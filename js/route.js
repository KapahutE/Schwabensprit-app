// Schwabensprit – Bereich „Route“: Strecke planen und die Tankstellen am Weg zeigen.
// Routing: FOSSGIS-Dienst (OSRM, Ausweich: Valhalla), Ortssuche: Nominatim – Adressen in endpoints.json.
// Preise am Weg: zuerst die Daten der Bases (keine Abfrage). Für Abschnitte außerhalb mit eigenem
// Tankerkönig-Schlüssel höchstens eine Live-Abfrage pro Minute und nur auf Nutzeraktion (Tankerkönig-Regeln).
// Geometrie (Abstand zur Strecke, Kilometer ab Start, Umweg): js/routegeo.js.
// Alle Teile sind klassische Skripte und teilen sich den globalen Gültigkeitsbereich – Reihenfolge in index.html beachten.

const Route = (() => {
  const CORRS = [1, 2, 5], LIVE_GAP = 60000, LIVE_KEEP = 30 * 60000, TK_RAD = 25;
  const S = {
    a: store.getJ("rtA", { kind: "gps", label: "Mein Standort" }),   // {kind: gps|base|place, label, sub?, lat?, lng?, baseId?}
    b: store.getJ("rtB", null),
    corr: CORRS.includes(+store.get("rtCorr", "2")) ? +store.get("rtCorr", "2") : 2,
    sort: ["route", "price", "value"].includes(store.get("rtSort", "")) ? store.get("rtSort", "") : "route",
    recent: store.getJ("rtRecent", []),
    route: null, busy: false, err: null, open: null, all: false, fit: false,
    live: [], liveAt: 0, liveBusy: false, picking: null,
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ll = (p) => `${(+p.lat).toFixed(6)},${(+p.lng).toFixed(6)}`;
  const fetchT = (url, ms = 15000) => {   // mit Zeitlimit, damit „Mir rechnet …“ nicht ewig steht
    const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
    return fetch(url, { signal: c.signal }).finally(() => clearTimeout(t));
  };

  // ---- Route berechnen (1 Anfrage je Nutzeraktion, ≥ 1 s Abstand, 10 Min. zwischengespeichert)
  const cache = new Map();
  let routeLast = 0;
  const noRoute = () => Object.assign(new Error("noroute"), { noRoute: true });
  async function fetchRoute(A, B) {
    const key = [A.lat, A.lng, B.lat, B.lng].map((v) => v.toFixed(3)).join(",");
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < 10 * 60000) return hit;
    const wait = routeLast + 1100 - Date.now();
    if (wait > 0) await sleep(wait);
    routeLast = Date.now();
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
  async function coords(p) {
    if (p.kind === "gps") {
      try { const c = await getPosition(); return { lat: c.latitude, lng: c.longitude }; }
      catch (e) { throw Object.assign(e, { user: true }); }
    }
    if (p.kind === "base") {
      const b = bases.find((x) => x.id === p.baseId);
      if (!b) throw Object.assign(new Error("Diese Base gibt es nicht mehr."), { user: true });
      return { lat: b.lat, lng: b.lng };
    }
    return { lat: +p.lat, lng: +p.lng };
  }
  async function go() {
    if (S.busy || !S.b) return;
    S.busy = true; S.err = null; paint();
    try {
      const A = await coords(S.a), B = await coords(S.b);
      if (distKm(A.lat, A.lng, B.lat, B.lng) < 1)
        throw Object.assign(new Error(say("Start ond Ziel sen fast am gleicha Fleck.", "Start und Ziel liegen fast am selben Ort.")), { user: true });
      const r = await fetchRoute(A, B);
      S.route = { ...r, A, B, gps: S.a.kind === "gps", index: routeIndex(r.pts), from: S.a.label, to: S.b.label };
      S.open = null; S.all = false; S.fit = true;
      S.busy = false; paint();
      await ensureBases();
      // außerhalb der Bases: höchstens eine Live-Abfrage für diese Aktion (Tankerkönig: 1/Minute)
      if (store.get("tk", "") && uncovered().km > 0.5 && Date.now() - S.liveAt >= LIVE_GAP) await loadLiveNext();
    } catch (e) {
      S.err = e.noRoute ? say("Do goht koi Weg na – Start oder Ziel liegt z'weit weg vo dr Stroß.", "Keine Route gefunden – Start oder Ziel liegt zu weit von einer Straße entfernt.")
        : e.user ? e.message
        : `${say("Dr Routendienst isch grad net z'erreicha.", "Der Routendienst ist gerade nicht erreichbar.")} (${e.name === "AbortError" ? "Zeitüberschreitung" : e.message})`;
    } finally { S.busy = false; paint(); }
  }

  // ---- Preise am Weg: Bases zuerst, Live-Abschnitte nur auf Knopfdruck
  async function ensureBases() {
    const R = S.route;
    if (!R) return;
    const need = bases.filter((b) => !baseCache[b.id] && nearestOnRoute(R.index, b.lat, b.lng, b.radius_km + CORRS.at(-1) + 1));
    if (!need.length) return;
    await Promise.all(need.map((b) => loadBaseData(b).catch(() => null)));
    paint();
  }
  const coveredBy = (lat, lng) =>
    bases.some((b) => distKm(lat, lng, b.lat, b.lng) <= b.radius_km - S.corr)
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
    if (Date.now() - S.liveAt < LIVE_GAP) return toast(say("Tankerkönig erlaubt bloß oi Abfrag pro Minut – glei wieder.", "Tankerkönig erlaubt nur eine Abfrage pro Minute – gleich wieder."));
    const u = uncovered();
    if (u.from == null) return;
    // Kreis (25 km) so legen, dass er den ersten Abschnitt ohne Preise samt Korridor abdeckt
    const [lat, lng] = routePointAt(R.index, Math.min(R.index.totalKm, u.from + (TK_RAD - S.corr - 1) * 0.9));
    S.liveBusy = true; S.liveAt = Date.now(); paint();
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
  const has = (s, f = fuel) => isOpen(s) && s[f] != null;

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
  const offTxt = (s) => s.offKm < 0.15 ? say("direkt am Weg", "direkt an der Strecke") : `${km(s.offKm)} ${say("ab", "abseits")}`;
  const baseLabel = (b) => (b.name + b.place).length <= 20 ? `${b.name} · ${b.place}` : b.name;   // wie bei der Ortswahl
  const ptIcon = (p) => p?.kind === "gps" ? `<div class="ic gps"><svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M21.7 2.3a1 1 0 0 0-1.1-.2l-18 8a1 1 0 0 0 .1 1.9l7.4 2 2 7.4a1 1 0 0 0 1.9.1l8-18a1 1 0 0 0-.3-1.2z"/></svg></div>`
    : p?.kind === "base" ? `<div class="ic">${esc(p.baseId || "B")}</div>` : `<div class="ic pl">⌖</div>`;
  const ptBtn = (w, p) => `<button class="opt rtpt" data-rtpick="${w}" aria-label="${w === "a" ? "Start" : "Ziel"} wählen">${ptIcon(p)}
    <div class="t"><div class="sub">${w === "a" ? "Start" : "Ziel"}</div><div>${p ? esc(p.label) : `<span class="sub">${say("Ziel wähla …", "Ziel wählen …")}</span>`}</div></div></button>`;

  function formHtml() {
    return `<section class="card rtform"><span class="eyebrow">${say("Wo fahrsch na?", "Wohin geht's?")}</span>
      <div class="rtpts">${ptBtn("a", S.a)}${ptBtn("b", S.b)}
        <button class="rtswap" data-rtswap type="button" aria-label="Start und Ziel tauschen"${S.b ? "" : " disabled"}>⇅</button></div>
      <div class="chips rtcorr"><span class="lbl">${say("Vom Weg", "Abstand")}</span>
        ${CORRS.map((c) => `<button class="chip ${c === S.corr ? "on" : ""}" data-rtcorr="${c}" aria-pressed="${c === S.corr}">${c} km</button>`).join("")}</div>
      <button class="btn block" data-rtgo type="button"${S.b && !S.busy ? "" : " disabled"}>${S.busy ? `<span class="spin-dot"></span> ${say("Mir rechnet …", "Route wird berechnet …")}` : say("Route berechna", "Route berechnen")}</button></section>`;
  }
  function paint() {
    const el = $("#rtBody");
    if (!el) return;
    let h = formHtml();
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
    const list = stationsAlongRoute(R.index, candidates(), { corridorKm: S.corr, fuel, roadFactor: ROAD, tankL: TANK(), consL100: CONS() });
    const priced = list.filter((s) => has(s));
    const { cheapest, bestValue } = bestPicks(priced, fuel);
    const med = median(priced.map((s) => s[fuel]));
    const lv = (s) => !has(s) || med == null ? "off" : s[fuel] <= med - 0.0095 ? "lo" : s[fuel] >= med + 0.0095 ? "hi" : "mid";
    lastList = list; lastLv = lv;
    const u = uncovered(), key = store.get("tk", "");
    let h = `<section class="card rtsum" aria-live="polite"><span class="eyebrow">${say("Dei Strecke", "Deine Strecke")} · ${FUELS[fuel]} · ± ${S.corr} km</span>
      <div class="big">${km(R.km).replace(",0 km", " km")} · ≈ ${dur(Math.max(1, Math.round(R.sec / 60)))}</div>
      <div class="sub">${esc(R.from)} → ${esc(R.to)} · ${list.length} ${list.length === 1 ? say("Tankstell", "Tankstelle") : say("Tankstella", "Tankstellen")} ${say("am Weg", "an der Strecke")}</div></section>`;
    // Abschnitte ohne Preise
    if (u.km > 0.5) {
      const cool = Math.ceil((LIVE_GAP - (Date.now() - S.liveAt)) / 1000);
      h += `<div class="card notice"><span class="ic">ℹ️</span><div><b>${say(`Uff ${fmtNum(u.km, 0)} km hen mir koine Preise`, `Für ${fmtNum(u.km, 0)} km fehlen Preise`)}</b> – ${say("dort send koine vo deine Bases.", "dort liegt keine deiner Bases.")}<br>
        ${key ? `${say("Mit deim Tankerkönig-Schlüssel kasch abschnittsweis Live-Preise lada (oi Abfrag pro Minut).", "Mit deinem Tankerkönig-Schlüssel lassen sich Live-Preise abschnittsweise laden (eine Abfrage pro Minute).")}
          <div class="row" style="margin-top:10px"><button class="btn secondary" data-rtlive${S.liveBusy || cool > 0 ? " disabled" : ""}>${S.liveBusy ? `<span class="spin-dot"></span> ${say("Lädt …", "Lädt …")}` : cool > 0 ? `${say("Nägschder Abschnitt in", "Nächster Abschnitt in")} <span class="rtcool">${cool}</span> s` : say("Nägschda Abschnitt lada", "Nächsten Abschnitt laden")}</button></div>`
        : `${say("Für Live-Preise trag unter ⚙ dein Tankerkönig-Schlüssel ei.", "Für Live-Preise unter ⚙ den Tankerkönig-Schlüssel eintragen.")}<div class="row" style="margin-top:10px"><button class="btn secondary" id="btnSetup">${say("Eistellunga", "Einstellungen")}</button></div>`}</div></div>`;
      if (key && cool > 0 && !S.liveBusy) tick();
    }
    if (cheapest) {
      const avg = mean(priced.map((s) => s[fuel])), save = avg - cheapest[fuel], sch = schedule(cheapest);
      h += `<section class="card hero rthero"><span class="eyebrow">${say("Am billigschde uff dr Strecke", "Günstigste an der Strecke")}</span>
        <div class="pricerow"><div class="price">${priceN(cheapest[fuel])}<span class="cur">€</span></div>
          ${priced.length > 1 && save > 0.0005 ? `<div class="save"><span class="eyebrow">${say("Gspart", "Ersparnis")}</span><b>${eur2(save * TANK())}</b><span>bei ${fmtNum(TANK(), 0)} l ggü. Ø</span></div>` : ""}</div>
        <div class="station">${badge(cheapest, lv(cheapest), "lg")}<div style="min-width:0"><div class="where">${esc(cheapest.brand)} · ${esc(cheapest.place)}</div>
          <div class="sub">${say("nach", "nach")} ${km(cheapest.alongKm)} · ${offTxt(cheapest)}${isOpen(cheapest) && sch?.short ? " · " + esc(sch.short) : ""}</div></div></div>
        ${SW() && priced.length > 1 && save > 0.0005 ? `<p class="quip">🥨 ${brezel(save * TANK())}</p>` : ""}
        <div class="row two"><a class="btn" href="${esc(gmaps(cheapest))}" target="_blank" rel="noopener">${NAV} ${say("Tankstopp", "Tankstopp")}</a>
          <button class="btn secondary" data-rtmap="${esc(cheapest.id)}">${say("Uff dr Kart", "Auf Karte")}</button></div></section>`;
      if (bestValue && bestValue.id !== cheapest.id && cheapest.fillCost - bestValue.fillCost > 0.05) {
        const gain = cheapest.fillCost - bestValue.fillCost;
        h += `<section class="card valuecard"><div class="tiphead"><div class="ic">🚗</div><div><b>${say("Lohnt sich am meischda", "Lohnt sich am meisten")}</b>
          <div class="sub">${say("inkl. Umweg", "inkl. Umweg")} · ${fmtNum(TANK(), 0)} l · ${fmtNum(CONS(), 1)} l/100 km</div></div></div>
          <div class="station" style="margin-top:14px">${badge(bestValue, lv(bestValue))}<div style="min-width:0;flex:1"><div class="where" style="font-size:16px">${esc(bestValue.brand)} · ${esc(bestValue.place)}</div>
            <div class="sub">${say("nach", "nach")} ${km(bestValue.alongKm)} · ${offTxt(bestValue)}</div></div><div class="price1">${price(bestValue[fuel])}</div></div>
          <p class="verdict">${say(`A bissle deirer, aber näher am Weg: unterm Strich <b>${eur2(gain)} billiger</b> als dr Billigschde (${km(cheapest.detourKm)} Umweg).`,
            `Etwas teurer, aber näher an der Strecke: unterm Strich <b>${eur2(gain)} günstiger</b> als die Günstigste (${km(cheapest.detourKm)} Umweg).`)}</p>
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
    let rows = onlyOpen ? list.filter((s) => has(s)) : list.slice();
    if (S.sort === "price") rows.sort((a, b) => (has(b) - has(a)) || (a[fuel] ?? 9) - (b[fuel] ?? 9) || a.alongKm - b.alongKm);
    if (S.sort === "value") rows.sort((a, b) => (has(b) - has(a)) || (a.fillCost ?? 1e9) - (b.fillCost ?? 1e9) || a.alongKm - b.alongKm);
    const n = S.all ? 80 : 10;
    h += `<div class="list rtlist">` + rows.slice(0, n).map((s) => item(s, cheapest, lv)).join("");
    if (rows.length > n) h += `<button class="morebtn" data-rtall>${S.all ? `… ${say("ond no", "und")} ${rows.length - n} ${say("weitere", "weitere")}` : say(`Älle ${rows.length} aazeige`, `Alle ${rows.length} anzeigen`)}</button>`;
    else if (S.all && rows.length > 10) h += `<button class="morebtn" data-rtall>${say("Weniger aazeige", "Weniger anzeigen")}</button>`;
    if (!rows.length) h += `<div class="empty">${say("Grad hot koine offa.", "Gerade hat keine Tankstelle geöffnet.")}</div>`;
    return h + `</div>`;
  }
  function item(s, cheapest, lv) {
    const p = has(s), o = isOpen(s), sch = schedule(s), d = p && cheapest ? s[fuel] - cheapest[fuel] : null, open = S.open === s.id;
    return `<div class="rtitem${open ? " open" : ""}" id="rt-${esc(s.id)}">
      <button class="item${p ? "" : " closed"}" data-rtst="${esc(s.id)}" aria-expanded="${open}">
        ${badge(s, lv(s))}
        <div class="info"><div class="name"><span>${esc(s.brand)}</span>${isFav(s.id) ? `<span class="favstar">★</span>` : ""}${o && sch?.short ? `<span class="tag">${esc(sch.short)}</span>` : ""}</div>
          <div class="addr">${say("nach", "nach")} ${km(s.alongKm)} · ${offTxt(s)} · ${esc(s.place)}</div></div>
        <div class="p">${p ? `<b>${price(s[fuel])}</b><div class="d">${d ? ct(d) : say("billigschde", "günstigste")}</div>` : `<div class="d">${o ? "kein " + FUELS[fuel] : "geschlossen"}${!o && sch?.short ? "<br>" + esc(sch.short) : ""}</div>`}</div>
      </button>${open ? detailHtml(s) : ""}</div>`;
  }
  function detailHtml(s) {
    const sch = schedule(s), o = isOpen(s);
    return `<div class="rtdet">
      <div class="fuelgrid">${Object.keys(FUELS).map((f) => `<div class="ftile${f === fuel ? " on" : ""}"><div class="n">${FUELS[f]}</div><b>${has(s, f) ? price(s[f]) : "–"}</b></div>`).join("")}</div>
      <div class="sub">${esc(s.street)}, ${esc(s.place)} · ${o ? (sch?.text ? esc(sch.text) : "geöffnet") : `geschlossen${sch?.short ? " · " + esc(sch.short) : ""}`}<br>
        ${say("Umweg", "Umweg")} ≈ ${km(s.detourKm)}${s.fillCost != null && has(s) ? ` · ${say("Tankfüllung inkl. Umweg", "Tankfüllung inkl. Umweg")} ${eur2(s.fillCost)}` : ""}</div>
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
      const left = Math.ceil((LIVE_GAP - (Date.now() - S.liveAt)) / 1000);
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
    const priced = vis.filter((s) => has(s)).sort((x, y) => x[fuel] - y[fuel]);
    const best = lastList.filter((s) => has(s)).sort((x, y) => x[fuel] - y[fuel])[0];
    const pins = new Set(), placed = [];
    for (const s of priced) {
      if (pins.size >= 25) break;
      const pt = rtMap.latLngToContainerPoint([s.lat, s.lng]);
      if (placed.every((q) => Math.abs(q.x - pt.x) > 78 || Math.abs(q.y - pt.y) > 30)) { pins.add(s.id); placed.push(pt); }
    }
    const shown = [...priced, ...vis.filter((s) => !has(s))].slice(0, 200);
    for (const s of shown) {
      const isPin = pins.has(s.id);
      const html = isPin ? `<div class="pin lv-${lv(s)}${s.id === best?.id ? " best" : ""}"><i></i><span>${price(s[fuel])}</span></div>` : `<div class="dotm lv-${lv(s)}"></div>`;
      L.marker([s.lat, s.lng], { icon: L.divIcon({ className: "mk", html, iconSize: [0, 0] }), zIndexOffset: isPin ? 3000 - priced.indexOf(s) : 0, keyboard: false, title: `${s.brand}, ${s.place}` })
        .on("click", () => { S.open = s.id; S.all = S.all || rowsIndex(s.id) >= 10; paint(); document.getElementById("rt-" + s.id)?.scrollIntoView({ block: "center", behavior: "smooth" }); })
        .addTo(rtLayer);
    }
  }
  const rowsIndex = (id) => lastList.findIndex((s) => s.id === id);

  // ---- Start/Ziel wählen (Dialog): Mein Standort, Bases, zuletzt gesucht, Suche (nur beim Absenden)
  function openPick(w) {
    S.picking = w;
    $("#rtDlgTitle").textContent = w === "a" ? say("Start wähla", "Start wählen") : say("Ziel wähla", "Ziel wählen");
    $("#rtHits").innerHTML = ""; $("#rtQ").value = "";
    const opt = (k, ic, t, sub) => `<button class="opt" data-rtset="${k}">${ic}<div class="t"><div>${esc(t)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div></button>`;
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
    const el = e.target.closest("[data-rtpick],[data-rtswap],[data-rtgo],[data-rtcorr],[data-rtsort],[data-rtonly],[data-rtall],[data-rtst],[data-rtmap],[data-rtlive]");
    if (!el || !el.closest("#rtBody")) return;
    const d = el.dataset;
    if (d.rtpick) return openPick(d.rtpick);
    if (el.hasAttribute("data-rtswap")) {
      if (!S.b) return;
      [S.a, S.b] = [S.b, S.a];
      store.setJ("rtA", S.a.kind === "gps" ? { kind: "gps", label: "Mein Standort" } : S.a);
      store.setJ("rtB", S.b.kind === "gps" ? { kind: "gps", label: "Mein Standort" } : S.b);
      return S.route ? go() : paint();
    }
    if (el.hasAttribute("data-rtgo")) return go();
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

  function render() {
    const main = $("#main");
    if (!$("#rtBody")) main.innerHTML = `<div id="rtBody"></div>`;
    paint();
    if (S.route) ensureBases();
  }
  return { render };
})();
