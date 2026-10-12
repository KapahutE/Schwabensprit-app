/* routegeo.js – Schwabensprit: Tankstellen entlang einer Route.
 * Reine Geometrie/Auswahl, kein DOM, kein Netz. Klassisches Script (globale
 * Funktionen); in Node per require() ladbar (module.exports am Ende).
 * Koordinaten immer [lat, lng] in Grad, Entfernungen in km.
 * Interne Helfer/Konstanten tragen das Präfix rg/RG_, damit sie nicht mit den
 * globalen Namen der App (distKm, fillCost, hasPrice, price …) kollidieren. */
"use strict";

const RG_KPD = 6371.0088 * Math.PI / 180; // km pro Breitengrad (~111.195)
const RG_RAD = Math.PI / 180;

/** Zahl aus number/nicht-leerem String, sonst NaN (null/false/"" → NaN, nicht 0). */
function rgNum(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") return Number(v);
  return NaN;
}

/** Preis einer Station für fuel ('e5'|'e10'|'diesel') oder null (fehlt/false/0). */
function rgPrice(s, fuel) {
  const p = s ? rgNum(s[fuel]) : NaN;
  return Number.isFinite(p) && p > 0 ? p : null;
}

/** Option mit Default (null/undefined/NaN → Default). */
function rgOpt(o, k, def) {
  const v = o ? o[k] : undefined;
  if (v == null) return def;
  if (typeof def === "number") { const n = rgNum(v); return Number.isFinite(n) ? n : def; }
  return v;
}

/** Equirektangulare Distanz zweier Punkte (km), cos der mittleren Breite. */
function rgDistKm(lat1, lng1, lat2, lng2) {
  const dx = (lng2 - lng1) * Math.cos((lat1 + lat2) * 0.5 * RG_RAD);
  const dy = lat2 - lat1;
  return Math.sqrt(dx * dx + dy * dy) * RG_KPD;
}

/**
 * Google-Polyline dekodieren (OSRM geometries=polyline6 → precision 6,
 * klassisches Google-Format → precision 5).
 * @param {string} str
 * @param {number} [precision=6]
 * @returns {Array<[number, number]>} [[lat, lng], …]; abgeschnittene Eingabe → bis dahin
 */
function decodePolyline(str, precision) {
  const out = [];
  if (typeof str !== "string" || !str) return out;
  const factor = Math.pow(10, precision == null ? 6 : precision);
  const len = str.length;
  let i = 0, lat = 0, lng = 0;
  while (i < len) {
    // Arithmetik statt Bit-Shifts: kein 32-bit-Überlauf bei großen Deltas
    let res = 0, mul = 1, b;
    do { if (i >= len) return out; b = str.charCodeAt(i++) - 63; res += (b & 31) * mul; mul *= 32; } while (b >= 32);
    lat += res % 2 ? -(res + 1) / 2 : res / 2;
    res = 0; mul = 1;
    do { if (i >= len) return out; b = str.charCodeAt(i++) - 63; res += (b & 31) * mul; mul *= 32; } while (b >= 32);
    lng += res % 2 ? -(res + 1) / 2 : res / 2;
    out.push([lat / factor, lng / factor]);
  }
  return out;
}

/**
 * Index über eine Route: kumulierte Strecke je Stützpunkt (km) und ein
 * Gitter (CSR) über die Segment-Bounding-Boxes für schnelle Nächstes-Segment-Abfragen.
 * @param {Array<[number, number]|{lat:number,lng:number}>} points
 * @param {{cellKm?: number}} [opts] Gitterweite (Default 1 km; wird bei Riesen-BBox vergrößert)
 * @returns {object} { n, lat, lng, cum, segLen, segCos, totalKm, bbox, grid, … }
 */
