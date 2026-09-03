// GitHub sync engine — the "database layer".
//
// The whole app is backed by a single master_ledger.json in a private repo.
// We use GitHub's REST API with ETag-based optimistic concurrency so that
// two phones editing at once do NOT crash:
//
//   GET  -> returns an ETag (version fingerprint)
//   PUT  -> sent with If-Match: <etag>
//   409  -> someone else changed it; we re-GET, merge our local queue, retry
//
// Offline edits are queued in localStorage and flushed on the next sync.
//
// SECURITY: The browser talks to a Cloudflare Worker (VITE_WORKER_URL), which
// holds the GitHub token server-side. The token is NEVER in the app bundle.

import { buildDefaultLedger } from './types.js'
import { uniqueId, canFinalizeMonth } from './logic.js'
import { encryptLedger, decryptLedger } from './ledgerCrypto.js'

// All sync requests go through the Cloudflare Worker proxy. The token lives
// server-side in the Worker; the browser never sees it.
const API = import.meta.env?.VITE_WORKER_URL || 'https://roomshare-proxy.workers.dev'

function env(key) {
  return import.meta.env?.[key]
}

function ghConfig() {
  return {
    user: env('VITE_GITHUB_USER') || '',
    repo: env('VITE_GITHUB_REPO') || '',
  }
}

// localStorage keys for the offline queue + last etag.
const QUEUE_KEY = 'roomshare:queue'
const ETAG_KEY = 'roomshare:etag'

export function loadQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  } catch {
    return []
  }
}
function saveQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}
export function pushQueue(item) {
  const q = loadQueue()
  q.push(item)
  saveQueue(q)
}
export function clearQueue() {
  saveQueue([])
}

export function loadEtag() {
  return localStorage.getItem(ETAG_KEY)
}
function saveEtag(etag) {
  if (etag) localStorage.setItem(ETAG_KEY, etag)
  else localStorage.removeItem(ETAG_KEY)
}

// ---- Low-level GitHub REST helpers ----

async function apiRequest(method, url, body, headers = {}) {
  // `url` looks like:
  //   https://api.github.com/repos/<user>/<repo>/contents/master_ledger.json
  // We strip the GitHub prefix and route the request through the Cloudflare
  // Worker, which holds the token server-side. The Worker re-adds the token.
  const cfg = ghConfig()
  const contentsPath = url.split('/contents/')[1] || ''
  const workerUrl = `${API}/contents/${contentsPath}`

  const res = await fetch(workerUrl, {
    method,
    headers: {
      'User-Agent': 'roomshare-pwa',
      'Accept': 'application/vnd.github+json',
      ...headers,
    },
    body,
  })
  return res
}

// Fetch the file content + its ETag.
export async function fetchFile() {
  const cfg = ghConfig()
  if (!cfg.repo) {
    throw new Error('GitHub not configured. Copy .env.example to .env.local and set VITE_GITHUB_REPO + VITE_WORKER_URL.')
  }
  const url = `${API}/contents/master_ledger.json`
  const res = await apiRequest('GET', url)
  if (res.status === 404) return null // file does not exist yet
  if (!res.ok) {
    throw new Error(`GitHub fetch failed (${res.status}): ${await res.text()}`)
  }
  const etag = res.headers.get('etag')
  const data = await res.json()
  // GitHub returns base64 content for binary-safe transfer.
  const raw = atob(data.content).replace(/\n$/, '')
  // Decrypt the ledger at rest. decryptLedger transparently passes through
  // legacy plaintext files (encrypted: false) so upgrades are seamless.
  const { plaintext, error } = await decryptLedger(raw, env('VITE_HOUSE_PASSWORD') || '')
  if (error) {
    throw new Error('Wrong house password or corrupted ledger. Check VITE_HOUSE_PASSWORD.')
  }
  const parsed = plaintext ? JSON.parse(plaintext) : null
  return { parsed, etag, path: data.path, sha: data.sha }
}

