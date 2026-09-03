import { useState } from 'react'
import { todayStr, uniqueId } from '../lib/logic'
import { CartIcon, PlusIcon, MinusIcon, CheckIcon, CloseIcon } from './Icons'

// "Log Bazar" — a one-tap drawer on the resident dashboard. No rotation:
// whoever goes shopping (or hands over cash) enters their purchase as line
// items with individual prices. The total becomes a grocery expense attributed
// to them (paid_by = themselves) and is folded into the meal-rate calculation.
//
// Props:
//   onLogBazar  - (lineItems: [{item, price}]) => void   (adds the expense)
//   resident    - current resident id (shown as "paid by")
//   recent      - last few grocery expenses, newest first (for the "just logged"
//                 confirmation + running total)
export default function BazarLog({ onLogBazar, resident, recent = [] }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([{ item: '', price: '' }])
  const [done, setDone] = useState(false)

  const total = items.reduce((s, it) => s + (Number(it.price) || 0), 0)

  const addItem = () => setItems((p) => [...p, { item: '', price: '' }])
  const removeItem = (i) => setItems((p) => p.filter((_, idx) => idx !== i))
  const updateItem = (i, field, val) =>
    setItems((p) => p.map((it, idx) => (idx === i ? { ...it, [field]: val } : it)))

  const submit = (e) => {
    e.preventDefault()
    if (total <= 0) return
    const lineItems = items
      .filter((it) => it.item.trim() || Number(it.price) > 0)
      .map((it) => ({ item: it.item.trim(), price: Number(it.price) || 0 }))
    onLogBazar(lineItems, total)
    setItems([{ item: '', price: '' }])
    setDone(true)
    setTimeout(() => {
      setDone(false)
      setOpen(false)
    }, 1600)
  }

  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
      >
        <span className="font-bold flex items-center gap-2 text-slate-800">
          <CartIcon size={18} /> Log Bazar
        </span>
        <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-semibold">
          {open ? 'Close' : 'Add purchase'}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-400 mb-3">
            Enter each item with its price. The total becomes a grocery expense paid by {resident}.
          </p>
          <form onSubmit={submit} className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={it.item}
                  onChange={(e) => updateItem(i, 'item', e.target.value)}
                  placeholder="item (e.g. rice)"
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
                />
                <input
                  type="number"
                  value={it.price === '' ? '' : it.price}
                  onChange={(e) => updateItem(i, 'price', e.target.value)}
                  placeholder="price"
                  className="w-24 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={removeItem}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:text-red-500"
                  aria-label="Remove item"
                >
                  <MinusIcon size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700"
            >
              <PlusIcon size={14} /> Add item
            </button>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-sm font-medium text-slate-500">Total</span>
              <span className="text-xl font-extrabold text-slate-800">{total.toLocaleString()}</span>
            </div>

            <button
              type="submit"
              disabled={total <= 0}
              className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-2.5 rounded-xl transition-colors"
            >
              <CheckIcon size={16} /> Log Bazar Expense
            </button>
          </form>

          {done && (
            <div className="mt-3 flex items-center gap-2 text-emerald-600 font-semibold text-sm animate-fade-up">
              <CheckIcon size={16} /> Logged! Total added to groceries.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
