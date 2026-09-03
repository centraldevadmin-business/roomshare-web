import { seal } from './tweetnacl-loader.mjs'

const TOKEN = process.env.VITE_GITHUB_TOKEN || ''
const OWNER = 'centraldevadmin-business'
const REPO = 'roomshare-data'

const secrets = {
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || '',
  VITE_GITHUB_TOKEN: TOKEN,
  VITE_GITHUB_REPO: REPO,
  VITE_GITHUB_USER: OWNER,
  VITE_PUSH_PUBLIC_KEY: process.env.VITE_PUSH_PUBLIC_KEY || '',
}

// Fetch GitHub's X25519 public key for sealed-box encryption.
const pkRes = await fetch(
  `https://api.github.com/repos/${OWNER}/${REPO}/actions/secrets/public-key`,
  { headers: { Authorization: `token ${TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } },
)
const pk = await pkRes.json()
console.log('GitHub key_id:', pk.key_id)
const recipientPubHex = Buffer.from(pk.key, 'base64').toString('hex')
console.log('recipientPub length:', Buffer.from(recipientPubHex, 'hex').length)

async function setSecret(name, value) {
  const encryptedB64 = seal(value, recipientPubHex)
  const b64url = encryptedB64
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/secrets/${name}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `token ${TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ encrypted_value: b64url, key_id: pk.key_id }),
    },
  )
  console.log(name, res.status, res.status === 201 || res.status === 204 ? 'OK' : (await res.text()).slice(0, 200))
}

for (const [name, value] of Object.entries(secrets)) {
  await setSecret(name, value)
}
