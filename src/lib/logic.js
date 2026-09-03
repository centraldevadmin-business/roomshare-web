// Business logic helpers — all pure functions, run client-side when the app
// opens. No server processing required.

import { MEAL_SLOTS } from './types.js'

// ---- Meal locking: dual lockout window ----
// Dinner locks at 4 PM (16:00) — a fixed business rule so tomorrow's dinner
// can't be added today. Breakfast & Lunch lock at house_config.cutoffHour
// (default 21:00 / 9 PM), which admins can change from House Settings.
//
// `cutoffHour` may be passed directly (an integer 0-23) or as a full
// house_config object; both forms are accepted.
export function isSlotLocked(slot, now = new Date(), cutoffHour = 21) {
  const hour = now.getHours()
  if (slot === 'dinner') {
    return hour >= 16 // dinner locks at 4 PM
  }
  // breakfast & lunch
  return hour >= Number(cutoffHour) // both lock at the configured cutoff
}

// ---- Debt visualizer: pick a status + color from a balance number ----
//   green  = +500 or more (house owes you — Good Standing)
//   grey   = neutral (roughly 0 to 1000 either way)
//   yellow = debt approaching 1,000 (Attention)
//   flash-red = debt exceeds 2,000 (Severely Behind)
export function debtStatus(balance) {
  if (balance >= 500) return { label: 'Good Standing', tone: 'green' }
  if (balance === 0 || balance === undefined || balance === null) return { label: 'Neutral', tone: 'grey' }
  if (balance < -2000) return { label: 'Severely Behind', tone: 'flash-red' }
  if (balance < -1000) return { label: 'Attention', tone: 'yellow' }
  return { label: 'Neutral', tone: 'grey' }
}

// ---- Computed meal rate: groceries ÷ total meals eaten (Phase 3) ----
// The house pays for groceries; the per-meal rate is derived from actual
// spending, not a hardcoded number. Falls back to config.mealRate if there
// are no grocery expenses yet.
export function computeMealRate(ledger) {
  const config = ledger.house_config || {}
  let groceries = 0
  let totalMeals = 0
  for (const e of ledger.expense_log || []) {
    if (e.type === 'grocery') groceries += Number(e.amount) || 0
  }
  for (const m of ledger.meal_log || []) {
    // Skip meals eaten on vacation dates — vacation mode waives those charges.
    if (isOnVacation(ledger.vacations, m.resident, m.date)) continue
    totalMeals += mealCount(m)
  }
  // Fall back to the configured rate whenever we have no grocery spend to
  // derive a rate from — regardless of how many meals were eaten. (Previously
  // this only fell back when there were no meals, so a month with meals but
  // no logged groceries would compute 0/total = 0, clamped to 1 TK/plate.)
  if (groceries <= 0 || totalMeals <= 0) return Number(config.mealRate) || 70
  return Math.max(1, Math.round(groceries / totalMeals))
}

// ---- Per-person rent: who pays what ----
// `rentByResident` maps resident id -> monthly rent (0 = rent-free). Falls
// back to a flat `rentPerPerson` when the map is absent (older ledgers).
export function rentForResident(config, resident) {
  const map = config.rentByResident
  if (map && typeof map[resident] === 'number') return map[resident]
  // Legacy fallback: rentFreeResident pays 0, everyone else pays rentPerPerson.
  if (config.rentFreeResident === resident) return 0
  return Number(config.rentPerPerson) || 0
}

// ---- Fixed monthly costs: the list split equally across everyone ----
// { name, total } entries (gas, internet, service, maid, ...). Returns the
// per-person share. `n` defaults to the resident count.
export function fixedCostShare(config, n) {
  const count = n || Number(config._residentCount) || 3
  const fixed = Array.isArray(config.fixedCosts) ? config.fixedCosts : []
  const total = fixed.reduce((s, c) => s + Number(c.total || 0), 0)
  return { total, perPerson: total / count }
}

