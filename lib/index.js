/**
 * GitHub 雷达 — 宿主半侧。
 *
 * 负责浏览器做不了、或不该直接做的事：
 *   - 抓 github.com/trending（浏览器直连会被 CORS 挡住）
 *   - 取 raw.githubusercontent.com 的 README，并按需用模型翻成中文
 *   - git clone 到 $DSH_HOME/github-radar/repos/
 *   - 可选的 GitHub 登录（gh CLI 或手动 PAT）：私有仓库克隆、接口额度
 *
 * 浏览器半侧在 lib/client.js，通过同源 /github-radar/api/* 访问这里。
 */

import { mkdir, readFile, writeFile, stat, readdir, chmod, unlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';

/** Cordis 插件名。 */
export const name = 'github-radar';

/** 需要 Web 服务器的具名路由表。 */
export const inject = ['webServer'];

const PREFIX = '/github-radar/api';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const TRANSLATE_BATCH = 12000; // 每次翻译的字符预算，「继续翻译」按同样的预算再来一批

const LANGS = [
  ['', '全部语言'], ['typescript', 'TypeScript'], ['javascript', 'JavaScript'], ['python', 'Python'],
  ['rust', 'Rust'], ['go', 'Go'], ['c++', 'C++'], ['c', 'C'], ['java', 'Java'], ['swift', 'Swift'],
  ['kotlin', 'Kotlin'], ['ruby', 'Ruby'], ['php', 'PHP'], ['zig', 'Zig'], ['lua', 'Lua'],
  ['jupyter-notebook', 'Jupyter'], ['html', 'HTML'], ['shell', 'Shell'],
];

const decodeEntities = (s) => String(s)
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

const stripTags = (s) => decodeEntities(String(s).replace(/<[^>]*>/g, '')).trim();
const num = (s) => Number(String(s).replace(/[^\d]/g, '')) || 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 5xx 多半是 GitHub 边缘节点抖一下（/trending 偶发 504，十几秒才吐），再试一次通常就回来了；
 * 4xx 是确定性拒绝，重试没有意义。
 */
async function fetchText(url, timeout = 20000, headers = {}, retries = 1) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeout);
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, accept: '*/*', ...headers }, signal: ac.signal, redirect: 'follow' });
      if (!r.ok) {
        // 带上状态码，让调用方能区分「上游抽风」和「页面改版」
        const err = new Error(`HTTP ${r.status}`);
        err.status = r.status;
        throw err;
      }
      return await r.text();
    } catch (err) {
      lastErr = err;
      const status = err.status || 0;
      if (status >= 400 && status < 500) throw err;
      if (attempt < retries) await sleep(600 * (attempt + 1));
    } finally { clearTimeout(timer); }
  }
  throw lastErr;
}

/** 把上游状态码翻成人话；认不出来的错误原样透出。 */
function describeFetchError(err) {
  const status = err && err.status;
  if (status === 502 || status === 503 || status === 504) return `GitHub 网关超时（${status}），榜单没抓到`;
  if (status === 429) return 'GitHub 限流了（429），过一分钟再刷';
  if (status >= 500) return `GitHub 返回 ${status}，稍后再试`;
  return String(err?.message || err);
}

/** 从 trending 页面里抠出仓库卡片。页面结构变了就返回空数组。 */
export function parseTrending(html, since) {
  const blocks = html.split('<article class="Box-row"').slice(1);
  const out = [];
  for (const raw of blocks) {
    const blk = raw.slice(0, 20000);
    const head = /<h2[\s\S]{0,4000}?href="\/([^/"?#]+)\/([^/"?#]+)"/.exec(blk);
    if (!head) continue;
    const owner = head[1];
    const repo = head[2];
    const descM = /<p class="col-9[^"]*">([\s\S]*?)<\/p>/.exec(blk);
    const langM = /itemprop="programmingLanguage">([^<]+)</.exec(blk);
    const colorM = /repo-language-color" style="background-color: (#[0-9a-fA-F]{6})"/.exec(blk);
    const starM = /\/stargazers"[\s\S]*?<\/svg>\s*([\d,]+)/.exec(blk);
    const forkM = /\/forks"[\s\S]*?<\/svg>\s*([\d,]+)/.exec(blk);
    const deltaM = /float-sm-right[\s\S]{0,3000}?([\d,]+)\s+stars?\s+(today|this week|this month)/.exec(blk);
    out.push({
      owner, repo,
      fullName: `${owner}/${repo}`,
      url: `https://github.com/${owner}/${repo}`,
      desc: descM ? stripTags(descM[1]).replace(/\s+/g, ' ').trim() : '',
      lang: langM ? decodeEntities(langM[1]).trim() : '',
      color: colorM ? colorM[1] : '#8b949e',
      stars: starM ? num(starM[1]) : 0,
      forks: forkM ? num(forkM[1]) : 0,
      delta: deltaM ? num(deltaM[1]) : 0,
      since,
    });
  }
  return out;
}

