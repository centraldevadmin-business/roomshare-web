// Creates the 5 GitHub Actions secrets needed by .github/workflows/push.yml
// in the data repo (centraldevadmin-business/roomshare-data).
//
// Secrets:
//   VAPID_PRIVATE_KEY   - base64 VAPID private key (from .vapid-private-key.txt)
//   VITE_GITHUB_TOKEN   - GitHub PAT
//   VITE_GITHUB_REPO    - roomshare-data
//   VITE_GITHUB_USER    - centraldevadmin-business
//   VITE_PUSH_PUBLIC_KEY- base64url VAPID public key (from public/vapid-public-key.txt)
//
// GitHub secret encryption (algorithm "encrypted_box"):
//   1. Fetch the repo's public encryption key via
//      GET /repos/{owner}/{repo}/actions/secrets/public-key
//      -> { key_id, key }  where `key` is base64 X25519 public key.
//   2. Encrypt each secret value with crypto_box_seal(value, githubPublicKey).
//      GitHub decrypts internally using its private key (never exposed).
//   3. PUT /repos/{owner}/{repo}/actions/secrets/{name} with
//      { encrypted_value, algorithm: 'encrypted_box', encryption_key_id }.
//
// Usage:
//   GH_TOKEN=ghp_xxx node scripts/create-push-secrets.mjs

import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { fileURLToPath } from 'node:url'
import { nacl, seal } from './tweetnacl-loader.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))

// --- Load VAPID keys (these are the secret VALUES, not the encryption key) ---
const vapidPrivPath = path.resolve(HERE, '../.vapid-private-key.txt')
const vapidPubPath = path.resolve(HERE, '../public/vapid-public-key.txt')

const vapidPrivB64 = fs.readFileSync(vapidPrivPath, 'utf8').trim()
const vapidPubB64 = fs.readFileSync(vapidPubPath, 'utf8').trim()

// --- Secrets to create -------------------------------------------------------
const ghToken = process.env.GH_TOKEN
if (!ghToken) {
  console.error('Set GH_TOKEN env var to your GitHub PAT (ghp_...).')
  process.exit(1)
}

const secrets = {
  VAPID_PRIVATE_KEY: vapidPrivB64,
  VITE_GITHUB_TOKEN: ghToken,
  VITE_GITHUB_REPO: 'roomshare-data',
  VITE_GITHUB_USER: 'centraldevadmin-business',
  VITE_PUSH_PUBLIC_KEY: vapidPubB64,
}

// --- crypto_box_seal encryption ---------------------------------------------
// Seal a UTF-8 plaintext for GitHub's repo encryption public key.
function encryptSecret(plaintext, githubPubHex) {
  return seal(
    Buffer.from(plaintext, 'utf8').toString('hex'),
    githubPubHex,
  )
}

// --- GitHub REST API ---------------------------------------------------------
function apiRequest(method, url, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const req = https.request(
      url,
      {
        method,
        headers: {
          'Authorization': `token ${ghToken}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
          'User-Agent': 'roomshare-create-secrets',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let chunks = ''
        res.on('data', (c) => (chunks += c))
        res.on('end', () => {
          resolve({ status: res.statusCode, body: chunks })
        })
      },
    )
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

const OWNER = 'centraldevadmin-business'
const REPO = 'roomshare-data'
const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/actions/secrets`

// Fetch existing public key (repo-level encryption key).
async function getRepoSecretKey() {
  const res = await apiRequest('GET', apiUrl + '/public-key')
  if (res.status !== 200) {
    throw new Error(`Failed to get repo public key: HTTP ${res.status} ${res.body}`)
  }
  const j = JSON.parse(res.body)
  return { keyId: j.key_id, key: j.key }
}

// Create/update a single secret.
async function putSecret(name, encryptedB64, keyId) {
  const body = {
    encrypted_value: encryptedB64,
    algorithm: 'encrypted_box',
    encryption_key_id: keyId,
  }
  console.log('PUT body:', JSON.stringify(body))
  const res = await apiRequest(
    'PUT',
    `${apiUrl}/${encodeURIComponent(name)}`,
    body,
  )
  return { name, status: res.status, body: res.body }
}

async function main() {
  const { keyId, key } = await getRepoSecretKey()
  console.log(`Repo encryption key id: ${keyId}`)
  console.log(`Repo public key: ${key}`)
  console.log('')

  // GitHub's public key is base64 X25519. Seal each secret for it.
  const githubPubHex = Buffer.from(new Uint8Array(Buffer.from(key, 'base64'))).toString('hex')

  const results = []
  for (const [name, value] of Object.entries(secrets)) {
    const encrypted = encryptSecret(value, githubPubHex)
    const r = await putSecret(name, encrypted, keyId)
    results.push({ name, status: r.status, body: r.body })
  }

  console.log('\n--- Results ---')
  let ok = true
  for (const r of results) {
    const good = r.status === 201 || r.status === 204
    if (!good) ok = false
    console.log(`${good ? 'OK ' : 'FAIL'} ${r.name} -> HTTP ${r.status}`)
    if (!good) console.log('   ', r.body)
  }

  if (ok) {
    console.log('\nAll 5 secrets created successfully.')
    console.log('Next: enable the push workflow at .github/workflows/push.yml')
  } else {
    console.log('\nSome secrets failed. See details above.')
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
