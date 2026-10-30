# Kommerzialisierung von Schwabensprit – Überlegungen

Stand: 30.10.2026. **Keine Rechts- oder Steuerberatung.** Rechtliche Aussagen sind meine Lesart der verlinkten Quellen; vor einer Entscheidung klären Anwalt, Steuerberater und die genannten Stellen. Zahlen sind **Annahmen oder Richtwerte** (gekennzeichnet) und müssen vor einer Entscheidung geprüft werden; Quellen stehen am Ende. Ergänzt `PROFESSIONALISIERUNG.md` (Fahrplan für den Betrieb mit Familie und Freunden) und `DIENSTE.md` (Bedingungen der Datendienste).

## 0. Kurzfassung

1. **Machbar, aber schwierig.** Der Engpass ist weder die Technik noch das Geld für den Start, sondern drei andere Dinge: der **Datenzugang** (rechtlich), die **geringe Zahlungsbereitschaft** (Wettbewerber verlangen etwa 2 bis 5 € im Jahr) und die **Reichweite** (eine Region ergibt grob 5.000 bis 15.000 Nutzer als Obergrenze, Annahme).
2. **Datenzugang entscheidet über alles.** Die freie Tankerkönig-API ist für Apps „auf Nutzeraktion“ gedacht; regelmäßiges Abrufen, Massendaten und Spiegeln brauchen eine Absprache. Der eigene Weg (Zulassung als Verbraucher-Informationsdienst) verlangt ein **bundesweites, öffentliches** Angebot. Kommerziell tragfähig ist also nur: (a) ein **Vertrag mit Tankerkönig** (Preis auf Anfrage) oder (b) ein **bundesweites eigenes Angebot** (6 bis 12 Monate Zulassung, eigene Infrastruktur).
3. **Wirtschaftlichkeit (Modell, Annahmen in Abschnitt 6):** Mit Premium (4,99 €/Jahr) und Werbung ergeben sich etwa **0,7 bis 0,9 € Umsatz je aktivem Nutzer und Jahr**. Der Betrieb ist bei rund **4.000 bis 7.000** aktiven Nutzern pro Monat kostendeckend, mit einer Datenlizenz von 3.000 €/Jahr bei **9.000 bis 15.000**. Für 6.000 € Gewinn im Jahr braucht es etwa 14.000 bis 22.000 Nutzer. Das liegt an oder über der regionalen Obergrenze.
4. **Was den Wert hebt:** Funktionen, die **nicht** an die eingeschränkt nutzbaren Preisdaten gebunden sind (Spritbüchle/Fahrtenbuch mit Belegleser und Steuer-Export, E-Auto-Ladepreise aus MobiData BW), Affiliate-Partner und regionale Kooperationen. Mit einem Umsatz von 1,5 € je Nutzer wäre schon bei etwa 7.000 Nutzern ein kleiner Gewinn möglich.
5. **Pflichten fallen früh an:** Sobald die App öffentlich und geschäftsmäßig betrieben wird: Gewerbe, Impressum, Datenschutz, Einwilligungen (bei Werbung), Verbraucherrecht für Abos, Lizenzen der Kartendienste (die kostenlosen Dienste sind für den Dauerbetrieb nicht gedacht). Das meiste davon ist günstig, aber Pflicht.
6. **Empfehlung:** In Stufen mit Prüfpunkten vorgehen (Abschnitt 12): erst Antwort von Tankerkönig, dann ein sauberer, kostenloser öffentlicher Betrieb mit Pflichtangaben, erst danach Bezahlfunktionen. Das Risiko bleibt klein, solange Gewerbe, Verträge und Store-Apps noch nicht begonnen sind.

## 1. Ziel festlegen (bestimmt alles Weitere)

| Ziel | Bedeutung | Nötige Nutzer (Modell) | Aufwand |
|---|---|---|---|
| **A Hobby, kostenneutral** | Betrieb deckt sich selbst, kein Gewerbe nötig, solange keine Gewinnabsicht und keine nachhaltige Einnahmeerzielung besteht (steuerlich klären) | wenige hundert, Spenden genügen | niedrig |
| **B Nebeneinkommen** (z. B. 3.000 bis 6.000 € Gewinn/Jahr) | Gewerbe, Kleinunternehmerregelung möglich | 14.000 bis 22.000 aktive Nutzer bei Umsatz 0,7 bis 0,9 €; bei 1,5 € etwa 7.000 | hoch (Abende und Wochenenden über 12 bis 18 Monate) |
| **C Hauptberuf** (ab 30.000 € Gewinn/Jahr) | Rechtsform, Mitarbeiter oder Aufträge, Betriebsorganisation | weit über der regionalen Obergrenze, nur mit bundesweitem Angebot oder B2B2C | sehr hoch |

**Offene Fragen an dich:** Welches Ziel? Wie viel Zeit pro Woche? Gibt es einen Arbeitsvertrag (Nebentätigkeit anzeigen oder genehmigen lassen, Wettbewerbsverbot)? Open Source oder geschlossen?

## 2. Der Datenzugang: die Weiche

| Weg | Was | Kommerziell? | Voraussetzungen | Bewertung |
|---|---|---|---|---|
| **A: freie Tankerkönig-API** | CC BY 4.0, Schlüssel je Nutzer, höchstens 1 Abfrage/Minute, Umkreis ≤ 25 km | **Nur im Sinne der Bedingungen:** Abfragen auf Nutzeraktion; **regelmäßige, nicht ausgelöste Abfragen und Massendaten sind ausgeschlossen** („geblockt, Schlüssel deaktiviert“); Spiegeln nur nach Absprache | Namensnennung, im Store-Text; keine Filterung ohne Wunsch des Nutzers; keine Mineralölunternehmen | skaliert nicht (1 Abfrage/Minute je Schlüssel; ein gemeinsamer Server-Schlüssel für alle Nutzer ist damit nicht tragfähig) |
| **B: Vertrag mit Tankerkönig** („Kommerzieller Service“) | individuelle Lösung für Massenabfragen, Daten auf eigenen Servern, aufbereitete historische Daten | ja, Preis auf Anfrage | Verhandlung; Auflagen der MTS-K gelten weiter | **realistischster Weg für eine regionale oder kleine App**; E-Mail-Vorlage in `docs/recht/` |
| **C: eigene Zulassung als Verbraucher-Informationsdienst (VID)** | Daten direkt von der MTS-K über die Mobilithek | ja (viele zugelassene Dienste finanzieren sich über Werbung und Abos) | **bundesweit alle Tankstellen, bundesweit abrufbar, nicht auf einen Nutzerkreis beschränkt, auf Dauer**; keine Gebühren; 6 bis 12 Monate; Mobilithek-Anbindung; Beschwerdestelle | nur als **bundesweites Produkt**; sonst nicht zulassungsfähig |
| **D: Open-Data-Archiv von Tankerkönig** | Preisverläufe, nur für angemeldete Nutzer | **nur gegen Vertrag** (CC BY-NC-SA 4.0; „SA“ verlangt gleiche Lizenz für Ableitungen) | Anmeldung | nur für Verlauf und Prognose, nicht für aktuelle Preise |

