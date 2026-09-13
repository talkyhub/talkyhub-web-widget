import { describe, expect, it } from 'vitest'
import { validateEmail, validateName, validatePhone } from '../validate'

// These rules are hand-rolled rather than delegated to libphonenumber-js (see validate.ts
// for the size measurement), which makes the cases below the actual specification. An
// address or number that a real visitor would type belongs in "accepts"; anything that
// would leave support unable to reply belongs in "rejects".

const accepts = (fn: (s: string) => { error: string | null; value: string }, input: string, normalized = input) =>
  it(`accepts ${JSON.stringify(input)}`, () => expect(fn(input)).toEqual({ error: null, value: normalized }))

const rejects = (fn: (s: string) => { error: string | null }, input: string) =>
  it(`rejects ${JSON.stringify(input)}`, () => expect(fn(input).error).not.toBeNull())

describe('validateEmail', () => {
  accepts(validateEmail, 'jane@example.com')
  accepts(validateEmail, 'jane.doe+support@example.co.uk')
  accepts(validateEmail, "o'brien@example.com")
  accepts(validateEmail, 'user_name-123@sub.domain.example.travel')
  accepts(validateEmail, 'a@b.io')
  accepts(validateEmail, '!#$%&*+-/=?^_`{|}~@example.com') // every legal RFC 5322 local char
  accepts(validateEmail, 'jane@xn--80ak6aa92e.com') // punycode IDN
  accepts(validateEmail, 'Jane.Doe@example.com') // local part is case-sensitive, kept

  // Normalised so one person can't become two contacts.
  accepts(validateEmail, 'jane@example.MUSEUM', 'jane@example.museum')
  accepts(validateEmail, '  jane@Example.Com  ', 'jane@example.com')

  rejects(validateEmail, '')
  rejects(validateEmail, 'jane')
  rejects(validateEmail, 'jane@')
  rejects(validateEmail, '@example.com')
  rejects(validateEmail, 'jane@localhost') // dotless: valid on a LAN, a typo here
  rejects(validateEmail, 'jane@example')
  rejects(validateEmail, 'jane example@x.com')
  rejects(validateEmail, 'jane@@example.com')
  rejects(validateEmail, 'jane@example.c') // one-char TLD
  rejects(validateEmail, 'jane@example.123') // all-numeric TLD
  rejects(validateEmail, 'jane@-example.com')
  rejects(validateEmail, 'jane@exam ple.com')
  rejects(validateEmail, `${'a'.repeat(65)}@example.com`) // RFC 5321 local-part limit
  rejects(validateEmail, `jane@${'x'.repeat(250)}.com`) // RFC 5321 total limit
})

describe('validatePhone', () => {
  accepts(validatePhone, '+79991234567')
  accepts(validatePhone, '+861380013800')
  accepts(validatePhone, '+999999999999999') // exactly 15 digits, the E.164 ceiling

  // Formatting people actually type, normalised to E.164.
  accepts(validatePhone, '+7 (999) 123-45-67', '+79991234567')
  accepts(validatePhone, '+44 20 7946 0958', '+442079460958')
  accepts(validatePhone, '+1-555-123-4567', '+15551234567')
  accepts(validatePhone, '0044 20 7946 0958', '+442079460958') // 00 international prefix

  // National format: kept as digits rather than guessing a country code.
  accepts(validatePhone, '8 999 123 45 67', '89991234567')

  rejects(validatePhone, '')
  rejects(validatePhone, '123')
  rejects(validatePhone, '12345') // under the 7-digit floor
  rejects(validatePhone, 'CALL-ME-NOW')
  rejects(validatePhone, '+1 800 FLOWERS') // vanity numbers aren't dialable as typed
  rejects(validatePhone, '+7999123456789012') // 16 digits, over the E.164 ceiling
  rejects(validatePhone, '+0123456789') // country codes never start with 0
  rejects(validatePhone, '++79991234567')
  rejects(validatePhone, '+7999+1234')
  rejects(validatePhone, '7999123<script>')
  rejects(validatePhone, '#79991234567')
})

describe('validateName', () => {
  accepts(validateName, '  Айгиз   Искужин ', 'Айгиз Искужин')
  accepts(validateName, '李雷')
  accepts(validateName, 'Иван 2-й') // digits are legitimate in real names
  accepts(validateName, 'O’Brien-Smith')

  rejects(validateName, '')
  rejects(validateName, '   ')
  rejects(validateName, 'x'.repeat(151))
})
