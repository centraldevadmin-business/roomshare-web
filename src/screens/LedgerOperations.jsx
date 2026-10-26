import { useState } from 'react'
import { todayStr, uniqueId } from '../lib/logic'
import { activeResidentIds, displayNameFor } from '../lib/users'
import { CartIcon, ZapIcon, EditIcon, TrashIcon, PlusIcon, ReceiptIcon, OpsIcon } from '../components/Icons'

// Section: Ledger Operations — admin expense input + recent operations view.
export default function LedgerOperations({ ledger, addExpense, updateExpense, deleteExpense }) {
  const config = ledger.house_config
  const today = todayStr()
  // Active members from the ledger (any of them can hand over bazar money).
  const residents = activeResidentIds(ledger)
  const [type, setType] = useState('grocery')
  const [amount, setAmount] = useState('')
  const [vendor, setVendor] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today)
  const [paidBy, setPaidBy] = useState(residents[0] || '')
  const [formError, setFormError] = useState('')
  const [editError, setEditError] = useState('')

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
    if (!amount || Number(amount) <= 0 || Number.isNaN(Number(amount))) {
      setFormError('Enter an amount greater than zero.')
      return
    }
    setFormError('')
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
    setEditError('')
    setEditForm({ type: e.type, amount: e.amount, vendor: e.vendor, note: e.note, date: e.date, paid_by: e.paid_by || '' })
  }
  const cancelEdit = () => {
    setEditingId(null)
    setEditError('')
  }
  const saveEdit = (e) => {
    e.preventDefault()
    if (!editForm.amount || Number(editForm.amount) <= 0 || Number.isNaN(Number(editForm.amount))) {
      setEditError('Enter an amount greater than zero.')
      return
    }
    setEditError('')
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

  // Deleting an expense rewrites the month's math — require a deliberate
  // confirmation so a stray tap can't erase a posted bill.
  const confirmDelete = (e) => {
    if (window.confirm(`Delete ${e.vendor || e.type} (${config.currency} ${Number(e.amount).toLocaleString()})? This cannot be undone.`)) {
      deleteExpense(e.id)
    }
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

  const sorted = [...(ledger.expense_log || [])].sort((a, b) => (a.date < b.date ? 1 : -1))

  // Filters: type + free-text search (vendor / note / paid-by) + month.
  // The log grows all month long — by the 25th scrolling past 60 entries to
  // find one utility bill is painful, so narrow it down first.
  const [filterType, setFilterType] = useState('all')
  const [search, setSearch] = useState('')
  const [filterMonth, setFilterMonth] = useState('all')

  const months = [...new Set(sorted.map((e) => (e.date || '').slice(0, 7)))].filter(Boolean).sort().reverse()

  const filtered = sorted.filter((e) => {
    if (filterType !== 'all' && e.type !== filterType) return false
    const q = search.trim().toLowerCase()
    if (q && !`${e.vendor || ''} ${e.note || ''} ${e.paid_by || ''}`.toLowerCase().includes(q)) return false
    if (filterMonth !== 'all' && !(e.date || '').startsWith(filterMonth)) return false
    return true
  })
  const filteredTotal = filtered.reduce((s, e) => s + Number(e.amount || 0), 0)

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
                  <option key={r} value={r}>{displayNameFor(ledger.users, r)}</option>
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
          {formError && <p className="text-xs text-red-600 font-medium">{formError}</p>}
          <button className="w-full bg-orange-500 hover:bg-orange-600 text-sm font-semibold py-2 rounded-lg text-white">
            Log Expense
          </button>
        </form>
      </div>

      {/* Recent operations */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h3 className="font-bold text-lg mb-3 text-slate-800 flex items-center gap-2">
          <OpsIcon size={18} /> Recent Operations
        </h3>

        {/* Filters */}
        {sorted.length > 0 && (
          <div className="space-y-2 mb-3">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-xs text-slate-800"
              >
                <option value="all">All types</option>
                <option value="grocery">Groceries</option>
                <option value="utility">Utilities</option>
              </select>
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-xs text-slate-800"
              >
                <option value="all">All months</option>
                {months.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vendor, note, or paid-by…"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400"
            />
            <div className="text-[10px] text-slate-400">
              {filtered.length} of {sorted.length} entries · {config.currency} {filteredTotal.toLocaleString()}
            </div>
          </div>
        )}

        {sorted.length === 0 ? (
          <p className="text-sm text-slate-400">No expenses logged yet.</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-400">No entries match the filter.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((e) => (
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
                            <option key={r} value={r}>{displayNameFor(ledger.users, r)}</option>
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
                      {editError && <p className="text-xs text-red-600 font-medium self-center">{editError}</p>}
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
                          <div className="text-[10px] text-slate-400">{e.date} · {e.note || '—'}{e.type === 'grocery' && e.paid_by ? ` · paid by ${displayNameFor(ledger.users, e.paid_by)}` : ''}</div>
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
                          onClick={() => confirmDelete(e)}
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
