// Disaster recovery for the single-file ledger.
//
// The whole "database" is one encrypted JSON file on GitHub. If it is ever
// lost, corrupted, or written over by mistake, an admin can:
//   - Download Backup: encrypt the CURRENT in-memory ledger with the house
//     password (exactly like the GitHub file) and save it to the phone.
//   - Restore from Backup: pick a backup file, decrypt it with the house
//     password, validate every required section, and force-overwrite GitHub.
//
// Backups are ciphertext at rest — the same AES-256-GCM envelope as the
// live file — so a lost phone never exposes the ledger in plain text.

import { encryptLedger, decryptLedger } from './ledgerCrypto.js'
import { seedLedger } from './githubSync.js'

// The same house password the sync engine uses to encrypt the GitHub file.
// In a build without it (plain local dev) the backup is encrypted with an
// empty password — still a valid round-trip for that build.
function housePassword() {
  return import.meta.env?.VITE_HOUSE_PASSWORD || ''
}

// Encrypt the live ledger and trigger a download. Returns the file name.
export async function downloadLedgerBackup(ledger, fileName) {
  const content = await encryptLedger(JSON.stringify(ledger, null, 2), housePassword())
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return fileName
}

// Decrypt + validate a backup file's text. Returns the parsed ledger, or
// throws with a human-readable reason. The result passes the same
// validation (seedLedger) the sync engine applies to the live file.
export async function parseLedgerBackup(text) {
  const { plaintext, error } = await decryptLedger(String(text || ''), housePassword())
  if (error) {
    throw new Error('Wrong house password or a corrupted backup file.')
  }
  let ledger
  try {
    ledger = JSON.parse(plaintext)
  } catch {
    throw new Error('Backup file is not valid JSON.')
  }
  const valid = seedLedger(ledger)
  if (valid !== ledger) {
    throw new Error('Backup file is missing required sections — it was not restored.')
  }
  return ledger
}
