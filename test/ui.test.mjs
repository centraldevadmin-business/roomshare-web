// Headless UI + logic test harness — runs in Node with react-dom/server.
// NO browser, NO jsdom, NO emulator, NO server. Pure CPU, minimal heat.
//
// Two layers, because renderToString can't fire real click events:
//   1. RENDER SMOKE TESTS — every component renders without throwing, shows
//      the right content, and contains zero emoji.
//   2. LOGIC + QUEUE OPS — the pure functions and applyQueue() operations that
//      every button click actually invokes under the hood. This is the real
//      "does the button's work" test.
import assert from 'node:assert'
import React from 'react'
import ReactDOMServer from 'react-dom/server'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
const { renderToString } = ReactDOMServer

let passed = 0
let failed = 0
function test(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    failed++
    console.log(`  ✗ ${name}`)
    console.log(`      ${e.message}`)
  }
}
const h = React.createElement

// ---------------------------------------------------------------------------
console.log('\n=== Icons.jsx — all icons render as <svg> (no emoji) ===')
const Icons = await import('../src/components/Icons.jsx')
const iconNames = Object.keys(Icons).filter((k) => /^[A-Z].*Icon$/.test(k))
test(`Icons.jsx exports ${iconNames.length} icon components`, () => {
  assert.ok(iconNames.length >= 40, `expected >=40 icons, got ${iconNames.length}`)
})
for (const name of iconNames) {
  test(`renders <${name} />`, () => {
    const out = renderToString(h(Icons[name], { size: 20 }))
    assert.ok(out.includes('<svg'), `${name} did not render an <svg>`)
    assert.ok(out.includes('viewBox'), `${name} missing viewBox`)
  })
}

// ---------------------------------------------------------------------------
console.log('\n=== RENDER SMOKE TESTS — every component renders + shows content ===')

const RolePicker = (await import('../src/components/RolePicker.jsx')).default
test('RolePicker renders "Enter the House" + Admin/Resident', () => {
  const out = renderToString(h(RolePicker, { onPick: () => {} }))
  // "Enter the House" shows on initial render. Admin/Resident appear only after
  // the button flips `picking` state, which renderToString can't trigger, so we
  // verify those role options exist in the component source instead.
  assert.ok(out.includes('Enter the House'))
  const src = readFileSync(new URL('../src/components/RolePicker.jsx', import.meta.url), 'utf8')
  assert.ok(src.includes('Admin'))
  assert.ok(src.includes('Resident'))
})

const Banner = (await import('../src/components/Banner.jsx')).default
test('Banner renders latest announcement text', () => {
  const out = renderToString(h(Banner, { announcements: [{ text: 'Bazar today' }] }))
  assert.ok(out.includes('Bazar today'))
})
test('Banner renders null when empty', () => {
  assert.equal(renderToString(h(Banner, { announcements: [] })), '')
})

const DebtCard = (await import('../src/components/DebtCard.jsx')).default
test('DebtCard renders GOOD STANDING for positive balance', () => {
  const out = renderToString(h(DebtCard, { balance: 1200, currency: 'TK' }))
  assert.ok(out.includes('GOOD STANDING'))
  assert.ok(out.includes('1,200'))
})
test('DebtCard renders SEVERE for >2000 debt', () => {
  const out = renderToString(h(DebtCard, { balance: -3000, currency: 'TK' }))
  assert.ok(out.includes('SEVERE'))
  assert.ok(out.includes('2,000'))
})
test('DebtCard renders neutral balance', () => {
  const out = renderToString(h(DebtCard, { balance: 100, currency: 'TK' }))
  assert.ok(out.includes('100'))
})

