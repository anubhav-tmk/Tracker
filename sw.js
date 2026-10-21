'use strict';
/* Tracker service worker: caches the app shell for offline use.
   Bump CACHE when you deploy a new version to force a refresh. */
const CACHE = 'tracker-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.png'];

/* ===== Install: pre-cache the shell (a missing file doesn't block install) ===== */
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});

/* ===== Activate: drop old caches ===== */
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* ===== Fetch: same-origin GETs only; GitHub API calls pass straight through ===== */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  // Pages: network first so updates show up, cached shell when offline.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put('./index.html', copy));
      return res;
    }).catch(() => caches.match('./index.html').then(r => r || caches.match('./'))));
    return;
  }

  // Other assets: serve from cache, refresh in the background.
  e.respondWith(caches.match(req).then(cached => {
    const net = fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => cached);
    return cached || net;
  }));
});

/* ===== Notification click: focus or open the app ===== */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const win = list.find(w => 'focus' in w);
    return win ? win.focus() : self.clients.openWindow('./');
  }));
});
