// Schwabensprit – Regeladresse und Ortswahl
// Regeladresse: der Ort für die grundsätzlichen Abfragen. Sie steht nur im Gerätespeicher („home“) und gilt beim Start der App;
// wer in dieser Sitzung etwas anderes gewählt hat (Standort, Adresse), behält es bis zum nächsten Start.
// Die Preisdaten kommen weiter aus dem Datengebiet (bases.json): Ein Ort ist voll versorgt, wenn sein Kreis ganz in einem Gebiet liegt.
// Der Teil „Rechnung“ ist rein (ohne Seite) und wird von den Unit-Tests geprüft; geladen nach grund.js.

const HOME_KEY = "home", RECENT_KEY = "recentPlaces", RECENT_MAX = 4;
// Kaltstart = erster Aufruf in dieser Sitzung (installierte App: nach dem Beenden, Browser: neuer Tab)
const COLD_START = (() => { try { const had = sessionStorage.getItem("sess"); sessionStorage.setItem("sess", "1"); return !had; } catch { return true; } })();

// ---- Regeladresse und zuletzt benutzte Orte (lokal)
const okPt = (p) => !!p && Number.isFinite(+p.lat) && Number.isFinite(+p.lng);
const homeAddr = () => { const h = store.getJ(HOME_KEY, null); return okPt(h) ? { lat: +h.lat, lng: +h.lng, label: String(h.label || "Regeladresse") } : null; };
const homeSet = (p) => store.setJ(HOME_KEY, { lat: +(+p.lat).toFixed(4), lng: +(+p.lng).toFixed(4), label: String(p.label || "Regeladresse").slice(0, 80) });
const homeClear = () => store.setJ(HOME_KEY, null);
const placeLabel = (b) => (b.name + b.place).length <= 20 ? `${b.name} · ${b.place}` : b.name;
function recentList() {
  const r = store.getJ(RECENT_KEY, null) ?? (store.getJ("lastPlace", null) ? [store.getJ("lastPlace", null)] : []);   // früher nur ein gesuchter Ort
  return r.filter(okPt).slice(0, RECENT_MAX);
}
function recentAdd(p) {
  const r = recentList().filter((x) => !(Math.abs(x.lat - p.lat) < 0.0005 && Math.abs(x.lng - p.lng) < 0.0005));
  r.unshift({ lat: +(+p.lat).toFixed(4), lng: +(+p.lng).toFixed(4), label: String(p.label || "").slice(0, 80), sub: String(p.sub || "").slice(0, 80) });
  store.setJ(RECENT_KEY, r.slice(0, RECENT_MAX));
}
// größter Radius (km), für den ein einzelnes Gebiet den Kreis um den Ort ganz abdeckt (wie pickSource in grund.js)
const coverKm = (lat, lng, list = bases) => Math.max(0, Math.floor(list.reduce((m, b) => Math.max(m, b.radius_km + 0.1 - distKm(lat, lng, b.lat, b.lng)), 0)));
// Treffer der Suche → kurze Beschriftung mit dem Ort davor/dahinter: „Hauptstraße 12, Ulm“, „Marktplatz, Filderstadt“
const hitLabel = (x) => { const c = String(x.sub || "").split(", ")[0]; return c && c !== x.label ? `${x.label}, ${c}` : x.label; };

// ---- Start: Regeladresse gilt beim Kaltstart; die bisherige Base wird einmalig zur Regeladresse
let locStarted = false;
function startLoc() {
  if (locStarted) return; locStarted = true;
  if (COLD_START && homeAddr() && loc.mode !== "home") loc = { mode: "home" };
}
function migrateHome() {
  if (homeAddr() || loc.auto) return;
  const b = bases.find((x) => x.id === store.get("homeBase", "")) || (loc.mode === "base" ? bases.find((x) => x.id === loc.baseId) : null);
  if (!b) return;
  homeSet({ lat: b.lat, lng: b.lng, label: placeLabel(b) });
  if (COLD_START || loc.mode === "base") loc = { mode: "home" };
}
// noch kein Ort gewählt (Erststart, entfernte Regeladresse, Auswahl nach Fenster ohne Wahl) → Ortswahl öffnen
const needLocPick = () => !homeAddr() && loc.mode === "base" && (!!loc.auto || !bases.some((b) => b.id === loc.baseId));
let locAsked = false;
function askLocOnce() { if (locAsked || !needLocPick()) return; locAsked = true; openLocDialog(true); }
// Hinweis zum Radius: reicht ein Gebiet für den Kreis um diesen Ort?
function radiusHint(c) {
  if (!c || !bases.length) return { txt: "", warn: false };
  const cov = coverKm(c.lat, c.lng), key = !!store.get("tk", "");
  if (cov < 1) return { warn: true, txt: `Dieser Ort liegt außerhalb des Datengebiets${key ? " – Live-Abfrage mit deinem Tankerkönig-Schlüssel." : "."}` };
  if (radius > cov) return { warn: true, txt: `Vollständige Daten liegen hier nur bis ≈ ${cov} km vor${key ? " – darüber Live-Abfrage." : " – bei größerem Radius fehlen Tankstellen."}` };
  return { warn: false, txt: `Daten vollständig (bis ≈ ${cov} km).` };
}

