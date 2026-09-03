// Verify the new nafiz password works on the live app.
import pkg from '/Users/nafiz/roomshare/node_modules/playwright/index.js'
const { chromium } = pkg
const PW = process.argv[2]
const url = 'https://7ec16a3a.roomshare-app.pages.dev/'
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage({ viewport: { width: 1280, height: 800 } })
await p.goto(url, { waitUntil: 'networkidle' })
await p.fill('input[placeholder="Username"]', 'nafiz')
await p.fill('input[placeholder="Password"]', PW)
await p.click('button[type="submit"]')
await p.waitForTimeout(2500)
const body = (await p.evaluate(() => document.body.innerText)).slice(0, 200)
const ok = body.includes('House Command')
console.log(ok ? 'PASS' : 'FAIL', '->', body.split('\n').filter(l => l.trim()).slice(0, 2).join(' | '))
await b.close()
process.exit(ok ? 0 : 1)
