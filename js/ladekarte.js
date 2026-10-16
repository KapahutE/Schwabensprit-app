// Schwabensprit – E-Modus: „Meine Ladekarte“ (eigene Preise je kWh für Ladekarte/App, z. B. EnBW mobility+).
//
// Die Preise gibt es nirgends offen – sie sind eine EIGENEINGABE und werden überall als solche gekennzeichnet (💳),
// nie als Betreiberpreis. Zwei voneinander unabhängige Sicherungen sorgen dafür, dass falsche oder veraltete Eingaben
// nicht unbemerkt Empfehlungen bestimmen:
//   1. Prüfung bei der Eingabe: harte Grenzen, Plausibilität (üblicher Bereich, DC ≥ AC, Abstand zu den Direktpreisen in der
//      Umgebung, große Änderung gegenüber vorher) und eine Zusammenfassung, die ausdrücklich bestätigt werden muss.
//   2. Laufende Prüfung: nach 30 Tagen fragt die App nach („stimmt noch?“), nach 60 Tagen ohne Bestätigung wird die Karte nicht
//      mehr angewendet; dazu der Abgleich mit den Direktpreisen der Stationen („Karte teurer als Direktzahlung“ → Eingabe prüfen).
// Alles liegt nur auf diesem Gerät. Alle Teile sind klassische Skripte und teilen sich den globalen Gültigkeitsbereich.

