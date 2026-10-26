import { useState } from 'react'
import { KeyIcon, EyeIcon, EyeOffIcon, CheckIcon } from './Icons'

// Self-service password change — visible to EVERY user, on the dashboard they
// land on first (no admin mode, no asking anyone).
//
//   • Everyone: type their CURRENT password + a new one (min 8 chars) +
//     confirm. The hook verifies the current hash, then swaps in a fresh
//     salt + hash. The old password stops working immediately.
//   • Full admin only: a one-tap "generate a strong password" option
//     (blind reset — useful when even the admin has lost the old password).
//
// Props:
//   - session: the current auth session
//   - changePassword: (id) => Promise<plaintext|null>  (admin generate)
//   - changeOwnPassword: (current, next) => Promise<boolean>  (manual)
export default function SelfResetPasswordCard({ session, changePassword, changeOwnPassword }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')
  // Manual form.
  const [current, setCurrent] = useState('')
  const [nextPw, setNextPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showNew, setShowNew] = useState(false)
  // Admin generated-password result.
  const [result, setResult] = useState(null) // { password } once set
  const [copied, setCopied] = useState(false)

  const strength = nextPw.length >= 12 && /[A-Z]/.test(nextPw) && /[0-9]/.test(nextPw)
    ? 'strong'
    : nextPw.length >= 8
      ? 'okay'
      : 'short'

  const reset = async () => {
    setError('')
    setOkMsg('')
    setBusy(true)
    try {
      const plaintext = await changePassword(session.id)
      if (!plaintext) {
        setError('You do not have permission to change passwords.')
        return
      }
      setResult({ password: plaintext })
      setCopied(false)
      setOkMsg('New password set. Copy it now — you will not see it again.')
    } catch (e) {
      setError(e?.message || 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const submitManual = async (e) => {
    e.preventDefault()
    setError('')
    setOkMsg('')
    if (!current || !nextPw) {
      setError('Enter your current password and a new one.')
      return
    }
    if (nextPw.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (nextPw === current) {
      setError('New password must be different from the current one.')
      return
    }
    if (nextPw !== confirmPw) {
      setError('New passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await changeOwnPassword(current, nextPw)
      setCurrent('')
      setNextPw('')
      setConfirmPw('')
      setShowNew(false)
      setOkMsg('Password updated. The old one no longer works.')
    } catch (err) {
      setError(err?.message || 'Something went wrong. Try again.')
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

  const isAdmin = session?.role === 'admin'

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <KeyIcon size={18} className="text-orange-600" />
        <h3 className="font-bold text-slate-700">Change My Password</h3>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Updates your sign-in password. The old one stops working immediately.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-3">
          {error}
        </div>
      )}

      {okMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3 mb-3 flex items-center gap-2">
          <CheckIcon size={14} /> {okMsg}
        </div>
      )}

      {/* Admin only: blind generate (e.g. when the old password is lost). */}
      {isAdmin && (
        <div className="mb-3">
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
            className="w-full bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-semibold py-2.5 rounded-xl transition-colors"
          >
            {busy && !result ? 'Generating…' : result ? 'Generate Another' : 'I forgot my password — generate a new one'}
          </button>
          <div className="flex items-center gap-2 my-3">
            <div className="flex-1 border-t border-slate-100" />
            <span className="text-[10px] text-slate-400">or change it yourself</span>
            <div className="flex-1 border-t border-slate-100" />
          </div>
        </div>
      )}

      {/* Manual change — everyone. */}
      <form onSubmit={submitManual} className="space-y-2">
        <div className="relative">
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="Current password"
            autoComplete="current-password"
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400"
          />
        </div>
        <div className="relative">
          <input
            type={showNew ? 'text' : 'password'}
            value={nextPw}
            onChange={(e) => setNextPw(e.target.value)}
            placeholder="New password (min 8 characters)"
            autoComplete="new-password"
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 pr-11 text-sm text-slate-800 placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={() => setShowNew((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            title={showNew ? 'Hide password' : 'Show password'}
          >
            {showNew ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
          </button>
        </div>
        <div className="relative">
          <input
            type={showNew ? 'text' : 'password'}
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="Repeat new password"
            autoComplete="new-password"
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400"
          />
          {nextPw.length > 0 && (
            <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold ${
              strength === 'strong' ? 'text-emerald-600' : strength === 'okay' ? 'text-amber-600' : 'text-red-500'
            }`}>
              {strength === 'strong' ? 'strong' : strength === 'okay' ? 'okay' : 'too short'}
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors"
        >
          {busy ? 'Updating…' : 'Update Password'}
        </button>
      </form>
    </div>
  )
}