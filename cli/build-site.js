#!/usr/bin/env node
// Builds site/builder.html: the builder page (index.html) with cli/threemf.js, cli/letter-pages.js,
// and src/engine.js inlined as one file for hosting next to site/index.html (the landing page).
// Run after any engine or UI change: npm run build-site
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");

function inlineScript(html, srcPath, source) {
  const tag = `<script src="${srcPath}"></script>`;
  if (!html.includes(tag)) throw new Error("index.html no longer loads " + srcPath + " with " + tag);
  const body = "<script>\n" + source.replace(/<\/script>/g, "<\\/script>") + "\n</script>";
  return html.replace(tag, body);
}

let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
html = inlineScript(html, "cli/threemf.js", fs.readFileSync(path.join(ROOT, "cli", "threemf.js"), "utf8"));
html = inlineScript(html, "cli/letter-pages.js", fs.readFileSync(path.join(ROOT, "cli", "letter-pages.js"), "utf8"));
html = inlineScript(html, "src/engine.js", fs.readFileSync(path.join(ROOT, "src", "engine.js"), "utf8"));

const page = /^\s*<!doctype/i.test(html) ? html : '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n' + html + "\n</body></html>\n";
fs.mkdirSync(path.join(ROOT, "site"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "site", "builder.html"), page);
console.log("wrote site/builder.html (" + (page.length / 1024).toFixed(0) + " KB)");
