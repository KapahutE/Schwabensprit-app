// Browser-Tests (Playwright, Chromium, iPhone-Größe) mit festen Testdaten und nachgestellten Diensten: node tests/e2e.js
// Env: LEAFLET_DIR = lokale Kopie von leaflet@1.9.4/dist (sonst wird unpkg wirklich abgerufen)
"use strict";
const { check, done, fixture, playwright, serve, ROOT } = require("./lib.js");
const fs = require("fs"), path = require("path");
const hv = (a, b, c, d) => { const p = Math.PI / 180, x = Math.sin((c - a) * p / 2) ** 2 + Math.cos(a * p) * Math.cos(c * p) * Math.sin((d - b) * p / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const { chromium, devices } = playwright(), srv = await serve(), browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], timezoneId: "Europe/Berlin", locale: "de-DE", serviceWorkers: "allow" });
  const bases = fixture("bases.json"), latest = fixture("latest-H.json"), EVL = fixture("ev-locations.json"), EVT = fixture("ev-tariffs.json"), OSRM = JSON.stringify(fixture("route-stgt-ulm.json"));
  const state = { offline: false, loc: 0, csp: [] };
  const H = { "access-control-allow-origin": "*" }, J = { ...H, "content-type": "application/json" };
  await ctx.route(/api\.github\.com/, async (r) => {
    if (state.offline) return r.abort("internetdisconnected");
    const u = r.request().url(), m = u.match(/contents\/docs\/(.*?)\?/);
    if (!m) return r.fulfill({ status: 200, headers: J, body: JSON.stringify({ workflow_runs: [] }) });
    const f = { "data/bases.json": bases, "data/H/latest.json": latest, "data/H/reports.json": [] }[m[1]];
    f ? r.fulfill({ status: 200, headers: J, body: JSON.stringify(f) }) : r.fulfill({ status: 404, headers: H, body: "{}" });
  });
  await ctx.route(/api\.mobidata-bw\.de/, (r) => {
    if (state.offline) return r.abort("internetdisconnected");
    const u = new URL(r.request().url());
    if (u.pathname.endsWith("/v1/locations")) {
      state.loc++;
      const q = u.searchParams, now = new Date().toISOString();
      // EnBW-Standorte melden frisch (Belegung zählt), alle anderen mit alter Zeitangabe
      const items = JSON.parse(JSON.stringify(EVL.items)).filter((x) => hv(+q.get("lat"), +q.get("lon"), x.coordinates.lat, x.coordinates.lon) <= +q.get("radius") / 1000)
        .map((x) => { if (x.source === "datex2_enbw") x.evses.forEach((e, i) => { e.status = i % 2 ? "CHARGING" : "AVAILABLE"; e.status_last_updated = now; }); return x; });
      items.push({ ...JSON.parse(JSON.stringify(EVL.items.find((x) => x.source === "bnetza_api"))), id: "990001", country: "CHE", source: "opendata_swiss", operator: { name: "Swiss Test AG" }, coordinates: { latitude: 48.7, longitude: 9.15, lat: 48.7, lon: 9.15 } });
      return r.fulfill({ status: 200, headers: J, body: JSON.stringify({ items, total_count: items.length, next_offset: null }) });
    }
    if (u.pathname.endsWith("/tariffs")) return r.fulfill({ status: 200, headers: J, body: JSON.stringify({ items: +u.searchParams.get("offset") ? [] : EVT.items, total_count: EVT.items.length }) });
    r.fulfill({ status: 404, headers: J, body: "{}" });
  });
  await ctx.route(/routing\.openstreetmap\.de/, (r) => r.request().url().includes("/table/") ? r.fulfill({ status: 500, body: "" }) : r.fulfill({ status: 200, headers: J, body: OSRM }));
  await ctx.route(/google\.com\/s2|tile\.openstreetmap|e-control|tankerkoenig|nominatim|valhalla/, (r) => r.fulfill({ status: 404, body: "" }));
  if (process.env.LEAFLET_DIR) await ctx.route(/unpkg\.com\/leaflet@1\.9\.4\/dist\/(.*)/, (r) => r.fulfill({ path: path.join(process.env.LEAFLET_DIR, r.request().url().split("/dist/")[1].split("?")[0]) }));
  await ctx.addInitScript(() => {
    if (sessionStorage.getItem("i")) return; sessionStorage.setItem("i", 1);
    localStorage.setItem("token", "test-token"); localStorage.setItem("repo", "test/tankpreise"); localStorage.setItem("dataMode", "api");
    localStorage.setItem("loc", JSON.stringify({ mode: "base", baseId: "H" })); localStorage.setItem("tab", "preise"); localStorage.removeItem("ev");
    localStorage.setItem("rtA", JSON.stringify({ kind: "base", baseId: "H", label: "Base H · Leinfelden" }));
    localStorage.setItem("rtB", JSON.stringify({ kind: "place", lat: 48.4011, lng: 9.9876, label: "Ulm", sub: "" }));
  });
  const p = await ctx.newPage(), errs = [], dlg = []; let answer = true;
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) state.csp.push(m.text().slice(0, 160)); });
  p.on("dialog", (d) => { dlg.push(d.message()); answer ? d.accept() : d.dismiss(); });
  const tx = async (s) => { const e = await p.$(s); return e ? (await e.innerText()).replace(/\s+/g, " ").trim() : ""; };
  const n = (s) => p.$$eval(s, (a) => a.length);
  const T = { timeout: 25000 };
  try {
    // ---- Preise (Kraftstoff)
    await p.goto(srv.url); await p.waitForSelector("#main .hero .price", T);
    check("Preise: Startseite zeigt günstigste Tankstelle und Liste", (await n("#main .list .item")) >= 5 && /€/.test(await tx("#main .hero")));
    check("Navigation: vier Bereiche und Umschalter (E5, E10, Diesel, ⚡ Strom)", (await n("#tabbar button")) === 4 && (await n("#seg button")) === 4);
    await p.click("#seg [data-f=diesel]"); await p.waitForTimeout(200);
    check("Preise: Sortenwechsel auf Diesel", /DIESEL/.test(await tx("#main .hero .eyebrow")));
    await p.click("#btnSettings"); await p.fill("#inRepo", "test/tankpreise"); await p.fill("#inToken", "test-token"); await p.keyboard.press("Enter"); await p.waitForTimeout(300);
    check("Einstellungen: Eingabetaste speichert (statt abzubrechen)", await p.evaluate(() => localStorage.getItem("token")) === "test-token" && !(await p.evaluate(() => document.querySelector("#dlg").open)));
    await p.waitForSelector("#main .hero .price", T);

    // ---- E-Modus
    await p.click("#seg [data-f=ev]"); await p.waitForSelector("#evBody .list .rtitem", T);
    check("E-Modus: ⚡ Strom aktiv, Ladestationen mit Preis in €/kWh", /Strom/.test(await tx("#seg .on")) && /€\/kWh/.test(await tx("#evBody .hero")) && (await n("#evBody .rtitem")) >= 5);
    check("E-Modus: Ladedaten ohne GitHub-Preisdaten, genau eine Umkreissuche", state.loc === 1, state.loc);
    check("E-Modus: Belegung – frische Meldung „frei“, alte „nicht aktuell“", await p.evaluate(() => { const r = Strom.rows().all; return r.some((v) => v.known && v.free > 0) && r.some((v) => v.stale); }));
    await p.click("[data-evkw='50']");
    check("E-Modus: Filter ≥ 50 kW zeigt nur Schnelllader", (await n("#evBody .rtitem")) > 0 && await p.$$eval("#evBody .rtitem .addr", (a) => a.filter((x) => /kW/.test(x.textContent)).every((x) => +x.textContent.match(/(\d+(?:,\d)?) kW/)[1].replace(",", ".") >= 50)));
    await p.click("[data-evkw='0']"); await p.click("[data-evsort='dist']");
    check("E-Modus: Sortierung nach Entfernung", (await n("#evBody .rtitem")) > 0);
    await p.click("[data-evsort='price']");
    await p.click("#evBody .rtitem:has(.p b) .item >> nth=0"); await p.waitForTimeout(200);
    check("E-Modus: Details mit Anschlüssen, Betreiber und Navigation", (await n("#evBody .rtdet .evgrp")) >= 1 && /Betreiber/.test(await tx("#evBody .rtdet")) && (await n("#evBody .rtdet a[href*='google.com/maps']")) === 1);
    await p.click("#evBody .rtdet [data-evfav]"); await p.waitForTimeout(250);
    check("Favorit: Abschnitt „Meine Ladestationen“, gespeichert", /Meine Ladestationa|Meine Ladestationen/.test(await tx("#evBody .sec h2")) && await p.evaluate(() => JSON.parse(localStorage.getItem("evFavs")).length) === 1);
    check("Schweiz: „keine Preise in diesem Land“ und Hinweis", await p.evaluate(() => Strom.S.stations.some((s) => s.country === "CHE")) && /Außerhalb Deutschlands/.test(await tx("#evBody")));
    await p.click("#evBody [data-evview='map']"); await p.waitForSelector("#evmap .leaflet-marker-icon", { state: "attached", ...T }); check("E-Modus: Karte mit Preisschildern", (await n("#evmap .pin")) >= 1); await p.click("#evBody [data-evview='list']");
    await p.click("#tabbar [data-tab=verlauf]"); await p.waitForTimeout(200);
    check("E-Modus: Verlauf zeigt Hinweis", /nur für Kraftstoff|Verlauf gibt/.test(await tx("#main")));
    await p.click("#tabbar [data-tab=preise]"); await p.waitForSelector("#evBody .list .rtitem", T);

    // ---- Meine Ladekarte: Eingabeprüfung
    await p.click("[data-cardopen]"); await p.waitForSelector("#dlgCard[open]"); await p.click("[data-card=new]");
    const fill = async (name, ac, dc, hpc = "") => { await p.fill("#cdName", name); await p.fill("#cdAc", ac); await p.fill("#cdDc", dc); await p.fill("#cdHpc", hpc); };
    await fill("", "abc", "0,59"); await p.click("[data-card=save]");
    check("Karte: leerer Name / Text als Preis → Fehler, keine Rückfrage", (await tx("#cdMsg")).includes("Namen") && (await tx("#cdMsg")).includes("Zahl") && dlg.length === 0);
    await fill("T", "5", "0,59"); await p.click("[data-card=save]"); check("Karte: 5 €/kWh nicht möglich", /nicht möglich/.test(await tx("#cdMsg")));
    answer = false; await fill("Meine Karte", "0,60", "0,40"); await p.click("[data-card=save]");
    check("Karte: Warnung (DC < AC) mit Zusammenfassung; abgelehnt → nichts gespeichert", /günstiger als AC/.test(dlg.at(-1)) && /Das wird gespeichert/.test(dlg.at(-1)) && (await n(".cardrow")) === 0);
    answer = true; await fill("Meine Karte", "0,49", "0,59", "0,69"); await p.click("[data-card=save]"); await p.waitForTimeout(200);
    check("Karte: gültige Eingabe nach Bestätigung gespeichert, „bestätigt heute“", (await n(".cardrow")) === 1 && /bestätigt heute/.test(await tx(".cardrow")));
    await p.click("#btnCardClose"); await p.waitForTimeout(400);
    check("Karte: 💳-Preise erscheinen (Eigeneingabe) und Auswahl Beste/Direkt/Karte", (await n("#evBody .p .d")) > 0 && (await p.$$eval("#evBody .p .d", (a) => a.some((x) => /💳/.test(x.textContent)))) && (await n("[data-evbasis]")) === 3);
    await p.click("[data-evbasis=direct]"); check("Karte: Basis „Direkt“ blendet 💳 aus", !(await p.$$eval("#evBody .p .d", (a) => a.some((x) => /💳/.test(x.textContent))))); await p.click("[data-evbasis=best]");
    // laufende Prüfung
    for (const [days, expect] of [[35, /Stimmen die Preise/], [70, /nicht mehr angewendet/]]) {
      await p.evaluate((d) => { const c = JSON.parse(localStorage.getItem("evCards")); c[0].at = new Date(Date.now() - d * 864e5).toISOString(); localStorage.setItem("evCards", JSON.stringify(c)); }, days);
      await p.reload(); await p.waitForSelector("#evBody .list .rtitem", T); await p.waitForTimeout(300);
      const cardRows = await p.$$eval("#evBody .p .d", (a) => a.filter((x) => /💳/.test(x.textContent)).length);
      check(`Karte: ${days} Tage nicht bestätigt → Hinweis${days > 60 ? ", Karte wird nicht mehr angewendet" : ", Karte noch angewendet"}`, expect.test(await tx("#evBody .warnbox")) && (days > 60 ? cardRows === 0 : cardRows > 0), await tx("#evBody .warnbox"));
    }
    answer = false; await p.click("[data-cardok]"); check("Karte: „Stimmt noch“ zeigt die Werte; abgebrochen → Hinweis bleibt", /AC 0,49/.test(dlg.at(-1)) && (await n("#evBody .warnbox")) === 1);
    answer = true; await p.click("[data-cardok]"); await p.waitForTimeout(300); check("Karte: bestätigt → Hinweis weg, Karte wieder angewendet", (await n("#evBody .warnbox")) === 0 && (await n("#evBody .p .d")) > 0);
    // Abgleich: absurd teure Karte
    await p.click("[data-cardopen]"); await p.click("[data-card=edit]"); await fill("Meine Karte", "1,40", "1,45"); await p.click("[data-card=save]"); await p.click("#btnCardClose"); await p.waitForTimeout(300);
    check("Karte: teurer als Direktzahlung an vielen Stationen → Hinweis „Eingaben prüfen“", /teurer als Direktzahlung/.test(await tx("#evBody .warnbox")));
    await p.click("[data-cardopen]"); await p.click("[data-card=del]"); await p.click("#btnCardClose"); await p.waitForTimeout(200);

    // ---- Route (E-Modus und Kraftstoff)
    await p.click("#tabbar [data-tab=route]"); await p.waitForSelector("#rtBody [data-rtgo]", T); await p.click("#rtBody [data-rtgo]"); await p.waitForSelector("#rtBody .rtlist .rtitem", T);
    await p.waitForFunction(() => !document.querySelector("#rtBody .spin-dot"), null, T);
    check("Route (E-Modus): Ladestationen an der Strecke", /STROM/.test(await tx(".rtsum")) && (await n("#rtBody .rtlist .rtitem")) >= 1);
    await p.click("#seg [data-f=e5]"); await p.waitForSelector("#rtBody .rthero", T);
    check("Route (Kraftstoff): Tankstellen an der Strecke", !/STROM/.test(await tx(".rtsum")) && (await n("#rtBody .rtlist .rtitem")) >= 1);
    await p.click("#seg [data-f=ev]"); await p.click("#tabbar [data-tab=preise]"); await p.waitForSelector("#evBody .list .rtitem", T);

    // ---- Spritbüchle
    await p.click("#tabbar [data-tab=tankbuch]"); await p.waitForTimeout(300);
    check("Spritbüchle: Bereich öffnet, Formular „Erfassen“", await p.$("#btnTbManual") !== null);
    await p.click("#btnTbManual"); await p.waitForTimeout(300); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
    check("Spritbüchle: Eingabetaste schließt das Formular nicht", await p.evaluate(() => document.querySelector("#dlgTb").open)); await p.click("#btnTbCancel");
    await p.click("#tabbar [data-tab=preise]");

    // ---- Belegleser (Tesseract, WebAssembly)
    const ocr = await p.evaluate(async () => {
      const c = document.createElement("canvas"); c.width = 900; c.height = 700; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 900, 700); x.fillStyle = "#000"; x.font = "bold 46px monospace";
      ["ARAL Tankstelle", "72555 Metzingen", "Super E10  40,00 l", "x 1,999 EUR/l", "SUMME EUR  79,96", "10.10.2026 10:31"].forEach((t, i) => x.fillText(t, 40, 90 + i * 100));
      const blob = await new Promise((res) => c.toBlob(res, "image/png")); return parseReceipt(await readReceipt(new File([blob], "r.png", { type: "image/png" })));
    });
    check("Belegleser: liest Testbeleg (Menge, Preis, Betrag, Datum, Uhrzeit)", ocr.liters === 40 && ocr.ppl === 1.999 && ocr.total === 79.96 && ocr.date === "2026-10-10" && ocr.time === "10:31", ocr);

    // ---- Sicherheit und Bedienbarkeit
    check("CSP: keine Verstöße in allen Abläufen", state.csp.length === 0, state.csp);
    check("CSP: Inline-Skript wird blockiert", await p.evaluate(() => { window.__x = 0; const s = document.createElement("script"); s.textContent = "window.__x = 1"; document.head.append(s); return window.__x === 0; }));
    const small = await p.evaluate(() => [...document.querySelectorAll(".chip, #seg button, .iconx, .iconbtn, #tabbar button")].filter((e) => e.offsetParent).map((e) => {
      const r = e.getBoundingClientRect(), a = getComputedStyle(e, "::after"), ext = a.content !== "none" && a.position === "absolute" ? Math.max(0, -parseFloat(a.top) || 0) + Math.max(0, -parseFloat(a.bottom) || 0) : 0;
      return { t: (e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 14), h: Math.round(r.height + ext) };
    }).filter((x) => x.h < 44));
    check("Bedienbarkeit: Tippflächen mindestens 44 px", small.length === 0, small);

    // ---- Service Worker: Offline-Start
    await p.evaluate(() => navigator.serviceWorker.ready); await p.reload(); await p.waitForSelector("#evBody .list .rtitem", T); await p.waitForTimeout(800);
    await p.click("#seg [data-f=e5]"); await p.waitForSelector("#main .hero .price", T); await p.reload(); await p.waitForSelector("#main .hero .price", T); await p.waitForTimeout(800);
    state.offline = true; await ctx.setOffline(true);
    await p.reload(); await p.waitForSelector("#main .hero .price", T); await p.waitForTimeout(600);
    check("Offline: App startet ohne Netz und zeigt den gespeicherten Stand", /Gespeichert/.test(await tx("#stand")) && (await n("#main .list .item")) >= 5, await tx("#stand"));
    await p.click("#seg [data-f=ev]"); await p.waitForSelector("#evBody .list .rtitem", T);
    check("Offline: E-Modus zeigt die zuletzt geladenen Ladestationen", (await n("#evBody .rtitem")) >= 5 && /Gespeichert|Kein Netz/.test((await tx("#stand")) + (await tx("#evBody"))));
    state.offline = false; await ctx.setOffline(false);
  } catch (e) { check("Ablauf ohne Ausnahme", false, e.message.split("\n").slice(0, 3).join(" | ")); }
  check("Keine Skriptfehler im Browser", errs.filter((e) => !/ERR_/.test(e)).length === 0, errs);
  await browser.close(); srv.close();
  done("Browser-Tests");
})();
