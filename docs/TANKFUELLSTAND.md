# Tankfüllstand – Konzept und Berechnungen

Stand: 30.10.2026 · umgesetzt in `js/fuellstand.js` · Tests: `tests/unit.js` (Rechnung, Auswahl), `tests/e2e.js` (Bedienung, Route, E-Modus, Barrierefreiheit)

## 1. Ziel

Bisher rechnete die App Ersparnis, Fahrtkosten und Empfehlungen mit **einer vollen Tankfüllung** (Einstellung „Tankgröße“, Standard 50 l). Kaum jemand tankt aber von leer auf voll. Wer noch einen halben Tank hat, spart bei gleichem Preisunterschied nur halb so viel – und eine weite Anfahrt lohnt sich entsprechend später.

Neu: Neben dem Ort steht ein Knopf **⛽** mit der Auswahl **¾ · ½ · ¼ · Reserve · Nicht angeben**. Die App rechnet dann mit der Menge, die **zum vollen Tank fehlt** („nötiges Tankvolumen“).

Entschieden (alle Rückfragen mit „ja“ beantwortet):

| Frage | Entscheidung |
|---|---|
| Was bedeutet „Nicht angeben“? | Wie bisher: volle Tankgröße wird nachgetankt, keine Reichweitenprüfung |
| Wie lange gilt die Auswahl? | 3 Tage, danach zählt wieder „Nicht angeben“ |
| Reichweite prüfen? | Ja: Tankstellen, die man mit der Restreichweite nicht sicher erreicht, werden ausgeschlossen und als „außer Reichweite“ markiert |
| E-Auto? | Ja: eigener Akkustand 🔋 (getrennt vom Tank), gleiche Auswahl, Rechnung in kWh |
| Was ist „Reserve“? | Feste Restreichweite von 50 km |

## 2. Bedienung

- Knopf neben dem Ort (`#btnLevel`): zeigt ⛽ und den gewählten Stand (¾, ½, ¼, Reserve) oder „–“. Im E-Modus zeigt er 🔋.
- Tippen öffnet die Auswahl (`#dlgLevel`) mit je einer Zeile pro Stand: Füllanzeige, **fehlende Menge** und **Reichweite** (z. B. „≈ 25 l · reicht 357 km“). Ein Tipp wählt und schließt, „Nicht angeben“ löscht die Auswahl.
- Auf Preise, Route und im E-Modus derselbe Knopf; die Beschriftung der Ersparnis nennt immer Menge und Stand: „Ersparnis 2,13 € **bei 25 l (½)** ggü. Ø“.

## 3. Berechnungen

Gegeben: Tankgröße **T** (Einstellung, Standard 50 l), Verbrauch **v** (Einstellung, Standard 7 l/100 km), Straßenfaktor **f = 1,3** (Fahrstrecke ≈ 1,3 × Luftlinie).

### 3.1 Restmenge, nötige Menge, Reichweite

| Auswahl | Restmenge im Tank | nötige Menge V = T − Rest | Restreichweite |
|---|---|---|---|
| ¾ | 0,75 · T | 0,25 · T | Rest ÷ v · 100 |
| ½ | 0,50 · T | 0,50 · T | Rest ÷ v · 100 |
| ¼ | 0,25 · T | 0,75 · T | Rest ÷ v · 100 |
| Reserve | 50 km · v ÷ 100 (höchstens T) | T − Rest | 50 km |
| Nicht angeben | – | **T** | keine Angabe (keine Prüfung) |

Beispiel T = 50 l, v = 7 l/100 km:

| Stand | Rest | nötig V | Reichweite |
|---|---|---|---|
| ¾ | 37,5 l | **12,5 l** | 536 km |
| ½ | 25 l | **25 l** | 357 km |
| ¼ | 12,5 l | **37,5 l** | 179 km |
| Reserve | 3,5 l | **46,5 l** | 50 km |
| Nicht angeben | – | **50 l** | – |

