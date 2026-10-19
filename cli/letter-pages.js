// Tile a full-size wall_template.svg onto US Letter landscape pages (15 mm overlap)
// so it can be printed on a home printer and taped up.
// Browser: globalThis.LetterPages.buildPrintHtml(...)
// Node CLI: also writeLetterPages() via headless Chrome → PDF.
(function (root) {
  "use strict";
  const isNode = typeof module === "object" && module.exports && typeof require === "function";

  const LETTER_W_MM = 279.4; // 11 in
  const LETTER_H_MM = 215.9; // 8.5 in
  const OVERLAP_MM = 15;
  const MARGIN_MM = 10;

  function planPages(panel) {
    const m = 20; // matches pegTemplateSVG margin
    const fullW = Number(panel.W) + 2 * m;
    const fullH = Number(panel.H) + 2 * m + 40;
    const usableW = LETTER_W_MM - 2 * MARGIN_MM;
    const usableH = LETTER_H_MM - 2 * MARGIN_MM - 18;
    const stepX = Math.max(40, usableW - OVERLAP_MM);
    const stepY = Math.max(40, usableH - OVERLAP_MM);
    const cols = Math.max(1, Math.ceil((fullW - OVERLAP_MM) / stepX));
    const rows = Math.max(1, Math.ceil((fullH - OVERLAP_MM) / stepY));
    const pages = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        pages.push({
          col: c + 1,
          row: r + 1,
          x0: c * stepX - m,
          y0: r * stepY - m,
        });
      }
    }
    return { cols, rows, pages, usableW, usableH, m };
  }

  function buildPrintHtml(svg, panel) {
    const plan = planPages(panel);
    const total = plan.pages.length;
    const bodySvg = String(svg).replace(/^<\?xml[^>]*>\s*/i, "");
    const pagesHtml = plan.pages
      .map((p, i) => {
        const n = i + 1;
        const tx = MARGIN_MM - p.x0;
        const ty = MARGIN_MM + 14 - p.y0;
        return (
          `<section class="page">` +
          `<div class="hdr">Page ${n} of ${total} · row ${p.row}, column ${p.col} — overlap pages by ${OVERLAP_MM} mm, line up the grid crosses, tape. Print at 100% / Actual size.</div>` +
          `<div class="clip"><div class="stage" style="transform:translate(${tx}mm, ${ty}mm)">${bodySvg}</div></div>` +
          `<div class="scale"><span class="bar"></span><span class="lbl">This line must measure exactly 100 mm. If not, reprint at 100% / Actual size.</span></div>` +
          `</section>`
        );
      })
      .join("\n");

    return (
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Wall template — letter pages</title>` +
      `<style>` +
      `@page{size:letter landscape;margin:0}` +
      `*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:sans-serif;color:#1D2329}` +
      `.page{width:${LETTER_W_MM}mm;height:${LETTER_H_MM}mm;position:relative;overflow:hidden;page-break-after:always;break-after:page}` +
      `.page:last-child{page-break-after:auto;break-after:auto}` +
      `.hdr{position:absolute;left:${MARGIN_MM}mm;right:${MARGIN_MM}mm;top:4mm;font-size:3.2mm;line-height:1.3;z-index:2}` +
      `.clip{position:absolute;left:${MARGIN_MM}mm;top:${MARGIN_MM + 12}mm;width:${plan.usableW}mm;height:${plan.usableH}mm;overflow:hidden;border:0.2mm solid #ccc}` +
      `.stage{position:absolute;left:0;top:0}.stage svg{display:block}` +
      `.scale{position:absolute;left:${MARGIN_MM}mm;bottom:5mm;right:${MARGIN_MM}mm;display:flex;align-items:center;gap:3mm;font-size:2.8mm;z-index:2}` +
      `.scale .bar{width:100mm;height:1.2mm;background:#1D2329;flex:0 0 auto}.scale .lbl{color:#5C6670}` +
      `</style></head><body>\n${pagesHtml}\n</body></html>`
    );
  }

  function writeLetterPages(outDir, svg, panel, baseName) {
    if (!isNode) throw new Error("writeLetterPages is Node-only");
    const fs = require("fs");
    const path = require("path");
    const os = require("os");
    const { spawnSync } = require("child_process");
    baseName = baseName || "wall_template_letter_pages";
    fs.mkdirSync(outDir, { recursive: true });
    const htmlPath = path.resolve(outDir, baseName + ".html");
    const pdfPath = path.resolve(outDir, baseName + ".pdf");
    fs.writeFileSync(htmlPath, buildPrintHtml(svg, panel));
    const plan = planPages(panel);

    const candidates = [
      process.env.CHROME_PATH,
      "google-chrome",
      "google-chrome-stable",
      "chromium",
      "chromium-browser",
      "/usr/local/bin/google-chrome",
      "/usr/bin/google-chrome",
    ].filter(Boolean);
    let chrome = null;
    for (const c of candidates) {
      const v = spawnSync(c, ["--version"], { encoding: "utf8" });
      if (v.status === 0) { chrome = c; break; }
    }
    if (!chrome) return { html: htmlPath, pages: plan.pages.length };

    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ll-chrome-"));
    // Absolute file URL — relative out/ paths break file:// loading in headless Chrome.
    const fileUrl = "file://" + htmlPath;
    const r = spawnSync(
      chrome,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--allow-file-access-from-files",
        `--user-data-dir=${profile}`,
        "--no-pdf-header-footer",
        "--virtual-time-budget=8000",
        `--print-to-pdf=${pdfPath}`,
        fileUrl,
      ],
      { encoding: "utf8", timeout: 90000 }
    );
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {}
    if (r.status !== 0 || !fs.existsSync(pdfPath) || fs.statSync(pdfPath).size < 500) {
      return {
        html: htmlPath,
        pages: plan.pages.length,
        error: String(r.stderr || r.stdout || "chrome failed").slice(0, 400),
      };
    }
    return { pdf: pdfPath, html: htmlPath, pages: plan.pages.length };
  }

  const api = { buildPrintHtml, planPages, writeLetterPages, LETTER_W_MM, LETTER_H_MM, OVERLAP_MM };
  if (isNode) module.exports = api;
  else root.LetterPages = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
