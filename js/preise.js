// Schwabensprit – Bereich „Preise“: Favoriten, Startkarte, „Lohnt sich“, „Wann tanka?“ (12-Uhr-Regel, beste Zeit, Prognose),
// Tankstellenliste und Karte, Detailansicht einer Tankstelle.
// Alle Teile sind klassische Skripte und teilen sich den globalen Gültigkeitsbereich – Reihenfolge in index.html beachten.

// ---- Favoriten: bis zu 3 Tankstellen, auf dem Gerät gespeichert (mit Name/Ort/Koordinaten,
// damit die Zeile auch lesbar bleibt, wenn die Tankstelle gerade nicht in den Daten ist)
const FAV_MAX = 3;
let favs = store.getJ("favs", []);
const isFav = (id) => favs.some((f) => f.id === id);
const saveFavs = () => { store.setJ("favs", favs); renderFavs(); render(); if (detailId) renderDetail(); };
let favLive = { at: 0, data: {} }, favBusy = false, favTry = 0;
// Aktuelle Daten eines Favoriten: aus der Ansicht, sonst aus einer Base, die ihn abdeckt, sonst live
function favStation(f) {
  const inView = byId(f.id);
  if (inView) return { s: inView, here: true };
  for (const b of favBases(f)) {
    const st = baseCache[b.id]?.latest?.stations?.find((x) => x.id === f.id);
    if (st) return { s: st, here: false };
  }
  const lv = favLive.data[f.id];
  return lv ? { s: { ...f, ...lv }, here: false } : null;
}
const favBases = (f) => f.lat == null ? [] : bases.filter((b) => distKm(b.lat, b.lng, f.lat, f.lng) <= b.radius_km + 0.05);
async function loadFavData() {
  if (favBusy || !favs.length || !bases.length || Date.now() - favTry < 60000) return;
  favBusy = true; favTry = Date.now();
  try {
    const need = favs.filter((f) => !favStation(f));
    const bs = [...new Set(need.flatMap((f) => favBases(f).slice(0, 1)))];
    await Promise.all(bs.filter((b) => !baseCache[b.id]).map((b) => loadBaseData(b).catch(() => null)));
    const live = favs.filter((f) => !favStation(f) && !favBases(f).length);
    if (live.length && store.get("tk", "") && Date.now() - favLive.at > 5 * 60000) {
      favLive.at = Date.now();   // auch bei Fehlschlag: nicht gleich wieder fragen
      const r = await fetch(`${TK}/prices.php?ids=${live.map((f) => f.id).join(",")}&apikey=${encodeURIComponent(store.get("tk", ""))}`);
      const d = await r.json();
      if (d.ok) {
        favLive = { at: Date.now(), data: {} };
        for (const [id, p] of Object.entries(d.prices || {}))
          favLive.data[id] = { open: p.status === "open", e5: p.e5 || null, e10: p.e10 || null, diesel: p.diesel || null };
      }
    }
  } catch {} finally { favBusy = false; }
  renderFavs();
}
function renderFavs() {
  const el = $("#favs");
  if (!el) return;
  if (!favs.length || !view || view.error) { el.innerHTML = ""; return; }
  const priced = view.stations.filter((x) => hasPrice(x));
  const best = priced.length ? Math.min(...priced.map((x) => x[fuel])) : null, lv = levelFn();
  let missing = false;
  const rows = favs.map((f) => {
    const hit = favStation(f), s = hit?.s;
    if (!hit) missing = true;
    let right;
    if (!s) right = `<span class="st">${(favBases(f).length || store.get("tk", "")) && (favBusy || !favTry) ? "lädt …" : "kein aktueller Preis"}</span>`;
    else if (hasPrice(s)) {
      const d = best == null ? null : s[fuel] - best;
      const df = d == null ? "" : Math.abs(d) < 0.0005 ? (hit.here ? say("billigschde", "günstigste") : "± 0 ct") : ct(d);
      right = `<span class="pr">${price(s[fuel])}</span><span class="df ${d != null && d < -0.0005 ? "lo" : d > 0.0005 ? "hi" : ""}">${df}</span>`;
    } else {
      const stt = state(s);
      right = `<span class="st">${stt.open ? `kein ${FUELS[fuel]}` : `zu${stt.short ? " · " + esc(stt.short.replace(/^öffnet /, "ab ")) : ""}`}</span>`;
    }
    return `<button class="frow" data-fav="${esc(f.id)}">${badge(s || f, s && hit.here ? lv(s) : s && hasPrice(s) ? "mid" : "off")}
      <span class="nm">${esc(f.brand)} <span>· ${esc(f.place)}</span></span>${right}</button>`;
  }).join("");
  el.innerHTML = `<section class="card favcard"><div class="favhead"><b>★ ${say("Meine Tankstella", "Meine Tankstellen")}</b><button id="btnFavEdit" type="button">Bearbeiten</button></div>${rows}</section>`;
  if (missing) loadFavData();
}
function toggleFav(id) {
  if (isFav(id)) { favs = favs.filter((f) => f.id !== id); toast(say("Aus de Favorita gnomma.", "Aus den Favoriten entfernt.")); return saveFavs(); }
  const s = byId(id);
  if (!s) return;
  const entry = { id: s.id, brand: s.brand, place: s.place, street: s.street, lat: s.lat, lng: s.lng };
  if (favs.length >= FAV_MAX) return openFavDialog(entry);
  favs.push(entry); toast(say("★ Als Favorit gmerkt.", "★ Als Favorit gemerkt.")); saveFavs();
}
// Bearbeiten (sortieren, entfernen) bzw. – wenn schon 3 gemerkt sind – auswählen, welcher ersetzt wird
let favReplace = null;
function openFavDialog(replaceWith = null) {
  favReplace = replaceWith;
  $("#favTitle").textContent = replaceWith ? "Welchen Favoriten ersetzen?" : "Meine Tankstellen";
  $("#favHint").textContent = replaceWith ? `Es sind schon ${FAV_MAX} Favoriten gemerkt. ${replaceWith.brand} · ${replaceWith.place} ersetzt:` : "Reihenfolge ändern oder entfernen. Neue Favoriten über ☆ in der Detailansicht einer Tankstelle.";
  paintFavDialog();
  if (!$("#dlgFav").open) $("#dlgFav").showModal();
}
function paintFavDialog() {
  $("#favList").innerHTML = favs.length ? favs.map((f, i) => `<div class="favedit"><span class="nm">${esc(f.brand)} · ${esc(f.place)}</span>
    ${favReplace ? `<button class="btn" style="width:auto;padding:0 14px" data-favrep="${i}">Ersetzen</button>`
      : `<button data-favmove="${i}:-1" ${i ? "" : "disabled"} aria-label="nach oben">▲</button><button data-favmove="${i}:1" ${i < favs.length - 1 ? "" : "disabled"} aria-label="nach unten">▼</button><button data-favdel="${i}" aria-label="entfernen">✕</button>`}</div>`).join("")
    : `<p class="small">Noch keine Favoriten.</p>`;
}
$("#favList").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.favrep != null) { favs[+b.dataset.favrep] = favReplace; favReplace = null; $("#dlgFav").close(); toast(say("★ Als Favorit gmerkt.", "★ Als Favorit gemerkt.")); return saveFavs(); }
  if (b.dataset.favdel != null) favs.splice(+b.dataset.favdel, 1);
  if (b.dataset.favmove) { const [i, d] = b.dataset.favmove.split(":").map(Number); [favs[i], favs[i + d]] = [favs[i + d], favs[i]]; }
  paintFavDialog(); saveFavs();
});
$("#btnFavClose").addEventListener("click", () => { favReplace = null; $("#dlgFav").close(); });
// Favorit außerhalb des gewählten Umkreises: zur Base wechseln, die ihn abdeckt, und Details öffnen
async function openFav(id) {
  if (byId(id)) return openDetail(id);
  const f = favs.find((x) => x.id === id), b = f && favBases(f)[0];
  if (!b) return toast(store.get("tk", "") ? "Diese Tankstelle liegt außerhalb deiner Bases." : "Kein aktueller Preis – außerhalb deiner Bases. Für Live-Preise unter ⚙ den Tankerkönig-Schlüssel eintragen.", 5000);
  loc = { mode: "base", baseId: b.id };
  radius = Math.min(25, Math.max(radius, Math.ceil(distKm(b.lat, b.lng, f.lat, f.lng)) + 1));
  store.set("radius", String(radius));
  await load();
  openDetail(id);
}

