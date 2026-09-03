// Hardcoded house accounts. No login-signup, no user creation.
// These are the only accounts. Authority is decided by `role`.
//
//   Nafiz   — ultimate admin. Full access to everything.
//   Mohin   — "co-admin" (cadmin). Looks like an admin in the UI, but two
//             powers are silently withheld (users.manage, expenses.delete).
//             He never knows the difference.
//   Neloy   — normal resident.
//
// NOTE: These hardcoded accounts are NOT used for login. Login authenticates
// against the ledger's `users` node (synced from GitHub), whose real passwords
//   are:  House@Ledger#2026! (all three share one strong password). This block
//   is kept only as a template for seeding a fresh ledger's users.
//
// SECURITY NOTE: This is a client-side PWA with zero cost. Credentials live
// in the browser bundle, so they are NOT secret — anyone can read them.
// That is acceptable here because the real protection is the private GitHub
// repo + the admin-only actions in the UI. If you need real secrets, move
// auth behind a server. For a 4-person house on a free tier, this is fine.

export const USERS = [
  {
    id: 'nafiz',
    name: 'Nafiz',
    email: '',
    username: 'nafiz',
    role: 'admin',
    salt: 'd7daf80a2e94db31d2b070a6f329320b',
    passwordHash: '4758cd810486286cec9baf2f80371f52d278f7a0e6e89d732a14f7384f3fa5f2',
    createdAt: '',
    active: true,
  },
  {
    id: 'mohin',
    name: 'Mohin',
    email: '',
    username: 'mohin',
    role: 'cadmin',
    salt: 'd2ae4c87fdf5caa8cba5144a274aa2e4',
    passwordHash: '055a3014c2de737efaf397ba306ed430c30c3d2c676c29a45a7feda3f0e9a419',
    createdAt: '',
    active: true,
  },
  {
    id: 'neloy',
    name: 'Neloy',
    email: '',
    username: 'neloy',
    role: 'resident',
    salt: 'fd0746bad8ba6c8978e44bc10ba6e11a',
    passwordHash: '1f77470cb45c4fc964e8ec124cfc78eca8eb3d0bc9fd9bf83483ad9a15514fbc',
    createdAt: '',
    active: true,
  },
]

// Verify a login attempt against the hardcoded list.
//
// security.js hashes passwords as SHA-256 of the UTF-8 bytes of
// `${salt}:${password}`. We mirror that EXACT algorithm here so the login
// screen authenticates against the same hashes. crypto.subtle.digest is
// async, so authenticate() is async too — same shape as security.js.
export async function authenticate(username, password) {
  const normalized = String(username ?? '').trim().toLowerCase()
  const match = USERS.find(
    (u) =>
      u.username.toLowerCase() === normalized &&
      u.active,
  )
  if (!match) return null
  const data = new TextEncoder().encode(`${match.salt}:${password}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  const hex = [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  if (hex !== match.passwordHash) return null
  return { id: match.id, username: match.username, name: match.name, role: match.role }
}

// Residents for meals/settlement = everyone who eats in the house, regardless
// of role. All three live here, so all three count.
export const RESIDENT_IDS = USERS.filter((u) => u.active).map((u) => u.id)

// Deep clone of the hardcoded accounts, for seeding a fresh ledger's `users`
// node. We clone so that later mutations (createUser, updateUser, etc.) never
// corrupt the shared template above.
export function seedUsers() {
  return USERS.map((u) => structuredClone(u))
}
