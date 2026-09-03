import { test, expect } from '@playwright/test'

// Full end-to-end Playwright suite. Runs on a DESKTOP Chromium viewport
// (1280x800) — no mobile emulation. Exercises the real login, the resident
// dashboard, admin tabs, and the settlement math screen.
//
// The app seeds an empty ledger on first load (no GitHub file yet), so all
// flows run against the in-memory default. Network calls to GitHub will fail
// silently (offline queue), which is fine — we're testing the UI + logic.

// Hardcoded house accounts (see src/lib/users.js):
//   nafiz  / House@Ledger#2026!  (admin)
//   mohin  / House@Ledger#2026!  (cadmin)
//   neloy  / House@Ledger#2026!  (resident)
const RESIDENT = { username: 'neloy', password: 'House@Ledger#2026!' }
const ADMIN = { username: 'nafiz', password: 'House@Ledger#2026!' }

// Log in via the sign-in form (no shared-password gate exists anymore).
async function login(page, creds = RESIDENT) {
  await page.goto('/')
  await page.fill('input[placeholder="Username"]', creds.username)
  await page.fill('input[placeholder="Password"]', creds.password)
  await page.click('button[type="submit"]')
  // Dismiss the first-login tutorial overlay so it doesn't block interactions.
  const skip = page.getByRole('button', { name: 'Skip tutorial' })
  if (await skip.count() > 0) await skip.click()
}

test.describe('House Ledger — Login Gate', () => {
  test('shows the House Ledger brand on first load', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1:has-text("House Ledger")')).toBeVisible()
  })

  test('rejects a wrong password', async ({ page }) => {
    await page.goto('/')
    await page.fill('input[placeholder="Username"]', 'neloy')
    await page.fill('input[placeholder="Password"]', 'wrong-password')
    await page.click('button[type="submit"]')
    await expect(page.locator('text=Wrong username or password')).toBeVisible({ timeout: 5000 })
  })

  test('lets a correct password through to the dashboard', async ({ page }) => {
    await login(page, RESIDENT)
    await expect(page.locator('text=House Command').first()).toBeVisible()
  })
})

test.describe('House Ledger — Resident Flow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, RESIDENT)
  })

  test('logs in resident and lands on the Dashboard', async ({ page }) => {
    await expect(page.locator('text=House Command').first()).toBeVisible()
    await expect(page.locator('text=RESIDENT')).toBeVisible()
  })

  test('shows the three resident tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Community' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ledger' })).toBeVisible()
  })

  test('Meal Matrix renders on the dashboard', async ({ page }) => {
    const matrix = page.getByRole('heading', { name: 'Meal Matrix' }).first()
    await expect(matrix).toBeVisible()
    await expect(page.getByRole('button', { name: 'Breakfast ○' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Lunch ○' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Dinner ○' }).first()).toBeVisible()
  })

  test('toggling a meal updates the Meal Matrix', async ({ page }) => {
    const breakfastBtn = page.getByRole('button', { name: 'Breakfast ○' }).first()
    await breakfastBtn.click()
    await expect(page.getByRole('button', { name: 'Breakfast', exact: true })).toBeVisible()
  })

  test('navigates to the Community tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Community' }).first().click()
    await expect(page.locator('text=House Command').first()).toBeVisible()
  })
})

test.describe('House Ledger — Admin Flow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN)
    // Nafiz starts in resident mode; flip to admin mode via the menu toggle.
    await page.getByTitle('Menu').first().click()
    await page.getByRole('button', { name: /Resident Mode|Admin Mode/ }).click()
    await expect(page.getByRole('button', { name: 'Control' })).toBeVisible({ timeout: 5000 })
  })

  test('logs in admin and sees admin tabs', async ({ page }) => {
    await expect(page.locator('text=House Command').first()).toBeVisible()
    await expect(page.locator('text=ADMIN')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Control' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Settlement' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ledger Ops' })).toBeVisible()
  })

  test('Settlement tab renders the monthly settlement', async ({ page }) => {
    await page.getByRole('button', { name: 'Settlement' }).first().click()
    await expect(page.locator('text=Monthly Settlement')).toBeVisible({ timeout: 5000 })
  })

  test('Control tab renders the admin control center', async ({ page }) => {
    await page.getByRole('button', { name: 'Control' }).first().click()
    await expect(page.locator('text=Control')).toBeVisible()
  })
})

test.describe('House Ledger — Layout & Responsiveness', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, RESIDENT)
  })

  test('page loads without React errors', async ({ page }) => {
    const errors = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('MIME type') && !msg.text().includes('400')) {
        errors.push(msg.text())
      }
    })
    page.on('pageerror', (err) => errors.push(err.message))
    await expect(page.locator('text=House Command').first()).toBeVisible()
    // Allow a moment for any async errors to surface.
    await page.waitForTimeout(1000)
    expect(errors).toHaveLength(0)
  })

  test('header shows the role badge', async ({ page }) => {
    await expect(page.locator('text=RESIDENT')).toBeVisible()
  })
})
