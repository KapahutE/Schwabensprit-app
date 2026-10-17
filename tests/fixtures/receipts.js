module.exports = [
{ name: "Aral E10, opening hours in header", exp: { fuel: "e10", liters: 42.15, ppl: 1.899, total: 80.04, date: "2026-10-14", time: "17:42" }, text: `
Aral Tankstelle
Hauptstraße 12
72070 Tübingen
Öffnungszeiten Mo-Sa 06:00-22:00 Uhr
Säule 4
Super E10
  42,15 l x 1,899 EUR/l      80,04 EUR A
SUMME                  EUR   80,04
Girocard               EUR   80,04
A 19,00%   67,26  12,78  80,04
Datum 14.10.2026   Uhrzeit 17:42
Beleg-Nr. 4711` },
{ name: "Shell V-Power with loyalty discount line", exp: { fuel: "e5", premium: true, liters: 38.02, ppl: 2.199, total: 81.61, date: "2026-10-14", time: "08:12" }, text: `
Shell Station Stuttgart
Heilbronner Str. 100
70191 Stuttgart
14.10.2026 08:12
Pumpe 05
Shell V-Power Racing
38,02 L x 2,199 EUR/L          83,61 A
ClubSmart Rabatt               -2,00 A
TOTAL                    EUR   81,61
Visa                     EUR   81,61` },
{ name: "JET cash with change", exp: { fuel: "e5", liters: 41.55, ppl: 1.749, total: 72.67, date: "2026-10-14", time: "17:45" }, text: `
JET Tankstelle
Stuttgarter Str. 55
73728 Esslingen
Super E5
Menge         41,55 l
Preis/l       1,749 EUR
Betrag        72,67 EUR
Gesamtbetrag  EUR 72,67
Bar           EUR 80,00
Rückgeld      EUR  7,33
14.10.26  17:45` },
{ name: "Esso diesel à", exp: { fuel: "diesel", liters: 45.67, ppl: 1.659, total: 75.77, date: "2026-10-13", time: "06:58" }, text: `
ESSO Station Reutlingen
Diesel  Säule 3
45,67 Liter à 1,659 €/Liter    75,77 €
Summe:                         75,77 €
EC-Karte                       75,77 €
Datum: 13.10.2026  Zeit: 06:58` },
{ name: "TotalEnergies Excellium Diesel", exp: { fuel: "diesel", premium: true, liters: 50.12, ppl: 1.799, total: 90.17, date: "2026-10-12", time: "19:03" }, text: `
TotalEnergies Tankstelle
Plochinger Str. 12, 73730 Esslingen
Excellium Diesel
Menge: 50,12 l
Preis je Liter: 1,799 EUR
Betrag: 90,17 EUR
Zu zahlen EUR 90,17
Mastercard EUR 90,17
12.10.2026 19:03` },
{ name: "ORLEN unit-before-number", exp: { fuel: "diesel", liters: 46.54, ppl: 1.659, total: 77.21, date: "2026-10-11", time: "12:01" }, text: `
ORLEN Deutschland
star Tankstelle
* Diesel   l 46,54 *
EUR/l 1,659
Betrag EUR 77,21
Gesamt EUR 77,21
11.10.2026 12:01` },
{ name: "freie: price line before quantity", exp: { fuel: "e10", liters: 40, ppl: 1.689, total: 67.56 }, text: `
Freie Tankstelle Müller
Lindenstr. 4, 72622 Nürtingen
Preis/Liter    1,689 EUR
Menge          40,00 l
Super E10      67,56 EUR
Summe EUR      67,56
10.10.2026 09:15` },
{ name: "Aral with coffee", exp: { fuel: "e5", liters: 35.12, ppl: 1.859, total: 65.29, shop: 2.9 }, text: `
Aral Tankstelle
Super E5  35,12 l  1,859 EUR/l  65,29 A
Kaffee groß                      2,90 B
Summe EUR                        68,19
09.10.2026 07:30` },
{ name: "Shell amount on next line + snack", exp: { fuel: "e10", liters: 30, ppl: 1.899, total: 56.97, shop: 1.49 }, text: `
Shell
Pumpe 2 Super FuelSave 95 E10
  30,00 L  x  1,899 EUR/L
                     56,97 EUR
Snickers              1,49 EUR
TOTAL                58,46 EUR
08.10.2026 18:22` },
{ name: "Tankautomat, Autorisierungsbetrag", exp: { fuel: "diesel", liters: 30, ppl: 1.659, total: 49.77, shop: null }, text: `
Tankautomat
Autorisierungsbetrag EUR 150,00
Diesel 30,00 l 1,659 EUR/l
Betrag EUR 49,77
07.10.2026 22:10` },
{ name: "AdBlue + Diesel", exp: { fuel: "diesel", liters: 45, ppl: 1.659, total: 74.66, shop: 8.99 }, text: `
Aral
Diesel 45,00 l 1,659 EUR/l 74,66
AdBlue 10,00 l 0,899 EUR/l 8,99
Summe 83,65
06.10.2026 10:00` },
{ name: "freie: Preis/l: EUR form, slashes date", exp: { liters: 42.15, ppl: 1.899, total: 80.04, date: "2026-10-05" }, text: `
Tankstelle Schmid
Super E10 42,15 l
Preis/l: EUR 1,899
Summe EUR 80,04
05/10/26 11:11` },
{ name: "Shop item, fuel line without own amount", exp: { liters: 35.12, ppl: 1.859, total: 65.29, shop: 2.9 }, text: `
Agip Tankstelle
Super E5  35,12 l x 1,859 EUR/l
Kaffee                 2,90
Summe EUR             68,19
04.10.2026 07:30` },
{ name: "ISO date (TSE style) only", exp: { date: "2026-10-03", time: "14:05" }, text: `
HEM Tankstelle
Diesel 40,00 l x 1,659 EUR/l 66,36
Summe 66,36
TSE-Start: 2026-10-03T14:05:12` },
{ name: "Liter value with 3 decimals + total with EUR before", exp: { liters: 42.150, ppl: 1.899, total: 80.04 }, text: `
Avia
Super E10   42,150 l
x 1,899
EUR 80,04
Summe EUR 80,04
02.10.2026 16:16` },
{ name: "Payback coupon cent/l discount (separate negative)", exp: { total: 78.04 }, text: `
Aral Tankstelle
Super E10  42,15 l x 1,899 EUR/l  80,04
Payback Coupon  -2,00
Zu zahlen EUR 78,04
01.10.2026 09:00` },
];