// Write the file. Uses If-Match for concurrency. Returns true on success,
// false on 409 (conflict — caller should merge & retry).
//
// The GitHub Contents API requires the current file `sha` when updating an
// existing file — omitting it returns 422 "sha wasn't supplied". We pass the
// SHA fetched during pull so the update is accepted.
async function writeFile(content, etag, sha) {
  const url = `${API}/contents/master_ledger.json`
  // Encrypt the ledger before it leaves the browser. The file stored in GitHub
  // (and seen by the Cloudflare Worker) is ciphertext — no plaintext ever
  // touches GitHub's or the proxy's servers.
  const encrypted = await encryptLedger(content, env('VITE_HOUSE_PASSWORD') || '')
  const body = JSON.stringify({
    message: `roomshare: ${new Date().toISOString()}`,
    content: btoa(unescape(encodeURIComponent(encrypted))),
    sha, // required by the GitHub API when updating an existing file
  })
  const headers = {}
  // NOTE: we intentionally do NOT send If-Match. The GitHub Contents API
  // rejects conditional request headers on unsafe (cross-origin) PUT requests,
  // returning 400. The `sha` field already provides optimistic concurrency, so
  // If-Match is redundant here.
  const res = await apiRequest('PUT', url, body, headers)
  if (res.status === 409) return false
  if (!res.ok) {
    throw new Error(`GitHub write failed (${res.status}): ${await res.text()}`)
  }
  const newEtag = res.headers.get('etag')
  saveEtag(newEtag)
  return true
}

// ---- High-level sync: pull -> apply queue -> push, with conflict retry ----

// Apply a batch of queued local operations to the in-memory ledger.
// Each queued item is { op, args }. Ops are pure functions of the ledger.
export function applyQueue(ledger, queue) {
  let changed = false
  for (const item of queue) {
    try {
      const fn = QUEUE_OPS[item.op]
      if (!fn) continue
      const next = fn(ledger, item.args)
      if (next !== ledger) {
        ledger.meal_log = next.meal_log
        ledger.expense_log = next.expense_log
        ledger.deposit_ledger = next.deposit_ledger
        ledger.house_config = next.house_config
        ledger.balances = next.balances
        ledger.announcements = next.announcements
        ledger.todos = next.todos
        ledger.calendar_events = next.calendar_events
        ledger.archived_months = next.archived_months
        ledger.users = next.users
        ledger.push_subscriptions = next.push_subscriptions
        changed = true
      }
    } catch (e) {
      console.warn('queue op failed', item, e)
    }
  }
  return changed
}

