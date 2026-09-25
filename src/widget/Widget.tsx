import { useEffect, useRef } from 'preact/hooks'
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
  const rootRef = useRef<HTMLDivElement>(null)

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
      const session = {
        contact: { ...contact, ...identity.contact },
        identifier: identity.identifier,
        identifierHash: identity.identifierHash,
      }
      // A visitor who already has a conversation resumes it now — that creates nothing, and it
      // is what keeps the unread badge live while the panel is shut. Everyone else is only
      // armed: their first message is what opens the session, so a widget that is loaded,
      // opened and abandoned leaves no empty conversation behind.
      if (loadSession(config.token).conversationId) void t.start(session)
      else t.arm(session)
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
        preChatPending.value = true
        return
      }
      preChatPending.value = false
      begin(s.contact)
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
      const merged = { ...contact, ...identity.contact }
      saveSession(config.token, { ...loadSession(config.token), contact: merged, preChatDone: true })
      begin(merged)
    })

    // Registered before boot() so a setUser queued before mount is applied to the first
    // decision, rather than triggering a second /session right after it.
    registerHost({ setUser: applyUser, reset: () => resetAll() })
    boot()

    return () => {
      registerHost(null)
      t.stop()
      preChatPending.value = false
    }
  }, [])

  const { accent, onAccent, position, launcher, modal } = config.appearance
  const open = isOpen.value
  // The panel and the floating channel row both clear the launcher, whose height differs per
  // shape — and the shape isn't just the configured value (see launcherShape).
  const shape = launcherShape(launcher, open)
  // In modal mode a floating row would sit on the scrim, so the channels move inside the panel
  // — the same place they go on a phone.
  const channelsInPanel = compact || modal

  // Dimming the page makes this a real dialog, so it has to behave like one: Escape closes it,
  // Tab stays inside it, the page underneath stops scrolling, and focus goes back where it came
  // from afterwards. Without the trap, tabbing would walk into a page the visitor can't see.
  useEffect(() => {
    const root = rootRef.current
    const panel = root?.querySelector<HTMLElement>('.tk-panel')
    if (!modal || !open || !root || !panel) return

    const shadow = root.getRootNode() as ShadowRoot
    const restoreTo = shadow.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusable = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeWidget()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusable()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && shadow.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && shadow.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    root.addEventListener('keydown', onKeyDown)
    // Land on the thing the visitor came to use, not the minimise button.
    ;(panel.querySelector<HTMLElement>('.tk-input, .tk-field-input') ?? focusable()[0])?.focus()

    return () => {
      root.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      restoreTo?.focus?.()
    }
  }, [modal, open])

  return (
    <div
      ref={rootRef}
      class={`tk ${position === 'bottom-left' ? 'is-left' : ''} ${modal ? 'is-modal' : ''} launcher-${shape}`}
      // Every accent-derived colour lands here as a custom property, so the gradient, the
      // shadows, the tinted surfaces and the mascot's own SVG stops all follow the site's
      // brand without a second source of truth.
      style={themeVars(accent, onAccent) as unknown as Record<string, string>}
    >
      {modal && open && <div class="tk-backdrop" onClick={closeWidget} aria-hidden="true" />}
      <Panel config={config} channels={channelsInPanel ? config.channels : []} />
      {/* Floating beside the launcher on desktop, and only while the panel is open — the
          row is an alternative to the conversation, so it belongs where the conversation
          already has the visitor's attention. On phones it moves inside the panel instead;
          see useCompact. */}
      {!channelsInPanel && open && (
        <Channels channels={config.channels} variant="float" originRight={position !== 'bottom-left'} />
      )}
      <Launcher config={config} />
    </div>
  )
}
