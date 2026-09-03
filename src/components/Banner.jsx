import { MegaphoneIcon } from './Icons'

// Section 1: The "Digital Fridge" — scrolling marquee banner.
// Admin pushes text; residents see it on next sync / app open.

export default function Banner({ announcements }) {
  const latest = announcements && announcements.length ? announcements[0].text : ''
  if (!latest) return null
  return (
    <div className="w-full overflow-hidden bg-indigo-500 text-white py-2 relative">
      <div className="whitespace-nowrap animate-marquee inline-flex items-center gap-3">
        <span className="inline-flex items-center justify-center shrink-0 text-indigo-200">
          <MegaphoneIcon size={16} />
        </span>
        <span className="font-medium">{latest}</span>
        <span className="inline-flex items-center justify-center shrink-0 text-indigo-200">
          <MegaphoneIcon size={16} />
        </span>
      </div>
    </div>
  )
}
