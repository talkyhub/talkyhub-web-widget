import type { WidgetConfig } from '../core/types'
import { closeWidget } from '../core/store'
import { Mascot } from './Mascot'
import { ChevronDown, CloseIcon } from './icons'
import { useCompact } from './useCompact'

export function Header({ config }: { config: WidgetConfig }) {
  // Full-screen on a phone, or centred over a dimmed page, there is no corner left to minimise
  // into and the launcher is hidden — so the control is a close, and says so. In the floating
  // card it really does tuck back down to the launcher, which is what the chevron means.
  const asClose = useCompact() || config.appearance.modal
  return (
    <div class="tk-head">
      <span class="tk-av">
        <Mascot size={26} />
      </span>
      <span class="tk-who">
        <b>{config.agentName}</b>
        {/* The presence dot no longer rides on the reply-time label: an inbox with no
            configured label sends reply_time: null, which used to hide the whole line. */}
        <span class="tk-status">online{config.replyTime ? ` · ${config.replyTime}` : ''}</span>
      </span>
      <button class="tk-min" onClick={closeWidget} aria-label={asClose ? 'Close chat' : 'Minimize chat'}>
        {asClose ? <CloseIcon size={17} /> : <ChevronDown size={18} />}
      </button>
    </div>
  )
}
