import type { WidgetConfig } from '../core/types'
import { isOpen, unread, toggleWidget } from '../core/store'
import { Mascot } from './Mascot'
import { ChatIcon, CloseIcon } from './icons'
import { Wordmark } from './Credit'

/**
 * Which shape is actually on screen right now. Exported because the widget root carries it as a
 * class and several things measure against it — the panel's bottom offset, the floating channel
 * row — and they were wrong whenever this drifted from what was rendered.
 *
 * A `label` launcher collapses to a plain bubble while the panel is open, since a wide card under
 * an open panel is just clutter, and comes back when the panel closes. It is never dismissed for
 * good: the invitation is the point of choosing this launcher.
 */
export function launcherShape(
  launcher: WidgetConfig['appearance']['launcher'],
  open: boolean,
): 'mascot' | 'bubble' | 'label' {
  if (launcher === 'label') return open ? 'bubble' : 'label'
  return launcher === 'mascot' ? 'mascot' : 'bubble'
}

// Three shapes, chosen by appearance.launcher:
//  - "mascot" — the whole mascot, no circle; a padded button gives it a >=48px hit area and CSS
//    adds the drop-shadow / hover so it reads as an interactive control.
//  - "bubble" — the conventional accent-filled circle, for sites where a character would fight
//    the brand. It swaps to a close glyph while the panel is open.
//  - "label"  — the Jivo/Intercom-style greeting card: mascot + an invitation to chat, wordmarked.
//    Same shape as Chatwoot's `expanded_bubble` + `launcherTitle`.
export function Launcher({ config }: { config: WidgetConfig }) {
  const open = isOpen.value
  const { launcher, launcherText } = config.appearance
  const shape = launcherShape(launcher, open)
  const label = open ? 'Close chat' : `Open chat with ${config.agentName}`

  if (shape === 'label') {
    return (
      <div class="tk-launch-wrap">
        <button class="tk-launch is-label" onClick={toggleWidget} aria-label={label} aria-expanded={false}>
          {/* white-bodied on the accent card, the same trick as the header's avatar disc —
              the brand-gradient variant would sink into the background it sits on. */}
          <Mascot size={30} variant="white" />
          <span class="tk-launch-text">{launcherText}</span>
          <span class="tk-launch-brand">
            <Wordmark tone="current" />
          </span>
          {unread.value > 0 && <span class="tk-badge">{unread.value}</span>}
        </button>
      </div>
    )
  }

  return (
    <button
      class={`tk-launch ${shape === 'bubble' ? 'is-bubble' : 'is-mascot'} ${open ? 'is-open' : ''}`}
      onClick={toggleWidget}
      aria-label={label}
      aria-expanded={open}
    >
      {/* The glyph carries the whole button here, so it is drawn large inside the circle rather
          than floating in the middle of it. */}
      {shape === 'bubble' ? open ? <CloseIcon size={26} /> : <ChatIcon size={31} /> : <Mascot size={58} />}
      {unread.value > 0 && !open && <span class="tk-badge">{unread.value}</span>}
    </button>
  )
}
