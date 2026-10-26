import { test, expect } from '@playwright/test'

// ============================================================================
// FULL UAT — House Ledger
// ============================================================================
// Exhaustive user-acceptance suite: every role × every screen × every action,
// plus the 2026-10 feature additions:
//   • invite-code signup (admin generates → new resident signs up)
//   • self-service password change (residents, not just admin)
//   • member-aware settlement (new members count automatically)
//   • encrypted backup & restore
//   • expense filtering
//   • PWA manifest / icons / service worker
//
// Runs in local mode (no .env.local): the app seeds the default ledger and
// all edits live in the in-memory ledger + localStorage queue. Each Playwright
// test gets a fresh context, so state never leaks between tests.
//
// Hardcoded house accounts (src/lib/users.js seed):
//   nafiz  / House@Ledger#2026!  (admin)
//   mohin  / House@Ledger#2026!  (cadmin)
//   neloy  / House@Ledger#2026!  (resident)

const RESIDENT = { username: 'neloy', password: 'House@Ledger#2026!' }
const ADMIN = { username: 'nafiz', password: 'House@Ledger#2026!' }
const CADMIN = { username: 'mohin', password: 'House@Ledger#2026!' }

// Log in through the real sign-in form and dismiss the first-login tutorial.
async function login(page, creds = RESIDENT) {
  // Navigate only when the app isn't already loaded: after an in-app logout
  // the login screen is right there, and a reload would wipe the in-memory
  // ledger (local mode), which the cross-login flows (resident → admin) need.
  const form = page.locator('input[placeholder="Username"]')
  if (await form.count() === 0) await page.goto('/')
  await expect(form).toBeVisible({ timeout: 10000 })
  await page.fill('input[placeholder="Username"]', creds.username)
  await page.fill('input[placeholder="Password"]', creds.password)
  await page.click('button[type="submit"]')
  await expect(page.locator('text=House Command').first()).toBeVisible({ timeout: 10000 })
  // The first-login tutorial is shown once per user by an effect that runs
  // AFTER the session is set, so it can mount after the dashboard. Wait a beat
  // and dismiss it if present — otherwise its z-[100] sheet blocks every click.
  const skip = page.getByRole('button', { name: 'Skip tutorial' })
  try {
    await skip.waitFor({ state: 'visible', timeout: 2000 })
    await skip.click()
  } catch {
    /* this user already saw the tutorial */
  }
}

// Admins start in resident mode; flip to admin mode via the menu toggle.
async function toAdminMode(page) {
  await page.getByTitle('Menu').first().click()
  await page.getByRole('button', { name: /Resident Mode|Admin Mode/ }).click()
  await expect(page.getByRole('button', { name: 'Control' })).toBeVisible({ timeout: 5000 })
}

async function logout(page) {
  // The header log-out button (title="Log out") is unique; the dropdown menu
  // adds a second "Log out" button, so we never target it by role name.
  await page.getByTitle('Log out').click()
  await expect(page.locator('h1:has-text("House Ledger")')).toBeVisible()
}

// Today's meal slots are all open before 16:00 (dinner locks at 16:00,
// breakfast/lunch at the 21:00 cutoff). Tests that touch TODAY's slots are
// skipped in the locked window so the suite is time-independent.
function todaySlotsOpen() {
  return new Date().getHours() < 16
}

