import { signal } from '@preact/signals'
import type { Contact, Message } from './types'
import { rid } from './types'
import type { Transport } from './transport'
import type { HostUser } from './identity'

// Widget-wide reactive state. Components read `.value` and re-render automatically.
export const isOpen = signal(false)
export const messages = signal<Message[]>([])
export const agentTyping = signal(false)
export const unread = signal(0)
// True while the pre-chat form is standing between the visitor and the thread. Set by
// Widget on mount; cleared by submitPreChat(), which is what actually opens the session.
export const preChatPending = signal(false)

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

// Details the host app already knows about its signed-in user (TalkyHub.setUser). The pre-chat
// form reads this to skip the fields it would otherwise ask for.
export const prefill = signal<Contact>({})

// The host page's runtime API (window.TalkyHub, loader.ts) can be called before the widget has
// mounted — the loader is async, and an app calls setUser the moment its own auth resolves.
// Calls are queued until Widget registers its handlers, then replayed in order.
export interface HostHandlers {
  setUser(user: HostUser | null): void
  reset(): void
}

export type HostCall = { name: 'setUser'; user: HostUser | null } | { name: 'reset' }

let host: HostHandlers | null = null
const queued: HostCall[] = []

function dispatch(h: HostHandlers, call: HostCall): void {
  if (call.name === 'setUser') h.setUser(call.user)
  else h.reset()
}

export function registerHost(handlers: HostHandlers | null): void {
  host = handlers
  if (handlers) for (const call of queued.splice(0)) dispatch(handlers, call)
}

export function callHost(call: HostCall): void {
  if (host) dispatch(host, call)
  else queued.push(call)
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
