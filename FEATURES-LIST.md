# House Ledger — Complete Feature List

A zero-cost household meal & expense tracker. Runs as a **Progressive Web App**
(installable on any phone) backed by a single private GitHub repo. No server,
no database hosting, no monthly fees.

> **Status:** UI complete. Build clean (`npm run build` ✓), 74/74 tests pass.
> Login is a **password-less role picker** — pick your role once, it's saved on
> the device. No signup, no passwords.
>
> **Community features** (calendar, to-do list, open announcements, per-role
> dashboards) are implemented and wired into the tab nav.

---

## 0. How to Run

```bash
cd /Users/nafiz/roomshare
npm install          # already done
npm run dev          # start dev server (http://localhost:5173)
npm run build        # production build → dist/
npm run preview      # preview the production build
node test/core.test.mjs   # run the 74-test logic suite
```

---

## 1. System Architecture

- **Single-file JSON database** — `master_ledger.json` in a private repo, split into 4 nodes:
  - `house_config` — rent, internet, meal rate, cutoff times, bazar interval, currency
  - `meal_log` — day-by-day array of who ate what
  - `expense_log` — chronological list of all money spent
  - `deposit_ledger` — log of who paid what to the admin
- **ETag optimistic concurrency** — replaces the fragile "staggered sync" idea.
  - `GET` returns an ETag (version fingerprint)
  - `PUT` sent with `If-Match: <etag>`
  - On `409` conflict: re-pull, merge local queue on top, retry — **never crashes**
- **Offline queue** — edits are queued in `localStorage` and flushed on next sync
- **Admin force-overwrite** — admin can overwrite the GitHub file from local truth
- **Offline PWA** — service worker caches the app shell so it opens without data

---

## 2. Resident Features

### 2.1 Meal Toggles
- Toggle own Breakfast / Lunch / Dinner per day
- Only sees and edits **their own** meals
- 3×2 grid: rows = Breakfast/Lunch/Dinner, columns = Today/Tomorrow

### 2.2 Guest Addition
- Add `+1` or `+2` plates per meal slot
- Extra plates **auto-charge** the resident's account
- Guest counter shown per meal

### 2.3 Deposit Request
- Form: Amount, Date, Note (e.g. "Handed 500 for Bazar")
- Status stays **Pending** until admin approves
- History of my deposits with status tags (Pending / Approved / Rejected)

### 2.4 Read-Only Ledgers
- Overall house expenses
- Current meal rate
- Personal debt balance
- Everyone's outstanding balances (view only)

### 2.5 Dashboard
- Bazar Duty badge
- Debt visualizer card
- Meal Matrix
- Guest Log
- Vacation Mode

---

## 3. Admin Features

### 3.1 Deposit Approval Inbox
- Sees "Member B submitted 500 TK"
- **[Verify]** locks it into the ledger (status → Approved)
- **[Reject]** if cash wasn't actually handed over (status → Rejected)

### 3.2 Expense Input
- Exclusive ability to log daily groceries and fixed monthly utilities
- Expense types: Groceries & Consumables, Utilities, Repairs, Other
- Fields: type, amount, date, vendor, note

### 3.3 Ledger Corrections (Undo)
- **24-hour window** to delete or edit an entry before it locks
- Status tags: OPEN (editable) → POSTED (locked by time) → LOCKED (manually locked)
- Lock / Edit / Delete buttons appear only within the window

### 3.4 Month Finalization
- Single button runs the final math
- Zeroes out meal counters
- Carries debts/credits forward to a fresh month node
- Generates the 3-tab Excel report and opens the native share menu
- **Gated by `cutoffDay`** (House Settings → "Month-finalize day", default 28):
  the month can't be finalized until the current day-of-month reaches `cutoffDay`.
  The button is disabled and a warning shows until then, so a month can't be
  prematurely closed mid-cycle.

### 3.5 Digital Fridge
- Push announcement text strings (e.g. "Maid is absent tomorrow, order food")
- Scrolls on residents' phones on next sync / app open

### 3.6 Community Board (open to everyone)
- Shared "Community Board" where **anyone** can post notices — not just the admin
- **Prebuilt one-tap templates**: 🔥 No gas, 💧 No water, ⚡ No electricity,
  🛒 Bazar, 🧹 Maid absent, 🧽 House cleaning
- Freeform text box for custom notices
- Feed shows newest first, with author + date
- Admin's "Digital Fridge" post still works alongside the open board

### 3.7 Community To-Do List
- Anyone can add a task with an optional due date and priority (Normal / High)
- Everyone can check tasks off (✓ toggle)
- Tasks sort by done-status then priority; overdue dates flagged red
- Admins get a **Delete** control; residents cannot delete

