# Quellen und Lizenzen

Die App enthält keine eigenen Preisdaten. Sie zeigt Daten Dritter und nutzt freie Software. Dieselbe Übersicht steht in der App unter ⚙ Einstellungen → „Quellen und Lizenzen“.

## Daten

| Daten | Quelle | Lizenz / Bedingungen | Wo in der App |
|---|---|---|---|
| Kraftstoffpreise Deutschland | [Tankerkönig](https://creativecommons.tankerkoenig.de) (Daten der Markttransparenzstelle für Kraftstoffe, Bundeskartellamt) | CC BY 4.0, Namensnennung „Tankerkönig / MTS-K“ | Fußzeile der Preise; Abruf durch das Daten-Repository (`KapahutE/tankpreise`) und Live-Abfrage mit eigenem Schlüssel |
| Kraftstoffpreise Österreich | [E-Control](https://www.e-control.at), Spritpreisrechner | Bedingungen der E-Control (Preise nur die jeweils günstigsten je Gegend) | Bereich Route |
| Ladestationen, Ladepreise, Belegung | [MobiData BW](https://mobidata-bw.de/dataset/e-ladesaulen) (OCPDB). Grundlage: Ladesäulenregister der Bundesnetzagentur; Preise und Belegung: Betreiber über [Mobilithek](https://mobilithek.info) | [Datenlizenz Deutschland – Namensnennung 2.0](https://www.govdata.de/dl-de/by-2-0) (Quelle nennen, Lizenz verlinken, Änderungen kenntlich machen; die App fasst Einträge zusammen und rechnet Preise um) | E-Modus (⚡ Strom) |
| Karten, Ortssuche, Routen | © [OpenStreetMap-Mitwirkende](https://www.openstreetmap.org/copyright) | ODbL. Kacheln: [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/); Ortssuche (Nominatim): [Usage Policy](https://operations.osmfoundation.org/policies/nominatim/); Routen: FOSSGIS (OSRM, Valhalla) | Karte, Ortssuche, Route |
| Marken-Logos | Symbole der Webseiten der Marken (Favicons), abgerufen über den Google-Favicon-Dienst | Marken der jeweiligen Inhaber | Tankstellenlisten |

## Software

| Bestandteil | Version | Lizenz | Hinweis |
|---|---|---|---|
| [Leaflet](https://leafletjs.com) | 1.9.4 | BSD-2-Clause | wird von unpkg geladen, mit Prüfsumme (SRI) |
| [Tesseract.js](https://github.com/naptha/tesseract.js) | 7.0.0 | Apache-2.0 | Belegleser, Dateien in `ocr/` (Lizenztexte dort) |
| [tesseract.js-core](https://github.com/naptha/tesseract.js-core) | 7.0.0 | Apache-2.0 | Tesseract OCR als WebAssembly, in `ocr/` |
| [Deutsche Sprachdaten](https://www.npmjs.com/package/@tesseract.js-data/deu) | 1.0.0 (`4.0.0_best_int`) | Apache-2.0 | `ocr/deu.traineddata.gz` |

Zum Testen (nicht Teil der App): Playwright (Apache-2.0), axe-core (MPL-2.0), ESLint (MIT).

## Eigene Inhalte

Texte, Symbole und Programmcode dieser App stammen vom Betreiber des Repositories. Eine Lizenz für den eigenen Code ist noch nicht festgelegt (siehe `docs/PROFESSIONALISIERUNG.md`); bis dahin gilt: alle Rechte vorbehalten.