**Verwendungszweck bei Weg B und C:** Die MTS-K-Daten dürfen **ausschließlich zur Verbraucherinformation** verwendet werden, nicht für die Mineralölwirtschaft, Tankstellenbetreiber, deren Verbände und IT-Dienstleister. Auch Analysen, aufbereitete oder aggregierte Daten dürfen nicht zu anderen Zwecken angeboten werden. Folgen:
- **Datenverkauf und eine öffentliche Programmierschnittstelle auf den Daten scheiden aus.**
- **B2B (Flotten, Lieferdienste, Händler):** Ob das noch „Verbraucherinformation“ ist, ist unklar und müsste bei der MTS-K oder Tankerkönig geklärt werden; Mineralöl-Kunden sind ausgeschlossen.
- Wer Daten **weitergibt oder bereitstellt**, ist für die zweckgemäße Verwendung durch Dritte mitverantwortlich. Ein **öffentlich lesbares Daten-Repository** (wie heute) ist damit kaum vereinbar (meine Lesart); ein kommerzielles Angebot braucht Zugangsregeln (Nutzungsbedingungen, kein offenes Spiegeln).

**Darum zuerst die Antwort von Tankerkönig abwarten.** Alles Weitere in diesem Dokument hängt davon ab, welcher Weg (A bis C) offen ist.

## 3. Produkt und Wettbewerb

**Wettbewerber:** ADAC, clever-tanken, Mehr-Tanken, 1-2-3 Tanken, Tankerkönig-App und viele weitere zugelassene Dienste (Liste beim Bundeskartellamt); dazu Kartendienste, die selbst Preise zeigen. Bezahl-Abos dort liegen laut Presseberichten bei etwa **2 bis 5 € im Jahr** (z. B. 1-2-3 Tanken Plus 4,99 €/Jahr; Stand der Berichte teils 2022 bis 2024, Preise im Store prüfen).

**Eigene Stärken (Hypothesen, mit Nutzern zu prüfen):**
- Ersparnis nach **Füllstand** („was spare ich wirklich?“), „lohnt sich der Weg?“ inkl. Umweg, 12-Uhr-Regel, Prognose und Wochenreport,
- **Datenschutz:** kein Konto, kein Tracking, Standort bleibt auf dem Gerät, Ort nur gerundet gespeichert (heute weitgehend so gebaut; ein Backend würde das einschränken),
- **Tankbuch mit Belegleser** auf dem Gerät (Texterkennung ohne Cloud),
- **E-Auto-Ladepreise** (MobiData BW, Datenlizenz Deutschland – Namensnennung 2.0, kommerzielle Nutzung mit Quellenangabe erlaubt),
- Route mit echtem Umweg, Betrieb ohne Netz, Schwäbisch (Alleinstellung, Regionalbezug).

**Schwächen:** keine Marke, keine Reichweite, kostenlose Platzhirsche, zurzeit nur eine Region, Preisdaten nur über Dritte, Datenaufbereitung hängt an GitHub Actions (unzuverlässiger Zeitgeber, ein Ausfall von 29 Stunden ist bereits vorgekommen).

**Zielgruppen für Zahlungsbereitschaft:** Vielfahrer und Pendler (Preisalarme, Ersparnis), Selbstständige mit Firmenwagen (Fahrtenbuch, Kfz-Kosten, Steuer-Export), E-Auto-Fahrer (Ladekosten, Karten-Vergleich), Familien und Gruppen (Familien-Abo).

## 4. Einnahmen

| Modell | Beschreibung | Ertrag (Annahmen) | Einschränkungen | Eignung |
|---|---|---|---|---|
| **Premium-Abo** | werbefrei, Preisalarme per Push, Prognose, mehrere Orte, Wochenreport, Tankbuch-Export | 4,99 €/Jahr brutto; netto je zahlendem Nutzer etwa 3,56 € nach 19 % USt und 15 % Store-Provision; Konversion 1 bis 3 % | Verbraucherrecht (Abschnitt 7); Aktualisierungspflicht für digitale Produkte | Grundpfeiler, aber allein zu wenig (Umsatz je Nutzer etwa 0,07 €) |
| **Einmalkauf** („Lifetime“) | 9,99 € | wie Abo, aber kein wiederkehrender Umsatz | Updatepflicht bleibt | als Wahlmöglichkeit |
| **Werbung** | Banner oder native Anzeigen | etwa 0,5 €/Jahr je Nutzer bei 1,50 € je 1.000 Einblendungen, 40 Einblendungen im Monat, 70 % mit Einwilligung (Annahme); bei 3 €/60 Einblendungen etwa 1,5 € | Einwilligungsverwaltung (TDDDG), Werbekennzeichnung, bezahlte Platzierungen dürfen die Preis-Rangfolge nicht verändern; wirkt gegen den Datenschutz-Auftritt | sinnvoll nur außerhalb der Preisliste |
| **Affiliate** | Ladekarten, Strom- und Gastarife, Kfz-Versicherung, Tankkarten (für Privatkunden) | etwa 0,1 €/Jahr je Nutzer (Annahme: 0,2 bis 0,3 % Abschlüsse bei 30 € Provision) | Kennzeichnung als Werbung; Anbieter-Auswahl; keine Mineralölunternehmen als Datenempfänger | Zusatz |
| **Regional-Sponsoring** | „Präsentiert von“ (Autohaus, Werkstatt, Stadtwerke) | 50 bis 300 €/Monat je Sponsor (grobe Spanne, Annahme) | muss klar als Werbung erkennbar sein und darf Preislisten nicht beeinflussen | gut, je Sponsor viel Aufwand |
| **White-Label (B2B2C)** | Widget oder App für Stadtwerke, Autoclubs, Verbünde, Arbeitgeber | einzeln verhandelbar | **Nutzung der MTS-K-Daten nur zur Verbraucherinformation**, kein Mineralöl; mit Tankerkönig und MTS-K klären | höchster Hebel, aber Vertrieb |
| **Spenden** | GitHub Sponsors, Ko-fi, Steady | wenige Euro bis zu zwei- oder dreistelligem Betrag im Monat (Annahme) | steuerlich erfassen | Zusatz, Ziel A |
| **Datenverkauf, Auswertungen, Programmierschnittstelle** | – | – | **unzulässig** (siehe Abschnitt 2) | ausgeschlossen |

