export type Author = 'visitor' | 'agent'

export interface Message {
  id: string
  body: string
  author: Author
  at: number
  status?: 'sending' | 'sent' | 'failed'
  // Client-generated id echoed back by the server so an optimistic message can be
  // reconciled with its persisted copy (and stream echoes de-duplicated).
  echoId?: string
}

export type PreChatField = 'name' | 'email' | 'phone'

/** Per-site config — the shape the backend returns from GET /widget/{token}/config. */
export interface WidgetConfig {
  token: string
  apiBase: string
  agentName: string
  greeting?: string
  replyTime?: string
  appearance: {
    accent: string
    position: 'bottom-right' | 'bottom-left'
    launcher: 'mascot' | 'bubble'
  }
  preChat: { enabled: boolean; fields: PreChatField[] }
}

/** Short random id for optimistic client-side messages. */
export function rid(): string {
  return 'm_' + Math.random().toString(36).slice(2, 10)
}
