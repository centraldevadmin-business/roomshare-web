import { useState } from 'react'
import { PREBUILT_ANNOUNCEMENTS } from '../lib/types.js'
import { FireIcon, WaterIcon, ZapIcon, CartIcon, BroomIcon, SparkleIcon, MegaphoneIcon } from './Icons'

const ICON_MAP = {
  fire: <FireIcon size={14} />,
  water: <WaterIcon size={14} />,
  zap: <ZapIcon size={14} />,
  cart: <CartIcon size={14} />,
  broom: <BroomIcon size={14} />,
  sparkle: <SparkleIcon size={14} />,
}

// Community announcement feed. Everyone can post — a quick "one tap" row of
// prebuilt notices (no gas / no water / no electricity / etc.) plus a freeform
// box. Admins keep a single "Digital Fridge" post too (handled elsewhere).
export default function AnnouncementFeed({
  announcements = [],
  onPost,
  onPostPrebuilt,
  isAdmin,
}) {
  const [text, setText] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    onPost(text.trim())
    setText('')
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <h3 className="font-bold text-lg mb-1 text-slate-800 flex items-center gap-2">
        <MegaphoneIcon size={18} /> Community Board
      </h3>
      <p className="text-xs text-slate-400 mb-3">
        Post a notice the whole house sees. Tap a quick template or write your own.
      </p>

      {/* Prebuilt one-tap notices */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {PREBUILT_ANNOUNCEMENTS.map((a) => (
          <button
            key={a.text}
            onClick={() => onPostPrebuilt(a.text)}
            className="text-left rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-orange-400 hover:bg-orange-50 transition-colors"
          >
            <span className="mr-1">{ICON_MAP[a.icon] || null}</span>
            {a.text}
          </button>
        ))}
      </div>

      {/* Freeform post */}
      <form onSubmit={submit} className="space-y-2 mb-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a notice for the house…"
          rows={2}
          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 resize-none"
        />
        <button className="w-full bg-orange-500 hover:bg-orange-600 text-sm font-semibold py-2 rounded-lg text-white">
          Post Notice
        </button>
      </form>

      {/* Feed */}
      {announcements.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] text-slate-400 font-medium">Recent</div>
          {announcements.map((a) => (
            <div key={a.id} className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <div className="text-sm text-amber-900">{a.text}</div>
              <div className="text-[10px] text-amber-500 mt-1">
                {a.by ? `· ${a.by}` : ''}
                {a.date ? ` · ${new Date(a.date).toLocaleDateString()}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
