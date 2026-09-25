import type { Author, Contact, Message, WidgetConfig } from './types'
import { rid } from './types'
import { loadSession, saveSession } from './session'
import type { Session } from './session'

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

/** Everything POST /session can carry about who the visitor is. See docs/identity.md. */
export interface SessionIdentity {
  // Pre-chat answers and/or host prefill, resolved through the same ContactResolver every
  // inbound channel uses.
  contact?: Contact
  // The host app's user id, trusted by the API only alongside a valid identifierHash.
  identifier?: string
  identifierHash?: string
}

export interface Transport {
  start(identity?: SessionIdentity): Promise<void>
  // Remember who the visitor is without opening anything. The session — and with it the
  // conversation — is then opened by their first message. See SseTransport.deliver().
  arm(identity?: SessionIdentity): void
  // The host identified its user after the session had already started (login in an SPA).
  identify(identity: SessionIdentity): Promise<void>
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

  async start(_identity?: SessionIdentity): Promise<void> {}

  arm(_identity?: SessionIdentity): void {}

  async identify(_identity: SessionIdentity): Promise<void> {}

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

interface SessionResponse {
  session_token: string
  conversation_id: string
  messages?: WireMessage[]
  // Optional (docs/identity.md): how the API treated the identity it was sent.
  identity?: 'verified' | 'unverified' | 'anonymous'
}

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
  private armed: SessionIdentity | undefined
  private opening: Promise<boolean> | null = null
  private readonly base: string
  private readonly token: string

  constructor(config: WidgetConfig, private ev: TransportEvents) {
    this.base = config.apiBase
    this.token = config.token
  }

  private url(path: string): string {
    return `${this.base}/api/v1/widget/${encodeURIComponent(this.token)}${path}`
  }

  /** Open the session now. Used to resume a visitor who already has a conversation. */
  async start(identity?: SessionIdentity): Promise<void> {
    this.armed = identity
    await this.ensureOpen()
  }

  /** Hold the identity; the first message opens the session with it. */
  arm(identity?: SessionIdentity): void {
    this.armed = identity
  }

  // Concurrent sends must not each POST /session, and a failed attempt has to be retryable, so
  // the in-flight promise is cached and cleared on failure.
  private async ensureOpen(): Promise<boolean> {
    if (this.sessionToken) return true
    this.opening ??= this.open()
    return this.opening
  }

  private async open(): Promise<boolean> {
    const data = await this.openSession(this.armed, loadSession(this.token))
    if (!data) {
      this.opening = null
      return false
    }
    const history = (data.messages ?? []).map(mapWire)
    if (history.length) this.ev.onHistory?.(history)
    await this.openStream()
    return true
  }

  // setUser after the session already started. POST /session is idempotent for a source_id, so
  // re-posting it with the new identity is how the details reach the API. If a verified identity
  // lands on a DIFFERENT conversation — the user's thread from another device — follow it:
  // replace the history and re-ticket the stream, which is still bound to the old one.
  async identify(identity: SessionIdentity): Promise<void> {
    this.armed = identity
    // Nothing is open yet, so there is nothing to re-post: the details ride along when the
    // visitor's first message opens the session.
    if (!this.sessionToken) return
    const before = loadSession(this.token).conversationId
    const data = await this.openSession(identity, loadSession(this.token))
    if (!data || data.conversation_id === before) return
    this.ev.onHistory?.((data.messages ?? []).map(mapWire))
    this.es?.close()
    this.es = null
    await this.openStream()
  }

  private async openSession(identity: SessionIdentity | undefined, session: Session): Promise<SessionResponse | null> {
    let data: SessionResponse
    try {
      const res = await fetch(this.url('/session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_id: session.sourceId,
          contact: identity?.contact ?? session.contact,
          identifier: identity?.identifier,
          identifier_hash: identity?.identifierHash,
        }),
      })
      if (res.status === 401 && identity?.identifier) {
        // On /session a 401 means the identity check failed (docs/identity.md). Say so loudly:
        // silently degrading a signed-in user to an anonymous visitor would hide a broken
        // integration until a customer complained their history vanished.
        console.error(
          "[TalkyHub] identifier_hash was rejected. It must be HMAC-SHA256 of the identifier, keyed with this inbox's identity secret, computed on your server. See docs/identity.md.",
        )
        return null
      }
      if (!res.ok) return null // widget stays usable with the client-rendered greeting
      data = (await res.json()) as SessionResponse
    } catch {
      return null
    }
    this.sessionToken = data.session_token
    saveSession(this.token, {
      ...loadSession(this.token),
      sessionToken: data.session_token,
      conversationId: data.conversation_id,
    })
    // In optional-verification mode a wrong hash doesn't fail — the identifier is just ignored.
    // This warning is the only place an integrator finds out.
    if (identity?.identifier && data.identity && data.identity !== 'verified') {
      console.warn(`[TalkyHub] the signed-in user was not verified (API: ${data.identity}); their history will not follow them across devices.`)
    }
    return data
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
    void this.deliver(text, echoId).catch(() => {
      /* best-effort; the optimistic bubble stays visible */
    })
  }

  private async deliver(text: string, echoId?: string): Promise<void> {
    // This is where a conversation is born. Loading the page, opening the widget and reading the
    // greeting all leave nothing behind on the server; only a message does.
    if (!(await this.ensureOpen())) return

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
    this.opening = null
    // A reset() on logout stops and restarts this transport. Clearing the token means a message
    // sent in that gap is rejected, instead of landing in the previous user's conversation.
    this.sessionToken = ''
  }
}

// Live transport when a real backend is configured (token + apiBase); otherwise the mock.
export function createTransport(config: WidgetConfig, events: TransportEvents): Transport {
  if (config.apiBase && config.token && config.token !== 'demo') {
    return new SseTransport(config, events)
  }
  return new MockTransport(events)
}
