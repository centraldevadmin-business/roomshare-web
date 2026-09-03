import { PlusIcon, MinusIcon, BowlIcon } from './Icons'

// Section 2.A: Guest Addition — add +1 or +2 plates, auto-charged.
export default function GuestLog({ resident, date, entry, onSetGuests }) {
  const guestTotal =
    (entry?.guests?.breakfast || 0) + (entry?.guests?.lunch || 0) + (entry?.guests?.dinner || 0)

  const add = (slot, delta) => {
    const current = entry?.guests?.[slot] || 0
    const next = Math.max(0, current + delta)
    onSetGuests(resident, date, slot, next)
  }

  const slotLabel = (slot) => {
    switch (slot) {
      case 'breakfast': return 'Breakfast'
      case 'lunch': return 'Lunch'
      case 'dinner': return 'Dinner'
      default: return slot
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
          <BowlIcon size={16} /> Guest Log
        </h3>
        <span className="text-[10px] text-slate-400">Auto-charged to your account</span>
      </div>
      <div className="space-y-1.5">
        {['breakfast', 'lunch', 'dinner'].map((slot) => (
          <div key={slot} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
            <span className="text-sm text-slate-700 font-medium">{slotLabel(slot)}</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => add(slot, -1)}
                className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 flex items-center justify-center transition-colors"
                title="Remove guest plate"
              >
                <MinusIcon size={14} />
              </button>
              <span className="w-5 text-center font-bold text-slate-800">{entry?.guests?.[slot] || 0}</span>
              <button
                onClick={() => add(slot, 1)}
                className="w-7 h-7 rounded-full bg-orange-500 hover:bg-orange-600 font-bold text-white flex items-center justify-center transition-colors"
                title="Add guest plate"
              >
                <PlusIcon size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      {guestTotal > 0 && (
        <div className="mt-2 text-xs text-orange-600 font-medium">
          {guestTotal} guest plate(s) added today.
        </div>
      )}
    </div>
  )
}
