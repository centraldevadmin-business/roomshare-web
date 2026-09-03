// Auto-Excel Engine. Runs client-side with SheetJS (xlsx).
// Generates a 3-tab .xlsx: Summary / Daily Ledger / Expense Log,
// then triggers a download + opens the native Share menu.

import * as XLSX from 'xlsx'
import { isOnVacation, computeMealRate, rentForResident, fixedCostShare, utilityShare } from './logic.js'
import { RESIDENT_IDS } from './users.js'

// Compute per-resident final balances for the summary tab.
//
// SIGN CONVENTION (canonical): positive = the house OWES the resident
// (good standing / credit). Negative = the resident OWES the house.
// This matches logic.computeDebt and the DebtCard UI. finalizeMonth stores
// this result into `balances`, so it MUST use the same convention — otherwise
// every month the sign flips and someone who owed money suddenly appears owed.
//
// The meal rate is the COMPUTED rate (groceries ÷ meals eaten), matching the
// on-screen debt. This keeps the Excel report consistent with what residents
// see; both fall back to config.mealRate when there's no grocery spend.
export function computeBalances(ledger, residents, mealRate = computeMealRate(ledger)) {
  const config = ledger.house_config || {}
  const { perPerson: fixedShare } = fixedCostShare(config, residents.length)
  const { perPerson: utilityShareAmt } = utilityShare(ledger, residents.length)

  const bal = { ...(ledger.balances || {}) }
  // Start from carried-over balances.
  for (const r of residents) bal[r] = bal[r] || 0

  // Meals charged to a resident (their own + guests they added) — they owe the
  // house, so this REDUCES their balance. Vacation dates are waived.
  for (const m of ledger.meal_log) {
    if (isOnVacation(ledger.vacations, m.resident, m.date)) continue
    const plates = (m.breakfast || 0) + (m.lunch || 0) + (m.dinner || 0)
    const guestPlates = (m.guests?.breakfast || 0) + (m.guests?.lunch || 0) + (m.guests?.dinner || 0)
    const total = (plates + guestPlates) * mealRate
    bal[m.resident] = (bal[m.resident] || 0) - total
  }

  // Rent (per-person) + fixed-cost share + utility share are obligations each
  // resident owes the house.
  for (const r of residents) {
    const rent = rentForResident(config, r)
    bal[r] = (bal[r] || 0) - (rent + fixedShare + utilityShareAmt)
  }

  // Deposits approved = money the resident already handed the admin (credit).
  for (const d of ledger.deposit_ledger) {
    if (d.status === 'approved') bal[d.resident] = (bal[d.resident] || 0) + d.amount
  }

  return bal
}

export function buildWorkbook(ledger, residents) {
  const mealRate = computeMealRate(ledger)
  const config = ledger.house_config || {}
  const rent = rentForResident(config, residents[0]) || 0
  const balances = computeBalances(ledger, residents, mealRate)

  const totalGroceries = ledger.expense_log
    .filter((e) => e.type === 'grocery')
    .reduce((s, e) => s + Number(e.amount || 0), 0)
  const totalUtilities = ledger.expense_log
    .filter((e) => e.type === 'utility')
    .reduce((s, e) => s + Number(e.amount || 0), 0)
  const totalDepositsApproved = ledger.deposit_ledger
    .filter((d) => d.status === 'approved')
    .reduce((s, d) => s + Number(d.amount || 0), 0)

  // ---- Tab 1: Summary ----
  const summary = [
    ['House Ledger — Monthly Summary'],
    ['Generated', new Date().toLocaleString()],
    [''],
    ['Metric', 'Amount'],
    ['Total Grocery Spend', totalGroceries],
    ['Total Utilities', totalUtilities],
    ['Total Approved Deposits', totalDepositsApproved],
    ['Meal Rate (per plate)', mealRate],
    ['Rent per person', rent],
    [''],
    ['Resident', 'Final Balance'],
    ...residents.map((r) => [r, balances[r] || 0]),
  ]

  // ---- Tab 2: Daily Ledger (who ate what every day) ----
  const days = collectDays(ledger.meal_log)
  const daily = [
    ['House Ledger — Daily Meal Ledger'],
    ['Resident', ...days],
    ...residents.map((r) => {
      const row = [r]
      for (const d of days) {
        const entry = ledger.meal_log.find((m) => m.resident === r && m.date === d)
        if (!entry) {
          row.push('')
          continue
        }
        const total = (entry.breakfast || 0) + (entry.lunch || 0) + (entry.dinner || 0)
        const guests = (entry.guests?.breakfast || 0) + (entry.guests?.lunch || 0) + (entry.guests?.dinner || 0)
        row.push(total + guests)
      }
      return row
    }),
  ]

  // ---- Tab 3: Expense Log ----
  const expense = [
    ['House Ledger — Expense & Deposit Log'],
    ['Type', 'Date', 'Vendor / Resident', 'Amount', 'Note', 'Status'],
    ...ledger.expense_log
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((e) => [
        e.type,
        e.date,
        e.vendor,
        e.amount,
        e.note || '',
        e.locked ? 'locked' : 'open',
      ]),
    [''],
    ['DEPOSITS'],
    ['Date', 'Resident', 'Amount', 'Note', 'Status'],
    ...ledger.deposit_ledger
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((d) => [d.date, d.resident, d.amount, d.note || '', d.status]),
  ]

  const ws1 = XLSX.utils.aoa_to_sheet(summary)
  const ws2 = XLSX.utils.aoa_to_sheet(daily)
  const ws3 = XLSX.utils.aoa_to_sheet(expense)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary')
  XLSX.utils.book_append_sheet(wb, ws2, 'Daily Ledger')
  XLSX.utils.book_append_sheet(wb, ws3, 'Expense Log')
  return wb
}

