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
exportZip()           STLs + SVG templates + README + Bambu .3mf into a zip
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

## 5. Invariants (tests enforce these)
1. No two parts overlap in 3D in the assembled state — tiles, frame pieces, standoffs, puck footprints.
2. Every tile and frame piece fits the bed (`fits`).
3. Every snap barb has solid material directly behind it (a lip) in the mating part.
4. The LED cove is open end to end, has a floor, and nothing covers it.
5. Each tile gets ≥ 2 wall sockets in wall-peg mode; puck footprints never overlap.
6. No part needs supports in its print orientation (bridges ≤ 16 mm, ledges ≤ 0.6 mm).
7. No puck, standoff or screw is visible through the lattice from the front.

## 6. Printing (Bambu P2S)
0.4 nozzle, 0.2 mm layers, PLA or PETG on textured PEI, 5 mm brim. Bars must print solid: wall loops enough to fill the bar width. Tiles: face down. Lap additions, frame pieces: as exported (already flipped). Standoffs and pucks: wall side down. Use PETG for the frame if the LED strip runs above ~10 W/m.

## 7. Roadmap (not built yet)
- **Inward LED cove** (second cove option): strip faces the centre to light the lattice from behind, no wall halo.
- **Slotted puck / standoff screw holes**: ±2 mm adjustment for imperfect drilling.
- **Backlight seam leak**: seam gaps (≈ fc) glow under LED backlight; consider a stepped seam or a diffuser layer.
- **Borderless edge option**: so a panel can grow outward later without new frame pieces.
- **3MF export with print settings**: CLI (`cli/generate.js`) and the page's Export zip both write `kumiko_WxH.3mf` with per-object Bambu Studio settings (0.2 mm layers, 5 mm outer brim, wall loops = ceil(max(gw,iw)/(2·0.4)) so bars print solid). Shared builder: `cli/bambu-3mf.js`. Bambu Studio's CLI could turn the project into a G-code `.3mf` automatically.
- **Mesh boolean cleanup**: export each part as one manifold (e.g. via manifold-3d) instead of overlapping prisms.