// ---- Preisprognose: im GitHub-Ablauf gelernt und am Rückblick geprüft (forecast.json)
const SPARK = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-5 4 3 8-8"/><path d="M15 7h5v5"/></svg>`;
const eurA = (v) => eur2s(v) + " €";
const dtLabel = (iso) => new Date(iso).toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) + " Uhr";
const fcErr = (fc, t) => { const h = Math.min(12, Math.max(1, Math.round((t - Date.now()) / 36e5))); return (fc.quality.mae[h - 1] ?? fc.quality.mae_avg) / 100; };
// Prognose einer Tankstelle als [[t, €]], ohne Zeiten, in denen sie laut Öffnungszeiten zu hat
function fcSeries(fc, s, f, maxH = 24) {
  const arr = fc?.ok && fc.stations?.[s.id]?.[f];
  if (!arr) return [];
  const now = Date.now(), out = [], ts = fcTimes(fc, arr.length);
  arr.forEach((v, i) => {
    const t = ts[i];
    if (v == null || t < now - 18e5 || t > now + maxH * 36e5) return;
    const sch = schedule(s, new Date(t));
    if (sch && !sch.open) return;
    out.push([t, v / 1000]);
  });
  return out;
}
// Zeitpunkte der Prognosewerte (Stunden ab „start“ in Ortszeit), je Prognose einmal berechnet
function fcTimes(fc, n) {
  if (!fc._ts || fc._ts.length < n) fc._ts = Array.from({ length: n }, (_, i) => wallAt(fc.start, i * (fc.step_min || 60)));
  return fc._ts;
}
// Günstigster prognostizierter Preis im Umkreis für die nächsten 12 Stunden
function fcPlan() {
  const fc = view?.base && baseCache[view.base.id]?.forecast;
  if (!fc?.ok) return { fc };
  const now = Date.now();
  const open = view.stations.filter((s) => hasPrice(s));
  const cur = open.length ? Math.min(...open.map((s) => s[fuel])) : null;
  const best = new Map();   // Stunde -> günstigste prognostizierte Tankstelle
  for (const s of view.stations) for (const [t, v] of fcSeries(fc, s, fuel, 12)) {
    if (t <= now) continue;
    const b = best.get(t);
    if (!b || v < b.v) best.set(t, { v, s });
  }
  const pts = [...best.entries()].sort((a, b) => a[0] - b[0]);
  if (!pts.length) return { fc };
  const [bt, bo] = pts.reduce((a, b) => b[1].v < a[1].v ? b : a);
  const stale = noonStale();
  const gain = cur == null || stale ? 0 : cur - bo.v, wait = !stale && cur != null && gain >= Math.max(0.015, fcErr(fc, bt));
  return { fc, ok: true, cur, pts, bt, bo, gain, wait };
}
// Prognose-Diagramm (aufklappbar in „Wann tanka?“)
function fcChart(P) {
  const { fc, cur, pts, bt, bo } = P, now = Date.now();
  const line = [...(cur != null ? [[now, cur]] : []), ...pts.map(([t, o]) => [t, o.v])];
  const band = pts.map(([t, o]) => [t, o.v - fcErr(fc, t), o.v + fcErr(fc, t)]);
  return `${lineChart([{ name: "Günstigster Preis (Prognose)", cls: "proj", pts: line, band }], { mark: [bt, bo.v], markLabel: `≈ ${eurA(bo.v)}` })}
    <div class="legend"><span><i class="k proj"></i>günstigster Preis im Umkreis, Prognose</span><span><i class="kr" style="background:var(--lo);opacity:.25"></i>übliche Abweichung</span></div>
    <p class="small" style="margin:10px 0 0">${say(
      `Lernendes Modell aus ${fmtNum(fc.days, 0)} Däg Daten. Im Rückblick-Test im Schnitt ±${fmtNum(fc.quality.mae_avg, 1)} ct dernebe – „dr Preis bleibt, wie er isch“ ±${fmtNum(fc.quality.naive_avg, 1)} ct. Ohne Gewähr, gell.`,
      `Lernendes Modell aus ${fmtNum(fc.days, 0)} Tagen Daten. Im Rückblick-Test im Schnitt ±${fmtNum(fc.quality.mae_avg, 1)} ct daneben – die Annahme „Preis bleibt gleich“ ±${fmtNum(fc.quality.naive_avg, 1)} ct. Keine Garantie.`)}</p>`;
}
// Prognose noch nicht freigeschaltet: kurzer Grund
function fcLearning(fc) {
  const q = fc.quality;
  return fc.available_from && !q ? say(`Mir sammlet no fleißig Daten – voraussichtlich ab ${dtLabel(fc.available_from)} woiß se Bscheid.`, `Genug Daten voraussichtlich ab ${dtLabel(fc.available_from)}.`)
    : q ? say(`Bis etz isch se no net gscheiter als „dr Preis bleibt, wie er isch“ (Ø ${fmtNum(q.mae_avg, 1)} ct gega ${fmtNum(q.naive_avg, 1)} ct dernebe). Erscht wenn se's zuverlässig besser ka, wird se freigschaltet – mir verlassat ons net auf a Gschwätz.`,
        `Bisher noch nicht genauer als die Annahme „Preis bleibt gleich“ (Ø ${fmtNum(q.mae_avg, 1)} ct vs. ${fmtNum(q.naive_avg, 1)} ct daneben). Sie wird freigeschaltet, sobald sie verlässlich besser ist.`)
    : say("Mir sammlet no Daten.", "Es werden noch Daten gesammelt.");
}
const labelOf = (id) => { const s = byId(id); return s ? `${s.brand}, ${s.place}` : "Tankstelle"; };

