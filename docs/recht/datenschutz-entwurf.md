# Datenschutzerklärung (Entwurf)

> Entwurf, nicht rechtlich geprüft. Platzhalter in `[eckigen Klammern]` ausfüllen.

## 1. Verantwortlicher

[Vor- und Nachname / Firma], [Straße Hausnummer], [PLZ Ort], E-Mail: [E-Mail-Adresse]

## 2. Grundsatz

„Schwabensprit“ ist eine Web-App, die Kraftstoffpreise und Ladestationen anzeigt. Die App hat **keinen eigenen Server, keine Nutzerkonten und kein Tracking**. Es werden keine Analyse- oder Werbedienste eingesetzt.

## 3. Daten auf deinem Gerät

Folgendes wird ausschließlich im Speicher deines Geräts (Browser bzw. installierte App) abgelegt und nicht an den Verantwortlichen übertragen: Einstellungen, Favoriten, eigene Ladekarten-Preise, das Spritbüchle (Tankbuch), gemerkte Strecken, zuletzt gesuchte Orte, der zuletzt geladene Stand der Preise und Ladestationen (Zwischenspeicher für schnellen Start und Betrieb ohne Netz) sowie, wenn du sie einträgst, dein Zugangsschlüssel für das Daten-Repository. Mit „Ortsdaten löschen“ in den Einstellungen kannst du Standort-, Routen- und Zwischenspeicherdaten löschen; weitere Daten löschst du über die Einstellungen deines Browsers bzw. durch Entfernen der App. [Rechtsgrundlage für die technisch erforderliche Speicherung: prüfen, § 25 Abs. 2 TDDDG.]

Belege, die du im Spritbüchle fotografierst, werden **auf dem Gerät** ausgelesen (Texterkennung) und nicht hochgeladen.

## 4. Standort

Dein Standort wird nur nach deiner Freigabe (Betriebssystem) und nur bei der Auswahl „Mein Standort“ abgefragt. Er wird höchstens auf etwa 100 m gerundet gespeichert und gerundet an die unten genannten Dienste gesendet. Rechtsgrundlage: Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) durch die Freigabe; du kannst sie jederzeit in den Einstellungen deines Geräts widerrufen.

## 5. Dienste, die beim Benutzen Daten erhalten

Beim Abruf übermittelt dein Gerät jeweils technisch notwendig **deine IP-Adresse** an den Dienst. Die App sendet nur das Genannte:

| Dienst (Anbieter) | Zweck | Inhalt der Anfrage |
|---|---|---|
| GitHub Pages / GitHub API (GitHub, Inc., USA) | Auslieferung der App; Abruf der Preisdaten | Abruf der App-Dateien; Abruf der Preisdaten mit deinem Schlüssel (kein Standort) |
| FOSSGIS e.V. (Routing) | Route berechnen | Start und Ziel (bei „Mein Standort“ auf ca. 100 m gerundet), Tankstellen am Weg |
| OpenStreetMap Foundation | Ortssuche (Nominatim), Karte (Kacheln) | Suchtext; Kartenausschnitt |
| Tankerkönig | Live-Preise (nur mit eigenem Schlüssel) | ein Punkt (ca. 100 m gerundet) und dein Schlüssel |
| MobiData BW | Ladestationen (E-Modus) | Mittelpunkt (ca. 100 m gerundet) und Radius; im Bereich Route Punkte entlang der Strecke (gerundet) |
| E-Control (Österreich) | Preise in Österreich | Punkte auf der Strecke dort (ca. 100 m gerundet), Sorte |
| Google Maps / Apple Karten / Karten-App deiner Wahl | Navigation | nur beim Antippen von „Tankstopp“/„Route“: Ziel und Tankstelle, bei festem Start auch der Start |
| Google (Favicon-Dienst) | Marken-Logos | Internetadresse der Marke |
| unpkg | Kartenbibliothek laden | Abruf der Datei (kein Standort) |

[Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (Betrieb der App); bei Übermittlung in die USA: Angaben zu Garantien (z. B. EU-US Data Privacy Framework) prüfen. Hinweis: Die Liste ändert sich, wenn Dienste ersetzt werden, z. B. Logos oder Leaflet künftig selbst gehostet werden.]

## 6. Server-Logs beim Hoster

Beim Abruf der App verarbeitet der Hoster (GitHub Pages) technisch notwendige Daten wie IP-Adresse, Zeitpunkt und abgerufene Datei. Auf diese Protokolle hat der Verantwortliche keinen Zugriff. [prüfen]

## 7. Deine Rechte

Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch sowie Beschwerde bei einer Aufsichtsbehörde ([zuständige Behörde]). Da der Verantwortliche keine personenbezogenen Daten der Nutzer speichert, beschränken sich diese Rechte im Wesentlichen auf die oben genannten Dienste; wende dich dafür an deren Anbieter.

## 8. Änderungen

Stand: [Datum]. Der Text wird angepasst, wenn sich die App ändert.
