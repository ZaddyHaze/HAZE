# Kumiko Lap Panel — design reference

This document is the source of truth for *why* the geometry is the way it is. Read it before changing `src/engine.js`.

## 1. Product in one paragraph

A wall panel of traditional kumiko lattice, 3D printed in bed-sized tiles on a Bambu Lab P2S (256 × 256 mm bed). No glue anywhere. Tiles join along zigzag seams that follow the lattice lines, so seams disappear into the pattern. A separate frame screws to the wall; tiles push onto hidden wall pucks and snap into the frame, so any tile can be pulled out and swapped from the front. Optionally the frame floats off the wall on standoffs, with an LED cove in its back for a halo backlight.

## 2. Coordinates and conventions

- Units: millimetres everywhere.
- Panel plane: `x` right, `y` up, origin at the panel's bottom-left outer corner. Panel is `W × H`.
- Depth: `z = 0` is the **front face** of the panel. `z` grows **toward the wall**.
  - Tiles occupy `0 … gh` (grid bar height).
  - Backing lattice ("flange") of the frame: `gh … gh + bt`.
  - Wall plane: `zw` (see `WALL(P)`).
- Every solid is a **z-prism**: `{pts: [[x,y], …] (convex, CCW), z0, z, kind}`. Overlapping prisms within one part are fine (slicers merge them). Prisms of *different* parts must never overlap in 3D — the tests enforce this.
- STL export converts prisms to triangles (`boxTris`). Some parts are **flipped** for printing (`z' = top − z`, and y mirrored for lap additions) so they print without supports.

## 3. Pipeline (src/engine.js)

```
readParams()          read controls → P
lattice(P)            cells (polygons + infill segments) and shared edges for the pattern;
                      origin snapped with latticeFit so frame edges land on full or half cells
candidates(P)         choose nx × ny tile grid so every tile fits the bed (turning tiles 90° if needed)
makeTiles(P, L, Lt)   assign cells to tiles (pattern-aware: assignCellTiles), build bars clipped to each
                      tile's own cells ("territory"), seams (zig / lap / straight), hubs + peg holes,
                      wall sockets, keys
makeBorders(P, Lt, pegPts, sockets)
                      frame pieces: bar + backing lattice + snap pegs + feet / standoffs + LED cove
render()              canvas preview, tile table, warnings
exportZip()           STLs + SVG templates + README + living_lattice_WxH.3mf into a zip
testKit(P)            small fit coupons at clearances 0.05 / 0.10 / 0.15 / 0.20 mm
```

Key rule — **territory clipping**: every bar is clipped to the polygon of the cell that owns it. That is what stops tiles from overlapping at zigzag corners. Don't add geometry to a tile without clipping it to that tile's cells.

## 4. Mechanisms and their numbers

### Seams
| Style | How it holds | Notes |
|---|---|---|
| `zig` (default) | Each tile keeps half-width bars on its side of the seam; tiles nest face to face. | Any tile removable on its own. Seam bars print at `gw/2`, so `gw` should halve to a multiple of 0.4 mm (2.4, 3.2). |
| `lap` | Half-lap by depth: base tiles keep the front `gh/2`, addition tiles keep the back `gh/2` plus teeth at 30 % / 70 % of each seam edge, alternating direction. | Additions export flipped. In wall mode an addition can't come off before its base neighbors. |
| `straight` | Glued rails + splice plates. | Legacy; not the product direction. |

**Seams follow each pattern's grain** (`assignCellTiles`): one rectangular cut for every pattern looks wrong — asanoha wants horizontal joins on triangle base edges, kaku wants axis-aligned grid lines, kikkō must not grow half-bars on its invisible triangle grid (hex infill already meets at edge midpoints), and hishi keeps panel-space tiles so the diamond stairstep still fits the bed.

### Snap latch (shared everywhere)
Default peg Ø3.5 mm: frame pegs print upright, so prongs flex across layer lines (the weak axis); 3.5 mm gives ~1.35 mm prongs. Recommend PETG for frame pieces.
`SNAP(P)`: barb depth `bd = 0.25`, barb height `bh = 0.6`, slot `s = 0.8`, front cap `cap = min(1, gh/3)`, peg tip at `cap + 0.3`.
- Barb radius `rb = (pin − fc)/2 + bd` is **wider than the hole** `ri = pin/2` → interference `bd − fc/2` (0.175 mm at fc = 0.15). The peg is split by the slot so the prongs flex.
- Hole has an **undercut** of radius `ru = rb + 0.1` from `cap` to `cap + 0.3 + bh + 0.1`. The barb clicks into it.
- Snap is active when `P.snap && pin ≥ 2.5 && gh − cap ≥ 3`; otherwise plain press-fit + warning.
- Used by: lap teeth (rectangular version in `lapStrip` / `lapCoupon`), frame→tile pegs (round), standoff→frame pegs (square).

