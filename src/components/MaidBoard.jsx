import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { todayStr, isSlotLocked } from '../lib/logic'
import { MEAL_SLOTS } from '../lib/types.js'
import { RESIDENT_IDS } from '../lib/users'
import {
  MegaphoneIcon,
  SunIcon,
  PlateIcon,
  MoonIcon,
  CheckIcon,
  BroomIcon,
  WarningIcon,
  CartIcon,
  FireIcon,
  WaterIcon,
  ZapIcon,
} from './Icons'

// The Maid Board — the one screen the person at the gate looks at when the
// maid arrives. It answers a single question in big letters:
//
//   "How many people eat today, and which meals?"
//
// Each resident has already tapped Breakfast / Lunch / Dinner for themselves
// (and any guests). This component rolls all of that up into a glanceable
// summary the gate person can read off and tell the maid. It also has one-tap
// alert buttons for the edge cases (no gas / no water / no power / bazar cash /
// maid didn't come) that post straight to the Community Board.

const SLOT_ICON = {
  breakfast: <SunIcon size={22} />,
  lunch: <PlateIcon size={22} />,
  dinner: <MoonIcon size={22} />,
}
const SLOT_LABEL = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
}

export default function MaidBoard({
  ledger,
  toggleMeal,
  postAnnouncement,
}) {
  const [alert, setAlert] = useState('')
  const today = todayStr()
  const config = ledger.house_config || {}
  const cutoffHour = config.cutoffHour ?? 21

  // Today's meal entries for every resident.
  const entries = useMemo(() => {
    const map = {}
    for (const id of RESIDENT_IDS) {
      map[id] = ledger.meal_log.find((m) => m.resident === id && m.date === today) || null
    }
    return map
  }, [ledger.meal_log, today])

  // Head count per meal: plates + guests, across everyone.
  const headCount = useMemo(() => {
    const c = { breakfast: 0, lunch: 0, dinner: 0 }
    for (const id of RESIDENT_IDS) {
      const e = entries[id]
      if (!e) continue
      c.breakfast += (e.breakfast || 0) + (e.guests?.breakfast || 0)
      c.lunch += (e.lunch || 0) + (e.guests?.lunch || 0)
      c.dinner += (e.dinner || 0) + (e.guests?.dinner || 0)
    }
    return c
  }, [entries])

  // Total distinct people eating today (any meal).
  const peopleEating = useMemo(() => {
    return RESIDENT_IDS.filter((id) => {
      const e = entries[id]
      if (!e) return false
      const total =
        (e.breakfast || 0) + (e.lunch || 0) + (e.dinner || 0) +
        (e.guests?.breakfast || 0) + (e.guests?.lunch || 0) + (e.guests?.dinner || 0)
      return total > 0
    }).length
  }, [entries])

  const post = (text) => {
    if (!text.trim()) return
    postAnnouncement(text.trim())
    setAlert('')
  }

  const lockedToday = MEAL_SLOTS.some((s) => isSlotLocked(s, new Date(), cutoffHour))

  return (
    <div className="space-y-4">
      {/* ---- The big glanceable summary ---- */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <MegaphoneIcon size={20} /> Maid Board — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </h3>
          <span className="text-[10px] text-slate-400">Cook for</span>
        </div>

        {/* The number everyone looks at */}
        <div className="flex items-end gap-2 mb-4">
          <span className="text-7xl font-black text-orange-500 leading-none">
            {peopleEating}
          </span>
          <span className="text-slate-500 font-semibold pb-1">people today</span>
        </div>

        {/* Per-meal head count — big rows the maid can see from across the room */}
        <div className="grid grid-cols-3 gap-3">
          {MEAL_SLOTS.map((slot) => {
            const locked = isSlotLocked(slot, new Date(), cutoffHour)
            const n = headCount[slot]
            return (
              <div
                key={slot}
                className={clsx(
                  'rounded-2xl border-2 p-3 text-center',
                  n > 0
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-slate-200 bg-slate-50'
                )}
              >
                <div className="flex items-center justify-center text-slate-600 mb-1">
                  {SLOT_ICON[slot]}
                </div>
                <div className="text-3xl font-black text-slate-800">{n}</div>
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                  {SLOT_LABEL[slot]}
                </div>
                {locked && n === 0 && (
                  <div className="text-[9px] text-slate-400 mt-1">locked</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ---- Who's eating what (per person) ---- */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h3 className="font-bold text-sm text-slate-700 mb-3">Who's eating what</h3>
        <div className="space-y-2">
          {RESIDENT_IDS.map((id) => {
            const e = entries[id]
            const hasAny =
              (e?.breakfast || 0) + (e?.lunch || 0) + (e?.dinner || 0) +
              (e?.guests?.breakfast || 0) + (e?.guests?.lunch || 0) + (e?.guests?.dinner || 0) > 0
            return (
              <div
                key={id}
                className={clsx(
                  'flex items-center justify-between rounded-xl border px-3 py-2',
                  hasAny ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-100 bg-slate-50/50'
                )}
              >
                <span className="font-medium text-slate-700">{id}</span>
                <div className="flex items-center gap-3">
                  {MEAL_SLOTS.map((slot) => {
                    const on = (e?.[slot] || 0) + (e?.guests?.[slot] || 0) > 0
                    return (
                      <div
                        key={slot}
                        className={clsx(
                          'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold',
                          on ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                        )}
                      >
                        {on ? <CheckIcon size={14} /> : null}
                        {SLOT_LABEL[slot].slice(0, 3)}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ---- Quick head-count buttons (in case someone forgot to tap) ---- */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h3 className="font-bold text-sm text-slate-700 mb-1">Quick head count</h3>
        <p className="text-xs text-slate-400 mb-3">
          If someone hasn't tapped yet, set their meals for today in one tap.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {RESIDENT_IDS.map((id) => {
            const e = entries[id]
            const hasAny =
              (e?.breakfast || 0) + (e?.lunch || 0) + (e?.dinner || 0) > 0
            return (
              <div key={id} className="rounded-xl border border-slate-200 p-2">
                <div className="text-xs font-semibold text-slate-600 mb-2 text-center">{id}</div>
                <div className="grid grid-cols-3 gap-1">
                  {MEAL_SLOTS.map((slot) => {
                    const locked = isSlotLocked(slot, new Date(), cutoffHour)
                    const on = (e?.[slot] || 0) > 0
                    return (
                      <button
                        key={slot}
                        disabled={locked}
                        onClick={() => toggleMeal(id, today, slot, !on)}
                        className={clsx(
                          'rounded-lg py-1.5 text-[11px] font-semibold transition-colors',
                          locked
                            ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                            : on
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-100 text-slate-500 hover:bg-orange-100'
                        )}
                      >
                        {SLOT_LABEL[slot].slice(0, 3)}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ---- Edge-case alerts — post straight to the Community Board ---- */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h3 className="font-bold text-sm text-slate-700 mb-1 flex items-center gap-2">
          <WarningIcon size={16} /> Alert the house
        </h3>
        <p className="text-xs text-slate-400 mb-3">
          No gas, no power, need bazar cash, or the maid didn't come? Tap one — it
          posts to everyone's phone instantly.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <AlertButton
            icon={<FireIcon size={16} />}
            label="No gas today"
            text="No gas today — kitchen closed, order food"
            alert={alert}
            onClick={() => setAlert('No gas today — kitchen closed, order food')}
          />
          <AlertButton
            icon={<WaterIcon size={16} />}
            label="No water today"
            text="No water today — tanks being cleaned"
            alert={alert}
            onClick={() => setAlert('No water today — tanks being cleaned')}
          />
          <AlertButton
            icon={<ZapIcon size={16} />}
            label="No electricity"
            text="No electricity — power cut expected"
            alert={alert}
            onClick={() => setAlert('No electricity — power cut expected')}
          />
          <AlertButton
            icon={<CartIcon size={16} />}
            label="Need bazar cash"
            text="Need money for bazar today — please contribute"
            alert={alert}
            onClick={() => setAlert('Need money for bazar today — please contribute')}
          />
          <AlertButton
            icon={<BroomIcon size={16} />}
            label="Maid didn't come"
            text="Maid absent today — order food"
            alert={alert}
            onClick={() => setAlert('Maid absent today — order food')}
            full
          />
          <button
            onClick={() => post(alert)}
            disabled={!alert.trim()}
            className="rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 px-2 transition-colors text-sm"
          >
            Post alert
          </button>
        </div>
      </div>
    </div>
  )
}

function AlertButton({ icon, label, text, alert, onClick, full }) {
  const active = alert === text
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors text-left',
        active
          ? 'border-red-400 bg-red-50 text-red-700'
          : 'border-slate-200 text-slate-600 hover:border-amber-400 hover:bg-amber-50'
      )}
    >
      <span>{icon}</span>
      {label}
    </button>
  )
}