export function apply(ctx) {
  // llm 是可选的：有的 profile 不挂模型。用嵌套 inject 拿，缺了也不会让插件加载失败。
  let llmCtx = null;
  ctx.inject(['llm'], (inner) => {
    llmCtx = inner;
    return () => { llmCtx = null; };
  });

  // 按家目录规则分层：克隆下来的都是 git 仓库，落 ~/Code；插件自己的状态落 ~/Data。
  const root = process.env.GITHUB_RADAR_HOME || path.join(homedir(), 'Data', 'github-radar');
  const repos = process.env.GITHUB_RADAR_CODE || path.join(homedir(), 'Code');
  const store = path.join(root, 'collection.json');
  const authFile = path.join(root, 'auth.json');
  const trDir = path.join(root, 'translations');

  let modelChoice;

  const send = (res, code, body) => {
    const buf = Buffer.from(JSON.stringify(body));
    res.writeHead(code, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': buf.length,
      'cache-control': 'no-store',
    });
    res.end(buf);
  };

  const readBody = (req) => new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 2e6) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (err) { reject(err); } });
    req.on('error', reject);
  });

  const readStore = async () => {
    try { return JSON.parse(await readFile(store, 'utf8')); } catch { return { items: [] }; }
  };

  const listClones = async () => {
    try {
      const entries = await readdir(repos, { withFileTypes: true });
      // ~/Code 里还有用户自己的仓库，只认本插件命名的 <owner>__<repo>
      return entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('.') && /^[\w.-]+__[\w.-]+$/.test(e.name))
        .map((e) => e.name);
    } catch { return []; }
  };

  /* ---------- GitHub 身份 ---------- */

  const readSavedToken = async () => {
    try { return JSON.parse(await readFile(authFile, 'utf8')).token || ''; } catch { return ''; }
  };

  const ghCliToken = () => new Promise((resolve) => {
    let done = false;
    const fin = (v) => { if (!done) { done = true; resolve(v); } };
    const child = spawn('gh', ['auth', 'token'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    child.stdout.on('data', (b) => { out += b.toString(); });
    child.on('error', () => fin(''));
    child.on('close', (code) => fin(code === 0 ? out.trim() : ''));
    setTimeout(() => { try { child.kill(); } catch {} fin(''); }, 5000);
  });

  const resolveToken = async () => {
    const saved = await readSavedToken();
    if (saved) return { token: saved, source: 'pat' };
    const cli = await ghCliToken();
    if (cli) return { token: cli, source: 'gh' };
    return { token: '', source: '' };
  };

  const gh = async (token, apiPath, init = {}) => {
    const r = await fetch(`https://api.github.com${apiPath}`, {
      ...init,
      headers: {
        'user-agent': UA,
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
    });
    return r;
  };

  const whoami = async (token) => {
    try {
      const r = await gh(token, '/user');
      if (!r.ok) return null;
      const u = await r.json();
      return { login: u.login, name: u.name || '', avatar: u.avatar_url || '' };
    } catch { return null; }
  };

  /* ---------- 数据 ---------- */

  const trendingFile = path.join(root, 'trending.json');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const readTrendingStore = async () => {
    try {
      const saved = JSON.parse(await readFile(trendingFile, 'utf8'));
      return saved && typeof saved === 'object' && saved.stores ? saved : { stores: {} };
    } catch { return { stores: {} }; }
  };

  /**
   * 榜单按天缓存：同一天内直接读盘，不重复打 GitHub；
   * 跨天或显式 force 才重新抓。抓失败时退回上一次的缓存（标 stale）。
   */
  const trending = async (since, lang, force) => {
    const key = `${since}|${lang || 'all'}`;
    const today = dayKey();
    const store = await readTrendingStore();
    const hit = store.stores[key];
    if (!force && hit && hit.day === today && Array.isArray(hit.items) && hit.items.length) {
      return { items: hit.items, at: hit.at, day: hit.day, cached: true };
    }
    try {
      const qs = new URLSearchParams({ since });
      if (lang) qs.set('language', lang);
      const items = parseTrending(await fetchText(`https://github.com/trending?${qs}`), since);
      if (!items.length) throw new Error('页面结构解析失败，GitHub 可能改版了');
      const at = Date.now();
      store.stores[key] = { at, day: today, items };
      // 只保留当天的条目，文件不会越滚越大
      for (const k of Object.keys(store.stores)) {
        if (!store.stores[k] || store.stores[k].day !== today) delete store.stores[k];
      }
      await mkdir(root, { recursive: true });
      await writeFile(trendingFile, JSON.stringify(store), 'utf8');
      return { items, at, day: today, cached: false };
    } catch (err) {
      const reason = describeFetchError(err);
      if (hit && Array.isArray(hit.items) && hit.items.length) {
        return { items: hit.items, at: hit.at, day: hit.day, cached: true, stale: true, error: reason };
      }
      throw new Error(reason);
    }
  };

  const readme = async (owner, repo) => {
    for (const ref of ['HEAD', 'main', 'master']) {
      for (const n of ['README.md', 'readme.md', 'README.MD', 'README.rst', 'README.txt']) {
        try {
          const text = await fetchText(`https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${n}`, 12000);
          if (text) return { name: n, text: text.slice(0, 60000) };
        } catch { /* 继续试下一个 */ }
      }
    }
    return null;
  };

  const clone = async (owner, repo) => {
    const token = (await resolveToken()).token;
    const dir = `${owner}__${repo}`;
    const target = path.join(repos, dir);
    const existing = await stat(target).catch(() => null);
    if (existing?.isDirectory()) return { ok: true, dir, path: target, existed: true };
    await mkdir(repos, { recursive: true });

    const env = { ...process.env };
    if (token) {
      // 走 GIT_CONFIG_* 环境变量，避免 token 出现在 argv / .git/config 里
      env.GIT_CONFIG_COUNT = '1';
      env.GIT_CONFIG_KEY_0 = 'http.https://github.com/.extraheader';
      env.GIT_CONFIG_VALUE_0 = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`;
    }

    return new Promise((resolve) => {
      const child = spawn('git', ['clone', '--depth', '1', '--single-branch', `https://github.com/${owner}/${repo}.git`, target], { stdio: ['ignore', 'pipe', 'pipe'], env });
      let log = '';
      const cap = (b) => { log += b.toString().replace(/x-access-token:[^@\s]+/g, '<token>'); if (log.length > 4000) log = log.slice(-4000); };
      child.stdout.on('data', cap);
      child.stderr.on('data', cap);
      const timer = setTimeout(() => child.kill('SIGKILL'), 120000);
      child.on('error', (err) => { clearTimeout(timer); resolve({ ok: false, error: String(err.message || err) }); });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve({ ok: true, dir, path: target, existed: false });
        else resolve({ ok: false, error: log.trim().split('\n').slice(-3).join(' ').slice(0, 300) || `git 退出码 ${code}` });
      });
    });
  };

  /* ---------- 翻译 ---------- */

  const settingsFile = path.join(root, 'settings.json');
  const readSettings = async () => {
    try { return JSON.parse(await readFile(settingsFile, 'utf8')); } catch { return {}; }
  };
  const saveSettings = async (patch) => {
    const next = { ...(await readSettings()), ...patch };
    await mkdir(root, { recursive: true });
    await writeFile(settingsFile, JSON.stringify(next, null, 2), 'utf8');
    return next;
  };

  const FREE_ENGINE = 'free';
  const GOOGLE_ENGINE = 'google';
  const googleFile = path.join(root, 'google.json');

  const readGoogleKey = async () => {
    try { return JSON.parse(await readFile(googleFile, 'utf8')).key || ''; } catch { return ''; }
  };
  const saveGoogleKey = async (key) => {
    await mkdir(root, { recursive: true });
    await writeFile(googleFile, JSON.stringify({ key, at: Date.now() }), 'utf8');
    await chmod(googleFile, 0o600).catch(() => {});
  };

  const decodeHtml = (s) => String(s)
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

  /** Google Cloud Translation v2：一次请求 30k 码点 / 128 段，够我们按段落调。 */
  const googleTranslate = async (text) => {
    const key = await readGoogleKey();
    if (!key) throw new Error('还没配 Google API key');
    const r = await fetch('https://translation.googleapis.com/language/translate/v2?key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ q: [text], source: 'en', target: 'zh-CN', format: 'text' }),
      signal: AbortSignal.timeout(30000),
    });
    const body = await r.json().catch(() => null);
    if (!r.ok) {
      const msg = body?.error?.message || `Google 返回 ${r.status}`;
      if (r.status === 403 || r.status === 400) throw new Error(msg);
      throw new Error(msg);
    }
    const out = body?.data?.translations?.[0]?.translatedText || '';
    if (!out) throw new Error('Google 没有返回译文');
    return decodeHtml(out);
  };

  let engineCache;
  /** 可选引擎：免费机翻 + 当前 profile 里所有提供方的所有模型。 */
  const listEngines = async () => {
    if (engineCache && Date.now() - engineCache.at < 60 * 1000) return engineCache.data;
    const models = [];
    if (llmCtx?.llm) {
      const providers = llmCtx.llm.listProviders?.() || [];
      for (const provider of providers) {
        let list = [];
        try { list = await llmCtx.llm.listModels(provider.id); } catch { /* 该提供方不可用就跳过 */ }
        for (const m of list) models.push({ id: `model:${provider.id}/${m.id}`, provider: provider.id, model: m.id, label: m.id });
      }
    }
    // 同名模型（不同提供方）加提供方后缀，下拉里才分得清
    const counts = models.reduce((acc, m) => { acc[m.label] = (acc[m.label] || 0) + 1; return acc; }, {});
    for (const m of models) if (counts[m.label] > 1) m.label = `${m.label} · ${m.provider}`;
    // 默认优先用 DSH 账号里的模型（account），其次 flash/mini 这类小模型——
    // 翻译不需要强模型，而官方 API key 可能没配或已失效。
    const score = (m) => (/account/i.test(m.provider) ? 2 : 0) + (/flash|mini|lite|small/i.test(m.label) ? 1 : 0);
    models.sort((a, b) => score(b) - score(a));
    const settings = await readSettings();
    const known = models.some((m) => m.id === settings.engine);
    const data = {
      google: { id: GOOGLE_ENGINE, label: 'Google 翻译', configured: Boolean(await readGoogleKey()) },
      free: { id: FREE_ENGINE, label: '免费机翻 · MyMemory', note: '不花模型额度；单次 500 字符、每天约 1000 词' },
      models,
      // 默认用模型；免费机翻额度很紧（很快 429），只在手动选中时才用
      current: settings.engine === FREE_ENGINE || settings.engine === GOOGLE_ENGINE || known
        ? settings.engine
        : (models[0]?.id || FREE_ENGINE),
    };
    engineCache = { at: Date.now(), data };
    return data;
  };

  const freeTranslate = async (text) => {
    const url = 'https://api.mymemory.translated.net/get?langpair=en|zh-CN&q=' + encodeURIComponent(text);
    let raw;
    try {
      raw = await fetchText(url, 25000);
    } catch (err) {
      if (/HTTP 429/.test(String(err.message))) throw new Error('免费机翻被限流了（429），换模型或过一会儿再试');
      throw err;
    }
    let body;
    try { body = JSON.parse(raw); } catch { throw new Error('机翻服务返回了非 JSON'); }
    const status = String(body.responseStatus || '');
    if (status !== '200') throw new Error(body.responseDetails || `机翻服务返回 ${status}`);
    const out = body.responseData?.translatedText;
    if (!out) throw new Error('机翻没有返回内容');
    if (/MYMEMORY WARNING|QUOTA|USAGE LIMIT/i.test(out)) throw new Error(out.slice(0, 120));
    return out;
  };

  /** MyMemory 单次最多 500 字符，按句子边界切开。 */
  const splitForFree = (text, size = 480) => {
    const parts = [];
    let rest = text;
    while (rest.length > size) {
      const win = rest.slice(0, size);
      let cut = Math.max(win.lastIndexOf('. '), win.lastIndexOf('! '), win.lastIndexOf('? '), win.lastIndexOf('。'), win.lastIndexOf('\n'));
      if (cut < size * 0.4) cut = win.lastIndexOf(' ');
      if (cut < size * 0.4) cut = size - 1;
      parts.push(rest.slice(0, cut + 1));
      rest = rest.slice(cut + 1);
    }
    if (rest.trim()) parts.push(rest);
    return parts;
  };

  // 缓存按「仓库 + 引擎」分文件，按批次存：每翻完一批就落盘，中途关掉也不白跑，
  // 「继续翻译」时直接从下一段接着来。
  const safeEngine = (id) => String(id).replace(/[^\w.-]+/g, '_');
  const trPath = (owner, repo, engine) => path.join(trDir, `${owner}__${repo}__${safeEngine(engine)}.json`);
  const trHash = (text) => createHash('sha1').update(text).digest('hex').slice(0, 16);

  const readCache = async (owner, repo, engine, hash) => {
    try {
      const saved = JSON.parse(await readFile(trPath(owner, repo, engine), 'utf8'));
      if (saved.hash !== hash || !Array.isArray(saved.chunks)) return null;
      return saved;
    } catch { return null; }
  };

  const writeCache = async (owner, repo, engine, hash, chunk) => {
    try {
      await mkdir(trDir, { recursive: true });
      let saved = await readCache(owner, repo, engine, hash);
      if (!saved) saved = { hash, engine, chunks: [] };
      saved.chunks = saved.chunks.filter((c) => c.from !== chunk.from);
      saved.chunks.push(chunk);
      saved.chunks.sort((a, b) => a.from - b.from);
      saved.more = !!chunk.more;
      saved.at = Date.now();
      await writeFile(trPath(owner, repo, engine), JSON.stringify(saved), 'utf8');
    } catch { /* 缓存失败不影响结果 */ }
  };

  /**
   * 把 README 切成「代码块」与「正文段」两类，并记下它们在原文里的位置。
   * 代码块原样保留、只翻正文，位置信息用来分批翻译（翻到哪、下次从哪继续）。
   */
  const segmentMarkdown = (text, maxChars) => {
    const out = [];
    const fence = /```[\s\S]*?```|~~~[\s\S]*?~~~/g;
    const pushText = (chunk, base) => {
      const gaps = /\n{2,}/g;
      const spans = [];
      let last = 0;
      let m;
      while ((m = gaps.exec(chunk)) !== null) {
        spans.push([last, m.index]);
        last = m.index + m[0].length;
      }
      spans.push([last, chunk.length]);
      let buf = null;
      for (const [s, e] of spans) {
        if (s >= e) continue;
        const para = chunk.slice(s, e);
        if (buf && buf.text.length + para.length + 2 > maxChars) {
          out.push({ type: 'text', text: buf.text, start: buf.start, end: buf.end });
          buf = null;
        }
        if (buf) { buf.text += '\n\n' + para; buf.end = base + e; }
        else buf = { text: para, start: base + s, end: base + e };
      }
      if (buf) out.push({ type: 'text', ...buf });
    };
    let last = 0;
    let m;
    while ((m = fence.exec(text)) !== null) {
      if (m.index > last) pushText(text.slice(last, m.index), last);
      out.push({ type: 'code', text: m[0], start: m.index, end: m.index + m[0].length });
      last = m.index + m[0].length;
    }
    if (last < text.length) pushText(text.slice(last), last);
    return out;
  };

  const SYSTEM_PROMPT = '你是技术文档翻译。把用户给出的 GitHub README 正文片段翻译成简体中文。要求：保留 Markdown 语法（标题、列表、粗体、链接、行内代码）；项目名、函数名、参数名、路径、命令、URL 保持原样不译；不要输出任何解释、前言或结语；不要续写内容，也不要补充原文没有的代码。';

  const translate = async (res, owner, repo, options = {}) => {
    const { force, engine: requested } = options;
    const offset = Math.max(0, Number(options.offset) || 0);
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    const emit = (obj) => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(obj)}\n\n`); };
    let closed = false;
    const ac = new AbortController();
    res.on('close', () => { closed = true; ac.abort(); });

    try {
      const doc = await readme(owner, repo);
      if (!doc) throw new Error('没找到 README');
      const full = doc.text.replace(/<!--[\s\S]*?-->/g, '');
      const hash = trHash(full);

      const engines = await listEngines();
      let engine = requested || engines.current;
      const isKnown = engine === FREE_ENGINE || engine === GOOGLE_ENGINE || engines.models.some((m) => m.id === engine);
      if (!isKnown) engine = engines.current;
      const engineLabel = engine === FREE_ENGINE ? engines.free.label : engine === GOOGLE_ENGINE ? engines.google.label : engine.replace(/^model:/, '');
      emit({ engine, engineLabel, offset, total: full.length });

      const cached = force ? null : await readCache(owner, repo, engine, hash);
      if (cached && cached.chunks.length) {
        const hit = offset === 0
          ? { text: cached.chunks.map((c) => c.text).join(''), to: cached.chunks[cached.chunks.length - 1].to, more: !!cached.chunks[cached.chunks.length - 1].more }
          : cached.chunks.find((c) => c.from === offset);
        if (hit) {
          emit({ cached: true });
          emit({ text: hit.text });
          emit({ more: !!hit.more, nextOffset: hit.to, total: full.length });
          emit({ done: true });
          return res.end();
        }
      }

      const segments = segmentMarkdown(full, 2400);
      let idx = 0;
      while (idx < segments.length && segments[idx].end <= offset) idx += 1;

      let out = '';
      let used = 0;
      let degraded = false;
      let fellBack = false;
      let index = 0;
      const total = segments.filter((s) => s.type === 'text' && s.end > offset).length;

      const askModel = async (provider, model, text) => {
        const messages = [
          { role: 'system', content: [{ type: 'text', text: SYSTEM_PROMPT }] },
          { role: 'user', content: [{ type: 'text', text }] },
        ];
        let piece = '';
        for await (const chunk of llmCtx.llm.stream({ provider, model, messages, maxTokens: 4096, signal: ac.signal })) {
          if (closed) break;
          if (chunk?.type === 'text-delta' && chunk.text) { piece += chunk.text; emit({ delta: chunk.text }); }
          else if (chunk?.type === 'error') throw new Error(String(chunk.error?.message || chunk.message || '模型调用失败'));
          else if (chunk?.type === 'finish') {
            const reason = chunk.reason || {};
            if (reason.kind === 'error' || reason.kind === 'aborted') {
              throw new Error(String(reason.failure?.message || '模型调用失败'));
            }
          }
        }
        return piece;
      };

      const runChunk = async (text) => {
        if (engine === GOOGLE_ENGINE) {
          try {
            const piece = await googleTranslate(text);
            emit({ delta: piece });
            return piece;
          } catch (err) {
            const fallback = engines.models[0];
            if (!fallback) throw err;
            engine = fallback.id;
            fellBack = true;
            emit({ notice: `Google 翻译不可用（${err.message}），改用 ${fallback.label}` });
            emit({ engine, engineLabel: fallback.label });
            return askModel(fallback.provider, fallback.model, text);
          }
        }
        if (engine !== FREE_ENGINE) {
          const [provider, model] = engine.slice('model:'.length).split('/');
          return askModel(provider, model, text);
        }
        try {
          let acc = '';
          for (const part of splitForFree(text)) {
            if (closed) return acc;
            await new Promise((r) => setTimeout(r, 250));
            const piece = await freeTranslate(part);
            acc += piece;
            emit({ delta: piece });
          }
          return acc;
        } catch (err) {
          const fallback = engines.models[0];
          if (!fallback) throw err;
          engine = fallback.id;
          fellBack = true;
          emit({ notice: `免费机翻不可用（${err.message}），改用 ${fallback.label}` });
          emit({ engine, engineLabel: fallback.label });
          return askModel(fallback.provider, fallback.model, text);
        }
      };

      for (; idx < segments.length; idx += 1) {
        if (closed) return;
        const seg = segments[idx];
        if (seg.type === 'code') {
          out += seg.text;
          emit({ delta: seg.text });
          continue;
        }
        // 到这一批的预算了：停下来，把「继续翻译」的位置交给前端
        if (used > 0 && used + seg.text.length > TRANSLATE_BATCH) break;
        index += 1;
        emit({ progress: { part: index, total } });
        let piece = await runChunk(seg.text);
        if (!piece.trim() && !closed) {
          emit({ delta: seg.text });
          piece = seg.text;
          degraded = true;
        }
        if (closed) return;
        out += piece;
        used += seg.text.length;
        if (idx < segments.length - 1) {
          const nl = seg.text.endsWith('\n') ? '' : '\n\n';
          if (nl) { out += nl; emit({ delta: nl }); }
        }
        await writeCache(owner, repo, engine, hash, { from: offset, to: segments[idx].end, text: out, more: true });
      }

      if (closed) return;

      const nextOffset = idx < segments.length ? segments[idx].start : full.length;
      const more = idx < segments.length;

      if (degraded) {
        const note = '\n\n（有段落没给出译文，已保留原文。）';
        out += note;
        emit({ delta: note });
      }
      if (fellBack) {
        const note = '\n\n（本次中途从免费机翻切到了模型。）';
        out += note;
        emit({ delta: note });
      }

      await writeCache(owner, repo, engine, hash, { from: offset, to: nextOffset, text: out, more });
      emit({ more, nextOffset, total: full.length });
      emit({ done: true });
      res.end();
    } catch (err) {
      if (!closed) {
        emit({ error: String(err?.message || err) });
        try { res.end(); } catch { /* 已经关了 */ }
      }
    }
  };

  /* ---------- 路由 ---------- */

  const handler = async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const route = url.pathname.slice(PREFIX.length);
    try {
      if (route === '/trending' && req.method === 'GET') {
        const since = ['daily', 'weekly', 'monthly'].includes(url.searchParams.get('since')) ? url.searchParams.get('since') : 'daily';
        const lang = (url.searchParams.get('lang') || '').trim();
        const force = url.searchParams.get('force') === '1';
        const result = await trending(since, lang, force);
        return send(res, 200, {
          since,
          items: result.items,
          langs: LANGS.map(([value, label]) => ({ value, label })),
          at: result.at,
          cached: !!result.cached,
          stale: !!result.stale,
          ...(result.error ? { error: result.error } : {}),
        });
      }

      if (route === '/state' && req.method === 'GET') {
        const data = await readStore();
        return send(res, 200, { collection: data.items || [], clones: await listClones(), root, repos });
      }

      if (route === '/collection' && req.method === 'POST') {
        const body = await readBody(req);
        const data = await readStore();
        const items = Array.isArray(data.items) ? data.items : [];
        const key = (i) => String(i?.fullName || '').toLowerCase();
        const item = body.item || {};
        if (body.action === 'remove') data.items = items.filter((i) => key(i) !== key(item));
        else if (body.action === 'add' && key(item)) {
          data.items = items.some((i) => key(i) === key(item)) ? items : [{ ...item, addedAt: Date.now() }, ...items];
        } else data.items = items;
        await mkdir(root, { recursive: true });
        await writeFile(store, JSON.stringify(data, null, 2), 'utf8');
        return send(res, 200, { ok: true, collection: data.items });
      }

      if (route === '/clone' && req.method === 'POST') {
        const { owner, repo } = await readBody(req);
        if (!/^[\w.-]+$/.test(owner || '') || !/^[\w.-]+$/.test(repo || '')) return send(res, 400, { ok: false, error: '仓库名不合法' });
        const r = await clone(owner, repo);
        return send(res, r.ok ? 200 : 502, r);
      }

      if (route === '/readme' && req.method === 'GET') {
        const owner = url.searchParams.get('owner') || '';
        const repo = url.searchParams.get('repo') || '';
        if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) return send(res, 400, { ok: false, error: '仓库名不合法' });
        const found = await readme(owner, repo);
        return found ? send(res, 200, { ok: true, ...found }) : send(res, 404, { ok: false, error: '没找到 README' });
      }

      if (route === '/reveal' && req.method === 'POST') {
        const { dir } = await readBody(req);
        const target = path.join(repos, String(dir || '').replace(/[/\\]/g, ''));
        if (!target.startsWith(repos)) return send(res, 400, { ok: false, error: '路径不合法' });
        const ok = await stat(target).then((s) => s.isDirectory()).catch(() => false);
        if (!ok) return send(res, 404, { ok: false, error: '目录不存在' });
        if (process.platform === 'darwin') spawn('open', [target], { stdio: 'ignore', detached: true }).unref();
        return send(res, 200, { ok: true, path: target });
      }

      /* ----- 登录 ----- */

      if (route === '/auth' && req.method === 'GET') {
        const { token, source } = await resolveToken();
        if (!token) return send(res, 200, { connected: false, source: '' });
        const user = await whoami(token);
        if (!user) return send(res, 200, { connected: false, source, error: 'token 无效或已过期' });
        return send(res, 200, { connected: true, source, ...user });
      }

      if (route === '/auth' && req.method === 'POST') {
        const { token } = await readBody(req);
        const trimmed = String(token || '').trim();
        if (!/^[A-Za-z0-9_]{20,}$/.test(trimmed)) return send(res, 400, { ok: false, error: 'token 格式不对' });
        const user = await whoami(trimmed);
        if (!user) return send(res, 400, { ok: false, error: 'GitHub 不认这个 token' });
        await mkdir(root, { recursive: true });
        await writeFile(authFile, JSON.stringify({ token: trimmed, login: user.login, at: Date.now() }), 'utf8');
        await chmod(authFile, 0o600).catch(() => {});
        return send(res, 200, { ok: true, connected: true, source: 'pat', ...user });
      }

      if (route === '/auth' && req.method === 'DELETE') {
        await unlink(authFile).catch(() => {});
        return send(res, 200, { ok: true, connected: false, source: '' });
      }

      /* ----- 翻译 ----- */

      if (route === '/engines' && req.method === 'GET') {
        return send(res, 200, await listEngines());
      }

      if (route === '/engines' && req.method === 'POST') {
        const { engine } = await readBody(req);
        const list = await listEngines();
        const ok = engine === FREE_ENGINE || engine === GOOGLE_ENGINE || list.models.some((m) => m.id === engine);
        if (!ok) return send(res, 400, { ok: false, error: '未知的翻译引擎' });
        if (engine === GOOGLE_ENGINE && !list.google.configured) {
          return send(res, 400, { ok: false, error: '还没配 Google API key' });
        }
        await saveSettings({ engine });
        engineCache = undefined;
        return send(res, 200, { ok: true, current: engine });
      }

      if (route === '/google' && req.method === 'POST') {
        const { key } = await readBody(req);
        const value = String(key || '').trim();
        if (!/^[A-Za-z0-9_-]{20,}$/.test(value)) return send(res, 400, { ok: false, error: 'key 格式不对' });
        await saveGoogleKey(value);
        try {
          const sample = await googleTranslate('hello');
          engineCache = undefined;
          return send(res, 200, { ok: true, sample });
        } catch (err) {
          await unlink(googleFile).catch(() => {});
          return send(res, 400, { ok: false, error: String(err.message || err) });
        }
      }

      if (route === '/google' && req.method === 'DELETE') {
        await unlink(googleFile).catch(() => {});
        engineCache = undefined;
        return send(res, 200, { ok: true });
      }

      if (route === '/translate' && req.method === 'POST') {
        const body = await readBody(req);
        const { owner, repo, force, engine } = body;
        if (!/^[\w.-]+$/.test(owner || '') || !/^[\w.-]+$/.test(repo || '')) {
          return send(res, 400, { ok: false, error: '仓库名不合法' });
        }
        return translate(res, owner, repo, { force: !!force, engine: engine ? String(engine) : '', offset: Number(body.offset) || 0 });
      }

      return send(res, 404, { ok: false, error: 'no route' });
    } catch (err) {
      if (res.headersSent) { try { res.end(); } catch {} return; }
      return send(res, 500, { ok: false, error: String(err?.message || err) });
    }
  };

  ctx.effect(() => {
    const dispose = ctx.webServer.register({ kind: 'prefix', path: PREFIX, handler });
    return () => dispose();
  }, 'github-radar: api routes');
}
