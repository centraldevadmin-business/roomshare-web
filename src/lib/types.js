// Core data model for the master_ledger.json file.
// The whole "database" is this one JSON file split into 4 nodes.

import { seedUsers } from './users.js'

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner']

// A single meal record for one resident on one day.
// { resident, date, breakfast, lunch, dinner, guests: {breakfast, lunch, dinner} }
export function emptyMealEntry(resident, date) {
  return {
    resident,
    date,
    breakfast: 0,
    lunch: 0,
    dinner: 0,
    guests: { breakfast: 0, lunch: 0, dinner: 0 },
  }
}

// An expense entry: groceries or a fixed utility.
// { id, date, type: 'grocery'|'utility', vendor, amount, note, paid_by, locked }
// `paid_by` is the resident id who handed the money at bazar — used by the
// settlement to compare "what they spent" against "their share".
export function emptyExpense(id, date, rest = {}) {
  return {
    id,
    date,
    type: 'grocery',
    vendor: '',
    amount: 0,
    note: '',
    paid_by: null,
    locked: false,
    ...rest,
  }
}

// A deposit request submitted by a resident, approved/rejected by admin.
// { id, resident, amount, date, note, status: 'pending'|'approved'|'rejected' }
export function emptyDeposit(id, resident, rest = {}) {
  return {
    id,
    resident,
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    note: '',
    status: 'pending',
    ...rest,
  }
}

export const defaultHouseConfig = {
  currency: 'TK',
  mealRate: 70,
  // Per-person rent. This is the source of truth for rent. `rentPerPerson`
  // below is only a fallback for old ledgers that predate per-person rent.
  rentByResident: { nafiz: 7000, mohin: 0, neloy: 6000 },
  rentPerPerson: 880, // legacy fallback (ignored when rentByResident is set)
  cutoffHour: 21, // meals lock at 9 PM (21:00)
  bazarIntervalDays: 3,
  cutoffDay: 28, // month finalization day
  // Settlement model (end-of-month cash split).
  // Meal weights per slot: breakfast = 0.5, lunch = 1, dinner = 1.
  mealWeights: { breakfast: 0.5, lunch: 1, dinner: 1 },
  // The resident who pays NO rent (e.g. the 3rd person). Others pay their
  // rentByResident amount. Fixed costs are still split across everyone.
  rentFreeResident: null,
  // Fixed monthly costs split equally across ALL residents (gas, internet,
  // service, maid, etc.). Each entry: { name, total }.
  fixedCosts: [],
}

// Prebuilt announcement templates. Anyone can post these with one tap so
// common house notices (no gas / no water / no electricity) go out instantly.
export const PREBUILT_ANNOUNCEMENTS = [
  { text: 'No gas today — kitchen closed, order food', icon: 'fire' },
  { text: 'No water today — tanks being cleaned', icon: 'water' },
  { text: 'No electricity — power cut expected', icon: 'zap' },
  { text: 'Bazar today — groceries coming in', icon: 'cart' },
  { text: 'Maid absent tomorrow — order food', icon: 'broom' },
  { text: 'House cleaning scheduled today', icon: 'sparkle' },
]

// A community to-do item. { id, text, done, priority, due, createdBy }
export function emptyTodo(id, rest = {}) {
  return {
    id,
    text: '',
    done: false,
    priority: 'normal', // 'normal' | 'high'
    due: '',
    createdBy: '',
    ...rest,
  }
}

// A community calendar event. { id, title, date, time, color, createdBy }
export function emptyEvent(id, rest = {}) {
  return {
    id,
    title: '',
    date: '',
    time: '',
    color: 'orange', // 'orange' | 'blue' | 'green' | 'purple'
    createdBy: '',
    ...rest,
  }
}

// A user account. Stored in the ledger's `users` node (synced to GitHub).
// Passwords are stored as SHA-256 + salt hashes, never plain text.
// { id, name, email, username, role, salt, passwordHash, createdAt, active }
export function emptyUser(id, rest = {}) {
  return {
    id,
    name: '',
    email: '',
    username: '',
    role: 'resident',
    salt: '',
    passwordHash: '',
    createdAt: '',
    active: true,
    ...rest,
  }
}

// The initial shape of master_ledger.json.
export function buildDefaultLedger() {
  return {
    version: 1,
    house_config: { ...defaultHouseConfig },
    meal_log: [],
    expense_log: [],
    deposit_ledger: [],
    // carried-over balances from previous months: { [resident]: number }
    balances: {},
    // admin announcements pushed to the "digital fridge"
    announcements: [],
    // community to-do list — anyone can add, everyone can check off
    todos: [],
    // community calendar events
    calendar_events: [],
    // closed months, newest first: { month, year, meal_log, expense_log,
    //   deposit_ledger, balances } — keeps the live logs from accumulating
    //   stale data across months.
    archived_months: [],
    // user accounts for login/RBAC. Seeded with the three hardcoded house
    // accounts (Nafiz, Mohin, Neloy) so the app is usable out of the box.
    users: seedUsers(),
    // VAPID push subscriptions for real background notifications. Each entry:
    //   { id, endpoint, p256dh, auth } — a browser PushSubscription.
    // Written by the app, read by the scheduled GitHub Action that fires pushes.
    push_subscriptions: [],
  }
}