// ---------------------------------------------------------------------------
// A. Auth & session
// ---------------------------------------------------------------------------
test.describe('UAT A — Auth & session', () => {
  test('rejects an unknown username', async ({ page }) => {
    await page.goto('/')
    await page.fill('input[placeholder="Username"]', 'ghost')
    await page.fill('input[placeholder="Password"]', 'whatever123')
    await page.click('button[type="submit"]')
    await expect(page.locator('text=Wrong username or password')).toBeVisible({ timeout: 5000 })
    // Still on the login screen.
    await expect(page.locator('h1:has-text("House Ledger")')).toBeVisible()
  })

  test('session survives a page reload', async ({ page }) => {
    await login(page, RESIDENT)
    await expect(page.locator('text=RESIDENT')).toBeVisible()
    await page.reload()
    await expect(page.locator('text=House Command').first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=RESIDENT')).toBeVisible()
  })

  test('admin stays in resident mode after a reload (consistent start)', async ({ page }) => {
    // The old bug: fresh login started in resident mode, but a reload
    // initialized adminMode from the session role and landed in admin mode.
    await login(page, ADMIN)
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Control' })).toHaveCount(0)
    await page.reload()
    await expect(page.locator('text=House Command').first()).toBeVisible({ timeout: 10000 })
    // Still resident mode after reload.
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Control' })).toHaveCount(0)
    // And the flip still works.
    await toAdminMode(page)
    await expect(page.getByRole('button', { name: 'Control' })).toBeVisible()
  })

  test('logout returns to the login screen', async ({ page }) => {
    await login(page, RESIDENT)
    await logout(page)
    await expect(page.locator('input[placeholder="Password"]')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// B. Resident dashboard — meals, guests, bazar, vacation
// ---------------------------------------------------------------------------
test.describe('UAT B — Resident dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, RESIDENT)
  })

  test('head count, meal matrix and set-all render', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Cook for today' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Meal Matrix' })).toBeVisible()
    // Tomorrow's column is never locked — toggle it regardless of the hour.
    const tomorrowBreakfast = page.getByRole('button', { name: 'Breakfast ○' }).nth(1)
    await tomorrowBreakfast.click()
    // Active cell: label without the ○.
    await expect(page.getByRole('button', { name: 'Breakfast', exact: true })).toHaveCount(1)
    if (todaySlotsOpen()) {
      // "Set all today's meals" is visible while today is untapped + unlocked.
      const setAll = page.getByRole('button', { name: /Set all today's meals/ })
      if (await setAll.count() > 0) {
        await setAll.click()
        await expect(page.getByRole('button', { name: 'Lunch', exact: true })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Dinner', exact: true })).toBeVisible()
      }
    }
  })

  test('guest plates increment and decrement', async ({ page }) => {
    // Guest Log renders AFTER the Meal Matrix, so its +/- are the LAST
    // "Add guest plate" / "Remove guest plate" buttons on the page. They edit
    // TODAY's entry and are not subject to the meal-lock cutoff, so this test
    // is time-independent.
    await page.getByTitle('Add guest plate').last().click()
    await expect(page.getByText('1 guest plate(s) added today')).toBeVisible({ timeout: 5000 })
    await page.getByTitle('Remove guest plate').last().click()
    await expect(page.getByText('1 guest plate(s) added today')).toHaveCount(0)
  })
})

// ---------------------------------------------------------------------------
// C. Resident dashboard — bazar, vacation, self-service password
// ---------------------------------------------------------------------------
test.describe('UAT C — Resident dashboard (bazar, vacation, password)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, RESIDENT)
  })

  test('bazar log records a multi-item grocery expense', async ({ page }) => {
    // The drawer header is the "Add purchase" badge (the submit button is
    // named "Log Bazar Expense", so a plain "Log Bazar" role match is
    // ambiguous).
    await page.getByText('Add purchase').click()
    await page.getByPlaceholder('item (e.g. rice)').first().fill('rice')
    await page.locator('input[placeholder="price"]').first().fill('450')
    await page.getByRole('button', { name: 'Add item' }).click()
    await page.getByPlaceholder('item (e.g. rice)').nth(1).fill('dal')
    await page.locator('input[placeholder="price"]').nth(1).fill('250')
    await page.getByRole('button', { name: 'Log Bazar Expense' }).click()
    await expect(page.getByText('Logged! Total added to groceries.')).toBeVisible({ timeout: 5000 })
  })

  test('vacation mode adds and removes a date range', async ({ page }) => {
    const card = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Vacation Mode' }) }).last()
    const iso = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const s = iso(new Date(Date.now() + 86400000))
    const e = iso(new Date(Date.now() + 3 * 86400000))
    await card.locator('input[type="date"]').nth(0).fill(s)
    await card.locator('input[type="date"]').nth(1).fill(e)
    await card.getByRole('button', { name: 'Confirm Dates' }).click()
    await expect(card.getByText(`${s} → ${e}`)).toBeVisible()
    await card.getByRole('button', { name: 'Remove' }).click()
    await expect(card.getByText(`${s} → ${e}`)).toHaveCount(0)
  })

  test('debt card renders a ledger balance', async ({ page }) => {
    await expect(page.getByText('Ledger Balance')).toBeVisible()
  })

  test('residents do not see the admin password generator', async ({ page }) => {
    await expect(page.getByRole('button', { name: /I forgot my password/ })).toHaveCount(0)
  })

  test('resident changes own password; the old one stops working', async ({ page }) => {
    const form = page.locator('form').filter({ has: page.getByPlaceholder('Current password') })
    // Wrong current password is rejected.
    await form.getByPlaceholder('Current password').fill('totally-wrong-1')
    await form.getByPlaceholder('New password (min 8 characters)').fill('NewPass@123')
    await form.getByPlaceholder('Repeat new password').fill('NewPass@123')
    await form.getByRole('button', { name: 'Update Password' }).click()
    await expect(page.getByText('Current password is wrong.')).toBeVisible({ timeout: 5000 })

    // Correct current password → updated.
    await form.getByPlaceholder('Current password').fill('House@Ledger#2026!')
    await form.getByRole('button', { name: 'Update Password' }).click()
    await expect(page.getByText('Password updated. The old one no longer works.')).toBeVisible({ timeout: 5000 })

    // Old password is dead, new one signs in.
    await logout(page)
    await page.fill('input[placeholder="Username"]', 'neloy')
    await page.fill('input[placeholder="Password"]', 'House@Ledger#2026!')
    await page.click('button[type="submit"]')
    await expect(page.getByText('Wrong username or password.')).toBeVisible({ timeout: 5000 })
    await page.fill('input[placeholder="Password"]', 'NewPass@123')
    await page.click('button[type="submit"]')
    await expect(page.locator('text=House Command').first()).toBeVisible({ timeout: 10000 })
    // First login in this context → tutorial effect may still be mounting.
    const skip = page.getByRole('button', { name: 'Skip tutorial' })
    try {
      await skip.waitFor({ state: 'visible', timeout: 2000 })
      await skip.click()
    } catch {
      /* tutorial already dismissed */
    }
  })
})

