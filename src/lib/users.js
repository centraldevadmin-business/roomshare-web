// Hardcoded house accounts — the SEED for a fresh ledger.
//
//   Nafiz   — ultimate admin. Full access to everything.
//   Mohin   — "co-admin" (cadmin). Looks like an admin in the UI, but two
//             powers are silently withheld (users.manage, expenses.delete).
//             He never knows the difference.
//   Neloy   — normal resident.
//
// NOTE: These hardcoded accounts are NOT used for login. Login authenticates
// against the ledger's `users` node (synced from GitHub) via
// security.js authenticate(). `seedUsers()` below clones this list into a
// fresh ledger's users so the app is usable out of the box.
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

// Residents for meals/settlement = everyone who eats in the house. All three
// live here, so all three count.
export const RESIDENT_IDS = USERS.filter((u) => u.active).map((u) => u.id)

// Active house members who count for meals/settlement — derived from the
// ledger's `users` node so members added later (Members screen or invite-code
// signup) are included automatically. Read-only `viewer` accounts do not eat
// or pay, so they are excluded. Falls back to the three seeded accounts when
// the users node is missing or empty (legacy/corrupt ledgers).
export function activeResidentIds(ledger) {
  const users = ledger && Array.isArray(ledger.users) ? ledger.users : null
  if (users && users.length) {
    const ids = users
      .filter((u) => u && u.active !== false && u.role !== 'viewer')
      .map((u) => u.id)
    if (ids.length) return ids
  }
  return RESIDENT_IDS
}

// Deep clone of the hardcoded accounts, for seeding a fresh ledger's `users`
// node. We clone so that later mutations (createUser, updateUser, etc.) never
// corrupt the shared template above.
export function seedUsers() {
  return USERS.map((u) => structuredClone(u))
}

// Human label for a resident id: the member's display name ("Neloy") when the
// users node knows them, otherwise the id itself (deleted members, legacy
// data, or a missing users node). Screens pass the id as the VALUE and this
// as the LABEL, so billing keys never change — only what people read.
export function displayNameFor(users, id) {
  const u = (Array.isArray(users) ? users : []).find((x) => x && x.id === id)
  return (u && u.name) || id
}
