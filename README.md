# Schwabensprit – App

Oberfläche der Tankpreis-App. Sie enthält **keine Daten**: Preise, Orte und Reports lädt sie mit dem
auf dem Gerät hinterlegten GitHub-Zugangsschlüssel aus dem Daten-Repository (soll privat sein, siehe `docs/DIENSTE.md`, Entscheidung vom 30.10.2026).

## Aufbau

- **Dieses Repository** enthält die App und ist die einzige Quelle des App-Codes.
- **Daten-Repository** `KapahutE/tankpreise`: Abrufprogramm und Rohdaten auf `main`; die aufbereiteten App-Daten (`docs/data`, `docs/reports`) auf dem Zweig `app-daten`, der bei jedem Abruf mit genau einem Stand überschrieben wird (kein Verlauf, das Repository wächst nicht unnötig).
- Die App liest über die GitHub-API von `app-daten` (Rückfall auf `main`).


## Bereiche

Leiste unten mit drei Bereichen:

- **⛽ Preise** – Favoriten, günstigste Tankstelle, „Lohnt sich am meischda“, „Wann tanka?“ (12-Uhr-Regel, beste Tageszeit und Prognose in einer Empfehlung), Tankstellen als Top 10 (alle auf Wunsch) oder Karte
- **🛣️ Route** – Strecke planen (Start: Standort, Base oder Ort; Ziel per Suche) und die Tankstellen am Weg sehen: Abstand zur Strecke 1/2/5 km, günstigste und „lohnt sich am meisten inkl. Umweg“, Karte, Liste nach Strecken-km, Tankstopp als Zwischenziel an Google Maps / Apple Karten übergeben; echter Umweg (eine Matrix-Anfrage), Preis und Öffnung bei Ankunft (Prognose, Abfahrtszeit wählbar), Spritkosten der Fahrt, gemerkte Strecken, letzte Route bleibt nach dem Neustart; durch Österreich mit amtlichen Preisen der E-Control und dem Vergleich „Vor oder nach der Grenze tanken?“; Ortssuche auch in den Nachbarländern
- **⚡ E-Modus** – über „⚡ Strom“ neben den Kraftstoffsorten ein- und ausschaltbar (bleibt gespeichert): Bereich Preise zeigt Ladestationen im Umkreis (bis 15 km) mit Ladepreis (€/kWh, Direktbezahlung), Leistung (AC/DC, kW), Steckertypen und Belegung (frei / belegt / gestört, wo der Betreiber sie meldet), Filter nach Leistung, Sortierung, Liste oder Karte; Route zeigt Ladestationen am Weg; Verlauf entfällt. Ladung für die Ersparnis-Rechnung unter ⚙ („Ladung E-Modus“, Standard 30 kWh); Favoriten (★, bis 5 Ladestationen); „💳 Meine Ladekarte“ für eigene Preise mit Karte/App (siehe unten)
- **📈 Verlauf** – letzte 7 Tage, Preis nach Uhrzeit, Preisänderungen, Rangliste, Wochenreports
- **📒 Spritbüchle** (Hochdeutsch: Tankbuch) – Belege scannen, Tankungen, Statistik, Export (nur auf dem Gerät)

## Schnell und ohne Netz

- **Service Worker** (`sw.js`): App-Dateien kommen aus dem Speicher (je Version unveränderlich, `?v=`-Hash), die Startseite sofort aus dem Speicher und wird im Hintergrund geprüft; gibt es eine neue Version, erscheint „Neue Version bereit – tippen zum Neuladen“. Der Belegleser (`ocr/`, 13 MB) wird bei erster Nutzung gespeichert. Preisdaten laufen nie über den Worker.
- **Zwischenspeicher der Daten** (IndexedDB `schwabensprit-cache`, nur auf dem Gerät): zuletzt geladene Preise der Basis und Ladestationen des letzten Orts. Beim Start erscheint sofort dieser Stand („Gespeichert · Stand …“), danach kommen die frischen Daten; ohne Netz bleibt er stehen. „Ortsdaten löschen“ leert ihn.
- **Content-Security-Policy** (Meta-Tag in `index.html`): Skripte nur aus der App und unpkg (Karte, mit Prüfsumme), Verbindungen nur zu den benötigten Diensten, keine Inline-Skripte. Wer in `endpoints.json` einen anderen Dienst einträgt, muss dessen Adresse auch in der Richtlinie ergänzen. Der Belegleser braucht `wasm-unsafe-eval` (iOS ab 16.4).
- **Tankfüllstand** (⛽ neben dem Ort; ¾ · ½ · ¼ · Reserve = 50 km Restreichweite · Nicht angeben; gilt 3 Tage; im E-Modus eigener Akkustand 🔋): Ersparnis, Kosten mit Hin- und Rückfahrt, „mit Anfahrt besser“, Route und Ladekosten rechnen mit der Menge, die zum vollen Tank fehlt, statt mit der ganzen Tankgröße; Tankstellen jenseits von 90 % der Restreichweite sind „außer Reichweite“. Rechnungen und Beispiele: [`docs/TANKFUELLSTAND.md`](docs/TANKFUELLSTAND.md).
- **Tank-Rat** (Preise, in „Wann tanken?“): nutzt den Füllstand → Reichweite, „jetzt tanken“ oder „warten spart ≈ …“ aus Prognose und 12-Uhr-Regel. **Kosten je 100 km** im E-Modus: Ladepreis × Verbrauch (⚙ „E-Auto kWh/100 km“), dazu der Sprit-Vergleich.

