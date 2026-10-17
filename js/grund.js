// Schwabensprit – Grundgerüst: Einstellungen, Daten laden, Ort/Radius, Öffnungszeiten, Bausteine, Bereiche (Leiste unten),
// Diagramme, Ortswahl, Statusmeldung, Abruf, Einstellungen, Klicks, Ziehen zum Aktualisieren, Start.
// Alle Teile sind klassische Skripte und teilen sich den globalen Gültigkeitsbereich – Reihenfolge in index.html beachten.

const FUELS = { e5: "Super E5", e10: "Super E10", diesel: "Diesel" };
const WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
// Auf Schwäbisch (abschaltbar unter ⚙): Tipps, Überschriften und kurze Hinweise. say(schwäbisch, hochdeutsch)
const SW = () => store.get("dialect", "1") === "1";
// Kosten einer Tankfüllung inkl. Hin- und Rückfahrt (Fahrstrecke ≈ 1,3 × Luftlinie)
const num = (k, d, lo, hi) => Math.min(hi, Math.max(lo, Number(String(store.get(k, d)).replace(",", ".")) || Number(d)));
const TANK = () => num("tank", "50", 5, 150), CONS = () => num("cons", "7", 2, 30), ROAD = 1.3;
const fillCost = (s, f = fuel) => s[f] * (TANK() + 2 * (s.dist || 0) * ROAD * CONS() / 100);
const say = (schw, hoch) => SW() ? schw : hoch;
// Name des Tankbuch-Bereichs (folgt dem Schwäbisch-Schalter)
const TB_NAME = () => say("Spritbüchle", "Tankbuch");
const WD_LONG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const WD_SCHW = ["Mendig", "Dienschdig", "Mittwoch", "Donnschdig", "Freidig", "Samschdig", "Sonndig"];
// Ersparnis in Brezeln umgerechnet – so versteht's jeder
const brezel = (e) => e >= 8 ? "Des langt für a Vesper – Brezel, Wurscht ond a Schorle."
  : e >= 4 ? "Des langt für zwoi Butterbrezla ond en Kaffee."
  : e >= 1.8 ? "Des isch a Butterbrezel – immerhin!"
  : "Kleinvieh macht au Mischt.";
const TK = "https://creativecommons.tankerkoenig.de/json";
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  getJ(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  setJ(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
// Gerät erkennen: iPhone/iPad, Android oder anderes (Karten-Apps, Installationshinweis)
function platformOf(ua, plat, touch) {
  const ios = /iPhone|iPad|iPod/.test(ua) || (plat === "MacIntel" && touch > 1);   // iPad meldet sich oft als Mac
  const android = !ios && /Android/.test(ua);
  return { ios, android, apple: ios || (!android && /Mac/.test(plat || "")) };
}
const PLAT = platformOf(navigator.userAgent, navigator.platform, navigator.maxTouchPoints || 0);
const isStandalone = () => navigator.standalone === true || ["standalone", "fullscreen", "minimal-ui"].some((m) => matchMedia(`(display-mode: ${m})`).matches);
let fuel = store.get("fuel", "e5");
let onlyOpen = store.get("onlyOpen", "0") === "1";
let evMode = store.get("ev", "0") === "1";   // E-Modus: Ladestationen statt Tankstellen (js/strom.js)
let sortBy = store.get("sortBy", "price");
let viewMode = store.get("viewMode", "list");
// Ort: {mode: "base"|"gps"|"place", baseId?, lat?, lng?, label?}
let loc = store.getJ("loc", { mode: "base", baseId: null });
let radius = Number(store.get("radius", "10"));
let lastPlace = store.getJ("lastPlace", null);

let bases = [], view = null, detailId = null, dataMode = null;

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CHEV = `<svg class="chev" width="8" height="14" viewBox="0 0 8 14"><path d="M1 1l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
const NAV = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.7 2.3a1 1 0 0 0-1.1-.2l-18 8a1 1 0 0 0 .1 1.9l7.4 2 2 7.4a1 1 0 0 0 1.9.1l8-18a1 1 0 0 0-.3-1.2z"/></svg>`;

// Tatsächlich abgerufene Preise (und Belegpreise) genau wie an der Säule: 2,03⁹ €.
// Errechnete Werte (Durchschnitte, Prognosen, Ersparnisse) kaufmännisch auf zwei Stellen: 2,035 → 2,04 €.
const eur2s = (v) => (Math.sign(v) * Math.round(Math.abs(v) * 100 + 1e-6) / 100).toFixed(2).replace(".", ",");
const priceN = (v) => { const s = v.toFixed(3).replace(".", ","); return `${s.slice(0, -1)}<sup>${s.slice(-1)}</sup>`; };
const price = (v) => v == null ? "–" : priceN(v) + "\u00a0€";            // abgerufener Preis, genau
const priceR = (v) => v == null ? "–" : eur2s(v) + "\u00a0€";            // errechneter Wert, gerundet
const eur = (v) => v == null ? "–" : eur2s(v) + " €";
const eurX = (v) => v == null ? "–" : v.toFixed(3).replace(".", ",") + " €";
const ct = (v) => (v > 0.0005 ? "+" : v < -0.0005 ? "−" : "±") + Math.abs(v * 100).toFixed(1).replace(".", ",") + " ct";
const km = (d) => d == null ? "" : d.toFixed(1).replace(".", ",") + " km";
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const fmtTime = (d) => d.toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const ago = (iso) => {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return "gerade eben";
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.round(m / 60);
  return h < 24 ? `vor ${h} Std.` : fmtTime(new Date(iso));
};
const toast = (msg, ms = 3500) => {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t); if (ms) toast._t = setTimeout(() => t.classList.remove("show"), ms);
};
const distKm = (a, b, c, d) => {
  const p = Math.PI / 180, x = Math.sin((c - a) * p / 2) ** 2 + Math.cos(a * p) * Math.cos(c * p) * Math.sin((d - b) * p / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
};

// ---- Datenquelle: dieselbe Webseite (öffentliches Repo) oder privates Repo über die GitHub-API
function defaultRepo() {
  const fixed = document.querySelector('meta[name="data-repo"]')?.content;
  if (fixed) return fixed;
  const m = location.hostname.match(/^([^.]+)\.github\.io$/);
  const seg = location.pathname.split("/").filter(Boolean)[0];
  return m && seg ? `${m[1]}/${seg.replace(/-app$/, "")}` : "";
}
const repo = () => store.get("repo", "") || defaultRepo();
const token = () => store.get("token", "");
let dataRef = "app-daten";
if (store.get("dataMode", "") === "api") dataMode = "api";   // gemerkt: beim Start nicht erst neben der App suchen
// ---- Zwischenspeicher auf dem Gerät (IndexedDB, getrennt vom Spritbüchle): letzter Preisstand und letzte Ladestationen –
// für den Sofortstart und, wenn kein Netz da ist. Enthält keine Zugangsdaten und keine Standortverläufe.
const kv = (() => {
  let p = null;
  const open = () => p ||= new Promise((res, rej) => {
    const r = indexedDB.open("schwabensprit-cache", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => { const db = r.result; db.onclose = db.onversionchange = () => { p = null; try { db.close(); } catch {} }; res(db); };
    r.onerror = () => { p = null; rej(r.error); };
  });
  const run = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction("kv", mode), req = fn(t.objectStore("kv")); t.oncomplete = () => res(req?.result); t.onerror = t.onabort = () => rej(t.error); }); };
  return { get: (k) => run("readonly", (s) => s.get(k)).catch(() => undefined), set: (k, v) => run("readwrite", (s) => s.put(v, k)).catch(() => {}), clear: () => run("readwrite", (s) => s.clear()).catch(() => {}) };
})();
const CACHE_PATHS = /^data\/(bases\.json|[^/]+\/(latest|forecast|history|changes)\.json)$/;
let cachedAt = 0;   // ≠ 0: die gerade geladenen Preise stammen aus dem Zwischenspeicher (kein Netz) – Zeitpunkt der Speicherung
async function fetchData(path, asText = false) {
  try {
    const d = await fetchDataNet(path, asText);
    if (!asText && CACHE_PATHS.test(path)) kv.set("d:" + path, { at: Date.now(), d });
    return d;
  } catch (e) {
    // kein Netz / Dienst gestört: zuletzt gespeicherten Stand nehmen (nicht bei „Schlüssel ungültig“)
    if (!e.setup && !asText && CACHE_PATHS.test(path)) { const c = await kv.get("d:" + path); if (c?.d) { cachedAt = cachedAt ? Math.min(cachedAt, c.at) : c.at; return c.d; } }
    throw e;
  }
}
async function fetchDataNet(path, asText = false) {
  if (dataMode !== "api") {
    const r = await fetchT(`${path}?t=${Date.now()}`, 15000, { cache: "no-store" });
    if (r.ok) return asText ? r.text() : r.json();
    if (dataMode === "web" || r.status !== 404) throw new Error(r.status);
  }
  if (!token() || !repo()) throw Object.assign(new Error("setup"), { setup: true });
  // Aufbereitete Daten liegen auf dem Zweig „app-daten“ (ein Stand ohne Verlauf); Rückfall auf „main“
  let r;
  for (const ref of [...new Set([dataRef, "app-daten", "main"])]) {
    // ohne Zeitstempel in der Adresse: „no-store“ verhindert alte Daten, und die Vorab-Prüfung (CORS) bleibt zwischengespeichert
    r = await fetchT(`https://api.github.com/repos/${repo()}/contents/docs/${path}?ref=${ref}`, 20000, {
      headers: { Authorization: `Bearer ${token()}`, Accept: "application/vnd.github.raw+json" }, cache: "no-store",
    });
    if (r.ok) { if (path === "data/bases.json") dataRef = ref; break; }
    if (r.status !== 404) break;
  }
  if (r.status === 401 || r.status === 403) throw Object.assign(new Error("Schlüssel ungültig oder ohne Leserecht"), { setup: true });
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  if (dataMode !== "api") { dataMode = "api"; store.set("dataMode", "api"); }
  return asText ? r.text() : r.json();
}
async function loadBases() {
  try { bases = await fetchData("data/bases.json"); if (dataMode !== "api") dataMode = "web"; }
  catch (e) { if (e.setup || !bases.length) bases = []; throw e; }
}

