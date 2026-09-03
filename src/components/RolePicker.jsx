import { useState } from 'react'
import { CrownIcon, PersonIcon, ReceiptIcon } from './Icons'

// First-launch role picker. No passwords, no login screen.
// The house installs this PWA and picks their role once; it is remembered.
export default function RolePicker({ onPick }) {
  const [picking, setPicking] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 animate-fade-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-500 mb-4 shadow-lg shadow-orange-500/30">
            <ReceiptIcon size={32} />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800">House Ledger</h1>
          <p className="text-slate-500 text-sm mt-1">Household meal &amp; expense tracker</p>
        </div>

        {!picking ? (
          <button
            onClick={() => setPicking(true)}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 rounded-2xl transition-colors shadow-sm text-lg"
          >
            Enter the House
          </button>
        ) : (
          <div className="space-y-3 animate-fade-up">
            <p className="text-center text-sm text-slate-500 mb-4">
              Who are you? This choice is saved on this device.
            </p>
            <button
              onClick={() => onPick({ id: 'admin', username: 'admin', name: 'Admin', role: 'admin' })}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-4 rounded-2xl transition-colors flex items-center justify-center gap-3"
            >
              <CrownIcon size={24} />
              <div className="text-left">
                <div className="font-bold">Admin</div>
                <div className="text-[11px] font-normal text-slate-300">Full controls · finalize month · edit expenses</div>
              </div>
            </button>
            <button
              onClick={() => onPick({ id: 'resident1', username: 'resident1', name: 'Resident 1', role: 'resident' })}
              className="w-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-semibold py-4 rounded-2xl transition-colors flex items-center justify-center gap-3"
            >
              <PersonIcon size={24} />
              <div className="text-left">
                <div className="font-bold">Resident</div>
                <div className="text-[11px] font-normal text-slate-400">Log meals · add guests · request deposits</div>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