// ---- Variable utilities: logged as `utility` expenses, split equally ----
// Water, electricity, etc. are NOT fixed — they vary month to month. Every
// `utility` expense in the ledger is pooled and divided across all residents.
export function utilityShare(ledger, n) {
  const count = n || Number(ledger.house_config?._residentCount) || 3
  const total = (ledger.expense_log || [])
    .filter((e) => e.type === 'utility')
    .reduce((s, e) => s + Number(e.amount || 0), 0)
  return { total, perPerson: total / count }
}

// ---- Personal balance: net amount the house owes you (Phase 3) ----
// Positive = house owes you (green). Negative = you owe the house (red).
//   net = approved deposits − meals owed − rent − fixed-cost share − utility share
//         + carried-over balance
export function computeDebt(ledger, resident, mealRate) {
  const config = ledger.house_config || {}
  let owed = 0
  for (const m of ledger.meal_log || []) {
    if (m.resident !== resident) continue
    // Skip meals eaten on vacation dates — vacation mode waives those charges.
    if (isOnVacation(ledger.vacations, resident, m.date)) continue
    owed += mealCount(m) * mealRate
  }
  // Rent: per-person amount (0 for the rent-free resident).
  owed += rentForResident(config, resident)
  // Fixed costs (gas, internet, service, maid, ...) split equally.
  owed += fixedCostShare(config).perPerson
  // Variable utilities (water, electricity) split equally.
  owed += utilityShare(ledger).perPerson
  // Approved deposits are credits to this resident.
  let credited = 0
  for (const d of ledger.deposit_ledger || []) {
    if (d.resident === resident && d.status === 'approved') credited += Number(d.amount) || 0
  }
  // Carried-over balance from previous months (positive = they owe you).
  const carried = Number(ledger.balances?.[resident]) || 0
  return credited + carried - owed
}

// ---- Bazar rotation: every Nth day the duty shifts to the next resident ----
export function bazarDuty(residents, date = new Date(), interval = 3) {
  if (!residents || residents.length === 0) return null
  // Day-of-year gives a monotonic counter we can mod.
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date - start
  const dayOfYear = Math.floor(diff / 86400000)
  const shift = Math.floor(dayOfYear / interval) % residents.length
  return residents[shift]
}

// ---- Vacation mode: are meals auto-zeroed for a resident on a date? ----
export function isOnVacation(residentVacations, resident, dateStr) {
  const vac = residentVacations?.[resident]
  if (!vac || !Array.isArray(vac)) return false
  return vac.some((v) => dateStr >= v.start && dateStr <= v.end)
}

// ---- Meal totals for a resident on a day (used for billing) ----
export function mealCount(entry) {
  if (!entry) return 0
  const plates = (entry.breakfast || 0) + (entry.lunch || 0) + (entry.dinner || 0)
  const guests = (entry.guests?.breakfast || 0) + (entry.guests?.lunch || 0) + (entry.guests?.dinner || 0)
  return plates + guests
}

// ---- Weighted meal count (house settlement model) ----
// Meals are weighted by slot so a shared grocery bill can be split fairly:
//   breakfast = 0.5, lunch = 1, dinner = 1
// Guests are weighted the same way. This is the count used by the end-of-month
// settlement, not the per-meal-rate billing shown on the dashboard.
export function weightedMealCount(entry) {
  if (!entry) return 0
  const weights = { breakfast: 0.5, lunch: 1, dinner: 1 }
  const plates =
    (entry.breakfast || 0) * weights.breakfast +
    (entry.lunch || 0) * weights.lunch +
    (entry.dinner || 0) * weights.dinner
  const guests =
    (entry.guests?.breakfast || 0) * weights.breakfast +
    (entry.guests?.lunch || 0) * weights.lunch +
    (entry.guests?.dinner || 0) * weights.dinner
  return plates + guests
}

