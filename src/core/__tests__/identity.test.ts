import { describe, expect, it } from 'vitest'
import { isUserSwitch, normalizeUser, remainingFields, userKey } from '../identity'

const HASH = 'a'.repeat(64)

describe('normalizeUser', () => {
  it('returns nothing for a missing user', () => {
    const empty = { contact: {}, rejected: [], badHash: false }
    expect(normalizeUser(undefined)).toEqual(empty)
    expect(normalizeUser(null)).toEqual(empty)
  })

  it('normalises supplied fields with the same rules as the form', () => {
    const u = normalizeUser({ name: '  Айгиз  Искужин ', email: 'Jane@Example.COM', phone: '+7 (999) 123-45-67' })
    expect(u.contact).toEqual({ name: 'Айгиз Искужин', email: 'Jane@example.com', phone: '+79991234567' })
    expect(u.rejected).toEqual([])
  })

  it('drops an invalid field and reports it, so the form asks for it instead', () => {
    const u = normalizeUser({ name: 'Jane', email: 'jane@localhost', phone: '123' })
    expect(u.contact).toEqual({ name: 'Jane' })
    expect(u.rejected).toEqual(['email', 'phone'])
  })

  it('treats an empty string as not supplied rather than invalid', () => {
    expect(normalizeUser({ name: '', email: 'jane@example.com' })).toEqual({
      contact: { email: 'jane@example.com' },
      rejected: [],
      badHash: false,
    })
  })

  it('accepts a numeric identifier as its string form', () => {
    expect(normalizeUser({ identifier: 42 }).identifier).toBe('42')
  })

  it('ignores a blank identifier', () => {
    expect(normalizeUser({ identifier: '   ' }).identifier).toBeUndefined()
  })

  it('keeps a well-formed hash, lowercased', () => {
    expect(normalizeUser({ identifier: 'u1', identifier_hash: HASH.toUpperCase() }).identifierHash).toBe(HASH)
  })

  it('drops and flags a hash that cannot be an HMAC-SHA256 hex digest', () => {
    for (const bad of ['not-a-hash', 'a'.repeat(63), 'g'.repeat(64)]) {
      const u = normalizeUser({ identifier: 'u1', identifier_hash: bad })
      expect(u.identifierHash).toBeUndefined()
      expect(u.badHash).toBe(true)
    }
  })

  it('never keeps a hash without an identifier to verify it against', () => {
    const u = normalizeUser({ identifier_hash: HASH })
    expect(u.identifierHash).toBeUndefined()
    expect(u.badHash).toBe(true)
  })
})

describe('remainingFields', () => {
  it('skips fields the host supplied', () => {
    expect(remainingFields(['name', 'email', 'phone'], { name: 'Jane', email: 'jane@example.com' })).toEqual(['phone'])
  })

  it('is empty when every configured field is known — the form is skipped', () => {
    expect(remainingFields(['name', 'email'], { name: 'Jane', email: 'jane@example.com', phone: '+79991234567' })).toEqual([])
  })

  it('asks for everything when nothing is known', () => {
    expect(remainingFields(['email', 'phone'], {})).toEqual(['email', 'phone'])
  })
})

describe('userKey', () => {
  it('is stable for the same user, so repeated setUser calls are no-ops', () => {
    const a = normalizeUser({ identifier: 'u1', email: 'jane@example.com' })
    const b = normalizeUser({ identifier: 'u1', email: 'jane@EXAMPLE.com' }) // normalises equal
    expect(userKey(a)).toBe(userKey(b))
  })

  it('changes when a detail changes', () => {
    expect(userKey(normalizeUser({ identifier: 'u1', name: 'Jane' }))).not.toBe(
      userKey(normalizeUser({ identifier: 'u1', name: 'Janet' })),
    )
  })

  it('changes when the hash arrives — an unverified session must be re-identified', () => {
    expect(userKey(normalizeUser({ identifier: 'u1' }))).not.toBe(
      userKey(normalizeUser({ identifier: 'u1', identifier_hash: HASH })),
    )
  })
})

describe('isUserSwitch', () => {
  it('is a switch when a different signed-in user replaces the stored one', () => {
    expect(isUserSwitch('u1', 'u2')).toBe(true)
  })

  it('is not a switch for the same user', () => {
    expect(isUserSwitch('u1', 'u1')).toBe(false)
  })

  it('is not a switch from anonymous to identified — the API decides that', () => {
    expect(isUserSwitch(undefined, 'u1')).toBe(false)
  })

  it('is not a switch when the call carries no identifier', () => {
    expect(isUserSwitch('u1', undefined)).toBe(false)
  })
})
