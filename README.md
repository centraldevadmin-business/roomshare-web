# House Ledger

A **zero-cost** household meal & expense tracker. Runs entirely in the browser as a
Progressive Web App (installable on any phone) and uses a **private GitHub repo** as
its database — no server, no database hosting, no monthly fees.

---

## What it does

- **Real push notifications** — meal reminders, summaries, and announcements land on everyone's phone even with the app closed (see "Push notifications" below).
- **3 house members**, hardcoded credentials. Just log in — no signup, no user creation.
- **Meal tracking** — toggle Breakfast / Lunch / Dinner per day. Guests (+1 / +2) auto-charge the account.
- **9 PM meal lock** — Breakfast & Lunch turn grey + padlocked after 9 PM. No exceptions.
- **Deposit requests** — residents request cash handed to the admin; admin **Verifies** or **Rejects**.
- **Expense logging** — admin logs groceries & utilities. **24-hour undo window** before entries lock.
- **Debt visualizer** — card color scales with standing (green → grey → yellow → flashing red with a warning).
- **Bazar rotation** — modulus-based grocery duty that shifts every 3 days.
- **Vacation mode** — pause meals for selected date ranges.
- **Digital Fridge** — admin pushes announcements that scroll on residents' phones.
- **Month Finalization** — runs the final math, zeroes meal counters, carries balances forward, and **generates a 3-tab Excel report** that opens the native share menu. Gated by the "Month-finalize day" setting so it can't be closed mid-month.

---

## The 4 screens

| Screen | Who | What |
|---|---|---|
| **Dashboard** | Resident | Bazar duty, debt card, meal matrix, guests, vacation |
| **Ledger** | Resident | My balance, everyone's balances, deposit request form |
| **Control Center** | Admin | Deposit inbox, daily matrix, finalize month, force-sync |
| **Ledger Operations** | Admin | Log expenses, view/correct/delete operations |

---

## Credentials (hardcoded)

| Name | Username | Password | Role |
|---|---|---|---|
| Nafiz | `nafiz` | `Nafiz!Ledger@2026#Secure` | admin (full access) |
| Mohin | `mohin` | `Mohin!Bazar@2026#Fresh` | cadmin (looks like admin; silently denied user management + deleting expenses) |
| Neloy | `neloy` | `Neloy!Meal@2026#Tasty` | resident |

---

## Setup (takes ~5 minutes, $0)

### 1. Create the data repo

1. Create a **new private** GitHub repo called `roomshare-data`.
2. (Optional) Drop an initial `master_ledger.json` in the repo, or let the app seed it on first sync.

### 2. Deploy the token-holding Worker (this is what keeps your data private)

The GitHub token lives **server-side** in a Cloudflare Worker — never in the app bundle.
The browser talks to the Worker, which forwards requests to GitHub using the token.

```bash
cd workers
npm install -g wrangler          # one-time
wrangler login                   # log in with your Cloudflare account
wrangler secret put GITHUB_TOKEN <your-token>
wrangler secret put GITHUB_USER  centraldevadmin-business
wrangler secret put GITHUB_REPO  roomshare-data
wrangler deploy                  # prints https://roomshare-proxy.<username>.workers.dev
```

Copy the printed Worker URL.

### 3. Configure the app

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local`:

```env
VITE_GITHUB_USER=centraldevadmin-business
VITE_GITHUB_REPO=roomshare-data
VITE_WORKER_URL=https://roomshare-proxy.<username>.workers.dev
```

> `.env.local` is gitignored — never commit it. The token is **not** in this file; it lives
> only in the Worker's secrets.

### 4. Run locally

```bash
npm run dev
```

Open the printed `http://localhost:5173`, log in, and the app will create
`master_ledger.json` in your repo on first sync.

### 5. Deploy for free

Build and host the `dist/` folder on **GitHub Pages** (or Netlify / Cloudflare Pages — all free):

```bash
npm run build
```

Then share the link. Everyone installs it to their home screen ("Add to Home Screen") and it
works offline.

---

## How sync works (no crashes)

GitHub is used as a single-file JSON database. To avoid the classic `409 Merge Conflict`
when two phones edit at once, the app uses **ETag optimistic concurrency**:

1. `GET` the file → GitHub returns an ETag (version fingerprint).
2. Edit locally, then `PUT` with `If-Match: <etag>`.
3. If someone else changed it → GitHub returns `409`. The app **re-pulls, merges its local
   queue on top, and retries** — it never crashes.
