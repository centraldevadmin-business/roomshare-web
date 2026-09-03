import { useState } from 'react'
import clsx from 'clsx'
import { isSlotLocked } from '../lib/logic'
import { MEAL_SLOTS } from '../lib/types.js'
import { SunIcon, PlateIcon, MoonIcon, LockIcon, CheckIcon, PlusIcon, MinusIcon, CheckAllIcon } from './Icons'

const SLOTS = [
  { key: 'breakfast', label: 'Breakfast', icon: <SunIcon size={20} /> },
  { key: 'lunch', label: 'Lunch', icon: <PlateIcon size={20} /> },
  { key: 'dinner', label: 'Dinner', icon: <MoonIcon size={20} /> },
]

// The Maid's Matrix — a bold 3x2 grid of meal status.
// Columns: Today / Tomorrow (or a chosen day).
// Rows: Breakfast / Lunch / Dinner.
// Dynamic lock: dinner locks at 4 PM, breakfast & lunch lock at 9 PM.
export default function MealMatrix({
  resident,
  date,
  tomorrow,
  entry,
  tomorrowEntry,
  onToggle,
  setGuests,
  showGuests = false,
  title,
  ledger,
  setAllMeals,
}) {
  const now = new Date()
  const cutoffHour = ledger?.house_config?.cutoffHour ?? 21
  const lockedToday = SLOTS.some((s) => isSlotLocked(s.key, now, cutoffHour))

  const cell = (e, slot) => (e ? (e[slot] || 0) : 0)
  const guestCell = (e, slot) => (e ? (e.guests?.[slot] || 0) : 0)

  const renderGrid = (e, nextE, isToday) => (
    <div className="grid grid-cols-3 gap-2">
      {SLOTS.map((s) => {
        const locked = isToday && isSlotLocked(s.key, now, cutoffHour)
        const active = cell(e, s.key) > 0
        return (
          <div key={s.key} className="flex flex-col items-center gap-1">
            <button
              onClick={() => !locked && onToggle(resident, date, s.key, !active)}
              disabled={locked}
              className={clsx(
                'relative rounded-xl py-2 px-2 text-center transition-all border-2 flex-1 w-full',
                locked
                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  : active
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'bg-white border-slate-300 text-slate-500 hover:border-orange-400'
              )}
            >
              <div className="text-white flex items-center justify-center">{s.icon}</div>
              <div className="text-[10px] mt-0.5 font-medium">{s.label}</div>
              <div className="text-base font-bold mt-0.5">
                {active ? <CheckIcon size={16} /> : <span className="inline-block">○</span>}
              </div>
              {locked && (
                <span className="absolute top-1 right-1 text-[11px]" title="Locked after 9 PM">
                  <LockIcon size={12} />
                </span>
              )}
            </button>
            {showGuests && !locked && (
              <div className="flex items-center justify-center gap-1">
                <button
                  onClick={(ev) => {
                    ev.stopPropagation()
                    if (setGuests) setGuests(resident, date, s.key, guestCell(e, s.key) + 1)
                  }}
                  className="w-5 h-5 flex items-center justify-center bg-orange-500 text-white rounded-full transition-colors"
                  title="Add guest plate"
                >
                  <PlusIcon size={12} />
                </button>
                <button
                  onClick={(ev) => {
                    ev.stopPropagation()
                    if (setGuests) setGuests(resident, date, s.key, guestCell(e, s.key) - 1)
                  }}
                  className="w-5 h-5 flex items-center justify-center bg-slate-200 text-slate-600 rounded-full transition-colors"
                  title="Remove guest plate"
                >
                  <MinusIcon size={12} />
                </button>
                <span className="text-[10px] font-semibold text-slate-600">{guestCell(e, s.key)}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-base text-slate-800">{title || 'Meal Matrix'}</h3>
        {lockedToday && (
          <span className="text-[10px] text-amber-600 flex items-center gap-1">
            <LockIcon size={11} /> Locks 9 PM
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-slate-400 mb-1 text-center font-medium">Today</div>
          {renderGrid(entry, tomorrowEntry, true)}
        </div>
        <div>
          <div className="text-[10px] text-slate-400 mb-1 text-center font-medium">Tomorrow</div>
          {renderGrid(tomorrowEntry, null, false)}
        </div>
      </div>

      {/* One-tap "set all today's meals" — only shows when the resident
          hasn't tapped anything yet for today. Tapping it flips breakfast,
          lunch, and dinner all on in a single gesture. */}
      {setAllMeals && !lockedToday && !todayHasAnyTap(entry) && (
        <button
          onClick={() => setAllMeals(resident, date)}
          className="mt-3 w-full rounded-xl py-2.5 px-3 text-sm font-bold text-white transition-all bg-gradient-to-r from-orange-500 to-amber-500 shadow-sm hover:shadow-md flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <CheckAllIcon size={18} /> Set all today's meals
        </button>
      )}
    </div>
  )
}

// A today entry counts as "untapped" when every slot is still 0.
function todayHasAnyTap(entry) {
  if (!entry) return false
  return (entry.breakfast || 0) + (entry.lunch || 0) + (entry.dinner || 0) > 0
}
