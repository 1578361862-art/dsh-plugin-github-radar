/**
 * GitHub 雷达 — 浏览器半侧。
 *
 * 一个全局面板（main 槽 + 侧栏入口）：浏览 GitHub 趋势仓库、本地收藏、
 * 读 README（可让模型翻成中文）、一键浅克隆。
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
.gr-page{--gr-void:var(--dsw-alias-bg-base,#151517);--gr-ink:#232324;--gr-obsidian:#1b1c1e;--gr-graphite:#2c2c2e;--gr-smoke:#81858c;--gr-ash:#adb2b8;--gr-mist:#f9fafb;--gr-iron:#151517;--gr-slate:rgba(255,255,255,.12);--gr-white:#f9fafb;--gr-coral:#ff6363;--gr-hair:rgba(255,255,255,.06);--gr-rule:rgba(255,255,255,.12);--gr-key:0 0 0 1px var(--gr-hair);--gr-foot:rgba(255,255,255,.02);
--gr-serif:"Iowan Old Style","Songti SC","Source Han Serif SC","Noto Serif SC",Georgia,serif;--gr-ui:-apple-system,"SF Pro Text","PingFang SC","Helvetica Neue",Arial,sans-serif;--gr-mono:"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace;
container:grpane/inline-size;display:flex;flex-direction:column;height:100%;min-height:0;background:var(--gr-void);color:var(--gr-white);font-family:var(--gr-ui);font-size:14px;line-height:1.5;overflow:hidden;position:relative;-webkit-font-smoothing:antialiased;animation:gr-panel-in .14s cubic-bezier(.2,0,0,1) both}
@keyframes gr-panel-in{from{opacity:.55}to{opacity:1}}
.gr-scroll{flex:1;min-height:0;overflow:auto;scrollbar-gutter:stable;--dsh-scrollbar-width:9px;--dsh-scrollbar-thumb-border:2px}
.gr-wrap{width:100%;box-sizing:border-box;margin:0 auto;padding:0 clamp(24px,3.6vw,56px) 64px}
[data-platform=darwin] .gr-head{padding-top:calc(26px + var(--dsh-frame-top-clearance,0px))}
.gr-head{padding-top:30px;display:flex;align-items:flex-end;justify-content:space-between;gap:32px;padding-bottom:22px;border-bottom:1px solid var(--gr-rule)}
.gr-brand{display:flex;gap:12px;align-items:flex-start;min-width:0}
.gr-eyebrow{display:flex;align-items:center;gap:9px;margin-bottom:10px;font-family:var(--gr-mono);font-size:10px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:var(--gr-ash)}
.gr-mark{width:5px;height:5px;background:var(--gr-coral);transform:rotate(45deg);flex:none}
.gr-title{margin:0;font-family:var(--gr-serif);font-size:44px;font-weight:600;line-height:1.02;letter-spacing:-.022em}
.gr-sub{margin:9px 0 0;font-size:14px;color:var(--gr-ash);letter-spacing:.008em}
.gr-headright{flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:10px}
.gr-stamp{font-family:var(--gr-mono);font-size:11px;color:var(--gr-smoke);letter-spacing:.017em;text-align:right;line-height:1.6}
.gr-stamp b{display:block;color:var(--gr-ash);font-weight:500}

.gr-auth{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 12px;border-radius:8px;border:1px solid var(--gr-slate);background:0 0;color:var(--gr-ash);font:inherit;font-size:13px;font-weight:500;cursor:pointer}
.gr-auth:hover{background:var(--gr-obsidian);border-color:var(--gr-hair);color:var(--gr-white)}
.gr-auth i{width:6px;height:6px;border-radius:50%;background:var(--gr-smoke);display:inline-block}
.gr-auth[data-on=true] i{background:#59d499}
.gr-auth b{font-weight:500;color:var(--gr-white)}

.gr-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:24px 0 20px}
.gr-tabs{display:inline-flex;gap:2px;padding:3px;background:var(--gr-obsidian);border-radius:8px;border:1px solid var(--gr-hair)}
.gr-tab{font:inherit;font-size:13px;font-weight:500;color:var(--gr-ash);background:0 0;border:0;border-radius:6px;height:28px;padding:0 13px;cursor:pointer}
.gr-tab:hover{color:var(--gr-white)}
.gr-tab[data-on=true]{background:var(--gr-graphite);color:var(--gr-white)}
.gr-field{display:flex;align-items:center;gap:8px;height:34px;padding:0 12px;border-radius:8px;background:var(--gr-ink);border:1px solid var(--gr-hair);color:var(--gr-ash);font-size:13px}
.gr-field:focus-within{border-color:var(--gr-slate)}
.gr-field input,.gr-field select{font:inherit;font-size:13px;color:var(--gr-white);background:0 0;border:0;outline:0;height:100%;min-width:0}
.gr-field select{color:var(--gr-ash);cursor:pointer}
.gr-field input{width:100%}
.gr-field input::placeholder{color:var(--gr-smoke)}
.gr-grow{flex:1;min-width:200px}
.gr-btn{font:inherit;font-size:12px;font-weight:500;height:28px;padding:0 11px;border-radius:8px;border:1px solid var(--gr-slate);background:0 0;color:var(--gr-ash);cursor:pointer;white-space:nowrap;transition:background-color .15s,color .15s,border-color .15s}
.gr-btn:hover{background:var(--gr-obsidian);color:var(--gr-white);border-color:var(--gr-hair)}
.gr-btn:disabled{opacity:.45;cursor:default}
.gr-btn:disabled:hover{background:0 0;color:var(--gr-ash);border-color:var(--gr-slate)}
.gr-btn.primary{height:34px;padding:0 14px;font-size:13px;background:var(--gr-mist);color:var(--gr-iron);border:1px solid var(--gr-mist);border-radius:8px}
.gr-btn.primary:hover{opacity:.9}
.gr-btn.sm{height:26px;padding:0 9px;font-size:11.5px}
.gr-btn.icon{width:26px;padding:0;display:inline-flex;align-items:center;justify-content:center}

.gr-cols{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:40px;align-items:start;padding-top:4px}
.gr-sec{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding-bottom:10px;border-bottom:1px solid var(--gr-hair)}
.gr-sec h2{margin:0;font-family:var(--gr-serif);font-size:20px;font-weight:600;letter-spacing:-.01em;color:var(--gr-white)}
.gr-count{font-family:var(--gr-mono);font-size:10px;color:var(--gr-smoke);letter-spacing:.12em;text-transform:uppercase}

.gr-row{display:grid;grid-template-columns:30px minmax(0,1fr) 104px 236px;gap:14px;align-items:center;padding:15px 10px 15px 0;border-bottom:1px solid var(--gr-hair);position:relative}
.gr-row:hover{background:var(--gr-obsidian)}
.gr-row.gr-top::before{content:"";position:absolute;left:-12px;top:15px;bottom:15px;width:2px;background:var(--gr-coral);border-radius:2px}
.gr-rank{font-family:var(--gr-mono);font-size:11px;color:var(--gr-smoke);letter-spacing:.05em;align-self:start;padding-top:4px}
.gr-row.gr-top .gr-rank{color:var(--gr-coral)}
.gr-name{margin:0;font-size:15px;font-weight:500;letter-spacing:.004em;line-height:1.35;overflow-wrap:break-word;hyphens:none;text-wrap:pretty}
.gr-name a{color:var(--gr-white);text-decoration:none}
.gr-name a:hover .gr-repo{text-decoration:underline;text-underline-offset:3px}
.gr-owner{color:var(--gr-ash);font-weight:400}
.gr-desc{margin:4px 0 0;font-size:13px;line-height:1.55;color:var(--gr-ash);max-width:64ch;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.gr-meta{display:flex;align-items:center;gap:7px;margin-top:7px;font-family:var(--gr-mono);font-size:11px;color:var(--gr-smoke);letter-spacing:.017em;min-width:0}
.gr-meta span.txt{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.gr-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex:none}
.gr-delta{text-align:right}
.gr-dnum{display:block;font-family:var(--gr-serif);font-size:21px;font-weight:500;line-height:1.1;letter-spacing:-.01em;font-variant-numeric:tabular-nums}
.gr-dlab{display:block;margin-top:4px;font-family:var(--gr-mono);font-size:9.5px;color:var(--gr-smoke);letter-spacing:.1em;text-transform:uppercase}
.gr-acts{display:flex;gap:6px;justify-content:flex-end;align-items:center}

.gr-shelf{background:var(--gr-ink);border:1px solid var(--gr-hair);border-radius:0;padding:20px}
.gr-shelf .gr-sec{border-bottom:0;padding-bottom:4px}
.gr-shelf-find{margin:12px 0 2px;height:30px;border-radius:0}
.gr-shelf-find input{font-size:12px}
.gr-shelf h2{margin:0;font-family:var(--gr-serif);font-size:17px;font-weight:600}
.gr-empty{padding:26px 0 30px;font-size:12.5px;line-height:1.7;color:var(--gr-smoke);border-bottom:1px solid var(--gr-hair)}
.gr-empty b{color:var(--gr-ash);font-weight:500}
.gr-fallback{margin:0 0 14px;padding:10px 12px;border:1px solid var(--gr-hair);border-left:2px solid var(--gr-coral);background:var(--gr-foot);font-size:11.5px;line-height:1.65;color:var(--gr-ash)}
.gr-item{padding:12px 0;border-bottom:1px solid var(--gr-hair)}
.gr-item:last-child{border-bottom:0}
.gr-iname{font-size:13px;font-weight:500;overflow-wrap:anywhere}
.gr-iname a{color:var(--gr-white);text-decoration:none}
.gr-iname a:hover{text-decoration:underline;text-underline-offset:3px}
.gr-idesc{margin:5px 0 0;font-size:12px;line-height:1.5;color:var(--gr-ash);max-width:52ch;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.gr-imeta{display:flex;gap:6px;align-items:center;margin-top:4px;font-family:var(--gr-mono);font-size:10.5px;color:var(--gr-smoke);letter-spacing:.017em}
.gr-iacts{display:flex;gap:5px;margin-top:9px;flex-wrap:wrap}
.gr-path{margin:16px -20px -20px;padding:10px 20px;border-top:1px solid var(--gr-hair);background:var(--gr-foot);font-family:var(--gr-mono);font-size:10.5px;line-height:1.6;color:var(--gr-smoke);letter-spacing:.017em;overflow-wrap:anywhere}
.gr-note{margin-top:16px;padding:22px 20px;border-radius:0;border:1px solid var(--gr-hair);background:rgba(255,255,255,.02);font-size:13px;line-height:1.7;color:var(--gr-ash)}
.gr-note b{display:block;color:var(--gr-white);font-weight:500;margin-bottom:4px}
.gr-note .gr-btn{margin-top:12px}

.gr-sk{padding:16px 0;border-bottom:1px solid var(--gr-hair)}
.gr-sk i{display:block;height:9px;border-radius:2px;background:linear-gradient(90deg,rgba(255,255,255,.07),rgba(255,255,255,.02),rgba(255,255,255,.07));background-size:200% 100%;animation:grSweep 1.3s linear infinite}
.gr-sk i+i{margin-top:8px}
.gr-sk i:nth-child(1){width:28%}.gr-sk i:nth-child(3){width:55%}
@keyframes grSweep{from{background-position:160% 0}to{background-position:-60% 0}}

.gr-modal{position:absolute;inset:0;background:rgba(4,5,6,.66);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:40px;z-index:20}
.gr-modal-card{background:var(--gr-ink);border-radius:16px;width:min(760px,100%);max-height:82%;display:flex;flex-direction:column;box-shadow:rgba(255,255,255,.05) 0 1px 0 0 inset,rgba(255,255,255,.18) 0 0 0 1px,rgba(0,0,0,.2) 0 -1px 0 0 inset,0 30px 80px rgba(0,0,0,.6)}
.gr-modal-card.narrow{width:min(520px,100%)}
.gr-modal-head{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--gr-hair);flex:none}
.gr-modal-head h3{margin:0;flex:1;min-width:0;font-size:14px;font-weight:500;letter-spacing:.004em;overflow-wrap:anywhere}
.gr-modal-body{overflow:auto;padding:20px 24px 26px;font-size:13.5px;line-height:1.75;color:var(--gr-ash);overflow-wrap:anywhere;scrollbar-gutter:stable;flex:1;min-height:120px}
.gr-modal-foot{display:flex;align-items:center;gap:8px;padding:12px 18px;border-top:1px solid var(--gr-hair);font-size:12px;color:var(--gr-smoke);flex:none}
.gr-seg{display:inline-flex;gap:2px;padding:2px;border-radius:9px;background:var(--gr-obsidian);border:1px solid var(--gr-hair);flex:none}
.gr-seg button{font:inherit;font-size:12px;font-weight:500;color:var(--gr-ash);background:0 0;border:0;border-radius:7px;padding:4px 10px;cursor:pointer}
.gr-seg button[data-on=true]{background:var(--gr-graphite);color:var(--gr-white)}
.gr-form{display:flex;flex-direction:column;gap:10px;padding:18px 20px 22px;font-size:12.5px;line-height:1.65;color:var(--gr-ash)}
.gr-form input{width:100%;box-sizing:border-box;height:34px;font:inherit;font-size:12.5px;padding:0 11px;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.06);color:var(--gr-white);outline:0;font-family:var(--gr-mono)}
.gr-form input:focus{border-color:rgba(255,255,255,.18)}
.gr-form textarea{width:100%;box-sizing:border-box;min-height:64px;resize:vertical;font:inherit;font-size:12.5px;padding:9px 11px;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.06);color:var(--gr-white);outline:0;font-family:var(--gr-mono)}
.gr-form textarea:focus{border-color:rgba(255,255,255,.18)}
.gr-form code{font-family:var(--gr-mono);font-size:11.5px;background:rgba(255,255,255,.06);padding:1px 5px;border-radius:5px;color:var(--gr-mist)}
.gr-form .gr-rowline{display:flex;gap:8px;align-items:center;margin-top:2px}
.gr-err{color:#ff8f8f}
.gr-hint{font-size:11.5px;color:var(--gr-smoke)}

.gr-md h2,.gr-md h3,.gr-md h4{margin:22px 0 8px;font-weight:500;line-height:1.35;letter-spacing:.004em;color:var(--gr-white)}
.gr-md h2{font-size:17px}
.gr-md h3{font-size:15px}
.gr-md h4{font-size:13.5px;color:var(--gr-ash)}
.gr-md p{margin:9px 0}
.gr-md ul,.gr-md ol{margin:9px 0;padding-left:20px}
.gr-md li{margin:4px 0}
.gr-md li>ul,.gr-md li>ol{margin:4px 0}
.gr-md pre{margin:12px 0;padding:12px 14px;border-radius:8px;border:1px solid var(--gr-hair);background:var(--gr-obsidian);overflow:auto;position:relative}
.gr-md pre code{background:0;padding:0;font-size:12px;line-height:1.6;font-family:var(--gr-mono);white-space:pre;color:var(--gr-mist)}
.gr-md pre[data-lang]::before{content:attr(data-lang);position:absolute;top:8px;right:12px;font-size:10px;color:var(--gr-smoke);font-family:var(--gr-mono);letter-spacing:.05em;text-transform:uppercase}
.gr-md code{font-family:var(--gr-mono);font-size:12px;background:rgba(255,255,255,.06);padding:1px 5px;border-radius:5px;color:var(--gr-mist)}
.gr-md blockquote{margin:12px 0;padding:2px 14px;border-left:2px solid var(--gr-slate);color:var(--gr-smoke)}
.gr-md blockquote p{margin:6px 0}
.gr-md hr{border:0;border-top:1px solid var(--gr-hair);margin:20px 0}
.gr-md .gr-table{overflow:auto;margin:12px 0}
.gr-md table{border-collapse:collapse;font-size:12.5px}
.gr-md th,.gr-md td{border:1px solid var(--gr-hair);padding:7px 11px;text-align:left;vertical-align:top}
.gr-md th{background:rgba(255,255,255,.04);font-weight:500;color:var(--gr-white)}
.gr-md img{max-width:100%;height:auto;vertical-align:middle}
.gr-md a{color:var(--gr-mist);text-underline-offset:3px}
.gr-md b{color:var(--gr-white);font-weight:500}
.gr-md .gr-check{display:inline-block;width:12px;height:12px;border:1px solid var(--gr-slate);border-radius:3px;margin-right:6px;vertical-align:-1px}
.gr-md .gr-check.on{background:var(--gr-mist);border-color:var(--gr-mist)}

.gr-more{margin:18px 0 4px;padding:14px 16px;border-radius:12px;border:1px dashed rgba(255,255,255,.14);background:rgba(255,255,255,.03);display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.gr-more-txt{margin:0;flex:1;min-width:180px;font-size:12px;line-height:1.6;color:var(--gr-ash)}
.gr-engine{display:inline-flex;align-items:center;gap:6px;font-family:var(--gr-mono);font-size:11px;color:var(--gr-smoke);letter-spacing:.017em}
.gr-engine select{font:inherit;font-size:11px;color:var(--gr-ash);background:0 0;border:0;border-bottom:1px dashed var(--gr-slate);border-radius:0;padding:0 2px 1px;outline:0;font-family:var(--gr-mono)}
.gr-engine select:focus-visible{border-bottom-color:var(--gr-ash)}

.gr-toast{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);background:var(--gr-graphite);color:var(--gr-white);font-size:12px;line-height:1.5;padding:9px 14px;border-radius:8px;max-width:70%;z-index:30;box-shadow:rgba(255,255,255,.05) 0 1px 0 0 inset,rgba(255,255,255,.14) 0 0 0 1px}

.gr-page[data-theme=light]{--gr-void:#faf6ee;--gr-ink:#fffcf6;--gr-obsidian:#f1eadc;--gr-graphite:#fffcf6;--gr-smoke:#7f7666;--gr-ash:#4b453a;--gr-mist:#1b1813;--gr-iron:#faf6ee;--gr-slate:rgba(27,24,19,.14);--gr-white:#1b1813;--gr-coral:#a8452f;--gr-hair:rgba(27,24,19,.14);--gr-rule:rgba(27,24,19,.62);--gr-key:0 0 0 1px var(--gr-hair);--gr-foot:rgba(27,24,19,.02)}
.gr-page[data-theme=light] .gr-field{background:var(--gr-ink);border-color:var(--gr-hair)}
.gr-page[data-theme=light] .gr-tab[data-on=true]{box-shadow:none}
.gr-page[data-theme=light] .gr-btn.primary{box-shadow:none}
.gr-page[data-theme=light] .gr-sk i{background:linear-gradient(90deg,rgba(27,24,19,.06),rgba(27,24,19,.02),rgba(27,24,19,.06));background-size:200% 100%}
.gr-page[data-theme=light] .gr-note{background:var(--gr-ink)}
.gr-page[data-theme=light] .gr-modal{background:rgba(20,17,14,.42)}
.gr-page[data-theme=light] .gr-modal-card{box-shadow:0 30px 80px rgba(27,24,19,.18)}
.gr-page[data-theme=light] .gr-toast{background:#1b1813;color:#faf6ee;box-shadow:0 8px 24px rgba(27,24,19,.18)}
.gr-page[data-theme=light] .gr-form input,.gr-page[data-theme=light] .gr-form textarea{background:var(--gr-ink);border-color:var(--gr-hair);color:var(--gr-white)}
.gr-page[data-theme=light] .gr-err{color:var(--gr-coral)}
.gr-page[data-theme=light] .gr-md code{background:rgba(27,24,19,.05)}
.gr-page[data-theme=light] .gr-md th{background:rgba(27,24,19,.03)}
.gr-page[data-theme=light] .gr-more{background:var(--gr-ink);border-color:var(--gr-hair)}
.gr-page[data-theme=light] .gr-seg button[data-on=true]{box-shadow:none}
.gr-page :focus-visible{outline:2px solid var(--gr-coral);outline-offset:2px}
@container grpane (max-width:1040px){
.gr-cols{grid-template-columns:minmax(0,1fr);gap:32px}
.gr-row{grid-template-columns:26px minmax(0,1fr) 84px}
.gr-acts{grid-column:2/-1;justify-content:flex-start;margin-top:2px}
.gr-desc{-webkit-line-clamp:3}
}
@container grpane (max-width:720px){
.gr-wrap{padding:0 20px 48px}
.gr-head{flex-direction:column;gap:16px}
.gr-headright{align-items:flex-start;flex-direction:row;flex-wrap:wrap}
.gr-row{grid-template-columns:22px minmax(0,1fr)}
.gr-delta{grid-column:2;text-align:left;display:flex;align-items:baseline;gap:8px;margin-top:2px}
.gr-dlab{margin-top:0}
.gr-acts{grid-column:2;justify-content:flex-start}
.gr-title{font-size:20px}
}
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

    /** 跟随 DSH 主题：dark 由 body[data-ds-dark-theme] 表示，切主题时实时响应。 */
    function currentTheme() {
      if (typeof document === 'undefined') return 'dark';
      return document.body && document.body.hasAttribute('data-ds-dark-theme') ? 'dark' : 'light';
    }

    function RadarPage() {
      const [since, setSince] = useState('daily');
      const [lang, setLang] = useState('');
      const [q, setQ] = useState('');
      const [shelfQ, setShelfQ] = useState('');
      const [via, setVia] = useState('');
      const [viaNote, setViaNote] = useState('');
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
      const [authOpen, setAuthOpen] = useState(false);
      const [tokenInput, setTokenInput] = useState('');
      const [authBusy, setAuthBusy] = useState(false);
      const [authError, setAuthError] = useState('');
      const [googleOpen, setGoogleOpen] = useState(false);
      const [googleKey, setGoogleKey] = useState('');
      const [googleBusy, setGoogleBusy] = useState(false);
      const [googleError, setGoogleError] = useState('');
      const [modal, setModal] = useState(null);
      const [theme, setTheme] = useState(currentTheme);
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

      const loadTrending = useCallback(async (nextSince, nextLang, force) => {
        setLoading(true);
        setError('');
        try {
          const r = await api('/trending?since=' + nextSince + '&lang=' + encodeURIComponent(nextLang || '') + (force ? '&force=1' : ''));
          setItems(r.items || []);
          setLangs(r.langs || []);
          setSavedAt(r.at || Date.now());
          setVia(r.via || '');
          setViaNote(r.note || '');
          if (r.stale) say('GitHub 暂时拿不到，用的是 ' + new Date(r.at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' 的缓存');
          return r.items || [];
        } catch (err) {
          setItems([]);
          setError(String(err.message || err));
          setVia('');
          setViaNote('');
          return [];
        } finally {
          setLoading(false);
        }
      }, []);

      useEffect(() => { loadTrending(since, lang); }, [since, lang]);
      useEffect(() => { loadState(); loadAuth(); loadEngines(); }, []);

      useEffect(() => {
        const sync = () => setTheme(currentTheme());
        sync();
        const observer = new MutationObserver(sync);
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] });
        return () => observer.disconnect();
      }, []);
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

      const shelfRows = useMemo(() => {
        const needle = shelfQ.trim().toLowerCase();
        if (!needle) return collection;
        return collection.filter((i) =>
          String(i.fullName || '').toLowerCase().includes(needle) ||
          String(i.desc || '').toLowerCase().includes(needle) ||
          String(i.lang || '').toLowerCase().includes(needle));
      }, [collection, shelfQ]);

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

      const submitToken = async () => {
        setAuthBusy(true);
        setAuthError('');
        try {
          const r = await api('/auth', { method: 'POST', body: JSON.stringify({ token: tokenInput }) });
          setAuth(r);
          setAuthOpen(false);
          setTokenInput('');
          say('已连接 GitHub：@' + r.login);
        } catch (err) {
          setAuthError(err.message);
        } finally { setAuthBusy(false); }
      };

      const logout = async () => {
        setAuthBusy(true);
        try {
          await api('/auth', { method: 'DELETE' });
          setAuth({ connected: false });
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
            item.desc ? h('p', { className: 'gr-desc', title: item.desc }, item.desc) : null,
            h('div', { className: 'gr-meta' },
              item.lang ? h('span', { className: 'gr-dot', style: { background: item.color } }) : null,
              h('span', { className: 'txt' },
                [item.lang, fmt(item.stars) + ' 星', fmt(item.forks) + ' fork'].filter(Boolean).join(' · ')))),
          h('div', { className: 'gr-delta' },
            item.via === 'search'
              ? h('span', { className: 'gr-dnum' }, '—')
              : h('span', { className: 'gr-dnum' }, '+' + item.delta.toLocaleString('en-US')),
            h('span', { className: 'gr-dlab' }, item.via === 'search' ? '新建' : period[2])),
          h('div', { className: 'gr-acts' },
            h('button', { className: 'gr-btn sm', type: 'button', disabled: cloned || isBusy, onClick: () => doClone(item) }, isBusy ? '拉取中' : cloned ? '已克隆' : '克隆'),
            h('button', { className: 'gr-btn sm', type: 'button', disabled: saved, onClick: () => doSave(item) }, saved ? '已收藏' : '收藏'),
            h('button', { className: 'gr-btn sm', type: 'button', onClick: () => openReadme(item) }, 'README'),
            h('a', { className: 'gr-btn sm', href: item.url, target: '_blank', rel: 'noreferrer', style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' } }, '↗')));
      };

      const shelfView = (item) => {
        const cloned = cloneSet.has(item.owner + '__' + item.repo);
        const when = new Date(item.addedAt || Date.now()).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
        return h('div', { className: 'gr-item', key: item.fullName },
          h('div', { className: 'gr-iname' }, h('a', { href: item.url, target: '_blank', rel: 'noreferrer' }, item.fullName)),
          item.desc ? h('p', { className: 'gr-idesc', title: item.desc }, item.desc) : null,
          h('div', { className: 'gr-imeta' },
            item.lang ? h('span', { className: 'gr-dot', style: { background: item.color || '#8b949e' } }) : null,
            item.lang ? h('span', null, item.lang) : null,
            item.lang ? h('span', null, '·') : null,
            item.stars ? h('span', null, fmt(item.stars) + ' 星') : null,
            item.stars ? h('span', null, '·') : null,
            h('span', null, when + ' 收'),
            cloned ? h('span', null, '·') : null,
            cloned ? h('span', null, '已克隆') : null),
          h('div', { className: 'gr-iacts' },
            h('button', { className: 'gr-btn sm', type: 'button', disabled: cloned || busy[item.fullName] === 'clone', onClick: () => doClone(item) }, busy[item.fullName] === 'clone' ? '拉取中' : cloned ? '已克隆' : '克隆'),
            cloned ? h('button', { className: 'gr-btn sm', type: 'button', onClick: () => doReveal(item) }, '打开') : null,
            h('button', { className: 'gr-btn sm', type: 'button', onClick: () => openReadme(item) }, 'README'),
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
                h('div', { className: 'gr-hint' }, '现在可以：克隆私有仓库、提高接口额度。'),
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
                  '要读私有库，token 需要 ', h('code', null, 'repo'), ' 范围（classic）或仓库读权限（fine-grained）。',
                  h('br'),
                  '不想手动建也可以：终端里跑 ', h('code', null, 'gh auth login'), '，插件会自动复用 gh 的 token。'),
                h('div', { className: 'gr-rowline' },
                  h('button', { className: 'gr-btn primary', type: 'button', disabled: authBusy || tokenInput.trim().length < 20, onClick: submitToken }, authBusy ? '验证中…' : '保存并验证'),
                  h('button', { className: 'gr-btn', type: 'button', onClick: () => setAuthOpen(false) }, '取消')))))
        : null;

      return h('div', { className: 'gr-page', 'data-theme': theme },
        h('div', { className: 'gr-scroll' },
          h('div', { className: 'gr-wrap' },
            h('header', { className: 'gr-head' },
              h('div', { className: 'gr-brand' },
                h('div', null,
                  h('div', { className: 'gr-eyebrow' },
                    h('span', { className: 'gr-mark', 'aria-hidden': true }),
                    '发现 · Discovery'),
                  h('h1', { className: 'gr-title' }, 'GitHub 雷达'),
                  h('p', { className: 'gr-sub' }, '扫一眼今天在涨的仓库，顺手拿下来用。'))),
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
                onClick: () => { loadTrending(since, lang, true); loadState(); },
              }, loading ? '刷新中' : '刷新')),

            h('div', { className: 'gr-cols' },
              h('section', null,
                h('div', { className: 'gr-sec' },
                  h('h2', null, period[1] + '上升榜'),
                  h('span', { className: 'gr-count' }, loading ? '读取中' : rows.length + ' 个仓库')),
                via === 'search' && viaNote ? h('p', { className: 'gr-fallback' }, viaNote) : null,
                body),
              h('aside', { className: 'gr-shelf' },
                h('div', { className: 'gr-sec', style: { borderBottom: 0, paddingBottom: 0 } },
                  h('h2', null, '收藏夹'),
                  h('span', { className: 'gr-count' }, shelfQ.trim() ? shelfRows.length + ' / ' + collection.length : String(collection.length))),
                collection.length === 0
                  ? h('div', { className: 'gr-empty' }, h('b', null, '还空着。'), '榜单里看到值得留下的，点一下「收藏」。')
                  : h('div', null,
                      h('label', { className: 'gr-field gr-shelf-find' },
                        h('input', {
                          type: 'search', value: shelfQ, placeholder: '搜名字、描述、语言…',
                          onChange: (e) => setShelfQ(e.target.value), 'aria-label': '搜索收藏',
                        })),
                      shelfRows.length === 0
                        ? h('div', { className: 'gr-empty', style: { paddingTop: 18 } }, h('b', null, '没搜到。'), '换个词，或清空搜索框。')
                        : shelfRows.map(shelfView)),
                h('p', { className: 'gr-path' },
                  codeRoot ? '克隆到 ' + codeRoot.replace(/^\/Users\/[^/]+/, '~') : '克隆到 ~/Code',
                  root ? h('br') : null,
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