// ---- Head count for a date: how many people eat each meal (plates + guests) ----
// Rolls up every resident's meal entry for `dateStr` into a glanceable summary
// the maid can read off. Used by both the Maid Board and the resident dashboard
// so everyone sees the same numbers.
//
// Returns { perMeal: { breakfast, lunch, dinner }, peopleEating, totalPlates }.
//   perMeal[slot]   = plates + guests for that slot across all residents
//   peopleEating    = distinct residents who entered ANY slot (plates or guests)
//   totalPlates     = plates + guests across all slots (for a "total today" line)
export function headCountForDate(mealLog, residents, dateStr) {
  const perMeal = { breakfast: 0, lunch: 0, dinner: 0 }
  let peopleEating = 0
  let totalPlates = 0
  for (const id of residents) {
    const entry = (mealLog || []).find((m) => m.resident === id && m.date === dateStr)
    if (!entry) continue
    const plates = (entry.breakfast || 0) + (entry.lunch || 0) + (entry.dinner || 0)
    const guests =
      (entry.guests?.breakfast || 0) + (entry.guests?.lunch || 0) + (entry.guests?.dinner || 0)
    perMeal.breakfast += (entry.breakfast || 0) + (entry.guests?.breakfast || 0)
    perMeal.lunch += (entry.lunch || 0) + (entry.guests?.lunch || 0)
    perMeal.dinner += (entry.dinner || 0) + (entry.guests?.dinner || 0)
    totalPlates += plates + guests
    if (plates + guests > 0) peopleEating += 1
  }
  return { perMeal, peopleEating, totalPlates }
}

// ---- End-of-month settlement: "who pays whom" in cash ----
// Implements the house's real accounting rules:
//   1. Pool every grocery (bazar) expense for the month.
//   2. Sum total weighted meals eaten by everyone.
//   3. cost_per_meal = total grocery spend / total weighted meals
//   4. Each person's meal share = their weighted meals * cost_per_meal
//   5. surplus = what THEY spent at bazar - their meal share
//        + positive  -> they overpaid -> reduces their rent/fixed costs
//        - negative  -> they underpaid -> adds to what they owe
//   6. Rent: per-person amount from config.rentByResident (0 = rent-free).
//   7. Fixed costs (gas, internet, service, maid, ...) split equally across
//      ALL residents.
//   8. Variable utilities (water, electricity) logged as `utility` expenses
//      are pooled and split equally across ALL residents.
//   9. Final bill (netOwed) = rent + fixedCostShare + utilityShare - surplus,
//      paid in cash. Surplus first deducts from rent, then fixed costs, then
//      utilities; any leftover surplus is carried forward to next month.
//
// Returns a structured object (see perPerson shape below). `netOwed` is the
// amount the resident OWES the house (positive = pay the admin in cash).
export function computeSettlement(ledger, residents) {
  const config = ledger.house_config || {}
  const n = residents.length || 1
  const rentFreeResident = config.rentFreeResident || null
  const rentPerPerson = Number(config.rentPerPerson) || 0
  const fixedCosts = Array.isArray(config.fixedCosts) ? config.fixedCosts : []
  const { total: totalFixed, perPerson: fixedCostShareAmt } = fixedCostShare(config, n)
  const { total: totalUtilities, perPerson: utilityShareAmt } = utilityShare(ledger, n)

  // 1. Pool grocery spend, grouped by who paid (paid_by).
  const spentBy = {}
  let totalGroceries = 0
  for (const e of ledger.expense_log || []) {
    if (e.type !== 'grocery') continue
    const amt = Number(e.amount || 0)
    totalGroceries += amt
    const payer = e.paid_by || e.resident || e.vendor || null
    if (payer) spentBy[payer] = (spentBy[payer] || 0) + amt
  }

  // 2. Weighted meals per resident (vacation dates are waived).
  const mealsBy = {}
  let totalMeals = 0
  for (const m of ledger.meal_log || []) {
    if (isOnVacation(ledger.vacations, m.resident, m.date)) continue
    const w = weightedMealCount(m)
    mealsBy[m.resident] = (mealsBy[m.resident] || 0) + w
    totalMeals += w
  }

  // 3. Cost per meal (falls back to configured rate with no data).
  const costPerMeal =
    totalMeals > 0 && totalGroceries > 0
      ? Math.round(totalGroceries / totalMeals)
      : Number(config.mealRate) || 70

  // 4-9. Per-person breakdown.
  const perPerson = {}
  for (const r of residents) {
    const weightedMeals = mealsBy[r] || 0
    const mealShare = weightedMeals * costPerMeal
    const spentAtBazar = spentBy[r] || 0
    const surplus = spentAtBazar - mealShare // + = overpaid, - = underpaid

    const rent = rentForResident(config, r)
    let netOwed = rent + fixedCostShareAmt + utilityShareAmt
    let carriedForward = 0

    if (surplus > 0) {
      // Surplus deducts from rent first, then fixed costs, then utilities.
      let rem = surplus
      const intoRent = Math.min(rem, rent)
      netOwed -= intoRent
      rem -= intoRent
      const intoFixed = Math.min(rem, fixedCostShareAmt)
      netOwed -= intoFixed
      rem -= intoFixed
      const intoUtility = Math.min(rem, utilityShareAmt)
      netOwed -= intoUtility
      rem -= intoUtility
      carriedForward = rem
    } else {
      // Underpayment adds to what they owe.
      netOwed += Math.abs(surplus)
    }

    perPerson[r] = {
      resident: r,
      weightedMeals,
      mealShare,
      spentAtBazar,
      surplus,
      rent,
      fixedCostShare: fixedCostShareAmt,
      utilityShare: utilityShareAmt,
      netOwed,
      carriedForward,
    }
  }

  return {
    costPerMeal,
    totalGroceries,
    totalWeightedMeals: totalMeals,
    totalUtilities: totalUtilities,
    fixedCosts,
    totalFixedCosts: totalFixed,
    fixedCostShare: fixedCostShareAmt,
    rentPerPerson,
    rentFreeResident,
    perPerson,
  }
}

