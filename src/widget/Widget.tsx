import { useEffect } from 'preact/hooks'
import type { WidgetConfig } from '../core/types'
import { createTransport } from '../core/transport'
import { attachTransport, pushMessage, setMessages, agentTyping } from '../core/store'
import { Panel } from './Panel'
import { Launcher } from './Launcher'

export function Widget({ config }: { config: WidgetConfig }) {
  useEffect(() => {
    if (config.greeting) {
      pushMessage({ id: 'greeting', body: config.greeting, author: 'agent', at: Date.now() })
    }
    const transport = createTransport(config, {
      onMessage: (m) => pushMessage(m),
      onTyping: (on) => {
        agentTyping.value = on
      },
      // A returning visitor's server history replaces the client greeting.
      onHistory: (list) => setMessages(list),
    })
    attachTransport(transport)
    void transport.start()
    return () => transport.stop()
  }, [])

  return (
    <div class="tk">
      <Panel config={config} />
      <Launcher />
    </div>
  )
}
