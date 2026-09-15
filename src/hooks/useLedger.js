import { useState, useEffect, useCallback, useRef } from 'react'
import { sync, fetchFile, pushQueue, applyQueue, forceOverwrite } from '../lib/githubSync.js'
import { buildDefaultLedger } from '../lib/types.js'
import { seedUsers } from '../lib/users.js'
import { todayStr } from '../lib/logic.js'

// Central ledger hook. Manages:
//  - the in-memory ledger (source of truth for the UI)
//  - syncing to GitHub (pull -> apply queue -> push, with conflict retry)
//  - queuing local ops for offline safety
//
// Residents can only queue ops for their own id. Admins can queue anything.

// Generate a strong random password: 16 chars mixing upper, lower, digits,
// and symbols. Used by the admin "change password" flow so every resident can
// have a strong, unique password the admin can show them.
function generateStrongPassword() {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lower = 'abcdefghijklmnopqrstuvwxyz'
  const digits = '0123456789'
  const symbols = '!@#$%^&*()-_=+'
  const all = upper + lower + digits + symbols
  const required = [upper, lower, digits, symbols]
  const len = 16
  const chars = new Array(len)
  // Guarantee at least one of each class.
  for (let i = 0; i < required.length; i++) {
    chars[i] = required[i][crypto.getRandomValues(new Uint32Array(1))[0] % required[i].length]
  }
  // Fill the rest randomly, then shuffle so the guaranteed chars aren't fixed.
  for (let i = required.length; i < len; i++) {
    chars[i] = all[crypto.getRandomValues(new Uint32Array(1))[0] % all.length]
  }
  for (let i = len - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

export function useLedger(session) {
  const [ledger, setLedger] = useState(buildDefaultLedger)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(null)
  const [lastSync, setLastSync] = useState(null)
  const queueRef = useRef(loadQueue())

  function loadQueue() {
    try {
      return JSON.parse(localStorage.getItem('roomshare:queue')) || []
    } catch {
      return []
    }
  }

  // Full admin = the real admin only. The "co-admin" (flat owner) role looks
  // identical in the UI but is silently denied these powers: users.manage and
  // expenses.delete. Everything else is identical.
  // Cap the auto-sync retry cadence so a persistent write failure (GitHub 409,
  // offline, no write access) can never spin the app in a tight retry loop.
  const RETRY_MIN_MS = 15000
  const lastFailedRef = useRef(0)
  const isFullAdmin = useCallback(() => session?.role === 'admin', [session])
  function enqueue(op, args) {
    const q = loadQueue()
    q.push({ op, args, at: Date.now() })
    localStorage.setItem('roomshare:queue', JSON.stringify(q))
    queueRef.current = q
  }

  // Pull the latest from GitHub.
  const pull = useCallback(async () => {
    const pullResult = await fetchFile()
    if (pullResult && pullResult.parsed) {
      setLedger(pullResult.parsed)
    }
    return pullResult
  }, [])

  // Initial load.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setLoading(true)
        const pullResult = await pull()
        if (!active) return
        // Apply any queued local ops to the pulled ledger.
        if (pullResult && pullResult.parsed) {
          const merged = structuredClone(pullResult.parsed)
          applyQueue(merged, loadQueue())
          // If the pulled ledger has no users (e.g. a fresh/empty GitHub file,
          // or a ledger that predates the auth system), seed the hardcoded
          // house accounts so login works. Without this the app can never log
          // in — authenticate() looks up ledger.users, which would be empty.
          if (!Array.isArray(merged.users) || merged.users.length === 0) {
            merged.users = seedUsers()
          } else {
            // Defense-in-depth: drop any user that arrived malformed (e.g. a
            // stale createUser op that pushed a Promise instead of an object,
            // which would otherwise crash the Members screen on render).
            merged.users = merged.users.filter((u) => u && typeof u.name === 'string' && u.name)
          }
          setLedger(merged)
        } else {
          // No file yet — seed defaults locally.
          setLedger(buildDefaultLedger())
        }
        setLastSync(new Date())
      } catch (e) {
        if (active) setError(String(e.message || e))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [pull])

  // The main sync: apply queue + push to GitHub.
  const doSync = useCallback(async () => {
    if (syncing) return
    setSyncing(true)
    setError(null)
    try {
      const queue = loadQueue()
      // The in-memory `ledger` already has every queued op applied (each action
      // applies its op for instant UI feedback AND enqueues it). We pass the
      // queue to `sync` so the SERVER receives the ops and clears the queue on
      // success — but we do NOT re-apply the queue to the local `ledger` here,
      // or every op would be added twice (once by the action, once by the sync).
      // `sync()` handles the pull/merge/retry internally.
      const result = await sync(ledger, queue)
      setLedger(result.ledger)
      setLastSync(new Date())
    } catch (e) {
      setError(String(e.message || e))
      lastFailedRef.current = Date.now()
    } finally {
      setSyncing(false)
    }
  }, [ledger, syncing])

  // ---- Debounced auto-sync after any user action ----
  // Every action above enqueues to localStorage but does NOT push to GitHub
  // until the next scheduled sync (04:00/16:00). That means edits made during
  // a session sit in localStorage until the next window. This effect flushes
  // the queue automatically ~2 seconds after the last action, so changes reach
  // GitHub almost immediately while still batching bursts.
  useEffect(() => {
    let timer
    const flush = () => {
      const q = loadQueue()
      if (q.length === 0) return
      // Guard against overlapping syncs AND against a runaway retry loop: if a
      // sync keeps failing (e.g. GitHub 409, offline, no write access) the
      // queue is never cleared, so we must not hammer the network forever.
      // Cap the retry cadence to at most once per RETRY_MIN_MS.
      const now = Date.now()
      if (lastFailedRef.current && now - lastFailedRef.current < RETRY_MIN_MS) return
      try {
        doSync()
      } catch {
        // doSync surfaces its own error state.
      }
    }
    // Debounce: re-arm when the queue GROWS (a new user action was enqueued)
    // OR when the queue is non-empty on initial mount (stale ops from a
    // previous session that never flushed). We deliberately do NOT re-arm on
    // ledger/syncing changes — otherwise a failing sync that flips `syncing`
    // back and forth would re-run this effect and spin in a tight 2s retry
    // loop forever.
    // Start prevLen at 0 so a non-empty queue on initial mount is treated as
    // "queue grew" and triggers a flush. Without this, stale ops left in
    // localStorage from a previous session would never be flushed because
    // prevLen would already equal the queue length.
    let prevLen = 0
    const check = () => {
      const len = loadQueue().length
      if (len > prevLen) {
        prevLen = len
        if (timer) clearTimeout(timer)
        timer = setTimeout(flush, 2000)
      }
    }
    check()
    // Re-check whenever the queue changes in another tab.
    const onStorage = () => check()
    window.addEventListener('storage', onStorage)
    // Poll as a fallback (storage events don't fire for same-tab writes).
    const interval = setInterval(check, 1500)
    return () => {
      if (timer) clearTimeout(timer)
      clearInterval(interval)
      window.removeEventListener('storage', onStorage)
    }
  }, [doSync])

  // ---- Resident actions (self-scoped) ----
  const toggleMeal = useCallback((resident, date, slot, value) => {
    if (resident !== session?.id) return
    enqueue('toggleMeal', { resident, date, slot, value })
    setLedger((l) => {
      const next = structuredClone(l)
      applyQueue(next, [{ op: 'toggleMeal', args: { resident, date, slot, value } }])
      return next
    })
  }, [session])

  // Set all three of today's meal slots in one tap (breakfast + lunch +
  // dinner = 1 each). Self-scoped like toggleMeal.
  const setAllMeals = useCallback((resident, date) => {
    if (resident !== session?.id) return
    for (const slot of ['breakfast', 'lunch', 'dinner']) {
      enqueue('toggleMeal', { resident, date, slot, value: true })
    }
    setLedger((l) => {
      const next = structuredClone(l)
      for (const slot of ['breakfast', 'lunch', 'dinner']) {
        applyQueue(next, [{ op: 'toggleMeal', args: { resident, date, slot, value: true } }])
      }
      return next
    })
  }, [session])

  const setGuests = useCallback((resident, date, slot, value) => {
    if (resident !== session?.id) return
    enqueue('setGuests', { resident, date, slot, value })
    setLedger((l) => {
      const next = structuredClone(l)
      applyQueue(next, [{ op: 'setGuests', args: { resident, date, slot, value } }])
      return next
    })
  }, [session])

  const addDeposit = useCallback((deposit) => {
    enqueue('addDeposit', { deposit })
    setLedger((l) => {
      const next = structuredClone(l)
      applyQueue(next, [{ op: 'addDeposit', args: { deposit } }])
      return next
    })
  }, [])

  const addVacation = useCallback((resident, { start, end }) => {
    if (resident !== session?.id) return
    enqueue('addVacation', { resident, start, end })
    setLedger((l) => {
      const next = structuredClone(l)
      applyQueue(next, [{ op: 'addVacation', args: { resident, start, end } }])
      return next
    })
  }, [session])

  const removeVacation = useCallback((resident, index) => {
    if (resident !== session?.id) return
    enqueue('removeVacation', { resident, index })
    setLedger((l) => {
      const next = structuredClone(l)
      applyQueue(next, [{ op: 'removeVacation', args: { resident, index } }])
      return next
    })
  }, [session])

  // ---- Community actions (anyone can add; anyone can complete) ----
  const addTodo = useCallback((todo) => {
    enqueue('addTodo', { todo })
    setLedger((l) => {
      const next = structuredClone(l)
      applyQueue(next, [{ op: 'addTodo', args: { todo } }])
      return next
    })
  }, [])

  const toggleTodo = useCallback((id) => {
    enqueue('toggleTodo', { id })
    setLedger((l) => {
      const next = structuredClone(l)
      applyQueue(next, [{ op: 'toggleTodo', args: { id } }])
      return next
    })
  }, [])

  const deleteTodo = useCallback((id) => {
    if (session?.role !== 'admin') return
    enqueue('deleteTodo', { id })
    setLedger((l) => {
      const next = structuredClone(l)
      applyQueue(next, [{ op: 'deleteTodo', args: { id } }])
      return next
    })
  }, [session])

  const addEvent = useCallback((event) => {
    enqueue('addEvent', { event })
    setLedger((l) => {
      const next = structuredClone(l)
      applyQueue(next, [{ op: 'addEvent', args: { event } }])
      return next
    })
  }, [])

  const deleteEvent = useCallback((id) => {
    if (session?.role !== 'admin') return
    enqueue('deleteEvent', { id })
    setLedger((l) => {
      const next = structuredClone(l)
      applyQueue(next, [{ op: 'deleteEvent', args: { id } }])
      return next
    })
  }, [session])

  // ---- Bazar entry (any resident, cadmin, or admin) ----
  // No rotation. Whoever goes to the bazar (or hands over cash) logs their
  // purchase as a grocery expense with paid_by = themselves. The total folds
  // into the grocery pool and is calculated against the meal rate.
  const addBazar = useCallback((expense) => {
    if (!session) return
    enqueue('addExpense', { expense })
    setLedger((l) => {
      const next = structuredClone(l)
      applyQueue(next, [{ op: 'addExpense', args: { expense } }])
      return next
    })
  }, [session, enqueue])

  // ---- Admin actions ----
  const addExpense = useCallback((expense) => {
    if (session?.role !== 'admin') return
    enqueue('addExpense', { expense })
    setLedger((l) => {
      const next = structuredClone(l)
      applyQueue(next, [{ op: 'addExpense', args: { expense } }])
      return next
    })
  }, [session])

  const updateExpense = useCallback((id, patch) => {
    if (session?.role !== 'admin') return
    enqueue('updateExpense', { id, patch })
    setLedger((l) => {
      const next = structuredClone(l)
      applyQueue(next, [{ op: 'updateExpense', args: { id, patch } }])
      return next
    })
  }, [session])

  const deleteExpense = useCallback((id) => {
    if (!isFullAdmin()) return
    enqueue('deleteExpense', { id })
    setLedger((l) => {
      const next = structuredClone(l)
      applyQueue(next, [{ op: 'deleteExpense', args: { id } }])
      return next
    })
  }, [session])

  const setDepositStatus = useCallback((id, status) => {
    if (session?.role !== 'admin') return
    enqueue('setDepositStatus', { id, status })
    setLedger((l) => {
      const next = structuredClone(l)
      applyQueue(next, [{ op: 'setDepositStatus', args: { id, status } }])
      return next
    })
  }, [session])

  const setAnnouncement = useCallback((text) => {
    if (session?.role !== 'admin') return
    enqueue('setAnnouncement', { text })
    setLedger((l) => {
      const next = structuredClone(l)
      applyQueue(next, [{ op: 'setAnnouncement', args: { text } }])
      return next
    })
  }, [session])

  // Community announcement — anyone can post. Appended to the list (newest
  // first) so everyone's notices show in the feed, not just the admin's.
  const postAnnouncement = useCallback((text) => {
    enqueue('postAnnouncement', { text, by: session?.name || session?.username || 'House' })
    setLedger((l) => {
      const next = structuredClone(l)
      applyQueue(next, [{ op: 'postAnnouncement', args: { text, by: session?.name || session?.username || 'House' } }])
      return next
    })
  }, [session])

  const updateConfig = useCallback((patch) => {
    if (session?.role !== 'admin') return
    enqueue('updateConfig', { patch })
    setLedger((l) => {
      const next = structuredClone(l)
      applyQueue(next, [{ op: 'updateConfig', args: { patch } }])
      return next
    })
  }, [session])

  const finalizeMonth = useCallback((nextBalances) => {
    if (session?.role !== 'admin') return
    enqueue('finalizeMonth', { nextBalances })
    setLedger((l) => {
      const next = structuredClone(l)
      applyQueue(next, [{ op: 'finalizeMonth', args: { nextBalances } }])
      return next
    })
  }, [session])

  // ---- User management (full admin only) ----
  // createUser works even with no session (the first user has no login yet).
  // All other user ops require full admin. The co-admin (flat owner) is denied
  // user management entirely — he just never sees these controls.
  const createUser = useCallback(async (userData) => {
    // Allow the no-session signup path (first user becomes admin).
    if (session && !isFullAdmin()) return
    const { createUser: mkUser } = await import('../lib/security.js')
    const users = ledger.users || []
    const next = structuredClone(ledger)
    const newUser = await mkUser(users, userData)
    next.users = [...users, newUser]
    enqueue('createUser', { user: next.users[next.users.length - 1] })
    setLedger(next)
    return next.users[next.users.length - 1]
  }, [ledger])

  const updateUser = useCallback((id, patch) => {
    if (!isFullAdmin()) return
    enqueue('updateUser', { id, patch })
    setLedger((l) => {
      const next = structuredClone(l)
      next.users = (next.users || []).map((u) => u.id === id ? { ...u, ...patch } : u)
      return next
    })
  }, [session])

  // ---- Change a user's password (full admin only) ----
  // Passwords are stored as SHA-256(salt:password) hashes, so we can't read a
  // password back — we can only SET one. This generates a strong random
  // password, hashes it with a fresh salt, and swaps it in for the user. It
  // returns the plaintext so the admin can show/copy it to the resident.
  const changePassword = useCallback(async (id) => {
    if (!isFullAdmin()) return null
    const { generateSalt, hashPassword } = await import('../lib/security.js')
    const users = ledger.users || []
    const user = users.find((u) => u.id === id)
    if (!user) return null
    const plaintext = generateStrongPassword()
    const salt = generateSalt()
    const passwordHash = await hashPassword(plaintext, salt)
    const next = structuredClone(ledger)
    next.users = next.users.map((u) => (u.id === id ? { ...u, salt, passwordHash } : u))
    enqueue('updateUser', { id, patch: { salt, passwordHash } })
    setLedger(next)
    return plaintext
  }, [ledger])

  const deleteUser = useCallback((id) => {
    if (!isFullAdmin()) return
    enqueue('deleteUser', { id })
    setLedger((l) => {
      const next = structuredClone(l)
      next.users = (next.users || []).filter((u) => u.id !== id)
      return next
    })
  }, [session])

  const setUserActive = useCallback((id, active) => {
    if (!isFullAdmin()) return
    enqueue('setUserActive', { id, active })
    setLedger((l) => {
      const next = structuredClone(l)
      next.users = (next.users || []).map((u) => u.id === id ? { ...u, active } : u)
      return next
    })
  }, [session])

  // Force overwrite from local data (admin).
  const forceSyncOverwrite = useCallback(async () => {
    if (session?.role !== 'admin') return
    await forceOverwrite(ledger)
    setLastSync(new Date())
  }, [ledger, session])

  return {
    ledger,
    loading,
    syncing,
    error,
    setError,
    lastSync,
    doSync,
    pull,
    enqueue,
    // resident
    toggleMeal,
    setAllMeals,
    setGuests,
    addDeposit,
    addVacation,
    removeVacation,
    addBazar,
    // community (anyone)
    postAnnouncement,
    addTodo,
    toggleTodo,
    addEvent,
    // admin
    addExpense,
    updateExpense,
    deleteExpense,
    setDepositStatus,
    setAnnouncement,
    updateConfig,
    finalizeMonth,
    forceSyncOverwrite,
    deleteTodo,
    deleteEvent,
    changePassword,
    createUser,
    updateUser,
    deleteUser,
    setUserActive,
  }
}
