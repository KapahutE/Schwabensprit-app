// Schwabensprit – Bereich „Route“: Strecke planen und die Tankstellen am Weg zeigen.
// Routing: FOSSGIS-Dienst (OSRM, Ausweich: Valhalla), Ortssuche: Nominatim – Adressen in endpoints.json.
// Preise am Weg: zuerst die Daten der Bases (keine Abfrage). Für Abschnitte außerhalb mit eigenem
// Tankerkönig-Schlüssel höchstens eine Live-Abfrage pro Minute und nur auf Nutzeraktion (Tankerkönig-Regeln).
// Geometrie (Abstand zur Strecke, Kilometer ab Start, Umweg): js/routegeo.js.
// Alle Teile sind klassische Skripte und teilen sich den globalen Gültigkeitsbereich – Reihenfolge in index.html beachten.

const Route = (() => {
  const CORRS = [1, 2, 5], LIVE_KEEP = 30 * 60000, TK_RAD = 25, BASE_RETRY = 60000;
  const S = {
    a: store.getJ("rtA", { kind: "gps", label: "Mein Standort" }),   // {kind: gps|base|place, label, sub?, lat?, lng?, baseId?}
    b: store.getJ("rtB", null),
    corr: CORRS.includes(+store.get("rtCorr", "2")) ? +store.get("rtCorr", "2") : 2,
    sort: ["route", "price", "value"].includes(store.get("rtSort", "")) ? store.get("rtSort", "") : "route",
    recent: store.getJ("rtRecent", []),
    route: null, busy: false, err: null, open: null, all: false, fit: false,
    live: [], liveBusy: false, picking: null, baseFail: new Map(),
    saved: store.getJ("rtSaved", []),   // gemerkte Strecken [{a, b}]
    depart: null,                        // Abfahrt (ms) – null = jetzt
    fc: new Map(),                       // Preisprognosen der Bases am Weg: id → forecast.json
  };
  let goSeq = 0;   // nur die zuletzt gestartete Berechnung darf ihr Ergebnis zeigen
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ll = (p) => `${(+p.lat).toFixed(6)},${(+p.lng).toFixed(6)}`;
  const samePt = (x, y) => !!x && !!y && x.kind === y.kind && x.label === y.label && x.baseId === y.baseId && x.lat === y.lat && x.lng === y.lng;
  // Polyline (Genauigkeit 6) für die gespeicherte letzte Route
  function encodePolyline(pts) {
    let out = "", pa = 0, pb = 0;
    const enc = (v) => { v = v < 0 ? ~(v * 2) : v * 2; let r = ""; while (v >= 32) { r += String.fromCharCode((32 | (v & 31)) + 63); v = Math.floor(v / 32); } return r + String.fromCharCode(v + 63); };
    for (const [la, ln] of pts) { const a = Math.round(la * 1e6), b = Math.round(ln * 1e6); out += enc(a - pa) + enc(b - pb); pa = a; pb = b; }
    return out;
  }

  // ---- Route berechnen (1 Anfrage je Nutzeraktion, ≥ 1 s Abstand, 10 Min. zwischengespeichert)
  const cache = new Map();
  let routeLast = 0;
  const noRoute = () => Object.assign(new Error("noroute"), { noRoute: true });
  async function fetchRoute(A, B) {
    const key = [A.lat, A.lng, B.lat, B.lng].map((v) => v.toFixed(3)).join(",");
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < 10 * 60000) return hit;
    const at = Math.max(Date.now(), routeLast + 1100);   // ≥ 1 s Abstand, auch bei schnellen Folge-Tipps
    routeLast = at;
    if (at > Date.now()) await sleep(at - Date.now());
    let lastErr = null;
    for (const ep of (await endpoints()).routing || []) {
      try {
        let res;
        if (ep.type === "osrm") {
          const r = await fetchT(`${ep.url}${A.lng},${A.lat};${B.lng},${B.lat}?overview=full&geometries=polyline6&alternatives=false&steps=false`);
          const d = await r.json().catch(() => ({}));
          if (d.code === "NoRoute" || d.code === "NoSegment") throw noRoute();
          if (!r.ok || d.code !== "Ok" || !d.routes?.length) throw new Error(`Routing ${r.status}`);
          res = { pts: decodePolyline(d.routes[0].geometry, 6), km: d.routes[0].distance / 1000, sec: d.routes[0].duration };
        } else if (ep.type === "valhalla") {
          const q = { locations: [{ lat: A.lat, lon: A.lng }, { lat: B.lat, lon: B.lng }], costing: "auto", directions_type: "none", units: "kilometers" };
          const r = await fetchT(`${ep.url}?json=${encodeURIComponent(JSON.stringify(q))}`);
          const d = await r.json().catch(() => ({}));
          if (d.error_code === 442 || d.error_code === 171) throw noRoute();
          if (!r.ok || !d.trip?.legs?.length) throw new Error(`Routing ${r.status}`);
          res = { pts: d.trip.legs.flatMap((l) => decodePolyline(l.shape, 6)), km: d.trip.summary.length, sec: d.trip.summary.time };
        } else continue;
        if (res.pts.length < 2) throw new Error("leere Route");
        Object.assign(res, { src: ep.name || ep.type, at: Date.now(), key });
        cache.set(key, res);
        return res;
      } catch (e) { if (e.noRoute) throw e; lastErr = e; }
    }
    throw lastErr || new Error("kein Routendienst eingetragen");
  }
  // Letzte Route auf dem Gerät merken (nicht bei GPS-Start: kein genauer Standort im Speicher)
  function saveLast() {
    const R = S.route;
    if (!R || R.gps) return store.set("rtLast", "");
    store.setJ("rtLast", { a: R.a, b: R.b, A: R.A, B: R.B, km: R.km, sec: R.sec, src: R.src, key: R.key, at: R.at, geom: encodePolyline(R.pts),
      det: [...R.det].slice(0, 40) });
  }
  function restoreLast() {
    const x = store.getJ("rtLast", null);
    if (!x?.geom || Date.now() - x.at > 24 * 36e5 || !samePt(x.a, S.a) || !samePt(x.b, S.b)) return;
    const pts = decodePolyline(x.geom, 6);
    if (pts.length < 2) return;
    S.route = { pts, km: x.km, sec: x.sec, src: x.src, key: x.key, at: x.at, A: x.A, B: x.B, gps: false, index: routeIndex(pts), from: x.a.label, to: x.b.label, a: x.a, b: x.b, det: new Map(x.det || []) };
    S.fit = true;
  }
  // Echter Umweg: eine Matrix-Anfrage (OSRM table) für die interessantesten Tankstellen am Weg –
  // Start → Tankstelle → Ziel minus Start → Ziel, in km und Minuten, dazu die Fahrzeit bis zur Tankstelle
  async function refineDetours() {
    const R = S.route;
    if (!R) return;
    const ep = ((await endpoints()).routing || []).find((e) => e.type === "osrm");
    if (!ep) return;
    const near = stationsAlongRoute(R.index, candidates(), { corridorKm: CORRS.at(-1), fuel: "e5" });
    const pick = new Map();
    for (const f of Object.keys(FUELS))
      near.filter((x) => x[f] != null && !R.det.has(x.id)).sort((x, y) => x[f] - y[f] || x.offKm - y.offKm).slice(0, 8).forEach((x) => pick.set(x.id, x));
    const list = [...pick.values()].slice(0, 24);
    if (!list.length) return;
    const at = Math.max(Date.now(), routeLast + 1100);   // gleiche Taktung wie das Routing (≥ 1 s)
    routeLast = at;
    if (at > Date.now()) await sleep(at - Date.now());
    const idx = list.map((_, i) => i + 2).join(";");
    const pts = [R.A, R.B, ...list].map((p) => `${(+p.lng).toFixed(6)},${(+p.lat).toFixed(6)}`).join(";");
    try {
      const r = await fetchT(`${ep.url.replace("/route/", "/table/")}${pts}?sources=0;${idx}&destinations=1;${idx}&annotations=duration,distance`);
      const d = await r.json();
      if (d.code !== "Ok" || S.route !== R) return;
      const dist = d.distances, du = d.durations, base = dist[0][0], baseT = du[0][0];
      list.forEach((x, i) => {
        const to = dist[0][i + 1], back = dist[i + 1]?.[0], toT = du[0][i + 1], backT = du[i + 1]?.[0];
        if ([to, back, toT, backT].some((v) => v == null)) return;
        R.det.set(x.id, { km: Math.max(0, (to + back - base) / 1000), min: Math.max(0, (toT + backT - baseT) / 60), toSec: toT });
      });
      saveLast(); paint();
    } catch { /* ohne Matrix bleibt die Schätzung */ }
  }
  async function coords(p) {
    if (p.kind === "gps") {
      try { const c = await getPosition(); return { lat: c.latitude, lng: c.longitude }; }
      catch (e) { throw Object.assign(e, { user: true }); }
    }
    if (p.kind === "base") {
      const b = bases.find((x) => x.id === p.baseId);
      if (!b) throw Object.assign(new Error(bases.length ? "Diese Base gibt es nicht mehr." : say("D'Bases hen se grad net lada lassa – nomol probiera.", "Die Bases konnten gerade nicht geladen werden – bitte erneut versuchen.")), { user: true });
      return { lat: b.lat, lng: b.lng };
    }
    return { lat: +p.lat, lng: +p.lng };
  }
  async function go() {
    if (!S.b) return;
    const a = S.a, b = S.b, seq = ++goSeq;   // Start/Ziel dieser Berechnung festhalten
    S.busy = true; S.err = null; paint();
    try {
      const A = await coords(a), B = await coords(b);
      if (seq !== goSeq) return;
      if (distKm(A.lat, A.lng, B.lat, B.lng) < 1)
        throw Object.assign(new Error(say("Start ond Ziel sen fast am gleicha Fleck.", "Start und Ziel liegen fast am selben Ort.")), { user: true });
      const r = await fetchRoute(A, B);
      if (seq !== goSeq) return;   // inzwischen neu gewählt/getauscht → dieses Ergebnis verwerfen
      S.route = { ...r, A, B, gps: a.kind === "gps", index: routeIndex(r.pts), from: a.label, to: b.label, a, b, det: new Map() };
      S.open = null; S.all = false; S.fit = true;
      S.busy = false; saveLast(); paint();
      await ensureBases();
      // außerhalb der Bases: höchstens eine Live-Abfrage für diese Aktion (Tankerkönig: 1/Minute, app-weit)
      if (seq === goSeq && store.get("tk", "") && uncovered().km > 0.5 && !tkWait()) await loadLiveNext();
      if (seq === goSeq) await refineDetours();
    } catch (e) {
      if (seq !== goSeq) return;
      S.err = e.noRoute ? say("Do goht koi Weg na – Start oder Ziel liegt z'weit weg vo dr Stroß.", "Keine Route gefunden – Start oder Ziel liegt zu weit von einer Straße entfernt.")
        : e.user ? e.message
        : `${say("Dr Routendienst isch grad net z'erreicha.", "Der Routendienst ist gerade nicht erreichbar.")} (${e.name === "AbortError" ? "Zeitüberschreitung" : e.message})`;
    } finally { if (seq === goSeq) { S.busy = false; paint(); } }
  }

  // ---- Preise am Weg: Bases zuerst, Live-Abschnitte nur auf Knopfdruck
  async function ensureBases() {
    const R = S.route;
    if (!R) return;
    const stale = (b) => !baseCache[b.id] || (b.updated && baseCache[b.id].latest?.updated !== b.updated);
    const need = bases.filter((b) => stale(b) && Date.now() - (S.baseFail.get(b.id) || 0) > BASE_RETRY
      && nearestOnRoute(R.index, b.lat, b.lng, b.radius_km + CORRS.at(-1) + 1));
    // Preisprognose je Base (für „Preis bei Ankunft“) – neu laden, wenn es neuere Daten gibt
    const onRoute = bases.filter((b) => nearestOnRoute(R.index, b.lat, b.lng, b.radius_km + CORRS.at(-1) + 1));
    const fcNeed = onRoute.filter((b) => !S.fc.has(b.id) || S.fc.get(b.id).upd !== b.updated);
    if (!need.length && !fcNeed.length) return;
    await Promise.all([
      ...need.map((b) => loadBaseData(b).then(() => S.baseFail.delete(b.id)).catch(() => S.baseFail.set(b.id, Date.now()))),
      ...fcNeed.map((b) => (baseCache[b.id]?.forecast && baseCache[b.id].latest?.updated === b.updated ? Promise.resolve(baseCache[b.id].forecast) : fetchData(`data/${b.id}/forecast.json`))
        .then((fc) => S.fc.set(b.id, { fc, upd: b.updated })).catch(() => S.fc.set(b.id, { fc: null, upd: b.updated }))),
    ]);
    paint();
  }
  const coveredBy = (lat, lng) =>
    bases.some((b) => !S.baseFail.has(b.id) && distKm(lat, lng, b.lat, b.lng) <= b.radius_km - S.corr)
    || S.live.some((e) => distKm(lat, lng, e.lat, e.lng) <= TK_RAD - S.corr - 1);
  // Strecke ohne Preisdaten (km) und wo sie beginnt
  function uncovered() {
    const ix = S.route?.index;
    if (!ix) return { km: 0, from: null };
    let sum = 0, from = null, prev = coveredBy(ix.lat[0], ix.lng[0]);
    if (!prev) from = 0;
    for (let i = 1; i < ix.n; i++) {
      const c = coveredBy(ix.lat[i], ix.lng[i]);
      if (!c && !prev) sum += ix.cum[i] - ix.cum[i - 1];
      if (!c && from == null) from = ix.cum[i];
      prev = c;
    }
    return { km: sum, from };
  }
  async function loadLiveNext() {
    const key = store.get("tk", ""), R = S.route;
    if (!key || !R || S.liveBusy) return;
    if (tkWait()) return toast(say("Tankerkönig erlaubt bloß oi Abfrag pro Minut – glei wieder.", "Tankerkönig erlaubt nur eine Abfrage pro Minute – gleich wieder."));
    const u = uncovered();
    if (u.from == null) return;
    // Kreis (25 km) so legen, dass er den ersten Abschnitt ohne Preise samt Korridor abdeckt
    const [lat, lng] = routePointAt(R.index, Math.min(R.index.totalKm, u.from + (TK_RAD - S.corr - 1) * 0.9));
    S.liveBusy = true; tkMark(); paint();
    try {
      const r = await fetchT(`${TK}/list.php?lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}&rad=${TK_RAD}&sort=dist&type=all&apikey=${encodeURIComponent(key)}`);
      const d = await r.json();
      if (!d.ok) throw new Error(d.message || "Tankerkönig-Fehler");
      const hc = hoursCache();
      S.live.push({ lat, lng, at: Date.now(), updated: new Date().toISOString(), stations: (d.stations || []).map((s) => ({
        id: s.id, ...niceStation(s), lat: s.lat, lng: s.lng, open: !!s.isOpen,
        e5: s.e5 || null, e10: s.e10 || null, diesel: s.diesel || null, hours: hc[s.id]?.h ?? null,
      })) });
    } catch (e) { toast(`${say("Live-Preise gehet grad net", "Live-Preise gerade nicht verfügbar")}: ${e.name === "AbortError" ? "Zeitüberschreitung" : e.message}`, 5000); }
    finally { S.liveBusy = false; paint(); }
    refineDetours();
  }
  // Alle bekannten Tankstellen in Routennähe; je Tankstelle der frischeste Stand mit Preis
  function candidates() {
    const R = S.route, m = new Map();
    S.live = S.live.filter((e) => Date.now() - e.at < LIVE_KEEP);
    const add = (s, upd) => {
      const o = m.get(s.id), n = { ...s, _upd: upd };
      if (!o || (n[fuel] != null && (o[fuel] == null || new Date(upd) > new Date(o._upd)))) m.set(s.id, n);
    };
    for (const e of S.live) for (const s of e.stations) add(s, e.updated);
    for (const b of bases) {
      const c = baseCache[b.id]?.latest;
      if (c && nearestOnRoute(R.index, b.lat, b.lng, b.radius_km + S.corr + 1)) for (const s of c.stations) add(s, c.updated);
    }
    return [...m.values()];
  }
  // Geöffnet? Frische Daten (< 30 Min.) haben Vorrang, sonst zählt der Öffnungsplan (wie state())
  const isOpen = (s) => { const sch = schedule(s), fresh = s._upd && Date.now() - new Date(s._upd) < 30 * 60000; return !sch || fresh ? !!s.open : sch.open; };
  const SOON = 20 * 60000;   // Ankunft innerhalb 20 Min.: es gilt der aktuelle Preis
  const fcFor = (id) => { for (const { fc } of S.fc.values()) if (fc?.ok && fc.stations?.[id]) return fc; return null; };
  // Preis zur Ankunftszeit aus der Prognose der Base (stündlich), sonst der aktuelle Preis
  function priceAt(s, f, t) {
    if (s[f] == null || t - Date.now() < SOON) return { v: s[f], fc: false };
    const fc = fcFor(s.id), arr = fc?.stations[s.id]?.[f];
    if (!arr) return { v: s[f], fc: false };
    const i = Math.round((t - new Date(fc.start).getTime()) / (fc.step_min * 60000));
    return arr[i] != null ? { v: arr[i] / 1000, fc: true } : { v: s[f], fc: false };
  }
  // Ankunft, Umweg (echt oder geschätzt), Preis und Öffnung bei Ankunft, Tankfüllung inkl. Umweg
  function enrich(list, R) {
    const dep = Math.max(Date.now(), S.depart || 0);
    for (const s of list) {
      const d = R.det.get(s.id);
      if (d) { s.detourKm = d.km; s.detourMin = d.min; s.exact = true; }
      s.toSec = d?.toSec ?? R.sec * (R.km ? s.alongKm / R.km : 0);
      s.eta = dep + s.toSec * 1000;
      s.p = {}; s.pfc = {};
      for (const f of Object.keys(FUELS)) { const x = priceAt(s, f, s.eta); s.p[f] = x.v; s.pfc[f] = x.fc; }
      const sch = schedule(s, new Date(s.eta));
      s.o = s.eta - Date.now() < SOON ? isOpen(s) : sch ? sch.open : !!s.open;
      s.fillCost = s.p[fuel] != null ? s.p[fuel] * (TANK() + s.detourKm * CONS() / 100) : null;
    }
    return list;
  }
  const pf = (s, f = fuel) => s.p ? s.p[f] : s[f];
  const has = (s, f = fuel) => (s.o ?? isOpen(s)) && pf(s, f) != null;
  const hm2 = (t) => new Date(t).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const minTxt = (m) => m < 60 ? `${Math.max(1, Math.round(m))} Min.` : dur(Math.round(m));

  // ---- Übergabe an Karten-Apps mit der Tankstelle als Zwischenstopp
  function gmaps(s) {
    const R = S.route, q = new URLSearchParams({ api: "1", destination: ll(R.B), waypoints: ll(s), travelmode: "driving" });
    if (!R.gps) q.set("origin", ll(R.A));
    return "https://www.google.com/maps/dir/?" + q;
  }
  function apple(s) {
    const R = S.route, q = new URLSearchParams({ destination: ll(R.B), waypoint: ll(s), mode: "driving" });
    if (!R.gps) q.set("source", ll(R.A));
    return "https://maps.apple.com/directions?" + q;
  }

  // ---- Darstellung
  // Umweg: echt (Matrix) als „+4 Min. Umweg“, sonst geschätzt aus dem Abstand zur Strecke
  const offTxt = (s) => s.exact ? (s.detourMin < 1 ? say("koi Umweg", "kein Umweg") : `+${minTxt(s.detourMin)} ${say("Umweg", "Umweg")}`)
    : s.offKm < 0.15 ? say("direkt am Weg", "direkt an der Strecke") : `${km(s.offKm)} ${say("ab", "abseits")}`;
  const whenTxt = (s) => `${km(s.alongKm)} · ${s.exact ? "" : "≈ "}${minTxt(s.toSec / 60)}`;   // Strecken-km und Fahrzeit bis dorthin
  const baseLabel = (b) => (b.name + b.place).length <= 20 ? `${b.name} · ${b.place}` : b.name;   // wie bei der Ortswahl
  const ptIcon = (p) => p?.kind === "gps" ? `<div class="ic gps"><svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M21.7 2.3a1 1 0 0 0-1.1-.2l-18 8a1 1 0 0 0 .1 1.9l7.4 2 2 7.4a1 1 0 0 0 1.9.1l8-18a1 1 0 0 0-.3-1.2z"/></svg></div>`
    : p?.kind === "base" ? `<div class="ic">${esc(p.baseId || "B")}</div>` : `<div class="ic pl">⌖</div>`;
  const ptBtn = (w, p) => `<button class="opt rtpt" data-rtpick="${w}" aria-label="${w === "a" ? "Start" : "Ziel"} wählen">${ptIcon(p)}
    <div class="t"><div class="sub">${w === "a" ? "Start" : "Ziel"}</div><div>${p ? esc(p.label) : `<span class="sub">${say("Ziel wähla …", "Ziel wählen …")}</span>`}</div></div></button>`;

  function formHtml() {
    const depVal = S.depart ? new Date(S.depart - new Date(S.depart).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
    return `<section class="card rtform"><span class="eyebrow">${say("Wo fahrsch na?", "Wohin geht's?")}</span>
      ${S.saved.length ? `<div class="chips rtsaved">${S.saved.map((x, i) => `<span class="rtsv"><button class="chip" data-rtsaved="${i}">★ ${esc(x.a.label)} → ${esc(x.b.label)}</button><button class="rtsvx" data-rtunsave="${i}" aria-label="Gemerkte Strecke entfernen">×</button></span>`).join("")}</div>` : ""}
      <div class="rtpts">${ptBtn("a", S.a)}${ptBtn("b", S.b)}
        <button class="rtswap" data-rtswap type="button" aria-label="Start und Ziel tauschen"${S.b ? "" : " disabled"}>⇅</button></div>
      <div class="chips rtcorr"><span class="lbl">${say("Vom Weg", "Abstand")}</span>
        ${CORRS.map((c) => `<button class="chip ${c === S.corr ? "on" : ""}" data-rtcorr="${c}" aria-pressed="${c === S.corr}">${c} km</button>`).join("")}</div>
      <div class="chips rtdep"><span class="lbl">${say("Abfahrt", "Abfahrt")}</span>
        <button class="chip ${S.depart ? "" : "on"}" data-rtdepnow aria-pressed="${!S.depart}">${say("Etz", "Jetzt")}</button>
        <input type="datetime-local" id="rtDep" class="${S.depart ? "on" : ""}" value="${depVal}" aria-label="Abfahrt später"></div>
      <button class="btn block" data-rtgo type="button"${S.b && !S.busy ? "" : " disabled"}>${S.busy ? `<span class="spin-dot"></span> ${say("Mir rechnet …", "Route wird berechnet …")}` : say("Route berechna", "Route berechnen")}</button></section>`;
  }
  function paint() {
    const el = $("#rtBody");
    if (!el) return;
    let h = formHtml();
    if (view?.error) h += view.error.setup
      ? `<div class="card notice warnbox"><span class="ic">🔑</span><div><b>Noch nicht eingerichtet</b><br>${say("Ohne GitHub-Schlüssel gibt's koine Preise vo de Bases.", "Ohne GitHub-Schlüssel gibt es keine Preise aus den Bases.")}<div class="row" style="margin-top:10px"><button class="btn" id="btnSetup">Einrichten</button></div></div></div>`
      : `<div class="card notice warnbox"><span class="ic">⚠️</span><div><b>${say("Preise hen se grad net lada lassa", "Preise konnten gerade nicht geladen werden")}</b><br>${esc(view.error.message)} – zum Neuladen nach unten ziehen.</div></div>`;
    if (S.err) h += `<div class="card notice warnbox"><span class="ic">⚠️</span><div>${esc(S.err)}${S.b ? `<div class="row" style="margin-top:10px"><button class="btn secondary" data-rtgo>${say("Nomol versuche", "Erneut versuchen")}</button></div>` : ""}</div></div>`;
    const R = S.route;
    if (S.busy && !R) h += `<div class="skel" style="height:120px"></div><div class="skel" style="height:300px"></div>`;
    else if (!R) h += `<div class="card empty"><div class="bigic">🛣️</div><b>${say("Wo goht's na?", "Wohin soll es gehen?")}</b><p>${say("Gib a Ziel ei – mir zeiget, wo's uff dr Strecke am billigschde isch.", "Ziel eingeben – wir zeigen, wo es an der Strecke am günstigsten ist.")}</p>
      <button class="btn" data-rtpick="b">${say("Ziel wähla", "Ziel wählen")}</button></div>`;
    else h += resultHtml(R);
    h += `<p class="foot rtfoot">Route: <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener">FOSSGIS-Routingdienst</a> (OSRM/Valhalla) ·
      Kartendaten © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap-Mitwirkende</a> ·
      <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener">Kartenfehler melden</a> · Suche: Nominatim ·
      Preise: <a href="https://www.tankerkoenig.de" target="_blank" rel="noopener">Tankerkönig</a> / MTS-K (CC BY 4.0) ·
      Kontakt: <a href="https://github.com/KapahutE/Schwabensprit-app" target="_blank" rel="noopener">GitHub</a></p>`;
    el.innerHTML = h;
    if (R) mountMap();
  }
  let lastList = [], lastLv = () => "mid";
  function resultHtml(R) {
    const list = enrich(stationsAlongRoute(R.index, candidates(), { corridorKm: S.corr, fuel, roadFactor: ROAD, tankL: TANK(), consL100: CONS() }), R);
    const priced = list.filter((s) => has(s));
    // Günstigste (Preis bei Ankunft; bei gleichem Preis die mit dem kleineren Umweg) und beste inkl. Umweg
    const minP = priced.length ? Math.min(...priced.map((s) => pf(s))) : null;
    const byCost = (x, y) => (y.fillCost < x.fillCost - 1e-9 || (Math.abs(y.fillCost - x.fillCost) <= 1e-9 && y.alongKm < x.alongKm) ? y : x);
    const cheapest = priced.length ? priced.filter((s) => pf(s) - minP < 1e-9).reduce(byCost) : null;
    const bestValue = priced.length ? priced.reduce(byCost) : null;
    const med = median(priced.map((s) => pf(s)));
    const lv = (s) => !has(s) || med == null ? "off" : pf(s) <= med - 0.0095 ? "lo" : pf(s) >= med + 0.0095 ? "hi" : "mid";
    lastList = list; lastLv = lv;
    const u = uncovered(), key = store.get("tk", "");
    const oldest = list.reduce((o, s) => (s._upd && (!o || s._upd < o) ? s._upd : o), null);   // ältester verwendeter Datenstand
    const tripCost = med != null ? R.km * CONS() / 100 * med : null;                            // Sprit für die ganze Fahrt
    const isSaved = S.saved.some((x) => samePt(x.a, R.a) && samePt(x.b, R.b));
    const depTxt = S.depart && S.depart > Date.now() + SOON ? ` · ${say("Abfahrt", "Abfahrt")} ${esc(new Date(S.depart).toLocaleString("de-DE", { weekday: "short", hour: "2-digit", minute: "2-digit" }))}` : "";
    let h = `<section class="card rtsum" aria-live="polite"><span class="eyebrow">${say("Dei Strecke", "Deine Strecke")} · ${FUELS[fuel]} · ± ${S.corr} km</span>
      <div class="big">${km(R.km).replace(",0 km", " km")} <span>≈ ${dur(Math.max(1, Math.round(R.sec / 60)))}${tripCost != null ? ` · Sprit ≈ ${eur2(tripCost)}` : ""}</span></div>
      <div class="sub">${esc(R.from)} → ${esc(R.to)}${depTxt} · ${list.length} ${list.length === 1 ? say("Tankstell", "Tankstelle") : say("Tankstella", "Tankstellen")} ${say("am Weg", "an der Strecke")}${oldest ? ` · Preise ${say("vom", "Stand")} ${esc(ago(oldest))}` : ""}</div>
      ${R.a && R.b ? `<div class="row"><button class="btn secondary rtsavebtn" data-rtsave aria-pressed="${isSaved}">${isSaved ? "★ " + say("Gmerkt", "Gemerkt") : "☆ " + say("Strecke merka", "Strecke merken")}</button></div>` : ""}</section>`;
    // Abschnitte ohne Preise
    if (u.km > 0.5) {
      const cool = Math.ceil(tkWait() / 1000);
      h += `<div class="card notice"><span class="ic">ℹ️</span><div><b>${say(`Uff ${fmtNum(u.km, 0)} km hen mir koine Preise`, `Für ${fmtNum(u.km, 0)} km fehlen Preise`)}</b> – ${say("dort send koine vo deine Bases.", "dort liegt keine deiner Bases.")}<br>
        ${key ? `${say("Mit deim Tankerkönig-Schlüssel kasch abschnittsweis Live-Preise lada (oi Abfrag pro Minut).", "Mit deinem Tankerkönig-Schlüssel lassen sich Live-Preise abschnittsweise laden (eine Abfrage pro Minute).")}
          <div class="row" style="margin-top:10px"><button class="btn secondary" data-rtlive${S.liveBusy || cool > 0 ? " disabled" : ""}>${S.liveBusy ? `<span class="spin-dot"></span> ${say("Lädt …", "Lädt …")}` : cool > 0 ? `${say("Nägschder Abschnitt in", "Nächster Abschnitt in")} <span class="rtcool">${cool}</span> s` : say("Nägschda Abschnitt lada", "Nächsten Abschnitt laden")}</button></div>`
        : `${say("Für Live-Preise trag unter ⚙ dein Tankerkönig-Schlüssel ei.", "Für Live-Preise unter ⚙ den Tankerkönig-Schlüssel eintragen.")}<div class="row" style="margin-top:10px"><button class="btn secondary" id="btnSetup">${say("Eistellunga", "Einstellungen")}</button></div>`}</div></div>`;
      if (key && cool > 0 && !S.liveBusy) tick();
    }
    if (cheapest) {
      const avg = mean(priced.map((s) => pf(s))), save = avg - pf(cheapest), sch = schedule(cheapest, new Date(cheapest.eta));
      const fcNote = cheapest.pfc[fuel] && Math.abs(pf(cheapest) - cheapest[fuel]) >= 0.005
        ? `<p class="quip">🕒 ${say(`Bei Ankunft (≈ ${hm2(cheapest.eta)} Uhr) voraussichtlich ${eurX(pf(cheapest))} – grad no ${eurX(cheapest[fuel])}.`, `Bei Ankunft (≈ ${hm2(cheapest.eta)} Uhr) voraussichtlich ${eurX(pf(cheapest))} – aktuell ${eurX(cheapest[fuel])}.`)}</p>` : "";
      h += `<section class="card hero rthero"><span class="eyebrow">${say("Am billigschde uff dr Strecke", "Günstigste an der Strecke")}</span>
        <div class="pricerow"><div class="price">${cheapest.pfc[fuel] ? "<small>≈</small>" : ""}${priceN(pf(cheapest))}<span class="cur">€</span></div>
          ${priced.length > 1 && save > 0.0005 ? `<div class="save"><span class="eyebrow">${say("Gspart", "Ersparnis")}</span><b>${eur2(save * TANK())}</b><span>bei ${fmtNum(TANK(), 0)} l ggü. Ø</span></div>` : ""}</div>
        <div class="station">${badge(cheapest, lv(cheapest), "lg")}<div style="min-width:0"><div class="where">${esc(cheapest.brand)} · ${esc(cheapest.place)}</div>
          <div class="sub">${whenTxt(cheapest)} · ${offTxt(cheapest)}${cheapest.o && sch?.short ? " · " + esc(sch.short) : ""}</div></div></div>
        ${fcNote}
        ${SW() && priced.length > 1 && save > 0.0005 ? `<p class="quip">🥨 ${brezel(save * TANK())}</p>` : ""}
        <div class="row two"><a class="btn" href="${esc(gmaps(cheapest))}" target="_blank" rel="noopener">${NAV} ${say("Tankstopp", "Tankstopp")}</a>
          <button class="btn secondary" data-rtmap="${esc(cheapest.id)}">${say("Uff dr Kart", "Auf Karte")}</button></div></section>`;
      if (bestValue && bestValue.id !== cheapest.id && cheapest.fillCost - bestValue.fillCost > 0.05) {
        const gain = cheapest.fillCost - bestValue.fillCost;
        h += `<section class="card valuecard"><div class="tiphead"><div class="ic">🚗</div><div><b>${say("Lohnt sich am meischda", "Lohnt sich am meisten")}</b>
          <div class="sub">${say("inkl. Umweg", "inkl. Umweg")} · ${fmtNum(TANK(), 0)} l · ${fmtNum(CONS(), 1)} l/100 km</div></div></div>
          <div class="station" style="margin-top:14px">${badge(bestValue, lv(bestValue))}<div style="min-width:0;flex:1"><div class="where" style="font-size:16px">${esc(bestValue.brand)} · ${esc(bestValue.place)}</div>
            <div class="sub">${whenTxt(bestValue)} · ${offTxt(bestValue)}</div></div><div class="price1">${bestValue.pfc[fuel] ? "≈ " : ""}${price(pf(bestValue))}</div></div>
          <p class="verdict">${say(`A bissle deirer, aber näher am Weg: unterm Strich <b>${eur2(gain)} billiger</b> als dr Billigschde (${cheapest.exact ? "" : "≈ "}${km(cheapest.detourKm)} Umweg).`,
            `Etwas teurer, aber näher an der Strecke: unterm Strich <b>${eur2(gain)} günstiger</b> als die Günstigste (${cheapest.exact ? "" : "≈ "}${km(cheapest.detourKm)} Umweg).`)}</p>
          <div class="row two"><a class="btn" href="${esc(gmaps(bestValue))}" target="_blank" rel="noopener">${NAV} Tankstopp</a>
            <button class="btn secondary" data-rtmap="${esc(bestValue.id)}">${say("Uff dr Kart", "Auf Karte")}</button></div></section>`;
      }
    } else if (list.length) h += `<div class="card empty"><div class="bigic">🌙</div><b>${say("Grad hot älles zu am Weg", "Gerade alles zu an der Strecke")}</b><p>${say(`Koi offene Tankstell mit ${FUELS[fuel]} uff dr Strecke.`, `Keine geöffnete Tankstelle mit ${FUELS[fuel]} an der Strecke.`)}</p></div>`;
    h += `<div class="card mapcard rtmapcard" id="rtmapslot"></div>`;
    // Liste
    h += `<div class="sec"><h2>${say("Tankstella am Weg", "Tankstellen an der Strecke")}</h2><span class="sub">± ${S.corr} km</span></div>`;
    if (!list.length) {
      h += `<div class="card empty"><div class="bigic">⛽</div><b>${say("Koi Tankstell am Weg", "Keine Tankstelle an der Strecke")}</b>
        <p>${u.km > 0.5 ? say("Für die Strecke fehlet no Preisdaten.", "Für diese Strecke fehlen noch Preisdaten.") : say(`Im Abstand vo ${S.corr} km isch nix.`, `Im Abstand von ${S.corr} km gibt es keine.`)}</p>
        ${S.corr < 5 ? `<button class="btn secondary" data-rtcorr="5">${say("Auf 5 km erweitera", "Auf 5 km erweitern")}</button>` : ""}</div>`;
      return h;
    }
    h += `<div class="chips">
      <button class="chip ${S.sort === "route" ? "on" : ""}" data-rtsort="route">${say("Nach Strecke", "Nach Strecke")}</button>
      <button class="chip ${S.sort === "price" ? "on" : ""}" data-rtsort="price">Nach Preis</button>
      <button class="chip ${S.sort === "value" ? "on" : ""}" data-rtsort="value">Inkl. Umweg</button>
      <button class="chip ${onlyOpen ? "on" : ""}" data-rtonly>Nur geöffnete</button></div>${LV_LEGEND}`;
    const rows = displayRows(list), n = S.all ? rows.length : 10;
    h += `<div class="list rtlist">` + rows.slice(0, n).map((s) => item(s, cheapest, lv)).join("");
    if (rows.length > 10) h += `<button class="morebtn" data-rtall>${S.all ? say("Weniger aazeige", "Weniger anzeigen") : say(`Älle ${rows.length} aazeige`, `Alle ${rows.length} anzeigen`)}</button>`;
    if (!rows.length) h += `<div class="empty">${say("Grad hot koine offa.", "Gerade hat keine Tankstelle geöffnet.")}</div>`;
    return h + `</div>`;
  }
  // Reihenfolge der Liste (auch für den Sprung von der Karte zur Zeile)
  function displayRows(list) {
    const rows = onlyOpen ? list.filter((s) => has(s)) : list.slice();
    if (S.sort === "price") rows.sort((a, b) => (has(b) - has(a)) || (pf(a) ?? 9) - (pf(b) ?? 9) || a.alongKm - b.alongKm);
    if (S.sort === "value") rows.sort((a, b) => (has(b) - has(a)) || (a.fillCost ?? 1e9) - (b.fillCost ?? 1e9) || a.alongKm - b.alongKm);
    return rows;
  }
  function item(s, cheapest, lv) {
    const p = has(s), o = s.o, sch = schedule(s, new Date(s.eta)), d = p && cheapest ? pf(s) - pf(cheapest) : null, open = S.open === s.id;
    return `<div class="rtitem${open ? " open" : ""}" id="rt-${esc(s.id)}">
      <button class="item${p ? "" : " closed"}" data-rtst="${esc(s.id)}" aria-expanded="${open}">
        ${badge(s, lv(s))}
        <div class="info"><div class="name"><span>${esc(s.brand)}</span>${isFav(s.id) ? `<span class="favstar">★</span>` : ""}${o && sch?.short ? `<span class="tag">${esc(sch.short)}</span>` : ""}</div>
          <div class="addr">${whenTxt(s)} · ${offTxt(s)} · ${esc(s.place)}</div></div>
        <div class="p">${p ? `<b>${s.pfc[fuel] ? "≈" : ""}${price(pf(s))}</b><div class="d">${d ? ct(d) : say("billigschde", "günstigste")}</div>` : `<div class="d">${o ? "kein " + FUELS[fuel] : "geschlossen"}${!o && sch?.short ? "<br>" + esc(sch.short) : ""}</div>`}</div>
      </button>${open ? detailHtml(s) : ""}</div>`;
  }
  function detailHtml(s) {
    const sch = schedule(s, new Date(s.eta)), o = s.o, later = s.eta - Date.now() >= SOON;
    return `<div class="rtdet">
      <div class="fuelgrid">${Object.keys(FUELS).map((f) => `<div class="ftile${f === fuel ? " on" : ""}"><div class="n">${FUELS[f]}</div><b>${has(s, f) ? (s.pfc[f] ? "≈" : "") + price(pf(s, f)) : "–"}</b>${s.pfc[f] && s[f] != null ? `<div class="r">jetzt ${eurX(s[f])}</div>` : ""}</div>`).join("")}</div>
      <div class="sub">${esc(s.street)}, ${esc(s.place)} · ${later ? `${say("Ankunft", "Ankunft")} ≈ ${hm2(s.eta)} Uhr · ` : ""}${o ? (sch?.text ? esc(sch.text) : "geöffnet") : `${later ? say("dann zu", "dann geschlossen") : "geschlossen"}${sch?.short ? " · " + esc(sch.short) : ""}`}<br>
        ${say("Umweg", "Umweg")} ${s.exact ? `${km(s.detourKm)} · +${minTxt(s.detourMin)}` : `≈ ${km(s.detourKm)} (${say("gschätzt", "geschätzt")})`}${s.fillCost != null && has(s) ? ` · ${say("Tankfüllung inkl. Umweg", "Tankfüllung inkl. Umweg")} ${eur2(s.fillCost)}` : ""}</div>
      <div class="row"><a class="btn" href="${esc(gmaps(s))}" target="_blank" rel="noopener">${NAV} Tankstopp (Google Maps)</a>
        <a class="btn secondary" href="${esc(apple(s))}" target="_blank" rel="noopener">Apple Karten</a>
        <button class="btn secondary" data-rtmap="${esc(s.id)}">${say("Uff dr Kart", "Auf Karte")}</button>
        ${byId(s.id) ? `<button class="btn secondary" data-detail="${esc(s.id)}">Details</button>` : ""}</div></div>`;
  }
  // Countdown bis zur nächsten erlaubten Live-Abfrage
  let tickT = null;
  function tick() {
    clearTimeout(tickT);
    tickT = setTimeout(() => {
      const el = document.querySelector("#rtBody .rtcool");
      if (!el) return;
      const left = Math.ceil(tkWait() / 1000);
      if (left <= 0) return paint();
      el.textContent = left; tick();
    }, 1000);
  }

  // ---- Karte (eigene Leaflet-Instanz, damit die Karte im Bereich Preise unberührt bleibt)
  const rtEl = document.createElement("div"); rtEl.id = "rtmap";
  let rtMap = null, rtLayer = null, rtLine = null, rtKey = "", rtFocus = null;
  async function mountMap() {
    const slot = $("#rtmapslot");
    if (!slot) return;
    slot.append(rtEl);
    try { await loadLeaflet(); } catch (e) { slot.innerHTML = `<div class="empty">${esc(e.message)}.</div>`; return; }
    if (!document.body.contains(rtEl)) return;
    if (!rtMap) {
      rtMap = L.map(rtEl, { zoomControl: false, zoomSnap: 0.5 });
      rtMap.attributionControl.setPrefix(false);
      rtEl.classList.add("osm");
      L.tileLayer(TILES[0].url(), { maxZoom: 19, attribution: TILES[0].attribution }).addTo(rtMap);
      rtLine = L.layerGroup().addTo(rtMap);
      rtLayer = L.layerGroup().addTo(rtMap);
      rtMap.on("moveend", drawMarkers);
    }
    rtMap.invalidateSize();
    const R = S.route;
    if (rtKey !== R.key + R.pts.length) {
      rtKey = R.key + R.pts.length;
      rtLine.clearLayers();
      L.polyline(R.pts, { color: "#1b1300", weight: 8, opacity: 0.35, interactive: false }).addTo(rtLine);
      L.polyline(R.pts, { color: "#f5b800", weight: 5, opacity: 0.95, interactive: false }).addTo(rtLine);
      L.marker(R.pts[0], { icon: L.divIcon({ className: "mk", html: '<div class="me"></div>', iconSize: [0, 0] }), interactive: false, keyboard: false }).addTo(rtLine);
      L.marker(R.pts.at(-1), { icon: L.divIcon({ className: "mk", html: '<div class="rtgoal">🏁</div>', iconSize: [0, 0] }), interactive: false, keyboard: false }).addTo(rtLine);
    }
    if (rtFocus) { rtMap.setView([rtFocus.lat, rtFocus.lng], 14); rtFocus = null; S.fit = false; }
    else if (S.fit) { S.fit = false; rtMap.fitBounds(L.latLngBounds(R.pts), { padding: [18, 18] }); }
    drawMarkers();
  }
  // Preis-Schilder für die günstigsten sichtbaren Tankstellen, sonst Punkte (höchstens 200 Marker)
  function drawMarkers() {
    if (!rtMap || !rtLayer || !document.body.contains(rtEl)) return;
    rtLayer.clearLayers();
    const b = rtMap.getBounds().pad(0.1), lv = lastLv;
    const vis = lastList.filter((s) => b.contains([s.lat, s.lng]) && (!onlyOpen || has(s)));
    const priced = vis.filter((s) => has(s)).sort((x, y) => pf(x) - pf(y));
    const best = lastList.filter((s) => has(s)).sort((x, y) => pf(x) - pf(y))[0];
    const pins = new Set(), placed = [];
    for (const s of priced) {
      if (pins.size >= 25) break;
      const pt = rtMap.latLngToContainerPoint([s.lat, s.lng]);
      if (placed.every((q) => Math.abs(q.x - pt.x) > 78 || Math.abs(q.y - pt.y) > 30)) { pins.add(s.id); placed.push(pt); }
    }
    const shown = [...priced, ...vis.filter((s) => !has(s))].slice(0, 200);
    for (const s of shown) {
      const isPin = pins.has(s.id);
      const html = isPin ? `<div class="pin lv-${lv(s)}${s.id === best?.id ? " best" : ""}"><i></i><span>${price(pf(s))}</span></div>` : `<div class="dotm lv-${lv(s)}"></div>`;
      L.marker([s.lat, s.lng], { icon: L.divIcon({ className: "mk", html, iconSize: [0, 0] }), zIndexOffset: isPin ? 3000 - priced.indexOf(s) : 0, keyboard: false, title: `${s.brand}, ${s.place}` })
        .on("click", () => { S.open = s.id; S.all = S.all || displayRows(lastList).findIndex((x) => x.id === s.id) >= 10; paint(); document.getElementById("rt-" + s.id)?.scrollIntoView({ block: "center", behavior: "smooth" }); })
        .addTo(rtLayer);
    }
  }

  // ---- Start/Ziel wählen (Dialog): Mein Standort, Bases, zuletzt gesucht, Suche (nur beim Absenden)
  function openPick(w) {
    S.picking = w;
    $("#rtDlgTitle").textContent = w === "a" ? say("Start wähla", "Start wählen") : say("Ziel wähla", "Ziel wählen");
    $("#rtHits").innerHTML = ""; $("#rtQ").value = "";
    const opt = (k, ic, t, sub) => `<button class="opt" data-rtset="${esc(k)}">${ic}<div class="t"><div>${esc(t)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div></button>`;
    $("#rtDlgBody").innerHTML = `<div class="grouplabel">${say("Schnellwahl", "Schnellwahl")}</div><div class="optgroup">
      ${opt("gps", ptIcon({ kind: "gps" }), "Mein Standort", "per Standortfreigabe")}
      ${bases.map((b) => opt("base:" + b.id, ptIcon({ kind: "base", baseId: b.id }), b.name, b.place)).join("")}</div>
      ${S.recent.length ? `<div class="grouplabel">${say("Zletscht gsucht", "Zuletzt gesucht")}</div><div class="optgroup">${S.recent.map((p, i) => opt("recent:" + i, ptIcon(p), p.label, p.sub)).join("")}</div>` : ""}
      <div class="grouplabel">${say("Ort sucha", "Ort suchen")}</div>`;
    $("#dlgRt").showModal();
  }
  function setPoint(p) {
    if (S.picking === "a") S.a = p; else S.b = p;
    store.setJ(S.picking === "a" ? "rtA" : "rtB", p.kind === "gps" ? { kind: "gps", label: "Mein Standort" } : p);
    if (p.kind === "place") { S.recent = [p, ...S.recent.filter((x) => x.label !== p.label || x.sub !== p.sub)].slice(0, 5); store.setJ("rtRecent", S.recent); }
    $("#dlgRt").close();
    S.err = null;
    if (S.a && S.b) go(); else paint();
  }
  $("#dlgRt").addEventListener("click", (e) => {
    const b = e.target.closest("[data-rtset],[data-rthit]");
    if (!b) return;
    if (b.dataset.rthit != null) return setPoint(hits[+b.dataset.rthit]);
    const k = b.dataset.rtset;
    if (k === "gps") return setPoint({ kind: "gps", label: "Mein Standort" });
    if (k.startsWith("base:")) { const x = bases.find((y) => y.id === k.slice(5)); return x && setPoint({ kind: "base", baseId: x.id, label: baseLabel(x) }); }
    if (k.startsWith("recent:")) return setPoint(S.recent[+k.slice(7)]);
  });
  let hits = [];
  $("#rtSearch").addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("#rtQ").value.trim(), btn = $("#rtSearch button");
    if (!q || btn.disabled) return;
    btn.disabled = true;
    $("#rtHits").innerHTML = `<div class="sub" style="padding:8px 4px">Suche …</div>`;
    try {
      hits = (await geoSearch(q)).map((x) => ({ kind: "place", lat: x.lat, lng: x.lng, label: x.label, sub: x.sub }));
      $("#rtHits").innerHTML = hits.length ? hits.map((x, i) => `<button class="opt" data-rthit="${i}"><div class="ic pl">⌖</div><div class="t"><div>${esc(x.label)}</div><div class="sub">${esc(x.sub)}</div></div></button>`).join("")
        : `<div class="sub" style="padding:8px 4px">Nichts gefunden.</div>`;
    } catch { $("#rtHits").innerHTML = `<div class="sub" style="padding:8px 4px">Suche gerade nicht möglich.</div>`; }
    finally { btn.disabled = false; }
  });
  $("#btnRtClose").addEventListener("click", () => $("#dlgRt").close());

  // ---- Bedienung
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-rtpick],[data-rtswap],[data-rtgo],[data-rtcorr],[data-rtsort],[data-rtonly],[data-rtall],[data-rtst],[data-rtmap],[data-rtlive],[data-rtsave],[data-rtsaved],[data-rtunsave],[data-rtdepnow]");
    if (!el || !el.closest("#rtBody")) return;
    const d = el.dataset;
    if (d.rtpick) return openPick(d.rtpick);
    if (el.hasAttribute("data-rtswap")) {
      if (!S.b) return;
      [S.a, S.b] = [S.b, S.a];
      store.setJ("rtA", S.a.kind === "gps" ? { kind: "gps", label: "Mein Standort" } : S.a);
      store.setJ("rtB", S.b.kind === "gps" ? { kind: "gps", label: "Mein Standort" } : S.b);
      return S.route || S.busy ? go() : paint();   // läuft gerade eine Berechnung: mit getauschten Punkten neu
    }
    if (el.hasAttribute("data-rtgo")) return go();
    if (el.hasAttribute("data-rtsave")) {
      const R = S.route, i = S.saved.findIndex((x) => samePt(x.a, R.a) && samePt(x.b, R.b));
      if (i >= 0) S.saved.splice(i, 1); else S.saved = [{ a: R.a, b: R.b }, ...S.saved].slice(0, 6);
      store.setJ("rtSaved", S.saved);
      toast(i >= 0 ? say("Strecke vergessa.", "Strecke entfernt.") : say("★ Strecke gmerkt – oba mit oim Tipp aufrufbar.", "★ Strecke gemerkt – oben mit einem Tipp aufrufbar."));
      return paint();
    }
    if (d.rtsaved != null) {
      const x = S.saved[+d.rtsaved];
      if (!x) return;
      S.a = x.a; S.b = x.b; store.setJ("rtA", x.a); store.setJ("rtB", x.b);
      return go();
    }
    if (d.rtunsave != null) { S.saved.splice(+d.rtunsave, 1); store.setJ("rtSaved", S.saved); return paint(); }
    if (el.hasAttribute("data-rtdepnow")) { S.depart = null; return paint(); }
    if (d.rtcorr) { S.corr = +d.rtcorr; store.set("rtCorr", d.rtcorr); return paint(); }
    if (d.rtsort) { S.sort = d.rtsort; store.set("rtSort", d.rtsort); return paint(); }
    if (el.hasAttribute("data-rtonly")) { onlyOpen = !onlyOpen; store.set("onlyOpen", onlyOpen ? "1" : "0"); return paint(); }
    if (el.hasAttribute("data-rtall")) { S.all = !S.all; return paint(); }
    if (el.hasAttribute("data-rtlive")) return loadLiveNext();
    if (d.rtst) { S.open = S.open === d.rtst ? null : d.rtst; return paint(); }
    if (d.rtmap) {
      const s = lastList.find((x) => x.id === d.rtmap);
      if (!s) return;
      rtFocus = s; S.open = s.id; paint();
      $("#rtmapslot")?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  });

  document.addEventListener("change", (e) => {
    if (e.target.id !== "rtDep") return;
    const t = e.target.value ? new Date(e.target.value).getTime() : NaN;
    S.depart = Number.isFinite(t) && t > Date.now() + 60000 ? t : null;
    paint();
  });

  restoreLast();
  function render() {
    const main = $("#main");
    if (!$("#rtBody")) main.innerHTML = `<div id="rtBody"></div>`;
    paint();
    if (S.route) ensureBases();
  }
  return { render };
})();