// ---- Ortswahl (Dialog): Standort · Regeladresse · Adresse eingeben · zuletzt benutzt · Radius
let locChanged = false;
const sameLoc = (a, b) => a && b && Math.abs(a.lat - b.lat) < 0.0006 && Math.abs(a.lng - b.lng) < 0.0006;
function renderLocDialog() {
  const h = homeAddr(), rec = recentList(), c = center();
  $("#optGps").classList.toggle("on", loc.mode === "gps");
  $("#optHome").hidden = !h;
  if (h) { $("#homeName").textContent = h.label; $("#optHome").classList.toggle("on", loc.mode === "home"); }
  $("#recentGroup").hidden = !rec.length;
  $("#locRecent").innerHTML = rec.map((p, i) => `<button class="opt ${loc.mode === "place" && sameLoc(p, loc) ? "on" : ""}" data-recent="${i}"><div class="ic pl">⌖</div>
    <div class="t"><div>${esc(p.label)}</div>${p.sub ? `<div class="sub">${esc(p.sub)}</div>` : ""}</div><span class="check">✓</span></button>`).join("");
  $("#btnSetHome").hidden = !((loc.mode === "gps" || loc.mode === "place") && okPt(loc) && !sameLoc(h, loc));
  $("#inRadius").value = radius; $("#radiusVal").textContent = `${radius} km`;
  const rh = radiusHint(c); $("#radiusHint").textContent = rh.txt; $("#radiusHint").classList.toggle("warn", rh.warn);
}
function setLoc(l) {
  loc = l; locChanged = true;
  store.setJ("loc", loc.mode === "gps" ? { ...loc, lat: +loc.lat.toFixed(3), lng: +loc.lng.toFixed(3) } : loc);   // Standort nur auf ca. 100 m gerundet speichern
  renderLocDialog();
}
function openLocDialog(first = false) {
  locChanged = false;
  $("#locHint").hidden = !first;
  renderLocDialog(); $("#searchResults").innerHTML = "";
  $("#dlgLoc").showModal();
}
$("#btnLoc").addEventListener("click", () => openLocDialog());
$("#optGps").addEventListener("click", async () => {
  $("#gpsSub").textContent = "Standort wird ermittelt …";
  try {
    const p = await getPosition();
    setLoc({ mode: "gps", lat: p.latitude, lng: p.longitude, label: "Mein Standort" });
    $("#gpsSub").textContent = "per Standortfreigabe";
  } catch (e) { $("#gpsSub").textContent = e.message; }
});
$("#optHome").addEventListener("click", () => setLoc({ mode: "home" }));
$("#locRecent").addEventListener("click", (e) => {
  const b = e.target.closest("[data-recent]"), p = b && recentList()[+b.dataset.recent];
  if (p) { recentAdd(p); setLoc({ mode: "place", ...p }); }
});
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
      const x = res[b.dataset.hit], p = { lat: x.lat, lng: x.lng, label: hitLabel(x), sub: x.sub.split(", ").slice(0, 2).join(", ") };
      recentAdd(p);
      $("#searchResults").innerHTML = ""; $("#inSearch").value = "";
      setLoc({ mode: "place", lat: p.lat, lng: p.lng, label: p.label });
    };
  } catch { $("#searchResults").innerHTML = `<div class="sub" style="padding:8px 4px">Suche gerade nicht möglich.</div>`; }
  finally { btn.disabled = false; }
});
// aktuellen Standort oder gesuchte Adresse als Regeladresse merken
$("#btnSetHome").addEventListener("click", () => {
  if (!okPt(loc)) return;
  const prev = homeBase()?.id;
  homeSet({ lat: loc.mode === "gps" ? +(+loc.lat).toFixed(3) : loc.lat, lng: loc.mode === "gps" ? +(+loc.lng).toFixed(3) : loc.lng, label: loc.mode === "gps" ? "Mein Standort · gespeichert" : loc.label });
  setLoc({ mode: "home" }); homeChanged(prev);
  toast(say("Regeladresse gmerkt ✓", "Regeladresse gespeichert ✓"));
});
$("#inRadius").addEventListener("input", (e) => {
  radius = Number(e.target.value); store.set("radius", String(radius));
  $("#radiusVal").textContent = `${radius} km`; locChanged = true;
  const rh = radiusHint(center()); $("#radiusHint").textContent = rh.txt; $("#radiusHint").classList.toggle("warn", rh.warn);
});
$("#btnLocDone").addEventListener("click", () => $("#dlgLoc").close());
$("#dlgLoc").addEventListener("close", () => { if (locChanged) load(); });
// Die Vergleichsregion im Tankbuch hängt an der Regeladresse: bei einem Wechsel der Region die Vergleiche neu berechnen
function homeChanged(prevBaseId) {
  const nb = homeBase()?.id;
  if (nb && nb !== prevBaseId) tbRecompute(true).then((n) => n && toast(`${TB_NAME()}: ${n} Vergleiche mit der neuen Regeladresse neu berechnet.`));
}

