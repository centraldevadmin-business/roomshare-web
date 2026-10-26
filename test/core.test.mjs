// Core logic test harness — runs in Node, no browser needed.
// Tests the pure functions that don't depend on GitHub/network.
import assert from 'node:assert'

let passed = 0
let failed = 0
// AWAIT the test body: several tests are async (crypto.subtle). The old
// harness never awaited, so async failures were silently swallowed and
// counted as passes.
async function test(name, fn) {
  try {
    await fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    failed++
    console.log(`  ✗ ${name}`)
    console.log(`      ${e.message}`)
  }
}

console.log('\n=== users.js ===')
const { USERS, RESIDENT_IDS, seedUsers, activeResidentIds } = await import('../src/lib/users.js')

await test('RESIDENT_IDS has 3 ids', () => {
  assert.equal(RESIDENT_IDS.length, 3)
  assert.ok(RESIDENT_IDS.includes('neloy'))
  assert.ok(RESIDENT_IDS.includes('nafiz'))
  assert.ok(RESIDENT_IDS.includes('mohin'))
})
await test('USERS has the three house accounts', () => {
  const names = USERS.map((u) => u.name)
  assert.ok(names.includes('Nafiz'))
  assert.ok(names.includes('Mohin'))
  assert.ok(names.includes('Neloy'))
})
await test('seedUsers returns a deep clone (mutating it never touches the template)', () => {
  const a = seedUsers()
  a[0].name = 'HACKED'
  a.push({ id: 'extra' })
  const b = seedUsers()
  assert.equal(b[0].name, 'Nafiz')
  assert.equal(b.length, 3)
})
await test('activeResidentIds falls back to the 3 seeded ids without a users node', () => {
  assert.deepEqual(activeResidentIds({}), RESIDENT_IDS)
  assert.deepEqual(activeResidentIds(null), RESIDENT_IDS)
})
await test('activeResidentIds derives members from the ledger users node', () => {
  const l = {
    users: [
      { id: 'nafiz', active: true, role: 'admin' },
      { id: 'neloy', active: true, role: 'resident' },
      { id: 'newbie', active: true, role: 'resident' },
      { id: 'ghost', active: false, role: 'resident' }, // deactivated
      { id: 'watcher', active: true, role: 'viewer' },  // read-only, does not eat
    ],
  }
  assert.deepEqual(activeResidentIds(l), ['nafiz', 'neloy', 'newbie'])
})

console.log('\n=== logic.js ===')
const {
  isSlotLocked,
  debtStatus,
  bazarDuty,
  isOnVacation,
  mealCount,
  computeMealRate,
  computeDebt,
  todayStr,
  daysInMonth,
  monthLabel,
  uniqueId,
  canFinalizeMonth,
  buildCalendarGrid,
  eventsOnDate,
} = await import('../src/lib/logic.js')

await test('isSlotLocked: breakfast locked after 9pm', () => {
  const late = new Date(2026, 7, 23, 21, 30)
  assert.equal(isSlotLocked('breakfast', late), true)
})
await test('isSlotLocked: lunch locked after 9pm', () => {
  const late = new Date(2026, 7, 23, 22, 0)
  assert.equal(isSlotLocked('lunch', late), true)
})
await test('isSlotLocked: dinner locked after 4pm', () => {
  const evening = new Date(2026, 7, 23, 21, 0)
  assert.equal(isSlotLocked('dinner', evening), true)
})
await test('isSlotLocked: dinner NOT locked before 4pm', () => {
  const afternoon = new Date(2026, 7, 23, 15, 0)
  assert.equal(isSlotLocked('dinner', afternoon), false)
})
await test('isSlotLocked: all open before 4pm', () => {
  const early = new Date(2026, 7, 23, 8, 0)
  assert.equal(isSlotLocked('breakfast', early), false)
  assert.equal(isSlotLocked('lunch', early), false)
  assert.equal(isSlotLocked('dinner', early), false)
})
await test('isSlotLocked: dinner locks at 4pm, breakfast/lunch at 9pm', () => {
  const evening = new Date(2026, 7, 23, 21, 0)
  assert.equal(isSlotLocked('breakfast', evening), true)
  assert.equal(isSlotLocked('lunch', evening), true)
  assert.equal(isSlotLocked('dinner', evening), true)
})
await test('debtStatus: green for +500+', () => {
  assert.equal(debtStatus(600).tone, 'green')
})
await test('debtStatus: grey for 0', () => {
  assert.equal(debtStatus(0).tone, 'grey')
})
await test('debtStatus: grey for -500 (neutral zone)', () => {
  assert.equal(debtStatus(-500).tone, 'grey')
})
await test('debtStatus: yellow for approaching -1000', () => {
  assert.equal(debtStatus(-1500).tone, 'yellow')
})
await test('debtStatus: flash-red for exceeding -2000', () => {
  assert.equal(debtStatus(-2500).tone, 'flash-red')
})
await test('debtStatus: flash-red shows severe label', () => {
  assert.equal(debtStatus(-2500).label, 'Severely Behind')
})
await test('debtStatus: yellow shows attention label', () => {
  assert.equal(debtStatus(-1500).label, 'Attention')
})
await test('bazarDuty: deterministic rotation', () => {
  const residents = ['resident1', 'resident2', 'resident3']
  const d1 = bazarDuty(residents, new Date(2026, 0, 1), 3)
  const d2 = bazarDuty(residents, new Date(2026, 0, 2), 3)
  const d3 = bazarDuty(residents, new Date(2026, 0, 3), 3)
  assert.ok(residents.includes(d1))
  assert.ok(residents.includes(d2))
  assert.ok(residents.includes(d3))
})
await test('bazarDuty: shifts every 3 days', () => {
  const residents = ['resident1', 'resident2', 'resident3']
  const day1 = bazarDuty(residents, new Date(2026, 0, 1), 3)
  const day4 = bazarDuty(residents, new Date(2026, 0, 4), 3)
  assert.notEqual(day1, day4)
})
await test('isOnVacation: within range returns true', () => {
  const vac = { resident1: [{ start: '2026-08-01', end: '2026-08-10' }] }
  assert.equal(isOnVacation(vac, 'resident1', '2026-08-05'), true)
})
await test('isOnVacation: outside range returns false', () => {
  const vac = { resident1: [{ start: '2026-08-01', end: '2026-08-10' }] }
  assert.equal(isOnVacation(vac, 'resident1', '2026-08-20'), false)
})
await test('isOnVacation: other resident false', () => {
  const vac = { resident1: [{ start: '2026-08-01', end: '2026-08-10' }] }
  assert.equal(isOnVacation(vac, 'resident2', '2026-08-05'), false)
})
await test('mealCount: plates + guests', () => {
  const e = { breakfast: 1, lunch: 1, dinner: 0, guests: { breakfast: 1, lunch: 0, dinner: 2 } }
  assert.equal(mealCount(e), 5)
})
await test('mealCount: empty entry is 0', () => {
  assert.equal(mealCount(null), 0)
})
await test('todayStr: returns YYYY-MM-DD for given date', () => {
  const s = todayStr(new Date(2026, 7, 23))
  assert.equal(s, '2026-08-23')
})
await test('todayStr: defaults to current date', () => {
  const s = todayStr()
  assert.match(s, /^\d{4}-\d{2}-\d{2}$/)
})
await test('daysInMonth: August has 31', () => {
  assert.equal(daysInMonth(2026, 7), 31)
})
await test('daysInMonth: Feb 2026 has 28', () => {
  assert.equal(daysInMonth(2026, 1), 28)
})
await test('monthLabel: returns month name + year', () => {
  assert.equal(monthLabel(2026, 7), 'August 2026')
})

