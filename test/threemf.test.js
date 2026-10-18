// Run: npm test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { inflateRawSync } = require("zlib");
const { loadEngine } = require("../cli/load-engine");
const {
  writePanel3mf,
  buildPanel3mf,
  isHardwarePart,
  panelObjectSettings,
  planPanelPlates,
} = require("../cli/threemf");

function unzipEntries(buf) {
  const files = {};
  let o = 0;
  while (o + 4 <= buf.length) {
    const sig = buf.readUInt32LE(o);
    if (sig !== 0x04034b50) break;
    const method = buf.readUInt16LE(o + 8);
    const compSize = buf.readUInt32LE(o + 18);
    const rawSize = buf.readUInt32LE(o + 22);
    const nameLen = buf.readUInt16LE(o + 26);
    const extraLen = buf.readUInt16LE(o + 28);
    const name = buf.slice(o + 30, o + 30 + nameLen).toString("utf8");
    const start = o + 30 + nameLen + extraLen;
    const payload = buf.slice(start, start + compSize);
    const data = method === 0 ? payload : inflateRawSync(payload);
    assert.strictEqual(data.length, rawSize, name);
    files[name] = data.toString("utf8");
    o = start + compSize;
  }
  return files;
}

test("isHardwarePart: tiles/frame get brim ears; hardware does not", () => {
  assert.strictEqual(isHardwarePart("tile_A1"), false);
  assert.strictEqual(isHardwarePart("border_t1"), false);
  assert.strictEqual(isHardwarePart("backer_A1"), false);
  assert.strictEqual(isHardwarePart("splice_plates"), false);
  assert.strictEqual(isHardwarePart("wall_pucks_x4"), true);
  assert.strictEqual(isHardwarePart("puck_shims_4_each_0.4-0.8-1.2mm"), true);
  assert.strictEqual(isHardwarePart("frame_standoffs_x8"), true);
  assert.strictEqual(isHardwarePart("bowtie_keys_x12"), true);
  assert.strictEqual(isHardwarePart("furniture_clips_x4"), true);
  assert.strictEqual(isHardwarePart("wall_cleats_x2"), true);
  assert.strictEqual(isHardwarePart("cleat_hooks_x2"), true);
  assert.strictEqual(panelObjectSettings("tile_A1").brim_type, "brim_ears");
  assert.strictEqual(panelObjectSettings("tile_A1").wall_loops, "4");
  assert.strictEqual(panelObjectSettings("tile_A1").layer_height, "0.2");
  assert.strictEqual(panelObjectSettings("wall_pucks_x2").brim_type, "no_brim");
  assert.strictEqual(panelObjectSettings("tile_A1").enable_support, "0");
  assert.strictEqual(panelObjectSettings("tile_A1").xy_hole_compensation, "0");
});

test("isomorphic builder attaches as ThreeMF for the browser", () => {
  const vm = require("node:vm");
  const code = fs.readFileSync(path.join(__dirname, "../cli/threemf.js"), "utf8");
  const sandbox = {
    Math, JSON, Map, Object, String, Number, Array, Date, TextEncoder,
    Uint8Array, DataView, Uint32Array,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  assert.ok(sandbox.ThreeMF);
  assert.strictEqual(typeof sandbox.ThreeMF.buildPanel3mf, "function");
  assert.strictEqual(typeof sandbox.ThreeMF.panelObjectSettings, "function");
});

test("panel 3MF embeds HANDOFF per-object settings and packs hardware", () => {
  const E = loadEngine({ W: 200, H: 200, cell: 40 });
  E.build();
  const P = E.model.P;
  const t = E.model.tiles[0];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kumiko-3mf-"));
  const out = path.join(dir, "panel.3mf");
  const parts = [
    { name: `tile_${t.name}`, tris: E.tileTris(t) },
    { name: "wall_pucks_x1", tris: E.puckTris(1, P) },
    { name: "frame_standoffs_x1", tris: E.standoffTris(P) },
  ].filter(p => p.tris && p.tris.length);

  const planned = planPanelPlates(parts, [P.bx, P.by]);
  assert.ok(planned.some(pl => /^tile_/.test(pl.name)), "tile gets its own plate");
  const hwPlates = planned.filter(pl => !/^tile_/.test(pl.name));
  assert.ok(hwPlates.length >= 1, "hardware is plated");
  assert.ok(hwPlates.some(pl => pl.objects.length >= 1));

  const r = writePanel3mf(out, parts, { bed: [P.bx, P.by], title: "test" });
  assert.ok(r.plates >= 1);
  assert.ok(r.objects >= 2);

  const files = unzipEntries(fs.readFileSync(out));
  for (const need of [
    "[Content_Types].xml",
    "_rels/.rels",
    "3D/3dmodel.model",
    "Metadata/model_settings.config",
  ]) assert.ok(files[need], need);

  const ms = files["Metadata/model_settings.config"];
  assert.match(ms, /key="name" value="tile_/);
  assert.match(ms, /key="layer_height" value="0\.2"/);
  assert.match(ms, /key="wall_loops" value="4"/);
  assert.match(ms, /key="brim_type" value="brim_ears"/);
  assert.match(ms, /key="brim_type" value="no_brim"/);
  assert.match(ms, /key="enable_support" value="0"/);
  assert.match(ms, /key="xy_hole_compensation" value="0"/);
  assert.match(ms, /key="xy_contour_compensation" value="0"/);
  assert.match(ms, /<plate>/);
  assert.match(files["3D/3dmodel.model"], /BambuStudio/);

  const browser = buildPanel3mf(parts, { bed: [P.bx, P.by] });
  assert.ok(browser.buffer.length > 1000);

  fs.rmSync(dir, { recursive: true, force: true });
});