const Karte = (() => {
  const CONFIRM_DAYS = 30, EXPIRE_DAYS = 60, MAX_CARDS = 3, MIN = 0.05, MAX = 1.5, DAY = 864e5, LOG_MAX = 12;
  const num = (v) => { const x = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", ".")); return Number.isFinite(x) ? x : null; };
  const ok = (c) => c && typeof c.id === "string" && typeof c.name === "string" && num(c.ac) != null && num(c.dc) != null;
  let cards = (() => { const a = store.getJ("evCards", []); return Array.isArray(a) ? a.filter(ok).slice(0, MAX_CARDS) : []; })();
  const persist = () => store.setJ("evCards", cards);
  let market = () => null, editing = null;   // editing: null | "new" | Karten-Id
  const f2 = (v) => eur2s(v);
  const ago = (c) => { const d = days(c); return d < 1 ? "heute" : d === 1 ? "gestern" : `vor ${d} Tg.`; };
  const days = (c) => Math.floor((Date.now() - Date.parse(c.at)) / DAY);
  const level = (c) => { const d = days(c); return !(d >= 0) || d >= EXPIRE_DAYS ? "expired" : d >= CONFIRM_DAYS ? "due" : "ok"; };
  const used = () => cards.filter((c) => c.on && level(c) !== "expired");   // diese Karten werden angewendet
  const prices = (c) => `AC ${f2(+c.ac)} · DC ${f2(+c.dc)}${c.hpc != null && c.hpc !== "" ? ` · ab 150 kW ${f2(+c.hpc)}` : ""} €/kWh`;
  const log = (c, t) => { (c.log ||= []).unshift({ at: new Date().toISOString(), t }); c.log.length = Math.min(c.log.length, LOG_MAX); };

  // ---- Anwendung auf Stationen (nur Deutschland: Preise in Euro; Betreiber-Filter optional)
  const applies = (c, s) => {
    if (s.country && s.country !== "DEU") return false;
    const ops = String(c.ops || "").toLowerCase().split(/[,;]/).map((x) => x.trim()).filter(Boolean);
    return !ops.length || ops.some((o) => `${s.op} ${s.brand}`.toLowerCase().includes(o));
  };
  const priceFor = (c, k) => k.kw >= 150 && c.hpc != null && c.hpc !== "" && num(c.hpc) != null ? +num(c.hpc) : k.dc ? +num(c.dc) : +num(c.ac);
  // günstigster Kartenpreis an der Station über die (gefilterten) Anschlüsse
  function best(s, cons) {
    let b = null;
    for (const c of used()) {
      if (!applies(c, s)) continue;
      for (const k of cons) { const p = priceFor(c, k); if (p > 0 && (!b || p < b.p)) b = { p, card: c }; }
    }
    return b;
  }

  // ---- Prüfung bei der Eingabe
  const pct = (a, b) => `${a > b ? "+" : "−"}${Math.round(Math.abs(a - b) / b * 100)} %`;
  function check(f, old) {
    const err = [], warn = [], name = String(f.name || "").trim();
    const ac = num(f.ac), dc = num(f.dc), hpc = String(f.hpc ?? "").trim() === "" ? null : num(f.hpc);
    if (!name) err.push("Bitte einen Namen eintragen (z. B. „EnBW mobility+“).");
    if (name.length > 24) err.push("Der Name ist zu lang (höchstens 24 Zeichen).");
    const rng = (v, t) => { if (v == null) err.push(`${t}: bitte eine Zahl in €/kWh eintragen (z. B. 0,49).`); else if (v < MIN || v > MAX) err.push(`${t}: ${f2(v)} €/kWh ist nicht möglich – erlaubt sind ${f2(MIN)} bis ${f2(MAX)} €/kWh.`); };
    rng(ac, "AC-Preis"); rng(dc, "DC-Preis");
    if (String(f.hpc ?? "").trim() !== "") rng(hpc, "Preis ab 150 kW");
    if (err.length) return { err, warn, ac, dc, hpc, name };
    if (ac < 0.25 || ac > 0.95) warn.push(`AC-Preis ${f2(ac)} €/kWh ist ungewöhnlich ${ac < 0.25 ? "niedrig" : "hoch"} (üblich: 0,35–0,80).`);
    if (dc < 0.25 || dc > 1.3) warn.push(`DC-Preis ${f2(dc)} €/kWh ist ungewöhnlich ${dc < 0.25 ? "niedrig" : "hoch"} (üblich: 0,45–1,00).`);
    if (dc < ac - 0.005) warn.push(`DC (${f2(dc)}) ist günstiger als AC (${f2(ac)}) – das ist ungewöhnlich.`);
    if (hpc != null && hpc > 1.3) warn.push(`Preis ab 150 kW (${f2(hpc)} €/kWh) ist ungewöhnlich hoch.`);
    const m = market();
    for (const [k, v, t] of [["ac", ac, "AC"], ["dc", dc, "DC"]]) if (m?.[k] && Math.abs(v - m[k]) / m[k] > 0.35)
      warn.push(`${t}-Preis ${f2(v)} liegt ${pct(v, m[k])} gegenüber dem Median der Direktpreise in deiner Umgebung (${f2(m[k])} €/kWh).`);
    if (old) for (const [k, t] of [["ac", "AC"], ["dc", "DC"]]) { const o = num(old[k]); if (o && Math.abs(num(f[k]) - o) / o > 0.25) warn.push(`${t}-Preis ändert sich stark: ${f2(o)} → ${f2(num(f[k]))} (${pct(num(f[k]), o)}).`); }
    return { err, warn, ac, dc, hpc, name };
  }
  function diff(old, n) {
    if (!old) return ["neue Karte"];
    const d = [];
    for (const [k, t] of [["ac", "AC"], ["dc", "DC"], ["hpc", "ab 150 kW"]]) {
      const a = old[k] === "" || old[k] == null ? null : num(old[k]), b = n[k];
      if (a !== b) d.push(`${t}: ${a == null ? "–" : f2(a)} → ${b == null ? "–" : f2(b)}${a && b ? ` (${pct(b, a)})` : ""}`);
    }
    if (String(old.ops || "") !== String(n.ops || "")) d.push("Betreiber-Filter geändert");
    if (old.name !== n.name) d.push(`Name: ${old.name} → ${n.name}`);
    return d;
  }

  // ---- Dialog
  const statusChip = (c) => {
    const l = level(c);
    return l === "ok" ? `<span class="evst ok">✓ bestätigt ${ago(c)}</span>` : l === "due" ? `<span class="evst busy">⚠ bitte prüfen · bestätigt ${ago(c)}</span>`
      : `<span class="evst out">⛔ abgelaufen – wird nicht angewendet</span>`;
  };
  function formHtml() {
    const c = cards.find((x) => x.id === editing) || {};
    const v = (k) => esc(c[k] == null ? "" : String(c[k]).replace(".", ","));
    return `<div class="cardform"><b>${editing === "new" ? "Neue Karte" : "Karte bearbeiten"}</b>
      <label for="cdName">Name</label><input id="cdName" maxlength="24" placeholder="z. B. EnBW mobility+" value="${esc(c.name || "")}" autocapitalize="off">
      <div class="two-in"><div><label for="cdAc">AC €/kWh</label><input id="cdAc" inputmode="decimal" placeholder="0,49" value="${v("ac")}"></div>
        <div><label for="cdDc">DC €/kWh</label><input id="cdDc" inputmode="decimal" placeholder="0,59" value="${v("dc")}"></div>
        <div><label for="cdHpc">ab 150 kW <span class="small">(optional)</span></label><input id="cdHpc" inputmode="decimal" placeholder="0,69" value="${v("hpc")}"></div></div>
      <label for="cdOps">Nur bei Betreibern <span class="small">(optional, mit Komma, z. B. „enbw, ionity“ – leer = überall)</span></label>
      <input id="cdOps" placeholder="leer = an allen Stationen" value="${esc(c.ops || "")}" autocapitalize="off" autocorrect="off" spellcheck="false">
      <label class="check"><input id="cdOn" type="checkbox" ${c.on === false ? "" : "checked"}> <span>Preise dieser Karte anwenden</span></label>
      <div class="cardmsg" id="cdMsg" role="alert"></div>
      <div class="row"><button class="btn" type="button" data-card="save">Speichern</button><button class="btn secondary" type="button" data-card="cancel">Abbrechen</button></div></div>`;
  }
  function bodyHtml() {
    const h = [`<p class="small">Zahlst du mit Ladekarte oder App? Trage hier <b>deine</b> Preise ein – die App zeigt sie neben dem Direktpreis des Betreibers.
      Sie sind eine <b>Eigeneingabe</b> (💳), nicht vom Betreiber bestätigt, und gelten nur in Deutschland (Euro).</p>
      <p class="small cardrules">🔒 <b>So bleibt es richtig:</b> Jede Eingabe wird geprüft (mögliche Werte, Plausibilität, Abgleich mit den Preisen in deiner Umgebung) und von dir bestätigt.
      Nach ${CONFIRM_DAYS} Tagen fragt die App nach, ob die Preise noch stimmen; nach ${EXPIRE_DAYS} Tagen ohne Bestätigung werden sie <b>nicht mehr angewendet</b>.
      Zusätzlich warnt die App, wenn deine Karte an vielen Stationen teurer ist als Direktzahlung.</p>`];
    if (!cards.length && editing !== "new") h.push(`<div class="card empty" style="margin:10px 0"><b>Noch keine Karte</b></div>`);
    for (const c of cards) h.push(`<div class="cardrow${c.on ? "" : " off"}"><div class="cr-t"><b>${esc(c.name)}</b>${c.on ? "" : ` <span class="tag">aus</span>`}
        <div class="sub">${esc(prices(c))}${c.ops ? ` · nur: ${esc(c.ops)}` : ""}</div><div>${statusChip(c)}</div></div>
        <div class="cr-a"><button class="btn secondary" type="button" data-card="ok" data-id="${esc(c.id)}">Stimmt noch ✓</button>
          <button class="btn secondary" type="button" data-card="edit" data-id="${esc(c.id)}">Ändern</button>
          <button class="iconx" type="button" data-card="del" data-id="${esc(c.id)}" aria-label="Karte löschen">×</button></div></div>`);
    if (editing) h.push(formHtml());
    else if (cards.length < MAX_CARDS) h.push(`<button class="btn secondary block" type="button" data-card="new" style="margin-top:10px">+ Karte hinzufügen</button>`);
    const lg = cards.flatMap((c) => (c.log || []).map((l) => ({ ...l, n: c.name }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
    if (lg.length) h.push(`<details class="tbl" style="margin-top:12px"><summary>Verlauf der Eingaben</summary><table>${lg.map((l) => `<tr><td>${esc(new Date(l.at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }))}</td><td>${esc(l.n)}: ${esc(l.t)}</td></tr>`).join("")}</table></details>`);
    return h.join("");
  }
  const paintDlg = () => { $("#cardBody").innerHTML = bodyHtml(); };
  function open() { editing = null; paintDlg(); $("#dlgCard").showModal(); }
  function changed() { try { statusSet(); } catch {} Karte.onChange?.(); }
  function statusText() {
    if (!cards.length) return "Keine Karte eingetragen";
    const worst = cards.some((c) => level(c) === "expired") ? "expired" : cards.some((c) => level(c) === "due") ? "due" : "ok";
    return `${cards.length} Karte${cards.length > 1 ? "n" : ""} · ${worst === "ok" ? "✓ bestätigt" : worst === "due" ? "⚠ bitte prüfen" : "⛔ abgelaufen"}`;
  }
  const statusSet = () => { const el = $("#cardStat"); if (el) el.textContent = statusText(); };
  function confirmCard(c) {
    if (!confirm(`Stimmen diese Preise noch?\n\n${c.name}\n${prices(c)}${c.ops ? `\nnur bei: ${c.ops}` : ""}\n\nNur bestätigen, wenn sie mit deinem aktuellen Tarif übereinstimmen.`)) return false;
    c.at = new Date().toISOString(); log(c, "bestätigt (Preise stimmen)"); persist(); changed(); return true;
  }
  function save() {
    const f = { name: $("#cdName").value, ac: $("#cdAc").value, dc: $("#cdDc").value, hpc: $("#cdHpc").value, ops: $("#cdOps").value.trim(), on: $("#cdOn").checked };
    const old = cards.find((x) => x.id === editing), r = check(f, old), msg = $("#cdMsg");
    if (r.err.length) { msg.className = "cardmsg bad"; msg.innerHTML = r.err.map((e) => `• ${esc(e)}`).join("<br>"); return; }
    const n = { name: r.name, ac: r.ac, dc: r.dc, hpc: r.hpc, ops: f.ops, on: f.on }, d = diff(old, n);
    // zweite Sicherung: Zusammenfassung mit allen Hinweisen – ohne ausdrückliches „OK“ wird nichts übernommen
    const text = `${r.warn.length ? "Bitte prüfen:\n• " + r.warn.join("\n• ") + "\n\n" : ""}Das wird gespeichert:\n${r.name}\n${prices(n)}${n.ops ? `\nnur bei: ${n.ops}` : ""}\n${d.length ? "Änderungen: " + d.join("; ") : "Keine Änderung der Preise"}\n\nStimmen diese Angaben mit deinem Tarif überein?`;
    if (!confirm(text)) return;
    const now = new Date().toISOString();
    if (old) { Object.assign(old, n, { at: now }); log(old, `geändert: ${d.join("; ") || "bestätigt"}`); }
    else cards.push({ id: "k" + Date.now().toString(36), ...n, at: now, made: now, log: [{ at: now, t: "angelegt: " + prices(n) }] });
    persist(); editing = null; paintDlg(); changed();
  }
  // Klicks im Dialog
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-card],[data-cardopen],[data-cardok]");
    if (!b) return;
    if (b.dataset.cardopen != null) return open();
    if (b.dataset.cardok) { const c = cards.find((x) => x.id === b.dataset.cardok); if (c) confirmCard(c); return; }
    if (!b.closest("#dlgCard")) return;
    const k = b.dataset.card, c = cards.find((x) => x.id === b.dataset.id);
    if (k === "new") { editing = "new"; paintDlg(); $("#cdName")?.focus(); }
    else if (k === "edit" && c) { editing = c.id; paintDlg(); }
    else if (k === "cancel") { editing = null; paintDlg(); }
    else if (k === "save") save();
    else if (k === "ok" && c) { if (confirmCard(c)) paintDlg(); }
    else if (k === "del" && c) { if (!confirm(`Karte „${c.name}“ löschen?`)) return; cards = cards.filter((x) => x.id !== c.id); persist(); paintDlg(); changed(); }
  });
  $("#btnCardClose").addEventListener("click", () => { $("#dlgCard").close(); changed(); });
  document.addEventListener("click", (e) => { if (e.target.closest("#btnCards")) open(); });

  // ---- Hinweise in der E-Ansicht (laufende Prüfung)
  // stats: {n: Stationen mit Direkt- und Kartenpreis, bad: Karte teurer als Direktzahlung, low: Karte weniger als halb so teuer}
  function bannerHtml(stats) {
    let h = "";
    for (const c of cards) {
      if (!c.on) continue;
      const l = level(c);
      if (l === "ok") continue;
      h += `<div class="card notice warnbox"><span class="ic">${l === "expired" ? "⛔" : "⚠️"}</span><div><b>${l === "expired" ? `Karte „${esc(c.name)}“ wird nicht mehr angewendet` : `Stimmen die Preise deiner Karte „${esc(c.name)}“ noch?`}</b><br>
        ${l === "expired" ? `Seit ${days(c)} Tagen nicht bestätigt (nach ${EXPIRE_DAYS} Tagen schaltet die App sie ab, damit keine veralteten Preise Empfehlungen bestimmen).` : `Zuletzt bestätigt ${ago(c)} – die App fragt alle ${CONFIRM_DAYS} Tage nach.`}
        <div class="row" style="margin-top:10px"><button class="btn" data-cardok="${esc(c.id)}">Stimmt noch ✓</button><button class="btn secondary" data-cardopen>Prüfen / ändern</button></div></div></div>`;
    }
    if (stats && stats.n >= 3 && (stats.bad >= 3 && stats.bad / stats.n >= 0.3))
      h += `<div class="card notice warnbox"><span class="ic">🔎</span><div><b>Deine Karte ist hier oft teurer als Direktzahlung</b><br>An ${stats.bad} von ${stats.n} Stationen liegt der Kartenpreis über dem Direktpreis des Betreibers – meist ein Zeichen, dass eine Eingabe nicht (mehr) stimmt.
        <div class="row" style="margin-top:10px"><button class="btn secondary" data-cardopen>Eingaben prüfen</button></div></div></div>`;
    else if (stats && stats.n >= 3 && stats.low >= 3 && stats.low / stats.n >= 0.3)
      h += `<div class="card notice"><span class="ic">🔎</span><div><b>Deine Karte ist hier auffällig günstig</b><br>An ${stats.low} von ${stats.n} Stationen liegt der Kartenpreis weniger als halb so hoch wie der Direktpreis. Stimmt das?
        <div class="row" style="margin-top:10px"><button class="btn secondary" data-cardopen>Eingaben prüfen</button></div></div></div>`;
    return h;
  }
  setTimeout(statusSet, 0);
  return { cards: () => cards, used, best, priceFor, applies, level, open, bannerHtml, statusText, ago, setMarket: (fn) => { market = fn; }, onChange: null, f2, num, CONFIRM_DAYS, EXPIRE_DAYS, check };
})();
