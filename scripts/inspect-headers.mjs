// Inspect the headers the proxy returns for a GET on the ledger file.
const API = process.env.VITE_WORKER_URL || 'https://roomshare-proxy.central-dev-admin.workers.dev'
const url = `${API}/contents/master_ledger.json`
const res = await fetch(url)
console.log('status:', res.status)
console.log('--- headers ---')
for (const [k, v] of res.headers.entries()) console.log(k, ':', v)
const data = await res.json()
console.log('--- content keys ---', Object.keys(data))
console.log('content length:', data.content?.length)