// ---- Ort & Quelle bestimmen
function center() {
  if (loc.mode === "base") {
    const b = bases.find((x) => x.id === loc.baseId) || bases[0];
    return b ? { lat: b.lat, lng: b.lng, label: (b.name + b.place).length <= 20 ? `${b.name} · ${b.place}` : b.name } : null;
  }
  return loc.lat != null ? { lat: loc.lat, lng: loc.lng, label: loc.label } : null;
}
// Base, die den Kreis (Mittelpunkt + Radius) komplett abdeckt -> sonst live oder teilweise
function pickSource(c) {
  const cover = bases.map((b) => ({ b, d: distKm(c.lat, c.lng, b.lat, b.lng) }))
    .filter((x) => x.d + radius <= x.b.radius_km + 0.1).sort((x, y) => x.d - y.d);
  if (cover.length) return { type: "base", base: cover[0].b };
  if (store.get("tk", "")) return { type: "live" };
  const near = bases.map((b) => ({ b, d: distKm(c.lat, c.lng, b.lat, b.lng) })).sort((x, y) => x.d - y.d)[0];
  return near && near.d < near.b.radius_km + radius ? { type: "partial", base: near.b } : { type: "none" };
}

function getPosition() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error("Standort wird nicht unterstützt"));
    navigator.geolocation.getCurrentPosition((p) => res(p.coords), (e) =>
      rej(new Error(e.code === 1 ? `Standortfreigabe abgelehnt – in den ${PLAT.ios ? "iPhone" : "Geräte"}-Einstellungen für ${PLAT.android ? "den Browser" : "diese App bzw. Safari"} erlauben` : "Standort nicht verfügbar")),
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 15000 });
  });
}

// ---- Laden
const baseCache = {};
async function loadBaseData(b) {
  const [latest, reports] = await Promise.all([fetchData(`data/${b.id}/latest.json`), fetchData(`data/${b.id}/reports.json`).catch(() => [])]);
  // gleicher Datenstand: Verlauf, Änderungen und Prognose behalten (sonst fehlen 12-Uhr-Karte und Prognose bis zum nächsten Abruf)
  const old = baseCache[b.id], same = !!old?.history && old.history.updated === latest.updated;
  baseCache[b.id] = { latest, reports, history: same ? old.history : null, changes: same ? old.changes : null, forecast: same ? old.forecast : null };
  return baseCache[b.id];
}
async function loadHistory() {
  if (!view?.base) return null;
  const c = baseCache[view.base.id], id = view.base.id;
  if (!c) return null;
  // nur eine Abfrage gleichzeitig (Startseite und Detailansicht fragen beide)
  if (!c.history) await (c.histP ||= Promise.all([
    fetchData(`data/${id}/history.json`).catch(() => ({ ts: [], stations: {}, prev: {} })),
    fetchData(`data/${id}/changes.json`).catch(() => null),
    fetchData(`data/${id}/forecast.json`).catch(() => null),
  ]).then(([h, ch, fc]) => { c.history = h; c.changes = ch; c.forecast = fc; }));
  return c.history;
}

// Live-Abfrage bei Tankerkönig (höchstens alle 5 Minuten je Ort/Radius)
async function loadLive(c, force) {
  const key = `${c.lat.toFixed(3)},${c.lng.toFixed(3)},${radius}`;
  const cache = store.getJ("liveCache", {});
  if (!force && cache.key === key && Date.now() - cache.at < 5 * 60000) return cache.data;
  if (tkWait() > 0) {   // Tankerkönig: höchstens eine list.php-Abfrage pro Minute (app-weit)
    if (cache.key === key) return cache.data;
    throw new Error(`Tankerkönig erlaubt nur eine Abfrage pro Minute – in ${Math.ceil(tkWait() / 1000)} s nochmal ziehen`);
  }
  tkMark();
  const r = await fetchT(`${TK}/list.php?lat=${c.lat.toFixed(3)}&lng=${c.lng.toFixed(3)}&rad=${radius}&sort=dist&type=all&apikey=${encodeURIComponent(store.get("tk", ""))}`);
  const d = await r.json();
  if (!d.ok) throw new Error(d.message || "Tankerkönig-Fehler");
  const data = { updated: new Date().toISOString(), stations: d.stations.map((s) => ({
    id: s.id, ...niceStation(s), lat: s.lat, lng: s.lng, open: !!s.isOpen,
    e5: s.e5 || null, e10: s.e10 || null, diesel: s.diesel || null, hours: hoursCache()[s.id]?.h ?? null,
  })) };
  store.setJ("liveCache", { key, at: Date.now(), data });
  return data;
}
const BRAND = { ARAL: "Aral", ESSO: "Esso", AVIA: "Avia", "AVIA XPRESS": "Avia XPress", "AGIP ENI": "Eni" };
function tidy(t) {
  t = (t || "").trim();
  const up = (t.match(/[A-ZÄÖÜ]/g) || []).length, lo = (t.match(/[a-zäöüß]/g) || []).length;
  if (up > Math.max(3, lo)) t = t.toLowerCase().replace(/(^|[\s\-./(])(\S)/g, (m, a, b) => a + b.toUpperCase());
  return t.replace(/strasse\b/g, "straße").replace(/Strasse\b/g, "Straße");
}
function niceStation(s) {
  let brand = (s.brand || s.name || "Tankstelle").trim();
  if (/^freie tankstelle/i.test(brand)) brand = "Freie Tankstelle";
  brand = BRAND[brand.toUpperCase()] || brand;
  const house = String(s.houseNumber || "").replace(/\s*\([^)]*$/, "").trim();
  return { brand, street: [tidy(s.street), house].filter(Boolean).join(" "), place: tidy(s.place).replace(/^Goeppingen$/, "Göppingen") };
}
const hoursCache = () => store.getJ("hoursCache", {});
async function liveHours(s) {
  const c = hoursCache();
  if (c[s.id] && Date.now() - c[s.id].at < 7 * 864e5) return c[s.id].h;
  const r = await fetch(`${TK}/detail.php?id=${s.id}&apikey=${encodeURIComponent(store.get("tk", ""))}`);
  const d = await r.json();
  if (!d.ok) throw new Error(d.message);
  const st = d.station || {};
  const h = { wholeDay: !!st.wholeDay, overrides: (st.overrides || []).slice(0, 5).map(String),
    slots: (st.openingTimes || []).map((o) => ({ text: o.text, start: (o.start || "").slice(0, 5), end: (o.end || "").slice(0, 5), days: parseDays(o.text) })) };
  c[s.id] = { at: Date.now(), h }; store.setJ("hoursCache", c);
  return h;
}
function parseDays(text) {
  let t = (text || "").toLowerCase().replace(/ä/g, "ae");
  if (/taeglich|durchgehend/.test(t) || /mo-so/.test(t.replace(/[\s.]/g, ""))) return /aus/.test(t) && /sonn/.test(t) ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6];
  if (/werktag/.test(t)) return [0, 1, 2, 3, 4, 5];
  const tok = [["montag", 0], ["dienstag", 1], ["mittwoch", 2], ["donnerstag", 3], ["freitag", 4], ["samstag", 5], ["sonnabend", 5], ["sonntag", 6], ["sonn", 6], ["mo", 0], ["di", 1], ["mi", 2], ["do", 3], ["fr", 4], ["sa", 5], ["so", 6]];
  const found = [];
  for (const [w, d] of tok) for (const m of t.matchAll(new RegExp(`\\b${w}`, "g")))
    if (!found.some((f) => m.index >= f[0] && m.index < f[1])) found.push([m.index, m.index + w.length, d]);
  if (!found.length) return null;
  found.sort((a, b) => a[0] - b[0]);
  const days = new Set();
  found.forEach(([, b, d], i) => {
    days.add(d);
    if (i + 1 < found.length && /^[\s.]*(-|–|bis)[\s.]*$/.test(t.slice(b, found[i + 1][0])))
      for (let k = d; k !== found[i + 1][2]; k = (k + 1) % 7) days.add(k);
  });
  return [...days].sort();
}

