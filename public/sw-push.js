// Service worker for REAL background push notifications.
//
// This is what makes notifications land on the phone even when the app is
// CLOSED and the user is anywhere. The scheduled GitHub Action sends a VAPID
// push to the browser's Push API; this service worker receives it and shows
// a native notification.
//
// It is registered SEPARATELY from the offline cache worker (sw.js) so the
// two concerns stay independent. Both must be registered for the app to work
// offline AND receive push.

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    return
  }

  const options = {
    body: payload.body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: payload.tag || 'house-ledger',
    vibrate: [100, 50, 100],
    data: { url: payload.url || '/' },
  }

  event.waitUntil(
    self.showNotification(payload.title || 'House Ledger', options).then(() => {
      // Auto-dismiss after 30s so notifications don't pile up.
      setTimeout(() => self.clearNotification(options.tag), 30000)
    }),
  )
})

// Optional: handle notification clicks (open the app).
self.addEventListener('notificationclick', (event) => {
  event.preventDefault()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((list) => {
      for (const client of list) {
        if (client.url === self.location.origin && 'focus' in client) {
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
