#!/usr/bin/env node
// One Bambu Studio project with every current test print, ready to slice: separate named objects,
// one plate per job, the magnet pause already set.  Run: node cli/test-kit-3mf.js [out/living-lattice-test-kit.3mf]
const path = require("path"), fs = require("fs");
const { write3mf } = require("./threemf");
const coupon = require("./cell-coupon").OBJECTS, acc = require("./accessories");
const file = process.argv[2] || "out/living-lattice-test-kit.3mf";
fs.mkdirSync(path.dirname(file), { recursive: true });
const small = { brim_type: "no_brim" };
const pick = (src, names, settings) => names.map(n => ({ name: n, tris: src[n], settings }));
const plates = [
  { name: "1 Cell fit test: base, chips, inserts", objects: [
    { name: "Cell base (face down)", tris: coupon["Cell base"], settings: small },
    ...pick(coupon, ["Chips TIGHT (1 dot)", "Chips MEDIUM (2 dots)", "Chips SNUG (3 dots)", "Inserts TIGHT", "Inserts MEDIUM", "Inserts SNUG"], small)] },
  { name: `2 Magnet chips: PAUSES at ${(acc.pauseAt + 0.2).toFixed(1)} mm for magnets`, pauseAt: acc.pauseAt, objects:
    pick(acc.OBJECTS, ["Magnet chip TIGHT (1 dot)", "Magnet chip MEDIUM (2 dots)", "Magnet chip SNUG (3 dots)"], small) },
  { name: "3 Cleat plugs + bud vase holder", objects: [
    ...pick(acc.OBJECTS, ["Cleat plug TIGHT (1 dot)", "Cleat plug MEDIUM (2 dots)", "Cleat plug SNUG (3 dots)"], small),
    { name: "Bud vase holder (on its side)", tris: acc.OBJECTS["Bud vase holder"], settings: { brim_type: "no_brim", wall_loops: "4" } }] },
];
for (const p of plates) for (const o of p.objects) if (!o.tris || !o.tris.length) throw new Error("missing object " + o.name);
// Bambu Studio loads 3MFs from other programs as "geometry only": it keeps the objects and their positions but
// drops plates and settings. So also write one file per plate, each sitting on the bed, ready to slice.
const r = write3mf(file, { plates, title: "Living Lattice test kit" });
console.log(`wrote ${file}: ${r.plates} plates, ${r.objects} objects`);
const slug = ["1-cell-fit", "2-magnet-chips-PAUSE-3mm", "3-cleat-plugs-vase"];
plates.forEach((pl, i) => {
  const f = file.replace(/\.3mf$/, `-${slug[i]}.3mf`);
  write3mf(f, { plates: [pl], title: "Living Lattice test kit, plate " + (i + 1) });
  console.log("wrote " + f);
});