// ---------------------------------------------------------------------------
// D. Deposit inbox — resident submits, admin verifies / rejects
// ---------------------------------------------------------------------------
test.describe('UAT D — Deposit inbox', () => {
  test('resident submits a deposit and the admin verifies it', async ({ page }) => {
    await login(page, RESIDENT)
    await page.getByRole('button', { name: 'Ledger' }).click()
    await page.getByPlaceholder('Amount').fill('500')
    await page.getByPlaceholder('Note: e.g.').fill('Handed 500 to admin')
    await page.getByRole('button', { name: 'Submit Deposit Request' }).click()
    await expect(page.getByRole('heading', { name: 'Recent Deposits' })).toBeVisible()
    // "Stays pending until approved" (the form hint) also contains "pending",
    // so only an exact, case-sensitive, whole-string match hits the badge.
    await expect(page.getByText('PENDING', { exact: true })).toBeVisible()

    // The in-memory ledger survives a logout on this page (no reload), so the
    // admin in the same browser sees the pending deposit in the inbox.
    await logout(page)
    await login(page, ADMIN)
    await toAdminMode(page)
    await page.getByRole('button', { name: 'Control' }).click()
    await expect(page.getByText('neloy submitted TK 500')).toBeVisible()
    await expect(page.getByText('Handed 500 to admin')).toBeVisible()
    await page.getByRole('button', { name: 'Verify' }).click()
    await expect(page.getByText('No pending deposits.')).toBeVisible()
  })

  test('admin can reject a deposit', async ({ page }) => {
    await login(page, RESIDENT)
    await page.getByRole('button', { name: 'Ledger' }).click()
    await page.getByPlaceholder('Amount').fill('300')
    await page.getByRole('button', { name: 'Submit Deposit Request' }).click()
    await expect(page.getByText('PENDING', { exact: true })).toBeVisible()

    await logout(page)
    await login(page, ADMIN)
    await toAdminMode(page)
    await page.getByRole('button', { name: 'Control' }).click()
    await page.getByRole('button', { name: 'Reject' }).click()
    await expect(page.getByText('No pending deposits.')).toBeVisible()
  })

  test('invalid deposit amount is rejected with an inline error', async ({ page }) => {
    await login(page, RESIDENT)
    await page.getByRole('button', { name: 'Ledger' }).click()
    await page.getByPlaceholder('Amount').fill('-100')
    await page.getByRole('button', { name: 'Submit Deposit Request' }).click()
    await expect(page.getByText('Enter an amount greater than zero.')).toBeVisible()
    // Nothing was queued — no pending badge appears.
    await expect(page.getByText('PENDING', { exact: true })).toHaveCount(0)
  })
})