await test('computeMealRate: groceries ÷ total meals', () => {
  const ledger = {
    house_config: { mealRate: 70 },
    expense_log: [{ type: 'grocery', amount: 1000 }],
    meal_log: [
      { resident: 'resident1', breakfast: 1, lunch: 1, dinner: 1, guests: {} },
      { resident: 'resident2', breakfast: 1, lunch: 1, dinner: 1, guests: {} },
    ],
  }
  // 1000 groceries / 6 meals = 166.67 → rounds to 167
  assert.equal(computeMealRate(ledger), 167)
})
await test('computeMealRate: falls back to config when no meals', () => {
  const ledger = {
    house_config: { mealRate: 75 },
    expense_log: [{ type: 'grocery', amount: 500 }],
    meal_log: [],
  }
  assert.equal(computeMealRate(ledger), 75)
})
await test('computeMealRate: falls back to config when meals exist but no groceries', () => {
  // Regression: previously this computed 0/total = 0 (clamped to 1 TK). It
  // must fall back to the configured rate instead.
  const ledger = {
    house_config: { mealRate: 70 },
    expense_log: [],
    meal_log: [
      { resident: 'resident1', breakfast: 1, lunch: 1, dinner: 1, guests: {} },
      { resident: 'resident2', breakfast: 1, lunch: 1, dinner: 1, guests: {} },
    ],
  }
  assert.equal(computeMealRate(ledger), 70)
})
await test('computeDebt: meals owed subtracted from deposits', () => {
  const ledger = {
    house_config: { mealRate: 70, rentByResident: { resident1: 880, resident2: 880 }, _residentCount: 3 },
    meal_log: [
      { resident: 'resident1', breakfast: 1, lunch: 1, dinner: 1, guests: {} },
      { resident: 'resident2', breakfast: 0, lunch: 0, dinner: 0, guests: {} },
    ],
    deposit_ledger: [{ resident: 'resident1', amount: 500, status: 'approved' }],
    balances: {},
  }
  // resident1: 3*70=210 owed meals + 880 rent - 500 deposit = 590 owed
  assert.ok(Math.abs(computeDebt(ledger, 'resident1', 70) - (-590)) < 0.5)
})
await test('computeDebt: positive when house owes you', () => {
  const ledger = {
    house_config: { mealRate: 70, rentPerPerson: 0, internetPerPerson: 0, _residentCount: 3 },
    meal_log: [],
    deposit_ledger: [{ resident: 'resident1', amount: 1000, status: 'approved' }],
    balances: {},
  }
  assert.equal(computeDebt(ledger, 'resident1', 70), 1000)
})

console.log('\n=== types.js ===')
const { buildDefaultLedger, emptyMealEntry, emptyExpense, emptyDeposit } = await import('../src/lib/types.js')

await test('buildDefaultLedger: has 4 nodes', () => {
  const l = buildDefaultLedger()
  assert.ok(l.house_config)
  assert.ok(Array.isArray(l.meal_log))
  assert.ok(Array.isArray(l.expense_log))
  assert.ok(Array.isArray(l.deposit_ledger))
})
await test('buildDefaultLedger: meal_log is empty array', () => {
  const l = buildDefaultLedger()
  assert.equal(l.meal_log.length, 0)
})
await test('emptyMealEntry: correct shape', () => {
  const e = emptyMealEntry('resident1', '2026-08-23')
  assert.equal(e.resident, 'resident1')
  assert.equal(e.breakfast, 0)
  assert.equal(e.guests.lunch, 0)
})
await test('emptyExpense: has id + locked false', () => {
  const e = emptyExpense('x1', '2026-08-23')
  assert.equal(e.id, 'x1')
  assert.equal(e.locked, false)
})
await test('emptyDeposit: status pending', () => {
  const d = emptyDeposit('d1', 'resident1')
  assert.equal(d.status, 'pending')
})

console.log('\n=== excel.js (computeBalances) ===')
const { computeBalances, buildWorkbook } = await import('../src/lib/excel.js')

await test('computeBalances: meals + rent - deposits (positive = house owes resident)', () => {
  const ledger = {
    house_config: { mealRate: 70, rentByResident: { resident1: 880, resident2: 880 } },
    meal_log: [
      { resident: 'resident1', breakfast: 1, lunch: 1, dinner: 1, guests: { breakfast: 0, lunch: 0, dinner: 0 } },
      { resident: 'resident2', breakfast: 0, lunch: 0, dinner: 0, guests: {} },
    ],
    deposit_ledger: [{ resident: 'resident1', amount: 500, status: 'approved' }],
    balances: {},
  }
  const bal = computeBalances(ledger, ['resident1', 'resident2'])
  // resident1: -3 plates * 70 - 880 rent + 500 deposit = -590 (owes house)
  assert.equal(bal.resident1, -590)
  // resident2: -880 rent = -880 (owes house)
  assert.equal(bal.resident2, -880)
})
await test('computeBalances: rejected deposits do not credit', () => {
  const ledger = {
    house_config: { mealRate: 70, rentByResident: { resident1: 0 } },
    meal_log: [],
    deposit_ledger: [{ resident: 'resident1', amount: 500, status: 'rejected' }],
    balances: {},
  }
  const bal = computeBalances(ledger, ['resident1'])
  assert.equal(bal.resident1, 0)
})
await test('buildWorkbook: returns workbook with 3 sheets', () => {
  const ledger = buildDefaultLedger()
  const wb = buildWorkbook(ledger, ['resident1', 'resident2'])
  assert.ok(wb.SheetNames)
  assert.equal(wb.SheetNames.length, 3)
  assert.ok(wb.SheetNames.includes('Summary'))
  assert.ok(wb.SheetNames.includes('Daily Ledger'))
  assert.ok(wb.SheetNames.includes('Expense Log'))
})

console.log('\n=== logic.js (settlement) ===')
const { computeSettlement, weightedMealCount } = await import('../src/lib/logic.js')

