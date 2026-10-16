# Kumiko Lap Panel

Modular 3D-printed kumiko lattice wall panels. Sized for a Bambu Lab P2S (256 × 256 mm bed), glue-free, with tiles that pop out of a wall-mounted frame and an optional floating frame with an LED cove.

## Quick start
Requires Node 18+. No dependencies to install.

```bash
npm test                 # verify geometry (25 checks)
npm run generate         # export a panel with default settings to out/
npm run test-kit         # export fit-test coupons to out/test-kit
npm run serve            # run the visual builder at http://localhost:8080
```

Custom panel:
```bash
node cli/generate.js --set W=900 --set H=600 --set pat=asanoha --set flt=20 --set b=18 --out out/living-room
# or put the settings in a JSON file
node cli/generate.js --params panels/living-room.json --out out/living-room
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
| `seam` | `zig` (swappable), `lap` (half-lap teeth), `straight` | zig |
| `snap` | snap barbs on teeth and pegs | true |
| `fc` | fit clearance, mm (pick from the test kit) | 0.15 |
| `pd`, `hd` | peg / hub diameter | 3 / 8 |
| `sepb`, `bt` | separate frame with backing lattice / its thickness | true / 1.2 |
| `mount` | `pegs` (wall pucks, swappable), `cleat` (one-piece hang), `none` | pegs |
| `flt` | float the frame off the wall, mm (0 = frame touches wall) | 0 |
| `cove`, `lw` | LED cove in frame back / strip width | true / 10 |
| `bx`, `by`, `mg` | bed size and edge margin | 256 / 256 / 8 |

See `docs/DESIGN.md` for how every part works, and `AGENTS.md` for rules when editing with an AI assistant.

## Output
- `tile_A1.stl …` — lattice tiles (face down)
- `border_t1.stl …` — frame pieces (print as exported)
- `wall_pucks_xN.stl`, `frame_standoffs_xN.stl` — wall hardware
- `kumiko_WxH.3mf` — Bambu Studio project: same parts, one plate each, with 0.2 mm layers, 5 mm brim, and enough wall loops for solid bars (also inside the page's Export zip; CLI: `--no-3mf` to skip)
- `wall_template.svg` — print at 100 %, tape level on the wall, drill the crosses
- `layout.svg`, `README.txt` — assembly map and steps

## License
© Travis Hergenreder. All rights reserved — see the license terms document for personal-use and commercial print licensing. JSZip (MIT) is loaded from a CDN by the web page.
