import { useMemo } from 'react'
import { SunIcon, MoonIcon, BowlIcon, HomeIcon, PlateIcon, PersonIcon } from './Icons'

// A cheerful "good morning / afternoon / evening" banner with a little cartoon
// scene that bobs and twinkles when someone opens the app. Shows once per
// session at the top of the app shell.
export default function Greeting({ name }) {
  const { message, mascot, scene } = useMemo(() => buildGreeting(name), [])

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 px-4 py-3 shadow-sm text-white">
      {/* Twinkling sparkles — CSS dots, no emoji glyphs */}
      <span className="absolute top-2 left-6 h-1.5 w-1.5 rounded-full bg-white/70 animate-pulse" style={{ animationDelay: '0ms' }} />
      <span className="absolute top-5 right-10 h-1 w-1 rounded-full bg-white/60 animate-pulse" style={{ animationDelay: '300ms' }} />
      <span className="absolute bottom-2 right-16 h-1 w-1 rounded-full bg-white/50 animate-pulse" style={{ animationDelay: '600ms' }} />

      <div className="flex items-center gap-3">
        {/* Bouncing cartoon mascot */}
        <div className="relative shrink-0" style={{ animation: 'hl-bounce 1.6s ease-in-out infinite' }}>
          <span className="text-3xl block select-none" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.15))' }}>
            {mascot}
          </span>
          {/* little shadow under the mascot */}
          <div className="mx-auto mt-0.5 h-1 w-8 rounded-full bg-black/15" style={{ animation: 'hl-pulse 1.6s ease-in-out infinite' }} />
        </div>

        <div className="min-w-0">
          <div className="font-extrabold text-base leading-tight truncate">
            {message}
            {name ? ', ' + name : ''}
          </div>
          <div className="text-xs text-white/85 mt-0.5 flex items-center gap-1">
            {scene}
          </div>
        </div>
      </div>
    </div>
  )
}

function buildGreeting(name) {
  const hour = new Date().getHours()
  let message, mascot, scene

  if (hour < 5) {
    message = 'Still up?'
    mascot = <MoonIcon size={32} />
    scene = 'Late-night vibes — grab some water'
  } else if (hour < 11) {
    message = 'Good morning!'
    mascot = <SunIcon size={32} />
    scene = 'A fresh new day at the house'
  } else if (hour < 16) {
    message = 'Good afternoon!'
    mascot = <HomeIcon size={32} />
    scene = 'Lunch time is coming up'
  } else if (hour < 20) {
    message = 'Good evening!'
    mascot = <PlateIcon size={32} />
    scene = 'Dinner locks at 4 PM — you made it'
  } else {
    message = 'Winding down'
    mascot = <PersonIcon size={32} />
    scene = 'Relax, tomorrow\'s breakfast awaits'
  }

  return { message, mascot, scene }
}