await test('weightedMealCount: breakfast 0.5, lunch/dinner 1', () => {
  assert.equal(weightedMealCount({ breakfast: 1, lunch: 1, dinner: 1 }), 2.5)
  assert.equal(weightedMealCount({ breakfast: 2, lunch: 0, dinner: 0 }), 1)
  assert.equal(weightedMealCount(null), 0)
})

await test('computeSettlement: cost_per_meal = groceries / weighted meals', () => {
  const ledger = {
    house_config: { mealRate: 70, rentPerPerson: 7000 },
    expense_log: [{ type: 'grocery', amount: 5000, paid_by: 'resident1' }],
    meal_log: [
      { resident: 'resident1', breakfast: 1, lunch: 1, dinner: 1, guests: {} }, // 2.5
      { resident: 'resident2', breakfast: 0, lunch: 1, dinner: 1, guests: {} }, // 2
    ],
  }
  const s = computeSettlement(ledger, ['resident1', 'resident2'])
  // total weighted meals = 4.5; 5000 / 4.5 = 1111.11 -> 1111
  assert.equal(s.costPerMeal, 1111)
  assert.equal(s.totalWeightedMeals, 4.5)
  assert.equal(s.totalGroceries, 5000)
})

await test('computeSettlement: surplus deducts from rent, 3rd person rent-free', () => {
  const ledger = {
    house_config: { mealRate: 70, rentPerPerson: 7000, rentFreeResident: 'resident3' },
    expense_log: [
      { type: 'grocery', amount: 4500, paid_by: 'resident1' },
      { type: 'grocery', amount: 500, paid_by: 'resident2' },
    ],
    meal_log: [
      { resident: 'resident1', breakfast: 1, lunch: 1, dinner: 1, guests: {} }, // 2.5
      { resident: 'resident2', breakfast: 1, lunch: 1, dinner: 1, guests: {} }, // 2.5
      { resident: 'resident3', breakfast: 1, lunch: 1, dinner: 1, guests: {} }, // 2.5
    ],
  }
  const s = computeSettlement(ledger, ['resident1', 'resident2', 'resident3'])
  // total meals = 7.5; cost_per_meal = 5000 / 7.5 = 667
  assert.equal(s.costPerMeal, 667)
  // resident1: share = 2.5*667 = 1667; spent 4500; surplus = 2833
  assert.ok(Math.abs(s.perPerson.resident1.surplus - (4500 - 1667)) < 1)
  // resident1 netOwed = rent 7000 - surplus 2833 = 4167
  assert.ok(Math.abs(s.perPerson.resident1.netOwed - 4167) < 2)
  // resident3 rent-free: netOwed = fixedCostShare - surplus (fixedCosts empty -> 0)
  assert.equal(s.perPerson.resident3.rent, 0)
})

await test('computeSettlement: fixed costs split across all, surplus deducts from them', () => {
  const ledger = {
    house_config: {
      mealRate: 70,
      rentPerPerson: 7000,
      fixedCosts: [{ name: 'Gas', total: 3000 }, { name: 'Internet', total: 3000 }],
    },
    expense_log: [{ type: 'grocery', amount: 3000, paid_by: 'resident1' }],
    meal_log: [
      { resident: 'resident1', breakfast: 0, lunch: 1, dinner: 1, guests: {} }, // 2
      { resident: 'resident2', breakfast: 0, lunch: 1, dinner: 1, guests: {} }, // 2
      { resident: 'resident3', breakfast: 0, lunch: 1, dinner: 1, guests: {} }, // 2
    ],
  }
  const s = computeSettlement(ledger, ['resident1', 'resident2', 'resident3'])
  // total meals = 6; cost_per_meal = 3000 / 6 = 500
  assert.equal(s.costPerMeal, 500)
  // fixedCostShare = 6000 / 3 = 2000 each
  assert.equal(s.fixedCostShare, 2000)
  // resident1: share = 2*500 = 1000; spent 3000; surplus = 2000
  // netOwed = rent 7000 + fixed 2000 - surplus 2000 = 7000
  assert.ok(Math.abs(s.perPerson.resident1.netOwed - 7000) < 1)
})

await test('computeSettlement: underpayment adds to what they owe', () => {
  const ledger = {
    house_config: { mealRate: 70, rentPerPerson: 7000 },
    expense_log: [{ type: 'grocery', amount: 1000, paid_by: 'resident1' }],
    meal_log: [
      { resident: 'resident1', breakfast: 0, lunch: 0, dinner: 0, guests: {} }, // 0
      { resident: 'resident2', breakfast: 1, lunch: 1, dinner: 1, guests: {} }, // 2.5
    ],
  }
  const s = computeSettlement(ledger, ['resident1', 'resident2'])
  // total meals = 2.5; cost_per_meal = 1000 / 2.5 = 400
  assert.equal(s.costPerMeal, 400)
  // resident1: share = 0; spent 1000; surplus = 1000 -> deducts from rent
  assert.ok(Math.abs(s.perPerson.resident1.surplus - 1000) < 1)
  // resident2: share = 2.5*400 = 1000; spent 0; deficit = -1000 -> adds
  assert.ok(Math.abs(s.perPerson.resident2.surplus - (-1000)) < 1)
  // resident2 netOwed = rent 7000 + deficit 1000 = 8000
  assert.ok(Math.abs(s.perPerson.resident2.netOwed - 8000) < 1)
})

await test('computeSettlement: surplus beyond rent + fixed carries forward', () => {
  const ledger = {
    house_config: {
      mealRate: 70,
      rentPerPerson: 1000,
      fixedCosts: [{ name: 'Water', total: 1500 }],
    },
    expense_log: [{ type: 'grocery', amount: 10000, paid_by: 'resident1' }],
    meal_log: [
      { resident: 'resident1', breakfast: 0, lunch: 0, dinner: 0, guests: {} }, // 0
      { resident: 'resident2', breakfast: 0, lunch: 0, dinner: 0, guests: {} }, // 0
    ],
  }
  const s = computeSettlement(ledger, ['resident1', 'resident2'])
  // resident1: share = 0; spent 10000; surplus = 10000
  // rent 1000 + fixed 750 = 1750 deducted; carry = 10000 - 1750 = 8250
  assert.ok(Math.abs(s.perPerson.resident1.surplus - 10000) < 1)
  assert.ok(Math.abs(s.perPerson.resident1.netOwed - 0) < 1)
  assert.ok(Math.abs(s.perPerson.resident1.carriedForward - 8250) < 1)
})