**Kennzahlen (Modell, Konversion 2 %, Premium 4,99 €, Werbung 1,50 €):** Premium allein 0,07 €/Nutzer, Werbung plus Affiliate 0,60 €, zusammen **0,67 €**. Mit 9,99 € Premium 0,74 €, mit 14,99 € und 3 % Konversion 0,91 €, mit Werbung zu 3 € und 60 Einblendungen 1,61 €.

## 5. Ausgaben

**Einmalig (Richtwerte, Annahmen):**

| Posten | Betrag | Bemerkung |
|---|---|---|
| Rechtstexte (AGB, Datenschutzerklärung, Widerrufsbelehrung, Impressum) durch einen Anwalt oder eine Kanzlei prüfen lassen | 1.500 bis 3.500 € | ersetzt keine laufende Beratung; Generatoren sind billiger, aber haften nicht |
| Markenrecherche, Markenanmeldung beim DPMA | 300 bis 800 € | Anmeldegebühr 290 € (online, bis 3 Klassen; Annahme, prüfen); „Schwabensprit“ ist möglicherweise schwer schützbar (beschreibend) |
| Gewerbeanmeldung | 20 bis 60 € | je Gemeinde |
| Entwicklerkonten (Apple 99 USD/Jahr, Google 25 USD einmalig) | etwa 130 € | Apple verlangt für Organisationen eine D-U-N-S-Nummer |
| Sicherheitsprüfung (Penetrationstest) | 0 bis 4.000 € | optional, bei Konten und Zahlungen sinnvoll |
| Barrierefreiheitsprüfung durch Dritte | 0 bis 4.000 € | gesetzlich für Kleinstunternehmen nicht Pflicht (Abschnitt 7) |
| Entwicklung (Abschnitt 8) | **65 bis 110 Personentage** | eigene Zeit; extern bei 500 €/Tag etwa 33.000 bis 55.000 € (Annahme) |

**Laufend je Jahr (Modell, Annahmen):**

| Posten | 1.000 Nutzer | 5.000 | 20.000 | 100.000 |
|---|---|---|---|---|
| Server, Datenbank, Netzwerk | 300 | 600 | 1.200 | 3.000 |
| Karten (Kacheln), Routing, Ortssuche (kommerzielle Anbieter oder eigener Server) | 300 | 600 | 2.400 | 9.600 |
| Fehlerüberwachung, Statistik ohne Tracking, E-Mail | 240 | 600 | 1.200 | 3.000 |
| Entwicklerkonten, Domain | 105 | 105 | 105 | 105 |
| Steuerberater, Buchführung | 600 | 1.200 | 2.000 | 4.000 |
| Versicherung (Betriebs-/IT-Haftpflicht, Cyber) | 400 | 600 | 900 | 2.000 |
| Rechtsberatung laufend | 0 | 300 | 600 | 2.000 |
| **Summe Betrieb** | **1.945** | **4.005** | **8.405** | **23.705** |
| Marketing (Nutzergewinnung) | 0 | 1.000 | 5.000 | 20.000 |
| **Datenlizenz Tankerkönig** | **unbekannt, auf Anfrage** | | | je 1.000 € Lizenz sind etwa 1.500 zusätzliche Nutzer nötig |

Nicht enthalten: Einkommen-, Gewerbe- und Umsatzsteuer, Sozialabgaben, Zahlungsgebühren, Kosten einer Rechtsform (UG/GmbH: Notar, Handelsregister, Bilanz).

**Zahlungsgebühren (Quellen):** Stripe 1,5 % + 0,25 € je Zahlung (Standardkarten EWR); Apple Small Business Program 15 % bis 1 Mio. USD Jahresumsatz; Google Play 15 % für Abos und für die ersten 1 Mio. USD, danach 30 % (Konditionen ändern sich, vor Entscheidung prüfen); Händler-von-Rekord-Anbieter (Paddle, Lemon Squeezy) etwa 5 % + 0,50 USD (Annahme, prüfen), übernehmen dafür die Umsatzsteuer im EU-Ausland.

## 6. Wirtschaftlichkeit (Modellrechnung, alle Annahmen offen)

Annahmen: Premium 4,99 € brutto, Konversion 2 % (Spanne 1 bis 3 %), Werbung 1,50 € je 1.000 Einblendungen, 40 Einblendungen/Monat, 70 % einwilligende Nutzer, Affiliate 0,10 €/Nutzer, Betriebskosten wie oben **ohne Marketing und ohne Datenlizenz**, Provision 15 %.

| Umsatz je aktivem Nutzer und Jahr | Betrag |
|---|---|
| Premium 4,99 € + Werbung | 0,67 € |
| Premium 9,99 € + Werbung | 0,74 € |
| Premium 14,99 € + Werbung (Konversion 3 %) | 0,91 € |
| nur Premium 14,99 € (3 %), kein Werbeeinsatz | 0,42 € |
| nur Premium 4,99 € (2 %), kein Werbeeinsatz | 0,17 € |
| nur Werbung 1,50 € + Affiliate | 0,60 € |
| nur Werbung 3,00 € (60 Einblendungen) + Affiliate | 1,61 € |

| Umsatz je Nutzer | Kostendeckung | 6.000 €/Jahr Gewinn | 12.000 €/Jahr Gewinn | Kostendeckung mit 3.000 € Datenlizenz |
|---|---|---|---|---|
| 0,67 € | etwa 6.800 Nutzer | 22.100 | 34.700 | 14.800 |
| 0,90 € | 3.800 | 14.100 | 23.400 | 9.200 |
| 1,50 € | 1.500 | 7.100 | 12.100 | 4.500 |

