#!/usr/bin/env node
// Headless export: writes the same files the page's "Download all" button zips,
// plus a Bambu Studio .3mf with per-object print settings (HANDOFF.md):
//   0.2 mm layers, 4 walls, mouse-ear brim on tiles/frame, no brim on hardware.
//   node cli/generate.js                         -> out/ with defaults from index.html
//   node cli/generate.js --set W=900 --set H=600 --set flt=20 --set b=19
//   node cli/generate.js --params my-panel.json --out builds/living-room
//   node cli/generate.js --test-kit              -> test coupons only
//   node cli/generate.js --no-3mf                -> skip the .3mf project
const fs = require("fs");
const path = require("path");
const { loadEngine } = require("./load-engine");
const {
  writeBambu3mf,
  latticeObjectSettings,
  latticeProjectOverrides,
} = require("./bambu-3mf");
const { writeLetterPages } = require("./letter-pages");

const args = process.argv.slice(2);
const overrides = {};
let out = "out", testOnly = false, want3mf = true;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--set") { const [k, ...v] = args[++i].split("="); overrides[k] = coerce(v.join("=")); }
  else if (a === "--params") Object.assign(overrides, JSON.parse(fs.readFileSync(args[++i], "utf8")));
  else if (a === "--out") out = args[++i];
  else if (a === "--test-kit") testOnly = true;
  else if (a === "--no-3mf") want3mf = false;
  else if (a === "-h" || a === "--help") { console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(1, 9).join("\n")); process.exit(0); }
  else { console.error("Unknown argument: " + a); process.exit(1); }
}
function coerce(v) { return v === "true" ? true : v === "false" ? false : v; }

const E = loadEngine(overrides);
E.build();
const m = E.model, P = m.P;
fs.mkdirSync(out, { recursive: true });
const write = (name, data) => {
  fs.writeFileSync(path.join(out, name), typeof data === "string" ? data : Buffer.from(data));
  console.log("  " + name);
};

console.log(`Panel ${P.W} x ${P.H} mm, ${m.tiles.length} tiles, ${m.borders.length} frame pieces -> ${out}/`);
if (testOnly) {
  for (const [n, d] of Object.entries(E.testKit(P))) write(n, d);
  process.exit(0);
}

const parts3mf = [];
function addPart(name, tris) {
  write(`${name}.stl`, E.stl(tris, name));
  if (want3mf) parts3mf.push({ name, tris, obj_settings: latticeObjectSettings(P, name) });
}

for (const t of m.tiles) addPart(`tile_${t.name}`, E.tileTris(t));
if (m.plates.length) addPart("splice_plates", E.plateTris(m.plates, P));
for (const bp of m.borders) addPart(bp.name.replace(" ", "_").toLowerCase(), E.borderTris(bp));
if (m.keys.length) addPart(`bowtie_keys_x${m.keys.length}`, E.keyTris(m.keys.length, P, m.K));
if (P.fm) {
  if (P.wall && m.sockets.length) {
    addPart(`wall_pucks_x${m.sockets.length}`, E.puckTris(m.sockets.length, P));
    addPart(`puck_shims_${E.shimCount(m.sockets.length)}_each_0.4-0.8-1.2mm`, E.shimTris(P, m.sockets.length));
  }
  {
    const svg = E.pegTemplateSVG();
    write("wall_template.svg", svg);
    const pages = writeLetterPages(out, svg, { W: P.W, H: P.H });
    if (pages.pdf) console.log(`  ${path.basename(pages.pdf)}  (${pages.pages} letter pages)`);
    else console.log(`  ${path.basename(pages.html)}  (${pages.pages} letter pages; open in browser → Print → PDF)`);
  }
  const nf = E.allFeet().filter(f => f.boxes).length;
  if (nf) addPart(`frame_standoffs_x${nf}`, E.standoffTris(P));
}
write("layout.svg", E.layoutSVG());
write("README.txt", E.readme());
write("params.json", JSON.stringify(E.vals, null, 2));

if (want3mf && parts3mf.length) {
  const proj = latticeProjectOverrides(P);
  const bed = proj._bed; delete proj._bed;
  const name = `living_lattice_${P.W}x${P.H}.3mf`;
  writeBambu3mf(path.join(out, name), parts3mf, proj, { bed });
  console.log(`  ${name}  (${parts3mf.length} objects, 0.2 mm / 4 walls / mouse-ear brim on tiles+frame)`);
}