await test('computeSettlement: per-person rent + variable utilities split equally', () => {
  const ledger = {
    house_config: {
      mealRate: 70,
      rentByResident: { resident1: 7000, resident2: 6000, resident3: 0 },
    },
    expense_log: [
      { type: 'grocery', amount: 3000, paid_by: 'resident1' },
      { type: 'utility', amount: 900 }, // water + electricity, pooled
    ],
    meal_log: [
      { resident: 'resident1', breakfast: 0, lunch: 1, dinner: 1, guests: {} }, // 2
      { resident: 'resident2', breakfast: 0, lunch: 1, dinner: 1, guests: {} }, // 2
      { resident: 'resident3', breakfast: 0, lunch: 1, dinner: 1, guests: {} }, // 2
    ],
  }
  const s = computeSettlement(ledger, ['resident1', 'resident2', 'resident3'])
  // utilities: 900 / 3 = 300 per person
  assert.equal(s.totalUtilities, 900)
  assert.equal(s.perPerson.resident1.utilityShare, 300)
  assert.equal(s.perPerson.resident2.utilityShare, 300)
  assert.equal(s.perPerson.resident3.utilityShare, 300)
  // resident1: rent 7000 + fixed 0 + utility 300 - surplus(3000-1000=2000)
  // netOwed = 7000 + 300 - 2000 = 5300
  assert.ok(Math.abs(s.perPerson.resident1.netOwed - 5300) < 1)
  // resident2: rent 6000 + fixed 0 + utility 300 - surplus(0-1000=-1000) = 6000+300+1000 = 7300
  assert.ok(Math.abs(s.perPerson.resident2.netOwed - 7300) < 1)
  // resident3: rent 0 (rent-free) + fixed 0 + utility 300 - surplus(0-1000=-1000) = 0+300+1000 = 1300
  assert.ok(Math.abs(s.perPerson.resident3.netOwed - 1300) < 1)
  assert.equal(s.perPerson.resident3.rent, 0)
})

console.log('\n=== githubSync.js (applyQueue) ===')
const { applyQueue, seedLedger, loadQueue, clearQueue } = await import('../src/lib/githubSync.js')

// ---- clearQueue: targeted clearing (the mid-sync wipe bug) ----
// A sync captures the queue at start and pushes it. Ops enqueued WHILE the
// sync is in flight were not part of that push, so clearQueue(applied) must
// remove only the applied snapshot — otherwise a login sync finishing after
// a user action silently deletes the action's queued write.
function withQueueStore(run) {
  const store = {}
  const origGet = globalThis.localStorage?.getItem
  const origSet = globalThis.localStorage?.setItem
  globalThis.localStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = v },
    removeItem: (k) => { delete store[k] },
  }
  return run(store).finally(() => {
    if (origGet) globalThis.localStorage = { getItem: origGet, setItem: origSet }
    else delete globalThis.localStorage
  })
}
await test('clearQueue(applied) keeps ops enqueued mid-sync', async () => {
  await withQueueStore(async (store) => {
    // The sync starts and captures this snapshot of the queue...
    const early = { id: 'op_1', op: 'toggleMeal', args: {} }
    store['roomshare:queue'] = JSON.stringify([early])
    const snapshot = loadQueue()
    // ...while this op is enqueued mid-flight.
    const late = { id: 'op_2', op: 'addDeposit', args: {} }
    store['roomshare:queue'] = JSON.stringify([early, late])
    // The sync succeeds and clears exactly what it pushed.
    clearQueue(snapshot)
    const remaining = loadQueue()
    assert.equal(remaining.length, 1)
    assert.equal(remaining[0].id, 'op_2')
  })
})
await test('clearQueue(applied) keeps legacy ops without an id (never drop unknowns)', async () => {
  await withQueueStore(async (store) => {
    const legacy = { op: 'addTodo', args: {} } // pre-id queue item
    store['roomshare:queue'] = JSON.stringify([legacy])
    const snapshot = loadQueue()
    clearQueue(snapshot)
    assert.equal(loadQueue().length, 1)
  })
})
await test('clearQueue() with no args clears everything (restore/force path)', async () => {
  await withQueueStore(async (store) => {
    store['roomshare:queue'] = JSON.stringify([{ id: 'op_1', op: 'x', args: {} }])
    clearQueue()
    assert.deepEqual(loadQueue(), [])
  })
})