// Lädt alles für den aktuellen Ort und baut die Ansicht
// liveForce: Live-Preise trotz 5-Minuten-Zwischenspeicher neu holen (nur bei ausdrücklichem Aktualisieren)
let loadSeq = 0, loadAt = 0;
// Ansicht aus Standort, Quelle und Daten bauen (für den Sofortstart und die normale Ladung)
function buildView(c, src, data, reports) {
  const stations = data.stations
    .map((s) => ({ ...s, dist: s.lat != null ? distKm(c.lat, c.lng, s.lat, s.lng) : null }))
    .filter((s) => s.dist == null || s.dist <= radius + 0.05);
  return { center: c, src, base: src.base, live: src.type === "live", updated: data.updated, stations, reports, deferred: !!data.deferred };
}
// Sofortstart: noch bevor das Netz antwortet, den zuletzt gespeicherten Stand zeigen (nur Basis-Daten; Live-Preise nie aus dem Speicher)
async function instantView(seq) {
  if (view || seq !== loadSeq || tab === "tankbuch" || (evMode && (tab === "preise" || tab === "verlauf"))) return;
  const cb = await kv.get("d:data/bases.json");
  if (!cb?.d?.length || view || seq !== loadSeq) return;
  const had = bases;
  bases = bases.length ? bases : cb.d;
  const c = center();
  if (!c) { bases = had; return; }
  const src = pickSource(c);
  if (src.type !== "base") { bases = had; return; }
  const cl = await kv.get(`d:data/${src.base.id}/latest.json`);
  if (!cl?.d?.stations || view || seq !== loadSeq) { bases = had; return; }
  const id = src.base.id;
  baseCache[id] ||= { latest: cl.d, reports: [], history: null, changes: null, forecast: null };
  view = { ...buildView(c, src, cl.d, []), cachedAt: cl.at };
  render();
  // „Wann tanken?“, Verlauf und Prognose ebenfalls sofort – nur wenn sie zum gespeicherten Preisstand gehören
  const [h, ch, fc] = await Promise.all(["history", "changes", "forecast"].map((n) => kv.get(`d:data/${id}/${n}.json`)));
  const bc = baseCache[id];
  if (h?.d && h.d.updated === cl.d.updated && bc && !bc.history && view?.cachedAt) {
    Object.assign(bc, { history: h.d, changes: ch?.d ?? null, forecast: fc?.d ?? null });
    renderAnalysis();
  }
}
async function load(force = false, liveForce = force) {
  const seq = ++loadSeq; loadAt = Date.now(); cachedAt = 0;
  if (!view) instantView(seq);
  if (evMode && force) Strom.invalidate();   // überholte Ladungen (z. B. langsamer Standort) dürfen nichts mehr ändern
  if (force) healthAt = 0;
  if (view && !view.error) $("#main").classList.add("busy");
  const gpsP = loc.mode === "gps" ? getPosition().then((p) => ({ p }), (e) => ({ e })) : null;   // Standort parallel zu den Daten
  // Preise der zuletzt gewählten Base gleich mit der Base-Liste anfragen (spart beim Start eine Runde)
  const preId = loc.mode === "base" && loc.baseId && !baseCache[loc.baseId] ? loc.baseId : null;
  const preP = preId ? loadBaseData({ id: preId }).catch(() => null) : null;
  try {
    if (!bases.length || force) await loadBases();
  } catch (e) {
    if (seq !== loadSeq) return;
    view = { error: e, bases: bases.length };
    return render();
  }
  if (seq !== loadSeq) return;
  if (loc.mode === "base" && !bases.find((b) => b.id === loc.baseId)) loc = { mode: "base", baseId: bases[0]?.id };
  if (loc.mode === "gps" && gpsP) {
    const g = await gpsP;
    if (seq !== loadSeq) return;
    if (g.p) loc = { mode: "gps", lat: g.p.latitude, lng: g.p.longitude, label: "Mein Standort" };
    else { toast(g.e.message, 5000); if (loc.lat == null) loc = { mode: "base", baseId: bases[0]?.id }; }
  }
  // Standort nur auf ca. 100 m gerundet speichern (der genaue Wert bleibt nur im Arbeitsspeicher)
  store.setJ("loc", loc.mode === "gps" ? { ...loc, lat: +loc.lat.toFixed(3), lng: +loc.lng.toFixed(3) } : loc);
  const c = center();
  if (!c) { view = { error: new Error("Keine Bases konfiguriert") }; return render(); }
  const src = pickSource(c);
  try {
    let data, reports = [];
    // Live-Preise nur holen, wenn Preise/Verlauf sie zeigen – sonst später beim Wechsel dorthin
    if (src.type === "live") data = (tab === "preise" || tab === "verlauf") && !evMode ? await loadLive(c, liveForce) : { updated: null, stations: [], deferred: true };
    else if (src.base) {
      if (preP && src.base.id === preId) await preP;
      const bc = baseCache[src.base.id];   // laut bases.json unverändert: nicht neu laden
      ({ latest: data, reports } = bc?.latest && src.base.updated && bc.latest.updated === src.base.updated ? bc : await loadBaseData(src.base));
    } else data = { updated: null, stations: [] };
    if (seq !== loadSeq) return;
    view = buildView(c, src, data, reports);
    if (cachedAt && src.type === "base") { view.cachedAt = cachedAt; toast(say("Koi Netz – i zeig dr letschde gspeicherte Stand.", "Kein Netz – gezeigt wird der zuletzt gespeicherte Stand."), 4500); }
  } catch (e) {
    if (seq !== loadSeq) return;
    view = { center: c, src, error: e };
  }
  render();
  if (detailId) renderDetail();
  if (view.stations) preloadLogos(view.stations);
  if (view.base && !view.error) loadHistory().then(() => { renderAnalysis(); if (detailId) renderDetail(); });
}

const byId = (id) => view?.stations?.find((s) => s.id === id);

// ---- Öffnungszeiten
const toMin = (hm) => { const [h, m] = String(hm).split(":").map(Number); return h * 60 + (m || 0); };
const fmtHM = (m) => m >= 1440 ? "24:00" : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
function schedule(s, now = new Date()) {
  const H = s.hours;
  if (!H) return null;
  if (H.wholeDay) return { open: true, text: "24 h geöffnet", short: "24 h" };
  const slots = (H.slots || []).filter((x) => x.days && x.start && x.end);
  if (!slots.length) return null;
  const wd = (now.getDay() + 6) % 7, t = now.getHours() * 60 + now.getMinutes();
  const iv = (d) => slots.filter((x) => x.days.includes(d)).map((x) => {
    const a = toMin(x.start); let b = toMin(x.end); if (b <= a) b += 1440; return [a, b];
  });
  for (const [a, b] of iv(wd)) if (t >= a && t < b) {
    if (b - a >= 1440) return { open: true, text: "24 h geöffnet", short: "24 h" };
    return { open: true, text: `geöffnet bis ${fmtHM(b % 1440 || 1440)}`, short: `bis ${fmtHM(b % 1440 || 1440)}` };
  }
  for (const [a, b] of iv((wd + 6) % 7)) if (b > 1440 && t < b - 1440)
    return { open: true, text: `geöffnet bis ${fmtHM(b - 1440)}`, short: `bis ${fmtHM(b - 1440)}` };
  for (let k = 0; k < 7; k++) {
    const d = (wd + k) % 7;
    const st = iv(d).map((x) => x[0]).filter((a) => k > 0 || a > t).sort((x, y) => x - y)[0];
    if (st != null) {
      const when = k === 0 ? `um ${fmtHM(st)}` : k === 1 ? `morgen ${fmtHM(st)}` : `${WD[d]} ${fmtHM(st)}`;
      return { open: false, text: `öffnet ${when}`, short: `öffnet ${when}` };
    }
  }
  return { open: false, text: "", short: "" };
}
// Frische Daten (< 30 Min.) haben Vorrang (kennen Feiertage), sonst zählt der Plan.
function state(s) {
  const sch = schedule(s);
  const fresh = view?.updated && Date.now() - new Date(view.updated) < 30 * 60000;
  // frisch, aber laut Plan seit dem Abruf auf- oder zugemacht (z. B. Abruf 21:52, Schluss 22:00): dann gilt der Plan
  const flip = sch && fresh && schedule(s, new Date(view.updated))?.open !== sch.open;
  const open = !sch || (fresh && !flip) ? s.open : sch.open;
  return { open, text: sch && sch.open === open ? sch.text : "", short: sch && sch.open === open ? sch.short : "" };
}
const hasPrice = (s, f = fuel) => state(s).open && s[f] != null;

// ---- Bausteine der Darstellung
const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
// Preisniveau je Sorte: blau = günstig, grau = mittel, rot = teuer (±1 ct um den Median im Umkreis)
function levelFn(f = fuel) {
  const med = median((view?.stations || []).filter((s) => hasPrice(s, f)).map((s) => s[f]));
  return (s) => !hasPrice(s, f) || med == null ? "off" : s[f] <= med - 0.0095 ? "lo" : s[f] >= med + 0.0095 ? "hi" : "mid";
}
const initials = (b) => {
  const w = String(b || "").replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter(Boolean);
  if (!w.length) return "?";
  return (w.length > 1 ? w[0][0] + w[1][0] : w[0].length <= 3 ? w[0] : w[0][0]).toUpperCase();
};
// Marken-Logos: Website-Symbol der Marke über Googles Icon-Dienst (es wird nur die Domain der
// Marke übertragen). Beim Laden einmal vorgeladen und je Marke gemerkt; ohne brauchbares Logo
// bleibt das Kürzel.
const LOGO_DOMAIN = {
  ARAL: "aral.de", SHELL: "shell.de", ESSO: "esso.de", ENI: "eni.com", AVIA: "avia.de", "AVIA XPRESS": "avia.de",
  JET: "jet-tankstellen.de", TOTALENERGIES: "totalenergies.de", TOTAL: "totalenergies.de", HEM: "hem-tankstelle.de",
  BFT: "bft.de", ORLEN: "orlen.de", "ORLEN EXPRESS": "orlen.de", OMV: "omv.de", STAR: "star.de",
  WESTFALEN: "westfalen.com", Q1: "q1.eu", HOYER: "hoyer.de", TAMOIL: "tamoil.de",
};
const logoKey = (b) => String(b || "").trim().toUpperCase();
const logoUrl = (k) => `https://www.google.com/s2/favicons?domain=${LOGO_DOMAIN[k]}&sz=64`;
const logos = store.getJ("logos", {});   // Marke -> { ok: 1|0, t: Zeitpunkt }
const logoInner = (k, t) => `<img src="${logoUrl(k)}" alt="" decoding="async" data-t="${esc(t)}">`;
// Logo nicht ladbar → Kürzel statt Bild (Fehlerereignisse steigen nicht auf: im Erfassen-Modus abfangen; ohne Inline-Handler wegen der CSP)
document.addEventListener("error", (e) => { const i = e.target; if (i?.tagName === "IMG" && i.dataset?.t != null) { i.parentNode?.classList.remove("haslogo"); i.replaceWith(i.dataset.t); } }, true);
function preloadLogos(stations) {
  const todo = new Set(stations.map((s) => logoKey(s.brand)).filter((k) => LOGO_DOMAIN[k]
    && !(logos[k] && (logos[k].ok || Date.now() - logos[k].t < 7 * 864e5))));   // Fehlschläge nach 7 Tagen neu versuchen
  for (const k of todo) {
    const img = new Image();
    const done = (ok) => {
      logos[k] = { ok: ok ? 1 : 0, t: Date.now() }; store.setJ("logos", logos);
      if (ok) document.querySelectorAll(`.badge[data-logo="${CSS.escape(k)}"]:not(.haslogo)`).forEach((el) => {
        el.classList.add("haslogo"); el.innerHTML = logoInner(k, el.textContent);
      });
    };
    img.onload = () => done(img.naturalWidth >= 32);   // Platzhalter-Weltkugel (16 px) zählt nicht
    img.onerror = () => done(false);
    img.src = logoUrl(k);
  }
}
const badge = (s, lv = "mid", cls = "") => {
  const t = initials(s?.brand), k = logoKey(s?.brand), has = LOGO_DOMAIN[k] && logos[k]?.ok;
  return `<div class="badge lv-${lv}${t.length > 2 ? " t3" : ""}${has ? " haslogo" : ""}${cls ? " " + cls : ""}"${LOGO_DOMAIN[k] ? ` data-logo="${esc(k)}"` : ""} aria-hidden="true">${has ? logoInner(k, t) : esc(t)}</div>`;
};
const pill = (d, text, cls = "") => `<span class="pill ${d < -0.0005 ? "lo" : d > 0.0005 ? "hi" : ""} ${cls}"><i></i>${text}</span>`;
const eur2 = (v) => eur2s(v) + " €";
const dayLabel = (t) => new Date(t).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
const CLOCK = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;
const LV_LEGEND = `<div class="lvlegend"><span><i style="background:var(--lo)"></i>günstig</span><span><i style="background:var(--mid)"></i>mittel</span><span><i style="background:var(--hi)"></i>teuer</span><span>± 1 ct zum Median</span></div>`;
// Jede Grafik bekommt eine Tabelle als gleichwertige Alternative
const tbl = (head, rows) => rows.length ? `<details class="tbl"><summary>Werte als Tabelle</summary><table><tr>${head.map((x) => `<th>${x}</th>`).join("")}</tr>${rows.map((r) => `<tr>${r.map((x) => `<td>${x}</td>`).join("")}</tr>`).join("")}</table></details>` : "";
const dailyRows = (pts) => {
  const days = {};
  pts.forEach(([t, v]) => { (days[new Date(t).toDateString()] ||= { t, vs: [] }).vs.push(v); });
  return Object.values(days).map(({ t, vs }) => [dayLabel(t), eur(mean(vs)), eur(Math.min(...vs)), eur(Math.max(...vs))]);
};

