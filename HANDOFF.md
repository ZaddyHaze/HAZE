# Handoff to Cursor — state as of Oct 17, 2026

Brand: **Living Lattice**, designed by Travis Hergenreder. Start with `AGENTS.md`, then `docs/DESIGN.md`. Run `npm test` first: 66 checks should pass.

## What's done
- Builder (`index.html` + `src/engine.js`) with a simple panel of 7 choices and everything else under Advanced.
- Zigzag swappable tiles and half-lap "one solid panel" seams. All joints snap-fit; no glue.
- Round wall pucks hidden behind tile hubs. Frame standoffs hidden behind the frame bar (one per ~300 mm). Slotted shims.
- Optional floating frame with an LED channel (Advanced, or the "LED backlight" checkbox).
- Every part prints without supports, and no hardware shows from the front (enforced by `test/printability.test.js`).
- Test kit: lap, pegs, pucks, frame/standoff snap, shims.

## Waiting on Travis
- Test kit print results: which dot count fits best for pegs, pucks, standoffs and laps. Change the default Fit if it isn't 3 dots.
- Trademark/domain check for "Living Lattice" before the name goes on anything printed.

## Next tasks, in order
1. ~~**3MF export**~~ **done** — CLI + web Export zip write `living_lattice_WxH.3mf` (`cli/bambu-3mf.js`): 0.2 mm layers, 4 walls, mouse-ear brim on tiles/frame, no brim on hardware, supports off, X-Y hole/contour compensation 0. Skip with `--no-3mf`.
1b. ~~**Letter-page wall template**~~ **done** — CLI writes `wall_template_letter_pages.pdf` (Chrome); web zip includes the print HTML. 15 mm overlap, US Letter landscape.
2. **Hub dots**: the hubs over the pucks show as round dots on the front (most visible on the square grid). Either place sockets only at vertices where the lattice is already dense, or make the hubs a deliberate design detail.
3. **Density zones**: large and small cells in one frame, 2:1 ratio only, so lines carry through.
4. **Inward-facing LED channel** (second cove option), parked by Travis.
5. **Slotted puck/standoff holes** (±2 mm drilling tolerance).
6. **Backlight seam glow**: seam gaps may glow under LED light. Test on a printed pair before changing geometry.

Keep `npm test` green. Add a test for every new mechanism.
