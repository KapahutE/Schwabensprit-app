# E-Mail an Tankerkönig – Vorlage

**An:** info@tankerkoenig.de
(Quelle: [Impressum](https://tankerkoenig.de/impressum) und [AGB](https://onboarding.tankerkoenig.de/static/img/AGB-Tankerkoenig.pdf), Tankerkönig UG (haftungsbeschränkt), Niederhöfen 5, 87484 Nesselwang, Geschäftsführer Hermann Kurz; auf [creativecommons.tankerkoenig.de](https://creativecommons.tankerkoenig.de) steht unter „Kommerzieller Service“, dass bei Massenabfragen, Daten auf eigenen Servern und aufbereiteten historischen Daten eine individuelle Lösung gesucht wird)

**Betreff:** Anfrage zur freien API – private Spritpreis-App, Ausbau auf den Raum Stuttgart–Ulm–Tübingen

---

Sehr geehrter Herr Kurz, sehr geehrtes Tankerkönig-Team,

ich betreibe privat und ohne Gewinnabsicht eine kleine Web-App („Schwabensprit“) zum Vergleich von Spritpreisen im Raum Stuttgart/Göppingen. Dafür nutze ich Ihre freie API (registriert mit der E-Mail-Adresse [Adresse der Registrierung]). Bevor ich die Nutzung ausbaue, möchte ich sicherstellen, dass mein Vorgehen mit Ihren Bedingungen vereinbar ist.

**Heutiger Stand**
- Ein Skript (GitHub Actions) ruft die Preise ab, höchstens alle 15 Minuten (tatsächlich meist alle 30 bis 45 Minuten). Je Abruf sind es 5 Umkreisabfragen (`list.php`, Radius 25 km), im Durchschnitt also deutlich weniger als eine Anfrage pro Minute.
- Erfasst werden rund 440 Tankstellen. Preisänderungen werden als Verlauf gespeichert; daraus entstehen Auswertungen (Tageszeiten, Wochenreport, Prognose) und aufbereitete Dateien für die App.
- Die Daten liegen in einem GitHub-Repository, das derzeit öffentlich lesbar ist. Die App nutze ich selbst, [mit Familie und Freunden / nur ich – bitte anpassen]. Die Quelle „Tankerkönig.de, CC BY 4.0“ ist in der App mit Link genannt.

**Geplant**
- Ausweitung auf das Gebiet Stuttgart – Ludwigsburg – Schwäbisch Gmünd – Ulm – Tübingen einschließlich eines Randstreifens: etwa 8 Umkreisabfragen je Abruf, weiterhin höchstens alle 15 Minuten, rund 500 Tankstellen, zusammengeführt in einem gemeinsamen Datenbestand mit Verlauf.
- Die App zeigt die Preise rund um den Standort oder die Wohnadresse der Nutzer; die Umkreisauswahl geschieht auf dem Gerät.

**Meine Fragen**
1. Ist dieses Abrufmuster mit der freien API vereinbar, oder gibt es Obergrenzen für Anzahl und Häufigkeit der Abfragen?
2. Darf ich die Daten in einem Repository speichern und aufbereitet (aktuelle Preise, Verlauf) an die App ausliefern? Falls das als Spiegeln gilt: Unter welchen Bedingungen ist es möglich, und muss das Repository privat sein?
3. Gibt es für dieses Gebiet eine geeignetere Lösung, etwa den Zugang zum Open-Data-Archiv oder Ihren kommerziellen Service? Falls ja, wie sehen die Konditionen für eine nicht kommerzielle, private Nutzung aus?
4. Gibt es über die Quellenangabe hinaus Vorgaben zur Namensnennung?

**Zum Schluss noch eine grundsätzliche Frage:** Wäre aus Ihrer Sicht auch eine **kommerzielle Nutzung** möglich, etwa wenn die App später mit Werbung oder gegen Entgelt angeboten würde [nach Bedarf anpassen]? Und welche **Rahmenbedingungen** würden dafür gelten (Vertrag, Kosten, Abfragekontingent, Speichern und Weitergabe aufbereiteter Daten, Nutzung des Archivs, Namensnennung, Haftung)?

Falls das mit Ihnen nicht möglich ist: **Woher beziehen Sie Ihre Daten?** Auf Ihrer Seite steht, dass die Markttransparenzstelle für Kraftstoffe (MTS-K) beim Bundeskartellamt den Zugang ausschließlich lizenzierten Spritpreis-Informationsdiensten gewährt. Könnten Sie mir sagen, an wen ich mich dort wenden könnte und ob es eine andere Bezugsquelle für den Raum Stuttgart–Ulm–Tübingen gibt?

Ich bestätige, dass ich weder Mineralölunternehmen noch Tankstellenbetreiber bin und auch nicht für solche tätig bin. Über eine kurze Antwort, gern in Textform, würde ich mich sehr freuen.

Mit freundlichen Grüßen

[Vorname Nachname]
[Ort]
[E-Mail-Adresse]

---

## Hintergrund zu den Schlussfragen (nicht Teil der E-Mail)
Laut [creativecommons.tankerkoenig.de](https://creativecommons.tankerkoenig.de) (abgerufen am 30.10.2026):
- **Datenquelle:** Alle rund 14.000 Tankstellen in Deutschland melden die Preise für Super E5, Super E10 und Diesel an die **Markttransparenzstelle für Kraftstoffe (MTS-K)**, eine Abteilung des Bundeskartellamts. Der Zugang zu diesen Daten ist über diese Behörde **ausschließlich lizenzierten Spritpreis-Informationsdiensten** möglich. Die freie API von Tankerkönig ist der Weg für alle anderen.
- **Auflagen der MTS-K** gelten auch für Tankerkönig-Nutzer: Die Daten dürfen weder unmittelbar an Mineralölunternehmen und Tankstellenbetreiber (einschließlich verbundener Unternehmen) noch an für sie tätige IT-Dienstleister gegeben werden.
- **Kommerziell:** Tankerkönig bietet einen „Kommerziellen Service“ mit individueller Lösung (Massenabfragen, Daten auf eigenen Servern, aufbereitete historische Daten). Das Open-Data-Archiv (Preisverläufe, nur für angemeldete Nutzer) steht unter **CC BY-NC-SA 4.0**: nichtkommerzielle Nutzung ist frei, für kommerzielle Nutzung ist ein kostenpflichtiger Vertrag nötig; „SA“ verlangt außerdem, abgeleitete Daten unter gleicher Lizenz weiterzugeben.
- **Eigener Weg:** Wer die MTS-K-Daten direkt beziehen will, muss laut Tankerkönig als lizenzierter Spritpreis-Informationsdienst bei der MTS-K (Bundeskartellamt) zugelassen sein. Die Bedingungen dafür habe ich nicht geprüft; sie müssten dort erfragt werden.

## Vor dem Absenden prüfen
- Platzhalter in eckigen Klammern ausfüllen; den **API-Schlüssel nicht** in die E-Mail schreiben.
- Den Absatz zum Nutzerkreis anpassen (nur ich / Familie und Freunde / öffentlich). Bei einem öffentlichen Angebot ist die Absprache zwingend (siehe `docs/DIENSTE.md`).
- Die Frage zur kommerziellen Nutzung konkretisieren (Werbung, Abo, Einmalkauf) oder streichen, wenn sie nicht gestellt werden soll. Die heutige Nutzung bleibt als „privat, ohne Gewinnabsicht“ beschrieben, die Frage ist ausdrücklich zukunftsgerichtet.
- Zahlen aus dem Stand vom 30.10.2026: 5 Abfragen, rund 440 Tankstellen; geplant etwa 8 Abfragen, rund 500 Tankstellen.
- Antwort aufbewahren und in `docs/DIENSTE.md` festhalten.
