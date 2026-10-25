import { describe, expect, it, vi } from 'vitest'
import { loadSession, resetSession, saveSession, useMemoryStorage } from '../session'

// The dashboard preview runs on useMemoryStorage(): it must keep a session for the page's
// lifetime and write nothing to the admin's browser.
describe('in-memory session storage', () => {
  it('keeps the session without touching localStorage', () => {
    const setItem = vi.fn()
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem, removeItem: vi.fn() })
    useMemoryStorage()

    const first = loadSession('wgt_preview')
    saveSession('wgt_preview', { ...first, conversationId: 'c1' })
    expect(loadSession('wgt_preview')).toEqual({ sourceId: first.sourceId, conversationId: 'c1' })

    const fresh = resetSession('wgt_preview')
    expect(fresh.sourceId).not.toBe(first.sourceId)
    expect(fresh.conversationId).toBeUndefined()
    expect(setItem).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
