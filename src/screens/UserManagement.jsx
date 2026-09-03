import { useState } from 'react'
import {
  UsersIcon,
  UserIcon,
  EmailIcon,
  KeyIcon,
  ShieldIcon,
  TrashIcon,
  EditIcon,
  CheckIcon,
  CloseIcon,
  EyeIcon,
  EyeOffIcon,
} from '../components/Icons'
import { ROLES } from '../lib/security.js'

// Admin screen: create, edit, delete, and deactivate house members.
// Users live in the ledger's `users` node and are synced to GitHub.
export default function UserManagement({ ledger, session, createUser, updateUser, deleteUser, setUserActive, changePassword }) {
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('resident')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Change-password modal state.
  const [changingId, setChangingId] = useState(null)
  const [passwordText, setPasswordText] = useState('')
  const [shownPassword, setShowPassword] = useState('')
  const [copied, setCopied] = useState(false)

  const users = Array.isArray(ledger.users) ? ledger.users : []

  const resetForm = () => {
    setName('')
    setEmail('')
    setUsername('')
    setPassword('')
    setRole('resident')
    setCreating(false)
    setEditingId(null)
    setError('')
  }

  const startCreate = () => {
    resetForm()
    setCreating(true)
  }

  const startEdit = (u) => {
    setEditingId(u.id)
    setName(u.name)
    setEmail(u.email)
    setUsername(u.username)
    setPassword('')
    setRole(u.role)
    setError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    if (saving) return
    if (!name.trim() || !email.trim() || !username.trim()) {
      setError('Name, email, and username are required.')
      return
    }
    if (!editingId && password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setSaving(true)
    setError('')

    try {
      if (editingId) {
        const patch = { name: name.trim(), email: email.trim().toLowerCase(), username: username.trim().toLowerCase(), role }
        await updateUser(editingId, patch)
      } else {
        await createUser({
          name: name.trim(),
          email: email.trim(),
          username: username.trim(),
          password,
          role,
        })
      }
      resetForm()
    } catch (e) {
      setError(e.message || 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = (u) => {
    if (u.id === session?.id) {
      setError('You cannot delete your own account.')
      return
    }
    if (window.confirm(`Delete ${u.name}? They will no longer be able to sign in.`)) {
      deleteUser(u.id)
    }
  }

  const toggleActive = (u) => {
    setUserActive(u.id, !u.active)
  }

  // ---- Change password flow ----
  const openChangePassword = async (u) => {
    setChangingId(u.id)
    setPasswordText('')
    setCopied(false)
    // Generate a strong password and show it immediately so the admin can
    // copy it to the resident.
    const pw = await changePassword(u.id)
    if (pw) setShowPassword(pw)
  }

  const closeChangePassword = () => {
    setChangingId(null)
    setPasswordText('')
    setShowPassword('')
    setCopied(false)
  }

  const regeneratePassword = async () => {
    const pw = await changePassword(changingId)
    if (pw) {
      setShowPassword(pw)
      setPasswordText(pw)
    }
  }

  const applyPassword = async () => {
    if (!passwordText.trim()) return
    await changePassword(changingId)
    setShowPassword(passwordText)
    setCopied(false)
  }

  const copyPassword = async () => {
    if (!shownPassword) return
    try {
      await navigator.clipboard.writeText(shownPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard may be unavailable; ignore.
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UsersIcon size={20} />
          <h2 className="text-lg font-extrabold text-slate-800">Members</h2>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="text-sm font-semibold text-orange-600 hover:text-orange-700"
        >
          + Add Member
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Create / Edit form */}
      {(creating || editingId) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 animate-fade-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-700">
              {editingId ? 'Edit Member' : 'New Member'}
            </h3>
            <button type="button" onClick={resetForm} className="text-slate-400 hover:text-slate-600">
              <CloseIcon size={18} />
            </button>
          </div>
          <form className="space-y-3">
            <div className="relative">
              <UserIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3 py-2.5 text-slate-800 placeholder:text-slate-400"
              />
            </div>
            <div className="relative">
              <EmailIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3 py-2.5 text-slate-800 placeholder:text-slate-400"
              />
            </div>
            <div className="relative">
              <UserIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3 py-2.5 text-slate-800 placeholder:text-slate-400"
              />
            </div>
            {!editingId && (
              <div className="relative">
                <KeyIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (min 6 chars)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3 py-2.5 text-slate-800 placeholder:text-slate-400"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <ShieldIcon size={18} className="text-slate-400" />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-slate-800 text-sm"
              >
                {Object.entries(ROLES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              onClick={submit}
              disabled={saving}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Member'}
            </button>
          </form>
        </div>
      )}

      {/* User list */}
      <div className="space-y-2">
        {users.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-sm">
            No members yet. Tap “Add Member” to create the first account.
          </div>
        )}
        {users.map((u) => (
          <div
            key={u.id}
            className={`bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 ${
              u.active ? '' : 'opacity-50'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
              {u.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-800 truncate">{u.name}</div>
              <div className="text-xs text-slate-400 truncate">{u.username} · {u.email}</div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
              {u.role}
            </span>
            {!u.active && (
              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-100 text-red-500">
                Disabled
              </span>
            )}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => toggleActive(u)}
                className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
                title={u.active ? 'Disable' : 'Enable'}
              >
                {u.active ? <CheckIcon size={16} /> : <CloseIcon size={16} />}
              </button>
              <button
                type="button"
                onClick={() => startEdit(u)}
                className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
                title="Edit"
              >
                <EditIcon size={16} />
              </button>
              <button
                type="button"
                onClick={() => openChangePassword(u)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 font-semibold text-xs hover:bg-blue-100"
                title="Change Password"
              >
                <KeyIcon size={14} />
                Change PW
              </button>
              <button
                type="button"
                onClick={() => confirmDelete(u)}
                className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100"
                title="Delete"
              >
                <TrashIcon size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Change Password Modal */}
      {changingId && (() => {
        const target = users.find((u) => u.id === changingId)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-xl animate-fade-up">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-700">Change Password</h3>
                <button type="button" onClick={closeChangePassword} className="text-slate-400 hover:text-slate-600">
                  <CloseIcon size={18} />
                </button>
              </div>

              <p className="text-sm text-slate-500 mb-3">
                Setting a new password for <span className="font-semibold text-slate-700">{target?.name}</span>.
                The old password will no longer work.
              </p>

              {/* Generated password display */}
              {shownPassword && (
                <div className="bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 flex items-center justify-between gap-2 mb-3">
                  <span className="font-mono text-slate-800 truncate select-all">{shownPassword}</span>
                  <button
                    type="button"
                    onClick={copyPassword}
                    className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              )}

              {/* Custom password input */}
              <div className="relative mb-3">
                <KeyIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={shownPassword ? 'text' : 'text'}
                  value={passwordText}
                  onChange={(e) => setPasswordText(e.target.value)}
                  placeholder="Type a custom password…"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-slate-800 placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => s ? '' : shownPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  title={shownPassword ? 'Hide' : 'Show generated password'}
                >
                  {shownPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={regeneratePassword}
                  className="px-3 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={applyPassword}
                  disabled={!passwordText.trim()}
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-xl"
                >
                  Set Password
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
