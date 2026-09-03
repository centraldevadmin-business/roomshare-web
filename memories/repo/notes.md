# House Ledger — Repo Notes

## Build & Test
- Build: `npm run build` (Vite 5). Target: `dist/`, base: './' for static hosting.
- Unit tests: `node test/core.test.mjs` — pure logic, no browser. 50 assertions, all pass.
- Tests import modules directly: users.js, logic.js, types.js, excel.js, githubSync.js.

## Gotchas
- **ESM imports need `.js` extension** even for sibling files. Vite resolves `./types` in browser, but Node test harness fails. Always write `./types.js`.
- **`todayStr()` must NOT use `toISOString()`** — it returns UTC, so UTC+6 users (Bangladesh) get the previous day. Use local Y/m/d formatting instead.
- Credentials: resident1/2/3 → resident123, admin → admin123. All generic names.

## Data Model
- Single `master_ledger.json` in private GitHub repo. 4 nodes: house_config, meal_log, expense_log, deposit_ledger.
- Sync: ETag optimistic concurrency + local queue retry on 409. Offline queue in localStorage.

## Community features (added this session)
- Data model: `todos: []` + `calendar_events: []` in `buildDefaultLedger` (types.js).
- PREBUILT_ANNOUNCEMENTS (6 templates) in types.js.
- Logic helpers: `buildCalendarGrid(year,month)`, `eventsOnDate(events,dateStr)` in logic.js.
- Queue ops in githubSync.js QUEUE_OPS: postAnnouncement (unshift, newest first), addTodo, toggleTodo, deleteTodo, addEvent, deleteEvent.
- useLedger.js returns: postAnnouncement, addTodo, toggleTodo, deleteTodo, addEvent, deleteEvent.
- Components: AnnouncementFeed.jsx, TodoList.jsx, Calendar.jsx. Screen: CommunityScreen.jsx.
- App.jsx tabs: Resident = Dashboard / Community / Ledger; Admin = Control / Community / Ledger Ops.
- deleteTodo/deleteEvent gated to admin role; postAnnouncement open to everyone.
- Test count now 74 (was 65). Test env "today" is the 24th; Aug 2026 starts Saturday, Sep 2026 starts Tuesday.

## Co-admin (cadmin) access model
- `src/lib/security.js`: new `cadmin` role, label 'Admin' (identical to admin so flat owner sees no difference). Permissions: expenses.log/edit, deposits.approve, month.finalize, config.edit, announcements.post, meals.toggle/view, ledger.view, community.post. WITHHELD: users.manage, expenses.delete.
- `src/lib/users.js`: resident3 → role 'cadmin'; RESIDENT_IDS now filters `role === 'resident' || 'cadmin'` so he's still counted in meals/settlement.
- `src/hooks/useLedger.js`: `isFullAdmin()` = `session?.role === 'admin'` (real admin only). deleteExpense/updateUser/deleteUser/setUserActive gated on `!isFullAdmin()`. createUser: `if (session && !isFullAdmin()) return` BEFORE the dynamic security import so no-session signup still works (first user becomes admin).
- `src/App.jsx`: `isAdmin = role === 'admin' || 'cadmin'` → identical nav.

## Maid Board (added this session)
- `src/components/MaidBoard.jsx`: glanceable "Cook for N" summary. Reads `ledger.meal_log` for today, aggregates plates+guests per meal (breakfast/lunch/dinner) across RESIDENT_IDS. Big head-count rows per meal, per-person "who's eating what" grid, quick head-count toggle buttons (calls toggleMeal), and one-tap alert buttons (No gas / No water / No electricity / Need bazar cash / Maid absent) that call postAnnouncement. Uses isSlotLocked to grey out locked slots. Props: { ledger, toggleMeal, postAnnouncement }.
- App.jsx: new ADMIN tab 'maid' = 'Maid Board'; renders MaidBoard.
- Background sync timing: 04:00 + 16:00 (was 04:00 + 17:00). Admin stagger 0, residents +2/+4/+6 min.

