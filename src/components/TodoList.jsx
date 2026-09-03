import { useState } from 'react'
import { uniqueId } from '../lib/logic'
import { TaskIcon, CheckIcon, WarningIcon, CalendarIcon, TrashIcon } from './Icons'

// Community to-do list. Anyone can add a task (with an optional due date and
// priority) and check it off. Admins can delete tasks.
export default function TodoList({ todos = [], onAdd, onToggle, onDelete }) {
  const [text, setText] = useState('')
  const [due, setDue] = useState('')
  const [priority, setPriority] = useState('normal')

  const submit = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    onAdd({
      id: uniqueId('todo'),
      text: text.trim(),
      done: false,
      priority,
      due,
      createdBy: '',
    })
    setText('')
    setDue('')
    setPriority('normal')
  }

  const sorted = [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    const prio = { high: 0, normal: 1 }
    if (prio[a.priority] !== prio[b.priority]) return prio[a.priority] - prio[b.priority]
    return 0
  })

  const priorityTag = (p) =>
    p === 'high'
      ? 'text-red-600 bg-red-100'
      : 'text-slate-500 bg-slate-100'

  const isOverdue = (due) => {
    if (!due) return false
    return new Date(due + 'T23:59:59') < new Date()
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <h3 className="font-bold text-lg mb-3 text-slate-800 flex items-center gap-2">
        <TaskIcon size={18} /> To-Do List
      </h3>

      <form onSubmit={submit} className="space-y-2 mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a task…"
            className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
          />
          <button className="bg-orange-500 hover:bg-orange-600 text-sm font-semibold px-4 rounded-lg text-white">
            Add
          </button>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-800"
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-800"
          >
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </div>
      </form>

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-400">No tasks yet. Add one above.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((t) => (
            <li key={t.id} className="flex items-start gap-3 rounded-lg bg-slate-50 px-3 py-2">
              <button
                onClick={() => onToggle(t.id)}
                className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  t.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'
                }`}
              >
                {t.done && <CheckIcon size={12} />}
              </button>
              <div className="flex-1 min-w-0">
                <div className={`text-sm ${t.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                  {t.text}
                </div>
                <div className="flex gap-2 mt-1 items-center flex-wrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${priorityTag(t.priority)}`}>
                    {t.priority === 'high' ? <><WarningIcon size={10} /> HIGH</> : 'NORMAL'}
                  </span>
                  {t.due && (
                    <span className={`text-[10px] flex items-center gap-1 ${isOverdue(t.due) ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
                      <CalendarIcon size={10} /> {t.due}
                    </span>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(t.id)}
                      className="text-[10px] text-red-500 hover:text-red-700 font-medium ml-auto flex items-center gap-1"
                    >
                      <TrashIcon size={10} /> Delete
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
