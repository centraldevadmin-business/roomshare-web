import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Zero-cost hosting: build with `npm run build` and deploy the `dist/` folder
// to GitHub Pages (or any static host). No server required.
export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic',
    }),
  ],
  base: './',
  // Expose the committed VAPID public key to the client bundle as
  // import.meta.env.VITE_PUSH_PUBLIC_KEY. The key is public (not secret); the
  // private key stays a GitHub secret and is only used by the scheduled Action.
  define: {
    '__VITE_PUSH_PUBLIC_KEY__': JSON.stringify(
      readFileSync(
        fileURLToPath(new URL('./public/vapid-public-key.txt', import.meta.url)),
        'utf8',
      ).trim(),
    ),
  },
})
