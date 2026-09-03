import { useMemo } from 'react'
import MealMatrix from '../components/MealMatrix'
import DebtCard from '../components/DebtCard'
import BazarLog from '../components/BazarLog'
import HeadCountCard from '../components/HeadCountCard'
import GuestLog from '../components/GuestLog'
import VacationMode from '../components/VacationMode'
import { todayStr, uniqueId, headCountForDate, computeMealRate, computeDebt } from '../lib/logic'
import { RESIDENT_IDS } from '../lib/users'

// Section: Resident Dashboard.
// Head Count (cook for N) + Bazar Log + Meal Matrix + Debt Visualizer +
// Guest Log + Vacation Mode.
export default function ResidentDashboard({
  session,
  ledger,
  toggleMeal,
  setAllMeals,
  setGuests,
  addVacation,
  removeVacation,
  addBazar,
}) {
  const residents = RESIDENT_IDS
  const config = ledger.house_config
  const today = todayStr()
  const tomorrow = todayStr(new Date(Date.now() + 86400000))

  const entry = ledger.meal_log.find((m) => m.resident === session.id && m.date === today)
  const tomorrowEntry = ledger.meal_log.find((m) => m.resident === session.id && m.date === tomorrow)

  // Computed meal rate: groceries ÷ total meals eaten across the house.
  const mealRate = useMemo(() => computeMealRate(ledger), [ledger])

  // Personal balance: meals owed + fixed-bill share − approved deposits.
  const balance = useMemo(() => computeDebt(ledger, session.id, mealRate), [ledger, session.id, mealRate])

  // Head count for today — rolls up every resident's meals (plates + guests).
  const { peopleEating, perMeal, totalPlates } = useMemo(
    () => headCountForDate(ledger.meal_log, residents, today),
    [ledger.meal_log, residents, today]
  )

  // Recent grocery expenses (newest first) for the "just logged" confirmation.
  const recentGroceries = useMemo(
    () => (ledger.expense_log || [])
      .filter((e) => e.type === 'grocery')
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 3),
    [ledger.expense_log]
  )

  const logBazar = (lineItems, total) => {
    addBazar({
      id: uniqueId('exp'),
      date: today,
      type: 'grocery',
      vendor: 'Bazar',
      amount: total,
      note: lineItems.map((it) => `${it.item} (${it.price})`).join(', '),
      paid_by: session.id,
      locked: false,
    })
  }

  return (
    <div className="space-y-3">
      {/* The one number everyone looks at when they open the app */}
      <HeadCountCard
        peopleEating={peopleEating}
        perMeal={perMeal}
        totalPlates={totalPlates}
      />

      <BazarLog onLogBazar={logBazar} resident={session.id} recent={recentGroceries} />

      <DebtCard balance={balance} currency={config.currency} />

      <MealMatrix
        resident={session.id}
        date={today}
        tomorrow={tomorrow}
        entry={entry}
        tomorrowEntry={tomorrowEntry}
        onToggle={toggleMeal}
        setAllMeals={setAllMeals}
        setGuests={setGuests}
        showGuests={true}
        title="Meal Matrix"
        ledger={ledger}
      />

      <GuestLog
        resident={session.id}
        date={today}
        entry={entry}
        onSetGuests={setGuests}
      />

      <VacationMode
        resident={session.id}
        vacations={ledger.vacations}
        onAdd={addVacation}
        onRemove={removeVacation}
      />
    </div>
  )
}
