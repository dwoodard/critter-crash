const CACHE = 'critter-crash-dev-v30'
const ASSETS = ['./index.html','./src/game.js','./icon.svg','./manifest.webmanifest']

self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)))
})

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))),
    self.clients.claim()
  ]))
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)

  if (event.request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          const copy = response.clone()
          caches.open(CACHE).then(cache => cache.put('./index.html', copy))
          return response
        })
        .catch(() => caches.match('./index.html'))
    )
    return
  }

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then(response => {
        const copy = response.clone()
        caches.open(CACHE).then(cache => cache.put(event.request, copy))
        return response
      })
      .catch(() => caches.match(event.request))
  )
})

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
