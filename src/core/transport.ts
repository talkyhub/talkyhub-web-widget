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
  // Resume the conversation this browser remembers. Resolves false when the server has nothing
  // open to resume (it was resolved while nobody was listening): the stored conversationId is
  // forgotten and nothing is created — the visitor's next message opens a new one.
  start(identity?: SessionIdentity): Promise<boolean>
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

  async start(_identity?: SessionIdentity): Promise<boolean> {
    return true
  }

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

// How an attempt to open the session ended. `none` is a resume the server answered with 204:
// there is no open conversation to re-bind to, and by design it created nothing.
type OpenOutcome = 'open' | 'none' | 'failed'

// Stream reconnect backoff: 1s, 2s, 4s … capped.
const STREAM_RETRY_MAX_MS = 30_000

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
  // The conversation this transport is bound to. Held here rather than read back from storage,
  // which is only a hint for the next page load and is cleared when a conversation resolves.
  private conversationId: string | undefined
  private opening: Promise<OpenOutcome> | null = null
  private streamRetries = 0
  private streamTimer: number | undefined
  private readonly base: string
  private readonly token: string

  constructor(config: WidgetConfig, private ev: TransportEvents) {
    this.base = config.apiBase
    this.token = config.token
  }

  private url(path: string): string {
    return `${this.base}/api/v1/widget/${encodeURIComponent(this.token)}${path}`
  }

  /** Re-bind now to the conversation this browser remembers. Never creates one. */
  async start(identity?: SessionIdentity): Promise<boolean> {
    this.armed = identity
    if (this.sessionToken) return true
    this.opening ??= this.open(true)
    return (await this.opening) !== 'none'
  }

  /** Hold the identity; the first message opens the session with it. */
  arm(identity?: SessionIdentity): void {
    this.armed = identity
  }

  // Concurrent sends must not each POST /session, and a failed attempt has to be retryable, so
  // the in-flight promise is cached and cleared on failure. A resume still in flight is awaited
  // first: if it found nothing open, this message is what opens the conversation.
  private async ensureOpen(): Promise<boolean> {
    if (this.sessionToken) return true
    if (this.opening && (await this.opening) === 'open') return true
    this.opening ??= this.open(false)
    return (await this.opening) === 'open'
  }

  private async open(resume: boolean): Promise<OpenOutcome> {
    const data = await this.openSession(this.armed, loadSession(this.token), resume)
    if (data === 'none' || !data) {
      this.opening = null
      return data ?? 'failed'
    }
    const history = (data.messages ?? []).map(mapWire)
    if (history.length) this.ev.onHistory?.(history)
    await this.openStream()
    return 'open'
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
    const before = this.conversationId
    const data = await this.openSession(identity, loadSession(this.token), false)
    if (!data || data === 'none' || data.conversation_id === before) return
    this.ev.onHistory?.((data.messages ?? []).map(mapWire))
    this.es?.close()
    this.es = null
    await this.openStream()
  }

  // `resume` asks the API to re-bind to an open conversation and create nothing. Without it a
  // page load after the thread was resolved — by an agent, or auto-resolve, while this widget
  // wasn't connected to hear about it — would mint a brand-new, empty conversation.
  private async openSession(
    identity: SessionIdentity | undefined,
    session: Session,
    resume: boolean,
  ): Promise<SessionResponse | 'none' | null> {
    let data: SessionResponse
    try {
      const res = await fetch(this.url('/session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_id: session.sourceId,
          contact: identity?.contact,
          identifier: identity?.identifier,
          identifier_hash: identity?.identifierHash,
          resume: resume || undefined,
        }),
      })
      if (resume && res.status === 204) {
        saveSession(this.token, { ...loadSession(this.token), conversationId: undefined })
        return 'none'
      }
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
    // The token is NOT persisted: every load fetches a fresh one, so storing it would leave a
    // server-issued credential on disk for no reader.
    this.sessionToken = data.session_token
    this.conversationId = data.conversation_id
    saveSession(this.token, { ...loadSession(this.token), conversationId: data.conversation_id })
    // In optional-verification mode a wrong hash doesn't fail — the identifier is just ignored.
    // This warning is the only place an integrator finds out.
    if (identity?.identifier && data.identity && data.identity !== 'verified') {
      console.warn(`[TalkyHub] the signed-in user was not verified (API: ${data.identity}); their history will not follow them across devices.`)
    }
    return data
  }

  private async openStream(): Promise<void> {
    window.clearTimeout(this.streamTimer)
    this.streamTimer = undefined
    try {
      const res = await fetch(this.url('/realtime/ticket'), {
        method: 'POST',
        headers: { [SESSION_HEADER]: this.sessionToken },
      })
      if (!res.ok) {
        // 4xx: the session itself is no good (expired, conversation gone) — another ticket won't
        // fix it. 5xx is the server having a moment; try again.
        if (res.status >= 500) this.retryStream()
        return
      }
      const { stream_url } = (await res.json()) as { stream_url: string }
      const es = new EventSource(`${this.base}${stream_url}`)
      es.onopen = () => {
        // A reconnect, not the first connect: anything sent while the stream was down was missed.
        if (this.streamRetries > 0) void this.catchUp()
        this.streamRetries = 0
      }
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
      // EventSource does reconnect on its own — but to the same URL, and the ticket in it is only
      // good for a minute. The server also ends every stream after 15 minutes. So the browser's
      // retry gets a 401, which EventSource treats as final, and the widget would go deaf for the
      // rest of the page: no agent replies, and no resolution notice — which is how a stored
      // conversationId outlived its conversation. Close it and come back with a fresh ticket.
      es.onerror = () => {
        if (this.es !== es) return // already replaced (rollover / identify)
        es.close()
        this.es = null
        this.retryStream()
      }
      this.es = es
    } catch {
      // offline — POSTs still work; keep trying for live inbound
      this.retryStream()
    }
  }

  private retryStream(): void {
    if (!this.sessionToken || this.streamTimer !== undefined) return
    const delay = Math.min(STREAM_RETRY_MAX_MS, 1000 * 2 ** this.streamRetries++)
    this.streamTimer = window.setTimeout(() => void this.openStream(), delay)
  }

  // Replay what arrived while the stream was down. Only the other side's messages: the visitor's
  // own come back through POST /messages, and a send still in flight has no server id to
  // de-duplicate against yet. pushMessage ignores ids it already has.
  private async catchUp(): Promise<void> {
    try {
      const res = await fetch(this.url('/messages'), { headers: { [SESSION_HEADER]: this.sessionToken } })
      if (!res.ok) return
      const { messages } = (await res.json()) as { messages?: WireMessage[] }
      for (const w of messages ?? []) if (w.author !== 'visitor') this.ev.onMessage(mapWire(w))
    } catch {
      /* the next reconnect tries again */
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
      this.conversationId = data.conversation_id
      saveSession(this.token, { ...loadSession(this.token), conversationId: data.conversation_id })
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
    window.clearTimeout(this.streamTimer)
    this.streamTimer = undefined
    this.streamRetries = 0
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
