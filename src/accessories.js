/* Living Lattice — cell accessories. Plain script (no imports): works as a browser <script> and as a Node module.
 *
 * Everything here fits ONE triangle cell of the modular-cell system (see cli/cell-coupon.js for the cell itself:
 * grid bars gw x gh, and a stepped ledge at the back of every cell). Cell-local coordinates: origin at the
 * cell's incenter, x right, y up, z = 0 at the panel front, z grows toward the wall (same as src/engine.js).
 * Triangle cells come in two orientations: "up" (point at the top, flat edge at the bottom) and "down".
 *
 * Parts
 *  - Cell plug: fills the whole cell, flush with the front, seated on the ledge (front part carries the fit).
 *    magnetPlug  = plug with a sealed pocket for an 8 x 2 mm disc magnet (print pause, no glue).
 *    cleatPlug   = plug with a 45-degree mini-cleat groove in its face: the universal accessory mount.
 *                  Needs 40 mm cells or larger (the groove is 21 mm wide); returns null when it doesn't fit.
 *  - vaseHolder: bud vase for a 16 x 100 mm glass test tube. Its tongue drops into a cleat plug's groove;
 *    the holder's weight pulls it tighter. Lift up and out to remove.
 *
 * All solids are z-prisms {pts:[[x,y],...] convex, z0, z, kind} in the frame given. Print-frame versions have
 * z measured up from the bed. Nothing needs supports (tests in test/accessories.test.js).
 */
