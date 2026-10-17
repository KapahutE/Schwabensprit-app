// Gemeinsame Hilfen für die Tests: Prüfungen, kleiner Webserver, Playwright finden, Skripte der App in einer Sandbox laden
"use strict";
const fs = require("fs"), path = require("path"), http = require("http"), vm = require("vm"), { execSync } = require("child_process");
const ROOT = path.resolve(__dirname, "..");
let fails = 0, total = 0;
exports.ROOT = ROOT;
exports.check = (name, ok, info = "") => { total++; if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}${!ok && info !== "" ? "\n       " + (typeof info === "string" ? info : JSON.stringify(info)) : ""}`); };
exports.done = (what) => { console.log(`\n${what}: ${total - fails} von ${total} Prüfungen bestanden${fails ? `, ${fails} FEHLGESCHLAGEN` : ""}`); process.exit(fails ? 1 : 0); };
exports.fixture = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", n), "utf8"));
exports.playwright = () => { try { return require("playwright"); } catch { return require(path.join(execSync("npm root -g").toString().trim(), "playwright")); } };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".gz": "application/gzip", ".wasm": "application/wasm" };
// statischer Server für das Repository (Port 0 = frei wählbar); „data/“ und „reports/“ gibt es hier nicht → 404 wie bei privatem Daten-Repository
exports.serve = () => new Promise((res) => {
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || /\/(tests|\.git|\.github)\//.test(p) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end("nf"); }
    r.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" }); fs.createReadStream(f).pipe(r);
  }).listen(0, "127.0.0.1", () => res({ url: `http://127.0.0.1:${srv.address().port}/`, close: () => srv.close() }));
});
// Skripte der App (klassische Skripte mit gemeinsamem Gültigkeitsbereich) in einer Sandbox ausführen
exports.sandbox = (files, extra = {}) => {
  const el = () => new Proxy(function () {}, { get: (t, k) => k === "addEventListener" || k === "append" || k === "classList" ? (k === "classList" ? { add() {}, remove() {}, toggle() {} } : () => {}) : (t[k] ?? el()), set: (t, k, v) => (t[k] = v, true), apply: () => el() });
  const store = { _: {}, get: (k, d) => store._[k] ?? d, set: (k, v) => { store._[k] = v; }, getJ: (k, d) => store._[k] ? JSON.parse(store._[k]) : d, setJ: (k, v) => { store._[k] = JSON.stringify(v); } };
  const ctx = vm.createContext({ console, Math, JSON, Promise, Set, Map, setTimeout, clearTimeout, Number, String, Array, Object, parseFloat, isFinite, Uint8Array, URL,
    document: { createElement: () => el(), addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] }, $: () => el(), store, esc: (s) => String(s ?? ""), say: (a, b) => b, ...extra });
  ctx.globalThis = ctx;
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(ROOT, "js", f), "utf8").replace(/^const (\w+) = /m, (m, n) => (/^[A-Z]/.test(n) && ["Strom", "Karte", "Route"].includes(n) ? `globalThis.${n} = ` : m)), ctx, { filename: f });
  return ctx;
};
