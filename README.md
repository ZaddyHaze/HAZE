# Living Lattice — panel builder

Modular 3D-printed kumiko lattice wall panels. Sized for a Bambu Lab P2S (256 × 256 mm bed), glue-free, with tiles that pop out of a wall-mounted frame and an optional floating frame with an LED cove.

## Quick start
Requires Node 18+. No dependencies to install.

```bash
npm test                 # verify geometry, printability, hidden hardware, 3MF settings
npm run generate         # export a panel with default settings to out/ (STLs + .3mf)
npm run test-kit         # export fit-test coupons to out/test-kit
npm run cell-coupon      # modular-cell fit test (chips + inserts) to out/cell-coupon
npm run accessories      # magnet chips, cleat plugs, bud vase holder to out/accessories
npm run kit              # all current test prints as one Bambu Studio project (.3mf, 3 plates)
npm run serve            # run the visual builder at http://localhost:8080
```

Custom panel:
```bash
node cli/generate.js --set W=900 --set H=600 --set pat=asanoha --set flt=20 --set b=19 --out out/living-room
# or put the settings in a JSON file
node cli/generate.js --params panels/living-room.json --out out/living-room
# skip the Bambu Studio project
node cli/generate.js --set W=200 --set H=200 --no-3mf --out /tmp/ll-smoke
```
Every export also writes `params.json`, so you can re-run it later.

## Settings (`--set name=value`)
| id | meaning | default |
|---|---|---|
| `W`, `H` | panel size, mm | 600 / 400 |
| `pat` | `asanoha`, `kikko`, `mitsukude`, `sankaku`, `kaku`, `hishi` | asanoha |
| `cell` | cell size, mm | 40 |
| `gw`, `gh` | grid bar width / height | 2.4 / 6 |
| `iw`, `ih` | infill bar width / height | 1.6 / 6 |
| `b`, `fh` | frame width / depth | 10 / 7 |
| `seam` | `zig` (swappable), `lap` (half-lap teeth) | zig |
| `snap` | snap barbs on teeth and pegs | true |
| `fc` | fit clearance, mm: 0.05 / 0.1 / 0.15 / 0.2 (1–4 dots in the test kit) | 0.15 |
| `pd`, `hd` | peg / hub diameter | 3.5 / 8 |
| `sepb`, `bt` | separate frame with backing lattice / its thickness | true / 1.2 |
| `mount` | `pegs` (hidden round pucks, swappable tiles), `frame` (panel hangs on hidden frame standoffs), `fit` (furniture: spring clips press the panel into a cube-shelf opening), `none` | pegs |
| `op` | cube-shelf opening, mm (furniture fit only; panel = opening − 4) | 335 |
| `flt` | float the frame off the wall, mm (0 = 5 mm shadow gap) | 0 |
| `cove`, `lw` | LED channel in frame back / strip width | false / 10 |
| `bx`, `by`, `mg` | bed size and edge margin | 256 / 256 / 8 |

See `docs/DESIGN.md` for how every part works, and `AGENTS.md` for rules when editing with an AI assistant.

## Output
- `tile_A1.stl …` — lattice tiles (face down)
- `border_t1.stl …` — frame pieces (print as exported)
- `wall_pucks_xN.stl`, `frame_standoffs_xN.stl` — wall hardware
- `puck_shims_…stl` — slotted shims (0.4 / 0.8 / 1.2 mm) to level tiles on uneven walls
- `furniture_clips_xN.stl` — spring clips for a cube-shelf insert (mount = fit)
- `living_lattice_WxH.3mf` — Bambu Studio project: 0.2 mm layers, 4 walls, mouse-ear brim on tiles/frame, no brim on hardware (also in the page Export zip; CLI: `--no-3mf` to skip)
- `wall_template.svg` — print at 100 %, tape level on the wall, drill the crosses
- `wall_template_letter_pages.pdf` (CLI) / `.html` (web) — same template on US Letter landscape pages with 15 mm overlap
- `layout.svg`, `README.txt` — assembly map and steps

## Furniture presets (builder: "Made for")
- **Cube shelf insert** (KALLAX-type, 13" cubes): panel = measured opening − 4 mm, lap seams, hidden spring clips.
- **Headboards**: Twin 1040, Full 1420, Queen 1575, California King 1880, King 2030 mm wide × 610 mm tall (mattress width + a few inches).

## Cell accessories (`src/accessories.js`)
Fit one triangle cell of the modular-cell system: a **magnet chip** (sealed 8 × 2 mm magnet, print pause, no glue), a **cleat plug** (45° mini-cleat in its face, the universal accessory mount; 40 mm cells and up) and a **bud vase holder** (16 × 100 mm glass test tube) that hangs on the cleat plug. Not in the builder yet: it joins when the per-cell system lands.

## License
© Travis Hergenreder. All rights reserved — see the license terms document for personal-use and commercial print licensing. JSZip (MIT) is loaded from a CDN by the web page.
