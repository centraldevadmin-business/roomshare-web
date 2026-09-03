import { useState } from 'react'
import Banner from './Banner'
import Greeting from './Greeting'
import {
  MenuIcon,
  LogoutIcon,
  RefreshIcon,
  HomeIcon,
  CommunityIcon,
  LedgerIcon,
  ControlIcon,
  OpsIcon,
  CrownIcon,
  InstallIcon,
} from './Icons'

// Shared app shell: header + bottom tab nav.
export function AppShell({ session, role, announcements, children, tabs, activeTab, onTab, onLogout, syncStatus, adminMode, onToggleAdmin, onInstall }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const iconFor = (id) => {
    switch (id) {
      case 'dashboard': return <HomeIcon size={20} />
      case 'community': return <CommunityIcon size={20} />
      case 'ledger': return <LedgerIcon size={20} />
      case 'control': return <ControlIcon size={20} />
      case 'operations': return <OpsIcon size={20} />
      default: return <HomeIcon size={20} />
    }
  }

  const isSyncing = syncStatus === 'syncing'
  const isSynced = syncStatus === 'synced'
  const isError = syncStatus === 'error'

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 pb-32">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
              title="Menu"
            >
              <MenuIcon size={18} />
            </button>
            <span className="font-extrabold text-slate-800 tracking-tight text-lg">House Command</span>
          </div>
          <div className="flex items-center gap-3">
            {isSyncing && (
              <span className="text-[10px] text-amber-600 flex items-center gap-1">
                <span className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                syncing…
              </span>
            )}
            {isSynced && (
              <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                <RefreshIcon size={12} /> synced
              </span>
            )}
            {isError && (
              <span className="text-[10px] text-red-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" /> error
              </span>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500 text-white font-bold uppercase tracking-wide">
              {role}
            </span>
            <button
              onClick={onLogout}
              className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center hover:bg-orange-200 transition-colors"
              title="Log out"
            >
              <LogoutIcon size={15} />
            </button>
          </div>
        </div>

        {/* Dropdown menu */}
        {menuOpen && (
          <div className="max-w-md mx-auto px-4 pb-3 animate-fade-up">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-lg p-2">
              {/* Superadmin mode toggle — only shown to the full admin (nafiz) */}
              {session?.role === 'admin' && onToggleAdmin && (
                <button
                  onClick={() => { onToggleAdmin(!adminMode); setMenuOpen(false) }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                >
                  <span className="flex items-center gap-3">
                    <CrownIcon size={16} />
                    {adminMode ? 'Admin Mode' : 'Resident Mode'}
                  </span>
                  <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${adminMode ? 'bg-orange-500' : 'bg-slate-300'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${adminMode ? 'translate-x-4' : 'translate-x-1'}`} />
                  </span>
                </button>
              )}
              {onInstall && (
                <button
                  onClick={() => { setMenuOpen(false); onInstall() }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-orange-600 hover:bg-orange-50 transition-colors text-left font-semibold"
                >
                  <InstallIcon size={16} />
                  Install app on your phone
                </button>
              )}
              <button
                onClick={() => { setMenuOpen(false); onLogout() }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
              >
                <LogoutIcon size={16} />
                Log out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Digital Fridge marquee */}
      <Banner announcements={announcements || []} />

      {/* Warm greeting + little cartoon scene on entry */}
      <div className="max-w-md mx-auto px-4 pt-4">
        <Greeting name={session?.name} />
      </div>

      <div className="max-w-md mx-auto px-4 pt-4">
        <div className="space-y-4">
          <div key={activeTab} className="animate-fade-up">
            {children}
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/98 backdrop-blur border-t border-slate-200 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="max-w-md mx-auto flex">
          {tabs.map((t) => {
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => onTab(t.id)}
                className={`flex-1 py-2.5 text-center flex flex-col items-center gap-1 relative transition-colors ${
                  active ? 'text-orange-500' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {active && (
                  <span className="absolute -top-0 left-1/2 -translate-x-1/2 w-10 h-1 rounded-t-full bg-orange-500" />
                )}
                <span className={`transition-transform ${active ? 'scale-110' : 'scale-100'}`}>
                  {iconFor(t.id)}
                </span>
                <span className="text-[10px] font-medium">{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
