// Derives the widget's whole palette from the single `appearance.accent` the backend sends.
//
// The design paints most surfaces (header, outgoing bubbles, send button, mascot) with a
// two-stop gradient, not with the accent directly, so a lone `--accent` var isn't enough:
// the gradient stops, the foreground that sits on them, the drop-shadow and the tinted
// surfaces all have to move with the accent or a non-purple brand looks broken.
//
// Chatwoot solves the same problem with one flat colour plus a per-component
// getContrastingTextColor(); we need the gradient version of that.

export interface Rgb {
  r: number
  g: number
  b: number
}

/** #rgb / #rrggbb (with or without the hash). Returns null for anything else. */
export function parseHex(hex: string): Rgb | null {
  const h = hex.trim().replace(/^#/, '')
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  const n = parseInt(full, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function toHex({ r, g, b }: Rgb): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/** WCAG relative luminance (sRGB → linear). */
export function luminance({ r, g, b }: Rgb): number {
  const lin = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** WCAG contrast ratio, 1 (identical) … 21 (black on white). */
export function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t }
}

interface Hsl {
  h: number
  s: number
  l: number
}

function toHsl({ r, g, b }: Rgb): Hsl {
  const R = r / 255
  const G = g / 255
  const B = b / 255
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  const d = max - min
  const l = (max + min) / 2
  if (d === 0) return { h: 0, s: 0, l }
  const s = d / (1 - Math.abs(2 * l - 1))
  let h: number
  if (max === R) h = ((G - B) / d) % 6
  else if (max === G) h = (B - R) / d + 2
  else h = (R - G) / d + 4
  return { h: (h * 60 + 360) % 360, s, l }
}

function fromHsl({ h, s, l }: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x]
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// Hue is held fixed and only lightness/saturation move. The deltas are reverse-engineered
// from the hand-picked default pair (#7b5cf0 / #4a2fc4 around #6a4ce0) so the stock purple
// still renders byte-for-close to the original design while any other accent gets the same
// relationship between its stops.
// A grey/black/white accent has no hue to speak of, so saturation is left at 0 rather than
// nudged — otherwise `h` defaults to 0 and a neutral brand drifts red.
function lighter(c: Rgb): Rgb {
  const { h, s, l } = toHsl(c)
  return fromHsl({ h, s: s === 0 ? 0 : clamp(s + 0.126, 0, 1), l: clamp(l + 0.063, 0, 0.96) })
}

function darker(c: Rgb): Rgb {
  const { h, s, l } = toHsl(c)
  return fromHsl({ h, s: s === 0 ? 0 : clamp(s - 0.092, 0, 1), l: clamp(l - 0.112, 0.06, 1) })
}

// Source for the faint washes and the shadow. A near-white accent mixed toward white gives
// back white — invisible hairlines and no shadow — so lightness is capped first. The
// gradient itself still uses the true accent; only these derived neutrals are clamped.
function tintBase(c: Rgb): Rgb {
  const { h, s, l } = toHsl(c)
  return l <= 0.6 ? c : fromHsl({ h, s, l: 0.6 })
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 }
const INK: Rgb = { r: 23, g: 20, b: 42 }

// Above this relative luminance an accent counts as "light" and takes dark text.
const LIGHT_ACCENT = 0.45

/**
 * Text and icons drawn on the accent gradient.
 *
 * The switch is the accent's own luminance, not whichever foreground scores higher on contrast.
 * Strict max-contrast flips mid-tone brands — #1f93ff most obviously — to dark ink: measurably
 * more readable, but it reads as broken next to every other chat widget, which is white on blue.
 * The threshold keeps white on blues, reds and purples, and gives ink to limes, yellows and
 * near-whites, where white genuinely fails (white on #B6E22F is about 1.7:1).
 *
 * The preference is only overruled when it would be unreadable at both stops. `--on-accent` can
 * also be set outright from the config (`appearance.on_accent`) when a brand needs a specific one.
 */
function onAccent(base: Rgb, a: Rgb, b: Rgb): Rgb {
  const preferred = luminance(base) > LIGHT_ACCENT ? INK : WHITE
  const other = preferred === WHITE ? INK : WHITE
  const worst = (fg: Rgb) => Math.min(contrast(fg, a), contrast(fg, b))
  return worst(preferred) >= 2 ? preferred : other
}

export interface ThemeVars {
  '--accent': string
  '--grad-a': string
  '--grad-b': string
  '--on-accent': string
  '--on-accent-soft': string
  '--shadow-rgb': string
  '--surface-2': string
  '--border': string
}

export const DEFAULT_ACCENT = '#6a4ce0'

/**
 * CSS custom properties for one accent, applied inline on the widget root so every
 * surface — including the mascot's SVG gradient — follows the site's brand colour.
 * An unparseable accent falls back to the default rather than rendering a broken page.
 * `onAccentOverride` forces the foreground drawn on that accent (appearance.on_accent).
 */
export function themeVars(accent: string, onAccentOverride?: string): ThemeVars {
  const base = parseHex(accent) ?? parseHex(DEFAULT_ACCENT)!
  const a = lighter(base)
  const b = darker(base)
  // An explicit override wins outright; an unparseable one falls back to the computed choice.
  const fg = (onAccentOverride ? parseHex(onAccentOverride) : null) ?? onAccent(base, a, b)
  const onWhite = luminance(fg) > 0.5
  const tint = tintBase(base)
  const shadow = darker(tint)
  return {
    '--accent': toHex(base),
    '--grad-a': toHex(a),
    '--grad-b': toHex(b),
    '--on-accent': toHex(fg),
    // Secondary text on the gradient (reply-time line, placeholder-ish detail).
    '--on-accent-soft': toHex(mix(fg, onWhite ? b : a, 0.18)),
    // Drop-shadow / panel shadow tint: the dark stop, as an `r, g, b` triple for rgba().
    '--shadow-rgb': `${Math.round(shadow.r)}, ${Math.round(shadow.g)}, ${Math.round(shadow.b)}`,
    // Faint accent washes for incoming bubbles, the composer field and hairlines.
    '--surface-2': toHex(mix(tint, WHITE, 0.91)),
    '--border': toHex(mix(tint, WHITE, 0.87)),
  }
}