await test('applyQueue: toggleMeal creates entry', () => {
  const l = buildDefaultLedger()
  applyQueue(l, [{ op: 'toggleMeal', args: { resident: 'resident1', date: '2026-08-23', slot: 'breakfast', value: true } }])
  const entry = l.meal_log.find((m) => m.resident === 'resident1' && m.date === '2026-08-23')
  assert.ok(entry)
  assert.equal(entry.breakfast, 1)
})
await test('applyQueue: toggleMeal off sets to 0', () => {
  const l = buildDefaultLedger()
  applyQueue(l, [{ op: 'toggleMeal', args: { resident: 'resident1', date: '2026-08-23', slot: 'breakfast', value: true } }])
  applyQueue(l, [{ op: 'toggleMeal', args: { resident: 'resident1', date: '2026-08-23', slot: 'breakfast', value: false } }])
  const entry = l.meal_log.find((m) => m.resident === 'resident1' && m.date === '2026-08-23')
  assert.equal(entry.breakfast, 0)
})
await test('applyQueue: addExpense appends', () => {
  const l = buildDefaultLedger()
  applyQueue(l, [{ op: 'addExpense', args: { expense: { id: 'e1', date: '2026-08-23', type: 'grocery', vendor: 'Whole Foods', amount: 500, note: '', locked: false } } }])
  assert.equal(l.expense_log.length, 1)
  assert.equal(l.expense_log[0].vendor, 'Whole Foods')
})
await test('applyQueue: updateExpense patches', () => {
  const l = buildDefaultLedger()
  applyQueue(l, [{ op: 'addExpense', args: { expense: { id: 'e1', date: '2026-08-23', type: 'grocery', vendor: 'Wrong', amount: 5000, note: '', locked: false } } }])
  applyQueue(l, [{ op: 'updateExpense', args: { id: 'e1', patch: { vendor: 'Right', amount: 500 } } }])
  const e = l.expense_log[0]
  assert.equal(e.vendor, 'Right')
  assert.equal(e.amount, 500)
})
await test('applyQueue: deleteExpense removes', () => {
  const l = buildDefaultLedger()
  applyQueue(l, [{ op: 'addExpense', args: { expense: { id: 'e1', date: '2026-08-23', type: 'grocery', vendor: 'X', amount: 1, note: '', locked: false } } }])
  applyQueue(l, [{ op: 'deleteExpense', args: { id: 'e1' } }])
  assert.equal(l.expense_log.length, 0)
})
await test('applyQueue: setDepositStatus updates', () => {
  const l = buildDefaultLedger()
  applyQueue(l, [{ op: 'addDeposit', args: { deposit: { id: 'd1', resident: 'resident1', amount: 500, date: '2026-08-23', note: '', status: 'pending' } } }])
  applyQueue(l, [{ op: 'setDepositStatus', args: { id: 'd1', status: 'approved' } }])
  assert.equal(l.deposit_ledger[0].status, 'approved')
})
await test('applyQueue: setAnnouncement appends (does not wipe community posts)', () => {
  const l = buildDefaultLedger()
  // A resident post already exists in the shared feed.
  applyQueue(l, [{ op: 'postAnnouncement', args: { text: 'resident note', by: 'neloy' } }])
  // Admin posts a fridge note — it must append, not replace.
  applyQueue(l, [{ op: 'setAnnouncement', args: { text: 'Maid absent tomorrow' } }])
  assert.equal(l.announcements.length, 2)
  assert.equal(l.announcements[0].text, 'Maid absent tomorrow')
  assert.equal(l.announcements[1].text, 'resident note')
})
await test('applyQueue: updateConfig merges', () => {
  const l = buildDefaultLedger()
  applyQueue(l, [{ op: 'updateConfig', args: { patch: { mealRate: 75 } } }])
  assert.equal(l.house_config.mealRate, 75)
  assert.equal(l.house_config.rentPerPerson, buildDefaultLedger().house_config.rentPerPerson)
})
await test('applyQueue: addVacation creates list', () => {
  const l = buildDefaultLedger()
  applyQueue(l, [{ op: 'addVacation', args: { resident: 'resident1', start: '2026-08-01', end: '2026-08-10' } }])
  assert.ok(l.vacations.resident1)
  assert.equal(l.vacations.resident1.length, 1)
})
await test('applyQueue: setGuests clamps at zero (never negative)', () => {
  const l = buildDefaultLedger()
  applyQueue(l, [{ op: 'setGuests', args: { resident: 'resident1', date: '2026-08-23', slot: 'lunch', value: 3 } }])
  applyQueue(l, [{ op: 'setGuests', args: { resident: 'resident1', date: '2026-08-23', slot: 'lunch', value: -2 } }])
  const e = l.meal_log.find((m) => m.resident === 'resident1')
  assert.equal(e.guests.lunch, 0)
})
await test('applyQueue: addVacation rejects inverted or missing ranges', () => {
  const l = buildDefaultLedger()
  applyQueue(l, [{ op: 'addVacation', args: { resident: 'resident1', start: '2026-08-10', end: '2026-08-01' } }])
  applyQueue(l, [{ op: 'addVacation', args: { resident: 'resident1', start: '2026-08-01', end: '' } }])
  assert.equal(l.vacations?.resident1?.length ?? 0, 0)
})
await test('applyQueue: removeAnnouncement deletes by id', () => {
  const l = buildDefaultLedger()
  applyQueue(l, [{ op: 'postAnnouncement', args: { text: 'first', by: 'Neloy' } }])
  applyQueue(l, [{ op: 'postAnnouncement', args: { text: 'second', by: 'Mohin' } }])
  applyQueue(l, [{ op: 'removeAnnouncement', args: { id: l.announcements[1].id } }])
  assert.equal(l.announcements.length, 1)
  assert.equal(l.announcements[0].text, 'second')
})
await test('applyQueue: removeVacation removes by index', () => {
  const l = buildDefaultLedger()
  applyQueue(l, [{ op: 'addVacation', args: { resident: 'resident1', start: '2026-08-01', end: '2026-08-10' } }])
  applyQueue(l, [{ op: 'addVacation', args: { resident: 'resident1', start: '2026-09-01', end: '2026-09-05' } }])
  applyQueue(l, [{ op: 'removeVacation', args: { resident: 'resident1', index: 0 } }])
  assert.equal(l.vacations.resident1.length, 1)
  assert.equal(l.vacations.resident1[0].start, '2026-09-01')
})
await test('applyQueue: finalizeMonth zeroes meals + carries balances', () => {
  const l = buildDefaultLedger()
  l.house_config.cutoffDay = 1 // allow finalize regardless of current day
  applyQueue(l, [{ op: 'addExpense', args: { expense: { id: 'e1', date: '2026-08-23', type: 'grocery', vendor: 'X', amount: 1, note: '', locked: false } } }])
  applyQueue(l, [{ op: 'finalizeMonth', args: { nextBalances: { resident1: 100 } } }])
  assert.equal(l.meal_log.length, 0)
  assert.equal(l.balances.resident1, 100)
})
await test('applyQueue: finalizeMonth is gated by cutoffDay (blocks premature close)', () => {
  // Mock the clock to a fixed early-month date so the cutoffDay gate blocks
  // deterministically regardless of when the test runs.
  const RealDate = Date
  globalThis.Date = class extends RealDate {
    constructor(...args) {
      if (args.length === 0) return new RealDate(2026, 7, 24) // Aug 24, 2026
      return new RealDate(...args)
    }
  }
  try {
    const l = buildDefaultLedger()
    // cutoffDay defaults to 28; day 24 is before that, so finalize is blocked.
    // The op throws internally and applyQueue logs a warning, leaving the
    // ledger unchanged (balances must not be carried early).
    applyQueue(l, [{ op: 'finalizeMonth', args: { nextBalances: { resident1: 100 } } }])
    assert.notEqual(l.balances.resident1, 100, 'balances must not be carried early')
    assert.ok(l.meal_log.length === 0, 'live logs must not be zeroed early')
  } finally {
    globalThis.Date = RealDate
  }
})
await test('canFinalizeMonth: blocks before cutoffDay, allows on/after', () => {
  const l = buildDefaultLedger()
  l.house_config.cutoffDay = 28
  // Fixed clock at day 24 — gate should block.
  const fixed = new Date(2026, 7, 24)
  assert.equal(canFinalizeMonth(l, fixed).ok, false)
  l.house_config.cutoffDay = 1
  assert.equal(canFinalizeMonth(l, fixed).ok, true)
})
await test('applyQueue: postAnnouncement appends newest first', () => {
  const l = buildDefaultLedger()
  applyQueue(l, [{ op: 'postAnnouncement', args: { text: 'No gas', by: 'Resident 1' } }])
  applyQueue(l, [{ op: 'postAnnouncement', args: { text: 'No water', by: 'Resident 2' } }])
  assert.equal(l.announcements.length, 2)
  assert.equal(l.announcements[0].text, 'No water')
  assert.equal(l.announcements[0].by, 'Resident 2')
  assert.equal(l.announcements[1].text, 'No gas')
})
await test('applyQueue: addTodo appends', () => {
  const l = buildDefaultLedger()
  applyQueue(l, [{ op: 'addTodo', args: { todo: { id: 't1', text: 'Take out trash', done: false, priority: 'normal', due: '', createdBy: '' } } }])
  assert.equal(l.todos.length, 1)
  assert.equal(l.todos[0].text, 'Take out trash')
})
await test('applyQueue: toggleTodo flips done', () => {
  const l = buildDefaultLedger()
  applyQueue(l, [{ op: 'addTodo', args: { todo: { id: 't1', text: 'Mop floor', done: false, priority: 'normal', due: '', createdBy: '' } } }])
  applyQueue(l, [{ op: 'toggleTodo', args: { id: 't1' } }])
  assert.equal(l.todos[0].done, true)
  applyQueue(l, [{ op: 'toggleTodo', args: { id: 't1' } }])
  assert.equal(l.todos[0].done, false)
})
await test('applyQueue: deleteTodo removes', () => {
  const l = buildDefaultLedger()
  applyQueue(l, [{ op: 'addTodo', args: { todo: { id: 't1', text: 'Buy soap', done: false, priority: 'normal', due: '', createdBy: '' } } }])
  applyQueue(l, [{ op: 'deleteTodo', args: { id: 't1' } }])
  assert.equal(l.todos.length, 0)
})
await test('applyQueue: addEvent appends', () => {
  const l = buildDefaultLedger()
  applyQueue(l, [{ op: 'addEvent', args: { event: { id: 'v1', title: 'Rent due', date: '2026-08-01', time: '09:00', color: 'red', createdBy: '' } } }])
  assert.equal(l.calendar_events.length, 1)
  assert.equal(l.calendar_events[0].title, 'Rent due')
  assert.equal(l.calendar_events[0].date, '2026-08-01')
})
await test('applyQueue: deleteEvent removes', () => {
  const l = buildDefaultLedger()
  applyQueue(l, [{ op: 'addEvent', args: { event: { id: 'v1', title: 'Party', date: '2026-08-15', time: '', color: 'red', createdBy: '' } } }])
  applyQueue(l, [{ op: 'deleteEvent', args: { id: 'v1' } }])
  assert.equal(l.calendar_events.length, 0)
})
await test('buildCalendarGrid: Saturday-start padding + day count', () => {
  // August 2026 starts on a Saturday (weekday 6) and has 31 days.
  const grid = buildCalendarGrid(2026, 7)
  assert.equal(grid.length, 37) // 6 leading nulls + 31 days
  assert.equal(grid[0], null)
  assert.equal(grid[5], null)
  assert.equal(grid[6].day, 1)
  assert.equal(grid[6].dateStr, '2026-08-01')
  assert.equal(grid[36].day, 31)
})
await test('buildCalendarGrid: September starts on Tuesday (2 leading nulls)', () => {
  const grid = buildCalendarGrid(2026, 8)
  assert.equal(grid.length, 32) // 2 leading nulls + 30 days
  assert.equal(grid[0], null)
  assert.equal(grid[1], null)
  assert.equal(grid[2].day, 1)
  assert.equal(grid[2].dateStr, '2026-09-01')
})
await test('eventsOnDate: counts events for a date', () => {
  const events = [
    { id: 'v1', date: '2026-08-01' },
    { id: 'v2', date: '2026-08-01' },
    { id: 'v3', date: '2026-08-02' },
  ]
  assert.equal(eventsOnDate(events, '2026-08-01'), 2)
  assert.equal(eventsOnDate(events, '2026-08-03'), 0)
})
await test('seedLedger: seeds defaults for empty input', () => {
  const l = seedLedger(null)
  assert.ok(l.house_config)
  assert.ok(Array.isArray(l.meal_log))
})
await test('seedLedger: passes through valid ledger', () => {
  const l = buildDefaultLedger()
  const seeded = seedLedger(l)
  assert.equal(seeded, l)
})
await test('seedLedger: rebuilds when expense_log is null (partial corruption)', () => {
  const l = buildDefaultLedger()
  l.expense_log = null
  const seeded = seedLedger(l)
  assert.ok(Array.isArray(seeded.expense_log))
})
await test('seedLedger: rebuilds when deposit_ledger is missing', () => {
  const l = buildDefaultLedger()
  delete l.deposit_ledger
  const seeded = seedLedger(l)
  assert.ok(Array.isArray(seeded.deposit_ledger))
})
await test('seedLedger: rebuilds when announcements is not an array', () => {
  const l = buildDefaultLedger()
  l.announcements = { nope: true }
  const seeded = seedLedger(l)
  assert.ok(Array.isArray(seeded.announcements))
})
await test('uniqueId: generates distinct IDs even in same millisecond', () => {
  const ids = new Set()
  for (let i = 0; i < 500; i++) ids.add(uniqueId('exp'))
  assert.equal(ids.size, 500)
})
await test('uniqueId: prefixes are respected', () => {
  assert.ok(uniqueId('dep').startsWith('dep-'))
  assert.ok(uniqueId('ann').startsWith('ann-'))
})

