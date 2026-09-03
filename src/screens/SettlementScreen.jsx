import { useMemo } from 'react'
import { computeSettlement } from '../lib/logic'
import { RESIDENT_IDS } from '../lib/users'
import { WalletIcon, CartIcon, HomeIcon, ReceiptIcon, CheckIcon } from '../components/Icons'

// End-of-month settlement screen.
// Implements the house's real cash-split rules:
//   - Pool all grocery (bazar) spend, attributed to who paid.
//   - cost_per_meal = total groceries / total weighted meals (breakfast 0.5,
//     lunch 1, dinner 1).
//   - Each person's meal share = their weighted meals * cost_per_meal.
//   - surplus = spent at bazar − meal share. Positive surplus reduces rent,
//     then fixed costs; leftover surplus carries to next month.
//   - Rent: rent-free resident pays 0; others pay rentPerPerson.
//   - Fixed costs split equally across ALL residents.
//   - Final bill (netOwed) = rent + fixedCostShare − surplus, paid in cash.
export default function SettlementScreen({ ledger }) {
  const config = ledger.house_config
  const residents = RESIDENT_IDS
  const names = Object.fromEntries(residents.map((id) => [id, id]))

  const settlement = useMemo(
    () => computeSettlement(ledger, residents),
    [ledger]
  )

  const { costPerMeal, totalGroceries, totalWeightedMeals, totalUtilities, fixedCostShare, utilityShare, rentPerPerson, rentFreeResident, perPerson } = settlement

  const totalOwed = Object.values(perPerson).reduce((s, p) => s + p.netOwed, 0)

  return (
    <div className="space-y-4">
      {/* Header summary */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h3 className="font-bold text-lg mb-3 text-slate-800 flex items-center gap-2">
          <WalletIcon size={18} /> Monthly Settlement
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[11px] text-slate-400">Total Groceries</div>
            <div className="text-xl font-extrabold text-slate-800">{config.currency} {totalGroceries.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Cost / Meal</div>
            <div className="text-xl font-extrabold text-orange-600">{config.currency} {costPerMeal}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Total Weighted Meals</div>
            <div className="text-xl font-extrabold text-slate-800">{totalWeightedMeals}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Total Owed (Cash)</div>
            <div className="text-xl font-extrabold text-emerald-600">{config.currency} {Math.round(totalOwed).toLocaleString()}</div>
          </div>
        </div>
        <div className="mt-3 text-[10px] text-slate-400">
          Weights: breakfast 0.5 · lunch 1 · dinner 1. Surplus from overpaying at bazar deducts from rent, then fixed costs.
        </div>
      </div>

      {/* Per-person cards */}
      <div className="space-y-3">
        {residents.map((r) => {
          const p = perPerson[r]
          const isRentFree = r === rentFreeResident
          const owes = p.netOwed > 0
          return (
            <div key={r} className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{p.surplus >= 0 ? <CheckIcon size={18} className="text-emerald-500" /> : <WalletIcon size={18} className="text-red-400" />}</span>
                  <div>
                    <div className="font-semibold text-slate-800">{names[r] || r}</div>
                    <div className="text-[10px] text-slate-400">
                      {p.weightedMeals} weighted meals · paid {config.currency} {p.spentAtBazar.toLocaleString()} at bazar
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400">PAYS</div>
                  <div className={`text-lg font-extrabold ${owes ? 'text-red-600' : 'text-emerald-600'}`}>
                    {config.currency} {Math.round(Math.abs(p.netOwed)).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Breakdown */}
              <div className="border-t border-slate-100 pt-2 space-y-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span className="flex items-center gap-1"><CartIcon size={13} /> Meal share ({p.weightedMeals} × {costPerMeal})</span>
                  <span>{config.currency} {p.mealShare.toFixed(0)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="flex items-center gap-1"><ReceiptIcon size={13} /> Fixed costs ÷ {residents.length}</span>
                  <span>{config.currency} {p.fixedCostShare.toFixed(0)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="flex items-center gap-1"><ReceiptIcon size={13} /> Utilities (water, electricity) ÷ {residents.length}</span>
                  <span>{config.currency} {p.utilityShare.toFixed(0)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="flex items-center gap-1"><HomeIcon size={13} /> Rent</span>
                  <span>{p.rent === 0 ? 'FREE' : `${config.currency} ${p.rent.toFixed(0)}`}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Meal surplus (paid more than ate)</span>
                  <span className={p.surplus >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                    {p.surplus >= 0 ? `− ${config.currency} ${Math.round(p.surplus)}` : `+ ${config.currency} ${Math.round(Math.abs(p.surplus))}`}
                  </span>
                </div>
                {p.carriedForward > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Carried to next month</span>
                    <span>{config.currency} {Math.round(p.carriedForward)}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Fixed costs list */}
      {config.fixedCosts && config.fixedCosts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <h4 className="font-semibold text-sm text-slate-700 mb-2 flex items-center gap-2"><ReceiptIcon size={15} /> Fixed Costs (split ÷ {residents.length})</h4>
          <div className="space-y-1 text-xs text-slate-600">
            {config.fixedCosts.map((c, i) => (
              <div key={i} className="flex justify-between">
                <span>{c.name}</span>
                <span>{config.currency} {Number(c.total).toLocaleString()} ({config.currency} {(Number(c.total) / residents.length).toFixed(0)}/person)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Utilities list — variable, logged as utility expenses */}
      {totalUtilities > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <h4 className="font-semibold text-sm text-slate-700 mb-2 flex items-center gap-2"><ReceiptIcon size={15} /> Utilities (water, electricity) — split ÷ {residents.length}</h4>
          <div className="space-y-1 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Total utilities this month</span>
              <span>{config.currency} {totalUtilities.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Per person (÷ {residents.length})</span>
              <span>{config.currency} {utilityShare.toFixed(0)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
