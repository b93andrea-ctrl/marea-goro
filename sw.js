// Service worker: tiene in cache la "shell" dell'app per l'avvio offline.
// I dati (Arpae, allertameteo) vengono sempre presi dalla rete; l'ultimo set valido lo salva la pagina in localStorage.
const CACHE = 'marea-goro-v3';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './logo-wave.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // dati esterni: sempre rete
  if (e.request.method !== 'GET') return;
  // 'no-cache': chiede sempre al server se c'è una versione nuova (GitHub Pages altrimenti fa usare copie fino a 10 min vecchie)
  e.respondWith(
    fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
