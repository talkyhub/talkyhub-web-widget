import { describe, expect, it } from 'vitest'
import { themeVars } from '../theme'

const on = (accent: string, override?: string) => themeVars(accent, override)['--on-accent']

// What colour the header text, outgoing bubbles and send button take on a given brand accent.
describe('--on-accent', () => {
  it('keeps white on mid-tone brand colours', () => {
    // #1f93ff is the case that matters: raw contrast marginally favours dark ink, but every
    // other chat widget puts white on a blue like this, and so do we.
    for (const accent of ['#1f93ff', '#6a4ce0', '#e2445c', '#111111', '#0b5cff']) {
      expect(on(accent)).toBe('#ffffff')
    }
  })

  it('flips to ink only on genuinely light accents, where white is unreadable', () => {
    for (const accent of ['#b6e22f', '#ffffff', '#ffe066', '#f2f2f2']) {
      expect(on(accent)).toBe('#17142a')
    }
  })

  it('honours an explicit override in both directions', () => {
    expect(on('#b6e22f', '#ffffff')).toBe('#ffffff')
    expect(on('#1f93ff', '#17142a')).toBe('#17142a')
  })

  it('falls back to the computed colour when the override is not a hex value', () => {
    expect(on('#1f93ff', 'white')).toBe('#ffffff')
    expect(on('#b6e22f', 'rgb(0,0,0)')).toBe('#17142a')
  })
})
