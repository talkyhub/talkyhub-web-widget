// 'system' is not a chat participant — it is the widget's own narration of a lifecycle
// change (resolved, rolled over). Rendered as a centred notice, never as a bubble.
export type Author = 'visitor' | 'agent' | 'system'

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

export const PRE_CHAT_FIELDS: readonly PreChatField[] = ['name', 'email', 'phone']

/** Pre-chat answers. Sent as `contact` on POST /session, which resolves/creates the contact. */
export interface Contact {
  name?: string
  email?: string
  phone?: string
}

// Messenger/social channels offered alongside the chat. `kind` selects a built-in brand mark
// and colour; anything unrecognised still renders, as a monogram on `color` (or the accent),
// so the dashboard can add a channel the widget has never heard of.
export type ChannelKind =
  | 'telegram'
  | 'whatsapp'
  | 'vk'
  | 'max'
  | 'instagram'
  | 'email'
  | 'phone'
  | 'link'

export const CHANNEL_KINDS: readonly ChannelKind[] = [
  'telegram',
  'whatsapp',
  'vk',
  'max',
  'instagram',
  'email',
  'phone',
  'link',
]

export interface Channel {
  kind: ChannelKind
  url: string
  /** Accessible name and tooltip. Defaults to the brand's own name. */
  label: string
  /** Brand colour override, for a channel the widget has no built-in mark for. */
  color?: string
}

/** Per-site config — the shape the backend returns from GET /widget/{token}/config. */
export interface WidgetConfig {
  token: string
  apiBase: string
  agentName: string
  /** Undefined means "no greeting" — the API sends null when the inbox greeting is off. */
  greeting?: string
  replyTime?: string
  appearance: {
    accent: string
    position: 'bottom-right' | 'bottom-left'
    // 'label' is the Jivo/Intercom-style greeting card: a pill carrying an invitation to
    // chat. Chatwoot calls the same shape `expanded_bubble` + `launcherTitle`.
    launcher: 'mascot' | 'bubble' | 'label'
    /** Copy inside the 'label' launcher. Ignored by the other two. */
    launcherText: string
    /** Show the TalkyHub wordmark on the label launcher (free-plan attribution). */
    branding: boolean
  }
  preChat: { enabled: boolean; fields: PreChatField[] }
  /** Rendered as round links beside the launcher. Empty means the feature is off. */
  channels: Channel[]
}

/** Short random id for optimistic client-side messages. */
export function rid(): string {
  return 'm_' + Math.random().toString(36).slice(2, 10)
}
