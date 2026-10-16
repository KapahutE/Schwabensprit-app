// Schwabensprit – Belegleser: Tankbeleg-Foto aufbereiten, mit Tesseract.js (läuft auf dem Gerät) lesen, Werte erkennen, Tankstelle finden.
// Alle Teile sind klassische Skripte und teilen sich den globalen Gültigkeitsbereich – Reihenfolge in index.html beachten.

// ---- Tankbeleg auswerten: Kraftstoff, Menge, Preis/Liter, Betrag, Datum, Uhrzeit aus dem OCR-Text.
// Belege sehen je Kette anders aus, deshalb mehrere Muster und eine Gegenprobe Menge × Preis = Betrag.
function parseReceipt(raw) {
  // häufige OCR-Verwechslung: O statt 0 in Zahlen („38,O7“, „Str 2O“)
  const fix = (s) => s.replace(/(?<=[\d,.])[oO](?=\d)|(?<=\d)[oO](?=[\d,.\s]|$)/g, "0")
    .replace(/(\d) ?([,.]) (\d{2,3})(?![\d.,])/g, "$1$2$3").replace(/(\d) ([,.])(\d{2,3})(?![\d.,])/g, "$1$2$3");   // „23, 17“ → „23,17“
  const lines = String(raw || "").split(/\r?\n/).map((l) => fix(l.trim())).filter(Boolean);
  const all = lines.join("\n"), low = all.toLowerCase();
  const n = (s) => parseFloat(String(s).replace(/\s/g, "").replace(",", "."));
  const r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;
  const out = { fuel: null, premium: false, liters: null, ppl: null, total: null, date: null, time: null, shop: null, discount: null };

  // Menge und Preis je Liter, oft in einer Zeile: „42,15 l x 1,899 EUR/l“ oder „42,15 L * 1,899“
  const LIT = /(\d{1,3}[,.]\d{2,3})\s*(?:l|ltr|lt|liter)\b/;
  const LIT2 = /(?:menge|liter|abgabe)\s*:?\s*(\d{1,3}[,.]\d{2,3})/;
  // Einheit vor der Zahl, z. B. ORLEN: „* Diesel   l 46,54 *“ (l oft als „|“ gelesen) – nur mit Sorte in der Zeile
  const LIT3 = /(?:diesel|super|benzin|e\s?10|e\s?5|kraftstoff|v-?power|ultimate)\b.*?(?:^|\s)(?:l|\||ltr|lt)\.?\s+(\d{1,3}[,.]\d{2,3})(?![\d,.])/;
  const PPL = [
    /(\d[,.]\d{2,3})\s*(?:€|eur|euro)?\s*\/\s*(?:l|ltr|liter)\b/,
    /(?:€|eur)\s*\/\s*(?:l|ltr|liter)\b[.:]?\s*(\d[,.]\d{2,3})/,
    /(?:preis|pr\.?)\s*(?:\/|je|pro)\s*(?:l|ltr|liter)\s*:?\s*(\d[,.]\d{2,3})/,
    /preis\s*\/\s*[l|1i!]?\s*(?:€|eur)?\s*:?\s*(\d[,.]\d{3})(?![\d,.])/,   // „Preis/ l EUR 2,169“ (l als „|“ gelesen)
    /(?:\bx|\*|à|@)\s*(\d[,.]\d{3})\b/,
  ];
  let fuelLine = -1;
  lines.forEach((l, i) => {
    const L = l.toLowerCase();
    const m = L.match(LIT) || L.match(LIT2) || L.match(LIT3);
    if (m && out.liters == null && n(m[1]) >= 1 && n(m[1]) <= 250) { out.liters = n(m[1]); fuelLine = i; }
    const p = PPL.map((re) => L.match(re)).find(Boolean);
    if (p && out.ppl == null && n(p[1]) >= 0.8 && n(p[1]) <= 4) { out.ppl = n(p[1]); if (fuelLine < 0) fuelLine = i; }
  });

  // Betrag: zuerst Summe/Gesamt/Zu zahlen, dann Zahlart-Zeilen (nie MwSt, Rückgeld …), sonst größter Betrag
  const money = (l) => [...l.matchAll(/(?<![\d,.])(\d{1,4}[,.]\d{2})(?![\d,.]|\s*(?:l|ltr|liter)\b|\s*(?:€|eur)?\s*\/)/gi)].map((m) => n(m[1]));
  const skip = /(mwst|ust|netto|steuer|rückgeld|rueckgeld|gegeben|max\.?\s*betrag|reservier|autoris)/i;   // „Max. Betrag“ = Kartenreservierung
  const pick = (re) => {
    const c = lines.filter((l) => re.test(l) && !skip.test(l)).flatMap(money).filter((v) => v >= 1 && v <= 600);
    return c.length ? Math.max(...c) : null;
  };
  out.total = pick(/(summe|gesamt|zu zahlen|endbetrag|total|betrag)/i)
    ?? pick(/(bezahlt|girocard|ec-?karte|kreditkarte|visa|mastercard|maestro|\bbar\b)/i);
  if (out.total == null) {
    const any = lines.filter((l) => !skip.test(l)).flatMap(money).filter((v) => v >= 5 && v <= 600);
    if (any.length) out.total = Math.max(...any);
  }

  // Menge oder Literpreis nicht zugeordnet (Zeichen verlesen, ungewohnter Aufbau): unter allen Zahlen das Paar
  // suchen, für das Menge × Literpreis den Betrag ergibt
  if (out.total != null && (out.liters == null || out.ppl == null)) {
    const nums = [];
    lines.forEach((l, i) => { for (const m of l.matchAll(/(?<![\d,.])(\d{1,3}[,.]\d{2,3})(?![\d,.])/g)) nums.push({ v: n(m[1]), dec: m[1].length - m[1].search(/[,.]/) - 1, i }); });
    const Ls = out.liters != null ? [{ v: out.liters, i: fuelLine }] : nums.filter((x) => x.v >= 1 && x.v <= 250 && Math.abs(x.v - out.total) > 0.001);
    const Ps = out.ppl != null ? [{ v: out.ppl }] : nums.filter((x) => x.dec === 3 && x.v >= 0.8 && x.v <= 4);
    // Ziel: die Summe – oder die Summe ohne einen Shop-Artikel (Kaffee, Brezel …)
    const extra = [0, ...new Set(lines.filter((l) => !skip.test(l)).flatMap(money).filter((v) => v > 0.2 && v < out.total - 1))];
    let hit = null;
    for (const x of extra) for (const a of Ls) for (const b of Ps) {
      const d = Math.abs(a.v * b.v - (out.total - x)) + (x ? 0.005 : 0);   // ohne Abzug bevorzugt
      if (d <= 0.035 && (!hit || d < hit.d)) hit = { a, b, d, x };
    }
    if (hit) {
      out.liters = hit.a.v; out.ppl = hit.b.v; if (fuelLine < 0 && hit.a.i >= 0) fuelLine = hit.a.i;
      if (hit.x) { out.shop = r2(hit.x); out.total = r2(out.total - hit.x); }
    }
  }

  // Gegenprobe Menge × Preis = Betrag. Stehen Shop-Artikel mit auf dem Beleg (Brezel, Kaffee …), ist die
  // Summe größer – dann zählt der Betrag der Kraftstoffzeile, der zu Menge × Preis passt.
  const { liters: L, ppl: P, total: T } = out;
  const fits = (v) => Math.abs(L * P - v) <= 0.03;      // Rundung Menge × Preis: höchstens wenige Cent
  const plausible = (v) => L && v / L >= 0.8 && v / L <= 4;
  let shopAmt = null;
  const disc = lines.filter((l) => /rabatt|nachlass|coupon|gutschein|bonus|ersparnis|abzug|[-−]\s*\d{1,3}[,.]\d{2}\b/i.test(l)).flatMap(money);
  if (L && P && T && !fits(T)) {
    const fuelAmt = lines.flatMap(money).find(fits);
    if (fuelAmt != null && T < fuelAmt && disc.some((d) => Math.abs(fuelAmt - d - T) <= 0.02)) out.discount = r2(fuelAmt - T);   // Summe nach Rabatt
    else if (fuelAmt != null) { if (T - fuelAmt > 0.05) out.shop = r2(T - fuelAmt); out.total = fuelAmt; }   // Shop-Artikel oder Summe verlesen
    else if ((shopAmt = lines.filter((l) => !skip.test(l)).flatMap(money).find((v) => v > 0.2 && v < T - 1 && fits(T - v))) != null) {
      out.shop = r2(shopAmt); out.total = r2(T - shopAmt);         // Summe = Kraftstoff + Shop-Artikel (Kraftstoffzeile ohne eigenen Betrag)
    }
    else if (plausible(T)) out.ppl = r3(T / L);                     // Preis je Liter falsch gelesen
    else if (T / P >= 1 && T / P <= 250) out.liters = r2(T / P);   // Menge falsch gelesen („23,17“ → „3,17“)
  }
  if (L && !P && T && fuelLine >= 0) {                               // ohne Literpreis: Betrag der Kraftstoffzeile bevorzugen
    const amt = [...money(lines[fuelLine]), ...money(lines[fuelLine + 1] || "")].find((v) => plausible(v) && v < T - 0.05);
    if (amt != null) { out.shop = r2(T - amt); out.total = amt; }
  }
  if (L && P && !out.total) out.total = r2(L * P);
  if (L && out.total && !out.ppl && plausible(out.total)) out.ppl = r3(out.total / L);
  if (!L && P && T) out.liters = r2(T / P);

  // Kraftstoff: zuerst rund um die Mengenzeile, sonst im ganzen Beleg
  const fuelOf = (t) => /diesel|d[il1]esel/.test(t) ? "diesel" : /\be\s?[1il][0o6g]\b|e1[0o]/.test(t) ? "e10"
    : /super|benzin|\be\s?5\b|\b95\b|v-?power|ultimate|excellium|plus/.test(t) ? "e5" : null;
  const near = fuelLine >= 0 ? lines.slice(Math.max(0, fuelLine - 2), fuelLine + 2).join(" ").toLowerCase() : "";
  out.fuel = fuelOf(near) || fuelOf(low);
  // „100“/„102“ nur als Oktanzahl (Super 100, 102 Oktan) – nicht in Beträgen wie „100,95“
  out.premium = /v-?power|ultimate|excellium|super\s*plus|max\s*plus|\b(?:super|e)\s*10[02]\b(?![,.]\d)|\b10[02]\s*(?:oktan|ron)\b/.test(near || low);

  // Datum (TT.MM.JJ[JJ]) und Uhrzeit (HH:MM[:SS])
  const now = new Date();
  let dateLine = -1;
  dates: for (const [i, l] of lines.entries()) for (const m of l.matchAll(/(?<![\d,.])(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4}|\d{2})(?![\d,])/g)) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3], mo = +m[2], d = +m[1], dt = new Date(y, mo - 1, d);
    if (y >= 2020 && dt.getMonth() === mo - 1 && dt.getDate() === d && dt <= new Date(now.getTime() + 864e5)) {
      out.date = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`; dateLine = i; break dates;
    }
  }
  // Uhrzeiten: keine Spannen („Mo-Sa 06:00-22:00“), keine ISO-/TSE-Zeiten (oft UTC); bevorzugt neben dem Datum oder bei „Uhrzeit“
  const tms = [];
  lines.forEach((l, i) => {
    const t = l.replace(/\d{1,2}\s?[:.]\s?\d{2}\s*(?:-|–|bis)\s*\d{1,2}\s?[:.]\s?\d{2}/gi, " ");
    for (const m of t.matchAll(/(?<![\d,.:T])([01]?\d|2[0-3])\s?:\s?([0-5]\d)(?::[0-5]\d)?(?![\d,])/g))
      tms.push({ i, h: m[1], m: m[2], tse: /\btse\b|signatur|utc|\d{4}-\d{2}-\d{2}t/i.test(l), named: /uhrzeit|\bzeit\b/i.test(l) });
    if (!tms.some((x) => x.i === i)) { const m = l.match(/(?:uhrzeit|\bzeit)\s*:?\s*([01]?\d|2[0-3])[.:]([0-5]\d)/i); if (m) tms.push({ i, h: m[1], m: m[2], named: true }); }
  });
  const tm = tms.find((x) => x.i === dateLine && !x.tse) || tms.find((x) => x.named && !x.tse) || tms.find((x) => !x.tse) || tms[0];
  if (tm) out.time = `${String(+tm.h).padStart(2, "0")}:${tm.m}`;
  // nur ISO-Angaben (z. B. „TSE-Start: 2026-10-03T14:05:12“, evtl. mit Zeitzone): als letzter Ausweg
  const iso = all.match(/(20\d{2})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?/);
  if (iso && (!out.date || !out.time)) {
    const d = iso[6] ? new Date(iso[0]) : new Date(+iso[1], +iso[2] - 1, +iso[3], +iso[4], +iso[5]);
    if (!Number.isNaN(d.getTime()) && d.getFullYear() >= 2020 && d <= new Date(now.getTime() + 864e5)) {
      const p2 = (v) => String(v).padStart(2, "0");
      out.date ||= `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
      out.time ||= `${p2(d.getHours())}:${p2(d.getMinutes())}`;
    }
  }
  return out;
}