// ---- Bereich „Preise“: Favoriten, Startkarte, Lohnt sich, Wann tanka?, Tankstellen
function preiseHtml() {
  let h = `<div id="favs"></div><div id="noonwarn"></div>`;
  h += `<div id="health">${healthHtml}</div>`;
  const exp = store.get("tokenExp", ""), left = exp ? Math.ceil((new Date(exp + "T23:59:59") - Date.now()) / 864e5) : null;
  if (token() && left != null && left <= 14)
    h += `<div class="card notice warnbox"><span class="ic">🔑</span><div><b>${left < 0 ? "GitHub-Schlüssel ist abgelaufen" : `GitHub-Schlüssel läuft ${left === 0 ? "heute" : left === 1 ? "morgen" : `in ${left} Tagen`} ab`}</b><br>
      Bei GitHub neu erstellen (oder „Regenerate“) und unter ⚙ eintragen – sonst kommen keine Preise mehr an.
      <div class="row" style="margin-top:10px"><a class="btn secondary" href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noopener">Zu GitHub</a><button class="btn" id="btnSetup">Einstellungen</button></div></div></div>`;
  if (view.src.type === "partial")
    h += `<div class="card notice"><span class="ic">ℹ️</span><div><b>Teilweise außerhalb deiner Bases.</b> Es werden nur Tankstellen aus ${esc(view.base.name)} angezeigt. Für vollständige Live-Preise trage unter ⚙ deinen Tankerkönig-Schlüssel ein.</div></div>`;
  if (view.src.type === "none")
    h += `<div class="card notice"><span class="ic">ℹ️</span><div><b>Dieser Ort liegt außerhalb deiner Bases.</b> Für Live-Preise trage unter ⚙ deinen Tankerkönig-Schlüssel ein.</div></div>`;

  const lv = levelFn();
  const withPrice = view.stations.filter((s) => hasPrice(s)).sort((a, b) => a[fuel] - b[fuel] || a.dist - b.dist);
  const others = view.stations.filter((s) => !hasPrice(s)).sort((a, b) => a.dist - b.dist);
  const best = withPrice[0];
  const avgNow = mean(withPrice.map((s) => s[fuel]));
  const near = withPrice.length ? withPrice.reduce((a, b) => a.dist <= b.dist ? a : b) : null;
  const smart = withPrice.length ? withPrice.reduce((a, b) => fillCost(a) <= fillCost(b) ? a : b) : null;
  let drive = "";
  if (best && near && best.id !== near.id && best.dist != null) {
    const net = fillCost(near) - fillCost(best), trip = km(2 * best.dist * ROAD);
    drive = smart.id === best.id
      ? (net > 0.05 ? say(`🚗 Lohnt sich au mit Anfahrt: ${eur2(net)} gspart gegenüber dr nächschde Tankstell.`, `🚗 Lohnt sich auch mit Anfahrt: ${eur2(net)} gespart gegenüber der nächsten Tankstelle.`) : "")
      : net <= 0 ? say(`🚗 Mit Hin- ond Rückfahrt (≈ ${trip}) zahlsch do ${eur2(-net)} drauf – unte steht, wo sich's lohnt.`, `🚗 Mit Hin- und Rückfahrt (≈ ${trip}) zahlst du hier ${eur2(-net)} drauf – unten steht, wo es sich lohnt.`)
      : say(`🚗 Mit Anfahrt bleibet bloß ${eur2(net)} – unte lohnt sich's mehr.`, `🚗 Mit Anfahrt bleiben nur ${eur2(net)} – unten lohnt es sich mehr.`);
  }

  // Mit Hin- und Rückfahrt kann eine andere Tankstelle unterm Strich besser sein als die mit dem niedrigsten Preis (eine Zeile in der Karte)
  const better = best && smart && smart.id !== best.id ? { s: smart, gain: fillCost(best) - fillCost(smart) } : null;
  const alt = better && better.gain >= 0.05 ? `<button class="alt" data-detail="${esc(better.s.id)}" aria-label="${say("Mit Hin- ond Rückfahrt besser", "Mit Hin- und Rückfahrt besser")}: ${esc(better.s.brand)}, ${esc(better.s.place)}, ${eur2(better.gain)} günstiger">
        <div class="grow"><div class="mini">🚗 ${say("Mit Hin- ond Rückfahrt besser:", "Mit Hin- und Rückfahrt besser:")}</div>
          <div class="altwho"><b class="altp">${price(better.s[fuel])}</b><span class="altn">${esc(better.s.brand)} · ${km(better.s.dist)}</span></div></div>
        <span class="tag2">−${eur2(better.gain)}</span>${CHEV}</button>` : "";
  if (best) {
    const stt = state(best), save = avgNow - best[fuel];
    h += `<section class="card hero">
      <span class="eyebrow">${say("Am billigschde", "Günstigste")} · ${FUELS[fuel]} · ${radius} km</span>
      <div class="pricerow"><div class="price">${priceN(best[fuel])}<span class="cur">€</span></div>
        ${withPrice.length > 1 && save > 0.0005 ? `<div class="save"><span class="eyebrow">${say("Gspart", "Ersparnis")}</span><b>${eur2(save * TANK())}</b><span>bei ${fmtNum(TANK(), 0)} l ggü. Ø</span></div>` : ""}</div>
      <div class="station">${badge(best, lv(best), "lg")}
        <div style="min-width:0"><div class="where">${esc(best.brand)} · ${esc(best.place)}</div>
        <div class="sub">${esc(best.street)} · ${km(best.dist)}${stt.short ? " · " + esc(stt.short) : ""}</div></div></div>
      <div class="row" id="heroPills">
        ${withPrice.length > 1 && save > 0.0005 ? pill(-save, `${ct(-save)} unter Ø`) : ""}
      </div>
      ${SW() && withPrice.length > 1 && save > 0.0005 ? `<p class="quip">🥨 ${brezel(save * TANK())}</p>` : ""}
      ${drive && !alt ? `<p class="quip">${drive}</p>` : ""}
      <div class="row two">
        <button class="btn" data-route="${esc(best.id)}">${NAV} Route</button>
        <button class="btn secondary" data-detail="${esc(best.id)}">Details</button>
      </div>${alt}
    </section>`;
  } else if (view.src.type !== "none") {
    h += `<div class="card empty"><div class="bigic">🌙</div><b>${say("Grad hot älles zu", "Gerade alles zu")}</b><p>${say(`Im Umkreis vo ${radius} km hot koi Tankstell mit ${FUELS[fuel]} offa. Morga isch au no a Dag.`, `Im Umkreis von ${radius} km ist keine Tankstelle mit ${FUELS[fuel]} geöffnet.`)}</p></div>`;
  }
  h += `<div id="when"></div>`;

  if (view.stations.length) {
    h += `<div class="sec"><h2>${say("Tankstella", "Tankstellen")}</h2>
      <div class="seg mini"><button data-view="list" class="${viewMode === "list" ? "on" : ""}">Liste</button><button data-view="map" class="${viewMode === "map" ? "on" : ""}">Karte</button></div></div>
      <div class="chips sortrow">
        ${viewMode === "list" ? `<div class="seg mini" role="group" aria-label="Sortierung"><button class="${sortBy === "price" ? "on" : ""}" data-sort="price" aria-pressed="${sortBy === "price"}">Preis</button><button class="${sortBy === "dist" ? "on" : ""}" data-sort="dist" aria-pressed="${sortBy === "dist"}">Nähe</button><button class="${sortBy === "value" ? "on" : ""}" data-sort="value" aria-pressed="${sortBy === "value"}" title="Preis inklusive Weg dorthin">Anfahrt</button></div>` : ""}
        <button class="chip ${onlyOpen ? "on" : ""}" data-open aria-pressed="${onlyOpen}">${say("Nur offa", "Nur offen")}</button>
      </div>`;
    if (viewMode === "map") {
      h += `<div class="card mapcard" id="mapslot"></div>`;
    } else {
      let list = [...withPrice, ...(onlyOpen ? [] : others)];
      if (sortBy === "dist") list = [...list].sort((a, b) => a.dist - b.dist);
      if (sortBy === "value") list = [...withPrice].sort((a, b) => fillCost(a) - fillCost(b)).concat(onlyOpen ? [] : others);
      const n = showAll ? LIST_MAX : LIST_TOP;
      h += `<div class="list">`;
      for (const s of list.slice(0, n)) {
        const has = hasPrice(s), stt = state(s);
        const d = has && best ? s[fuel] - best[fuel] : null;
        h += `<button class="item${has ? "" : " closed"}" data-detail="${esc(s.id)}">
          ${badge(s, lv(s))}
          <div class="info"><div class="name"><span>${esc(s.brand)}</span>${isFav(s.id) ? `<span class="favstar">★</span>` : ""}${stt.open && stt.short ? `<span class="tag">${esc(stt.short)}</span>` : ""}</div>
            <div class="addr">${km(s.dist)} · ${esc(s.place)}, ${esc(s.street)}</div></div>
          <div class="p">${has ? `<b>${price(s[fuel])}</b><div class="d">${d ? ct(d) : "günstigste"}</div>` : `<div class="d">${stt.open ? "kein " + FUELS[fuel] : "geschlossen"}${!stt.open && stt.short ? "<br>" + esc(stt.short) : ""}</div>`}</div>
          ${CHEV}</button>`;
      }
      if (!showAll && list.length > LIST_TOP)
        h += `<button class="morebtn" data-showall>${say(`Älle ${list.length} aazeige`, `Alle ${list.length} anzeigen`)}</button>`;
      else if (list.length > LIST_MAX)
        h += `<div class="more">${say(`… ond no ${list.length - LIST_MAX} weitere – Radius kleiner macha oder d'Kart nemma.`, `… und ${list.length - LIST_MAX} weitere. Radius verkleinern oder Karte nutzen.`)}</div>`;
      if (showAll && list.length > LIST_TOP) h += `<button class="morebtn" data-showall>${say("Weniger aazeige", "Weniger anzeigen")}</button>`;
      if (!list.length) h += `<div class="empty">${say("Grad hot koine offa.", "Gerade hat keine Tankstelle geöffnet.")}</div>`;
      h += `</div>${LV_LEGEND}`;
    }
  }
  return h + FOOT();
}
const FOOT = () => `<p class="foot">Schwabensprit${say(" – mir kennet älles, au billig tanka", "")} · Daten: <a href="https://www.tankerkoenig.de" target="_blank" rel="noopener">Tankerkönig</a> / MTS-K (CC BY 4.0)</p>`;

