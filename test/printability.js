// Print-orientation checks shared by the printability test and the audit script.
const { inPoly, circle } = require("./helpers");

// every part as it sits on the bed: [{name, boxes:[{pts,z0,z}]}] with z measured up from the bed
function printParts(E) {
  const m = E.model, Wd = E.WALL(m.P), parts = [];
  for (const t of m.tiles) {
    const flip = t.role === "addition";
    parts.push({ name: "tile " + t.name, boxes: t.boxes.map(b => flip ? { pts: b.pts, z0: t.top - b.z, z: t.top - (b.z0 || 0) } : { pts: b.pts, z0: b.z0 || 0, z: b.z }) });
  }
  for (const t of m.tiles) if (t.backer) parts.push({ name: "backer " + t.name, boxes: t.backer.map(b => ({ pts: b.pts, z0: b.z0 - b.z0, z: b.z - b.z0 })) });
  for (const b of m.borders) parts.push({ name: b.name, boxes: b.boxes.map(x => ({ pts: x.pts, z0: b.top - x.z, z: b.top - (x.z0 || 0) })) });
  E.allFeet().filter(f => f.boxes).forEach((f, i) => parts.push({ name: "standoff " + (i + 1), boxes: f.boxes.map(x => ({ pts: x.pts, z0: Wd.zw - x.z, z: Wd.zw - x.z0 })) }));
  { const top = Wd.fd + E.FITCLIP(m.P).t; m.borders.flatMap(b => b.clips || []).forEach((c, i) => parts.push({ name: "clip " + (i + 1), boxes: c.boxes.map(x => ({ pts: x.pts, z0: top - x.z, z: top - x.z0 })) })); }
  m.borders.filter(b => b.hook).forEach((b, i) => parts.push({ name: "hook " + (i + 1), boxes: b.hook.boxes.map(x => ({ pts: x.pts, z0: b.hook.zw - x.z, z: b.hook.zw - x.z0 })) }));
  return parts;
}

function bbox(pts) { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const p of pts) { a = Math.min(a, p[0]); b = Math.max(b, p[0]); c = Math.min(c, p[1]); d = Math.max(d, p[1]); } return [a, c, b, d]; }

// Unsupported overhangs. A downward face is OK if material sits right under it, within LEDGE mm sideways
// (a short step, prints fine), or if it bridges: support on both sides along some direction within BRIDGE mm total.
function overhangs(part, { samples = 6, LEDGE = 0.6, BRIDGE = 16, rand = Math.random } = {}) {
  const boxes = part.boxes.map(b => ({ ...b, bb: bbox(b.pts) }));
  const G = 6, grid = new Map(), key = (i, j) => i + "," + j;
  boxes.forEach((b, bi) => { for (let i = Math.floor(b.bb[0] / G); i <= Math.floor(b.bb[2] / G); i++) for (let j = Math.floor(b.bb[1] / G); j <= Math.floor(b.bb[3] / G); j++) { const k = key(i, j); (grid.get(k) || grid.set(k, []).get(k)).push(bi); } });
  const below = (p, z) => (grid.get(key(Math.floor(p[0] / G), Math.floor(p[1] / G))) || []).some(bi => {
    const b = boxes[bi]; return b.z0 < z - 0.01 && b.z >= z - 0.01 && p[0] >= b.bb[0] && p[0] <= b.bb[2] && p[1] >= b.bb[1] && p[1] <= b.bb[3] && inPoly(p, b.pts);
  });
  const fails = [];
  for (const b of boxes) {
    if (b.z0 <= 0.05 || b.z - b.z0 < 1e-6) continue;
    const [x0, y0, x1, y1] = b.bb; let n = 0, tries = 0;
    while (n < samples && tries++ < samples * 20) {
      const p = [x0 + rand() * (x1 - x0), y0 + rand() * (y1 - y0)];
      if (!inPoly(p, b.pts)) continue; n++;
      if (below(p, b.z0)) continue;
      let ok = false;
      for (let a = 0; a < 16 && !ok; a++) { const t = a * Math.PI / 8; for (const r of [0.2, 0.4, LEDGE]) if (below([p[0] + r * Math.cos(t), p[1] + r * Math.sin(t)], b.z0)) { ok = true; break; } }
      for (let a = 0; a < 32 && !ok; a++) { // straight bridge spans, anchored at both ends
        const t = a * Math.PI / 32, d = [Math.cos(t), Math.sin(t)];
        let s1 = null, s2 = null;
        for (let r = 0.5; r <= BRIDGE; r += 0.5) { if (s1 === null && below([p[0] + r * d[0], p[1] + r * d[1]], b.z0)) s1 = r; if (s2 === null && below([p[0] - r * d[0], p[1] - r * d[1]], b.z0)) s2 = r; }
        if (s1 !== null && s2 !== null && s1 + s2 <= BRIDGE) ok = true;
      }
      if (!ok) fails.push({ p, z: +b.z0.toFixed(2), kind: b.kind });
    }
  }
  return fails;
}

// How much of each hidden part shows through the lattice from the front (0 = fully hidden).
function visibility(E, { samples = 400, rand = Math.random } = {}) {
  const m = E.model, cover = m.tiles.flatMap(t => t.boxes).concat(m.borders.flatMap(b => b.boxes.filter(x => (x.z0 || 0) < 0.01)));
  const Wd = E.WALL(m.P);
  const frac = (shape) => { const bb = bbox(shape); let seen = 0, n = 0, guard = 0;
    while (n < samples && guard++ < samples * 10) { const p = [bb[0] + rand() * (bb[2] - bb[0]), bb[1] + rand() * (bb[3] - bb[1])]; if (!inPoly(p, shape)) continue; n++; if (!cover.some(b => inPoly(p, b.pts))) seen++; }
    return seen / Math.max(1, n); };
  const rectPts = r => [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]];
  return {
    pucks: m.sockets.map(k => frac(circle(k.p, Wd.puckR))),
    feet: E.allFeet().map(f => frac(rectPts(f.rect))),
    clips: m.borders.flatMap(b => b.clips || []).map(c => frac(rectPts(c.rect))),
    hooks: m.borders.filter(b => b.hook).flatMap(b => b.hook.boxes.filter(x => x.kind === "hk").map(x => frac(x.pts))),
  };
}
module.exports = { printParts, overhangs, visibility };
