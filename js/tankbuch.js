// Schwabensprit – Bereich „Tankbuch“: Speicher auf dem Gerät (IndexedDB), Vergleich mit dem Bestpreis, Erfassen, Statistik, Export.
// Alle Teile sind klassische Skripte und teilen sich den globalen Gültigkeitsbereich – Reihenfolge in index.html beachten.

// =========================================================================== Tankbuch
// Tankbelege fotografieren, mit Tesseract.js (Open Source, läuft komplett auf dem Gerät) auslesen,
// prüfen, speichern und mit dem günstigsten Preis im Umkreis der Homebase zum Tankzeitpunkt vergleichen.
// Alles bleibt auf dem Gerät (IndexedDB) – Sicherung/Export als Datei.
const tbDB = (() => {
  let p;
  const open = () => p ||= new Promise((res, rej) => {
    const r = indexedDB.open("schwabensprit", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("tankbuch", { keyPath: "id" });
    r.onsuccess = () => { const db = r.result; db.onclose = db.onversionchange = () => { p = null; try { db.close(); } catch {} }; res(db); };
    r.onerror = () => { p = null; rej(r.error); };
  });
  const tx = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction("tankbuch", mode), req = fn(t.objectStore("tankbuch"));
      t.oncomplete = () => res(req?.result);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error || new Error("Speichern abgebrochen (Speicher voll?)"));
    });
  };
  return { all: () => tx("readonly", (s) => s.getAll()), put: (e) => tx("readwrite", (s) => s.put(e)), del: (id) => tx("readwrite", (s) => s.delete(id)),
    // nur ändern, was noch so gespeichert ist (fn gibt null zurück: nichts tun)
    upd: (id, fn) => tx("readwrite", (s) => { const r = s.get(id); r.onsuccess = () => { const v = r.result && fn(r.result); if (v) s.put(v); }; return r; }) };
})();
let tbEntries = [], tbLoaded = false, tbErr = null;
async function tbLoad() {
  try { tbEntries = (await tbDB.all()) || []; tbErr = null; } catch (e) { tbEntries = []; tbErr = e; }
  tbEntries.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  tbLoaded = true;
}
try { navigator.storage?.persist?.(); } catch {}

