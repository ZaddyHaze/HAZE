# Instructions for AI coding agents (Cursor, Claude Code, etc.)

Read `docs/DESIGN.md` first. It explains the coordinate system, every mechanism and its numbers, and the invariants.

## Project layout
- `src/engine.js` — all geometry + the page's UI logic. A plain browser script (no build step, no modules). The page loads it with `<script src>`; the CLI and tests load it into a Node `vm` with a fake DOM (`cli/load-engine.js`).
- `index.html` — the app: controls (their `value`/`checked` attributes are the defaults), styles, preview canvas.
- `cli/generate.js` — headless export to a folder of STLs/SVGs plus a Bambu Studio `.3mf`.
- `cli/bambu-3mf.js` — isomorphic 3MF builder (Node + browser via `globalThis.Bambu3mf`); loaded by `index.html` before `engine.js`.
- `cli/letter-pages.js` — tiles `wall_template.svg` onto US Letter landscape pages (15 mm overlap); CLI prints PDF via Chrome, web zip includes the HTML.
- `examples/living-lattice-accent/` — sample 460×240 asanoha export (STLs + `.3mf` + letter-page wall template).
- `test/` — `node --test` suite. Monte-Carlo 3D collision checks plus mechanism checks.

## Rules
1. **Run `npm test` after every geometry change.** All tests must pass. If you add a mechanism, add a test for its invariant.
2. **No glue, ever.** Every joint must hold mechanically (snap, lap teeth, pegs). Don't propose adhesives.
3. **Every tile must stay removable from the front** in the default mode (zigzag seams + wall pegs).
4. **Nothing needs supports, nothing shows.** Every part must print without supports in its exported orientation, and no wall hardware may be visible through the lattice from the front. `test/printability.test.js` enforces both; split a part or hide it behind a hub or the frame bar rather than relaxing the test.
5. **Clip to territory.** Geometry added to a tile must be clipped to that tile's own cell polygons (see `addBar`, `pushPiece`, hub loop).
6. **Fit clearance `fc` comes off male parts only.** Holes/sockets stay nominal.
7. **Snap geometry comes from `SNAP(P)`.** Don't hard-code barb sizes elsewhere.
8. Keep `engine.js` a single classic script (it's spliced into a single-file web page). No `import`/`export`, no npm runtime dependencies. JSZip is loaded from cdnjs in `index.html`.
9. A new control needs: an input in `index.html` (with its default), an entry in the `ids` array, a field in `readParams()`, a warning in `render()` if it can be set to something unprintable, and a line in `readme()` if it changes assembly.
10. Original design: don't copy geometry, names or text from Paper View's "Large Kumiko Frame Generator" or any other third-party kumiko kit.

## Commands
```
npm test                       # full suite (~5 min)
npm run generate               # defaults → out/
node cli/generate.js --set flt=20 --set b=19 --set cove=true --out out/led
npm run test-kit               # fit coupons → out/test-kit
npm run serve                  # open http://localhost:8080
```

## Expert skills in this project
Two expert roles ship with the project. Use them whenever the work touches their area:
- **Master craftsman & designer** — joints, materials, print orientation, proportion, design reviews. Review order: will it hold → can it be made → is it beautiful → is it a product → one fix with exact dimensions.
- **Japanese history guru** — pattern names and meanings, kumiko and joinery history, Japanese terms (kanji + romaji), product copy that's accurate. Separate documented history from tradition; cite sources.

Where they live:
- Cursor: `.cursor/rules/master-craftsman-designer.mdc`, `.cursor/rules/japanese-history-guru.mdc` (applied by description; mention them with @ to force them on).
- Claude Code: `.claude/skills/master-craftsman-designer/`, `.claude/skills/japanese-history-guru/`.