### Fit clearance
`fc` (default 0.15) is subtracted from every male part. Test kit coupons at 0.05–0.20 let the user pick the right value for their printer/filament.

### Rule: nothing needs supports, nothing shows
Every part prints flat-side down with no overhang it can't bridge, and no wall hardware is visible through the lattice from the front. `test/printability.test.js` checks both for every pattern and mount option.

### Wall mount: pucks (`mount = "pegs"`, default)
`WALL(P)`:
- Frame depth `fd = max(fh, gh + bt)` — the frame is never deeper than its backing lattice, so the lattice always prints flat on the bed.
- `zw` = wall plane = `fd + max(5, flt)`. Float 0 = 5 mm shadow gap; 15–25 mm for LED backlight. `T = zw − gh` = air gap behind tiles.
- **Round puck**, Ø`2·puckR` (≈ 14 mm): sits entirely behind its tile's socket hub (Ø`2·sockRo` ≈ 15.2 mm, solid front cap), so it can't be seen. One #6 pan-head screw goes down the hollow peg (ID 8, OD `sock − fc` ≈ 10.25) onto a 1.8 mm floor.
- **Shims**: same round footprint, 0.4 / 0.8 / 1.2 mm, slot from the edge to the screw so they slide in after loosening it; 1–3 notches mark thickness.
- Each tile gets two sockets at non-seam grid vertices.

### Frame (`sepb`) and its standoffs
- Strips T/B/L/R, split to fit the bed. Bar is `b` wide; backing lattice reaches one cell row behind the outer tiles.
- Frame → tile: snap pegs on the backing lattice go into the outer tiles' hub holes.
- Frame → wall (`P.fm`: mount pegs or frame-only): separate **standoffs** (`standoffTris`), 28 mm long and as wide as the bar minus 1.6 mm, so they hide completely behind the bar. Screwed to the wall first; the #6 head sits on the standoff's top and tucks into an 8 mm square pocket in the bar's back (or into the LED cove). Two square snap pegs click into blind sockets in the bar. Needs `b ≥ 8`.
- **Frame only** (`mount = "frame"`): standoffs but no tile pucks — the assembled panel (lap seams) hangs from its frame. Fewer holes; tiles aren't individually swappable.
- Legacy hidden-cleat code (`cleatDims`, `hookTris`) is kept but not offered: its hook lip hung behind the open lattice and showed.

### LED cove
`COVE(P)`: channel in the back of the bar, `off = 1.6` from the outer edge, width `gW = lw + 0.6`, depth `gD = 3`. T/B channels stop 1.6 mm short of the frame's outer ends (no notch in the side); at each corner a 3.5 mm wire channel links them to the L/R channels, so every bit of the channel ceiling bridges between two walls. The strip is cut at each corner and joined with a jumper wire.
Requires: floating frame (`flt > 0`), a wall mount, separate frame, `b ≥ off + gW + 2·(pin/2 + 0.35 + 1.0)` (≈ 18.4 mm for a 10 mm strip with 3.5 mm pegs) and `fd ≥ gD + 3`. Otherwise it switches off and warns.

