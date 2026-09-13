import { useEffect, useRef } from 'preact/hooks'
import type { Contact, WidgetConfig } from '../core/types'
import { createTransport } from '../core/transport'
import {
  isOpen,
  attachTransport,
  onStartSession,
  onLabelDismissed,
  labelDismissed,
  preChatPending,
  pushMessage,
  pushNotice,
  setMessages,
  agentTyping,
} from '../core/store'
import { loadSession, saveSession } from '../core/session'
import { themeVars } from '../core/theme'
import { Panel } from './Panel'
import { Launcher, launcherShape } from './Launcher'
import { Channels } from './Channels'
import { useCompact } from './useCompact'

export function Widget({ config }: { config: WidgetConfig }) {
  const transport = useRef<ReturnType<typeof createTransport> | null>(null)
  const compact = useCompact()

  useEffect(() => {
    if (config.greeting) {
      pushMessage({ id: 'greeting', body: config.greeting, author: 'agent', at: Date.now() })
    }
    const t = createTransport(config, {
      onMessage: (m) => pushMessage(m),
      onTyping: (on) => {
        agentTyping.value = on
      },
      // A returning visitor's server history replaces the client greeting.
      onHistory: (list) => setMessages(list),
      // An agent closed the thread. Say so rather than leaving the visitor to guess why
      // replies stopped — and don't disable the composer: the API reopens a freshly
      // resolved conversation, so typing again is a supported thing to do.
      onResolved: (id) => pushNotice(`sys_resolved_${id}`, 'This conversation was marked resolved.'),
      // The server rolled this message into a new conversation. The divider is what keeps
      // the panel honest: everything above it belongs to the closed thread and no agent is
      // reading it any more.
      onRollover: (id, echoId) =>
        pushNotice(`sys_new_${id}`, 'Started a new conversation.', echoId),
    })
    transport.current = t
    attachTransport(t)

    // The session is what creates the conversation, so with a pre-chat form enabled it is
    // deferred until the form is submitted — otherwise every visitor who only hovers the
    // launcher would open an anonymous conversation the agent then has to triage.
    const session = loadSession(config.token)
    labelDismissed.value = !!session.labelDismissed
    onLabelDismissed(() => {
      saveSession(config.token, { ...loadSession(config.token), labelDismissed: true })
    })
    onStartSession((contact?: Contact) => {
      if (contact) saveSession(config.token, { ...loadSession(config.token), contact, preChatDone: true })
      void t.start(contact)
    })

    if (config.preChat.enabled && !session.preChatDone) {
      preChatPending.value = true
    } else {
      void t.start(session.contact)
    }

    return () => {
      t.stop()
      transport.current = null
      preChatPending.value = false
      labelDismissed.value = false
    }
  }, [])

  const { accent, position, launcher } = config.appearance
  // The panel and the floating channel row both clear the launcher, whose height differs per
  // shape — and the shape isn't just the configured value (see launcherShape).
  const shape = launcherShape(launcher, isOpen.value, labelDismissed.value)
  return (
    <div
      class={`tk ${position === 'bottom-left' ? 'is-left' : ''} launcher-${shape}`}
      // Every accent-derived colour lands here as a custom property, so the gradient, the
      // shadows, the tinted surfaces and the mascot's own SVG stops all follow the site's
      // brand without a second source of truth.
      style={themeVars(accent) as unknown as Record<string, string>}
    >
      <Panel config={config} channels={compact ? config.channels : []} />
      {/* Floating beside the launcher on desktop, and only while the panel is open — the
          row is an alternative to the conversation, so it belongs where the conversation
          already has the visitor's attention. On phones it moves inside the panel instead;
          see useCompact. */}
      {!compact && isOpen.value && <Channels channels={config.channels} variant="float" />}
      <Launcher config={config} />
    </div>
  )
}