// ---- 12-Uhr-Regel: Erhöhungen gibt es (fast) nur um 12 Uhr – erkannt aus den beobachteten Änderungen
let noonCtx = null;
function noonInfo(chg, ids, f) {
  let ups = 0;
  const jumps = [];
  for (const id of ids) for (const e of stationEvents(chg, id, f)) {
    if (e.d <= 0) continue;
    ups++;
    // Zeitraum der Erhöhung überschneidet 12–13 Uhr (manche Tankstellen erhöhen erst ein paar Minuten nach 12)
    const to = e.to || e.t, from = e.from || e.t, a = new Date(to), b = new Date(to);
    a.setHours(12, 0, 0, 0); b.setHours(13, 0, 0, 0);
    if (from < b && to >= a) jumps.push(e.d);
  }
  return ups >= 10 && jumps.length / ups >= 0.8 ? { share: jumps.length / ups, avgUp: mean(jumps) } : null;
}
// Zwischen 12 und 13:30 Uhr mit Daten von vor/um 12 Uhr: Die Tankstellen erhöhen gerade, die angezeigten
// Preise (und alles, was darauf aufbaut) können schon überholt sein
function noonStale() {
  if (!noonCtx || !view?.updated || view.live) return false;
  const now = new Date(), noon = new Date(now), u = new Date(view.updated);
  noon.setHours(12, 0, 0, 0);
  return now >= noon && now < noon.getTime() + 90 * 60000 && u < noon.getTime() + 25 * 60000 && u > noon.getTime() - 3 * 36e5;
}
const dur = (min) => {
  const h = Math.floor(min / 60), m = min % 60;
  return SW() ? [h ? `${h} Stond` : "", m || !h ? `${m} Minuta` : ""].filter(Boolean).join(" ") : [h ? `${h} Std.` : "", m || !h ? `${m} Min.` : ""].filter(Boolean).join(" ");
};
// Rechtsgrundlage: § 2 Abs. 1 Kraftstoffpreisanpassungsgesetz (KPAnG), BGBl. 2026 I Nr. 82, in Kraft seit 1.4.2026.
// Die Karte erscheint nur, solange die Daten die Regel zeigen – fällt sie weg, verschwindet sie von selbst.
const NOON_LAW = "Gesetzlich (§ 2 Kraftstoffpreisanpassungsgesetz, seit 1.4.2026): Erhöhen nur einmal täglich um 12 Uhr, senken jederzeit.";

