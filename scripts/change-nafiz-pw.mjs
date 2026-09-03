// Standalone script: change the `nafiz` user's password in the live master_ledger.json.
// Replicates the app's exact hashing + encryption so the new password works at login.
//
//   - Fetches the encrypted ledger through the Cloudflare Worker proxy (holds the GitHub token).
//   - Decrypts with the house password (house2026).
//   - Generates a strong random password, a fresh salt, and hashes it exactly like security.js:
//       hash = SHA-256( utf8(`${salt}:${password}`) )  -> hex
//   - Re-encrypts and PUTs back with the current sha (optimistic concurrency).
//
// Usage: node scripts/change-nafiz-pw.mjs

const API = process.env.VITE_WORKER_URL || 'https://roomshare-proxy.central-dev-admin.workers.dev'
const HOUSE_PW = process.env.VITE_HOUSE_PASSWORD || 'house2026'
const GH_USER = process.env.VITE_GITHUB_USER || 'centraldevadmin-business'
const GH_REPO = process.env.VITE_GITHUB_REPO || 'roomshare-data'
const PATH = 'master_ledger.json'

const encVersion = 1
const pbkdf2Iter = 250000
const saltBytes = 16
const nonceBytes = 12

const u8ToB64 = (u) => btoa(String.fromCharCode(...u))
const b64ToU8 = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0))

async function deriveKey(password, saltBytesIn) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytesIn, iterations: pbkdf2Iter, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 },
    false, ['encrypt', 'decrypt'],
  )
}

async function encryptLedger(plaintext, password) {
  const salt = crypto.getRandomValues(new Uint8Array(saltBytes))
  const key = await deriveKey(password, salt)
  const nonce = crypto.getRandomValues(new Uint8Array(nonceBytes))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, new TextEncoder().encode(plaintext))
  return JSON.stringify({ v: encVersion, kdf: 'pbkdf2', iter: pbkdf2Iter, salt: u8ToB64(salt), nonce: u8ToB64(nonce), data: u8ToB64(new Uint8Array(ct)) })
}

async function decryptLedger(content, password) {
  let env
  try { env = JSON.parse(content) } catch { return { plaintext: content, encrypted: false } }
  if (env.v !== encVersion || typeof env.data !== 'string' || !env.salt || !env.nonce) {
    return { plaintext: content, encrypted: false }
  }
  const key = await deriveKey(password, b64ToU8(env.salt))
  const nonce = b64ToU8(env.nonce)
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, b64ToU8(env.data))
  return { plaintext: new TextDecoder().decode(pt), encrypted: true }
}

async function apiRequest(method, url, headers = {}, body) {
  const contentsPath = url.split('/contents/')[1] || ''
  const workerUrl = `${API}/contents/${contentsPath}`
  const res = await fetch(workerUrl, { method, headers: { 'User-Agent': 'roomshare-pwa', 'Accept': 'application/vnd.github+json', ...headers }, body })
  return res
}

// Strong 16-char password: upper, lower, digit, symbol, shuffled.
function strongPassword() {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lower = 'abcdefghijklmnopqrstuvwxyz'
  const digits = '0123456789'
  const symbols = '!@#$%^&*()-_=+'
  const all = upper + lower + digits + symbols
  const required = [upper, lower, digits, symbols]
  const len = 16
  const chars = new Array(len)
  for (let i = 0; i < required.length; i++) {
    chars[i] = required[i][crypto.getRandomValues(new Uint32Array(1))[0] % required[i].length]
  }
  for (let i = required.length; i < len; i++) {
    chars[i] = all[crypto.getRandomValues(new Uint32Array(1))[0] % all.length]
  }
  for (let i = len - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function main() {
  const url = `${API}/contents/${PATH}`
  const res = await apiRequest('GET', url)
  if (!res.ok) throw new Error(`GET failed ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const sha = data.sha // GitHub sha lives in the JSON body, not a CORS-exposed header
  const raw = atob(data.content).replace(/\n$/, '')

  const { plaintext, encrypted } = await decryptLedger(raw, HOUSE_PW)
  if (!plaintext) throw new Error('Decryption failed — wrong house password or corrupt ledger.')
  const ledger = JSON.parse(plaintext)

  const user = (ledger.users || []).find((u) => u.id === 'nafiz')
  if (!user) throw new Error('No nafiz user found in ledger.')

  const newPassword = strongPassword()
  const salt = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('')
  const passwordHash = await hashPassword(newPassword, salt)

  user.salt = salt
  user.passwordHash = passwordHash
  ledger.users = ledger.users.map((u) => (u.id === 'nafiz' ? user : u))

  const encrypted2 = await encryptLedger(JSON.stringify(ledger, null, 2), HOUSE_PW)

  // PUT back with sha for optimistic concurrency.
  const putUrl = `${API}/contents/${PATH}`
  const putRes = await apiRequest('PUT', putUrl, { 'Content-Type': 'application/json' }, JSON.stringify({
    message: `roomshare: change nafiz password (${new Date().toISOString()})`,
    content: btoa(unescape(encodeURIComponent(encrypted2))),
    sha,
  }))
  if (!putRes.ok) throw new Error(`PUT failed ${putRes.status}: ${await putRes.text()}`)
  if (!putRes.ok) throw new Error(`PUT failed ${putRes.status}: ${await putRes.text()}`)

  console.log('✅ nafiz password changed and pushed to GitHub.')
  console.log('🔑 NEW nafiz password:', newPassword)
  console.log('   (salt + hash updated in master_ledger.json; old password no longer works)')
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
