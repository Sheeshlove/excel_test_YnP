/* =============================================================================
 * sw.js — service worker
 * Caches the whole app on first visit, then serves it from the cache. After the
 * first load the trainer works with no network at all, which is the point on a
 * phone: it has to keep working on the underground and on a plane.
 *
 * Bump CACHE whenever the app files change, otherwise phones keep the old copy.
 * ========================================================================== */
var CACHE = 'excel-trainer-v1';

var ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './manifest.webmanifest',
  './js/formula.js',
  './js/engine.js',
  './js/pivot.js',
  './js/explain.js',
  './js/grader.js',
  './js/curriculum.js',
  './js/drills.js',
  './js/storage.js',
  './js/grid.js',
  './js/pivotui.js',
  './js/touch.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          return k === CACHE ? null : caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (res) {
        // keep anything else the app asks for, so a second visit is fully offline
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match('./index.html');
      });
    })
  );
});
