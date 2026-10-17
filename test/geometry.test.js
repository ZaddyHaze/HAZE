// Run: npm test   (node --test). Every change to src/engine.js must keep these green.
const test = require("node:test");
const assert = require("node:assert");
const { loadEngine } = require("../cli/load-engine");
const { solidAt, countOverlaps, assembled } = require("./helpers");

const CONFIGS = [
  { name: "zigzag, wall pegs, frame on wall", set: { seam: "zig", mount: "pegs", flt: 0 } },
  { name: "zigzag, floating frame + LED cove", set: { seam: "zig", mount: "pegs", flt: 20, b: 19, cove: true } },
  { name: "zigzag, floating, no cove", set: { seam: "zig", mount: "pegs", flt: 20, b: 19, cove: false } },
  { name: "half-lap seams, wall pegs", set: { seam: "lap", mount: "pegs", flt: 0 } },
  { name: "frame only, lap seams", set: { seam: "lap", mount: "frame", flt: 0 } },
  { name: "frame only, floating + cove", set: { seam: "lap", mount: "frame", flt: 20, b: 19, cove: true } },
];
const PATTERNS = ["asanoha", "kaku", "hishi", "mitsukude"];

for (const cfg of CONFIGS) for (const pat of PATTERNS) {
  test(`${cfg.name} / ${pat}: no parts collide`, () => {
    const E = loadEngine({ ...cfg.set, pat });
    E.build();
    const m = E.model;
    assert.ok(m.tiles.every(t => t.fits), "every tile fits the bed");
    assert.ok(m.borders.every(b => b.fits), "every frame piece fits the bed");
    assert.strictEqual(countOverlaps(assembled(E), m.P.W, m.P.H, 6000), 0);
  });
}

test("wall pegs: every tile gets 2 sockets, pucks don't overlap", () => {
  const E = loadEngine({ seam: "zig", mount: "pegs" }); E.build();
  const S = E.model.sockets;
  assert.ok(E.model.tiles.every(t => t.sockets >= 2));
  for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++)
    assert.ok(Math.abs(S[i].p[0] - S[j].p[0]) >= 36 || Math.abs(S[i].p[1] - S[j].p[1]) >= 24, "puck footprints overlap");
});

test("snap pegs: every frame peg and standoff peg has a lip to click behind", () => {
  const E = loadEngine({ seam: "zig", mount: "pegs", flt: 20, b: 19 }); E.build();
  const m = E.model, P = m.P, S = E.SNAP(P);
  assert.ok(S.on, "snap should be on with default pegs");
  const ri = P.pin / 2, rb = (P.pin - P.fc) / 2 + S.bd;
  assert.ok(rb > ri, "barb must be wider than the hole it passes through");
  for (const q of m.pins) { // tile hub: solid ring just behind the barb, in the barb's path
    const z = S.z0 + S.bh + 0.1 + 0.05;
    assert.ok(m.tiles.some(T => solidAt([q[0] - (ri + rb) / 2, q[1]], z, T.boxes)), "tile hub lip missing");
  }
  const frame = m.borders.flatMap(B => B.boxes);
  for (const f of E.allFeet().filter(f => f.boxes)) for (const q of f.pegs)
    assert.ok(solidAt([q[0] - (ri + rb) / 2, q[1]], 1 + 0.3 + S.bh + 0.1 + 0.05, frame), "frame socket lip missing");
});

test("LED cove: open channel all the way round, with a floor, not covered by standoffs", () => {
  const E = loadEngine({ seam: "zig", mount: "pegs", flt: 20, b: 19, cove: true }); E.build();
  const m = E.model, P = m.P, CV = E.COVE(P);
  assert.ok(CV.on);
  const frame = m.borders.flatMap(B => B.boxes), st = E.allFeet().filter(f => f.boxes).flatMap(f => f.boxes);
  const o = CV.off + CV.gW / 2, top = m.borders[0].top, pts = [];
  for (let x = o; x <= P.W - o; x += 1) pts.push([x, o], [x, P.H - o]);
  for (let y = o; y <= P.H - o; y += 1) pts.push([o, y], [P.W - o, y]);
  for (const p of pts) {
    assert.ok(!solidAt(p, top - CV.gD / 2, frame) && !solidAt(p, top - CV.gD / 2, st), `cove blocked at ${p}`);
    assert.ok(solidAt(p, top - CV.gD - 0.5, frame), `cove has no floor at ${p}`);
  }
});

test("LED cove turns itself off (with a warning) when the border is too narrow", () => {
  const E = loadEngine({ seam: "zig", mount: "pegs", flt: 20, b: 10, cove: true }); E.build();
  assert.strictEqual(E.COVE(E.model.P).on, false);
});

test("test kit exports every coupon", () => {
  const E = loadEngine({ seam: "lap", mount: "pegs" }); E.build();
  const files = Object.keys(E.testKit(E.model.P));
  for (const f of ["test_lap_bases.stl", "test_lap_additions.stl", "test_peg_holes.stl", "test_pegs.stl", "test_wall_sockets.stl", "test_wall_pucks.stl", "test_frame_sockets.stl", "test_standoffs.stl", "test_puck_shims.stl", "TEST_KIT_README.txt"])
    assert.ok(files.includes(f), f);
});

test("puck shims: three thicknesses, slots line up with the puck screws", () => {
  const E = loadEngine({ seam: "zig", mount: "pegs" }); E.build();
  const P = E.model.P, Wd = E.WALL(P), tris = E.shimTris(P, E.model.sockets.length);
  assert.ok(tris.length > 0);
  const zs = new Set(tris.flatMap(t => t.map(v => +v[2].toFixed(2))));
  for (const t of [0.4, 0.8, 1.2]) assert.ok(zs.has(t), "missing shim thickness " + t);
  // first shim sits at x 0..36, y 0..24, centre (18,12): the screw centres (18±dx, 12) must be open (in a slot)
  const { inPoly } = require("./helpers");
  const tops = []; for (const t of tris) if (t.every(v => Math.abs(v[2] - 0.4) < 1e-6)) tops.push(t.map(v => [v[0], v[1]]));
  for (const x of [18 - Wd.dx, 18 + Wd.dx]) assert.ok(!tops.some(tr => inPoly([x, 12], tr)), "screw hole covered at x=" + x);
});
