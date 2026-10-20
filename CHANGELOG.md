# Änderungen

Neueste zuerst. Die Versionsnummer der App (`?v=…`, siehe `tools/version.js`) steht in den Einstellungen unter „Anzeige-Diagnose“.

## 20.10.2026 – Vorbereitung der Professionalisierung
- Linter (ESLint) und Barrierefreiheits-Prüfung (axe-core) in den Tests; Versionsnummer, Skript-Liste und Sicherheitsrichtlinie werden geprüft
- Barrierefreiheit: Schieberegler beschriftet, Überschrift 1. Ebene, Bereiche der Seite benannt, Kontrast der grauen Schrift in der hellen Darstellung
- Quellen und Lizenzen in den Einstellungen und in `THIRD_PARTY.md`; **Namensnennung der Ladedaten korrigiert** (Datenlizenz Deutschland – Namensnennung 2.0 statt „CC BY 4.0“), Tankerkönig verlinkt
- „Preise zu alt“ erst nach 90 Minuten (GitHub startet den Abruf nur etwa alle 30 Minuten)
- Veröffentlicht wird nur noch die App (`tools/publish.js` → `_site`), nicht mehr das ganze Repository (Tests, Dokumentation, Werkzeuge)
- Dokumentation: `docs/` (Architektur, Fahrplan, Bedingungen der Dienste, Entwürfe Datenschutz und Impressum); Dependabot; Vorlage für Fehlermeldungen

## 19.10.2026
- Karten liegen unter der Leiste unten und der Sortenwahl (eigene Ebene)
- iPhone: Leiste und Sortenwahl bleiben am Rand (ohne Weichzeichner, eigene Ebene, Korrektur bei Versatz), Anzeige-Diagnose

## 18.10.2026
- „Hinweis zur Aktualisierung“: kein falscher Alarm mehr durch den gespeicherten Stand beim Start

## 17.10.2026
- Android: Installieren, Karten-App (Maps-Intent, „Andere Karten-App“), Zurück-Taste, Symbole (maskable, monochrom), Verknüpfungen
- Witz vom Dag entfernt
- Offline-Start und Sofortstart mit gespeicherten Preisen (Service Worker, IndexedDB), schnellere Ladestationen, Content-Security-Policy, Tests im Repository (GitHub Actions), Tippflächen ≥ 44 px, Tank-Rat, Kosten je 100 km

## 16.10.2026
- E-Modus (⚡ Strom): Ladestationen mit Ladepreis, Leistung und Belegung; „Meine Ladekarte“ mit Eingabeprüfung; Favoriten
- Prüfung von Funktion, Logik und Geschwindigkeit, Fehler behoben

## 12.–14.10.2026
- Bereich Route: Tankstellen am Weg mit echtem Umweg, Preis bei Ankunft, gemerkte Strecken, Spritkosten; Österreich (E-Control) und Grenzvergleich
- Datenschutz: Standort gerundet, „Ortsdaten löschen“
- Belegleser verbessert

## 5.–11.10.2026
- Erstfassung: Preise, Karte, Verlauf, Preisprognose, „Wann tanken?“, 12-Uhr-Regel, Tankbuch (Spritbüchle) mit Belegleser, Schwäbisch-Modus, Marken-Logos