**Plausibilitätsprüfung der Reichweite (grobe Annahme):** Raum Stuttgart–Ulm–Tübingen mit etwa 1,5 Mio. Pkw; eine regionale Nischen-App erreicht 0,3 bis 1 % davon, also **4.500 bis 15.000 Nutzer**. Bei 0,67 € je Nutzer sind das **3.000 bis 10.000 € Umsatz im Jahr**, vor Kosten. Ein Gewinn entsteht nur mit Umsatz je Nutzer über etwa 1,5 € oder mit einem bundesweiten Angebot.

**Hebel in dieser Reihenfolge:** (1) Datenlizenz günstig verhandeln, (2) Funktionen mit echter Zahlungsbereitschaft (Fahrtenbuch/Steuer, Preisalarme, Familien-Abo), (3) Affiliate und regionale Sponsoren, (4) Reichweite (bundesweit, Kooperationen), (5) Kosten niedrig halten (ein Server statt vieler Dienste, EU-Anbieter mit Gratiskontingent).

**Empfindlichkeit:** Jede Annahme ist unsicher. Besonders die Konversion (1 bis 3 %), die Anzeigenpreise (halb oder doppelt) und die Datenlizenz bewegen das Ergebnis stärker als die Serverkosten.

## 7. Rechtliche Vorgaben und Pflichten

Reihenfolge nach Zeitpunkt: **vor einem öffentlichen Angebot**, **vor der ersten Einnahme**, **laufend**.

### 7.1 Vor einem öffentlichen Angebot (auch kostenlos)
- **Impressum** nach § 5 DDG für „geschäftsmäßige, in der Regel gegen Entgelt angebotene digitale Dienste“: Name, Anschrift (keine Postfachadresse), E-Mail und ein zweiter schneller Kontaktweg, ggf. Register- und USt-IdNr. Ob ein kostenloses Hobbyangebot darunter fällt, ist eine Einzelfallfrage; sobald Werbung oder Abos dazukommen, ist es Pflicht. Entwurf: `docs/recht/impressum-entwurf.md`.
- **Datenschutzerklärung** (Art. 13 DSGVO): Verantwortlicher, Zwecke, Rechtsgrundlagen, Empfänger (GitHub, Hosting, Karten-/Ortssuchdienste, Zahlungsanbieter, Store-Betreiber), Drittlandübermittlung (USA), Speicherdauer, Rechte, Beschwerde bei der Aufsichtsbehörde (Baden-Württemberg: Landesbeauftragter für den Datenschutz). Entwurf: `docs/recht/datenschutz-entwurf.md`.
- **Standortdaten** sind personenbezogen. Vorteil der heutigen Bauweise: Der Ort verlässt das Gerät nicht (Preise kommen als Gebietsdateien, die Auswahl geschieht lokal; GPS wird auf etwa 100 m gerundet gespeichert). Das ist ein **Datenschutz-Verkaufsargument**; jedes Backend (Preisalarme, Konten) muss es neu begründen.
- **Verarbeitungsverzeichnis** (Art. 30), **Auftragsverarbeitungsverträge** (Art. 28) mit Hoster, E-Mail-, Fehler-, Zahlungsdiensten, **Datenpannen-Verfahren** (Meldung binnen 72 Stunden, Art. 33), Auskunfts- und Löschprozess. Einen Datenschutzbeauftragten braucht es erst ab 20 Personen, die ständig mit automatisierter Verarbeitung befasst sind (§ 38 BDSG).
- **Einwilligung (TDDDG § 25):** Für alles, was nicht „unbedingt erforderlich“ ist (Werbung, Analyse, Tracking), vorher einwilligen lassen (Einwilligungsverwaltung). Funktions-Speicher (Einstellungen, Zwischenspeicher) ist ausgenommen.
- **Quellenangaben und Lizenzen** (Abschnitt 7.5), **Kartenanbieter wechseln** (Abschnitt 8).
- **Tankerkönig** will bei öffentlichen Diensten Link und Info; **Quellenangabe im Store-Text**.

### 7.2 Vor der ersten Einnahme
- **Gewerbeanmeldung** (Gewerbeordnung) bei der Gemeinde; **steuerliche Erfassung** beim Finanzamt (Fragebogen, Frist ein Monat; Prüfung, ob eine Gewinnerzielungsabsicht vorliegt). **Nebentätigkeit** beim Arbeitgeber anzeigen oder genehmigen lassen.
- **Kleinunternehmerregelung** (§ 19 UStG, seit 2025): Vorjahresumsatz bis 25.000 € und laufendes Jahr bis 100.000 € netto; dann keine Umsatzsteuer ausweisen. Wichtig bei Verkauf an Verbraucher im EU-Ausland: besondere Regeln (One-Stop-Shop, Schwelle 10.000 € EU-weit; Annahme, vom Steuerberater klären lassen). Über den Store zahlt Apple/Google die Umsatzsteuer an den Staat.
- **Gewerbesteuer:** Freibetrag 24.500 € Gewerbeertrag für natürliche Personen und Personengesellschaften (§ 11 GewStG). **IHK-Beitrag** fällt an (Freistellung bei kleinem Ertrag möglich, prüfen). **Einkommensteuer**, Vorauszahlungen, **Krankenversicherung** je nach Status (Nebenberuf oder hauptberuflich).
- **Rechtsform:** Einzelunternehmen (einfach, unbeschränkte Haftung, deshalb Haftpflicht- und Cyber-Versicherung), später UG (haftungsbeschränkt) oder GmbH (25.000 € Stammkapital) bei größerem Risiko. Empfehlung: **mit Einzelunternehmen starten**, UG erst bei spürbarem Umsatz.
- **Verbraucherrecht für Abos und Käufe:** Preisangabe als Endpreis inklusive Umsatzsteuer (Preisangabenverordnung); „zahlungspflichtig bestellen“-Schaltfläche (§ 312j BGB); vorvertragliche Informationen (Art. 246a EGBGB); **Widerrufsrecht** bei digitalen Inhalten mit Hinweis auf das Erlöschen bei sofortigem Beginn; **Kündigungsschaltfläche** „Verträge hier kündigen“ und Bestätigungsseite für online abschließbare Verträge (§ 312k BGB, siehe Quelle); Mindestlaufzeit und Verlängerung (§ 309 Nr. 9 BGB: nach der Erstlaufzeit jederzeit kündbar); **Pflichten für digitale Produkte** (§§ 327 ff. BGB: Mängelrechte und Aktualisierungen, auch bei kostenpflichtigen Apps), **AGB** (§§ 305 ff. BGB). Hinweis zur Verbraucherstreitbeilegung (je nach Teilnahmebereitschaft).
- **Zahlung:** Käufe im Store (Apple/Google, Pflicht für digitale Inhalte in der App, Provision 15 bis 30 %) oder im Web (Stripe, Händler-von-Rekord-Anbieter). Für die Installation als Web-App ist nur der Web-Weg möglich.
- **Store-Pflichten:** In der EU zeigen Apple und Google die **Anbieterdaten** (Name, Anschrift, E-Mail, Telefon) öffentlich (Händlerstatus nach dem Gesetz über digitale Dienste); privat gewohnte Adresse deshalb vermeiden (Büro-/Geschäftsadresse). Datenschutz-Angaben im Store (Apple „App-Datenschutz“, Google „Datensicherheit“).

