import { describe, expect, it } from 'vitest'
import { validateCustom, validateEmail, validateName, validatePhone } from '../validate'

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

// Custom fields mirror the API's parser (PreChatCustomFields.Coerce): a value it would refuse with a
// 400 refuses the whole chat, so it has to be caught here instead.
describe('validateCustom', () => {
  const f = (type: string, required = false, options: string[] = []) => ({ type, required, options })
  const value = (type: string, raw: string | boolean, options?: string[]) => validateCustom(f(type, false, options), raw)

  it('skips a blank optional answer and requires a required one', () => {
    expect(value('text', '  ')).toEqual({ error: null })
    expect(validateCustom(f('text', true), '').error).not.toBeNull()
    expect(validateCustom(f('list', true, ['a']), '').error).not.toBeNull()
  })

  it('text: trimmed, up to 500 characters', () => {
    expect(value('text', '  Клиника  ')).toEqual({ error: null, value: 'Клиника' })
    expect(value('text', 'x'.repeat(501)).error).not.toBeNull()
  })

  it('number: reads what people type and sends a number', () => {
    expect(value('number', '1 234,5')).toEqual({ error: null, value: 1234.5 })
    expect(value('number', '-3')).toEqual({ error: null, value: -3 })
    expect(value('number', '12abc').error).not.toBeNull()
    expect(value('number', '1,2,3').error).not.toBeNull()
    expect(value('number', '1e40').error).not.toBeNull()
    expect(value('number', '9'.repeat(20)).error).not.toBeNull()
  })

  it('link: bare hosts, ports and http(s) pass; other schemes and dotless hosts do not', () => {
    expect(value('link', 'clinic.ru')).toEqual({ error: null, value: 'clinic.ru' })
    expect(value('link', 'clinic.ru:8080/a')).toEqual({ error: null, value: 'clinic.ru:8080/a' })
    expect(value('link', 'https://clinic.ru/x?y=1').error).toBeNull()
    expect(value('link', 'javascript://alert(1)').error).not.toBeNull()
    expect(value('link', 'localhost').error).not.toBeNull()
    expect(value('link', 'clinic .ru').error).not.toBeNull()
  })

  it('date: real yyyy-MM-dd dates only', () => {
    expect(value('date', '2026-10-28')).toEqual({ error: null, value: '2026-10-28' })
    expect(value('date', '2026-02-30').error).not.toBeNull()
    expect(value('date', '28.10.2026').error).not.toBeNull()
  })

  it('checkbox: unticked is an answer, unless the box is required', () => {
    expect(value('checkbox', false)).toEqual({ error: null, value: false })
    expect(value('checkbox', true)).toEqual({ error: null, value: true })
    expect(validateCustom(f('checkbox', true), false).error).not.toBeNull()
  })

  it('list: one of the options, sent in the option’s own spelling', () => {
    expect(value('list', 'бизнес', ['Старт', 'Бизнес'])).toEqual({ error: null, value: 'Бизнес' })
    expect(value('list', 'Про', ['Старт', 'Бизнес']).error).not.toBeNull()
  })
})
