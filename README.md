# Schwabensprit – App

Oberfläche der Tankpreis-App. Sie enthält **keine Daten**: Preise, Orte und Reports lädt sie mit dem
auf dem Gerät hinterlegten GitHub-Zugangsschlüssel aus dem privaten Daten-Repository.

## Aufbau

- **Dieses Repository** enthält die App und ist die einzige Quelle des App-Codes.
- **Daten-Repository** `KapahutE/tankpreise`: Abrufprogramm und Rohdaten auf `main`; die aufbereiteten App-Daten (`docs/data`, `docs/reports`) auf dem Zweig `app-daten`, der bei jedem Abruf mit genau einem Stand überschrieben wird (kein Verlauf, das Repository wächst nicht unnötig).
- Die App liest über die GitHub-API von `app-daten` (Rückfall auf `main`).


## Bereiche

Leiste unten mit drei Bereichen:

- **⛽ Preise** – Favoriten, günstigste Tankstelle, „Lohnt sich am meischda“, „Wann tanka?“ (12-Uhr-Regel, beste Tageszeit und Prognose in einer Empfehlung), Tankstellen als Top 10 (alle auf Wunsch) oder Karte
- **🛣️ Route** – Strecke planen (Start: Standort, Base oder Ort; Ziel per Suche) und die Tankstellen am Weg sehen: Abstand zur Strecke 1/2/5 km, günstigste und „lohnt sich am meisten inkl. Umweg“, Karte, Liste nach Strecken-km, Tankstopp als Zwischenziel an Google Maps / Apple Karten übergeben; echter Umweg (eine Matrix-Anfrage), Preis und Öffnung bei Ankunft (Prognose, Abfahrtszeit wählbar), Spritkosten der Fahrt, gemerkte Strecken, letzte Route bleibt nach dem Neustart; durch Österreich mit amtlichen Preisen der E-Control und dem Vergleich „Vor oder nach der Grenze tanken?“; Ortssuche auch in den Nachbarländern
- **⚡ E-Modus** – über „⚡ Strom“ neben den Kraftstoffsorten ein- und ausschaltbar (bleibt gespeichert): Bereich Preise zeigt Ladestationen im Umkreis (bis 15 km) mit Ladepreis (€/kWh, Direktbezahlung), Leistung (AC/DC, kW), Steckertypen und Belegung (frei / belegt / gestört, wo der Betreiber sie meldet), Filter nach Leistung, Sortierung, Liste oder Karte; Route zeigt Ladestationen am Weg; Verlauf entfällt. Ladung für die Ersparnis-Rechnung unter ⚙ („Ladung E-Modus“, Standard 30 kWh)
- **📈 Verlauf** – letzte 7 Tage, Preis nach Uhrzeit, Preisänderungen, Rangliste, Wochenreports
- **📒 Spritbüchle** (Hochdeutsch: Tankbuch) – Belege scannen, Tankungen, Statistik, Export (nur auf dem Gerät)

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Grundgerüst (Kopf, Leiste, Dialoge) |
| `app.css` | Aussehen (hell/dunkel) |
| `js/grund.js` | Einstellungen, Daten laden, Ort/Radius, Bausteine, Diagramme, Bereiche, Start |
| `js/strom.js` | E-Modus: Ladestationen und Ladepreise (MobiData BW OCPDB), Ansicht für Preise und Route |
| `js/route.js` | Bereich Route: Routing (FOSSGIS OSRM, Ausweich Valhalla), Tankstellen am Weg, Preise Österreich (E-Control), Grenzvergleich, Karte, Übergabe an Karten-Apps |
| `js/routegeo.js` | Geometrie: Polyline, Abstand zur Strecke, Kilometer ab Start, Umweg, Abfragepunkte |
| `endpoints.json` | Adressen von Routing-, Such- und E-Control-Dienst (austauschbar ohne Code-Änderung) |
| `js/witz.js` | „Witz vom Dag“: Hannes & Lena (eigene Figuren), Dialog Zeile für Zeile, abschaltbar unter ⚙ |
| `js/preise.js` | Bereich Preise, „Wann tanka?“, Karte, Detailansicht |
| `js/verlauf.js` | Auswertung, Bereich Verlauf, Wochenreports |
| `js/belegleser.js` | Belegfoto aufbereiten, Texterkennung (Tesseract.js in `ocr/`), Werte und Tankstelle erkennen |
| `js/tankbuch.js` | Bereich Tankbuch (IndexedDB), Vergleich, Erfassen, Export |

