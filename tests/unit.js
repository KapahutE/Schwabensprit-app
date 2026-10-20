// Unit-Tests ohne Browser: node tests/unit.js
"use strict";
const { check, done, fixture, sandbox, ROOT } = require("./lib.js");
const fs = require("fs"), path = require("path"), vm = require("vm"), { spawnSync } = require("child_process");

// ---- 1. Streckengeometrie (eigene Testdatei)
{
  const r = spawnSync(process.execPath, [path.join(__dirname, "routegeo.test.js")], { encoding: "utf8" });
  const m = (r.stdout + r.stderr).match(/(\d+) bestanden, (\d+) fehlgeschlagen/);
  check("Streckengeometrie (routegeo.test.js)", r.status === 0 && m && +m[2] === 0, (r.stdout + r.stderr).slice(-300));
}

// ---- 2. Belegleser: Belegtexte → Menge, Preis, Betrag, Datum, Uhrzeit
{
  const ctx = vm.createContext({ console, location: { href: "http://x/" }, window: {}, document: {}, URL, Date, Math });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js/belegleser.js"), "utf8"), ctx);
  for (const c of require("./fixtures/receipts.js")) {
    const r = ctx.parseReceipt(c.text), bad = Object.entries(c.exp).filter(([k, v]) => r[k] !== v).map(([k, v]) => `${k}: ${JSON.stringify(r[k])} statt ${JSON.stringify(v)}`);
    check(`Beleg: ${c.name}`, !bad.length, bad.join("; "));
  }
}

// ---- 3. Spritbüchle: Verbrauch Volltankung zu Volltankung (Auto verbraucht genau 7,0 l/100 km)
{
  const el = () => new Proxy({}, { get: (t, k) => k === "addEventListener" ? () => {} : (t[k] ?? el()), set: (t, k, v) => (t[k] = v, true) });
  const ctx = vm.createContext({ console, Date, Math, JSON, $: () => el(), document: { addEventListener() {} }, navigator: {}, indexedDB: {}, store: { get: (k, d) => d }, bases: [], fmtNum: (v, d = 2) => v.toFixed(d) });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js/tankbuch.js"), "utf8") + "\n;this.tbStats = tbStats;", ctx);
  const E = (date, liters, odo, full = true) => ({ date, liters, odo, full, total: +(liters * 1.8).toFixed(2), ppl: 1.8 });
  const cons = (l) => ctx.tbStats(l).cons;
  check("Verbrauch: alle voll, km-Stand jedes Mal", Math.abs(cons([E("2026-01-01", 40, 10000), E("2026-01-10", 35, 10500), E("2026-01-20", 35, 11000)]) - 7) < 0.01);
  check("Verbrauch: Teilbetankung dazwischen", Math.abs(cons([E("2026-01-01", 40, 10000), E("2026-01-05", 30, 10300, false), E("2026-01-10", 5, 10500)]) - 7) < 0.01);
  check("Verbrauch: km-Stand einer Volltankung fehlt", Math.abs(cons([E("2026-01-01", 40, 10000), E("2026-01-05", 21, null), E("2026-01-10", 14, 10500)]) - 7) < 0.01);
  check("Verbrauch: Teilbetankung ohne km-Stand", Math.abs(cons([E("2026-01-01", 40, 10000), E("2026-01-05", 20, null, false), E("2026-01-10", 15, 10500)]) - 7) < 0.01);
}