// ---- Belegleser (Tesseract.js, Dateien liegen im App-Repository unter ocr/)
const absUrl = (p) => new URL(p, location.href).href;
let tessLoading = null;
const loadTess = () => tessLoading ||= new Promise((res, rej) => {
  if (window.Tesseract) return res();
  const s = document.createElement("script");
  s.src = "ocr/tesseract.min.js"; s.onload = res; s.onerror = () => { tessLoading = null; rej(new Error("Belegleser konnte nicht geladen werden")); };
  document.head.appendChild(s);
});
const canvas = (w, h) => Object.assign(document.createElement("canvas"), { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) });
const free = (...cs) => cs.forEach((c) => { if (c) { c.width = 0; c.height = 0; } });   // Canvas-Speicher sofort freigeben (iOS)
const scaledTo = (c, k) => { const o = canvas(c.width * k, c.height * k), x = o.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(c, 0, 0, o.width, o.height); return o; };
// Foto vorbereiten: richtig drehen (EXIF über <img>), auf Arbeitsgröße bringen
async function prepImage(file, maxSide) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Bild konnte nicht gelesen werden")); i.src = url; });
    // in Halbierungsschritten mit hoher Qualität verkleinern – Safari skaliert große Fotos sonst grob,
    // die Schrift wird pixelig und die Texterkennung scheitert
    const W = img.naturalWidth, H = img.naturalHeight, target = Math.min(1, maxSide / Math.max(W, H));
    let k = 1;
    while (W * H * k * k > 16e6 || k * 0.25 > target) k *= 0.5;   // sehr große Fotos gleich beim Einlesen halbieren
    let c = canvas(W * k, H * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    while (k * 0.5 > target) { const o = scaledTo(c, 0.5); free(c); c = o; k *= 0.5; }
    if (target < k) { const o = scaledTo(c, target / k); free(c); c = o; }
    return c;
  } finally { URL.revokeObjectURL(url); }
}
const grayOf = (c) => {
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data, g = new Uint8Array(c.width * c.height);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) g[j] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
  return g;
};
const otsu = (g) => {
  const h = new Float64Array(256); for (const v of g) h[v]++;
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * h[i];
  let sB = 0, wB = 0, best = 0, t = 128;
  for (let i = 0; i < 256; i++) {
    wB += h[i]; if (!wB) continue; const wF = g.length - wB; if (!wF) break;
    sB += i * h[i]; const d = sB / wB - (sum - sB) / wF, v = wB * wF * d * d;
    if (v > best) { best = v; t = i; }
  }
  return t;
};
// Drehen um beliebigen Winkel; Ränder in der Farbe fill
function rotated(c, deg, fill) {
  const r = deg * Math.PI / 180, cs = Math.abs(Math.cos(r)), sn = Math.abs(Math.sin(r));
  const o = canvas(c.width * cs + c.height * sn, c.width * sn + c.height * cs), x = o.getContext("2d");
  x.fillStyle = fill; x.fillRect(0, 0, o.width, o.height);
  x.translate(o.width / 2, o.height / 2); x.rotate(r); x.drawImage(c, -c.width / 2, -c.height / 2);
  return o;
}
// Beleg im Foto finden: heller Bereich (Papier) vor dunklerem Hintergrund
function paperBox(c, pad = 0.04) {
  const k = Math.min(1, 500 / Math.max(c.width, c.height)), s = scaledTo(c, k), g = grayOf(s), t = otsu(g), W = s.width, H = s.height;
  free(s);
  const rows = new Uint32Array(H), cols = new Uint32Array(W);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y * W + x] > t) { rows[y]++; cols[x]++; }
  const span = (a) => { const m = Math.max(...a) * 0.35; let i = 0, j = a.length - 1; while (i < j && a[i] < m) i++; while (j > i && a[j] < m) j--; return [i, j]; };
  const [y0, y1] = span(rows), [x0, x1] = span(cols);
  const area = (x1 - x0) * (y1 - y0) / (W * H);
  if (area < 0.06 || area > 0.9) return null;   // kein klarer Beleg erkennbar → ganzes Bild
  const mx = (x1 - x0) * pad, my = (y1 - y0) * pad;   // pad < 0: etwas nach innen, ohne Papierkante
  return { x: Math.max(0, (x0 - mx) / k), y: Math.max(0, (y0 - my) / k), w: Math.min(W, x1 - x0 + 2 * mx) / k, h: Math.min(H, y1 - y0 + 2 * my) / k };
}
const cropped = (c, b) => { const o = canvas(b.w, b.h); o.getContext("2d").drawImage(c, b.x, b.y, b.w, b.h, 0, 0, o.width, o.height); return o; };
// Schräglage schätzen: bei welchem Winkel liegen die dunklen Textpixel am deutlichsten in Zeilen?
function skewAngle(c) {
  const k = Math.min(1, 700 / Math.max(c.width, c.height)), s = scaledTo(c, k), g = grayOf(s), W = s.width, H = s.height;
  free(s);
  // nur der innere Bereich – Ränder und Ecken (Hintergrund) würden die Messung verfälschen
  const inner = [], X0 = W * 0.15 | 0, X1 = W * 0.85 | 0, Y0 = H * 0.12 | 0, Y1 = H * 0.88 | 0;
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) inner.push(g[y * W + x]);
  const ti = otsu(Uint8Array.from(inner)) * 0.9, px = [];
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x += 2) if (g[y * W + x] < ti) px.push(x, y);
  if (px.length < 400) return 0;
  let best = 0, bestScore = -1;
  for (let a = -15; a <= 15; a += 0.5) {
    const r = a * Math.PI / 180, sn = Math.sin(r), cs = Math.cos(r), hist = new Float64Array(W + H * 2);
    for (let i = 0; i < px.length; i += 2) hist[Math.round(px[i + 1] * cs - px[i] * sn + W)]++;
    let sc = 0; for (const v of hist) sc += v * v;
    if (sc > bestScore) { bestScore = sc; best = a; }
  }
  return best;
}
// Ungleichmäßige Ausleuchtung und blassen Druck ausgleichen: Pixel / lokaler Hintergrund
function flatten(c) {
  const W = c.width, H = c.height, g = grayOf(c), I = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += g[y * W + x]; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + row; } }
  const R = Math.max(8, Math.round(Math.max(W, H) / 40)), ctx = c.getContext("2d"), im = ctx.createImageData(W, H), d = im.data;
  const out = new Float32Array(W * H), hist = new Uint32Array(256);
  for (let y = 0; y < H; y++) {
    const ya = Math.max(0, y - R), yb = Math.min(H, y + R + 1);
    for (let x = 0; x < W; x++) {
      const xa = Math.max(0, x - R), xb = Math.min(W, x + R + 1);
      const m = (I[yb * (W + 1) + xb] - I[ya * (W + 1) + xb] - I[yb * (W + 1) + xa] + I[ya * (W + 1) + xa]) / ((yb - ya) * (xb - xa));
      const v = Math.min(255, g[y * W + x] / Math.max(1, m) * 235);
      out[y * W + x] = v; hist[v | 0]++;
    }
  }
  let lo = 0, acc = 0; while (lo < 200 && (acc += hist[lo]) < W * H * 0.01) lo++;   // dunkelste 1 % → schwarz
  for (let i = 0, j = 0; i < out.length; i++, j += 4) { const v = Math.max(0, Math.min(255, (out[i] - lo) * 255 / Math.max(1, 235 - lo))); d[j] = d[j + 1] = d[j + 2] = v; d[j + 3] = 255; }
  ctx.putImageData(im, 0, 0);
  return c;
}
// Komplette Aufbereitung für die Texterkennung
// base: das einmal eingelesene Foto – wird nicht verändert
function prepForOcr(base, rot, plain) {
  let c = base;
  const step = (o) => { if (c !== base) free(c); c = o; };
  if (rot) step(rotated(c, rot, "#000"));
  // erst Schräglage am Beleg messen, dann das ganze Foto gerade drehen und den Beleg eng ausschneiden
  let box = paperBox(c);
  const probe = box ? cropped(c, box) : c, a = skewAngle(probe);
  if (probe !== c) free(probe);
  if (Math.abs(a) >= 0.5) { step(rotated(c, -a, "#000")); box = paperBox(c); }
  if (box) step(cropped(c, paperBox(c, -0.015) || box));
  if (c.width < 1400) step(scaledTo(c, 1400 / c.width));          // Schrift groß genug für Tesseract
  else if (c.width > 2200) step(scaledTo(c, 2200 / c.width));
  if (c === base) c = scaledTo(base, 1);                          // Kopie: der Kontrastfilter ändert das Bild
  return plain ? c : flatten(c);
}
const foundOf = (r) => ["fuel", "liters", "ppl", "total", "date", "time"].filter((k) => r[k] != null).length;
// Lesen; bei schwachem Ergebnis gedreht erneut versuchen (Beleg quer oder kopfüber fotografiert)
async function readReceipt(file, onProgress) {
  await loadTess();
  let step = 0;
  const worker = await Tesseract.createWorker("deu", 1, {
    workerPath: absUrl("ocr/worker.min.js"), corePath: absUrl("ocr/"), langPath: absUrl("ocr/"), gzip: true,
    logger: (m) => m.status === "recognizing text" && onProgress?.(m.progress, step),
  });
  const base = await prepImage(file, 3200);
  try {
    await worker.setParameters({ tessedit_pageseg_mode: "4", preserve_interword_spaces: "1" });
    let best = { text: "", found: -1 };
    // 1. aufbereitet, 2. ohne Kontrastfilter (Tesseract binarisiert selbst), dann gedreht
    for (const [rot, plain] of [[0, false], [0, true], [90, false], [270, false], [180, false]]) {
      const img = prepForOcr(base, rot, plain), { data } = await worker.recognize(img);
      free(img);
      const found = foundOf(parseReceipt(data.text || ""));
      if (found > best.found) best = { text: data.text || "", found };
      if (best.found >= 6 || (plain && best.found >= 3)) break;   // gedreht nur, wenn aufrecht fast nichts lesbar ist
      step++;
    }
    return best.text;
  } finally { worker.terminate(); free(base); }
}
async function thumbOf(file) {
  const c = await prepImage(file, 1000);
  return new Promise((res) => c.toBlob((b) => { free(c); res(b); }, "image/jpeg", 0.6));
}

