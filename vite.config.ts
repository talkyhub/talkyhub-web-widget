import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

const OUT_DIR = 'dist/widget/v1'

// The embed URL has to stay stable — it is pasted into customers' HTML and we can't ask them
// to edit it per release — but a file that changes must not be cached immutably. So each
// build also emits a content-hashed copy that never changes and can be cached forever, plus
// a manifest naming the current one. nginx caches `loader.js` for minutes and
// `loader.<hash>.js` for a year; a customer who needs a frozen build embeds the hashed name.
function emitVersionedCopy() {
  return {
    name: 'talkyhub-versioned-copy',
    closeBundle() {
      const source = join(OUT_DIR, 'loader.js')
      const code = readFileSync(source)
      const hash = createHash('sha256').update(code).digest('hex').slice(0, 12)
      writeFileSync(join(OUT_DIR, `loader.${hash}.js`), code)
      writeFileSync(
        join(OUT_DIR, 'manifest.json'),
        JSON.stringify(
          {
            loader: `loader.${hash}.js`,
            sha256: createHash('sha256').update(code).digest('base64'),
            bytes: code.length,
            builtAt: new Date().toISOString(),
          },
          null,
          2,
        ) + '\n',
      )
      // eslint-disable-next-line no-console
      console.log(`  versioned copy  ${OUT_DIR}/loader.${hash}.js`)
    },
  }
}

// Two lives:
//  - `vite dev`   → serves index.html (the dev harness) and /src/loader.ts as a module.
//  - `vite build` → bundles the loader as a single self-contained IIFE that a customer's
//                   site loads with one <script data-token=…>. Preact + CSS are inlined.
export default defineConfig({
  plugins: [preact(), emitVersionedCopy()],
  build: {
    lib: {
      entry: 'src/loader.ts',
      name: 'TalkyHubWidget',
      formats: ['iife'],
      fileName: () => 'loader.js',
    },
    outDir: OUT_DIR,
    emptyOutDir: true,
    cssCodeSplit: false,
    target: 'es2019',
  },
})