const qlabel = (q) => { const f = (m) => `${Math.floor(m / 60) % 24}:${String(m % 60).padStart(2, "0")}`; return `${f(q * 15)}–${f(q * 15 + 15)}`; };
const joinDe = (a) => a.length > 1 ? `${a.slice(0, -1).join(", ")} und ${a[a.length - 1]}` : a.join("");
function changeCard(c, title, sub) {
  if (!c || c.n < 5) return "";
  const rows = c.up.map((u, h) => [`${h}–${h + 1} Uhr`, u, c.down[h]]).filter((r) => r[1] || r[2]);
  return `<div class="card chartcard"><div class="t">${title}</div><div class="s">${sub}</div>${upDownChart(c.up, c.down)}
    <div class="legend"><span><i class="kr" style="background:var(--hi)"></i>Erhöhungen</span><span><i class="kr" style="background:var(--lo)"></i>Senkungen</span></div>
    <div class="facts">
      ${c.topUp.length ? `<div><span class="arw hi">▲</span> Erhöhungen meist <b>${joinDe(c.topUp.map(qlabel))} Uhr</b>${c.avgUp ? ` · Ø ${ct(c.avgUp)}` : ""}</div>` : ""}
      ${c.topDown.length ? `<div><span class="arw lo">▼</span> Senkungen meist <b>${joinDe(c.topDown.map(qlabel))} Uhr</b>${c.avgDown ? ` · Ø ${ct(c.avgDown)}` : ""}</div>` : ""}
      <div class="sub">Zugeordnet nach der Mitte des Zeitraums zwischen zwei Abrufen · ${c.n} Änderungen beobachtet · Ø ${c.perDay.toFixed(1).replace(".", ",")} pro Tankstelle und Tag</div>
    </div>
    ${tbl(["Uhrzeit", "▲ Erhöhungen", "▼ Senkungen"], rows)}</div>`;
}

// ---- Bereiche (Leiste unten): Preise, Route, Verlauf, Tankbuch
const TABS = ["preise", "route", "verlauf", "tankbuch"];
let tab = TABS.includes(store.get("tab", "")) ? store.get("tab", "") : "preise";
// Start über eine Verknüpfung (Android: Symbol lange drücken): ?tab=route, ?ev=1 (Ladestationen), ?ev=0 (Sprit)
{
  const q = new URLSearchParams(location.search);
  if (TABS.includes(q.get("tab"))) { tab = q.get("tab"); store.set("tab", tab); }
  if (q.has("ev")) { evMode = q.get("ev") === "1"; store.set("ev", evMode ? "1" : "0"); }
  if (q.has("tab") || q.has("ev")) try { history.replaceState(null, "", location.pathname + location.hash); } catch {}
}
let showAll = false;          // Tankstellenliste: Top 10 oder alle
const LIST_TOP = 10, LIST_MAX = 60;
// Zurück-Taste/-Geste (Android, Safari): aus einem Bereich erst zurück zu „Preise“, dann erst raus aus der App.
// Dafür liegt beim Wechsel weg von „Preise“ ein Eintrag {t:1} im Verlauf.
const tabState = () => { try { return history.state?.t === 1; } catch { return false; } };
function setTab(t, fromPop) {
  if (!TABS.includes(t)) return;
  if (t === tab) return window.scrollTo({ top: 0, behavior: "smooth" });   // nochmal tippen: nach oben
  tab = t; store.set("tab", t);
  if (!fromPop) try {
    if (t !== "preise" && !tabState()) history.pushState({ t: 1 }, "");
    else if (t === "preise" && tabState()) history.back();
  } catch {}
  if (view?.deferred && (t === "preise" || t === "verlauf")) load();   // Live-Preise erst jetzt holen
  render(); window.scrollTo(0, 0);
  if (t === "tankbuch") tbRecompute(false);
}

