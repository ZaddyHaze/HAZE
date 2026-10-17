// Loads src/engine.js (a browser script) into a Node vm with a tiny fake DOM, so the exact same
// geometry code runs headless. Control defaults are read from index.html, so the CLI and the page agree.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");

function readDefaults() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const vals = {};
  for (const m of html.matchAll(/<input\b[^>]*>/g)) {
    const tag = m[0];
    const id = (tag.match(/\bid="([^"]+)"/) || [])[1];
    if (!id) continue;
    if (/type="checkbox"/.test(tag)) vals[id] = /\bchecked\b/.test(tag);
    else vals[id] = (tag.match(/\bvalue="([^"]*)"/) || [])[1] ?? "";
  }
  for (const m of html.matchAll(/<select\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
    const opts = [...m[2].matchAll(/<option\b([^>]*)value="([^"]*)"([^>]*)>([^<]*)/g)];
    const sel = opts.find(o => /\bselected\b/.test(o[1] + o[3])) || opts[0];
    if (sel) vals[m[1]] = { value: sel[2], text: sel[4].trim(), options: opts.map(o => ({ value: o[2], text: o[4].trim() })) };
  }
  return vals;
}

function loadEngine(overrides = {}) {
  const defaults = readDefaults();
  const vals = {};
  for (const [k, v] of Object.entries(defaults)) vals[k] = v && v.options ? v.value : v;
  Object.assign(vals, overrides);

  const ctx2d = new Proxy({}, { get: (t, k) => (k === "measureText" ? () => ({ width: 10 }) : typeof k === "string" ? () => {} : undefined), set: () => true });
  const els = {};
  const el = id => ({
    get value() { return String(vals[id] ?? ""); },
    set value(v) { vals[id] = v; },
    get checked() { return !!vals[id]; },
    get selectedOptions() {
      const d = defaults[id];
      const o = d && d.options && d.options.find(o => o.value === String(vals[id]));
      return [{ text: o ? o.text : String(vals[id] ?? "") }];
    },
    addEventListener() {}, parentElement: { clientWidth: 900 }, style: {}, getContext: () => ctx2d,
    set innerHTML(v) {}, set textContent(v) {}, disabled: false, dataset: {},
  });
  const sandbox = {
    console, Math, Date, JSON, Map, Set, Proxy, ArrayBuffer, DataView, Uint8Array, Float32Array, setTimeout, clearTimeout,
    document: { getElementById: id => els[id] || (els[id] = el(id)), documentElement: {}, body: { appendChild() {} }, createElement: () => ({ click() {}, remove() {} }) },
    getComputedStyle: () => ({ getPropertyValue: () => "#000" }),
    window: { addEventListener() {}, devicePixelRatio: 1 },
    matchMedia: () => ({ addEventListener() {} }),
    MutationObserver: class { observe() {} },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "src", "engine.js"), "utf8"), sandbox, { filename: "engine.js" });
  // top-level let/const/function in engine.js live in the context's script scope; expose them
  const api = vm.runInContext(`({
    get model(){return model}, build, readParams, testKit, readme, layoutSVG, stl,
    tileTris, borderTris, plateTris, keyTris, puckTris, cleatTris, standoffTris, pegTemplateSVG, wallTemplateSVG,
    allFeet, WALL, SNAP, COVE, cleatDims, shimTris, shimCount
  })`, sandbox);
  api.vals = vals;
  api.rebuild = (more = {}) => { Object.assign(vals, more); api.build(); return api.model; };
  return api;
}

module.exports = { loadEngine, readDefaults, ROOT };
