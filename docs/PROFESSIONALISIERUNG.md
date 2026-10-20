# Fahrplan zur Professionalisierung

Stand: 20.10.2026. Ziel: die App von einem persönlichen Werkzeug zu etwas machen, das andere zuverlässig und rechtssicher nutzen können. Die Schritte hängen vom **Zielkreis** ab; deshalb stehen unten Stufen und die Entscheidungen, die nur der Betreiber treffen kann.

## Was schon erledigt ist (Stufe 0, Stand heute)

| Bereich | Stand |
|---|---|
| Funktion | Preise, Karte, Verlauf, Prognose, „Wann tanken?“, Route (D, A), E-Modus, Spritbüchle mit Belegleser; iPhone und Android; Betrieb ohne Netz |
| Tests | 63 Unit-Prüfungen, 65 (iPhone) bzw. 66 (Android) Browser-Prüfungen, bei jedem Push in GitHub Actions |
| Code-Qualität | ESLint ohne Befund (5.400 Zeilen, kein undefinierter Name); Versionsnummer, Skript-Liste, Sicherheitsrichtlinie und Veröffentlichungsordner werden geprüft |
| Barrierefreiheit | axe-core (WCAG 2.1 AA) ohne Verstöße in allen Hauptansichten, hell und dunkel; **noch nicht** mit Screenreader auf echten Geräten geprüft |
| Veröffentlichung | nur App-Dateien auf GitHub Pages (`tools/publish.js`), Änderungsprotokoll (`CHANGELOG.md`), Dependabot, Vorlage für Fehlermeldungen |
| Quellen | Namensnennung vollständig und korrigiert (MobiData BW: Datenlizenz Deutschland – Namensnennung 2.0), Übersicht in der App und in `THIRD_PARTY.md`, Bedingungen der Dienste in `DIENSTE.md` |
| Betrieb | Hinweis „Preise zu alt“ ohne Fehlalarm (Schwelle 90 Min.), Anzeige-Diagnose mit Version |

## Offene Entscheidungen (nur der Betreiber kann sie treffen)

1. **Zielkreis:** nur du / Familie und Freunde / öffentlich. Bestimmt die Stufe unten.
2. **Lizenz des eigenen Codes** (z. B. MIT, GPL oder „alle Rechte vorbehalten“). Ohne Lizenzdatei gilt „alle Rechte vorbehalten“. Ich habe keine festgelegt.
3. **Name und Marke** „Schwabensprit“ (Markenrecherche, Domain). Ich habe nichts geprüft.
4. **Verantwortlicher für Datenschutz und Impressum** (Name, Anschrift, E-Mail): Entwürfe liegen in `docs/recht/` mit Platzhaltern; ob ein Impressum nötig ist, hängt von der Art des Angebots ab (privat/nicht geschäftsmäßig oder nicht) und sollte geprüft werden.
5. **Tankerkönig anschreiben** (nur nötig bei Stufe 2): Spiegeln und öffentliches Bereitstellen der Daten braucht laut Bedingungen eine Absprache (`DIENSTE.md`).
6. **Budget** für Betrieb (Domain, Karten-/Routing-Anbieter, ggf. kleiner Server) und die Frage, ob Daten bei Dritten liegen dürfen (z. B. externer Zeitgeber).

## Stufe 1 – Familie und Freunde (wenige Nutzer, kleiner Aufwand)

| Schritt | Warum | Aufwand |
|---|---|---|
| Zugang vereinfachen: pro Person ein nur lesender, befristeter GitHub-Schlüssel (Contents: Read) statt Vollzugriff; Anleitung | Heute braucht jeder einen eigenen Schlüssel mit Schreibrecht für Actions | klein |
| Leaflet selbst hosten statt unpkg | eine Abhängigkeit weniger, Datenschutz (kein Dritter beim Laden) | klein |
| Marken-Logos selbst mitliefern statt Google-Favicons | Datenschutz; Markenrechte klären | mittel |
| Externer Zeitgeber für den Abruf (z. B. cron-job.org ruft `workflow_dispatch` auf) oder das Programm auf einem eigenen kleinen Rechner (`crontab.example`, `tankpreise.service` liegen im Daten-Repository) | GitHub-Zeitplan liefert nur etwa alle 30 Min. statt 15 | klein |
| Ausfallmeldung (Mail oder Push), wenn der Abruf > 90 Min. steht | Betrieb ohne ständiges Nachsehen | klein |
| Lizenzdatei und Name festlegen (Entscheidungen 2 und 3) | Klarheit, was andere dürfen | klein |

## Stufe 2 – Öffentlich

| Schritt | Warum | Aufwand |
|---|---|---|
| **Tankerkönig-Absprache** (Entscheidung 5) | ohne sie dürfen die Daten nicht öffentlich bereitgestellt werden | klein (Mail), Wartezeit |
| Preisdaten öffentlich bereitstellen (statisch, z. B. Cloudflare Pages/R2 oder GitHub Pages mit eigenem Datenzweig) | kein Schlüssel pro Nutzer mehr, keine GitHub-Ratenlimits | mittel |
| Eigener bzw. bezahlter Karten-, Routing- und Suchdienst, über `endpoints.json` austauschbar | OSM-/FOSSGIS-Dienste sind für Dauerlast nicht gedacht (`DIENSTE.md`) | mittel, laufende Kosten |
| Datenschutzerklärung und Impressum als eigene Seiten (Entwürfe in `docs/recht/`), Link in der App | rechtliche Pflicht bei öffentlichem Angebot | klein bis mittel, rechtliche Prüfung |
| Fehlerberichte (anonym, ohne Tracking) und Statusseite | Probleme bei Nutzern sehen | mittel |
| Eigene Adresse (Domain), Sicherheits-Header (Cloudflare oder Netlify statt GitHub Pages) | Vertrauen, `frame-ancestors`, HSTS | klein bis mittel |
| Prüfung mit Screenreader (VoiceOver, TalkBack) auf echten Geräten, Tests auf echten Geräten und Browsern (Safari, Chrome, Samsung Internet) | automatische Prüfung findet nur einen Teil der Probleme | mittel |
| Support-Kanal (GitHub Issues sind vorbereitet) und Datenquellen-Hinweise in der Beschreibung | Erwartungen klären | klein |

## Stufe 3 – Ausbau

- Umbau auf Module mit Build-Schritt (z. B. Vite), später Typen: bessere Wartbarkeit und kleinere, schnellere Auslieferung; erst sinnvoll vor vielen neuen Funktionen.
- Preisalarm als Push-Nachricht (braucht ein kleines Backend und Abonnements).
- Eintrag im Google Play Store (Trusted Web Activity; Entwicklerkonto nötig). Für den Apple App Store werden reine Web-Apps oft abgelehnt; die installierte Web-App reicht auf dem iPhone.
- Eigene Datenhaltung statt Git-Zweig (Verlauf, Statistik), falls die Nutzung wächst.

## Empfohlene Reihenfolge

Bleibt es bei Familie und Freunden: Stufe 1, etwa ein bis zwei Arbeitstage. Soll es öffentlich werden: zuerst Entscheidung 5 (Tankerkönig anschreiben, denn das braucht Zeit), parallel Stufe 1, danach Stufe 2. Stufe 3 erst, wenn sich die Nutzung zeigt.
