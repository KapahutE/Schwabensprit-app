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
- **📈 Verlauf** – letzte 7 Tage, Preis nach Uhrzeit, Preisänderungen, Rangliste, Wochenreports
- **📒 Tankbuch** – Belege scannen, Tankungen, Statistik, Export (nur auf dem Gerät)

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Grundgerüst (Kopf, Leiste, Dialoge) |
| `app.css` | Aussehen (hell/dunkel) |
| `js/grund.js` | Einstellungen, Daten laden, Ort/Radius, Bausteine, Diagramme, Bereiche, Start |
| `js/preise.js` | Bereich Preise, „Wann tanka?“, Karte, Detailansicht |
| `js/verlauf.js` | Auswertung, Bereich Verlauf, Wochenreports |
| `js/belegleser.js` | Belegfoto aufbereiten, Texterkennung (Tesseract.js in `ocr/`), Werte und Tankstelle erkennen |
| `js/tankbuch.js` | Bereich Tankbuch (IndexedDB), Vergleich, Erfassen, Export |

Die Skripte sind klassische Skripte ohne Build-Schritt und teilen sich den globalen Gültigkeitsbereich – die Reihenfolge in `index.html` zählt (`grund.js` zuerst).

Nach Änderungen an CSS/JS die Versionsnummer erneuern, damit iPhones nicht alte Dateien aus dem Zwischenspeicher nehmen:

```sh
v=$(cat app.css js/*.js | sha1sum | cut -c1-8); sed -i -E "s/\?v=[0-9a-f]+/?v=$v/g" index.html
```
