import { useState } from 'react'
import {
  UserIcon,
  KeyIcon,
  ShieldIcon,
  EyeIcon,
  EyeOffIcon,
} from './Icons'
import { authenticate, createUser as mkUser, signupAllowed, isFirstUser } from '../lib/security.js'

// Login + signup screen. Replaces the old shared-password gate and the
// "pick your role" picker. The first user to sign up becomes admin; after
// that, signup requires an invite code from house_config.
//
// Props:
//   ledger       - the current ledger (has .users array)
//   onLogin      - (user) => void, called after a successful login
//   persistUser  - async (ledger, newUser) => void, persists the new user to
//                  the ledger (GitHub) before logging in. Only used on signup.
export default function LoginSignup({ ledger, onLogin, persistUser }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const users = Array.isArray(ledger.users) ? ledger.users : []

  const reset = () => {
    setUsername('')
    setPassword('')
    setName('')
    setInviteCode('')
    setError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')

    try {
      if (mode === 'login') {
        const user = await authenticate(users, username, password)
        if (!user) {
          setError('Wrong username or password.')
          setPassword('')
          return
        }
        onLogin(user)
      } else {
        // Signup.
        const check = signupAllowed(users, inviteCode)
        if (!check.allowed) {
          setError(check.reason || 'Signup is closed.')
          return
        }
        if (!name.trim() || !username.trim() || !password) {
          setError('Please fill in all fields.')
          return
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters.')
          return
        }
        const role = isFirstUser(users) ? 'admin' : 'resident'
        const newUser = await mkUser(users, {
          name: name.trim(),
          username: username.trim(),
          password,
          role,
        })
        // Persist the new user into the ledger, then log them in.
        if (persistUser) {
          await persistUser(ledger, newUser)
        }
        onLogin(newUser)
      }
    } catch (e) {
      setError(e.message || 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 animate-fade-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-500 mb-4 shadow-lg shadow-orange-500/30">
            <ShieldIcon size={32} />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800">House Ledger</h1>
          <p className="text-slate-500 text-sm mt-1">
            {mode === 'login' ? 'Sign in to your house account' : 'Create your house account'}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex bg-slate-200/70 rounded-2xl p-1 mb-6">
          <button
            type="button"
            onClick={() => { setMode('login'); reset() }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              mode === 'login' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); reset() }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              mode === 'signup' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && (
            <div className="relative animate-fade-up">
              <UserIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                autoComplete="name"
                className="w-full bg-white border border-slate-300 rounded-2xl pl-11 pr-4 py-3 text-slate-800 placeholder:text-slate-400"
              />
            </div>
          )}

          <div className="relative animate-fade-up">
            <UserIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoComplete="username"
              className="w-full bg-white border border-slate-300 rounded-2xl pl-11 pr-4 py-3 text-slate-800 placeholder:text-slate-400"
            />
          </div>

          {mode === 'signup' && isFirstUser(users) && (
            <p className="text-xs text-slate-400 -mt-1 px-1">
              You'll be registered as the first <b>Admin</b> of the house.
            </p>
          )}

          {mode === 'signup' && !isFirstUser(users) && (
            <div className="relative animate-fade-up">
              <KeyIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Invite code (from an admin)"
                autoComplete="off"
                className="w-full bg-white border border-slate-300 rounded-2xl pl-11 pr-4 py-3 text-slate-800 placeholder:text-slate-400"
              />
            </div>
          )}

          <div className="relative animate-fade-up">
            <KeyIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full bg-white border border-slate-300 rounded-2xl pl-11 pr-11 py-3 text-slate-800 placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
            </button>
          </div>

          {error && (
            <p className="text-red-600 text-sm text-center font-medium animate-fade-up">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3.5 rounded-2xl transition-colors shadow-sm text-lg"
          >
            {submitting ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          {mode === 'login'
            ? 'First time here? Tap “Sign Up” above.'
            : 'Have an invite code? Enter it above to join the house.'}
        </p>
      </div>
    </div>
  )
}
