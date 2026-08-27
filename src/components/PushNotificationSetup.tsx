'use client';

/**
 * Push Notification Registration Component
 *
 * Registers the service worker and requests push notification permission
 * on first load (or after first planning cycle for better UX).
 *
 * This is a lightweight client component that runs once per session.
 */

import { useEffect } from 'react';

export function PushNotificationSetup() {
  useEffect(() => {
    // Only run in browser with service worker support
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    registerServiceWorker();
  }, []);

  return null; // This component doesn't render anything
}

async function registerServiceWorker() {
  try {
    // Register the service worker
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/',
    });

    console.log('[Service Worker] Registered successfully', registration);

    // Listen for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('[Service Worker] Update available');
        }
      });
    });

    // Request push permission if not already granted
    // Delay by 3 seconds to avoid interrupting UX
    setTimeout(() => {
      requestPushPermission(registration);
    }, 3000);
  } catch (error) {
    console.error('[Service Worker] Registration failed:', error);
  }
}

async function requestPushPermission(registration: ServiceWorkerRegistration) {
  try {
    // Check if push is supported
    if (!('PushManager' in window)) {
      console.log('[Push] PushManager not supported');
      return;
    }

    // Check current subscription
    let existingSubscription = await registration.pushManager.getSubscription();

    if (existingSubscription) {
      console.log('[Push] Already subscribed');
      return;
    }

    // Check if permission is already denied
    if (Notification.permission === 'denied') {
      console.log('[Push] Notifications denied by user');
      return;
    }

    // Request permission if not yet determined
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        console.log('[Push] Permission not granted');
        return;
      }
    }

    // Subscribe to push notifications
    // In production, replace with your VAPID public key
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const subscriptionOptions: PushSubscriptionOptionsInit = {
      userVisibleOnly: true,
    };

    if (vapidKey) {
      subscriptionOptions.applicationServerKey = urlBase64ToUint8Array(
        vapidKey
      ) as any;
    }

    const subscription = await registration.pushManager.subscribe(
      subscriptionOptions as PushSubscriptionOptionsInit
    );

    console.log('[Push] Subscription created:', subscription);

    // Send subscription to server (if NEXT_PUBLIC_VAPID_PUBLIC_KEY is set)
    if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      });
    }
  } catch (error) {
    console.error('[Push] Permission request failed:', error);
  }
}

/**
 * Convert VAPID key from base64 to Uint8Array
 * Required by PushManager.subscribe()
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  if (!base64String) {
    // Return a dummy array if key is not configured
    // Allows service worker to register even without push setup
    return new Uint8Array(65);
  }

  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
