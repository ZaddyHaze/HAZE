#!/usr/bin/env node
// Cell accessories test print: magnet chips and cleat plugs at three fits, plus one bud vase holder.
// Uses the same cell as cli/cell-coupon.js, so they test in that coupon's base (left cell = "up", right = "down").
// Run: node cli/accessories.js [out/accessories] [--cell 40]
const fs = require("fs"), path = require("path");
const A = require("../src/accessories");
const { loadEngine } = require("./load-engine");
const args = process.argv.slice(2), out = args.find(a => !a.startsWith("--")) || "out/accessories";
const cell = +(args[args.indexOf("--cell") + 1] || 40) || 40, gw = 2.4;
const OBJECTS = {}; // name -> triangles (used by the 3MF test kit)

function prism(pts, z0, z1, tris) {
  if (A.area(pts) < 0) pts = pts.slice().reverse();
  const n = pts.length;
  for (let i = 1; i < n - 1; i++) { tris.push([[...pts[0], z0], [...pts[i + 1], z0], [...pts[i], z0]]); tris.push([[...pts[0], z1], [...pts[i], z1], [...pts[i + 1], z1]]); }
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; tris.push([[...p, z0], [...q, z0], [...q, z1]]); tris.push([[...p, z0], [...q, z1], [...p, z1]]); }
}
const place = (boxes, dx, dy) => boxes.map(b => ({ ...b, pts: b.pts.map(p => [p[0] + dx, p[1] + dy]) }));
const toTris = boxes => { const t = []; for (const b of boxes) prism(b.pts, b.z0, b.z, t); return t; };
// fit marks: 1-3 small dots on the back face (tight = 1, medium = 2, snug = 3)
const dots = (n, z) => Array.from({ length: n }, (_, i) => ({ pts: A.tri(0.9, "up").map(p => [p[0] + (i - (n - 1) / 2) * 2.6, p[1] - 3]), z0: z, z: z + 0.4, kind: "dot" }));

const FITS = [["tight", -0.10], ["medium", -0.05], ["snug", 0.0]];
const sp = cell + 4, parts = { magnet: [], cleat: [] };
FITS.forEach(([name, f], i) => {
  const tag = `${name.toUpperCase()} (${i + 1} dot${i ? "s" : ""})`;
  const m = A.magnetPlug(cell, gw, "up", f), mb = m.boxes.concat(dots(i + 1, 6));
  parts.magnet.push(...place(mb, i * sp, 0)); OBJECTS[`Magnet chip ${tag}`] = toTris(mb);
  const c = A.cleatPlug(cell, gw, "down", f), cb = c.boxes.concat(dots(i + 1, 6));
  parts.cleat.push(...place(cb, i * sp, 0)); OBJECTS[`Cleat plug ${tag}`] = toTris(cb);
});
const mag = A.magnetPlug(cell, gw, "up", 0);
const yg = A.cleatY(cell, gw, "down"), holder = A.vaseHolderPrint(yg);
OBJECTS["Bud vase holder"] = toTris(holder.boxes);
module.exports = { OBJECTS, pauseAt: mag.pauseAt };
if (require.main === module) {
fs.mkdirSync(out, { recursive: true });
const E = loadEngine({});
fs.writeFileSync(path.join(out, "magnet_chips_x3_fits.stl"), Buffer.from(E.stl(toTris(parts.magnet), "magnet chips")));
fs.writeFileSync(path.join(out, "cleat_plugs_x3_fits.stl"), Buffer.from(E.stl(toTris(parts.cleat), "cleat plugs")));
fs.writeFileSync(path.join(out, "bud_vase_holder.stl"), Buffer.from(E.stl(toTris(holder.boxes), "bud vase holder")));
const D = holder.dims;
fs.writeFileSync(path.join(out, "README.txt"), `CELL ACCESSORIES — test print (${cell} mm cells). Living Lattice, designed by Travis Hergenreder.

Test these in the cell coupon base (cell_base_x1.stl from cell-coupon.zip): left cell points up, right cell points down.
Dots on the back mark the fit: 1 = tight, 2 = medium, 3 = snug (same fits as the chip test).

PRINT (0.4 nozzle, 0.2 mm layers, no supports, no brim unless noted)
- magnet_chips_x3_fits.stl: face down (as exported). Needs a PAUSE so the magnets get sealed inside, no glue:
    Bambu Studio: Preview, drag the layer slider to the first layer above ${mag.pauseAt} mm, right-click, Add pause.
    When it pauses, press an 8 x 2 mm disc magnet into each round pocket, then resume.
    If the next pieces will hold a magnet too (not steel), mark the magnet's face before you drop it in so every
    chip has the same pole facing out.
- cleat_plugs_x3_fits.stl: face down (as exported).
- bud_vase_holder.stl: lying on its side (as exported), 4 walls. PETG if it will hold water near a window.

BUY
- 8 x 2 mm N52 neodymium disc magnets (one per magnet chip).
- 16 x 100 mm glass test tubes (one per vase). Any tube 16 mm or slightly under fits; rimmed or plain.

TEST
1. Magnet chip: press it into the LEFT (pointing-up) cell from the front. It should seat flush with the bars and stay
   when you shake the coupon. A fridge magnet or a steel washer should stick to its face. Pull it out with a
   stronger magnet: does it come out without damaging anything?
2. Cleat plug: press it into the RIGHT (pointing-down) cell, groove at the top, opening facing you.
3. Vase holder: hold it upright, tongue toward the plug, and drop the tongue into the groove (move it back and
   down at the same time, along the slope). Let go: it should hang by itself and sit flat against the lattice.
4. Put the tube in (through the collar, down into the cup) with water. Wiggle it: the holder must not lift off
   unless you lift it straight up first.
5. Tell me: which fit seated best for each part, and did the vase holder rock or hang flat?

Dimensions: holder ${(D.yTop - D.yBot).toFixed(0)} mm tall, sticks out ${(-D.zFront).toFixed(0)} mm from the panel face; tube top sits ${A.VASE.above} mm above the collar.
`);
console.log("written to", out, "| magnet pause at", mag.pauseAt, "mm | cleat yg", yg.toFixed(2));
}
