import { useState } from 'react'
import { CogIcon, PlusIcon, TrashIcon } from './Icons'
import { RESIDENT_IDS } from '../lib/users'

// Section 3.2 (extended): House Configuration.
// Admins edit the shared house parameters. Changes are queued and synced to
// GitHub, then read by the billing logic (meal rate, rent, internet, cutoff
// hours, bazar interval) and the Excel report.
export default function HouseSettings({ config, onSave }) {
  const residents = RESIDENT_IDS
  const rentByResident = config.rentByResident || {}
  const [form, setForm] = useState({
    currency: config.currency || 'TK',
    mealRate: config.mealRate ?? 70,
    rentPerPerson: config.rentPerPerson ?? 880,
    cutoffHour: config.cutoffHour ?? 21,
    bazarIntervalDays: config.bazarIntervalDays ?? 3,
    cutoffDay: config.cutoffDay ?? 28,
    residentCount: (config._residentCount) || 3,
    rentFreeResident: config.rentFreeResident || '',
    rentByResident: residents.reduce((acc, r) => { acc[r] = rentByResident[r] ?? 0; return acc }, {}),
    fixedCosts: Array.isArray(config.fixedCosts) ? config.fixedCosts : [],
  })
  const [saved, setSaved] = useState(false)

  const set = (key) => (e) => {
    const value = e.target.value
    setSaved(false)
    setForm((f) => ({ ...f, [key]: value }))
  }

  // Fixed-costs editor. Each row: { name, total }.
  const updateFixedCost = (i, key, value) => {
    setSaved(false)
    const next = [...(form.fixedCosts || [])]
    while (next.length <= i) next.push({ name: '', total: 0 })
    next[i] = { ...next[i], [key]: value }
    setForm((f) => ({ ...f, fixedCosts: next }))
  }
  const addFixedCost = () => {
    setSaved(false)
    setForm((f) => ({ ...f, fixedCosts: [...(f.fixedCosts || []), { name: '', total: 0 }] }))
  }
  const removeFixedCost = (i) => {
    setSaved(false)
    setForm((f) => ({ ...f, fixedCosts: (f.fixedCosts || []).filter((_, idx) => idx !== i) }))
  }

  // Per-person rent editor. Each resident gets their own rent amount (0 =
  // rent-free). This is the source of truth for the billing logic.
  const updateRent = (r, value) => {
    setSaved(false)
    setForm((f) => ({ ...f, rentByResident: { ...f.rentByResident, [r]: Number(value) || 0 } }))
  }

  const submit = (e) => {
    e.preventDefault()
    onSave({
      currency: form.currency,
      mealRate: Number(form.mealRate),
      rentPerPerson: Number(form.rentPerPerson),
      cutoffHour: Number(form.cutoffHour),
      bazarIntervalDays: Number(form.bazarIntervalDays),
      cutoffDay: Number(form.cutoffDay),
      _residentCount: Number(form.residentCount),
      rentFreeResident: form.rentFreeResident || null,
      rentByResident: form.rentByResident,
      fixedCosts: (form.fixedCosts || []).filter((c) => c.name && Number(c.total)).map((c) => ({ name: c.name, total: Number(c.total) })),
    })
    setSaved(true)
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <h3 className="font-bold text-lg mb-1 text-slate-800 flex items-center gap-2">
        <CogIcon size={18} /> House Settings
      </h3>
      <p className="text-xs text-slate-400 mb-3">
        Shared parameters for the whole house. Billing reads these live.
      </p>

      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Currency</label>
            <input
              value={form.currency}
              onChange={set('currency')}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Residents</label>
            <input
              type="number"
              min="1"
              value={form.residentCount}
              onChange={set('residentCount')}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Meal Rate (per plate)</label>
            <input
              type="number"
              value={form.mealRate}
              onChange={set('mealRate')}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Rent fallback (per person)</label>
            <input
              type="number"
              value={form.rentPerPerson}
              onChange={set('rentPerPerson')}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800"
              placeholder="Legacy fallback"
            />
            <p className="text-[10px] text-slate-400 mt-1">Used only if per-person rent below is blank. Set each person's rent below.</p>
          </div>
        </div>

        {/* Per-person rent editor — source of truth for billing */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs text-slate-400">Rent per resident</label>
            <span className="text-[10px] text-slate-400">0 = rent-free</span>
          </div>
          {residents.map((r) => (
            <div key={r} className="grid grid-cols-3 gap-2 items-end">
              <input
                type="text"
                value={r}
                readOnly
                className="bg-slate-100 border border-slate-300 rounded-lg px-2 py-2 text-sm text-slate-700"
              />
              <input
                type="number"
                value={form.rentByResident[r] ?? 0}
                onChange={(e) => updateRent(r, e.target.value)}
                placeholder="0"
                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-sm text-slate-800 placeholder:text-slate-400"
              />
              <label className="flex items-center gap-1 text-[10px] text-slate-500">
                <input
                  type="checkbox"
                  checked={Number(form.rentByResident[r] ?? 0) === 0}
                  onChange={(e) => updateRent(r, e.target.checked ? 0 : form.rentPerPerson)}
                  className="accent-orange-500"
                />
                rent-free
              </label>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Bazar interval (days)</label>
            <input
              type="number"
              min="1"
              value={form.bazarIntervalDays}
              onChange={set('bazarIntervalDays')}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Dinner locks at (hour, 24h)</label>
            <input
              type="number"
              min="0"
              max="23"
              value={form.cutoffHour}
              onChange={set('cutoffHour')}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Dinner locks at (hour, 24h)</label>
            <input
              type="number"
              min="0"
              max="23"
              value={form.cutoffHour}
              onChange={set('cutoffHour')}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Month-finalize day (gate)</label>
            <input
              type="number"
              min="1"
              max="31"
              value={form.cutoffDay}
              onChange={set('cutoffDay')}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800"
            />
          </div>
        </div>

        {/* Settlement config */}
        <div className="border-t border-slate-100 pt-3 mt-1 space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Rent-free resident</label>
            <select
              value={form.rentFreeResident}
              onChange={set('rentFreeResident')}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800"
            >
              <option value="">— none —</option>
              {residents.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">This person pays no rent, but fixed costs are still split across everyone.</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-slate-400">Fixed costs (split ÷ everyone)</label>
              <button type="button" onClick={addFixedCost} className="text-[10px] px-2 py-1 rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-600 font-semibold flex items-center gap-1">
                <PlusIcon size={12} /> Add
              </button>
            </div>
            <div className="space-y-2">
              {(form.fixedCosts || []).map((c, i) => (
                <div key={i} className="grid grid-cols-3 gap-2 items-end">
                  <input
                    type="text"
                    value={c.name}
                    onChange={(e) => updateFixedCost(i, 'name', e.target.value)}
                    placeholder="e.g. Gas"
                    className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-sm text-slate-800 placeholder:text-slate-400"
                  />
                  <input
                    type="number"
                    value={c.total || ''}
                    onChange={(e) => updateFixedCost(i, 'total', e.target.value)}
                    placeholder="Amount"
                    className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-sm text-slate-800 placeholder:text-slate-400"
                  />
                  <button type="button" onClick={() => removeFixedCost(i)} className="bg-red-100 hover:bg-red-200 text-red-600 rounded-lg px-2 py-2 text-sm font-semibold flex items-center justify-center">
                    <TrashIcon size={14} />
                  </button>
                </div>
              ))}
              {(form.fixedCosts || []).length === 0 && (
                <p className="text-[10px] text-slate-400">No fixed costs added. Internet is still split separately.</p>
              )}
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-orange-500 hover:bg-orange-600 text-sm font-semibold py-2.5 rounded-lg text-white flex items-center justify-center gap-2"
        >
          {saved ? 'Saved · will sync next cycle' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}
