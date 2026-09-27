import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

const OUT_DIR = 'dist/widget/v1'

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }

// Which commit produced these bytes. Until now a live bundle could not be traced back to one:
// manifest.json recorded the content hash, which says WHICH bytes are serving but nothing about
// where they came from. CI sets GITHUB_SHA; locally fall back to git; 'dev' when neither exists
// (a build from a tarball, say).
function buildCommit(): string {
  const sha = process.env.GITHUB_SHA
  if (sha) return sha.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'dev'
  }
}

const COMMIT = buildCommit()

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
            version: pkg.version,
            commit: COMMIT,
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
  // Inlined at build time so the running bundle can say what it is — see src/core/version.ts.
  define: {
    __WIDGET_VERSION__: JSON.stringify(pkg.version),
    __WIDGET_COMMIT__: JSON.stringify(COMMIT),
  },
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
