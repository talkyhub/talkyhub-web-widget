import type { Author, Contact, Message, WidgetConfig } from './types'
import { rid } from './types'
import { loadSession, saveSession } from './session'

export interface TransportEvents {
  onMessage: (m: Message) => void
  onTyping: (typing: boolean) => void
  // Server history returned by POST /session (only called when non-empty), so a
  // returning visitor's thread replaces the client-rendered greeting.
  onHistory?: (messages: Message[]) => void
  // An agent marked the conversation resolved. The thread stays usable — the API reopens it
  // for a grace window — so this is a status notice, not an end state.
  onResolved?: (conversationId: string) => void
  // The message identified by `echoId` landed on a NEW conversation: the bound one had been
  // resolved long enough to go cold, and the API rolled the visitor over. Everything above
  // that message belongs to the previous, closed thread.
  onRollover?: (conversationId: string, echoId?: string) => void
}

export interface Transport {
  // `contact` carries the pre-chat answers into POST /session, where the API resolves them
  // through the same ContactResolver every inbound channel uses. Omitted when the pre-chat
  // form is disabled — the visitor then stays anonymous until they identify themselves.
  start(contact?: Contact): Promise<void>
  // echoId (optional) is the optimistic client id; the real transport sends it so the
  // server can round-trip it for reconciliation. MockTransport ignores it.
  send(text: string, echoId?: string): void
  stop(): void
}

// Stand-in transport so the widget runs with no backend: it echoes a canned agent reply
// after a short "typing" pause. Enough to build and demo the whole UI end to end.
export class MockTransport implements Transport {
  private timers: number[] = []
  constructor(private ev: TransportEvents) {}

  async start(_contact?: Contact): Promise<void> {}

  send(text: string, _echoId?: string): void {
    this.timers.push(window.setTimeout(() => this.ev.onTyping(true), 450))
    this.timers.push(
      window.setTimeout(() => {
        this.ev.onTyping(false)
        this.ev.onMessage({ id: rid(), body: canned(text), author: 'agent', at: Date.now() })
      }, 1900),
    )
  }

  stop(): void {
    this.timers.forEach((t) => window.clearTimeout(t))
    this.timers = []
  }
}

function canned(text: string): string {
  const t = text.toLowerCase()
  if (t.includes('invoice') || t.includes('order')) return 'Right away — pulling that up now. 📄'
  if (t.includes('price') || t.includes('cost') || t.includes('plan')) return 'Happy to help with pricing — which plan are you looking at?'
  if (t.includes('hi') || t.includes('hello') || t.includes('привет')) return 'Hey! How can we help today?'
  return 'Thanks! An agent will be right with you. Anything else in the meantime?'
}

const SESSION_HEADER = 'X-Talkyhub-Session'

// The API's WidgetMessage wire shape (snake_case). author ∈ visitor|agent|bot|system.
interface WireMessage {
  id: string
  content?: string | null
  author: string
  created_at: string
  echo_id?: string
}

function mapWire(w: WireMessage): Message {
  // bot replies are chat and render as bubbles; `system` is a lifecycle notice and renders
  // as a centred line, matching the notices the widget raises for itself.
  const author: Author =
    w.author === 'visitor' ? 'visitor' : w.author === 'system' ? 'system' : 'agent'
  return {
    id: w.id,
    body: w.content ?? '',
    author,
    at: Date.parse(w.created_at) || Date.now(),
    echoId: w.echo_id,
  }
}

// Real transport: REST out (session/messages), SSE in (agent messages). Server→client only over
// EventSource; visitor sends via POST — mirrors the agent console (see docs/webchat-widget.md).
// The visitor's own message is shown optimistically, so the stream carries only agent/bot/system.
export class SseTransport implements Transport {
  private es: EventSource | null = null
  private sessionToken = ''
  private readonly base: string
  private readonly token: string

  constructor(config: WidgetConfig, private ev: TransportEvents) {
    this.base = config.apiBase
    this.token = config.token
  }

