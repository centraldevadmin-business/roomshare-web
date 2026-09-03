import clsx from 'clsx'
import { SunIcon, PlateIcon, MoonIcon, BowlIcon } from './Icons'

// The "Cook for N people today" card — the single most important thing on the
// dashboard. Anyone who opens the app can read off how many plates to prepare
// for each meal and tell the maid. Rolls up every resident's meal entry
// (plates + guests) for today.
//
// Props:
//   peopleEating - distinct residents eating today (the big headline number)
//   perMeal      - { breakfast, lunch, dinner } counts (plates + guests)
//   totalPlates  - all plates + guests across all meals today
const SLOT = {
  breakfast: { label: 'Breakfast', icon: <SunIcon size={22} /> },
  lunch: { label: 'Lunch', icon: <PlateIcon size={22} /> },
  dinner: { label: 'Dinner', icon: <MoonIcon size={22} /> },
}

export default function HeadCountCard({ peopleEating, perMeal, totalPlates }) {
  return (
    <div className="rounded-2xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
            <BowlIcon size={18} /> Cook for today
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Tell the maid how many plates</p>
        </div>
        <span className="text-[10px] text-slate-400">people</span>
      </div>

      {/* The headline number everyone looks at */}
      <div className="flex items-end gap-2 my-2">
        <span className="text-5xl font-black text-orange-500 leading-none">
          {peopleEating}
        </span>
        <span className="text-slate-500 font-semibold pb-1 text-sm">people eating</span>
      </div>

      {/* Per-meal head count — big rows the maid can see from across the room */}
      <div className="grid grid-cols-3 gap-2">
        {Object.keys(SLOT).map((slot) => {
          const n = perMeal[slot] || 0
          return (
            <div
              key={slot}
              className={clsx(
                'rounded-xl border-2 py-2.5 text-center',
                n > 0
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-slate-200 bg-white'
              )}
            >
              <div className="flex items-center justify-center text-slate-600 mb-0.5">
                {SLOT[slot].icon}
              </div>
              <div className="text-xl font-black text-slate-800">{n}</div>
              <div className="text-[9px] font-medium text-slate-500 uppercase tracking-wide">
                {SLOT[slot].label}
              </div>
            </div>
          )
        })}
      </div>

      {totalPlates > 0 && (
        <div className="mt-2 text-xs text-slate-500 text-center font-medium">
          {totalPlates} plates total today
        </div>
      )}
    </div>
  )
}
