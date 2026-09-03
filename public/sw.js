// Service worker for offline PWA support.
//
// In production, Vite bundles the app into hashed assets/ files (e.g.
// assets/index-DOG9WhoK.js). We can't hardcode those names, so:
//   1. Install precaches the static app shell (index.html, manifest, favicon).
//   2. The runtime fetch handler caches JS/CSS on first successful load, so the
//      hashed assets get cached the first time the app opens — then everything
//      works offline.
//
// The old version did cache.addAll(['/src/main.jsx', '/src/App.jsx', ...]) which
// 404 in production, failing install and disabling caching entirely.

const CACHE = 'house-ledger-v1'
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(SHELL).catch(() => null)
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  // Hashed JS/CSS assets: cache-first, then network + cache on miss.
  if (event.url.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached ||
        fetch(event.request)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone()
              caches.open(CACHE).then((cache) => cache.put(event.request, copy))
            }
            return res
          })
          .catch(() => caches.match('/index.html'))
      )
    )
    return
  }

  // Everything else (app shell): network-first so we always get the latest
  // index.html (avoids browsers serving a stale cached blank shell), falling
  // back to the cache only when offline.
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  )
})