(function (root) {
  const SQ3 = Math.sqrt(3);
  // ledge steps at the back of every cell: [z0, z1, width beyond the bar face] — must match cli/cell-coupon.js
  const LEDGE = [[4.0, 4.4, 0.5], [4.4, 4.8, 1.0], [4.8, 6.0, 1.5]];
  const CELL = { zChip: 3.2, zLedge: 4.0, chipT: 0.8, neckClr: 0.1 };
  const MAG = { d: 8, t: 2, clr: 0.15, skin: 0.6, tClr: 0.2 }; // 8 x 2 mm N52 disc
  const CLEAT = { w: 21, open: 2.6, depth: 3.0, clr: 0.25, tongueW: 20.4 }; // groove: 21 wide (the holder's full width, so the tongue prints from the bed), 2.6 tall at the face, 45 deg down-back
  const VASE = { tubeD: 16, bore: 16.8, wallF: 1.8, wallB: 1.2, spineT: 3, spineW: 20.4, collarH: 12, cupH: 10, floor: 2, tubeL: 100, above: 25 };

  // inradius of the grid-line triangle for cell size s (s = side length)
  const R0 = s => s / (2 * SQ3);
  // equilateral triangle with inradius r around the origin, CCW
  function tri(r, dir) {
    const a0 = dir === "up" ? 90 : 270, out = [];
    for (let k = 0; k < 3; k++) { const a = (a0 + 120 * k) * Math.PI / 180; out.push([2 * r * Math.cos(a), 2 * r * Math.sin(a)]); }
    return out; // angles increase -> CCW
  }
  // clip a convex CCW polygon to the half-plane n . p <= c
  function half(pts, n, c) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length], dp = n[0] * p[0] + n[1] * p[1] - c, dq = n[0] * q[0] + n[1] * q[1] - c;
      if (dp <= 0) out.push(p);
      if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) { const t = dp / (dp - dq); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
    }
    return out;
  }
  const area = pts => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
  const ok = p => p.length > 2 && area(p) > 1e-4;
  // convex polygon minus an axis-aligned rectangle [x0,y0,x1,y1] -> convex pieces
  function minusRect(P, R) {
    const [x0, y0, x1, y1] = R, out = [];
    const below = half(P, [0, 1], y0), above = half(P, [0, -1], -y1);
    let mid = half(half(P, [0, -1], -y0), [0, 1], y1);
    const left = half(mid, [1, 0], x0), right = half(mid, [-1, 0], -x1);
    for (const q of [below, above, left, right]) if (ok(q)) out.push(q);
    return out;
  }
  // convex polygon minus a circle (as an N-gon): wedge pieces between rays from the circle's center
  function minusCircle(P, c, r, N = 32) {
    const out = [];
    for (let k = 0; k < N; k++) {
      const a0 = 2 * Math.PI * k / N, a1 = 2 * Math.PI * (k + 1) / N;
      let w = half(P, [-Math.sin(a0), Math.cos(a0)].map(v => -v), -(-Math.sin(a0) * c[0] + Math.cos(a0) * c[1])); // left of ray a0
      w = half(w, [-Math.sin(a1), Math.cos(a1)], -Math.sin(a1) * c[0] + Math.cos(a1) * c[1]);                     // right of ray a1
      const p0 = [c[0] + r * Math.cos(a0), c[1] + r * Math.sin(a0)], p1 = [c[0] + r * Math.cos(a1), c[1] + r * Math.sin(a1)];
      const n = [p1[0] - p0[0], p1[1] - p0[1]], nn = [n[1], -n[0]]; // outward normal of the chord
      w = half(w, nn.map(v => -v), -(nn[0] * p0[0] + nn[1] * p0[1])); // keep the side away from the center
      if (ok(w)) out.push(w);
    }
    return out;
  }

  // ---- cell plugs ----
  // fit: lateral oversize of the front part (negative = tighter), same meaning as the cell coupon's fits
  function plugBody(s, gw, dir, fit, holes) {
    // holes(z0, z1) -> function(poly) -> [pieces] lets callers cut pockets/grooves per layer
    const r0 = R0(s), boxes = [], front = tri(r0 - gw / 2 - fit, dir);
    const layers = holes ? holes.zs : [0, CELL.zLedge];
    for (let i = 0; i + 1 < layers.length; i++) {
      const z0 = layers[i], z1 = layers[i + 1];
      const pieces = holes ? holes.cut(front, (z0 + z1) / 2) : [front];
      for (const p of pieces) boxes.push({ pts: p, z0, z: z1, kind: "plug" });
    }
    for (const [z0, z1, w] of LEDGE) boxes.push({ pts: tri(r0 - gw / 2 - w - CELL.neckClr, dir), z0, z: z1, kind: "plug" });
    return boxes;
  }
  function magnetPlug(s, gw, dir, fit, m = MAG) {
    const z0 = m.skin, z1 = m.skin + m.t + m.tClr;
    return { pauseAt: +z1.toFixed(2), boxes: plugBody(s, gw, dir, fit, {
      zs: [0, z0, z1, CELL.zLedge], cut: (P, zm) => zm > z0 && zm < z1 ? minusCircle(P, [0, 0], (m.d + m.clr) / 2) : [P] }) };
  }
  // where the groove sits: centred in the band of the triangle where it has room (both orientations)
  function cleatY(s, gw, dir) {
    const r = R0(s) - gw / 2, C = CLEAT;
    // width of the opening at height y
    const width = y => dir === "down" ? (y + 2 * r) * 2 / SQ3 : (2 * r - y) * 2 / SQ3;
    let lo = -1e9, hi = 1e9;
    for (let y = -2 * r; y <= 2 * r; y += 0.05) {
      const top = y + C.open, bot = y - C.depth; // groove spans bot..top over its depth
      const fits = top <= (dir === "down" ? r : 2 * r) - 1.5 && bot >= (dir === "down" ? -2 * r : -r) + 1.5 &&
        Math.min(width(top), width(bot)) >= C.w + 3;
      if (fits) { lo = Math.min(lo === -1e9 ? y : lo, y); hi = y; }
    }
    if (lo === -1e9) return null;
    return (lo + hi) / 2;
  }
  // the groove, as thin layers: at depth z it spans y in [yg - z, yg + open - z] (slopes down toward the wall)
  function cleatPlug(s, gw, dir, fit, dz = 0.2) {
    const yg = cleatY(s, gw, dir), C = CLEAT;
    if (yg === null) return null;
    const zs = []; for (let z = 0; z < C.depth - 1e-6; z += dz) zs.push(+z.toFixed(3)); zs.push(C.depth, CELL.zLedge);
    return { yg, boxes: plugBody(s, gw, dir, fit, { zs, cut: (P, zm) => zm < C.depth ? minusRect(P, [-C.w / 2, yg - zm - dz / 2, C.w / 2, yg + C.open - zm + dz / 2]) : [P] }) };
  }

  // ---- bud vase holder ----
  // geometry in the panel frame (cell-local): returns {tongue (z >= 0, z-prism layers), dims}
  function vaseDims(yg) {
    const V = VASE, C = CLEAT, yTop = yg + 6, r = V.bore / 2;
    const zc = -(V.spineT + V.wallB + r), zFront = zc - r - V.wallF;
    const yFloor = yTop + V.above - V.tubeL; // tube bottom rests here
    return { yTop, yFloor, yBot: yFloor - V.floor, r, zc, zFront, half: r + 0.2 + 1.6 /* block half-width, see bore() */ };
  }
  // tongue layers (panel frame) for collision tests against the plug
  function vaseTongue(yg, dz = 0.2) {
    const C = CLEAT, out = [], c = C.clr, zEnd = C.depth - 0.2;
    for (let z = 0; z < zEnd - 1e-6; z += dz) {
      const z1 = Math.min(zEnd, z + dz);
      // conservative: the tongue's extent over the whole layer
      out.push({ pts: [[-C.tongueW / 2, yg - z1 + c], [C.tongueW / 2, yg - z1 + c], [C.tongueW / 2, yg + C.open - z - c], [-C.tongueW / 2, yg + C.open - z - c]], z0: z, z: z1, kind: "tongue" });
    }
    return out;
  }
  // bore half-width (in z) at sideways offset x: circle below 0.707 r, then a 45-degree roof, capped flat at
  // x = r + 0.2 (a short bridge). Holds a round tube of diameter < 2r: the roof line stays r/sqrt2*sqrt2 = r away.
  function boreHalf(x, r) {
    if (x <= -r) return 0;
    if (x <= r / Math.SQRT2) return Math.sqrt(Math.max(0, r * r - x * x));
    if (x <= r + 0.2) return r * Math.SQRT2 - x;
    return 0;
  }
  // print frame: lying on its side, the panel's x axis points up from the bed. Bed coords: u = panel y, v = -panel z.
  function vaseHolderPrint(yg, slab = 0.4) {
    const V = VASE, C = CLEAT, D = vaseDims(yg), boxes = [], H = D.half, u0 = D.yBot;
    const add = (pts, kind, xa, xb) => boxes.push({ pts: pts.map(([u, v]) => [u - u0, v]), z0: xa + H, z: xb + H, kind });
    const rect = (ua, ub, va, vb) => [[ua, va], [ub, va], [ub, vb], [ua, vb]];
    const vF = -D.zFront, vB = V.spineT; // block runs v in [vB, vF]  (v = -z)
    for (let xa = -H; xa < H - 1e-6; xa += slab) {
      const xb = Math.min(H, xa + slab), xm = (xa + xb) / 2;
      // bore: in the lower half use the slab's wider end, in the upper half its narrower end (no overhang)
      const hz = xm < 0 ? boreHalf(xa, D.r) : boreHalf(xb, D.r);
      const bv0 = -D.zc - hz, bv1 = -D.zc + hz;
      const ring = (ua, ub) => { if (hz <= 0.01) add(rect(ua, ub, vB, vF), "block", xa, xb);
        else { if (bv0 > vB + 0.01) add(rect(ua, ub, vB, bv0), "block", xa, xb); if (vF > bv1 + 0.01) add(rect(ua, ub, bv1, vF), "block", xa, xb); } };
      ring(D.yTop - V.collarH, D.yTop);                                  // collar: open top and bottom
      add(rect(D.yBot, D.yFloor, vB, vF), "block", xa, xb);              // cup floor
      ring(D.yFloor, D.yFloor + V.cupH);                                 // cup wall
      if (Math.abs(xm) <= V.spineW / 2) add(rect(D.yBot, D.yTop, 0, V.spineT), "spine", xa, xb);
      if (Math.abs(xm) <= C.tongueW / 2) { // tongue: parallelogram, drops 45 degrees toward the wall
        const c = C.clr, e = C.depth - 0.2;
        add([[yg + c, 0], [yg + C.open - c, 0], [yg + C.open - c - e, -e], [yg + c - e, -e]].reverse(), "tongue", xa, xb);
      }
    }
    return { boxes, dims: D };
  }

  const API = { LEDGE, CELL, MAG, CLEAT, VASE, R0, tri, half, minusRect, minusCircle, magnetPlug, cleatPlug, cleatY, vaseDims, vaseTongue, vaseHolderPrint, boreHalf, area };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.ACC = API;
})(this);