### 7.3 Laufende Pflichten
- **Wettbewerbsrecht (UWG):** Werbung kennzeichnen; bei Rangfolgen die Hauptparameter offenlegen (§ 5b UWG); **bezahlte Platzierung darf Preisrangfolgen nicht verfälschen** und muss erkennbar sein; keine irreführenden Ersparnisangaben (die Berechnung ist in `TANKFUELLSTAND.md` dokumentiert, im Zweifel Haftungshinweis „Angaben ohne Gewähr“).
- **Barrierefreiheit (BFSG, seit 28.06.2025):** Kleinstunternehmen (weniger als 10 Beschäftigte und höchstens 2 Mio. € Umsatz oder Bilanzsumme), die **Dienstleistungen** anbieten, sind ausgenommen (§ 3 Abs. 3 BFSG). Das gilt für einen Einzelentwickler; bei Wachstum oder Beschäftigten (ab 10 Personen) müssen Online-Verträge barrierefrei sein. Der Grundstein ist gelegt (axe-core ohne Befund); echte Prüfung mit Screenreader steht aus.
- **Aufbewahrung und Buchführung:** Belege 8 bis 10 Jahre (Handelsrecht/Abgabenordnung, Fristen prüfen), Einnahmenüberschussrechnung; bei Rechnungen an Unternehmen ab 2025/2027 elektronisches Rechnungsformat (Übergangsfristen, nur bei B2B relevant).
- **MTS-K-Pflichten (nur bei Weg C):** Beschwerdestelle mit Kontaktdaten in der App, **wöchentlich** Beschwerden an die MTS-K (Mobilithek), Daten **unverändert** und aktuell, Quellenangabe mit Logo, Änderungen der Angaben sofort melden.
- **Datenschutz laufend:** Anfragen betroffener Personen binnen eines Monats, Löschung, Aktualisierung der Dokumentation bei neuen Diensten, Prüfung der Dienstleister.
- **Sicherheit:** angemessene technische und organisatorische Maßnahmen (Art. 32 DSGVO), bei Zahlungen keine Karten-Daten selbst speichern (Anbieter).

### 7.4 Haftung
- **Datenqualität:** Die MTS-K prüft die gemeldeten Daten nicht inhaltlich; Fehler sind möglich. Hinweis „Preise ohne Gewähr“, Meldeweg für falsche Daten (bei Weg C Pflicht), Aktualitätsanzeige (ist bereits vorhanden).
- **Haftungsrisiko** bei Verbraucher-Apps ist gering, aber nicht null (Fehlinformationen, Datenpanne, Abmahnung wegen fehlendem Impressum oder Datenschutz). **Versicherung** (Betriebs-/IT-Haftpflicht, Cyber) und saubere Pflichtangaben sind die günstigste Absicherung.

### 7.5 Lizenzen und Bedingungen Dritter
| Dienst | Aussage der Bedingungen | Folge bei kommerziellem Betrieb |
|---|---|---|
| Tankerkönig, freie API | on demand, keine Massendaten, 1 Abfrage/Minute, Namensnennung, keine Filter ohne Nutzerwunsch | siehe Abschnitt 2 |
| OpenStreetMap-Kacheln (`tile.openstreetmap.org`) | Zugang „best effort, kein SLA“; **kommerzielle Dienste müssen damit rechnen, dass der Zugang jederzeit entzogen wird**; kein Vorladen großer Gebiete | **eigene oder bezahlte Kacheln** nötig (z. B. Anbieter mit Vertrag) |
| Nominatim (Ortssuche) | höchstens 1 Anfrage/Sekunde, **keine schweren Nutzungen**; periodische Abfragen aus Apps gelten als Massenabfrage, höchstens bei „sehr wenigen Nutzern“ mit Zwischenspeicher; für zahlende Kunden ausdrücklich Vorsicht | **eigener Ortssuch-Dienst** (Nominatim/Photon selbst betreiben) oder Anbieter mit Vertrag |
| FOSSGIS-Routing (`routing.openstreetmap.de`) | höchstens 1 Anfrage/Sekunde, kein Scraping, keine schwere Nutzung, Quellenangabe | eigener OSRM- oder Valhalla-Server (Deutschland/DACH) oder Anbieter mit Vertrag |
| Google-Favicon-Dienst für Marken-Logos | nicht dokumentierter Dienst; Marken gehören den Inhabern | **eigene Logo-Sammlung mit Genehmigung** oder neutrale Symbole |
| MobiData BW (Ladestationen) | Datenlizenz Deutschland – Namensnennung 2.0 | kommerziell nutzbar mit Quellenangabe und Hinweis auf Änderungen |
| E-Control Österreich | keine eigenen Bedingungen auffindbar | vor kommerziellem Einsatz schriftlich klären (oder Österreich weglassen) |
| OpenStreetMap-Daten | ODbL: Namensnennung, ggf. Weitergabe unter gleichen Bedingungen bei abgeleiteten Datenbanken | Hinweis in der App, bei eigenen Kartenabzügen beachten |
| Software (Leaflet BSD-2, Tesseract Apache-2.0, Sprachdaten Apache-2.0) | Lizenztexte beilegen | bereits in `THIRD_PARTY.md`, Store-Hinweise ergänzen |

