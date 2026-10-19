// Cell accessories: magnet chip, cleat plug, bud vase holder (src/accessories.js)
const test = require("node:test"), assert = require("node:assert");
const A = require("../src/accessories");
const { overhangs } = require("./printability");
const { inPoly, countOverlaps } = require("./helpers");

const gw = 2.4, gh = 6, rnd = (() => { let a = 7; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
const solid = (p, z, boxes) => boxes.some(b => z > b.z0 && z < b.z && inPoly(p, b.pts));
// the cell around a plug: three grid bars + the stepped ledge (cell-local, same as cli/cell-coupon.js)
function cellWalls(s, dir) {
  const R = A.R0(s), out = [], ring = (rOut, rIn, z0, z1) => { const o = A.tri(rOut, dir), i = A.tri(rIn, dir);
    for (let k = 0; k < 3; k++) out.push({ pts: [o[k], o[(k + 1) % 3], i[(k + 1) % 3], i[k]], z0, z: z1 }); };
  ring(R + gw, R - gw / 2, 0, gh);                                  // bars (inner face only matters)
  for (const [z0, z1, w] of A.LEDGE) ring(R - gw / 2 + 0.01, R - gw / 2 - w, z0, z1);
  return out;
}

for (const s of [30, 40, 60]) for (const dir of ["up", "down"]) {
  test(`magnet chip ${s} mm ${dir}: prints without supports, magnet sealed, fits the cell`, () => {
    const m = A.magnetPlug(s, gw, dir, 0);
    assert.deepStrictEqual(overhangs({ boxes: m.boxes }, { samples: 30 }), []);
    // pocket: empty inside, closed above and below
    for (let k = 0; k < 200; k++) { const a = rnd() * 2 * Math.PI, r = rnd() * A.MAG.d / 2;
      const p = [r * Math.cos(a), r * Math.sin(a)];
      assert.ok(!solid(p, A.MAG.skin + 1, m.boxes), "pocket must be empty");
      assert.ok(solid(p, A.MAG.skin / 2, m.boxes), "front skin closes the pocket");
      assert.ok(solid(p, m.pauseAt + 0.3, m.boxes), "cap closes the pocket"); }
    assert.strictEqual(countOverlaps([{ id: "plug", boxes: m.boxes.map(b => ({ ...b, pts: shrink(b.pts, 0.02) })) }, { id: "cell", boxes: cellWalls(s, dir) }], s, s, 4000, () => rnd() * 2 - 1), 0);
  });
  test(`cleat plug ${s} mm ${dir}: prints, and the vase tongue drops in, hangs, and can't pull straight out`, () => {
    const c = A.cleatPlug(s, gw, dir, 0);
    if (s < 40) { assert.strictEqual(c, null, "30 mm cells are too small for the cleat"); return; }
    assert.ok(c, "groove must fit the cell");
    assert.deepStrictEqual(overhangs({ boxes: c.boxes }, { samples: 20 }), []);
    const t = A.vaseTongue(c.yg), sh = (dy, dz) => t.map(b => ({ ...b, pts: b.pts.map(p => [p[0], p[1] + dy]), z0: b.z0 + dz, z: b.z + dz }));
    const hit = boxes => { for (let k = 0; k < 6000; k++) { const p = [(rnd() - 0.5) * 23, c.yg - 4 + rnd() * 8], z = rnd() * 3;
      if (solid(p, z, boxes) && solid(p, z, c.boxes)) return true; } return false; };
    assert.ok(!hit(t), "tongue seated without touching the plug");
    assert.ok(hit(sh(0, -0.6)), "pulling straight forward is blocked");
    assert.ok(!hit(sh(0.5, -0.5)), "lifting along the slope releases it");
  });
}
function shrink(pts, d) { const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
  return pts.map(p => { const v = [p[0] - c[0], p[1] - c[1]], L = Math.hypot(...v); return [p[0] - v[0] / L * d, p[1] - v[1] / L * d]; }); }

test("bud vase holder prints on its side without supports and takes a 16 mm tube", () => {
  const h = A.vaseHolderPrint(A.cleatY(40, gw, "down")), D = h.dims;
  assert.deepStrictEqual(overhangs({ boxes: h.boxes }, { samples: 12 }), []);
  // tube cross-section (radius 8) through the collar and cup is free of material
  for (let k = 0; k < 3000; k++) {
    const a = rnd() * 2 * Math.PI, r = rnd() * (A.VASE.tubeD / 2), x = r * Math.cos(a), zz = D.zc + r * Math.sin(a);
    const u = D.yFloor + 0.05 + rnd() * (D.yTop - D.yFloor - 0.1);
    assert.ok(!solid([u - D.yBot, -zz], x + D.half, h.boxes), `tube point blocked at x=${x.toFixed(2)} u=${u.toFixed(1)}`);
  }
  // the cup has a floor under the tube
  assert.ok(solid([D.yBot - D.yBot + 1, -D.zc], D.half, h.boxes));
});
