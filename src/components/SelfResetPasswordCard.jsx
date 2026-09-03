import { useState } from 'react'
import { KeyIcon, EyeIcon, EyeOffIcon, CloseIcon, CheckIcon } from './Icons'

// Self-service password reset for the full admin (nafiz).
//
// The full admin can change his OWN password directly from the dashboard he
// lands on first — no need to ask the co-admin or flip into admin mode. The
// hook generates a strong random password, hashes it with a fresh salt, and
// pushes it to the ledger. It returns the plaintext so the admin can copy it.
//
// Props:
//   - session: the current auth session (must be role === 'admin')
//   - changePassword: ledger.changePassword(id) -> Promise<plaintext>
export default function SelfResetPasswordCard({ session, changePassword }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null) // { password } once set
  const [copied, setCopied] = useState(false)

  const reset = async () => {
    setError('')
    setResult(null)
    setBusy(true)
    try {
      const plaintext = await changePassword(session.id)
      if (!plaintext) {
        setError('You do not have permission to change passwords.')
        return
      }
      setResult({ password: plaintext })
      setCopied(false)
    } catch (e) {
      setError(e?.message || 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!result?.password) return
    try {
      await navigator.clipboard.writeText(result.password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard may be unavailable; ignore.
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <KeyIcon size={18} className="text-orange-600" />
        <h3 className="font-bold text-slate-700">Change My Password</h3>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Generate a fresh, strong password for your account. The old one stops
        working immediately.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-3">
          {error}
        </div>
      )}

      {/* Result: show the new password once set */}
      {result && (
        <div className="bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 flex items-center justify-between gap-2 mb-3">
          <span className="font-mono text-slate-800 truncate select-all">{result.password}</span>
          <button
            type="button"
            onClick={copy}
            className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={reset}
        disabled={busy}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors"
      >
        {busy ? 'Changing…' : result ? 'Generate Another' : 'Change My Password'}
      </button>
    </div>
  )
}