function collectDays(mealLog) {
  const set = new Set(mealLog.map((m) => m.date))
  return Array.from(set).sort()
}

// Download the workbook and try to open the native Share menu (Android).
export function exportAndShare(ledger, residents, filename) {
  const wb = buildWorkbook(ledger, residents)
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `house-ledger-${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)

  // Native share (works on Android mobile browsers / PWAs).
  if (navigator.canShare && navigator.canShare({ files: [new File([blob], a.download)] }) && navigator.share) {
    navigator.share({ files: [new File([blob], a.download)], title: 'House Ledger Report', url }).catch(() => {
      /* user cancelled share — download already happened */
    })
  }
  return url
}

// ---- Per-person Excel export ----
// Builds a workbook for ONE resident: their meals, their charges (rent, fixed
// costs, utilities), their deposits, and a final net balance. Everyone gets
// their own full breakdown — "mohin gets his, niloy gets his."
export function buildPersonWorkbook(ledger, resident, residents = RESIDENT_IDS) {
  const mealRate = computeMealRate(ledger)
  const config = ledger.house_config || {}
  const { perPerson: fixedShare } = fixedCostShare(config, residents.length)
  const { perPerson: utilityShareAmt } = utilityShare(ledger, residents.length)
  const rent = rentForResident(config, resident) || 0

  const bal = computeBalances(ledger, residents, mealRate)
  const myBalance = bal[resident] || 0

  // Meals this resident ate (own + guests), day by day.
  const myMeals = (ledger.meal_log || [])
    .filter((m) => m.resident === resident)
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  // Groceries this resident paid for at the bazar.
  const myGroceries = (ledger.expense_log || [])
    .filter((e) => e.type === 'grocery' && e.paid_by === resident)
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  // Approved deposits this resident made.
  const myDeposits = (ledger.deposit_ledger || [])
    .filter((d) => d.resident === resident && d.status === 'approved')
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  const totalMealCharge = myMeals.reduce((s, m) => {
    if (isOnVacation(ledger.vacations, resident, m.date)) return s
    const plates = (m.breakfast || 0) + (m.lunch || 0) + (m.dinner || 0)
    const guests = (m.guests?.breakfast || 0) + (m.guests?.lunch || 0) + (m.guests?.dinner || 0)
    return s + (plates + guests) * mealRate
  }, 0)

  const totalGrocerySpend = myGroceries.reduce((s, e) => s + Number(e.amount || 0), 0)
  const totalDeposit = myDeposits.reduce((s, d) => s + Number(d.amount || 0), 0)

  // ---- Tab 1: My Summary ----
  const summary = [
    ['House Ledger — My Report'],
    ['Resident', resident],
    ['Generated', new Date().toLocaleString()],
    [''],
    ['What I Ate (meals × rate)', `₹${totalMealCharge.toLocaleString()}`],
    ['Rent', rent === 0 ? 'FREE' : `₹${rent.toLocaleString()}`],
    ['Fixed cost share', `₹${fixedShare.toLocaleString()}`],
    ['Utility share', `₹${utilityShareAmt.toLocaleString()}`],
    ['Groceries I paid', `₹${totalGrocerySpend.toLocaleString()}`],
    ['Deposits I made', `₹${totalDeposit.toLocaleString()}`],
    [''],
    ['NET BALANCE', `₹${myBalance.toLocaleString()}`],
    [''],
    [myBalance >= 0 ? 'The house OWES you' : 'You OWE the house', `₹${Math.abs(myBalance).toLocaleString()}`],
  ]

  // ---- Tab 2: My Meals ----
  const meals = [
    ['My Meals — Day by Day'],
    ['Date', 'Breakfast', 'Lunch', 'Dinner', 'Guests', 'Total Plates', 'Charge'],
    ...myMeals.map((m) => {
      const plates = (m.breakfast || 0) + (m.lunch || 0) + (m.dinner || 0)
      const guests = (m.guests?.breakfast || 0) + (m.guests?.lunch || 0) + (m.guests?.dinner || 0)
      const waived = isOnVacation(ledger.vacations, resident, m.date)
      const charge = waived ? 0 : (plates + guests) * mealRate
      return [m.date, m.breakfast || 0, m.lunch || 0, m.dinner || 0, guests, plates + guests, waived ? 'WAIVED' : `₹${charge}`]
    }),
  ]

  // ---- Tab 3: My Expenses & Deposits ----
  const expenses = [
    ['My Expenses — Groceries Paid'],
    ['Date', 'Vendor', 'Amount', 'Note'],
    ...myGroceries.map((e) => [e.date, e.vendor, e.amount, e.note || '']),
    [''],
    ['My Deposits'],
    ['Date', 'Amount', 'Note', 'Status'],
    ...myDeposits.map((d) => [d.date, d.amount, d.note || '', d.status]),
  ]

  const ws1 = XLSX.utils.aoa_to_sheet(summary)
  const ws2 = XLSX.utils.aoa_to_sheet(meals)
  const ws3 = XLSX.utils.aoa_to_sheet(expenses)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws1, 'My Summary')
  XLSX.utils.book_append_sheet(wb, ws2, 'My Meals')
  XLSX.utils.book_append_sheet(wb, ws3, 'My Expenses')
  return wb
}

// Download a single resident's full breakdown.
export function exportPersonWorkbook(ledger, resident, residents = RESIDENT_IDS) {
  const wb = buildPersonWorkbook(ledger, resident, residents)
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `house-ledger-${resident}-${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)

  if (navigator.canShare && navigator.canShare({ files: [new File([blob], a.download)] }) && navigator.share) {
    navigator.share({ files: [new File([blob], a.download)], title: `My House Ledger Report`, url }).catch(() => {
      /* user cancelled share — download already happened */
    })
  }
  return url
}
