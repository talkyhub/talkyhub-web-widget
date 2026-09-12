// Per-visitor session, persisted in localStorage and scoped by widget token so two
// widgets on the same origin don't collide. `sourceId` is the stable visitor id
// (Chatwoot's pubsub_token analogue) sent to the API to resolve/create the contact;
// `sessionToken` is the server-issued, signed handle returned by POST /session that
// authorizes subsequent message/realtime calls for this visitor's conversation.
export interface Session {
  sourceId: string
  sessionToken?: string
  conversationId?: string
}

const KEY = (token: string) => `talkyhub:session:${token}`

function randomId(): string {
  const buf = new Uint8Array(18)
  ;(globalThis.crypto ?? ({} as Crypto)).getRandomValues?.(buf)
  const b64 =
    typeof btoa === 'function'
      ? btoa(String.fromCharCode(...buf))
      : Math.random().toString(36).slice(2)
  return 'src_' + b64.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)
}

// Load the stored session for this token, minting a fresh sourceId on first visit.
// Never throws — private-mode / disabled storage falls back to an in-memory id.
export function loadSession(token: string): Session {
  try {
    const raw = localStorage.getItem(KEY(token))
    if (raw) return JSON.parse(raw) as Session
  } catch {
    /* storage unavailable — fall through to a fresh, ephemeral session */
  }
  const fresh: Session = { sourceId: randomId() }
  saveSession(token, fresh)
  return fresh
}

export function saveSession(token: string, session: Session): void {
  try {
    localStorage.setItem(KEY(token), JSON.stringify(session))
  } catch {
    /* ignore — the session stays in memory for this page load */
  }
}