## UI redesign (emoji → SVG icons)
- NO emoji anywhere. All icons from `src/components/Icons.jsx` (pure SVG, `stroke="currentColor"`).
- Animations in `index.css` (`.animate-fade-up`, `.animate-pop`, `.animate-float`, `.shimmer-bar`, `.stagger-N`) + Tailwind keyframes.
- `PREBUILT_ANNOUNCEMENTS` in types.js use icon *keys* (fire/water/zap/cart/broom/sparkle), mapped in AnnouncementFeed ICON_MAP.

## Accounts (hardcoded, no signup — replaced generic resident1/2/3/admin)
- Nafiz / `nafiz123` / admin (full access). Mohin / `mohin123` / cadmin (looks like admin; silently denied users.manage + expenses.delete). Neloy / `neloy123` / resident.
- Accounts live in `src/lib/users.js` (USERS array). `seedUsers()` clones them into `buildDefaultLedger().users` so login works (LoginSignup authenticates against ledger.users via security.js async authenticate).
- `authenticate` in users.js is async (crypto.subtle.digest SHA-256 of `${salt}:${password}`), matches security.js shape.

## Notifications (added this session)
- NO server = NO true background push. Notifications only fire while the app is OPEN on a phone. Reminders fire based on wall-clock while app open.
- `src/lib/notifications.js` = pure, testable detection (no React): isWithinWindow, hasEntered, mealSlotCount, mealReminderState, mealSummaryState, newAnnouncement, requestNotificationPermission, showNotification.
- `src/hooks/useNotifications.js` = React wrapper: requestPermission on login, ticks every 60s.
- Reminder windows: evening 21-22h → breakfast+lunch tomorrow; afternoon 14-15h → dinner tomorrow; summary at 04:00 & 16:00. Dedup by tag.
- App.jsx calls `useNotifications(session, ledger.ledger)`.
- Test count now 91 (was 74). `newAnnouncement` needs a localStorage stub in tests.

## UI test harness gotchas (fixed this session)
- `\p{Emoji}/u` wrongly matches ASCII digits 0-9 and `*`. Use explicit ranges; exclude `\u{2190}-\u{21FF}` (typographic arrows like → are legit, not emoji).
- `applyQueue` is in `githubSync.js`, NOT `logic.js`. It swallows op errors internally (`console.warn`) and returns `changed` — a gated op (finalizeMonth) won't throw; verify its effect (logs untouched, no archive) instead.
- `buildDefaultLedger` is a function — must call it: `buildDefaultLedger()`.
- React SSR inserts `<!-- -->` between a number and text: `2<!-- --> guest plate...` so "2 guest plate(s)..." is NOT a contiguous substring.
- `bazarDuty` uses `new Date()` internally — tests must derive duty resident dynamically, not hardcode `currentResident`.
- `computeDebt` returns `credited + carried - owed` (opposite sign of intuition).
- `canFinalizeMonth` message names the cutoff day VALUE (e.g. "28"), not the word.
- `AdminControlCenter.jsx` imports `PlateIcon` from Icons; `ResidentDashboard.jsx` imports `computeDebt` from logic — both were missing imports (real runtime bugs, fixed).
- Status: core 80/80, UI 112/112, build OK.

## Billing model (per-person rent + fixed costs + variable utilities)
- `src/lib/logic.js`: `rentForResident(config, resident)` reads `config.rentByResident` map (0 = rent-free); `fixedCostShare(config,n)` splits `config.fixedCosts` (`{name,total}`) equally; `utilityShare(ledger,n)` pools `utility`-type expenses equally. `computeDebt` = rent + fixedShare + utilityShare − approved deposits − carried.
- `defaultHouseConfig` (types.js): `rentByResident = {nafiz:7000, mohin:0, neloy:6000}`, `rentFreeResident: null`, `fixedCosts: []`. Legacy `rentPerPerson:880` fallback kept.
- Fixed costs seeded in `master_ledger.json`: Internet 800, Gas 1080, Service 2200, Maid 3000 (total 7080 → 2360/person).
- `computeSettlement` surplus deducts rent→fixed→utilities; leftover carries forward.

