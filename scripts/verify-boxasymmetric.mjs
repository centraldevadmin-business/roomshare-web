import crypto from 'node:crypto'

console.log('boxAsymmetricKeyPair:', typeof crypto.boxAsymmetricKeyPair)
console.log('boxAsymmetricBefore:', typeof crypto.boxAsymmetricBefore)
console.log('boxAsymmetric:', typeof crypto.boxAsymmetric)
console.log('boxAsymmetricOpen:', typeof crypto.boxAsymmetricOpen)

// Recreate GitHub's crypto_box_seal using Node's OpenSSL-backed API.
function boxSeal(message, recipientPublicKey) {
  const ephemeral = crypto.boxAsymmetricKeyPair()
  const sharedKey = crypto.boxAsymmetricBefore(
    ephemeral.ephemeralPublicKey,
    recipientPublicKey,
    recipientSecretKey,
  )
  const ciphertext = crypto.boxAsymmetric(message, ephemeral.ephemeralPublicKey, sharedKey)
  return Buffer.concat([ephemeral.ephemeralPublicKey, ciphertext])
}
function boxSealOpen(sealed, recipientSecretKey) {
  const ephemeralPublicKey = sealed.subarray(0, 32)
  const ciphertext = sealed.subarray(32)
  const sharedKey = crypto.boxAsymmetricBefore(ephemeralPublicKey, recipientPublicKey, recipientSecretKey)
  return crypto.boxAsymmetricOpen(ciphertext, ephemeralPublicKey, sharedKey)
}

// Generate a recipient keypair (this is what GitHub's public-key endpoint returns).
const recipient = crypto.boxAsymmetricKeyPair()
const msg = Buffer.from('hello roomshare launch test')
const sealed = boxSeal(msg, recipient.ephemeralPublicKey)
const opened = boxSealOpen(sealed, recipient.ephemeralSecretKey)
console.log('roundtrip match:', Buffer.compare(msg, opened) === 0)
console.log('sealed length:', sealed.length)