// ---------------------------------------------------------------------------
// E. Community — announcements, todos, calendar
// ---------------------------------------------------------------------------
test.describe('UAT E — Community', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, RESIDENT)
    await page.getByRole('button', { name: 'Community' }).click()
  })

  test('freeform announcement posts to the feed with the author', async ({ page }) => {
    await page.getByPlaceholder('Write a notice for the house…').fill('Pizza night on Friday')
    await page.getByRole('button', { name: 'Post Notice' }).click()
    // The header Banner marquee ALSO shows the latest announcement, so scope
    // the assertion to the amber feed card to stay unambiguous.
    const feedItem = page.locator('div.bg-amber-50').filter({ hasText: 'Pizza night on Friday' })
    await expect(feedItem).toBeVisible()
    await expect(feedItem.getByText('· Neloy')).toBeVisible()
  })

  test('one-tap prebuilt notice posts without typing', async ({ page }) => {
    await page.getByRole('button', { name: 'Maid absent tomorrow — order food' }).click()
    // The prebuilt button and the header marquee keep the same text, so assert
    // on the amber feed card specifically.
    const feedItem = page
      .locator('div.bg-amber-50')
      .filter({ hasText: 'Maid absent tomorrow — order food' })
    await expect(feedItem).toBeVisible()
    await expect(feedItem.getByText('· Neloy')).toBeVisible()
  })

  test('todo: add, complete, and no delete control for residents', async ({ page }) => {
    await page.getByPlaceholder('Add a task…').fill('Buy rice')
    // exact: the calendar's "Add Event" button also matches a plain "Add".
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    const task = page.locator('li').filter({ hasText: 'Buy rice' })
    await expect(task).toBeVisible()
    await task.locator('button').first().click()
    await expect(task.locator('div.line-through')).toBeVisible()
    // Residents cannot delete other people's tasks.
    await expect(task.getByRole('button', { name: 'Delete' })).toHaveCount(0)
  })

  test('calendar event shows on its date', async ({ page }) => {
    await page.getByPlaceholder('Event title…').fill('Maid training')
    await page.getByRole('button', { name: 'Add Event' }).click()
    await expect(page.locator('li').filter({ hasText: 'Maid training' })).toBeVisible()
  })

  test('admin can delete an announcement from the feed', async ({ page }) => {
    await logout(page)
    await login(page, ADMIN)
    await toAdminMode(page)
    await page.getByRole('button', { name: 'Community' }).click()
    await page.getByPlaceholder('Write a notice for the house…').fill('Remove me please')
    await page.getByRole('button', { name: 'Post Notice' }).click()
    const feedItem = page.locator('div.bg-amber-50').filter({ hasText: 'Remove me please' })
    await expect(feedItem).toBeVisible()
    await feedItem.getByLabel('Remove post').click()
    await expect(feedItem).toHaveCount(0)
  })
})

