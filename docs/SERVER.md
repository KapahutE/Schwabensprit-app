# Eigener Server für den Preisabruf – Empfehlung

Stand: 04.11.2026. Anlass: GitHub startet den geplanten Abruf nur noch unregelmäßig (am 4.11. in 13 Stunden 2 geplante Läufe, dazu die Störung vom selben Tag, siehe `CHANGELOG.md`). Dieses Dokument beschreibt, welcher Server genügt, was er können muss und welche Zusatzsoftware für Schutz und Betrieb nötig ist. **Preise und Verfügbarkeit ändern sich 2026 häufig; vor der Bestellung beim Anbieter prüfen.**

## 1. Kurzfassung

- **Empfehlung:** ein kleiner virtueller Server (VPS) in Deutschland mit Debian 13 (oder Ubuntu 24.04 LTS), 2 vCPU, 2 bis 4 GB RAM, 20 GB Speicher. Erste Wahl **Hetzner Cloud** (Nürnberg/Falkenstein, Tarif CX23 oder CAX11) oder **netcup VPS 500 G12**. Kosten etwa **5 bis 7 € im Monat** plus etwa 1 bis 4 € für ein getrenntes Backup.
- **Die Last ist winzig:** Die Auswertung braucht auf den heutigen Daten 5 Sekunden Rechenzeit und 134 MB Arbeitsspeicher (gemessen), der Abruf ist fast nur Warten auf Tankerkönig (etwa 30 Sekunden). Das Programm benutzt nur die Python-Standardbibliothek.
- **Aufgabe des Servers:** verlässlicher Zeitgeber und Abruf (alle 15 Minuten), Ergebnis wie bisher nach GitHub schieben (Zweige `main` und `app-daten`). Die App bleibt unverändert. Die GitHub-Läufe bleiben als Reserve (sie überspringen, wenn der Server gerade abgerufen hat, weil der Stand in `data/state.json` gemeinsam im Repository liegt).
- **Wichtigste Zusatzsoftware:** Schutz (Schlüssel-Anmeldung, Firewall, automatische Sicherheitsupdates, Fail2ban oder CrowdSec) und **ein Herzschlag-Wächter** (healthchecks.io), der meldet, wenn kein Abruf mehr eintrifft. Genau das fehlt heute.

## 2. Was der Server können muss

| Anforderung | Wert | Bemerkung |
|---|---|---|
| Betriebssystem | Debian 13 oder Ubuntu 24.04 LTS | langfristig mit Sicherheitsupdates |
| Programme | Python 3.10 oder neuer, Git, OpenSSH, curl | keine weiteren Pakete (nur Standardbibliothek) |
| Rechenleistung | 1 vCPU genügt, empfohlen 2 | Auswertung 5 s CPU, Spitze 134 MB RAM |
| Arbeitsspeicher | mindestens 1 GB, empfohlen 2 bis 4 GB | Reserve für spätere Datenbank, Webserver |
| Speicher | 20 GB | Daten wachsen um etwa 10 MB im Monat (heute 9,7 MB für 2 Monate); mit Großraum etwa das Doppelte |
| Netz | nur **ausgehend**: `creativecommons.tankerkoenig.de` (HTTPS) und `github.com` (SSH/HTTPS) | eingehend nur SSH, möglichst nur über VPN |
| Uhr und Zeitzone | `chrony`, **`TZ=Europe/Berlin`** | das Programm schreibt Ortszeit; die GitHub-Läufe setzen dieselbe Zeitzone |
| Zeitplan | systemd-Timer alle 15 Minuten, zufällige Verzögerung bis 60 s | Tankerkönig bittet um Abruf nicht zu runden Zeiten; `Persistent=true` holt verpasste Läufe nach |
| Veröffentlichen | Git-Push auf `main` (Rohdaten) und Force-Push auf `app-daten` (aufbereitete Daten), mit **Deploy-Schlüssel nur für dieses Repository** | gleiche Schritte wie `.github/workflows/tankpreise.yml` |
| Wochenreport | Montag 06:37 | wie im bisherigen Zeitplan |

Nicht nötig: Docker, Datenbank, Webserver, eigene Domain. Diese kommen erst, wenn der Server später Daten selbst ausliefert (abhängig von der Antwort von Tankerkönig).

## 3. Welcher Server