Mengen werden nicht auf ganze Liter gerundet (37,5 l, 46,5 l), damit die Zahl zur Rechnung passt.

### 3.2 Ersparnis

Ersparnis = (Durchschnittspreis der Umgebung − Preis der günstigsten Tankstelle) × V.

Beispiel: 8,5 ct/l unter Durchschnitt: ¾ → 1,06 € · ½ → 2,13 € · ¼ → 3,19 € · Reserve → 3,96 € · nicht angegeben → 4,25 €.

### 3.3 Kosten mit Hin- und Rückfahrt („lohnt sich“)

Kosten einer Tankstelle im Abstand d (Luftlinie):

> **K = Preis × ( V + 2 · d · f · v ÷ 100 )**

Der Sprit für die Anfahrt (hin und zurück) wird zur getankten Menge gerechnet und zum Preis dieser Tankstelle bewertet. „Mit Hin- und Rückfahrt besser“ in der Karte „Günstigste“ nimmt die Tankstelle mit den niedrigsten **K** – nur wenn sie mindestens 5 ct unter der günstigsten liegt.

**Wann lohnt sich ein Umweg?** Ein Preisvorteil Δp (€/l) trägt eine Anfahrt bis

> **d\* = Δp · V ÷ ( Preis · 2 · f · v ÷ 100 )**

Das ist proportional zu V: **halbe Menge → halbe Strecke.** Beispiel Δp = 4 ct, Preis 2,00 €: bei 50 l bis 5,5 km, bei 25 l bis 2,7 km. Deshalb wechselt die Empfehlung mit dem Stand (z. B. bei ½ die nahe Tankstelle, bei ¼ die günstigere weiter weg).

### 3.4 Reichweitenprüfung

Eine Tankstelle gilt als erreichbar, wenn die Fahrstrecke **höchstens 90 % der Restreichweite** beträgt (10 % Sicherheitsabstand für Umwege, Verkehr, Verbrauchsschwankung):

> **erreichbar ⇔ Fahrstrecke ≤ 0,9 · Restreichweite**

- *Preise:* Fahrstrecke = d · f. Betrifft nur kleine Restreichweiten (Reserve 50 km → bis 45 km Fahrstrecke, ¼ bei 179 km praktisch nie, da der Suchradius höchstens 25 km beträgt).
- *Route:* Fahrstrecke zur Tankstelle = Kilometer entlang der Strecke + Weg abseits × f. Die **erste** Tankstelle muss erreichbar sein. Unerreichbare Tankstellen stehen weiter in der Liste („außer Reichweite“), zählen aber nicht für „Am billigsten auf der Strecke“, Ersparnis und Umwegkosten.
- *Ohne Treffer:* Liegt keine Tankstelle in Reichweite, erscheint „Keine Tankstelle in Reichweite“ mit der Reichweite.
- *E-Modus:* gleiche Regel mit der Akku-Reichweite (Akku ÷ Verbrauch in kWh/100 km).

### 3.5 Tank-Rat und 12-Uhr-Regel

Der Tank-Rat („Wann tanken?“) nutzt dieselbe Menge V und die Restreichweite:

1. Reichweite < 100 km → „jetzt tanken, nicht auf einen günstigeren Preis warten“.
2. Prognose sagt fallende Preise → „du kannst warten: gegen 16 Uhr ≈ X € günstiger (V l)“ mit X = erwarteter Preisvorteil × V.
3. Vor 12 Uhr (Preise steigen mittags im Mittel, gemessen aus dem Verlauf) → „vor 12 Uhr tanken spart ≈ X €“ mit X = mittlerer Anstieg × V.
4. Sonst → „kein Grund zu warten, du tankst ≈ V l“.

Ohne Auswahl steht dort ein Hinweis, dass der Knopf ⛽ die Rechnung genauer macht.

