/// <reference lib="webworker" />

const CACHE_NAME = 'feedreader-v1'
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event
  
  // Skip non-GET requests
  if (request.method !== 'GET') return
  
  // Skip API requests - always go to network
  if (request.url.includes('/api/')) {
    event.respondWith(fetch(request))
    return
  }
  
  // For navigation requests, use network-first strategy
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response.ok) {
            const responseClone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone)
            })
          }
          return response
        })
        .catch(() => {
          // Fallback to cache if offline
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match('/')
          })
        })
    )
    return
  }
  
  // For other requests, use stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            cache.put(request, networkResponse.clone())
          }
          return networkResponse
        })
        
        return cachedResponse || fetchPromise
      })
    })
  )
})

// Background sync for refreshing feeds
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-feeds') {
    event.waitUntil(syncFeeds())
  }
})

async function syncFeeds() {
  try {
    // Get all clients and send them a message to refresh
    const clients = await self.clients.matchAll()
    clients.forEach((client) => {
      client.postMessage({ type: 'SYNC_FEEDS' })
    })
  } catch (error) {
    console.error('Background sync failed:', error)
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return
  
  const data = event.data.json()
  
  const options = {
    body: data.body || 'Tienes nuevas publicaciones',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    actions: [
      {
        action: 'open',
        title: 'Abrir'
      },
      {
        action: 'dismiss',
        title: 'Descartar'
      }
    ]
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'FeedReader', options)
  )
})

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  
  if (event.action === 'dismiss') return
  
  const url = event.notification.data?.url || '/'
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus()
        }
      }
      // Open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    })
  )
})

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'refresh-feeds') {
    event.waitUntil(syncFeeds())
  }
})