function routeIndex(points, opts) {
  const src = points || [], m = src.length;
  const latBuf = new Float64Array(Math.max(2, m)), lngBuf = new Float64Array(Math.max(2, m));
  let n = 0;
  for (let i = 0; i < m; i++) {
    const p = src[i];
    if (!p) continue;
    let la, ln;
    if (Array.isArray(p)) { la = p[0]; ln = p[1]; }
    else { la = p.lat; ln = p.lng != null ? p.lng : p.lon; }
    if (typeof la !== "number") la = rgNum(la);
    if (typeof ln !== "number") ln = rgNum(ln);
    if (la === la && ln === ln && Math.abs(la) <= 90 && Math.abs(ln) <= 180) { latBuf[n] = la; lngBuf[n] = ln; n++; }
  }
  if (!n) throw new Error("routeIndex: keine gültigen Routenpunkte");
  if (n === 1) { latBuf[1] = latBuf[0]; lngBuf[1] = lngBuf[0]; n = 2; } // Ein Punkt → Null-Segment
  const lat = n === latBuf.length ? latBuf : latBuf.slice(0, n);
  const lng = n === lngBuf.length ? lngBuf : lngBuf.slice(0, n);
  const nSeg = n - 1;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (let i = 0; i < n; i++) {
    const la = lat[i], ln = lng[i];
    if (la < minLat) minLat = la; if (la > maxLat) maxLat = la;
    if (ln < minLng) minLng = ln; if (ln > maxLng) maxLng = ln;
  }

  // Kumulierte Strecke (equirektangular je Segment, cos der Segmentmitte)
  const cum = new Float64Array(n), segLen = new Float64Array(nSeg), segCos = new Float64Array(nSeg);
  let cosMin = 1;
  for (let i = 0; i < nSeg; i++) {
    const c = Math.cos((lat[i] + lat[i + 1]) * 0.5 * RG_RAD);
    const dx = (lng[i + 1] - lng[i]) * c, dy = lat[i + 1] - lat[i];
    segCos[i] = c;
    if (c < cosMin) cosMin = c;
    segLen[i] = Math.sqrt(dx * dx + dy * dy) * RG_KPD;
    cum[i + 1] = cum[i] + segLen[i];
  }

  // Gitter in Grad (Zellen ≈ cellKm × cellKm um die BBox-Mitte)
  let cellKm = rgOpt(opts, "cellKm", 1);
  if (!(cellKm > 0)) cellKm = 1;
  const cosRef = Math.max(0.01, Math.cos((minLat + maxLat) * 0.5 * RG_RAD));
  let cellLat, cellLng, cols, rows;
  for (;;) {
    cellLat = cellKm / RG_KPD;
    cellLng = cellKm / (RG_KPD * cosRef);
    cols = Math.floor((maxLng - minLng) / cellLng) + 1;
    rows = Math.floor((maxLat - minLat) / cellLat) + 1;
    if (cols * rows <= 4e6) break;
    cellKm *= 2;
  }
  // Jedes Segment in alle Zellen seiner BBox eintragen (CSR: start[cell]..start[cell+1])
  const nCells = cols * rows;
  const box = new Int32Array(4 * nSeg); // c0, c1, r0, r1 je Segment
  const start = new Int32Array(nCells + 1);
  for (let s = 0, b = 0; s < nSeg; s++, b += 4) {
    const a = lng[s], e = lng[s + 1], u = lat[s], v = lat[s + 1];
    const c0 = Math.max(0, Math.floor(((a < e ? a : e) - minLng) / cellLng));
    const c1 = Math.min(cols - 1, Math.floor(((a < e ? e : a) - minLng) / cellLng));
    const r0 = Math.max(0, Math.floor(((u < v ? u : v) - minLat) / cellLat));
    const r1 = Math.min(rows - 1, Math.floor(((u < v ? v : u) - minLat) / cellLat));
    box[b] = c0; box[b + 1] = c1; box[b + 2] = r0; box[b + 3] = r1;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) start[r * cols + c + 1]++;
  }
  for (let k = 0; k < nCells; k++) start[k + 1] += start[k];
  const items = new Int32Array(start[nCells]);
  const fill = start.slice(0, nCells);
  for (let s = 0, b = 0; s < nSeg; s++, b += 4) {
    for (let r = box[b + 2]; r <= box[b + 3]; r++) {
      for (let c = box[b]; c <= box[b + 1]; c++) items[fill[r * cols + c]++] = s;
    }
  }

  return {
    n, lat, lng, cum, segLen, segCos, cosMin,
    totalKm: cum[n - 1],
    bbox: { minLat, maxLat, minLng, maxLng },
    grid: { lat0: minLat, lng0: minLng, cellLat, cellLng, cols, rows, cellKm, start, items },
    seen: new Int32Array(nSeg), qid: 0,
  };
}