| Option | Kosten (Richtwert, brutto) | Für | Dagegen |
|---|---|---|---|
| **Hetzner Cloud** CX23 (x86) oder CAX11 (ARM), Nürnberg/Falkenstein | etwa 6 bis 7 € im Monat inkl. IPv4 (2026 mehrfach teurer geworden) | Schnittstelle und Firewall im Verwaltungsportal, Schnappschüsse, stundengenaue Abrechnung, Server in Minuten neu aufgebaut, deutscher Anbieter, Auftragsverarbeitungsvertrag online | die günstigen Tarife waren laut Berichten zeitweise nicht bestellbar; laut Berichten wurden die Preise im April und Juni 2026 angehoben |
| **netcup VPS 500 G12** (2 vCores, 4 GB RAM, 128 GB NVMe), Nürnberg oder Wien | etwa 5 bis 6 € im Monat | viel Speicher und RAM fürs Geld, laut Berichten monatlich kündbar, deutscher Anbieter | einfachere Werkzeuge, Schnappschüsse begrenzt |
| **Raspberry Pi oder Mini-PC zu Hause** | einmalig etwa 80 bis 150 €, Strom etwa 10 € im Jahr (Annahme) | keine laufenden Mietkosten, nur ausgehende Verbindungen nötig | Heim-Internet und Strom sind Ausfallquellen, kein Platz zum Wachsen, ungeeignet für den kommerziellen Betrieb |

