/**
 * Push notification handling — imported into the generated Workbox service
 * worker via `importScripts`. Shows notifications and deep-links on click.
 */

self.addEventListener('push', event => {
  let payload = {
    title: '2021familyforever',
    body: 'You have a new notification.',
    url: '/',
  }
  try {
    if (event.data) payload = { ...payload, ...event.data.json() }
  } catch {
    if (event.data) payload.body = event.data.text()
  }

  const options = {
    body: payload.body,
    icon: '/icons/notification-icon.png',
    badge: '/icons/notification-badge.png',
    vibrate: [100, 50, 100],
    tag: payload.tag || undefined,
    data: { url: payload.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(payload.title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Focus an existing window and navigate it to the deep link.
        for (const client of clientList) {
          if ('focus' in client) {
            client.navigate(target)
            return client.focus()
          }
        }
        return self.clients.openWindow(target)
      })
  )
})