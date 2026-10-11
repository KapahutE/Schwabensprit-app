// Schwabensprit – Bereich „Verlauf“: Auswertung der letzten 7 Tage, Preis nach Uhrzeit, Preisänderungen, Rangliste, Wochenreports.
// Alle Teile sind klassische Skripte und teilen sich den globalen Gültigkeitsbereich – Reihenfolge in index.html beachten.

// ---- Auswertung (läuft in der App, damit sie zum gewählten Radius passt)
function analyse(hist, ids, f) {
  if (!hist?.ts?.length) return null;
  const ts = hist.ts.map((t) => new Date(t));
  const st = ids.map((id) => [id, hist.stations[id]?.[f]]).filter(([, a]) => a && a.some((v) => v != null));
  if (!st.length) return null;
  const all = [], perTs = ts.map(() => []), byHour = {}, byWd = {}, ranking = [];
  let lo = null, hi = null;
  for (const [id, arr] of st) {
    const vals = arr.map((v) => v == null ? null : v / 1000);
    const days = {};
    vals.forEach((v, i) => { if (v != null) (days[ts[i].toDateString()] ||= []).push(v); });
    const dm = Object.fromEntries(Object.entries(days).map(([k, a]) => [k, mean(a)]));
    const own = vals.filter((v) => v != null), sm = mean(own);
    ranking.push({ id, mean: sm });
    vals.forEach((v, i) => {
      if (v == null) return;
      all.push(v); perTs[i].push(v);
      (byHour[ts[i].getHours()] ||= []).push(v - dm[ts[i].toDateString()]);
      (byWd[(ts[i].getDay() + 6) % 7] ||= []).push(v - sm);
      if (!lo || v < lo.v) lo = { v, id, t: ts[i] };
      if (!hi || v > hi.v) hi = { v, id, t: ts[i] };
    });
  }
  const hourAvg = Object.fromEntries(Object.entries(byHour).map(([h, a]) => [h, mean(a)]));
  const hours = Object.keys(hourAvg).map(Number);
  const wdAvg = Object.fromEntries(Object.entries(byWd).map(([d, a]) => [d, mean(a)]));
  const wds = Object.keys(wdAvg).map(Number);
  const prev = st.map(([id]) => [ranking.find((r) => r.id === id).mean, hist.prev?.[id]?.[f]]).filter(([, p]) => p != null);
  ranking.sort((a, b) => a.mean - b.mean);
  return {
    mean: mean(all), lo, hi, hourAvg, wdAvg, ranking,
    bestHour: hours.reduce((a, b) => hourAvg[a] <= hourAvg[b] ? a : b),
    worstHour: hours.reduce((a, b) => hourAvg[a] >= hourAvg[b] ? a : b),
    bestWd: wds.length > 1 ? wds.reduce((a, b) => wdAvg[a] <= wdAvg[b] ? a : b) : null,
    trend: prev.length ? mean(prev.map(([m, p]) => m - p / 1000)) : null,
    series: ts.map((t, i) => [t.getTime(), mean(perTs[i])]).filter((p) => p[1] != null),
    days: new Set(ts.map((t) => t.toDateString())).size,
  };
}
// Preisänderungen: changes.json enthält je Tankstelle/Sorte [Minuten seit start, Δ in 1/1000 €, …]
// Je Änderung: Zeitraum zwischen zwei Abrufen (from–to), in dem sie passiert ist; t = Mitte (für Auswertungen)
function stationEvents(chg, id, f) {
  const arr = chg?.stations?.[id]?.[f] || [], t0 = new Date(chg?.start).getTime(), out = [];
  if (chg?.v === 2) {
    for (let i = 0; i < arr.length; i += 3) {
      const to = t0 + arr[i] * 60000, from = to - arr[i + 1] * 60000;
      out.push({ t: new Date((from + to) / 2), from: new Date(from), to: new Date(to), d: arr[i + 2] / 1000 });
    }
  } else for (let i = 0; i < arr.length; i += 2) out.push({ t: new Date(t0 + arr[i] * 60000), d: arr[i + 1] / 1000 });
  return out;
}
const hm = (d) => d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
const span = (e) => e.from && e.to - e.from > 0
  ? `${e.to.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })}, ${hm(e.from)}–${hm(e.to)}`
  : fmtTime(e.t);
