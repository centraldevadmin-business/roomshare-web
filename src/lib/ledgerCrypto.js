// End-to-end encryption for the master_ledger.json at rest.
//
// WHY: The app's "database" is a single JSON file in a private GitHub repo.
// Even in a private repo, anyone with read access — plus every hop the file
// passes through (GitHub's servers, the Cloudflare Worker proxy) — would see
// the full plaintext: balances, debts, deposits, who ate what. That is
// financial data for a whole house. We do not want it sitting around as
// readable JSON anywhere.
//
// HOW: The whole ledger is encrypted with AES-256-GCM before it is written to
// GitHub, and decrypted the moment it is pulled. The key is derived from the
// shared house password with PBKDF2-SHA256 (250k iterations) + a random salt
// stored in the file header. So:
//   - The file in GitHub is ciphertext. GitHub cannot read it.
//   - The Cloudflare Worker only ever sees ciphertext. It cannot read it.
//   - Anyone who knows the house password can read/write. That is the whole
//     house, which is exactly who should have access to a shared ledger.
//
// This is true encryption-at-rest. It is NOT key-exchange E2E (where each
// person has their own key and cannot be read by others) — that model does
// not fit a shared ledger that everyone must be able to edit. But it does
// mean the data is opaque to GitHub, the proxy, and anyone who steals the
// file without the password.
//
// MIGRATION: files written by older versions are plaintext JSON. Reads detect
// that and fall back to treating the content as legacy plaintext, so upgrading
// is seamless — the next write re-encrypts the file automatically.

const ENC_VERSION = 1
const PBKDF2_ITERATIONS = 250000
const SALT_BYTES = 16
const NONCE_BYTES = 12

// AES-GCM param key differs by platform: Chrome/Node use `iv`, Safari uses
// `nonce`. We must NOT use `process` here — Vite defines `process.env.NODE_ENV`
// in the browser bundle, so `typeof process` is truthy even in the browser.
// Detect the browser by the presence of a global `window`/`self` object, and
// Safari specifically by the `safari` global. Everything else (Chrome, Node)
// uses `iv`.
const isSafari = typeof safari !== 'undefined' && typeof window !== 'undefined' && window.safari
const GCM_KEY = isSafari ? 'nonce' : 'iv'

function aeadParams(nonce) {
  return { name: 'AES-GCM', [GCM_KEY]: nonce }
}

function uint8ToB64(uint8) {
  let s = ''
  for (let i = 0; i < uint8.length; i++) s += String.fromCharCode(uint8[i])
  return btoa(s)
}

function b64ToUint8(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

async function deriveKey(password, saltBytes) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

// Encrypt a plaintext JSON string. Returns an envelope string safe to store.
export async function encryptLedger(plaintext, password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const key = await deriveKey(password, salt)
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES))
  const ciphertext = await crypto.subtle.encrypt(
    aeadParams(nonce),
    key,
    new TextEncoder().encode(plaintext),
  )
  return JSON.stringify({
    v: ENC_VERSION,
    kdf: 'pbkdf2',
    iter: PBKDF2_ITERATIONS,
    salt: uint8ToB64(salt),
    nonce: uint8ToB64(nonce),
    data: uint8ToB64(new Uint8Array(ciphertext)),
  })
}

// Decrypt an envelope string. Returns { plaintext, encrypted: true }.
// If the content is NOT an envelope (legacy plaintext, or corrupt), returns
// { plaintext: <original content>, encrypted: false } so callers can fall back.
export async function decryptLedger(content, password) {
  let env
  try {
    env = JSON.parse(content)
  } catch {
    // Not JSON at all — hand it back unchanged; the caller decides.
    return { plaintext: content, encrypted: false }
  }
  if (env.v !== ENC_VERSION || typeof env.data !== 'string' || !env.salt || !env.nonce) {
    // Legacy plaintext ledger (or some other JSON). Return unchanged.
    return { plaintext: content, encrypted: false }
  }
  try {
    const key = await deriveKey(password, b64ToUint8(env.salt))
    const nonce = b64ToUint8(env.nonce)
    const pt = await crypto.subtle.decrypt(
      aeadParams(nonce),
      key,
      b64ToUint8(env.data),
    )
    return { plaintext: new TextDecoder().decode(pt), encrypted: true }
  } catch {
    // Wrong password or tampered data. Signal failure with an empty plaintext
    // and a flag so the caller does not mistake it for a valid empty ledger.
    return { plaintext: null, encrypted: true, error: true }
  }
}
