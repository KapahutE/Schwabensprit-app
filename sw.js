// Schwabensprit – Service Worker: Sofortstart und Betrieb ohne Netz für die App-Dateien.
//  • Startseite (index.html): sofort aus dem Speicher, im Hintergrund auf Neues prüfen; gibt es eine neue Version, meldet der
//    Worker das der App („Neue Version bereit“) – so bleibt der Start schnell und Updates kommen trotzdem an.
//  • js/, app.css, Symbole: je Version (?v=…) unveränderlich → aus dem Speicher; ocr/ (Belegleser, 13 MB) bei erster Nutzung.
//  • Preisdaten (data/, reports/) und fremde Dienste gehen immer am Worker vorbei; für „kein Netz“ sorgt die App selbst (IndexedDB).
const VERSION = "1";
const SHELL = "sw-shell-" + VERSION, FILES = "sw-files-" + VERSION, OCR = "sw-ocr-" + VERSION, MAX_FILES = 90;
const INDEX = new URL("./", self.registration.scope).href;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (!k.endsWith("-" + VERSION)) await caches.delete(k);   // alte Worker-Versionen aufräumen
  await self.clients.claim();
})()));

self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  const p = u.pathname;
  if (/\/(data|reports)\//.test(p)) return;
  if (r.mode === "navigate" || p.endsWith("/") || p.endsWith("/index.html")) return e.respondWith(page(e));
  if (p.endsWith("/endpoints.json")) return e.respondWith(networkFirst(r));
  e.respondWith(cacheFirst(r));
});

async function page(e) {
  const cache = await caches.open(SHELL), hit = await cache.match(INDEX), copy = hit ? hit.clone() : null;   // Kopie: hit selbst geht an den Browser
  const net = fetch(INDEX, { cache: "no-cache" }).then(async (res) => {
    if (!res.ok) return res;
    const nw = await res.clone().text(), old = copy ? await copy.text() : null;
    await cache.put(INDEX, res.clone());
    if (old != null && old !== nw) await tell(e);
    return res;
  }).catch(() => null);
  e.waitUntil(net);
  return hit || (await net) || new Response("Offline – die App wurde noch nicht gespeichert.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
}
// Neue Version gefunden: die Seite, die gerade geöffnet wird (sie hängt noch an der alten Version), kurz darauf benachrichtigen –
// zum Zeitpunkt des Vergleichs gibt es sie oft noch nicht, daher ein paar Versuche
async function tell(e) {
  for (let i = 0; i < 10; i++) {
    const c = e.resultingClientId ? await self.clients.get(e.resultingClientId) : null;
    if (c) return c.postMessage({ type: "update" });
    await new Promise((r) => setTimeout(r, 300));
  }
  for (const c of await self.clients.matchAll({ includeUncontrolled: true })) c.postMessage({ type: "update" });
}
async function networkFirst(r) {
  const cache = await caches.open(SHELL);
  try {
    const res = await Promise.race([fetch(r, { cache: "no-cache" }), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000))]);
    if (res.ok) cache.put(r, res.clone());
    return res;
  } catch { return (await cache.match(r)) || new Response("{}", { status: 503, headers: { "content-type": "application/json" } }); }
}
async function cacheFirst(r) {
  const cache = await caches.open(r.url.includes("/ocr/") ? OCR : FILES), hit = await cache.match(r);
  if (hit) return hit;
  const res = await fetch(r);
  if (res.ok && res.type === "basic" && res.status === 200) {
    await cache.put(r, res.clone());
    if (!r.url.includes("/ocr/")) { const ks = await cache.keys(); for (const k of ks.slice(0, Math.max(0, ks.length - MAX_FILES))) await cache.delete(k); }   // ältere Versionen verwerfen
  }
  return res;
}