console.log('\n=== notifications.js ===')
const {
  isWithinWindow,
  hasEntered,
  mealSlotCount,
  mealReminderState,
  mealSummaryState,
  newAnnouncement,
} = await import('../src/lib/notifications.js')

await test('isWithinWindow: evening window', () => {
  assert.ok(isWithinWindow(new Date(2026, 7, 23, 21, 30), 21, 22))
  assert.ok(!isWithinWindow(new Date(2026, 7, 23, 20, 30), 21, 22))
  assert.ok(!isWithinWindow(new Date(2026, 7, 23, 22, 0), 21, 22))
})
await test('hasEntered: true when slot > 0', () => {
  assert.ok(hasEntered({ breakfast: 1, lunch: 0, dinner: 0 }, 'breakfast'))
  assert.ok(!hasEntered({ breakfast: 0, lunch: 0, dinner: 0 }, 'breakfast'))
  assert.ok(!hasEntered(null, 'breakfast'))
})
await test('mealSlotCount: counts plates + guests', () => {
  const ledger = {
    meal_log: [
      { resident: 'nafiz', date: '2026-08-23', breakfast: 1, lunch: 0, dinner: 0, guests: { breakfast: 1, lunch: 0, dinner: 0 } },
      { resident: 'mohin', date: '2026-08-23', breakfast: 1, lunch: 0, dinner: 0, guests: { breakfast: 0, lunch: 0, dinner: 0 } },
      { resident: 'neloy', date: '2026-08-23', breakfast: 0, lunch: 0, dinner: 0, guests: {} },
    ],
  }
  // nafiz 1 plate + 1 guest, mohin 1 plate, neloy 0 = 3
  assert.equal(mealSlotCount(ledger, ['nafiz', 'mohin', 'neloy'], '2026-08-23', 'breakfast'), 3)
})
await test('mealReminderState: evening nag for missed breakfast+lunch', () => {
  const ledger = { meal_log: [{ resident: 'neloy', date: '2026-08-24', breakfast: 0, lunch: 0, dinner: 0, guests: {} }] }
  const now = new Date(2026, 7, 23, 21, 30) // evening, tomorrow = 08-24
  const r = mealReminderState(now, ledger, ['neloy'])
  assert.equal(r.length, 1)
  assert.ok(r[0].tag.includes('neloy'))
  assert.ok(r[0].body.toLowerCase().includes('breakfast'))
  assert.ok(r[0].body.toLowerCase().includes('lunch'))
})
await test('mealReminderState: no nag when all slots entered', () => {
  const ledger = { meal_log: [{ resident: 'neloy', date: '2026-08-24', breakfast: 1, lunch: 1, dinner: 0, guests: {} }] }
  const now = new Date(2026, 7, 23, 21, 30)
  const r = mealReminderState(now, ledger, ['neloy'])
  assert.equal(r.length, 0)
})
await test('mealReminderState: afternoon nags only about dinner', () => {
  const ledger = { meal_log: [{ resident: 'neloy', date: '2026-08-24', breakfast: 1, lunch: 1, dinner: 0, guests: {} }] }
  const now = new Date(2026, 7, 23, 14, 30) // afternoon
  const r = mealReminderState(now, ledger, ['neloy'])
  assert.equal(r.length, 1)
  assert.ok(r[0].body.toLowerCase().includes('dinner'))
  assert.ok(!r[0].body.toLowerCase().includes('breakfast'))
})
await test('mealReminderState: empty when no residents', () => {
  const r = mealReminderState(new Date(2026, 7, 23, 21, 30), { meal_log: [] }, [])
  assert.equal(r.length, 0)
})
await test('mealSummaryState: reports all three slots', () => {
  const ledger = {
    meal_log: [
      { resident: 'nafiz', date: '2026-08-23', breakfast: 1, lunch: 2, dinner: 3, guests: {} },
      { resident: 'mohin', date: '2026-08-23', breakfast: 0, lunch: 1, dinner: 0, guests: {} },
    ],
  }
  const s = mealSummaryState(new Date(2026, 7, 23, 16, 0), ledger, ['nafiz', 'mohin'])
  assert.equal(s.title, 'House meals today')
  assert.ok(s.body.includes('Cook for 2'))
  assert.ok(s.body.includes('Breakfast: 1'))
  assert.ok(s.body.includes('Lunch: 3'))
  assert.ok(s.body.includes('Dinner: 3'))
})
await test('newAnnouncement: returns newest when different from stored', () => {
  const store = { 'roomshare:lastAnnounced': { id: 'old' } }
  const getItem = (k) => JSON.stringify(store[k] || null)
  const setItem = (k, v) => { store[k] = JSON.parse(v) }
  const ledger = { announcements: [{ id: 'new1', text: 'No gas', date: '2026-08-23' }] }
  const origGet = globalThis.localStorage?.getItem
  const origSet = globalThis.localStorage?.setItem
  // Provide a minimal localStorage stub for the pure function.
  globalThis.localStorage = { getItem, setItem }
  try {
    const ann = newAnnouncement(ledger)
    assert.equal(ann.id, 'new1')
    assert.equal(ann.text, 'No gas')
  } finally {
    globalThis.localStorage = { getItem: origGet, setItem: origSet }
  }
})
await test('newAnnouncement: null when newest matches stored', () => {
  const store = { 'roomshare:lastAnnounced': { id: 'same' } }
  const ledger = { announcements: [{ id: 'same', text: 'No gas', date: '2026-08-23' }] }
  const origGet = globalThis.localStorage?.getItem
  const origSet = globalThis.localStorage?.setItem
  globalThis.localStorage = {
    getItem: (k) => JSON.stringify(store[k] || null),
    setItem: (k, v) => { store[k] = JSON.parse(v) },
  }
  try {
    assert.equal(newAnnouncement(ledger), null)
  } finally {
    globalThis.localStorage = { getItem: origGet, setItem: origSet }
  }
})

