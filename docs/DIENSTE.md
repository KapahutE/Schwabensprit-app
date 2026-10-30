# Bedingungen der Dienste Dritter

Stand: 20.10.2026. Quelle sind die jeweils genannten Seiten der Anbieter; das ist **keine Rechtsberatung**. Maßgeblich ist der aktuelle Wortlaut beim Anbieter.

## Überblick

| Dienst | Wofür | Bedingungen (kurz) | Eignung für eine öffentliche App |
|---|---|---|---|
| **Tankerkönig** (MTS-K) | Kraftstoffpreise Deutschland | CC BY 4.0, Namensnennung mit Link auf tankerkoenig.de (bei Apps auch im Store-Text); persönlicher Schlüssel; Umkreis ≤ 25 km, **1 Abfrage/Minute**; Abfragen **auf Nutzeraktion**, regelmäßige nicht ausgelöste Abfragen vermeiden; **Massenabfragen und Spiegeln auf eigenen Servern nur nach Absprache** (kommerzieller Service); Schlüssel nie auf GitHub veröffentlichen; keine Filterung der Ergebnisse, die der Nutzer nicht wünscht | **Nur nach Absprache** (siehe unten) |
| **MobiData BW** (OCPDB) | Ladestationen, Ladepreise, Belegung | Datenlizenz Deutschland – Namensnennung 2.0: Quelle nennen, Lizenz verlinken, Änderungen kenntlich machen; öffentliche API ohne Schlüssel | Ja, mit korrekter Namensnennung (ist umgesetzt); keine Verfügbarkeitszusage |
| **OSM-Kacheln** (`tile.openstreetmap.org`) | Kartenhintergrund | Tile Usage Policy: Best-Effort ohne SLA, Namensnennung, gültiger Referer/User-Agent, Zwischenspeichern, **kein Bulk-Download, keine starke Nutzung**; Sperre ohne Vorwarnung möglich | Nur bei geringer Last; sonst anderer Kartenanbieter oder eigener Server |
| **Nominatim** (`nominatim.openstreetmap.org`) | Ortssuche | Usage Policy: **max. 1 Anfrage/Sekunde** für die ganze App, gültiger Referer/User-Agent, Namensnennung; nutzerausgelöste Suchen sind ok bei „moderater“ Nutzerzahl; **Dienst muss ohne App-Update austauschbar sein** (ist über `endpoints.json` möglich); Proxy mit Zwischenspeicher empfohlen. Die App sucht erst beim Abschicken (keine Autovervollständigung) | Bei wenigen Nutzern ja, später eigener Proxy oder Anbieter |
| **FOSSGIS** (`routing.openstreetmap.de`, `valhalla1.openstreetmap.de`) | Routen | Fair-Use-Demoserver ohne Zusage; für Valhalla wird ein Limit von etwa 1 Anfrage/Nutzer/Sekunde genannt (Angabe aus Dritt-Dokumentation, nicht beim Betreiber geprüft); Austausch über `endpoints.json` möglich | Nur bei geringer Last; sonst eigener Server oder bezahlter Anbieter (z. B. OpenRouteService, GraphHopper) |
| **E-Control** (`api.e-control.at/sprit/1.0`) | Kraftstoffpreise Österreich (nur günstigste je Gegend) | Dokumentation unter `api.e-control.at/sprit/1.0/doc`; **keine eigenen Nutzungsbedingungen für diese Schnittstelle gefunden** (die veröffentlichten Bedingungen betreffen den Tarifkalkulator für Strom und Gas) | Offen: bei E-Control nachfragen |
| **GitHub** (API, Pages, Actions) | Daten lesen, Abruf starten, Hosting, Zeitplan | Pages: nicht für Betrieb eines Geschäfts oder Software-als-Dienst gedacht, **weiche Grenze 100 GB Datenverkehr/Monat**, Seite ≤ 1 GB; API: Ratenlimit je Schlüssel; Actions: geplante Läufe ohne Zeitgarantie | Für den Anfang ja; kommerziell nicht (Pages-Bedingungen) |
| **Google** (Favicon-Dienst `s2/favicons`) | Marken-Logos | inoffizielle Schnittstelle ohne Zusage; Google erfährt die Marken-Webseiten, die ein Nutzer sieht | Besser Logos selbst mitliefern (Markenrechte klären) |
| **unpkg** | Leaflet laden | Gemeinschafts-CDN ohne Zusage; Prüfsumme (SRI) schützt vor Veränderung | Besser selbst hosten (`js/` oder eigener Ordner) |
| **TCS Benzinpreis-Radar / Comparis** | Schweiz | Crowd-Daten; Comparis bezieht sie über eine Schnittstelle vom TCS; keine öffentliche Schnittstelle; Comparis sperrt Skripte (DataDome) | Nicht nutzbar ohne Vereinbarung mit dem TCS |

