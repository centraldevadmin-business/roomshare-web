import { useState } from 'react'
import { verifyPassword, markGatePassed } from '../lib/security.js'
import { LockIcon } from './Icons'

// Shared-password gate shown before the role picker. Only people who know the
// password reach the house. This is the "just us" layer on top of the PWA.
export default function PasswordGate({ onUnlock }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(false)
    if (verifyPassword(value)) {
      markGatePassed()
      onUnlock()
    } else {
      setError(true)
      setSubmitting(false)
      setValue('')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 animate-fade-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-500 mb-4 shadow-lg shadow-orange-500/30">
            <LockIcon size={32} />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800">House Ledger</h1>
          <p className="text-slate-500 text-sm mt-1">Members only — enter the house password</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(false) }}
            placeholder="House password"
            autoComplete="off"
            autoFocus
            className="w-full bg-white border border-slate-300 rounded-2xl px-4 py-4 text-lg text-slate-800 placeholder:text-slate-400 text-center tracking-wide"
          />
          {error && (
            <p className="text-red-600 text-sm text-center font-medium">
              That's not the password. Try again.
            </p>
          )}
          <button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 rounded-2xl transition-colors shadow-sm text-lg"
          >
            Unlock
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Ask a housemate for the password if you don't have it.
        </p>
      </div>
    </div>
  )
}
