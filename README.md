# Schwabensprit – App

Oberfläche der Tankpreis-App. Sie enthält **keine Daten**: Preise, Orte und Reports lädt sie mit dem
auf dem Gerät hinterlegten GitHub-Zugangsschlüssel aus dem privaten Daten-Repository.

Die Dateien hier sind eine Kopie von `docs/` aus dem Daten-Repository (ohne `docs/data` und `docs/reports`).

## Aufbau

- **Dieses Repository** enthält die App (eine Datei `index.html` + Icons + `ocr/` für den Belegleser) und ist die einzige Quelle des App-Codes.
- **Daten-Repository** `KapahutE/tankpreise`: Abrufprogramm und Rohdaten auf `main`; die aufbereiteten App-Daten (`docs/data`, `docs/reports`) auf dem Zweig `app-daten`, der bei jedem Abruf mit genau einem Stand überschrieben wird (kein Verlauf, das Repository wächst nicht unnötig).
- Die App liest über die GitHub-API von `app-daten` (Rückfall auf `main`).

