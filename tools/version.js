// Versionsnummer der App-Dateien: die ersten 8 Zeichen der SHA-1-Summe von app.css und js/*.js (in dieser Reihenfolge).
// Sie steht als ?v=… an allen Skript- und Stil-Adressen in index.html, damit Geräte nach Änderungen keine alten Dateien nehmen.
//   node tools/version.js         schreibt die neue Nummer in index.html
//   node tools/version.js --check zeigt nur an, ob die Nummer stimmt (Exit-Code 1, wenn nicht)
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const ROOT = path.resolve(__dirname, "..");
const compute = () => {
  const h = crypto.createHash("sha1");
  h.update(fs.readFileSync(path.join(ROOT, "app.css")));
  for (const f of fs.readdirSync(path.join(ROOT, "js")).filter((x) => x.endsWith(".js")).sort()) h.update(fs.readFileSync(path.join(ROOT, "js", f)));
  return h.digest("hex").slice(0, 8);
};
const inIndex = () => [...fs.readFileSync(path.join(ROOT, "index.html"), "utf8").matchAll(/\?v=([0-9a-f]+)/g)].map((m) => m[1]);
module.exports = { compute, inIndex };

if (require.main === module) {
  const want = compute(), have = inIndex();
  if (process.argv.includes("--check")) {
    const ok = have.length > 0 && have.every((v) => v === want);
    console.log(ok ? `Versionsnummer stimmt: ${want}` : `Versionsnummer veraltet: index.html hat ${[...new Set(have)].join(", ") || "keine"}, die Dateien ergeben ${want} – „node tools/version.js“ ausführen`);
    process.exit(ok ? 0 : 1);
  }
  const p = path.join(ROOT, "index.html");
  fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/\?v=[0-9a-f]+/g, `?v=${want}`));
  console.log(`index.html: ?v=${want} (${have.length} Stellen)`);
}