// ---- Date helpers ----
export function todayStr(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

export function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

// ---- Month-finalization gate ----
// A month can only be finalized on or after house_config.cutoffDay (default
// 28) of the current month. This stops an admin from prematurely closing a
// month mid-cycle. Returns { ok, message } so the UI can show a reason.
export function canFinalizeMonth(ledger, now = new Date()) {
  const cutoffDay = Number(ledger?.house_config?.cutoffDay) || 28
  const dayOfMonth = now.getDate()
  const daysInThisMonth = daysInMonth(now.getFullYear(), now.getMonth())
  if (dayOfMonth < cutoffDay) {
    return {
      ok: false,
      message:
        `Month can't be finalized until day ${cutoffDay}. ` +
        `It's day ${dayOfMonth} of ${daysInThisMonth} right now.`,
    }
  }
  return { ok: true }
}

// ---- Community calendar helpers ----
// Build a month grid of day numbers for a given year/month. Returns an array
// of { day, dateStr, isCurrentMonth } cells laid out in weeks (Sun–Sat),
// padded with nulls so the first week starts on the correct weekday.
export function buildCalendarGrid(year, month) {
  const first = new Date(year, month, 1)
  const startWeekday = first.getDay() // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, dateStr, isCurrentMonth: true })
  }
  return cells
}

// Count events scheduled for a specific date string.
export function eventsOnDate(events, dateStr) {
  return (events || []).filter((e) => e.date === dateStr).length
}

// ---- Unique ID generator ----
// Queue entries (expenses, deposits, announcements) need stable, unique IDs.
// Date.now().toString() alone can collide when two entries are created within
// the same millisecond, which would make edits/deletes hit the wrong row.
// This combines a timestamp, a monotonic counter, and randomness so IDs are
// unique even under rapid successive creation.
let _idCounter = 0
export function uniqueId(prefix = 'id') {
  _idCounter = (_idCounter + 1) % 1e9
  const rand = Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now().toString(36)}-${_idCounter.toString(36)}-${rand}`
}
