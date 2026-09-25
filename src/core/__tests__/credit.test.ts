import { describe, expect, it } from 'vitest'
import { SITE_URL, creditUrl } from '../credit'

describe('creditUrl', () => {
  it('points at the marketing site with widget UTM tags', () => {
    expect(creditUrl('shop.example.com')).toBe(
      'https://talkyhub.ru/?utm_source=shop.example.com&utm_medium=widget&utm_campaign=powered_by',
    )
  })

  it('normalises the embedding host', () => {
    expect(new URL(creditUrl('  WWW.Shop.Example.com ')).searchParams.get('utm_source')).toBe('shop.example.com')
  })

  it('omits utm_source when the host is unknown', () => {
    expect(new URL(creditUrl('')).searchParams.has('utm_source')).toBe(false)
    expect(new URL(creditUrl(undefined)).searchParams.has('utm_source')).toBe(false)
  })

  it('cannot be steered somewhere else by a hostile host string', () => {
    const u = new URL(creditUrl('evil.example&utm_campaign=hijack#frag'))
    expect(u.origin + u.pathname).toBe(SITE_URL)
    expect(u.searchParams.get('utm_campaign')).toBe('powered_by')
    expect(u.hash).toBe('')
  })
})
