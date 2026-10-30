// Schwabensprit – Füllstand: Wie viel muss nachgetankt (bzw. geladen) werden?
// Auswahl ¾ · ½ · ¼ · Reserve (feste Restreichweite 50 km) neben dem Ort; „Nicht angeben“ = wie bisher (volle Tankgröße wird nachgetankt).
//   nötige Menge  V = Tankgröße − Restmenge        Restmenge: Bruchteil × Tankgröße, bei Reserve 50 km × Verbrauch ÷ 100
// V ersetzt die Tankgröße in allen Rechnungen (Ersparnis, Kosten inkl. Anfahrt, 12-Uhr-Regel, Route, Ladekosten).
// Der Teil „Rechnung“ ist rein (ohne Speicher und Seite) und wird von den Unit-Tests geprüft; geladen nach grund.js.

const LEVELS = [{ k: "0.75", t: "¾" }, { k: "0.5", t: "½" }, { k: "0.25", t: "¼" }, { k: "res", t: "Reserve" }];
const RESERVE_KM = 50, REACH_SAFE = 0.9, LEVEL_DAYS = 3;

// ---- Rechnung (rein)
const levelRest = (cap, cons, k) => !k ? 0 : k === "res" ? Math.min(cap, RESERVE_KM * cons / 100) : cap * Number(k);   // Rest im Tank/Akku
const levelNeed = (cap, cons, k) => Math.max(0, cap - levelRest(cap, cons, k));                                          // nötige Menge
const levelRange = (cap, cons, k) => k ? levelRest(cap, cons, k) / cons * 100 : null;                                    // Restreichweite in km
const inReach = (roadKm, range) => range == null || roadKm <= REACH_SAFE * range;                                       // 10 % Sicherheitsabstand
const costWith = (price, need, distKm, cons, road = 1.3) => price * (need + 2 * distKm * road * cons / 100);            // inkl. Hin- und Rückfahrt
const breakEvenKm = (dp, need, price, cons, road = 1.3) => dp * need / (price * 2 * road * cons / 100);                 // so weit lohnt ein Preisvorteil dp

// ---- Auswahl (gespeichert, gilt 3 Tage; Sprit und Strom getrennt)
const LVL_KEY = { fuel: "lvl", ev: "lvlEv" };
function levelGet(kind) {
  const x = store.getJ(LVL_KEY[kind], null), age = x ? Date.now() - x.at : -1;
  if (!x || !(age >= 0 && age < LEVEL_DAYS * 864e5)) return null;
  const k = x.k ?? (x.f == null ? null : x.f <= 0.15 ? "res" : String(x.f));   // alter Tank-Rat: „fast leer“ (10 %) → Reserve
  return LEVELS.some((l) => l.k === k) ? { k, at: x.at } : null;
}
const levelSet = (kind, k) => store.setJ(LVL_KEY[kind], k ? { k, at: Date.now() } : null);
const levelText = (k) => LEVELS.find((l) => l.k === k)?.t || "–";

// Tankgröße/Akkugröße und Verbrauch je Art
const evCap = () => { const v = parseFloat(String(store.get("kwh", "30")).replace(",", ".")); return v > 0 && v <= 200 ? v : 30; };
const evCons = () => { const v = parseFloat(String(store.get("evcons", "18")).replace(",", ".")); return v > 3 && v <= 60 ? v : 18; };
const lvlKind = () => (evMode ? "ev" : "fuel");
const lvlCap = (kind) => kind === "ev" ? evCap() : TANK();
const lvlCons = (kind) => kind === "ev" ? evCons() : CONS();

const NEED = (kind = "fuel") => levelNeed(lvlCap(kind), lvlCons(kind), levelGet(kind)?.k ?? null);       // Liter bzw. kWh
const RANGE = (kind = "fuel") => levelRange(lvlCap(kind), lvlCons(kind), levelGet(kind)?.k ?? null);     // km oder null
const qty = (v) => fmtNum(v, Math.abs(v - Math.round(v)) < 0.05 ? 0 : 1);   // 25 · 37,5 · 46,5
const needTxt = (kind = "fuel") => { const g = levelGet(kind); return `${qty(NEED(kind))} ${kind === "ev" ? "kWh" : "l"}${g ? ` (${levelText(g.k)})` : ""}`; };

// ---- Anzeige: Knopf neben dem Ort und Auswahl
function renderLevelChip() {
  const b = $("#btnLevel"); if (!b) return;
  const kind = lvlKind(), g = levelGet(kind);
  $("#lvlIcon").textContent = kind === "ev" ? "🔋" : "⛽"; $("#lvlLabel").textContent = g ? levelText(g.k) : "–";
  b.classList.toggle("set", !!g);
  b.setAttribute("aria-label", `${kind === "ev" ? "Akkustand" : "Tankfüllstand"}: ${g ? levelText(g.k) : "nicht angegeben"} – ändern`);
}
function paintLevel() {
  const kind = lvlKind(), ev = kind === "ev", cap = lvlCap(kind), cons = lvlCons(kind), u = ev ? "kWh" : "l", g = levelGet(kind);
  $("#lvlTitle").textContent = ev ? "Akkustand" : "Tankfüllstand";
  $("#lvlHint").textContent = ev
    ? `Ersparnis und Ladekosten rechnen mit der Menge, die zum vollen Akku (${fmtNum(cap, 0)} kWh) fehlt. Gilt ${LEVEL_DAYS} Tage.`
    : `Ersparnis und Kosten rechnen mit der Menge, die zum vollen Tank (${fmtNum(cap, 0)} l) fehlt. Reserve = ${RESERVE_KM} km Restreichweite. Gilt ${LEVEL_DAYS} Tage.`;
  const row = (k, name, sub, icon) => `<button class="opt ${(g?.k ?? "") === k ? "on" : ""}" data-lvlk="${k}" aria-pressed="${(g?.k ?? "") === k}"><div class="ic gg">${icon}</div>
    <div class="t"><div>${name}</div><div class="sub">${sub}</div></div><span class="check">✓</span></button>`;
  const gauge = (f, cls = "") => `<span class="gauge ${cls}" style="--f:${f}"></span>`;
  $("#lvlOpts").innerHTML = LEVELS.map((l) => {
    const need = levelNeed(cap, cons, l.k), range = levelRange(cap, cons, l.k);
    return row(l.k, l.t,
      `≈ ${qty(need)}\u00a0${u} · reicht ${fmtNum(range, 0)}\u00a0km`, gauge(l.k === "res" ? 0.08 : l.k, l.k === "res" ? "res" : ""));
  }).join("") + row("", "Nicht angeben", `wie bisher · rechnet mit ${fmtNum(cap, 0)} ${u}`, gauge(0));
}
function levelChanged() { renderLevelChip(); if (typeof render === "function") render(); }
document.addEventListener("click", (e) => {
  if (e.target.closest("#btnLevel")) { paintLevel(); $("#dlgLevel").showModal(); return; }
  const o = e.target.closest("[data-lvlk]");
  if (o) { levelSet(lvlKind(), o.dataset.lvlk || null); $("#dlgLevel").close(); levelChanged(); }
});
$("#btnLevelClose").addEventListener("click", () => $("#dlgLevel").close());
renderLevelChip();
