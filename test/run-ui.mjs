// Bundles the JSX test with esbuild, then runs it in Node. No browser, no server.
import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import { rmSync } from 'node:fs'

const outfile = new URL('./.ui-bundle.mjs', import.meta.url)
try {
  await build({
    entryPoints: [new URL('./ui.test.mjs', import.meta.url).pathname],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: outfile.pathname,
    logLevel: 'warning',
    jsx: 'automatic',
    jsxImportSource: 'react',
    // react-dom/server is already in node_modules; keep it external so Node resolves it.
    external: ['react', 'react-dom', 'react-dom/server', 'xlsx'],
  })
  await import(outfile.href)
} catch (e) {
  console.error(e)
  process.exit(1)
} finally {
  rmSync(outfile, { force: true })
}
