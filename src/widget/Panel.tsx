import type { WidgetConfig } from '../core/types'
import { isOpen } from '../core/store'
import { Header } from './Header'
import { MessageList } from './MessageList'
import { Composer } from './Composer'

export function Panel({ config }: { config: WidgetConfig }) {
  return (
    <div
      class={`tk-panel ${isOpen.value ? 'is-open' : ''}`}
      role="dialog"
      aria-label={`Chat with ${config.agentName}`}
      aria-hidden={!isOpen.value}
    >
      <Header config={config} />
      <MessageList />
      <Composer />
    </div>
  )
}
