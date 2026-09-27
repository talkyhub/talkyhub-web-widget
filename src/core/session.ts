// Per-visitor session, persisted in localStorage and scoped by widget token so two widgets on
// the same origin don't collide.
//
// Deliberately three opaque fields and no more — every browser-scoped store outlives the thing
// it describes, so the less it holds the fewer ways it can go stale. In particular it holds no
// personal data (the server has the contact, keyed to sourceId) and no credential (the session
// token is fetched fresh on every load and lives only in memory).
export interface Session {
  // Stable visitor id, Chatwoot's pubsub_token analogue, sent to the API to resolve the contact.
  sourceId: string
  // Written once the server has actually created a conversation. Doubles as "this visitor has a
  // live thread", which is what decides whether the pre-chat form appears: asked once per
  // CONVERSATION, not once per browser. A visitor who never sent anything is asked again, and
  // can answer differently.
  conversationId?: string
  // The host app's signed-in user this session belongs to (TalkyHub.setUser), kept so a
  // DIFFERENT user on the same browser is detected and gets a fresh session. The
  // identifier_hash is deliberately never stored — the host re-supplies it on every load.
  identifier?: string
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

/**
 * Forget this browser's visitor entirely: new sourceId, no conversation, no identifier. What
 * logout has to do on a shared device, so the next person to open the widget cannot see the
 * previous one's thread. Chatwoot's `$chatwoot.reset()` equivalent.
 */
export function resetSession(token: string): Session {
  try {
    localStorage.removeItem(KEY(token))
  } catch {
    /* storage unavailable — nothing was persisted to remove */
  }
  return loadSession(token)
}
