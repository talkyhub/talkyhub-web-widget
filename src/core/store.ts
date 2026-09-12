import { signal } from '@preact/signals'
import type { Message } from './types'
import { rid } from './types'
import type { Transport } from './transport'

// Widget-wide reactive state. Components read `.value` and re-render automatically.
export const isOpen = signal(false)
export const messages = signal<Message[]>([])
export const agentTyping = signal(false)
export const unread = signal(0)

let transport: Transport | null = null
export function attachTransport(t: Transport): void {
  transport = t
}

export function openWidget(): void {
  isOpen.value = true
  unread.value = 0
}
export function closeWidget(): void {
  isOpen.value = false
}
export function toggleWidget(): void {
  isOpen.value ? closeWidget() : openWidget()
}

// Replace the whole list (used when a session loads server history).
export function setMessages(list: Message[]): void {
  messages.value = list
}

// Append or reconcile. A message that carries an `echoId` matching an optimistic one
// replaces it (the persisted copy supersedes the local one); a message whose server `id`
// is already present is ignored (stream/POST double-delivery). Everything else appends.
export function pushMessage(m: Message): void {
  const list = messages.value
  if (m.echoId) {
    const i = list.findIndex((x) => x.echoId === m.echoId)
    if (i >= 0) {
      const next = list.slice()
      next[i] = m
      messages.value = next
      return
    }
  }
  if (list.some((x) => x.id === m.id)) return
  messages.value = [...list, m]
  if (m.author === 'agent' && !isOpen.value) unread.value += 1
}

export function sendMessage(text: string): void {
  const body = text.trim()
  if (!body) return
  const echoId = rid()
  messages.value = [...messages.value, { id: echoId, body, author: 'visitor', at: Date.now(), status: 'sent', echoId }]
  transport?.send(body, echoId)
}