### 7.6 Marke, Name, Code-Lizenz
- **Name:** Recherche beim DPMA und EUIPO sowie nach Domains und Store-Namen („Schwabensprit“ ist ein Wortspiel aus einer Region und einem Gattungsbegriff, schutzfähig ist es nur eingeschränkt).
- **Code-Lizenz:** Heute keine festgelegt (alle Rechte vorbehalten, obwohl das Repository öffentlich ist). Optionen: geschlossen betreiben (Repository privat), **Quelloffen mit Einschränkung** (z. B. nicht kommerziell), **Copyleft** (AGPL: Konkurrenten dürfen die App nur bei offenem Code betreiben), **Doppellizenz**. Die Wahl beeinflusst Förderungen (Open-Source-Förderungen) und Wettbewerbsschutz.

## 8. Technische Maßnahmen und Notwendigkeiten

**Ist-Stand:** Statische App (GitHub Pages), Datenaufbereitung in GitHub Actions (Cron, Git als Ablage), Zugriff mit persönlichem GitHub-Schlüssel (Tankerkönig-Schlüssel nur als Secret), keine Konten, kein Server, 97 Unit- und 95 Browser-Prüfungen, axe ohne Befund, ESLint, Versionsprüfung, CSP, Dependabot. **Das ist für den Privatgebrauch richtig und für ein kommerzielles Angebot nicht ausreichend.**

| Arbeitspaket | Inhalt | Aufwand (Annahme) |
|---|---|---|
| **1 Datenplattform** | verlässlicher Zeitgeber statt GitHub Actions (eigener Server mit Cron/Warteschlange), Datenbank (Preisänderungen, Stationen), Anbindung der Datenquelle (Tankerkönig-Vertrag oder Mobilithek), Überwachung | 8 bis 15 Tage |
| **2 Öffentlicher Datenzugang** | statische oder zwischengespeicherte Gebietsdateien über CDN **ohne** GitHub-Schlüssel; Nutzungsbedingungen, Ratenbegrenzung, kein offenes Spiegeln | 3 bis 5 Tage |
| **3 Zahlung und Berechtigungen** | Zahlungsanbieter (Stripe oder Händler-von-Rekord), Webhooks, **Lizenzschlüssel ohne Konto** (datensparsam), „Wiederherstellen“, Kündigungsschaltfläche, Rechnungen | 8 bis 12 Tage |
| **4 Store-Pakete** | Capacitor (iOS/Android) oder Trusted Web Activity, Signierung, In-App-Kauf (Apple IAP, Google Play Billing), Store-Einträge, Prüfverfahren (Apple verlangt Mehrwert gegenüber einer reinen Web-App) | 10 bis 15 Tage |
| **5 Preisalarme (Push)** | Web-Push (installierte iPhone-App ab iOS 16.4) oder FCM/APNs über die native Hülle; Server-Jobs; Einwilligung; Standort nur als grobe Gebietszuordnung | 8 bis 12 Tage |
| **6 Werbung (falls gewählt)** | Werbe-SDK oder -Netzwerk, Einwilligungsverwaltung (zertifiziert), Platzierung ohne Beeinflussung der Preisliste | 4 bis 7 Tage |
| **7 Datenschutz-Technik** | Einwilligungsmodul, Löschfunktion, Protokolle, Statistik ohne Cookies (z. B. selbst gehostet), Datenfluss-Dokumentation | 3 bis 5 Tage |
| **8 Betrieb** | Überwachung und Alarme, Sicherungen, Statusseite, CI/CD mit Testumgebung, Notfallhandbuch, Fehlerüberwachung (EU-Anbieter) | 5 bis 8 Tage |
| **9 Sicherheit** | Bedrohungsmodell, Zugriffsgrenzen, Geheimnisse, Abhängigkeitsprüfung (vorhanden), optional externer Test | 3 bis 5 Tage |
| **10 Karten, Routen, Ortssuche** | bezahlte oder eigene Kacheln, eigener Routing- und Ortssuch-Dienst (Deutschland/DACH, Speicherbedarf zweistellig GB), Marken-Logos ersetzen | 5 bis 10 Tage |
| **11 Qualität und Barrierefreiheit** | Prüfung mit Screenreader (VoiceOver/TalkBack), Leistungsmessung, Tests für Zahlung und Alarme | 3 bis 5 Tage |
| **12 Inhalte und Support** | Rechtstexte einbinden, Hilfeseiten/FAQ, Onboarding, Kontakt, Support-Postfach | 3 bis 5 Tage |
| **Summe** | | **65 bis 110 Personentage** (3 bis 5 Monate Vollzeit, nebenberuflich 9 bis 18 Monate) |

**Grundsätze:** (1) **Lokal zuerst** beibehalten (Standort bleibt auf dem Gerät, Konten vermeiden); (2) **kein eigener Schlüssel pro Nutzer mehr**, aber auch **kein gemeinsamer Tankerkönig-Schlüssel für alle Nutzer** (1 Abfrage/Minute); (3) **Datenquelle austauschbar** halten (Adapter), damit Wechsel zwischen Tankerkönig-Vertrag und eigener Zulassung möglich ist; (4) **Funktionsumfang trennen** in Teile, die von MTS-K-Daten abhängen (Preise, Verlauf, Prognose) und unabhängige (Tankbuch, Belegleser, Ladepreise, Kostenrechner); (5) **Testabdeckung** beibehalten und um Zahlungs- und Alarm-Abläufe erweitern.

## 9. Finanzierung