4. Offline edits are queued in `localStorage` and flushed on the next sync.

This replaces the old "staggered sync times" idea with something strictly more robust.

### Where the token lives

The browser never talks to GitHub directly. Every sync request is routed through a
**Cloudflare Worker** (`workers/proxy.mjs`) that holds the GitHub token as a Cloudflare
secret. The public app bundle therefore contains **no token at all** — the token only ever
exists server-side. (The scheduled GitHub Action also holds the token as a GitHub secret,
which is fine because it runs server-side and is never shipped to a browser.)

---

## Push notifications (real, even when the app is closed)

Notifications land on everyone's phone **no matter where they are, even with the app closed**. This works with a scheduled GitHub Action (free) that reads the ledger and sends VAPID pushes to each phone.

**What pushes people get:**
- **9–10 PM** — "You haven't said yet — do you want breakfast + lunch tomorrow?" (only for people who forgot to enter)
- **2–3 PM** — "You haven't said whether you want dinner tomorrow."
- **4 AM & 4 PM** — "House meals today: Breakfast: X · Lunch: Y · Dinner: Z"
- **Any announcement** — the instant someone posts one, everyone's phone buzzes.

**Setup (one-time, ~5 minutes):**

1. **Generate a VAPID keypair** (the public key is committed to the repo; the private key is a secret). Run this once and copy the two values:
   ```bash
   node -e "const c=require('crypto');const {publicKey,privateKey}=c.generateKeyPairSync('ec',{namedCurve:'prime256v1'});console.log('PUBLIC='+publicKey.export({type:'spki',format:'der'}).toString('base64url'));console.log('PRIVATE='+privateKey.export({type:'pkcs8',format:'der'}).toString('base64url')))"
   ```
   The public key is already written to `public/vapid-public-key.txt`.

2. **Add secrets** to your repo → Settings → Secrets and variables → Actions:
   | Secret | Where from |
   |---|---|
   | `VAPID_PRIVATE_KEY` | the PRIVATE value from step 1 |
   | `VITE_GITHUB_TOKEN` | a token with read/write to `roomshare-data` (server-side, never in the app) |
   | `VITE_GITHUB_REPO` | `roomshare-data` |
   | `VITE_GITHUB_USER` | your GitHub username |
   | `VITE_PUSH_PUBLIC_KEY` | the PUBLIC value from step 1 |

3. **Enable Actions** in the repo settings (Settings → Actions → General → "Allow GitHub Actions to create and update GitHub workflow files" or "Read and write permissions").

4. **Deploy the app** (step 4 above). The first time anyone opens it and grants notification permission, their phone registers a subscription that gets written to the ledger. From then on, the Action fires pushes on their schedule.

> The Action runs every 5 minutes on GitHub's free runners (~600 runs/month, well under the 2000 free monthly minutes).

---

## Project structure

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
    useNotifications.js # client-side reminder ticking (app-open only)
  lib/
    notifications.js  # pure reminder/announcement detection
    pushDecisions.js  # pure "what to push" logic (runs in the Action)
    pushSubscribe.js  # browser: register SW + create push subscription
  components/         # Banner, MealMatrix, DebtCard, BazarDuty, GuestLog, VacationMode, Layout
  screens/            # Login, ResidentDashboard, ResidentLedger, AdminControlCenter, LedgerOperations
  App.jsx             # shell + tab routing
  sw.js               # offline service worker
  sw-push.js          # push service worker (receives background pushes)
scripts/
  send-push.mjs       # scheduled Action: reads ledger, sends VAPID pushes
workers/
  proxy.mjs           # Cloudflare Worker: holds the GitHub token server-side
  wrangler.toml       # Worker config
.github/workflows/push.yml  # runs send-push.mjs every 5 minutes
```

---

## Security notes

- Credentials live in the browser bundle (client-side, zero cost), so they are **not secret**.
  The real protection is the **private GitHub repo** + admin-only UI actions.
- The GitHub token is **never in the app bundle**. It lives server-side in a Cloudflare Worker
  (`workers/proxy.mjs`) as a Cloudflare secret. The browser only talks to the Worker.
- The scheduled GitHub Action also holds the token as a GitHub secret — fine because it runs
  server-side and is never shipped to a browser.
- For a 4-person house on a free tier, this is the right tradeoff. If you need real secrets,
  move auth behind a server.
