import clsx from 'clsx'
import { bazarDuty } from '../lib/logic'
import { CartIcon, BasketIcon, MoneyIcon } from './Icons'

// Section 4.1: Bazar Rotation.
//
// Nafiz (the admin) does NOT shop — he just hands over the cash. The grocery
// duty rotates only among the residents who actually go to the bazar. Pass the
// `shoppers` list (everyone who shops) and, optionally, the `funder` id (who
// funds the groceries). The funder sees a "hand out the cash" message instead
// of a rotation badge.
const NAMES = {
  mohin: 'Mohin',
  neloy: 'Neloy',
}

export default function BazarDuty({
  shoppers,
  currentResident,
  funder = null,
  interval = 3,
}) {
  const roster = shoppers || []
  const duty = roster.length ? bazarDuty(roster, new Date(), interval) : null
  const isFunder = funder === currentResident || !roster.includes(currentResident)
  const isMyTurn = !isFunder && duty === currentResident

  return (
    <div
      className={clsx(
        'rounded-2xl p-4 border-2 transition-all',
        isMyTurn ? 'bg-orange-50 border-orange-300'
        : isFunder ? 'bg-sky-50 border-sky-200'
        : 'bg-white border-slate-200'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-bold flex items-center gap-2">
          <CartIcon size={18} /> Bazar Duty
        </span>
        {isMyTurn ? (
          <span className="text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded-full font-bold">
            YOUR TURN
          </span>
        ) : isFunder ? (
          <span className="text-[10px] bg-sky-500 text-white px-2 py-0.5 rounded-full font-bold">
            YOU FUND IT
          </span>
        ) : (
          <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">ROTATING</span>
        )}
      </div>
      <div className="text-3xl my-2 flex items-center justify-center">
        {isFunder ? <MoneyIcon size={40} /> : <BasketIcon size={40} />}
      </div>
      <div className="text-sm text-slate-600 text-center">
        {isFunder ? (
          <span className="font-semibold text-sky-700">
            Hand the bazar cash to <span className="text-sky-900">{NAMES[duty] || duty || 'whoever'}</span> on duty today.
          </span>
        ) : isMyTurn ? (
          <span className="font-semibold text-orange-600">Today is Your Turn for Groceries!</span>
        ) : (
          <span>Next up: <span className="font-semibold text-slate-800">{NAMES[duty] || duty || '—'}</span></span>
        )}
      </div>
    </div>
  )
}
