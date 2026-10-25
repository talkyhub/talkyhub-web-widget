import type { WidgetConfig } from '../core/types'
import { closeWidget } from '../core/store'
import { Mascot } from './Mascot'
import { ChevronDown, CloseIcon } from './icons'
import { useCompact } from './useCompact'
import { launcherHidden } from './Launcher'

export function Header({ config }: { config: WidgetConfig }) {
  const compact = useCompact()
  // Full-screen on a phone, centred over a dimmed page, or with no launcher on the page, there is
  // no corner left to minimise into — so the control is a close, and says so. In the floating
  // card it really does tuck back down to the launcher, which is what the chevron means.
  const asClose = compact || config.appearance.modal || launcherHidden(config.display, compact)
  // Inline, the conversation is part of the page: there is nothing to close it into.
  const inline = config.display.mode === 'inline'
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
      {!inline && (
        <button class="tk-min" onClick={closeWidget} aria-label={asClose ? 'Close chat' : 'Minimize chat'}>
          {asClose ? <CloseIcon size={17} /> : <ChevronDown size={18} />}
        </button>
      )}
    </div>
  )
}
