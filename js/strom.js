// Schwabensprit – E-Modus: Ladestationen mit Ladepreis, Leistung und Belegung.
// Wird über „⚡ Strom“ neben den Kraftstoffsorten ein- und ausgeschaltet und ersetzt dann die Tankstellen im Bereich Preise
// (Verlauf: Hinweis) – der Bereich Route zeigt Ladestationen am Weg.
//
// Datenquelle (Deutschland): MobiData BW „OCPDB“ (api.mobidata-bw.de/ocpdb) – offen, ohne Schlüssel, bundesweit.
//   Standorte:  Bundesnetzagentur Ladesäulenregister (CC BY 4.0), dazu Betreiber-Feeds der Mobilithek (DATEX II, CC0 / CC BY 4.0)
//               mit Belegung in Echtzeit (frei / belegt / gestört).
//   Preise:     Direktbezahlpreise (Ad-hoc, ohne Fahrstromvertrag) aus den Betreiber-Feeds von chargecloud, EcoMovement und EnBW –
//               nur dort, wo der Betreiber sie meldet (im Register selbst stehen keine Preise).
// Anfragen: 1 × Umkreissuche (Mittelpunkt auf ca. 100 m gerundet) je Aktion, Tarife einmal je 12 Std. (≈ 50 KB).
// Alle Teile sind klassische Skripte und teilen sich den globalen Gültigkeitsbereich – Reihenfolge in index.html beachten.

