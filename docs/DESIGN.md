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
lattice(P)            cells (polygons + infill segments) and shared edges for the pattern
candidates(P)         choose nx × ny tile grid so every tile fits the bed (turning tiles 90° if needed)
makeTiles(P, L, Lt)   assign cells to tiles, build bars clipped to each tile's own cells ("territory"),
                      seams (zig / lap / straight), hubs + peg holes, wall sockets, keys
makeBorders(P, Lt, pegPts, sockets)
                      frame pieces: bar + backing lattice + snap pegs + feet / standoffs + LED cove
render()              canvas preview, tile table, warnings
exportZip()           STLs + SVG templates + README into a zip
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

### Snap latch (shared everywhere)
`SNAP(P)`: barb depth `bd = 0.25`, barb height `bh = 0.6`, slot `s = 0.8`, front cap `cap = min(1, gh/3)`, peg tip at `cap + 0.3`.
- Barb radius `rb = (pin − fc)/2 + bd` is **wider than the hole** `ri = pin/2` → interference `bd − fc/2` (0.175 mm at fc = 0.15). The peg is split by the slot so the prongs flex.
- Hole has an **undercut** of radius `ru = rb + 0.1` from `cap` to `cap + 0.3 + bh + 0.1`. The barb clicks into it.
- Snap is active when `P.snap && pin ≥ 2.5 && gh − cap ≥ 3`; otherwise plain press-fit + warning.
- Used by: lap teeth (rectangular version in `lapStrip` / `lapCoupon`), frame→tile pegs (round), standoff→frame pegs (square).

### Fit clearance
`fc` (default 0.15) is subtracted from every male part. Test kit coupons at 0.05–0.20 let the user pick the right value for their printer/filament.

### Wall mount: pucks (`mount = "pegs"`, default)
`WALL(P)`:
- `zw` = wall plane = `fd + flt` if floating, else `max(gh + 5, fh)`; `fd = max(fh, gh + bt)` = frame depth.
- `T = zw − gh` = air gap behind tiles.
- Puck: 36 × 24 mm, two #8 screws in square counterbores (`hole 4.5`, `cb 9`, `cbD 3.2`, `dx ±11`), peg Ø(8 − fc) × `pegL`. When `T > 5.5` the puck is a 5 mm plate plus a 12 × 12 mm post.
- Each tile gets two hidden sockets (blind, front cap) — picked so puck footprints don't overlap each other or the frame.

### Frame (`sepb`)
- Strips T/B/L/R, split to fit the bed. Bar is `b` wide; backing lattice reaches `depth` (one cell row) behind the outer tiles.
- Frame → tile: snap pegs on the backing lattice go into the outer tiles' hub holes.
- Frame → wall, **float = 0**: integral feet (16 mm wide blocks) just inside the bar, screw column through the lattice. Pop out an outer tile to reach the screw.
- Frame → wall, **float > 0**: separate **standoffs** (`standoffTris`), printed wall-side down. Screw goes through a counterbore in the standoff's top; two square snap pegs click into blind square sockets in the back of the bar. Frame bar depth is `fd`, so a floating frame never needs supports.
- Foot placement avoids puck footprints, frame pegs and each other (`ok()` in `makeBorders`).

### LED cove
`COVE(P)`: channel in the back of the bar, `off = 1.6` from the outer edge, width `gW = lw + 0.6`, depth `gD = 3`. Runs the full length of every piece and turns the corners (T/B pieces get a short leg that meets the L/R channel). Standoffs and their pegs sit inward of the channel.
Requires: floating frame, wall-peg mount, separate frame, `b ≥ off + gW + 2·(pin/2 + 0.35 + 1.0)` (≈ 17.8 mm for a 10 mm strip) and `fd ≥ gD + 3`. Otherwise it switches off and warns.

### Hidden cleat (`mount = "cleat"`)
Whole panel hangs as one piece on hooks behind the top border (`cleatDims`). Kept for customers who never swap tiles.

## 5. Invariants (tests enforce these)
1. No two parts overlap in 3D in the assembled state — tiles, frame pieces, standoffs, puck footprints.
2. Every tile and frame piece fits the bed (`fits`).
3. Every snap barb has solid material directly behind it (a lip) in the mating part.
4. The LED cove is open end to end, has a floor, and nothing covers it.
5. Each tile gets ≥ 2 wall sockets in wall-peg mode; puck footprints never overlap.

## 6. Printing (Bambu P2S)
0.4 nozzle, 0.2 mm layers, PLA or PETG on textured PEI, 5 mm brim. Bars must print solid: wall loops enough to fill the bar width. Tiles: face down. Lap additions, frame pieces: as exported (already flipped). Standoffs and pucks: wall side down. Use PETG for the frame if the LED strip runs above ~10 W/m.

## 7. Roadmap (not built yet)
- **Inward LED cove** (second cove option): strip faces the centre to light the lattice from behind, no wall halo.
- **Slotted puck / standoff screw holes**: ±2 mm adjustment for imperfect drilling.
- **Borderless edge option**: so a panel can grow outward later without new frame pieces.
- **3MF export with print settings** (CLI): `cli/generate.js` writes `kumiko_WxH.3mf` with per-object Bambu Studio settings (0.2 mm layers, 5 mm outer brim, wall loops = ceil(max(gw,iw)/(2·0.4)) so bars print solid). Web zip export is still STL-only. Bambu Studio's CLI could turn the project into a G-code `.3mf` automatically.
- **Mesh boolean cleanup**: export each part as one manifold (e.g. via manifold-3d) instead of overlapping prisms.
