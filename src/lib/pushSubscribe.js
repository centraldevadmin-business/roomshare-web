// Client-side push subscription. Runs in the browser.
//
// On first app load (with permission granted), it:
//   1. Registers the push service worker (sw-push.js)
//   2. Creates a VAPID push subscription via the Push API
//   3. Writes it to the ledger via the addPushSubscription queue op
//
// The scheduled GitHub Action reads those subscriptions and sends real
// background pushes — so notifications land even when the app is closed.

import { uniqueId } from './logic.js'

// Register the push service worker. Returns true if it registered.
export async function registerPushWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return false
  }
  try {
    await navigator.serviceWorker.register('/sw-push.js')
    return true
  } catch {
    return false
  }
}

// Create a VAPID push subscription from the registered service worker.
// Returns the subscription, or null if push isn't supported / denied.
export async function createPushSubscription() {
  if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
    return null
  }
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: __VITE_PUSH_PUBLIC_KEY__ || null,
    })
    // toJSON() gives a clean, JSON-serializable { endpoint, p256dh, auth }.
    const j = sub.toJSON()
    return {
      endpoint: j.endpoint,
      p256dh: j.p256dh,
      auth: j.auth,
    }
  } catch {
    return null
  }
}

// Build the subscription record to store in the ledger.
export function buildSubscriptionRecord(sub, userId) {
  return {
    id: userId,
    endpoint: sub.endpoint,
    p256dh: sub.p256dh,
    auth: sub.auth,
    createdAt: new Date().toISOString(),
  }
}