// ---- „Wann tanka?“: 12-Uhr-Regel, beste Tankzeit und Prognose als eine Empfehlung.
// Die Überschrift sagt, was zu tun ist; darunter die Fakten (Tageszeit-Streifen, Prognose zum Aufklappen).
let anaSum = null, moreOpen = false, whenHour = -1;
function whenHead(sum, P) {
  const N = noonCtx, stale = noonStale(), now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
  const noon12 = new Date(now); noon12.setHours(12, 0, 0, 0);
  const at = (t) => hm(new Date(t)), where = (o) => `${esc(o.s.brand)}, ${esc(o.s.place)}`;
  const best = P.ok ? say(`geg ${at(P.bt)} Uhr: ≈ ${eurA(P.bo.v)} bei ${where(P.bo)}`, `gegen ${at(P.bt)} Uhr: ≈ ${eurA(P.bo.v)} bei ${where(P.bo)}`) : "";
  const gainCt = P.ok ? `<b>${fmtNum(P.gain * 100, 1)} ct</b>` : "";
  const up = N ? fmtNum(N.info.avgUp * 100, 1) : "", L = fmtNum(TANK(), 0);
  let ic = "⛽", title, sub = "", soon = false, go = null;
  if (stale) {
    ic = "⏳";
    title = say("Grad laufet d'Erhöhunga", "Erhöhungen laufen gerade");
    sub = say(`Die Preise oba sind vom Abruf um ${hm(new Date(view.updated))} Uhr ond wohl scho überholt.`, `Die Preise oben sind vom Abruf um ${hm(new Date(view.updated))} Uhr und wohl schon überholt.`)
      + (P.ok ? say(` Am billigschde wird's voraussichtlich ${best}.`, ` Am günstigsten voraussichtlich ${best}.`)
        : N?.recover ? say(` Bis etwa ${N.recover} Uhr wird's Stück für Stück wieder billiger.`, ` Bis etwa ${N.recover} Uhr wird es Schritt für Schritt wieder günstiger.`) : "");
    if (P.ok) go = P.bo.s;
  } else if (P.ok && P.cur == null) {
    ic = "🌙";
    title = say("Grad hot älles zu", "Gerade alles zu");
    sub = say(`Grad hot koi Tankstell im Umkreis offa. Am billigschde wird's voraussichtlich ${best}.`, `Gerade hat keine Tankstelle im Umkreis geöffnet. Am günstigsten voraussichtlich ${best}.`);
    go = P.bo.s;
  } else if (N && mins < 720) {
    const left = 720 - mins;
    ic = "⏰"; soon = left <= 60;
    title = say(`${soon ? "Etz aber gschwind: " : ""}no <span class="cd">${dur(left)}</span> bis zum Preissprung`, `${soon ? "Jetzt schnell: " : ""}noch <span class="cd">${dur(left)}</span> bis zur Preiserhöhung`);
    sub = say(`Um 12 Uhr ganget d'Preis nauf – im Schnitt um ${up} ct. Vorher tanka spart bei ${L} l rund ${eur2(N.info.avgUp * TANK())}.`,
      `Um 12 Uhr steigen die Preise – im Schnitt um ${up} ct. Vorher tanken spart bei ${L} l rund ${eur2(N.info.avgUp * TANK())}.`);
    if (P.wait && P.bt > noon12) {
      sub += say(` Billiger als etz wird's erscht wieder ${best} (${gainCt} weniger). Wer so lang warta ka, wartet – sonst vor 12 tanka.`,
        ` Günstiger als jetzt wird es erst wieder ${best} (${gainCt} weniger). Wer so lange warten kann, wartet – sonst vor 12 Uhr tanken.`);
      go = P.bo.s;
    } else if (P.wait) {
      sub += say(` Bis dahin wird's no a bissle billiger: ${best}.`, ` Bis dahin wird es noch etwas günstiger: ${best}.`);
      go = P.bo.s;
    }
  } else if (N && mins < 780) {
    ic = "⏰";
    title = say("Grad goht's nauf", "Gerade wird erhöht");
    sub = say(`Seit 12 Uhr erhöhet d'Tankstella nach ond nach – im Schnitt um ${up} ct.`, `Seit 12 Uhr erhöhen die Tankstellen nach und nach – im Schnitt um ${up} ct.`)
      + (P.ok ? say(` Am billigschde wird's voraussichtlich ${best}.`, ` Am günstigsten voraussichtlich ${best}.`)
        : say(` ${N.recover ? `Bis etwa ${N.recover} Uhr` : "Bis zum Obend"} wird's dann Stück für Stück wieder billiger.`, ` ${N.recover ? `Bis etwa ${N.recover} Uhr` : "Bis zum Abend"} wird es dann Schritt für Schritt wieder günstiger.`));
    if (P.wait) go = P.bo.s;
  } else if (N && (N.recover == null || now.getHours() < N.recover)) {
    ic = "⏰";
    if (P.ok && !P.wait) {
      title = say("Etz tanka passt scho", "Jetzt tanken ist in Ordnung");
      sub = say(`Um 12 Uhr isch's im Schnitt um ${up} ct nauf. Laut Prognose wird's in de nächschde 12 Stond aber net arg billiger als etz (${eurX(P.cur)}).`,
        `Um 12 Uhr ging es im Schnitt um ${up} ct nach oben. Laut Prognose wird es in den nächsten 12 Stunden aber nicht deutlich günstiger als jetzt (${eurX(P.cur)}).`);
    } else {
      title = say("Grad erscht nauf gange", "Gerade erst erhöht");
      sub = say(`Um 12 Uhr isch's im Schnitt um ${up} ct nauf.`, `Um 12 Uhr ging es im Schnitt um ${up} ct nach oben.`)
        + (P.wait ? say(` Laut Prognose am billigschde ${best} – ${gainCt} weniger als etz. Wenn's net pressiert: warta.`, ` Laut Prognose am günstigsten ${best} – ${gainCt} weniger als jetzt. Wenn möglich warten.`)
          : say(` ${N.recover ? `Bis etwa ${N.recover} Uhr wird's Stück für Stück billiger` : "Bis zum Obend wird's wieder billiger"} – wenn's net pressiert: warta.`,
            ` ${N.recover ? `Bis etwa ${N.recover} Uhr wird es Schritt für Schritt günstiger` : "Bis zum Abend wird es wieder günstiger"} – wenn möglich warten.`));
      if (P.wait) go = P.bo.s;
    }
  } else if (P.wait) {
    ic = SPARK;
    title = say("Warta lohnt sich!", "Warten lohnt sich voraussichtlich");
    sub = say(`Geg ${at(P.bt)} Uhr wird's voraussichtlich <b>${fmtNum(P.gain * 100, 1)} ct billiger</b>: ≈ ${eurA(P.bo.v)} bei ${where(P.bo)}. Also bloß net hudla!`,
      `Gegen ${at(P.bt)} Uhr ca. <b>${fmtNum(P.gain * 100, 1)} ct günstiger</b>: ≈ ${eurA(P.bo.v)} bei ${where(P.bo)}.`);
    go = P.bo.s;
  } else if (N) {
    title = say("Bis morga 12 Uhr bleibt's billig", "Bis morgen 12 Uhr bleibt es günstig");
    sub = say(`Nauf goht's erscht wieder morga um 12 Uhr (im Schnitt +${up} ct). Bis dahin ka mr in Ruh tanka.`,
      `Erhöht wird erst wieder morgen um 12 Uhr (im Schnitt +${up} ct). Bis dahin kann man in Ruhe tanken.`);
  } else if (P.ok) {
    ic = SPARK;
    title = say("Etz tanka passt scho", "Jetzt tanken ist in Ordnung");
    sub = say(`In de nächschde 12 Stond wird's voraussichtlich net arg billiger als etz (${eurX(P.cur)}).`, `In den nächsten 12 Stunden wird es voraussichtlich nicht deutlich günstiger als jetzt (${eurX(P.cur)}).`);
  } else if (sum && sum.days > 1) {
    // ohne Prognose und ohne 12-Uhr-Regel: typische Tageszeit
    const hNow = now.getHours(), devNow = sum.hourAvg[hNow];
    ic = CLOCK;
    if (devNow == null) return null;
    if (devNow <= sum.hourAvg[sum.bestHour] + 0.01) {
      title = say("Etz isch a guate Zeit", "Jetzt ist eine gute Zeit");
      sub = say("Nix wie na an d'Zapfsäul!", "Um diese Uhrzeit ist es meist günstig.");
    } else if (devNow > 0.01) {
      title = say("Wenn's net pressiert: warta", "Wenn möglich: später tanken");
      sub = say(`Um ${hNow} Uhr isch's meischtens <b>${fmtNum(devNow * 100, 1)} ct deirer</b> als im Tagesschnitt – mir hen's jo net zom Verschenka.`,
        `Jetzt (${hNow} Uhr) ist es typischerweise <b>${fmtNum(devNow * 100, 1)} ct teurer</b> als im Tagesmittel.`);
    } else {
      title = say("Ka mr macha", "Jetzt tanken geht");
      sub = say(`Um ${hNow} Uhr isch dr Preis meischtens so mittel – ka mr macha, muss mr aber net.`, `Jetzt (${hNow} Uhr) liegt der Preis meist etwa im Tagesmittel.`);
    }
  } else return null;
  const btn = go ? `<div class="row"><button class="btn secondary" data-detail="${esc(go.id)}">${say("Zur Tankstell", "Zur Tankstelle")}: ${esc(go.brand)}</button></div>` : "";
  return { soon, html: `<div class="tiphead"><div class="ic">${ic}</div><div><b>${title}</b><div class="sub">${sub}</div></div></div>${btn}` };
}
// ---- Tank-Rat: Füllstand (vom Nutzer angegeben, gilt 3 Tage) + Prognose + 12-Uhr-Regel → was jetzt sinnvoll ist
const LVLS = [[0.1, "fast leer"], [0.25, "¼"], [0.5, "½"], [0.75, "¾"]];
const lvlGet = () => { const x = store.getJ("lvl", null); return x && LVLS.some(([f]) => f === x.f) && Date.now() - x.at >= 0 && Date.now() - x.at < 3 * 864e5 ? x : null; };
function tankrat(P) {
  const x = lvlGet();
  const chips = LVLS.map(([f, t]) => `<button class="chip ${x?.f === f ? "on" : ""}" data-lvl="${f}" aria-pressed="${x?.f === f}">${t}</button>`).join("");
  let txt = "";
  if (x) {
    const range = Math.round(x.f * TANK() / CONS() * 100), fill = (1 - x.f) * TANK(), L = fmtNum(fill, 0);
    const noonUp = noonCtx && new Date().getHours() < 12 && !noonStale() ? noonCtx.info.avgUp : 0;
    if (range < 100) txt = say(`⚠ Reichweite bloß ≈ ${range} km – etz tanka, net uff en günstigera Preis warta.`, `⚠ Reichweite nur ≈ ${range} km – jetzt tanken, nicht auf einen günstigeren Preis warten.`);
    else if (P?.ok && P.wait) txt = say(`Reichweite ≈ ${range} km – du kasch warta: geg ${hm(new Date(P.bt))} Uhr ≈ ${eur2(P.gain * fill)} billiger (${L} l).`, `Reichweite ≈ ${range} km – du kannst warten: gegen ${hm(new Date(P.bt))} Uhr ≈ ${eur2(P.gain * fill)} günstiger (${L} l).`);
    else if (noonUp > 0.002) txt = say(`Reichweite ≈ ${range} km – vor 12 Uhr tanka spart ≈ ${eur2(noonUp * fill)} (${L} l).`, `Reichweite ≈ ${range} km – vor 12 Uhr tanken spart ≈ ${eur2(noonUp * fill)} (${L} l).`);
    else txt = say(`Reichweite ≈ ${range} km – koi Grund z'warta, du tankscht ≈ ${L} l.`, `Reichweite ≈ ${range} km – kein Grund zu warten, du tankst ≈ ${L} l.`);
  }
  return { txt, html: `<div class="tankrat"><div class="chips"><span class="lbl">${say("Dein Tank", "Dein Tank")}</span>${chips}</div>${txt ? "" : `<p class="small" style="margin:6px 0 0">${say("Wie voll isch dr Tank? Dann sag i dir, ob warta sich lohnt.", "Wie voll ist der Tank? Dann sagt die App, ob Warten sich lohnt.")}</p>`}</div>` };
}
function renderWhen(headOnly = false) {
  const el = $("#when");
  if (!el || !view || view.error) return;
  if (view.live || !view.base) { el.innerHTML = ""; return; }
  if (!baseCache[view.base.id]?.history) { el.innerHTML = `<div class="skel" style="height:190px"></div>`; return; }
  const sum = anaSum, P = fcPlan(), head = whenHead(sum, P);
  const w = $("#noonwarn");
  if (w) w.innerHTML = noonStale() ? `<div class="card notice warnbox"><span class="ic">⏳</span><div><b>Erhöhung läuft gerade</b><br>
    Die Preise sind vom Abruf um ${hm(new Date(view.updated))} Uhr – seit 12 Uhr erhöhen die Tankstellen. Angezeigte Preise können schon überholt sein, der nächste Abruf kommt in wenigen Minuten.</div></div>` : "";
  // Minutentakt: nur Überschrift neu; zur vollen Stunde alles (Markierung „jetzt“ im Streifen)
  if (headOnly && head && whenHour === new Date().getHours() && $("#whenHead")) {
    $("#whenHead").innerHTML = head.html;
    el.firstElementChild?.classList.toggle("soon", head.soon);
    return;
  }
  whenHour = new Date().getHours();
  const tipRow = sum && sum.days > 1 ? `<div class="wfact"><div>${say(`Am billigschde meischtens <b>${sum.bestHour}–${sum.bestHour + 1} Uhr</b> (${ct(sum.hourAvg[sum.bestHour])}), am deirschde ${sum.worstHour}–${sum.worstHour + 1} Uhr.`,
      `Meist am günstigsten <b>${sum.bestHour}–${sum.bestHour + 1} Uhr</b> (${ct(sum.hourAvg[sum.bestHour])}), am teuersten ${sum.worstHour}–${sum.worstHour + 1} Uhr.`)}${sum.bestWd != null ? say(` Billigschder Dag: ${WD_SCHW[sum.bestWd]}.`, ` Günstigster Wochentag: ${WD_LONG[sum.bestWd]}.`) : ""}</div>
      ${stripChart(sum.hourAvg)}
      <div class="legend" style="margin-top:6px"><span><i class="kr" style="background:var(--lo)"></i>günstiger</span><span><i class="kr" style="background:var(--hi)"></i>teurer</span><span>▼ jetzt</span><span>ggü. Tagesschnitt</span></div></div>` : "";
  const fcRow = P.ok ? `<div class="wfact"><b>${say("Prognose für de nächschde 12 Stond", "Prognose für die nächsten 12 Stunden")}</b>${fcChart(P)}</div>`
    : P.fc?.ok ? `<p class="small wfact">📈 ${say("Für de nächschde Stond gibt's grad koi Prognose – se kommt mit em nägschda Abruf wieder.", "Für die nächsten Stunden liegt gerade keine Prognose vor – sie kommt mit dem nächsten Abruf wieder.")}</p>`
    : P.fc ? `<p class="small wfact">📈 <b>${say("D'Preisprognose lernt no", "Preisprognose lernt noch")}.</b> ${fcLearning(P.fc)}</p>` : "";
  const law = noonCtx ? `<p class="small" style="margin:12px 0 0">${NOON_LAW} Beobachtet: ${fmtNum(noonCtx.info.share * 100, 0)} % aller Preiserhöhungen der letzten Tage lagen zwischen 12 und 13 Uhr.</p>` : "";
  if (!head && !tipRow && !fcRow) { el.innerHTML = ""; return; }
  const TR = tankrat(P);
  // sichtbar: Überschrift mit einem Satz (und das Ergebnis des Tank-Rats, wenn ein Füllstand gewählt ist); alles Weitere unter „Mehr“
  el.innerHTML = `<section class="card when${head?.soon ? " soon" : ""}"><span class="eyebrow">${say("Wann tanka?", "Wann tanken?")} · ${FUELS[fuel]}</span>
    <div id="whenHead">${head ? head.html : ""}</div>${TR.txt ? `<p class="small wrat">${TR.txt}</p>` : ""}
    <details class="tbl wmore" id="whenMore"${moreOpen ? " open" : ""}><summary>${"Mehr: Tank, Zeiten, Prognose"}</summary>${TR.html}${tipRow}${fcRow}${law}</details></section>`;
}
document.addEventListener("toggle", (e) => { if (e.target.id === "whenMore") moreOpen = e.target.open; }, true);
setInterval(() => { if (!document.hidden) renderWhen(true); }, 30000);

