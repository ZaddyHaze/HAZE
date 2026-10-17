// Run: npm test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { inflateRawSync } = require("zlib");
const { loadEngine } = require("../cli/load-engine");
const {
  writeBambu3mf,
  solidWallLoops,
  isLatticePart,
  latticeObjectSettings,
  latticeProjectOverrides,
} = require("../cli/bambu-3mf");

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

test("solidWallLoops fills bar width at 0.4 mm line width", () => {
  assert.strictEqual(solidWallLoops(2.4), 3);
  assert.ok(solidWallLoops(2.4) * 2 * 0.4 >= 2.4);
});

test("isLatticePart: tiles/frame get brim ears; hardware does not", () => {
  assert.strictEqual(isLatticePart("tile_A1"), true);
  assert.strictEqual(isLatticePart("border_t1"), true);
  assert.strictEqual(isLatticePart("splice_plates"), true);
  assert.strictEqual(isLatticePart("wall_pucks_x4"), false);
  assert.strictEqual(isLatticePart("puck_shims_4_each_0.4-0.8-1.2mm"), false);
  assert.strictEqual(isLatticePart("frame_standoffs_x8"), false);
  assert.strictEqual(isLatticePart("bowtie_keys_x12"), false);
  assert.strictEqual(latticeObjectSettings({}, "tile_A1").brim_type, "brim_ears");
  assert.strictEqual(latticeObjectSettings({}, "tile_A1").wall_loops, "4");
  assert.strictEqual(latticeObjectSettings({}, "wall_pucks_x2").brim_type, "no_brim");
});

test("isomorphic builder attaches as Bambu3mf for the browser", () => {
  const vm = require("node:vm");
  const code = fs.readFileSync(path.join(__dirname, "../cli/bambu-3mf.js"), "utf8");
  const sandbox = {
    Math, JSON, Map, Object, String, Number, Array,
    crypto: { randomUUID: () => "11111111-1111-4111-8111-111111111111" },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  assert.ok(sandbox.Bambu3mf);
  assert.strictEqual(typeof sandbox.Bambu3mf.buildBambuPackage, "function");
});

test("3MF export embeds HANDOFF per-object Bambu settings", () => {
  const E = loadEngine({ W: 200, H: 200, cell: 40 });
  E.build();
  const P = E.model.P;
  const t = E.model.tiles[0];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kumiko-3mf-"));
  const out = path.join(dir, "panel.3mf");
  const tileName = `tile_${t.name}`;
  const settings = latticeObjectSettings(P, tileName);
  const proj = latticeProjectOverrides(P);
  delete proj._bed;

  writeBambu3mf(
    out,
    [
      { name: tileName, tris: E.tileTris(t), obj_settings: settings },
      { name: "wall_pucks_x1", tris: E.puckTris(1, P), obj_settings: latticeObjectSettings(P, "wall_pucks_x1") },
    ],
    proj,
    { bed: P.bx }
  );

  const files = unzipEntries(fs.readFileSync(out));
  for (const need of [
    "[Content_Types].xml",
    "_rels/.rels",
    "3D/3dmodel.model",
    "Metadata/project_settings.config",
    "Metadata/model_settings.config",
    "Metadata/slice_info.config",
  ]) assert.ok(files[need], need);

  const project = JSON.parse(files["Metadata/project_settings.config"]);
  assert.strictEqual(project.layer_height, "0.2");
  assert.strictEqual(project.wall_loops, "4");
  assert.strictEqual(project.brim_type, "brim_ears");
  assert.strictEqual(project.enable_support, "0");
  assert.strictEqual(project.xy_hole_compensation, "0");
  assert.strictEqual(project.xy_contour_compensation, "0");

  const ms = files["Metadata/model_settings.config"];
  assert.match(ms, /key="name" value="tile_/);
  assert.match(ms, /key="layer_height" value="0\.2"/);
  assert.match(ms, /key="wall_loops" value="4"/);
  assert.match(ms, /key="brim_type" value="brim_ears"/);
  assert.match(ms, /key="brim_type" value="no_brim"/);
  assert.match(ms, /<plate>/);
  assert.match(files["3D/3dmodel.model"], /BambuStudio/);

  fs.rmSync(dir, { recursive: true, force: true });
});