  private url(path: string): string {
    return `${this.base}/api/v1/widget/${encodeURIComponent(this.token)}${path}`
  }

  async start(contact?: Contact): Promise<void> {
    const session = loadSession(this.token)
    let data: { session_token: string; conversation_id: string; messages?: WireMessage[] }
    try {
      const res = await fetch(this.url('/session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: session.sourceId, contact: contact ?? session.contact }),
      })
      if (!res.ok) return // widget stays usable with the client-rendered greeting
      data = await res.json()
    } catch {
      return
    }
    this.sessionToken = data.session_token
    saveSession(this.token, {
      ...session,
      sessionToken: data.session_token,
      conversationId: data.conversation_id,
    })
    const history = (data.messages ?? []).map(mapWire)
    if (history.length) this.ev.onHistory?.(history)
    await this.openStream()
  }

  private async openStream(): Promise<void> {
    try {
      const res = await fetch(this.url('/realtime/ticket'), {
        method: 'POST',
        headers: { [SESSION_HEADER]: this.sessionToken },
      })
      if (!res.ok) return
      const { stream_url } = (await res.json()) as { stream_url: string }
      const es = new EventSource(`${this.base}${stream_url}`)
      // Server frames outbound messages as `event: message` (default type) with a JSON WidgetMessage body.
      es.onmessage = (e) => this.onWire(e.data)
      // Resolution is a NAMED frame (`event: conversation.resolved`), so onmessage never sees
      // it — it needs its own listener or the widget silently ignores the agent closing the
      // thread. Payload is { conversation_id }.
      es.addEventListener('conversation.resolved', (e) => {
        try {
          const { conversation_id } = JSON.parse((e as MessageEvent).data) as { conversation_id: string }
          this.ev.onResolved?.(conversation_id)
        } catch {
          /* ignore malformed frame */
        }
      })
      es.onerror = () => {
        /* EventSource reconnects on its own; nothing to do */
      }
      this.es = es
    } catch {
      /* offline — POSTs still work, just no live inbound */
    }
  }

  private onWire(raw: string): void {
    try {
      this.ev.onMessage(mapWire(JSON.parse(raw) as WireMessage))
    } catch {
      /* ignore malformed frame */
    }
  }

  send(text: string, echoId?: string): void {
    void this.post(text, echoId).catch(() => {
      /* best-effort; the optimistic bubble stays visible */
    })
  }

  private async post(text: string, echoId?: string): Promise<void> {
    const res = await fetch(this.url('/messages'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [SESSION_HEADER]: this.sessionToken },
      body: JSON.stringify({ content: text, echo_id: echoId }),
    })
    if (!res.ok) return
    const data = (await res.json()) as {
      message: WireMessage
      conversation_id: string
      session_token?: string | null
    }

    // A session_token here means the API rolled this message over to a NEW conversation: the
    // bound thread was resolved and had gone cold past the server's grace window. The
    // decision is the server's alone — the widget's job is only to follow it, by adopting the
    // new token/id and re-pointing the stream, which is still bound to the old conversation.
    if (data.session_token) {
      this.sessionToken = data.session_token
      saveSession(this.token, {
        ...loadSession(this.token),
        sessionToken: data.session_token,
        conversationId: data.conversation_id,
      })
      this.ev.onRollover?.(data.conversation_id, echoId)
      this.es?.close()
      this.es = null
      await this.openStream()
    }

    // Reconcile the optimistic bubble with the persisted message (the POST response is the
    // only place a visitor's own message comes back — the stream deliberately omits it).
    this.ev.onMessage(mapWire(data.message))
  }

  stop(): void {
    this.es?.close()
    this.es = null
  }
}

// Live transport when a real backend is configured (token + apiBase); otherwise the mock.
export function createTransport(config: WidgetConfig, events: TransportEvents): Transport {
  if (config.apiBase && config.token && config.token !== 'demo') {
    return new SseTransport(config, events)
  }
  return new MockTransport(events)
}
