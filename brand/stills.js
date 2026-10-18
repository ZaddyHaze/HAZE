// Composes the social / listing stills: lattice field (stills_field.py) + wordmark, tagline and spec line in the brand fonts.
// Run: python3 stills_field.py ... (see README) then NODE_PATH=$(npm root -g) node stills.js
const { chromium } = require("playwright"), fs = require("fs"), path = require("path");
const D = __dirname, f = p => "file://" + path.join(D, p);
const SPECS = [
  { out: "stills/living-lattice-instagram-4x5.png", field: "stills/field-4x5.png", w: 1080, h: 1350, top: 1088, word: 60, tag: 31, mono: 17, gap: 22 },
  { out: "stills/living-lattice-etsy-1x1.png", field: "stills/field-1x1.png", w: 2000, h: 2000, top: 1675, word: 96, tag: 48, mono: 27, gap: 30 },
];
const page = s => `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Shippori;src:url(${f("fonts/ShipporiMincho-500.ttf")})}
@font-face{font-family:Zen;src:url(${f("fonts/zen-kaku-gothic-new-latin-500-normal.woff2")})}
@font-face{font-family:Plex;src:url(${f("fonts/ibm-plex-mono-latin-500-normal.woff2")})}
html,body{margin:0;width:${s.w}px;height:${s.h}px;background:#F1ECDD;overflow:hidden}
.f{position:absolute;inset:0;background:url(${f(s.field)}) 0 0/100% 100%}
.t{position:absolute;left:0;right:0;top:${s.top}px;text-align:center;color:#2E3F63}
.w{font:500 ${s.word}px/1 Shippori;letter-spacing:.2em;margin-right:-.2em}
.g{font:500 ${s.tag}px/1.3 Zen;color:#1d2433;margin-top:${s.gap}px}
.m{font:500 ${s.mono}px/1 Plex;letter-spacing:.14em;color:#5c6474;margin-top:${s.gap * 1.1}px}
</style><div class="f"></div><div class="t"><div class="w">LIVING LATTICE</div>
<div class="g">A lattice wall that keeps changing with you.</div>
<div class="m">MODULAR · NO GLUE · TILES SWAP FROM THE FRONT</div></div>`;
(async () => {
  const b = await chromium.launch();
  for (const s of SPECS) {
    const p = await b.newPage({ viewport: { width: s.w, height: s.h } });
    const tmp = path.join(D, "stills/_page.html"); fs.writeFileSync(tmp, page(s));
    await p.goto("file://" + tmp); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(D, s.out) }); fs.unlinkSync(tmp); console.log("wrote", s.out);
  }
  await b.close();
})();
