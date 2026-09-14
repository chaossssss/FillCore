// ==UserScript==
// @name         FastForm 填写记忆（Element Plus / Vant）
// @version      1.2.3
// @match        http://192.168.120.228/*
// @match        http://192.168.100.156/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_addElement
// @inject-into  content
// ==/UserScript==

function ffMemApp() {
  "use strict";

  const VERSION = "1.2.3";
  const MAX_HIST = 30;
  const pageKey = () =>
    "ff_mem_" + location.pathname + location.hash.split("?")[0];
  const oldOriginKey = () =>
    "ff_mem_" + location.origin + location.pathname + location.hash.split("?")[0];
  const histKey = () => pageKey() + "_hist";
  const posKey = "ff_mem_bar_pos";

  function gmPing(op, key, val) {
    try {
      window.postMessage({ ns: "ff-mem-gm", op: op, key: key, val: val }, "*");
    } catch (_) {}
  }
  function storeGet(key) {
    try {
      const mem = window.__FF_MEM_INIT__;
      if (mem && mem[key] != null && String(mem[key]) !== "") return String(mem[key]);
    } catch (_) {}
    try {
      if (typeof GM_getValue === "function") {
        const v = GM_getValue(key, "");
        if (v) return String(v);
      }
    } catch (_) {}
    try {
      return localStorage.getItem(key) || "";
    } catch (_) {
      return "";
    }
  }

  function storeSet(key, val) {
    try {
      window.__FF_MEM_INIT__ = window.__FF_MEM_INIT__ || {};
      window.__FF_MEM_INIT__[key] = val;
    } catch (_) {}
    gmPing("set", key, val);
    try {
      if (typeof GM_setValue === "function") GM_setValue(key, val);
    } catch (_) {}
    try {
      localStorage.setItem(key, val);
    } catch (_) {}
  }

  function storeDel(key) {
    try {
      if (window.__FF_MEM_INIT__) delete window.__FF_MEM_INIT__[key];
    } catch (_) {}
    gmPing("del", key);
    try {
      if (typeof GM_deleteValue === "function") GM_deleteValue(key);
    } catch (_) {}
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  }

  function parseList(raw) {
    try {
      const arr = JSON.parse(raw || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function storePieces(key) {
    const out = [];
    const push = (v) => {
      if (v != null && String(v) !== "") out.push(String(v));
    };
    try {
      const mem = window.__FF_MEM_INIT__;
      if (mem) push(mem[key]);
    } catch (_) {}
    try {
      if (typeof GM_getValue === "function") push(GM_getValue(key, ""));
    } catch (_) {}
    try {
      push(localStorage.getItem(key));
    } catch (_) {}
    return out;
  }

  (function migrateShared() {
    const neu = pageKey();
    const old = oldOriginKey();
    const merged = [];
    const seen = new Set();
    storePieces(neu + "_hist")
      .concat(storePieces(old + "_hist"))
      .forEach((raw) => {
        parseList(raw).forEach((item) => {
          if (!item || !item.id || seen.has(item.id)) return;
          seen.add(item.id);
          merged.push(item);
        });
      });
    merged.sort((a, b) => (b.time || 0) - (a.time || 0));
    if (merged.length) storeSet(neu + "_hist", JSON.stringify(merged.slice(0, MAX_HIST)));
    if (!storeGet(neu)) {
      const latest = storePieces(neu).concat(storePieces(old)).find(Boolean);
      if (latest) storeSet(neu, latest);
    }
  })();

  function f2(v) {
    return Math.round(v * 100) / 100;
  }
  function circle6(cx, cy, r) {
    const h = r * (4 / 3) * Math.tan(Math.PI / 12);
    const angs = [-90, -30, 30, 90, 150, 210];
    const pts = angs.map((deg) => {
      const a = (deg * Math.PI) / 180;
      return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    });
    let d = "M" + f2(pts[0].x) + " " + f2(pts[0].y);
    for (let i = 0; i < 6; i++) {
      const p0 = pts[i];
      const p1 = pts[(i + 1) % 6];
      const a0 = (angs[i] * Math.PI) / 180;
      const a1 = (angs[(i + 1) % 6] * Math.PI) / 180;
      d +=
        "C" +
        f2(p0.x - Math.sin(a0) * h) + " " + f2(p0.y + Math.cos(a0) * h) + " " +
        f2(p1.x + Math.sin(a1) * h) + " " + f2(p1.y - Math.cos(a1) * h) + " " +
        f2(p1.x) + " " + f2(p1.y);
    }
    return d + "Z";
  }
  function poly6(pts) {
    let d = "M" + f2(pts[0][0]) + " " + f2(pts[0][1]);
    for (let i = 0; i < 6; i++) {
      const x0 = pts[i][0], y0 = pts[i][1];
      const x1 = pts[(i + 1) % 6][0], y1 = pts[(i + 1) % 6][1];
      d +=
        "C" +
        f2(x0 + (x1 - x0) / 3) + " " + f2(y0 + (y1 - y0) / 3) + " " +
        f2(x0 + ((x1 - x0) * 2) / 3) + " " + f2(y0 + ((y1 - y0) * 2) / 3) + " " +
        f2(x1) + " " + f2(y1);
    }
    return d + "Z";
  }
  function pathC(start, cubics) {
    let d = "M" + f2(start[0]) + " " + f2(start[1]);
    cubics.forEach((c) => {
      d += "C" + c.map(f2).join(" ");
    });
    return d + "Z";
  }
  function lineC(x0, y0, x1, y1) {
    return [
      x0 + (x1 - x0) / 3,
      y0 + (y1 - y0) / 3,
      x0 + ((x1 - x0) * 2) / 3,
      y0 + ((y1 - y0) * 2) / 3,
      x1,
      y1,
    ];
  }
  function circle8(cx, cy, r) {
    const h = r * (4 / 3) * Math.tan(Math.PI / 16);
    const angs = [-90, -45, 0, 45, 90, 135, 180, 225];
    const pts = angs.map((deg) => {
      const a = (deg * Math.PI) / 180;
      return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    });
    const cubics = [];
    for (let i = 0; i < 8; i++) {
      const p0 = pts[i];
      const p1 = pts[(i + 1) % 8];
      const a0 = (angs[i] * Math.PI) / 180;
      const a1 = (angs[(i + 1) % 8] * Math.PI) / 180;
      cubics.push([
        p0.x - Math.sin(a0) * h,
        p0.y + Math.cos(a0) * h,
        p1.x + Math.sin(a1) * h,
        p1.y - Math.cos(a1) * h,
        p1.x,
        p1.y,
      ]);
    }
    return pathC([pts[0].x, pts[0].y], cubics);
  }
  function roundRect8(x, y, w, h, r) {
    const k = 0.55228475;
    const x1 = x + w;
    const y1 = y + h;
    const mx = x + w / 2;
    return pathC([mx, y], [
      lineC(mx, y, x1 - r, y),
      [x1 - r + k * r, y, x1, y + r - k * r, x1, y + r],
      lineC(x1, y + r, x1, y1 - r),
      [x1, y1 - r + k * r, x1 - r + k * r, y1, x1 - r, y1],
      lineC(x1 - r, y1, x + r, y1),
      [x + r - k * r, y1, x, y1 - r + k * r, x, y1 - r],
      lineC(x, y1 - r, x, y + r),
      [x, y + r - k * r, x + r - k * r, y, x + r, y],
    ]);
  }
  const GLYPH = {
    outerOff: circle6(16, 16, 9),
    outerOn: poly6([
      [16, 4.2],
      [27, 10.6],
      [27, 21.4],
      [16, 27.8],
      [5, 21.4],
      [5, 10.6],
    ]),
    innerOff: circle8(16, 16, 3.2),
    innerOn: roundRect8(9.2, 13.4, 13.6, 5.2, 1.1),
    antOff: "M12.8 16L12.8 16M19.2 16L19.2 16",
    antOn: "M5.2 16L2.6 16M26.8 16L29.4 16",
  };
  const BOT =
    '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true">' +
    '<path class="outer" d="' + GLYPH.outerOff + '"></path>' +
    '<path class="inner" d="' + GLYPH.innerOff + '"></path>' +
    '<path class="ant" d="' + GLYPH.antOff + '"></path>' +
    "</svg>";

  const css = document.createElement("style");
  css.textContent = `
    #ff-hud, #ff-hud *, #ff-mem-hist, #ff-mem-hist *,
    #ff-mem-pick, #ff-mem-pick *, #ff-mem-ctx, #ff-mem-ctx * { box-sizing: border-box; }
    #ff-hud {
      position: fixed; z-index: 2147483647;
      font-family: "Microsoft YaHei", Consolas, sans-serif;
      color: #c8f7ff;
      right: 18px; bottom: 18px;
    }
    #ff-hud .core {
      width: 46px; height: 46px; border: 0; cursor: grab; padding: 0;
      position: relative;
      background: radial-gradient(circle at 50% 48%, #0c221c 0%, #061018 72%);
      clip-path: polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%);
      box-shadow: 0 0 0 1px #3dff9a77, 0 0 14px #1aff7033, inset 0 0 10px #0a2a20aa;
      color: #7af6ff;
      display: grid; place-items: center; user-select: none;
      transition: background .48s ease, box-shadow .48s ease, color .48s ease;
      animation: ffgreencore 1.8s ease-in-out infinite;
    }
    @keyframes ffgreencore {
      0%, 100% {
        box-shadow: 0 0 0 1px #1e8a4a66, 0 0 6px #1aff7022, inset 0 0 8px #061410cc;
      }
      50% {
        box-shadow: 0 0 0 1px #b8ffd0, 0 0 16px #3dff8acc, 0 0 28px #22ff7a77, inset 0 0 12px #3dff8a55;
      }
    }
    #ff-hud.open .core {
      background: radial-gradient(circle at 50% 46%, #1e4a5c 0 12%, #143848 48%, #061018 100%);
      box-shadow: 0 0 0 1px #6ec4dc99, 0 0 12px #3aa8c855, inset 0 0 8px #7ec8e033;
      color: #b7e6f2;
      animation: none;
    }
    #ff-hud .core svg { width: 28px; height: 28px; display: block; overflow: visible; }
    #ff-hud .core .outer {
      fill: none; stroke: #4dff9c; stroke-width: 1.55; stroke-linejoin: round;
      transition: stroke .45s ease, stroke-width .45s ease;
    }
    #ff-hud.open .core .outer { stroke: #8fd4ea; stroke-width: 1.65; }
    #ff-hud .core .inner {
      fill: #148a48;
      stroke: #7dffb0;
      stroke-width: .5;
      transform-box: fill-box;
      transform-origin: center;
      animation: ffgreen 1.8s ease-in-out infinite;
      transition: fill .45s ease, stroke .45s ease, stroke-width .45s ease;
    }
    @keyframes ffgreen {
      0%, 100% {
        fill: #0d6b38;
        filter: drop-shadow(0 0 1px #1a8a4a);
        transform: scale(.86);
      }
      50% {
        fill: #9fffc4;
        filter: drop-shadow(0 0 4px #7dffb0);
        transform: scale(1.22);
      }
    }
    #ff-hud.open .core .inner {
      stroke: #9adff0;
      stroke-width: 1.2;
      transform-box: fill-box;
      transform-origin: center;
      animation: ffvisor 1.6s ease-in-out infinite;
    }
    @keyframes ffvisor {
      0%, 100% {
        fill: #163848cc;
        filter: drop-shadow(0 0 1px #2a7a94);
        transform: scale(.9);
      }
      50% {
        fill: #8fd4eadd;
        filter: drop-shadow(0 0 5px #7ec8e8);
        transform: scale(1.16);
      }
    }
    #ff-hud .core .ant {
      fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round;
      opacity: 0; transition: opacity .28s ease .12s;
    }
    #ff-hud.open .core .ant { opacity: 1; }
    @keyframes ffpulse {
      0%, 100% { filter: brightness(1); }
      50% { filter: brightness(1.22); }
    }
    #ff-hud .core:hover { box-shadow: 0 0 0 1px #9fffc0, 0 0 18px #3dff8a88; }
    #ff-hud.open .core:hover { box-shadow: 0 0 0 1px #8fd4ea, 0 0 16px #3aa8c866; }
    #ff-hud .ring {
      position: absolute; inset: -6px; pointer-events: none;
      clip-path: polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%);
      border: 1px dashed #2ee6ff55;
      animation: ffspin 9s linear infinite;
    }
    #ff-hud.open .ring { animation-duration: 3.5s; border-color: #7af6ffaa; }
    @keyframes ffspin { to { transform: rotate(360deg); } }
    #ff-hud .beam {
      position: absolute; left: 50%; bottom: 42px; width: 26px; margin-left: -13px;
      height: 0; opacity: 0; pointer-events: none;
      background: linear-gradient(to top, #7af6ffaa, #7af6ff14);
      clip-path: polygon(36% 100%, 64% 100%, 100% 0, 0 0);
      box-shadow: 0 0 18px #00e5ff88;
      filter: blur(.4px);
      transform-origin: 50% 100%;
      transition: height .22s ease .2s, opacity .18s ease .2s;
    }
    #ff-hud.open .beam {
      height: 20px; opacity: .9;
      transition: height .28s ease, opacity .18s ease;
    }
    #ff-hud .menu {
      position: absolute; right: -10px; bottom: 60px; width: 188px;
      padding: 0; overflow: visible;
      background:
        linear-gradient(180deg, rgba(0,229,255,.12), transparent 26%),
        repeating-linear-gradient(0deg, transparent 0 10px, rgba(46,230,255,.045) 11px),
        #061018f6;
      border: 1px solid #2ee6ff88;
      box-shadow: 0 0 32px #00d4ff55, 0 0 0 1px #083040 inset, inset 0 0 28px #00e5ff14;
      clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
      transform-origin: 88% 100%;
      opacity: 0; visibility: hidden; pointer-events: none;
      transform: perspective(460px) rotateX(68deg) translateY(10px) scaleY(.18) scaleX(.72);
      filter: blur(10px) brightness(1.8);
      transition: opacity .26s ease, transform .3s ease, filter .26s ease, visibility .3s;
    }
    #ff-hud.open .menu {
      opacity: 1; visibility: visible; pointer-events: auto;
      transform: perspective(460px) rotateX(0deg) translateY(0) scaleY(1) scaleX(1);
      filter: none;
      transition: opacity .42s ease .16s, transform .52s cubic-bezier(.14,1.15,.28,1) .16s, filter .4s ease .16s, visibility .5s;
      animation: ffholo 5.5s ease-in-out .62s infinite;
    }
    #ff-hud.dock .menu {
      opacity: 0 !important; visibility: hidden !important; pointer-events: none !important;
      transition: none !important; animation: none !important; filter: none !important;
    }
    @keyframes ffholo {
      0%, 100% { filter: brightness(1); }
      46% { filter: brightness(1); }
      48% { filter: brightness(1.35) saturate(1.25); }
      50% { filter: brightness(.82) hue-rotate(-8deg); }
      53% { filter: brightness(1.12); }
      56% { filter: brightness(1); }
    }
    #ff-hud .menu::before, #ff-hud .menu::after {
      content: ""; position: absolute; width: 12px; height: 12px;
      border: 1.5px solid #7af6ff; pointer-events: none; z-index: 6;
    }
    #ff-hud .menu::before { top: 5px; left: 5px; border-right: 0; border-bottom: 0; }
    #ff-hud .menu::after { bottom: 5px; right: 5px; border-left: 0; border-top: 0; }
    #ff-hud .menu .m-edge {
      position: absolute; left: 0; right: 0; top: 0; height: 2px; z-index: 5;
      background: linear-gradient(90deg, transparent, #7af6ff, #fff, #00e5ff, transparent);
      background-size: 220% 100%;
      animation: ffedge 2.2s linear infinite;
      box-shadow: 0 0 10px #00e5ff;
    }
    @keyframes ffedge {
      from { background-position: 120% 0; }
      to { background-position: -120% 0; }
    }
    #ff-hud .menu .m-scan {
      position: absolute; left: 0; right: 0; height: 46px; pointer-events: none; z-index: 4;
      background: linear-gradient(180deg, transparent, #7af6ff22, transparent);
      animation: ffscan 2.4s linear infinite;
    }
    #ff-hud .menu .m-hd {
      position: relative; z-index: 3;
      display: flex; align-items: center; gap: 7px;
      padding: 9px 12px 7px 14px;
      font: 10px Consolas, monospace; letter-spacing: 2.5px; color: #7af6ff;
      border-bottom: 1px solid #2ee6ff33;
      background: linear-gradient(90deg, #0e304477, transparent);
    }
    #ff-hud .menu .led {
      width: 7px; height: 7px;
      background: #7af6ff;
      clip-path: polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%);
      box-shadow: 0 0 10px #00e5ff;
      animation: ffpulse 1.1s ease-in-out infinite;
    }
    #ff-hud .menu .m-ver {
      color: #4a8890; letter-spacing: 1px; font-size: 9px;
    }
    #ff-hud .menu .m-tag {
      margin-left: auto; color: #6f6; letter-spacing: 1px; font-size: 9px;
      text-shadow: 0 0 8px #6f6;
      animation: ffpulse 1.6s ease-in-out infinite;
    }
    #ff-hud .menu .m-list { display: grid; gap: 5px; padding: 8px 8px 4px; position: relative; z-index: 3; }
    #ff-hud .menu button {
      appearance: none; border: 1px solid #2ee6ff44;
      background: linear-gradient(90deg, #0b2836d9, #07141ccc 42%);
      color: #d7fbff; height: 34px; padding: 0 10px 0 0;
      display: grid; grid-template-columns: 30px 1fr auto; align-items: center;
      font: 13px/1 "Microsoft YaHei", sans-serif; cursor: pointer;
      position: relative; overflow: hidden; opacity: 0;
      clip-path: polygon(8px 0, 100% 0, 100% 100%, 8px 100%, 0 50%);
      transition: border-color .18s, box-shadow .18s, background .18s, transform .18s;
    }
    #ff-hud .menu button::before {
      content: ""; position: absolute; left: 0; top: 5px; bottom: 5px; width: 3px;
      background: #2ee6ff77; box-shadow: 0 0 6px #00e5ff44;
    }
    #ff-hud .menu button::after {
      content: ""; position: absolute; inset: 0;
      background: linear-gradient(110deg, transparent 28%, #ffffff2e 48%, transparent 68%);
      transform: translateX(-130%); pointer-events: none;
    }
    #ff-hud .menu button .idx {
      font: 10px Consolas, monospace; color: #4de8ff; letter-spacing: 0; text-align: center;
      text-shadow: 0 0 8px #00e5ff;
    }
    #ff-hud .menu button .lab { letter-spacing: 2px; }
    #ff-hud .menu button .en {
      font: 9px Consolas, monospace; color: #4a8890; letter-spacing: 1px;
    }
    #ff-hud.open .menu button { animation: ffin .42s cubic-bezier(.2,.8,.2,1) forwards; }
    #ff-hud.open .menu button:nth-child(1) { animation-delay: .28s; }
    #ff-hud.open .menu button:nth-child(2) { animation-delay: .34s; }
    #ff-hud.open .menu button:nth-child(3) { animation-delay: .40s; }
    #ff-hud.open .menu button:nth-child(4) { animation-delay: .46s; }
    #ff-hud.open .menu button:nth-child(5) { animation-delay: .52s; }
    #ff-hud.open .menu button:nth-child(6) { animation-delay: .58s; }
    @keyframes ffin {
      from { opacity: 0; filter: blur(8px); }
      to { opacity: 1; filter: none; }
    }
    #ff-hud .menu button:hover {
      transform: translateX(-3px);
      border-color: #7af6ff;
      box-shadow: 0 0 16px #00e5ff66, inset 0 0 12px #00e5ff22;
    }
    #ff-hud .menu button:hover::before { box-shadow: 0 0 10px currentColor; }
    #ff-hud .menu button:hover::after { transform: translateX(130%); transition: transform .45s ease; }
    #ff-hud .menu button:hover .en { color: #c8f7ff; }
    #ff-hud .menu button[data-a="save"]:hover { background: linear-gradient(90deg, #0d3a4e, #071820); }
    #ff-hud .menu button[data-a="save"]::before { background: #4de8ff; }
    #ff-hud .menu button[data-a="fill"]:hover { background: linear-gradient(90deg, #0b3a32, #071820); }
    #ff-hud .menu button[data-a="fill"]::before { background: #5fffc0; }
    #ff-hud .menu button[data-a="fill"] .idx { color: #5fffc0; }
    #ff-hud .menu button[data-a="mock"]:hover { background: linear-gradient(90deg, #3a1830, #071820); }
    #ff-hud .menu button[data-a="mock"]::before { background: #ff7ad9; }
    #ff-hud .menu button[data-a="mock"] .idx { color: #ff7ad9; }
    #ff-hud .menu button[data-a="hist"]:hover { background: linear-gradient(90deg, #2a1f4a, #071820); }
    #ff-hud .menu button[data-a="hist"]::before { background: #b89bff; }
    #ff-hud .menu button[data-a="hist"] .idx { color: #b89bff; }
    #ff-hud .menu button[data-a="copy"]:hover { background: linear-gradient(90deg, #3a3010, #071820); }
    #ff-hud .menu button[data-a="copy"]::before { background: #ffd36a; }
    #ff-hud .menu button[data-a="copy"] .idx { color: #ffd36a; }
    #ff-hud .menu button[data-a="imp"]:hover { background: linear-gradient(90deg, #3a1c10, #071820); }
    #ff-hud .menu button[data-a="imp"]::before { background: #ff9a62; }
    #ff-hud .menu button[data-a="imp"] .idx { color: #ff9a62; }
    #ff-hud .hint {
      position: relative; z-index: 3;
      font: 9px Consolas, monospace; color: #4a8890; letter-spacing: 1px;
      text-align: center; padding: 4px 8px 8px; opacity: 0;
    }
    #ff-hud.open .hint { animation: ffin .3s ease .62s forwards; }
    #ff-mem-toast {
      position: fixed; left: 50%; bottom: 80px; transform: translateX(-50%) translateY(8px);
      z-index: 2147483647; padding: 8px 14px; font: 12px "Microsoft YaHei", sans-serif;
      color: #9ef6ff; background: #061018ee; border: 1px solid #2ee6ff88;
      box-shadow: 0 0 16px #00e5ff44; opacity: 0; pointer-events: none;
      transition: .25s ease; white-space: nowrap;
    }
    #ff-mem-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

    #ff-mem-hist {
      display: none; position: fixed; z-index: 2147483647;
      width: min(560px, 94vw); max-height: 58vh; overflow: hidden;
      color: #c8f7ff; font: 12px/1.4 "Microsoft YaHei", Consolas, sans-serif;
      background:
        linear-gradient(180deg, rgba(0,229,255,.08), transparent 22%),
        repeating-linear-gradient(0deg, transparent 0 22px, rgba(46,230,255,.035) 23px),
        #061018f5;
      border: 1px solid #2ee6ff77;
      clip-path: polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px);
      box-shadow: 0 0 0 1px #083040 inset, 0 0 40px #00d4ff40, 0 18px 40px #0008;
      animation: ffpanel .32s cubic-bezier(.2,.9,.2,1);
    }
    #ff-mem-hist::before, #ff-mem-hist::after {
      content: ""; position: absolute; width: 16px; height: 16px;
      border: 1.5px solid #7af6ff; pointer-events: none; z-index: 3;
    }
    #ff-mem-hist::before { top: 7px; left: 7px; border-right: 0; border-bottom: 0; }
    #ff-mem-hist::after { bottom: 7px; right: 7px; border-left: 0; border-top: 0; }
    #ff-mem-hist .scan {
      position: absolute; left: 0; right: 0; height: 80px; pointer-events: none; z-index: 2;
      background: linear-gradient(180deg, transparent, #7af6ff18, transparent);
      animation: ffscan 3.6s linear infinite;
    }
    @keyframes ffscan { from { top: -80px; } to { top: 100%; } }
    @keyframes ffpanel {
      from { opacity: 0; transform: translateY(10px) scale(.97); }
      to { opacity: 1; transform: none; }
    }
    #ff-mem-hist .hd {
      position: relative; z-index: 4;
      padding: 12px 16px 10px 18px;
      display: flex; align-items: center; gap: 8px;
      background: linear-gradient(90deg, #0e3044aa, transparent);
      border-bottom: 1px solid #2ee6ff33;
    }
    #ff-mem-hist .mark {
      width: 11px; height: 11px; background: #7af6ff;
      clip-path: polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%);
      box-shadow: 0 0 10px #00e5ff;
    }
    #ff-mem-hist .ttl { font-size: 13px; letter-spacing: 4px; }
    #ff-mem-hist .cnt {
      margin-left: auto; font-family: Consolas, monospace; color: #7af6ff;
      border: 1px solid #2ee6ff55; padding: 2px 8px; font-size: 11px;
    }
    #ff-mem-hist .cnt i { color: #4a8890; font-style: normal; }
    #ff-mem-hist .wipe {
      border: 1px solid #844; background: #1a1010; color: #f88;
      padding: 2px 8px; cursor: pointer; font: 11px "Microsoft YaHei", sans-serif;
      letter-spacing: 1px;
    }
    #ff-mem-hist .wipe:hover { border-color: #f88; box-shadow: 0 0 8px #f844; }
    #ff-mem-hist .wipe:disabled { opacity: .35; cursor: default; box-shadow: none; border-color: #533; }
    #ff-mem-hist .x {
      border: 0; background: transparent; color: #7af6ff; cursor: pointer;
      font-size: 15px; line-height: 1; padding: 2px 4px;
    }
    #ff-mem-hist .x:hover { color: #fff; text-shadow: 0 0 8px #7af6ff; }
    #ff-mem-hist .bd {
      position: relative; z-index: 1;
      overflow: auto; max-height: calc(58vh - 48px);
      padding: 10px 12px 14px;
    }
    #ff-mem-hist .bd::-webkit-scrollbar { width: 6px; }
    #ff-mem-hist .bd::-webkit-scrollbar-thumb { background: #2ee6ff55; }
    #ff-mem-hist .row {
      display: grid; grid-template-columns: 1fr auto; gap: 6px 10px;
      padding: 10px 12px; margin-bottom: 7px;
      background: #071820cc; border: 1px solid #1a4a58; border-left: 2px solid #2ee6ff99;
      clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%);
      animation: ffin .28s ease both;
      transition: border-color .15s, box-shadow .15s, transform .15s, background .15s;
    }
    #ff-mem-hist .row:hover {
      border-color: #7af6ff; border-left-color: #7af6ff;
      background: #0c2834; box-shadow: 0 0 16px #00e5ff33;
      transform: translateX(3px);
    }
    #ff-mem-hist .row input {
      width: 100%; background: transparent; border: 0; border-bottom: 1px solid #2ee6ff33;
      color: #e8ffff; padding: 2px 0; outline: none; font: 13px "Microsoft YaHei", sans-serif;
    }
    #ff-mem-hist .row input:focus { border-bottom-color: #7af6ff; }
    #ff-mem-hist .meta {
      display: flex; gap: 10px; align-items: center;
      color: #6ab; font: 11px Consolas, monospace; grid-column: 1;
    }
    #ff-mem-hist .chip {
      color: #7af6ff; border: 1px solid #2ee6ff44; padding: 0 6px; line-height: 16px;
    }
    #ff-mem-hist .preview {
      grid-column: 1 / -1; color: #7a9aa8; font-size: 11px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    #ff-mem-hist .ops { display: flex; gap: 4px; align-items: flex-start; }
    #ff-mem-hist .op {
      border: 1px solid #2ee6ff55; background: #0a2030; color: #9ef6ff;
      padding: 3px 8px; cursor: pointer; font: 12px "Microsoft YaHei", sans-serif;
      transition: .15s ease;
    }
    #ff-mem-hist .op:hover { box-shadow: 0 0 10px #00e5ff66; border-color: #7af6ff; }
    #ff-mem-hist .del { color: #f88; border-color: #844; }
    #ff-mem-hist .empty {
      text-align: center; padding: 36px 12px 28px; color: #5aa;
    }
    #ff-mem-hist .empty .hex {
      width: 36px; height: 36px; margin: 0 auto 12px;
      border: 1px solid #2ee6ff66;
      clip-path: polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%);
      box-shadow: 0 0 16px #00e5ff33 inset;
    }
    #ff-mem-hist .empty p { margin: 0 0 4px; color: #9ef6ff; letter-spacing: 2px; }

    #ff-mem-pick {
      display: none; position: fixed; z-index: 2147483647;
      width: min(420px, calc(100vw - 88px)); max-height: min(58vh, calc(100vh - 24px));
      overflow: hidden; flex-direction: column;
      color: #c8f7ff; font: 12px/1.4 "Microsoft YaHei", Consolas, sans-serif;
      background:
        linear-gradient(180deg, rgba(0,229,255,.08), transparent 22%),
        repeating-linear-gradient(0deg, transparent 0 22px, rgba(46,230,255,.035) 23px),
        #061018f5;
      border: 1px solid #2ee6ff77;
      box-shadow: 0 0 0 1px #083040 inset, 0 0 40px #00d4ff40, 0 18px 40px #0008;
      animation: ffpanel .32s cubic-bezier(.2,.9,.2,1);
    }
    #ff-mem-pick .hd {
      position: relative; z-index: 4;
      padding: 12px 16px 10px 18px;
      display: flex; align-items: center; gap: 8px;
      background: linear-gradient(90deg, #0e3044aa, transparent);
      border-bottom: 1px solid #2ee6ff33;
    }
    #ff-mem-pick .mark {
      width: 11px; height: 11px; background: #7af6ff;
      clip-path: polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%);
      box-shadow: 0 0 10px #00e5ff;
    }
    #ff-mem-pick .ttl { font-size: 13px; letter-spacing: 4px; }
    #ff-mem-pick .cnt {
      margin-left: auto; font-family: Consolas, monospace; color: #7af6ff;
      border: 1px solid #2ee6ff55; padding: 2px 8px; font-size: 11px;
    }
    #ff-mem-pick .x {
      border: 0; background: transparent; color: #7af6ff; cursor: pointer;
      font-size: 15px; line-height: 1; padding: 2px 4px;
    }
    #ff-mem-pick .x:hover { color: #fff; text-shadow: 0 0 8px #7af6ff; }
    #ff-mem-pick .bd {
      overflow: auto; flex: 1; min-height: 0; max-height: none;
      padding: 10px 12px 8px; position: relative; z-index: 1;
    }
    #ff-mem-pick .bd::-webkit-scrollbar { width: 6px; }
    #ff-mem-pick .bd::-webkit-scrollbar-thumb { background: #2ee6ff55; }
    #ff-mem-pick .line {
      display: grid; grid-template-columns: 18px minmax(0, 1fr) minmax(80px, 42%);
      gap: 8px; align-items: center;
      padding: 7px 10px; margin-bottom: 4px;
      background: #071820cc; border: 1px solid #1a4a58; border-left: 2px solid #2ee6ff99;
      cursor: pointer;
    }
    #ff-mem-pick .line:hover { border-color: #7af6ff; background: #0c2834; }
    #ff-mem-pick .line .k { color: #9ef6ff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #ff-mem-pick .line .n { color: #4a8890; font: 10px Consolas, monospace; margin-left: 6px; }
    #ff-mem-pick .line .v {
      color: #7af6ff; font: 11px Consolas, monospace; text-align: right;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    #ff-mem-pick .line input { accent-color: #7af6ff; margin: 0; }
    #ff-mem-pick .ft {
      display: flex; gap: 6px; align-items: center; flex-wrap: wrap;
      padding: 10px 14px 14px; border-top: 1px solid #2ee6ff33;
      position: relative; z-index: 4; flex-shrink: 0; background: #061018;
    }
    #ff-mem-pick .ft .sp { margin-left: auto; color: #6ab; font: 11px Consolas, monospace; }
    #ff-mem-pick .op {
      border: 1px solid #2ee6ff55; background: #0a2030; color: #9ef6ff;
      padding: 6px 12px; cursor: pointer; font: 12px "Microsoft YaHei", sans-serif;
      flex-shrink: 0;
    }
    #ff-mem-pick .op:hover { box-shadow: 0 0 10px #00e5ff66; border-color: #7af6ff; }
    #ff-mem-pick .go {
      color: #061018; background: #5fffc0; border-color: #5fffc0; font-weight: 700;
      padding: 6px 16px;
    }
    #ff-mem-pick .go:hover { color: #061018; box-shadow: 0 0 14px #5fffc088; }

    #ff-mem-ctx {
      display: none; position: fixed; z-index: 2147483647;
      min-width: 148px; padding: 6px;
      background: #061018f6; border: 1px solid #2ee6ff88;
      box-shadow: 0 0 24px #00d4ff55, 0 0 0 1px #083040 inset;
      clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
    }
    #ff-mem-ctx button {
      display: block; width: 100%; text-align: left; border: 0;
      background: transparent; color: #d7fbff; cursor: pointer;
      padding: 7px 10px; font: 12px "Microsoft YaHei", sans-serif;
    }
    #ff-mem-ctx button:hover { background: #0c2834; color: #7af6ff; }
    #ff-mem-ctx button[disabled] { color: #4a8890; cursor: default; }
  `;
  document.documentElement.appendChild(css);

  function toast(msg, ms) {
    let el = document.getElementById("ff-mem-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "ff-mem-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), ms || 1800);
  }

  function toastStats(head, s) {
    toast(
      head + " 成功 " + (s.ok || 0) + " · 跳过 " + (s.skip || 0) + " · 失败 " + (s.fail || 0),
      2800
    );
  }

  function collectVnodes(vnode, stack) {
    if (!vnode) return;
    if (vnode.component) stack.push(vnode.component);
    const ch = vnode.children;
    if (Array.isArray(ch)) ch.forEach((c) => collectVnodes(c, stack));
    else if (ch && typeof ch === "object") {
      Object.values(ch).forEach((v) => {
        if (Array.isArray(v)) v.forEach((c) => collectVnodes(c, stack));
        else if (v && (v.component || v.children)) collectVnodes(v, stack);
      });
    }
  }

  function allVueInstances() {
    const seen = new Set();
    const stack = [];
    document.querySelectorAll("*").forEach((el) => {
      if (el.__vueParentComponent) stack.push(el.__vueParentComponent);
    });
    const appEl =
      document.querySelector("#app") || document.querySelector("[data-v-app]");
    if (appEl?.__vue_app__?._instance) stack.push(appEl.__vue_app__._instance);
    const out = [];
    while (stack.length) {
      const inst = stack.pop();
      if (!inst || seen.has(inst)) continue;
      seen.add(inst);
      out.push(inst);
      collectVnodes(inst.subTree, stack);
    }
    return out;
  }

  function rootEl(inst) {
    const el = inst.vnode?.el;
    if (el && el.nodeType === 1) return el;
    if (el && el.parentElement) return el.parentElement;
    return null;
  }

  function formApi(inst) {
    const cands = [inst.exposed, inst.proxy, inst.ctx].filter(Boolean);
    for (const o of cands) {
      if (typeof o.getValues === "function" && typeof o.setValues === "function")
        return o;
    }
    return null;
  }

  function preferOverlay(list) {
    const overlay = list.filter((a) => inOpenOverlay(a.el));
    const pool = overlay.length ? overlay : list;
    return pool.filter(
      (a) =>
        !pool.some(
          (b) => b !== a && b.el && a.el && b.el !== a.el && b.el.contains(a.el)
        )
    );
  }

  function findFastForms() {
    const list = [];
    for (const inst of allVueInstances()) {
      const api = formApi(inst);
      if (!api) continue;
      list.push({ kind: "fastform", api, el: rootEl(inst), inst });
    }
    return preferOverlay(list);
  }

  function findUiForms() {
    const list = [];
    for (const inst of allVueInstances()) {
      const name = inst.type?.name || inst.type?.__name || "";
      const el = rootEl(inst);
      const cls = el?.classList;
      const props = inst.props || {};
      if (name === "ElForm" || cls?.contains("el-form")) {
        if (props.model && typeof props.model === "object") {
          list.push({
            kind: "el-form",
            el,
            inst,
            get: () => JSON.parse(JSON.stringify(props.model)),
            set: (data) => Object.assign(props.model, data),
          });
        }
      }
      if (name === "VanForm" || name === "Form" || cls?.contains("van-form")) {
        const exp = inst.exposed || inst.proxy;
        if (typeof exp?.getValues === "function") {
          list.push({
            kind: "van-form",
            el,
            inst,
            get: () => exp.getValues(),
            set: (data) => {
              if (typeof exp.setValues === "function") return exp.setValues(data);
              Object.assign(props.model || {}, data);
            },
          });
        }
      }
    }
    return preferOverlay(list);
  }

  function nativeCollect() {
    const data = {};
    document.querySelectorAll("input, textarea, select").forEach((el, i) => {
      if (["password", "file", "hidden", "submit", "button"].includes(el.type))
        return;
      if (el.closest(".el-select, .el-date-editor, .el-cascader, .van-picker"))
        return;
      if (el.type === "checkbox") {
        data[el.name || "cb_" + i] = el.checked;
        return;
      }
      if (el.type === "radio") {
        if (el.checked && el.name) data[el.name] = el.value;
        return;
      }
      const k = el.name || el.id || "idx_" + i;
      if (el.value) data[k] = el.value;
    });
    return data;
  }

  function nativeFill(data, onlyEmpty) {
    document.querySelectorAll("input, textarea, select").forEach((el, i) => {
      if (["password", "file"].includes(el.type)) return;
      if (el.closest(".el-select, .el-date-editor, .el-cascader")) return;
      const proto =
        el.tagName === "TEXTAREA"
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      const apply = (v) => {
        if (setter) setter.call(el, v);
        else el.value = v;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      if (el.type === "checkbox") {
        if (onlyEmpty && el.checked) return;
        const v = data[el.name || "cb_" + i];
        if (typeof v === "boolean") {
          el.checked = v;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
        return;
      }
      if (el.type === "radio" && data[el.name] === el.value) {
        if (onlyEmpty && document.querySelector('input[type="radio"][name="' + el.name + '"]:checked'))
          return;
        el.checked = true;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }
      const k = el.name || el.id || "idx_" + i;
      if (onlyEmpty && String(el.value || "").trim()) return;
      if (data[k] != null) apply(data[k]);
    });
  }

  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function valEq(a, b) {
    if (a === b) return true;
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }

  function tally(before, after, patch) {
    let ok = 0, fail = 0;
    for (const [k, v] of Object.entries(patch || {})) {
      if (valEq(after[k], v)) ok++;
      else if (!valEq(before[k], after[k]) && !isEmpty(after[k])) ok++;
      else fail++;
    }
    return { ok, fail };
  }

  function currentForms() {
    const ff = findFastForms();
    if (ff.length) {
      return ff.map((f) => ({
        kind: "fastform",
        el: f.el,
        get: () => f.api.getValues() || {},
        set: (data) => {
          try {
            f.api.setValues(data);
          } catch (_) {}
          if (typeof f.api.setFieldValue === "function") {
            Object.entries(data || {}).forEach(([k, v]) => {
              try {
                f.api.setFieldValue(k, v);
              } catch (__) {}
            });
          }
        },
      }));
    }
    const ui = findUiForms();
    if (ui.length) {
      return ui.map((f) => ({
        kind: f.kind,
        el: f.el,
        get: () => f.get() || {},
        set: (data) => f.set(data),
      }));
    }
    return [
      {
        kind: "native",
        el: document.body,
        get: () => nativeCollect(),
        set: (data, onlyEmpty) => nativeFill(data, onlyEmpty),
      },
    ];
  }

  function labelMap(el) {
    const m = new Map();
    metasInside(el).forEach((x) => m.set(x.name, x));
    return m;
  }

  function fmtVal(v) {
    if (v == null) return "";
    if (typeof v === "object") {
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    }
    return String(v);
  }

  function vueFieldName(el) {
    let inst = el && el.__vueParentComponent;
    let depth = 0;
    while (inst && depth < 14) {
      const p = inst.props || {};
      if (p.name != null && p.name !== "") return String(p.name);
      if (p.prop != null && p.prop !== "") return String(p.prop);
      inst = inst.parent;
      depth++;
    }
    return "";
  }

  function overlaySelector() {
    return [
      ".el-dialog",
      ".el-drawer",
      ".el-overlay-dialog",
      ".el-dialog__wrapper",
      ".el-message-box",
      ".van-popup",
      ".van-dialog",
    ].join(",");
  }

  function isDialogBox(el) {
    const c = el.classList;
    return (
      c.contains("el-dialog") ||
      c.contains("el-drawer") ||
      c.contains("el-message-box") ||
      c.contains("van-dialog")
    );
  }

  function pickTopOverlay() {
    const raw = [...document.querySelectorAll(overlaySelector())].filter(isVisibleEl);
    if (!raw.length) return null;
    const scored = raw.map((el) => {
      const s = getComputedStyle(el);
      let z = parseInt(s.zIndex, 10);
      if (!Number.isFinite(z) || z === 0) {
        let p = el.parentElement;
        for (let i = 0; i < 6 && p; i++, p = p.parentElement) {
          const pz = parseInt(getComputedStyle(p).zIndex, 10);
          if (Number.isFinite(pz) && pz > 0) {
            z = pz;
            break;
          }
        }
      }
      if (!Number.isFinite(z)) z = 0;
      const r = el.getBoundingClientRect();
      const vp = window.innerWidth * window.innerHeight;
      const area = Math.max(1, r.width * r.height);
      return {
        el,
        z,
        inner: isDialogBox(el) ? 1 : 0,
        full: area > vp * 0.8 ? 1 : 0,
        area,
      };
    });
    scored.sort((a, b) => b.inner - a.inner || a.full - b.full || b.z - a.z || a.area - b.area);
    return scored[0].el;
  }

  async function snapshot() {
    const forms = currentForms();
    return {
      engine: forms[0]?.kind || "native",
      forms: forms.map((f, i) => ({ i, kind: f.kind, data: f.get() })),
    };
  }

  async function applyMerge(patches, { onlyEmpty } = {}) {
    const forms = currentForms();
    const befores = forms.map((f) => f.get());
    const used = forms.map((f, i) => {
      const src = patches[i] != null ? patches[i] : patches.length === 1 ? patches[0] : {};
      const patch = { ...(src || {}) };
      if (onlyEmpty) {
        Object.keys(patch).forEach((k) => {
          if (!isEmpty(befores[i][k])) delete patch[k];
        });
      }
      return patch;
    });
    const write = () => {
      forms.forEach((f, i) => {
        const patch = used[i];
        if (!patch || !Object.keys(patch).length) return;
        try {
          if (f.kind === "native") f.set(patch, !!onlyEmpty);
          else f.set({ ...befores[i], ...patch });
        } catch (_) {
          try {
            f.set(patch);
          } catch (__) {}
        }
      });
    };
    write();
    await delay(350);
    write();
    const afters = forms.map((f) => f.get());
    let ok = 0, fail = 0;
    used.forEach((patch, i) => {
      const t = tally(befores[i], afters[i], patch);
      ok += t.ok;
      fail += t.fail;
    });
    return { engine: forms[0].kind + "×" + forms.length, ok, fail };
  }

  async function apply(payload) {
    const patches = (payload.forms || [{ data: payload }]).map((f) => f.data || {});
    return applyMerge(patches);
  }

  function junkField(name) {
    return !name || /^(el-id-|idx_|cb_)/.test(String(name));
  }

  function isVisibleEl(el) {
    if (!el || el.nodeType !== 1) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return false;
    const s = getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) !== 0;
  }

  function inOpenOverlay(el) {
    if (!el) return false;
    const modal = pickTopOverlay();
    if (!modal) return false;
    return modal === el || modal.contains(el);
  }

  function unwrapArr(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    if (Array.isArray(v.value)) return v.value;
    return [];
  }

  function preferType(next, prev) {
    const rank = (t) => {
      const x = String(t || "").toLowerCase().replace(/[-_]/g, "");
      if (!x || x === "text" || x === "search" || x === "button" || x === "hidden") return 0;
      if (x === "textarea" || x === "number" || x === "tel" || x === "email" || x === "digit") return 1;
      return 2;
    };
    return rank(next) >= rank(prev) ? next || prev : prev || next;
  }

  function dateEditorType(root) {
    if (!root || !root.querySelector) return "";
    const ed = root.querySelector(".el-date-editor, .el-time-picker");
    const cls = String((ed && ed.className) || "");
    if (/datetimerange/.test(cls)) return "datetimerange";
    if (/daterange/.test(cls)) return "daterange";
    if (/monthrange/.test(cls)) return "monthrange";
    if (/datetime/.test(cls)) return "datetime";
    if (/--month/.test(cls)) return "month";
    if (/--year/.test(cls)) return "year";
    if (/--week/.test(cls)) return "week";
    if (/--time/.test(cls) || /\bel-time-picker\b/.test(cls)) return "time";
    if (/--date/.test(cls) || /\bel-date-editor\b/.test(cls)) return "date";
    return "";
  }

  function walkSchema(schema, out) {
    for (const item of unwrapArr(schema)) {
      if (!item || typeof item !== "object") continue;
      if (item.name && (item.type || item.label)) out.push(item);
      walkSchema(item.schema, out);
      walkSchema(item.children, out);
      walkSchema(item.fields, out);
      walkSchema(item.columns, out);
    }
  }

  function schemaOf(inst) {
    const out = [];
    const p = inst?.props || {};
    const proxy = inst?.proxy || {};
    walkSchema(p.schema || p.fields || proxy.schema, out);
    return out;
  }

  function metasInside(formEl) {
    const map = new Map();
    const add = (m) => {
      if (junkField(m?.name)) return;
      const prev = map.get(m.name) || {};
      map.set(m.name, {
        name: m.name,
        type: preferType(m.type, prev.type),
        label: m.label || prev.label,
        placeholder: m.placeholder || prev.placeholder,
        options: m.options || prev.options,
        valueFormat: m.valueFormat || m["value-format"] || prev.valueFormat,
        isRange: m.isRange || m["is-range"] || prev.isRange,
        startPlaceholder: m.startPlaceholder || m["start-placeholder"] || prev.startPlaceholder,
        endPlaceholder: m.endPlaceholder || m["end-placeholder"] || prev.endPlaceholder,
      });
    };
    for (const inst of allVueInstances()) {
      const el = rootEl(inst);
      if (formEl && (!el || (el !== formEl && !formEl.contains(el)))) continue;
      const p = inst.props || {};
      const name = p.name || p.prop;
      if (name) {
        add({
          name,
          type: p.type,
          label: typeof p.label === "string" ? p.label : "",
          placeholder: p.placeholder,
          options: p.options,
          valueFormat: p.valueFormat || p["value-format"],
          isRange: p.isRange || p["is-range"],
          startPlaceholder: p.startPlaceholder || p["start-placeholder"],
          endPlaceholder: p.endPlaceholder || p["end-placeholder"],
        });
      }
      schemaOf(inst).forEach(add);
    }
    const root = formEl || document;
    root.querySelectorAll(".el-form-item, .van-field").forEach((item) => {
      const label = (
        item.querySelector(".el-form-item__label, .van-field__label")?.textContent || ""
      ).trim();
      const control = item.querySelector("input, textarea, select");
      const rawId = control?.name || control?.id || "";
      const name = junkField(rawId) ? vueFieldName(item) : rawId;
      if (name && !junkField(name))
        add({
          name,
          label,
          type: dateEditorType(item) || (control?.tagName === "TEXTAREA" ? "textarea" : control?.type),
          placeholder: control?.placeholder,
        });
    });
    return [...map.values()];
  }

  function metasNative() {
    const metas = [];
    document.querySelectorAll("input, textarea, select").forEach((el, i) => {
      if (["password", "file", "hidden", "submit", "button"].includes(el.type)) return;
      const wrap = el.closest(".el-form-item, .van-field");
      const label = (
        wrap?.querySelector(".el-form-item__label, .van-field__label")?.textContent ||
        (el.id && document.querySelector('label[for="' + el.id + '"]')?.textContent) ||
        ""
      ).trim();
      metas.push({
        name: el.name || (!junkField(el.id) && el.id) || "idx_" + i,
        type: dateEditorType(wrap) || (el.tagName === "TEXTAREA" ? "textarea" : el.type),
        label,
        placeholder: el.placeholder,
      });
    });
    return metas;
  }

  function textOf(meta) {
    return [meta.label, meta.name, meta.placeholder, meta.startPlaceholder, meta.endPlaceholder, meta.type]
      .filter((x) => x != null && x !== "")
      .join(" ");
  }

  function inferKind(meta) {
    const t = String(meta.type || "").toLowerCase().replace(/[-_]/g, "");
    const s = textOf(meta).toLowerCase();
    if (t === "password" || /密码/.test(s) || /\bpassword\b/.test(s)) return "";
    if (/验证码|captcha|sms.?code|checkcode/.test(s)) return "";
    if (t === "file" || t === "image") return "";
    if (/上传/.test(s) || /\b(upload|oss)\b/.test(s)) return "";
    if (/ipv6|ip.?v6/.test(s)) return "ipv6";
    if (/ipv4|ip.?v4|ip地址|ipaddress/.test(s) || (/\bip\b/.test(s) && /地址|address/.test(s))) return "ipv4";
    if (/\bmac\b|mac地址|mac.?addr/.test(s)) return "mac";
    if (/经度|longitude|\blng\b|\blon\b/.test(s) && !/纬度|latitude/.test(s)) return "lng";
    if (/纬度|latitude|\blat\b/.test(s) && !/经度|longitude/.test(s)) return "lat";
    if (/架设高度|erectheight/.test(s)) return "height";
    if (/保存天数|录像天数/.test(s)) return "days";
    if (t === "geo-location") return "";
    const isRange =
      !!meta.isRange ||
      !!meta["is-range"] ||
      /range/.test(t) ||
      /区间|起止|(日期|时间)\s*范围|范围\s*(日期|时间)|开始日期|结束日期/.test(s);
    if (isRange) {
      if (/month/.test(t)) return "monthrange";
      if (t === "datetimerange" || /日期时间/.test(s)) return "datetimerange";
      return "daterange";
    }
    if (t === "tel") return "phone";
    if (t === "email") return "email";
    if (t === "date") return "date";
    if (t === "datetime") return "datetime";
    if (t === "daterange") return "daterange";
    if (t === "datetimerange") return "datetimerange";
    if (t === "month") return "month";
    if (t === "monthrange") return "monthrange";
    if (t === "year") return "year";
    if (t === "time") return "time";
    if (t === "week") return "date";
    if (t === "switch") return "switch";
    if (t === "rate") return "rate";
    if (t === "slider") return "slider";
    if (t === "checkbox") return "options-multi";
    if (t === "radio" || t === "select" || t === "cascader" || t === "tree-select") return "option";
    if (t === "textarea") return "remark";
    if (t === "digit" || t === "number" || t === "input-number") {
      return /金额|价格|费用|amount|price|money|fee/.test(s) ? "amount" : "number";
    }
    if (/手机|电话|联系方式|mobile|phone|\btel\b/.test(s)) return "phone";
    if (/邮箱|e-?mail/.test(s)) return "email";
    if (/身份证|idcard|id.?card/.test(s)) return "idcard";
    if (/金额|价格|费用|amount|price|money/.test(s)) return "amount";
    if (/备注|说明|描述|remark|comment|\bnote\b|reason/.test(s)) return "remark";
    if (/地址|address/.test(s) && !/ipv?[46]|ip地址|ipaddress|email|\bmac\b/.test(s)) return "address";
    if (/国标编码|国际编码|standardcode|gb.?28181/.test(s)) return "gbcode";
    if (/备案|recordcode/.test(s)) return "recordcode";
    if (/设备编码|摄像机编码|cameracode/.test(s)) return "devicecode";
    if (/设备名称|devicename/.test(s)) return "devicename";
    if (/设备型号|型号|devicemodel/.test(s)) return "model";
    if (/点位俗称|点位名称|pointname/.test(s)) return "site";
    if (/补光/.test(s)) return "filllight";
    if (/行政区域|行政区划|所属区域/.test(s)) return "region";
    if (/路口|路段/.test(s)) return "road";
    if (/公司|企业名称|单位名称|company/.test(s)) return "company";
    if (/日期/.test(s)) return "date";
    if (/时间/.test(s)) return "datetime";
    if (/姓名|名字|联系人/.test(s)) return "name";
    if (/(^|_)(real.?name|nick.?name|contactname)(_|$)/i.test(String(meta.name))) return "name";
    if (/^(name)$/i.test(String(meta.name))) return "name";
    return "";
  }

  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }
  function ri(a, b) {
    return a + ((Math.random() * (b - a + 1)) | 0);
  }
  function pad(n) {
    return String(n).padStart(2, "0");
  }
  function ymd(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function hms(d) {
    return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }
  function addDays(d, n) {
    const x = new Date(d.getTime());
    x.setDate(x.getDate() + n);
    return x;
  }
  function fmt(meta, d) {
    const f = meta.valueFormat || meta["value-format"];
    if (f === "x") return d.getTime();
    if (f === "X") return Math.floor(d.getTime() / 1000);
    if (!f) return ymd(d);
    return String(f)
      .replace(/YYYY|yyyy/g, String(d.getFullYear()))
      .replace(/MM/g, pad(d.getMonth() + 1))
      .replace(/DD|dd/g, pad(d.getDate()))
      .replace(/HH/g, pad(d.getHours()))
      .replace(/mm/g, pad(d.getMinutes()))
      .replace(/ss/g, pad(d.getSeconds()));
  }
  function rangeVal(v) {
    if (v instanceof Date) return v.getTime();
    if (typeof v === "number") return v;
    const t = Date.parse(String(v).replace(/-/g, "/"));
    return Number.isFinite(t) ? t : String(v);
  }
  function orderedRange(a, b) {
    const va = rangeVal(a);
    const vb = rangeVal(b);
    if (typeof va === "number" && typeof vb === "number") return va <= vb ? [a, b] : [b, a];
    return String(a) <= String(b) ? [a, b] : [b, a];
  }
  function mockRange(meta, withTime) {
    const pair = datePair();
    const start = pair.start.getTime() <= pair.end.getTime() ? pair.start : pair.end;
    const end = pair.start.getTime() <= pair.end.getTime() ? pair.end : pair.start;
    if (withTime) {
      const f = meta.valueFormat || meta["value-format"] || "YYYY-MM-DD HH:mm:ss";
      return orderedRange(fmt({ valueFormat: f }, start), fmt({ valueFormat: f }, end));
    }
    return orderedRange(fmt(meta, start), fmt(meta, end));
  }

  const SURNAMES = "赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张";
  const GIVEN = "伟芳娜敏静丽强磊洋勇艳杰娟涛超秀英霞平刚桂英";
  const HN_SPOTS = [
    { area: "硖石街道", road: "海洲西路", cross: "工人路", lng: 120.4189, lat: 30.5255 },
    { area: "硖石街道", road: "西山路", cross: "水月亭路", lng: 120.4102, lat: 30.5318 },
    { area: "海洲街道", road: "水月亭路", cross: "海宁大道", lng: 120.4306, lat: 30.5324 },
    { area: "海昌街道", road: "文苑路", cross: "钱江路", lng: 120.4048, lat: 30.5196 },
    { area: "马桥街道", road: "马桥路", cross: "洛塘路", lng: 120.4547, lat: 30.5082 },
    { area: "盐官镇", road: "观潮路", cross: "建设路", lng: 120.5558, lat: 30.3934 },
    { area: "长安镇", road: "农发大道", cross: "长安路", lng: 120.2686, lat: 30.4561 },
    { area: "许村镇", road: "皮革城大道", cross: "许巷路", lng: 120.3759, lat: 30.5116 },
    { area: "斜桥镇", road: "斜桥大道", cross: "建设路", lng: 120.4887, lat: 30.4823 },
    { area: "周王庙镇", road: "建设路", cross: "周王路", lng: 120.3508, lat: 30.4479 },
    { area: "丁桥镇", road: "丁桥大道", cross: "人民路", lng: 120.6284, lat: 30.4452 },
    { area: "袁花镇", road: "人民路", cross: "袁花大道", lng: 120.7156, lat: 30.4781 },
    { area: "黄湾镇", road: "黄湾大道", cross: "盐黄线", lng: 120.6318, lat: 30.3726 },
  ];
  const DEVICE_MODELS = [
    "DS-2CD3346FWD-I",
    "DS-2CD3T47G1-L",
    "DS-2CD2385FWD-I",
    "DH-IPC-HFW4433M-I2",
    "DH-IPC-HDW2433T-A",
    "IPC-B120-M",
  ];
  let hnCtx = null;
  let dateCtx = null;
  function resetHainingCtx() {
    hnCtx = null;
    dateCtx = null;
  }
  function datePair() {
    if (!dateCtx) {
      const now = new Date();
      const start = addDays(now, -ri(0, 20));
      const end = addDays(start, ri(180, 400));
      dateCtx = { start, end, now };
    }
    return dateCtx;
  }
  function dateForMeta(meta, fallback) {
    const s = textOf(meta).toLowerCase();
    const pair = datePair();
    if (/开始/.test(s) && !/结束/.test(s)) return pair.start;
    if (/结束/.test(s) && !/开始/.test(s)) return pair.end;
    return fallback;
  }
  function hainingCtx() {
    if (!hnCtx) {
      const spot = pick(HN_SPOTS);
      const no = ri(1, 188);
      const seq = String(ri(1, 999999)).padStart(6, "0");
      const jitter = () => (Math.random() - 0.5) * 0.006;
      hnCtx = {
        address: "浙江省嘉兴市海宁市" + spot.area + spot.road + no + "号",
        region: "浙江省嘉兴市海宁市" + spot.area,
        road: spot.area + spot.road + "与" + spot.cross + "交叉口",
        site: spot.road + "监控点",
        deviceName: "海宁市" + spot.area + spot.road + "摄像机",
        gbCode: "33048100111320" + seq,
        deviceCode: "HN" + ymd(new Date()).replace(/-/g, "") + seq.slice(-4),
        recordCode: "BA330481" + ymd(new Date()).replace(/-/g, "").slice(2) + seq.slice(-4),
        model: pick(DEVICE_MODELS),
        fillLight: pick(["红外补光", "白光补光", "无补光", "激光补光"]),
        lng: (spot.lng + jitter()).toFixed(6),
        lat: (spot.lat + jitter()).toFixed(6),
      };
    }
    return hnCtx;
  }
  function hex2() {
    return ri(0, 255).toString(16).padStart(2, "0").toUpperCase();
  }
  function hex4() {
    return ri(0, 65535).toString(16).padStart(4, "0");
  }

  function mockPhone() {
    return pick(["138", "139", "150", "158", "186", "188", "199"]) + String(ri(10000000, 99999999));
  }
  function mockName() {
    return (
      SURNAMES[(Math.random() * SURNAMES.length) | 0] +
      GIVEN[(Math.random() * GIVEN.length) | 0] +
      (Math.random() > 0.45 ? GIVEN[(Math.random() * GIVEN.length) | 0] : "")
    );
  }
  function mockIdCard() {
    const area = "330481";
    const birth = String(ri(1978, 2000)) + pad(ri(1, 12)) + pad(ri(1, 28));
    const seq = String(ri(0, 999)).padStart(3, "0");
    const base = area + birth + seq;
    const w = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const c = "10X98765432";
    let sum = 0;
    for (let i = 0; i < 17; i++) sum += Number(base[i]) * w[i];
    return base + c[sum % 11];
  }
  function mockIpv4() {
    return "10." + ri(10, 88) + "." + ri(0, 255) + "." + ri(1, 254);
  }
  function mockIpv6() {
    return "fd12:" + hex4() + ":" + hex4() + "::" + hex4();
  }
  function mockMac() {
    return [hex2(), hex2(), hex2(), hex2(), hex2(), hex2()].join(":");
  }
  function optVal(o) {
    if (o == null || typeof o !== "object") return o;
    if ("value" in o) return o.value;
    if ("id" in o) return o.id;
    return o.text ?? o.label;
  }
  function optionsOf(meta) {
    return unwrapArr(meta.options).filter((o) => {
      const v = optVal(o);
      return v !== "" && v != null;
    });
  }
  function firstOption(meta) {
    const list = optionsOf(meta);
    return list.length ? optVal(list[0]) : undefined;
  }
  function firstCascade(meta) {
    const path = [];
    let cur = unwrapArr(meta.options);
    while (cur.length) {
      const n = cur[0];
      if (n == null || typeof n !== "object") {
        path.push(n);
        break;
      }
      path.push("value" in n ? n.value : n.id);
      cur = unwrapArr(n.children);
    }
    return path.length ? path : undefined;
  }

  function mockValue(kind, meta) {
    const now = new Date();
    if (kind === "phone") return mockPhone();
    if (kind === "name") return mockName();
    if (kind === "email") return "test_" + ri(1000, 9999) + "@example.com";
    if (kind === "idcard") return mockIdCard();
    if (kind === "remark") return "测试备注，无需处理";
    if (kind === "address") return hainingCtx().address;
    if (kind === "region") return hainingCtx().region;
    if (kind === "road") return hainingCtx().road;
    if (kind === "site") return hainingCtx().site;
    if (kind === "devicename") return hainingCtx().deviceName;
    if (kind === "gbcode") return hainingCtx().gbCode;
    if (kind === "devicecode") return hainingCtx().deviceCode;
    if (kind === "recordcode") return hainingCtx().recordCode;
    if (kind === "model") return hainingCtx().model;
    if (kind === "filllight") return hainingCtx().fillLight;
    if (kind === "lng") return hainingCtx().lng;
    if (kind === "lat") return hainingCtx().lat;
    if (kind === "height") return (ri(45, 80) / 10).toFixed(1);
    if (kind === "days") return pick([15, 30, 60, 90]);
    if (kind === "ipv4") return mockIpv4();
    if (kind === "ipv6") return mockIpv6();
    if (kind === "mac") return mockMac();
    if (kind === "company") return "海宁测试科技有限公司";
    if (kind === "amount") return (ri(100, 99999) / 100).toFixed(2);
    if (kind === "number") return ri(1, 99);
    if (kind === "switch") return true;
    if (kind === "rate") return 4;
    if (kind === "slider") return 50;
    if (kind === "date") return fmt(meta, dateForMeta(meta, now));
    if (kind === "datetime") {
      const f = meta.valueFormat || meta["value-format"] || "YYYY-MM-DD HH:mm:ss";
      return fmt({ valueFormat: f }, dateForMeta(meta, now));
    }
    if (kind === "time") return hms(now);
    if (kind === "month") return now.getFullYear() + "-" + pad(now.getMonth() + 1);
    if (kind === "year") return String(now.getFullYear());
    if (kind === "daterange") return mockRange(meta, false);
    if (kind === "datetimerange") return mockRange(meta, true);
    if (kind === "monthrange") {
      const pair = datePair();
      const a = pair.start.getFullYear() + "-" + pad(pair.start.getMonth() + 1);
      const b = pair.end.getFullYear() + "-" + pad(pair.end.getMonth() + 1);
      return a <= b ? [a, b] : [b, a];
    }
    if (kind === "option") {
      if (String(meta.type).toLowerCase() === "cascader") return firstCascade(meta);
      return firstOption(meta);
    }
    if (kind === "options-multi") {
      const v = firstOption(meta);
      return v == null ? undefined : [v];
    }
  }

  function isEmpty(v) {
    if (v == null) return true;
    if (typeof v === "string") return v.trim() === "";
    if (Array.isArray(v)) {
      if (v.length === 0) return true;
      if (v.length === 2 && v[0] != null && v[1] != null && rangeVal(v[0]) > rangeVal(v[1])) return true;
      return false;
    }
    if (typeof v === "object") return !Object.keys(v).length;
    return false;
  }

  function buildMock(metas, current) {
    resetHainingCtx();
    const data = {};
    for (const meta of metas) {
      if (!isEmpty(current[meta.name])) continue;
      const kind = inferKind(meta);
      if (!kind) continue;
      const v = mockValue(kind, meta);
      if (v !== undefined) data[meta.name] = v;
    }
    return data;
  }

  function planVirtual() {
    resetHainingCtx();
    const forms = currentForms();
    let skip = 0;
    const planned = forms.map((f) => {
      const current = f.get();
      const metas = f.kind === "native" ? metasNative() : metasInside(f.el);
      const rows = [];
      const mock = {};
      metas.forEach((meta) => {
        if (junkField(meta.name)) return;
        const kind = inferKind(meta);
        if (!kind) return;
        if (!isEmpty(current[meta.name])) {
          skip++;
          return;
        }
        const v = mockValue(kind, meta);
        if (v === undefined) {
          skip++;
          return;
        }
        mock[meta.name] = v;
        rows.push({
          formIndex: 0,
          key: meta.name,
          label: meta.label || meta.name,
          value: v,
          checked: true,
        });
      });
      return { current, mock, rows, set: f.set, kind: f.kind };
    });
    planned.forEach((p, i) => p.rows.forEach((r) => (r.formIndex = i)));
    return { planned, skip, engine: forms[0]?.kind };
  }

  function latestPayload() {
    const list = loadHist();
    if (list[0]) return { engine: list[0].engine, forms: list[0].forms, note: list[0].note, time: list[0].time };
    try {
      return JSON.parse(storeGet(pageKey()) || "null");
    } catch {
      return null;
    }
  }

  function entriesFromPayload(payload) {
    const forms = currentForms();
    const entries = [];
    (payload.forms || []).forEach((f, fi) => {
      const labels = labelMap(forms[fi]?.el || forms[0]?.el);
      Object.entries(f.data || {}).forEach(([k, v]) => {
        if (isEmpty(v)) return;
        const meta = labels.get(k);
        entries.push({
          formIndex: fi,
          key: k,
          label: meta?.label || k,
          value: v,
          checked: true,
        });
      });
    });
    return entries;
  }

  async function virtualFill() {
    const { planned, skip } = planVirtual();
    const entries = planned.flatMap((p) => p.rows);
    if (!entries.length) return toast(skip ? "空字段里没有可虚拟的项" : "没有识别到可填的空字段");
    openPick({
      title: "虚拟预览",
      entries,
      skip,
      confirmText: "写入",
      onConfirm: async (picked) => {
        const dataAll = {};
        picked.filter((e) => e.checked && !junkField(e.key)).forEach((e) => {
          dataAll[e.key] = e.value;
        });
        const forms = currentForms();
        const patches = forms.map((_, i) => {
          const data = {};
          picked
            .filter((e) => e.checked && e.formIndex === i && !junkField(e.key))
            .forEach((e) => (data[e.key] = e.value));
          return data;
        });
        const overlayIdx = forms.findIndex((f) => inOpenOverlay(f.el));
        if (overlayIdx >= 0) patches[overlayIdx] = { ...patches[overlayIdx], ...dataAll };
        const unchecked = picked.filter((e) => !e.checked).length;
        const stat = await applyMerge(patches);
        toastStats("虚拟", { ok: stat.ok, fail: stat.fail, skip: skip + unchecked });
      },
    });
  }

  function fieldCount(payload) {
    return (payload.forms || []).reduce(
      (s, f) => s + Object.keys(f.data || {}).length,
      0
    );
  }

  function previewText(payload) {
    const data = payload.forms?.[0]?.data || {};
    return (
      Object.entries(data)
        .slice(0, 4)
        .map(([k, v]) => k + "=" + String(v).slice(0, 12))
        .join("；") || "（空）"
    );
  }

  function loadHist() {
    return parseList(storeGet(histKey()));
  }

  function saveHist(list) {
    storeSet(histKey(), JSON.stringify(list.slice(0, MAX_HIST)));
  }

  function addHistory(payload, note) {
    const item = {
      id: Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      time: Date.now(),
      note: note || "",
      engine: payload.engine,
      forms: payload.forms,
    };
    saveHist([item, ...loadHist()].slice(0, MAX_HIST));
    storeSet(pageKey(), JSON.stringify(payload));
    return item;
  }

  function save() {
    const note = window.prompt("备注（可空，方便以后区分）", "") ?? "";
    snapshot().then((payload) => {
      addHistory(payload, note.trim());
      toast("已保存 " + fieldCount(payload) + " 个字段");
      renderHist();
    });
  }

  async function applyPayload(payload, title) {
    const patches = (payload.forms || [{ data: payload }]).map((f) => f.data || {});
    const stat = await applyMerge(patches);
    toastStats("回填「" + title + "」", { ok: stat.ok, fail: stat.fail, skip: 0 });
  }

  function fillLatest(pick) {
    const payload = latestPayload();
    if (!payload) return toast("这一页还没有历史");
    const title = payload.note || "最新一条";
    if (pick) return openFillPick(payload, title);
    applyPayload(payload, title);
  }

  function fillItem(id, pick) {
    const item = loadHist().find((x) => x.id === id);
    if (!item) return toast("这条已经不在了");
    const payload = { engine: item.engine, forms: item.forms };
    const title = item.note || timeStr(item.time);
    if (pick) return openFillPick(payload, title);
    applyPayload(payload, title);
  }

  function openFillPick(payload, title) {
    const entries = entriesFromPayload(payload);
    if (!entries.length) return toast("这条没有可回填的字段");
    openPick({
      title: "勾选回填",
      entries,
      skip: 0,
      confirmText: "回填",
      onConfirm: async (picked) => {
        const patches = (payload.forms || []).map((f, i) => {
          const data = {};
          picked
            .filter((e) => e.checked && e.formIndex === i)
            .forEach((e) => (data[e.key] = e.value));
          return data;
        });
        const unchecked = picked.filter((e) => !e.checked).length;
        const stat = await applyMerge(patches);
        toastStats("回填「" + title + "」", { ok: stat.ok, fail: stat.fail, skip: unchecked });
      },
    });
  }

  function delItem(id) {
    saveHist(loadHist().filter((x) => x.id !== id));
    renderHist();
  }

  function clearPageHist() {
    const n = loadHist().length;
    if (!n) return toast("这一页没有历史");
    if (!window.confirm("确定清空本页 " + n + " 条历史？")) return;
    saveHist([]);
    storeDel(pageKey());
    storeDel(oldOriginKey());
    storeDel(oldOriginKey() + "_hist");
    renderHist();
    toast("已清空本页历史");
  }

  function renameItem(id, note) {
    saveHist(loadHist().map((x) => (x.id === id ? { ...x, note } : x)));
  }

  function copyItem(id) {
    const item = loadHist().find((x) => x.id === id);
    if (!item) return;
    navigator.clipboard
      .writeText(JSON.stringify({ engine: item.engine, forms: item.forms }, null, 2))
      .then(() => toast("已复制该条"));
  }

  function copyLatest() {
    const list = loadHist();
    const payload = list[0]
      ? { engine: list[0].engine, forms: list[0].forms }
      : null;
    if (!payload) return toast("没有可复制的数据");
    navigator.clipboard
      .writeText(JSON.stringify(payload, null, 2))
      .then(() => toast("已复制"));
  }

  function imp() {
    navigator.clipboard.readText().then(
      (t) => {
        const payload = JSON.parse(t);
        const note = window.prompt("导入备注（可空）", "导入") ?? "导入";
        addHistory(payload, note.trim() || "导入");
        return apply(payload);
      }
    ).then(
      (stat) => {
        toastStats("已导入并回填", { ok: stat.ok, fail: stat.fail, skip: 0 });
        renderHist();
      },
      () => toast("剪贴板不是合法 JSON")
    );
  }

  function timeStr(ts) {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, "0");
    return p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  const panel = document.createElement("div");
  panel.id = "ff-mem-hist";
  const pickEl = document.createElement("div");
  pickEl.id = "ff-mem-pick";
  const ctx = document.createElement("div");
  ctx.id = "ff-mem-ctx";
  ctx.innerHTML =
    '<button type="button" data-a="mock1">虚拟此字段</button>' +
    '<button type="button" data-a="fill1">回填此字段</button>';

  function hidePick() {
    pickEl.style.display = "none";
    pickEl._opts = null;
    if (panel.style.display !== "block") hud.classList.remove("dock");
  }
  function hideCtx() {
    ctx.style.display = "none";
    ctx._field = null;
  }

  function openPick(opts) {
    setOpen(false);
    hud.classList.add("dock");
    hideCtx();
    panel.style.display = "none";
    pickEl._opts = {
      title: opts.title || "预览",
      entries: (opts.entries || []).map((e) => ({ ...e })),
      skip: opts.skip || 0,
      confirmText: opts.confirmText || "写入",
      onConfirm: opts.onConfirm,
    };
    pickEl.style.display = "flex";
    renderPick();
    placePick();
  }

  function renderPick() {
    const opts = pickEl._opts;
    if (!opts) return;
    pickEl.innerHTML =
      '<div class="hd"><span class="mark"></span><span class="ttl"></span>' +
      '<span class="cnt"></span><button type="button" class="x" title="关闭">✕</button></div>' +
      '<div class="bd"></div><div class="ft"></div>';
    pickEl.querySelector(".ttl").textContent = opts.title;
    pickEl.querySelector(".cnt").textContent =
      opts.entries.filter((e) => e.checked).length + "/" + opts.entries.length;
    pickEl.querySelector(".x").onclick = hidePick;
    const bd = pickEl.querySelector(".bd");
    opts.entries.forEach((ent) => {
      const line = document.createElement("label");
      line.className = "line";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!ent.checked;
      cb.addEventListener("change", () => {
        ent.checked = cb.checked;
        pickEl.querySelector(".cnt").textContent =
          opts.entries.filter((e) => e.checked).length + "/" + opts.entries.length;
      });
      const k = document.createElement("div");
      k.className = "k";
      k.append(ent.label || ent.key);
      if (ent.label && ent.label !== ent.key) {
        const nEl = document.createElement("span");
        nEl.className = "n";
        nEl.textContent = ent.key;
        k.appendChild(nEl);
      }
      const v = document.createElement("div");
      v.className = "v";
      v.textContent = fmtVal(ent.value);
      v.title = fmtVal(ent.value);
      line.append(cb, k, v);
      bd.appendChild(line);
    });
    const ft = pickEl.querySelector(".ft");
    const mk = (text, cls, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "op " + (cls || "");
      b.textContent = text;
      b.addEventListener("click", fn);
      return b;
    };
    ft.append(
      mk(opts.confirmText, "go", confirmPick),
      mk("全选", "", () => {
        opts.entries.forEach((e) => (e.checked = true));
        renderPick();
      }),
      mk("反选", "", () => {
        opts.entries.forEach((e) => (e.checked = !e.checked));
        renderPick();
      })
    );
    const sp = document.createElement("span");
    sp.className = "sp";
    sp.textContent = opts.skip ? "已跳过 " + opts.skip + " 个非空" : "Enter 确认 · Esc 关闭";
    ft.appendChild(sp);
  }

  function confirmPick() {
    const opts = pickEl._opts;
    if (!opts) return;
    if (!opts.entries.some((e) => e.checked)) return toast("没有勾选字段");
    const fn = opts.onConfirm;
    const picked = opts.entries;
    hidePick();
    if (fn) fn(picked);
  }

  function renderHist() {
    const list = loadHist();
    if (panel.style.display !== "block") return;
    panel.innerHTML =
      '<div class="scan"></div><div class="hd"><span class="mark"></span><span class="ttl">本页档案</span>' +
      '<span class="cnt">' + list.length + "<i>/" + MAX_HIST + "</i></span>" +
      '<button type="button" class="wipe" title="清空本页历史">清空</button>' +
      '<button type="button" class="x" title="关闭">✕</button></div><div class="bd"></div>';
    panel.querySelector(".x").onclick = () => {
      panel.style.display = "none";
      hud.classList.remove("dock");
    };
    const wipe = panel.querySelector(".wipe");
    wipe.disabled = !list.length;
    wipe.onclick = clearPageHist;
    const bd = panel.querySelector(".bd");
    if (!list.length) {
      bd.innerHTML = '<div class="empty"><div class="hex"></div><p>暂无记录</p><span>填完表点「保存」</span></div>';
      return;
    }
    list.forEach((item, idx) => {
      const row = document.createElement("div");
      row.className = "row";
      row.style.animationDelay = idx * 0.04 + "s";
      const noteInput = document.createElement("input");
      noteInput.value = item.note || "";
      noteInput.placeholder = "点这里改备注";
      noteInput.addEventListener("change", () => renameItem(item.id, noteInput.value.trim()));
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.innerHTML =
        "<span>" + timeStr(item.time) + "</span>" +
        '<span class="chip">' + (item.engine || "") + "</span>" +
        "<span>" + fieldCount(item) + " 字段</span>";
      const ops = document.createElement("div");
      ops.className = "ops";
      [
        ["回填", () => fillItem(item.id), ""],
        ["勾选", () => fillItem(item.id, true), ""],
        ["复制", () => copyItem(item.id), ""],
        ["删除", () => delItem(item.id), "del"],
      ].forEach(([text, fn, cls]) => {
        const b = document.createElement("button");
        b.className = "op " + cls;
        b.textContent = text;
        b.addEventListener("click", fn);
        ops.appendChild(b);
      });
      const preview = document.createElement("div");
      preview.className = "preview";
      preview.textContent = previewText(item);
      preview.title = previewText(item);
      row.append(noteInput, ops, meta, preview);
      bd.appendChild(row);
    });
  }

  function toggleHist() {
    const open = panel.style.display !== "block";
    panel.style.display = open ? "block" : "none";
    if (open) {
      setOpen(false);
      pickEl.style.display = "none";
      pickEl._opts = null;
      hud.classList.add("dock");
      renderHist();
      placePanel();
    } else {
      hud.classList.remove("dock");
    }
  }

  const hud = document.createElement("div");
  hud.id = "ff-hud";
  hud.innerHTML =
    '<div class="ring"></div><div class="beam"></div>' +
    '<button class="core" type="button" title="单击展开 / 拖动移动 / 双击复位">' +
    BOT +
    "</button>" +
    '<div class="menu">' +
    '<div class="m-edge"></div><div class="m-scan"></div>' +
    '<div class="m-hd"><span class="led"></span>CMD GRID<span class="m-ver">v' + VERSION + '</span><span class="m-tag">ON</span></div>' +
    '<div class="m-list">' +
    '<button type="button" data-a="save" title="Alt+S"><span class="idx">01</span><span class="lab">保存</span><span class="en">SAVE</span></button>' +
    '<button type="button" data-a="fill" title="Alt+F 直接回填 · Shift+点击勾选"><span class="idx">02</span><span class="lab">回填</span><span class="en">FILL</span></button>' +
    '<button type="button" data-a="mock" title="Alt+V"><span class="idx">03</span><span class="lab">虚拟</span><span class="en">MOCK</span></button>' +
    '<button type="button" data-a="hist"><span class="idx">04</span><span class="lab">历史</span><span class="en">LOG</span></button>' +
    '<button type="button" data-a="copy"><span class="idx">05</span><span class="lab">复制</span><span class="en">COPY</span></button>' +
    '<button type="button" data-a="imp"><span class="idx">06</span><span class="lab">导入</span><span class="en">IN</span></button>' +
    "</div>" +
    '<div class="hint">ALT+S/F/V · DRAG</div></div>';

  const core = hud.querySelector(".core");
  hud.querySelector(".menu").addEventListener("click", (e) => {
    const a = e.target.closest("[data-a]")?.getAttribute("data-a");
    if (a === "save") save();
    if (a === "fill") fillLatest(e.shiftKey);
    if (a === "mock") virtualFill();
    if (a === "hist") toggleHist();
    if (a === "copy") copyLatest();
    if (a === "imp") imp();
  });

  function lerpPath(a, b, t) {
    const na = a.match(/-?\d*\.?\d+/g);
    const nb = b.match(/-?\d*\.?\d+/g);
    if (!na || !nb || na.length !== nb.length) return t < 1 ? a : b;
    let i = 0;
    return a.replace(/-?\d*\.?\d+/g, () => {
      const x = +na[i];
      const y = +nb[i++];
      return String(f2(x + (y - x) * t));
    });
  }

  let morphRaf = 0;
  function morphGlyph(open, instant) {
    const outer = core.querySelector(".outer");
    const inner = core.querySelector(".inner");
    const ant = core.querySelector(".ant");
    if (!outer || !inner || !ant) return;
    const toO = open ? GLYPH.outerOn : GLYPH.outerOff;
    const toI = open ? GLYPH.innerOn : GLYPH.innerOff;
    const toA = open ? GLYPH.antOn : GLYPH.antOff;
    if (morphRaf) cancelAnimationFrame(morphRaf);
    if (instant) {
      outer.setAttribute("d", toO);
      inner.setAttribute("d", toI);
      ant.setAttribute("d", toA);
      return;
    }
    const fromO = outer.getAttribute("d") || GLYPH.outerOff;
    const fromI = inner.getAttribute("d") || GLYPH.innerOff;
    const fromA = ant.getAttribute("d") || GLYPH.antOff;
    const t0 = performance.now();
    const dur = 480;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      outer.setAttribute("d", lerpPath(fromO, toO, e));
      inner.setAttribute("d", lerpPath(fromI, toI, e));
      ant.setAttribute("d", lerpPath(fromA, toA, e));
      if (p < 1) morphRaf = requestAnimationFrame(tick);
      else morphRaf = 0;
    };
    morphRaf = requestAnimationFrame(tick);
  }

  function setOpen(v) {
    hud.classList.toggle("open", v);
    morphGlyph(v, false);
  }

  function clamp(left, top) {
    const w = 50, h = 50;
    return {
      left: Math.min(Math.max(8, window.innerWidth - w - 8), Math.max(8, left)),
      top: Math.min(Math.max(8, window.innerHeight - h - 8), Math.max(8, top)),
    };
  }

  function applyPos(left, top) {
    const p = clamp(left, top);
    hud.style.left = p.left + "px";
    hud.style.top = p.top + "px";
    hud.style.right = "auto";
    hud.style.bottom = "auto";
    placePanel();
  }

  function placeBox(el, maxW) {
    if (!el || el.style.display === "none") return;
    const r = (core && core.getBoundingClientRect()) || hud.getBoundingClientRect();
    const w = Math.min(maxW, Math.max(240, window.innerWidth - 88));
    const h = Math.min(el.offsetHeight || 280, window.innerHeight * 0.58);
    let left = Math.round(r.left - w - 14);
    if (left < 8) left = Math.round(r.right + 14);
    if (left + w > window.innerWidth - 8) left = Math.max(8, window.innerWidth - w - 8);
    if (left < 8) left = 8;
    let top = Math.round(r.bottom - h);
    if (top < 8) top = 8;
    if (top + h > window.innerHeight - 8) top = Math.max(8, window.innerHeight - h - 8);
    el.style.left = left + "px";
    el.style.top = top + "px";
    el.style.right = "auto";
    el.style.bottom = "auto";
  }

  function placePanel() {
    placeBox(panel, 560);
    placeBox(pickEl, 420);
  }

  function placePick() {
    placeBox(pickEl, 420);
    requestAnimationFrame(() => placeBox(pickEl, 420));
  }

  function resetPos() {
    storeDel(posKey);
    hud.style.left = hud.style.top = "";
    hud.style.right = hud.style.bottom = "18px";
    placePanel();
  }

  try {
    const saved = JSON.parse(storeGet(posKey) || "null");
    if (saved && typeof saved.left === "number") applyPos(saved.left, saved.top);
  } catch (_) {}

  let drag = null;
  let moved = false;
  core.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const rect = hud.getBoundingClientRect();
    drag = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    moved = false;
  });
  core.addEventListener("dblclick", (e) => {
    e.preventDefault();
    resetPos();
  });
  window.addEventListener("mousemove", (e) => {
    if (!drag) return;
    moved = true;
    applyPos(e.clientX - drag.dx, e.clientY - drag.dy);
  });
  window.addEventListener("mouseup", () => {
    if (!drag) return;
    if (!moved) setOpen(!hud.classList.contains("open"));
    else {
      const rect = hud.getBoundingClientRect();
      storeSet(posKey, JSON.stringify({ left: rect.left, top: rect.top }));
    }
    drag = null;
  });

  function fieldFromEvent(e) {
    const t = e.target;
    if (!(t instanceof Element)) return null;
    if (t.closest("#ff-hud, #ff-mem-hist, #ff-mem-pick, #ff-mem-ctx, #ff-mem-toast"))
      return null;
    const host = t.closest(
      "input, textarea, select, .el-form-item, .van-field, .el-input, .el-textarea, .el-select, .el-date-editor, .el-cascader, .van-cell"
    );
    if (!host) return null;
    const control = host.matches("input, textarea, select")
      ? host
      : host.querySelector("input, textarea, select");
    if (control && ["password", "file", "hidden", "submit", "button"].includes(control.type))
      return null;
    let name = control?.name || control?.id || "";
    let label = "";
    const item = host.closest(".el-form-item, .van-field");
    if (item) {
      label = (item.querySelector(".el-form-item__label, .van-field__label")?.textContent || "").trim();
      if (!name) {
        const c = item.querySelector("input, textarea, select");
        name = c?.name || c?.id || "";
      }
    }
    let inst = host.__vueParentComponent || control?.__vueParentComponent;
    while (inst) {
      const p = inst.props || {};
      if (p.name || p.prop) {
        name = p.name || p.prop || name;
        if (typeof p.label === "string" && p.label) label = label || p.label;
        break;
      }
      inst = inst.parent;
    }
    if (!name) return null;
    return { name, label: label || name, host };
  }

  async function mockOne(field) {
    const forms = currentForms();
    const f = forms.find((x) => x.el && field.host && x.el.contains(field.host)) || forms[0];
    if (!f) return toast("没有找到表单");
    const metas = f.kind === "native" ? metasNative() : metasInside(f.el);
    const meta = metas.find((m) => m.name === field.name) || {
      name: field.name,
      label: field.label,
      type: field.host?.type,
    };
    resetHainingCtx();
    const kind = inferKind(meta);
    if (!kind) return toast("这个字段没法虚拟");
    const v = mockValue(kind, meta);
    if (v === undefined) return toast("这个字段没法虚拟");
    const patches = forms.map((x) => (x === f ? { [field.name]: v } : {}));
    const stat = await applyMerge(patches);
    toastStats("虚拟「" + (field.label || field.name) + "」", stat);
  }

  async function fillOne(field) {
    const payload = latestPayload();
    if (!payload) return toast("这一页还没有历史");
    let found = null;
    (payload.forms || []).forEach((frm, i) => {
      if (frm.data && Object.prototype.hasOwnProperty.call(frm.data, field.name) && !isEmpty(frm.data[field.name]))
        found = { i, v: frm.data[field.name] };
    });
    if (!found) return toast("最新一条没有「" + (field.label || field.name) + "」");
    const patches = (payload.forms || []).map((frm, i) =>
      i === found.i ? { [field.name]: found.v } : {}
    );
    const stat = await applyMerge(patches);
    toastStats("回填「" + (field.label || field.name) + "」", { ok: stat.ok, fail: stat.fail, skip: 0 });
  }

  ctx.addEventListener("click", (e) => {
    const a = e.target.closest("[data-a]")?.getAttribute("data-a");
    const field = ctx._field;
    hideCtx();
    if (!field) return;
    if (a === "mock1") mockOne(field);
    if (a === "fill1") fillOne(field);
  });

  document.addEventListener(
    "contextmenu",
    (e) => {
      const field = fieldFromEvent(e);
      if (!field) return;
      e.preventDefault();
      ctx._field = field;
      ctx.style.display = "block";
      ctx.style.left = Math.min(e.clientX, window.innerWidth - 168) + "px";
      ctx.style.top = Math.min(e.clientY, window.innerHeight - 90) + "px";
    },
    true
  );
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#ff-mem-ctx")) hideCtx();
  });

  window.addEventListener("keydown", (e) => {
    if (pickEl.style.display !== "none") {
      if (e.key === "Escape") {
        e.preventDefault();
        hidePick();
        return;
      }
      if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
        e.preventDefault();
        confirmPick();
        return;
      }
    }
    if (e.key === "Escape") {
      hideCtx();
      if (panel.style.display === "block") {
        panel.style.display = "none";
        hud.classList.remove("dock");
      }
    }
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (k === "s" && !e.shiftKey) {
      e.preventDefault();
      save();
    } else if (k === "f") {
      e.preventDefault();
      fillLatest(e.shiftKey);
    } else if (k === "v" && !e.shiftKey) {
      e.preventDefault();
      virtualFill();
    }
  });

  document.documentElement.appendChild(hud);
  document.documentElement.appendChild(panel);
  document.documentElement.appendChild(pickEl);
  document.documentElement.appendChild(ctx);
}

(function boot() {
  if (typeof GM_getValue !== "function") {
    ffMemApp();
    return;
  }
  const init = {};
  try {
    const keys = typeof GM_listValues === "function" ? GM_listValues() : [];
    for (let i = 0; i < (keys || []).length; i++) {
      const k = keys[i];
      if (!k) continue;
      const v = GM_getValue(k, "");
      if (v != null && String(v) !== "") init[k] = String(v);
    }
  } catch (_) {}
  window.addEventListener("message", function (e) {
    if (e.source !== window || !e.data || e.data.ns !== "ff-mem-gm") return;
    try {
      if (e.data.op === "set" && e.data.key) GM_setValue(e.data.key, e.data.val);
      if (e.data.op === "del" && e.data.key) GM_deleteValue(e.data.key);
    } catch (__) {}
  });
  const code = "window.__FF_MEM_INIT__=" + JSON.stringify(init) + ";(" + ffMemApp.toString() + ")();";
  try {
    if (typeof GM_addElement === "function") {
      GM_addElement(document.documentElement, "script", { textContent: code });
      return;
    }
  } catch (_) {}
  const s = document.createElement("script");
  s.textContent = code;
  (document.documentElement || document.head).appendChild(s);
  s.remove();
})();