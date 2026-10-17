const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { planPages, buildPrintHtml, writeLetterPages } = require("../cli/letter-pages");
const { loadEngine } = require("../cli/load-engine");

test("planPages tiles a 460×240 panel onto multiple letter pages", () => {
  const plan = planPages({ W: 460, H: 240 });
  assert.ok(plan.pages.length >= 2);
  assert.ok(plan.cols >= 2);
  assert.strictEqual(plan.pages[0].col, 1);
  assert.strictEqual(plan.pages[0].row, 1);
});

test("buildPrintHtml includes overlap instructions and scale bar", () => {
  const html = buildPrintHtml('<svg xmlns="http://www.w3.org/2000/svg"></svg>', { W: 460, H: 240 });
  assert.match(html, /overlap pages by 15 mm/);
  assert.match(html, /100 mm/);
  assert.match(html, /letter landscape/);
  assert.match(html, /Page 1 of/);
});

test("writeLetterPages emits PDF when Chrome is available", () => {
  const E = loadEngine({ W: 460, H: 240, cell: 30, size: 30 });
  E.build();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ll-letter-"));
  const svg = E.pegTemplateSVG();
  const out = writeLetterPages(dir, svg, { W: E.model.P.W, H: E.model.P.H });
  assert.ok(fs.existsSync(out.html));
  assert.ok(out.pages >= 2);
  if (out.pdf) {
    assert.ok(fs.existsSync(out.pdf));
    assert.ok(fs.statSync(out.pdf).size > 1000);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});
