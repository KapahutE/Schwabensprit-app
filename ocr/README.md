# Belegleser (OCR)

Texterkennung für das Tankbuch – läuft komplett im Browser auf dem Gerät, es werden keine Bilder hochgeladen.

| Datei | Herkunft | Lizenz |
|---|---|---|
| `tesseract.min.js`, `worker.min.js` | [tesseract.js](https://github.com/naptha/tesseract.js) 7.0.0 | Apache-2.0 |
| `tesseract-core-*lstm.wasm.js` | [tesseract.js-core](https://github.com/naptha/tesseract.js-core) 7.0.0 (Tesseract OCR als WebAssembly) | Apache-2.0 |
| `deu.traineddata.gz` | [@tesseract.js-data/deu](https://www.npmjs.com/package/@tesseract.js-data/deu) 1.0.0, `4.0.0_best_int` (tessdata) | Apache-2.0 |

Die App lädt diese Dateien erst, wenn ein Beleg gescannt wird (ca. 5 MB beim ersten Mal, danach aus dem Cache).