// ---- Detailansicht
function openDetail(id) {
  if (!byId(id)) return;
  detailId = id;
  if (window.history.state?.d !== id) try { window.history.pushState({ d: id }, ""); } catch {}
  $("#detail").classList.add("open"); $("#detail").setAttribute("aria-hidden", "false");
  document.body.classList.add("lock");
  $("#detail").scrollTop = 0;
  renderDetail();
}
function closeDetail(fromPop) {
  if (!detailId) return;
  detailId = null;
  $("#detail").classList.remove("open"); $("#detail").setAttribute("aria-hidden", "true");
  document.body.classList.remove("lock");
  if (!fromPop) try { window.history.back(); } catch {}
}
window.addEventListener("popstate", () => {
  const overlay = detailId || $("#report").classList.contains("open");
  closeReport(); closeDetail(true);
  if (!overlay && !tabState() && tab !== "preise") setTab("preise", true);   // Zurück aus Route/Verlauf/Spritbüchle → Preise
});
// Start in einem anderen Bereich als „Preise“: Verlaufseintrag anlegen, damit „Zurück“ erst nach „Preise“ führt
if (tab !== "preise" && !tabState()) try { history.pushState({ t: 1 }, ""); } catch {}

async function renderDetail() {
  const s = byId(detailId);
  if (!s) return;
  if (view.live && !s.hours && store.get("tk", "")) liveHours(s).then((h) => { s.hours = h; if (detailId === s.id) renderDetail(); }).catch(() => {});
  const stt = state(s);
  const tiles = Object.keys(FUELS).map((f) => {
    const all = view.stations.filter((x) => hasPrice(x, f)).sort((a, b) => a[f] - b[f]);
    const rank = all.findIndex((x) => x.id === s.id) + 1;
    return `<button class="ftile ${f === fuel ? "on" : ""}" data-fuel="${f}"><div class="n"><i class="${levelFn(f)(s)}"></i>${FUELS[f]}</div>
      <b>${hasPrice(s, f) ? price(s[f]) : "–"}</b>
      <div class="r">${rank ? `Platz ${rank}/${all.length}` : stt.open ? "nicht angeboten" : "geschlossen"}</div></button>`;
  }).join("");
  const all = view.stations.filter((x) => hasPrice(x));
  const diffNow = hasPrice(s) ? s[fuel] - mean(all.map((x) => x[fuel])) : null;
  $("#detailBody").innerHTML = `
    <button class="back" id="btnBack"><svg width="12" height="20" viewBox="0 0 12 20"><path d="M10 2L2 10l8 8" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Zurück</button>
    <div class="dhead">${badge(s, levelFn()(s), "xl")}
      <div style="min-width:0"><h1>${esc(s.brand)}</h1><div class="sub">${esc(s.street)}, ${esc(s.place)} · ${km(s.dist)}</div></div>
      <button class="favbtn" data-favtoggle="${esc(s.id)}" aria-label="${isFav(s.id) ? "Favorit entfernen" : "Als Favorit merken"}">${isFav(s.id) ? "★" : "☆"}</button></div>
    <div class="row">
      <span class="pill ${stt.open ? "ok" : ""}"><i></i>${stt.open ? "Geöffnet" : "Geschlossen"}${stt.text ? " · " + esc(stt.text.replace(/^geöffnet /, "")) : ""}</span>
      ${diffNow != null && all.length > 1 ? pill(diffNow, `${ct(diffNow)} ggü. Ø jetzt`) : ""}
    </div>
    <div class="fuelgrid">${tiles}</div>
    <button class="btn block" data-route="${esc(s.id)}">${NAV} Route mit Google Maps</button>
    ${hoursCard(s)}
    <div id="dstats">${view.live ? "" : `<div class="skel" style="height:220px;margin-top:28px"></div>`}</div>
    <p class="foot">Stand ${esc(ago(view.updated))}</p>`;
  if (view.live) return;

  const hist = await loadHistory();
  if (detailId !== s.id || !hist || !view?.base || view.error) return;
  const ts = hist.ts.map((t) => new Date(t).getTime());
  const own = (hist.stations?.[s.id]?.[fuel] || []).map((v) => v == null ? null : v / 1000);
  const ids = view.stations.map((x) => x.id);
  const regAvg = ts.map((_, i) => { const m = mean(ids.map((id) => hist.stations[id]?.[fuel]?.[i]).filter((v) => v != null)); return m == null ? null : m / 1000; });
  const pts = ts.map((t, i) => [t, own[i]]).filter((p) => p[1] != null);
  const regPts = ts.map((t, i) => [t, regAvg[i]]).filter((p) => p[1] != null && !Number.isNaN(p[1]));
  let h = "";
  if (pts.length < 2) {
    h = `<div class="card empty" style="margin-top:12px">Für diese Tankstelle gibt es noch zu wenige ${FUELS[fuel]}-Daten. Nach ein paar Stunden erscheint hier der Verlauf.</div>`;
  } else {
    const vals = pts.map((p) => p[1]);
    const avg = mean(vals);
    const regMean = mean(pts.map((p) => regAvg[ts.indexOf(p[0])]).filter((v) => v != null && !Number.isNaN(v)));
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const loAt = pts.find((p) => p[1] === lo)[0];
    const days = {};
    pts.forEach(([t, v]) => { const k = new Date(t).toDateString(); (days[k] ||= []).push(v); });
    const dayMean = Object.fromEntries(Object.entries(days).map(([k, a]) => [k, mean(a)]));
    const byHour = {};
    pts.forEach(([t, v]) => { const d = new Date(t); (byHour[d.getHours()] ||= []).push(v - dayMean[d.toDateString()]); });
    const hourAvg = Object.fromEntries(Object.entries(byHour).map(([k, a]) => [k, mean(a)]));
    const hours = Object.keys(hourAvg).map(Number);
    const bestH = hours.length ? hours.reduce((a, b) => hourAvg[a] <= hourAvg[b] ? a : b) : null;
    const span = (pts[pts.length - 1][0] - pts[0][0]) / 864e5;
    const nChg = stationEvents(baseCache[view.base.id]?.changes, s.id, fuel).length;
    const fcData = baseCache[view.base.id]?.forecast, fcPts = fcSeries(fcData, s, fuel);
    const fcBand = fcPts.map(([t, v]) => [t, v - fcErr(fcData, t), v + fcErr(fcData, t)]);
    const fc12 = fcPts.filter(([t]) => t > Date.now() && t <= Date.now() + 12 * 36e5);
    const fcBest = fc12.length ? fc12.reduce((a, b) => b[1] < a[1] ? b : a) : null;
    h += `<div class="sec"><h2>${FUELS[fuel]}</h2><span class="sub">${span >= 6 ? say("die letschde 7 Täg", "letzte 7 Tage") : say("bis etz gsammelt", "bisher gesammelt")}</span></div>
      <div class="stats">
        <div class="card stat"><span class="eyebrow">Ø Preis hier</span><span class="v">${eur(avg)}</span>${pill(avg - regMean, `${ct(avg - regMean)} ggü. Ø`)}</div>
        <div class="card stat"><span class="eyebrow">Tiefstpreis</span><span class="v">${eurX(lo)}</span><span class="sub">${esc(fmtTime(new Date(loAt)))}</span></div>
        <div class="card stat"><span class="eyebrow">Höchstpreis</span><span class="v">${eurX(hi)}</span><span class="sub">${hi - lo < 0.0005 ? "Preis unverändert" : "Spanne " + ct(hi - lo).replace("+", "")}</span></div>
        <div class="card stat"><span class="eyebrow">Günstigste Zeit</span><span class="v">${bestH != null && Object.keys(days).length > 1 ? `${bestH}–${bestH + 1} Uhr` : "–"}</span><span class="sub">${nChg} Preisänderungen</span></div>
      </div>
      <div class="card chartcard"><div class="t">Preisverlauf</div><div class="s">${esc(s.brand)} im Vergleich zum Ø im Umkreis</div>
        ${lineChart([{ name: s.brand, pts, exact: true }, { name: "Ø Umkreis", cls: "ref", pts: regPts }, { name: "Prognose", cls: "proj", pts: fcPts, band: fcBand }])}
        <div class="legend"><span><i class="k"></i>${esc(s.brand)}</span><span><i class="k ref"></i>Ø Umkreis</span>${fcPts.length ? `<span><i class="k proj"></i>Prognose 24 h</span>` : ""}</div>
        ${fcBest ? `<div class="facts"><div>${say("Prognose: am billigschde voraussichtlich geg", "Prognose: am günstigsten voraussichtlich gegen")} <b>${hm(new Date(fcBest[0]))} Uhr</b> (≈ ${eurA(fcBest[1])}, ±${fmtNum(fcErr(fcData, fcBest[0]) * 100, 1)} ct).</div></div>` : ""}
        ${tbl(["Tag", "Ø", "Tief", "Hoch"], dailyRows(pts))}</div>`;
    if (Object.keys(days).length > 1)
      h += `<div class="card chartcard"><div class="t">Preis nach Uhrzeit</div><div class="s">${say("Abweichung vom Tagesschnitt dieser Tankstelle", "Abweichung vom Tagesmittel dieser Tankstelle")}</div>
        ${devBars(hourAvg, bestH)}
        <div class="legend"><span><i class="kr" style="background:var(--lo)"></i>günstiger</span><span><i class="kr" style="background:var(--hi)"></i>teurer</span><span>▼ jetzt</span></div>
        ${tbl(["Uhrzeit", "Abweichung"], hours.sort((a, b) => a - b).map((hh) => [`${hh}–${hh + 1} Uhr`, ct(hourAvg[hh])]))}</div>`;
  }
  // Preisänderungen dieser Tankstelle (Preis nach der Änderung rückwärts ab dem aktuellen Preis)
  const chg = baseCache[view.base.id]?.changes, ev = stationEvents(chg, s.id, fuel);
  if (ev.length) {
    h += changeCard(changeStats(chg, [s.id], fuel), say("Wann dreht die Tankstell am Preis?", "Wann ändert diese Tankstelle ihre Preise?"), "Anzahl je Uhrzeit, letzte 7 Tage");
    let p = s[fuel];
    const rows = ev.slice().reverse().slice(0, 10).map((e) => {
      const r = `<tr><td>${esc(span(e))}</td><td><span class="arw ${e.d > 0 ? "hi" : "lo"}">${e.d > 0 ? "▲" : "▼"}</span> ${ct(e.d)}</td><td>${p != null ? eurX(p) : ""}</td></tr>`;
      if (p != null) p -= e.d;
      return r;
    }).join("");
    h += `<div class="sec"><h2>${say("Zletscht am Preis dreht", "Letzte Preisänderungen")}</h2><span class="sub">${FUELS[fuel]}</span></div><div class="card"><table class="hours chg">${rows}</table>
      <div class="small" style="margin-top:8px">Angegeben ist der Zeitraum zwischen zwei Abrufen, in dem der Preis geändert wurde.</div></div>`;
  }
  $("#dstats").innerHTML = h;
}

