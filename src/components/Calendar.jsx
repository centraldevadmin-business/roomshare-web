import { useState } from 'react'
import { buildCalendarGrid, eventsOnDate, todayStr } from '../lib/logic'
import { uniqueId } from '../lib/logic'
import { CalendarIcon, PinIcon, PlusIcon, TrashIcon } from './Icons'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const COLORS = {
  orange: 'bg-orange-500',
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  purple: 'bg-purple-500',
}

// Community calendar. Everyone can add an event for a date; the month grid
// shows which days have events. Admins can delete events.
export default function Calendar({ events = [], onAdd, onDelete }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [color, setColor] = useState('orange')

  const grid = buildCalendarGrid(year, month)
  const monthName = new Date(year, month, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1) } else setMonth(month - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1) } else setMonth(month + 1)
  }

  const submit = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({
      id: uniqueId('event'),
      title: title.trim(),
      date: selectedDate,
      time,
      color,
      createdBy: '',
    })
    setTitle('')
    setTime('')
  }

  const selectedEvents = events.filter((ev) => ev.date === selectedDate)

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <h3 className="font-bold text-lg mb-3 text-slate-800 flex items-center gap-2">
        <CalendarIcon size={18} /> Calendar
      </h3>

      {/* Month navigator */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="text-sm font-semibold text-slate-600 hover:text-orange-600">‹ Prev</button>
        <span className="font-bold text-slate-800">{monthName}</span>
        <button onClick={nextMonth} className="text-sm font-semibold text-slate-600 hover:text-orange-600">Next ›</button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-[9px] text-center text-slate-400 font-medium py-1">{w}</div>
        ))}
        {grid.map((cell, i) =>
          cell ? (
            <button
              key={i}
              onClick={() => setSelectedDate(cell.dateStr)}
              className={`relative rounded-lg py-2 text-sm transition-colors ${
                cell.dateStr === todayStr()
                  ? 'bg-orange-500 text-white font-bold'
                  : cell.dateStr === selectedDate
                  ? 'bg-orange-100 text-orange-700 font-semibold'
                  : 'text-slate-700 hover:bg-orange-50'
              }`}
            >
              {cell.day}
              {eventsOnDate(events, cell.dateStr) > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 border border-white" />
              )}
            </button>
          ) : (
            <div key={i} />
          )
        )}
      </div>

      {/* Selected date + add form */}
      <div className="mt-4 pt-3 border-t border-slate-100">
        <div className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
          <PinIcon size={12} /> {selectedDate}
        </div>

        <form onSubmit={submit} className="space-y-2 mb-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title…"
              className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-xs text-slate-800"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {Object.keys(COLORS).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-5 h-5 rounded-full ${COLORS[c]} ${color === c ? 'ring-2 ring-offset-1 ring-orange-400' : ''}`}
                />
              ))}
            </div>
            <button className="bg-orange-500 hover:bg-orange-600 text-sm font-semibold px-4 rounded-lg text-white">
              Add Event
            </button>
          </div>
        </form>

        {/* Events for selected date */}
        {selectedEvents.length > 0 && (
          <ul className="space-y-1.5">
            {selectedEvents.map((ev) => (
              <li key={ev.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <span className={`w-2 h-2 rounded-full ${COLORS[ev.color]}`} />
                <span className="flex-1 text-sm text-slate-800">{ev.title}</span>
                {ev.time && <span className="text-[10px] text-slate-400">{ev.time}</span>}
                {onDelete && (
                  <button onClick={() => onDelete(ev.id)} className="text-[10px] text-red-500 hover:text-red-700">
                    <TrashIcon size={11} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
