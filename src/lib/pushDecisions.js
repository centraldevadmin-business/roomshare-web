// Pure push-decision logic — runs in the GitHub Action (Node) to decide what
// to push to each phone. No browser APIs, no React. Pure + unit-testable.
//
// The scheduled Action imports this, feeds it the current ledger + a clock,
// and gets back a list of { sub, title, body, tag, url } messages to send via
// the browser Push API.

import { mealSlotCount } from './notifications.js'

// Local Y/m/d date string (UTC+6 aware — Bangladesh time, the house's zone).
export function localDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Tomorrow's local date string.
export function tomorrowStr(d) {
  const t = new Date(d)
  t.setDate(t.getDate() + 1)
  return localDateStr(t)
}

// ---- Decision: meal reminders ---------------------------------------------
// Evening (21:00–22:00 local): nag residents who haven't entered breakfast +
// lunch for tomorrow. Afternoon (14:00–15:00): nag about dinner tomorrow.
//
// `residents` = list of resident ids. `now` = Date (defaults to now).
// Returns array of { id (resident), title, body, tag }.
export function decideMealReminders(ledger, residents, now = new Date()) {
  const hour = now.getHours()
  const tomorrow = tomorrowStr(now)
  const log = Array.isArray(ledger.meal_log) ? ledger.meal_log : []
  const entryFor = (resident) =>
    log.find((m) => m.resident === resident && m.date === tomorrow) || null
  const entered = (resident, slot) => {
    const e = entryFor(resident)
    return !!e && (Number(e[slot]) || 0) > 0
  }

  const out = []
  if (hour >= 21 && hour < 22) {
    for (const r of residents) {
      if (entered(r, 'breakfast') && entered(r, 'lunch')) continue
      const missed = []
      if (!entered(r, 'breakfast')) missed.push('breakfast')
      if (!entered(r, 'lunch')) missed.push('lunch')
      out.push({
        id: r,
        title: `Hungry tomorrow, ${r}?`,
        body: `You haven't said yet — do you want ${missed.join(' and ')} tomorrow?`,
        tag: `meal-${r}-evening`,
      })
    }
  }
  if (hour >= 14 && hour < 15) {
    for (const r of residents) {
      if (entered(r, 'dinner')) continue
      out.push({
        id: r,
        title: `Dinner tomorrow, ${r}?`,
        body: 'You haven\'t said whether you want dinner tomorrow. Open the app to enter!',
        tag: `meal-${r}-dinner`,
      })
    }
  }
  return out
}

// ---- Decision: meal summary (04:00 & 16:00) -------------------------------
// One summary for everyone: how many will eat each meal today. Includes the
// total people eating so the head-count is visible in the push, matching the
// dashboard.
export function decideMealSummary(ledger, residents, now = new Date()) {
  const today = localDateStr(now)
  const breakfast = mealSlotCount(ledger, residents, today, 'breakfast')
  const lunch = mealSlotCount(ledger, residents, today, 'lunch')
  const dinner = mealSlotCount(ledger, residents, today, 'dinner')
  const peopleEating = residents.filter((r) => {
    const e = (Array.isArray(ledger.meal_log) ? ledger.meal_log : []).find(
      (m) => m.resident === r && m.date === today
    )
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

// ---- Decision: new announcement -------------------------------------------
// Returns the newest announcement as a push message, or null if there's none.
// The Action tracks the last-announced id in a sidecar file so it only pushes
// each announcement once.
export function decideNewAnnouncement(ledger, lastAnnouncedId) {
  const anns = Array.isArray(ledger.announcements) ? ledger.announcements : []
  if (!anns.length) return null
  const newest = anns[0]
  if (newest.id === lastAnnouncedId) return null
  return {
    title: 'House announcement',
    body: newest.text,
    tag: `ann-${newest.id}`,
  }
}

// ---- Decision: full batch for a tick --------------------------------------
// Combines all decisions into one list of messages. `residents` is the list of
// resident ids (from users.js RESIDENT_IDS). `lastAnnouncedId` is tracked by
// the Action. Returns { messages, nextAnnouncedId }.
export function decidePushBatch(ledger, residents, now = new Date(), lastAnnouncedId = null) {
  const messages = []
  let nextAnnouncedId = lastAnnouncedId

  for (const m of decideMealReminders(ledger, residents, now)) {
    messages.push({ target: m.id, title: m.title, body: m.body, tag: m.tag })
  }

  const hour = now.getHours()
  if (hour === 4 || hour === 16) {
    const s = decideMealSummary(ledger, residents, now)
    messages.push({ target: 'everyone', title: s.title, body: s.body, tag: s.tag })
  }

  const ann = decideNewAnnouncement(ledger, lastAnnouncedId)
  if (ann) {
    nextAnnouncedId = ledger.announcements[0].id
    messages.push({ target: 'everyone', title: ann.title, body: ann.body, tag: ann.tag })
  }

  return { messages, nextAnnouncedId }
}
