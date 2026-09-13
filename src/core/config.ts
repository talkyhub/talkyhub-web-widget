import type { Channel, ChannelKind, PreChatField, WidgetConfig } from './types'
import { CHANNEL_KINDS, PRE_CHAT_FIELDS } from './types'
import { DEFAULT_ACCENT, parseHex } from './theme'

export const DEFAULT_CONFIG: WidgetConfig = {
  token: 'demo',
  apiBase: '',
  agentName: 'TalkyHub Support',
  greeting: 'Hi! 👋 Question about your order or setup?',
  replyTime: 'replies in ~2 min',
  appearance: {
    accent: DEFAULT_ACCENT,
    position: 'bottom-right',
    launcher: 'mascot',
    launcherText: 'Chat with us — we’re online',
    branding: false,
  },
  preChat: { enabled: false, fields: ['name', 'email'] },
  channels: [],
}

// Shape returned by GET /api/v1/widget/{token}/config. The API serializes snake_case
// (JsonNamingPolicy.SnakeCaseLower); position/launcher/fields are the exact strings the
// widget uses ("bottom-right", "mascot", "name"|"email"|"phone").
interface RemoteConfig {
  agent_name?: string
  greeting?: string | null
  reply_time?: string | null
  appearance?: {
    accent?: string
    position?: string
    launcher?: string
    launcher_text?: string | null
    branding?: boolean
  }
  pre_chat?: { enabled?: boolean; fields?: string[] }
  channels?: { kind?: string; url?: string; label?: string; color?: string }[]
}

type Position = WidgetConfig['appearance']['position']
type Launcher = WidgetConfig['appearance']['launcher']

const POSITIONS: readonly Position[] = ['bottom-right', 'bottom-left']
const LAUNCHERS: readonly Launcher[] = ['mascot', 'bubble', 'label']

// A missing key means "the backend didn't say" -> keep the default. An explicit null is a
// deliberate "off": GetWidgetConfigEndpoint sends greeting: null when the inbox greeting is
// disabled, and reply_time: null when no label is configured. Collapsing both with `??`
// resurrected the built-in English copy on sites that had switched it off.
function optional(value: string | null | undefined, fallback?: string): string | undefined {
  if (value === undefined) return fallback
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

// The config is public, unauthenticated JSON — validate rather than trust. An accent that
// isn't a hex colour or an unknown position/launcher falls back instead of producing a
// broken gradient or a widget stuck off-screen.
function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

function preChatFields(fields: string[] | undefined, fallback: PreChatField[]): PreChatField[] {
  if (!Array.isArray(fields)) return fallback
  // Keep the canonical order so the form doesn't reshuffle on a backend whim, and drop
  // anything this widget version can't render.
  const wanted = new Set(fields)
  return PRE_CHAT_FIELDS.filter((f) => wanted.has(f))
}

/**
 * Per-site overrides from `window.talkyhubSettings` / the embed script's data-attributes,
 * applied on top of whatever the backend returned. Chatwoot's SDK does the same thing with
 * `window.chatwootSettings` (position, type, launcherTitle...): the dashboard owns the
 * defaults, but the embedding page gets the last word on placement and shape. Anything
 * unrecognised is dropped rather than trusted.
 */
export function applyOverrides(config: WidgetConfig, overrides?: AppearanceOverrides): WidgetConfig {
  if (!overrides) return config
  const { accent, position, launcher, launcherText } = overrides
  return {
    ...config,
    appearance: {
      ...config.appearance,
      accent: accent && parseHex(accent) ? accent : config.appearance.accent,
      position: oneOf(position, POSITIONS, config.appearance.position),
      launcher: oneOf(launcher, LAUNCHERS, config.appearance.launcher),
      launcherText: launcherText?.trim() || config.appearance.launcherText,
    },
  }
}

export interface AppearanceOverrides {
  accent?: string
  position?: string
  launcher?: string
  launcherText?: string
}

// Only these schemes may reach an href. The config is public, unauthenticated JSON that ends
// up in a link on the customer's page, so a `javascript:` or `data:` URL here would be stored
// XSS on every site embedding the widget — the single most important check in this file.
const SAFE_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:']

const DEFAULT_LABEL: Record<Exclude<ChannelKind, 'link'>, string> = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  vk: 'VK',
  max: 'MAX',
  instagram: 'Instagram',
  email: 'Email',
  phone: 'Phone',
}

