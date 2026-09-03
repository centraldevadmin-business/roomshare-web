// Cloudflare Worker — GitHub proxy.
//
// This is the security fix. The GitHub token lives here as a Cloudflare
// secret (never shipped to any browser). The app sends its requests to this
// Worker, which forwards them to the GitHub REST API using the server-side
// token. The public app bundle therefore contains NO token.
//
// Deploy with:  wrangler deploy
// Secrets:       GITHUB_TOKEN, GITHUB_USER, GITHUB_REPO
//
// The app calls:  GET  /contents/master_ledger.json
//                  PUT  /contents/master_ledger.json
// with the same ETag / If-Match concurrency headers it already uses.

const UPSTREAM = 'https://api.github.com'

export default {
  // `env` is a Cloudflare global holding your secrets.
  async fetch(req, env) {
    const cors = {
      'Access-Control-Allow-Origin': req.headers.get('Origin') || '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Accept, If-Match, Content-Type',
      // Expose etag so the app's If-Match concurrency loop keeps working
      // across the cross-origin request.
      'Access-Control-Expose-Headers': 'etag',
    }

    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: cors })
    }

    const cfg = {
      token: env.GITHUB_TOKEN || '',
      user: env.GITHUB_USER || '',
      repo: env.GITHUB_REPO || '',
    }

    if (!cfg.token || !cfg.user || !cfg.repo) {
      return json({ error: 'Worker misconfigured — missing secrets' }, 500, cors)
    }

    // The app requests the path relative to /contents/
    const path = req.url.split('/contents/')[1]
    if (!path) {
      return json({ error: 'bad path' }, 400, cors)
    }
    const upstreamUrl = `${UPSTREAM}/repos/${cfg.user}/${cfg.repo}/contents/${path}`

    const headers = new Headers()
    headers.set('Authorization', `token ${cfg.token}`)
    headers.set('Accept', 'application/vnd.github+json')
    headers.set('User-Agent', 'roomshare-worker')

    try {
      const res = await fetch(upstreamUrl, {
        method: req.method,
        headers,
        body: req.method === 'PUT' ? req.body : undefined,
      })
      const outHeaders = new Headers(res.headers)
      // The app uses the GitHub `sha` field for optimistic concurrency. If
      // Cloudflare's CDN caches the GET response (the upstream sends
      // `cache-control: private, max-age=60`), the browser can read a STALE
      // sha and then PUT with it, getting a perpetual 409 that the retry loop
      // can never resolve because every re-pull returns the same cached sha.
      // Disable caching on the contents endpoint so the app always gets a
      // fresh sha.
      if (req.method === 'GET') {
        outHeaders.set('Cache-Control', 'no-store')
      }
      for (const [k, v] of Object.entries(cors)) outHeaders.set(k, v)
      return new Response(res.body, { status: res.status, headers: outHeaders })
    } catch (e) {
      return json({ error: String(e) }, 502, cors)
    }
  },
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
