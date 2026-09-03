import { useEffect } from 'react'
import {
  requestNotificationPermission,
  showNotification,
  mealReminderState,
  mealSummaryState,
  newAnnouncement,
} from '../lib/notifications.js'
import { RESIDENT_IDS } from '../lib/users.js'

// Notifications hook. Wires the pure detection logic in notifications.js to the
// browser's Notification API.
//
// Because this PWA has no server, notifications only fire while the app is open
// on a phone. The hook:
//   • requests permission once, right after login
//   • ticks every 60s and fires meal reminders / summaries for the current
//     wall-clock window
//   • fires a notification whenever a new announcement appears
//
// Props:
//   session - the current auth session (has .id, .name, .role)
//   ledger  - the current ledger object from useLedger

// Module-level so the module-scope notifyOnce() can dedupe notifications.
// A plain object works fine here — notifyOnce() lives outside the hook and
// doesn't need React's ref semantics; it just needs a stable store across ticks.
const notifiedRef = {} // tag -> true, so we never double-notify

export function useNotifications(session, ledger) {

  // 1. Request permission right after login.
  useEffect(() => {
    if (!session) return
    let cancelled = false
    requestNotificationPermission().then((granted) => {
      if (!cancelled && granted) {
        // Fire an immediate "you're all set" so the user knows it works.
        showNotification('House Ledger is live', 'You will get meal reminders and announcements here.')
      }
    })
    return () => {
      cancelled = true
    }
  }, [session])

  // 2. Tick every 60s: reminders + announcements.
  useEffect(() => {
    if (!session || !ledger) return
    let cancelled = false

    function tick() {
      if (cancelled) return
      const now = new Date()

      // Meal reminders (evening: breakfast+lunch tomorrow; afternoon: dinner).
      for (const r of mealReminderState(now, ledger, RESIDENT_IDS)) {
        notifyOnce(r)
      }

      // Meal summary at 04:00 and 16:00.
      if (now.getHours() === 4 || now.getHours() === 16) {
        notifyOnce(mealSummaryState(now, ledger, RESIDENT_IDS))
      }

      // New announcement.
      const ann = newAnnouncement(ledger)
      if (ann) notifyOnce({ title: 'House announcement', body: ann.text, tag: `ann-${ann.id}` })
    }

    tick() // run once immediately on mount
    const id = setInterval(tick, 60_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [session, ledger])

  return null
}

// Show a notification once per tag, even across ticks.
function notifyOnce(item) {
  if (!item || !item.tag) return
  if (notifiedRef[item.tag]) return
  if (showNotification(item.title, item.body, item.tag)) {
    notifiedRef[item.tag] = true
  }
}
