import type { Contact, PreChatField } from './types'
import { PRE_CHAT_FIELDS } from './types'
import { validateEmail, validateName, validatePhone } from './validate'
import type { FieldResult } from './validate'

/**
 * What the host app passes to identify its signed-in user — `window.talkyhubSettings.user`
 * at boot, or `TalkyHub.setUser()` at runtime.
 *
 * Two tiers, and the difference is a security boundary, not a feature flag:
 *  - name/email/phone alone are PREFILL. They skip pre-chat fields and label the contact, but
 *    anything in a page can be edited from devtools, so the API never uses them to look up an
 *    existing contact or its history.
 *  - identifier + identifier_hash is IDENTITY. The hash is HMAC-SHA256(identifier) keyed with
 *    the inbox's identity secret, computed on the host's BACKEND. Only a verified identifier
 *    lets the API resolve the same contact and conversation across devices. An identifier
 *    without a valid hash is never trusted. See docs/identity.md.
 */
export interface HostUser {
  name?: string
  email?: string
  phone?: string
  identifier?: string | number
  identifier_hash?: string
}

export interface NormalizedUser {
  /** Validated, normalised fields — only the ones that passed. */
  contact: Contact
  identifier?: string
  identifierHash?: string
  /** Fields the host supplied that failed validation; the form asks for them instead. */
  rejected: PreChatField[]
  /** A hash was supplied but could never verify, so it was dropped. */
  badHash: boolean
}

const VALIDATORS: Record<PreChatField, (raw: string) => FieldResult> = {
  name: validateName,
  email: validateEmail,
  phone: validatePhone,
}

// A 64-char hex SHA-256 HMAC. Anything else cannot verify, so it is dropped here rather than
// sent to earn a guaranteed 401 — the integrator gets a console warning instead.
const HMAC_HEX = /^[0-9a-f]{64}$/i

export function normalizeUser(input: HostUser | null | undefined): NormalizedUser {
  const out: NormalizedUser = { contact: {}, rejected: [], badHash: false }
  if (!input || typeof input !== 'object') return out

  for (const f of PRE_CHAT_FIELDS) {
    const raw = input[f]
    if (raw === undefined || raw === null || raw === '') continue
    // Same rules as the form. Prefill is not a way around validation: an app with a malformed
    // phone on file should get the field shown, not garbage written to the contact.
    const { error, value } = VALIDATORS[f](String(raw))
    if (error) out.rejected.push(f)
    else out.contact[f] = value
  }

  const id = input.identifier
  if ((typeof id === 'string' && id.trim()) || (typeof id === 'number' && Number.isFinite(id))) {
    out.identifier = String(id).trim()
  }

  const hash = typeof input.identifier_hash === 'string' ? input.identifier_hash.trim() : ''
  if (hash) {
    // A hash with nothing to verify it against is as useless as a malformed one.
    if (out.identifier && HMAC_HEX.test(hash)) out.identifierHash = hash.toLowerCase()
    else out.badHash = true
  }
  return out
}

/**
 * The pre-chat fields still worth asking for. A field the host already supplied is not asked
 * again — making a signed-in user type the email the app already knows is exactly the
 * friction this API exists to remove. Empty means the form is skipped.
 */
export function remainingFields(configured: readonly PreChatField[], known: Contact): PreChatField[] {
  return configured.filter((f) => !known[f])
}

/**
 * Stable key for "the same user with the same details", so a host calling setUser on every
 * render (React effects do) doesn't re-post /session each time. Not a security value; it is
 * never sent or stored.
 */
export function userKey(u: NormalizedUser): string {
  const { name, email, phone } = u.contact
  return JSON.stringify([u.identifier ?? null, u.identifierHash ?? null, name ?? null, email ?? null, phone ?? null])
}

/**
 * True when a DIFFERENT signed-in user replaces the one this browser's session belongs to. That
 * must start a fresh visitor session: on a shared device, user B must never open the widget
 * onto user A's conversation. Anonymous -> identified is not a switch; the API decides what a
 * verified identity resolves to.
 */
export function isUserSwitch(storedIdentifier: string | undefined, incoming: string | undefined): boolean {
  return !!storedIdentifier && !!incoming && storedIdentifier !== incoming
}
