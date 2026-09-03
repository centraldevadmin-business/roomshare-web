global.self = global
const { createRequire } = await import('node:module')
const require = createRequire(import.meta.url)
const m = require('../tweetnacl-auth.js')
console.log('typeof m:', typeof m)
console.log('keys:', Object.keys(m))
console.log('has box:', Boolean(m && m.box))