// ---- 4. Meine Ladekarte: Eingabeprüfung und laufende Prüfung
{
  const DAY = 864e5; let now = Date.parse("2026-10-16T12:00:00Z");
  class FD extends Date { constructor(...a) { a.length ? super(...a) : super(now); } static now() { return now; } }
  const ctx = sandbox(["ladekarte.js"], { Date: FD, eur2s: (v) => (Math.round(v * 100) / 100).toFixed(2).replace(".", ","), toast() {}, confirm: () => true });
  const K = ctx.Karte, ok = (f, old) => K.check(f, old);
  check("Karte: leerer Name und Text als Preis werden abgelehnt", ok({ name: "", ac: "abc", dc: "0,59" }).err.length === 2);
  check("Karte: 5 €/kWh und 0,02 €/kWh sind nicht möglich", ok({ name: "X", ac: "5", dc: "0,59" }).err.length === 1 && ok({ name: "X", ac: "0,49", dc: "0,02" }).err.length === 1);
  check("Karte: gültige Eingabe ohne Hinweise", (() => { const r = ok({ name: "EnBW", ac: "0,49", dc: "0,59", hpc: "0,69" }); return !r.err.length && !r.warn.length; })());
  check("Karte: DC günstiger als AC → Warnung", ok({ name: "X", ac: "0,60", dc: "0,40" }).warn.some((w) => /günstiger als AC/.test(w)));
  check("Karte: ungewöhnlich niedrig/hoch → Warnung", ok({ name: "X", ac: "0,20", dc: "0,59" }).warn.length >= 1 && ok({ name: "X", ac: "0,49", dc: "1,40" }).warn.length >= 1);
  K.setMarket(() => ({ ac: 0.5, dc: 0.7 }));
  check("Karte: Abweichung > 35 % vom Marktmedian → Warnung", ok({ name: "X", ac: "0,30", dc: "0,70" }).warn.some((w) => /Median der Direktpreise/.test(w)) && !ok({ name: "X", ac: "0,52", dc: "0,70" }).warn.length);
  check("Karte: starke Änderung gegenüber vorher → Warnung", ok({ name: "X", ac: "0,70", dc: "0,70" }, { ac: 0.5, dc: 0.7 }).warn.some((w) => /ändert sich stark/.test(w)));
  // Laufende Prüfung: bestätigt vor n Tagen
  const card = (days, extra = {}) => ({ id: "k", name: "T", ac: 0.49, dc: 0.59, hpc: 0.69, ops: "", on: true, at: new Date(now - days * DAY).toISOString(), ...extra });
  ctx.store.setJ("evCards", [card(10)]);
  const K2 = sandbox(["ladekarte.js"], { Date: FD, eur2s: ctx.eur2s, toast() {}, confirm: () => true, store: ctx.store }).Karte;
  check("Karte: 10 Tage → in Ordnung, wird angewendet", K2.level(card(10)) === "ok" && K2.used().length === 1);
  check("Karte: 35 Tage → bitte prüfen, wird noch angewendet", K2.level(card(35)) === "due");
  check("Karte: 70 Tage → abgelaufen", K2.level(card(70)) === "expired");
  check("Karte: kaputtes/zukünftiges Datum → abgelaufen", K2.level(card(1, { at: "kaputt" })) === "expired" && K2.level(card(-5)) === "expired");
  const s = { op: "EnBW", brand: "EnBW", country: "DEU" }, ac = { kw: 22, dc: false }, dc = { kw: 50, dc: true }, hpc = { kw: 150, dc: true };
  check("Karte: Preis nach Anschlussart (AC / DC / ab 150 kW)", K2.priceFor(card(1), ac) === 0.49 && K2.priceFor(card(1), dc) === 0.59 && K2.priceFor(card(1), hpc) === 0.69 && K2.priceFor(card(1, { hpc: "" }), hpc) === 0.59);
  check("Karte: gilt nur in Deutschland", K2.applies(card(1), s) && !K2.applies(card(1), { ...s, country: "CHE" }));
  check("Karte: Betreiber-Filter", K2.applies(card(1, { ops: "enbw, ionity" }), s) && !K2.applies(card(1, { ops: "ionity" }), s));
}