/** Kandidaten-Segmente im Kasten ±rKm um (qlat,qlng) prüfen; best wird verbessert. */
function rgSearch(ix, qlat, qlng, rKm, best) {
  const g = ix.grid;
  const cosQ = Math.cos(qlat * RG_RAD);
  // Projektion je (Punkt, Segment) nutzt kx = (cosQ + segCos)/2 ≥ min(cosQ, cosMin)
  const dLat = rKm / RG_KPD;
  const dLng = rKm / (RG_KPD * Math.max(0.01, Math.min(cosQ, ix.cosMin)));
  let r0 = Math.floor((qlat - dLat - g.lat0) / g.cellLat), r1 = Math.floor((qlat + dLat - g.lat0) / g.cellLat);
  let c0 = Math.floor((qlng - dLng - g.lng0) / g.cellLng), c1 = Math.floor((qlng + dLng - g.lng0) / g.cellLng);
  if (r1 < 0 || c1 < 0 || r0 >= g.rows || c0 >= g.cols) return best;
  if (r0 < 0) r0 = 0; if (c0 < 0) c0 = 0;
  if (r1 >= g.rows) r1 = g.rows - 1; if (c1 >= g.cols) c1 = g.cols - 1;
  if (ix.qid > 1e9) { ix.seen.fill(0); ix.qid = 0; }
  const stamp = ++ix.qid, seen = ix.seen, start = g.start, items = g.items;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0, cell = r * g.cols + c0; c <= c1; c++, cell++) {
      for (let k = start[cell], e = start[cell + 1]; k < e; k++) {
        const s = items[k];
        if (seen[s] === stamp) continue;
        seen[s] = stamp;
        rgSegTest(ix, s, qlat, qlng, cosQ, best);
      }
    }
  }
  return best;
}

/** Punkt–Segment-Abstand in lokaler equirektangularer Projektion (Einheit: Grad Breite). */
function rgSegTest(ix, s, qlat, qlng, cosQ, best) {
  const lat = ix.lat, lng = ix.lng;
  const kx = 0.5 * (cosQ + ix.segCos[s]);
  const ay = lat[s], ax = lng[s];
  const bx = (lng[s + 1] - ax) * kx, by = lat[s + 1] - ay;
  const px = (qlng - ax) * kx, py = qlat - ay;
  const L2 = bx * bx + by * by;
  let t = L2 > 0 ? (px * bx + py * by) / L2 : 0;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  const ex = px - t * bx, ey = py - t * by;
  const d2 = ex * ex + ey * ey;
  // Gleichstand (Route fährt dieselbe Straße zweimal) → früheres Segment
  if (d2 < best.d2 || (d2 === best.d2 && s < best.seg)) { best.d2 = d2; best.seg = s; best.t = t; }
}

/**
 * Nächster Punkt auf der Route.
 * @param {object} index routeIndex(...)
 * @param {number} lat
 * @param {number} lng
 * @param {number} [maxKm] optional: nur bis maxKm suchen, sonst null (schnell, für Korridor)
 * @returns {{distKm:number, alongKm:number, segIdx:number}|null}
 */
