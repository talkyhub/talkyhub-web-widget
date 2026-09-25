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
    <svg
      width={size}
      height={size}
      viewBox="28 44 420 420"
      fill="currentColor"
      aria-hidden="true"
      style={{ transform: 'translate(-1px, -1px)' }}
    >
      <path d="M446.7 98.6l-67.6 318.8c-5.1 22.5-18.4 28.1-37.3 17.5l-103-75.9-49.7 47.8c-5.5 5.5-10.1 10.1-20.7 10.1l7.4-104.9 190.9-172.5c8.3-7.4-1.8-11.5-12.9-4.1L142.8 271.4 42.2 240c-21.9-6.9-22.3-21.9 4.6-32.4L418.4 66.4c18.2-6.9 34.2 4.1 28.3 32.2z" />
    </svg>
  )
}

// WhatsApp's handset-in-a-bubble, the official glyph outline.
function WhatsApp({ size = 21 }: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ transform: 'translateY(-1px)' }}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.465 3.488" />
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

// MAX's mark alone, drawn at glyph size on the brand's gradient (BRAND_GRADIENT). As its full
// artwork tile it filled the entire button, while every sibling glyph fills about half of one —
// so it read as far larger than anything else in the row.
function Max({ size = 21 }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 1000 1000" fill="currentColor" aria-hidden="true">
      <path
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
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
      stroke-width="1.9"
      style={{ transform: 'translate(-1px, -1px)' }}
    >
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
    <span class="tk-ch-mono" style={{ fontSize: `${Math.round(size * 0.92)}px` }} aria-hidden="true">
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
  max: '#53e',
  instagram: '#DD2A7B',
  email: '#57506F',
  phone: '#17A06A',
  link: '#57506F',
}

// Brands whose mark is a gradient rather than a colour. Flattening either of these to a single
// stop is the most recognisable way to get it wrong.
export const BRAND_GRADIENT: Partial<Record<ChannelKind, string[]>> = {
  instagram: ['#F9CE34', '#EE2A7B', '#6228D7'],
  max: ['#4cf', '#53e 66%', '#93d'],
}

const OPTICAL: Partial<Record<ChannelKind, number>> = {
  telegram: 1.05,
  whatsapp: 1.05,
  vk: 1.4,
  instagram: 1.15,
  max: 1.15,
  email: 1.1,
  phone: 1.35,
}

export function BrandMark({ kind, label, size }: { kind: ChannelKind; label: string; size?: number }) {
  const base = size ?? 20
  const scaled = Math.round(base * (OPTICAL[kind] ?? 1))
  switch (kind) {
    case 'telegram':
      return <Telegram size={scaled} />
    case 'whatsapp':
      return <WhatsApp size={scaled} />
    case 'vk':
      return <Vk size={scaled} />
    case 'max':
      return <Max size={scaled} />
    case 'instagram':
      return <Instagram size={scaled} />
    case 'email':
      return <Email size={scaled} />
    case 'phone':
      return <Phone size={scaled} />
    default:
      return <Monogram label={label} size={base} />
  }
}