## Folgen für die Professionalisierung

1. **Tankerkönig entscheidet über „öffentliche Daten“.** Das Daten-Repository `KapahutE/tankpreise` ist **öffentlich lesbar** (am 21.10.2026 ohne Anmeldung geprüft: Rohdaten und `app-daten` sind abrufbar); ein einzelner Abruf (5 Bases, alle ~15–30 Min.) füllt es. Die Bedingungen sehen vor, dass Apps **auf Nutzeraktion** abfragen und dass das **Spiegeln der Daten auf eigenen Servern** eine Absprache erfordert („bitte mit uns in Kontakt treten, wir werden zusammen eine Lösung finden“). Die abgerufenen Preise der vier Bases liegen damit bereits öffentlich im Netz, was wie das beschriebene Spiegeln wirkt. Zwei saubere Wege: **Tankerkönig anschreiben** und die Nutzung absprechen, oder das **Repository auf privat stellen** (dann Actions-Minuten beachten: rund 57 Läufe am Tag mit je mindestens einer abgerechneten Minute ergeben etwa 1.700 Minuten im Monat, das liegt nahe am Kontingent privater Repositories im kostenlosen Tarif, sofern das dein Tarif ist). Für den Schlüssel selbst ändert sich nichts: Als Actions-Secret ist er auch in einem öffentlichen Repository nicht lesbar.
2. **Keine Schlüssel im Quelltext.** Auch der Demo-Schlüssel darf nicht auf GitHub stehen. Dieses Repository enthält keinen (geprüft: nur Platzhalter; der Schlüssel des Nutzers liegt im Gerätespeicher, der des Abrufs als Secret im Daten-Repository).
3. **Kein Filtern ohne Wunsch des Nutzers.** „Nur geöffnete“ ist standardmäßig aus und vom Nutzer wählbar; das muss so bleiben.
4. **Dienste mit Best-Effort (OSM-Kacheln, Nominatim, FOSSGIS, unpkg, Google-Logos)** tragen nur kleine Nutzerzahlen. Die Adressen für Routing, Ortssuche und E-Control stehen in `endpoints.json` und sind ohne Programmänderung austauschbar (bei neuen Hosts die Content-Security-Policy in `index.html` ergänzen; ein Test prüft das).
5. **Namensnennung** ist umgesetzt: Tankerkönig (verlinkt), MobiData BW mit Lizenz (korrigiert am 20.10.2026), OpenStreetMap, Leaflet; Übersicht in der App unter ⚙ und in `THIRD_PARTY.md`. Für einen Store-Eintrag gehört die Tankerkönig-Nennung auch in den Beschreibungstext.

## Quellen

- Tankerkönig: https://creativecommons.tankerkoenig.de (Abschnitte „Nutzungsbedingungen“, „Kommerzieller Service“)
- MobiData BW: https://mobidata-bw.de/dataset/e-ladesaulen (Lizenz: https://www.govdata.de/dl-de/by-2-0)
- OSMF: https://operations.osmfoundation.org/policies/tiles/ und https://operations.osmfoundation.org/policies/nominatim/
- GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- E-Control: https://api.e-control.at/sprit/1.0/doc
