import React, { useState } from 'react'
import {
  CloseIcon, HomeIcon, SunIcon, PlateIcon, LedgerIcon, CartIcon,
  PlaneIcon, CommunityIcon, MegaphoneIcon, SparkleIcon, CogIcon,
  ControlIcon, UsersIcon, CrownIcon,
} from './Icons'

// Map the string icon keys used in tutorialSteps.js to SVG icon components.
const ICON_MAP = {
  home: HomeIcon, sun: SunIcon, plate: PlateIcon, ledger: LedgerIcon,
  cart: CartIcon, plane: PlaneIcon, community: CommunityIcon,
  megaphone: MegaphoneIcon, sparkle: SparkleIcon, cog: CogIcon,
  control: ControlIcon, users: UsersIcon, crown: CrownIcon,
}

// First-login tutorial. A step-by-step tour that teaches every tab and the key
// feature on each screen. Dismissed once per user via localStorage so it only
// shows on the very first login.
export default function Tutorial({ steps, onComplete }) {
  const [index, setIndex] = useState(0)
  const step = steps[index]
  const isLast = index === steps.length - 1
  const isFirst = index === 0

  const next = () => {
    if (isLast) {
      onComplete?.()
      return
    }
    setIndex((i) => i + 1)
  }
  const skip = () => onComplete?.()

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={skip} />

      {/* Card */}
      <div className="relative w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 shadow-2xl animate-fade-up">
        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-4">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-orange-500' : 'w-1.5 bg-slate-200'}`}
            />
          ))}
        </div>

        {/* Close */}
        <button
          onClick={skip}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
          aria-label="Skip tutorial"
        >
          <CloseIcon size={16} />
        </button>

        {/* Icon */}
        <div className="flex justify-center text-orange-500 mb-4" style={{ animation: 'hl-bounce 1.6s ease-in-out infinite' }}>
          {ICON_MAP[step.icon] ? React.createElement(ICON_MAP[step.icon], { size: 48 }) : null}
        </div>

        {/* Content */}
        <h2 className="text-xl font-extrabold text-slate-800 text-center mb-2">{step.title}</h2>
        <p className="text-sm text-slate-600 text-center leading-relaxed mb-6">{step.body}</p>

        {/* Footer */}
        <div className="flex items-center gap-3">
          {!isFirst && (
            <button
              onClick={() => setIndex((i) => i - 1)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Back
            </button>
          )}
          <button
            onClick={next}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all bg-gradient-to-r from-orange-500 to-amber-500 hover:shadow-md active:scale-[0.98]"
          >
            {isLast ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