| Quelle | Eignung | Hinweise |
|---|---|---|
| **Eigenmittel** (Zeit und wenig Geld) | **beste Wahl für Ziel A und B** | Einmalkosten etwa 3.000 bis 6.000 € ohne Fremdentwicklung (Rechtstexte, Marke, Konten, Versicherung, Puffer) |
| **Einnahmen im Projekt** (Premium, Spenden, Sponsoren) | Ziel A und B | frühe Validierung mit Vorbestellungen oder Warteliste |
| **Spenden, Förderer** (GitHub Sponsors, Ko-fi, Steady) | klein | Einnahmen steuerlich erfassen |
| **Prototype Fund** | nur für **Open-Source-Software mit gesellschaftlichem Nutzen**, Einzelpersonen mit Wohnsitz in Deutschland möglich; frühere Runden bis zu 47.500 € für 6 Monate (2022 bis 2024), aktuelle Summen und Fristen prüfen | passt nur, wenn der Code offen und nicht kommerziell ist; schließt eine geschlossene Vermarktung der geförderten Teile aus |
| **mFUND** (Bundesverkehrsministerium) | datenbasierte Mobilitäts-Projekte; zweistufiges Verfahren, Bewilligung im Ermessen, KMU begünstigt; **zurzeit laut Ministeriumsseite keine offenen Aufrufe** (Datum unklar) | eher für Verbünde/Forschung; für Einzelpersonen schwer |
| **EXIST-Gründerstipendium** | nur mit **Hochschulbezug** (Studierende, Absolventen bis 5 Jahre, Wissenschaftler); 12 Monate, steuerpflichtig | nur wenn passend |
| **Gründungszuschuss der Agentur für Arbeit** | nur bei Bezug von Arbeitslosengeld I | nicht geprüft |
| **KfW ERP-Gründerkredit StartGeld, L-Bank Startfinanzierung 80** (Baden-Württemberg) | Kredite über die Hausbank, bis zu 200.000 € bzw. 125.000 € je Gründer (Stand der Suchergebnisse) | **nicht empfehlenswert** bei dieser Umsatzerwartung; ein Kredit braucht einen tragfähigen Plan |
| **Business Angels, Risikokapital** | passt nicht | begrenzter Markt, starke kostenlose Konkurrenz, geringe Skalierung |
| **Partner und Auftraggeber** (Stadtwerke, Autoclubs, Autohäuser, Landkreise, Verkehrsverbünde) | **realistisch für Region und B2B2C** | Pilotprojekte, Sponsoring, White-Label; MTS-K-Verwendungszweck beachten |
| **Crowdfunding** (Startnext u. a.) | Validierung und Vorfinanzierung kleiner Beträge | Gegenleistungen planen (Premium-Lizenzen) |

**Hinweis:** Förderprogramme ändern sich. Vor einer Bewerbung die aktuellen Richtlinien und Fristen auf den Seiten der Programme prüfen; die Angaben hier stammen aus Suchergebnissen und sind nicht vollständig belegt.

## 10. Alles, was drum herum nötig ist

- **Support:** Kontakt per E-Mail, FAQ, Fehlerberichte, Reaktionszeit (z. B. 2 Werktage); Support-Aufwand grob 1 bis 3 Anfragen je 1.000 Nutzer und Woche (Annahme).
- **Marketing:** Store-Optimierung (Stichworte wie „Spritpreise Stuttgart“, „Tanken Göppingen“), **Seiten je Ort** (statische Ortsseiten mit Tagespreisen: prüfen, ob das als öffentliche Bereitstellung der Daten gilt), regionale Presse und Pendler-Gruppen, Autohäuser, Betriebe, Hochschulen, Empfehlungsprogramm. Erfahrungswert für bezahlte Installationen: 0,5 bis 2 € je Installation (Annahme), bei Umsatz von 0,7 bis 0,9 €/Jahr kaum wirtschaftlich.
- **Kennzahlen:** aktive Nutzer (Woche/Monat), Bindung nach 1, 7, 30 Tagen, Konversion zu Premium, Kündigungsquote, Umsatz je Nutzer, Akquisekosten, Absturzfreiheit, Datenaktualität (Alter des letzten Abrufs), Support-Anfragen.
- **Qualität im Betrieb:** Überwachung der Datenaktualität (der frühere Fall von 29 Stunden Verzug darf nicht unbemerkt bleiben), Statusseite, Benachrichtigung bei Ausfall, Rückfallebene bei Ausfall der Datenquelle (zuletzt gespeicherter Stand ist bereits vorhanden).
- **Organisation:** Dokumentation (vorhanden), **Vertretung** (Zugänge, Notfallhandbuch), Verträge mit Dienstleistern (AVV), Zeitplan für Rechts- und Steuertermine, Rücklage für Steuern.
- **Kommunikation:** Änderungsprotokoll (vorhanden), Datenschutz- und Lizenzseiten in der App, ehrliche Aussagen zu Genauigkeit und Quellen.
- **Zeitbudget:** Ab Ziel B realistisch 8 bis 12 Stunden pro Woche für Betrieb, Support und Weiterentwicklung.

## 11. Risiken und Gegenmaßnahmen

| Risiko | Wirkung | Gegenmaßnahme |
|---|---|---|
| **Datenzugang verweigert oder verteuert** | Produkt nicht möglich oder unwirtschaftlich | Antwort von Tankerkönig abwarten; Datenquelle austauschbar halten; Funktionen ohne MTS-K-Daten ausbauen |
| **Verstoß gegen Bedingungen** (heute regelmäßiger Abruf, öffentliches Repository) | Schlüssel gesperrt, Datenzugang verloren | Absprache, Zugriff beschränken, Repository privat oder Daten nicht öffentlich ausliefern |
| **Zu wenig Nutzer, geringe Zahlungsbereitschaft** | kein Ertrag | früh validieren (Warteliste, Pilot mit Partnern), Kosten niedrig, Gates (Abschnitt 12) |
| **Kostenlose Kartendienste entfallen** | Karte, Route, Ortssuche fallen aus | rechtzeitig auf bezahlte oder eigene Dienste wechseln |
| **Abmahnung, Datenschutzverstoß** | Kosten, Bußgeld | Pflichtangaben vor Start, Rechtstexte prüfen lassen, Versicherung |
| **Store-Ablehnung** (Apple verlangt mehr als eine Webseite) | kein Store-Auftritt | Mehrwert-Funktionen (Push, Widgets), PWA als Hauptweg behalten |
| **Plattformabhängigkeit** (Apple, Google, GitHub) | Regeländerungen, Provision | Webweg offen halten, Anbieterwechsel einplanen |
| **Einzelperson als Engpass** | Ausfall, Fehler | Dokumentation, Notfallhandbuch, Vertretung |
| **Arbeitsvertrag** | Konflikt mit Nebentätigkeit | früh klären |
| **Preisfehler in den Daten** | falsche Empfehlung, Reputationsschaden | Hinweise, Meldeweg, Aktualitätsanzeige |

## 12. Fahrplan mit Prüfpunkten

**Phase 0 – Klärung (jetzt, 0 €, 2 bis 4 Wochen):** E-Mail an Tankerkönig (`docs/recht/email-tankerkoenig.md`); Ziel A/B/C und Zeitbudget festlegen; Arbeitsvertrag prüfen; Code-Lizenz und Name entscheiden; Wettbewerber prüfen; Nachfrage testen (Warteliste, Umfrage in Pendlergruppen).
*Prüfpunkt:* Es gibt eine schriftliche Auskunft zum Datenzugang (Weg A, B oder C), und eine Entscheidung für Ziel und Zeitbudget.