const homeBase = () => {
  const id = store.get("homeBase", "");
  return bases.find((b) => b.id === id) || bases.find((b) => /^homebase/i.test(b.name)) || bases[0] || null;
};
const dDE = (iso) => iso ? iso.split("-").reverse().join(".") : "";
const num2 = (v) => { const x = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", ".")); return Number.isFinite(x) ? x : null; };
const fmtL = (v) => v == null ? "–" : fmtNum(v, 2) + " l";
const ctl = (v) => `${v > 0.0005 ? "+" : v < -0.0005 ? "−" : "±"}${fmtNum(Math.abs(v) * 100, 1)} ct/l`;

// ---- Vergleich: günstigster und mittlerer Preis im Umkreis der Homebase zur Tankzeit (min-JJJJ-MM.json)
const minCache = {};
// Vergleichsregion: die Homebase, wenn die Tankstelle dort liegt (oder unbekannt ist), sonst die Base,
// in der sie liegt – auswärts getankt wird nicht mit zu Hause verglichen. Außerhalb aller Bases: kein Vergleich.
function regionOf(e) {
  const hb = homeBase(), s = e.station;
  if (!s || s.lat == null) return hb;
  const d = (b) => distKm(b.lat, b.lng, s.lat, s.lng), inside = (b) => d(b) <= b.radius_km + 0.05;
  if (hb && inside(hb)) return hb;
  return bases.filter(inside).sort((x, y) => d(x) - d(y))[0] || null;
}
async function compareEntry(e) {
  if (!e.date || !e.fuel || !e.ppl) return null;
  if (e.premium) return { premium: true };          // Premium-Sorten gibt es bei Tankerkönig nicht – kein fairer Vergleich
  const b = regionOf(e);
  if (!b) return { outside: true };
  const ym = e.date.slice(0, 7), key = `${b.id}/${ym}`;
  if (!(key in minCache)) minCache[key] = await fetchData(`data/${b.id}/min-${ym}.json`).catch(() => null);
  const mf = minCache[key], arr = mf?.[e.fuel];
  if (!arr) return { base: b.id, none: true };
  const [y, m, d] = e.date.split("-").map(Number), [hh, mi] = (e.time || "12:00").split(":").map(Number);
  const [sy, sm] = mf.start.slice(0, 7).split("-").map(Number);
  const i0 = Math.floor((Date.UTC(y, m - 1, d, hh, mi) - Date.UTC(sy, sm - 1, 1)) / (mf.step * 60000));
  // Gezapft wird vor dem Bezahlen: Viertelstunde der Belegzeit und die davor zählen (z. B. 11:58 gezapft, 12:01 bezahlt)
  let ks = [i0, i0 - 1].filter((k) => arr.min[k] != null);
  if (!ks.length) ks = [i0 + 1, i0 - 2].filter((k) => arr.min[k] != null);   // kleine Lücken überbrücken
  if (!ks.length) return { base: b.id, none: true };
  const k = ks.reduce((x, y) => arr.min[y] < arr.min[x] ? y : x);
  return { base: b.id, baseName: b.name, home: b.id === homeBase()?.id, min: arr.min[k] / 1000, avg: arr.avg[k] / 1000, cheapest: mf.names?.[mf.ids[arr.at[k]]] || "" };
}
// Bewertung eines Eintrags: Bestpreis getroffen, günstiger als alles im Umkreis, oder Abstand
const verdictOf = (e) => {
  const c = e.cmp;
  if (!c || c.none || c.premium || c.outside || c.min == null) return null;
  const diff = e.ppl - c.min;
  return { diff, best: diff <= 0.0005, beat: diff < -0.0005, vsAvg: (c.avg - e.ppl) * e.liters };
};
const cmpNote = (e) => e.cmp?.premium ? "Premium" : e.cmp?.outside ? "außerhalb" : e.cmp?.none ? "kein Vergleich" : "";
// 6: Vergleiche neu berechnen (Homebase gewechselt, oder inzwischen Daten vorhanden)
let tbRecBusy = null;
const tbSig = (e) => JSON.stringify([e.date, e.time, e.fuel, e.ppl, e.premium, e.station?.lat, e.station?.lng]);
async function tbRecompute(all) {
  if (tbRecBusy) return tbRecBusy.then(() => all ? tbRecompute(all) : 0);
  tbRecBusy = (async () => {
    if (!tbLoaded) await tbLoad();
    let n = 0;
    for (const e of [...tbEntries]) {
      if (!all && e.cmp && !e.cmp.none) continue;
      const c = await compareEntry(e).catch(() => null);
      if (JSON.stringify(c) === JSON.stringify(e.cmp)) continue;
      const sig = tbSig(e);
      await tbDB.upd(e.id, (x) => tbSig(x) === sig ? { ...x, cmp: c } : null).catch(() => {});
      n++;
    }
    if (n) { await tbLoad(); renderTankbuch(); }
    return n;
  })().finally(() => { tbRecBusy = null; });
  return tbRecBusy;
}

// ---- Tankbuch: eigener Bereich (Leiste unten)
function tbStats(list) {
  const s = { n: list.length, liters: 0, cost: 0, saved: 0, cmpN: 0, best: 0 };
  for (const e of list) {
    s.liters += e.liters || 0; s.cost += e.total || 0;
    const v = verdictOf(e);
    if (v) { s.cmpN++; s.saved += v.vsAvg; if (v.best) s.best++; }
  }
  s.ppl = s.liters ? s.cost / s.liters : null;
  // Verbrauch aus Kilometerständen: von Volltankung zu Volltankung (jeweils mit km-Stand); alle Liter dazwischen
  // zählen mit – auch Teilbetankungen und Tankungen ohne km-Stand
  const chron = [...list].sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  let km = 0, l = 0, eu = 0, last = null, accL = 0, accE = 0;
  for (const e of chron) {
    if (last) { accL += e.liters || 0; accE += e.total || 0; }
    if (e.full === false || !e.odo) continue;
    const d = last ? e.odo - last.odo : 0;
    if (last && d > 0 && d < 3000) { km += d; l += accL; eu += accE; }
    last = e; accL = 0; accE = 0;
  }
  if (km >= 50) { s.cons = l / km * 100; s.per100 = eu / km * 100; s.km = km; }
  return s;
}
let tbYear = null;
// Monatskosten als schmale Balken (Jan–Dez), Wert über dem Balken
function monthBars(list, year) {
  const m = Array(12).fill(0);
  for (const e of list) m[+e.date.slice(5, 7) - 1] += e.total || 0;
  const max = Math.max(...m, 1), W = 320, H = 120, bw = W / 12;
  const bars = m.map((v, i) => {
    const h = v ? Math.max(2, v / max * (H - 34)) : 0, x = i * bw + bw * 0.2, y = H - 18 - h;
    return `${v ? `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.6).toFixed(1)}" height="${h.toFixed(1)}" rx="2" class="tbbar"><title>${"JFMAMJJASOND"[i]} ${year}: ${eur2(v)}</title></rect>
      <text x="${(x + bw * 0.3).toFixed(1)}" y="${(y - 3).toFixed(1)}" text-anchor="middle" class="tbval">${Math.round(v)}</text>` : ""}
      <text x="${(i * bw + bw / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle">${"JFMAMJJASOND"[i]}</text>`;
  }).join("");
  return `<div class="card chartcard"><div class="t">Kosten je Monat</div><div class="s">${year} · in €</div><svg viewBox="0 0 ${W} ${H}" class="tbchart" role="img" aria-label="Tankkosten je Monat ${year}">${bars}</svg></div>`;
}
function renderTankbuch() {
  const el = $("#tbBody");
  if (!el) return;
  if (!tbLoaded) { el.innerHTML = `<div class="skel" style="height:300px;margin-top:6px"></div>`; tbLoad().then(renderTankbuch); return; }
  const years = [...new Set(tbEntries.map((e) => e.date.slice(0, 4)))].sort().reverse();
  if (!years.includes(tbYear)) tbYear = years[0] || String(new Date().getFullYear());
  const year = tbYear, list = tbEntries.filter((e) => e.date?.startsWith(year)), st = tbStats(list), due = backupDue();
  const hb = homeBase();
  const months = {};
  for (const e of tbEntries) { const k = e.date.slice(0, 7); (months[k] ||= []).push(e); }
  const rows = list.map((e) => {
    const v = verdictOf(e);
    const tag = v ? v.best ? `<span class="tbtag good">🏆 ${v.beat ? say("billiger als älles", "günstiger als alle") : "Bestpreis"}</span>` : `<span class="tbtag ${v.diff > 0.02 ? "bad" : ""}">${ctl(v.diff)}</span>`
      : cmpNote(e) ? `<span class="tbtag">${cmpNote(e)}</span>` : "";
    return `<button class="tbitem" data-tbedit="${esc(e.id)}"><div class="d">${esc(dDE(e.date).slice(0, 6))}<span>${esc(e.time || "")}</span></div>
      <div class="info"><div class="name"><span>${esc(e.station?.label || "Tankstelle")}</span></div>
      <div class="addr">${FUELS[e.fuel] || ""}${e.premium ? " (Premium)" : ""} · ${fmtL(e.liters)} · ${eurX(e.ppl)}/l</div></div>
      <div class="p"><b>${eur2(e.total || 0)}</b>${tag}</div></button>`;
  }).join("");
  el.innerHTML = `
    <h1 class="tbh">📒 ${TB_NAME()}</h1>
    <p class="small" style="margin:2px 0 14px">Vergleich mit dem günstigsten Preis im Umkreis von <b>${esc(hb?.name || "–")}</b> zur Tankzeit · änderbar unter ⚙</p>
    <div class="row two" style="margin:0 0 6px">
      <button class="btn" id="btnTbScan">📷 ${say("Beleg scanna", "Beleg scannen")}</button>
      <button class="btn secondary" id="btnTbManual">✍️ Ohne Beleg</button>
    </div>
    ${due ? `<div class="card notice warnbox" style="margin-top:12px"><span class="ic">💾</span><div><b>Zeit für eine Sicherung</b><br>${esc(due)} Das ${TB_NAME()} liegt nur auf diesem Gerät.
      <div class="row" style="margin-top:10px"><button class="btn" id="btnTbBackup2">Jetzt sichern</button></div></div></div>` : ""}
    ${st.n ? `<div class="sec"><h2>${year}</h2><span class="sub">${st.n} ${st.n === 1 ? "Tankung" : "Tankungen"}</span></div>
    ${years.length > 1 ? `<div class="chips">${years.map((y) => `<button class="chip ${y === year ? "on" : ""}" data-tbyear="${y}">${y}</button>`).join("")}</div>` : ""}
    <div class="stats">
      <div class="card stat"><span class="eyebrow">Kosten</span><span class="v">${eur2(st.cost)}</span><span class="sub">${fmtNum(st.liters, 1)} l · Ø ${st.ppl ? eur(st.ppl) : "–"}/l</span></div>
      <div class="card stat"><span class="eyebrow">${say("Gspart", "Gespart")}</span><span class="v">${st.cmpN ? eur2(st.saved) : "–"}</span><span class="sub">ggü. Ø im Umkreis</span></div>
      <div class="card stat"><span class="eyebrow">Bestpreis</span><span class="v">${st.cmpN ? `${st.best} von ${st.cmpN}` : "–"}</span><span class="sub">Tankungen zum günstigsten Preis</span></div>
      <div class="card stat"><span class="eyebrow">Verbrauch</span><span class="v">${st.cons ? fmtNum(st.cons, 1) + " l" : "–"}</span><span class="sub">${st.cons ? `je 100 km · ${eur2(st.per100)}/100 km` : "Kilometerstand eintragen"}</span></div>
    </div>
    ${monthBars(list, year)}
    ${tbl(["Monat", "Liter", "Kosten", "Ø €/l"], Object.keys(months).filter((k) => k.startsWith(year)).sort().reverse().map((k) => {
      const s = tbStats(months[k]); return [`${k.slice(5)}/${k.slice(0, 4)}`, fmtNum(s.liters, 1), eur2(s.cost), s.ppl ? eur(s.ppl) : "–"];
    }))}
    <div class="sec"><h2>${say("Älle Tankunga", "Alle Tankungen")}</h2><span class="sub">${year}</span></div><div class="list">${rows}</div>`
    : tbErr ? `<div class="card notice warnbox"><span class="ic">⚠️</span><div><b>${TB_NAME()} konnte nicht geöffnet werden</b><br>${esc(tbErr.message || String(tbErr))} – die Einträge sind nicht verloren. Bitte die App neu starten.</div></div>`
    : `<div class="card empty"><div class="bigic">⛽</div><b>${say("No nix eitrage", "Noch keine Einträge")}</b><p>${say("Fotografier dein nächschda Tankbeleg – d'App liest Sorte, Menge ond Preis aus ond sagt dir, ob's dr Bestpreis war.", "Fotografiere deinen nächsten Tankbeleg – die App liest Sorte, Menge und Preis aus und sagt dir, ob es der Bestpreis war.")}</p></div>`}
    <div class="sec"><h2>Daten</h2></div>
    <div class="row two"><button class="btn secondary" id="btnTbCsv">Als CSV exportieren</button><button class="btn secondary" id="btnTbBackup">Sicherung speichern</button></div>
    <div class="row"><button class="btn secondary block" id="btnTbRestore">Sicherung laden</button></div>
    <p class="small" style="margin-top:10px">Das ${TB_NAME()} bleibt nur auf diesem Gerät gespeichert – Belege werden direkt auf dem iPhone ausgelesen (Tesseract.js, Open Source), nichts wird hochgeladen. Ab und zu eine Sicherung speichern, z. B. in iCloud Drive.</p>`;
}

