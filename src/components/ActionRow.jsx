import { useState } from 'react'
import clsx from 'clsx'
import { MEAL_SLOTS } from '../lib/types.js'
import { isSlotLocked } from '../lib/logic'
import { SunIcon, PlateIcon, MoonIcon, LockIcon, CheckIcon, PlusIcon, MinusIcon } from './Icons'

const SLOTS = [
  { key: 'breakfast', label: 'Breakfast', icon: <SunIcon size={24} /> },
  { key: 'lunch', label: 'Lunch', icon: <PlateIcon size={24} /> },
  { key: 'dinner', label: 'Dinner', icon: <MoonIcon size={24} /> },
]

// The Action Row — three large toggle buttons for the NEXT day only.
// Each button is a single tap to mark a meal as eaten. Locked slots are
// greyed out and padlocked. Guests are added from the Guest Log below.
export default function ActionRow({
  resident,
  date,
  tomorrow,
  entry,
  tomorrowEntry,
  onToggle,
  showGuests = false,
  setGuests,
  ledger,
}) {
  const now = new Date()
  const cutoffHour = ledger?.house_config?.cutoffHour ?? 21
  const lockedToday = SLOTS.some((s) => isSlotLocked(s.key, now, cutoffHour))

  const cell = (e, slot) => (e ? (e[slot] || 0) : 0)

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg text-slate-800">Tomorrow</h3>
        {lockedToday && (
          <span className="text-[11px] text-amber-600 flex items-center gap-1">
            <LockIcon size={12} /> Some meals locked
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {SLOTS.map((s) => {
          const locked = isSlotLocked(s.key, now, cutoffHour)
          const active = cell(tomorrowEntry, s.key) > 0
          return (
            <button
              key={s.key}
              onClick={() => !locked && onToggle(resident, tomorrow, s.key, !active)}
              disabled={locked}
              className={clsx(
                'relative rounded-2xl py-6 px-2 text-center transition-all border-2',
                locked
                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  : active
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'bg-white border-slate-300 text-slate-500 hover:border-orange-400'
              )}
            >
              <div className="text-white flex items-center justify-center">{s.icon}</div>
              <div className="text-xs mt-1 font-medium">{s.label}</div>
              <div className="text-xl font-bold mt-1">
                {active ? <CheckIcon size={20} /> : <span className="inline-block">○</span>}
              </div>
              {locked && (
                <span className="absolute top-1 right-2 text-[11px]" title="Locked">
                  <LockIcon size={12} />
                </span>
              )}
            </button>
          )
        })}
      </div>
      {showGuests && (
        <div className="mt-3">
          <div className="text-xs text-slate-400 mb-1.5 font-medium">Guest plates (tomorrow)</div>
          <div className="grid grid-cols-3 gap-2">
            {SLOTS.map((s) => {
              const g = (tomorrowEntry?.guests?.[s.key] || 0)
              return (
                <div key={s.key} className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5">
                  <span className="text-xs text-capitalize text-slate-600">{s.label}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(ev) => {
                        ev.stopPropagation()
                        if (setGuests) setGuests(resident, tomorrow, s.key, g - 1)
                      }}
                      className="w-5 h-5 flex items-center justify-center bg-slate-200 text-slate-600 rounded-full transition-colors"
                    >
                      <MinusIcon size={12} />
                    </button>
                    <span className="text-[11px] font-semibold text-slate-600">{g}</span>
                    <button
                      onClick={(ev) => {
                        ev.stopPropagation()
                        if (setGuests) setGuests(resident, tomorrow, s.key, g + 1)
                      }}
                      className="w-5 h-5 flex items-center justify-center bg-orange-500 text-white rounded-full transition-colors"
                    >
                      <PlusIcon size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
