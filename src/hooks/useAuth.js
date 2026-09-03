import { useState, useCallback } from 'react'
import { loadSession, saveSession, clearSession, hasPermission } from '../lib/security.js'

// Real login + RBAC. The session is stored in localStorage and the user's
// permissions are derived from their role via hasPermission(). This replaces
// the old "pick your role once" role picker with proper authentication.
export function useAuth() {
  const [session, setSession] = useState(() => loadSession())

  const login = useCallback((user) => {
    setSession(user)
    saveSession(user)
  }, [])

  const logout = useCallback(() => {
    setSession(null)
    clearSession()
  }, [])

  const can = useCallback((permission) => {
    return session ? hasPermission(session.role, permission) : false
  }, [session])

  return { session, login, logout, can }
}