## Cloudflare Worker proxy (security fix — token lives server-side)
- `workers/proxy.mjs` + `workers/wrangler.toml` (name=roomshare-proxy). Browser → Worker → GitHub. Token is a Cloudflare secret, NEVER in the app bundle.
- Secrets set via stdin (NOT `--value`): `echo -n '<val>' | wrangler secret put KEY`. wrangler v4.
- wrangler auth uses `CLOUDFLARE_API_TOKEN` env var (NOT `WRANGLER_APITOKEN`).
- wrangler writes to `/Users/nafiz/Library/Preferences/.wrangler` — sandbox blocks it. Run with `requestUnsandboxedExecution=true`.
- **BUG (fixed):** upstream URL must be `repos/{user}/{repo}/contents/{path}` — the `/contents/` segment is REQUIRED or GitHub returns 404.
- Deployed URL: `https://roomshare-proxy.central-dev-admin.workers.dev`. App `.env.local` `VITE_WORKER_URL` points here.
- App routes all GitHub sync through the Worker in `src/lib/githubSync.js` (`API = import.meta.env.VITE_WORKER_URL`).

## Deployment
- Web app → GitHub Pages via `.github/workflows/deploy.yml` (peaceiris/actions-gh-pages, publishes `dist/`). Also deployable manually: push `dist/*` to `gh-pages` branch.
- Data repo: `centraldevadmin-business/roomshare-data` (private) holds `master_ledger.json`. Seeded with initial ledger + fixed costs.
- Live site: https://centraldevadmin-business.github.io/roomshare-web/

## Security — token rotation (CRITICAL)
- Old token was LEAKED into the public app bundle. MUST be revoked at github.com/settings/tokens.
- New token is now used in: (1) git remote `origin`, (2) Cloudflare Worker secret `GITHUB_TOKEN`, (3) GitHub Action secrets.
- After rotating, redeploy the Worker (`wrangler deploy`) — updating the secret alone does NOT update the running Worker.
- `.env.local` is gitignored. `workers/.npm-cache` and `workers/node_modules` are gitignored.

## Push notifications (real background)
- `.github/workflows/push.yml`: every 5 min, reads ledger, sends VAPID pushes via `scripts/send-push.mjs` (web-push npm). Needs secrets: VAPID_PRIVATE_KEY, VITE_GITHUB_TOKEN, VITE_GITHUB_REPO, VITE_GITHUB_USER.
- `src/sw-push.js` = push receiver (separate from offline `src/sw.js`). `src/lib/pushSubscribe.js` registers + writes subscription to ledger.
- `src/lib/pushDecisions.js` = pure decision logic (Node-runnable).

## Test status
- Core: 103/103 (`node test/core.test.mjs`). UI: 112/112 (`node test/run-ui.mjs`, bundles JSX via esbuild first). Build: OK (546 kB).

## LIVE DEPLOY (2026-09-03)
- App URL: https://7ec16a3a.roomshare-app.pages.dev/ (Cloudflare Pages, project roomshare-app).
- Worker proxy: https://roomshare-proxy.central-dev-admin.workers.dev (deployed via wrangler, version 9ea00648).
- Web repo: centraldevadmin-business/roomshare-web (pushed). Data repo: centraldevadmin-business/roomshare-data.
- Cloudflare API key: stored in the environment (CLOUDFLARE_API_TOKEN); session-scoped, re-deploy with it. Do NOT paste the raw key into this file — GitHub secret scanning will reject the push.
- Deploy commands: `npm run build` then `CLOUDFLARE_API_TOKEN=... ./workers/node_modules/.bin/wrangler pages deploy dist --project-name=roomshare-app`; Worker: `cd workers && CLOUDFLARE_API_TOKEN=... ./node_modules/.bin/wrangler deploy`.
- Playwright is in LOCAL node_modules (`/Users/nafiz/roomshare/node_modules/playwright/index.js`), NOT /tmp/pwtest (that path is gone).

## Bug fixed: announcement data-loss
- AdminControlCenter `setAnnouncement` (QUEUE_OP) REPLACED the whole `announcements` array, wiping every resident's community post whenever an admin posted a fridge note. Changed to `unshift` (append newest-first, by:'Admin') in githubSync.js. Tests updated (core.test.mjs, ui.test.mjs).

## Credentials (updated)
- All 3 users share strong password: `House@Ledger#2026!` (nafiz=admin, mohin=cadmin, neloy=resident). Ledger encryption password (separate): house2026.
