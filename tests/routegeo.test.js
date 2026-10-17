/* routegeo.test.js – node routegeo.test.js (keine Abhängigkeiten) */
"use strict";
const assert = require("assert");
const path = require("path");
const G = require("../js/routegeo.js");

/* ---------- Test-Helfer (unabhängig vom Modul: echte Kugelgeometrie) ---------- */
const R_KM = 6371.0088, RAD = Math.PI / 180;
function hav(lat1, lng1, lat2, lng2) {
  const dLat = (lat2 - lat1) * RAD, dLng = (lng2 - lng1) * RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}
function dest(lat, lng, brgDeg, km) { // Großkreis-Zielpunkt
  const d = km / R_KM, b = brgDeg * RAD, p1 = lat * RAD, l1 = lng * RAD;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [p2 / RAD, l2 / RAD];
}
function bearing(lat1, lng1, lat2, lng2) {
  const p1 = lat1 * RAD, p2 = lat2 * RAD, dl = (lng2 - lng1) * RAD;
  return Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) / RAD;
}
function rng(seed) { // mulberry32, deterministisch
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function encodePolyline(pts, precision) {
  const f = Math.pow(10, precision);
  const encNum = (d) => {
    let v = d < 0 ? -2 * d - 1 : 2 * d, s = "";
    while (v >= 32) { s += String.fromCharCode((32 | (v % 32)) + 63); v = Math.floor(v / 32); }
    return s + String.fromCharCode(v + 63);
  };
  let pl = 0, pg = 0, s = "";
  for (const [la, lg] of pts) {
    const a = Math.round(la * f), b = Math.round(lg * f);
    s += encNum(a - pl) + encNum(b - pg); pl = a; pg = b;
  }
  return s;
}
/** Referenz: Haversine-Brute-Force über alle Segmente (Ternärsuche auf t). */
function refNearest(pts, lat, lng) {
  let best = { d: Infinity, seg: -1, t: 0 };
  for (let i = 0; i < pts.length - 1; i++) {
    const [a1, b1] = pts[i], [a2, b2] = pts[i + 1];
    const L = hav(a1, b1, a2, b2);
    if (Math.min(hav(lat, lng, a1, b1), hav(lat, lng, a2, b2)) - L > best.d) continue;
    const f = (t) => hav(lat, lng, a1 + t * (a2 - a1), b1 + t * (b2 - b1));
    let lo = 0, hi = 1;
    for (let k = 0; k < 60; k++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (f(m1) <= f(m2)) hi = m2; else lo = m1; }
    const t = (lo + hi) / 2, d = f(t);
    if (d < best.d) best = { d, seg: i, t };
  }
  let along = 0;
  for (let i = 0; i < best.seg; i++) along += hav(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
  const s = best.seg;
  along += best.t * hav(pts[s][0], pts[s][1], pts[s + 1][0], pts[s + 1][1]);
  return { distKm: best.d, alongKm: along, segIdx: s };
}
/** Brute-Force mit derselben Projektionsformel wie das Modul (prüft Gitter-Vollständigkeit). */
function bruteSameMetric(ix, lat, lng) {
  const KPD = 6371.0088 * Math.PI / 180, cosQ = Math.cos(lat * RAD);
  let bd = Infinity, bs = -1, bt = 0;
  for (let s = 0; s < ix.n - 1; s++) {
    const kx = 0.5 * (cosQ + ix.segCos[s]);
    const bx = (ix.lng[s + 1] - ix.lng[s]) * kx, by = ix.lat[s + 1] - ix.lat[s];
    const px = (lng - ix.lng[s]) * kx, py = lat - ix.lat[s];
    const L2 = bx * bx + by * by;
    let t = L2 > 0 ? (px * bx + py * by) / L2 : 0; t = Math.max(0, Math.min(1, t));
    const d2 = (px - t * bx) ** 2 + (py - t * by) ** 2;
    if (d2 < bd) { bd = d2; bs = s; bt = t; }
  }
  return { distKm: Math.sqrt(bd) * KPD, alongKm: ix.cum[bs] + bt * ix.segLen[bs], segIdx: bs };
}
function straightRoute(lat0, lng0, lat1, lng1, n) {
  const pts = [];
  for (let i = 0; i < n; i++) { const t = i / (n - 1); pts.push([lat0 + t * (lat1 - lat0), lng0 + t * (lng1 - lng0)]); }
  return pts;
}
const now = () => Number(process.hrtime.bigint()) / 1e6;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ""} erwartet ${b} ±${tol}, ist ${a}`);

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log("PASS " + name); }
  catch (e) { fail++; console.log("FAIL " + name + "\n     " + (e && e.message ? e.message : e)); }
}

/* ---------- Fixtures ---------- */
const FIX = require(path.join(__dirname, "fixtures", "route-stgt-ulm.json"));
const route = FIX.routes[0];
const PTS = G.decodePolyline(route.geometry, 6);
const IX = G.routeIndex(PTS);
let LONG = null;
try { LONG = require(path.join(__dirname, "fixture-long.json")); } catch (e) { /* optional */ }

/* ---------- decodePolyline ---------- */
test("decodePolyline: Google-Referenzbeispiel (precision 5)", () => {
  const p = G.decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@", 5);
  assert.deepStrictEqual(p.map(([a, b]) => [+a.toFixed(5), +b.toFixed(5)]), [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]);
});
test("decodePolyline: Roundtrip zufälliger Weltkoordinaten (precision 6, große Deltas)", () => {
  const r = rng(7), pts = [];
  for (let i = 0; i < 500; i++) pts.push([+(r() * 180 - 90).toFixed(6), +(r() * 360 - 180).toFixed(6)]);
  const back = G.decodePolyline(encodePolyline(pts, 6));
  assert.strictEqual(back.length, pts.length);
  back.forEach((p, i) => { near(p[0], pts[i][0], 5e-7); near(p[1], pts[i][1], 5e-7); });
  assert.strictEqual(G.decodePolyline(encodePolyline([[48.5, 9.1]], 6)).length, 1, "Default-precision 6");
});
test("decodePolyline: leer/abgeschnitten/ungültig wirft nicht", () => {
  assert.deepStrictEqual(G.decodePolyline(""), []);
  assert.deepStrictEqual(G.decodePolyline(null), []);
  const s = route.geometry;
  const cut = G.decodePolyline(s.slice(0, Math.floor(s.length / 2)));
  assert.ok(cut.length > 0 && cut.length < PTS.length);
  cut.forEach((p, i) => { assert.strictEqual(p[0], PTS[i][0]); assert.strictEqual(p[1], PTS[i][1]); });
});
test(`decodePolyline: echte OSRM-Antwort Stuttgart→Ulm (${PTS.length} Punkte)`, () => {
  assert.strictEqual(FIX.code, "Ok");
  assert.ok(PTS.length > 500, "zu wenige Punkte");
  const [w0, w1] = FIX.waypoints;
  near(PTS[0][0], w0.location[1], 1e-6, "Start lat"); near(PTS[0][1], w0.location[0], 1e-6, "Start lng");
  near(PTS.at(-1)[0], w1.location[1], 1e-6, "Ziel lat"); near(PTS.at(-1)[1], w1.location[0], 1e-6, "Ziel lng");
  for (const [la, lg] of PTS) assert.ok(la > 48.3 && la < 48.9 && lg > 9.0 && lg < 10.1, `Punkt außerhalb: ${la},${lg}`);
  let havSum = 0;
  for (let i = 1; i < PTS.length; i++) havSum += hav(PTS[i - 1][0], PTS[i - 1][1], PTS[i][0], PTS[i][1]);
  near(havSum, route.distance / 1000, 0.01 * route.distance / 1000, "Länge vs. OSRM distance (1 %)");
  near(IX.totalKm, havSum, 0.001 * havSum, "routeIndex.totalKm vs. Haversine (0,1 %)");
  console.log(`     Länge: OSRM ${(route.distance / 1000).toFixed(2)} km, Haversine ${havSum.toFixed(2)} km, Index ${IX.totalKm.toFixed(2)} km`);
});

/* ---------- routeIndex / nearestOnRoute ---------- */
test("routeIndex: kumulierte Strecke monoton, Randfälle", () => {
  for (let i = 1; i < IX.n; i++) assert.ok(IX.cum[i] >= IX.cum[i - 1], "cum fällt bei " + i);
  assert.strictEqual(IX.cum[0], 0);
  const one = G.routeIndex([[48.5, 9.5]]);
  assert.strictEqual(one.totalKm, 0);
  const h = G.nearestOnRoute(one, 48.5, 9.51);
  near(h.distKm, hav(48.5, 9.5, 48.5, 9.51), 1e-3); assert.strictEqual(h.alongKm, 0);
  const mixed = G.routeIndex([[48.5, 9.5], null, [NaN, 1], { lat: 48.6, lng: 9.6 }, ["48.7", "9.7"]]);
  assert.strictEqual(mixed.n, 3);
  assert.throws(() => G.routeIndex([]));
});
test("along-route Monotonie: Stationen in Routenreihenfolge → alongKm steigend", () => {
  // nur Stützpunkte, an denen die Route nicht an sich selbst vorbeiführt (Stuttgart: Wende auf
  // der Konrad-Adenauer-Str., Gegenfahrbahn 30 m daneben → dort ist "nächster Punkt" mehrdeutig)
  const selfClear = (i) => {
    for (let j = 0; j < IX.n; j++) {
      if (Math.abs(IX.cum[j] - IX.cum[i]) > 0.4 && hav(PTS[i][0], PTS[i][1], PTS[j][0], PTS[j][1]) < 0.35) return false;
    }
    return true;
  };
  const st = [];
  let skipped = 0;
  for (let i = 1, k = 0, last = -Infinity; i < IX.n - 1; i++) {
    if (IX.cum[i] - last < 1.0) continue; // Prüfpunkte ≥ 1 km auseinander
    if (!selfClear(i)) { skipped++; continue; }
    last = IX.cum[i];
    // 100 m quer zur lokalen Fahrtrichtung, abwechselnd links/rechts
    const b = bearing(PTS[i][0], PTS[i][1], PTS[i + 1][0], PTS[i + 1][1]) + (k % 2 ? 90 : -90);
    const [la, lg] = dest(PTS[i][0], PTS[i][1], b, 0.1);
    st.push({ id: "m" + k++, lat: la, lng: lg, vtx: i });
  }
  assert.ok(st.length >= 60, "zu wenige Prüfpunkte " + st.length);
  // gemischt übergeben, Ergebnis muss nach Route sortiert sein
  const shuffled = st.slice().sort((a, b) => ((a.vtx * 7919) % 101) - ((b.vtx * 7919) % 101));
  const res = G.stationsAlongRoute(IX, shuffled);
  assert.strictEqual(res.length, st.length, "alle Stationen im Korridor");
  for (let k = 1; k < res.length; k++) assert.ok(res[k].alongKm > res[k - 1].alongKm, "alongKm nicht steigend");
  assert.deepStrictEqual(res.map((s) => s.id), st.map((s) => s.id), "Reihenfolge = Routenreihenfolge");
  res.forEach((s) => {
    near(s.alongKm, IX.cum[s.vtx], 0.15, "alongKm ≈ cum[vtx] " + s.id);
    const ref = refNearest(PTS, s.lat, s.lng);
    near(s.alongKm, ref.alongKm, 0.005 * ref.alongKm + 0.002, "alongKm vs. Haversine-Referenz " + s.id);
  });
  console.log(`     ${st.length} Stationen geprüft (${skipped} Stützpunkte mit Selbstannäherung übersprungen)`);
  // exakt auf Stützpunkten: alongKm == cum[i]
  for (let i = 0; i < IX.n; i += 97) {
    const h = G.nearestOnRoute(IX, PTS[i][0], PTS[i][1]);
    assert.ok(h.distKm < 1e-9, "dist auf Vertex"); near(h.alongKm, IX.cum[i], 1e-6, "along auf Vertex " + i);
  }
});
test("Station exakt auf der Route (Segmentmitte): offKm ≈ 0", () => {
  const i = Math.floor(IX.n / 2);
  const la = (PTS[i][0] + PTS[i + 1][0]) / 2, lg = (PTS[i][1] + PTS[i + 1][1]) / 2;
  const [s] = G.stationsAlongRoute(IX, [{ id: "on", lat: la, lng: lg, e5: 1.799 }]);
  assert.ok(s, "nicht gefunden");
  assert.ok(s.offKm < 0.001, "offKm " + s.offKm);
  near(s.alongKm, IX.cum[i] + IX.segLen[i] / 2, 1e-6);
  near(s.detourKm, 0, 0.003); near(s.fillCost, 1.799 * 50, 0.01);
});

// gerades Stück der A8 suchen: ±2 km um Vertex i weicht < 25 m von der Sehne ab
function straightSpot(ix, pts) {
  for (let i = Math.floor(ix.n * 0.2); i < ix.n * 0.9; i++) {
    const a = ix.cum[i];
    if (a < 5 || a > ix.totalKm - 5) continue;
    const A = G.routePointAt(ix, a - 2), B = G.routePointAt(ix, a + 2);
    let ok = true;
    for (let j = i; j >= 0 && ix.cum[j] >= a - 2 && ok; j--) ok = refNearest([A, B], pts[j][0], pts[j][1]).distKm < 0.025;
    for (let j = i; j < ix.n && ix.cum[j] <= a + 2 && ok; j++) ok = refNearest([A, B], pts[j][0], pts[j][1]).distKm < 0.025;
    if (ok) return { i, brg: bearing(A[0], A[1], B[0], B[1]) };
  }
  throw new Error("kein gerades Stück gefunden");
}
const SP = straightSpot(IX, PTS);
test(`Station 1,5 km neben der Route (Vertex ${SP.i}, along ${IX.cum[SP.i].toFixed(1)} km) → im 2-km-Korridor`, () => {
  const V = PTS[SP.i];
  const [la, lg] = dest(V[0], V[1], SP.brg + 90, 1.5);
  const ref = refNearest(PTS, la, lg);
  const [s] = G.stationsAlongRoute(IX, [{ id: "off15", lat: la, lng: lg, e5: 1.8 }]);
  assert.ok(s, "nicht im Korridor");
  near(s.offKm, ref.distKm, 0.005 * ref.distKm, "offKm vs. Haversine-Referenz (0,5 %)");
  near(s.offKm, 1.5, 0.03, "offKm ≈ 1,5");
  near(s.alongKm, ref.alongKm, 0.005 * ref.alongKm, "alongKm vs. Referenz (0,5 %)");
  near(s.alongKm, IX.cum[SP.i], 0.05);
  // detour/fillCost-Formel
  near(s.detourKm, 2 * s.offKm * 1.3, 1e-12);
  near(s.fillCost, 1.8 * 50 + s.detourKm * 7 / 100 * 1.8, 1e-9);
  near(s.detourKm, 3.9, 0.08);
  console.log(`     offKm ${s.offKm.toFixed(4)} (Ref ${ref.distKm.toFixed(4)}), alongKm ${s.alongKm.toFixed(3)} (Ref ${ref.alongKm.toFixed(3)}), detour ${s.detourKm.toFixed(3)} km, fillCost ${s.fillCost.toFixed(4)} €`);
});
test("Station 3 km neben der Route → ausgeschlossen (aber nearestOnRoute ≈ 3 km)", () => {
  const V = PTS[SP.i];
  const [la, lg] = dest(V[0], V[1], SP.brg - 90, 3);
  assert.strictEqual(G.stationsAlongRoute(IX, [{ id: "off3", lat: la, lng: lg, e5: 1.7 }]).length, 0);
  assert.strictEqual(G.nearestOnRoute(IX, la, lg, 2), null);
  const h = G.nearestOnRoute(IX, la, lg), ref = refNearest(PTS, la, lg);
  near(h.distKm, ref.distKm, 0.005 * ref.distKm); near(h.distKm, 3, 0.05);
  // mit größerem Korridor dabei
  assert.strictEqual(G.stationsAlongRoute(IX, [{ id: "off3", lat: la, lng: lg }], { corridorKm: 3.5 }).length, 1);
});
test("Genauigkeit: 300 Zufallspunkte 0–6 km neben der Route vs. Haversine-Referenz (< 0,5 %)", () => {
  const r = rng(42);
  let maxRelD = 0, maxRelA = 0, maxAbsA = 0, alongChecked = 0;
  for (let k = 0; k < 300; k++) {
    const q = G.routePointAt(IX, r() * IX.totalKm);
    const [la, lg] = dest(q[0], q[1], r() * 360, r() * 6);
    const h = G.nearestOnRoute(IX, la, lg), ref = refNearest(PTS, la, lg);
    const relD = Math.abs(h.distKm - ref.distKm) / Math.max(ref.distKm, 0.2);
    maxRelD = Math.max(maxRelD, relD);
    assert.ok(relD < 0.005, `dist ${h.distKm} vs ${ref.distKm}`);
    // Punkt bei alongKm liegt wirklich so weit weg (along konsistent mit dist)
    const X = G.routePointAt(IX, h.alongKm);
    near(hav(la, lg, X[0], X[1]), ref.distKm, 0.005 * Math.max(ref.distKm, 0.2) + 0.002, "routePointAt(alongKm)");
    if (Math.abs(h.segIdx - ref.segIdx) <= 1) {
      alongChecked++;
      const absA = Math.abs(h.alongKm - ref.alongKm), relA = absA / Math.max(ref.alongKm, 1);
      maxRelA = Math.max(maxRelA, relA); maxAbsA = Math.max(maxAbsA, absA);
      assert.ok(relA < 0.005 || Math.abs(h.alongKm - ref.alongKm) < 0.01, `along ${h.alongKm} vs ${ref.alongKm}`);
    }
  }
  assert.ok(alongChecked > 250, "zu wenige eindeutige Segmente: " + alongChecked);
  console.log(`     max rel. Fehler dist ${(maxRelD * 100).toFixed(4)} %, along ${(maxRelA * 100).toFixed(4)} % / ${(maxAbsA * 1000).toFixed(1)} m (${alongChecked}/300 along geprüft)`);
});

/* ---------- Start/Ende ---------- */
const SYN = straightRoute(48.5, 9.0, 48.5, 10.0, 201); // ~73,7 km Ost-West
const SIX = G.routeIndex(SYN);
test("Station hinter dem Start: alongKm = 0, offKm = Abstand zum Start", () => {
  const [a1, b1] = dest(48.5, 9.0, 270, 0.8);
  const [a2, b2] = dest(48.5, 9.0, 225, 1.5);
  const [a3, b3] = dest(48.5, 9.0, 270, 2.5);
  const res = G.stationsAlongRoute(SIX, [
    { id: "b08", lat: a1, lng: b1, e5: 1.8 }, { id: "b15", lat: a2, lng: b2, e5: 1.8 }, { id: "b25", lat: a3, lng: b3, e5: 1.8 },
  ]);
  assert.deepStrictEqual(res.map((s) => s.id).sort(), ["b08", "b15"]);
  for (const s of res) { assert.strictEqual(s.alongKm, 0); assert.ok(s.alongKm >= 0); }
  near(res.find((s) => s.id === "b08").offKm, 0.8, 0.004);
  near(res.find((s) => s.id === "b15").offKm, 1.5, 0.0075);
  // echte Route: 1 km entgegen der ersten Fahrtrichtung → along klein, nie negativ
  const b0 = bearing(PTS[0][0], PTS[0][1], PTS[1][0], PTS[1][1]);
  const [la, lg] = dest(PTS[0][0], PTS[0][1], b0 + 180, 1);
  const h = G.nearestOnRoute(IX, la, lg), ref = refNearest(PTS, la, lg);
  assert.ok(h.alongKm >= 0 && h.alongKm < 3, "along " + h.alongKm);
  near(h.distKm, ref.distKm, 0.005 * ref.distKm + 0.002);
});
test("Station nahe dem Ziel / hinter dem Ziel", () => {
  const end = PTS.at(-1);
  const h0 = G.nearestOnRoute(IX, end[0], end[1]);
  near(h0.distKm, 0, 1e-9); near(h0.alongKm, IX.totalKm, 1e-9);
  const i = IX.n - 6;
  const b = bearing(PTS[i][0], PTS[i][1], PTS[i + 1][0], PTS[i + 1][1]) + 90;
  const [la, lg] = dest(PTS[i][0], PTS[i][1], b, 0.5);
  const ref = refNearest(PTS, la, lg);
  const res = G.stationsAlongRoute(IX, [{ id: "end", lat: la, lng: lg, e10: 1.7 }, { id: "z", lat: end[0], lng: end[1] }], { fuel: "e10" });
  assert.strictEqual(res.length, 2);
  const s = res.find((x) => x.id === "end");
  near(s.offKm, ref.distKm, 0.005 * ref.distKm + 0.002); near(s.alongKm, ref.alongKm, 0.005 * ref.alongKm);
  assert.ok(s.alongKm > IX.totalKm - 1.5, "along " + s.alongKm);
  assert.strictEqual(res.at(-1).id, "z", "Zielpunkt zuletzt");
  near(res.find((x) => x.id === "z").alongKm, IX.totalKm, 1e-9);
  assert.strictEqual(res.find((x) => x.id === "z").fillCost, null);
  // synthetisch: 1 km hinter dem Ziel → along = totalKm, off ≈ 1
  const [c1, c2] = dest(48.5, 10.0, 90, 1);
  const [t] = G.stationsAlongRoute(SIX, [{ id: "beyond", lat: c1, lng: c2 }]);
  assert.strictEqual(t.alongKm, SIX.totalKm); near(t.offKm, 1, 0.005);
});
test("Korridorgrenze: 1,99 km drin, 2,01 km draußen (gerade Strecke)", () => {
  const [a, b] = dest(48.5, 9.5, 0, 1.99), [c, d] = dest(48.5, 9.5, 180, 2.01);
  const res = G.stationsAlongRoute(SIX, [{ id: "in", lat: a, lng: b }, { id: "out", lat: c, lng: d }]);
  assert.deepStrictEqual(res.map((s) => s.id), ["in"]);
  near(res[0].alongKm, hav(48.5, 9.0, 48.5, 9.5), 0.005 * 36.85);
});

/* ---------- Preise, Dedupe, bestPicks ---------- */
test("fillCost/detour: Optionen, Preise null/false/0/String", () => {
  const [a, b] = dest(48.5, 9.3, 0, 1.0);
  const res = G.stationsAlongRoute(SIX, [
    { id: 1, lat: a, lng: b, diesel: 1.659, e5: 1.9 },
    { id: 2, lat: 48.5, lng: 9.4, diesel: null },
    { id: 3, lat: 48.5, lng: 9.41, diesel: false },
    { id: 4, lat: 48.5, lng: 9.42, diesel: 0 },
    { id: 5, lat: 48.5, lng: 9.43, diesel: "1.599" },
    { id: 6, lat: null, lng: 9.44, diesel: 1.5 },       // ungültig → raus (nicht als 0 werten)
    { id: 7, lat: 48.5, lng: undefined, diesel: 1.5 },  // ungültig → raus
  ], { fuel: "diesel", roadFactor: 1, tankL: 40, consL100: 6, corridorKm: 1.5 });
  assert.deepStrictEqual(res.map((s) => s.id), [1, 2, 3, 4, 5]);
  const s1 = res[0];
  near(s1.detourKm, 2 * s1.offKm, 1e-12); near(s1.offKm, 1, 0.005);
  near(s1.fillCost, 1.659 * 40 + s1.detourKm * 6 / 100 * 1.659, 1e-9);
  assert.strictEqual(res[1].fillCost, null); assert.strictEqual(res[2].fillCost, null); assert.strictEqual(res[3].fillCost, null);
  near(res[4].fillCost, 1.599 * 40, 1e-9);
  assert.strictEqual(s1.e5, 1.9, "Originalfelder bleiben erhalten");
});
test("Dedupe nach id (Preis gewinnt), ohne id nach Koordinate", () => {
  const input = [
    { id: "x", lat: 48.5, lng: 9.2, e5: null, src: "a" },
    { id: "x", lat: 48.5, lng: 9.2, e5: 1.75, src: "b" },
    { id: "x", lat: 48.5, lng: 9.2, e5: 1.70, src: "c" },
    { id: "y", lat: 48.5, lng: 9.3, e5: 1.80, src: "d" },
    { id: "y", lat: 48.5, lng: 9.3, e5: 1.60, src: "e" },
    { lat: 48.5, lng: 9.4, e5: 1.9 }, { lat: 48.5, lng: 9.4, e5: 1.9 },
    { id: "p", lat: 48.5, lng: 9.5 }, { id: "q", lat: 48.5, lng: 9.5 },
  ];
  const before = JSON.stringify(input);
  const res = G.stationsAlongRoute(SIX, input);
  assert.strictEqual(res.length, 5);
  assert.strictEqual(res.find((s) => s.id === "x").src, "b", "erstes Duplikat mit Preis");
  assert.strictEqual(res.find((s) => s.id === "y").src, "d", "erstes gewinnt, wenn beide Preis haben");
  assert.strictEqual(res.filter((s) => s.id === undefined).length, 1);
  assert.deepStrictEqual(res.filter((s) => s.id === "p" || s.id === "q").map((s) => s.id), ["p", "q"]);
  assert.strictEqual(JSON.stringify(input), before, "Eingabe unverändert");
});
test("bestPicks: cheapest vs. bestValue, Gleichstand → früher, ohne Preis ignoriert", () => {
  const [fa, fb] = dest(48.5, 9.2, 0, 1.9); // günstig, aber weit ab
  const list = G.stationsAlongRoute(SIX, [
    { id: "far-cheap", lat: fa, lng: fb, e5: 1.699, open: true },
    { id: "on-route", lat: 48.5, lng: 9.6, e5: 1.709, open: true },
    { id: "tie-late", lat: 48.5, lng: 9.8, e5: 1.709, open: true },
    { id: "noprice", lat: 48.5, lng: 9.1, e5: null },
    { id: "closed", lat: 48.5, lng: 9.05, e5: 1.5, open: false },
  ]);
  let p = G.bestPicks(list, "e5");
  assert.strictEqual(p.cheapest.id, "closed");
  p = G.bestPicks(list, "e5", { openOnly: true });
  assert.strictEqual(p.cheapest.id, "far-cheap");
  // far-cheap: 1,699·(50 + 2·1,9·1,3·0,07) ≈ 85,54; on-route: 1,709·50 = 85,45
  assert.strictEqual(p.bestValue.id, "on-route");
  // Gleichstand: zwei Stationen mit gleichem Preis/fillCost → früher entlang der Route
  const tie = G.bestPicks([
    { id: "late", e5: 1.7, fillCost: 85, alongKm: 50 },
    { id: "early", e5: 1.7, fillCost: 85, alongKm: 10 },
    { id: "np", e5: false, fillCost: null, alongKm: 0 },
  ], "e5");
  assert.strictEqual(tie.cheapest.id, "early"); assert.strictEqual(tie.bestValue.id, "early");
  assert.deepStrictEqual(G.bestPicks([], "e5"), { cheapest: null, bestValue: null });
  assert.deepStrictEqual(G.bestPicks([{ id: 1, e5: null, fillCost: null }], "e5"), { cheapest: null, bestValue: null });
  assert.strictEqual(G.bestPicks(list, "diesel").cheapest, null, "kein Dieselpreis");
});

/* ---------- samplePoints ---------- */
function checkCoverage(ix, pts, opts, label) {
  const r = opts.radiusKm, c = opts.corridorKm;
  const sp = G.samplePoints(ix, opts);
  assert.deepStrictEqual(sp[0], [ix.lat[0], ix.lng[0]], "Start enthalten");
  assert.deepStrictEqual(sp.at(-1), [ix.lat[ix.n - 1], ix.lng[ix.n - 1]], "Ziel enthalten");
  const minD = (la, lg) => { let m = Infinity; for (const q of sp) m = Math.min(m, hav(la, lg, q[0], q[1])); return m; };
  let worstV = 0;
  for (let i = 0; i < ix.n; i++) {
    const d = minD(ix.lat[i], ix.lng[i]);
    worstV = Math.max(worstV, d);
    assert.ok(d <= r - c, `${label}: Vertex ${i} ${d.toFixed(2)} km > ${r - c}`);
  }
  const rr = rng(99);
  let worstC = 0;
  for (let k = 0; k < 4000; k++) {
    const q = G.routePointAt(ix, rr() * ix.totalKm);
    const [la, lg] = dest(q[0], q[1], rr() * 360, rr() * c);
    const d = minD(la, lg);
    worstC = Math.max(worstC, d);
    assert.ok(d <= r, `${label}: Korridorpunkt ${d.toFixed(2)} km > ${r}`);
  }
  console.log(`     ${label}: ${ix.totalKm.toFixed(1)} km → ${sp.length} Punkte; max Vertex→Mitte ${worstV.toFixed(2)} km (≤ ${r - c}), max Korridor→Mitte ${worstC.toFixed(2)} km (≤ ${r})`);
  return sp;
}
test("samplePoints: Abdeckung Stuttgart→Ulm (r 25, Korridor 2)", () => {
  checkCoverage(IX, PTS, { radiusKm: 25, corridorKm: 2 }, "Stgt→Ulm");
});
test("samplePoints: 300 km gerade Strecke → ~7–8 Punkte", () => {
  const [la, lg] = dest(48.0, 8.0, 60, 300);
  const ix = G.routeIndex(straightRoute(48.0, 8.0, la, lg, 3001));
  const sp = checkCoverage(ix, null, { radiusKm: 25, corridorKm: 2 }, "300 km gerade");
  assert.ok(sp.length >= 7 && sp.length <= 8, "Anzahl " + sp.length);
});
test("samplePoints: kurvige Zickzack-/Kehrtwende-Route, andere Radien, Kurzstrecke", () => {
  const zig = [];
  for (let k = 0; k <= 400; k++) { // 4-km-Zickzack-Mäander nach Osten + Schleife zurück
    const t = k / 400;
    zig.push([48.4 + 0.03 * Math.sin(t * 40 * Math.PI) + (t > 0.7 ? (t - 0.7) * 0.6 : 0), 8.6 + (t < 0.7 ? t : 1.4 - t) * 2]);
  }
  checkCoverage(G.routeIndex(zig), null, { radiusKm: 25, corridorKm: 2 }, "Zickzack");
  checkCoverage(G.routeIndex(zig), null, { radiusKm: 10, corridorKm: 1 }, "Zickzack r10/k1");
  const short = G.routeIndex(straightRoute(48.5, 9.0, 48.5, 9.05, 10));
  assert.strictEqual(G.samplePoints(short).length, 2, "Kurzstrecke: Start + Ziel");
  assert.strictEqual(G.samplePoints(G.routeIndex([[48.5, 9.0]])).length, 1, "Ein-Punkt-Route");
});
if (LONG) test("samplePoints: Abdeckung Langstrecke Freiburg→Hamburg", () => {
  const p = G.decodePolyline(LONG.routes[0].geometry);
  checkCoverage(G.routeIndex(p), p, { radiusKm: 25, corridorKm: 2 }, "FR→HH");
});

/* ---------- Gitter vs. Brute-Force, Performance ---------- */
function randomStations(ix, count, seed, maxOffKm) {
  const r = rng(seed), out = [];
  for (let k = 0; k < count; k++) {
    const q = G.routePointAt(ix, r() * ix.totalKm);
    const [la, lg] = dest(q[0], q[1], r() * 360, r() * maxOffKm);
    out.push({ id: "S" + k, brand: "X", lat: la, lng: lg, open: r() > 0.1, e5: r() > 0.05 ? +(1.6 + r() * 0.3).toFixed(3) : null, e10: 1.7, diesel: 1.6 });
  }
  return out;
}
test("Gitter liefert exakt dasselbe wie Brute-Force (2000 Stationen, cellKm 1 / 0,25 / 5)", () => {
  const st = randomStations(IX, 2000, 5, 8);
  const res = G.stationsAlongRoute(IX, st);
  const expected = [];
  for (const s of st) { const b = bruteSameMetric(IX, s.lat, s.lng); if (b.distKm <= 2) expected.push({ id: s.id, b }); }
  assert.strictEqual(res.length, expected.length, `Anzahl ${res.length} vs ${expected.length}`);
  const byId = new Map(res.map((s) => [s.id, s]));
  for (const e of expected) {
    const s = byId.get(e.id);
    assert.ok(s, "fehlt " + e.id);
    near(s.offKm, e.b.distKm, 1e-9); near(s.alongKm, e.b.alongKm, 1e-9);
  }
  for (const cellKm of [0.25, 5]) {
    const r2 = G.stationsAlongRoute(G.routeIndex(PTS, { cellKm }), st);
    assert.deepStrictEqual(r2.map((s) => s.id), res.map((s) => s.id), "cellKm " + cellKm);
  }
  // weit entfernte Punkte (Fallback-Pfad) = Brute-Force
  for (const [la, lg] of [[47.0, 7.0], [50.5, 12.0], [48.6, 9.6], [48.775786, 9.0]]) {
    const h = G.nearestOnRoute(IX, la, lg), b = bruteSameMetric(IX, la, lg);
    near(h.distKm, b.distKm, 1e-9); near(h.alongKm, b.alongKm, 1e-9);
  }
  console.log(`     ${res.length}/2000 im Korridor, identisch zur Brute-Force`);
});
function timeIt(fn, reps) { const t = []; let r; for (let k = 0; k < reps; k++) { const a = now(); r = fn(); t.push(now() - a); } t.sort((a, b) => a - b); return { first: null, med: t[Math.floor(t.length / 2)], min: t[0], r }; }
function perf(label, pts) {
  let a = now(); const ix = G.routeIndex(pts); const idxCold = now() - a;
  const idx = timeIt(() => G.routeIndex(pts), 7);
  const st = randomStations(ix, 2000, 11, 10);
  a = now(); const first = G.stationsAlongRoute(ix, st); const cold = now() - a;
  const warm = timeIt(() => G.stationsAlongRoute(ix, st), 9);
  a = now(); const sp = G.samplePoints(ix); const spMs = now() - a;
  a = now(); G.bestPicks(first, "e5"); const bpMs = now() - a;
  console.log(`     TIME ${label}: ${ix.n} Punkte, ${ix.totalKm.toFixed(0)} km | routeIndex erster ${idxCold.toFixed(2)} ms, median ${idx.med.toFixed(2)} ms | stationsAlongRoute(2000) erster ${cold.toFixed(2)} ms, median ${warm.med.toFixed(2)} ms (${first.length} im Korridor) | samplePoints ${spMs.toFixed(2)} ms (${sp.length}) | bestPicks ${bpMs.toFixed(3)} ms`);
  assert.ok(warm.med < 50, "stationsAlongRoute median " + warm.med);
  assert.ok(cold < 50, "stationsAlongRoute erster Aufruf " + cold);
  assert.ok(idx.med < 50, "routeIndex median " + idx.med);
}
test("Performance: 2000 Stationen nahe Stuttgart→Ulm", () => perf("Stgt→Ulm", PTS));
if (LONG) test("Performance: 2000 Stationen nahe Freiburg→Hamburg", () => perf("FR→HH", G.decodePolyline(LONG.routes[0].geometry)));
test("Performance: synthetische 800-km-Route mit 20 000 Stützpunkten", () => {
  const r = rng(3), pts = [[47.8, 7.7]];
  let brg = 30;
  for (let k = 1; k < 20000; k++) { brg += (r() - 0.5) * 6; const p = pts[k - 1]; pts.push(dest(p[0], p[1], brg, 0.04)); }
  perf("synthetisch 20k", pts);
});

test("Kaltstart in frischem Prozess (erster Aufruf inkl. JIT): FR→HH + 2000 Stationen", () => {
  if (!LONG) return;
  const code = `
    const G = require(${JSON.stringify(path.join(__dirname, "..", "js", "routegeo.js"))});
    const L = require(${JSON.stringify(path.join(__dirname, "fixture-long.json"))});
    const now = () => Number(process.hrtime.bigint()) / 1e6;
    let t = now(); const pts = G.decodePolyline(L.routes[0].geometry); const tDec = now() - t;
    t = now(); const ix = G.routeIndex(pts); const tIdx = now() - t;
    const st = []; let s = 1;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 2000; k++) { const q = G.routePointAt(ix, r() * ix.totalKm); st.push({ id: k, lat: q[0] + (r() - 0.5) * 0.12, lng: q[1] + (r() - 0.5) * 0.18, e5: 1.7 }); }
    t = now(); const res = G.stationsAlongRoute(ix, st); const tSt = now() - t;
    t = now(); const sp = G.samplePoints(ix); const tSp = now() - t;
    console.log(JSON.stringify({ tDec, tIdx, tSt, tSp, hits: res.length, sp: sp.length }));`;
  const out = JSON.parse(require("child_process").execFileSync(process.execPath, ["-e", code]).toString());
  console.log(`     TIME kalt: decodePolyline ${out.tDec.toFixed(2)} ms, routeIndex ${out.tIdx.toFixed(2)} ms, stationsAlongRoute(2000) ${out.tSt.toFixed(2)} ms (${out.hits} im Korridor), samplePoints ${out.tSp.toFixed(2)} ms`);
  assert.ok(out.tSt < 50, "stationsAlongRoute kalt " + out.tSt);
});
test("Browser-Tauglichkeit: als klassisches Script ladbar, keine Namenskollision mit der App", () => {
  const fs = require("fs"), vm = require("vm");
  const src = fs.readFileSync(path.join(__dirname, "..", "js", "routegeo.js"), "utf8");
  const ctx = vm.createContext({ Math, Number, Object, Array, Map, Float64Array, Int32Array, Error, Infinity, NaN });
  vm.runInContext(src, ctx, { filename: "routegeo.js" });
  for (const f of ["decodePolyline", "routeIndex", "nearestOnRoute", "stationsAlongRoute", "samplePoints", "bestPicks", "routePointAt"]) {
    assert.strictEqual(vm.runInContext("typeof " + f, ctx), "function", f + " global");
  }
  assert.strictEqual(vm.runInContext("typeof module", ctx), "undefined");
  const mine = [...src.matchAll(/^(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
  const appDir = path.join(__dirname, "..", "js");
  if (fs.existsSync(appDir)) {
    const theirs = new Set();
    for (const f of fs.readdirSync(appDir).filter((f) => f.endsWith(".js") && f !== "routegeo.js")) {
      for (const m of fs.readFileSync(path.join(appDir, f), "utf8").matchAll(/^(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)) theirs.add(m[1]);
    }
    const clash = mine.filter((n) => theirs.has(n));
    assert.deepStrictEqual(clash, [], "Kollision mit App-Globals");
    console.log(`     ${mine.length} Top-Level-Namen, ${theirs.size} App-Globals, keine Kollision`);
  }
});

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
process.exitCode = fail ? 1 : 0;