// ---------------------------------------------------------------------------
// F. Admin — Ledger Ops (expenses, filters, correction window)
// ---------------------------------------------------------------------------
test.describe('UAT F — Admin: Ledger Ops', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN)
    await toAdminMode(page)
    await page.getByRole('button', { name: 'Ledger Ops' }).click()
  })

  async function addExpense(page, { type, amount, vendor, note }) {
    if (type) await page.locator('select').first().selectOption(type)
    await page.getByPlaceholder('$ 0.00').fill(String(amount))
    await page.getByPlaceholder('e.g. Whole Foods').fill(vendor)
    if (note) await page.getByPlaceholder('e.g. Weekly restock at Whole Foods').fill(note)
    await page.getByRole('button', { name: 'Log Expense' }).click()
    await expect(page.getByText(vendor)).toBeVisible({ timeout: 5000 })
  }

  test('log a grocery and a utility, then edit within the correction window', async ({ page }) => {
    await addExpense(page, { amount: 250, vendor: 'Dutch Bazar', note: 'rice + dal' })
    await expect(page.getByText('paid by Nafiz')).toBeVisible()
    await addExpense(page, { type: 'utility', amount: 300, vendor: 'City Gas', note: 'monthly gas' })

    // Both entries are within the 24-hour correction window → editable.
    const firstEdit = page.getByRole('button', { name: 'Edit' }).first()
    await firstEdit.click()
    const editForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Save Changes' }) })
    await expect(editForm).toBeVisible()
    await editForm.locator('input[type="number"]').fill('275')
    await editForm.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByText('TK 275')).toBeVisible({ timeout: 5000 })
  })

  test('filters narrow the expense log by type and search', async ({ page }) => {
    await addExpense(page, { amount: 250, vendor: 'Dutch Bazar' })
    await addExpense(page, { type: 'utility', amount: 300, vendor: 'City Gas' })

    // Type filter: groceries only.
    const typeFilter = page.locator('select').nth(1)
    await typeFilter.selectOption('grocery')
    await expect(page.getByText('Dutch Bazar')).toBeVisible()
    await expect(page.getByText('City Gas')).toHaveCount(0)
    await expect(page.getByText('1 of 2 entries')).toBeVisible()

    // Free-text search across the full log.
    await typeFilter.selectOption('all')
    await page.getByPlaceholder('Search vendor, note, or paid-by…').fill('gas')
    await expect(page.getByText('City Gas')).toBeVisible()
    await expect(page.getByText('Dutch Bazar')).toHaveCount(0)
    await expect(page.getByText('1 of 2 entries')).toBeVisible()
  })

  test('lock a posted expense', async ({ page }) => {
    await addExpense(page, { amount: 150, vendor: 'Electricity' })
    await page.getByRole('button', { name: 'Lock' }).click()
    await expect(page.getByText('LOCKED')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Lock' })).toHaveCount(0)
  })

  test('deleting an expense asks for confirmation first', async ({ page }) => {
    await addExpense(page, { amount: 120, vendor: 'Confirm Test', note: 'delete me' })
    let dialogMessage = null
    page.on('dialog', async (d) => {
      dialogMessage = d.message()
      await d.dismiss()
    })
    await page.getByRole('button', { name: 'Delete' }).first().click()
    await expect.poll(() => dialogMessage).not.toBeNull()
    // Dismissed → the expense must still be in the log.
    await expect(page.getByText('Confirm Test')).toBeVisible()
  })

  test('invalid expense amount is rejected with an inline error', async ({ page }) => {
    await page.getByPlaceholder('$ 0.00').fill('-50')
    await page.getByPlaceholder('e.g. Whole Foods').fill('Bad Amount')
    await page.getByRole('button', { name: 'Log Expense' }).click()
    await expect(page.getByText('Enter an amount greater than zero.')).toBeVisible()
    await expect(page.getByText('Bad Amount')).toHaveCount(0)
  })
})

