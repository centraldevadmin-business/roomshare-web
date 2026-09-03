// Scheduled push sender — runs in a GitHub Action.
//
// Reads master_ledger.json from the repo, decides what to push (using the pure
// pushDecisions logic), and sends VAPID pushes to every phone via the browser
// Push API. Uses the `web-push` npm package for correct VAPID signing.
//
// Secrets (GitHub repo Settings → Secrets and variables → Actions):
//   VAPID_PRIVATE_KEY  — base64url P-256 private key (see setup notes)
//   VITE_GITHUB_TOKEN  — read/write token for the data repo
//   VITE_GITHUB_REPO   — repo name holding master_ledger.json
//   VITE_GITHUB_USER   — your GitHub username (attribution)

import webpush from 'web-push'
import { readFileSync, writeFileSync } from 'node:fs'
import { decidePushBatch } from '../src/lib/pushDecisions.js'
import { RESIDENT_IDS } from '../src/lib/users.js'

const env = (k) => process.env[k] || ''

webpush.setVapidDetails(
  { subject: `mailto:${env('VITE_GITHUB_USER') || 'roomshare'}@localhost` },
  env('VITE_PUSH_PUBLIC_KEY') || '',
  env('VAPID_PRIVATE_KEY') || '',
)

async function fetchLedger() {
  const user = env('VITE_GITHUB_USER')
  const repo = env('VITE_GITHUB_REPO')
  const token = env('VITE_GITHUB_TOKEN')
  const url = `https://api.github.com/repos/${user}/${repo}/contents/master_ledger.json`
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json',
    },
  })
  if (!res.ok) throw new Error(`fetch failed ${res.status}`)
  const data = await res.json()
  return JSON.parse(atob(data.content))
}

// Read the last-announced id from a sidecar file so each announcement pushes once.
function readLastAnnounced() {
  try {
    return readFileSync('.push-last-announced.json', 'utf8').trim() || null
  } catch {
    return null
  }
}
function writeLastAnnounced(id) {
  try {
    writeFileSync('.push-last-announced.json', JSON.stringify(id))
  } catch {
    /* ignore */
  }
}

async function sendOne(sub) {
  try {
    await webpush.push(sub, JSON.stringify({ title: '', body: '', tag: '' }))
    return true
  } catch (e) {
    // 410 Gone = subscription expired; drop it.
    if (e.code === 410) return 'expired'
    return false
  }
}

const main = async () => {
  const ledger = await fetchLedger()
  const subs = Array.isArray(ledger.push_subscriptions) ? ledger.push_subscriptions : []
  if (!subs.length) {
    console.log('No push subscriptions yet. Waiting for phones to register.')
    return
  }

  const now = new Date()
  const lastAnnounced = readLastAnnounced()
  const { messages, nextAnnouncedId } = decidePushBatch(ledger, RESIDENT_IDS, now, lastAnnounced)

  if (!messages.length) {
    console.log('Nothing to push this tick.')
    return
  }

  // Map message target to subscriptions. 'everyone' → all subs; a resident id
  // → that resident's sub (if any).
  const byTarget = {}
  for (const m of messages) {
    const targets = m.target === 'everyone' ? subs : subs.filter((s) => s.id === m.target)
    for (const sub of targets) {
      ;(byTarget[sub.id] = byTarget[sub.id] || []).push(m)
    }
  }

  let sent = 0
  const expired = []
  for (const [id, msgs] of Object.entries(byTarget)) {
    const sub = subs.find((s) => s.id === id)
    if (!sub) continue
    for (const m of msgs) {
      const ok = await sendOne(sub)
      if (ok === true) sent++
      else if (ok === 'expired') expired.push(id)
    }
  }

  console.log(`Pushed ${sent} notification(s).`)
  if (expired.length) {
    console.log(`Dropping expired subscriptions: ${expired.join(', ')}`)
    // Prune expired subs back to the repo.
    try {
      const user = env('VITE_GITHUB_USER')
      const repo = env('VITE_GITHUB_REPO')
      const token = env('VITE_GITHUB_TOKEN')
      const url = `https://api.github.com/repos/${user}/${repo}/contents/master_ledger.json`
      const res = await fetch(url, {
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' },
      })
      const data = await res.json()
      const fresh = JSON.parse(atob(data.content))
      fresh.push_subscriptions = (fresh.push_subscriptions || []).filter(
        (s) => !expired.includes(s.id),
      )
      await fetch(url, {
        method: 'PUT',
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' },
        body: JSON.stringify({
          message: 'roomshare: prune expired push subscriptions',
          content: btoa(unescape(encodeURIComponent(JSON.stringify(fresh, null, 2)))),
        }),
      })
      console.log('Pruned expired subscriptions.')
    } catch (e) {
      console.warn('Prune failed:', e.message)
    }
  }

  if (nextAnnouncedId) writeLastAnnounced(nextAnnouncedId)
}

main().catch((e) => {
  console.error('Push sender failed:', e.message)
  process.exit(1)
})