// ---- 5. E-Modus: MwSt.-Erkennung, Zusammenfassen von Doppelmeldungen, Belegung, Preisbasis
{
  const NOW = Date.parse("2026-10-16T12:00:00Z");
  class FD extends Date { constructor(...a) { a.length ? super(...a) : super(NOW); } static now() { return NOW; } }
  const helpers = `
    const distKm = (a, b, c, d) => { const p = Math.PI / 180, x = Math.sin((c - a) * p / 2) ** 2 + Math.cos(a * p) * Math.cos(c * p) * Math.sin((d - b) * p / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
    const tidy = (t) => String(t || "").trim(); const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
    const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
    const eur2s = (v) => (Math.round(v * 100) / 100).toFixed(2).replace(".", ","); const ago = () => ""; const km = (d) => d.toFixed(1) + " km"; const ct = (v) => (v * 100).toFixed(1) + " ct";
    const fmtNum = (v, d = 2) => v.toFixed(d); const eur2 = (v) => eur2s(v) + " €"; const eurX = (v) => v.toFixed(3) + " €"; const FUELS = { e5: "Super E5" }; let fuel = "e5", view = null, evMode = true, radius = 10;
    const hasPrice = () => false; const CONS = () => 7; const center = () => ({ lat: 48.693, lng: 9.143, label: "x" }); const toast = () => {}; const render = () => {};
    const kv = { get: async () => undefined, set: async () => {}, clear: async () => {} };
    const badge = () => ""; const NAV = ""; const pill = () => ""; const LV_LEGEND = ""; const dur = () => ""; const loadLeaflet = null; const TILES = []; const ROAD = 1.3; const L = null; const fetchT = null; const endpoints = async () => ({});`;
  const ctx = sandbox([], { Date: FD });
  vm.runInContext(helpers, ctx);
  for (const f of ["ladekarte.js", "strom.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, "js", f), "utf8").replace(/^const (Strom|Karte) = /m, "globalThis.$1 = "), ctx, { filename: f });
  const St = ctx.Strom, S = St.S;
  const g = (p) => Math.round(St.gross(p) * 100) / 100;
  check("MwSt.: Endpreise bleiben, Nettopreise werden brutto (0,6639 → 0,79; 0,5882 → 0,70; 0,5125 → 0,61)", g(0.41) === 0.41 && g(0.75) === 0.75 && g(0.6639) === 0.79 && g(0.5882) === 0.7 && g(0.5125) === 0.61);
  check("MwSt.: Endpreis mit mehr Stellen bleibt (0,5355)", Math.abs(St.gross(0.5355) - 0.5355) < 1e-9);
  const cd = St.condense({ elements: [{ price_components: [{ type: "FLAT", price: 1.5 }] }, { price_components: [{ type: "ENERGY", price: 0.46 }] }, { price_components: [{ type: "TIME", price: 0.06 }], restrictions: { min_duration: 3600 } }] });
  check("Tarif verdichten: Energie, Start, Zeitpreis ab Frist", cd[0] === 0.46 && cd[1] === 1.5 && cd[2] === 0.06 && cd[3] === 60, cd);
  check("Tarif: 0,00 €/kWh ist kein Preis (Platzhalter)", St.condense({ elements: [{ price_components: [{ type: "ENERGY", price: 0 }] }] })[0] === null);
  // Standorte aus den Testdaten: Raster-Zusammenfassen gleich dem Paarvergleich
  const items = fixture("ev-locations.json").items, c0 = { lat: 48.693, lng: 9.143 };
  const norm = items.map((x) => St.norm(x, c0)).filter(Boolean);
  const d = (a, b) => { const p = Math.PI / 180, x = Math.sin((b.lat - a.lat) * p / 2) ** 2 + Math.cos(a.lat * p) * Math.cos(b.lat * p) * Math.sin((b.lng - a.lng) * p / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
  const naive = (list) => {
    const live = list.filter((s) => s.src !== "bnetza_api");
    const kept = list.filter((s) => s.src !== "bnetza_api" || !live.some((t) => d(t, s) < 0.06)), out = [];
    for (const s of kept) { const o = out.find((t) => t.op === s.op && d(t, s) < 0.05); if (o) o.n += s.cons.length; else out.push({ ...s, n: s.cons.length }); }
    return out;
  };
  const a = St.dedupe(norm), b = naive(norm);
  check(`Zusammenfassen: Raster = Paarvergleich (${norm.length} → ${a.length} Stationen)`, a.length === b.length && a.every((s, i) => s.cons.length === b[i].n), { raster: a.length, paar: b.length });
  const keptCons = norm.filter((s) => s.src !== "bnetza_api" || !norm.some((t) => t.src !== "bnetza_api" && d(t, s) < 0.06)).reduce((n, s) => n + s.cons.length, 0);
  check("Zusammenfassen: weniger Stationen als Standorte, alle Anschlüsse bleiben erhalten", a.length < norm.length && a.reduce((n, s) => n + s.cons.length, 0) === keptCons, { stationen: a.length, standorte: norm.length });
  // Belegung zählt nur, wenn höchstens 2 Std. alt
  const mk = (id, raw, hAgo, extra = {}) => ({ id, uid: id, src: "datex2_enbw", country: "DEU", brand: "T", op: "T", place: "X", street: "", plz: "", lat: 48.69, lng: 9.14, dist: 1, upd: null, hours: null, phone: "", name: "", kw: 22, live: true,
    cons: [{ std: "Typ 2", kw: 22, dc: false, tid: ["t1"], raw, ts: NOW - hAgo * 36e5, ev: id + "e" }], ...extra });
  S.tar = { t1: [0.5, 0, 0, 0] }; S.stations = [mk("a", "free", 1), mk("b", "free", 5), mk("c", "busy", 0.5), mk("d", "out", 1)];
  const rows = St.rows().all, by = (id) => rows.find((v) => v.s.id === id);
  check("Belegung: frisch (1 Std.) → frei", by("a").known && by("a").free === 1);
  check("Belegung: veraltet (5 Std.) → unbekannt, aber als „nicht aktuell“ gekennzeichnet", !by("b").known && by("b").stale && by("b").free === 0);
  check("Belegung: belegt und gestört werden erkannt", by("c").full && by("d").out);
  // Preisbasis: Direkt / Karte / Beste
  ctx.store.setJ("evCards", [{ id: "k", name: "T", ac: 0.4, dc: 0.5, hpc: "", ops: "", on: true, at: new Date(NOW).toISOString() }]);
  const K = vm.runInContext("Karte", ctx); K.cards().length || K.cards().push({ id: "k", name: "T", ac: 0.4, dc: 0.5, hpc: "", ops: "", on: true, at: new Date(NOW).toISOString() });
  S.basis = "best"; check("Preisbasis „Beste“: Kartenpreis 0,40 < Direktpreis 0,50", St.rows().all[0].e === 0.4 && St.rows().all[0].src === "card");
  S.basis = "direct"; check("Preisbasis „Direkt“", St.rows().all[0].e === 0.5 && St.rows().all[0].src === "direct");
  S.basis = "card"; check("Preisbasis „Karte“", St.rows().all[0].e === 0.4);
  S.stations = [mk("ch", "free", 1, { country: "CHE" })]; S.basis = "best";
  check("Schweiz: kein Kartenpreis (Euro gilt nur in Deutschland)", St.rows().all[0].src === "direct" && St.rows().all[0].c == null);
}
// ---- 5. Android und iPhone: Geräteerkennung, Maps-Intent, Manifest (Symbole, Verknüpfungen)
{
  const src = fs.readFileSync(path.join(ROOT, "js/grund.js"), "utf8");
  const pick = (re) => { const m = src.match(re); if (!m) throw new Error("nicht gefunden: " + re); return m[0]; };
  const ctx = vm.createContext({ URL, encodeURIComponent, navigator: {} });
  vm.runInContext(pick(/function platformOf[\s\S]*?\n}\n/) + pick(/const mapsIntent = .*\n/) + "\n;this.platformOf = platformOf; this.mapsIntent = mapsIntent;", ctx);
  const P = (ua, plat = "", touch = 0) => ctx.platformOf(ua, plat, touch);
  check("Gerät: iPhone", P("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari", "iPhone", 5).ios === true && P("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", "iPhone", 5).android === false);
  check("Gerät: iPad (meldet sich als Mac, hat Touch) ist iOS", P("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 5).ios === true);
  check("Gerät: Mac ohne Touch ist Apple, aber nicht iOS", P("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 0).apple === true && P("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 0).ios === false);
  check("Gerät: Android (Chrome, Samsung Internet)", P("Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36", "Linux armv81", 5).android === true && P("Mozilla/5.0 (Linux; Android 13; SM-S918B) SamsungBrowser/23.0 Chrome/115 Mobile", "Linux armv81", 5).apple === false);
  check("Gerät: Windows/Linux-Desktop ist weder Android noch Apple", ["ios", "android", "apple"].every((k) => P("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120", "Win32", 0)[k] === false));
  const it = ctx.mapsIntent("https://www.google.com/maps/dir/?api=1&destination=48.5%2C9.2&travelmode=driving");
  check("Android: Maps-Intent mit Maps-App und Rückfall auf die Webadresse", it.startsWith("intent://www.google.com/maps/dir/?api=1&destination=48.5%2C9.2&travelmode=driving#Intent;scheme=https;package=com.google.android.apps.maps;S.browser_fallback_url=https%3A%2F%2Fwww.google.com%2Fmaps%2Fdir%2F") && it.endsWith(";end"), it);
  const mf = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.webmanifest"), "utf8")), png = (f) => { const b = fs.readFileSync(path.join(ROOT, f)); return b.readUInt32BE(16) + "x" + b.readUInt32BE(20); };
  const pngs = mf.icons.filter((i) => i.type === "image/png");
  check("Manifest: Symbole vorhanden, Größe stimmt (192, 512, maskable, monochrome)", pngs.every((i) => fs.existsSync(path.join(ROOT, i.src)) && png(i.src) === i.sizes) && ["any", "maskable", "monochrome"].every((u) => pngs.some((i) => i.purpose === u)) && pngs.some((i) => i.sizes === "192x192") && pngs.some((i) => i.sizes === "512x512"), pngs.map((i) => i.src + " " + i.sizes));
  const tabs = src.match(/const TABS = \[(.*?)\]/)[1].replace(/"/g, "").split(/,\s*/);
  check("Manifest: Verknüpfungen zeigen auf vorhandene Bereiche", mf.shortcuts.length >= 3 && mf.shortcuts.every((x) => tabs.includes(new URL(x.url, "http://x/").searchParams.get("tab"))), mf.shortcuts.map((x) => x.url));
  check("Manifest: Startadresse und Umfang relativ, Anzeige als App", mf.start_url === "./" && mf.scope === "./" && mf.display === "standalone");
}
// ---- 6. Versionsnummer in index.html passt zu den Dateien (sonst nehmen Geräte alte Dateien aus dem Zwischenspeicher)
{
  const V = require("../tools/version.js"), have = V.inIndex(), want = V.compute();
  check("Versionsnummer: alle ?v=-Adressen in index.html stimmen mit app.css und js/*.js überein (node tools/version.js)", have.length >= 10 && have.every((v) => v === want), { index: [...new Set(have)], dateien: want });
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script src="js\/([\w.]+)\?v=/g)].map((m) => m[1]).sort(), files = fs.readdirSync(path.join(ROOT, "js")).filter((f) => f.endsWith(".js")).sort();
  check("Skripte: jede Datei in js/ ist in index.html eingebunden und umgekehrt", JSON.stringify(scripts) === JSON.stringify(files), { scripts, files });
  // Content-Security-Policy erlaubt alle Dienste aus endpoints.json
  const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)[1], hosts = [...JSON.stringify(require("../endpoints.json")).matchAll(/https:\/\/([^/"]+)/g)].map((m) => m[1]);
  check("CSP: connect-src nennt alle Dienste aus endpoints.json", hosts.every((h) => csp.includes(`https://${h}`)), hosts.filter((h) => !csp.includes(`https://${h}`)));
}
// ---- 7. Veröffentlichungsordner: enthält alles, was die App braucht, und nichts von Tests, Dokumentation, Werkzeugen
{
  const os = require("os"), P = require("../tools/publish.js"), out = fs.mkdtempSync(path.join(os.tmpdir(), "site-")), r = P.build(out);
  const top = fs.readdirSync(out).sort();
  check("Veröffentlichung: alle in index.html und manifest genannten Dateien sind im Ordner", r.missing.length === 0, r.missing);
  check("Veröffentlichung: keine Tests, Dokumente oder Werkzeuge im Ordner", !top.some((f) => /^(tests|docs|tools|node_modules|package|eslint|README|CHANGELOG|THIRD_PARTY)/.test(f)), top);
  const sw = fs.readFileSync(path.join(out, "sw.js"), "utf8"); check("Veröffentlichung: Service Worker und Skripte liegen im Ordner", sw.length > 100 && fs.existsSync(path.join(out, "js", "grund.js")));
  fs.rmSync(out, { recursive: true, force: true });
}
done("Unit-Tests");