## iPhone und Android

Eine App für beide Systeme (Progressive Web App, kein Store nötig):

- **Installieren:** Android (Chrome, Samsung Internet): ⚙ Einstellungen → „App installieren“ (oder der Hinweis unten beim ersten Besuch, sonst Browser-Menü ⋮ → „App installieren“). iPhone: Safari → Teilen → „Zum Home-Bildschirm“. Symbole: `icon-192.png`/`icon-512.png`, `icon-maskable-512.png` (mit Rand für runde Android-Masken), `icon-mono-512.png` (einfarbig, Android 13+ Designsymbole), `apple-touch-icon.png`.
- **Verknüpfungen (Android):** Symbol lange drücken → Spritpreise, Ladestationen, Route, Spritbüchle (`?tab=…&ev=…`, siehe `manifest.webmanifest`).
- **Karten-Apps:** Google Maps auf beiden Systemen (Android öffnet die Maps-App per Intent, sonst die Webseite). iPhone/Mac zusätzlich Apple Karten; Android zusätzlich „Andere Karten-App“ (`geo:`, Auswahl aller installierten Navi-Apps).
- **iPhone, installierte App:** Die Leiste unten und die Sortenwahl oben sind „fest“; WebKit versetzt sie manchmal gegenüber der Seite (nach der Tastatur oder beim schnellen Scrollen). Gegenmaßnahmen: Leisten ohne Weichzeichner und mit eigener Ebene (`app.css`), Neuberechnung bei bleibendem Versatz (`vpHeal` in `js/grund.js`), `overscroll-behavior` nur außerhalb von iOS. Werte zur Fehlersuche: ⚙ Einstellungen → „Anzeige-Diagnose“.
- **Zurück-Taste/-Geste:** schließt zuerst Detailansicht und Report, führt aus Route/Verlauf/Spritbüchle zurück zu „Preise“, erst dann verlässt sie die App.
- Android: aktuelles Chrome oder Samsung Internet; iPhone: iOS ab 16.4 (wegen des Belegelesers).
- Eine Version für den Google Play Store wäre möglich (Trusted Web Activity, z. B. mit Bubblewrap), braucht aber ein Entwicklerkonto – für den Eigengebrauch nicht nötig.

## Tests und Prüfungen

Vorbereitung (einmalig): `npm ci && npx playwright install chromium`. Alles zusammen: `npm test`. Bei jedem Push läuft dasselbe in GitHub Actions (`.github/workflows/tests.yml`).

