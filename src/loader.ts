import { h, render } from 'preact'
import { effect } from '@preact/signals'
import type { Signal } from '@preact/signals'
import { Widget } from './widget/Widget'
import { DEFAULT_CONFIG, applyOverrides, loadConfig, parseRemoteConfig } from './core/config'
import type { AppearanceOverrides } from './core/config'
import { callHost, closeWidget, isOpen, openWidget, pinOpen, toggleWidget, unread } from './core/store'
import { useMemoryStorage } from './core/session'
import { BUILD } from './core/version'
import type { HostUser } from './core/identity'
import type { WidgetConfig } from './core/types'
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
  // No launcher — everywhere (true / 'always') or only on phones ('mobile'). The page opens the
  // chat itself: TalkyHub.open(), or any element with data-talkyhub-open.
  hideLauncher?: boolean | 'always' | 'mobile' | 'never'
  // Render the conversation inside this element (or selector) instead of floating: always open,
  // no launcher. For a /support page or a full-screen chat in an app's web view.
  container?: string | HTMLElement
  // The dashboard's live preview (preview.html): fake chat, nothing stored, settings arrive by
  // postMessage from the app. Not something to set on a real site.
  preview?: boolean
}

const HOST_ID = 'talkyhub-widget-host'

// Runtime API for the host page. Defined synchronously, the moment this script executes, so an
// app can call it as soon as its own auth resolves; calls that arrive before the widget has
// mounted are queued and replayed (store.callHost). Code that may run before this script has
// even loaded should pass `user` in talkyhubSettings instead, or wait for `talkyhub:ready`.
const api = {
  /** The running build, e.g. `0.0.1+ab12cd3`. Ask a customer to read this out of the console. */
  version: BUILD,
  /** Identify the signed-in user. `null` is a logout. A no-op for the same user and details. */
  setUser(user: HostUser | null): void {
    callHost({ name: 'setUser', user })
  },
  /** Forget this browser's visitor. Call it on logout on any device people share. */
  reset(): void {
    callHost({ name: 'reset' })
  },
  /** Open the chat — from the page's own "Chat with us" button, say. No-op when inline. */
  open(): void {
    openWidget()
  },
  close(): void {
    closeWidget()
  },
  toggle(): void {
    toggleWidget()
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
    hideLauncher: d?.hideLauncher as Settings['hideLauncher'], // "true" | "mobile", see hideLauncherMode
    container: d?.container,
  }
}

// `unknown`: a data-* attribute arrives as the string "true", talkyhubSettings as the boolean.
function hideLauncherMode(v: unknown): WidgetConfig['display']['hideLauncher'] {
  if (v === true || v === 'true' || v === 'always') return 'always'
  return v === 'mobile' ? 'mobile' : 'never'
}

function resolveContainer(c: Settings['container']): HTMLElement | null {
  if (!c) return null
  if (c instanceof HTMLElement) return c
  try {
    const el = document.querySelector<HTMLElement>(c)
    if (el) return el
  } catch {
    /* not a valid selector — reported below */
  }
  // Falling back to the floating widget beats rendering nothing: the visitor still gets a chat.
  console.warn(`[TalkyHub] container "${c}" was not found; showing the floating widget instead.`)
  return null
}

// Shadow DOM isolates our CSS from the host page (and vice versa). Swap for an iframe when full
// origin isolation is needed — the mount seam stays the same.
function createMount(container: HTMLElement | null): HTMLElement {
  const host = document.createElement('div')
  host.id = HOST_ID
  // Inline, the host is the box the conversation fills; the container decides how big it is.
  if (container) host.style.cssText = 'display:block;width:100%;height:100%'
  ;(container ?? document.body).appendChild(host)
  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = css
  shadow.appendChild(style)
  const mount = document.createElement('div')
  if (container) mount.style.height = '100%'
  shadow.appendChild(mount)
  return mount
}

