import type { WidgetConfig } from '../core/types'
import { closeWidget } from '../core/store'
import { Mascot } from './Mascot'
import { ChevronDown } from './icons'

export function Header({ config }: { config: WidgetConfig }) {
  return (
    <div class="tk-head">
      <span class="tk-av">
        <Mascot size={26} />
      </span>
      <span class="tk-who">
        <b>{config.agentName}</b>
        {config.replyTime && <span class="tk-status">online · {config.replyTime}</span>}
      </span>
      <button class="tk-min" onClick={closeWidget} aria-label="Minimize chat">
        <ChevronDown size={18} />
      </button>
    </div>
  )
}