// ---- Darstellung
function render() {
  document.body.dataset.tab = tab;
  document.querySelectorAll(".tbname").forEach((e) => { e.textContent = TB_NAME(); });
  document.querySelectorAll("#tabbar button").forEach((b) => {
    const on = b.dataset.tab === tab;
    b.classList.toggle("on", on); on ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current");
  });
  document.querySelectorAll("#seg button").forEach((b) => { const on = evMode ? b.dataset.f === "ev" : b.dataset.f === fuel; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
  const c = view?.center || (evMode ? center() : null);
  $("#locLabel").textContent = c ? `${c.label} · ${evMode ? Math.min(radius, Strom.MAX_KM) : radius} km` : "Ort wählen";
  const st = $("#stand");
  if (evMode && tab !== "tankbuch" && tab !== "route") st.innerHTML = "";   // Stand der Ladedaten setzt js/strom.js
  else if (view?.updated) {
    const age = (Date.now() - new Date(view.updated)) / 60000;
    st.className = "stand" + (age < 20 ? " fresh" : age > 35 ? " old" : "");
    st.innerHTML = `<i></i>${view.live ? "Live · " : ""}${view.cachedAt ? "Gespeichert · " : ""}Stand ${esc(ago(view.updated))}`;
  } else st.innerHTML = "";
  const main = $("#main");
  main.classList.remove("busy");
  // Das Tankbuch liegt auf dem Gerät und braucht keine Preisdaten
  if (tab === "tankbuch") { main.innerHTML = `<div id="tbBody"></div>`; return renderTankbuch(); }
  // Die Route braucht nur die Bases (Preise am Weg lädt sie selbst)
  if (tab === "route") return Route.render();
  // E-Modus: Ladestationen statt Tankstellen – braucht keine Preisdaten von GitHub
  if (evMode && (tab === "preise" || tab === "verlauf")) return Strom.render(tab);
  if (!view) return;
  if (view.error) {
    main.innerHTML = view.error.setup
      ? `<div class="card empty"><div class="bigic">🔑</div><b>Noch nicht eingerichtet</b><p>Trage deinen GitHub-Zugangsschlüssel ein, dann erscheinen hier die Preise.</p><button class="btn" id="btnSetup">Einrichten</button></div>`
      : `<div class="card empty"><div class="bigic">⚠️</div><b>Daten konnten nicht geladen werden</b><p>${esc(view.error.message)} – zum Neuladen nach unten ziehen.</p></div>`;
    return;
  }
  if (view.deferred) { main.innerHTML = `<div class="skel" style="height:268px;margin-top:6px"></div><div class="skel" style="height:320px"></div>`; return; }
  main.innerHTML = tab === "verlauf" ? verlaufHtml() : preiseHtml();
  if (tab === "preise") {
    renderFavs();
    Witz.render();
    checkHealth();
    if (viewMode === "map" && view.stations.length) mountMap();
  }
  renderAnalysis();
}

// ---- Diagramme: schmale Marken, Haarlinien, Hover/Tipp-Tooltip, jede Grafik mit Tabelle
const CH = {};
let chSeq = 0;
let chPrune = 0;
const chartBox = (svg, data) => {
  const id = "c" + ++chSeq; CH[id] = data;
  // später (die Grafik ist dann eingefügt) die Daten nicht mehr angezeigter Grafiken freigeben
  chPrune ||= setTimeout(() => { chPrune = 0; for (const k in CH) if (!document.querySelector(`[data-cid="${k}"]`)) delete CH[k]; }, 1500);
  return `<div class="cw" data-cid="${id}">${svg}<div class="tt" hidden></div></div>`;
};
const fmtNum = (v, d = 2) => v.toFixed(d).replace(".", ",");
function barPath(x, y0, w, h, up) {
  const r = Math.min(4, h, w / 2);
  if (up) { const y = y0 - h; return `M${x},${y0}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y0}Z`; }
  const y = y0 + h;
  return `M${x},${y0}V${y - r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y - r}V${y0}Z`;
}

// series: [{ name, pts: [[t, v]], cls: "" | "ref" | "proj", band?: [[t, lo, hi]] }]; erste Reihe = Hauptreihe
function lineChart(series, opts = {}) {
  series = series.filter((x) => x.pts && x.pts.length);
  const main = series[0]?.pts;
  if (!main || main.length < 2) return `<div class="sub">Noch zu wenige Daten.</div>`;
  const W = 340, H = 168, L = 44, R = 10, T = 16, B = 20;
  const all = series.flatMap((x) => [...x.pts, ...(x.band || []).flatMap(([t, a, b]) => [[t, a], [t, b]])]);
  const t0 = Math.min(...all.map((p) => p[0])), t1 = Math.max(...all.map((p) => p[0]));
  let lo = Math.min(...all.map((p) => p[1])), hi = Math.max(...all.map((p) => p[1]));
  const step = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5].find((st) => (hi - lo) / st <= 4) || 1;
  lo = Math.floor(lo / step + 1e-9) * step; hi = Math.ceil(hi / step - 1e-9) * step;
  if (hi - lo < step) hi = lo + step;
  const X = (t) => L + (t - t0) / (t1 - t0 || 1) * (W - L - R);
  const Y = (v) => T + (hi - v) / (hi - lo) * (H - T - B);
  let g = "";
  for (let v = lo; v <= hi + 1e-9; v += step) {
    const y = Y(v).toFixed(1);
    g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text x="${L - 5}" y="${(+y + 3.5).toFixed(1)}" text-anchor="end">${eur2s(v)} €</text>`;
  }
  if (t1 - t0 > 864e5 * 1.2) {
    const d0 = new Date(t0); d0.setHours(24, 0, 0, 0);
    for (let d = d0; d.getTime() < t1; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const x = X(d.getTime()).toFixed(1);
      g += `<line class="gl" x1="${x}" x2="${x}" y1="${T}" y2="${H - B}"/><text x="${(+x + 3).toFixed(1)}" y="${H - 6}">${WD[(d.getDay() + 6) % 7]}</text>`;
    }
  } else {
    const d0 = new Date(t0); d0.setMinutes(0, 0, 0);
    const stepH = Math.max(1, Math.ceil((t1 - t0) / 36e5 / 6));
    for (let d = new Date(d0.getTime() + 36e5); d.getTime() < t1; d = new Date(d.getTime() + stepH * 36e5)) {
      const x = X(d.getTime()).toFixed(1);
      g += `<line class="gl" x1="${x}" x2="${x}" y1="${T}" y2="${H - B}"/><text x="${x}" y="${H - 6}" text-anchor="middle">${d.getHours()} Uhr</text>`;
    }
  }
  g += `<line class="ax" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>`;
  const path = (p) => "M" + p.map(([t, v]) => `${X(t).toFixed(1)},${Y(v).toFixed(1)}`).join("L");
  for (const x of series) if (x.band?.length > 1)
    g += `<path class="band" d="${path(x.band.map(([t, , b]) => [t, b]))}L${x.band.slice().reverse().map(([t, a]) => `${X(t).toFixed(1)},${Y(a).toFixed(1)}`).join("L")}Z"/>`;
  if (series.length === 1 && !series[0].cls) g += `<path class="area" d="${path(main)}L${X(main[main.length - 1][0]).toFixed(1)},${H - B}L${X(main[0][0]).toFixed(1)},${H - B}Z"/>`;
  if (series.some((x) => x.cls === "proj")) {
    const xn = X(Date.now());
    if (xn > L && xn < W - R) g += `<line class="ax" x1="${xn.toFixed(1)}" x2="${xn.toFixed(1)}" y1="${T}" y2="${H - B}"/><text x="${(xn + 3).toFixed(1)}" y="${T - 4}">jetzt</text>`;
  }
  for (const x of [...series].reverse()) if (x.pts.length > 1) g += `<path class="ln ${x.cls || ""}" d="${path(x.pts)}"/>`;
  const [mt, mv] = opts.mark || main[main.length - 1];
  const lx = X(mt), right = lx < L + 60;
  // Tageshöchstwerte beschriften (je Kalendertag der höchste Punkt), ohne den Endwert zu überdecken
  if (opts.peaks) {
    const days = {};
    for (const p of main) (days[new Date(p[0]).toDateString()] ||= []).push(p);
    for (const d of Object.values(days)) {
      const [t, v] = d.reduce((a, b) => b[1] > a[1] ? b : a), mid = median(d.map((p) => p[1]));
      if (d.length < 6 || t === main[0][0] || v - mid < 0.015) continue;   // nur echte Spitzen (≥ 1,5 ct über dem Tagesmittel), nicht am angeschnittenen Rand
      const x = X(t), y = Y(v);
      if (t === mt || (Math.abs(x - lx) < 46 && Math.abs(y - Y(mv)) < 16)) continue;
      g += `<circle class="pk" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5"/><text class="pkl" x="${Math.min(W - R, Math.max(L + 12, x)).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle">${eur2s(v)} €</text>`;
    }
  }
  g += `<circle class="dot" cx="${X(mt).toFixed(1)}" cy="${Y(mv).toFixed(1)}" r="4"/>`;
  g += `<text class="lbl" x="${(right ? lx + 7 : lx - 7).toFixed(1)}" y="${(Y(mv) - 8).toFixed(1)}" text-anchor="${right ? "start" : "end"}">${opts.markLabel || (series[0].exact ? eurX(mv).replace(" ", "\u00a0") : eur2s(mv) + "\u00a0€")}</text>`;
  g += `<line class="xh" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/>`;
  const times = [...new Set(series.flatMap((x) => x.pts.map((p) => p[0])))].sort((a, b) => a - b);
  const maps = series.map((x) => new Map(x.pts.map(([t, v]) => [t, v])));
  return chartBox(`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(series.map((x) => x.name).join(" und "))} im Verlauf">${g}</svg>`, {
    W, xs: times.map(X),
    tip: (i) => ({
      title: fmtTime(new Date(times[i])),
      rows: series.map((x, j) => {
        const v = maps[j].get(times[i]);
        return v == null ? null : { value: x.cls === "proj" ? `≈ ${eurA(v)}` : x.exact ? eurX(v) : eur(v), label: x.name, k: x.cls === "ref" ? "var(--mid)" : "var(--lo)" };
      }).filter(Boolean),
    }),
  });
}

// Abweichung je Stunde: unter der Nulllinie günstiger (blau), darüber teurer (rot)
function devBars(hourAvg, bestHour) {
  const W = 340, H = 170, L = 4, R = 4, T = 18, B = 18, PB = H - B - 14;
  const vals = Array.from({ length: 24 }, (_, i) => hourAvg[i] ?? null);
  const m = Math.max(0.001, ...vals.filter((v) => v != null).map(Math.abs));
  const zero = T + (PB - T) / 2, sc = (PB - T) / 2 / m, slot = (W - L - R) / 24, bw = Math.min(24, slot * 0.64), now = new Date().getHours();
  let g = "";
  const xs = [];
  vals.forEach((v, i) => {
    const cx = L + slot * i + slot / 2;
    xs.push(cx);
    if (v != null && Math.abs(v) * sc >= 0.5) g += `<path class="bar ${v < 0 ? "b-lo" : "b-hi"}" data-i="${i}" d="${barPath(cx - bw / 2, zero, bw, Math.abs(v) * sc, v > 0)}"/>`;
    if (i % 3 === 0) g += `<text x="${cx.toFixed(1)}" y="${H - 4}" text-anchor="middle">${i}</text>`;
  });
  g += `<line class="ax" x1="${L}" x2="${W - R}" y1="${zero}" y2="${zero}"/>`;
  if (bestHour != null && vals[bestHour] != null) {
    const v = vals[bestHour], y = v < 0 ? zero + Math.abs(v) * sc + 12 : zero - Math.abs(v) * sc - 4;
    g += `<text class="lbl" x="${Math.min(Math.max(xs[bestHour], 22), W - 22).toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle">${ct(v)}</text>`;
  }
  g += `<path class="nowm" d="M${(xs[now] - 4).toFixed(1)},${T - 12} h8 l-4,6 z"/>`;
  return chartBox(`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Preisabweichung nach Uhrzeit">${g}</svg>`, {
    W, xs, hl: true,
    tip: (i) => ({
      title: `${i}–${i + 1} Uhr${i === now ? " · jetzt" : ""}`,
      rows: vals[i] == null ? [{ label: "keine Daten" }] : [{ value: ct(vals[i]), label: vals[i] < 0 ? "günstiger als im Tagesmittel" : "teurer als im Tagesmittel", kr: vals[i] < 0 ? "var(--lo)" : "var(--hi)" }],
    }),
  });
}

// 24 Felder als Kurzfassung im Tipp: je kräftiger, desto größer die Abweichung
function stripChart(hourAvg) {
  const W = 340, H = 46, cw = W / 24, now = new Date().getHours();
  const vals = Array.from({ length: 24 }, (_, i) => hourAvg[i] ?? null);
  const m = Math.max(0.001, ...vals.filter((v) => v != null).map(Math.abs));
  let g = "";
  const xs = [];
  vals.forEach((v, i) => {
    const x = i * cw;
    xs.push(x + cw / 2);
    if (v == null) { g += `<rect class="cell" data-i="${i}" x="${(x + 1).toFixed(1)}" y="14" width="${(cw - 2).toFixed(1)}" height="18" rx="3" fill="var(--seg)"/>`; return; }
    const a = 0.2 + 0.8 * Math.min(1, Math.abs(v) / m);
    const col = Math.abs(v) < 0.0015 ? "var(--mid)" : v < 0 ? "var(--lo)" : "var(--hi)";
    g += `<rect class="cell" data-i="${i}" x="${(x + 1).toFixed(1)}" y="14" width="${(cw - 2).toFixed(1)}" height="18" rx="3" fill="${col}" fill-opacity="${a.toFixed(2)}"/>`;
  });
  g += `<path class="nowm" d="M${(xs[now] - 4).toFixed(1)},7 h8 l-4,6 z"/>`;
  [0, 6, 12, 18].forEach((hh) => { g += `<text x="${(hh * cw + 1).toFixed(1)}" y="${H - 2}">${hh}</text>`; });
  g += `<text x="${W}" y="${H - 2}" text-anchor="end">24</text>`;
  return chartBox(`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Preis nach Uhrzeit, Kurzfassung" style="margin-top:12px">${g}</svg>`, {
    W, xs, hl: true,
    tip: (i) => ({
      title: `${i}–${i + 1} Uhr${i === now ? " · jetzt" : ""}`,
      rows: vals[i] == null ? [{ label: "keine Daten" }] : [{ value: ct(vals[i]), label: "ggü. Tagesmittel", kr: vals[i] < 0 ? "var(--lo)" : "var(--hi)" }],
    }),
  });
}

// Erhöhungen nach oben (rot), Senkungen nach unten (blau)
function upDownChart(up, down) {
  const W = 340, H = 170, L = 4, R = 4, T = 16, B = 18, PB = H - B - 14;
  const m = Math.max(1, ...up, ...down);
  const zero = T + (PB - T) / 2, sc = (PB - T) / 2 / m - 0.5 / m, slot = (W - L - R) / 24, bw = Math.min(24, slot * 0.64);
  let g = "";
  const xs = [];
  for (let i = 0; i < 24; i++) {
    const cx = L + slot * i + slot / 2;
    xs.push(cx);
    if (up[i]) g += `<path class="bar b-hi" data-i="${i}" d="${barPath(cx - bw / 2, zero - 1, bw, up[i] * sc, true)}"/>`;
    if (down[i]) g += `<path class="bar b-lo" data-i="${i}" d="${barPath(cx - bw / 2, zero + 1, bw, down[i] * sc, false)}"/>`;
    if (i % 3 === 0) g += `<text x="${cx.toFixed(1)}" y="${H - 4}" text-anchor="middle">${i}</text>`;
  }
  g += `<line class="ax" x1="${L}" x2="${W - R}" y1="${zero}" y2="${zero}"/>`;
  const iu = up.indexOf(Math.max(...up)), id = down.indexOf(Math.max(...down));
  if (up[iu]) g += `<text class="lbl" x="${xs[iu].toFixed(1)}" y="${(zero - 1 - up[iu] * sc - 4).toFixed(1)}" text-anchor="middle">${up[iu]}</text>`;
  if (down[id]) g += `<text class="lbl" x="${xs[id].toFixed(1)}" y="${(zero + 1 + down[id] * sc + 12).toFixed(1)}" text-anchor="middle">${down[id]}</text>`;
  return chartBox(`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Preisänderungen nach Uhrzeit">${g}</svg>`, {
    W, xs, hl: true,
    tip: (i) => ({
      title: `${i}–${i + 1} Uhr`,
      rows: [{ value: String(up[i]), label: "Erhöhungen", kr: "var(--hi)" }, { value: String(down[i]), label: "Senkungen", kr: "var(--lo)" }],
    }),
  });
}

// Tooltip: Fadenkreuz folgt dem Finger/Zeiger zur nächsten Stelle; Texte nur per textContent
function chartAt(e) {
  const cw = e.target.closest?.(".cw");
  if (!cw) return;
  const d = CH[cw.dataset.cid], svg = cw.querySelector("svg");
  if (!d || !svg) return;
  const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * d.W;
  let i = 0;
  d.xs.forEach((px, k) => { if (Math.abs(px - x) < Math.abs(d.xs[i] - x)) i = k; });
  hideTips(cw);
  const xh = svg.querySelector(".xh");
  if (xh) { xh.setAttribute("x1", d.xs[i]); xh.setAttribute("x2", d.xs[i]); xh.setAttribute("visibility", "visible"); }
  svg.querySelectorAll(".hl").forEach((n) => n.classList.remove("hl"));
  if (d.hl) svg.querySelectorAll(`[data-i="${i}"]`).forEach((n) => n.classList.add("hl"));
  const t = d.tip(i), tt = cw.querySelector(".tt");
  tt.replaceChildren();
  const hd = document.createElement("div"); hd.className = "h"; hd.textContent = t.title; tt.append(hd);
  for (const row of t.rows) {
    const rr = document.createElement("div"); rr.className = "r";
    if (row.k || row.kr) {
      const k = document.createElement("span");
      k.className = row.k ? "k" : "kr";
      if (row.k) k.style.borderColor = row.k; else k.style.background = row.kr;
      rr.append(k);
    }
    if (row.value) { const b = document.createElement("b"); b.textContent = row.value; rr.append(b); }
    const l = document.createElement("span"); l.textContent = row.label || ""; rr.append(l);
    tt.append(rr);
  }
  tt.hidden = false;
  const px = d.xs[i] * r.width / d.W, w = tt.offsetWidth;
  tt.style.left = Math.max(w / 2, Math.min(cw.clientWidth - w / 2, px)) + "px";
  tt.style.top = "-8px";
}
function hideTips(except) {
  document.querySelectorAll(".cw").forEach((cw) => {
    if (cw === except) return;
    const tt = cw.querySelector(".tt");
    if (!tt || tt.hidden) return;
    tt.hidden = true;
    cw.querySelector(".xh")?.setAttribute("visibility", "hidden");
    cw.querySelectorAll(".hl").forEach((n) => n.classList.remove("hl"));
  });
}
document.addEventListener("pointermove", (e) => { if (e.target.closest?.(".cw")) chartAt(e); else if (e.pointerType === "mouse") hideTips(); });
document.addEventListener("pointerdown", (e) => { if (e.target.closest?.(".cw")) chartAt(e); else hideTips(); });
window.addEventListener("scroll", () => hideTips(), { passive: true });
$("#detail").addEventListener("scroll", () => hideTips(), { passive: true });

// ---- Route mit Google Maps: App, falls installiert, sonst Browser
let navTo = (u) => { location.href = u; };   // (für Tests austauschbar)
// Android: Maps-App per Intent öffnen; ist sie nicht da, nimmt Chrome die Webadresse (browser_fallback_url)
const mapsIntent = (web) => { const u = new URL(web); return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.google.android.apps.maps;S.browser_fallback_url=${encodeURIComponent(web)};end`; };
function openRoute(s) {
  const dest = s.lat && s.lng ? `${s.lat},${s.lng}` : `${s.street}, ${s.place}`;
  const web = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`;
  if (PLAT.android) return navTo(mapsIntent(web));
  if (!PLAT.ios) return void (window.open(web, "_blank") || navTo(web));
  let left = false;
  const onHide = () => { left = true; };
  document.addEventListener("visibilitychange", onHide, { once: true });
  navTo(`comgooglemaps://?daddr=${encodeURIComponent(dest)}&directionsmode=driving`);
  setTimeout(() => {
    document.removeEventListener("visibilitychange", onHide);
    if (!left && !document.hidden) window.open(web, "_blank") || navTo(web);
  }, 1200);
}
// Android: auch die „Google Maps“-Knöpfe (Links) öffnen die Maps-App
document.addEventListener("click", (e) => {
  if (!PLAT.android || e.defaultPrevented) return;
  const a = e.target.closest?.('a[href^="https://www.google.com/maps/"]');
  if (!a) return;
  e.preventDefault(); navTo(mapsIntent(a.href));
});
// Zweiter Karten-Knopf: Apple Karten auf Apple-Geräten, auf Android „Andere Karten-App“ (geo:, Auswahl aller installierten Navi-Apps)
function mapAlt(appleUrl, s) {
  if (PLAT.apple) return `<a class="btn secondary" href="${esc(appleUrl)}" target="_blank" rel="noopener">Apple Karten</a>`;
  if (!PLAT.android || s.lat == null) return "";
  const ll = `${(+s.lat).toFixed(6)},${(+s.lng).toFixed(6)}`;
  return `<a class="btn secondary" href="geo:${ll}?q=${ll}(${encodeURIComponent(String(s.brand || s.op || "Ziel").replace(/[()]/g, ""))})">Andere Karten-App</a>`;
}

// ---- Ortswahl
function renderLocDialog() {
  $("#locBases").innerHTML = bases.map((b) => `<button class="opt ${loc.mode === "base" && loc.baseId === b.id ? "on" : ""}" data-base="${esc(b.id)}">
    <div class="ic">${esc(b.id)}</div><div class="t"><div>${esc(b.name)}</div><div class="sub">${esc(b.place)} · bis ${b.radius_km} km</div></div><span class="check">✓</span></button>`).join("");
  $("#optGps").classList.toggle("on", loc.mode === "gps");
  $("#optPlace").hidden = !lastPlace;
  if (lastPlace) { $("#placeName").textContent = lastPlace.label; $("#optPlace").classList.toggle("on", loc.mode === "place"); }
  $("#inRadius").value = radius; $("#radiusVal").textContent = `${radius} km`;
}
let locChanged = false;
function setLoc(l) { loc = l; locChanged = true; store.setJ("loc", loc); renderLocDialog(); }
$("#btnLoc").addEventListener("click", () => { locChanged = false; renderLocDialog(); $("#searchResults").innerHTML = ""; $("#dlgLoc").showModal(); });
$("#locBases").addEventListener("click", (e) => { const b = e.target.closest("[data-base]"); if (b) setLoc({ mode: "base", baseId: b.dataset.base }); });
$("#optGps").addEventListener("click", async () => {
  $("#gpsSub").textContent = "Standort wird ermittelt …";
  try {
    const p = await getPosition();
    setLoc({ mode: "gps", lat: p.latitude, lng: p.longitude, label: "Mein Standort" });
    $("#gpsSub").textContent = "per Standortfreigabe";
  } catch (e) { $("#gpsSub").textContent = e.message; }
});
$("#optPlace").addEventListener("click", () => lastPlace && setLoc({ mode: "place", ...lastPlace }));
// Abruf mit Zeitlimit (hängende Mobilverbindung)
// Zeitachsen der Daten (changes.json, forecast.json): Minuten ab „start“ in Ortszeit, wie die Wanduhr –
// über die Zeitumstellung hinweg richtig (der Datenabruf rechnet ebenso)
const wallAt = (start, min) => { const d = new Date(start); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes() + min).getTime(); };
const wallMin = (start, t) => {
  const a = new Date(start), b = new Date(t), u = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
  return (u(b) - u(a)) / 60000;
};
const fetchT = (url, ms = 15000, opts = {}) => {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t));
};
// Tankerkönig: höchstens eine list.php-Abfrage pro Minute – gilt für die ganze App (auch über Neustarts)
const TK_GAP = 60000;
const tkWait = () => Math.max(0, Number(store.get("tkLast", "0")) + TK_GAP - Date.now());
const tkMark = () => store.set("tkLast", String(Date.now()));
// ---- Dienst-Adressen (endpoints.json – austauschbar, ohne den App-Code zu ändern)
const EP_DEFAULT = {
  routing: [{ type: "osrm", name: "FOSSGIS OSRM", url: "https://routing.openstreetmap.de/routed-car/route/v1/driving/" },
    { type: "valhalla", name: "FOSSGIS Valhalla", url: "https://valhalla1.openstreetmap.de/route" }],
  geocode: "https://nominatim.openstreetmap.org/search",
  atPrices: "https://api.e-control.at/sprit/1.0/search/gas-stations/by-address",   // Österreich: E-Control-Spritpreisrechner
  evApi: "https://api.mobidata-bw.de/ocpdb/api/public",                              // Ladestationen und Ladepreise (MobiData BW OCPDB)
};
let epP = null;
const endpoints = () => epP ||= fetchT("endpoints.json", 8000, { cache: "no-cache" }).then((r) => r.ok ? r.json() : {}).catch(() => ({}))
  .then((e) => ({ ...EP_DEFAULT, ...e }));