| Befehl | Prüft |
|---|---|
| `npm run lint` | ESLint über `js/`, `sw.js` und `tests/` (undefinierte Namen, tote Variablen, Fehlerquellen; Konfiguration `eslint.config.js` kennt die gemeinsamen Namen der klassischen Skripte) |
| `node tools/version.js --check` | die Versionsnummer `?v=…` in `index.html` passt zu `app.css` und `js/*.js` |
| `npm run unit` | ohne Browser: Streckengeometrie, Belegleser, Spritbüchle-Verbrauch, Ladekarte, E-Modus-Logik, Geräteerkennung, Manifest, Versionsnummer, Skript-Liste, CSP-Hosts |
| `npm run e2e` / `npm run e2e:android` | Chromium mit Playwright (iPhone 13 bzw. Pixel 7), feste Testdaten in `tests/fixtures/`, nachgestellte Dienste: Preise, E-Modus, Ladekarte, Route, Spritbüchle, Belegleser, CSP, Tippflächen, Offline-Start, Zurück-Taste, Installation, Ebenen der Karten, Hinweis zur Aktualisierung, Tankfüllstand, **Barrierefreiheit (axe-core, WCAG 2.1 AA, hell und dunkel)** |

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Grundgerüst (Kopf, Leiste, Dialoge) |
| `app.css` | Aussehen (hell/dunkel) |
| `js/grund.js` | Einstellungen, Daten laden, Ort/Radius, Bausteine, Diagramme, Bereiche, Start |
| `js/fuellstand.js` | Tankfüllstand: nötige Menge, Reichweite, Kosten mit Anfahrt (rein), Auswahl mit Ablauf nach 3 Tagen, Knopf und Dialog |
| `js/ladekarte.js` | E-Modus: „Meine Ladekarte“ – Eigeneingabe mit Eingabeprüfung und laufender Prüfung |
| `js/strom.js` | E-Modus: Ladestationen und Ladepreise (MobiData BW OCPDB), Ansicht für Preise und Route |
| `js/route.js` | Bereich Route: Routing (FOSSGIS OSRM, Ausweich Valhalla), Tankstellen am Weg, Preise Österreich (E-Control), Grenzvergleich, Karte, Übergabe an Karten-Apps |
| `js/routegeo.js` | Geometrie: Polyline, Abstand zur Strecke, Kilometer ab Start, Umweg, Abfragepunkte |
| `sw.js` | Service Worker: Sofortstart und Betrieb ohne Netz |
| `tests/` | Unit-Tests, Browser-Tests und Testdaten |
| `tools/version.js` | berechnet und prüft die Versionsnummer `?v=…` |
| `eslint.config.js`, `package.json` | Linter und Prüfwerkzeuge (die App selbst braucht keinen Build) |
| `THIRD_PARTY.md` | Quellen und Lizenzen der Daten und Bestandteile |
| `docs/` | Architektur, Fahrplan zur Professionalisierung, Bedingungen der Fremddienste, Entwürfe für Datenschutz und Impressum |
| `CHANGELOG.md` | Änderungen je Stand |
| `endpoints.json` | Adressen von Routing-, Such- und E-Control-Dienst (austauschbar ohne Code-Änderung) |
| `js/preise.js` | Bereich Preise, „Wann tanka?“, Karte, Detailansicht |
| `js/verlauf.js` | Auswertung, Bereich Verlauf, Wochenreports |
| `js/belegleser.js` | Belegfoto aufbereiten, Texterkennung (Tesseract.js in `ocr/`), Werte und Tankstelle erkennen |
| `js/tankbuch.js` | Bereich Tankbuch (IndexedDB), Vergleich, Erfassen, Export |

Die Skripte sind klassische Skripte ohne Build-Schritt und teilen sich den globalen Gültigkeitsbereich – die Reihenfolge in `index.html` zählt (`grund.js` zuerst).

Nach Änderungen an CSS/JS die Versionsnummer erneuern, damit Handys nicht alte Dateien aus dem Zwischenspeicher nehmen (der Test schlägt sonst fehl):

```sh
node tools/version.js
```

## Ladestationen (E-Modus)

- **Quelle:** MobiData BW „OCPDB“ (api.mobidata-bw.de/ocpdb/api/public) – offen, ohne Schlüssel, bundesweit, mit CORS. Die Adresse steht in `endpoints.json` (`evApi`).
  - **Standorte:** Bundesnetzagentur-Ladesäulenregister und Betreiber-Feeds der Mobilithek (DATEX II), gebündelt von MobiData BW unter „Datenlizenz Deutschland – Namensnennung 2.0“ (Quelle nennen, Lizenz verlinken, Änderungen kenntlich machen – steht im Fuß des E-Modus). Doppelte Meldungen derselben Säule (Register + Betreiber) und viele Ladepunkte desselben Betreibers an einem Ort werden zusammengefasst.
  - **Belegung** (frei / belegt / gestört) und **Preise** kommen nur aus den Betreiber-Feeds (chargecloud, EcoMovement, EnBW); für alle übrigen Säulen aus dem Register gibt es Standort und Leistung, aber weder Preis noch Belegung. In Deutschland gibt es keine zentrale Preisdatenbank für Strom (anders als MTS-K für Kraftstoff).
