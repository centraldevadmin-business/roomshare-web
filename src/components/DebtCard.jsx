import clsx from 'clsx'
import { debtStatus } from '../lib/logic'
import { CheckIcon, TrendUpIcon, TrendDownIcon, WarningIcon } from './Icons'

// The "Guilt-Trip" Debt Visualizer — pure numbers, no payment system.
// Positive balance = house owes you (green). Negative = you owe the house.
//   green  = +500 or more (house owes you)
//   grey   = 0 to 500 (neutral)
//   yellow = approaching ~1000 in debt
//   flash-red = more than 2000 in debt
export default function DebtCard({ balance, currency = 'TK' }) {
  const { label, tone } = debtStatus(balance)
  const isSevere = tone === 'flash-red'
  const isAttention = tone === 'yellow'
  const isGreen = tone === 'green'
  const isPositive = balance >= 0

  return (
    <div className={clsx(
      'rounded-2xl p-4 border-2 transition-all',
      isSevere ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-300'
      : isGreen ? 'bg-gradient-to-br from-emerald-50 to-teal-100 border-emerald-300'
      : isAttention ? 'bg-gradient-to-br from-amber-50 to-yellow-100 border-amber-300'
      : 'bg-white border-slate-200'
    )}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">Ledger Balance</span>
        <span
          className={clsx(
            'text-[10px] px-2 py-0.5 rounded-full font-semibold',
            isSevere && 'bg-red-500 text-white',
            isGreen && 'bg-emerald-500 text-emerald-50',
            isAttention && 'bg-amber-500 text-white',
            !isSevere && !isGreen && !isAttention && 'bg-slate-200 text-slate-600'
          )}
        >
          {isSevere ? <><WarningIcon size={10} /> SEVERE</> : isGreen ? 'GOOD STANDING' : label}
        </span>
      </div>
      <div className={clsx('text-3xl font-extrabold mt-1.5', isSevere && 'text-red-600', isGreen && 'text-emerald-600', isAttention && 'text-amber-600', tone === 'grey' && 'text-slate-700')}>
        {currency} {Math.abs(balance || 0).toLocaleString()}
      </div>
      {isSevere && (
        <div className="mt-2 text-xs font-semibold bg-red-500/10 rounded-lg px-3 py-2">
          <WarningIcon size={13} /> You are more than {currency} 2,000 in debt. Hand cash to Admin today.
        </div>
      )}
      {isGreen && (
        <div className="mt-2 text-xs text-emerald-600 font-medium">
          The house owes you.
        </div>
      )}
    </div>
  )
}
