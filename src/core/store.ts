import { signal } from '@preact/signals'
import type { Contact, Message } from './types'
import { rid } from './types'
import type { Transport } from './transport'

// Widget-wide reactive state. Components read `.value` and re-render automatically.
export const isOpen = signal(false)
export const messages = signal<Message[]>([])
export const agentTyping = signal(false)
export const unread = signal(0)
// True while the pre-chat form is standing between the visitor and the thread. Set by
// Widget on mount; cleared by submitPreChat(), which is what actually opens the session.
export const preChatPending = signal(false)
// The 'label' launcher collapses to a plain bubble once dismissed. Seeded from the stored
// session by Widget, so the invitation doesn't come back on every page view.
export const labelDismissed = signal(false)

let onDismissLabel: (() => void) | null = null
export function onLabelDismissed(fn: () => void): void {
  onDismissLabel = fn
}

export function dismissLabel(): void {
  labelDismissed.value = true
  onDismissLabel?.()
}

let transport: Transport | null = null
export function attachTransport(t: Transport): void {
  transport = t
}

// Widget registers how a session gets opened, so the pre-chat form can hand its answers
// straight to POST /session without the Panel having to drill a callback down to it.
let sessionStarter: ((contact?: Contact) => void) | null = null
export function onStartSession(fn: (contact?: Contact) => void): void {
  sessionStarter = fn
}

export function submitPreChat(contact: Contact): void {
  preChatPending.value = false
  sessionStarter?.(contact)
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

/**
 * Add a lifecycle notice to the thread. `beforeEcho` places it immediately above the
 * visitor message with that echo id — a rollover notice has to sit *before* the message
 * that triggered it, but the optimistic bubble is already in the list by the time the
 * server's answer comes back. Ids are stable per conversation, so a reconnect that
 * redelivers the same event can't duplicate the line.
 */
export function pushNotice(id: string, body: string, beforeEcho?: string): void {
  const list = messages.value
  if (list.some((m) => m.id === id)) return
  const notice: Message = { id, body, author: 'system', at: Date.now() }
  const i = beforeEcho ? list.findIndex((m) => m.echoId === beforeEcho) : -1
  messages.value = i >= 0 ? [...list.slice(0, i), notice, ...list.slice(i)] : [...list, notice]
}

export function sendMessage(text: string): void {
  const body = text.trim()
  if (!body) return
  const echoId = rid()
  messages.value = [...messages.value, { id: echoId, body, author: 'visitor', at: Date.now(), status: 'sent', echoId }]
  transport?.send(body, echoId)
}
