import { useMemo } from 'preact/hooks'
import type { ChannelKind } from '../core/types'

// Brand marks for the channel links, drawn inline. They can't be <img> tags: the bundle is a
// single self-contained IIFE served from our CDN onto arbitrary customer origins, so every
// asset has to travel inside it.
//
// Nominative use — each mark links to that company's own service and nothing else. If a brand
// updates its logo, the fix is here.

interface MarkProps {
  size?: number
}

// Telegram's paper plane.
function Telegram({ size = 21 }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="28 44 420 420" fill="currentColor" aria-hidden="true">
      <path d="M446.7 98.6l-67.6 318.8c-5.1 22.5-18.4 28.1-37.3 17.5l-103-75.9-49.7 47.8c-5.5 5.5-10.1 10.1-20.7 10.1l7.4-104.9 190.9-172.5c8.3-7.4-1.8-11.5-12.9-4.1L142.8 271.4 42.2 240c-21.9-6.9-22.3-21.9 4.6-32.4L418.4 66.4c18.2-6.9 34.2 4.1 28.3 32.2z" />
    </svg>
  )
}

// WhatsApp's handset inside a speech bubble.
function WhatsApp({ size = 20 }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a9.9 9.9 0 00-8.5 15.02L2.2 22l5.1-1.27A9.9 9.9 0 1012 2zm0 1.9a8 8 0 116.9 12.06l-.28.46.72 2.63-2.7-.7-.44.25A8 8 0 0112 3.9z" />
      <path d="M9.2 7.4c-.17-.4-.35-.4-.52-.41h-.44c-.15 0-.4.06-.61.29-.21.23-.8.78-.8 1.9s.82 2.2.93 2.36c.12.15 1.6 2.56 3.96 3.49 1.96.77 2.36.62 2.79.58.42-.04 1.37-.56 1.56-1.1.2-.54.2-1 .14-1.1-.06-.1-.21-.16-.44-.27-.23-.12-1.37-.68-1.58-.75-.21-.08-.37-.12-.52.11-.15.23-.6.75-.73.9-.14.16-.27.18-.5.06-.23-.11-.98-.36-1.86-1.15-.69-.61-1.15-1.37-1.29-1.6-.13-.23-.01-.36.1-.47.11-.1.24-.27.35-.4.12-.14.16-.23.24-.39.08-.15.04-.29-.02-.4-.06-.12-.51-1.26-.7-1.71z" />
    </svg>
  )
}

// VK's monogram. Drawn small inside its own viewBox, so it is rendered larger than the other
// marks to end up optically the same size.
function Vk({ size = 28 }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="currentColor" aria-hidden="true">
      <path d="M25.54 34.5801C14.6 34.5801 8.3601 27.0801 8.1001 14.6001H13.5801C13.7601 23.7601 17.8 27.6401 21 28.4401V14.6001H26.1602V22.5001C29.3202 22.1601 32.6398 18.5601 33.7598 14.6001H38.9199C38.0599 19.4801 34.4599 23.0801 31.8999 24.5601C34.4599 25.7601 38.5601 28.9001 40.1201 34.5801H34.4399C33.2199 30.7801 30.1802 27.8401 26.1602 27.4401V34.5801H25.54Z" />
    </svg>
  )
}

// MAX is a full-bleed tile: the gradient IS the logo, so it fills the button and takes no
// background of its own. Gradient ids must be unique per instance or a second MAX button on
// the page would reference the first one's defs — same reason Mascot counts instances.
let maxUid = 0
function Max({ size = 38 }: MarkProps) {
  const uid = useMemo(() => ++maxUid, [])
  const sheen = `tk-max-a${uid}`
  const glow = `tk-max-b${uid}`
  return (
    <svg width={size} height={size} viewBox="0 0 1000 1000" aria-hidden="true">
      <defs>
        <linearGradient id={sheen} x1="117.847" x2="1000" y1="760.536" y2="500" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#4cf" />
          <stop offset="0.662" stop-color="#53e" />
          <stop offset="1" stop-color="#93d" />
        </linearGradient>
        {/* The source art fades to a stop with no stop-color, which defaults to black and can
            leave a dark ring where browsers interpolate un-premultiplied. Same blue at zero
            alpha renders the intended glow. */}
        <radialGradient
          id={glow}
          cx="-87.392"
          cy="1166.116"
          r="500"
          fx="-87.392"
          fy="1166.116"
          gradientTransform="rotate(51.356 1551.478 559.3) scale(2.42703433 1)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stop-color="#00f" />
          <stop offset="1" stop-color="#00f" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="1000" height="1000" fill={`url(#${sheen})`} ry="249.681" />
      <rect width="1000" height="1000" fill={`url(#${glow})`} ry="249.681" />
      <path
        fill="#fff"
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M508.211 878.328c-75.007 0-109.864-10.95-170.453-54.75-38.325 49.275-159.686 87.783-164.979 21.9 0-49.456-10.95-91.248-23.36-136.873-14.782-56.21-31.572-118.807-31.572-209.508 0-216.626 177.754-379.597 388.357-379.597 210.785 0 375.947 171.001 375.947 381.604.707 207.346-166.595 376.118-373.94 377.224m3.103-571.585c-102.564-5.292-182.499 65.7-200.201 177.024-14.6 92.162 11.315 204.398 33.397 210.238 10.585 2.555 37.23-18.98 53.837-35.587a189.8 189.8 0 0 0 92.71 33.032c106.273 5.112 197.08-75.794 204.215-181.95 4.154-106.382-77.67-196.486-183.958-202.574Z"
      />
    </svg>
  )
}