// Registrable domains each brand actually uses for deep links. Matched on the exact host or a
// subdomain of it — `endsWith('t.me')` alone would hand `evil-t.me` the Telegram mark.
const BRAND_HOSTS: [Exclude<ChannelKind, 'email' | 'phone' | 'link'>, string[]][] = [
  ['telegram', ['t.me', 'telegram.me', 'telegram.org', 'telegram.dog']],
  ['whatsapp', ['wa.me', 'whatsapp.com']],
  ['vk', ['vk.com', 'vk.ru', 'vk.me', 'vkontakte.ru']],
  ['max', ['max.ru']],
  ['instagram', ['instagram.com', 'instagr.am']],
]

const hostMatches = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`)

/**
 * Work out the brand from the URL when the dashboard didn't say. `kind` is really a display
 * hint, and the link itself already carries the answer — so pasting `https://t.me/support`
 * with no `kind` should get the Telegram mark, not a grey circle with an "L" on it.
 *
 * Also covers an unrecognised `kind` (a newer dashboard naming a brand this bundle predates):
 * inferring beats falling straight through to the generic mark.
 */
function inferKind(url: URL): ChannelKind {
  if (url.protocol === 'mailto:') return 'email'
  if (url.protocol === 'tel:') return 'phone'
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  for (const [kind, domains] of BRAND_HOSTS) {
    if (domains.some((d) => hostMatches(host, d))) return kind
  }
  return 'link'
}

// What to call a channel we have no brand name for. The host is the most useful thing we
// know — it is what the visitor would recognise, and it gives the monogram a real initial
// ("signal.me" -> S) instead of the letter L from the word "Link".
function genericLabel(url: URL): string {
  if (url.protocol === 'mailto:') return url.pathname || 'Email'
  if (url.protocol === 'tel:') return url.pathname || 'Phone'
  return url.hostname.replace(/^www\./, '') || 'Link'
}

function safeUrl(raw: string | undefined): URL | null {
  if (!raw) return null
  try {
    // Relative URLs are meaningless here (the widget runs on someone else's origin), so the
    // base is only there to make the parser accept and then reject them by scheme.
    const u = new URL(raw.trim(), 'https://invalid.example')
    if (!SAFE_SCHEMES.includes(u.protocol)) return null
    if (u.hostname === 'invalid.example' && u.protocol.startsWith('http')) return null
    return u
  } catch {
    return null
  }
}

// A channel with an unusable URL is dropped rather than rendered dead: a button that does
// nothing costs more trust than a missing one.
function channels(list: RemoteConfig['channels'], fallback: Channel[]): Channel[] {
  if (!Array.isArray(list)) return fallback
  const out: Channel[] = []
  for (const c of list) {
    const url = safeUrl(c?.url)
    if (!url) continue
    // An explicit, recognised kind wins; anything else is inferred from the URL.
    const declared = CHANNEL_KINDS.includes(c?.kind as ChannelKind) ? (c.kind as ChannelKind) : null
    const kind = declared && declared !== 'link' ? declared : inferKind(url)
    const color = c?.color && parseHex(c.color) ? c.color : undefined
    const label = c?.label?.trim() || (kind === 'link' ? genericLabel(url) : DEFAULT_LABEL[kind])
    out.push({ kind, url: url.href, label, color })
  }
  return out
}

// Fetch per-site config by token. Falls back to defaults for local dev and whenever the
// backend endpoint isn't reachable yet (design note: GET /api/v1/widget/{token}/config).
export async function loadConfig(token?: string, apiBase = ''): Promise<WidgetConfig> {
  const base: WidgetConfig = { ...DEFAULT_CONFIG, token: token ?? DEFAULT_CONFIG.token, apiBase }
  if (!token || !apiBase) return base
  try {
    const res = await fetch(`${apiBase}/api/v1/widget/${encodeURIComponent(token)}/config`)
    if (!res.ok) return base
    const r = (await res.json()) as RemoteConfig
    const accent = r.appearance?.accent
    return {
      ...base,
      agentName: optional(r.agent_name, base.agentName) ?? base.agentName,
      greeting: optional(r.greeting, base.greeting),
      replyTime: optional(r.reply_time, base.replyTime),
      appearance: {
        accent: accent && parseHex(accent) ? accent : base.appearance.accent,
        position: oneOf(r.appearance?.position, POSITIONS, base.appearance.position),
        launcher: oneOf(r.appearance?.launcher, LAUNCHERS, base.appearance.launcher),
        launcherText:
          optional(r.appearance?.launcher_text, base.appearance.launcherText) ??
          base.appearance.launcherText,
        branding: r.appearance?.branding ?? base.appearance.branding,
      },
      preChat: {
        enabled: r.pre_chat?.enabled ?? base.preChat.enabled,
        fields: preChatFields(r.pre_chat?.fields, base.preChat.fields),
      },
      channels: channels(r.channels, base.channels),
    }
  } catch {
    return base
  }
}