// The set of local operations a device can queue. These mirror the admin/
// resident actions. Residents can only queue their own id.
const QUEUE_OPS = {
  toggleMeal: (l, { resident, date, slot, value }) => {
    let entry = l.meal_log.find((m) => m.resident === resident && m.date === date)
    if (!entry) {
      entry = { resident, date, breakfast: 0, lunch: 0, dinner: 0, guests: { breakfast: 0, lunch: 0, dinner: 0 } }
      l.meal_log.push(entry)
    }
    entry[slot] = value ? 1 : 0
    return l
  },
  setGuests: (l, { resident, date, slot, value }) => {
    const entry = l.meal_log.find((m) => m.resident === resident && m.date === date)
    if (entry) entry.guests[slot] = value
    return l
  },
  addExpense: (l, { expense }) => {
    l.expense_log.push(expense)
    return l
  },
  updateExpense: (l, { id, patch }) => {
    const e = l.expense_log.find((x) => x.id === id)
    if (e) Object.assign(e, patch)
    return l
  },
  deleteExpense: (l, { id }) => {
    l.expense_log = l.expense_log.filter((x) => x.id !== id)
    return l
  },
  addDeposit: (l, { deposit }) => {
    l.deposit_ledger.push(deposit)
    return l
  },
  setDepositStatus: (l, { id, status }) => {
    const d = l.deposit_ledger.find((x) => x.id === id)
    if (d) d.status = status
    return l
  },
  setAnnouncement: (l, { text }) => {
    // Append the admin's fridge note to the shared community feed instead of
    // replacing the whole array. The Community screen renders the same
    // `announcements` array, so a replace here would wipe every resident's
    // post. Newest-first, matching postAnnouncement.
    if (!Array.isArray(l.announcements)) l.announcements = []
    l.announcements.unshift({ id: uniqueId('ann'), text, date: new Date().toISOString(), by: 'Admin' })
    return l
  },
  // Community announcement — appends to the list (newest first) so everyone's
  // notices show in the feed, not just the admin's single fridge post.
  postAnnouncement: (l, { text, by }) => {
    if (!Array.isArray(l.announcements)) l.announcements = []
    l.announcements.unshift({ id: uniqueId('ann'), text, date: new Date().toISOString(), by: by || 'House' })
    return l
  },
  updateConfig: (l, { patch }) => {
    l.house_config = { ...l.house_config, ...patch }
    return l
  },
  finalizeMonth: (l, { nextBalances }) => {
    // Safety net: don't finalize a month that isn't near its end yet. The UI
    // (AdminControlCenter) checks this first, but the queue op enforces it too
    // so a stale/gated op can never prematurely close a month.
    const gate = canFinalizeMonth(l)
    if (!gate.ok) throw new Error(`CANNOT_FINALIZE: ${gate.message}`)
    // Archive the month we are closing (newest first) so the live logs do not
    // accumulate stale data that would keep polluting computeMealRate and the
    // next month's Excel report.
    const now = new Date()
    const month = now.getMonth()
    const year = now.getFullYear()
    l.archived_months.unshift({
      month,
      year,
      meal_log: l.meal_log,
      expense_log: l.expense_log,
      deposit_ledger: l.deposit_ledger,
      balances: { ...(l.balances || {}) },
    })
    l.balances = nextBalances
    l.meal_log = []
    l.expense_log = []
    l.deposit_ledger = []
    return l
  },
  addVacation: (l, { resident, start, end }) => {
    if (!l.vacations) l.vacations = {}
    if (!Array.isArray(l.vacations[resident])) l.vacations[resident] = []
    l.vacations[resident].push({ start, end })
    return l
  },
  removeVacation: (l, { resident, index }) => {
    if (!l.vacations || !Array.isArray(l.vacations[resident])) return l
    l.vacations[resident].splice(index, 1)
    return l
  },
  addTodo: (l, { todo }) => {
    if (!Array.isArray(l.todos)) l.todos = []
    l.todos.push(todo)
    return l
  },
  toggleTodo: (l, { id }) => {
    if (!Array.isArray(l.todos)) return l
    const t = l.todos.find((x) => x.id === id)
    if (t) t.done = !t.done
    return l
  },
  deleteTodo: (l, { id }) => {
    if (!Array.isArray(l.todos)) return l
    l.todos = l.todos.filter((x) => x.id !== id)
    return l
  },
  addEvent: (l, { event }) => {
    if (!Array.isArray(l.calendar_events)) l.calendar_events = []
    l.calendar_events.push(event)
    return l
  },
  deleteEvent: (l, { id }) => {
    if (!Array.isArray(l.calendar_events)) return l
    l.calendar_events = l.calendar_events.filter((x) => x.id !== id)
    return l
  },
  // ---- User management (admin) ----
  createUser: (l, { user }) => {
    if (!Array.isArray(l.users)) l.users = []
    l.users.push(user)
    return l
  },
  updateUser: (l, { id, patch }) => {
    if (!Array.isArray(l.users)) return l
    const u = l.users.find((x) => x.id === id)
    if (u) Object.assign(u, patch)
    return l
  },
  deleteUser: (l, { id }) => {
    if (!Array.isArray(l.users)) return l
    l.users = l.users.filter((x) => x.id !== id)
    return l
  },
  setUserActive: (l, { id, active }) => {
    if (!Array.isArray(l.users)) return l
    const u = l.users.find((x) => x.id === id)
    if (u) u.active = active
    return l
  },
  // ---- Push subscriptions (real background notifications) ----
  // A browser PushSubscription is written to the ledger so the scheduled
  // GitHub Action can send VAPID pushes even when the app is closed.
  addPushSubscription: (l, { sub }) => {
    if (!Array.isArray(l.push_subscriptions)) l.push_subscriptions = []
    // Replace any existing subscription for this id (device may have rotated).
    l.push_subscriptions = l.push_subscriptions.filter((s) => s.id !== sub.id)
    l.push_subscriptions.push(sub)
    return l
  },
  removePushSubscription: (l, { id }) => {
    if (!Array.isArray(l.push_subscriptions)) return l
    l.push_subscriptions = l.push_subscriptions.filter((s) => s.id !== id)
    return l
  },
}

