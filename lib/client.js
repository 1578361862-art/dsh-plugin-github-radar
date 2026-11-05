/**
 * GitHub 雷达 — 浏览器半侧。
 *
 * 一个全局面板（main 槽 + 侧栏入口）：浏览 GitHub 趋势仓库、收藏、
 * 读 README（可让模型翻成中文）、标星、一键浅克隆。
 * 所有网络与文件操作都走宿主半侧的 /github-radar/api/*，这里是纯 UI。
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-github-radar',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useRef, useCallback, useMemo } = React;

    const PANEL_ID = 'github-radar';
    const API = '/github-radar/api';

    /* ---------- 样式 ---------- */

    const CSS = `
.gr-page{--gr-bg:var(--dsw-alias-bg-base,#fff);--gr-panel:var(--dsw-alias-bg-layer-1,#f7f7f5);--gr-ink:var(--dsw-alias-label-primary,#141414);--gr-2:var(--dsw-alias-label-secondary,#454545);--gr-mute:var(--dsw-alias-label-tertiary,#6f6f6f);--gr-line:var(--dsw-alias-border-l3,rgba(0,0,0,.14));--gr-hover:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.045));--gr-accent:var(--dsw-alias-state-business-primary,#2f6bff);--gr-mark:#cdf26a;
display:flex;flex-direction:column;height:100%;min-height:0;background:var(--gr-bg);color:var(--gr-ink);font-size:14px;line-height:1.6;overflow:hidden;position:relative}
.gr-scroll{flex:1;min-height:0;overflow:auto;scrollbar-gutter:stable;--dsh-scrollbar-width:9px;--dsh-scrollbar-thumb-border:2px}
.gr-wrap{max-width:1240px;margin:0 auto;padding:0 clamp(20px,3.4vw,44px) 56px}
[data-platform=darwin] .gr-head{padding-top:calc(26px + var(--dsh-frame-top-clearance,0px))}
.gr-head{padding-top:26px;display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding-bottom:18px;border-bottom:.5px solid var(--gr-line)}
.gr-title{margin:0;font-size:20px;font-weight:500;line-height:28px;letter-spacing:-.01em}
.gr-sub{margin:4px 0 0;font-size:13px;color:var(--gr-mute)}
.gr-headright{flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:8px}
.gr-stamp{text-align:right;font-family:var(--dsw-font-mono,ui-monospace,monospace);font-size:11px;color:var(--gr-mute);line-height:1.7}
.gr-stamp b{display:block;color:var(--gr-2);font-weight:500}

.gr-auth{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:13px;border:.5px solid var(--gr-line);background:0 0;color:var(--gr-2);font:inherit;font-size:12px;cursor:pointer}
.gr-auth:hover{background:var(--gr-hover)}
.gr-auth i{width:6px;height:6px;border-radius:50%;background:var(--gr-mute);display:inline-block}
.gr-auth[data-on=true] i{background:#3fb950}
.gr-auth b{font-weight:500;color:var(--gr-ink)}

.gr-bar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:16px 0 14px}
.gr-tabs{display:inline-flex;gap:4px;background:var(--gr-panel);border-radius:14px;padding:3px}
.gr-tab{font:inherit;font-size:13px;line-height:22px;height:28px;padding:0 12px;border:0;border-radius:11px;background:0 0;color:var(--gr-mute);cursor:pointer}
.gr-tab:hover{color:var(--gr-ink)}
.gr-tab[data-on=true]{background:var(--gr-bg);color:var(--gr-ink);box-shadow:0 0 0 .5px var(--gr-line)}
.gr-field{display:flex;align-items:center;gap:6px;height:32px;padding:0 10px;border:.5px solid var(--gr-line);border-radius:12px;color:var(--gr-mute);transition:border-color .15s}
.gr-field:focus-within{border-color:var(--gr-accent)}
.gr-field input,.gr-field select{font:inherit;font-size:13px;color:var(--gr-ink);background:0 0;border:0;outline:0;height:100%;min-width:0}
.gr-field input{width:200px}
.gr-field input::placeholder{color:var(--gr-mute)}
.gr-grow{flex:1;min-width:180px}
.gr-grow input{width:100%}
.gr-btn{font:inherit;font-size:13px;line-height:20px;height:32px;padding:0 14px;border-radius:16px;border:.5px solid var(--gr-line);background:0 0;color:var(--gr-ink);cursor:pointer;white-space:nowrap}
.gr-btn:hover{background:var(--gr-hover)}
.gr-btn:disabled{opacity:.5;cursor:default}
.gr-btn.primary{background:var(--gr-ink);color:var(--gr-bg);border-color:var(--gr-ink)}
.gr-btn.primary:hover{opacity:.88}
.gr-btn.sm{height:26px;padding:0 10px;font-size:12px;border-radius:13px}

.gr-cols{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:clamp(20px,3vw,40px);align-items:start;padding-top:6px}
.gr-sec{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding-bottom:9px;border-bottom:.5px solid var(--gr-line)}
.gr-sec h2{margin:0;font-size:13px;font-weight:500;color:var(--gr-2)}
.gr-count{font-family:var(--dsw-font-mono,ui-monospace,monospace);font-size:11px;color:var(--gr-mute)}

.gr-row{display:grid;grid-template-columns:30px minmax(0,1fr) 88px 246px;gap:12px;align-items:center;padding:12px 8px 12px 0;border-bottom:.5px solid var(--gr-line)}
.gr-row:hover{background:var(--gr-hover)}
.gr-rank{font-family:var(--dsw-font-mono,ui-monospace,monospace);font-size:11px;color:var(--gr-mute);align-self:start;padding-top:5px}
.gr-name{margin:0;font-size:15px;font-weight:600;line-height:1.35;letter-spacing:-.005em;overflow-wrap:anywhere}
.gr-name a{color:var(--gr-ink);text-decoration:none}
.gr-name a:hover .gr-repo{text-decoration:underline;text-underline-offset:3px}
.gr-owner{color:var(--gr-mute);font-weight:400}
.gr-desc{margin:3px 0 0;font-size:13px;line-height:1.55;color:var(--gr-mute);max-width:66ch;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.gr-meta{display:flex;align-items:center;gap:7px;margin-top:6px;font-family:var(--dsw-font-mono,ui-monospace,monospace);font-size:11px;color:var(--gr-mute);flex-wrap:wrap}
.gr-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex:none}
.gr-delta{text-align:right;font-family:var(--dsw-font-mono,ui-monospace,monospace);line-height:1.1}
.gr-dnum{display:block;font-size:18px;font-weight:600;letter-spacing:-.02em}
.gr-dlab{display:block;font-size:10px;color:var(--gr-mute);margin-top:3px}
.gr-top .gr-dnum{background:linear-gradient(to top,var(--gr-mark) 0 3px,transparent 3px);padding:0 2px 3px;margin-right:-2px}
.gr-acts{display:flex;gap:5px;justify-content:flex-end;align-items:center}
.gr-acts .gr-btn.sm{padding:0 9px;font-size:11.5px}
.gr-star{width:26px;height:26px;padding:0;display:inline-flex;align-items:center;justify-content:center;border:.5px solid var(--gr-line);border-radius:13px;background:0 0;color:var(--gr-mute);cursor:pointer;flex:none}
.gr-star:hover{background:var(--gr-hover);color:var(--gr-ink)}
.gr-star[data-on=true]{color:#e3b341;border-color:color-mix(in srgb,#e3b341 45%,transparent)}

.gr-shelf{background:var(--gr-panel);border-radius:14px;padding:14px 14px 6px}
.gr-shelf h2{margin:0;font-size:13px;font-weight:500}
.gr-item{padding:10px 0;border-bottom:.5px solid var(--gr-line)}
.gr-item:last-child{border-bottom:0}
.gr-iname{font-size:13px;font-weight:600;overflow-wrap:anywhere}
.gr-iname a{color:var(--gr-ink);text-decoration:none}
.gr-iname a:hover{text-decoration:underline;text-underline-offset:3px}
.gr-imeta{display:flex;gap:6px;align-items:center;margin-top:3px;font-family:var(--dsw-font-mono,ui-monospace,monospace);font-size:10.5px;color:var(--gr-mute)}
.gr-iacts{display:flex;gap:5px;margin-top:7px;flex-wrap:wrap}
.gr-empty{padding:22px 0;font-size:12.5px;line-height:1.7;color:var(--gr-mute);border-bottom:.5px dashed var(--gr-line)}
.gr-empty b{color:var(--gr-ink);font-weight:500}

.gr-note{margin-top:16px;padding:22px 18px;border:.5px solid var(--gr-line);border-radius:12px;font-size:13px;line-height:1.7;color:var(--gr-mute)}
.gr-note b{display:block;color:var(--gr-ink);font-weight:500;margin-bottom:4px}
.gr-note .gr-btn{margin-top:12px}

.gr-sk{padding:16px 0;border-bottom:.5px solid var(--gr-line)}
.gr-sk i{display:block;height:9px;border-radius:2px;background:linear-gradient(90deg,var(--gr-hover),transparent,var(--gr-hover));background-size:200% 100%;animation:grSweep 1.3s linear infinite}
.gr-sk i+i{margin-top:8px}
.gr-sk i:nth-child(1){width:28%}.gr-sk i:nth-child(3){width:55%}
@keyframes grSweep{from{background-position:160% 0}to{background-position:-60% 0}}

.gr-modal{position:absolute;inset:0;background:rgba(0,0,0,.34);display:flex;align-items:center;justify-content:center;padding:28px;z-index:20}
.gr-modal-card{background:var(--gr-bg);border:.5px solid var(--gr-line);border-radius:16px;width:min(780px,100%);max-height:82%;display:flex;flex-direction:column;box-shadow:var(--dsw-elevation-prominent,0 18px 48px rgba(0,0,0,.18))}
.gr-modal-card.narrow{width:min(520px,100%)}
.gr-modal-head{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:.5px solid var(--gr-line);flex:none}
.gr-modal-head h3{margin:0;font-size:14px;font-weight:500;overflow-wrap:anywhere;flex:1;min-width:0}
.gr-modal-body{overflow:auto;padding:8px 22px 24px;font-size:13.5px;line-height:1.75;overflow-wrap:anywhere;scrollbar-gutter:stable;flex:1;min-height:120px}
.gr-modal-body code{font-family:var(--dsw-font-mono,ui-monospace,monospace);font-size:12px;background:var(--gr-hover);padding:1px 4px;border-radius:4px}
.gr-modal-body h1,.gr-modal-body h2,.gr-modal-body h3{font-weight:600;line-height:1.4}
.gr-modal-body h1{font-size:17px}.gr-modal-body h2{font-size:15px}.gr-modal-body h3{font-size:13.5px}
.gr-modal-body a{color:inherit;text-underline-offset:3px}
.gr-md h2,.gr-md h3,.gr-md h4{margin:18px 0 8px;font-weight:600;line-height:1.35;letter-spacing:-.005em}
.gr-md h2{font-size:17px}
.gr-md h3{font-size:15px}
.gr-md h4{font-size:13.5px;color:var(--gr-2)}
.gr-md p{margin:9px 0}
.gr-md ul,.gr-md ol{margin:9px 0;padding-left:22px}
.gr-md li{margin:3px 0}
.gr-md li>ul,.gr-md li>ol{margin:4px 0}
.gr-md pre{margin:12px 0;padding:10px 12px;border:.5px solid var(--gr-line);border-radius:10px;background:var(--gr-panel);overflow:auto;position:relative}
.gr-md pre code{background:0;padding:0;font-size:12px;line-height:1.6;font-family:var(--dsw-font-mono,ui-monospace,monospace);white-space:pre}
.gr-md pre[data-lang]::before{content:attr(data-lang);position:absolute;top:6px;right:10px;font-size:10px;color:var(--gr-mute);font-family:var(--dsw-font-mono,ui-monospace,monospace)}
.gr-md blockquote{margin:12px 0;padding:2px 14px;border-left:2px solid var(--gr-line);color:var(--gr-mute)}
.gr-md blockquote p{margin:6px 0}
.gr-md hr{border:0;border-top:.5px solid var(--gr-line);margin:18px 0}
.gr-md .gr-table{overflow:auto;margin:12px 0}
.gr-md table{border-collapse:collapse;font-size:12.5px}
.gr-md th,.gr-md td{border:.5px solid var(--gr-line);padding:6px 10px;text-align:left;vertical-align:top}
.gr-md th{background:var(--gr-panel);font-weight:600}
.gr-md img{max-width:100%;height:auto;vertical-align:middle}
.gr-md a{color:var(--gr-accent)}
.gr-md .gr-check{display:inline-block;width:12px;height:12px;border:.5px solid var(--gr-line);border-radius:3px;margin-right:6px;vertical-align:-1px}
.gr-md .gr-check.on{background:var(--gr-accent);border-color:var(--gr-accent)}
.gr-more{margin:18px 0 6px;padding:14px 16px;border:.5px dashed var(--gr-line);border-radius:12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:var(--gr-panel)}
.gr-more-txt{font-size:12px;line-height:1.6;color:var(--gr-mute);flex:1;min-width:180px}
.gr-modal-foot{flex:none;display:flex;align-items:center;gap:8px;padding:10px 16px;border-top:.5px solid var(--gr-line);font-size:11.5px;color:var(--gr-mute)}
.gr-engine{display:inline-flex;align-items:center;gap:6px}
.gr-engine select{font:inherit;font-size:11.5px;color:var(--gr-ink);background:0 0;border:.5px solid var(--gr-line);border-radius:9px;padding:2px 6px;outline:0}
.gr-engine select:focus-visible{border-color:var(--gr-accent)}
.gr-seg{display:inline-flex;gap:2px;background:var(--gr-panel);border-radius:11px;padding:2px;flex:none}
.gr-seg button{font:inherit;font-size:12px;height:24px;padding:0 10px;border:0;border-radius:9px;background:0 0;color:var(--gr-mute);cursor:pointer}
.gr-seg button[data-on=true]{background:var(--gr-bg);color:var(--gr-ink);box-shadow:0 0 0 .5px var(--gr-line)}
.gr-form{display:flex;flex-direction:column;gap:10px;padding:16px 18px 20px;font-size:12.5px;line-height:1.65;color:var(--gr-mute)}
.gr-form input{width:100%;box-sizing:border-box;height:34px;font:inherit;font-size:12.5px;padding:0 10px;border:.5px solid var(--gr-line);border-radius:10px;background:var(--gr-bg);color:var(--gr-ink);outline:0;font-family:var(--dsw-font-mono,ui-monospace,monospace)}
.gr-form input:focus{border-color:var(--gr-accent)}
.gr-form textarea{width:100%;box-sizing:border-box;min-height:64px;resize:vertical;font:inherit;font-size:12.5px;padding:8px 10px;border:.5px solid var(--gr-line);border-radius:10px;background:var(--gr-bg);color:var(--gr-ink);outline:0}
.gr-form textarea:focus{border-color:var(--gr-accent)}
.gr-form code{font-family:var(--dsw-font-mono,ui-monospace,monospace);font-size:11.5px;background:var(--gr-hover);padding:1px 4px;border-radius:4px}
.gr-form .gr-rowline{display:flex;gap:8px;align-items:center}
.gr-err{color:var(--dsw-alias-state-error-primary,#d93a3a)}
.gr-hint{font-size:11.5px}
.gr-toast{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);background:var(--gr-ink);color:var(--gr-bg);font-size:12px;padding:8px 14px;border-radius:10px;max-width:70%;z-index:30}
.gr-page :focus-visible{outline:2px solid var(--gr-accent);outline-offset:2px}
@media (max-width:1060px){.gr-cols{grid-template-columns:minmax(0,1fr)}.gr-row{grid-template-columns:26px minmax(0,1fr) 80px}.gr-acts{grid-column:2/-1;justify-content:flex-start}}
@media (max-width:640px){.gr-row{grid-template-columns:22px minmax(0,1fr)}.gr-delta{grid-column:2;text-align:left;display:flex;align-items:baseline;gap:8px}.gr-dlab{margin-top:0}.gr-acts{grid-column:2}.gr-head{flex-direction:column}.gr-headright{align-items:flex-start}}
`;

    let styleEl = null;
    function mountCss() {
      if (typeof document === 'undefined' || styleEl) return;
      styleEl = document.createElement('style');
      styleEl.dataset.plugin = 'dsh-plugin-github-radar';
      styleEl.textContent = CSS;
      document.head.appendChild(styleEl);
    }
    function unmountCss() {
      if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
      styleEl = null;
    }

    /* ---------- 图标 ---------- */

    function RadarIcon({ size = 16 }) {
      return h('svg', { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, 'aria-hidden': true },
        h('circle', { cx: 8, cy: 8, r: 6.2 }),
        h('circle', { cx: 8, cy: 8, r: 3.1, opacity: 0.55 }),
        h('circle', { cx: 8, cy: 8, r: 1, fill: 'currentColor', stroke: 'none' }),
        h('path', { d: 'M8 8 12.6 3.4' }));
    }

    function StarIcon({ filled }) {
      return h('svg', { width: 13, height: 13, viewBox: '0 0 16 16', fill: filled ? 'currentColor' : 'none', stroke: 'currentColor', strokeWidth: 1.3, 'aria-hidden': true },
        h('path', { d: 'M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6 4.2 13.6l.7-4.3-3.1-3 4.3-.6z', strokeLinejoin: 'round' }));
    }

    /* ---------- 工具 ---------- */

    const esc = (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const fmt = (n) => (n >= 1000 ? String(Math.round(n / 100) / 10).replace(/\.0$/, '') + 'k' : String(n));
    const keyOf = (s) => String(s || '').toLowerCase();

    async function api(path, opts) {
      const res = await fetch(API + path, { headers: { 'content-type': 'application/json' }, ...opts });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || '请求失败 ' + res.status);
      return body;
    }

    /* ---------- Markdown ---------- */

    const rawBase = (m) => (m && m.owner && m.repo ? `https://raw.githubusercontent.com/${m.owner}/${m.repo}/HEAD/` : '');

    const escHtml = (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // README 里的图片/链接常写成相对路径，按仓库 raw 地址补齐，否则全是破图
    const resolveUrl = (u, base) => {
      const v = String(u || '').trim();
      if (!v) return '#';
      if (/^(https?:)?\/\//i.test(v)) return v;
      if (/^(#|mailto:)/i.test(v)) return v;
      if (!base) return v;
      return base + v.replace(/^\.?\//, '');
    };

    /** 行内：代码 → 图片 → 链接 → 粗体/斜体/删除线，按占位符保护行内代码。 */
    let mdBase = '';

    function inlineMd(text, base) {
      base = base === undefined ? mdBase : base;
      const codes = [];
      let out = escHtml(text)
        .replace(/`([^`]+)`/g, (_, code) => { codes.push(code); return '\u0000' + (codes.length - 1) + '\u0000'; })
        .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
          (_, alt, src) => `<img src="${escHtml(resolveUrl(src, base))}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer">`)
        .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
          (_, label, href) => `<a href="${escHtml(resolveUrl(href, base))}" target="_blank" rel="noreferrer">${label}</a>`)
        .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
        .replace(/__([^_]+)__/g, '<b>$1</b>')
        .replace(/(^|[\s(（])[*_]([^*_\n]+)[*_]/g, '$1<i>$2</i>')
        .replace(/~~([^~]+)~~/g, '<s>$1</s>');
      out = out.replace(/\u0000(\d+)\u0000/g, (_, i) => '<code>' + codes[Number(i)] + '</code>');
      return out;
    }

    const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
    const FENCE_RE = /^\s*(```|~~~)\s*([\w+#.-]*)\s*$/;
    const HEAD_RE = /^(#{1,6})\s+(.*)$/;
    const HR_RE = /^\s*([-*_])(\s*\1){2,}\s*$/;
    const QUOTE_RE = /^\s*>/;
    const TABLE_SEP_RE = /^\s*\|?[\s:|-]+\|[\s:|-]*$/;

    function isBlockStart(line, next) {
      return FENCE_RE.test(line) || HEAD_RE.test(line) || HR_RE.test(line) ||
        QUOTE_RE.test(line) || LIST_RE.test(line) ||
        (next !== undefined && /\|/.test(line) && TABLE_SEP_RE.test(next));
    }

    function renderList(items, idx, indent) {
      const ordered = items[idx].ordered;
      let html = ordered ? '<ol>' : '<ul>';
      while (idx < items.length && items[idx].indent >= indent) {
        if (items[idx].indent > indent) {
          const [sub, next] = renderList(items, idx, items[idx].indent);
          html += sub;
          idx = next;
          continue;
        }
        let body = items[idx].text;
        let box = '';
        const task = /^\[([ xX])\]\s+(.*)$/.exec(body);
        if (task) {
          box = '<span class="gr-check' + (task[1].toLowerCase() === 'x' ? ' on' : '') + '" aria-hidden="true"></span>';
          body = task[2];
        }
        html += '<li>' + box + inlineMd(body);
        idx += 1;
        if (idx < items.length && items[idx].indent > indent) {
          const [sub, next] = renderList(items, idx, items[idx].indent);
          html += sub;
          idx = next;
        }
        html += '</li>';
      }
      html += ordered ? '</ol>' : '</ul>';
      return [html, idx];
    }

    /** README 里混着裸 HTML（<picture> 徽章、<details> 折叠块）。去掉标签、只留文字，避免原样漏出来。 */
    function cleanSource(src) {
      return String(src || '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
        .replace(/<\/?[a-zA-Z][^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
    }

    /** 够用的 README 渲染器：标题、段落、列表、代码块、表格、引用、分隔线、图片、行内样式。 */
    function mdToHtml(src, base) {
      const previous = mdBase;
      mdBase = base === undefined ? previous : base;
      const lines = cleanSource(src).replace(/\r\n?/g, '\n').split('\n');
      const out = [];
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) { i += 1; continue; }

        const fence = FENCE_RE.exec(line);
        if (fence) {
          const mark = fence[1];
          const lang = fence[2] || '';
          const buf = [];
          i += 1;
          while (i < lines.length && !lines[i].trim().startsWith(mark)) { buf.push(lines[i]); i += 1; }
          i += 1;
          out.push('<pre' + (lang ? ` data-lang="${escHtml(lang)}"` : '') + '><code>' + escHtml(buf.join('\n')) + '</code></pre>');
          continue;
        }

        const head = HEAD_RE.exec(line);
        if (head) {
          const level = Math.min(head[1].length + 1, 4); // README 的 # 当页面标题太大，降一级
          out.push(`<h${level}>${inlineMd(head[2].replace(/\s+#+\s*$/, ''))}</h${level}>`);
          i += 1;
          continue;
        }

        if (HR_RE.test(line)) { out.push('<hr>'); i += 1; continue; }

        if (/\|/.test(line) && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1])) {
          const cells = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
          const headCells = cells(line);
          i += 2;
          const bodyRows = [];
          while (i < lines.length && lines[i].trim() && /\|/.test(lines[i])) { bodyRows.push(cells(lines[i])); i += 1; }
          out.push('<div class="gr-table"><table><thead><tr>' + headCells.map((c) => '<th>' + inlineMd(c) + '</th>').join('') + '</tr></thead><tbody>' +
            bodyRows.map((r) => '<tr>' + r.map((c) => '<td>' + inlineMd(c) + '</td>').join('') + '</tr>').join('') +
            '</tbody></table></div>');
          continue;
        }

        if (QUOTE_RE.test(line)) {
          const buf = [];
          while (i < lines.length && QUOTE_RE.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i += 1; }
          out.push('<blockquote>' + mdToHtml(buf.join('\n')) + '</blockquote>');
          continue;
        }

        if (LIST_RE.test(line)) {
          const items = [];
          while (i < lines.length && LIST_RE.test(lines[i])) {
            const m = LIST_RE.exec(lines[i]);
            items.push({
              indent: m[1].replace(/\t/g, '  ').length,
              ordered: /^\d/.test(m[2]),
              text: m[3],
            });
            i += 1;
          }
          const [html] = renderList(items, 0, items[0].indent);
          out.push(html);
          continue;
        }

        const para = [];
        while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i], lines[i + 1])) { para.push(lines[i].trim()); i += 1; }
        if (para.length) out.push('<p>' + inlineMd(para.join(' ')) + '</p>');
        else { i += 1; }
      }
      mdBase = previous;
      return out.join('\n');
    }

    /* ---------- 面板 ---------- */

    const PERIODS = [['daily', '今日', '今日新增'], ['weekly', '本周', '本周新增'], ['monthly', '本月', '本月新增']];

    function RadarPage() {
      const [since, setSince] = useState('daily');
      const [lang, setLang] = useState('');
      const [q, setQ] = useState('');
      const [langs, setLangs] = useState([{ value: '', label: '全部语言' }]);
      const [items, setItems] = useState([]);
      const [collection, setCollection] = useState([]);
      const [clones, setClones] = useState([]);
      const [root, setRoot] = useState('');
      const [codeRoot, setCodeRoot] = useState('');
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState('');
      const [busy, setBusy] = useState({});
      const [savedAt, setSavedAt] = useState(0);
      const [toast, setToast] = useState('');
      const [auth, setAuth] = useState({ connected: false });
      const [engines, setEngines] = useState(null);
      const [stars, setStars] = useState({});
      const [authOpen, setAuthOpen] = useState(false);
      const [tokenInput, setTokenInput] = useState('');
      const [authBusy, setAuthBusy] = useState(false);
      const [authError, setAuthError] = useState('');
      const [googleOpen, setGoogleOpen] = useState(false);
      const [googleKey, setGoogleKey] = useState('');
      const [googleBusy, setGoogleBusy] = useState(false);
      const [googleError, setGoogleError] = useState('');
      const [modal, setModal] = useState(null);
      const toastTimer = useRef(null);
      const trAbort = useRef(null);

      const say = useCallback((text) => {
        setToast(text);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(''), 3200);
      }, []);

      const loadState = useCallback(async () => {
        try {
          const r = await api('/state');
          setCollection(r.collection || []);
          setClones(r.clones || []);
          if (r.root) setRoot(r.root);
          if (r.repos) setCodeRoot(r.repos);
        } catch { /* 收藏夹不可用不影响榜单 */ }
      }, []);

      const loadEngines = useCallback(async () => {
        try { setEngines(await api('/engines')); } catch { /* 没有引擎信息也不阻塞 */ }
      }, []);

      const loadAuth = useCallback(async () => {
        try { setAuth(await api('/auth')); } catch { setAuth({ connected: false }); }
      }, []);

      const loadStars = useCallback(async (list, connected) => {
        if (!connected || !list || !list.length) return;
        try {
          const names = list.map((i) => i.fullName).join(',');
          const r = await api('/stars?repos=' + encodeURIComponent(names));
          if (r.authed) setStars((prev) => ({ ...prev, ...r.map }));
        } catch { /* 标星状态取不到就算了 */ }
      }, []);

      const loadTrending = useCallback(async (nextSince, nextLang) => {
        setLoading(true);
        setError('');
        try {
          const r = await api('/trending?since=' + nextSince + '&lang=' + encodeURIComponent(nextLang || ''));
          setItems(r.items || []);
          setLangs(r.langs || []);
          setSavedAt(r.at || Date.now());
          return r.items || [];
        } catch (err) {
          setItems([]);
          setError(String(err.message || err));
          return [];
        } finally {
          setLoading(false);
        }
      }, []);

      useEffect(() => { loadTrending(since, lang).then((list) => loadStars(list, auth.connected)); }, [since, lang]);
      useEffect(() => { loadState(); loadAuth(); loadEngines(); }, []);
      useEffect(() => () => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        if (trAbort.current) trAbort.current.abort();
      }, []);

      const closeModal = useCallback(() => {
        if (trAbort.current) { trAbort.current.abort(); trAbort.current = null; }
        setModal(null);
      }, []);

      useEffect(() => {
        if (!modal) return;
        const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
      }, [modal, closeModal]);

      const cloneSet = useMemo(() => new Set(clones), [clones]);
      const savedSet = useMemo(() => new Set(collection.map((i) => keyOf(i.fullName))), [collection]);

      const rows = useMemo(() => {
        const needle = q.trim().toLowerCase();
        if (!needle) return items;
        return items.filter((i) =>
          i.fullName.toLowerCase().includes(needle) ||
          (i.desc || '').toLowerCase().includes(needle) ||
          (i.lang || '').toLowerCase().includes(needle));
      }, [items, q]);

      const period = PERIODS.find((p) => p[0] === since) || PERIODS[0];

      /* ----- 动作 ----- */

      const doClone = async (item) => {
        const dir = item.owner + '__' + item.repo;
        setBusy((b) => ({ ...b, [item.fullName]: 'clone' }));
        try {
          const r = await api('/clone', { method: 'POST', body: JSON.stringify({ owner: item.owner, repo: item.repo }) });
          setClones((list) => (list.includes(dir) ? list : [...list, dir]));
          say(r.existed ? item.fullName + ' 已经在本地了' : item.fullName + ' 已克隆到 ' + (r.path || dir));
        } catch (err) {
          say('克隆失败：' + err.message);
        } finally {
          setBusy((b) => { const next = { ...b }; delete next[item.fullName]; return next; });
        }
      };

      const doSave = async (item) => {
        try {
          const r = await api('/collection', { method: 'POST', body: JSON.stringify({ action: 'add', item }) });
          setCollection(r.collection || []);
          say('已收藏 ' + item.fullName);
        } catch (err) { say('收藏失败：' + err.message); }
      };

      const doUnsave = async (item) => {
        try {
          const r = await api('/collection', { method: 'POST', body: JSON.stringify({ action: 'remove', item: { fullName: item.fullName } }) });
          setCollection(r.collection || []);
          say('已移除 ' + item.fullName);
        } catch (err) { say('移除失败：' + err.message); }
      };

      const doReveal = async (item) => {
        try { await api('/reveal', { method: 'POST', body: JSON.stringify({ dir: item.owner + '__' + item.repo }) }); }
        catch (err) { say('打不开：' + err.message); }
      };

      const toggleStar = async (item) => {
        if (!auth.connected) { setAuthOpen(true); return; }
        const next = !stars[item.fullName];
        setStars((s) => ({ ...s, [item.fullName]: next }));
        try {
          await api('/star', { method: 'POST', body: JSON.stringify({ owner: item.owner, repo: item.repo, star: next }) });
          say(next ? '已在 GitHub 标星 ' + item.fullName : '已取消标星 ' + item.fullName);
        } catch (err) {
          setStars((s) => ({ ...s, [item.fullName]: !next }));
          say('标星失败：' + err.message);
        }
      };

      const submitToken = async () => {
        setAuthBusy(true);
        setAuthError('');
        try {
          const r = await api('/auth', { method: 'POST', body: JSON.stringify({ token: tokenInput }) });
          setAuth(r);
          setAuthOpen(false);
          setTokenInput('');
          say('已连接 GitHub：@' + r.login);
          loadStars(items, true);
        } catch (err) {
          setAuthError(err.message);
        } finally { setAuthBusy(false); }
      };

      const logout = async () => {
        setAuthBusy(true);
        try {
          await api('/auth', { method: 'DELETE' });
          setAuth({ connected: false });
          setStars({});
          setAuthOpen(false);
          say('已退出 GitHub');
        } catch (err) { setAuthError(err.message); }
        finally { setAuthBusy(false); }
      };

      const openReadme = async (item) => {
        if (trAbort.current) { trAbort.current.abort(); trAbort.current = null; }
        setModal({ fullName: item.fullName, owner: item.owner, repo: item.repo, title: item.fullName, source: '', zh: '', view: 'source', loading: true, translating: false, error: '' });
        try {
          const r = await api('/readme?owner=' + encodeURIComponent(item.owner) + '&repo=' + encodeURIComponent(item.repo));
          setModal((m) => (m && m.fullName === item.fullName ? { ...m, source: r.text || '', loading: false } : m));
        } catch (err) {
          setModal((m) => (m && m.fullName === item.fullName ? { ...m, loading: false, source: '没有取到 README：' + err.message } : m));
        }
      };

      const startTranslate = async (force, engineOverride, offset = 0) => {
        if (!modal) return;
        if (offset === 0 && modal.zh && !force) { setModal((m) => ({ ...m, view: 'zh' })); return; }
        if (trAbort.current) trAbort.current.abort();
        const ac = new AbortController();
        trAbort.current = ac;
        const owner = modal.owner;
        const repo = modal.repo;
        setModal((m) => (m ? {
          ...m, view: 'zh', error: '', translating: true, more: false,
          ...(offset === 0 ? { zh: '', nextOffset: 0, total: 0 } : {}),
        } : m));
        try {
          const res = await fetch(API + '/translate', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ owner, repo, force: !!force, engine: engineOverride || engines?.current || '', offset }),
            signal: ac.signal,
          });
          if (!res.ok || !res.body) throw new Error('翻译请求失败 ' + res.status);
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buf = '';
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let idx;
            while ((idx = buf.indexOf('\n\n')) >= 0) {
              const frame = buf.slice(0, idx);
              buf = buf.slice(idx + 2);
              if (!frame.startsWith('data: ')) continue;
              let msg;
              try { msg = JSON.parse(frame.slice(6)); } catch { continue; }
              if (msg.delta) setModal((m) => (m ? { ...m, zh: m.zh + msg.delta } : m));
              else if (msg.engine) setEngines((e) => (e ? { ...e, current: msg.engine } : e));
              else if (msg.notice) say(String(msg.notice));
              else if (msg.text) setModal((m) => {
                if (!m) return m;
                if (offset === 0) return { ...m, zh: msg.text };
                const sep = m.zh && !/\n$/.test(m.zh) ? '\n\n' : '';
                return { ...m, zh: m.zh + sep + msg.text };
              });
              else if (msg.more !== undefined) setModal((m) => (m ? { ...m, more: !!msg.more, nextOffset: msg.nextOffset ?? m.nextOffset, total: msg.total ?? m.total } : m));
              else if (msg.error) setModal((m) => (m ? { ...m, error: msg.error, translating: false } : m));
              else if (msg.done) setModal((m) => (m ? { ...m, translating: false } : m));
            }
          }
          setModal((m) => (m ? { ...m, translating: false } : m));
        } catch (err) {
          if (err && err.name === 'AbortError') return;
          setModal((m) => (m ? { ...m, error: String(err.message || err), translating: false } : m));
        } finally {
          if (trAbort.current === ac) trAbort.current = null;
        }
      };

      const onPickEngine = (id) => {
        if (id === 'google' && !engines?.google?.configured) { setGoogleOpen(true); return; }
        changeEngine(id);
      };

      const saveGoogle = async () => {
        setGoogleBusy(true);
        setGoogleError('');
        try {
          await api('/google', { method: 'POST', body: JSON.stringify({ key: googleKey }) });
          setGoogleOpen(false);
          setGoogleKey('');
          const next = await api('/engines');
          setEngines(next);
          say('Google 翻译已接入');
          changeEngine('google');
        } catch (err) {
          setGoogleError(err.message);
        } finally { setGoogleBusy(false); }
      };

      const changeEngine = async (id) => {
        setEngines((e) => (e ? { ...e, current: id } : e));
        try { await api('/engines', { method: 'POST', body: JSON.stringify({ engine: id }) }); }
        catch (err) { say('切换引擎失败：' + err.message); }
        setModal((m) => (m ? { ...m, zh: '', error: '' } : m));
        startTranslate(true, id);
      };

      const enginePicker = () => {
        if (!engines) return null;
        const options = [
          ...(engines.models || []).map((m) => ({ id: m.id, label: m.label })),
          ...(engines.google ? [{ id: engines.google.id, label: engines.google.label + (engines.google.configured ? '' : '（待配 key）') }] : []),
          ...(engines.free ? [{ id: engines.free.id, label: engines.free.label }] : []),
        ];
        return h('label', { className: 'gr-engine' },
          '引擎',
          h('select', {
            value: engines.current || '',
            onChange: (e) => onPickEngine(e.target.value),
            'aria-label': '翻译引擎',
          }, options.map((o) => h('option', { key: o.id, value: o.id }, o.label))));
      };

      /* ----- 片段 ----- */

      const starBtn = (item) => {
        const on = !!stars[item.fullName];
        return h('button', {
          className: 'gr-star', type: 'button', 'data-on': String(on),
          'aria-label': on ? '取消标星' : '在 GitHub 标星',
          title: auth.connected ? (on ? '取消标星' : '在 GitHub 标星') : '登录后可以标星',
          onClick: () => toggleStar(item),
        }, h(StarIcon, { filled: on }));
      };

      const rowView = (item, idx) => {
        const cloned = cloneSet.has(item.owner + '__' + item.repo);
        const saved = savedSet.has(keyOf(item.fullName));
        const isBusy = busy[item.fullName] === 'clone';
        return h('div', { className: 'gr-row' + (idx === 0 ? ' gr-top' : ''), key: item.fullName },
          h('div', { className: 'gr-rank' }, String(idx + 1).padStart(2, '0')),
          h('div', { style: { minWidth: 0 } },
            h('h3', { className: 'gr-name' },
              h('a', { href: item.url, target: '_blank', rel: 'noreferrer' },
                h('span', { className: 'gr-owner' }, item.owner + ' / '), ' ',
                h('span', { className: 'gr-repo' }, item.repo))),
            item.desc ? h('p', { className: 'gr-desc' }, item.desc) : null,
            h('div', { className: 'gr-meta' },
              item.lang ? h('span', { className: 'gr-dot', style: { background: item.color } }) : null,
              item.lang ? h('span', null, item.lang) : null,
              item.lang ? h('span', null, '·') : null,
              h('span', null, fmt(item.stars) + ' 星'),
              h('span', null, '·'),
              h('span', null, fmt(item.forks) + ' fork'))),
          h('div', { className: 'gr-delta' },
            h('span', { className: 'gr-dnum' }, '+' + item.delta.toLocaleString('en-US')),
            h('span', { className: 'gr-dlab' }, period[2])),
          h('div', { className: 'gr-acts' },
            h('button', { className: 'gr-btn sm', type: 'button', disabled: cloned || isBusy, onClick: () => doClone(item) }, isBusy ? '拉取中' : cloned ? '已克隆' : '克隆'),
            h('button', { className: 'gr-btn sm', type: 'button', disabled: saved, onClick: () => doSave(item) }, saved ? '已收藏' : '收藏'),
            h('button', { className: 'gr-btn sm', type: 'button', onClick: () => openReadme(item) }, 'README'),
            starBtn(item),
            h('a', { className: 'gr-btn sm', href: item.url, target: '_blank', rel: 'noreferrer', style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' } }, '↗')));
      };

      const shelfView = (item) => {
        const cloned = cloneSet.has(item.owner + '__' + item.repo);
        const when = new Date(item.addedAt || Date.now()).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
        return h('div', { className: 'gr-item', key: item.fullName },
          h('div', { className: 'gr-iname' }, h('a', { href: item.url, target: '_blank', rel: 'noreferrer' }, item.fullName)),
          h('div', { className: 'gr-imeta' },
            item.lang ? h('span', { className: 'gr-dot', style: { background: item.color || '#8b949e' } }) : null,
            item.lang ? h('span', null, item.lang) : null,
            item.lang ? h('span', null, '·') : null,
            h('span', null, when + ' 收'),
            cloned ? h('span', null, '·') : null,
            cloned ? h('span', null, '已克隆') : null),
          h('div', { className: 'gr-iacts' },
            h('button', { className: 'gr-btn sm', type: 'button', disabled: cloned || busy[item.fullName] === 'clone', onClick: () => doClone(item) }, busy[item.fullName] === 'clone' ? '拉取中' : cloned ? '已克隆' : '克隆'),
            cloned ? h('button', { className: 'gr-btn sm', type: 'button', onClick: () => doReveal(item) }, '打开') : null,
            h('button', { className: 'gr-btn sm', type: 'button', onClick: () => openReadme(item) }, 'README'),
            starBtn(item),
            h('button', { className: 'gr-btn sm', type: 'button', onClick: () => doUnsave(item), 'aria-label': '移除' }, '✕')));
      };

      const body = loading && !items.length
        ? h('div', null, [0, 1, 2, 3].map((i) => h('div', { className: 'gr-sk', key: i }, h('i'), h('i'), h('i'))))
        : error
          ? h('div', { className: 'gr-note' }, h('b', null, '这次没扫到'), error,
              h('button', { className: 'gr-btn', type: 'button', onClick: () => loadTrending(since, lang) }, '再试一次'))
          : rows.length === 0
            ? h('div', { className: 'gr-note' }, h('b', null, '没有匹配的仓库'), '换个关键词，或者切到别的时间范围看看。')
            : rows.map(rowView);

      const modalView = modal ? h('div', { className: 'gr-modal', onClick: (e) => { if (e.target === e.currentTarget) closeModal(); } },
        h('div', { className: 'gr-modal-card' },
          h('div', { className: 'gr-modal-head' },
            h('h3', null, modal.title),
            h('div', { className: 'gr-seg' },
              h('button', { type: 'button', 'data-on': String(modal.view === 'source'), onClick: () => setModal((m) => ({ ...m, view: 'source' })) }, '原文'),
              h('button', { type: 'button', 'data-on': String(modal.view === 'zh'), onClick: () => (modal.zh ? setModal((m) => ({ ...m, view: 'zh' })) : startTranslate(false)) }, '中文')),
            h('button', { className: 'gr-btn sm', type: 'button', onClick: closeModal, 'aria-label': '关闭' }, '✕')),
          modal.view === 'source'
            ? (modal.loading
              ? h('div', { className: 'gr-modal-body' }, '读取 README…')
              : h('div', { className: 'gr-modal-body gr-md', dangerouslySetInnerHTML: { __html: mdToHtml(modal.source, rawBase(modal)) } }))
            : h('div', { className: 'gr-modal-body' },
                modal.error
                  ? h('div', { className: 'gr-err' }, modal.error)
                  : h(React.Fragment, null,
                      modal.zh
                        ? h('div', { className: 'gr-md', dangerouslySetInnerHTML: { __html: mdToHtml(modal.zh, rawBase(modal)) } })
                        : h('div', null, '正在翻译…'),
                      modal.more && !modal.translating
                        ? h('div', { className: 'gr-more' },
                            h('div', { className: 'gr-more-txt' },
                              '已翻到 ' + Math.round(((modal.nextOffset || 0) / (modal.total || 1)) * 100) + '%，后面还有 ' +
                              Math.max(0, (modal.total || 0) - (modal.nextOffset || 0)) + ' 字符没翻'),
                            h('button', {
                              className: 'gr-btn primary', type: 'button',
                              onClick: () => startTranslate(false, null, modal.nextOffset || 0),
                            }, '继续翻译下一段'))
                        : null),
                modal.translating ? h('div', { className: 'gr-hint', style: { marginTop: 8, color: 'var(--gr-mute)' } }, '模型正在逐段输出，稍等。') : null),
          h('div', { className: 'gr-modal-foot' },
            modal.view === 'zh'
              ? (enginePicker() || h('span', null, '翻译中'))
              : h('span', null, '原样展示仓库 README'),
            h('span', { style: { flex: 1 } }),
            modal.view === 'zh' && modal.more && !modal.translating
              ? h('button', {
                  className: 'gr-btn sm primary', type: 'button',
                  onClick: () => startTranslate(false, null, modal.nextOffset || 0),
                }, '继续翻译（剩 ' + Math.max(0, (modal.total || 0) - (modal.nextOffset || 0)) + ' 字）')
              : null,
            modal.view === 'zh' && modal.zh && !modal.translating
              ? h('button', { className: 'gr-btn sm', type: 'button', onClick: () => startTranslate(true) }, '重新翻译')
              : null)))
        : null;

      const googleView = googleOpen ? h('div', { className: 'gr-modal', onClick: (e) => { if (e.target === e.currentTarget) setGoogleOpen(false); } },
        h('div', { className: 'gr-modal-card narrow' },
          h('div', { className: 'gr-modal-head' }, h('h3', null, '接入 Google 翻译'),
            h('button', { className: 'gr-btn sm', type: 'button', onClick: () => setGoogleOpen(false), 'aria-label': '关闭' }, '✕')),
          h('div', { className: 'gr-form' },
            h('div', null, '需要一个 Google Cloud Translation API key（v2）。它只存在这台机器的 ', h('code', null, '~/Data/github-radar/google.json'), '（权限 600）。'),
            h('input', {
              value: googleKey, placeholder: 'AIza…', spellCheck: false,
              onChange: (e) => setGoogleKey(e.target.value),
              onKeyDown: (e) => { if (e.key === 'Enter' && googleKey.trim().length > 20) saveGoogle(); },
            }),
            googleError ? h('div', { className: 'gr-err' }, googleError) : null,
            h('div', { className: 'gr-hint' },
              'GCP 控制台 → 启用 Cloud Translation API → 创建 API key（建议限制为只允许 Translation API）。',
              h('br'),
              '每月 50 万字符免费，超出约 $20/百万字符；翻译一篇 1.2 万字符的 README 大约用掉 1/40 的月度额度。'),
            h('div', { className: 'gr-rowline' },
              h('button', { className: 'gr-btn primary', type: 'button', disabled: googleBusy || googleKey.trim().length < 20, onClick: saveGoogle }, googleBusy ? '验证中…' : '保存并测试'),
              h('button', { className: 'gr-btn', type: 'button', onClick: () => setGoogleOpen(false) }, '取消')))))
        : null;

      const authView = authOpen ? h('div', { className: 'gr-modal', onClick: (e) => { if (e.target === e.currentTarget) setAuthOpen(false); } },
        h('div', { className: 'gr-modal-card narrow' },
          h('div', { className: 'gr-modal-head' }, h('h3', null, 'GitHub 登录'),
            h('button', { className: 'gr-btn sm', type: 'button', onClick: () => setAuthOpen(false), 'aria-label': '关闭' }, '✕')),
          auth.connected
            ? h('div', { className: 'gr-form' },
                h('div', null, '已连接 ', h('b', { style: { color: 'var(--gr-ink)' } }, '@' + (auth.login || 'unknown')), '（来源：', auth.source === 'gh' ? 'gh CLI' : '手动 token', '）'),
                h('div', { className: 'gr-hint' }, '现在可以：克隆私有仓库、在面板里直接标星。'),
                h('div', { className: 'gr-rowline' },
                  h('button', { className: 'gr-btn', type: 'button', disabled: authBusy, onClick: logout }, '退出登录')))
            : h('div', { className: 'gr-form' },
                h('div', null, '粘贴一个 GitHub Personal Access Token。它只存在这台机器的 ', h('code', null, '~/.dsh/github-radar/auth.json'), '（权限 600）。'),
                h('textarea', {
                  value: tokenInput, placeholder: 'ghp_… 或 github_pat_…',
                  onChange: (e) => setTokenInput(e.target.value), spellCheck: false,
                }),
                authError ? h('div', { className: 'gr-err' }, authError) : null,
                h('div', { className: 'gr-hint' },
                  '要标星和读私有库，token 需要 ', h('code', null, 'repo'), ' 范围（classic）或仓库读权限（fine-grained）。',
                  h('br'),
                  '不想手动建也可以：终端里跑 ', h('code', null, 'gh auth login'), '，插件会自动复用 gh 的 token。'),
                h('div', { className: 'gr-rowline' },
                  h('button', { className: 'gr-btn primary', type: 'button', disabled: authBusy || tokenInput.trim().length < 20, onClick: submitToken }, authBusy ? '验证中…' : '保存并验证'),
                  h('button', { className: 'gr-btn', type: 'button', onClick: () => setAuthOpen(false) }, '取消')))))
        : null;

      return h('div', { className: 'gr-page' },
        h('div', { className: 'gr-scroll' },
          h('div', { className: 'gr-wrap' },
            h('header', { className: 'gr-head' },
              h('div', null,
                h('h1', { className: 'gr-title' }, 'GitHub 雷达'),
                h('p', { className: 'gr-sub' }, '扫一眼今天在涨的仓库，顺手拿下来用。')),
              h('div', { className: 'gr-headright' },
                h('button', { className: 'gr-auth', type: 'button', 'data-on': String(!!auth.connected), onClick: () => setAuthOpen(true) },
                  h('i'), auth.connected ? h('span', null, '@', h('b', null, auth.login || 'unknown')) : h('span', null, '登录 GitHub')),
                h('div', { className: 'gr-stamp' },
                  h('b', null, new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })),
                  savedAt ? '更新于 ' + new Date(savedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '等待数据'))),

            h('div', { className: 'gr-bar' },
              h('div', { className: 'gr-tabs', role: 'tablist' },
                PERIODS.map(([value, label]) => h('button', {
                  key: value, type: 'button', role: 'tab', className: 'gr-tab',
                  'data-on': String(since === value), 'aria-selected': since === value,
                  onClick: () => setSince(value),
                }, label))),
              h('label', { className: 'gr-field' },
                h('select', { value: lang, onChange: (e) => setLang(e.target.value), 'aria-label': '语言' },
                  langs.map((l) => h('option', { key: l.value, value: l.value }, l.label)))),
              h('label', { className: 'gr-field gr-grow' },
                h('input', { type: 'search', value: q, placeholder: '过滤仓库名、描述、语言…', onChange: (e) => setQ(e.target.value), 'aria-label': '过滤' })),
              h('button', {
                className: 'gr-btn primary', type: 'button', disabled: loading,
                onClick: () => { loadTrending(since, lang).then((list) => loadStars(list, auth.connected)); loadState(); },
              }, loading ? '刷新中' : '刷新')),

            h('div', { className: 'gr-cols' },
              h('section', null,
                h('div', { className: 'gr-sec' },
                  h('h2', null, period[1] + '上升榜'),
                  h('span', { className: 'gr-count' }, loading ? '读取中' : rows.length + ' 个仓库')),
                body),
              h('aside', { className: 'gr-shelf' },
                h('div', { className: 'gr-sec', style: { borderBottom: 0, paddingBottom: 0 } },
                  h('h2', null, '收藏夹'),
                  h('span', { className: 'gr-count' }, String(collection.length))),
                collection.length === 0
                  ? h('div', { className: 'gr-empty' }, h('b', null, '还空着。'), '榜单里看到值得留下的，点一下「收藏」。')
                  : collection.map(shelfView),
                h('p', { style: { margin: '10px 0 6px', fontFamily: 'var(--dsw-font-mono, monospace)', fontSize: '10.5px', lineHeight: 1.6, color: 'var(--gr-mute)', overflowWrap: 'anywhere' } },
                  codeRoot ? '克隆到 ' + codeRoot.replace(/^\/Users\/[^/]+/, '~') : '克隆到 ~/Code',
                  collection.length ? h('br') : null,
                  root ? '数据在 ' + root.replace(/^\/Users\/[^/]+/, '~') : null))))),

        toast ? h('div', { className: 'gr-toast' }, toast) : null,
        modalView,
        authView,
        googleView);
    }

    /* ---------- 插件体 ---------- */

    function apply(ctx) {
      try {
        mountCss();
        if (ctx.effect) ctx.effect(() => () => unmountCss(), 'github-radar: styles');

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          inject: () => ({}),
        }, RadarPage));

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 30,
          label: () => 'GitHub 雷达',
        }, RadarIcon));
      } catch (err) {
        // 插件自身的失败不应该拖垮整个 Web 启动
        console.error('[github-radar] apply failed', err);
      }
    }

    exports.__mdToHtml = mdToHtml;
    exports.PANEL_ID = PANEL_ID;
    exports.inject = ['slots'];
    exports.apply = apply;
    return module.exports;
  },
});
