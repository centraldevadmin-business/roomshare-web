# House Ledger — Complete Feature List

A zero-cost household meal & expense tracker. Runs as a Progressive Web App
(installable on any phone) backed by a single private GitHub repo. No server,
no database hosting, no monthly fees.

---

## 0. Credentials (hardcoded — just log in)

No signup, no user creation. Three accounts only.

| Name | Username | Password | Role |
|---|---|---|---|
| Nafiz | `nafiz` | `Nafiz!Ledger@2026#Secure` | admin (full access) |
| Mohin | `mohin` | `Mohin!Bazar@2026#Fresh` | cadmin (looks like admin; silently denied user management + deleting expenses) |
| Neloy | `neloy` | `Neloy!Meal@2026#Tasty` | resident |

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

## 2. Resident APK Features

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

## 3. Admin APK Features

### 3.1 Deposit Approval Inbox
- Sees "Member B submitted 500 TK"
- **[Verify]** locks it into the ledger (status → Approved)
- **[Reject]** if cash wasn't actually handed over (status → Rejected)

### 3.2 Expense Input
- Exclusive ability to log daily groceries and fixed monthly utilities
- Expense types: Groceries, Utilities, Repairs, Other
- Fields: type, amount, date, vendor, note

### 3.3 Ledger Corrections (Undo)
- **24-hour window** to delete or edit an entry before it locks
- Status tags: OPEN (editable) → POSTED (locked by time) → LOCKED (manually locked)
- Lock / Delete buttons appear only within the window

### 3.4 Month Finalization
- Single button runs the final math
- Zeroes out meal counters
- Carries debts/credits forward to a fresh month node
- Generates the 3-tab Excel report and opens the native share menu
- **Gated by `cutoffDay`** (House Settings → "Month-finalize day", default 28): the month can't be finalized until the current day-of-month reaches `cutoffDay`. The button is disabled and a warning shows until then, so a month can't be prematurely closed mid-cycle.

### 3.5 Digital Fridge
- Push announcement text strings (e.g. "Maid is absent tomorrow, order food")
- Scrolls on residents' phones on next sync / app open

### 3.6 Force Sync & Overwrite
- Overwrites the GitHub file from local data if it ever corrupts

---

## 4. UI/UX

### 4.1 House Command Header
- Role badge (RESIDENT / ADMIN)
- Live sync status (⟳ syncing… / ✓ synced / ⚠ error)
- User name + logout

### 4.2 Digital Fridge (Top Banner)
- Marquee scrolling banner
- Admin-pushed announcements
- Updates on residents' phones during next sync / app open

### 4.3 Maid's Matrix (Action Zone)
- Bold 3×2 grid of meal status
- **Dynamic Lock UI**: at/after 9 PM, Breakfast & Lunch turn grey + padlock 🔒
- Dinner stays open after 9 PM
- No exceptions

### 4.4 Guilt-Trip Debt Visualizer
- Background color scales with financial standing:
  - 🟢 **Green** — balance +500 TK or more (Good Standing)
  - ⚪ **Grey** — neutral
  - 🟡 **Yellow** — debt approaching 1,000 TK (Attention)
  - 🔴 **Flashing Red** — debt exceeds 2,000 TK
    - Hardcoded warning: *"You are severely behind on payments. Hand cash to Admin today."*

### 4.5 Bottom Navigation
- Resident: Dashboard / Ledger
- Admin: Control / Ledger Ops

---

## 5. Advanced Automation Modules (client-side, low compute)

### 5.1 Bazar Rotation Algorithm
- Modulus-based duty rotation based on day-of-year
- Shifts to the next resident every 3 days
- Badge: *"Today is Your Turn for Groceries"* when it's your turn
- Shows next resident otherwise

### 5.2 Smart Vacation Mode
- Resident selects start/end dates on a calendar
- Meals auto-zeroed for those specific days
- Prevents accidental charges when forgetting to toggle off
- Add / remove vacation ranges

### 5.3 Auto-Excel Engine
"Finalize Month" generates a 3-tab `.xlsx`:
- **Tab 1 — Summary:** Total Grocery Spend, Meal Rate, Rent Split, Final Debts/Credits for all residents
- **Tab 2 — Daily Ledger:** row-by-row matrix of who ate what every day (the proof)
- **Tab 3 — Expense Log:** every approved deposit and grocery receipt chronologically
- Saved to local storage + opens the Android Share menu (WhatsApp group, etc.)

---

## 6. File Map

```
src/
  lib/
    types.js          # data model + default ledger
    users.js          # hardcoded credentials
    githubSync.js     # GitHub REST + ETag concurrency + offline queue
    excel.js          # 3-tab Excel export + native share
    logic.js          # meal lock, debt, bazar, vacation
  hooks/
    useAuth.js        # login/logout
    useLedger.js      # central ledger state + sync
  components/
    Banner.jsx        # Digital Fridge marquee
    MealMatrix.jsx    # 3x2 meal grid + 9 PM lock
    DebtCard.jsx      # debt visualizer
    BazarDuty.jsx     # rotation badge
    GuestLog.jsx      # guest plate adder
    VacationMode.jsx  # vacation date picker
    Layout.jsx        # app shell + bottom nav
  screens/
    LoginScreen.jsx
    ResidentDashboard.jsx
    ResidentLedger.jsx
    AdminControlCenter.jsx
    LedgerOperations.jsx
  App.jsx             # shell + tab routing
  sw.js               # offline service worker
  main.jsx            # entry point
```

---

## 7. How to Run

```bash
cd /Users/nafiz/roomshare
npm install          # already done
npm run dev          # start dev server
```

1. Create a private GitHub repo `roomshare-data`
2. Generate a fine-grained token with Read & Write access
3. `cp .env.example .env.local` and fill in `VITE_GITHUB_USER`, `VITE_GITHUB_REPO`, `VITE_GITHUB_TOKEN`
4. Log in — the app seeds `master_ledger.json` on first sync

Deploy free on GitHub Pages / Netlify / Cloudflare Pages via `npm run build`.