function changeStats(chg, ids, f) {
  if (!chg?.stations) return null;
  const up = Array(24).fill(0), down = Array(24).fill(0), upQ = {}, downQ = {}, ups = [], downs = [];
  let first = Infinity, last = 0, withData = 0;
  for (const id of ids) {
    const ev = stationEvents(chg, id, f);
    if (ev.length) withData++;
    for (const { t, d } of ev) {
      const h = t.getHours(), q = h * 4 + Math.floor(t.getMinutes() / 15);
      if (d > 0) { up[h]++; upQ[q] = (upQ[q] || 0) + 1; ups.push(d); } else { down[h]++; downQ[q] = (downQ[q] || 0) + 1; downs.push(d); }
      first = Math.min(first, t.getTime()); last = Math.max(last, t.getTime());
    }
  }
  const n = ups.length + downs.length;
  if (!n) return null;
  const top = (o) => Object.keys(o).sort((a, b) => o[b] - o[a]).slice(0, 3).map(Number);
  const days = Math.max(1, Math.min(7, (last - first) / 864e5));
  return { up, down, n, topUp: top(upQ), topDown: top(downQ), avgUp: mean(ups), avgDown: mean(downs),
    perDay: n / Math.max(withData, 1) / days };
}

// ---- Bereich „Verlauf“: letzte 7 Tage, Preis nach Uhrzeit, Preisänderungen, Rangliste, Wochenreports
function verlaufHtml() {
  let h = `<div id="analysis"></div>`;
  if (view.reports?.length) {
    h += `<div class="sec"><h2>${say("D'Woch im Rückblick", "Wochenreports")}</h2><span class="sub">${esc(view.base.name)}</span></div><div class="list">` + view.reports.map((r) =>
      `<button class="item" data-report="${esc(r.file)}"><div class="badge rank">📊</div><div class="info"><div class="name"><span>${esc(r.title)}</span></div></div>${CHEV}</button>`).join("") + `</div>`;
  }
  return h + FOOT();
}

// Kurzfassung der Tagesspitzen: übliche Uhrzeit und Abstand zum Tagestief (nur volle Tage)
function peakNote(series) {
  const days = {};
  for (const [t, v] of series) (days[new Date(t).toDateString()] ||= []).push([t, v]);
  const full = Object.values(days).filter((d) => d.length >= 20);
  if (full.length < 2) return "";
  const hours = {}, rise = [];
  for (const d of full) {
    const top = d.reduce((a, b) => b[1] > a[1] ? b : a), low = Math.min(...d.map((p) => p[1]));
    const h = new Date(top[0]).getHours(); hours[h] = (hours[h] || 0) + 1; rise.push(top[1] - low);
  }
  const h = +Object.keys(hours).sort((a, b) => hours[b] - hours[a])[0];
  return `<span>${say(`Spitza meischtens geg ${h} Uhr, im Schnitt ${ct(mean(rise))} überm Tagestief`, `Spitzen meist gegen ${h} Uhr, im Schnitt ${ct(mean(rise))} über dem Tagestief`)}</span>`;
}

