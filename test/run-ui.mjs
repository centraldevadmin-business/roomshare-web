// Bundles the JSX test with esbuild, then runs it in Node. No browser, no server.
// NOTE: use fileURLToPath(), NOT url.pathname — .pathname percent-encodes
// spaces in the directory name ("My development" -> "My%20development") and
// esbuild then fails to resolve the entry point.
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { rmSync } from 'node:fs'

const outfile = fileURLToPath(new URL('./.ui-bundle.mjs', import.meta.url))
try {
  await build({
    entryPoints: [fileURLToPath(new URL('./ui.test.mjs', import.meta.url))],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'warning',
    jsx: 'automatic',
    jsxImportSource: 'react',
    // react-dom/server is already in node_modules; keep it external so Node resolves it.
    external: ['react', 'react-dom', 'react-dom/server', 'xlsx'],
  })
  await import(pathToFileURL(outfile).href)
} catch (e) {
  console.error(e)
  process.exit(1)
} finally {
  rmSync(outfile, { force: true })
}
