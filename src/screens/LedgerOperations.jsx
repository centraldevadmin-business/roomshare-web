import { useState } from 'react'
import { todayStr, uniqueId } from '../lib/logic'
import { RESIDENT_IDS } from '../lib/users'
import { CartIcon, ZapIcon, EditIcon, TrashIcon, PlusIcon, ReceiptIcon, OpsIcon } from '../components/Icons'

// Section: Ledger Operations — admin expense input + recent operations view.
export default function LedgerOperations({ ledger, addExpense, updateExpense, deleteExpense }) {
  const config = ledger.house_config
  const today = todayStr()
  const residents = RESIDENT_IDS
  const [type, setType] = useState('grocery')
  const [amount, setAmount] = useState('')
  const [vendor, setVendor] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today)
  const [paidBy, setPaidBy] = useState(residents[0] || '')

  // Inline editing state for the correction window.
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({
    type: 'grocery',
    amount: '',
    vendor: '',
    note: '',
    date: today,
    paid_by: '',
  })

  const submit = (e) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return
    addExpense({
      id: uniqueId('exp'),
      date,
      type,
      vendor,
      amount: Number(amount),
      note,
      paid_by: type === 'grocery' ? paidBy : null,
      locked: false,
    })
    setAmount('')
    setVendor('')
    setNote('')
  }

  const startEdit = (e) => {
    setEditingId(e.id)
    setEditForm({ type: e.type, amount: e.amount, vendor: e.vendor, note: e.note, date: e.date, paid_by: e.paid_by || '' })
  }
  const cancelEdit = () => {
    setEditingId(null)
  }
  const saveEdit = (e) => {
    e.preventDefault()
    if (!editForm.amount || Number(editForm.amount) <= 0) return
    updateExpense(editingId, {
      type: editForm.type,
      amount: Number(editForm.amount),
      vendor: editForm.vendor,
      note: editForm.note,
      date: editForm.date,
      paid_by: editForm.type === 'grocery' ? editForm.paid_by : null,
    })
    setEditingId(null)
  }

  const isEditable = (e) => {
    // 24-hour correction window.
    const dayMs = 86400000
    return Date.now() - new Date(e.date).getTime() < dayMs
  }

  const statusTag = (e) => {
    if (e.locked) return 'text-slate-600 bg-slate-200'
    if (!isEditable(e)) return 'text-emerald-600 bg-emerald-100'
    return 'text-amber-600 bg-amber-100'
  }
  const statusLabel = (e) => {
    if (e.locked) return 'LOCKED'
    if (!isEditable(e)) return 'POSTED'
    return 'OPEN'
  }

  const sorted = [...ledger.expense_log].sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <div className="space-y-4">
      {/* New entry form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h3 className="font-bold text-lg mb-3 text-slate-800 flex items-center gap-2">
          <PlusIcon size={18} /> New Entry
        </h3>
        <form onSubmit={submit} className="space-y-2">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Expense Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800"
            >
              <option value="grocery">Groceries &amp; Consumables</option>
              <option value="utility">Utilities</option>
              <option value="repair">Repairs</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Amount</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="$ 0.00"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800"
              />
            </div>
          </div>
          {type === 'grocery' && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Paid by</label>
              <select
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800"
              >
                {residents.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Vendor / Store</label>
            <input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="e.g. Whole Foods"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Note (optional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Weekly restock at Whole Foods"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
            />
          </div>
          <button className="w-full bg-orange-500 hover:bg-orange-600 text-sm font-semibold py-2 rounded-lg text-white">
            Deposit Log
          </button>
        </form>
      </div>

      {/* Recent operations */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h3 className="font-bold text-lg mb-3 text-slate-800 flex items-center gap-2">
          <OpsIcon size={18} /> Recent Operations
        </h3>
        {sorted.length === 0 ? (
          <p className="text-sm text-slate-400">No expenses logged yet.</p>
        ) : (
          <div className="space-y-2">
            {sorted.map((e) => (
              <div key={e.id} className="bg-white border border-slate-200 rounded-2xl p-4">
                {editingId === e.id ? (
                  <form onSubmit={saveEdit} className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={editForm.type}
                        onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                        className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-sm text-slate-800"
                      >
                        <option value="grocery">Groceries &amp; Consumables</option>
                        <option value="utility">Utilities</option>
                        <option value="repair">Repairs</option>
                        <option value="other">Other</option>
                      </select>
                      <input
                        type="date"
                        value={editForm.date}
                        onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                        className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-sm text-slate-800"
                      />
                    </div>
                    {editForm.type === 'grocery' && (
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">Paid by</label>
                        <select
                          value={editForm.paid_by}
                          onChange={(e) => setEditForm({ ...editForm, paid_by: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-sm text-slate-800"
                        >
                          <option value="">— nobody —</option>
                          {residents.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        value={editForm.amount}
                        onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                        placeholder="Amount"
                        className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-sm text-slate-800 placeholder:text-slate-400"
                      />
                      <input
                        value={editForm.vendor}
                        onChange={(e) => setEditForm({ ...editForm, vendor: e.target.value })}
                        placeholder="Vendor"
                        className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-sm text-slate-800 placeholder:text-slate-400"
                      />
                      <input
                        value={editForm.note}
                        onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                        placeholder="Note"
                        className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-sm text-slate-800 placeholder:text-slate-400"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="submit"
                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-sm font-semibold py-2 rounded-lg text-white"
                      >
                        Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold py-2 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {e.type === 'grocery' ? <CartIcon size={20} /> : e.type === 'utility' ? <ZapIcon size={20} /> : e.type === 'repair' ? <EditIcon size={20} /> : <ReceiptIcon size={20} />}
                        </span>
                        <div>
                          <div className="text-sm font-medium text-slate-700">{e.vendor || e.type}</div>
                          <div className="text-[10px] text-slate-400">{e.date} · {e.note || '—'}{e.type === 'grocery' && e.paid_by ? ` · paid by ${e.paid_by}` : ''}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-slate-800">{config.currency} {Number(e.amount).toLocaleString()}</div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${statusTag(e)}`}>
                          {statusLabel(e)}
                        </span>
                      </div>
                    </div>
                    {isEditable(e) && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                        {!e.locked && (
                          <button
                            onClick={() => updateExpense(e.id, { locked: true })}
                            className="text-[10px] px-2 py-1 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 font-semibold"
                          >
                            Lock
                          </button>
                        )}
                        <button
                          onClick={() => startEdit(e)}
                          className="text-[10px] px-2 py-1 rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-600 font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteExpense(e.id)}
                          className="text-[10px] px-2 py-1 rounded-full bg-red-100 hover:bg-red-200 text-red-600 font-semibold"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