// Ortssuche (Nominatim): nur auf Knopfdruck, höchstens eine Anfrage pro Sekunde, Treffer zwischengespeichert.
// Preise: nur Deutschland (Tankerkönig); Route: auch die Nachbarländer.
const GEO_DE = "de", GEO_EU = "de,at,ch,li,it,fr,lu,be,nl,dk,pl,cz,sk,hu,si,hr";
const geoCache = new Map();
let geoLast = 0;
async function geoSearch(q, cc = GEO_DE) {
  const k = cc + "|" + q.trim().toLowerCase();
  if (geoCache.has(k)) return geoCache.get(k);
  const wait = geoLast + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  geoLast = Date.now();
  const r = await fetchT(`${(await endpoints()).geocode}?format=jsonv2&countrycodes=${cc}&addressdetails=1&limit=5&accept-language=de&q=${encodeURIComponent(q)}`, 10000);
  if (!r.ok) throw new Error(`Suche ${r.status}`);
  const res = (await r.json()).map((x) => {
    const a = String(x.display_name || "").split(", ");
    // Adresse: „12, Hauptstraße, Ulm …“ → „Hauptstraße 12“
    const c = String(x.address?.country_code || "").toLowerCase();
    return /^\d+\s*[a-z]?$/i.test(a[0]) && a[1] ? { lat: Number(x.lat), lng: Number(x.lon), label: `${a[1]} ${a[0]}`, sub: a.slice(2, 5).join(", "), cc: c }
      : { lat: Number(x.lat), lng: Number(x.lon), label: a[0], sub: a.slice(1, 4).join(", "), cc: c };
  });
  geoCache.set(k, res);
  return res;
}
$("#searchForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = $("#inSearch").value.trim(), btn = $("#searchForm button");
  if (!q || btn.disabled) return;
  btn.disabled = true;
  $("#searchResults").innerHTML = `<div class="sub" style="padding:8px 4px">Suche …</div>`;
  try {
    const res = await geoSearch(q);
    $("#searchResults").innerHTML = res.length ? res.map((x, i) =>
      `<button class="opt" data-hit="${i}"><div class="ic pl">⌖</div><div class="t"><div>${esc(x.label)}</div><div class="sub">${esc(x.sub)}</div></div></button>`).join("")
      : `<div class="sub" style="padding:8px 4px">Nichts gefunden.</div>`;
    $("#searchResults").onclick = (ev) => {
      const b = ev.target.closest("[data-hit]"); if (!b) return;
      const x = res[b.dataset.hit];
      lastPlace = { lat: x.lat, lng: x.lng, label: x.label };
      store.setJ("lastPlace", lastPlace);
      $("#searchResults").innerHTML = ""; $("#inSearch").value = "";
      setLoc({ mode: "place", ...lastPlace });
    };
  } catch { $("#searchResults").innerHTML = `<div class="sub" style="padding:8px 4px">Suche gerade nicht möglich.</div>`; }
  finally { btn.disabled = false; }
});
$("#inRadius").addEventListener("input", (e) => {
  radius = Number(e.target.value); store.set("radius", String(radius));
  $("#radiusVal").textContent = `${radius} km`; locChanged = true;
});
$("#btnLocDone").addEventListener("click", () => $("#dlgLoc").close());
$("#dlgLoc").addEventListener("close", () => { if (locChanged) load(); });

