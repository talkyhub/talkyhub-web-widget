import { isOpen, unread, toggleWidget } from '../core/store'
import { Mascot } from './Mascot'

// The launcher is the whole mascot (no circle) — a padded button gives it a ≥48px hit
// area, and CSS adds the drop-shadow / hover so it reads as an interactive control.
export function Launcher() {
  return (
    <button
      class={`tk-launch ${isOpen.value ? 'is-open' : ''}`}
      onClick={toggleWidget}
      aria-label="Open chat with Talky"
      aria-expanded={isOpen.value}
    >
      <Mascot size={58} />
      {unread.value > 0 && !isOpen.value && <span class="tk-badge">{unread.value}</span>}
    </button>
  )
}