// ---- Tankstelle zum Beleg finden (Marke, PLZ, Straße, Ort)
async function allStations() {
  await Promise.all(bases.filter((b) => !baseCache[b.id]).map((b) => loadBaseData(b).catch(() => null)));
  const m = new Map();
  for (const b of bases) for (const s of baseCache[b.id]?.latest?.stations || []) m.set(s.id, s);
  return [...m.values()];
}
function matchStation(text, list) {
  const T = ` ${text.toLowerCase().replace(/[^a-z0-9äöüß]+/g, " ")} `, tokens = new Set(T.trim().split(" "));
  const STOP = new Set(["unter", "ober", "nieder", "neckar", "fils", "teck", "achalm", "stadt", "straße", "strasse"]);
  const words = (s) => String(s || "").toLowerCase().replace(/str(aße|asse|\.)?\b/g, " ").split(/[^a-z0-9äöüß]+/).filter((w) => w.length >= 4 && !STOP.has(w));
  const bw = (s) => String(s.brand || "").toLowerCase().replace(/[^a-z0-9äöüß ]/g, "").trim().split(" ")[0];
  // ein Buchstabe falsch gelesen („MIB“ statt „MTB“) zählt noch als Treffer
  const near1 = (a, b) => a.length === b.length && [...a].filter((c, i) => c !== b[i]).length === 1;
  const fuzzy = (w) => w.length >= 3 && [...tokens].some((t) => near1(t, w));
  // Steht eine bekannte Marke auf dem Beleg, passt keine Tankstelle einer anderen Marke
  const brands = new Set(list.map(bw).filter((b) => b && b.length >= 3 && !["freie", "tankstelle", "sb"].includes(b)));
  // nur die erste Zeile: darunter steht oft der Betreiber („Fritz Wahr Energie“), der zufällig wie eine Marke heißen kann
  const head = new Set(String(text).split(/\n/).map((l) => l.trim()).find(Boolean)?.toLowerCase().split(/[^a-z0-9äöüß]+/) || []);
  const onReceipt = [...brands].find((b) => head.has(b));
  const placeHit = (s) => words(s.place).some((w) => tokens.has(w));
  const perPlace = {};
  for (const s of list) if (placeHit(s)) perPlace[s.place] = (perPlace[s.place] || 0) + 1;
  let best = null;
  for (const s of list) {
    let sc = 0;
    const b = bw(s), generic = !b || ["freie", "tankstelle", "sb"].includes(b);
    if (!generic && tokens.has(b)) sc += 3;
    else if (!generic && !onReceipt && fuzzy(b)) sc += 2;
    else if (onReceipt) sc -= 4;
    const plz = s.plz && T.includes(` ${s.plz}`), place = placeHit(s);
    if (plz) sc += 3;
    if (words(s.street).some((w) => T.includes(w))) sc += 3;
    if (place) sc += perPlace[s.place] === 1 ? 4 : 2;   // einzige Tankstelle in diesem Ort → fast eindeutig
    if (!plz && !place) sc -= 2;                 // ohne passenden Ort keine sichere Zuordnung
    const hn = String(s.street || "").match(/\d+/)?.[0];
    if (hn && T.includes(` ${hn} `)) sc += 1;
    if (sc > (best?.sc ?? 0)) best = { s, sc };
  }
  return best && best.sc >= 5 ? best.s : null;
}
