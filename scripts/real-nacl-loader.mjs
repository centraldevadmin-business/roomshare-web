import fs from 'node:fs'
import { createRequire } from 'node:module'

const requireFn = createRequire(import.meta.url)

// Load the real tweetnacl (LibSodium-compatible crypto_box_seal) in the current
// realm so all Uint8Arrays match. Pass require in so its top-level
// require('crypto') PRNG seeding works.
const src = fs.readFileSync(new URL('./real-nacl.js', import.meta.url), 'utf8')
const moduleObj = { exports: {} }
new Function('self', 'module', 'exports', 'require', src)(
  globalThis, moduleObj, moduleObj.exports, requireFn,
)
const nacl = moduleObj.exports

// crypto_box_seal: ephemeral keypair, box.before(ephPub, recipientPub), zero
// nonce, secretbox, prepend ephemeral pubkey. Matches LibSodium exactly.
function seal(message, recipientPubHex) {
  const messageBytes = Buffer.from(message, 'utf8')
  const recipientPub = new Uint8Array(Buffer.from(recipientPubHex, 'hex'))
  const eph = nacl.box.keyPair()
  const shared = nacl.box.before(recipientPub, eph.secretKey)
  // LibSodium crypto_box_seal uses a ZERO 24-byte nonce.
  const nonce = new Uint8Array(24)
  const box = nacl.secretbox(messageBytes, nonce, shared)
  const out = new Uint8Array(eph.publicKey.length + box.length)
  out.set(eph.publicKey, 0)
  out.set(box, eph.publicKey.length)
  return Buffer.from(out).toString('base64')
}

export { nacl, seal }