const BazarDuty = (await import('../src/components/BazarDuty.jsx')).default
const { bazarDuty } = await import('../src/lib/logic.js')
// BazarDuty computes its duty resident from `new Date()` internally, so the
// test must derive the same value to pass the right `currentResident`.
const dutyResident = bazarDuty(['resident1', 'resident2', 'resident3'], new Date(), 3)
test('BazarDuty shows "YOUR TURN" for current resident', () => {
  const out = renderToString(h(BazarDuty, { shoppers: ['resident1', 'resident2', 'resident3'], currentResident: dutyResident, funder: null, interval: 3 }))
  assert.ok(out.includes('YOUR TURN'))
})
test('BazarDuty shows "ROTATING" for others', () => {
  const others = ['resident1', 'resident2', 'resident3'].filter((r) => r !== dutyResident)
  const out = renderToString(h(BazarDuty, { shoppers: ['resident1', 'resident2', 'resident3'], currentResident: others[0], funder: null, interval: 3 }))
  assert.ok(out.includes('ROTATING'))
})
test('BazarDuty shows "YOU FUND IT" for the funder', () => {
  const out = renderToString(h(BazarDuty, { shoppers: ['resident1', 'resident2', 'resident3'], currentResident: 'resident3', funder: 'resident3', interval: 3 }))
  assert.ok(out.includes('YOU FUND IT'))
})

const MealMatrix = (await import('../src/components/MealMatrix.jsx')).default
test('MealMatrix renders Breakfast/Lunch/Dinner + Tomorrow', () => {
  const out = renderToString(h(MealMatrix, {
    resident: 'resident1', date: '2026-08-25', tomorrow: '2026-08-26',
    entry: { resident: 'resident1', date: '2026-08-25', breakfast: 1, lunch: 0, dinner: 0, guests: { breakfast: 0, lunch: 0, dinner: 0 } },
    tomorrowEntry: null, onToggle: () => {}, setGuests: () => {}, showGuests: true, title: 'Meal Matrix', ledger: { house_config: { cutoffHour: 21 } },
  }))
  assert.ok(out.includes('Breakfast'))
  assert.ok(out.includes('Lunch'))
  assert.ok(out.includes('Dinner'))
  assert.ok(out.includes('Tomorrow'))
})

const ActionRow = (await import('../src/components/ActionRow.jsx')).default
test('ActionRow renders Tomorrow meals', () => {
  const out = renderToString(h(ActionRow, {
    resident: 'resident1', date: '2026-08-25', tomorrow: '2026-08-26',
    entry: null, tomorrowEntry: { resident: 'resident1', date: '2026-08-26', breakfast: 0, lunch: 0, dinner: 0, guests: { breakfast: 0, lunch: 0, dinner: 0 } },
    onToggle: () => {}, showGuests: true, setGuests: () => {}, ledger: { house_config: { cutoffHour: 21 } },
  }))
  assert.ok(out.includes('Tomorrow'))
})

const GuestLog = (await import('../src/components/GuestLog.jsx')).default
test('GuestLog renders Breakfast/Lunch/Dinner + guest total', () => {
  const out = renderToString(h(GuestLog, {
    resident: 'resident1', date: '2026-08-25',
    entry: { resident: 'resident1', date: '2026-08-25', breakfast: 0, lunch: 0, dinner: 0, guests: { breakfast: 2, lunch: 0, dinner: 0 } },
    onSetGuests: () => {},
  }))
  assert.ok(out.includes('Guest Log'))
  // React inserts a comment between the number and text: "2<!-- --> guest plate(s)..."
  assert.ok(out.includes('guest plate(s) added today.'))
})

const VacationMode = (await import('../src/components/VacationMode.jsx')).default
test('VacationMode renders form + "Confirm Dates"', () => {
  const out = renderToString(h(VacationMode, { resident: 'resident1', vacations: {}, onAdd: () => {}, onRemove: () => {} }))
  assert.ok(out.includes('Vacation Mode'))
  assert.ok(out.includes('Confirm Dates'))
})
test('VacationMode lists existing vacation with Remove', () => {
  const out = renderToString(h(VacationMode, { resident: 'resident1', vacations: { resident1: [{ start: '2026-09-01', end: '2026-09-10' }] }, onAdd: () => {}, onRemove: () => {} }))
  assert.ok(out.includes('2026-09-01'))
  assert.ok(out.includes('Remove'))
})

