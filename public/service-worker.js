/**
 * Service Worker for Web Push Notifications
 *
 * Lifecycle:
 * 1. Registered by layout.tsx on first page load (after first planning cycle)
 * 2. Listens for 'push' events from the server
 * 3. Displays notification to the user
 * 4. Handles notification click to navigate to the relevant screen
 *
 * Features:
 * - Request permission once (no spam)
 * - Handle notification clicks
 * - Clean up inactive subscriptions
 */

const NOTIFICATION_TAG_PREFIX = 'housegro-';

/**
 * Install event: set up the service worker
 */
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  // Activate immediately
  self.skipWaiting();
});

/**
 * Activate event: take control of all pages
 */
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(clients.claim());
});

/**
 * Push event: receive and display notification
 *
 * Triggered by server sending a push notification.
 * The server would send: { title, body, tag, badge, icon, data }
 */
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('[Push] Received push without data');
    return;
  }

  try {
    const payload = event.data.json();

    const options = {
      title: payload.title || 'HouseGrocer',
      body: payload.body || 'New notification',
      tag: `${NOTIFICATION_TAG_PREFIX}${payload.tag || 'default'}`,
      badge: payload.badge || '🏠',
      icon: payload.icon || '/icon-192.png',
      badge: '/badge-128.png',
      data: payload.data || {},
      actions: [
        {
          action: 'open',
          title: 'Open',
        },
        {
          action: 'close',
          title: 'Dismiss',
        },
      ],
    };

    console.log(`[Push] Displaying: ${options.title}`);

    event.waitUntil(
      self.registration.showNotification(options.title, options)
    );
  } catch (error) {
    console.error('[Push] Error parsing notification:', error);
  }
});

/**
 * Notification click event: navigate to the relevant screen
 *
 * If the notification includes a data.screen property, navigate there.
 * Otherwise, just focus/open the app.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { action, data } = event.notification;
  const target = data?.screen || '/plan';

  console.log(`[Notification Click] Action: ${action}, Target: ${target}`);

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to find an existing window
        for (const client of clientList) {
          if (client.url === target && 'focus' in client) {
            return client.focus();
          }
        }

        // No matching window, open a new one
        if (clients.openWindow) {
          return clients.openWindow(target);
        }
      })
  );
});

/**
 * Notification close event: log dismissals for analytics
 */
self.addEventListener('notificationclose', (event) => {
  console.log(`[Notification Closed] ${event.notification.tag}`);
});

/**
 * Message event: handle messages from the client
 *
 * Supports:
 * - 'register-push-subscription': Store subscription endpoint
 * - 'unregister-push-subscription': Remove subscription
 * - 'clear-notifications': Clear all notifications with a tag
 */
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  console.log(`[Service Worker] Message: ${type}`);

  if (type === 'clear-notifications') {
    const tag = data?.tag || `${NOTIFICATION_TAG_PREFIX}*`;
    self.registration
      .getNotifications({ tag })
      .then((notifications) => {
        notifications.forEach((notification) => notification.close());
      });
  }
});
