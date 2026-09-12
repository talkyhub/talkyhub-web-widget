import { h, render } from 'preact'
import { Widget } from './widget/Widget'
import { loadConfig } from './core/config'
import css from './widget/styles.css?inline'

// Captured synchronously at script execution — in the built IIFE this is the customer's
// <script data-token=…>. In dev (a module script) it's null, so we fall back to a global.
const bootScript = document.currentScript as HTMLScriptElement | null

interface Settings {
  token?: string
  apiBase?: string
}

function readSettings(): Settings {
  const w = window as unknown as { talkyhubSettings?: Settings }
  if (w.talkyhubSettings) return w.talkyhubSettings
  return { token: bootScript?.dataset.token, apiBase: bootScript?.dataset.api }
}

async function boot(): Promise<void> {
  if (document.getElementById('talkyhub-widget-host')) return // guard against double-inject
  const { token, apiBase = '' } = readSettings()

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

  const config = await loadConfig(token, apiBase)
  render(h(Widget, { config }), mount)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void boot())
} else {
  void boot()
}
