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
- **🛣️ Route** – Strecke planen (Start: Standort, Base oder Ort; Ziel per Suche) und die Tankstellen am Weg sehen: Abstand zur Strecke 1/2/5 km, günstigste und „lohnt sich am meisten inkl. Umweg“, Karte, Liste nach Strecken-km, Tankstopp als Zwischenziel an Google Maps / Apple Karten übergeben; echter Umweg (eine Matrix-Anfrage), Preis und Öffnung bei Ankunft (Prognose, Abfahrtszeit wählbar), Spritkosten der Fahrt, gemerkte Strecken, letzte Route bleibt nach dem Neustart
- **📈 Verlauf** – letzte 7 Tage, Preis nach Uhrzeit, Preisänderungen, Rangliste, Wochenreports
- **📒 Spritbüchle** (Hochdeutsch: Tankbuch) – Belege scannen, Tankungen, Statistik, Export (nur auf dem Gerät)

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Grundgerüst (Kopf, Leiste, Dialoge) |
| `app.css` | Aussehen (hell/dunkel) |
| `js/grund.js` | Einstellungen, Daten laden, Ort/Radius, Bausteine, Diagramme, Bereiche, Start |
| `js/route.js` | Bereich Route: Routing (FOSSGIS OSRM, Ausweich Valhalla), Tankstellen am Weg, Karte, Übergabe an Karten-Apps |
| `js/routegeo.js` | Geometrie: Polyline, Abstand zur Strecke, Kilometer ab Start, Umweg, Abfragepunkte |
| `endpoints.json` | Adressen von Routing- und Suchdienst (austauschbar ohne Code-Änderung) |
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

## Fremde Dienste im Bereich Route

- **Routing:** FOSSGIS-Server (routing.openstreetmap.de, Ausweich valhalla1.openstreetmap.de) – eine Anfrage pro Nutzeraktion, mindestens 1 s Abstand, 10 Minuten zwischengespeichert. Nutzungsbedingungen: https://www.fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/
- **Ortssuche:** Nominatim – nur beim Absenden (keine Suche beim Tippen), höchstens 1 Anfrage pro Sekunde, Treffer zwischengespeichert.
- **Preise am Weg:** zuerst die Daten der Bases; außerhalb nur mit eigenem Tankerkönig-Schlüssel und höchstens einer `list.php`-Abfrage pro Minute für die ganze App (Tankerkönig-Regel).
- Die Dienst-Adressen stehen in `endpoints.json`.
