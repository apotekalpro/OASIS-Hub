const CACHE_NAME = 'oasis-hub-v2'

self.addEventListener('install', event => {
  // Take control immediately without waiting
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(['/oasis-hub-logo.png']).catch(() => {})
    )
  )
})

self.addEventListener('activate', event => {
  // Claim all clients immediately
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      ),
    ])
  )
})

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  // Skip non-GET, API routes, and auth routes
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.includes('supabase')
  ) {
    return
  }
  // Network-first strategy
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  )
})
