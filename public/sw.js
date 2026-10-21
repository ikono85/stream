// Seule la page hors connexion est conservée, jamais les comptes ou les API.
const CACHE = 'lucarne-offline-v1'
const OFFLINE = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('lucarne-offline-') && key !== CACHE) await caches.delete(key)
    }
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate'
      || url.origin !== self.location.origin || url.pathname.startsWith('/api/')
      || /^\/admin(?:\/|\.|$)/.test(url.pathname)) return
  event.respondWith(fetch(event.request).catch(async () => {
    return (await caches.match(OFFLINE)) ?? new Response('Connexion indisponible. Réessayez lorsque le réseau revient.', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }))
})
