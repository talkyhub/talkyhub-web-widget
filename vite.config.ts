import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

// Two lives:
//  - `vite dev`   → serves index.html (the dev harness) and /src/loader.ts as a module.
//  - `vite build` → bundles the loader as a single self-contained IIFE that a customer's
//                   site loads with one <script data-token=…>. Preact + CSS are inlined.
export default defineConfig({
  plugins: [preact()],
  build: {
    lib: {
      entry: 'src/loader.ts',
      name: 'TalkyHubWidget',
      formats: ['iife'],
      fileName: () => 'loader.js',
    },
    outDir: 'dist/widget/v1',
    emptyOutDir: true,
    cssCodeSplit: false,
    target: 'es2019',
  },
})
