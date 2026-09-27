import { describe, expect, it } from 'vitest'
import { BUILD, COMMIT, VERSION } from '../version'

// These come from vite `define`, so this also proves the define is wired — without it the
// identifiers would be undefined at runtime and the bundle would throw on load.
describe('build stamp', () => {
  it('carries a semver version', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('carries a commit, or the explicit dev fallback', () => {
    expect(COMMIT).toMatch(/^([0-9a-f]{7}|dev)$/)
  })

  it('composes valid semver build metadata', () => {
    expect(BUILD).toMatch(/^\d+\.\d+\.\d+\+([0-9a-f]{7}|dev)$/)
  })
})
