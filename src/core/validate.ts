// Pre-chat field validation.
//
// Why hand-rolled rather than libphonenumber-js: measured against this bundle, importing
// `isValidPhoneNumber` from `libphonenumber-js/min` costs +30 KB gzip — it takes the widget
// from 16.5 KB to 46.8 KB, a 2.8x increase, on a script that loads on every page view of
// every customer site. That is not a trade worth making for one optional form field.
// Chatwoot reached the same conclusion: libphonenumber-js is in their dependencies but
// reaches only the dashboard bundle; their widget validates with a handful of regexes
// (shared/helpers/Validators.js).
//
// What we give up is per-country plausibility — this cannot tell you that +7 495 123 45 6
// is one digit short for Moscow. What it does catch is every typo that actually makes a
// contact unreachable: a missing @, a bare domain, a number that is too short to dial.
//
// This is UX, not enforcement. Anything that matters has to be re-validated server-side;
// a POST to /session bypasses this file entirely.

export interface FieldResult {
  /** null when valid; otherwise a message to show under the field. */
  error: string | null
  /** Canonical form to send to the API. Only meaningful when error is null. */
  value: string
}

const ok = (value: string): FieldResult => ({ error: null, value })
const bad = (error: string, value = ''): FieldResult => ({ error, value })

// RFC 5321 limits. A longer address is not deliverable, whatever its shape.
const MAX_LOCAL = 64
const MAX_EMAIL = 254

// The WHATWG HTML spec's email regex — what browsers themselves apply to <input type=email>.
// The spec calls it "a willful violation of RFC 5322", and that is the point: the full
// grammar accepts quoted strings, comments and nested folding whitespace that no real
// signup form should take, while rejecting nothing a visitor is likely to type. Do not
// replace this with a stricter homebrew pattern; the usual result is bouncing valid
// addresses with a + tag or a long TLD.
const HTML_EMAIL =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

export function validateEmail(raw: string): FieldResult {
  // Some mobile keyboards and paste sources add a trailing space or a non-breaking one.
  const v = raw.replace(/\s+/g, ' ').trim()
  if (!v) return bad('Required')
  if (v.length > MAX_EMAIL) return bad('That address is too long')
  if (!HTML_EMAIL.test(v)) return bad('Enter a valid email')

  const at = v.lastIndexOf('@')
  const local = v.slice(0, at)
  const domain = v.slice(at + 1)
  if (local.length > MAX_LOCAL) return bad('That address is too long')

  // The HTML regex accepts a dotless domain (`jane@localhost`, `jane@intranet`). Valid on a
  // LAN, never what someone means in a support form on the public web — and a silent typo
  // for `jane@localhost.com`. Requiring a dot here is the one place we are stricter.
  const labels = domain.split('.')
  if (labels.length < 2) return bad('Enter a valid email')

  const tld = labels[labels.length - 1]
  // Two chars minimum, letters only — except punycode IDNs, which are `xn--` plus ASCII.
  if (!/^[a-zA-Z]{2,}$/.test(tld) && !/^xn--[a-z0-9-]+$/i.test(tld)) {
    return bad('Enter a valid email')
  }

  // Addresses are case-insensitive in the domain; the local part technically is not, so
  // only the domain is lowercased. Prevents the same person becoming two contacts.
  return ok(`${local}@${domain.toLowerCase()}`)
}

// E.164: a leading '+', a country code starting 1-9, and at most 15 digits in total.
const E164 = /^\+[1-9]\d{6,14}$/

// Below this a string is a typo or an extension, not a dialable number. The shortest real
// E.164 numbers (a few island nations) are around 8 digits; 7 leaves room without letting
// `12345` through.
const MIN_DIGITS = 7
const MAX_DIGITS = 15

/**
 * Accepts what people actually type — `+7 (999) 123-45-67`, `8 999 123 45 67`,
 * `00 44 20 7946 0958` — and normalises it. A number that already carries a country code
 * comes back in E.164; a national-format number is kept as digits, because guessing its
 * country from the browser locale is how you silently corrupt a contact.
 */
export function validatePhone(raw: string): FieldResult {
  const v = raw.trim()
  if (!v) return bad('Required')

  // Letters are the giveaway for a vanity number or a pasted label ("tel: 555-CALL").
  if (/[A-Za-z]/.test(v)) return bad('Enter a valid phone number')
  if (/[^\d\s+()./-]/.test(v)) return bad('Enter a valid phone number')

  // '00' is the international prefix in most of the world; treat it as '+'.
  let normalized = v.replace(/[\s()./-]/g, '')
  if (normalized.startsWith('00')) normalized = '+' + normalized.slice(2)

  // A '+' anywhere but the front means the number was mangled in transit.
  if (normalized.slice(1).includes('+')) return bad('Enter a valid phone number')

  const digits = normalized.replace(/\D/g, '')
  if (digits.length < MIN_DIGITS) return bad('That number looks too short')
  if (digits.length > MAX_DIGITS) return bad('That number looks too long')

  if (normalized.startsWith('+')) {
    return E164.test(normalized) ? ok(normalized) : bad('Enter a valid phone number')
  }

  // No country code. Keep the digits as typed — an agent in the customer's own country
  // reads `89991234567` fine, and inventing a prefix would be worse than omitting one.
  return ok(digits)
}

// Names get length bounds and nothing else. There is no pattern for a human name: a rule
// that rejects digits also rejects a legitimate `Иван 2-й`, and one that demands two words
// rejects most of Indonesia. The only real failure here is an empty box.
const MAX_NAME = 150

export function validateName(raw: string): FieldResult {
  const v = raw.replace(/\s+/g, ' ').trim()
  if (!v) return bad('Required')
  if (v.length > MAX_NAME) return bad('That name is too long')
  return ok(v)
}