function nearestOnRoute(index, lat, lng, maxKm) {
  const ix = index;
  const best = { d2: Infinity, seg: -1, t: 0 };
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (maxKm != null && Number.isFinite(maxKm)) {
    if (maxKm < 0) return null;
    rgSearch(ix, lat, lng, maxKm, best);
    if (best.seg < 0 || Math.sqrt(best.d2) * RG_KPD > maxKm) return null;
  } else {
    // Kasten verdoppeln, bis ein Treffer innerhalb des Kastenradius liegt (dann global nächster)
    const cap = 64 * ix.grid.cellKm;
    for (let r = ix.grid.cellKm; ; r *= 2) {
      rgSearch(ix, lat, lng, r, best);
      if (best.seg >= 0 && Math.sqrt(best.d2) * RG_KPD <= r) break;
      if (r >= cap) { // weit weg: alle Segmente prüfen
        const cosQ = Math.cos(lat * RG_RAD);
        for (let s = 0; s < ix.n - 1; s++) rgSegTest(ix, s, lat, lng, cosQ, best);
        break;
      }
    }
  }
  const s = best.seg;
  return { distKm: Math.sqrt(best.d2) * RG_KPD, alongKm: ix.cum[s] + best.t * ix.segLen[s], segIdx: s };
}

/**
 * Punkt auf der Route bei alongKm (geklemmt auf [0, totalKm]).
 * @returns {[number, number]} [lat, lng]
 */
function routePointAt(index, alongKm) {
  const ix = index, cum = ix.cum, n = ix.n;
  const a = Math.min(ix.totalKm, Math.max(0, +alongKm || 0));
  let lo = 0, hi = n - 2; // größtes i mit cum[i] <= a
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (cum[mid] <= a) lo = mid; else hi = mid - 1; }
  const L = ix.segLen[lo], t = L > 0 ? Math.min(1, (a - cum[lo]) / L) : 0;
  return [ix.lat[lo] + t * (ix.lat[lo + 1] - ix.lat[lo]), ix.lng[lo] + t * (ix.lng[lo + 1] - ix.lng[lo])];
}

/**
 * Stationen im Korridor um die Route, sortiert nach alongKm, dedupliziert nach id
 * (bei Duplikaten gewinnt das erste mit Preis für fuel).
 * detourKm = 2·offKm·roadFactor (hin und zurück),
 * fillCost = price·tankL + detourKm·consL100/100·price (null ohne Preis).
 * @param {object} index routeIndex(...)
 * @param {Array<object>} stations {id, lat, lng, e5, e10, diesel, …}
 * @param {{corridorKm?:number, fuel?:string, roadFactor?:number, tankL?:number, consL100?:number}} [opts]
 * @returns {Array<object>} [{...station, offKm, alongKm, detourKm, fillCost}]
 */
function stationsAlongRoute(index, stations, opts) {
  const corridorKm = rgOpt(opts, "corridorKm", 2);
  const fuel = rgOpt(opts, "fuel", "e5");
  const roadFactor = rgOpt(opts, "roadFactor", 1.3);
  const tankL = rgOpt(opts, "tankL", 50);
  const consL100 = rgOpt(opts, "consL100", 7);

  const uniq = new Map(); // Einfügereihenfolge bleibt beim Ersetzen erhalten
  for (const s of stations || []) {
    if (!s) continue;
    const la = rgNum(s.lat), ln = rgNum(s.lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) continue;
    const key = s.id != null && s.id !== "" ? "i" + s.id : "p" + la.toFixed(5) + "," + ln.toFixed(5);
    const prev = uniq.get(key);
    if (!prev) uniq.set(key, { s, la, ln });
    else if (rgPrice(prev.s, fuel) == null && rgPrice(s, fuel) != null) uniq.set(key, { s, la, ln });
  }

  const out = [];
  for (const { s, la, ln } of uniq.values()) {
    const hit = nearestOnRoute(index, la, ln, corridorKm);
    if (!hit) continue;
    const p = rgPrice(s, fuel);
    const detourKm = 2 * hit.distKm * roadFactor;
    out.push(Object.assign({}, s, {
      offKm: hit.distKm,
      alongKm: hit.alongKm,
      detourKm,
      fillCost: p == null ? null : p * tankL + detourKm * consL100 / 100 * p,
    }));
  }
  out.sort((a, b) => a.alongKm - b.alongKm || a.offKm - b.offKm);
  return out;
}