**Phase 1 – Sauberer öffentlicher Betrieb ohne Einnahmen (4 bis 8 Wochen, 1.000 bis 3.000 €):** Impressum, Datenschutz, Quellenangaben, Einwilligung falls nötig; Daten laut Absprache ausliefern; Marken-Logos und Karten-/Routing-/Ortssuchdienste klären; Betrieb und Überwachung stabilisieren; Rechtstexte prüfen lassen.
*Prüfpunkt:* mindestens 500 aktive Nutzer in 30 Tagen, Bindung nach 30 Tagen über 25 % (Richtwert), keine offenen Rechtspunkte.

**Phase 2 – Einnahmen-MVP (6 bis 10 Wochen):** Gewerbe und steuerliche Erfassung, Premium (Web-Zahlung mit Händler-von-Rekord-Anbieter oder Stripe), Lizenzschlüssel, Kündigungsschaltfläche, Widerrufsbelehrung, AGB; Premium-Inhalte festlegen (Preisalarme, Familien-Abo, Tankbuch-Export). Optional Werbung nur außerhalb der Preisliste und mit Einwilligung.
*Prüfpunkt:* Konversion mindestens 2 %, Umsatz je Nutzer mindestens 0,7 € bei sinkenden Akquisekosten; sonst Phase 3 nicht beginnen.

**Phase 3 – Stores und Push (2 bis 4 Monate):** Store-Pakete, In-App-Kauf, Push, Marketing in der Region, regionale Sponsoren.
*Prüfpunkt:* Nutzerzahl über 5.000, Umsatz deckt den Betrieb (Abschnitt 6).

**Phase 4 – Ausbau (nur bei Erfolg):** bundesweit als VID (Antrag, Mobilithek, Beschwerdestelle, Server), Verträge mit Stadtwerken, Autoclubs, Arbeitgebern; Rechtsform prüfen (UG), Personal.

**Ausstieg jederzeit möglich:** Die App bleibt als privates Werkzeug bestehen; Phase 1 und 2 sind so angelegt, dass bis dahin wenig Geld gebunden ist.

## 13. Offene Entscheidungen

1. Ziel (A, B, C) und Zeit pro Woche.
2. Zielkreis: weiterhin Familie und Freunde oder öffentlich (Impressum, Datenquelle).
3. Datenweg nach Antwort von Tankerkönig (B) oder bundesweit mit eigener Zulassung (C).
4. Geschäftsmodell: Premium, Werbung, Mischung, Partner.
5. Code-Lizenz (geschlossen, Copyleft, nicht kommerziell offen) und Marke.
6. Rechtsform und Arbeitgeber-Klärung.
7. Budget für Rechtstexte, Karten-/Routing-Dienste, Marketing.

## Quellen (abgerufen am 30.10.2026)

- Tankerkönig: [Nutzungsbedingungen und Kommerzieller Service](https://creativecommons.tankerkoenig.de), [AGB](https://onboarding.tankerkoenig.de/static/img/AGB-Tankerkoenig.pdf), [Impressum](https://tankerkoenig.de/impressum)
- MTS-K: [§ 47k GWB](https://www.gesetze-im-internet.de/gwb/__47k.html), [§§ 5 bis 7 MTS-Kraftstoff-Verordnung](https://www.gesetze-im-internet.de/mtskraftv/__6.html), [Bundeskartellamt: Zulassung](https://www.bundeskartellamt.de/DE/Aufgaben/MarkttransparenzstelleFuerKraftstoffe/ZulassungVIDs/zulassungvids_node.html), [Hilfestellung zur Antragsgestaltung](https://www.bundeskartellamt.de/SharedDocs/Publikation/DE/Sonstiges/MTS-K/Hilfestellung_Antragsgestaltung.pdf?__blob=publicationFile&v=10), [Modalitäten des Datenbezugs](https://www.bundeskartellamt.de/SharedDocs/Publikation/DE/Sonstiges/MTS-K/MTS_Modalitaeten_Datenbezug_Verbraucherinformation.pdf?__blob=publicationFile&v=4), [Informationsblatt zur Verwendung](https://www.bundeskartellamt.de/SharedDocs/Publikation/DE/Sonstiges/MTS-K/Info_VID_Verbraucher.pdf?__blob=publicationFile&v=4), [Bundesportal](https://verwaltung.bund.de/leistungsverzeichnis/de/leistung/99070011006000), [zugelassene Dienste](https://www.bundeskartellamt.de/DE/Aufgaben/MarkttransparenzstelleFuerKraftstoffe/TankApps/tankapps_node.html)
- Recht: [§ 5 DDG](https://www.gesetze-im-internet.de/ddg/__5.html), [§ 312k BGB](https://www.gesetze-im-internet.de/bgb/__312k.html), [§ 3 BFSG](https://www.gesetze-im-internet.de/bfsg/__3.html), [§ 11 GewStG](https://www.gesetze-im-internet.de/gewstg/__11.html), Kleinunternehmerregelung ab 2025 (IHK-Informationen, 25.000 € Vorjahr/100.000 € laufendes Jahr)
- Dienste: [Nominatim-Nutzungsbedingungen](https://operations.osmfoundation.org/policies/nominatim/), [Kachel-Nutzungsbedingungen](https://operations.osmfoundation.org/policies/tiles/), [FOSSGIS-Routing](https://routing.openstreetmap.de/about.html)
- Gebühren: [Stripe](https://stripe.com/de/pricing), [Apple Small Business Program](https://developer.apple.com/app-store/small-business-program/), [Google Play](https://support.google.com/googleplay/android-developer/answer/112622)
- Wettbewerb: Presseberichte zu 1-2-3 Tanken (Abo 4,99 €/Jahr), z. B. [Mobiflip](https://www.mobiflip.de/1-2-3-tanken-stellt-komplett-auf-abo-modell-um/amp/), [iphone-ticker](https://www.iphone-ticker.de/1-2-3-tanken-neues-abo-modell-sorgt-fuer-aerger-134263/)
- Förderung: Suchergebnisse zu Prototype Fund, mFUND, EXIST, KfW StartGeld und L-Bank (nicht vollständig belegt, vor Bewerbung prüfen)
