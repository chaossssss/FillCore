// ==UserScript==
// @name         FastForm 填写记忆（Element Plus / Vant）
// @match        http://192.168.120.228/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const MAX_HIST = 30;
  const pageKey = () =>
    "ff_mem_" + location.origin + location.pathname + location.hash.split("?")[0];
  const histKey = () => pageKey() + "_hist";
  const posKey = "ff_mem_bar_pos";
  const openKey = "ff_mem_bar_open";

  const BOT = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M16 4.2 L27 10.6 V21.4 L16 27.8 L5 21.4 V10.6 Z"
      stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
    <rect class="visor" x="9.2" y="13.4" width="13.6" height="5.2" rx="1.1"
      stroke="currentColor" stroke-width="1.35"/>
    <path d="M5.2 15.2H2.6M26.8 15.2h2.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;

  const css = document.createElement("style");
  css.textContent = `
    #ff-hud, #ff-hud *, #ff-mem-hist, #ff-mem-hist * { box-sizing: border-box; }
    #ff-hud {
      position: fixed; z-index: 2147483647;
      font-family: "Microsoft YaHei", Consolas, sans-serif;
      color: #c8f7ff;
      right: 18px; bottom: 18px;
    }
    #ff-hud .core {
      width: 46px; height: 46px; border: 0; cursor: grab; padding: 0;
      background: radial-gradient(circle at 30% 25%, #1c3a55, #061018 70%);
      clip-path: polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%);
      box-shadow: 0 0 0 1px #4de8ff, 0 0 18px #00d4ff66, inset 0 0 12px #00e5ff33;
      color: #7af6ff;
      display: grid; place-items: center; user-select: none;
      animation: ffpulse 2.4s ease-in-out infinite;
    }
    #ff-hud .core svg { width: 26px; height: 26px; display: block; }
    #ff-hud .core .visor { fill: #00e5ff24; }
    #ff-hud.open .core .visor { animation: visor 1.5s ease-in-out infinite; }
    @keyframes visor {
      0%, 100% { fill: #00e5ff22; }
      50% { fill: #7af6ff77; }
    }
    #ff-hud.open .core { animation: ffpulse 1.2s ease-in-out infinite; }
    #ff-hud .core:hover { box-shadow: 0 0 0 1px #9ffffe, 0 0 28px #00e5ffaa; }
    @keyframes ffpulse {
      0%, 100% { filter: brightness(1); }
      50% { filter: brightness(1.22); }
    }
    #ff-hud .ring {
      position: absolute; inset: -6px; pointer-events: none;
      clip-path: polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%);
      border: 1px dashed #2ee6ff55;
      animation: ffspin 9s linear infinite;
    }
    #ff-hud.open .ring { animation-duration: 3.5s; border-color: #7af6ffaa; }
    @keyframes ffspin { to { transform: rotate(360deg); } }
    #ff-hud .beam {
      position: absolute; right: 22px; bottom: 44px; width: 2px; height: 0;
      background: linear-gradient(#7af6ff, transparent);
      box-shadow: 0 0 8px #00e5ff; pointer-events: none; opacity: 0;
      transition: height .32s ease, opacity .28s;
    }
    #ff-hud.open .beam { height: 16px; opacity: 1; }
    #ff-hud .menu {
      position: absolute; right: -10px; bottom: 60px; width: 176px;
      padding: 0; overflow: hidden;
      background:
        linear-gradient(180deg, rgba(0,229,255,.12), transparent 26%),
        repeating-linear-gradient(0deg, transparent 0 10px, rgba(46,230,255,.045) 11px),
        #061018f6;
      border: 1px solid #2ee6ff88;
      box-shadow: 0 0 32px #00d4ff55, 0 0 0 1px #083040 inset, inset 0 0 28px #00e5ff14;
      clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
      transform-origin: 88% 100%;
      opacity: 0; visibility: hidden; pointer-events: none;
      transform: translateY(16px) scale(.84);
      transition: opacity .3s ease, transform .38s cubic-bezier(.2,.9,.2,1), visibility .3s;
    }
    #ff-hud.open .menu {
      opacity: 1; visibility: visible; pointer-events: auto;
      transform: translateY(0) scale(1);
      animation: ffholo 5.5s ease-in-out infinite;
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
    #ff-hud.open .menu button:nth-child(1) { animation-delay: .05s; }
    #ff-hud.open .menu button:nth-child(2) { animation-delay: .10s; }
    #ff-hud.open .menu button:nth-child(3) { animation-delay: .15s; }
    #ff-hud.open .menu button:nth-child(4) { animation-delay: .20s; }
    #ff-hud.open .menu button:nth-child(5) { animation-delay: .25s; }
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
    #ff-hud.open .hint { animation: ffin .3s ease .32s forwards; }
    #ff-mem-toast {
      position: fixed; left: 50%; bottom: 80px; transform: translateX(-50%) translateY(8px);
      z-index: 2147483647; padding: 8px 14px; font: 12px "Microsoft YaHei", sans-serif;
      color: #9ef6ff; background: #061018ee; border: 1px solid #2ee6ff88;
      box-shadow: 0 0 16px #00e5ff44; opacity: 0; pointer-events: none;
      transition: .25s ease;
    }
    #ff-mem-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

    #ff-mem-hist {
      display: none; position: fixed; z-index: 2147483646;
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
  `;
  document.documentElement.appendChild(css);

  function toast(msg) {
    let el = document.getElementById("ff-mem-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "ff-mem-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 1800);
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

  function findFastForms() {
    const list = [];
    for (const inst of allVueInstances()) {
      const api = formApi(inst);
      if (!api) continue;
      list.push({ kind: "fastform", api, el: rootEl(inst) });
    }
    return list.filter(
      (a) =>
        !list.some(
          (b) => b !== a && b.el && a.el && b.el !== a.el && b.el.contains(a.el)
        )
    );
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
            get: () => exp.getValues(),
            set: (data) => {
              if (typeof exp.setValues === "function") return exp.setValues(data);
              Object.assign(props.model || {}, data);
            },
          });
        }
      }
    }
    return list.filter(
      (a) =>
        !list.some(
          (b) => b !== a && b.el && a.el && b.el !== a.el && b.el.contains(a.el)
        )
    );
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

  function nativeFill(data) {
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
        const v = data[el.name || "cb_" + i];
        if (typeof v === "boolean") {
          el.checked = v;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
        return;
      }
      if (el.type === "radio" && data[el.name] === el.value) {
        el.checked = true;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }
      const k = el.name || el.id || "idx_" + i;
      if (data[k] != null) apply(data[k]);
    });
  }

  async function snapshot() {
    const ff = findFastForms();
    if (ff.length) {
      return {
        engine: "fastform",
        forms: ff.map((f, i) => ({ i, kind: "fastform", data: f.api.getValues() || {} })),
      };
    }
    const ui = findUiForms();
    if (ui.length) {
      return {
        engine: ui[0].kind,
        forms: ui.map((f, i) => ({ i, kind: f.kind, data: f.get() || {} })),
      };
    }
    return { engine: "native", forms: [{ i: 0, kind: "native", data: nativeCollect() }] };
  }

  async function apply(payload) {
    const forms = payload.forms || [{ data: payload }];
    const ff = findFastForms();
    if (ff.length) {
      for (let n = 0; n < 2; n++) {
        ff.forEach((f, i) => f.api.setValues(forms[i]?.data || forms[0]?.data || {}));
        if (n === 0) await new Promise((r) => setTimeout(r, 350));
      }
      return "fastform×" + ff.length;
    }
    const ui = findUiForms();
    if (ui.length) {
      ui.forEach((f, i) => f.set(forms[i]?.data || forms[0]?.data || {}));
      return ui[0].kind + "×" + ui.length;
    }
    nativeFill(forms[0]?.data || {});
    return "native";
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
    try {
      const arr = JSON.parse(localStorage.getItem(histKey()) || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveHist(list) {
    localStorage.setItem(histKey(), JSON.stringify(list.slice(0, MAX_HIST)));
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
    localStorage.setItem(pageKey(), JSON.stringify(payload));
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

  function fillLatest() {
    const list = loadHist();
    const payload = list[0]
      ? { engine: list[0].engine, forms: list[0].forms }
      : JSON.parse(localStorage.getItem(pageKey()) || "null");
    if (!payload) return toast("这一页还没有历史");
    apply(payload).then((engine) => toast("已回填最新一条（" + engine + "）"));
  }

  function fillItem(id) {
    const item = loadHist().find((x) => x.id === id);
    if (!item) return toast("这条已经不在了");
    apply({ engine: item.engine, forms: item.forms }).then((engine) =>
      toast("已回填「" + (item.note || timeStr(item.time)) + "」（" + engine + "）")
    );
  }

  function delItem(id) {
    saveHist(loadHist().filter((x) => x.id !== id));
    renderHist();
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
      (engine) => {
        toast("已导入并回填（" + engine + "）");
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

  function renderHist() {
    const list = loadHist();
    if (panel.style.display !== "block") return;
    panel.innerHTML =
      '<div class="scan"></div><div class="hd"><span class="mark"></span><span class="ttl">本页档案</span>' +
      '<span class="cnt">' + list.length + "<i>/" + MAX_HIST + "</i></span>" +
      '<button type="button" class="x" title="关闭">✕</button></div><div class="bd"></div>';
    panel.querySelector(".x").onclick = () => { panel.style.display = "none"; };
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
      placePanel();
      renderHist();
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
    '<div class="m-hd"><span class="led"></span>CMD GRID<span class="m-tag">ON</span></div>' +
    '<div class="m-list">' +
    '<button type="button" data-a="save"><span class="idx">01</span><span class="lab">保存</span><span class="en">SAVE</span></button>' +
    '<button type="button" data-a="fill"><span class="idx">02</span><span class="lab">回填</span><span class="en">FILL</span></button>' +
    '<button type="button" data-a="hist"><span class="idx">03</span><span class="lab">历史</span><span class="en">LOG</span></button>' +
    '<button type="button" data-a="copy"><span class="idx">04</span><span class="lab">复制</span><span class="en">COPY</span></button>' +
    '<button type="button" data-a="imp"><span class="idx">05</span><span class="lab">导入</span><span class="en">IN</span></button>' +
    "</div>" +
    '<div class="hint">DRAG · DBL RESET</div></div>';

  const core = hud.querySelector(".core");
  hud.querySelector(".menu").addEventListener("click", (e) => {
    const a = e.target.closest("[data-a]")?.getAttribute("data-a");
    if (a === "save") save();
    if (a === "fill") fillLatest();
    if (a === "hist") toggleHist();
    if (a === "copy") copyLatest();
    if (a === "imp") imp();
  });

  function setOpen(v) {
    hud.classList.toggle("open", v);
    localStorage.setItem(openKey, v ? "1" : "0");
  }
  if (localStorage.getItem(openKey) === "1") hud.classList.add("open");

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

  function placePanel() {
    const r = hud.getBoundingClientRect();
    const w = Math.min(560, window.innerWidth * 0.94);
    let left = r.right - w;
    if (left < 8) left = 8;
    let top = r.top - 12;
    if (top < 8) top = r.bottom + 8;
    if (top + 160 > window.innerHeight) top = 8;
    panel.style.left = left + "px";
    panel.style.top = top + "px";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  }

  function resetPos() {
    localStorage.removeItem(posKey);
    hud.style.left = hud.style.top = "";
    hud.style.right = hud.style.bottom = "18px";
    placePanel();
  }

  try {
    const saved = JSON.parse(localStorage.getItem(posKey) || "null");
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
      localStorage.setItem(posKey, JSON.stringify({ left: rect.left, top: rect.top }));
    }
    drag = null;
  });

  document.documentElement.appendChild(hud);
  document.documentElement.appendChild(panel);
})();