// Instagram's camera outline.
function Instagram({ size = 20 }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke="currentColor" stroke-width="1.9">
      <rect x="2.8" y="2.8" width="18.4" height="18.4" rx="5.4" />
      <circle cx="12" cy="12" r="4.1" />
      <circle cx="17.4" cy="6.6" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  )
}

function Email({ size = 20 }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke="currentColor" stroke-width="1.9" stroke-linejoin="round">
      <rect x="2.6" y="4.8" width="18.8" height="14.4" rx="2.6" />
      <path d="M3.4 7l8.6 6 8.6-6" />
    </svg>
  )
}

function Phone({ size = 20 }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7.4 3.2c.5-.2 1.1 0 1.4.5l1.6 2.8c.3.5.2 1.1-.2 1.5L8.8 9.1c.9 1.9 2.2 3.2 4.1 4.1l1.1-1.4c.4-.4 1-.5 1.5-.2l2.8 1.6c.5.3.7.9.5 1.4l-.7 1.9c-.2.6-.8 1-1.5.9C10.2 16.7 7.3 13.8 5.2 8c-.2-.7.2-1.3.8-1.5z" />
    </svg>
  )
}

// Fallback for MAX and for any channel the dashboard invents. A monogram on the brand colour
// is honest about not having the real mark, and still reads as a deliberate button — better
// than shipping a logo drawn from memory and getting it subtly wrong.
function Monogram({ label, size = 20 }: MarkProps & { label: string }) {
  const initial = useMemo(() => [...label.trim()][0]?.toUpperCase() ?? '?', [label])
  return (
    <span class="tk-ch-mono" style={{ fontSize: `${Math.round(size * 0.72)}px` }} aria-hidden="true">
      {initial}
    </span>
  )
}

// Each brand's own colour, so the row reads as the messengers it is rather than as a row of
// accent-coloured dots. Instagram is a gradient, handled in Channels.tsx.
export const BRAND_COLOR: Record<ChannelKind, string> = {
  telegram: '#1B8CC2',
  whatsapp: '#25D366',
  vk: '#0077FF',
  max: 'transparent', // unused — MAX is full-bleed, see below
  instagram: '#DD2A7B',
  email: '#57506F',
  phone: '#17A06A',
  link: '#57506F',
}

// Marks that carry their own background and fill the whole button. The row must not paint a
// colour behind these, and must not shrink them to glyph size.
export const FULL_BLEED: ReadonlySet<ChannelKind> = new Set<ChannelKind>(['max'])

export const INSTAGRAM_STOPS = ['#F9CE34', '#EE2A7B', '#6228D7']

export function BrandMark({ kind, label, size }: { kind: ChannelKind; label: string; size?: number }) {
  switch (kind) {
    case 'telegram':
      return <Telegram size={size} />
    case 'whatsapp':
      return <WhatsApp size={size} />
    case 'vk':
      // Rendered oversize on purpose; the glyph sits small in its own viewBox.
      return <Vk size={size ? Math.round(size * 1.4) : undefined} />
    case 'max':
      return <Max size={size} />
    case 'instagram':
      return <Instagram size={size} />
    case 'email':
      return <Email size={size} />
    case 'phone':
      return <Phone size={size} />
    default:
      return <Monogram label={label} size={size} />
  }
}