// ---- Erfassen / Bearbeiten
let tbEdit = null, tbPhoto = null, tbOrder = [], tbFormSeq = 0;
const tbTouched = new Set();   // während des Lesens von Hand geänderte Felder: nicht überschreiben
["#tbDate", "#tbTime", "#tbFuel", "#tbL", "#tbP", "#tbT", "#tbPremium", "#tbSt"].forEach((id) => $(id).addEventListener("input", () => tbTouched.add(id)));
const tbImgSet = (blob) => { const el = $("#tbImg"); if (el.src.startsWith("blob:")) URL.revokeObjectURL(el.src); el.src = blob ? URL.createObjectURL(blob) : ""; el.hidden = !blob; };
let tbStList = [], tbGuess = null, tbSel = "";
const stLabel = (s) => `${s.brand} · ${s.place}, ${s.street}`;
async function stationOptions(selId, text) {
  tbStList = await allStations();
  tbGuess = text ? matchStation(text, tbStList) : null;
  tbSel = selId || tbGuess?.id || "";
  $("#tbStQ").value = "";
  paintStations(tbSel);
  return tbGuess;
}
// Liste nach Entfernung zur Homebase; mit Suchbegriff gefiltert („aral metz“)
function paintStations(cur = $("#tbSt").value || tbSel) {
  const hb = homeBase(), q = $("#tbStQ").value.toLowerCase().split(/\s+/).filter(Boolean);
  const d = (s) => hb && s.lat != null ? distKm(hb.lat, hb.lng, s.lat, s.lng) : 999;
  const hit = (s) => q.every((w) => stLabel(s).toLowerCase().includes(w) || String(s.plz || "").startsWith(w));
  const list = tbStList.filter((s) => s.id !== tbGuess?.id && hit(s)).sort((a, b) => d(a) - d(b)).slice(0, q.length ? 80 : 400);
  $("#tbSt").innerHTML = `<option value="">– unbekannt / andere –</option>`
    + (tbGuess && hit(tbGuess) ? `<optgroup label="Erkannt"><option value="${esc(tbGuess.id)}">${esc(stLabel(tbGuess))}</option></optgroup>` : "")
    + `<optgroup label="${q.length ? `${list.length} Treffer` : "Nach Entfernung zur Homebase"}">${list.map((s) => `<option value="${esc(s.id)}">${esc(stLabel(s))}</option>`).join("")}</optgroup>`;
  if (cur && ![...$("#tbSt").options].some((o) => o.value === cur)) {
    const s = tbStList.find((x) => x.id === cur);
    $("#tbSt").insertAdjacentHTML("afterbegin", `<option value="${esc(cur)}">${esc(s ? stLabel(s) : tbEdit?.station?.label || "gespeicherte Tankstelle")}</option>`);
  }
  $("#tbSt").value = q.length && !cur && list.length ? list[0].id : cur;
}
$("#tbStQ").addEventListener("input", () => paintStations());
function fillForm(e) {
  const now = new Date();
  $("#tbDate").value = e.date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  $("#tbTime").value = e.time || "";
  $("#tbFuel").value = e.fuel || fuel;
  $("#tbL").value = e.liters != null ? fmtNum(e.liters, 2) : "";
  $("#tbP").value = e.ppl != null ? fmtNum(e.ppl, 3) : "";
  $("#tbT").value = e.total != null ? fmtNum(e.total, 2) : "";
  $("#tbOdo").value = e.odo || "";
  $("#tbFull").checked = e.full !== false;
  $("#tbNote").value = e.note || "";
  $("#tbPremium").checked = !!e.premium;
  tbOrder = []; tbTouched.clear();
}
async function openTbForm(entry, file) {
  const seq = ++tbFormSeq, still = () => seq === tbFormSeq && $("#dlgTb").open;   // gehört das Ergebnis noch zu diesem Dialog?
  tbEdit = entry || null; tbPhoto = entry?.photo || null;
  fillForm(entry || {});
  // Auswahl sofort auf die gespeicherte Tankstelle setzen – die volle Liste kommt nach
  tbSel = entry?.station?.id || ""; tbGuess = null; $("#tbStQ").value = "";
  $("#tbSt").innerHTML = `<option value="">– unbekannt / andere –</option>${entry?.station ? `<option value="${esc(entry.station.id)}">${esc(entry.station.label || "gespeicherte Tankstelle")}</option>` : ""}`;
  $("#tbSt").value = tbSel;
  $("#tbTitle").textContent = entry ? "Tankung bearbeiten" : file ? "Beleg prüfen" : "Tankung erfassen";
  $("#btnTbDel").hidden = !entry;
  tbImgSet(tbPhoto);
  $("#tbOcr").textContent = ""; delete $("#tbOcr").dataset.text;
  $("#dlgTb").showModal();
  await stationOptions(entry?.station?.id, null).catch(() => {});
  if (!file || !still()) return;
  const thumb = await thumbOf(file).catch(() => null);
  if (!still()) return;
  tbPhoto = thumb; if (thumb) tbImgSet(thumb);
  $("#tbOcr").innerHTML = `<span class="spin-dot"></span> Beleg wird gelesen … (beim ersten Mal wird der Belegleser geladen, ca. 5 MB)`;
  try {
    const text = await readReceipt(file, (p, step) => { if (still()) $("#tbOcr").innerHTML = `<span class="spin-dot"></span> Beleg wird gelesen${step ? ` (${step + 1}. Versuch, gedreht)` : ""} … ${Math.round(p * 100)} %`; });
    if (!still()) return;
    const r = parseReceipt(text), keep = new Set(tbTouched);
    // von Hand Eingetipptes behalten
    const prem = $("#tbPremium").checked, vals = { "#tbDate": $("#tbDate").value, "#tbTime": $("#tbTime").value, "#tbFuel": $("#tbFuel").value, "#tbL": $("#tbL").value, "#tbP": $("#tbP").value, "#tbT": $("#tbT").value };
    fillForm({ ...r, full: true });
    for (const id of keep) if (id in vals) $(id).value = vals[id];
    if (keep.has("#tbPremium")) $("#tbPremium").checked = prem;
    const guess = keep.has("#tbSt") ? null : await stationOptions(null, text).catch(() => null);
    if (!still()) return;
    const found = ["fuel", "liters", "ppl", "total", "date", "time"].filter((k) => r[k] != null).length;
    $("#tbOcr").innerHTML = `${found >= 5 ? "✅" : "⚠️"} ${found} von 6 Angaben erkannt${guess ? ` · Tankstelle: ${esc(guess.brand)} ${esc(guess.place)}` : ""}${r.shop ? ` · Shop-Artikel (${eur2(r.shop)}) nicht mitgezählt` : ""}${r.discount ? ` · Rabatt (${eur2(r.discount)}) abgezogen` : ""}. <b>Bitte prüfen</b> – Belege sind nicht immer gut lesbar.`;
    $("#tbOcr").dataset.text = text;
  } catch (err) {
    if (still()) $("#tbOcr").textContent = `⚠️ ${err.message || "Beleg konnte nicht gelesen werden"} – bitte von Hand eintragen.`;
  }
}
// Zwei von Menge / Preis / Betrag eingegeben → dritte Größe ausrechnen
["#tbL", "#tbP", "#tbT"].forEach((id) => $(id).addEventListener("input", () => {
  tbOrder = [...tbOrder.filter((x) => x !== id), id].slice(-2);
  if (tbOrder.length < 2) return;
  const L = num2($("#tbL").value), P = num2($("#tbP").value), T = num2($("#tbT").value);
  const other = ["#tbL", "#tbP", "#tbT"].find((x) => !tbOrder.includes(x));
  if (other === "#tbT" && L && P) $("#tbT").value = fmtNum(L * P, 2);
  if (other === "#tbP" && L && T) $("#tbP").value = fmtNum(T / L, 3);
  if (other === "#tbL" && P && T) $("#tbL").value = fmtNum(T / P, 2);
}));
async function saveTb() {
  const L = num2($("#tbL").value), P = num2($("#tbP").value), T = num2($("#tbT").value);
  if (!$("#tbDate").value || !L || !P) { toast("Bitte mindestens Datum, Menge und Preis je Liter eintragen.", 4000); return; }
  if (L < 0 || P < 0 || (T != null && T < 0)) { toast("Menge, Preis und Betrag dürfen nicht negativ sein.", 4000); return; }
  const sid = $("#tbSt").value, opt = $("#tbSt").selectedOptions[0];
  const e = {
    id: tbEdit?.id || `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    date: $("#tbDate").value, time: $("#tbTime").value || "", fuel: $("#tbFuel").value, premium: $("#tbPremium").checked,
    liters: L, ppl: P, total: T ?? Math.round(L * P * 100) / 100,
    station: sid ? (() => { const st = tbStList.find((x) => x.id === sid);
      return { id: sid, label: st ? `${st.brand} · ${st.place}` : (tbEdit?.station?.id === sid ? tbEdit.station.label : opt.textContent.split(",")[0]),
        lat: st?.lat ?? tbEdit?.station?.lat ?? null, lng: st?.lng ?? tbEdit?.station?.lng ?? null }; })() : null,
    odo: num2($("#tbOdo").value) || null, full: $("#tbFull").checked, note: $("#tbNote").value.trim(),
    photo: tbPhoto || null, created: tbEdit?.created || new Date().toISOString(),
  };
  const warn = [], ord = (x) => x.date + (x.time || "");
  if (e.ppl < 1.2 || e.ppl > 3.2) warn.push(`Preis je Liter ${eurX(e.ppl)} ist ungewöhnlich`);
  if (e.liters > 150) warn.push(`${fmtL(e.liters)} sind sehr viel für eine Tankung`);
  const dT = e.total - e.liters * e.ppl;   // kleiner ist ok (Rabatt, z. B. Payback-Coupon), aber nicht beliebig
  if (dT > Math.max(0.1, e.total * 0.02) || dT < -Math.max(0.1, e.liters * e.ppl * 0.12)) warn.push("Menge × Preis passt nicht zum Betrag");
  if (e.odo) {
    const prev = tbEntries.filter((x) => x.id !== e.id && x.odo && ord(x) < ord(e)).sort((a, b) => ord(b).localeCompare(ord(a)))[0];
    const next = tbEntries.filter((x) => x.id !== e.id && x.odo && ord(x) > ord(e)).sort((a, b) => ord(a).localeCompare(ord(b)))[0];
    if (prev && e.odo <= prev.odo) warn.push(`Kilometerstand ist nicht größer als bei der Tankung am ${dDE(prev.date)} (${prev.odo} km)`);
    else if (prev && e.odo - prev.odo > 2500) warn.push(`${e.odo - prev.odo} km seit der letzten Tankung – Tippfehler?`);
    if (next && e.odo >= next.odo) warn.push(`Kilometerstand ist größer als bei der Tankung am ${dDE(next.date)} (${next.odo} km)`);
  }
  if (warn.length && !confirm(`Bitte prüfen:\n• ${warn.join("\n• ")}\n\nTrotzdem speichern?`)) return;
  const dup = tbEntries.find((x) => x.id !== e.id && x.date === e.date && x.time === e.time && Math.abs((x.total || 0) - e.total) < 0.01);
  if (dup && !confirm(`Diese Tankung scheint schon im ${TB_NAME()} zu stehen. Trotzdem speichern?`)) return;
  e.cmp = await compareEntry(e).catch(() => null);
  try { await tbDB.put(e); } catch (err) { toast("Speichern nicht möglich: " + err.message, 6000); return; }
  $("#dlgTb").close();
  await tbLoad();
  renderTankbuch();
  celebrate(e);
}
// ---- Gratulation bei Bestpreis (oder günstiger als alles im Umkreis der Homebase)
function celebrate(e) {
  const v = verdictOf(e), area = e.cmp?.baseName || homeBase()?.name || "der Homebase";
  if (!v) {
    toast(e.cmp?.premium ? "Gespeichert ✓ – Premium-Sorte, daher ohne Preisvergleich."
      : e.cmp?.outside ? "Gespeichert ✓ – die Tankstelle liegt außerhalb deiner Bases, daher ohne Preisvergleich."
      : e.cmp?.none ? "Gespeichert ✓ – für diesen Zeitpunkt gibt es keine Vergleichsdaten." : "Gespeichert ✓", 5000);
    return;
  }
  if (!v.best) {
    toast(say(`Gspeichert ✓ – ${ctl(v.diff)} über em Bestpreis im Umkreis vo ${area} (${e.cmp.cheapest}). Nägschtes Mol!`,
      `Gespeichert ✓ – ${ctl(v.diff)} über dem Bestpreis im Umkreis von ${area} (${e.cmp.cheapest}).`), 6000);
    return;
  }
  const L = fmtNum(e.liters, 0);
  $("#cgTitle").textContent = v.beat ? (e.cmp.home ? say("Billiger als älles drhoim!", "Günstiger als alles rund um die Homebase!") : say(`Billiger als älles rund um ${area}!`, `Günstiger als alles rund um ${area}!`)) : say("Bestpreis – sauber!", "Bestpreis getroffen!");
  $("#cgText").innerHTML = (v.beat
    ? say(`Mit ${eurX(e.ppl)}/l warsch <b>${fmtNum(-v.diff * 100, 1)} ct</b> billiger als dr günstigschde Preis im Umkreis vo ${esc(area)}.`,
      `Mit ${eurX(e.ppl)}/l warst du <b>${fmtNum(-v.diff * 100, 1)} ct</b> günstiger als der günstigste Preis im Umkreis von ${esc(area)}.`)
    : say(`Um ${esc(e.time || "die Zeit")} hot's im Umkreis vo ${esc(area)} nix Billigers gä als deine ${eurX(e.ppl)}/l.`,
      `Um ${esc(e.time || "diese Zeit")} gab es im Umkreis von ${esc(area)} nichts Günstigeres als deine ${eurX(e.ppl)}/l.`))
    + (v.vsAvg > 0.05 ? `<br>${say("Gegenüber em Durchschnitt gspart", "Gegenüber dem Durchschnitt gespart")}: <b>${eur2(v.vsAvg)}</b> bei ${L} l${SW() ? ` – ${brezel(v.vsAvg).replace(/^D/, "d").replace(/[.!]$/, "")}` : ""}.` : "");
  const cf = $("#cgConfetti");
  cf.innerHTML = Array.from({ length: 26 }, (_, i) => `<i style="left:${(i * 37) % 100}%;animation-delay:${(i % 9) * 0.12}s;animation-duration:${1.8 + (i % 5) * 0.35}s">${["🎉", "⛽", "🥨", "✨", "🏆"][i % 5]}</i>`).join("");
  $("#congrats").hidden = false;
  clearTimeout(celebrate.t); celebrate.t = setTimeout(() => { $("#congrats").hidden = true; }, 8000);
}
$("#congrats").addEventListener("click", () => { $("#congrats").hidden = true; });

