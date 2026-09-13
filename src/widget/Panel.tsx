import type { Channel, WidgetConfig } from '../core/types'
import { isOpen, preChatPending } from '../core/store'
import { Header } from './Header'
import { MessageList } from './MessageList'
import { Composer } from './Composer'
import { PreChat } from './PreChat'
import { Channels } from './Channels'

// `channels` is passed in rather than read off config: on a phone the messenger row lives
// inside the panel, on a desktop it floats beside the launcher, and Widget owns that choice.
export function Panel({ config, channels }: { config: WidgetConfig; channels: Channel[] }) {
  const gated = preChatPending.value
  return (
    <div
      class={`tk-panel ${isOpen.value ? 'is-open' : ''}`}
      role="dialog"
      aria-label={`Chat with ${config.agentName}`}
      aria-hidden={!isOpen.value}
    >
      <Header config={config} />
      {gated ? (
        <PreChat config={config} />
      ) : (
        <>
          <MessageList />
          <Channels channels={channels} variant="panel" />
          <Composer />
        </>
      )}
    </div>
  )
}
