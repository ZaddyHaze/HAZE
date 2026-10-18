// Every design prints without supports, and no wall hardware shows through the lattice from the front.
const test = require("node:test");
const assert = require("node:assert");
const { loadEngine } = require("../cli/load-engine");
const { printParts, overhangs, visibility } = require("./printability");

const PATTERNS = ["asanoha", "kikko", "mitsukude", "sankaku", "kaku", "hishi"];
const CONFIGS = [
  { name: "zigzag + wall pegs", set: { seam: "zig", mount: "pegs", flt: 0 } },
  { name: "zigzag + floating frame + LED cove", set: { seam: "zig", mount: "pegs", flt: 20, b: 19, cove: true } },
  { name: "lap + wall pegs", set: { seam: "lap", mount: "pegs", flt: 0 } },
  { name: "lap + frame only", set: { seam: "lap", mount: "frame", flt: 0 } },
  { name: "zigzag, no mount", set: { seam: "zig", mount: "none", flt: 0 } },
  { name: "cube shelf insert (furniture clips)", set: { seam: "lap", mount: "fit", W: 331, H: 331, op: 335, bk: false, flt: 0 } },
  { name: "zigzag, rotated, no snap", set: { seam: "zig", mount: "pegs", flt: 0, rot: true, snap: false } },
];
for (const cfg of CONFIGS) for (const pat of PATTERNS) {
  test(`${cfg.name} / ${pat}: no supports needed, no hardware visible`, () => {
    const E = loadEngine({ ...cfg.set, pat }); E.build();
    for (const part of printParts(E)) {
      const f = overhangs(part, { samples: 4 });
      assert.strictEqual(f.length, 0, `${part.name} has an unsupported overhang at ${JSON.stringify(f[0])}`);
    }
    const v = visibility(E, { samples: 150 });
    for (const [kind, list] of Object.entries(v)) list.forEach((x, i) => assert.ok(x <= 0.02, `${kind} #${i + 1} shows ${(x * 100).toFixed(0)}% through the lattice`));
  });
}
