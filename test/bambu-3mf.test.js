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
  latticeObjectSettings,
  latticeProjectOverrides,
} = require("../cli/bambu-3mf");

function unzipEntries(buf) {
  // Minimal ZIP reader for stored/deflated local entries (our writer only).
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
  assert.strictEqual(solidWallLoops(2.4), 3); // default grid bar
  assert.strictEqual(solidWallLoops(1.6), 2); // default infill bar
  assert.strictEqual(solidWallLoops(3.2), 4);
  assert.ok(solidWallLoops(2.4) * 2 * 0.4 >= 2.4);
});

test("3MF export embeds Bambu project + per-object settings", () => {
  const E = loadEngine({ W: 200, H: 200, cell: 40 });
  E.build();
  const P = E.model.P;
  const t = E.model.tiles[0];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kumiko-3mf-"));
  const out = path.join(dir, "panel.3mf");
  const settings = latticeObjectSettings(P);
  const proj = latticeProjectOverrides(P);
  delete proj._bed;

  writeBambu3mf(
    out,
    [{ name: `tile_${t.name}`, tris: E.tileTris(t), obj_settings: settings }],
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
  assert.strictEqual(project.brim_width, "5");
  assert.strictEqual(project.brim_type, "outer_only");
  assert.strictEqual(project.wall_loops, String(solidWallLoops(Math.max(P.gw, P.iw))));
  assert.strictEqual(project.curr_bed_type, "Textured PEI Plate");

  const ms = files["Metadata/model_settings.config"];
  assert.match(ms, /key="name" value="tile_/);
  assert.match(ms, /key="layer_height" value="0\.2"/);
  assert.match(ms, /key="brim_width" value="5"/);
  assert.match(ms, /key="wall_loops" value="\d+"/);
  assert.match(ms, /<plate>/);
  assert.match(files["3D/3dmodel.model"], /<vertex /);
  assert.match(files["3D/3dmodel.model"], /BambuStudio/);

  fs.rmSync(dir, { recursive: true, force: true });
});