// ---------------------------------------------------------------------------
// G. Admin — Control Center (fridge, settings, backup, finalize gate)
// ---------------------------------------------------------------------------
test.describe('UAT G — Admin: Control Center', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN)
    await toAdminMode(page)
    await page.getByRole('button', { name: 'Control' }).click()
  })

  test('digital fridge post is visible under Current Post', async ({ page }) => {
    await page.getByPlaceholder('Write a note for the house…').fill('Maid absent Friday')
    await page.getByRole('button', { name: 'Post to Fridge' }).click()
    await expect(page.getByText('Current Post')).toBeVisible()
    // The header marquee also shows the new post — assert on the amber
    // Current Post card specifically.
    const postCard = page.locator('div.bg-amber-50').filter({ hasText: 'Maid absent Friday' })
    await expect(postCard).toBeVisible()
  })

  test('house settings save and show the saved state', async ({ page }) => {
    const mealRateInput = page
      .locator('label', { hasText: 'Meal Rate (per plate)' })
      .locator('xpath=following-sibling::input[1]')
    await mealRateInput.fill('85')
    await page.getByRole('button', { name: 'Save Settings' }).click()
    await expect(page.getByRole('button', { name: 'Saved · will sync next cycle' })).toBeVisible()
  })

  test('backup downloads and restores in a round trip', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download Backup' }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/^roomshare-backup-.*\.json$/)
    await expect(page.getByText('Backup downloaded — it is encrypted with the house password.')).toBeVisible({ timeout: 10000 })

    // Round-trip: restore from the exact file just downloaded.
    const filePath = await download.path()
    page.once('dialog', (d) => d.accept())
    await page
      .locator('label', { hasText: 'Restore from Backup' })
      .locator('input[type="file"]')
      .setInputFiles(filePath)
    await expect(page.getByText(/Restored from/)).toBeVisible({ timeout: 10000 })
  })

  test('finalize month is gated by the cutoff day (28)', async ({ page }) => {
    const btn = page.getByRole('button', { name: 'Finalize Month' })
    if (new Date().getDate() < 28) {
      await expect(btn).toBeDisabled()
    } else {
      await expect(btn).toBeEnabled()
    }
  })

  test('full admin sees the one-tap password generator on the dashboard', async ({ page }) => {
    // Flip back to resident mode — that is where the password card lives.
    await page.getByTitle('Menu').first().click()
    await page.getByRole('button', { name: /Resident Mode|Admin Mode/ }).click()
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByRole('button', { name: /I forgot my password/ })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// H. Admin — Members (user management) + I. Co-admin (withheld powers)
// ---------------------------------------------------------------------------
// A member row is the rounded card whose bold name div matches exactly.
function memberRow(page, name) {
  return page.locator('div.rounded-2xl').filter({ has: page.getByText(name, { exact: true }) })
}

async function addMember(page, { name, email, username, password }) {
  await page.getByRole('button', { name: '+ Add Member' }).click()
  await page.getByPlaceholder('Full name').fill(name)
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Username').fill(username)
  await page.getByPlaceholder('Password (min 6 chars)').fill(password)
  await page.getByRole('button', { name: 'Create Member' }).click()
  await expect(page.getByText(name)).toBeVisible({ timeout: 5000 })
}

test.describe('UAT H — Admin: Members', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN)
    await toAdminMode(page)
    await page.getByRole('button', { name: 'Members' }).click()
  })

  test('new member joins settlement automatically', async ({ page }) => {
    await addMember(page, {
      name: 'Rafi Khan',
      email: 'rafi@example.com',
      username: 'rafi',
      password: 'Rafi@2026!',
    })

    // Member-aware settlement: the new member gets a card (labelled by their
    // username, like the seeded accounts) and the split denominator grows
    // from 3 to 4.
    await page.getByRole('button', { name: 'Settlement' }).click()
    await expect(page.getByRole('heading', { name: 'Monthly Settlement' })).toBeVisible()
    await expect(page.getByText('rafi', { exact: true })).toBeVisible()
    // One "Fixed costs ÷ N" row per resident card — 4 residents → 4 matches.
    await expect(page.getByText('Fixed costs ÷ 4').first()).toBeVisible()
  })

  test('duplicate username is rejected', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add Member' }).click()
    await page.getByPlaceholder('Full name').fill('Ghost')
    await page.getByPlaceholder('Email').fill('ghost@example.com')
    await page.getByPlaceholder('Username').fill('neloy')
    await page.getByPlaceholder('Password (min 6 chars)').fill('Ghost@123')
    await page.getByRole('button', { name: 'Create Member' }).click()
    await expect(page.getByText('A user with that email or username already exists.')).toBeVisible()
  })

  test('disabling a member drops them from settlement', async ({ page }) => {
    // Rows are labelled by display name ("Neloy"); the username only appears
    // as "neloy · <email>", so an exact "neloy" match finds nothing.
    const row = memberRow(page, 'Neloy')
    await row.getByTitle('Disable').click()
    await expect(row.getByText('Disabled')).toBeVisible()
    await page.getByRole('button', { name: 'Settlement' }).click()
    await expect(page.getByText('neloy', { exact: true })).toHaveCount(0)
  })

  test('admin deletes a member', async ({ page }) => {
    await addMember(page, {
      name: 'Temp Guy',
      email: 'temp@example.com',
      username: 'tempguy',
      password: 'Temp@1234',
    })
    page.once('dialog', (d) => d.accept())
    await memberRow(page, 'Temp Guy').getByTitle('Delete').click()
    await expect(memberRow(page, 'Temp Guy')).toHaveCount(0)
  })

  test('admin cannot delete their own account', async ({ page }) => {
    const row = memberRow(page, 'Nafiz')
    await row.getByTitle('Delete').click()
    await expect(page.getByText('You cannot delete your own account.')).toBeVisible()
    await expect(row.getByText('Nafiz', { exact: true })).toBeVisible()
  })

  test('admin cannot deactivate their own account', async ({ page }) => {
    const row = memberRow(page, 'Nafiz')
    await row.getByTitle('Disable').click()
    await expect(page.getByText('You cannot deactivate your own account while you are signed in.')).toBeVisible()
    // The guard blocks the toggle — the account stays active.
    await expect(row.getByText('Disabled')).toHaveCount(0)
  })
})