**Meine Wahl:** Hetzner Cloud (wegen Werkzeugen und schnellem Neuaufbau), wenn der Tarif bestellbar ist, sonst netcup. Bei beiden gilt: nur Standorte in Deutschland oder der EU, Zwei-Faktor-Anmeldung für das Kundenkonto, Hauptkonto nur auf deinen Namen. Hinweise zu den Preisen: [Bericht zu Hetzner-Preiserhöhungen](https://www.tomshardware.com/tech-industry/hetzner-to-raise-prices-by-up-to-37-percent-from-april-1), [Preisvergleich Cloud-Anbieter 08/2026](https://kimmo.suominen.com/stuff/cpc-2026-08.txt), [netcup](https://www.netcup.com/de/server/vps) und [Hetzner](https://www.hetzner.com/cloud) selbst.

## 4. Schutz (Pflicht)

| Maßnahme | Software / Einstellung | Zweck |
|---|---|---|
| Anmeldung nur mit Schlüssel | OpenSSH: `PasswordAuthentication no`, `PermitRootLogin no`, `AllowUsers`, eigener Benutzer | stoppt Passwort-Angriffe |
| Verwaltung nur über VPN | **Tailscale** (kostenlos für Privatpersonen) oder **WireGuard**; SSH nur dort erreichbar | kein offener SSH-Port im Internet |
| Firewall | Firewall des Anbieters **und** `nftables`/`ufw` (alles eingehend gesperrt, außer VPN) | doppelter Schutz |
| Sicherheitsupdates | `unattended-upgrades` (täglich), Neustart nachts bei Bedarf (`needrestart`) | Lücken schließen ohne Handarbeit |
| Aussperren von Angreifern | **CrowdSec** oder `fail2ban` | blockt wiederholte Fehlversuche |
| Geheimnisse | Tankerkönig-Schlüssel und Deploy-Schlüssel in Dateien mit Rechten `0600` oder über `systemd-creds`; nie im Repository, nie in Skripten | Schlüssel nicht abgreifbar |
| Dienst eingeschränkt | eigener Benutzer ohne Anmeldung, systemd-Härtung (`NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`, `ReadWritePaths` nur Arbeitsordner, `MemoryMax`, `TimeoutStartSec`) | begrenzter Schaden bei Fehlern |
| Deploy-Schlüssel | GitHub-Deploy-Key mit Schreibrecht **nur** für `tankpreise` | gestohlener Schlüssel gefährdet nur dieses Repository |
| Prüfung | **Lynis** (vierteljährlich) | findet Konfigurationsfehler |
| Konto | Zwei-Faktor beim Anbieter und bei GitHub, Wiederherstellungscodes im Passwortmanager | Zugriff auf Verwaltung schützen |

## 5. Betrieb (Pflicht)

| Aufgabe | Software | Hinweis |
|---|---|---|
| **Herzschlag-Wächter** | [healthchecks.io](https://healthchecks.io) (kostenlos, 20 Prüfungen; auch selbst betreibbar) | Jeder erfolgreiche Lauf ruft `…/ping`, bei Fehler `…/fail`. Kommt 30 Minuten nichts, geht eine E-Mail oder Telegram/ntfy-Nachricht raus. Genau diese Meldung fehlt heute |
| Aktualität von außen | zweite Prüfung bei healthchecks.io, die per Skript prüft, ob `bases.json` auf GitHub jünger als 45 Minuten ist | erkennt auch, wenn der Server läuft, aber der Push scheitert |
| Zeitplan | systemd-Timer (`OnCalendar=*:0/15`, `RandomizedDelaySec=60`, `Persistent=true`) statt cron | Neustart-fest, Protokoll im Journal |
| Parallelität | `flock` um den Lauf | nie zwei Läufe gleichzeitig |
| Protokolle | `journald` dauerhaft, Größe begrenzt | Fehlersuche |
| Sicherung | **restic** oder **borg**, verschlüsselt, täglich, auf einen **anderen** Speicher (Hetzner Storage Box, Backblaze B2 oder Server eines zweiten Anbieters); zusätzlich Schnappschuss beim Anbieter | Daten liegen auch auf GitHub; wichtig sind Konfiguration, Schlüssel (im Passwortmanager) und ein getesteter Wiederherstellungsweg |
| Plattenplatz und Last | einfaches Skript (Platte über 80 %, Last) meldet an healthchecks.io; oder **Netdata** | rechtzeitig warnen |
| Zeit | `chrony` | Zeitstempel in den Daten |
| Neuaufbau | **cloud-init** oder **Ansible** im Repository (`server/`) | Server in 15 Minuten neu, ohne Handarbeit |
| Dokumentation | Notfallhandbuch (Zugang, Schlüssel, Wiederherstellung) | Vertretung möglich |

## 6. Einbindung ohne Doppelarbeit

1. Der Server holt das Repository (`main`), ruft ab, wertet aus, speichert und veröffentlicht, genau wie der GitHub-Lauf. Vor jedem Lauf `git pull --rebase`, nach Konflikt abbrechen und neu aufsetzen.
2. **Eine** Quelle der Wahrheit für „wann zuletzt abgerufen“ ist `data/state.json` im Repository: ruft der Server um 10:00 ab, überspringt ein GitHub-Lauf um 10:05 (Abstand unter 13 Minuten, bei Start über die App unter 5).
3. Der Zeitplan in GitHub bleibt als **Reserve** bestehen; der automatische Abruf der App startet weiterhin GitHub (zusätzliche Sicherheit, falls der Server ausfällt).
4. Der Tankerkönig-Schlüssel liegt dann auf dem Server und im GitHub-Secret (Reserve). Wer das nicht möchte, schaltet den Zeitplan in GitHub ab und lässt nur den manuellen Start.

## 7. Aufwand und Kosten

| Posten | Einmalig | Laufend |
|---|---|---|
| Server (VPS) | – | 5 bis 7 € im Monat |
| Backup-Speicher | – | 1 bis 4 € im Monat |
| Wächter (healthchecks.io), VPN (Tailscale) | – | 0 € (kostenlose Tarife) |
| Einrichtung (Server, Härtung, Zeitplan, Veröffentlichung, Wächter, Backup, Test) | etwa 1 Arbeitstag, davon 3 Tage Parallelbetrieb zur Prüfung | gelegentlich Updates und Kontrolle, etwa 1 Stunde im Monat |
| **Summe** | | **etwa 85 bis 130 € im Jahr** |

## 8. Offene Entscheidungen

1. Anbieter (Hetzner oder netcup) und Standort, Kundenkonto auf wessen Namen.
2. Wo die Sicherung liegt (zweiter Anbieter).
3. Soll der GitHub-Zeitplan als Reserve bleiben oder abgeschaltet werden?
4. Wohin gehen die Warnmeldungen (E-Mail, Telegram, ntfy)?
5. Hängt später ein Webserver an den Server (Daten selbst ausliefern)? Das hängt an der Antwort von Tankerkönig und ändert Härtung und Kosten (Domain, TLS, Zwischenspeicher).

## Messwerte (Grundlage der Größenwahl)

Gemessen am 04.11.2026 auf einer Kopie der Daten (9,7 MB, 5 Bases, 436 Tankstellen): `python3 tankpreise.py export` – 5,0 s Laufzeit, 4,9 s CPU, **134 MB** Spitzenspeicher, Ausgabe 5,5 MB in 31 Dateien. Der Abruf (`fetch`) dauert im GitHub-Lauf 27 bis 28 s, überwiegend Wartezeit auf Tankerkönig.