- **Belegung:** zählt nur, wenn die Meldung höchstens 2 Stunden alt ist (viele Feeds melden nur bei Änderung oder gar nicht mehr; im Test waren 76 % der Meldungen älter als 6 Stunden). Ältere Meldungen stehen grau als „Belegung unbekannt (nicht aktuell)“, in den Details mit dem letzten Stand.
- **Ausland:** Standorte und Belegung der Schweiz sind in derselben Schnittstelle (opendata.swiss), aber ohne Preise; dort zeigt die App „keine Preise in diesem Land“. Eigene Kartenpreise (Euro) gelten nur in Deutschland. Österreich: nicht enthalten; die E-Control-Ladestellen-Schnittstelle braucht eine kostenlose Registrierung (API-Schlüssel) und ist noch nicht eingebaut.
- **Favoriten:** Name, Betreiber und Koordinaten der Station (keine Nutzerdaten) auf dem Gerät; Favoriten außerhalb des Umkreises werden mit einer kleinen Suche (100 m) um die Station geladen – das findet sie auch, wenn sich ihre Kennung ändert.
- **Meine Ladekarte** (Eigeneingabe, bis 3 Karten: AC-, DC- und optional Preis ab 150 kW, optional nur bei bestimmten Betreibern): Es gibt keine offene Quelle für Karten-/App-Preise. Die Eingaben werden überall mit 💳 als Eigeneingabe gekennzeichnet, neben dem Direktpreis des Betreibers gezeigt und mit „Preis: Beste / Direkt / Karte“ wählbar. Zwei voneinander unabhängige Sicherungen:
  1. *Prüfung bei der Eingabe:* harte Grenzen (0,05–1,50 €/kWh), Plausibilität (üblicher Bereich, DC nicht unter AC, Abstand zum Median der Direktpreise in der Umgebung, große Änderung gegenüber vorher) und eine Zusammenfassung mit allen Hinweisen, die ausdrücklich bestätigt werden muss; jede Änderung steht im Verlauf der Eingaben.
  2. *Laufende Prüfung:* nach 30 Tagen fragt die App nach („Stimmt noch ✓“ mit Anzeige der Werte), nach 60 Tagen ohne Bestätigung wird die Karte nicht mehr angewendet; dazu ein Abgleich mit den Direktpreisen („Karte teurer als Direktzahlung“ an vielen Stationen → Hinweis, Eingaben zu prüfen).
- **Preise:** Direktbezahlung (Ad-hoc, ohne Ladekarte/Fahrstromvertrag): Energiepreis €/kWh, Startgebühr, Zeitpreis €/Min. (Blockiergebühr nach einer Frist). Die Quelle meldet „MwSt. enthalten“ nicht verlässlich; Nettopreise werden daran erkannt, dass Preis × 1,19 volle Cent ergibt, und mit 19 % umgerechnet. Angezeigt wird auf Cent gerundet.
- **Anfragen:** Preise-Bereich: eine Umkreissuche (Mittelpunkt auf ca. 100 m gerundet, höchstens 15 km, bis zu 3 Seiten à 1000) je Aktion, 4 Minuten zwischengespeichert; Tarife (≈ 50 KB, 1043 Stück) alle 12 Stunden. Route: alle 20 km ein Umkreis von 15 km (höchstens 45), nacheinander mit 0,4 s Pause, 10 Minuten zwischengespeichert. Nichts davon geht an Tankerkönig.

## Fremde Dienste im Bereich Route

- **Routing:** FOSSGIS-Server (routing.openstreetmap.de, Ausweich valhalla1.openstreetmap.de) – eine Anfrage pro Nutzeraktion, mindestens 1 s Abstand, 10 Minuten zwischengespeichert. Nutzungsbedingungen: https://www.fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/
- **Ortssuche:** Nominatim – nur beim Absenden (keine Suche beim Tippen), höchstens 1 Anfrage pro Sekunde, Treffer zwischengespeichert. Route: Deutschland und Nachbarländer; Preise-Bereich: nur Deutschland (Tankerkönig).
- **Preise am Weg:** zuerst die Daten der Bases; außerhalb nur mit eigenem Tankerkönig-Schlüssel und höchstens einer `list.php`-Abfrage pro Minute für die ganze App (Tankerkönig-Regel).
- **Österreich:** E-Control-Spritpreisrechner (api.e-control.at, ohne Schlüssel) – nur für Streckenabschnitte in Österreich: ein Punkt alle ~20 km (höchstens 12, auf ca. 100 m gerundet), nacheinander mit Pause, 15 Minuten zwischengespeichert, nach einem Fehlschlag 2 Minuten Pause. Je Abfrage höchstens 10 Tankstellen, mit Preis nur die günstigsten; Super 95 steht für E5/E10. Die Landesgrenze (OpenStreetMap, vereinfacht) entscheidet nur, wo abgefragt wird.
- Die Dienst-Adressen stehen in `endpoints.json`.
