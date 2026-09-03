import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { useLedger } from './hooks/useLedger'
import { useNotifications } from './hooks/useNotifications'
import { AppShell } from './components/Layout'
import LoginSignup from './components/LoginSignup'
import ResidentDashboard from './screens/ResidentDashboard'
import ResidentLedger from './screens/ResidentLedger'
import AdminControlCenter from './screens/AdminControlCenter'
import LedgerOperations from './screens/LedgerOperations'
import SettlementScreen from './screens/SettlementScreen'
import CommunityScreen from './screens/CommunityScreen'
import UserManagement from './screens/UserManagement'
import MaidBoard from './components/MaidBoard'
import Tutorial from './components/Tutorial'
import { WarningIcon } from './components/Icons'
import { ADMIN_TUTORIAL_STEPS, RESIDENT_TUTORIAL_STEPS } from './components/tutorialSteps.js'
import { registerPushWorker, createPushSubscription, buildSubscriptionRecord } from './lib/pushSubscribe.js'
import { useInstallPrompt } from './hooks/useInstallPrompt'

// Tabs per role.
const RESIDENT_TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'community', label: 'Community' },
  { id: 'ledger', label: 'Ledger' },
]
const ADMIN_TABS = [
  { id: 'maid', label: 'Maid Board' },
  { id: 'control', label: 'Control' },
  { id: 'settlement', label: 'Settlement' },
  { id: 'members', label: 'Members' },
  { id: 'community', label: 'Community' },
  { id: 'operations', label: 'Ledger Ops' },
]

