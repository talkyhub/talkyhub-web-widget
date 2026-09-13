import type { Channel } from '../core/types'
import { BRAND_COLOR, BrandMark, FULL_BLEED, INSTAGRAM_STOPS } from './brands'

// The messenger row: round brand-coloured links offered alongside the chat, for visitors who
// would rather continue somewhere they already are. Jivo and Bitrix put these next to the
// launcher; we do the same on desktop, and move them inside the panel on phones where the
// panel is full-screen and a floating row would sit on top of the conversation.

function background(c: Channel): string {
  // MAX and friends are full tiles — their gradient is the logo, so a colour behind them is
  // at best invisible and at worst a rim of the wrong hue around the artwork.
  if (FULL_BLEED.has(c.kind)) return 'transparent'
  if (c.color) return c.color
  if (c.kind === 'instagram') {
    // Instagram's mark is a gradient, not a colour — flattening it to one stop is the single
    // most recognisable way to get it wrong.
    return `linear-gradient(135deg, ${INSTAGRAM_STOPS.join(', ')})`
  }
  return BRAND_COLOR[c.kind]
}

export function Channels({ channels, variant }: { channels: Channel[]; variant: 'float' | 'panel' }) {
  if (!channels.length) return null
  return (
    <nav class={`tk-channels is-${variant}`} aria-label="Other ways to reach us">
      {channels.map((c) => (
        <a
          key={c.url}
          class={`tk-ch ${FULL_BLEED.has(c.kind) ? 'is-full' : ''}`}
          href={c.url}
          // These leave the widget for a third-party site. noopener/noreferrer is not
          // optional: without it the opened tab gets window.opener on the CUSTOMER's page.
          target="_blank"
          rel="noopener noreferrer"
          style={{ background: background(c) }}
          aria-label={c.label}
          title={c.label}
        >
          <BrandMark
            kind={c.kind}
            label={c.label}
            // A full-bleed mark is the button; a glyph sits inside one.
            size={FULL_BLEED.has(c.kind) ? 38 : variant === 'panel' ? 19 : 20}
          />
        </a>
      ))}
    </nav>
  )
}