test.describe('UAT I — Co-admin (silent power withholding)', () => {
  test('co-admin cannot delete members — the click is a silent no-op', async ({ page }) => {
    await login(page, CADMIN)
    await toAdminMode(page)
    await page.getByRole('button', { name: 'Members' }).click()
    const row = memberRow(page, 'Neloy')
    page.once('dialog', (d) => d.accept())
    await row.getByTitle('Delete').click()
    // Confirmed, but silently refused: the row is untouched.
    await expect(row.getByText('Neloy', { exact: true })).toBeVisible()
    await expect(row.getByText('Disabled')).toHaveCount(0)
  })

  test('co-admin does not see the one-tap password generator', async ({ page }) => {
    await login(page, CADMIN)
    await expect(page.getByRole('button', { name: /I forgot my password/ })).toHaveCount(0)
  })
})

// ---------------------------------------------------------------------------
// J. Signup & invite codes
// ---------------------------------------------------------------------------
test.describe('UAT J — Signup & invite codes', () => {
  test('signup is closed without a published code', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Sign Up' }).click()
    await page.getByPlaceholder('Full name').fill('Rafi Khan')
    await page.getByPlaceholder('Username').fill('rafi')
    await page.getByPlaceholder('Password').fill('Rafi@2026!')
    await page.click('button[type="submit"]')
    await expect(page.getByText('Signup is closed. Ask an admin to share an invite code.')).toBeVisible()
    // Still on the login screen.
    await expect(page.locator('h1:has-text("House Ledger")')).toBeVisible()
  })

  test('invite-code signup end to end', async ({ page }) => {
    // 1. Admin publishes a code in House Settings.
    await login(page, ADMIN)
    await toAdminMode(page)
    await page.getByRole('button', { name: 'Control' }).click()
    await page.getByRole('button', { name: 'Generate' }).click()
    const code = await page.locator('input.font-mono').inputValue()
    expect(code).toMatch(/^[A-Z2-9]{8}$/)
    await page.getByRole('button', { name: 'Save Settings' }).click()
    await expect(page.getByRole('button', { name: 'Saved · will sync next cycle' })).toBeVisible()

    // 2. Log out and sign up in the same browser (the in-memory ledger keeps
    //    the published code across logout).
    await logout(page)
    await page.getByRole('button', { name: 'Sign Up' }).click()
    await page.getByPlaceholder('Full name').fill('Rafi Khan')
    await page.getByPlaceholder('Username').fill('rafi')
    await page.getByPlaceholder('Password').fill('Rafi@2026!')
    // A wrong code is rejected…
    await page.getByPlaceholder('Invite code (from an admin)').fill('ZZZZZZZZ')
    await page.click('button[type="submit"]')
    await expect(page.getByText('Invalid invite code.')).toBeVisible({ timeout: 5000 })
    // …the published code joins the house.
    await page.getByPlaceholder('Invite code (from an admin)').fill(code)
    await page.click('button[type="submit"]')
    await expect(page.locator('text=House Command').first()).toBeVisible({ timeout: 10000 })
    // Brand-new user's first login → tutorial effect may still be mounting.
    const skip = page.getByRole('button', { name: 'Skip tutorial' })
    try {
      await skip.waitFor({ state: 'visible', timeout: 2000 })
      await skip.click()
    } catch {
      /* tutorial already dismissed */
    }
    // Joined as a resident — no admin tabs.
    await expect(page.getByRole('button', { name: 'Control' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// K. Settlement + L. Maid board
// ---------------------------------------------------------------------------
test.describe('UAT K — Settlement', () => {
  test('settlement renders for all seeded members', async ({ page }) => {
    await login(page, ADMIN)
    await toAdminMode(page)
    await page.getByRole('button', { name: 'Settlement' }).click()
    await expect(page.getByRole('heading', { name: 'Monthly Settlement' })).toBeVisible()
    await expect(page.getByText('Total Groceries')).toBeVisible()
    await expect(page.getByText('Total Owed (Cash)')).toBeVisible()
    for (const id of ['nafiz', 'mohin', 'neloy']) {
      await expect(page.getByText(id, { exact: true })).toBeVisible()
    }
  })
})

test.describe('UAT L — Maid board', () => {
  test('maid board renders the house meal summary', async ({ page }) => {
    await login(page, ADMIN)
    await toAdminMode(page)
    await page.getByRole('button', { name: 'Maid Board' }).click()
    await expect(page.getByRole('heading', { name: /Maid Board —/ })).toBeVisible()
    await expect(page.getByText("Who's eating what")).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// M. PWA readiness
// ---------------------------------------------------------------------------
test.describe('UAT M — PWA readiness', () => {
  test('manifest is valid and icons are served', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest')
    expect(res.status()).toBe(200)
    const manifest = await res.json()
    expect(manifest.name).toBe('House Ledger')
    expect(manifest.display).toBe('standalone')
    expect(Array.isArray(manifest.icons) ? manifest.icons.length : 0).toBeGreaterThan(0)
    for (const icon of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon.svg']) {
      const r = await request.get(`/${icon}`)
      expect(r.status(), icon).toBe(200)
    }
    const png = await request.get('/icon-512.png')
    expect(png.headers()['content-type']).toContain('image/png')
  })

  test('service worker registers on load', async ({ page }) => {
    await page.goto('/')
    await expect
      .poll(async () =>
        page.evaluate(() => navigator.serviceWorker.getRegistrations().then((rs) => rs.length))
      )
      .toBeGreaterThanOrEqual(1)
  })
})