### 3.8 Community Calendar
- Month grid (Sun–Sat) with event-count dots on busy days
- Tap any day to view / add events (title, time, color)
- Month navigation (prev / next)
- Admins can delete events

### 3.9 Force Sync & Overwrite
- Overwrites the GitHub file from local data if it ever corrupts

### 3.10 House Settings
- Edit shared parameters: currency, meal rate, rent/person, internet/person,
  dinner cutoff hour, bazar interval, month-finalize day, resident count
- Billing reads these live

---

## 5. UI/UX

### 5.1 House Command Header
- Role badge (RESIDENT / ADMIN)
- Live sync status (⟳ syncing… / ✓ synced)
- User name + logout

### 5.2 Digital Fridge (Top Banner)
- Marquee scrolling banner
- Admin-pushed announcements
- Updates on residents' phones during next sync / app open

### 5.3 Maid's Matrix (Action Zone)
- Bold 3×2 grid of meal status
- **Dynamic Lock UI**: dinner locks at 4 PM, breakfast & lunch lock at 9 PM
- Locked slots turn grey + padlock 🔒
- No exceptions

### 5.4 Guilt-Trip Debt Visualizer
- Background color scales with financial standing:
  - 🟢 **Green** — balance +500 or more (Good Standing)
  - ⚪ **Grey** — neutral
  - 🟡 **Yellow** — debt approaching 1,000 TK (Attention)
  - 🔴 **Flashing Red** — debt exceeds 2,000 TK
    - Hardcoded warning: *"You are more than 2,000 in debt. Hand cash to Admin today."*

### 5.5 Bottom Navigation
- Resident: Dashboard / Community / Ledger
- Admin: Control / Community / Ledger Ops

---

## 6. Advanced Automation Modules (client-side, low compute)

### 6.1 Bazar Rotation Algorithm
- Modulus-based duty rotation based on day-of-year
- Shifts to the next resident every 3 days
- Badge: *"Today is Your Turn for Groceries!"* when it's your turn
- Shows next resident otherwise

### 6.2 Smart Vacation Mode
- Resident selects start/end dates on a calendar
- Meals auto-zeroed for those specific days
- Prevents accidental charges when forgetting to toggle off
- Add / remove vacation ranges

### 6.3 Auto-Excel Engine
"Finalize Month" generates a 3-tab `.xlsx`:
- **Tab 1 — Summary:** Total Grocery Spend, Meal Rate, Rent Split, Final Debts/Credits for all residents
- **Tab 2 — Daily Ledger:** row-by-row matrix of who ate what every day (the proof)
- **Tab 3 — Expense Log:** every approved deposit and grocery receipt chronologically
- Saved to local storage + opens the Android Share menu (WhatsApp group, etc.)

---

## 7. House Settings (configurable)

- Meal rate (default 70 TK)
- Rent per person (default 880 TK)
- Internet per person (default 40 TK)
- Dinner cutoff hour (default 21)
- Bazar interval days (default 3)
- **Month-finalize day / cutoffDay** (default 28) — gates month finalization
- Currency (default TK)
- Resident count (default 3)

---

## 8. File Map

```
src/
  lib/
    types.js          # data model + default ledger
    users.js          # hardcoded credentials (reference only)
    githubSync.js     # GitHub REST + ETag concurrency + offline queue
    excel.js          # 3-tab Excel export + native share
    logic.js          # meal lock, debt, bazar, vacation, finalize gate
  hooks/
    useAuth.js        # login/logout (role picker)
    useLedger.js      # central ledger state + sync
  components/
    RolePicker.jsx    # first-launch role selection (no password)
    Banner.jsx        # Digital Fridge marquee
    MealMatrix.jsx    # 3x2 meal grid + lock UI
    DebtCard.jsx      # debt visualizer
    BazarDuty.jsx     # rotation badge
    GuestLog.jsx      # guest plate adder
    VacationMode.jsx  # vacation date picker
    HouseSettings.jsx # config UI (meal rate, cutoffDay, etc.)
    AnnouncementFeed.jsx # community board (prebuilt + freeform posts)
    TodoList.jsx      # community to-do list
    Calendar.jsx      # community calendar month grid
    Layout.jsx        # app shell + bottom nav
  screens/
    ResidentDashboard.jsx
    ResidentLedger.jsx
    AdminControlCenter.jsx
    LedgerOperations.jsx
    CommunityScreen.jsx # shared announcements + calendar + todos
  App.jsx             # shell + tab routing
  sw.js               # offline service worker
  main.jsx            # entry point
```

---

## 8. What's NOT in this app (intentionally)

- ❌ No payment system, no Stripe, no in-app purchases
- ❌ No password login — role is picked once per device
- ❌ No server, no database hosting — everything is local + GitHub