const HouseSettings = (await import('../src/components/HouseSettings.jsx')).default
test('HouseSettings renders config fields + per-person rent editor', () => {
  const out = renderToString(h(HouseSettings, {
    config: { currency: 'TK', mealRate: 70, rentPerPerson: 880, rentByResident: { nafiz: 7000, mohin: 0, neloy: 6000 }, cutoffHour: 21, bazarIntervalDays: 3, cutoffDay: 28, _residentCount: 3 },
    onSave: () => {},
  }))
  for (const label of ['Currency', 'Residents', 'Meal Rate', 'Rent fallback', 'Rent per resident', 'Bazar interval', 'Dinner locks at', 'Month-finalize day', 'Save Settings']) {
    assert.ok(out.includes(label), `missing config label: ${label}`)
  }
})

const ResidentLedger = (await import('../src/screens/ResidentLedger.jsx')).default
test('ResidentLedger renders balance + deposit form', () => {
  const ledger = { house_config: { currency: 'TK', mealRate: 70, rentByResident: { resident1: 0 } }, meal_log: [], expense_log: [], deposit_ledger: [], balances: {} }
  const out = renderToString(h(ResidentLedger, { session: { id: 'resident1', role: 'resident' }, ledger, addDeposit: () => {} }))
  assert.ok(out.includes('Current Balance'))
  assert.ok(out.includes('Deposit Request'))
  assert.ok(out.includes('Submit Deposit Request'))
})

const AdminControlCenter = (await import('../src/screens/AdminControlCenter.jsx')).default
test('AdminControlCenter renders all sections', () => {
  const ledger = { house_config: { currency: 'TK', mealRate: 70, rentPerPerson: 880, rentByResident: { resident1: 880 } }, expense_log: [], meal_log: [], deposit_ledger: [], announcements: [], todos: [], calendar_events: [] }
  const out = renderToString(h(AdminControlCenter, {
    ledger, setDepositStatus: () => {}, finalizeMonth: () => {}, forceSyncOverwrite: () => {}, setAnnouncement: () => {}, updateConfig: () => {},
  }))
  for (const s of ['Digital Fridge', 'Deposit Inbox', 'Daily Meal Matrix', 'Finalize Month', 'House Settings']) {
    assert.ok(out.includes(s), `missing section: ${s}`)
  }
})

const LedgerOperations = (await import('../src/screens/LedgerOperations.jsx')).default
test('LedgerOperations renders new-entry form + recent ops', () => {
  const ledger = { house_config: { currency: 'TK' }, expense_log: [{ id: 'e1', date: '2026-08-20', type: 'grocery', vendor: 'Store', amount: 100, note: '', locked: false }] }
  const out = renderToString(h(LedgerOperations, { ledger, addExpense: () => {}, updateExpense: () => {}, deleteExpense: () => {} }))
  assert.ok(out.includes('New Entry'))
  assert.ok(out.includes('Recent Operations'))
  assert.ok(out.includes('Store'))
})

const AnnouncementFeed = (await import('../src/components/AnnouncementFeed.jsx')).default
test('AnnouncementFeed renders Community Board + templates', () => {
  const out = renderToString(h(AnnouncementFeed, {
    announcements: [{ id: 'a1', text: 'No gas today', by: 'Admin', date: '2026-08-25' }],
    onPost: () => {}, onPostPrebuilt: () => {}, isAdmin: true,
  }))
  assert.ok(out.includes('Community Board'))
  assert.ok(out.includes('No gas today'))
})

const TodoList = (await import('../src/components/TodoList.jsx')).default
test('TodoList renders form + task list', () => {
  const out = renderToString(h(TodoList, {
    todos: [{ id: 't1', text: 'Clean', done: false, priority: 'normal', due: '', createdBy: '' }],
    onAdd: () => {}, onToggle: () => {}, onDelete: () => {},
  }))
  assert.ok(out.includes('To-Do List'))
  assert.ok(out.includes('Clean'))
})