Die Skripte sind klassische Skripte ohne Build-Schritt und teilen sich den globalen Gültigkeitsbereich – die Reihenfolge in `index.html` zählt (`grund.js` zuerst).

Nach Änderungen an CSS/JS die Versionsnummer erneuern, damit iPhones nicht alte Dateien aus dem Zwischenspeicher nehmen:

```sh
v=$(cat app.css js/*.js | sha1sum | cut -c1-8); sed -i -E "s/\?v=[0-9a-f]+/?v=$v/g" index.html
```

## Ladestationen (E-Modus)

- **Quelle:** MobiData BW „OCPDB“ (api.mobidata-bw.de/ocpdb/api/public) – offen, ohne Schlüssel, bundesweit, mit CORS. Die Adresse steht in `endpoints.json` (`evApi`).
  - **Standorte:** Bundesnetzagentur-Ladesäulenregister (CC BY 4.0) und Betreiber-Feeds der Mobilithek (DATEX II; CC0 bzw. CC BY 4.0). Doppelte Meldungen derselben Säule (Register + Betreiber) und viele Ladepunkte desselben Betreibers an einem Ort werden zusammengefasst.
  - **Belegung** (frei / belegt / gestört) und **Preise** kommen nur aus den Betreiber-Feeds (chargecloud, EcoMovement, EnBW); für alle übrigen Säulen aus dem Register gibt es Standort und Leistung, aber weder Preis noch Belegung. In Deutschland gibt es keine zentrale Preisdatenbank für Strom (anders als MTS-K für Kraftstoff).
- **Preise:** Direktbezahlung (Ad-hoc, ohne Ladekarte/Fahrstromvertrag): Energiepreis €/kWh, Startgebühr, Zeitpreis €/Min. (Blockiergebühr nach einer Frist). Die Quelle meldet „MwSt. enthalten“ nicht verlässlich; Nettopreise werden daran erkannt, dass Preis × 1,19 volle Cent ergibt, und mit 19 % umgerechnet. Angezeigt wird auf Cent gerundet.
- **Anfragen:** Preise-Bereich: eine Umkreissuche (Mittelpunkt auf ca. 100 m gerundet, höchstens 15 km, bis zu 3 Seiten à 1000) je Aktion, 4 Minuten zwischengespeichert; Tarife (≈ 50 KB, 1043 Stück) alle 12 Stunden. Route: alle 20 km ein Umkreis von 15 km (höchstens 45), nacheinander mit 0,4 s Pause, 10 Minuten zwischengespeichert. Nichts davon geht an Tankerkönig.

## Fremde Dienste im Bereich Route

- **Routing:** FOSSGIS-Server (routing.openstreetmap.de, Ausweich valhalla1.openstreetmap.de) – eine Anfrage pro Nutzeraktion, mindestens 1 s Abstand, 10 Minuten zwischengespeichert. Nutzungsbedingungen: https://www.fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/
- **Ortssuche:** Nominatim – nur beim Absenden (keine Suche beim Tippen), höchstens 1 Anfrage pro Sekunde, Treffer zwischengespeichert. Route: Deutschland und Nachbarländer; Preise-Bereich: nur Deutschland (Tankerkönig).
- **Preise am Weg:** zuerst die Daten der Bases; außerhalb nur mit eigenem Tankerkönig-Schlüssel und höchstens einer `list.php`-Abfrage pro Minute für die ganze App (Tankerkönig-Regel).
- **Österreich:** E-Control-Spritpreisrechner (api.e-control.at, ohne Schlüssel) – nur für Streckenabschnitte in Österreich: ein Punkt alle ~20 km (höchstens 12, auf ca. 100 m gerundet), nacheinander mit Pause, 15 Minuten zwischengespeichert, nach einem Fehlschlag 2 Minuten Pause. Je Abfrage höchstens 10 Tankstellen, mit Preis nur die günstigsten; Super 95 steht für E5/E10. Die Landesgrenze (OpenStreetMap, vereinfacht) entscheidet nur, wo abgefragt wird.
- Die Dienst-Adressen stehen in `endpoints.json`.
