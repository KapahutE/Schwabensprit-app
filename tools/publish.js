// Stellt den Ordner zusammen, der auf GitHub Pages veröffentlicht wird: nur die App, nicht Tests, Dokumentation und Werkzeuge.
//   node tools/publish.js _site
// Prüft danach, dass jede in index.html und manifest.webmanifest genannte Datei im Ordner liegt.
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const FILES = ["index.html", "app.css", "sw.js", "manifest.webmanifest", "endpoints.json", "icon.svg", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "icon-mono-512.png", "apple-touch-icon.png", ".nojekyll"];
const DIRS = ["js", "ocr"];

function build(out) {
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  for (const f of FILES) fs.copyFileSync(path.join(ROOT, f), path.join(out, f));
  for (const d of DIRS) fs.cpSync(path.join(ROOT, d), path.join(out, d), { recursive: true });
  const refs = [...fs.readFileSync(path.join(out, "index.html"), "utf8").matchAll(/(?:href|src)="([^"#:?]+)(?:\?[^"]*)?"/g)].map((m) => m[1]).filter((r) => !r.startsWith("//") && !/^https?$/.test(r));
  const mf = JSON.parse(fs.readFileSync(path.join(out, "manifest.webmanifest"), "utf8"));
  refs.push(...mf.icons.map((i) => i.src));
  const missing = [...new Set(refs)].filter((r) => !fs.existsSync(path.join(out, r)));
  return { files: FILES.length + DIRS.length, missing };
}
module.exports = { build, FILES, DIRS };

if (require.main === module) {
  const out = path.resolve(process.argv[2] || "_site"), r = build(out);
  if (r.missing.length) { console.error("Fehlt im Veröffentlichungsordner:", r.missing.join(", ")); process.exit(1); }
  console.log(`${out}: App-Dateien zusammengestellt, alle Verweise vorhanden`);
}
