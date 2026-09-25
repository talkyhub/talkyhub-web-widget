import { h, render } from 'preact'
import { Widget } from './widget/Widget'
import { applyOverrides, loadConfig } from './core/config'
import type { AppearanceOverrides } from './core/config'
import { callHost } from './core/store'
import type { HostUser } from './core/identity'
import css from './widget/styles.css?inline'

// Captured synchronously at script execution — in the built IIFE this is the customer's
// <script data-token=…>. In dev (a module script) it's null, so we fall back to a global.
const bootScript = document.currentScript as HTMLScriptElement | null

interface Settings {
  token?: string
  apiBase?: string
  // Optional per-page appearance overrides; the dashboard config wins by default.
  appearance?: AppearanceOverrides
  // The host app's signed-in user: prefill, and with identifier + identifier_hash, verified
  // identity. `null` means "nobody is signed in". See docs/identity.md.
  user?: HostUser | null
}

// Runtime API for the host page. Defined synchronously, the moment this script executes, so an
// app can call it as soon as its own auth resolves; calls that arrive before the widget has
// mounted are queued and replayed (store.callHost). Code that may run before this script has
// even loaded should pass `user` in talkyhubSettings instead, or wait for `talkyhub:ready`.
const api = {
  /** Identify the signed-in user. `null` is a logout. A no-op for the same user and details. */
  setUser(user: HostUser | null): void {
    callHost({ name: 'setUser', user })
  },
  /** Forget this browser's visitor. Call it on logout on any device people share. */
  reset(): void {
    callHost({ name: 'reset' })
  },
}
;(window as unknown as { TalkyHub?: typeof api }).TalkyHub = api

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
  const { token, apiBase = '', appearance, user } = readSettings()

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
  // `user` goes in as a prop, not through the setUser queue: known before the first render, it
  // lets the widget choose form-or-session correctly on the first try.
  render(h(Widget, { config, user }), mount)
  window.dispatchEvent(new CustomEvent('talkyhub:ready'))
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void boot())
} else {
  void boot()
}