async function boot(): Promise<void> {
  if (document.getElementById(HOST_ID)) return // guard against double-inject
  const settings = readSettings()
  if (settings.preview) return bootPreview()
  const { token, apiBase = '', appearance, user } = settings

  const container = resolveContainer(settings.container)
  const mount = createMount(container)
  const display: WidgetConfig['display'] = {
    mode: container ? 'inline' : 'floating',
    hideLauncher: hideLauncherMode(settings.hideLauncher),
  }
  const config = { ...applyOverrides(await loadConfig(token, apiBase), appearance), display }
  if (container) pinOpen()
  // `user` goes in as a prop, not through the setUser queue: known before the first render, it
  // lets the widget choose form-or-session correctly on the first try.
  render(h(Widget, { config, user }), mount)
  window.dispatchEvent(new CustomEvent('talkyhub:ready'))
}

// Who may drive the preview. The page is harmless without this — fake chat, no network, no
// storage — but it should still only ever show what the dashboard sends it. nginx enforces the
// same list as frame-ancestors.
const PREVIEW_PARENTS = [/^https:\/\/app\.talkyhub\.ru$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/]

// The dashboard preview: the real Widget on the mock transport, fed the same /config-shaped
// object the API serves, so every field goes through the same validation as on a live site.
//
//   app → preview  { type: 'talkyhub:preview:config', config: <GET /config body>, open?: boolean }
//   preview → app  { type: 'talkyhub:preview:ready', version }   once listening; send config then
function bootPreview(): void {
  useMemoryStorage()
  const mount = createMount(null)
  // Token 'demo' keeps createTransport on MockTransport: nothing reaches the API.
  const base: WidgetConfig = { ...DEFAULT_CONFIG, greeting: undefined, replyTime: undefined }
  // Appearance edits re-render in place. Greeting and pre-chat are read once, when the widget
  // mounts and decides what to show — so a change to either remounts it, as a reload would.
  const show = (config: WidgetConfig) =>
    render(h(Widget, { key: JSON.stringify([config.greeting, config.preChat]), config }), mount)
  let first = true

  window.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== window.parent || !PREVIEW_PARENTS.some((r) => r.test(e.origin))) return
    const d = e.data as { type?: string; config?: unknown; open?: boolean } | null
    if (d?.type !== 'talkyhub:preview:config') return
    show(parseRemoteConfig(base, d.config))
    // Opens on the first config — the panel is what the admin is styling — then leaves the
    // open/closed state to them, unless the app says otherwise.
    if (typeof d.open === 'boolean') d.open ? openWidget() : closeWidget()
    else if (first) openWidget()
    first = false
  })

  if (window.parent === window) {
    // Opened directly rather than framed: show the defaults instead of an empty page.
    show(base)
    openWidget()
  } else {
    window.parent.postMessage({ type: 'talkyhub:preview:ready', version: BUILD }, '*')
  }
  window.dispatchEvent(new CustomEvent('talkyhub:ready'))
}

// Page-level hooks, live from the moment the script runs (the store's signals exist before the
// widget mounts, so an open requested early simply renders open):
//  - any element with data-talkyhub-open opens the chat — a custom launcher with no JS at all;
//  - a link to #talkyhub-open does the same, from another page, an email or a QR code;
//  - talkyhub:open / talkyhub:close / talkyhub:unread {count} on window, so a page that hid the
//    launcher can show the unread count on its own button.
document.addEventListener('click', (e) => {
  const el = (e.target as Element | null)?.closest?.('[data-talkyhub-open]')
  if (!el) return
  e.preventDefault()
  openWidget()
})
const openFromHash = () => {
  if (location.hash === '#talkyhub-open') openWidget()
}
openFromHash()
window.addEventListener('hashchange', openFromHash)

function onChange<T>(sig: Signal<T>, fn: (v: T) => void): void {
  let initial = true
  effect(() => {
    const v = sig.value
    if (initial) initial = false
    else fn(v)
  })
}
onChange(isOpen, (open) => window.dispatchEvent(new CustomEvent(open ? 'talkyhub:open' : 'talkyhub:close')))
onChange(unread, (count) => window.dispatchEvent(new CustomEvent('talkyhub:unread', { detail: { count } })))

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void boot())
} else {
  void boot()
}