### 3.6 Route

- Spritkosten der Strecke bleiben unverändert (Strecke × Verbrauch).
- **Nachtanken inkl. Umweg** je Tankstelle: Preis × (V + Umweg-km × v ÷ 100); der Umweg kommt aus der echten Streckenführung (nicht aus der Luftlinie).
- Unter der Strecke steht eine Zeile: „⛽ ½ · nachtanken ≈ 25 l · Reichweite ≈ 357 km · Tankstopp in den ersten ≈ 321 km“ (letzteres nur bei Reichweite unter 400 km).

### 3.7 E-Modus

Gleiche Auswahl für den **Akku** mit eigener Speicherung (`lvlEv`): V = Akkugröße − Restmenge in kWh (Einstellung „Akkugröße E-Modus (kWh)“, Standard 30 kWh; Verbrauch „E-Auto kWh/100 km“, Standard 18). Reserve = 50 km × 18 kWh ÷ 100 = 9 kWh Rest. Ersparnis und Ladekosten rechnen mit V in kWh.

## 4. Speicherung und Übergang

- `localStorage`: `lvl` = `{ k, at }` für den Tank, `lvlEv` für den Akku; `k` ∈ `"0.75" | "0.5" | "0.25" | "res"`; `at` = Zeitpunkt der Auswahl.
- Gültig 3 Tage; ein Zeitstempel in der Zukunft (falsche Gerätezeit) gilt als ungültig.
- Übernahme des alten Tank-Rats (`{ f: 0,1 }` → Reserve, sonst der gespeicherte Bruchteil).
- Die Auswahl bleibt auf dem Gerät und wird nirgends übertragen.

## 5. Geänderte Dateien

| Datei | Änderung |
|---|---|
| `js/fuellstand.js` (neu) | Rechnung (rein), Speicher mit Ablauf, Knopf, Auswahldialog |
| `js/grund.js` | `fillCost` nutzt V statt Tankgröße; alter Tank-Rat-Schalter entfernt |
| `js/preise.js` | Karte „Günstigste“, Ersparnis, 12-Uhr-Text, Tank-Rat, Liste („außer Reichweite“), Karte ohne Treffer |
| `js/route.js` | V statt Tankgröße, Reichweitenprüfung, Zeile mit Stand und Menge |
| `js/strom.js` | Akkustand 🔋, V in kWh, Reichweitenprüfung |
| `index.html`, `app.css` | Knopf `#btnLevel`, Dialog `#dlgLevel`; Einstellungen: „Tankgröße (Liter)“, „Akkugröße E-Modus (kWh)“ |

## 6. Tests

- Unit: nötige Menge und Reichweite aller Stände, Reserve bei anderem Verbrauch und kleinem Tank, 90-%-Regel, Kosten mit Anfahrt, Umweggrenze (halbe Menge = halbe Strecke), Mengenanzeige, Speicher: 3-Tage-Ablauf, Zukunftszeit, Übernahme alter Werte, Sprit/Strom getrennt.
- Browser: Knopf neben dem Ort (320 und 390 px, eine Zeile), Ersparnis bei ½ ≈ halb, Reserve 46,5 l, ¾ 12,5 l, „Nicht angeben“ wie bisher, Akkustand getrennt, Route mit „außer Reichweite“, Preise mit kleinem Tank, Barrierefreiheit der Auswahl (axe, hell und dunkel).

## 7. Grenzen

- Die Reichweite ist eine Schätzung aus dem eingestellten Durchschnittsverbrauch; Fahrweise, Last und Steigungen sind nicht berücksichtigt. Deshalb der 10-%-Abstand. Die Anzeige ersetzt nicht den Blick auf die Tankanzeige.
- Der Füllstand wird nicht aus dem Auto gelesen, sondern von Hand gewählt und läuft nach 3 Tagen ab, damit alte Angaben nicht stillschweigend weiterrechnen.