console.log('\n=== pushDecisions.js ===')
const {
  localDateStr,
  tomorrowStr,
  decideMealReminders,
  decideMealSummary,
  decideNewAnnouncement,
  decidePushBatch,
} = await import('../src/lib/pushDecisions.js')

await test('localDateStr: formats local Y/m/d', () => {
  const d = new Date(2026, 7, 28, 9, 30)
  assert.equal(localDateStr(d), '2026-08-28')
})
await test('tomorrowStr: adds one day', () => {
  const d = new Date(2026, 7, 28, 9, 30)
  assert.equal(tomorrowStr(d), '2026-08-29')
})
await test('decideMealReminders: evening nags missed breakfast+lunch', () => {
  const ledger = { meal_log: [{ resident: 'neloy', date: '2026-08-29', breakfast: 0, lunch: 0, dinner: 0, guests: {} }] }
  const r = decideMealReminders(ledger, ['neloy'], new Date(2026, 7, 28, 21, 30))
  assert.equal(r.length, 1)
  assert.equal(r[0].id, 'neloy')
  assert.ok(r[0].body.toLowerCase().includes('breakfast'))
  assert.ok(r[0].body.toLowerCase().includes('lunch'))
})
await test('decideMealReminders: no nag when all entered', () => {
  const ledger = { meal_log: [{ resident: 'neloy', date: '2026-08-29', breakfast: 1, lunch: 1, dinner: 0, guests: {} }] }
  const r = decideMealReminders(ledger, ['neloy'], new Date(2026, 7, 28, 21, 30))
  assert.equal(r.length, 0)
})
await test('decideMealReminders: afternoon nags only dinner', () => {
  const ledger = { meal_log: [{ resident: 'neloy', date: '2026-08-29', breakfast: 1, lunch: 1, dinner: 0, guests: {} }] }
  const r = decideMealReminders(ledger, ['neloy'], new Date(2026, 7, 28, 14, 30))
  assert.equal(r.length, 1)
  assert.ok(r[0].body.toLowerCase().includes('dinner'))
  assert.ok(!r[0].body.toLowerCase().includes('breakfast'))
})
await test('decideMealReminders: no reminders outside windows', () => {
  const ledger = { meal_log: [] }
  const r = decideMealReminders(ledger, ['neloy'], new Date(2026, 7, 28, 10, 0))
  assert.equal(r.length, 0)
})
await test('decideMealSummary: reports all slots at 16:00', () => {
  const ledger = { meal_log: [{ resident: 'nafiz', date: '2026-08-28', breakfast: 1, lunch: 2, dinner: 3, guests: {} }] }
  const s = decideMealSummary(ledger, ['nafiz'], new Date(2026, 7, 28, 16, 0))
  assert.equal(s.title, 'House meals today')
  assert.ok(s.body.includes('Breakfast: 1'))
  assert.ok(s.body.includes('Lunch: 2'))
  assert.ok(s.body.includes('Dinner: 3'))
})
await test('decideMealSummary: null at other hours via batch', () => {
  const ledger = { meal_log: [] }
  const batch = decidePushBatch(ledger, ['nafiz'], new Date(2026, 7, 28, 10, 0))
  const summary = batch.messages.find((m) => m.tag === 'meal-summary')
  assert.equal(summary, undefined)
})
await test('decideNewAnnouncement: returns newest', () => {
  const ledger = { announcements: [{ id: 'ann-1', text: 'No gas', date: '2026-08-28' }] }
  const a = decideNewAnnouncement(ledger, null)
  assert.equal(a.title, 'House announcement')
  assert.equal(a.body, 'No gas')
})
await test('decideNewAnnouncement: null when already announced', () => {
  const ledger = { announcements: [{ id: 'ann-1', text: 'No gas', date: '2026-08-28' }] }
  const a = decideNewAnnouncement(ledger, 'ann-1')
  assert.equal(a, null)
})
await test('decidePushBatch: combines reminders + summary + announcement', () => {
  const ledger = {
    meal_log: [{ resident: 'neloy', date: '2026-08-29', breakfast: 0, lunch: 0, dinner: 0, guests: {} }],
    announcements: [{ id: 'ann-9', text: 'Bazar today', date: '2026-08-28' }],
  }
  const batch = decidePushBatch(ledger, ['nafiz', 'mohin', 'neloy'], new Date(2026, 7, 28, 16, 30), null)
  const meal = batch.messages.filter((m) => m.tag.startsWith('meal-'))
  const summary = batch.messages.find((m) => m.tag === 'meal-summary')
  const ann = batch.messages.find((m) => m.tag.startsWith('ann-'))
  assert.ok(meal.length >= 1)
  assert.ok(summary, 'summary should fire at 16:00')
  assert.ok(ann, 'announcement should fire')
  assert.equal(batch.nextAnnouncedId, 'ann-9')
})

