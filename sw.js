/* Draft rooms have bad signal. Everything the app needs is cached on first
   visit so a later load works with no connection at all. */
"use strict";

const CACHE = 'draftroom-v1';
const SHELL = ['/', '/draft-room.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // serve from cache immediately, then refresh it in the background so a new
  // deploy lands on the next open rather than blocking this one on the network
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const hit = await cache.match(req, {ignoreSearch: true});
      const net = fetch(req).then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      return hit || net.then(res => res || Response.error());
    })
  );
});
