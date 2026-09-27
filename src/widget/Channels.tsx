import type { Channel } from '../core/types'
import { BrandMark, channelBackground } from './brands'

// The messenger row: round brand-coloured links offered alongside the chat, for visitors who
// would rather continue somewhere they already are. Jivo and Bitrix put these next to the
// launcher; we do the same on desktop, and move them inside the panel on phones where the
// panel is full-screen and a floating row would sit on top of the conversation.

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
          // The label is the only place a channel's name appears in this row, so it is the
          // tooltip. Floating, it can overflow freely; inside the panel it would be clipped by
          // the panel's own overflow, so there it falls back to the native title.
          data-tip={c.label}
          title={variant === 'panel' ? c.label : undefined}
          style={{
            background: channelBackground(c),
            // Staggered outward from the launcher, nearest first, so the row unfolds rather than
            // appearing all at once.
            animationDelay:
              variant === 'float' ? `${(originRight ? channels.length - 1 - i : i) * 45}ms` : undefined,
          }}
          aria-label={c.label}
        >
          <BrandMark kind={c.kind} label={c.label} size={variant === 'panel' ? 19 : 20} />
        </a>
      ))}
    </nav>
  )
}
