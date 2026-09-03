import fs from 'node:fs'
const src = fs.readFileSync(new URL('../tweetnacl-auth.js', import.meta.url), 'utf8')
globalThis.self = globalThis
// tweetnacl-js assigns to self.nacl (browser path). Set self, then eval.
new Function(src)(globalThis)
const nacl = globalThis.nacl

// Known tweetnacl test vector (from tweetnacl's own test suite).
const sk = Buffer.from('77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a', 'hex')
const kp = nacl.box.keyPair.fromSecretKey(new Uint8Array(sk))
const got = Buffer.from(kp.publicKey).toString('hex')
const want = '8520f0098930a754748b7ddcb42ee9a99285c2956cc0229d9ef05bfeb0e7f187'
console.log('KEYPAIR MATCH:', got === want)
console.log('has box.seal:', typeof nacl.box.seal)