const Strom = (() => {
  const KEEP = 4 * 60000, TAR_KEEP = 12 * 36e5, MAX_KM = 15, PAGE = 1000, MAX_PAGES = 3;
  const KWS = [0, 22, 50, 150];
  const S = {
    key: "", at: 0, stations: [], total: 0, cut: false, busy: false, err: null,
    tar: null, tarErr: false,                       // Tarife: Karte original_id → [Energie €/kWh, Start €, Zeit €/Min., ab Min.]
    minKw: KWS.includes(+store.get("evKw", "0")) ? +store.get("evKw", "0") : 0,
    hideBusy: store.get("evBusy", "0") === "1",
    sort: ["price", "dist", "power"].includes(store.get("evSort", "")) ? store.get("evSort", "") : "price",
    view: store.get("evView", "list") === "map" ? "map" : "list",
    open: null, all: false, focus: null,
  };
  const KWH = () => { const v = parseFloat(String(store.get("kwh", "30")).replace(",", ".")); return v > 0 && v <= 200 ? v : 30; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let seq = 0;

  // ---- Preise: Tarife laden und verdichten
  // Die Quelle meldet „MwSt. nicht enthalten“ nicht verlässlich (bekannter Fehler im Import). Deshalb: volle Cent → Endpreis;
  // ergibt Preis × 1,19 volle Cent → Nettopreis, umrechnen; sonst unverändert (Netto ÷ 1,19 → Endpreis mit mehr Stellen).
  function gross(p) {
    if (!(p > 0)) return p || 0;
    if (Math.abs(p * 100 - Math.round(p * 100)) < 0.03) return p;
    const g = p * 119;
    return Math.abs(g - Math.round(g)) < 0.05 ? p * 1.19 : p;
  }
  function condense(t) {
    let e = null, f = 0, tp = 0, tm = 0;
    for (const el of t.elements || []) {
      const r = el.restrictions || {}, from = Math.round((r.min_duration || 0) / 60);
      for (const pc of el.price_components || []) {
        const p = gross(+pc.price);
        if (pc.type === "ENERGY" && p > 0 && (e == null || p < e)) e = p;   // 0,00 €/kWh sind meist Platzhalter/Testwerte: nicht als „kostenlos“ zeigen
        else if (pc.type === "FLAT" && p > f) f = p;
        else if (pc.type === "TIME" && p > 0 && (tp === 0 || from < tm)) { tp = p; tm = from; }
      }
    }
    return [e, f, tp, tm];
  }
  async function loadTariffs() {
    if (S.tar) return S.tar;
    const c = store.getJ("evTar", null);
    if (c?.m && Date.now() - c.at < TAR_KEEP) return S.tar = c.m;
    const base = (await endpoints()).evApi;
    try {
      const m = {};
      for (let off = 0, n = 1; off < n && off < 5000;) {
        const r = await fetchT(`${base}/ocpi/3.0/tariffs?limit=${PAGE}&offset=${off}`, 20000);
        if (!r.ok) throw new Error(`Tarife ${r.status}`);
        const d = await r.json();
        n = d.total_count || 0;
        for (const t of d.items || []) if (t.original_id) m[t.original_id] = condense(t);
        if (!d.items?.length) break;
        off += d.items.length;
      }
      S.tarErr = false; S.tar = m; store.setJ("evTar", { at: Date.now(), m });
      return m;
    } catch (e) {
      S.tarErr = true;
      if (c?.m) return S.tar = c.m;   // abgelaufen, aber besser als nichts
      throw e;
    }
  }

  // ---- Ladestationen laden und vereinheitlichen
  const STD = { IEC_62196_T2: "Typ 2", IEC_62196_T2_COMBO: "CCS", CHADEMO: "CHAdeMO", DOMESTIC_F: "Schuko", IEC_62196_T1: "Typ 1", IEC_62196_T1_COMBO: "CCS (T1)", TESLA_S: "Tesla" };
  const stdName = (s) => STD[s] || String(s || "?").replace(/^IEC_\d+_/, "").replace(/_/g, " ");
  const stOf = (s) => s === "AVAILABLE" ? "free" : s === "CHARGING" || s === "BLOCKED" || s === "RESERVED" ? "busy" : s === "OUTOFORDER" || s === "INOPERATIVE" || s === "REMOVED" ? "out" : "unk";
  const SRC = { bnetza_api: "Bundesnetzagentur", datex2_chargecloud: "chargecloud", datex2_ecomovement: "EcoMovement", datex2_enbw: "EnBW", datex2_tesla: "Tesla", datex2_e_clearing_net: "e-clearing.net", datex2_midorion: "Midorion", datex2_taubert: "Taubert" };
  const shortOp = (n) => String(n || "").replace(/\b(gmbh|ag|se|kg|mbh|e\.?\s?v\.?|& co\.?|und co\.?|ug \(haftungsbeschränkt\))\b\.?/gi, "").replace(/\s{2,}/g, " ").replace(/[\s,&-]+$/, "").trim();
  function norm(x, c) {
    const la = +x.coordinates?.latitude, ln = +x.coordinates?.longitude;
    if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
    const cons = [], seen = new Set();
    for (const ev of x.evses || []) {
      if (ev.presence === "ABSENT") continue;
      for (const k of ev.connectors || []) {
        const kw = (k.max_electric_power || 0) / 1000;
        cons.push({ std: stdName(k.standard), kw: Math.round(kw * 10) / 10, dc: k.power_type === "DC", tid: k.tariff_ids || [], st: stOf(ev.status), ev: ev.uid });
      }
      seen.add(ev.uid);
    }
    if (!cons.length) return null;
    const op = x.operator?.name || x.owner?.name || x.name || "Ladestation";
    const upd = (x.evses || []).map((e) => e.status_last_updated).filter(Boolean).sort().at(-1) || null;
    return {
      id: "ev" + x.id, uid: x.id, src: x.source, brand: shortOp(op) || op, op, place: tidy(x.city || ""), street: tidy(x.address || ""), plz: x.postal_code || "", lat: la, lng: ln,
      cons, live: cons.some((k) => k.st !== "unk"), upd, hours: x.opening_times || null, phone: x.help_phone || "", name: x.name || "",
      kw: Math.max(...cons.map((k) => k.kw)), dist: c ? distKm(c.lat, c.lng, la, ln) : null,
    };
  }
  // Register und Betreiber melden dieselbe Säule oft doppelt: Register-Eintrag weglassen, wenn ein Betreiber-Eintrag < 60 m daneben liegt
  function dedupe(list) {
    const live = list.filter((s) => s.src !== "bnetza_api");
    const kept = list.filter((s) => s.src !== "bnetza_api" || !live.some((t) => Math.abs(t.lat - s.lat) < 0.0006 && Math.abs(t.lng - s.lng) < 0.0009 && distKm(t.lat, t.lng, s.lat, s.lng) < 0.06));
    // derselbe Betreiber am selben Ort (Parkhaus mit vielen Ladepunkten wird oft als viele Standorte gemeldet): zusammenfassen
    const byOp = new Map(), out = [];
    for (const s of kept) {
      const arr = byOp.get(s.op) || (byOp.set(s.op, []), byOp.get(s.op));
      const o = arr.find((t) => Math.abs(t.lat - s.lat) < 0.0006 && Math.abs(t.lng - s.lng) < 0.0009 && distKm(t.lat, t.lng, s.lat, s.lng) < 0.05);
      if (!o) { const c = { ...s, cons: [...s.cons] }; arr.push(c); out.push(c); }
      else { o.cons.push(...s.cons); o.live ||= s.live; if (s.upd && (!o.upd || s.upd > o.upd)) o.upd = s.upd; o.kw = Math.max(o.kw, s.kw); }
    }
    return out;
  }
  // Alle Ladestationen im Umkreis (Mittelpunkt auf ca. 100 m gerundet); mehrere Seiten, nächste zuerst
  async function fetchRaw(lat, lng, rKm) {
    const base = (await endpoints()).evApi;
    const la = lat.toFixed(3), ln = lng.toFixed(3), out = [];
    let total = 0, cut = false;
    for (let page = 0, off = 0; page < MAX_PAGES; page++) {
      const r = await fetchT(`${base}/v1/locations?lat=${la}&lon=${ln}&radius=${Math.round(rKm * 1000)}&limit=${PAGE}&offset=${off}`, 25000);
      if (!r.ok) throw new Error(`Ladestationen ${r.status}`);
      const d = await r.json();
      total = d.total_count || 0;
      out.push(...(d.items || []));
      if (d.next_offset == null || !d.items?.length) break;
      off = d.next_offset;
      if (page === MAX_PAGES - 1) cut = true;
    }
    return { items: out, total, cut };
  }
  async function fetchArea(lat, lng, rKm, c) {
    const r = await fetchRaw(lat, lng, rKm);
    return { list: dedupe(r.items.map((x) => norm(x, c)).filter(Boolean)), total: r.total, cut: r.cut };
  }
  async function load(force = false) {
    const c = center();
    if (!c) return;
    const rKm = Math.min(radius, MAX_KM), key = `${c.lat.toFixed(3)},${c.lng.toFixed(3)},${rKm}`;
    if (!force && S.key === key && Date.now() - S.at < KEEP) return;
    if (S.busy) return;
    const my = ++seq;
    S.busy = true; S.err = null; paint();
    try {
      const [res] = await Promise.all([fetchArea(c.lat, c.lng, rKm, c), loadTariffs().catch(() => null)]);
      if (my !== seq) return;
      Object.assign(S, { key, at: Date.now(), stations: res.list, total: res.total, cut: res.cut });
      if (!res.list.length) S.err = null;
    } catch (e) {
      if (my !== seq) return;
      S.err = e.name === "AbortError" ? "Zeitüberschreitung" : e.message;
    } finally { if (my === seq) { S.busy = false; paint(); } }
  }

  // ---- Preise und Belegung einer Station (abhängig vom Leistungsfilter)
  const tariffOf = (k) => { let b = null; for (const id of k.tid) { const t = S.tar?.[id]; if (t && (b == null || (t[0] ?? 9) < (b[0] ?? 9))) b = t; } return b; };
  function stationView(s) {
    const cons = s.cons.filter((k) => k.kw >= S.minKw);
    if (!cons.length) return null;
    let best = null;
    for (const k of cons) { const t = tariffOf(k); if (t && t[0] != null && (!best || t[0] < best[0])) best = t; }
    const free = new Set(cons.filter((k) => k.st === "free").map((k) => k.ev)).size, all = new Set(cons.map((k) => k.ev)).size;
    const known = cons.some((k) => k.st !== "unk"), out = known && cons.every((k) => k.st === "out");
    return { s, cons, e: best ? best[0] : null, flat: best ? best[1] : 0, tp: best ? best[2] : 0, tfrom: best ? best[3] : 0, free, all, known, out, full: known && !out && free === 0,
      kw: Math.max(...cons.map((k) => k.kw)), dc: cons.some((k) => k.dc), open: openNow(s) };
  }
  // Öffnungszeiten (OCPI): twentyfourseven oder regular_hours [{weekday 1–7, period_begin, period_end}]
  function openNow(s) {
    const h = s.hours;
    if (!h || h.twentyfourseven) return h?.twentyfourseven ? true : null;
    if (!h.regular_hours?.length) return null;
    const d = new Date(), wd = ((d.getDay() + 6) % 7) + 1, t = d.getHours() * 60 + d.getMinutes();
    const mm = (x) => { const [a, b] = String(x).split(":").map(Number); return a * 60 + (b || 0); };
    return h.regular_hours.some((r) => +r.weekday === wd && t >= mm(r.period_begin) && (t < mm(r.period_end) || r.period_end === "24:00" || r.period_end === "00:00"));
  }
  const ct2 = (v) => eur2s(v) + " €/kWh";
  const stand = () => S.at ? `<i></i>⚡ Stand ${esc(ago(new Date(S.at).toISOString()))}` : "";
  const lvOf = (priced) => {
    const med = median(priced.map((v) => v.e));
    return (v) => v.e == null || med == null ? "off" : v.e <= med - 0.03 ? "lo" : v.e >= med + 0.03 ? "hi" : "mid";
  };

  // ---- Darstellung: Bereich Preise
  const gmaps = (s) => `https://www.google.com/maps/dir/?api=1&destination=${s.lat.toFixed(6)},${s.lng.toFixed(6)}&travelmode=driving`;
  const apple = (s) => `https://maps.apple.com/directions?destination=${s.lat.toFixed(6)},${s.lng.toFixed(6)}&mode=driving`;
  const avail = (v) => v.out ? `<span class="evst out">gestört</span>` : !v.known ? `<span class="evst unk">Belegung unbekannt</span>`
    : v.full ? `<span class="evst busy">belegt</span>` : `<span class="evst ok">${v.free} von ${v.all} frei</span>`;
  const power = (v) => `${v.dc ? "⚡ DC" : "AC"} ${fmtNum(v.kw, v.kw % 1 ? 1 : 0)} kW`;
  function tariffText(v) {
    if (v.e == null) return "";
    const p = [`${ct2(v.e)}`];
    if (v.flat > 0) p.push(`${eur2s(v.flat)} € Startgebühr`);
    if (v.tp > 0) p.push(`${eur2s(v.tp)} €/Min.${v.tfrom ? ` ab ${v.tfrom >= 60 && v.tfrom % 60 === 0 ? v.tfrom / 60 + " Std." : v.tfrom + " Min."}` : ""} Zeitpreis`);
    return p.join(" · ");
  }
  const sessionCost = (v) => v.e == null ? null : v.e * KWH() + v.flat;

  function rows() {
    let all = S.stations.map(stationView).filter(Boolean);
    if (S.hideBusy) all = all.filter((v) => !v.full && !v.out);
    const priced = all.filter((v) => v.e != null);
    const byPrice = (a, b) => a.e - b.e || a.s.dist - b.s.dist;
    let list;
    if (S.sort === "dist") list = [...all].sort((a, b) => a.s.dist - b.s.dist);
    else if (S.sort === "power") list = [...all].sort((a, b) => b.kw - a.kw || a.s.dist - b.s.dist);
    else list = [...priced].sort(byPrice).concat(all.filter((v) => v.e == null).sort((a, b) => a.s.dist - b.s.dist));
    return { all, priced, list };
  }

  function itemHtml(v, lv, cheapestE, where, ctx) {
    const s = v.s, open = (ctx ? RT.open : S.open) === s.id, d = v.e != null && cheapestE != null ? v.e - cheapestE : null;
    return `<div class="rtitem${open ? " open" : ""}" id="ev-${esc(s.id)}">
      <button class="item evi${v.out || v.open === false ? " closed" : ""}" data-evst="${esc(s.id)}" aria-expanded="${open}">
        ${badge(s, lv(v))}
        <div class="info"><div class="name"><span>${esc(s.brand)}</span></div>
          <div class="addr">${where ?? km(s.dist)} · ${power(v)} · ${esc(s.place)}</div>
          <div class="addr">${avail(v)}${v.open === false ? " · <span class=\"evst out\">geschlossen</span>" : ""}</div></div>
        <div class="p">${v.e != null ? `<b>${eur2s(v.e)}</b><div class="d">€/kWh</div><div class="d">${d && d > 0.0049 ? ct(d) : "günstigste"}</div>` : `<div class="d">kein Preis<br>gemeldet</div>`}</div>
      </button>${open ? detailHtml(v, ctx) : ""}</div>`;
  }
  function detailHtml(v, ctx) {
    const s = v.s, groups = new Map();
    for (const k of v.cons) {
      const t = tariffOf(k), key = `${k.std}|${k.kw}|${t ? t.join() : ""}`;
      const g = groups.get(key) || { k, t, n: 0, free: 0, known: false };
      g.n++; if (k.st === "free") g.free++; if (k.st !== "unk") g.known = true; groups.set(key, g);
    }
    const grp = [...groups.values()].sort((a, b) => b.k.kw - a.k.kw);
    const tx = (t) => !t || t[0] == null ? "kein Preis gemeldet" : tariffText({ e: t[0], flat: t[1], tp: t[2], tfrom: t[3] });
    const cost = sessionCost(v), hrs = s.hours?.twentyfourseven ? "24 Std. zugänglich" : s.hours?.regular_hours?.length ? "Zeiten laut Betreiber" : "";
    return `<div class="rtdet">
      <div class="evgrps">${grp.map((g) => `<div class="evgrp"><div class="evk"><b>${esc(g.k.std)}</b><span>${g.k.dc ? "DC" : "AC"} ${fmtNum(g.k.kw, g.k.kw % 1 ? 1 : 0)} kW · ${g.n}×</span></div>
        <div class="evt">${esc(tx(g.t))}</div><div class="evs">${g.known ? `<span class="evst ${g.free ? "ok" : "busy"}">${g.free} von ${g.n} frei</span>` : `<span class="evst unk">Belegung unbekannt</span>`}</div></div>`).join("")}</div>
      <div class="sub">${esc(s.street)}${s.plz || s.place ? ", " : ""}${esc((s.plz + " " + s.place).trim())}${hrs ? " · " + hrs : ""}<br>
        Betreiber: ${esc(s.op)}${s.phone ? ` · <a href="tel:${esc(s.phone.replace(/[^+\d]/g, ""))}">${esc(s.phone)}</a>` : ""}${cost != null ? `<br>≈ ${eur2(cost)} für ${fmtNum(KWH(), 0)} kWh (Direktbezahlung)` : ""}<br>
        <span class="small">Quelle: ${esc(SRC[s.src] || s.src)}${s.upd ? ` · Belegung ${esc(ago(s.upd))}` : ""}</span></div>
      <div class="row"><a class="btn" href="${esc((ctx?.gmaps || gmaps)(s))}" target="_blank" rel="noopener">${NAV} ${ctx ? "Ladestopp (Google Maps)" : "Route (Google Maps)"}</a>
        <a class="btn secondary" href="${esc((ctx?.apple || apple)(s))}" target="_blank" rel="noopener">Apple Karten</a>
        <button class="btn secondary" data-evmap="${esc(s.id)}">Auf Karte</button></div></div>`;
  }
  const NOTE = `Preise: Direktbezahlung (ohne Ladekarte/Fahrstromvertrag) laut Betreiber, inkl. MwSt. – mit Karte oder App oft anders. Nicht jeder Betreiber meldet Preise.`;
  const FOOT = () => `<p class="foot">Ladedaten: <a href="https://mobidata-bw.de/dataset/e-ladesaulen" target="_blank" rel="noopener">MobiData BW (OCPDB)</a> ·
    Standorte: Bundesnetzagentur (CC BY 4.0) · Preise und Belegung: Betreiber über <a href="https://mobilithek.info" target="_blank" rel="noopener">Mobilithek</a> (chargecloud, EcoMovement, EnBW) ·
    Karte © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a></p>`;

  let last = { list: [], lv: () => "mid", priced: [] };
  function bodyHtml() {
    const c = center();
    if (!c) return `<div class="card empty"><div class="bigic">📍</div><b>${say("Ort wähla", "Ort wählen")}</b><p>${say("Für Ladestationen brauch i en Ort – oba links uffs Ortssymbol tippa.", "Für Ladestationen wird ein Ort gebraucht – oben auf den Ort tippen.")}</p></div>`;
    if (S.busy && !S.stations.length) return `<div class="skel" style="height:220px;margin-top:6px"></div><div class="skel" style="height:300px"></div>`;
    if (S.err && !S.stations.length) return `<div class="card notice warnbox"><span class="ic">⚠️</span><div><b>${say("Ladestationa gehet grad net", "Ladestationen gerade nicht verfügbar")}</b><br>${esc(S.err)}
      <div class="row" style="margin-top:10px"><button class="btn" data-evreload>${say("Nomol versuche", "Erneut versuchen")}</button></div></div></div>`;
    const { all, priced, list } = rows(), lv = lvOf(priced);
    last = { list, lv, priced };
    const cheapest = priced.length ? [...priced].sort((a, b) => a.e - b.e || a.s.dist - b.s.dist)[0] : null;
    const med = median(priced.map((v) => v.e)), save = cheapest && med != null ? (med - cheapest.e) * KWH() : 0;
    let h = "";
    if (S.err) h += `<div class="card notice warnbox"><span class="ic">⚠️</span><div>${esc(S.err)} – es werden die zuletzt geladenen Stationen gezeigt.</div></div>`;
    if (S.tarErr && !priced.length) h += `<div class="card notice"><span class="ic">ℹ️</span><div>${say("D'Preis send grad net z'erreicha – d'Stationa sieht mr trotzdem.", "Die Preise sind gerade nicht erreichbar – die Stationen werden trotzdem gezeigt.")}</div></div>`;
    if (cheapest) {
      const s = cheapest.s;
      h += `<section class="card hero evhero"><span class="eyebrow">${say("Am billigschde lada", "Günstigste Ladestation")} · ${radius > MAX_KM ? MAX_KM : radius} km</span>
        <div class="pricerow"><div class="price">${eur2s(cheapest.e)}<span class="cur">€/kWh</span></div>
          ${priced.length > 1 && save > 0.005 ? `<div class="save"><span class="eyebrow">${say("Gspart", "Ersparnis")}</span><b>${eur2(save)}</b><span>bei ${fmtNum(KWH(), 0)} kWh ggü. Ø</span></div>` : ""}</div>
        <div class="station">${badge(s, lv(cheapest), "lg")}<div style="min-width:0"><div class="where">${esc(s.brand)} · ${esc(s.place)}</div>
          <div class="sub">${esc(s.street)} · ${km(s.dist)} · ${power(cheapest)}</div></div></div>
        <div class="row" style="margin-top:8px">${avail(cheapest)}${priced.length > 1 && save > 0.005 ? pill(-(med - cheapest.e), `${ct(cheapest.e - med)} unter Ø`) : ""}</div>
        ${cheapest.flat > 0 || cheapest.tp > 0 ? `<p class="quip">${esc(tariffText(cheapest))}</p>` : ""}
        <div class="row two"><a class="btn" href="${esc(gmaps(s))}" target="_blank" rel="noopener">${NAV} Route</a>
          <button class="btn secondary" data-evst="${esc(s.id)}" data-evgo>Details</button></div></section>`;
    } else if (all.length) h += `<div class="card empty"><div class="bigic">💶</div><b>${say("Koi Preis gmeldet", "Keine Preise gemeldet")}</b><p>${say("Für dui Gegend meldet koi Betreiber Preis. D'Stationa sieht mr trotzdem.", "Für diese Gegend meldet kein Betreiber Preise. Die Stationen stehen unten.")}</p></div>`;
    else h += `<div class="card empty"><div class="bigic">🔌</div><b>${say("Koi Ladestation", "Keine Ladestation")}</b><p>${say(`Im Umkreis vo ${Math.min(radius, MAX_KM)} km hot's koine – Radius größer macha.`, `Im Umkreis von ${Math.min(radius, MAX_KM)} km gibt es keine passende Ladestation – Radius vergrößern oder Filter lockern.`)}</p></div>`;
    h += `<div class="sec"><h2>${say("Ladestationa", "Ladestationen")}</h2>
      <div class="seg mini"><button data-evview="list" class="${S.view === "list" ? "on" : ""}">Liste</button><button data-evview="map" class="${S.view === "map" ? "on" : ""}">Karte</button></div></div>
      <div class="chips evchips"><span class="lbl">${say("Leistung", "Leistung")}</span>${KWS.map((k) => `<button class="chip ${k === S.minKw ? "on" : ""}" data-evkw="${k}" aria-pressed="${k === S.minKw}">${k ? "≥ " + k + " kW" : "Alle"}</button>`).join("")}</div>
      <div class="chips">${S.view === "list" ? `<button class="chip ${S.sort === "price" ? "on" : ""}" data-evsort="price">Nach Preis</button>
        <button class="chip ${S.sort === "dist" ? "on" : ""}" data-evsort="dist">Nach Entfernung</button>
        <button class="chip ${S.sort === "power" ? "on" : ""}" data-evsort="power">Nach Leistung</button>` : ""}
        <button class="chip ${S.hideBusy ? "on" : ""}" data-evbusy aria-pressed="${S.hideBusy}">Ohne belegte</button></div>${LV_LEGEND.replace("± 1 ct zum Median", "± 3 ct zum Median")}`;
    if (S.view === "map") h += `<div class="card mapcard" id="evmapslot"></div>`;
    else {
      const n = S.all ? 80 : 12;
      h += `<div class="list rtlist">` + list.slice(0, n).map((v) => itemHtml(v, lv, cheapest?.e ?? null)).join("");
      if (list.length > 12) h += `<button class="morebtn" data-evall>${S.all ? say("Weniger aazeige", "Weniger anzeigen") : say(`Älle ${list.length} aazeige`, `Alle ${list.length} anzeigen`)}</button>`;
      if (!list.length) h += `<div class="empty">${say("Nix gfunda – Filter lockera.", "Nichts gefunden – Filter lockern.")}</div>`;
      h += `</div>`;
    }
    h += `<p class="small" style="margin:12px 4px 0">${NOTE}</p>`;
    if (S.cut || radius > MAX_KM) h += `<p class="small" style="margin:6px 4px 0">${radius > MAX_KM ? `Für Ladestationen gilt höchstens ${MAX_KM} km Umkreis. ` : ""}${S.cut ? "Sehr viele Stationen – es werden die nächsten gezeigt." : ""}</p>`;
    return h + FOOT();
  }
  function paint() {
    const el = $("#evBody");
    if (!el) return;
    el.innerHTML = bodyHtml();
    const st = $("#stand"); if (st && evMode) { st.className = "stand" + (S.at && Date.now() - S.at < 10 * 60000 ? " fresh" : ""); st.innerHTML = stand(); }
    if (S.view === "map" && $("#evmapslot")) mountMap();
  }

  // ---- Karte (eigene Leaflet-Instanz)
  const mEl = document.createElement("div"); mEl.id = "evmap";
  let map = null, layer = null, fitKey = "";
  async function mountMap() {
    const slot = $("#evmapslot");
    if (!slot) return;
    slot.append(mEl);
    try { await loadLeaflet(); } catch (e) { slot.innerHTML = `<div class="empty">${esc(e.message)}.</div>`; return; }
    if (!document.body.contains(mEl)) return;
    if (!map) {
      map = L.map(mEl, { zoomControl: false, zoomSnap: 0.5 });
      map.attributionControl.setPrefix(false);
      mEl.classList.add("osm");
      L.tileLayer(TILES[0].url(), { maxZoom: 19, attribution: TILES[0].attribution }).addTo(map);
      layer = L.layerGroup().addTo(map);
      map.on("moveend", drawMarkers);
    }
    map.invalidateSize();
    const c = center(), key = `${c.lat},${c.lng},${Math.min(radius, MAX_KM)}`;
    if (S.focus) { map.setView([S.focus.lat, S.focus.lng], 16); S.focus = null; fitKey = key; }
    else if (key !== fitKey) { fitKey = key; map.fitBounds(L.latLng(c.lat, c.lng).toBounds(Math.min(radius, MAX_KM) * 2000), { padding: [8, 8] }); }
    drawMarkers();
  }
  function drawMarkers() {
    if (!map || !layer || !document.body.contains(mEl)) return;
    layer.clearLayers();
    const c = center(), { priced, lv } = last, b = map.getBounds().pad(0.15);
    L.marker([c.lat, c.lng], { icon: L.divIcon({ className: "mk", html: '<div class="me"></div>', iconSize: [0, 0] }), interactive: false, keyboard: false }).addTo(layer);
    const vis = rows().all.filter((v) => b.contains([v.s.lat, v.s.lng]) && !(S.hideBusy && (v.full || v.out)));
    const pr = vis.filter((v) => v.e != null).sort((x, y) => x.e - y.e), best = priced[0] ? [...priced].sort((x, y) => x.e - y.e)[0] : null;
    const pins = new Set(), placed = [];
    for (const v of pr) {
      if (pins.size >= 30) break;
      const pt = map.latLngToContainerPoint([v.s.lat, v.s.lng]);
      if (placed.every((q) => Math.abs(q.x - pt.x) > 70 || Math.abs(q.y - pt.y) > 30)) { pins.add(v.s.id); placed.push(pt); }
    }
    for (const v of vis.slice(0, 400)) {
      const isPin = pins.has(v.s.id), cls = lv(v);
      const html = isPin ? `<div class="pin lv-${cls}${v === best || v.s.id === best?.s.id ? " best" : ""}"><i></i><span>${eur2s(v.e)}</span></div>` : `<div class="dotm lv-${cls}"></div>`;
      L.marker([v.s.lat, v.s.lng], { icon: L.divIcon({ className: "mk", html, iconSize: [0, 0] }), zIndexOffset: isPin ? 3000 - pr.indexOf(v) : 0, keyboard: false, title: `${v.s.brand}, ${v.s.place}` })
        .on("click", () => { S.open = v.s.id; S.view = "list"; store.set("evView", "list"); S.all = true; paint(); document.getElementById("ev-" + v.s.id)?.scrollIntoView({ block: "center", behavior: "smooth" }); })
        .addTo(layer);
    }
  }

  // ---- Bedienung
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-evst],[data-evview],[data-evkw],[data-evsort],[data-evbusy],[data-evall],[data-evmap],[data-evreload],[data-evrsort]");
    if (!el) return;
    if (el.closest("#rtBody")) return routeClick(el);
    if (!el.closest("#evBody")) return;
    const d = el.dataset;
    if (d.evmap) { const v = last.list.find((x) => x.s.id === d.evmap); if (!v) return; S.focus = v.s; S.view = "map"; store.set("evView", "map"); return paint(); }
    if (d.evst) { S.open = S.open === d.evst && !el.hasAttribute("data-evgo") ? null : d.evst; S.all = S.all || last.list.findIndex((x) => x.s.id === d.evst) >= 12; paint(); if (el.hasAttribute("data-evgo")) document.getElementById("ev-" + d.evst)?.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
    if (d.evview) { S.view = d.evview; store.set("evView", d.evview); return paint(); }
    if (d.evkw != null) { S.minKw = +d.evkw; store.set("evKw", String(S.minKw)); return paint(); }
    if (d.evsort) { S.sort = d.evsort; store.set("evSort", d.evsort); return paint(); }
    if (el.hasAttribute("data-evbusy")) { S.hideBusy = !S.hideBusy; store.set("evBusy", S.hideBusy ? "1" : "0"); return paint(); }
    if (el.hasAttribute("data-evall")) { S.all = !S.all; return paint(); }
    if (el.hasAttribute("data-evreload")) return load(true);
  });

  // Bereich Preise / Verlauf im E-Modus
  function render(t) {
    const main = $("#main");
    if (t === "verlauf") {
      main.innerHTML = `<div class="card empty"><div class="bigic">⚡</div><b>${say("Verlauf gibt's bloß für Sprit", "Verlauf gibt es nur für Kraftstoff")}</b>
        <p>${say("Ladepreis ändret sich selte ond werret net protokolliert. Schalt „⚡ Strom“ aus, dass d'Spritpreis-Auswertung siehsch.", "Ladepreise ändern sich selten und werden nicht aufgezeichnet. Mit „⚡ Strom“ wieder auf eine Kraftstoffsorte schalten, um die Auswertung der Spritpreise zu sehen.")}</p></div>`;
      return;
    }
    if (!$("#evBody")) main.innerHTML = `<div id="evBody"></div>`;
    paint();
    load();
  }
  const invalidate = () => { S.at = 0; };

  // ---- Bereich Route: Ladestationen am Weg (alle 20 km ein Umkreis von 15 km, nacheinander)
  const RT = { map: new Map(), centers: new Map(), busy: false, again: null, route: null, err: null, prog: null, ver: 0, memo: null,
    sort: ["route", "price", "power"].includes(store.get("evRSort", "")) ? store.get("evRSort", "") : "route", open: null, all: false, ctx: null, rows: [], lv: () => "mid" };
  const R_KM = 15, STEP = 20, MAX_PTS = 45, CENTER_KEEP = 10 * 60000;
  function alongPts(ix) {
    const pts = [];
    for (let a = 0; a < ix.totalKm && pts.length < MAX_PTS; a += STEP) pts.push(routePointAt(ix, a));
    if (pts.length < MAX_PTS) pts.push([ix.lat[ix.n - 1], ix.lng[ix.n - 1]]);
    return pts;
  }
  async function loadAlong(R, repaint) {
    if (!R) return;
    if (RT.busy) { RT.again = [R, repaint]; return; }
    if (RT.route !== R) { RT.route = R; RT.err = null; }
    const key = (p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
    const pts = alongPts(R.index).filter((p) => { const c = RT.centers.get(key(p)); return !c || Date.now() - c > CENTER_KEEP; });
    if (!pts.length) return;
    RT.busy = true; RT.prog = { done: 0, total: pts.length }; repaint();
    const my = ++seq;
    try {
      await loadTariffs().catch(() => null);
      const c = null;
      for (const [k, p] of pts.entries()) {
        if (RT.route !== R || my !== seq) break;
        if (k) await sleep(400);
        const r = await fetchRaw(p[0], p[1], R_KM);
        for (const x of r.items) { const s = norm(x, c); if (s) RT.map.set(s.uid + "|" + s.src, s); }
        RT.centers.set(key(p), Date.now()); RT.ver++; RT.prog.done = k + 1;
        if (k % 4 === 3) repaint();
      }
      RT.err = null;
    } catch (e) { RT.err = e.name === "AbortError" ? "Zeitüberschreitung" : e.message; }
    finally {
      RT.busy = false; RT.prog = null; repaint();
      if (RT.again) { const [R2, rp] = RT.again; RT.again = null; loadAlong(R2, rp); }
    }
  }
  function alongRows(R, corr) {
    if (!RT.memo || RT.memo.ver !== RT.ver) RT.memo = { ver: RT.ver, list: dedupe([...RT.map.values()]) };
    const cand = [];
    for (const s of RT.memo.list) { const v = stationView(s); if (v && !(S.hideBusy && (v.full || v.out))) cand.push({ id: s.id, lat: s.lat, lng: s.lng, ev: v.e, _v: v }); }
    const near = stationsAlongRoute(R.index, cand, { corridorKm: corr, fuel: "ev", roadFactor: ROAD, tankL: KWH(), consL100: 0 });
    return near.map((x) => ({ ...x._v, along: x.alongKm, off: x.offKm, detour: x.detourKm, min: R.sec / 60 * (R.km ? x.alongKm / R.km : 0) }));
  }
  const detTxt = (r) => r.off < 0.15 ? "direkt an der Strecke" : `${km(r.off)} abseits`;
  const whereTxt = (r) => `${km(r.along)} · ≈ ${dur(Math.max(1, Math.round(r.min)))} · ${detTxt(r)}`;
  function routeHtml(R, ctx) {
    RT.ctx = ctx;
    const rows = alongRows(R, ctx.corr), priced = rows.filter((r) => r.e != null), lv = lvOf(priced);
    let list = rows;
    if (RT.sort === "price") list = [...priced].sort((a, b) => a.e - b.e || a.along - b.along).concat(rows.filter((r) => r.e == null));
    else if (RT.sort === "power") list = [...rows].sort((a, b) => b.kw - a.kw || a.along - b.along);
    else list = [...rows].sort((a, b) => a.along - b.along);
    RT.rows = rows; RT.lv = lv;
    const cheapest = priced.length ? [...priced].sort((a, b) => a.e - b.e || a.along - b.along)[0] : null;
    const med = median(priced.map((r) => r.e)), save = cheapest && med != null ? (med - cheapest.e) * KWH() : 0;
    let h = "";
    if (RT.busy && RT.prog) h += `<div class="card notice"><span class="ic"><span class="spin-dot"></span></span><div>${say("Ladestationa am Weg werret gläda", "Ladestationen an der Strecke werden geladen")} … ${RT.prog.done} / ${RT.prog.total}</div></div>`;
    else if (RT.err) h += `<div class="card notice warnbox"><span class="ic">⚠️</span><div>${esc(RT.err)}${rows.length ? " – es werden die bisher geladenen Stationen gezeigt." : ""}<div class="row" style="margin-top:10px"><button class="btn secondary" data-evreload>${say("Nomol versuche", "Erneut versuchen")}</button></div></div></div>`;
    if (cheapest) {
      const s = cheapest.s;
      h += `<section class="card hero rthero evhero"><span class="eyebrow">${say("Am billigschde lada uff dr Strecke", "Günstigster Ladestopp an der Strecke")}</span>
        <div class="pricerow"><div class="price">${eur2s(cheapest.e)}<span class="cur">€/kWh</span></div>
          ${priced.length > 1 && save > 0.005 ? `<div class="save"><span class="eyebrow">${say("Gspart", "Ersparnis")}</span><b>${eur2(save)}</b><span>bei ${fmtNum(KWH(), 0)} kWh ggü. Ø</span></div>` : ""}</div>
        <div class="station">${badge(s, lv(cheapest), "lg")}<div style="min-width:0"><div class="where">${esc(s.brand)} · ${esc(s.place)}</div>
          <div class="sub">${whereTxt(cheapest)} · ${power(cheapest)}</div></div></div>
        <div class="row" style="margin-top:8px">${avail(cheapest)}</div>
        ${cheapest.flat > 0 || cheapest.tp > 0 ? `<p class="quip">${esc(tariffText(cheapest))}</p>` : ""}
        <div class="row two"><a class="btn" href="${esc(ctx.gmaps(s))}" target="_blank" rel="noopener">${NAV} Ladestopp</a>
          <button class="btn secondary" data-evmap="${esc(s.id)}">${say("Uff dr Kart", "Auf Karte")}</button></div></section>`;
    } else if (!RT.busy) h += `<div class="card empty"><div class="bigic">🔌</div><b>${say("Koi Preis gmeldet", "Keine Preise gemeldet")}</b><p>${rows.length ? say("Für d'Strecke meldet koi Betreiber Preis – d'Stationa sieht mr trotzdem.", "Für diese Strecke meldet kein Betreiber Preise. Die Stationen stehen unten.") : say(`Im Abstand vo ${ctx.corr} km hot's koine Ladestationa.`, `Im Abstand von ${ctx.corr} km gibt es keine passende Ladestation.`)}</p>
      ${!rows.length && ctx.corr < 5 ? `<button class="btn secondary" data-rtcorr="5">${say("Auf 5 km erweitera", "Auf 5 km erweitern")}</button>` : ""}</div>`;
    h += `<div class="card mapcard rtmapcard" id="rtmapslot"></div>`;
    h += `<div class="sec"><h2>${say("Ladestationa am Weg", "Ladestationen an der Strecke")}</h2><span class="sub">± ${ctx.corr} km</span></div>
      <div class="chips evchips"><span class="lbl">Leistung</span>${KWS.map((k) => `<button class="chip ${k === S.minKw ? "on" : ""}" data-evkw="${k}" aria-pressed="${k === S.minKw}">${k ? "≥ " + k + " kW" : "Alle"}</button>`).join("")}</div>
      <div class="chips"><button class="chip ${RT.sort === "route" ? "on" : ""}" data-evrsort="route">Nach Strecke</button>
        <button class="chip ${RT.sort === "price" ? "on" : ""}" data-evrsort="price">Nach Preis</button>
        <button class="chip ${RT.sort === "power" ? "on" : ""}" data-evrsort="power">Nach Leistung</button>
        <button class="chip ${S.hideBusy ? "on" : ""}" data-evbusy aria-pressed="${S.hideBusy}">Ohne belegte</button></div>${LV_LEGEND.replace("± 1 ct zum Median", "± 3 ct zum Median")}`;
    const n = RT.all ? 80 : 12;
    h += `<div class="list rtlist">` + list.slice(0, n).map((r) => itemHtml(r, lv, cheapest?.e ?? null, whereTxt(r), ctx)).join("");
    if (list.length > 12) h += `<button class="morebtn" data-evall>${RT.all ? say("Weniger aazeige", "Weniger anzeigen") : say(`Älle ${list.length} aazeige`, `Alle ${list.length} anzeigen`)}</button>`;
    if (!list.length && !RT.busy) h += `<div class="empty">${say("Nix gfunda – Filter lockera.", "Nichts gefunden – Filter lockern.")}</div>`;
    h += `</div><p class="small" style="margin:12px 4px 0">${NOTE}</p>`;
    return h;
  }
  function routeClick(el) {
    const d = el.dataset, ctx = RT.ctx;
    if (!ctx) return;
    if (d.evmap) { const r = RT.rows.find((x) => x.s.id === d.evmap); if (r) ctx.focus(r.s); return; }
    if (d.evst) { RT.open = RT.open === d.evst ? null : d.evst; RT.all = RT.all || RT.rows.findIndex((x) => x.s.id === d.evst) >= 12; return ctx.paint(); }
    if (d.evkw != null) { S.minKw = +d.evkw; store.set("evKw", String(S.minKw)); return ctx.paint(); }
    if (d.evrsort) { RT.sort = d.evrsort; store.set("evRSort", d.evrsort); return ctx.paint(); }
    if (el.hasAttribute("data-evbusy")) { S.hideBusy = !S.hideBusy; store.set("evBusy", S.hideBusy ? "1" : "0"); return ctx.paint(); }
    if (el.hasAttribute("data-evall")) { RT.all = !RT.all; return ctx.paint(); }
    if (el.hasAttribute("data-evreload")) { RT.centers.clear(); return loadAlong(RT.route, ctx.paint); }
  }
  // Preis-Schilder auf der Streckenkarte (Route-Tab)
  function drawRouteMarkers(map, layer) {
    const ctx = RT.ctx, b = map.getBounds().pad(0.1), lv = RT.lv;
    const vis = RT.rows.filter((r) => b.contains([r.s.lat, r.s.lng]));
    const pr = vis.filter((r) => r.e != null).sort((x, y) => x.e - y.e), best = RT.rows.filter((r) => r.e != null).sort((x, y) => x.e - y.e)[0];
    const pins = new Set(), placed = [];
    for (const r of pr) {
      if (pins.size >= 25) break;
      const pt = map.latLngToContainerPoint([r.s.lat, r.s.lng]);
      if (placed.every((q) => Math.abs(q.x - pt.x) > 70 || Math.abs(q.y - pt.y) > 30)) { pins.add(r.s.id); placed.push(pt); }
    }
    for (const r of vis.slice(0, 300)) {
      const isPin = pins.has(r.s.id), cls = lv(r);
      const html = isPin ? `<div class="pin lv-${cls}${r.s.id === best?.s.id ? " best" : ""}"><i></i><span>${eur2s(r.e)}</span></div>` : `<div class="dotm lv-${cls}"></div>`;
      L.marker([r.s.lat, r.s.lng], { icon: L.divIcon({ className: "mk", html, iconSize: [0, 0] }), zIndexOffset: isPin ? 3000 - pr.indexOf(r) : 0, keyboard: false, title: `${r.s.brand}, ${r.s.place}` })
        .on("click", () => { RT.open = r.s.id; RT.all = RT.all || RT.rows.indexOf(r) >= 12; ctx.paint(); document.getElementById("ev-" + r.s.id)?.scrollIntoView({ block: "center", behavior: "smooth" }); })
        .addTo(layer);
    }
  }
  const resetRoute = () => { Object.assign(S, { stations: [], key: "", at: 0, open: null }); RT.map.clear(); RT.centers.clear(); RT.memo = null; RT.route = null; RT.rows = []; RT.open = null; seq++; };
  const ATTR = `Ladedaten: <a href="https://mobidata-bw.de/dataset/e-ladesaulen" target="_blank" rel="noopener">MobiData BW (OCPDB)</a> · Standorte: Bundesnetzagentur (CC BY 4.0) · Preise und Belegung: Betreiber über <a href="https://mobilithek.info" target="_blank" rel="noopener">Mobilithek</a>`;
  return { render, load, invalidate, fetchArea, fetchRaw, norm, dedupe, loadTariffs, tariffOf, S, RT, gross, condense, loadAlong, routeHtml, drawRouteMarkers, resetRoute, ATTR, KEEP, MAX_KM };
})();
