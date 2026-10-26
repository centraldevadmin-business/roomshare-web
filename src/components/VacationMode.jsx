import { useState } from 'react'
import { PlaneIcon, CheckIcon } from './Icons'

// Section 4.2: Smart Vacation Mode.
// A resident selects start/end dates; meals are auto-zeroed for those days.
export default function VacationMode({ resident, vacations, onAdd, onRemove }) {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const list = vacations?.[resident] || []

  const submit = (e) => {
    e.preventDefault()
    setSaved(false)
    if (!start || !end) {
      setError('Pick both a start and an end date.')
      return
    }
    if (end < start) {
      setError('The end date must be on or after the start date.')
      return
    }
    setError('')
    onAdd(resident, { start, end })
    setStart('')
    setEnd('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <h3 className="font-bold text-lg mb-1 text-slate-800 flex items-center gap-2">
        <PlaneIcon size={18} /> Vacation Mode
      </h3>
      <p className="text-xs text-slate-400 mb-3">
        Select dates you'll be out of town to pause associated costs (meals).
      </p>

      <form onSubmit={submit} className="space-y-2 mb-3">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={start}
            onChange={(e) => { setStart(e.target.value); setError('') }}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-sm text-slate-800"
          />
          <input
            type="date"
            value={end}
            onChange={(e) => { setEnd(e.target.value); setError('') }}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-sm text-slate-800"
          />
        </div>
        {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        {saved && (
          <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
            <CheckIcon size={12} /> Vacation added — meals on those days won't count against you.
          </p>
        )}
        <button
          type="submit"
          className="w-full bg-orange-500 hover:bg-orange-600 text-sm font-semibold py-2 rounded-lg text-white"
        >
          Confirm Dates
        </button>
      </form>

      {list.length > 0 && (
        <ul className="space-y-1">
          {list.map((v, i) => (
            <li key={i} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2">
              <span className="text-slate-700">{v.start} → {v.end}</span>
              <button onClick={() => onRemove(resident, i)} className="text-red-500 text-xs font-medium">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
