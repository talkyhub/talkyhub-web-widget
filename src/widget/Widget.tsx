import { useEffect } from 'preact/hooks'
import { effect } from '@preact/signals'
import type { Contact, Message, WidgetConfig } from '../core/types'
import { createTransport } from '../core/transport'
import {
  isOpen,
  attachTransport,
  closeWidget,
  onStartSession,
  prefill,
  preChatPending,
  pushMessage,
  pushNotice,
  registerHost,
  setMessages,
  submitPreChat,
  agentTyping,
} from '../core/store'
import { loadSession, resetSession, saveSession } from '../core/session'
import { isUserSwitch, normalizeUser, remainingFields, userKey } from '../core/identity'
import type { HostUser, NormalizedUser } from '../core/identity'
import { themeVars } from '../core/theme'
import { Panel } from './Panel'
import { Launcher, launcherShape } from './Launcher'
import { Channels } from './Channels'
import { useCompact } from './useCompact'

// `user` is the host app's signed-in user from window.talkyhubSettings. It is known before the
// first render, so the form-or-session decision can use it: a signed-in user never sees the
// form flash, or opens an anonymous session that setUser then has to replace.
export function Widget({ config, user }: { config: WidgetConfig; user?: HostUser | null }) {
  const compact = useCompact()

  useEffect(() => {
    const greeting = (): Message[] =>
      config.greeting ? [{ id: 'greeting', body: config.greeting, author: 'agent', at: Date.now() }] : []
    setMessages(greeting())

    const t = createTransport(config, {
      onMessage: (m) => pushMessage(m),
      onTyping: (on) => {
        agentTyping.value = on
      },
      // A returning visitor's server history replaces the client greeting. An empty history (a
      // verified user moved onto a brand-new conversation) keeps the greeting, not a blank panel.
      onHistory: (list) => setMessages(list.length ? list : greeting()),
      // An agent closed the thread. Say so rather than leaving the visitor to guess why
      // replies stopped — and don't disable the composer: the API reopens a freshly
      // resolved conversation, so typing again is a supported thing to do.
      onResolved: (id) => pushNotice(`sys_resolved_${id}`, 'This conversation was marked resolved.'),
      // The server rolled this message into a new conversation. The divider is what keeps
      // the panel honest: everything above it belongs to the closed thread and no agent is
      // reading it any more.
      onRollover: (id, echoId) => pushNotice(`sys_new_${id}`, 'Started a new conversation.', echoId),
    })
    attachTransport(t)

    // What the host has told us about its signed-in user. The identifier_hash lives here, in
    // memory, and is never persisted.
    let identity: NormalizedUser = normalizeUser(user)
    // The identity THIS page load's session was opened with, for de-duplicating setUser calls.
    // Not persisted on purpose: a session opened anonymously on this load must still be
    // re-identified, even if last visit's user was the same person.
    let appliedKey: string | null = null
    let started = false
    // Mirrors preChatPending as a PLAIN variable on purpose. The open-watcher below must not
    // subscribe to that signal: submitPreChat() clears it before handing over the answers, so a
    // tracked read would re-run the effect and open the session with the pre-form contact.
    let gated = false

    const warnRejected = (u: NormalizedUser) => {
      if (u.rejected.length) {
        console.warn(`[TalkyHub] setUser: ignored invalid ${u.rejected.join(', ')}; the pre-chat form will ask instead.`)
      }
      if (u.badHash) {
        console.warn('[TalkyHub] setUser: identifier_hash must be a 64-character hex HMAC-SHA256 with an identifier; it was ignored.')
      }
    }

    const begin = (contact?: Contact) => {
      if (started) return // idempotent: boot() and the open-watcher below can both call it
      started = true
      appliedKey = userKey(identity)
      // Host-supplied details win over anything stored or typed: the app's record of its own
      // signed-in user is more authoritative than a pre-chat answer from a past visit.
      void t.start({
        contact: { ...contact, ...identity.contact },
        identifier: identity.identifier,
        identifierHash: identity.identifierHash,
      })
    }

    // Opening a session is what creates the conversation, so it never happens just because a page
    // loaded. With pre-chat enabled it waits for the form; without one it waits for the visitor to
    // open the widget (the effect below). Fields the host already supplied are not asked, and if
    // that covers all of them the form is skipped.
    const boot = () => {
      if (started) return
      const s = loadSession(config.token)
      prefill.value = identity.contact
      if (config.preChat.enabled && !s.preChatDone && remainingFields(config.preChat.fields, identity.contact).length) {
        gated = true
        preChatPending.value = true
        return
      }
      gated = false
      preChatPending.value = false
      // A visitor who already has a thread is only being resumed — nothing is created — and
      // connecting now is what keeps their unread badge working while the panel is shut. A
      // first-time visitor gets nothing until they actually open the widget.
      if (s.conversationId || s.preChatDone || s.contact) begin(s.contact)
    }

    // Forget this browser's visitor and start again — as `next` when a different user signs in,
    // anonymously on logout. On a shared device this is what stops the next person opening the
    // widget onto the previous person's conversation.
    const resetAll = (next: NormalizedUser = normalizeUser(undefined)) => {
      t.stop()
      resetSession(config.token)
      identity = next
      appliedKey = null
      started = false
      setMessages(greeting())
      closeWidget()
      if (next.identifier) saveSession(config.token, { ...loadSession(config.token), identifier: next.identifier })
      boot()
    }

    const applyUser = (input: HostUser | null) => {
      if (input === null) return resetAll() // setUser(null) is a logout
      const next = normalizeUser(input)
      warnRejected(next)
      if (started && appliedKey === userKey(next)) return // same user, same details
      if (isUserSwitch(loadSession(config.token).identifier, next.identifier)) return resetAll(next)

      identity = next
      if (next.identifier) saveSession(config.token, { ...loadSession(config.token), identifier: next.identifier })
      prefill.value = next.contact

      if (!started) {
        // Still on the form. If the host just supplied everything it asks for, skip it.
        if (preChatPending.value && !remainingFields(config.preChat.fields, next.contact).length) submitPreChat({})
        return
      }
      appliedKey = userKey(next)
      void t.identify({ contact: next.contact, identifier: next.identifier, identifierHash: next.identifierHash })
    }

    // Boot-time checks, before anything opens a session.
    const stored = loadSession(config.token)
    warnRejected(identity)
    if ((user === null && stored.identifier) || isUserSwitch(stored.identifier, identity.identifier)) {
      // The app says nobody is signed in, or that someone else is: the stored visitor session
      // belongs to another person either way.
      resetSession(config.token)
    }
    if (identity.identifier) {
      saveSession(config.token, { ...loadSession(config.token), identifier: identity.identifier })
    }

    onStartSession((contact?: Contact) => {
      gated = false
      const merged = { ...contact, ...identity.contact }
      saveSession(config.token, { ...loadSession(config.token), contact: merged, preChatDone: true })
      begin(merged)
    })

    // Registered before boot() so a setUser queued before mount is applied to the first
    // decision, rather than triggering a second /session right after it.
    registerHost({ setUser: applyUser, reset: () => resetAll() })
    boot()

    // The deferred half of the rule above: the first open of the panel opens the session.
    // begin() is idempotent, so this is a no-op once one exists.
    const stopOpenWatch = effect(() => {
      if (isOpen.value && !gated) begin(loadSession(config.token).contact)
    })

    return () => {
      stopOpenWatch()
      registerHost(null)
      t.stop()
      preChatPending.value = false
    }
  }, [])

  const { accent, onAccent, position, launcher } = config.appearance
  // The panel and the floating channel row both clear the launcher, whose height differs per
  // shape — and the shape isn't just the configured value (see launcherShape).
  const shape = launcherShape(launcher, isOpen.value)
  return (
    <div
      class={`tk ${position === 'bottom-left' ? 'is-left' : ''} launcher-${shape}`}
      // Every accent-derived colour lands here as a custom property, so the gradient, the
      // shadows, the tinted surfaces and the mascot's own SVG stops all follow the site's
      // brand without a second source of truth.
      style={themeVars(accent, onAccent) as unknown as Record<string, string>}
    >
      <Panel config={config} channels={compact ? config.channels : []} />
      {/* Floating beside the launcher on desktop, and only while the panel is open — the
          row is an alternative to the conversation, so it belongs where the conversation
          already has the visitor's attention. On phones it moves inside the panel instead;
          see useCompact. */}
      {!compact && isOpen.value && (
        <Channels channels={config.channels} variant="float" originRight={position !== 'bottom-left'} />
      )}
      <Launcher config={config} />
    </div>
  )
}
