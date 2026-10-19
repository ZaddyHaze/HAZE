#!/usr/bin/env node
// Cell test coupon for the modular-cell system: a two-cell grid piece with a back ledge in each cell,
// plus backer chips and asanoha insert pieces at three fits. Prints in minutes; decides the fit before
// the full cell system is built.  Run: node cli/cell-coupon.js out/cell-coupon
const fs = require("fs"), path = require("path");
const { loadEngine } = require("./load-engine");
const out = process.argv[2] || "out/cell-coupon";
const OBJECTS = {}; // name -> triangles, one printable object each (used by the 3MF test kit)

// ---- geometry helpers (prisms -> triangles) ----
function prism(pts, z0, z1, tris) {
  let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  if (a < 0) pts = pts.slice().reverse();
  const n = pts.length;
  for (let i = 1; i < n - 1; i++) { tris.push([[...pts[0], z0], [...pts[i + 1], z0], [...pts[i], z0]]); tris.push([[...pts[0], z1], [...pts[i], z1], [...pts[i + 1], z1]]); }
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; tris.push([[...p, z0], [...q, z0], [...q, z1]]); tris.push([[...p, z0], [...q, z1], [...p, z1]]); }
}
const bar = (a, b, w) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / L * w / 2, ny = (b[0] - a[0]) / L * w / 2;
  return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]; };
// inset a triangle by d (perpendicular to every edge)
function insetTri(t, d) {
  const c = [(t[0][0] + t[1][0] + t[2][0]) / 3, (t[0][1] + t[1][1] + t[2][1]) / 3];
  const r = (t, k) => t; // equilateral: scale about the centroid
  const inr = Math.hypot(...[0, 1].map(i => (t[0][i] + t[1][i]) / 2 - c[i])); // inradius
  const f = (inr - d) / inr;
  return t.map(p => [c[0] + (p[0] - c[0]) * f, c[1] + (p[1] - c[1]) * f]);
}

// ---- dimensions (mm) ----
const s = 40, gw = 2.4, gh = 6, iw = 1.6, chipT = 0.8, h = s * Math.sqrt(3) / 2;
const zChip = 3.2;                        // chip front face; insert runs 0..zChip (front flush with the grid)
const ledge = [[4.0, 4.4, 0.5], [4.4, 4.8, 1.0], [4.8, gh, 1.5]]; // [z0, z1, width]: stepped so it prints without supports
const A = [0, 0], B = [s, 0], C = [s / 2, h], D = [s * 1.5, h];
const cells = [[A, B, C], [B, D, C]];
const edges = [[A, B], [B, C], [C, A], [B, D], [D, C]];

// ---- base: grid bars + ledges, printed face down (z = 0 is the front) ----
const base = [];
for (const [a, b] of edges) prism(bar(a, b, gw), 0, gh, base);
for (const t of cells) for (const [z0, z1, w] of ledge) {
  const o = insetTri(t, gw / 2 - 0.05), i = insetTri(t, gw / 2 + w);
  // ring between the outer and inner triangle, as 3 trapezoids
  for (let k = 0; k < 3; k++) prism([o[k], o[(k + 1) % 3], i[(k + 1) % 3], i[k]], z0, z1, base);
}
// a grip tab so the coupon is easy to hold
prism([[-6, -8], [s * 1.5 + 6, -8], [s * 1.5 + 6, -gw / 2 + 0.1], [-6, -gw / 2 + 0.1]], 0, gh, base);
OBJECTS["Cell base"] = base;

