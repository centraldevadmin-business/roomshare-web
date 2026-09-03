// Notifications layer for the house ledger PWA.
//
// IMPORTANT — no server, no true push. This is a client-side PWA with zero
// cost, so browser notifications can ONLY fire while the app is open on a
// phone. There is no backend to wake the phone in the background. So:
//
//   • Reminders fire based on the wall-clock while the app is open.
//   • A new announcement notifies everyone whose app is currently open.
//
// This module is deliberately framework-agnostic (no React) so the detection
// logic is pure and unit-testable in Node. The React hook (useNotifications)
// is the only place that calls showNotification on a schedule.
//
// The pure helpers here return plain data — the hook decides WHEN to call
// them. That keeps the timing rules testable without a clock.

import { mealCount } from './logic.js'

// ---- Time-window helpers -------------------------------------------------

// Is `now` (a Date) inside the window [startHour, endHour)? Hours are 0-23.
export function isWithinWindow(now, startHour, endHour) {
  const h = now.getHours()
  if (startHour <= endHour) return h >= startHour && h < endHour
  // wrap past midnight, e.g. 22 -> 0
  return h >= startHour || h < endHour
}

// ---- Meal detection ------------------------------------------------------

// Find a resident's meal entry for a given date, or null.
function mealEntry(ledger, resident, dateStr) {
  const log = Array.isArray(ledger.meal_log) ? ledger.meal_log : []
  return log.find((m) => m.resident === resident && m.date === dateStr) || null
}

// Has a resident "entered" a slot for a date? They have, if the slot value is
// > 0 (a plate or a guest). Zero or missing = they forgot to enter.
export function hasEntered(entry, slot) {
  return !!entry && (Number(entry[slot]) || 0) > 0
}

// Count how many residents will eat a given slot tomorrow (plates + guests).
export function mealSlotCount(ledger, residents, dateStr, slot) {
  let total = 0
  for (const r of residents) {
    const entry = mealEntry(ledger, r, dateStr)
    if (!entry) continue
    total += Number(entry[slot] || 0)
    total += Number(entry.guests?.[slot] || 0)
  }
  return total
}

// ---- Pure reminder state -------------------------------------------------

// What meal reminders should fire right now?
//
// Returns an array of { title, body, tag } objects. Each reminder targets one
// resident who has NOT entered a given slot for tomorrow.
//
//   • 21:00-22:00  → "breakfast + lunch tomorrow?" (dinner locks at 16:00, so
//                    we only nag about breakfast + lunch in the evening)
//   • 14:00-15:00  → "dinner tomorrow?" (before dinner prep)
//
// `residents` is the list of resident ids. `now` defaults to Date.now().
export function mealReminderState(now = new Date(), ledger = {}, residents = []) {
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

  const reminders = []

  // Evening window: breakfast + lunch tomorrow.
  if (isWithinWindow(now, 21, 22)) {
    for (const r of residents) {
      const entry = mealEntry(ledger, r, tomorrowStr)
      const missed = []
      if (!hasEntered(entry, 'breakfast')) missed.push('breakfast')
      if (!hasEntered(entry, 'lunch')) missed.push('lunch')
      if (missed.length) {
        reminders.push({
          title: `Hungry tomorrow, ${r}?`,
          body: `You haven't said yet — do you want ${missed.join(' and ')} tomorrow?`,
          tag: `meal-${r}-evening`,
        })
      }
    }
  }

  // Afternoon window: dinner tomorrow.
  if (isWithinWindow(now, 14, 15)) {
    for (const r of residents) {
      const entry = mealEntry(ledger, r, tomorrowStr)
      if (!hasEntered(entry, 'dinner')) {
        reminders.push({
          title: `Dinner tomorrow, ${r}?`,
          body: 'You haven\'t said whether you want dinner tomorrow. Tap to enter!',
          tag: `meal-${r}-dinner`,
        })
      }
    }
  }

  return reminders
}

// The meal summary shown at 04:00 and 16:00: how many people will eat each
// meal today. Returns { title, body } or null when there's nothing to report.
// Includes the total people eating so the head-count is visible in the
// notification, matching the dashboard.
export function mealSummaryState(now = new Date(), ledger = {}, residents = []) {
  const todayStr = now.toISOString().slice(0, 10)
  const breakfast = mealSlotCount(ledger, residents, todayStr, 'breakfast')
  const lunch = mealSlotCount(ledger, residents, todayStr, 'lunch')
  const dinner = mealSlotCount(ledger, residents, todayStr, 'dinner')
  const peopleEating = residents.filter((r) => {
    const e = mealEntry(ledger, r, todayStr)
    if (!e) return false
    const total =
      (e.breakfast || 0) + (e.lunch || 0) + (e.dinner || 0) +
      (e.guests?.breakfast || 0) + (e.guests?.lunch || 0) + (e.guests?.dinner || 0)
    return total > 0
  }).length
  return {
    title: 'House meals today',
    body: `Cook for ${peopleEating} · Breakfast: ${breakfast} · Lunch: ${lunch} · Dinner: ${dinner}`,
    tag: 'meal-summary',
  }
}

// ---- Announcement detection ----------------------------------------------

// Has a new announcement appeared? Compares the newest announcement's id/date
// against the last one we already notified about (stored in localStorage).
// Returns the new announcement object, or null.
export function newAnnouncement(ledger, key = 'roomshare:lastAnnounced') {
  const anns = Array.isArray(ledger.announcements) ? ledger.announcements : []
  if (!anns.length) return null
  const newest = anns[0]
  try {
    const last = JSON.parse(localStorage.getItem(key) || 'null')
    if (last && last.id === newest.id) return null
  } catch {
    // ignore malformed stored value
  }
  return newest
}

// ---- Browser notifications (side-effecting) ------------------------------

// Ask the user to allow notifications. Resolves to the granted state.
export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  try {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  } catch {
    return false
  }
}

// Show a single browser notification. Safe to call in non-browser envs (Node
// tests) — it just returns false. Returns true if shown.
export function showNotification(title, body, tag = '') {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission !== 'granted') return false
  try {
    // Dedupe: a notification with the same tag replaces the previous one, so
    // we don't stack up a pile of identical reminders.
    new Notification(title, { body, tag })
    return true
  } catch {
    return false
  }
}