// ---- Statusmeldung: veraltete Daten oder hängende/fehlgeschlagene Läufe bei GitHub
let healthHtml = "", healthAt = 0;
const minsAgo = (iso) => Math.round((Date.now() - new Date(iso)) / 60000);
async function lastRun(repoName, workflow, auth) {
  const r = await fetch(`https://api.github.com/repos/${repoName}/actions/workflows/${workflow}/runs?per_page=3`, {
    headers: { Accept: "application/vnd.github+json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, cache: "no-store",
  });
  if (!r.ok) return null;
  return (await r.json()).workflow_runs || [];
}
function describe(runs, what) {
  if (!runs?.length) return null;
  const run = runs[0], age = minsAgo(run.created_at);
  if (["queued", "waiting", "pending", "requested"].includes(run.status) && age >= 10)
    return `${what} hängt seit ${age} Min. bei GitHub in der Warteschlange.`;
  if (run.status === "in_progress" && age >= 20) return `${what} läuft seit ${age} Min. ungewöhnlich lange.`;
  if (run.status === "completed" && ["failure", "timed_out", "startup_failure"].includes(run.conclusion))
    return `${what} ist um ${hm(new Date(run.updated_at))} Uhr fehlgeschlagen.`;
  if (run.status === "completed" && run.conclusion === "cancelled" && runs[1]?.conclusion !== "success")
    return `${what} wurde bei GitHub abgebrochen (${hm(new Date(run.updated_at))} Uhr).`;
  return null;
}
async function checkHealth(force) {
  if (!view || view.error || view.live) { healthHtml = ""; return; }
  if (!force && Date.now() - healthAt < 120000) return paintHealth();
  healthAt = Date.now();
  const msgs = [];
  const age = view.updated ? minsAgo(view.updated) : null;
  if (age != null && age > 35) msgs.push(`Die Preise sind ${age >= 120 ? `${Math.round(age / 60)} Std.` : `${age} Min.`} alt – normalerweise kommt alle 15 Minuten ein neuer Abruf.`);
  try {
    // Zum Preisabruf nur etwas sagen, wenn die Preise wirklich veraltet sind – eine hängende
    // oder ersetzte Veröffentlichung der Webseite allein ist kein Problem für die App.
    if (age != null && age > 35 && token() && repo()) {
      const m = describe(await lastRun(repo(), "tankpreise.yml", token()), "Der Preisabruf");
      if (m) msgs.push(m);
    }
    const host = location.hostname.match(/^([^.]+)\.github\.io$/), seg = location.pathname.split("/").filter(Boolean)[0];
    if (host && seg && `${host[1]}/${seg}`.toLowerCase() !== repo().toLowerCase()) {
      const m = describe(await lastRun(`${host[1]}/${seg}`, "pages.yml"), "Die Veröffentlichung der neuesten App-Version");
      if (m) msgs.push(m);
    }
  } catch {}
  healthHtml = msgs.length ? `<div class="card notice warnbox"><span class="ic">⚠️</span><div><b>Hinweis zur Aktualisierung</b><br>${msgs.map(esc).join("<br>")}
    <div class="row" style="margin-top:10px"><a class="btn secondary" href="https://github.com/${esc(repo())}/actions" target="_blank" rel="noopener">Bei GitHub ansehen</a>
    ${token() ? `<button class="btn" id="btnRetry">Abruf neu starten</button>` : ""}</div></div></div>` : "";
  paintHealth();
}
function paintHealth() { const el = $("#health"); if (el && el.innerHTML !== healthHtml) el.innerHTML = healthHtml; }
document.addEventListener("click", (e) => { if (e.target.closest("#btnRetry")) { healthAt = 0; dispatch("abrufen"); } });

// ---- Abruf bei GitHub starten (Knopf ↻)
async function dispatch(aktion) {
  if (view?.live) { toast("Live-Preise werden aktualisiert …"); return load(true); }
  if (!repo() || !token()) { openSettings(); return; }
  const btn = $("#btnFetch svg"); btn.classList.add("spin");
  try {
    const r = await fetch(`https://api.github.com/repos/${repo()}/actions/workflows/tankpreise.yml/dispatches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}`, Accept: "application/vnd.github+json" },
      body: JSON.stringify({ ref: "main", inputs: { aktion } }),
    });
    if (r.status !== 204) throw new Error({
      401: "Schlüssel ungültig oder abgelaufen – unter ⚙ neu eintragen",
      403: "Dem Schlüssel fehlt die Berechtigung „Actions: Read and write“",
      404: "Repository nicht gefunden – ist es beim Schlüssel unter „Repository access“ ausgewählt?",
    }[r.status] || `GitHub-Fehler ${r.status}`);
    toast(aktion === "report" ? say("Dr Wochenreport wird gmacht – dauert a Minütle oder zwoi.", "Wochenreport wird erstellt – dauert ca. 1–2 Minuten.")
      : say("Abruf läuft – in 1–2 Minuta gibt's frische Preis.", "Abruf gestartet – neue Preise in ca. 1–2 Minuten."), 0);
    const before = JSON.stringify(bases.map((b) => b.updated)), beforeRep = view?.reports?.length;
    for (let i = 0; i < 24; i++) {
      await new Promise((res) => setTimeout(res, 15000));
      try {
        const b = await fetchData("data/bases.json");
        if (JSON.stringify(b.map((x) => x.updated)) !== before || aktion === "report" && i > 6) { await load(true); toast(aktion === "report" ? say("Sodele, dr Report isch do ✓", "Aktualisiert ✓") : say("Sodele, frische Preis sind do ✓", "Aktualisiert ✓")); return; }
      } catch {}
    }
    toast(say("Des dauert länger als denkt – nochher nomol neu lada.", "Dauert länger als erwartet – später neu laden."), 5000);
  } catch (e) {
    toast("Fehler: " + e.message, 6000);
  } finally { btn.classList.remove("spin"); }
}