### Inserts, backers and color
- **Per-tile inserts** (`P.ins`, map tile name → insert): on mixable triangle patterns (asanoha, mitsukude, sankaku) each tile can carry a different insert; the grid stays continuous so seams still land on bars. `insertSegs()` defines each insert. Sakura and goma are NOT built yet: add them only from a verified construction reference.
- **Backers** (`P.bk`, wall-peg mode only): 0.8 mm plate per tile at `z = gh + bt` (behind the frame's backing lattice), cut to the tile's cells (inset 0.12 mm) with 16-gon holes for the puck pegs (hidden behind the hubs). Pucks gain a shoulder (r = puckR + 2) that the backer rests on. Exported as `backer_<tile>.stl`, printed flat in any color.
- **Colors** (`cFrame`, `cGrid`, `cIns`, `cBack`, per-tile `bkc`) drive the "finished colors" preview only. When the insert color differs from the grid color, each tile exports as `_grid` and `_inserts` parts for an AMS print (`twoColor()`).

### Furniture fit (`mount = "fit"`)
For panels that press into furniture instead of hanging on a wall (cube-shelf inserts such as KALLAX).
- `FITCLIP(P)`: clip body 24 mm long, `t = 5` mm deep, behind the frame bar, with two square snap pegs (±7 mm) into blind sockets in the bar (same `SNAP` geometry as the standoffs). Needs `b ≥ 8`.
- Two leaves per clip, 16 mm long, 1.4 mm thick, angle out from the body ends and end `reach = (op − W)/2 + 0.8` mm beyond the frame's outer edge (0.8 mm preload). They stand as vertical walls in print, so they flex along the layers.
- Leaves stay inside their own piece's span (≥ 3 mm from its ends), so leaves of neighbouring pieces never meet at a corner.
- Panel size = measured opening − 4 mm (2 mm gap per side). Warnings below 1 mm or above 4 mm gap, and for zigzag seams (nothing behind the tiles in a shelf, so use lap).
- Builder presets ("Made for"): cube insert (opening 335 mm default — the user measures), headboards Twin 1040 / Full 1420 / Queen 1575 / Cal King 1880 / King 2030 × 610 mm.

### Cell accessories (`src/accessories.js`, separate plain script)
Cell-local frame: origin at the cell's incenter, same z as the panel. All parts fit the modular cell from `cli/cell-coupon.js` (grid bar `gw`, back ledge steps `LEDGE`).
- **Cell plug**: front part `z 0 … 4.0` fills the opening (inradius `R0 − gw/2 − fit`), then three neck steps that mirror the ledge with 0.1 mm clearance. Prints face down; the steps narrow upward, so no overhangs.
- **Magnet chip**: plug with a sealed pocket for an 8 × 2 mm disc: 0.6 mm front skin, pocket Ø8.15 × 2.2, cap above. Pause the print at 2.8 mm and drop the magnet in. Polarity: mark the face if accessories carry magnets; steel discs avoid the issue.
- **Cleat plug**: a 45° groove in the plug face, 21 mm wide, 2.6 mm tall at the face, 3 mm deep, sloping down toward the wall. Placed where the triangle is wide enough (`cleatY`); needs 40 mm cells or larger (returns null for 30 mm).
- **Bud vase holder**: 20.4 mm wide plate (spine 3 mm) with a collar at the top and a cup with a floor at the bottom, for a 16 × 100 mm glass test tube (bore Ø16.8). Its tongue (full width, so it prints from the bed) drops into the cleat groove; weight pulls it tighter; lift up and out to remove. Prints on its side; the bore is a circle up to 0.707 r, then a 45° roof, capped flat at r + 0.2 (short bridge), so it holds a round tube without supports.
- Accessories need horizontal grid lines (pattern not rotated 90°).

## 5. Invariants (tests enforce these)
1. No two parts overlap in 3D in the assembled state — tiles, frame pieces, standoffs, puck footprints.
2. Every tile and frame piece fits the bed (`fits`).
3. Every snap barb has solid material directly behind it (a lip) in the mating part.
4. The LED cove is open end to end, has a floor, and nothing covers it.
5. Each tile gets ≥ 2 wall sockets in wall-peg mode; puck footprints never overlap.
6. No part needs supports in its print orientation (bridges ≤ 16 mm, ledges ≤ 0.6 mm).
7. No puck, standoff, clip or screw is visible through the lattice from the front.
8. Accessories: magnet pocket sealed on both faces; plugs never collide with the cell; the vase tongue seats without touching, is blocked when pulled straight out, and releases when lifted along the slope; a 16 mm tube passes the collar and rests on the cup floor.

## 6. Printing (Bambu P2S)
0.4 nozzle, 0.2 mm layers, PLA or PETG on textured PEI, 5 mm brim. Bars must print solid: wall loops enough to fill the bar width. Tiles: face down. Lap additions, frame pieces: as exported (already flipped). Standoffs and pucks: wall side down. Use PETG for the frame if the LED strip runs above ~10 W/m.

## 7. Roadmap (not built yet)
- **Inward LED cove** (second cove option): strip faces the centre to light the lattice from behind, no wall halo.
- **Slotted puck / standoff screw holes**: ±2 mm adjustment for imperfect drilling.
- **Backlight seam leak**: seam gaps (≈ fc) glow under LED backlight; consider a stepped seam or a diffuser layer.
- **Borderless edge option**: so a panel can grow outward later without new frame pieces.
- **Mesh boolean cleanup**: export each part as one manifold (e.g. via manifold-3d) instead of overlapping prisms.

## 8. Panel 3MF export (`cli/threemf.js`)
CLI (`node cli/generate.js`) and the builder Export zip both write `living_lattice_WxH.3mf` via `ThreeMF` / `writePanel3mf`:
- Per-object: `layer_height` 0.2, `wall_loops` 4, `enable_support` 0, `xy_hole_compensation` 0, `xy_contour_compensation` 0
- `brim_type` `brim_ears` on tiles, borders, backers, splice plates; `no_brim` on pucks, shims, standoffs, keys, clips, cleats/hooks
- One plate per large part (tiles near bed-sized); smaller hardware packed onto shared plates when it fits
- CLI: `--no-3mf` skips the project. Wall mount also writes letter-page wall templates (`cli/letter-pages.js`).