// ---- Einstellungen: Regeladresse suchen, aus dem Standort übernehmen, entfernen (gilt erst mit „Speichern“)
let homeDraft;   // undefined = unverändert · null = entfernen · {lat, lng, label}
function paintHomeSetting() {
  const h = homeDraft === undefined ? homeAddr() : homeDraft;
  $("#homeNow").textContent = h ? h.label : "nicht festgelegt";
  $("#btnHomeClear").hidden = !h;
}
function openHomeSetting() { homeDraft = undefined; $("#inHomeQ").value = ""; $("#homeHits").innerHTML = ""; $("#homeSub").textContent = ""; paintHomeSetting(); }
function commitHome() {
  if (homeDraft === undefined) return;
  const prev = homeBase()?.id;
  if (homeDraft) { homeSet(homeDraft); loc = { mode: "home" }; }
  else { homeClear(); if (loc.mode === "home") loc = { mode: "base", baseId: null, auto: true }; }
  store.setJ("loc", loc); homeDraft = undefined; homeChanged(prev);
}
async function homeSearch() {
  const q = $("#inHomeQ").value.trim(), btn = $("#btnHomeSearch");
  if (!q || btn.disabled) return;
  btn.disabled = true;
  $("#homeHits").innerHTML = `<div class="sub" style="padding:8px 4px">Suche …</div>`;
  try {
    const res = await geoSearch(q);
    $("#homeHits").innerHTML = res.length ? res.map((x, i) =>
      `<button type="button" class="opt" data-homehit="${i}"><div class="ic pl">⌖</div><div class="t"><div>${esc(x.label)}</div><div class="sub">${esc(x.sub)}</div></div></button>`).join("")
      : `<div class="sub" style="padding:8px 4px">Nichts gefunden.</div>`;
    $("#homeHits").onclick = (ev) => {
      const b = ev.target.closest("[data-homehit]"); if (!b) return;
      const x = res[b.dataset.homehit];
      homeDraft = { lat: x.lat, lng: x.lng, label: hitLabel(x) };
      $("#homeHits").innerHTML = ""; $("#inHomeQ").value = ""; paintHomeSetting();
    };
  } catch { $("#homeHits").innerHTML = `<div class="sub" style="padding:8px 4px">Suche gerade nicht möglich.</div>`; }
  finally { btn.disabled = false; }
}
$("#btnHomeSearch").addEventListener("click", homeSearch);
$("#inHomeQ").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); homeSearch(); } });   // Eingabetaste sucht (statt zu speichern)
$("#btnHomeGps").addEventListener("click", async () => {
  $("#homeSub").textContent = "Standort wird ermittelt …";
  try {
    const p = await getPosition();
    homeDraft = { lat: +p.latitude.toFixed(3), lng: +p.longitude.toFixed(3), label: "Mein Standort · gespeichert" };   // ca. 100 m genau
    $("#homeSub").textContent = ""; paintHomeSetting();
  } catch (e) { $("#homeSub").textContent = e.message; }
});
$("#btnHomeClear").addEventListener("click", () => { homeDraft = null; paintHomeSetting(); });