function openSettings() {
  $("#inRepo").value = store.get("repo", "") || defaultRepo();
  $("#inToken").value = token();
  $("#inTk").value = store.get("tk", "");
  $("#inDialect").checked = SW();
  $("#inWitz").checked = store.get("witz", "1") === "1";
  $("#inRtKeep").checked = store.get("rtKeep", "1") === "1";
  $("#inTokExp").value = store.get("tokenExp", "");
  $("#inHome").innerHTML = bases.map((b) => `<option value="${esc(b.id)}">${esc(b.name)} · ${esc(b.place)}</option>`).join("");
  if (homeBase()) $("#inHome").value = homeBase().id;
  $("#inTank").value = fmtNum(TANK(), 0);
  $("#inCons").value = fmtNum(CONS(), 1);
  $("#inKwh").value = fmtNum(parseFloat(String(store.get("kwh", "30")).replace(",", ".")) || 30, 0);
  $("#inEvCons").value = fmtNum(parseFloat(String(store.get("evcons", "18")).replace(",", ".")) || 18, 0);
  $("#testOut").innerHTML = "";
  renderInstall();
  $("#dlg").returnValue = "";   // sonst gilt „Wischen/Esc“ nach einem früheren Speichern wieder als Speichern
  $("#dlg").showModal();
}
function saveSettings() {
  store.set("repo", $("#inRepo").value.trim());
  store.set("token", $("#inToken").value.trim());
  store.set("tk", $("#inTk").value.trim());
  store.set("dialect", $("#inDialect").checked ? "1" : "0");
  store.set("witz", $("#inWitz").checked ? "1" : "0");
  store.set("rtKeep", $("#inRtKeep").checked ? "1" : "0");
  if (!$("#inRtKeep").checked) store.set("rtLast", "");
  store.set("tokenExp", $("#inTokExp").value);
  if ($("#inHome").value && $("#inHome").value !== store.get("homeBase", homeBase()?.id || "")) {
    store.set("homeBase", $("#inHome").value);
    tbRecompute(true).then((n) => n && toast(`${TB_NAME()}: ${n} Vergleiche mit der neuen Homebase neu berechnet.`));
  } else if ($("#inHome").value) store.set("homeBase", $("#inHome").value);
  store.set("tank", $("#inTank").value || "50");
  store.set("cons", $("#inCons").value || "7");
  store.set("kwh", $("#inKwh").value || "30");
  store.set("evcons", $("#inEvCons").value || "18");
  dataMode = null; bases = []; store.set("dataMode", "");
}
// Ortsdaten löschen: gesuchte Orte, gemerkte Strecken, letzte Route, Start/Ziel, Live-Zwischenspeicher, Preise-Ort
$("#btnGeoClear").addEventListener("click", () => {
  if (!confirm("Alle gespeicherten Ortsdaten auf diesem Gerät löschen?\n\nZuletzt gesuchte Orte, gemerkte Strecken, letzte Route, Start/Ziel, gesuchter Ort, Live-Zwischenspeicher und gespeicherte Ladestationen.")) return;
  for (const k of ["rtRecent", "rtSaved", "rtLast", "rtA", "rtB", "liveCache", "lastPlace"]) { try { localStorage.removeItem(k); } catch {} }
  kv.clear();   // gespeicherte Ladestationen und Preisdaten (Zwischenspeicher)
  lastPlace = null;
  if (loc.mode !== "base") { loc = { mode: "base", baseId: bases[0]?.id }; store.setJ("loc", loc); }
  Route.reset();
  $("#dlg").close();
  toast(say("Ortsdaten gelöscht ✓", "Ortsdaten gelöscht ✓"));
  load();
});
// Prüft Schlüssel und Rechte, ohne etwas auszulösen: Ein Start auf einen nicht
// existierenden Branch antwortet mit 422, wenn das Recht vorhanden ist, sonst mit 403/404.
$("#btnTest").addEventListener("click", async () => {
  const r = $("#inRepo").value.trim(), t = $("#inToken").value.trim(), out = $("#testOut");
  const line = (ok, txt) => `${ok ? "✅" : "❌"} ${txt}<br>`;
  const where = isStandalone() ? "installierte App" : "Browser";
  let h = `Schlüssel …${esc(t.slice(-4)) || "(leer)"} · Repository ${esc(r) || "(leer)"} · ${where}<br>`;
  out.innerHTML = h + "Prüfe …";
  if (!r || !t) { out.innerHTML = h + line(false, "Repository und Schlüssel ausfüllen."); return; }
  const H = { Authorization: `Bearer ${t}`, Accept: "application/vnd.github+json" };
  try {
    const a = await fetch(`https://api.github.com/repos/${r}/contents/docs/data/bases.json?ref=app-daten`, { headers: H, cache: "no-store" });
    h += a.ok ? line(true, "Daten lesen erlaubt")
      : line(false, { 401: "Schlüssel ungültig oder abgelaufen", 404: "Kein Zugriff – Repository beim Schlüssel nicht ausgewählt (oder Name falsch)", 403: "Lesen nicht erlaubt – „Contents: Read-only“ fehlt" }[a.status] || `Lesen: GitHub ${a.status}`);
    const b = await fetch(`https://api.github.com/repos/${r}/actions/workflows/tankpreise.yml/dispatches`, {
      method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ ref: "verbindungstest-gibt-es-nicht" }),
    });
    let msg = ""; try { msg = (await b.json()).message || ""; } catch {}
    h += b.status === 422 ? line(true, "Abrufe starten erlaubt")
      : line(false, { 401: "Abrufe starten: Schlüssel ungültig", 403: "Abrufe starten nicht erlaubt – „Actions: Read and write“ fehlt oder der Schlüssel gilt nicht für dieses Repository", 404: "Abrufe starten: Repository beim Schlüssel nicht ausgewählt" }[b.status] || `Abrufe starten: GitHub ${b.status}`)
        + (msg ? `<span style="opacity:.8">GitHub: ${esc(msg)}</span><br>` : "");
  } catch (e) { h += line(false, "Keine Verbindung zu GitHub: " + esc(e.message)); }
  out.innerHTML = h;
});
$("#dlg").addEventListener("close", () => { if ($("#dlg").returnValue === "save") { saveSettings(); toast(say("Sodele, gspeichert.", "Gespeichert.")); load(true); } });
$("#btnReport").addEventListener("click", () => { saveSettings(); $("#dlg").close(); dispatch("report"); });
$("#btnSettings").addEventListener("click", openSettings);
$("#btnDlgCancel").addEventListener("click", () => $("#dlg").close("cancel"));
$("#btnFetch").addEventListener("click", () => { if (evMode && (tab === "preise" || tab === "verlauf")) { toast(say("Ladestationa werret aktualisiert …", "Ladestationen werden aktualisiert …")); return Strom.load(true); } dispatch("abrufen"); });
$("#seg").addEventListener("click", (e) => {
  const f = e.target.closest("button")?.dataset?.f; if (!f) return;
  if (f === "ev") { if (evMode) return; evMode = true; store.set("ev", "1"); }
  else { const was = evMode; fuel = f; store.set("fuel", f); evMode = false; store.set("ev", "0"); if (was && view?.deferred) load(); }
  if (detailId) closeDetail();
  render();
});

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-lvl],[data-tab],[data-showall],[data-route],[data-detail],[data-fuel],[data-sort],[data-open],[data-report],[data-view],[data-fav],[data-favtoggle],#btnFavEdit,#btnBack,#btnSetup");
  if (!el) return;
  if (el.dataset.lvl) {   // Tank-Rat: Füllstand angeben / wieder abwählen
    const f = +el.dataset.lvl;
    if (store.getJ("lvl", null)?.f === f) store.set("lvl", ""); else store.setJ("lvl", { f, at: Date.now() });
    return renderWhen();
  }
  if (el.dataset.tab) return setTab(el.dataset.tab);
  if (el.hasAttribute("data-showall")) { showAll = !showAll; return render(); }
  if (el.dataset.fav) return openFav(el.dataset.fav);
  if (el.dataset.favtoggle) return toggleFav(el.dataset.favtoggle);
  if (el.id === "btnFavEdit") return openFavDialog();
  if (el.id === "btnBack") return closeDetail();
  if (el.id === "btnSetup") return openSettings();
  if (el.dataset.route) return openRoute(byId(el.dataset.route));
  if (el.dataset.detail) return openDetail(el.dataset.detail);
  if (el.dataset.report) return openReport(el.dataset.report);
  if (el.dataset.fuel) { fuel = el.dataset.fuel; store.set("fuel", fuel); render(); return renderDetail(); }
  if (el.dataset.sort) { sortBy = el.dataset.sort; store.set("sortBy", sortBy); return render(); }
  if (el.dataset.view) { viewMode = el.dataset.view; store.set("viewMode", viewMode); return render(); }
  if (el.hasAttribute("data-open")) { onlyOpen = !onlyOpen; store.set("onlyOpen", onlyOpen ? "1" : "0"); return render(); }
});

// Wischen vom linken Rand schließt die Detailansicht
let sx = null, sy = null;
$("#detail").addEventListener("touchstart", (e) => { const t = e.touches[0]; sx = t.clientX < 40 ? t.clientX : null; sy = t.clientY; }, { passive: true });
$("#detail").addEventListener("touchend", (e) => {
  if (sx == null) return; const t = e.changedTouches[0];
  if (t.clientX - sx > 80 && Math.abs(t.clientY - sy) < 60) closeDetail();
  sx = null;
}, { passive: true });

// Ziehen nach unten zum Aktualisieren
const ptr = $("#ptr"); let py = null, pull = 0, busy = false;
window.addEventListener("touchstart", (e) => { py = !detailId && window.scrollY <= 0 && !busy && !document.querySelector("dialog[open]") && !e.target.closest(".leaflet-container") ? e.touches[0].clientY : null; pull = 0; }, { passive: true });
window.addEventListener("touchmove", (e) => {
  if (py == null) return;
  pull = Math.max(0, e.touches[0].clientY - py);
  ptr.style.opacity = Math.min(1, pull / 70);
  ptr.firstElementChild.style.transform = `translateY(${Math.min(pull, 90) / 2}px) rotate(${pull * 3}deg)`;
}, { passive: true });
window.addEventListener("touchend", async () => {
  if (py == null) return; py = null;
  if (pull > 70) {
    busy = true; ptr.querySelector("svg").classList.add("spin");
    await load(true).catch(() => {});
    ptr.querySelector("svg").classList.remove("spin"); busy = false;
  }
  ptr.style.opacity = 0; ptr.firstElementChild.style.transform = "";
});

document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - loadAt > 60000) load(true, false); });   // Live-Preise nur über den Zwischenspeicher
// Erst starten, wenn alle Teile geladen sind
document.addEventListener("DOMContentLoaded", () => load(true));


// ---- Service Worker (Sofortstart, Betrieb ohne Netz) und Hinweis auf neue Versionen
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data?.type !== "update" || $("#updBar")) return;
    const b = Object.assign(document.createElement("button"), { id: "updBar", type: "button", textContent: "Neue Version bereit – tippen zum Neuladen" });
    b.addEventListener("click", () => location.reload());
    document.body.append(b);
  });
}

// ---- App installieren: Android/Chrome bietet den Knopf selbst an (beforeinstallprompt), auf dem iPhone gibt es nur die Anleitung
let installEv = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEv = e; renderInstall(); });
window.addEventListener("appinstalled", () => { installEv = null; renderInstall(); toast("App installiert ✓"); });
function renderInstall() {
  const done = isStandalone(), bar = $("#instBar"), box = $("#instBox");
  bar.hidden = done || !installEv || store.get("instNo", "0") === "1";
  $("#btnInstall").hidden = !installEv;
  box.hidden = done || (!installEv && !PLAT.ios && !PLAT.android);
  $("#instTxt").textContent = installEv ? "Startet wie eine App und auch ohne Netz."
    : PLAT.ios ? "In Safari unten auf „Teilen“ tippen, dann „Zum Home-Bildschirm“ wählen."
    : "Im Browser-Menü (⋮) „App installieren“ bzw. „Zum Startbildschirm hinzufügen“ wählen.";
}
async function installApp() {
  if (!installEv) return;
  const ev = installEv; installEv = null;   // ein Ereignis gilt nur einmal
  try { await ev.prompt(); await ev.userChoice; } catch {}
  renderInstall();
}
$("#btnInstall").addEventListener("click", () => { $("#dlg").close(); installApp(); });
$("#btnInstBar").addEventListener("click", installApp);
$("#btnInstNo").addEventListener("click", () => { store.set("instNo", "1"); $("#instBar").hidden = true; });