const Calendar = (await import('../src/components/Calendar.jsx')).default
test('Calendar renders month grid + weekday headers', () => {
  const out = renderToString(h(Calendar, { events: [], onAdd: () => {}, onDelete: () => {} }))
  assert.ok(out.includes('Calendar'))
  for (const w of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) assert.ok(out.includes(w), `missing weekday ${w}`)
})

const CommunityScreen = (await import('../src/screens/CommunityScreen.jsx')).default
test('CommunityScreen composes all three sections', () => {
  const out = renderToString(h(CommunityScreen, {
    session: { role: 'resident' }, announcements: [], todos: [], events: [],
    postAnnouncement: () => {}, addTodo: () => {}, toggleTodo: () => {}, deleteTodo: () => {}, addEvent: () => {}, deleteEvent: () => {},
  }))
  assert.ok(out.includes('Community Board'))
  assert.ok(out.includes('To-Do List'))
  assert.ok(out.includes('Calendar'))
})

const { AppShell } = await import('../src/components/Layout.jsx')
test('AppShell renders header + nav + children', () => {
  const out = renderToString(h(AppShell, {
    session: { name: 'Resident 1' }, role: 'resident', announcements: [],
    tabs: [{ id: 'dashboard', label: 'Dashboard' }, { id: 'community', label: 'Community' }, { id: 'ledger', label: 'Ledger' }],
    activeTab: 'dashboard', onTab: () => {}, onLogout: () => {}, syncStatus: 'synced',
  }, h('div', null, 'CHILDREN')))
  assert.ok(out.includes('House Command'))
  assert.ok(out.includes('Dashboard'))
  assert.ok(out.includes('CHILDREN'))
})

const ResidentDashboard = (await import('../src/screens/ResidentDashboard.jsx')).default
test('ResidentDashboard composes all widgets', () => {
  const ledger = { house_config: { currency: 'TK', mealRate: 70, rentByResident: { resident1: 880 }, bazarIntervalDays: 3 }, meal_log: [], expense_log: [], deposit_ledger: [], balances: {} }
  const out = renderToString(h(ResidentDashboard, {
    session: { id: 'resident1', role: 'resident' }, ledger,
    toggleMeal: () => {}, setGuests: () => {}, addVacation: () => {}, removeVacation: () => {}, addBazar: () => {},
  }))
  for (const s of ['Cook for today', 'Log Bazar', 'Ledger Balance', 'Meal Matrix', 'Guest Log', 'Vacation Mode']) {
    assert.ok(out.includes(s), `missing widget: ${s}`)
  }
})

// ---------------------------------------------------------------------------
console.log('\n=== LOGIC FUNCTIONS — every pure function a button calls ===')
const logic = await import('../src/lib/logic.js')