export default function App() {
  const { session, login, logout, can } = useAuth()
  const { prompt: promptInstall, installed, canPrompt } = useInstallPrompt()
  const [tab, setTab] = useState('dashboard')
  const [showTutorial, setShowTutorial] = useState(false)
  // Superadmin (nafiz) starts in "resident mode" — the first page looks like a
  // normal resident dashboard. He flips to admin mode from the menu. This is
  // what the user asked for: "at first when I log in, the first page should
  // look like a normal resident like neloy."
  const [adminMode, setAdminMode] = useState(session?.role === 'admin')

  // Show the first-login tutorial exactly once per user. We track it in
  // localStorage keyed by user id so it never reappears after the first time.
  useEffect(() => {
    if (!session) return
    const key = `hl-tutorial-done:${session.id}`
    if (localStorage.getItem(key)) return
    setShowTutorial(true)
  }, [session])

  const finishTutorial = () => {
    if (!session) return
    localStorage.setItem(`hl-tutorial-done:${session.id}`, '1')
    setShowTutorial(false)
  }

  const ledger = useLedger(session)

  // Notifications: request permission on login, tick for meal reminders and
  // new announcements. No server = notifications only fire while the app is
  // open on a phone.
  useNotifications(session, ledger.ledger)

  // Real background push: register the push service worker and write the
  // subscription to the ledger once, after login. The scheduled GitHub Action
  // reads these subscriptions and sends pushes even when the app is closed.
  useEffect(() => {
    if (!session) return
    let cancelled = false
    ;(async () => {
      try {
        await registerPushWorker()
        if (cancelled) return
        const sub = await createPushSubscription()
        if (cancelled || !sub) return
        const record = buildSubscriptionRecord(sub, session.id)
        ledger.enqueue('addPushSubscription', { sub: record })
        await ledger.doSync()
      } catch {
        // Push is best-effort; never block the app if it fails.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session, ledger])

  // Persist a newly signed-up user into the ledger before logging them in.
  const persistUser = async (ledgerData, newUser) => {
    await ledger.createUser({
      name: newUser.name,
      email: newUser.email,
      username: newUser.username,
      password: newUser.password,
      role: newUser.role,
    })
  }

  const handleLogin = (user) => {
    login(user)
  }

  // Auto-sync on login and periodically.
  useEffect(() => {
    if (!session) return
    let cancelled = false
    ;(async () => {
      try {
        await ledger.doSync()
      } finally {
        // No-op: sync status is surfaced via ledger.syncing / ledger.error,
        // which AppShell reads directly. The local syncStatus state was dead
        // (set but never rendered) and has been removed.
        if (!cancelled) return
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session, ledger])

  // Staggered background sync — twice daily at precise times to avoid GitHub
  // collisions. Admins sync at 04:00 / 16:00, residents staggered by a few
  // minutes (04:02 / 16:02, 04:05 / 16:05). The offline queue in localStorage
  // handles any edits made between syncs.
  useEffect(() => {
    if (!session) return
    let cancelled = false
    // Assign a distinct stagger offset per role so no two roles collide:
    // admin=0, resident1=2min, resident2=4min, resident3=6min.
    const staggerMinutes = session.id === 'admin' ? 0
      : session.id === 'resident1' ? 2
      : session.id === 'resident2' ? 4 : 6
    const syncTimes = [
      new Date().setHours(4, staggerMinutes, 0, 0),
      new Date().setHours(16, staggerMinutes, 0, 0),
    ]

    function scheduleNext() {
      const now = Date.now()
      const next = syncTimes.find((t) => t > now) ?? syncTimes[0] + 86400000
      const delay = Math.max(0, next - now)
      setTimeout(async () => {
        if (cancelled) return
        try {
          await ledger.doSync()
        } finally {
          if (!cancelled) return
        }
        scheduleNext()
      }, delay)
    }
    scheduleNext()
    return () => {
      cancelled = true
    }
  }, [session, ledger])

  // No session yet → show login / signup.
  if (!session) {
    return (
      <LoginSignup
        ledger={ledger.ledger}
        onLogin={handleLogin}
        persistUser={persistUser}
      />
    )
  }

  // "Admin" in the UI = the real admin OR the co-admin (flat owner). They see
  // identical tabs and screens. The co-admin's withheld powers (users, delete
  // expenses) are silently enforced in useLedger, so the buttons just don't do
  // anything for him — he never sees a difference.
  //
  // The full admin (nafiz) additionally has an admin/resident toggle. When
  // adminMode is off he sees the resident dashboard; when on he sees the admin
  // tabs. The co-admin always sees admin tabs (no toggle needed).
  const isAdmin = session.role === 'cadmin'
    || (session.role === 'admin' && adminMode)
  const tabs = isAdmin ? ADMIN_TABS : RESIDENT_TABS

  const renderScreen = () => {
    if (isAdmin) {
      if (tab === 'control') {
        return (
          <AdminControlCenter
            ledger={ledger.ledger}
            setDepositStatus={ledger.setDepositStatus}
            finalizeMonth={ledger.finalizeMonth}
            forceSyncOverwrite={ledger.forceSyncOverwrite}
            setAnnouncement={ledger.setAnnouncement}
            updateConfig={ledger.updateConfig}
          />
        )
      }
      if (tab === 'maid') {
        return (
          <MaidBoard
            ledger={ledger.ledger}
            toggleMeal={ledger.toggleMeal}
            postAnnouncement={ledger.postAnnouncement}
          />
        )
      }
      if (tab === 'settlement') {
        return <SettlementScreen ledger={ledger.ledger} />
      }
      if (tab === 'members') {
        return (
          <UserManagement
            session={session}
            ledger={ledger.ledger}
            createUser={ledger.createUser}
            updateUser={ledger.updateUser}
            deleteUser={ledger.deleteUser}
            setUserActive={ledger.setUserActive}
            changePassword={ledger.changePassword}
          />
        )
      }
      return (
        <LedgerOperations
          ledger={ledger.ledger}
          addExpense={ledger.addExpense}
          updateExpense={ledger.updateExpense}
          deleteExpense={ledger.deleteExpense}
        />
      )
    }

    if (tab === 'community') {
      return (
        <CommunityScreen
          session={session}
          announcements={ledger.ledger.announcements}
          todos={ledger.ledger.todos}
          events={ledger.ledger.calendar_events}
          postAnnouncement={ledger.postAnnouncement}
          addTodo={ledger.addTodo}
          toggleTodo={ledger.toggleTodo}
          deleteTodo={ledger.deleteTodo}
          addEvent={ledger.addEvent}
          deleteEvent={ledger.deleteEvent}
        />
      )
    }

    if (tab === 'ledger') {
      return (
        <ResidentLedger
          session={session}
          ledger={ledger.ledger}
          addDeposit={ledger.addDeposit}
        />
      )
    }

    return (
      <ResidentDashboard
        session={session}
        ledger={ledger.ledger}
        toggleMeal={ledger.toggleMeal}
        setAllMeals={ledger.setAllMeals}
        setGuests={ledger.setGuests}
        addVacation={ledger.addVacation}
        removeVacation={ledger.removeVacation}
        addBazar={ledger.addBazar}
        changePassword={ledger.changePassword}
      />
    )
  }

  return (
    <>
      <AppShell
        session={session}
        role={session.role}
        announcements={ledger.ledger.announcements}
        tabs={tabs}
        activeTab={tab}
        onTab={setTab}
        onLogout={logout}
        syncStatus={ledger.error ? 'error' : ledger.syncing ? 'syncing' : 'synced'}
        adminMode={adminMode}
        onToggleAdmin={setAdminMode}
        onInstall={() => {
          const ok = promptInstall()
          if (!ok) {
            // iOS Safari / unsupported browsers: no native prompt. Fall back
            // to a short hint explaining the manual "Add to Home Screen" flow.
            const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
            if (ios) {
              alert('To install House Ledger: tap the Share button in Safari, then "Add to Home Screen".')
            } else {
              alert('To install this app: use your browser\'s menu → "Add to Home Screen" (or "Install app").')
            }
          }
        }}
      >
        {ledger.error && (
          <div className="mb-3 bg-amber-50 border border-amber-300 text-amber-700 text-xs rounded-lg px-3 py-2 flex items-center gap-2">
            <WarningIcon size={14} /> Sync issue: {ledger.error}. Your local changes are queued and will sync when possible.
          </div>
        )}
        {renderScreen()}
      </AppShell>

      {/* First-login tutorial — shows once per user */}
      {showTutorial && (
        <Tutorial steps={isAdmin ? ADMIN_TUTORIAL_STEPS : RESIDENT_TUTORIAL_STEPS} onComplete={finishTutorial} />
      )}
    </>
  )
}
