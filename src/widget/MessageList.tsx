import { useEffect, useRef } from 'preact/hooks'
import { messages, agentTyping } from '../core/store'
import { Message } from './Message'
import { TypingIndicator } from './TypingIndicator'

export function MessageList() {
  const ref = useRef<HTMLDivElement>(null)
  const list = messages.value

  // Keep pinned to the newest message as the thread grows / typing toggles.
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [list, agentTyping.value])

  return (
    <div class="tk-thread" ref={ref} role="log" aria-live="polite">
      {list.map((m, i) => {
        const prev = list[i - 1]
        const next = list[i + 1]
        return (
          <Message
            key={m.id}
            m={m}
            firstOfGroup={!prev || prev.author !== m.author}
            lastOfGroup={!next || next.author !== m.author}
          />
        )
      })}
      {agentTyping.value && <TypingIndicator />}
    </div>
  )
}
