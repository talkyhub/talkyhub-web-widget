import type { WidgetConfig } from '../core/types'
import { isOpen, unread, toggleWidget, labelDismissed, dismissLabel } from '../core/store'
import { Mascot } from './Mascot'
import { ChatIcon, CloseIcon } from './icons'

// Three shapes, chosen by appearance.launcher:
//  - "mascot" — the whole mascot, no circle; a padded button gives it a >=48px hit area
//    and CSS adds the drop-shadow / hover so it reads as an interactive control.
//  - "bubble" — the conventional accent-filled circle, for sites where a character would
//    fight the brand. It swaps to a close glyph while the panel is open.
//  - "label"  — the Jivo/Intercom-style greeting card: mascot + an invitation to chat,
//    optionally wordmarked. Same shape as Chatwoot's `expanded_bubble` + `launcherTitle`.
/**
 * Which shape is actually on screen right now. Exported because the widget root carries it as
 * a class and several things measure against it — the panel's bottom offset, the floating
 * channel row — and they were wrong whenever this drifted: a `label` launcher collapses to a
 * bubble while the panel is open, so the configured value alone can't be trusted.
 *
 * A card this wide covering the page forever is an ad, not an invitation: once the visitor
 * dismisses it — or opens the chat — it collapses to the plain bubble, and the dismissal is
 * remembered. Chatwoot's expanded bubble behaves the same.
 */
export function launcherShape(
  launcher: WidgetConfig['appearance']['launcher'],
  open: boolean,
  dismissed: boolean,
): 'mascot' | 'bubble' | 'label' {
  if (launcher === 'label') return open || dismissed ? 'bubble' : 'label'
  return launcher === 'mascot' ? 'mascot' : 'bubble'
}

export function Launcher({ config }: { config: WidgetConfig }) {
  const open = isOpen.value
  const { launcher, launcherText, branding } = config.appearance
  const shape = launcherShape(launcher, open, labelDismissed.value)
  const label = open ? 'Close chat' : `Open chat with ${config.agentName}`

  if (shape === 'label') {
    return (
      <div class="tk-launch-wrap">
        <button class="tk-launch is-label" onClick={toggleWidget} aria-label={label} aria-expanded={false}>
          {/* white-bodied on the accent card, the same trick as the header's avatar disc —
              the brand-gradient variant would sink into the background it sits on. */}
          <Mascot size={30} variant="white" />
          <span class="tk-launch-text">{launcherText}</span>
          {branding && <span class="tk-launch-brand">TalkyHub</span>}
          {unread.value > 0 && <span class="tk-badge">{unread.value}</span>}
        </button>
        <button
          class="tk-launch-x"
          onClick={dismissLabel}
          aria-label="Dismiss chat invitation"
          type="button"
        >
          <CloseIcon size={12} />
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
      {shape === 'bubble' ? open ? <CloseIcon size={24} /> : <ChatIcon size={26} /> : <Mascot size={58} />}
      {unread.value > 0 && !open && <span class="tk-badge">{unread.value}</span>}
    </button>
  )
}