// ---- Export (CSV, z. B. für Excel/Steuer) und Sicherung (JSON, ohne Fotos)
async function shareFile(name, type, content) {
  const file = new File([content], name, { type });
  try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: name }); return true; } } catch (e) { if (e.name === "AbortError") return false; }
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(file), download: name });
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  return true;
}
// Sicherung fällig? Ab 3 Einträgen: noch nie gesichert, älter als 30 Tage oder 10 neue Einträge seitdem
function backupDue() {
  if (tbEntries.length < 3) return null;
  const at = store.get("tbBackupAt", ""), since = at ? tbEntries.filter((e) => (e.created || "") > at).length : tbEntries.length;
  if (!at) return `Du hast dein ${TB_NAME()} noch nie gesichert.`;
  const days = Math.floor((Date.now() - new Date(at)) / 864e5);
  if (days > 30 || since >= 10) return `Letzte Sicherung vor ${days} Tagen${since ? `, seitdem ${since} neue ${since === 1 ? "Tankung" : "Tankungen"}` : ""}.`;
  return null;
}
const csvNum = (v, d) => v == null ? "" : v.toFixed(d).replace(".", ",");
function exportCsv() {
  const head = ["Datum", "Uhrzeit", "Tankstelle", "Sorte", "Liter", "Preis je Liter", "Betrag", "Kilometerstand", "Vollgetankt",
    "Bestpreis Umkreis Homebase", "Ø Umkreis Homebase", "Abstand zum Bestpreis (ct/l)", "Gespart ggü. Ø (€)", "Notiz"];
  const q = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const rows = [...tbEntries].reverse().map((e) => {
    const v = verdictOf(e);
    return [dDE(e.date), e.time, q(e.station?.label || ""), FUELS[e.fuel] + (e.premium ? " (Premium)" : ""), csvNum(e.liters, 2), csvNum(e.ppl, 3), csvNum(e.total, 2),
      e.odo ?? "", e.full === false ? "nein" : "ja", csvNum(e.cmp?.min, 3), csvNum(e.cmp?.avg, 3), v ? csvNum(v.diff * 100, 1) : "", v ? csvNum(v.vsAvg, 2) : "", q(e.note)].join(";");
  });
  shareFile(`Tankbuch-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv", "﻿" + [head.join(";"), ...rows].join("\r\n"));
}
async function exportBackup() {
  const data = tbEntries.map(({ photo, ...e }) => e);
  const ok = await shareFile(`Tankbuch-Sicherung-${new Date().toISOString().slice(0, 10)}.json`, "application/json", JSON.stringify({ app: "Schwabensprit", v: 1, entries: data }, null, 1));
  if (ok) { store.set("tbBackupAt", new Date().toISOString()); renderTankbuch(); }
}
$("#tbImport").addEventListener("change", async (ev) => {
  const f = ev.target.files[0]; ev.target.value = "";
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    const list = (d.entries || []).filter((e) => e.id && e.date && e.liters);
    for (const e of list) { const old = tbEntries.find((x) => x.id === e.id); await tbDB.put({ ...e, photo: old?.photo || null }); }
    await tbLoad(); renderTankbuch();
    toast(`${list.length} Tankungen aus der Sicherung übernommen ✓`);
  } catch { toast(`Das ist keine gültige ${TB_NAME()}-Sicherung.`, 5000); }
});
$("#tbFile").addEventListener("change", (ev) => { const f = ev.target.files[0]; ev.target.value = ""; if (f) openTbForm(null, f); });
$("#tbForm").addEventListener("submit", (e) => e.preventDefault());   // Eingabetaste schließt das Formular nicht
$("#btnTbSave").addEventListener("click", saveTb);
$("#btnTbCancel").addEventListener("click", () => $("#dlgTb").close());
$("#btnTbDel").addEventListener("click", async () => {
  if (!tbEdit || !confirm("Diese Tankung löschen?")) return;
  await tbDB.del(tbEdit.id); $("#dlgTb").close(); await tbLoad(); renderTankbuch(); toast("Gelöscht.");
});
document.addEventListener("click", (e) => {
  const el = e.target.closest("#btnTbScan,#btnTbManual,#btnTbCsv,#btnTbBackup,#btnTbBackup2,#btnTbRestore,[data-tbedit],[data-tbyear]");
  if (!el) return;
  if (el.dataset.tbyear) { tbYear = el.dataset.tbyear; return renderTankbuch(); }
  if (el.id === "btnTbBackup2") return exportBackup();
  if (el.id === "btnTbScan") return $("#tbFile").click();
  if (el.id === "btnTbManual") return openTbForm(null, null);
  if (el.id === "btnTbCsv") return exportCsv();
  if (el.id === "btnTbBackup") return exportBackup();
  if (el.id === "btnTbRestore") return $("#tbImport").click();
  if (el.dataset.tbedit) return openTbForm(tbEntries.find((x) => x.id === el.dataset.tbedit), null);
});