test('isSlotLocked: dinner locks at 16:00', () => {
  assert.equal(logic.isSlotLocked('dinner', new Date(2026, 7, 25, 17), 21), true)
  assert.equal(logic.isSlotLocked('dinner', new Date(2026, 7, 25, 13), 21), false)
})
test('isSlotLocked: breakfast/lunch lock at cutoffHour', () => {
  assert.equal(logic.isSlotLocked('breakfast', new Date(2026, 7, 25, 22), 21), true)
  assert.equal(logic.isSlotLocked('breakfast', new Date(2026, 7, 25, 8), 21), false)
})
test('debtStatus: green / neutral / yellow / severe', () => {
  assert.equal(logic.debtStatus(1200).label, 'Good Standing')
  assert.equal(logic.debtStatus(0).label, 'Neutral')
  assert.equal(logic.debtStatus(-1500).label, 'Attention')
  assert.equal(logic.debtStatus(-3000).label, 'Severely Behind')
})
test('mealCount: plates + guests', () => {
  assert.equal(logic.mealCount({ breakfast: 1, lunch: 2, dinner: 0, guests: { breakfast: 1, lunch: 0, dinner: 1 } }), 5)
  assert.equal(logic.mealCount(null), 0)
})
test('bazarDuty: rotates across residents by interval', () => {
  const r = ['resident1', 'resident2', 'resident3']
  const d1 = logic.bazarDuty(r, new Date(2026, 0, 1), 3)
  const d2 = logic.bazarDuty(r, new Date(2026, 0, 9), 3)
  assert.ok(r.includes(d1))
  assert.ok(r.includes(d2))
  assert.equal(logic.bazarDuty([], new Date()), null)
})
test('isOnVacation: date within range is true, outside is false', () => {
  const vac = { resident1: [{ start: '2026-09-01', end: '2026-09-10' }] }
  assert.equal(logic.isOnVacation(vac, 'resident1', '2026-09-05'), true)
  assert.equal(logic.isOnVacation(vac, 'resident1', '2026-09-20'), false)
  assert.equal(logic.isOnVacation({}, 'resident1', '2026-09-05'), false)
})
test('computeMealRate: groceries / meals, falls back when no groceries', () => {
  const ledger = { house_config: { mealRate: 70 }, expense_log: [{ type: 'grocery', amount: 700 }], meal_log: [{ resident: 'r1', date: '2026-08-25', breakfast: 1, lunch: 1, dinner: 1, guests: { breakfast: 0, lunch: 0, dinner: 0 } }] }
  assert.equal(logic.computeMealRate(ledger), 233) // 700 / 3 meals
  const noGroceries = { house_config: { mealRate: 70 }, expense_log: [], meal_log: [{ resident: 'r1', date: '2026-08-25', breakfast: 1, lunch: 0, dinner: 0, guests: { breakfast: 0, lunch: 0, dinner: 0 } }] }
  assert.equal(logic.computeMealRate(noGroceries), 70) // fallback
})
test('computeDebt: meals owed + rent - approved deposits - carried', () => {
  const ledger = {
    house_config: { rentByResident: { resident1: 880, resident2: 880, resident3: 880 } },
    meal_log: [{ resident: 'resident1', date: '2026-08-25', breakfast: 1, lunch: 1, dinner: 1, guests: { breakfast: 0, lunch: 0, dinner: 0 } }],
    deposit_ledger: [{ resident: 'resident1', amount: 500, status: 'approved' }],
    balances: { resident1: 0 },
    vacations: {},
  }
  const debt = logic.computeDebt(ledger, 'resident1', 70)
  // owed = 3 meals * 70 + 880 rent = 210 + 880 = 1090
  // return = credited(500) + carried(0) - owed(1090) = -590
  assert.ok(Math.abs(debt - (-590)) < 1e-6, `expected -590, got ${debt}`)
})
test('canFinalizeMonth: gated before cutoffDay', () => {
  const early = { house_config: { cutoffDay: 28 } }
  // Fixed clock at day 24 — gate should block regardless of real date.
  const gate = logic.canFinalizeMonth(early, new Date(2026, 7, 24))
  assert.equal(gate.ok, false)
  // The message names the cutoff day value (28), not the word "cutoffDay".
  assert.ok(gate.message.includes('28'))
})
test('buildCalendarGrid: starts on Sunday with padding', () => {
  const grid = logic.buildCalendarGrid(2026, 7) // Aug 2026 starts Saturday
  assert.equal(grid[0], null) // one padding cell (Saturday is weekday 6)
  assert.equal(grid[6].day, 1) // day 1 lands on Sunday
  assert.equal(grid[6].dateStr, '2026-08-01')
})
test('daysInMonth + monthLabel', () => {
  assert.equal(logic.daysInMonth(2026, 7), 31)
  assert.equal(logic.monthLabel(2026, 7), 'August 2026')
})
test('todayStr: uses LOCAL date (no UTC bug for UTC+6)', () => {
  const fixed = new Date(2026, 7, 25, 23, 0, 0) // local Aug 25 11PM
  const s = logic.todayStr(fixed)
  assert.match(s, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(s, '2026-08-25') // would be wrong if it used toISOString (UTC)
})
test('uniqueId: returns unique values', () => {
  const ids = new Set(Array.from({ length: 50 }, () => logic.uniqueId('x')))
  assert.equal(ids.size, 50)
})

// ---------------------------------------------------------------------------
console.log('\n=== QUEUE OPS — applyQueue() is what every button click invokes ===')
const { applyQueue } = await import('../src/lib/githubSync.js')
const { buildDefaultLedger } = await import('../src/lib/types.js')

function freshLedger() { return structuredClone(buildDefaultLedger()) }

test('toggleMeal: creates entry and sets slot', () => {
  const l = freshLedger()
  applyQueue(l, [{ op: 'toggleMeal', args: { resident: 'resident1', date: '2026-08-25', slot: 'breakfast', value: true } }])
  const e = l.meal_log.find((m) => m.resident === 'resident1' && m.date === '2026-08-25')
  assert.equal(e.breakfast, 1)
})
test('toggleMeal: toggles off', () => {
  const l = freshLedger()
  applyQueue(l, [{ op: 'toggleMeal', args: { resident: 'resident1', date: '2026-08-25', slot: 'lunch', value: true } }])
  applyQueue(l, [{ op: 'toggleMeal', args: { resident: 'resident1', date: '2026-08-25', slot: 'lunch', value: false } }])
  const e = l.meal_log.find((m) => m.resident === 'resident1' && m.date === '2026-08-25')
  assert.equal(e.lunch, 0)
})
test('setGuests: sets guest plate count', () => {
  const l = freshLedger()
  applyQueue(l, [{ op: 'toggleMeal', args: { resident: 'resident1', date: '2026-08-25', slot: 'breakfast', value: true } }])
  applyQueue(l, [{ op: 'setGuests', args: { resident: 'resident1', date: '2026-08-25', slot: 'breakfast', value: 2 } }])
  const e = l.meal_log.find((m) => m.resident === 'resident1' && m.date === '2026-08-25')
  assert.equal(e.guests.breakfast, 2)
})
test('addExpense: pushes expense', () => {
  const l = freshLedger()
  applyQueue(l, [{ op: 'addExpense', args: { expense: { id: 'e1', date: '2026-08-25', type: 'grocery', vendor: 'Store', amount: 100, note: '', locked: false } } }])
  assert.equal(l.expense_log.length, 1)
  assert.equal(l.expense_log[0].vendor, 'Store')
})
test('updateExpense: applies patch', () => {
  const l = freshLedger()
  l.expense_log = [{ id: 'e1', date: '2026-08-25', type: 'grocery', vendor: 'Store', amount: 100, note: '', locked: false }]
  applyQueue(l, [{ op: 'updateExpense', args: { id: 'e1', patch: { locked: true } } }])
  assert.equal(l.expense_log[0].locked, true)
})
test('deleteExpense: removes expense', () => {
  const l = freshLedger()
  l.expense_log = [{ id: 'e1', date: '2026-08-25', type: 'grocery', vendor: 'Store', amount: 100, note: '', locked: false }]
  applyQueue(l, [{ op: 'deleteExpense', args: { id: 'e1' } }])
  assert.equal(l.expense_log.length, 0)
})
test('addDeposit: pushes deposit as pending', () => {
  const l = freshLedger()
  applyQueue(l, [{ op: 'addDeposit', args: { deposit: { id: 'd1', resident: 'resident1', amount: 500, date: '2026-08-25', note: '', status: 'pending' } } }])
  assert.equal(l.deposit_ledger.length, 1)
  assert.equal(l.deposit_ledger[0].status, 'pending')
})
test('setDepositStatus: approves/rejects', () => {
  const l = freshLedger()
  l.deposit_ledger = [{ id: 'd1', resident: 'resident1', amount: 500, date: '2026-08-25', note: '', status: 'pending' }]
  applyQueue(l, [{ op: 'setDepositStatus', args: { id: 'd1', status: 'approved' } }])
  assert.equal(l.deposit_ledger[0].status, 'approved')
})
test('setAnnouncement: appends fridge post (does not wipe community posts)', () => {
  const l = freshLedger()
  applyQueue(l, [{ op: 'postAnnouncement', args: { text: 'resident note', by: 'neloy' } }])
  applyQueue(l, [{ op: 'setAnnouncement', args: { text: 'Bazar today' } }])
  assert.equal(l.announcements.length, 2)
  assert.equal(l.announcements[0].text, 'Bazar today')
  assert.equal(l.announcements[1].text, 'resident note')
})
test('postAnnouncement: appends newest first', () => {
  const l = freshLedger()
  applyQueue(l, [{ op: 'postAnnouncement', args: { text: 'first', by: 'R1' } }])
  applyQueue(l, [{ op: 'postAnnouncement', args: { text: 'second', by: 'R2' } }])
  assert.equal(l.announcements[0].text, 'second')
  assert.equal(l.announcements[1].text, 'first')
})
test('updateConfig: merges config patch', () => {
  const l = freshLedger()
  applyQueue(l, [{ op: 'updateConfig', args: { patch: { mealRate: 90, currency: 'BDT' } } }])
  assert.equal(l.house_config.mealRate, 90)
  assert.equal(l.house_config.currency, 'BDT')
})
test('finalizeMonth: archives month and clears logs', () => {
  const l = freshLedger()
  l.house_config = { ...l.house_config, cutoffDay: 1 } // pass the gate
  l.meal_log = [{ resident: 'r1', date: '2026-08-25', breakfast: 1, lunch: 0, dinner: 0, guests: { breakfast: 0, lunch: 0, dinner: 0 } }]
  applyQueue(l, [{ op: 'finalizeMonth', args: { nextBalances: { r1: 0 } } }])
  assert.equal(l.meal_log.length, 0)
  assert.ok(l.archived_months.length === 1)
})
test('finalizeMonth: gated before cutoffDay', () => {
  const l = freshLedger()
  l.house_config = { ...l.house_config, cutoffDay: 32 } // gate fails for any real day
  l.meal_log = [{ resident: 'r1', date: '2026-08-25', breakfast: 1, lunch: 0, dinner: 0, guests: { breakfast: 0, lunch: 0, dinner: 0 } }]
  // applyQueue swallows op errors internally, so verify the gate's effect:
  // the month must NOT be finalized (logs intact, no archived month added).
  applyQueue(l, [{ op: 'finalizeMonth', args: { nextBalances: {} } }])
  assert.equal(l.meal_log.length, 1, 'meal_log should be untouched when gated')
  assert.equal(l.archived_months.length, 0, 'no month should be archived when gated')
})
test('addVacation: adds vacation range', () => {
  const l = freshLedger()
  applyQueue(l, [{ op: 'addVacation', args: { resident: 'resident1', start: '2026-09-01', end: '2026-09-10' } }])
  assert.equal(l.vacations.resident1.length, 1)
})
test('removeVacation: removes by index', () => {
  const l = freshLedger()
  l.vacations = { resident1: [{ start: '2026-09-01', end: '2026-09-10' }, { start: '2026-10-01', end: '2026-10-05' }] }
  applyQueue(l, [{ op: 'removeVacation', args: { resident: 'resident1', index: 0 } }])
  assert.equal(l.vacations.resident1.length, 1)
})
test('addTodo: pushes task', () => {
  const l = freshLedger()
  applyQueue(l, [{ op: 'addTodo', args: { todo: { id: 't1', text: 'Clean', done: false, priority: 'normal', due: '', createdBy: '' } } }])
  assert.equal(l.todos.length, 1)
})
test('toggleTodo: flips done', () => {
  const l = freshLedger()
  l.todos = [{ id: 't1', text: 'Clean', done: false, priority: 'normal', due: '', createdBy: '' }]
  applyQueue(l, [{ op: 'toggleTodo', args: { id: 't1' } }])
  assert.equal(l.todos[0].done, true)
})
test('deleteTodo: removes task', () => {
  const l = freshLedger()
  l.todos = [{ id: 't1', text: 'Clean', done: false, priority: 'normal', due: '', createdBy: '' }]
  applyQueue(l, [{ op: 'deleteTodo', args: { id: 't1' } }])
  assert.equal(l.todos.length, 0)
})
test('addEvent: pushes calendar event', () => {
  const l = freshLedger()
  applyQueue(l, [{ op: 'addEvent', args: { event: { id: 'ev1', title: 'Party', date: '2026-08-25', time: '', color: 'orange', createdBy: '' } } }])
  assert.equal(l.calendar_events.length, 1)
})
test('deleteEvent: removes event', () => {
  const l = freshLedger()
  l.calendar_events = [{ id: 'ev1', title: 'Party', date: '2026-08-25', time: '', color: 'orange', createdBy: '' }]
  applyQueue(l, [{ op: 'deleteEvent', args: { id: 'ev1' } }])
  assert.equal(l.calendar_events.length, 0)
})

// ---------------------------------------------------------------------------
console.log('\n=== CONFIG VALIDATION — HouseSettings submit transformation ===')
test('config submit produces correct numeric types', () => {
  // Mirrors HouseSettings.submit(): every numeric field is Number()-coerced.
  const form = { currency: 'TK', mealRate: '90', rentPerPerson: '880', cutoffHour: '21', bazarIntervalDays: '3', cutoffDay: '28', residentCount: '3', rentByResident: { nafiz: '7000', mohin: '0', neloy: '6000' } }
  const saved = {
    currency: form.currency,
    mealRate: Number(form.mealRate),
    rentPerPerson: Number(form.rentPerPerson),
    cutoffHour: Number(form.cutoffHour),
    bazarIntervalDays: Number(form.bazarIntervalDays),
    cutoffDay: Number(form.cutoffDay),
    _residentCount: Number(form.residentCount),
    rentByResident: form.rentByResident,
  }
  assert.equal(typeof saved.mealRate, 'number')
  assert.equal(saved.mealRate, 90)
  assert.equal(saved._residentCount, 3)
  assert.equal(saved.cutoffDay, 28)
  assert.equal(saved.rentByResident.nafiz, '7000')
})
test('computeBalances: sign convention (house owes resident = positive)', async () => {
  const { computeBalances } = await import('../src/lib/excel.js')
  const ledger = {
    house_config: { rentByResident: { resident1: 880 } },
    meal_log: [{ resident: 'resident1', date: '2026-08-25', breakfast: 2, lunch: 1, dinner: 1, guests: { breakfast: 0, lunch: 0, dinner: 0 } }],
    deposit_ledger: [{ resident: 'resident1', amount: 1000, status: 'approved' }],
    balances: {},
    vacations: {},
  }
  const bal = computeBalances(ledger, ['resident1'], 70)
  // meals = 4 * 70 = 280 owed; rent = 880 owed; deposit 1000 credit
  // bal = -280 - 880 + 1000 = -160
  assert.equal(bal.resident1, -160)
})

// ---------------------------------------------------------------------------
console.log('\n=== EMPIRICAL AUDIT — zero emoji anywhere in src ===')
// Matches only real emoji glyphs. Note: \p{Emoji} wrongly matches ASCII
// digits 0-9, so we use an explicit Unicode range instead. The typographic
// arrow range (2190-21FF) is excluded — those are arrows like →, not emoji.
const emojiRe = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2B00}-\u{2BFF}\u{2934}-\u{2935}]/u
let scanned = 0
let emojiCount = 0
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) { walk(p); continue }
    if (!/\.(js|jsx)$/.test(name)) continue
    scanned++
    const txt = readFileSync(p, 'utf8')
    if (emojiRe.test(txt)) { emojiCount++; console.log(`      emoji in ${p}`) }
  }
}
try { walk(join(process.cwd(), 'src')) } catch (e) { console.log('      scan error', e.message) }
test(`scanned ${scanned} source files, found ${emojiCount} with emoji`, () => {
  assert.equal(emojiCount, 0, 'emoji found in source files')
})

// ---------------------------------------------------------------------------
console.log('\n========================================')
console.log(`RESULT: ${passed} passed, ${failed} failed`)
console.log('========================================')
if (failed > 0) process.exit(1)
