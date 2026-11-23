// Service worker: la app abre sin conexión; los datos y las fotos nunca se guardan en caché.
const CACHE = 'le1-porteria-v8';
const BASE = ['./', './index.html', './estilos.css', './app.js', './config.js', './manifest.webmanifest', './icono.svg', './icono-192.png', './icono-512.png',
  './icono-maskable-512.png', './icono-apple-180.png', './marca/spa-monograma-negativo.svg', './marca/spa-logo-negativo.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.hostname.endsWith('supabase.co')) return;
  const versionado = url.hostname === 'cdn.jsdelivr.net' || url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com');
  if (versionado) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((resp) => {
      const copia = resp.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return resp;
    })));
    return;
  }
  if (url.origin === location.origin) {
    e.respondWith(fetch(e.request).then((resp) => {
      const copia = resp.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return resp;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })));
  }
});