function hoursCard(s) {
  const H = s.hours;
  let body;
  if (!H) body = `<div class="sub">${view.live ? (store.get("tk", "") ? "Öffnungszeiten werden geladen …" : "Keine Öffnungszeiten verfügbar.") : "Die Öffnungszeiten werden in den nächsten Stunden geladen."}</div>`;
  else if (H.wholeDay) body = `<div><b>Durchgehend geöffnet</b> – 24 Stunden, 7 Tage.</div>`;
  else if (!H.slots?.length) body = `<div class="sub">Keine Öffnungszeiten hinterlegt.</div>`;
  else {
    const wd = (new Date().getDay() + 6) % 7;
    body = `<table class="hours">` + H.slots.map((x) => {
      const range = x.start === x.end ? "24 h" : `${x.start}–${x.end === "00:00" ? "24:00" : x.end} Uhr`;
      return `<tr class="${x.days?.includes(wd) ? "today" : ""}"><td>${esc(x.text)}</td><td>${esc(range)}</td></tr>`;
    }).join("") + `</table>`;
    if (H.overrides?.length) body += `<div class="sub" style="margin-top:10px"><b>Abweichende Zeiten:</b><br>${H.overrides.map(esc).join("<br>")}</div>`;
  }
  return `<div class="sec"><h2>${say("Wann hen se offa?", "Öffnungszeiten")}</h2></div><div class="card">${body}</div>`;
}

