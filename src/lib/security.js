// Security layer for House Ledger.
//
// IMPORTANT SECURITY REALITY (read this):
// This app has NO server. It runs entirely in the browser. That means ANY
// secret — a password, a hash, a salt — stored in the code bundle can be
// read by anyone who opens DevTools. There is no way to make client-side auth
// truly secure without a backend.
//
// What this module DOES provide:
//   - Passwords are stored as SHA-256 + per-user salt (never plain text).
//   - A proper RBAC model with granular roles and permissions.
//   - Permission checks the UI can use to hide/show controls.
//
// What it does NOT provide:
//   - Protection against someone who inspects the JS bundle.
//
// The real protection is the private GitHub repo behind the data. This layer
// stops casual/unauthorized access and gives you a professional auth model.

// ---- Password hashing (SHA-256 + salt) ----
// Uses the Web Crypto API. Returns a hex string.

export async function hashPassword(password, salt = '') {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function generateSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ---- RBAC: roles and their permissions ----
// Each role is a set of permission flags. Add new roles here.

export const ROLES = {
  admin: {
    label: 'Admin',
    permissions: [
      'users.manage',
      'expenses.log',
      'expenses.edit',
      'expenses.delete',
      'deposits.approve',
      'month.finalize',
      'config.edit',
      'announcements.post',
      'meals.toggle',
      'meals.view',
      'ledger.view',
      'community.post',
    ],
  },
  // "Co-admin" — the flat owner. Same label ("Admin"), same tabs and buttons,
  // same everything in the UI. But two admin powers are silently withheld:
  //   - users.manage  (add/remove users)
  //   - expenses.delete (delete expense rows)
  // He never sees a difference — the buttons just don't do anything when he
  // taps them. The real admin (you) keeps the full set above.
  cadmin: {
    label: 'Admin',
    permissions: [
      'expenses.log',
      'expenses.edit',
      'deposits.approve',
      'month.finalize',
      'config.edit',
      'announcements.post',
      'meals.toggle',
      'meals.view',
      'ledger.view',
      'community.post',
    ],
  },
  moderator: {
    label: 'Moderator',
    permissions: [
      'expenses.log',
      'expenses.edit',
      'expenses.delete',
      'deposits.approve',
      'config.edit',
      'announcements.post',
      'meals.toggle',
      'meals.view',
      'ledger.view',
      'community.post',
    ],
  },
  resident: {
    label: 'Resident',
    permissions: [
      'expenses.log',
      'meals.toggle',
      'meals.view',
      'ledger.view',
      'community.post',
    ],
  },
  viewer: {
    label: 'Viewer',
    permissions: [
      'meals.view',
      'ledger.view',
      'community.post',
    ],
  },
}

export const DEFAULT_ROLE = 'resident'

export function hasPermission(role, permission) {
  const r = ROLES[role]
  return !!(r && r.permissions.includes(permission))
}

// ---- User store ----
// Users live in the ledger's `users` node (synced to GitHub). This module
// manages the local session and provides helpers.

const SESSION_KEY = 'house:session'

export function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || null
  } catch {
    return null
  }
}

export function saveSession(session) {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } else {
    localStorage.removeItem(SESSION_KEY)
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

// ---- Signup: create a new user ----
// The first user to sign up becomes admin. After that, signup requires an
// invite code (set in house_config.inviteCode) so random people can't join.
export async function createUser(users, { name, email, username, password, role }) {
  const normEmail = (email || '').toLowerCase().trim()
  const normUser = String(username || '').toLowerCase().trim()
  // Uniqueness check. An EMPTY email must not count as a match: the seeded
  // house accounts have no email, and the invite-code signup form does not
  // collect one either. Comparing '' === '' made every invite signup fail
  // with "already exists" on the very first account.
  const existing = users.find(
    (u) =>
      (normEmail !== '' && (u.email || '').toLowerCase() === normEmail) ||
      (u.username || '').toLowerCase() === normUser
  )
  if (existing) {
    throw new Error('A user with that email or username already exists.')
  }
  const salt = generateSalt()
  const passwordHash = await hashPassword(password, salt)
  return {
    // The house screens (settlement, deposits, paid-by, rent editor) display a
    // member's id as their label — the seeded accounts all use
    // id === username, so new members must too. An opaque "user_xxx" token
    // would show up as the member's name everywhere in the app.
    id: normUser || `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    email: normEmail,
    username: normUser,
    role: role || DEFAULT_ROLE,
    salt,
    passwordHash,
    createdAt: new Date().toISOString(),
    active: true,
  }
}

// ---- Login: verify credentials ----
export async function authenticate(users, username, password) {
  const u = users.find(
    (x) => x.username.toLowerCase() === String(username ?? '').trim().toLowerCase()
  )
  if (!u || !u.active) return null
  const ok = await verifyUserPassword(u, password)
  if (!ok) return null
  return { id: u.id, name: u.name, email: u.email, username: u.username, role: u.role }
}

// Verify a password against one user record's stored salt + hash. Exported so
// the self-service "change my password" flow can check the CURRENT password
// before swapping in a new hash.
export async function verifyUserPassword(user, password) {
  if (!user) return false
  const hash = await hashPassword(password, user.salt || '')
  return hash === user.passwordHash || hash === user.hash
}

// ---- Invite code logic ----
// Signup rules:
//   1. First user on a fresh ledger (no users at all) → allowed, becomes admin.
//   2. Otherwise, an admin must publish an invite code in
//      house_config.inviteCode (House Settings). With a code published, anyone
//      who signs up with the right code joins as a resident.
//   3. No code published → signup closed (admin adds people from Members).
export function isFirstUser(users) {
  return !users || users.length === 0
}

export function signupAllowed(users, inviteCode, houseConfig = {}) {
  if (isFirstUser(users)) return { allowed: true }
  const configured = String(houseConfig?.inviteCode || '').trim()
  if (!configured) {
    return { allowed: false, reason: 'Signup is closed. Ask an admin to share an invite code.' }
  }
  const given = String(inviteCode || '').trim()
  if (!given || given !== configured) {
    return { allowed: false, reason: 'Invalid invite code.' }
  }
  return { allowed: true }
}
