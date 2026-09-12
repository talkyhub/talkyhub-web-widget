import type { PreChatField, WidgetConfig } from './types'

export const DEFAULT_CONFIG: WidgetConfig = {
  token: 'demo',
  apiBase: '',
  agentName: 'TalkyHub Support',
  greeting: 'Hi! 👋 Question about your order or setup?',
  replyTime: 'replies in ~2 min',
  appearance: { accent: '#6a4ce0', position: 'bottom-right', launcher: 'mascot' },
  preChat: { enabled: false, fields: ['name', 'email'] },
}

// Shape returned by GET /api/v1/widget/{token}/config. The API serializes snake_case
// (JsonNamingPolicy.SnakeCaseLower); position/launcher/fields are the exact strings the
// widget uses ("bottom-right", "mascot", "name"|"email"|"phone").
interface RemoteConfig {
  agent_name?: string
  greeting?: string | null
  reply_time?: string | null
  appearance?: {
    accent?: string
    position?: WidgetConfig['appearance']['position']
    launcher?: WidgetConfig['appearance']['launcher']
  }
  pre_chat?: { enabled?: boolean; fields?: PreChatField[] }
}

// Fetch per-site config by token. Falls back to defaults for local dev and whenever the
// backend endpoint isn't reachable yet (design note: GET /api/v1/widget/{token}/config).
export async function loadConfig(token?: string, apiBase = ''): Promise<WidgetConfig> {
  const base: WidgetConfig = { ...DEFAULT_CONFIG, token: token ?? DEFAULT_CONFIG.token, apiBase }
  if (!token || !apiBase) return base
  try {
    const res = await fetch(`${apiBase}/api/v1/widget/${encodeURIComponent(token)}/config`)
    if (!res.ok) return base
    const r = (await res.json()) as RemoteConfig
    return {
      ...base,
      agentName: r.agent_name ?? base.agentName,
      greeting: r.greeting ?? base.greeting,
      replyTime: r.reply_time ?? base.replyTime,
      appearance: { ...base.appearance, ...(r.appearance ?? {}) },
      preChat: {
        enabled: r.pre_chat?.enabled ?? base.preChat.enabled,
        fields: r.pre_chat?.fields ?? base.preChat.fields,
      },
    }
  } catch {
    return base
  }
}