// ---- Kartenansicht (Leaflet + OpenStreetMap-Kacheln, wird erst beim ersten Öffnen geladen)
const LEAFLET = {
  js: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js", jsI: "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=",
  css: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css", cssI: "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=",
};
const darkMq = matchMedia("(prefers-color-scheme: dark)");
// Kartenhintergrund: OpenStreetMap (ohne API-Schlüssel; CARTO verlangt inzwischen einen)
const TILES = [
  { url: () => "https://tile.openstreetmap.org/{z}/{x}/{y}.png", subdomains: "",
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', osm: true },
];
let tileIdx = 0, tileOk = 0, tileErr = 0;
const tileUrl = () => TILES[tileIdx].url();
function makeTiles() {
  const t = TILES[tileIdx];
  tileOk = 0; tileErr = 0;
  mapEl.classList.toggle("osm", !!t.osm);
  tiles = L.tileLayer(t.url(), { subdomains: t.subdomains || "abc", maxZoom: 19, attribution: t.attribution })
    .on("tileload", () => { tileOk++; mapEl.querySelector(".maperr")?.remove(); })
    .on("tileerror", () => {
      if (++tileErr < 4 || tileOk) return;
      if (tileIdx < TILES.length - 1) { map.removeLayer(tiles); tileIdx++; makeTiles(); }
      else if (!mapEl.querySelector(".maperr")) mapEl.insertAdjacentHTML("beforeend", '<div class="maperr">Kartenhintergrund gerade nicht erreichbar – Tankstellen werden trotzdem angezeigt.</div>');
    })
    .addTo(map);
}
const mapEl = document.createElement("div"); mapEl.id = "map";
let leafletP = null, map = null, tiles = null, layer = null, fitKey = "";
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  return leafletP ||= new Promise((res, rej) => {
    const css = Object.assign(document.createElement("link"), { rel: "stylesheet", href: LEAFLET.css, integrity: LEAFLET.cssI, crossOrigin: "" });
    const js = Object.assign(document.createElement("script"), { src: LEAFLET.js, integrity: LEAFLET.jsI, crossOrigin: "" });
    js.onload = res;
    js.onerror = () => { leafletP = null; css.remove(); js.remove(); rej(new Error("Karte konnte nicht geladen werden")); };
    document.head.append(css, js);
  });
}
async function mountMap() {
  const slot = $("#mapslot");
  if (!slot) return;
  slot.append(mapEl);
  try { await loadLeaflet(); } catch (e) { slot.innerHTML = `<div class="empty">${esc(e.message)}.<br>Zum Neuladen nach unten ziehen.</div>`; return; }
  if (!document.body.contains(mapEl)) return;
  if (!map) {
    map = L.map(mapEl, { zoomControl: false, zoomSnap: 0.5 });
    map.attributionControl.setPrefix(false);
    makeTiles();
    layer = L.layerGroup().addTo(map);
    map.on("moveend", drawMarkers);
    darkMq.addEventListener?.("change", () => tiles.setUrl(tileUrl()));
  }
  map.invalidateSize();
  const c = view.center, key = `${c.lat},${c.lng},${radius}`;
  if (key !== fitKey) { fitKey = key; map.fitBounds(L.latLng(c.lat, c.lng).toBounds(radius * 2000), { padding: [8, 8] }); }
  drawMarkers();
}
// Preis-Schilder für die günstigsten sichtbaren Tankstellen (beim Hineinzoomen für alle), sonst farbige Punkte
function drawMarkers() {
  if (!map || !layer || !view?.stations || !document.body.contains(mapEl)) return;
  layer.clearLayers();
  const c = view.center, lv = levelFn();
  L.circle([c.lat, c.lng], { radius: radius * 1000, color: "#f5b800", weight: 1.5, opacity: 0.9, fillColor: "#f5b800", fillOpacity: 0.05, interactive: false }).addTo(layer);
  L.marker([c.lat, c.lng], { icon: L.divIcon({ className: "mk", html: '<div class="me"></div>', iconSize: [0, 0] }), interactive: false, keyboard: false }).addTo(layer);
  const bounds = map.getBounds().pad(0.15);
  const priced = view.stations.filter((s) => hasPrice(s)).sort((a, b) => a[fuel] - b[fuel]);
  const bestId = priced[0]?.id;
  const vis = view.stations.filter((s) => s.lat != null && bounds.contains([s.lat, s.lng]) && (!onlyOpen || hasPrice(s)));
  const visPriced = priced.filter((s) => vis.includes(s));
  const pins = new Set(), placed = [];
  const order = vis.some((s) => s.id === bestId) ? [priced[0], ...visPriced] : visPriced;
  for (const s of order) {
    if (pins.size >= 30) break;
    if (pins.has(s.id)) continue;
    const pt = map.latLngToContainerPoint([s.lat, s.lng]);
    if (placed.every((q) => Math.abs(q.x - pt.x) > 78 || Math.abs(q.y - pt.y) > 30)) { pins.add(s.id); placed.push(pt); }
  }
  const rank = new Map(priced.map((s, i) => [s.id, i]));
  for (const s of vis) {
    const isPin = pins.has(s.id);
    const html = isPin ? `<div class="pin lv-${lv(s)}${s.id === bestId ? " best" : ""}"><i></i><span>${price(s[fuel])}</span></div>` : `<div class="dotm lv-${lv(s)}"></div>`;
    L.marker([s.lat, s.lng], {
      icon: L.divIcon({ className: "mk", html, iconSize: [0, 0] }),
      zIndexOffset: isPin ? 3000 - (rank.get(s.id) ?? 0) : 0, keyboard: false, title: `${s.brand}, ${s.place}`,
    }).on("click", () => openDetail(s.id)).addTo(layer);
  }
}