// ---- chips and inserts at three fits ----
const FITS = { tight: -0.10, medium: -0.05, snug: 0.0 }; // lateral interference (negative = oversize) at the cell walls
const DOTS = { tight: 1, medium: 2, snug: 3 };
for (const [name, f] of Object.entries(FITS)) {
  const parts = [], chips = [], inserts = [];
  cells.forEach((t0, k) => {
    const dx = k * (s + 6), t = t0.map(p => [p[0] - (k ? s / 2 : 0) + dx, p[1] - (k ? 0 : 0)]);
    const tt = k ? [[t[0][0], t[0][1] - h + h], t[1], t[2]] : t;
    // chip: fills the opening, edges bear on the first ledge step
    const chip = insetTri(t0, gw / 2 + f).map(p => [p[0] + k * (s + 6), p[1] + 50]);
    prism(chip, 0, chipT, parts); prism(chip, 0, chipT, chips);
    // fit mark: 1-3 dots on the chip's back, in the middle (clear of the ledge, which only touches the edges)
    const cc = [(chip[0][0] + chip[1][0] + chip[2][0]) / 3, (chip[0][1] + chip[1][1] + chip[2][1]) / 3];
    for (let d = 0; d < DOTS[name]; d++) { const x = cc[0] + (d - (DOTS[name] - 1) / 2) * 2.6, y = cc[1];
      const dot = [[x - 0.8, y - 0.8], [x + 0.8, y - 0.8], [x + 0.8, y + 0.8], [x - 0.8, y + 0.8]]; prism(dot, chipT, chipT + 0.4, parts); prism(dot, chipT, chipT + 0.4, chips); }
    // asanoha insert: three arms from the centroid into the corners of the opening; ends wedge into the corners
    const op = insetTri(t0, gw / 2), c = [(op[0][0] + op[1][0] + op[2][0]) / 3, (op[0][1] + op[1][1] + op[2][1]) / 3];
    const ox = k * (s + 6) + 100, oy = 0;
    for (const v of op) {
      const L = Math.hypot(v[0] - c[0], v[1] - c[1]), back = (iw / 2) / Math.tan(Math.PI / 6) + f / Math.tan(Math.PI / 6); // stop where the arm meets the corner walls
      const e = [c[0] + (v[0] - c[0]) * (L - back) / L, c[1] + (v[1] - c[1]) * (L - back) / L];
      prism(bar([c[0] + ox - (k ? s / 2 : 0), c[1] + oy], [e[0] + ox - (k ? s / 2 : 0), e[1] + oy], iw), 0, zChip, parts);
      prism(bar([c[0] + ox - (k ? s / 2 : 0), c[1] + oy], [e[0] + ox - (k ? s / 2 : 0), e[1] + oy], iw), 0, zChip, inserts);
    }
  });
  OBJECTS[`Chips ${name.toUpperCase()} (${DOTS[name]} dot${DOTS[name] > 1 ? "s" : ""})`] = chips;
  OBJECTS[`Inserts ${name.toUpperCase()}`] = inserts;
  OBJECTS[`_file cell_chips_and_inserts_${name}`] = parts;
}
module.exports = { OBJECTS };
if (require.main === module) {
const E = loadEngine({}); // for stl()
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "cell_base_x1.stl"), Buffer.from(E.stl(OBJECTS["Cell base"], "cell base")));
for (const name of Object.keys(FITS)) fs.writeFileSync(path.join(out, `cell_chips_and_inserts_${name}.stl`), Buffer.from(E.stl(OBJECTS[`_file cell_chips_and_inserts_${name}`], "cell parts " + name)));
fs.writeFileSync(path.join(out, "README.txt"), `CELL TEST COUPON — modular cells (backer chip + insert piece per cell)

Print: same filament as the panel, 0.2 mm layers, no supports, no brim. Print the base face down (as exported).
Print chips and inserts in a second color if you have one, so you can see them.

Files
- cell_base_x1.stl: two triangle cells (40 mm) with a stepped ledge at the back of each cell.
- cell_chips_and_inserts_tight / medium / snug.stl: two backer chips + two asanoha insert pieces at each fit.

Test, one fit at a time
1. Base face up (front toward you). Drop a chip into each cell: it should sit flat on the ledge.
2. Press an insert piece in front of the chip, arms into the three corners. It should click into place and hold the chip.
3. Shake it, flick it, hold it upside down: nothing should fall out.
4. Remove the insert with a fingernail or a toothpick at the center. It should come out without breaking.
5. Without an insert, does the chip stay put on its own? (Needed for "open" cells.)
Dots on the back of each chip mark its fit: 1 = tight, 2 = medium, 3 = snug.

Tell me which fit (tight / medium / snug) did all five, and whether the chip alone held.
`);
console.log("written to", out);
}
