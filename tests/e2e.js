// Browser-Tests (Playwright, Chromium, Handy-Größe) mit festen Testdaten und nachgestellten Diensten: node tests/e2e.js
// Env: DEVICE = Gerät aus Playwright (Standard "iPhone 13"; "Pixel 7" für Android)
//      LEAFLET_DIR = lokale Kopie von leaflet@1.9.4/dist (sonst wird unpkg wirklich abgerufen)
"use strict";
const { check, done, fixture, playwright, serve } = require("./lib.js");
const fs = require("fs"), path = require("path");
const hv = (a, b, c, d) => { const p = Math.PI / 180, x = Math.sin((c - a) * p / 2) ** 2 + Math.cos(a * p) * Math.cos(c * p) * Math.sin((d - b) * p / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const { chromium, devices } = playwright(), srv = await serve(), browser = await chromium.launch();
  const DEVICE = process.env.DEVICE || "iPhone 13", ANDROID = /Android/.test(devices[DEVICE].userAgent);
  const ctx = await browser.newContext({ ...devices[DEVICE], timezoneId: "Europe/Berlin", locale: "de-DE", serviceWorkers: "allow" });
  const bases = fixture("bases.json"), latest = fixture("latest-H.json"), EVL = fixture("ev-locations.json"), EVT = fixture("ev-tariffs.json"), OSRM = JSON.stringify(fixture("route-stgt-ulm.json"));
  const state = { offline: false, loc: 0, csp: [], updMin: 5, delay: 0, fail: false };
  const stamp = (min) => new Date(Date.now() - min * 60000).toLocaleString("sv-SE", { timeZone: "Europe/Berlin" }).replace(" ", "T");   // wie „updated“ in den Daten (Berliner Zeit)
  const H = { "access-control-allow-origin": "*" }, J = { ...H, "content-type": "application/json" };
  await ctx.route(/api\.github\.com/, async (r) => {
    if (state.offline) return r.abort("internetdisconnected");
    const u = r.request().url(), m = u.match(/contents\/docs\/(.*?)\?/);
    if (!m) return r.fulfill({ status: 200, headers: J, body: JSON.stringify({ workflow_runs: [] }) });
    if (m[1] === "data/H/latest.json") { if (state.fail) return r.fulfill({ status: 500, headers: H, body: "{}" }); if (state.delay) await sleep(state.delay); }
    const f = { "data/bases.json": bases, "data/H/latest.json": { ...latest, updated: stamp(state.updMin) }, "data/H/reports.json": [] }[m[1]];
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
    try { if (sessionStorage.getItem("i")) return; sessionStorage.setItem("i", 1); } catch { return; }   // im abgeschotteten Berichtsrahmen gibt es keinen Speicher
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

    // ---- Eine Karte statt zwei: „Mit Hin- und Rückfahrt besser“ als Zeile in der Karte „Günstigste“
    const alt = await p.evaluate(() => ({ cards: document.querySelectorAll("#main .hero").length, second: document.querySelectorAll("#main .valuecard").length, row: document.querySelector("#main .hero .alt")?.innerText.replace(/\s+/g, " ") ?? null }));
    check("Preise: keine zweite Karte „Lohnt sich am meisten“, Hinweis höchstens als Zeile in der Karte", alt.cards === 1 && alt.second === 0 && (alt.row === null || /Rückfahrt besser/.test(alt.row) && /−[\d,]+ €/.test(alt.row)), alt);
    if (alt.row) { await p.click("#main .hero .alt"); await p.waitForSelector("#detail.open"); check("Preise: Zeile „besser mit Anfahrt“ öffnet die Details dieser Tankstelle", /\S/.test(await tx("#detailBody")) ); await p.click("#btnBack"); await p.waitForTimeout(350); }

    // ---- Füllstand (Sprit): Auswahl neben dem Ort, nötige Menge statt voller Tankgröße
    {
      const sv = () => p.evaluate(() => document.querySelector("#main .hero .save")?.innerText.replace(/\s+/g, " ") ?? ""), eur = (t) => parseFloat(t.match(/([\d.]+,\d\d) €/)?.[1].replace(".", "").replace(",", ".")), pick = async (k) => { await p.click("#btnLevel"); await p.waitForSelector("#dlgLevel[open]"); await p.click(`[data-lvlk="${k}"]`); await p.waitForTimeout(250); };
      const s0 = await sv();
      check("Füllstand: Knopf neben dem Ort, ohne Auswahl „–“ und Ersparnis für die volle Tankgröße (wie bisher)", await p.isVisible("#btnLevel") && (await tx("#lvlLabel")) === "–" && /bei 50 l ggü\. Ø/.test(s0), s0);
      await pick("0.5"); const s5 = await sv();
      check("Füllstand: ½ → Ersparnis für 25 l, etwa halb so hoch, Beschriftung nennt Menge und Stand", (await tx("#lvlLabel")) === "½" && /bei 25 l \(½\) ggü\. Ø/.test(s5) && Math.abs(eur(s5) * 2 - eur(s0)) <= 0.03, [s0, s5]);
      check("Füllstand: Auswahl bleibt gespeichert (3 Tage)", await p.evaluate(() => { const x = JSON.parse(localStorage.getItem("lvl")); return x.k === "0.5" && Date.now() - x.at < 5000; }));
      await pick("res"); const sr = await sv();
      check("Füllstand: Reserve → 46,5 l nachtanken, Ersparnis etwa wie bei leerem Tank", /bei 46,5 l \(Reserve\) ggü\. Ø/.test(sr) && Math.abs(eur(sr) - eur(s0) * 46.5 / 50) <= 0.03, [s0, sr]);
      await pick("0.75"); const s7 = await sv();
      check("Füllstand: ¾ → Ersparnis nur für 12,5 l", /bei 12,5 l \(¾\) ggü\. Ø/.test(s7) && eur(s7) < eur(s5), [s5, s7]);
      // kleiner Tank, hoher Verbrauch: bei ¼ reichen nur ≈ 4 km → weiter entfernte Tankstellen sind „außer Reichweite“
      await p.evaluate(() => { localStorage.setItem("tank", "5"); localStorage.setItem("cons", "30"); }); await pick("0.25");
      const farP = await p.$$eval("#main .list .item", (a) => a.filter((x) => /net erreichbar|außer Reichweite/.test(x.textContent)).length), heroP = await tx("#main .hero, #main .empty");
      check("Füllstand: Tankstellen außerhalb 90 % der Reichweite sind markiert und nie die „Günstigste“", farP >= 1 && !/net erreichbar|außer Reichweite/.test(heroP), { farP, heroP: heroP.slice(0, 160) });
      await p.evaluate(() => { localStorage.removeItem("tank"); localStorage.removeItem("cons"); });
      await pick("0.5");
      check("Füllstand: Tank-Rat und Details rechnen mit der gewählten Menge (25 l)", /25 l/.test(await tx("#main")), (await tx("#main")).slice(0, 300));
      await pick("");
      check("Füllstand: „Nicht angeben“ → wie bisher (volle Tankgröße)", (await tx("#lvlLabel")) === "–" && /bei 50 l ggü\. Ø/.test(await sv()) && await p.evaluate(() => localStorage.getItem("lvl")) === "null");
    }

    // ---- Regeladresse und Ortswahl am Start
    {
      const pl = await ctx.newPage(), pe = [];
      pl.on("pageerror", (e) => pe.push(e.message));
      await pl.route(/nominatim\.openstreetmap\.org/, (r) => {
        const ulm = /ulm/i.test(new URL(r.request().url()).searchParams.get("q"));
        r.fulfill({ status: 200, headers: J, body: JSON.stringify([ulm ? { lat: "48.4011", lon: "9.9876", display_name: "Ulm, Baden-Württemberg, Deutschland", address: { country_code: "de" } }
          : { lat: "48.6946", lon: "9.2108", display_name: "Marktplatz, Filderstadt, Landkreis Esslingen, Baden-Württemberg, Deutschland", address: { country_code: "de" } }]) });
      });
      const chip = () => pl.evaluate(() => document.querySelector("#locLabel").innerText.replace(/\s+/g, " ")), ls = (k) => pl.evaluate((k) => JSON.parse(localStorage.getItem(k)), k);
      const orig = await p.evaluate(() => localStorage.getItem("home"));
      await pl.goto(srv.url); await pl.waitForSelector("#main .hero .price", T);
      check("Regeladresse: die bisherige Base wurde einmalig zur Regeladresse, die App startet darauf (ohne Ortswahl)", (await ls("home"))?.label === "Base H · Leinfelden" && (await ls("loc")).mode === "home" && /^Base H · Leinfelden · \d+ km$/.test(await chip()) && !(await pl.evaluate(() => document.querySelector("#dlgLoc").open)), [await ls("home"), await chip()]);
      await pl.click("#btnLoc"); await pl.waitForSelector("#dlgLoc[open]");
      const d = await pl.evaluate(() => ({ bases: !!document.querySelector("#locBases, [data-base]"), gps: !!document.querySelector("#optGps"), home: !document.querySelector("#optHome").hidden, name: document.querySelector("#homeName").innerText, hint: document.querySelector("#locHint").hidden, set: document.querySelector("#btnSetHome").hidden, ph: document.querySelector("#inSearch").placeholder }));
      check("Ortswahl: Aktueller Standort, Regeladresse und Adresseingabe – keine Liste von Bases", !d.bases && d.gps && d.home && d.name === "Base H · Leinfelden" && d.hint && d.set && /Adresse/.test(d.ph), d);
      await ctx.grantPermissions(["geolocation"], { origin: new URL(srv.url).origin }); await ctx.setGeolocation({ latitude: 48.5367, longitude: 9.2857 });
      await pl.click("#optGps"); await pl.waitForFunction(() => document.querySelector("#optGps").classList.contains("on")); await ctx.clearPermissions();
      const g = await ls("loc");
      check("Ortswahl: Aktueller Standort wird nur auf ca. 100 m gerundet gespeichert; „Als Regeladresse merken“ erscheint", g.mode === "gps" && g.lat === 48.537 && g.lng === 9.286 && !(await pl.evaluate(() => document.querySelector("#btnSetHome").hidden)), g);
      await pl.fill("#inSearch", "Marktplatz Filderstadt"); await pl.click("#searchForm button"); await pl.waitForSelector("[data-hit]"); await pl.click('[data-hit="0"]');
      const w = await pl.evaluate(() => ({ loc: JSON.parse(localStorage.getItem("loc")), recent: JSON.parse(localStorage.getItem("recentPlaces")).map((x) => x.label), home: JSON.parse(localStorage.getItem("home")).label, hint: document.querySelector("#radiusHint").innerText }));
      check("Ortswahl: manuell eingegebene Adresse wird gewählt und unter „Zuletzt benutzt“ gemerkt, Regeladresse bleibt", w.loc.mode === "place" && w.loc.label === "Marktplatz, Filderstadt" && w.recent[0] === "Marktplatz, Filderstadt" && w.home === "Base H · Leinfelden" && (await pl.$$eval("#locRecent .opt", (a) => a.length)) === 1, w);
      check("Ortswahl: Hinweis zum nutzbaren Radius (Daten vollständig bis ≈ x km)", /≈ \d+ km/.test(w.hint), w.hint);
      await pl.click("#btnSetHome"); await pl.waitForTimeout(150); await pl.click("#btnLocDone");
      await pl.waitForFunction(() => /Filderstadt/.test(document.querySelector("#locLabel").innerText)); await pl.waitForSelector("#main .hero .price", T);
      check("Regeladresse: „Als Regeladresse merken“ speichert lokal und die App zeigt sie", (await ls("home")).label === "Marktplatz, Filderstadt" && (await ls("loc")).mode === "home" && /^Marktplatz, Filderstadt · \d+ km$/.test(await chip()), [await ls("home"), await chip()]);
      // Einstellungen: suchen, Eingabetaste sucht (speichert nicht), Abbrechen verwirft, Speichern übernimmt
      await pl.click("#btnSettings"); await pl.waitForSelector("#dlg[open]");
      check("Einstellungen: Regeladresse wird angezeigt", (await pl.innerText("#homeNow")) === "Marktplatz, Filderstadt" && !(await pl.evaluate(() => document.querySelector("#btnHomeClear").hidden)));
      await pl.fill("#inHomeQ", "Ulm"); await pl.press("#inHomeQ", "Enter"); await pl.waitForSelector("[data-homehit]");
      check("Einstellungen: Eingabetaste im Adressfeld sucht, statt die Einstellungen zu speichern", await pl.evaluate(() => document.querySelector("#dlg").open) && (await pl.$$eval("[data-homehit]", (a) => a.length)) === 1);
      await pl.click('[data-homehit="0"]');
      check("Einstellungen: gewählte Adresse steht als neue Regeladresse, noch nicht gespeichert", (await pl.innerText("#homeNow")) === "Ulm, Baden-Württemberg" && (await ls("home")).label === "Marktplatz, Filderstadt");
      await pl.click("#btnDlgCancel");
      check("Einstellungen: Abbrechen verwirft die Änderung", (await ls("home")).label === "Marktplatz, Filderstadt");
      await pl.click("#btnSettings"); await pl.waitForSelector("#dlg[open]"); await pl.fill("#inHomeQ", "Ulm"); await pl.click("#btnHomeSearch"); await pl.waitForSelector("[data-homehit]"); await pl.click('[data-homehit="0"]');
      await pl.click("#dlg button[value=save]"); await pl.waitForFunction(() => /Ulm/.test(document.querySelector("#locLabel").innerText));
      await pl.waitForSelector("#main .card.notice", T);
      check("Einstellungen: Speichern übernimmt die Regeladresse; Ort außerhalb des Datengebiets zeigt den Hinweis", (await ls("home")).label === "Ulm, Baden-Württemberg" && (await ls("home")).lat === 48.4011 && /außerhalb des Datengebiets/.test(await pl.innerText("#main")), await chip());
      await pl.click("#btnSettings"); await pl.waitForSelector("#dlg[open]"); await pl.click("#btnHomeClear");
      check("Einstellungen: Entfernen zeigt „nicht festgelegt“", (await pl.innerText("#homeNow")) === "nicht festgelegt" && (await ls("home")).label === "Ulm, Baden-Württemberg");
      await pl.click("#btnDlgCancel");
      // Route: Start/Ziel „Regeladresse“
      await pl.click("#tabbar [data-tab=route]"); await pl.waitForSelector("[data-rtpick=b]"); await pl.click("[data-rtpick=b]"); await pl.waitForSelector("#dlgRt[open]");
      check("Route: Start/Ziel bieten die Regeladresse (statt der Bases)", (await pl.$$eval("#dlgRt [data-rtset]", (a) => a.map((x) => x.dataset.rtset))).join() === "gps,home", await pl.$$eval("#dlgRt [data-rtset]", (a) => a.map((x) => x.dataset.rtset)));
      await pl.keyboard.press("Escape");
      // Erststart ohne gespeicherten Ort: Ortswahl öffnet sich von selbst
      await pl.evaluate(() => { for (const k of ["loc", "home", "recentPlaces", "lastBase", "homeBase", "lastPlace"]) localStorage.removeItem(k); });
      await pl.reload(); await pl.waitForSelector("#dlgLoc[open]", T);
      check("Erststart: ohne gespeicherten Ort öffnet sich die Ortswahl mit Hinweis (Standort oder Adresse)", await pl.evaluate(() => !document.querySelector("#locHint").hidden && !!document.querySelector("#optGps") && !document.querySelector("#locHint").closest("dialog").querySelector("[data-base]")));
      check("Erststart: Ortswahl bleibt ohne Auswahl erhalten, keine Regeladresse wird erfunden", (await ls("home")) === null);
      check("Regeladresse: keine Skriptfehler", pe.length === 0, pe);
      await pl.evaluate((o) => { if (o) localStorage.setItem("home", o); localStorage.setItem("loc", JSON.stringify({ mode: "home" })); }, orig);
      await pl.close();
    }

    // ---- E-Modus
    await p.click("#seg [data-f=ev]"); await p.waitForSelector("#evBody .list .rtitem", T);
    check("E-Modus: ⚡ Strom aktiv, Ladestationen mit Preis in €/kWh", /Strom/.test(await tx("#seg .on")) && /€\/kWh/.test(await tx("#evBody .hero")) && (await n("#evBody .rtitem")) >= 5);
    check("E-Modus: Ladedaten ohne GitHub-Preisdaten, genau eine Umkreissuche", state.loc === 1, state.loc);
    {
      await p.click("#btnLevel"); await p.waitForSelector("#dlgLevel[open]");
      const title = await tx("#lvlTitle"), sub = await tx('[data-lvlk="0.5"]'); await p.click('[data-lvlk="0.5"]'); await p.waitForTimeout(250);
      check("Füllstand (E-Modus): eigener Akkustand 🔋 in kWh, getrennt vom Tankfüllstand", title === "Akkustand" && /≈ 15 kWh/.test(sub) && (await tx("#lvlIcon")) === "🔋" && (await tx("#lvlLabel")) === "½" && await p.evaluate(() => localStorage.getItem("lvl")) === "null", { title, sub });
      check("Füllstand (E-Modus): Ersparnis bei 15 kWh (½)", !(await p.$("#evBody .hero .save")) || /bei 15 kWh \(½\) ggü\. Ø/.test(await tx("#evBody .hero .save")), await tx("#evBody .hero .save"));
      await p.click("#btnLevel"); await p.click('[data-lvlk=""]'); await p.waitForTimeout(150);
    }
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
    {
      await p.click("#btnLevel"); await p.waitForSelector("#dlgLevel[open]"); await p.click('[data-lvlk="res"]'); await p.waitForSelector("#rtBody .rthero, #rtBody .rtlist", T); await p.waitForTimeout(400);
            check("Füllstand (Route): Zeile mit Stand, Menge und Reichweite (Reserve · ≈ 46,5 l · 50 km)", /Reserve/.test(await tx("#rtBody .rtlevel")) && /46,5 l/.test(await tx("#rtBody .rtlevel")) && /50 km/.test(await tx("#rtBody .rtlevel")), await tx("#rtBody .rtlevel"));
      // kleiner Tank, hoher Verbrauch: bei ¼ reichen nur ≈ 4 km → Tankstellen weiter vorn auf der Strecke sind „außer Reichweite“
      await p.evaluate(() => { localStorage.setItem("tank", "5"); localStorage.setItem("cons", "30"); });
      await p.click("#btnLevel"); await p.click('[data-lvlk="0.25"]'); await p.waitForTimeout(500);
      const far = await p.$$eval("#rtBody .rtitem", (a) => a.filter((x) => /net erreichbar|außer Reichweite/.test(x.textContent)).length), hero = await tx("#rtBody .rthero, #rtBody .empty, #rtBody .rtsum");
      check("Füllstand (Route): Tankstellen jenseits von 90 % der Reichweite sind „außer Reichweite“ und nie die beste", far >= 1 && !/net erreichbar|außer Reichweite/.test(await tx("#rtBody .rthero")), { far, hero: hero.slice(0, 200) });
      await p.evaluate(() => { localStorage.removeItem("tank"); localStorage.removeItem("cons"); });
      await p.click("#btnLevel"); await p.click('[data-lvlk=""]'); await p.waitForTimeout(300);
    }
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

    // ---- Android und iPhone: Karten-Knöpfe, Zurück-Taste, Installation, Verknüpfungen, schmale Bildschirme
    const back = async () => { await p.evaluate(() => history.back()); await p.waitForTimeout(250); };
    const bodyTab = () => p.evaluate(() => document.body.dataset.tab);
    if (!(await n("#evBody .rtdet"))) await p.click("#evBody .rtitem:has(.p b) .item >> nth=0");
    const hrefs = await p.locator("#evBody .rtdet").first().locator(".row a.btn").evaluateAll((a) => a.map((x) => x.getAttribute("href")));
    check(ANDROID ? "Android: Google Maps und „Andere Karten-App“ (geo:), kein Apple Karten" : "iPhone: Google Maps und Apple Karten, kein geo:",
      hrefs.filter((h) => /google\.com\/maps/.test(h)).length === 1 && (ANDROID ? hrefs.filter((h) => /^geo:\d/.test(h)).length === 1 && !hrefs.some((h) => /apple/.test(h)) : hrefs.filter((h) => /maps\.apple\.com/.test(h)).length === 1 && !hrefs.some((h) => /^geo:/.test(h))), hrefs);
    await p.evaluate(() => { window.__nav = null; navTo = (u) => { window.__nav = u; }; window.open = () => null; });
    if (ANDROID) await p.locator("#evBody .rtdet").first().locator("a[href*='google.com/maps']").click();
    else await p.evaluate(() => openRoute({ lat: 48.5, lng: 9.2 }));
    const nav = await p.evaluate(() => window.__nav);
    check(ANDROID ? "Android: Google-Maps-Knopf öffnet die Maps-App (Intent mit Rückfall auf die Webseite)" : "iPhone: Route öffnet Google Maps über comgooglemaps://",
      ANDROID ? /^intent:\/\/www\.google\.com\/maps\/.*package=com\.google\.android\.apps\.maps;S\.browser_fallback_url=https%3A%2F%2Fwww\.google\.com%2Fmaps%2F/.test(nav) : /^comgooglemaps:\/\/\?daddr=48\.5%2C9\.2/.test(nav), nav);
    if (ANDROID) { await p.evaluate(() => { window.__nav = null; openRoute({ lat: 48.5, lng: 9.2 }); }); check("Android: „Route“ (Detailansicht) nutzt denselben Intent", /^intent:\/\/www\.google\.com\/maps\/dir\//.test(await p.evaluate(() => window.__nav))); }
    if (!ANDROID) await p.waitForTimeout(1400);   // iPhone: nach 1,2 s folgt der Rückfall auf die Webseite (hier ebenfalls abgefangen)
    await p.evaluate(() => { navTo = (u) => { location.href = u; }; });

    await p.click("#tabbar [data-tab=route]"); await p.waitForTimeout(200); await p.click("#tabbar [data-tab=verlauf]"); await p.waitForTimeout(200);
    check("Zurück-Taste: Wechsel zwischen Bereichen legt nur einen Verlaufseintrag an", await p.evaluate(() => history.state?.t === 1) && await bodyTab() === "verlauf");
    await back();
    check("Zurück-Taste: aus „Verlauf“ zurück zu „Preise“ (statt die App zu verlassen)", await bodyTab() === "preise" && await p.evaluate(() => history.state?.t == null), await bodyTab());
    await p.click("#seg [data-f=e5]"); await p.waitForSelector("#main .hero .price", T);
    await p.click("#main .list .item >> nth=0"); await p.waitForSelector("#detail.open"); await back();
    check("Zurück-Taste: schließt die Detailansicht, bleibt in „Preise“", !(await p.evaluate(() => document.querySelector("#detail").classList.contains("open"))) && await bodyTab() === "preise");
    await p.click("#tabbar [data-tab=route]"); if (await p.$("#rtBody [data-rtgo]")) await p.click("#rtBody [data-rtgo]"); await p.waitForSelector("#rtBody .rtlist .rtitem", T);
    await p.waitForFunction(() => !document.querySelector("#rtBody .spin-dot"), null, T);
    await p.click("#rtBody .rtlist .rtitem .item >> nth=0"); await p.click("#rtBody [data-detail] >> nth=0"); await p.waitForSelector("#detail.open"); await back();
    check("Zurück-Taste: Detailansicht aus „Route“ schließt nur die Ansicht", !(await p.evaluate(() => document.querySelector("#detail").classList.contains("open"))) && await bodyTab() === "route");
    await back();
    check("Zurück-Taste: danach zurück zu „Preise“", await bodyTab() === "preise");
    await p.click("#tabbar [data-tab=route]"); await p.click("#tabbar [data-tab=preise]"); await p.waitForTimeout(250);
    check("Zurück-Taste: „Preise“ antippen räumt den Verlaufseintrag wieder ab", await p.evaluate(() => history.state?.t == null) && await bodyTab() === "preise");

    await p.click("#btnSettings"); await p.waitForTimeout(150);
    check(ANDROID ? "Installieren (Android): Anleitung über das Browser-Menü" : "Installieren (iPhone): Anleitung „Teilen → Zum Home-Bildschirm“",
      await p.isVisible("#instBox") && !(await p.isVisible("#btnInstall")) && (ANDROID ? /⋮/.test(await tx("#instTxt")) : /Teilen/.test(await tx("#instTxt"))), await tx("#instBox"));
    await p.click("#btnDlgCancel");
    await p.evaluate(() => { window.__prompted = 0; const e = new Event("beforeinstallprompt", { cancelable: true }); e.prompt = async () => { window.__prompted++; }; e.userChoice = Promise.resolve({ outcome: "accepted" }); window.dispatchEvent(e); });
    const bar = await p.evaluate(() => [...document.querySelectorAll("#instBar button")].map((b) => Math.round(b.getBoundingClientRect().height)));
    check("Installieren: Hinweis erscheint bei „beforeinstallprompt“, Knöpfe mindestens 44 px", await p.isVisible("#instBar") && bar.length === 2 && bar.every((h) => h >= 44), bar);
    await p.click("#btnInstBar"); await p.waitForTimeout(150);
    check("Installieren: Knopf ruft die Installation des Browsers auf, Hinweis verschwindet", await p.evaluate(() => window.__prompted) === 1 && !(await p.isVisible("#instBar")));
    await p.evaluate(() => { const e = new Event("beforeinstallprompt", { cancelable: true }); e.prompt = async () => {}; e.userChoice = Promise.resolve({}); window.dispatchEvent(e); });
    await p.click("#btnSettings"); await p.waitForTimeout(150);
    check("Installieren: Einstellungen zeigen den Knopf „App installieren“", await p.isVisible("#btnInstall")); await p.click("#btnDlgCancel");
    await p.click("#btnInstNo"); await p.evaluate(() => { const e = new Event("beforeinstallprompt", { cancelable: true }); e.prompt = async () => {}; e.userChoice = Promise.resolve({}); window.dispatchEvent(e); });
    check("Installieren: weggeklickter Hinweis kommt nicht wieder", !(await p.isVisible("#instBar")));

    const p2 = await ctx.newPage(); await p2.goto(srv.url + "?tab=verlauf&ev=0"); await p2.waitForSelector("#main", T); await p2.waitForTimeout(1500);
    const lk = await p2.evaluate(() => ({ tab: document.body.dataset.tab, url: location.search, st: history.state, ev: localStorage.getItem("ev") }));
    check("Verknüpfung ?tab=verlauf: öffnet den Bereich, Adresse wird bereinigt, „Zurück“ führt zu „Preise“", lk.tab === "verlauf" && lk.url === "" && lk.st?.t === 1 && lk.ev === "0", lk);
    await p2.evaluate(() => history.back()); await p2.waitForTimeout(250);
    check("Verknüpfung: Zurück → Preise", await p2.evaluate(() => document.body.dataset.tab) === "preise");
    await p2.goto(srv.url + "?tab=preise&ev=1"); await p2.waitForSelector("#evBody .list .rtitem", T);
    check("Verknüpfung ?ev=1: öffnet die Ladestationen (⚡ Strom)", /Strom/.test(await p2.innerText("#seg .on")) && await p2.evaluate(() => localStorage.getItem("ev")) === "1");
    await p2.close();

    const W = ANDROID ? [360, 412] : [320, 390], widths = [];
    for (const w of W) { await p.setViewportSize({ width: w, height: 760 });
      for (const t of ["preise", "route", "verlauf", "tankbuch"]) { await p.click(`#tabbar [data-tab=${t}]`); await p.waitForTimeout(250); const sw = await p.evaluate(() => document.documentElement.scrollWidth);
        if (t === "preise") { const r = await p.evaluate(() => { const a = document.querySelector("#btnLoc").getBoundingClientRect(), b = document.querySelector("#btnLevel").getBoundingClientRect(); return { dy: Math.abs(a.top - b.top), right: b.right, h: b.height, w: b.width }; }); if (r.dy > 4 || r.right > w) widths.push(`Füllstandsknopf@${w}: ${JSON.stringify(r)}`); }
        if (sw > w) widths.push(`${t}@${w}: ${sw} · ${await p.evaluate((w) => [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > w + 1 && e.offsetParent && !e.closest(".leaflet-container, .cw, svg")).slice(0, 4).map((e) => e.tagName + "." + e.className + " " + Math.round(e.getBoundingClientRect().right) + " «" + e.outerHTML.slice(0, 90).replace(/\s+/g, " ") + "»").join(" | "), w)}`); } }
    check(`Schmale Bildschirme (${W.join(", ")} px): kein seitliches Scrollen in allen Bereichen`, widths.length === 0, widths);
    await p.setViewportSize(devices[DEVICE].viewport);
    await p.click("#tabbar [data-tab=preise]"); await p.click("#seg [data-f=ev]"); await p.waitForSelector("#evBody .list .rtitem", T);

    // ---- Barrierefreiheit (axe-core, WCAG 2.1 AA und Best Practice): keine Verstöße in den Hauptansichten, hell und dunkel
    const axeSrc = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8"), axeBad = [];
    const p9 = await ctx.newPage(); await p9.goto(srv.url); await p9.waitForSelector("#main .hero .price", T); await p9.evaluate(axeSrc);
    const ax = async (name) => { const r = await p9.evaluate(() => axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] } }));
      r.violations.forEach((v) => axeBad.push(`${name}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 2).map((x) => x.target.join(" ")).join(" | ")}`)); };
    for (const scheme of ["light", "dark"]) {
      await p9.emulateMedia({ colorScheme: scheme }); const sc = (n) => `${scheme}/${n}`;
      await p9.click("#tabbar [data-tab=preise]"); if (await p9.$("#seg [data-f=e5].on") === null) await p9.click("#seg [data-f=e5]"); await p9.waitForSelector("#main .hero .price", T);
      await ax(sc("Preise"));
      await p9.click("#main [data-view='map']"); await p9.waitForSelector("#map .leaflet-marker-icon", { state: "attached", ...T }); await p9.waitForTimeout(300); await ax(sc("Karte")); await p9.click("#main [data-view='list']");
      await p9.click("#main .list .item >> nth=0"); await p9.waitForSelector("#detail.open"); await p9.waitForTimeout(400); await ax(sc("Detail")); await p9.click("#btnBack"); await p9.waitForTimeout(350);
      await p9.click("#tabbar [data-tab=route]"); await p9.waitForTimeout(300); await ax(sc("Route"));
      await p9.click("#tabbar [data-tab=verlauf]"); await p9.waitForTimeout(400); await ax(sc("Verlauf"));
      await p9.click("#tabbar [data-tab=tankbuch]"); await p9.waitForTimeout(300); await ax(sc("Spritbüchle"));
      await p9.click("#tabbar [data-tab=preise]"); await p9.click("#btnSettings"); await p9.waitForTimeout(250); await ax(sc("Einstellungen")); await p9.click("#btnDlgCancel");
      await p9.click("#btnLoc"); await p9.waitForTimeout(250); await ax(sc("Ortswahl")); await p9.click("#btnLocDone");
      await p9.click("#btnLevel"); await p9.waitForSelector("#dlgLevel[open]"); await ax(sc("Füllstand")); await p9.click("#btnLevelClose");
      await p9.click("#seg [data-f=ev]"); await p9.waitForSelector("#evBody .list .rtitem", T); await ax(sc("E-Modus"));
      await p9.click("#evBody .rtitem:has(.p b) .item >> nth=0"); await p9.waitForTimeout(250); await ax(sc("E-Modus Details"));
      await p9.click("[data-cardopen]"); await p9.waitForSelector("#dlgCard[open]"); await ax(sc("Ladekarte")); await p9.click("#btnCardClose");
    }
    check("Barrierefreiheit: axe-core findet keine Verstöße (Preise, Karte, Details, Route, Verlauf, Spritbüchle, Einstellungen, Ortswahl, Füllstand, E-Modus, Ladekarte; hell und dunkel)", axeBad.length === 0, axeBad.slice(0, 12));
    await p9.close();

    // ---- Ebenen: Karten (Leaflet, Ebenen bis 1000) dürfen nicht über die Leiste unten und die Sortenwahl oben reichen
    const layers = (sel) => p.evaluate(async (sel) => {
      const map = document.querySelector(sel), h = innerHeight, wait = () => new Promise((r) => setTimeout(r, 250));
      const top = (x, y, q) => document.elementFromPoint(x, y)?.closest(q) != null;
      window.scrollBy(0, map.getBoundingClientRect().top - (h - 200)); await wait();          // Karte reicht unter die Leiste unten
      const bar = top(innerWidth / 2, h - 14, "#tabbar");
      window.scrollBy(0, map.getBoundingClientRect().bottom - 12); await wait();               // Karte reicht unter die Sortenwahl oben
      const sticky = top(innerWidth / 2, 30, ".sticky");
      window.scrollTo(0, 0); return { bar, sticky, isolated: [...document.querySelectorAll(".leaflet-container")].every((e) => getComputedStyle(e).isolation === "isolate") };
    }, sel);
    await p.click("#evBody [data-evview='map']"); await p.waitForSelector("#evmap .leaflet-marker-icon", { state: "attached", ...T }); await p.waitForTimeout(300);
    const l1 = await layers("#evmap");
    await p.click("#evBody [data-evview='list']");
    await p.click("#seg [data-f=e5]"); await p.waitForSelector("#main .hero .price", T);
    await p.click("#main [data-view='map']"); await p.waitForSelector("#map .leaflet-marker-icon", { state: "attached", ...T }); await p.waitForTimeout(300);
    const l2 = await layers("#map");
    check("Ebenen: Karte (E-Modus) liegt unter Leiste unten und Sortenwahl", l1.bar && l1.sticky && l1.isolated, l1);
    check("Ebenen: Karte (Preise) liegt unter Leiste unten und Sortenwahl", l2.bar && l2.sticky && l2.isolated, l2);
    await p.click("#main [data-view='list']"); await p.click("#seg [data-f=ev]"); await p.waitForSelector("#evBody .list .rtitem", T);

    // ---- Hinweis zur Aktualisierung: der gespeicherte Stand beim Start darf keinen Alarm auslösen
    const health = (pg) => pg.evaluate(() => document.querySelector("#health")?.innerText.replace(/\s+/g, " ").trim() || "");
    const seedOld = () => p.evaluate(async (old) => { const c = await kv.get("d:data/H/latest.json"); await kv.set("d:data/H/latest.json", { at: Date.now() - 29 * 3600e3, d: { ...c.d, updated: old } }); }, stamp(29 * 60));
    const open3 = async (setup) => { await setup(); const pg = await ctx.newPage(); await pg.goto(srv.url); await pg.waitForSelector("#main .hero .price", T); return pg; };
    await seedOld(); state.delay = 2500;
    const p3 = await open3(async () => {});
    const stand1 = await p3.innerText("#stand"); await p3.waitForTimeout(300); const h1 = await health(p3);
    await p3.waitForFunction(() => !/Gespeichert/.test(document.querySelector("#stand")?.textContent || ""), null, T); await p3.waitForTimeout(600); const h2 = await health(p3);
    check("Hinweis: beim Start steht der gespeicherte Stand (29 Std.) ohne Alarm da", /Gespeichert/.test(stand1) && h1 === "", { stand1, h1 });
    check("Hinweis: nach den frischen Daten kein „Preise sind … alt“", h2 === "", h2);
    await p3.close(); state.delay = 0;

    await seedOld(); state.fail = true;
    const p4 = await open3(async () => {}); await p4.waitForTimeout(600); const h3 = await health(p4);
    check("Hinweis: Abruf schlägt fehl → „gespeicherter Stand“, ohne Vorwurf an den Preisabruf und ohne „Abruf neu starten“", /gespeicherte Stand/.test(h3) && !/normalerweise/.test(h3) && (await p4.$("#btnRetry")) === null && (await p4.$("#btnReload")) !== null, h3);
    await p4.close(); state.fail = false;

    state.updMin = 180; const p5 = await open3(async () => {}); await p5.waitForTimeout(600); const h4 = await health(p5);
    check("Hinweis: Preise wirklich 3 Std. alt → Hinweis mit „Abruf neu starten“", /3 Std\. alt/.test(h4) && (await p5.$("#btnRetry")) !== null, h4);
    await p5.close();

    state.updMin = 75; const p6 = await open3(async () => {}); await p6.waitForTimeout(600); const h5 = await health(p6);
    check("Hinweis: 75 Min. alt (GitHub startet nur etwa alle 30 Min., Lücken bis fast 1 Std. kommen vor) ist noch normal", h5 === "", h5);
    await p6.close(); state.updMin = 5;
    // ---- Leiste unten und Sortenwahl: ohne Weichzeichner; Korrektur bei versetztem Anzeigebereich (nur iPhone, installierte App)
    const css = await p.evaluate(() => { const g = (q) => { const e = document.querySelector(q); return e ? getComputedStyle(e) : null; }; return { bar: g("#tabbar")?.backdropFilter, sticky: g(".sticky")?.backdropFilter, will: g("#tabbar")?.willChange }; });
    check("Anzeige: Leiste unten und Sortenwahl ohne Weichzeichner, Leiste mit eigener Ebene (iOS löst sie sonst beim Scrollen)", css.bar === "none" && css.sticky === "none" && /transform/.test(css.will), css);
    const p7 = await ctx.newPage();
    await p7.addInitScript(() => Object.defineProperty(navigator, "standalone", { get: () => true }));
    await p7.goto(srv.url); await p7.waitForSelector("#main .hero .price", T);
    await p7.evaluate(() => window.scrollTo(0, 400)); await p7.waitForTimeout(250);
    const y0 = await p7.evaluate(() => Math.round(scrollY));
    const vp = async (setup) => { await p7.evaluate(setup); await p7.evaluate(() => visualViewport.dispatchEvent(new Event("resize"))); await p7.waitForTimeout(550); return p7.evaluate(() => ({ heals: vpStat.heals, y: Math.round(scrollY), bar: getComputedStyle(document.querySelector("#tabbar")).display })); };
    const v0 = await vp(() => {});
    const v1 = await vp(() => Object.defineProperty(visualViewport, "offsetTop", { get: () => 297, configurable: true }));
    check(ANDROID ? "Anzeige (Android): versetzter Anzeigebereich löst keine iPhone-Korrektur aus" : "Anzeige (iPhone, installiert): bleibt der Anzeigebereich um 297 px versetzt, wird die Lage neu berechnet, Scrollstand bleibt",
      ANDROID ? v1.heals === 0 : v0.heals === 0 && v1.heals === 1 && v1.y === y0 && v1.bar !== "none", { y0, v0, v1 });
    const v2 = await vp(() => Object.defineProperty(visualViewport, "scale", { get: () => 2, configurable: true }));
    const v3 = await vp(() => { Object.defineProperty(visualViewport, "scale", { get: () => 1, configurable: true }); const i = document.createElement("input"); i.id = "tmpIn"; document.body.append(i); i.focus(); });
    check("Anzeige: bei Zoom oder offener Tastatur keine Korrektur", v2.heals === v1.heals && v3.heals === v1.heals, { v1, v2, v3 });
    await p7.evaluate(() => document.querySelector("#tmpIn").remove());
    await p7.click("#btnSettings"); await p7.waitForTimeout(150);
    const diag = await p7.evaluate(() => document.querySelector("#vpDiag").textContent);
    check("Einstellungen: Anzeige-Diagnose zeigt Fenster, Versatz, Zoom und Korrekturen", /Fenster \d+×\d+/.test(diag) && /Versatz/.test(diag) && /installierte App/.test(diag) && /Korrekturen \d/.test(diag), diag);
    await p7.close();
    await p.evaluate(() => { localStorage.setItem("ev", "1"); localStorage.setItem("tab", "preise"); });   // die Seiten oben haben die gemeinsamen Einstellungen zurückgesetzt

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
