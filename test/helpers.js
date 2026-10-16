// Geometry checks used by the tests. Every part is a list of z-prisms {pts:[[x,y]...], z0, z}.
const inPoly = (p, pts) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a[1] > p[1]) != (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};
const solidAt = (p, z, boxes) => boxes.some(b => inPoly(p, b.pts) && z > (b.z0 || 0) && z < b.z);

// Monte-Carlo: random (x,y) columns; any two DIFFERENT parts whose z-ranges overlap there = collision.
function countOverlaps(parts, W, H, samples = 8000, rand = mulberry32(1)) {
  let bad = 0;
  for (let k = 0; k < samples; k++) {
    const p = [rand() * W, rand() * H], iv = [];
    for (const o of parts) for (const b of o.boxes) if (inPoly(p, b.pts)) iv.push([o.id, b.z0 || 0, b.z]);
    outer: for (let a = 0; a < iv.length; a++)
      for (let c = a + 1; c < iv.length; c++)
        if (iv[a][0] !== iv[c][0] && Math.min(iv[a][2], iv[c][2]) - Math.max(iv[a][1], iv[c][1]) > 0.01) { bad++; break outer; }
  }
  return bad;
}
// all parts as they sit on the wall (tiles, frame pieces, standoffs, puck footprints)
function assembled(E) {
  const m = E.model, Wd = E.WALL(m.P);
  return m.tiles.map((T, i) => ({ id: "t" + i, boxes: T.boxes }))
    .concat(m.borders.map((B, i) => ({ id: "b" + i, boxes: B.boxes })))
    .concat(E.allFeet().filter(f => f.boxes).map((f, i) => ({ id: "s" + i, boxes: f.boxes })))
    .concat(m.sockets.map((k, i) => ({ id: "p" + i, boxes: [{ pts: [[k.p[0] - 18, k.p[1] - 12], [k.p[0] + 18, k.p[1] - 12], [k.p[0] + 18, k.p[1] + 12], [k.p[0] - 18, k.p[1] + 12]], z0: m.P.gh + 0.01, z: Wd.zw }] })));
}
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
module.exports = { inPoly, solidAt, countOverlaps, assembled };
