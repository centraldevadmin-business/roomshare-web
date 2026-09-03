import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const requireFn = createRequire(import.meta.url)

const filePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../tweetnacl-auth.js',
)
const src = fs.readFileSync(filePath, 'utf8')

// Run the UMD bundle in the CURRENT realm via `new Function` so that every
// `Uint8Array`/`Buffer` inside tweetnacl is the same realm's constructor as the
// ones we create here. (A `vm` context would give tweetnacl a *different*
// Uint8Array, and tweetnacl's internal `checkArrayTypes` would reject our
// cross-realm arrays.)
//
// We pass `require` in so tweetnacl's top-level `require('crypto')` (used to
// seed its PRNG) resolves. `module.exports` ends up holding the nacl object.
const moduleObj = { exports: {} }
new Function('self', 'module', 'exports', 'require', src)(
  globalThis,
  moduleObj,
  moduleObj.exports,
  requireFn,
)

const nacl = moduleObj.exports
if (!nacl || typeof nacl.box !== 'function') {
  throw new Error('tweetnacl failed to load: nacl.box is not available')
}

// crypto_box_seal, implemented with the low-level tweetnacl primitives:
//   sealed = ephemeralPub || crypto_secretbox(message, nonce=0,
//                       crypto_box_beforenm(ephPub, recipientPub))
// This is exactly what GitHub's LibSodium `crypto_box_seal` expects.
function seal(message, recipientPubHex) {
  const messageBytes = Buffer.from(message, 'utf8')
  const recipientPub = new Uint8Array(Buffer.from(recipientPubHex, 'hex'))

  const eph = nacl.box.keyPair()
  // crypto_box_beforenm(recipientPublic, ephemeralSecret)
  const shared = nacl.box.before(recipientPub, eph.secretKey)
  const nonce = new Uint8Array(24)
  const box = nacl.secretbox(messageBytes, nonce, shared)

  const out = new Uint8Array(eph.publicKey.length + box.length)
  out.set(eph.publicKey, 0)
  out.set(box, eph.publicKey.length)
  return Buffer.from(out).toString('base64')
}

export { nacl, seal }