function renderAnalysis() {
  if (!view || view.error) return;
  const elA = $("#analysis");
  if (!elA && !$("#when")) return;
  if (view.live || !view.base) {
    noonCtx = null; anaSum = null; renderWhen();
    if (elA) elA.innerHTML = `<div class="card notice" style="margin-top:6px"><span class="ic">📈</span><div>Verlauf, beste Tankzeit und Wochenreports gibt es für Orte innerhalb von ${bases.map((b) => esc(b.name)).join(", ")}.</div></div>`;
    return;
  }
  const cache = baseCache[view.base.id];
  if (!cache?.history) {
    renderWhen();
    if (elA) elA.innerHTML = `<div class="skel" style="height:120px;margin-top:6px"></div><div class="skel" style="height:260px"></div>`;
    return;
  }
  const ids = view.stations.map((s) => s.id);
  const sum = analyse(cache.history, ids, fuel);
  const ninfo = noonInfo(cache.changes, ids, fuel);
  if (ninfo) {
    // ab wann die Senkungen nach dem Sprung auslaufen (≤ 0,5 ct über dem Tiefstand des Nachmittags/Abends)
    const aft = [...Array(11).keys()].map((i) => 13 + i).filter((h) => sum?.hourAvg?.[h] != null);
    const low = Math.min(...aft.map((h) => sum.hourAvg[h]));
    const rec = aft.find((h) => sum.hourAvg[h] <= low + 0.005);
    noonCtx = { info: ninfo, recover: rec ?? null };
  } else noonCtx = null;
  anaSum = sum;
  renderWhen();
  if (sum?.trend != null && $("#heroPills") && !$("#heroPills .trend"))
    $("#heroPills").insertAdjacentHTML("beforeend", pill(sum.trend, `Woche ${ct(sum.trend)}`, "trend"));
  if (!elA) return;
  if (!sum) { elA.innerHTML = `<div class="card empty"><div class="bigic">📈</div><b>${say("No koi Verlauf", "Noch kein Verlauf")}</b><p>${say("Für dui Sorte ond den Umkreis gibt's no z'wenig Daten.", "Für diese Sorte und diesen Umkreis gibt es noch zu wenige Daten.")}</p></div>`; return; }
  let h = `<div class="sec" style="margin-top:6px"><h2>${sum.days >= 6 ? say("Die letschde 7 Täg", "Letzte 7 Tage") : say("Bis etz gsammelt", "Bisher gesammelt")}</h2><span class="sub">${FUELS[fuel]} · ${radius} km</span></div>
    <div class="stats">
      <div class="card stat"><span class="eyebrow">Ø Preis</span><span class="v">${eur(sum.mean)}</span>${sum.trend != null ? pill(sum.trend, `${ct(sum.trend)} ggü. Vorwoche`) : ""}</div>
      <div class="card stat"><span class="eyebrow">Tiefstpreis</span><span class="v">${eur(sum.lo.v)}</span><span class="sub">${esc(labelOf(sum.lo.id))} · ${esc(fmtTime(sum.lo.t))}</span></div>
    </div>
    <div class="card chartcard"><div class="t">Durchschnittspreis</div><div class="s">Alle Tankstellen im Umkreis, stündlich</div>
      ${lineChart([{ name: "Ø im Umkreis", pts: sum.series }], { peaks: true })}
      <div class="legend"><span><i class="kr pkk"></i>${say("Tageshöchschtwert", "Tageshöchstwert")}</span>${peakNote(sum.series)}</div>
      ${tbl(["Tag", "Ø", "Tief", "Hoch"], dailyRows(sum.series))}</div>`;
  if (sum.days > 1) {
    h += `<div class="card chartcard"><div class="t">Preis nach Uhrzeit</div><div class="s">${say("Abweichung vom Tagesschnitt der jeweiligen Tankstelle", "Abweichung vom Tagesmittel der jeweiligen Tankstelle")}</div>
      ${devBars(sum.hourAvg, sum.bestHour)}
      <div class="legend"><span><i class="kr" style="background:var(--lo)"></i>günstiger</span><span><i class="kr" style="background:var(--hi)"></i>teurer</span><span>▼ jetzt</span></div>
      ${sum.bestWd != null ? `<div class="facts"><div>${say(`Am billigschde meischtens am <b>${WD_SCHW[sum.bestWd]}</b>.`, `Günstigster Wochentag: <b>${WD_LONG[sum.bestWd]}</b>.`)}</div></div>` : ""}
      ${tbl(["Uhrzeit", "Abweichung"], Object.keys(sum.hourAvg).map(Number).sort((a, b) => a - b).map((hh) => [`${hh}–${hh + 1} Uhr`, ct(sum.hourAvg[hh])]))}</div>`;
  }
  h += changeCard(changeStats(cache.changes, ids, fuel), say("Wann drehet se am Preis?", "Wann ändern sich die Preise?"), "Anzahl der Erhöhungen und Senkungen je Uhrzeit");
  h += `<div class="sec"><h2>${say("Im Schnitt am billigschde", "Günstigste im Schnitt")}</h2><span class="sub">Ø der Woche</span></div><div class="list">` + sum.ranking.slice(0, 5).map((r, i) => {
    const s = byId(r.id);
    return `<button class="item" data-detail="${esc(r.id)}"><div class="badge rank">${i + 1}</div><div class="info">
      <div class="name"><span>${esc(s?.brand ?? "Tankstelle")}</span></div><div class="addr">${km(s?.dist)} · ${esc(s?.place ?? "")}, ${esc(s?.street ?? "")}</div></div>
      <div class="p"><b>${price(r.mean)}</b><div class="d">Ø Woche</div></div>${CHEV}</button>`;
  }).join("") + `</div>`;
  elA.innerHTML = h;
}

// ---- Wochenreport anzeigen (funktioniert auch bei privatem Repository)
async function openReport(file) {
  try {
    const html = await fetchData(file, true);
    $("#repFrame").srcdoc = SW() ? html : html.replace(/<html\b/, '<html class="hoch"');
    $("#report").classList.add("open");
    try { window.history.pushState({ r: 1 }, ""); } catch {}
  } catch (e) { toast("Report konnte nicht geladen werden: " + e.message, 5000); }
}
function closeReport() { $("#report").classList.remove("open"); }
$("#btnRepBack").addEventListener("click", () => { closeReport(); try { window.history.back(); } catch {} });