console.log('\n=== security.js (signup + password verify) ===')
const {
  signupAllowed,
  isFirstUser,
  verifyUserPassword,
  hashPassword,
  generateSalt,
} = await import('../src/lib/security.js')

const twoUsers = [
  { id: 'nafiz', username: 'nafiz', role: 'admin', active: true, salt: 's1', passwordHash: 'h1' },
  { id: 'neloy', username: 'neloy', role: 'resident', active: true, salt: 's2', passwordHash: 'h2' },
]

await test('signupAllowed: first user (no users) is allowed', () => {
  assert.deepEqual(signupAllowed([], 'whatever'), { allowed: true })
  assert.deepEqual(signupAllowed(null, ''), { allowed: true })
})
await test('signupAllowed: closed when no invite code is published', () => {
  const r = signupAllowed(twoUsers, 'ABC123', { inviteCode: '' })
  assert.equal(r.allowed, false)
  assert.ok(/closed/i.test(r.reason))
})
await test('signupAllowed: closed when the users node is empty-string code', () => {
  const r = signupAllowed(twoUsers, 'ABC123', {})
  assert.equal(r.allowed, false)
})
await test('signupAllowed: rejected with a wrong invite code', () => {
  const r = signupAllowed(twoUsers, 'WRONG1', { inviteCode: 'RIGHT1' })
  assert.equal(r.allowed, false)
  assert.ok(/invalid/i.test(r.reason))
})
await test('signupAllowed: accepted with the exact invite code (trims whitespace)', () => {
  const r = signupAllowed(twoUsers, '  RIGHT1 ', { inviteCode: 'RIGHT1' })
  assert.equal(r.allowed, true)
})

await test('verifyUserPassword: matches a correct password', async () => {
  const salt = generateSalt()
  const user = { salt, passwordHash: await hashPassword('correct horse', salt) }
  assert.equal(await verifyUserPassword(user, 'correct horse'), true)
})
await test('verifyUserPassword: rejects a wrong password', async () => {
  const salt = generateSalt()
  const user = { salt, passwordHash: await hashPassword('correct horse', salt) }
  assert.equal(await verifyUserPassword(user, 'wrong horse'), false)
})
await test('verifyUserPassword: rejects a null user', async () => {
  assert.equal(await verifyUserPassword(null, 'x'), false)
})

console.log('\n=== logic.js (invite code) ===')
const { generateInviteCode } = await import('../src/lib/logic.js')

await test('generateInviteCode: 8 chars from the unambiguous alphabet', () => {
  for (let i = 0; i < 50; i++) {
    const code = generateInviteCode()
    assert.equal(code.length, 8)
    assert.ok(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/.test(code), code)
  }
})
await test('generateInviteCode: produces distinct codes', () => {
  const set = new Set(Array.from({ length: 200 }, () => generateInviteCode()))
  assert.ok(set.size > 190)
})

console.log('\n=== backup.js (encrypt/decrypt round trip + validation) ===')
const { parseLedgerBackup } = await import('../src/lib/backup.js')
const { encryptLedger } = await import('../src/lib/ledgerCrypto.js')
const { buildDefaultLedger: bdl } = await import('../src/lib/types.js')

await test('parseLedgerBackup: round-trips a valid encrypted ledger', async () => {
  const original = bdl()
  original.announcements = [{ id: 'a1', text: 'hello', by: 'nafiz' }]
  const envelope = await encryptLedger(JSON.stringify(original, null, 2), '')
  const restored = await parseLedgerBackup(envelope)
  assert.equal(restored.announcements.length, 1)
  assert.equal(restored.announcements[0].text, 'hello')
  assert.ok(Array.isArray(restored.meal_log))
  assert.ok(Array.isArray(restored.users))
})
await test('parseLedgerBackup: rejects garbage (not a valid envelope/JSON)', async () => {
  await assert.rejects(() => parseLedgerBackup('this is not json at all'))
})
await test('parseLedgerBackup: rejects an envelope with a wrong password', async () => {
  // Node test env has no VITE_HOUSE_PASSWORD, so the file is encrypted with ''
  // and parseLedgerBackup also uses ''. Simulate a mismatch by encrypting with
  // a different password — decryption must fail, not produce a ledger.
  const original = bdl()
  const foreign = await encryptLedger(JSON.stringify(original), 'other-password')
  await assert.rejects(() => parseLedgerBackup(foreign), /password|corrupted/i)
})
await test('parseLedgerBackup: rejects a JSON file missing required nodes', async () => {
  const envelope = await encryptLedger(JSON.stringify({ hello: 'world' }), '')
  await assert.rejects(() => parseLedgerBackup(envelope), /required sections/i)
})

console.log(`\n${'='.repeat(40)}`)
console.log(`RESULT: ${passed} passed, ${failed} failed`)
console.log(`${'='.repeat(40)}\n`)

process.exit(failed === 0 ? 0 : 1)