/**
 * Abfragemittelpunkte (z. B. Tankerkönig list.php, rad ≤ 25 km) entlang der Route,
 * inkl. Start und Ziel, sodass die Kreise den Korridor überdecken.
 * Garantie (auch für kurvige Routen, per Dreiecksungleichung): jeder Routenpunkt liegt
 * ≤ radiusKm − w von einem Mittelpunkt (w = corridorKm + 1 km Reserve), also jeder
 * Korridorpunkt ≤ radiusKm − 1 km. Gierig: nächster Mittelpunkt sitzt radiusKm − w
 * (entlang der Route) hinter dem letzten noch abgedeckten Stützpunkt. Auf geraden
 * Strecken Abstand 2·(r − w) (44 km bei 25/2) statt 2·√(r² − w²) (49,6 km), weil
 * Letzteres nur für gerade Strecken gilt; 300 km gerade → 8 Punkte.
 * @param {object} index routeIndex(...)
 * @param {{radiusKm?:number, corridorKm?:number}} [opts]
 * @returns {Array<[number, number]>} [[lat, lng], …]
 */
function samplePoints(index, opts) {
  const ix = index;
  const r = rgOpt(opts, "radiusKm", 25);
  const w = rgOpt(opts, "corridorKm", 2) + 1;
  const R = r - w > 0 ? r - w : Math.max(0.1, r * 0.5); // r ≤ w: volle Abdeckung unmöglich
  const n = ix.n, lat = ix.lat, lng = ix.lng, cum = ix.cum, total = ix.totalKm;
  const pts = [[lat[0], lng[0]]];
  let a = 0, pLat = lat[0], pLng = lng[0], j = 1;
  for (;;) {
    while (j < n && cum[j] <= a) j++;
    while (j < n && rgDistKm(pLat, pLng, lat[j], lng[j]) <= R) j++;
    if (j >= n) break;                       // Rest liegt im aktuellen Kreis
    const base = Math.max(a, cum[j - 1]);    // bis hier abgedeckt
    if (base >= total - R) break;            // Rest deckt der Ziel-Kreis ab
    a = base + R;
    const q = routePointAt(ix, a);
    pLat = q[0]; pLng = q[1];
    pts.push(q);
  }
  const last = pts[pts.length - 1];
  if (last[0] !== lat[n - 1] || last[1] !== lng[n - 1]) pts.push([lat[n - 1], lng[n - 1]]);
  return pts;
}

/**
 * Beste Stationen: cheapest = niedrigster Preis, bestValue = niedrigste fillCost.
 * Ohne Preis für fuel wird ignoriert; Gleichstand → früher auf der Route.
 * @param {Array<object>} list Ergebnis von stationsAlongRoute
 * @param {string} fuel
 * @param {{openOnly?: boolean}} [opts] openOnly: Stationen mit open === false ignorieren
 * @returns {{cheapest: object|null, bestValue: object|null}}
 */
function bestPicks(list, fuel, opts) {
  const f = fuel || "e5";
  const openOnly = !!(opts && opts.openOnly);
  const EPS = 1e-9;
  const along = (s) => (s && Number.isFinite(s.alongKm) ? s.alongKm : Infinity);
  let cheapest = null, cp = Infinity, bestValue = null, bv = Infinity;
  for (const s of list || []) {
    if (!s || (openOnly && s.open === false)) continue;
    const p = rgPrice(s, f);
    if (p == null) continue;
    if (p < cp - EPS || (Math.abs(p - cp) <= EPS && along(s) < along(cheapest))) { cheapest = s; cp = p; }
    const fc = s.fillCost;
    if (typeof fc === "number" && Number.isFinite(fc) &&
        (fc < bv - EPS || (Math.abs(fc - bv) <= EPS && along(s) < along(bestValue)))) { bestValue = s; bv = fc; }
  }
  return { cheapest, bestValue };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { decodePolyline, routeIndex, nearestOnRoute, routePointAt, stationsAlongRoute, samplePoints, bestPicks };
}