// The main sync routine. Pulls the latest, applies this device's queue,
// and pushes back — retrying on 409 conflicts.
export async function sync(ledger, queue) {
  const pull = await fetchFile()
  if (!pull) {
    // No file yet: seed with defaults, apply queue, create it.
    const seeded = seedLedger(ledger)
    applyQueue(seeded, queue)
    await writeFile(JSON.stringify(seeded, null, 2), null)
    return { ledger: seeded, created: true }
  }

  // Start from the authoritative server copy.
  const merged = structuredClone(pull.parsed)
  applyQueue(merged, queue)

  // Push with retry loop (bounded) to handle 409 conflicts.
  let etag = pull.etag
  let attempts = 0
  const maxAttempts = 6
  while (attempts < maxAttempts) {
    attempts++
    const ok = await writeFile(JSON.stringify(merged, null, 2), etag, pull.sha)
    if (ok) {
      clearQueue()
      return { ledger: merged, created: false }
    }
    // 409: someone else won. Re-pull and re-merge our queue.
    const repull = await fetchFile()
    if (!repull) throw new Error('File disappeared mid-sync')
    const reparsed = structuredClone(repull.parsed)
    applyQueue(reparsed, queue)
    Object.assign(merged, reparsed)
    etag = repull.etag
    // CRITICAL: also refresh the sha. The old code only updated `etag` and
    // left `pull.sha` pointing at the now-stale blob, so every retry sent the
    // wrong sha and GitHub kept returning 409. This is what made the
    // sync-after-action fix appear to fail — the queue emptied (writeFile
    // returned false, not true) but the write never landed.
    pull.sha = repull.sha
  }
  throw new Error('Sync conflict could not be resolved after several retries.')
}

// Seed a fresh ledger from defaults if the file is empty/malformed.
//
// We validate ALL four core nodes, not just meal_log. A partial write or
// corrupted transfer can leave the file half-formed — e.g. a valid
// house_config but a null/missing expense_log. Checking only meal_log would
// let such a file through and then crash later when code iterates over a
// non-array node. If any required node is missing or the wrong type, we
// discard and rebuild from defaults.
export function seedLedger(ledger) {
  const valid = (v) => Array.isArray(v)
  if (
    !ledger ||
    !ledger.house_config ||
    typeof ledger.house_config !== 'object' ||
    !valid(ledger.meal_log) ||
    !valid(ledger.expense_log) ||
    !valid(ledger.deposit_ledger) ||
    !Array.isArray(ledger.announcements) ||
    !Array.isArray(ledger.todos) ||
    !Array.isArray(ledger.calendar_events) ||
    !Array.isArray(ledger.users)
  ) {
    return buildDefaultLedger()
  }
  return ledger
}

// Force-overwrite: admin overwrites the GitHub file with local data.
export async function forceOverwrite(ledger) {
  // Fetch the current file to get its SHA (required by the GitHub API for
  // updates), then overwrite with local data.
  const pull = await fetchFile()
  await writeFile(JSON.stringify(ledger, null, 2), pull?.etag, pull?.sha)
  clearQueue()
}
