import { useMemo, useState } from 'react'
import { todayStr, computeDebt, uniqueId } from '../lib/logic'
import { RESIDENT_IDS } from '../lib/users'
import { exportPersonWorkbook } from '../lib/excel'
import { CheckIcon, WalletIcon, DownloadIcon } from '../components/Icons'

// Section: Resident Ledger — read-only financial standing + deposit request form.
export default function ResidentLedger({ session, ledger, addDeposit }) {
  const config = ledger.house_config
  const mealRate = config.mealRate || 70
  const today = todayStr()

  // Personal balance (positive = house owes you; negative = you owe the house).
  const balance = useMemo(
    () => computeDebt(ledger, session.id, mealRate),
    [ledger, session.id, mealRate]
  )

  // Outstanding balances for all residents (positive = house owes them).
  const outstanding = useMemo(() => {
    const rows = []
    for (const r of RESIDENT_IDS) {
      rows.push({ id: r, name: r, balance: computeDebt(ledger, r, mealRate) })
    }
    return rows
  }, [ledger, mealRate])

  // Deposit request form.
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const submitDeposit = (e) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return
    addDeposit({
      id: uniqueId('dep'),
      resident: session.id,
      amount: Number(amount),
      date: today,
      note,
      status: 'pending',
    })
    setAmount('')
    setNote('')
  }

  // My deposits.
  const myDeposits = ledger.deposit_ledger
    .filter((d) => d.resident === session.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  const statusTag = (status) => {
    const map = {
      pending: 'text-amber-600 bg-amber-100',
      approved: 'text-emerald-600 bg-emerald-100',
      rejected: 'text-red-600 bg-red-100',
    }
    return map[status] || ''
  }

  return (
    <div className="space-y-4">
      {/* Current balance */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="text-xs text-slate-400">Current Balance</div>
        <div className="text-4xl font-extrabold text-slate-800 mt-1">
          {config.currency} {Math.abs(balance).toLocaleString()}
        </div>
        <div className="mt-2">
          {balance >= 0 ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 font-semibold flex items-center gap-1">
              <CheckIcon size={11} /> No Debt · Good Standing
            </span>
          ) : (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">
              Debt {config.currency} {Math.abs(balance).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Download my full Excel breakdown */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h3 className="font-bold text-lg mb-1 text-slate-800 flex items-center gap-2">
          <DownloadIcon size={18} /> My Full Report
        </h3>
        <p className="text-xs text-slate-400 mb-3">
          Download your complete financial breakdown — meals, rent, costs, deposits, and your final balance.
        </p>
        <button
          onClick={() => exportPersonWorkbook(ledger, session.id)}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-sm font-semibold py-2.5 rounded-lg text-white flex items-center justify-center gap-2 transition-colors"
        >
          <DownloadIcon size={16} /> Download Excel Report
        </button>
      </div>

      {/* Outstanding balances */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h3 className="font-bold text-lg mb-3 text-slate-800">Outstanding Balances</h3>
        <div className="space-y-2">
          {outstanding.map((r) => (
            <div key={r.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-700 text-sm">{r.name}</span>
              </div>
              <span className={r.balance < 0 ? 'text-red-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                {config.currency} {Math.abs(r.balance).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Deposit request form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h3 className="font-bold text-lg mb-1 text-slate-800 flex items-center gap-2">
          <WalletIcon size={18} /> Deposit Request
        </h3>
        <p className="text-xs text-slate-400 mb-3">Log cash given to the Admin. Stays pending until approved.</p>
        <form onSubmit={submitDeposit} className="space-y-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder='Note: e.g. "Handed 500 for Bazar"'
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
          />
          <button className="w-full bg-orange-500 hover:bg-orange-600 text-sm font-semibold py-2 rounded-lg text-white">
            Submit Deposit Request
          </button>
        </form>
      </div>

      {/* My deposits */}
      {myDeposits.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <h3 className="font-bold text-lg mb-3 text-slate-800">Recent Deposits</h3>
          <div className="space-y-2">
            {myDeposits.map((d) => (
              <div key={d.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                <div>
                  <div className="text-sm text-slate-700 font-medium">{config.currency} {d.amount.toLocaleString()}</div>
                  {d.note && <div className="text-[11px] text-slate-400">{d.note}</div>}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusTag(d.status)}`}>
                  {d.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
