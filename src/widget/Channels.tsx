import type { Channel } from '../core/types'
import { BRAND_COLOR, BRAND_GRADIENT, BrandMark } from './brands'

// The messenger row: round brand-coloured links offered alongside the chat, for visitors who
// would rather continue somewhere they already are. Jivo and Bitrix put these next to the
// launcher; we do the same on desktop, and move them inside the panel on phones where the
// panel is full-screen and a floating row would sit on top of the conversation.

function background(c: Channel): string {
  if (c.color) return c.color
  const gradient = BRAND_GRADIENT[c.kind]
  if (gradient) return `linear-gradient(135deg, ${gradient.join(', ')})`
  return BRAND_COLOR[c.kind]
}

export function Channels({
  channels,
  variant,
  originRight = true,
}: {
  channels: Channel[]
  variant: 'float' | 'panel'
  /** Which end the row unfolds from — the launcher's side, so it reads as coming out of it. */
  originRight?: boolean
}) {
  if (!channels.length) return null
  return (
    <nav class={`tk-channels is-${variant}`} aria-label="Other ways to reach us">
      {channels.map((c, i) => (
        <a
          key={c.url}
          class="tk-ch"
          href={c.url}
          // These leave the widget for a third-party site. noopener/noreferrer is not
          // optional: without it the opened tab gets window.opener on the CUSTOMER's page.
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: background(c),
            // Staggered outward from the launcher, nearest first, so the row unfolds rather than
            // appearing all at once.
            animationDelay:
              variant === 'float' ? `${(originRight ? channels.length - 1 - i : i) * 45}ms` : undefined,
          }}
          aria-label={c.label}
          title={c.label}
        >
          <BrandMark kind={c.kind} label={c.label} size={variant === 'panel' ? 19 : 20} />
        </a>
      ))}
    </nav>
  )
}
