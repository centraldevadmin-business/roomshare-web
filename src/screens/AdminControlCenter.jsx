import { useMemo, useState } from 'react'
import { exportAndShare, computeBalances } from '../lib/excel'
import { todayStr, canFinalizeMonth } from '../lib/logic'
import { RESIDENT_IDS } from '../lib/users'
import HouseSettings from '../components/HouseSettings'
import { PinIcon, CheckIcon, TrashIcon, WarningIcon, ReceiptIcon, RefreshIcon, PlateIcon } from '../components/Icons'

// Section: Admin Control Center — deposit inbox, daily matrix, finalize month.
export default function AdminControlCenter({
  ledger,
  setDepositStatus,
  finalizeMonth,
  forceSyncOverwrite,
  setAnnouncement,
  updateConfig,
}) {
  const [fridgeText, setFridgeText] = useState('')
  const saveFridge = () => {
    if (!fridgeText.trim()) return
    setAnnouncement(fridgeText.trim())
    setFridgeText('')
  }
  const config = ledger.house_config
  const residents = RESIDENT_IDS
  const names = Object.fromEntries(RESIDENT_IDS.map((id) => [id, id]))
  const today = todayStr()

  const totalGroceries = useMemo(
    () => ledger.expense_log.filter((e) => e.type === 'grocery').reduce((s, e) => s + Number(e.amount || 0), 0),
    [ledger]
  )
  const monthToDate = useMemo(
    () => ledger.expense_log.reduce((s, e) => s + Number(e.amount || 0), 0),
    [ledger]
  )
  const monthBudget = 5000
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const dayOfMonth = new Date().getDate()

  // Pending deposits.
  const pendingDeposits = ledger.deposit_ledger.filter((d) => d.status === 'pending')

  // Daily matrix for today.
  const todayEntries = ledger.meal_log.filter((m) => m.date === today)

  const [finalizing, setFinalizing] = useState(false)
  const [finalizeError, setFinalizeError] = useState('')
  const finalize = () => {
    const gate = canFinalizeMonth(ledger)
    if (!gate.ok) {
      setFinalizeError(gate.message)
      return
    }
    setFinalizing(true)
    setFinalizeError('')
    const balances = computeBalances(ledger, residents)
    finalizeMonth(balances)
    // Generate the Excel report and share it.
    exportAndShare(ledger, residents, `house-ledger-finalize-${today}.xlsx`)
    setFinalizing(false)
  }

  const statusBadge = (entry) => {
    const total =
      (entry?.breakfast || 0) + (entry?.lunch || 0) + (entry?.dinner || 0) +
      (entry?.guests?.breakfast || 0) + (entry?.guests?.lunch || 0) + (entry?.guests?.dinner || 0)
    if (total === 0) return <span className="text-[10px] text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full font-semibold">ABSENT</span>
    return <span className="text-[10px] text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full font-semibold">ACTIVE</span>
  }

  return (
    <div className="space-y-4">
      {/* House overview */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="text-xs text-slate-400">House Overview</div>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div>
            <div className="text-[11px] text-slate-400">Total Monthly Groceries</div>
            <div className="text-2xl font-extrabold text-slate-800">{config.currency} {totalGroceries.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Meal Rate</div>
            <div className="text-2xl font-extrabold text-orange-600">{config.currency} {config.mealRate}/Meal</div>
          </div>
        </div>
      </div>

      {/* Digital Fridge — admin announcement board */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h3 className="font-bold text-lg mb-1 text-slate-800 flex items-center gap-2">
          <PinIcon size={18} /> Digital Fridge
        </h3>
        <p className="text-xs text-slate-400 mb-3">Post a note everyone sees — e.g. "Maid absent tomorrow", "Bazar today".</p>
        <div className="space-y-2">
          <textarea
            value={fridgeText}
            onChange={(e) => setFridgeText(e.target.value)}
            placeholder="Write a note for the house…"
            rows={2}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 resize-none"
          />
          <button
            onClick={saveFridge}
            disabled={!fridgeText.trim()}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2 rounded-xl transition-colors text-sm"
          >
            Post to Fridge
          </button>
        </div>
        {ledger.announcements && ledger.announcements.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="text-[11px] text-slate-400 mb-1.5 font-medium">Current Post</div>
            {ledger.announcements.map((a) => (
              <div key={a.id} className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <div className="text-sm text-amber-900">{a.text}</div>
                <div className="text-[10px] text-amber-500 mt-1">
                  {new Date(a.date).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* House settings */}
      <HouseSettings config={ledger.house_config} onSave={updateConfig} />

      {/* Month-to-date progress */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex justify-between text-xs text-slate-500 mb-2">
          <span>Month-to-date</span>
          <span className="font-medium">
            {config.currency} {monthToDate.toLocaleString()} / {config.currency} {monthBudget.toLocaleString()}
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full"
            style={{ width: `${Math.min(100, (monthToDate / monthBudget) * 100)}%` }}
          />
        </div>
        <div className="text-[10px] text-slate-400 mt-1.5">Day {dayOfMonth} of {daysInMonth} · {config.currency} {(monthBudget - monthToDate).toLocaleString()} remaining</div>
      </div>

      {/* Deposit inbox */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h3 className="font-bold text-lg mb-3 text-slate-800 flex items-center gap-2">
          <ReceiptIcon size={18} /> Deposit Inbox
        </h3>
        {pendingDeposits.length === 0 ? (
          <p className="text-sm text-slate-400">No pending deposits.</p>
        ) : (
          <div className="space-y-2">
            {pendingDeposits.map((d) => (
              <div key={d.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                <div>
                  <div className="text-sm text-slate-700 font-medium">
                    {names[d.resident] || d.resident} submitted{' '}
                    <span className="font-semibold">{config.currency} {d.amount.toLocaleString()}</span>
                  </div>
                  {d.note && <div className="text-[11px] text-slate-400">{d.note}</div>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDepositStatus(d.id, 'approved')}
                    className="text-[11px] px-2 py-1 rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-200 font-semibold"
                  >
                    Verify
                  </button>
                  <button
                    onClick={() => setDepositStatus(d.id, 'rejected')}
                    className="text-[11px] px-2 py-1 rounded-full bg-red-100 text-red-600 hover:bg-red-200 font-semibold"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Daily meal matrix */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h3 className="font-bold text-lg mb-3 text-slate-800 flex items-center gap-2">
          <PlateIcon size={18} /> Daily Meal Matrix (Today)
        </h3>
        <div className="space-y-2">
          {residents.map((r) => {
            const entry = todayEntries.find((m) => m.resident === r)
            const total =
              (entry?.breakfast || 0) + (entry?.lunch || 0) + (entry?.dinner || 0) +
              (entry?.guests?.breakfast || 0) + (entry?.guests?.lunch || 0) + (entry?.guests?.dinner || 0)
            return (
              <div key={r} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                <span className="text-sm text-slate-700 font-medium">{names[r]}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">
                    {(entry?.breakfast || 0)} / {(entry?.lunch || 0)} / {(entry?.dinner || 0)}
                  </span>
                  {statusBadge(entry)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Finalize + force sync */}
      {finalizeError && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <WarningIcon size={14} /> {finalizeError}
        </div>
      )}
      <button
        onClick={finalize}
        disabled={finalizing || !canFinalizeMonth(ledger).ok}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-2xl transition-colors"
      >
        {finalizing ? 'Generating…' : 'Finalize Month'}
      </button>

      <button
        onClick={forceSyncOverwrite}
        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium py-2 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        <RefreshIcon size={15} /> Force Sync &amp; Overwrite (from local data)
      </button>
    </div>
  )
}
