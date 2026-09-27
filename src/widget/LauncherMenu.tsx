import type { Channel } from '../core/types'
import { BrandMark, channelBackground } from './brands'
import { ChatIcon } from './icons'

// The list that unfolds above the `label` launcher on hover — Jivo's pattern. It exists because
// a channel's `label` has nowhere else to be read: the round row can only show marks, so a
// config that carefully names each link ("Новости в Telegram") shows none of those names.
//
// Hover alone would leave this keyboard-unreachable, so the whole thing is driven by
// `:hover` OR `:focus-within` on the wrapper, and the menu follows the launcher in the DOM so
// focusing the card reveals it and Tab walks straight into the rows.
export function LauncherMenu({ channels, onChat }: { channels: Channel[]; onChat: () => void }) {
  return (
    <nav class="tk-lmenu" aria-label="Other ways to reach us">
      {channels.map((c) => (
        <a
          key={c.url}
          class="tk-lmenu-row"
          href={c.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="tk-lmenu-icon" style={{ background: channelBackground(c) }}>
            <BrandMark kind={c.kind} label={c.label} size={15} />
          </span>
          <span class="tk-lmenu-label">{c.label}</span>
        </a>
      ))}
      <button class="tk-lmenu-row" type="button" onClick={onChat}>
        <span class="tk-lmenu-icon is-chat">
          <ChatIcon size={16} />
        </span>
        <span class="tk-lmenu-label">Write in chat</span>
      </button>
    </nav>
  )
}
