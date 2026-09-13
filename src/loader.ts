import { h, render } from 'preact'
import { Widget } from './widget/Widget'
import { applyOverrides, loadConfig } from './core/config'
import type { AppearanceOverrides } from './core/config'
import css from './widget/styles.css?inline'

// Captured synchronously at script execution — in the built IIFE this is the customer's
// <script data-token=…>. In dev (a module script) it's null, so we fall back to a global.
const bootScript = document.currentScript as HTMLScriptElement | null

interface Settings {
  token?: string
  apiBase?: string
  // Optional per-page appearance overrides; the dashboard config wins by default.
  appearance?: AppearanceOverrides
}

function readSettings(): Settings {
  const w = window as unknown as { talkyhubSettings?: Settings }
  if (w.talkyhubSettings) return w.talkyhubSettings
  const d = bootScript?.dataset
  return {
    token: d?.token,
    apiBase: d?.api,
    appearance: { accent: d?.accent, position: d?.position, launcher: d?.launcher },
  }
}

async function boot(): Promise<void> {
  if (document.getElementById('talkyhub-widget-host')) return // guard against double-inject
  const { token, apiBase = '', appearance } = readSettings()

  const host = document.createElement('div')
  host.id = 'talkyhub-widget-host'
  document.body.appendChild(host)

  // Shadow DOM isolates our CSS from the host page (and vice versa). Swap for an iframe
  // when full origin isolation is needed — the mount seam stays the same.
  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = css
  shadow.appendChild(style)
  const mount = document.createElement('div')
  shadow.appendChild(mount)

  const config = applyOverrides(await loadConfig(token, apiBase), appearance)
  render(h(Widget, { config }), mount)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void boot())
} else {
  void boot()
}
