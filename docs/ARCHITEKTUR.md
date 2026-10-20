# Architektur

Stand: 20.10.2026. Beschreibt, wie die App aufgebaut ist und wo Daten fließen. Für die Dienste Dritter siehe `DIENSTE.md`, für den Fahrplan `PROFESSIONALISIERUNG.md`.

## Überblick

```
Tankerkönig (MTS-K, CC BY 4.0)
        │  list.php je Base (25 km), 4 Bases, alle ~15–30 Min.
        ▼
Daten-Repository  KapahutE/tankpreise  (privat, GitHub Actions, Python)
   main:       Rohdaten (data/), Programm tankpreise.py
   app-daten:  aufbereitete JSON-Dateien (docs/data, docs/reports), ein einziger Commit, bei jedem Abruf überschrieben
        │  GitHub-API (Zugangsschlüssel nur auf dem Gerät)
        ▼
App-Repository  KapahutE/Schwabensprit-app  ──GitHub Pages──►  Browser / installierte App (iPhone, Android)
                                                                  │  direkt vom Gerät, ohne eigenen Server:
                                                                  ├─ MobiData BW (Ladestationen, Ladepreise, Belegung)
                                                                  ├─ FOSSGIS OSRM / Valhalla (Routen), Nominatim (Ortssuche)
                                                                  ├─ OSM-Kacheln (Karte), unpkg (Leaflet)
                                                                  ├─ E-Control (Österreich), Tankerkönig (Live, eigener Schlüssel)
                                                                  └─ Google (Marken-Logos), Google Maps / Apple Karten (Übergabe)
```

Es gibt **keinen eigenen Server**. Alles, was nicht aus dem Daten-Repository kommt, ruft das Gerät selbst bei den Diensten ab.

## Daten-Repository (Abruf)

- Workflow `tankpreise.yml`: Zeitplan `1-59/5 * * * *` (alle 5 Minuten angestoßen), das Programm ruft aber höchstens alle 13 Minuten ab (`--min-interval 13`); montags 04:37 UTC Wochenreport. GitHub führt geplante Läufe verzögert aus: **tatsächlich Median 29 Minuten, bis 57 Minuten** (Messung über 100 Läufe).
- Vier Bases (`bases.json`: F Uhingen, H Leinfelden, S Metzingen, MJ Wernau), je 25 km Radius. Der Schlüssel liegt als Secret `TANKERKOENIG_API_KEY`.
- Ergebnis: `docs/data/<Base>/latest.json`, `history.json`, `changes.json`, `forecast.json`, `reports.json` sowie `docs/reports/`. Veröffentlicht per Force-Push als einzelner Commit auf `app-daten` (das Repository wächst dadurch nicht). Rohdaten bleiben auf `main`.

## App (dieses Repository)

Klassische Skripte ohne Build-Schritt; alle teilen sich den globalen Gültigkeitsbereich, die Reihenfolge in `index.html` zählt.

| Datei | Aufgabe |
|---|---|
| `index.html` | Gerüst, Dialoge, Content-Security-Policy (Meta-Tag) |
| `app.css` | Aussehen (hell/dunkel), Ebenen (z-index), Tippflächen |
| `js/grund.js` | Speicher (`store`, IndexedDB `kv`), Daten laden (`fetchData`: Netz → Zwischenspeicher), Ort/Radius, Bausteine, Diagramme, Bereiche, Einstellungen, Installation, Service Worker |
| `js/preise.js` | Bereich Preise, „Wann tanken?“, Tank-Rat, Karte, Detailansicht |
| `js/verlauf.js` | Auswertung, Bereich Verlauf, Wochenreports |
| `js/route.js`, `js/routegeo.js` | Route: Routing, Tankstellen am Weg, Österreich, Grenzvergleich, Geometrie |
| `js/strom.js`, `js/ladekarte.js` | E-Modus: Ladestationen, Ladepreise, Belegung, „Meine Ladekarte“ |
| `js/tankbuch.js`, `js/belegleser.js` | Spritbüchle (Tankbuch) und Belegleser (OCR auf dem Gerät) |
| `sw.js` | Service Worker: Sofortstart und Betrieb ohne Netz |

## Daten im Gerät

- **localStorage** (nur auf dem Gerät): Einstellungen (`repo`, `token`, `tk`, `tokenExp`, `dialect`, `tank`, `cons`, `kwh`, `evcons`, `homeBase`), Auswahl (`fuel`, `ev`, `tab`, `loc`, `radius`, `sortBy`, `viewMode`, `onlyOpen`, `lvl`), Favoriten und Karten (`favs`, `evFavs`, `evCards`, `evBasis`, …), Route (`rtA`, `rtB`, `rtLast`, `rtSaved`, `rtRecent`, `rtKeep`, …), Zwischenwerte (`logos`, `hoursCache`, `liveCache`, `dataMode`).
- **IndexedDB** `schwabensprit-cache` (Zwischenspeicher: zuletzt geladene Preise `d:data/…`, Ladestationen `ev:last`) und `schwabensprit` (Spritbüchle).
- **Service Worker** `sw-shell-2` (Startseite, Manifest, Symbole), `sw-files-2` (Skripte und Stile je Version), `sw-ocr-2` (Belegleser, 13 MB). Preisdaten laufen nie über den Worker.
- „Ortsdaten löschen“ in den Einstellungen leert Standort-, Routen- und Zwischenspeicherdaten.

## Start und Aktualisierung

1. `index.html` kommt sofort aus dem Service Worker; im Hintergrund wird auf eine neue Version geprüft („Neue Version bereit – tippen zum Neuladen“).
2. Die App zeigt den zuletzt gespeicherten Stand (`instantView`, vorläufig) und lädt die frischen Daten; schlägt das fehl, bleibt der gespeicherte Stand („Gespeichert · …“).
3. Skripte und Stile tragen `?v=<Hash>` (`tools/version.js`); ein Test stellt sicher, dass die Nummer zu den Dateien passt.

## Veröffentlichung

`pages.yml` baut bei jedem Push auf `main` den Ordner `_site` (`tools/publish.js`: nur App-Dateien) und veröffentlicht ihn über GitHub Pages. `tests.yml` führt Linter, Versionsprüfung, Unit- und Browser-Tests (iPhone- und Android-Emulation) aus.

## Sicherheit

- Content-Security-Policy erlaubt nur die genannten Dienste (`connect-src`), Skripte nur aus der App und von unpkg (mit Prüfsumme); keine Inline-Skripte. Der Belegleser braucht `wasm-unsafe-eval`.
- Der GitHub-Zugangsschlüssel liegt im `localStorage` des Geräts (fein eingeschränkt: nur das Daten-Repository, Contents lesen, Actions schreiben). Das ist für den Eigengebrauch vertretbar, für andere Nutzer nicht (siehe Fahrplan, Stufe 2).
- Standort wird nur mit Freigabe abgefragt, auf ca. 100 m gerundet gespeichert und gerundet an Dienste gesendet.

## Bekannte Grenzen

- Geplante GitHub-Läufe sind unregelmäßig (Median 29 Min.); ein externer Zeitgeber wäre verlässlicher.
- Jedes Gerät braucht einen eigenen Zugangsschlüssel für das private Daten-Repository.
- Die Seite scrollt als Ganzes; feste Leisten (unten, Sortenwahl) hängen dadurch am Anzeigebereich des Browsers. Auf dem iPhone (installierte App) gibt es dafür bekannte WebKit-Fehler, siehe README.
- Gemeinsamer globaler Gültigkeitsbereich: Namen dürfen sich nicht überschneiden (Linter prüft Verwendung, nicht Doppelungen).
