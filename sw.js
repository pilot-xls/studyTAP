/* Service worker: funciona offline. Muda a VERSION sempre que atualizares a app. */
const VERSION = 'tapcards-v4';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'music.js', 'cards.md', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // API do Claude passa direto
  // cartões: rede primeiro (para veres logo as atualizações), cache se estiveres offline
  if (url.pathname.endsWith('cards.md')) {
    e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(VERSION).then(c => c.put('cards.md', cp)); return r; })
      .catch(() => caches.match('cards.md')));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).then(res => {
    const cp = res.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); return res;
  })));
});
