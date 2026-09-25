import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadConfig } from '../config'

// The config response is public, unauthenticated JSON that ends up driving colours, links and
// form fields on a customer's page. These cases pin the rule that it is validated, not
// trusted — a bad row in the dashboard database must degrade, never break the page.

function respond(body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => body }))
}

const load = () => loadConfig('wgt_test', 'https://api.example')

afterEach(() => vi.unstubAllGlobals())

describe('channels', () => {
  it('drops javascript: URLs', async () => {
    respond({ channels: [{ kind: 'telegram', url: 'javascript:alert(1)' }] })
    expect((await load()).channels).toEqual([])
  })

  it('drops data: URLs', async () => {
    respond({ channels: [{ kind: 'link', url: 'data:text/html,<script>alert(1)</script>' }] })
    expect((await load()).channels).toEqual([])
  })

  it('drops relative URLs — the widget runs on someone else’s origin', async () => {
    respond({ channels: [{ kind: 'link', url: '/support' }] })
    expect((await load()).channels).toEqual([])
  })

  it('keeps http, https, mailto and tel', async () => {
    respond({
      channels: [
        { kind: 'telegram', url: 'https://t.me/x' },
        { kind: 'link', url: 'http://example.com' },
        { kind: 'email', url: 'mailto:support@example.com' },
        { kind: 'phone', url: 'tel:+79991234567' },
      ],
    })
    expect((await load()).channels.map((c) => c.kind)).toEqual(['telegram', 'link', 'email', 'phone'])
  })

  it('falls back to the generic kind for a brand it has never heard of', async () => {
    respond({ channels: [{ kind: 'signal', url: 'https://signal.me/x' }] })
    const [c] = (await load()).channels
    expect(c.kind).toBe('link')
    // The host, not the word "Link" — it is what the visitor recognises, and it gives the
    // monogram a real initial (S) instead of a meaningless L.
    expect(c.label).toBe('signal.me')
  })

  // `kind` is a display hint; the URL already carries the answer. Omitting it must not
  // downgrade a known brand to a grey placeholder.
  it.each([
    ['https://t.me/verificahub', 'telegram', 'Telegram'],
    ['https://telegram.me/x', 'telegram', 'Telegram'],
    ['https://wa.me/79991234567', 'whatsapp', 'WhatsApp'],
    ['https://api.whatsapp.com/send?phone=1', 'whatsapp', 'WhatsApp'],
    ['https://vk.com/verificahub', 'vk', 'VK'],
    ['https://vk.ru/verificahub', 'vk', 'VK'],
    ['https://max.ru/verificahub', 'max', 'MAX'],
    ['https://www.instagram.com/verificahub', 'instagram', 'Instagram'],
    ['mailto:support@example.com', 'email', 'Email'],
    ['tel:+79991234567', 'phone', 'Phone'],
  ])('infers %s as %s when kind is omitted', async (url, kind, label) => {
    respond({ channels: [{ url }] })
    const [c] = (await load()).channels
    expect(c.kind).toBe(kind)
    expect(c.label).toBe(label)
  })

  it('infers from the URL when kind is unrecognised', async () => {
    respond({ channels: [{ kind: 'telegramm', url: 'https://t.me/x' }] })
    expect((await load()).channels[0].kind).toBe('telegram')
  })

  it('does not hand a brand mark to a lookalike domain', async () => {
    respond({
      channels: [
        { url: 'https://evil-t.me/x' },
        { url: 'https://t.me.attacker.com/x' },
        { url: 'https://notvk.com/x' },
      ],
    })
    expect((await load()).channels.map((c) => c.kind)).toEqual(['link', 'link', 'link'])
  })

  it('honours an explicit kind over the URL', async () => {
    respond({ channels: [{ kind: 'max', url: 'https://support.example.com/chat' }] })
    expect((await load()).channels[0].kind).toBe('max')
  })

  it('honours an explicit label over both', async () => {
    respond({ channels: [{ url: 'https://t.me/x', label: 'Наш Telegram' }] })
    const [c] = (await load()).channels
    expect(c.kind).toBe('telegram')
    expect(c.label).toBe('Наш Telegram')
  })

  it('labels each channel with its brand name by default', async () => {
    respond({ channels: [{ kind: 'whatsapp', url: 'https://wa.me/1' }] })
    expect((await load()).channels[0].label).toBe('WhatsApp')
  })

  it('ignores a colour override that is not a hex value', async () => {
    respond({ channels: [{ url: 'https://signal.me/x', color: 'red; background:url(x)' }] })
    expect((await load()).channels[0].color).toBeUndefined()
  })

  it('drops a channel with no URL rather than rendering a dead button', async () => {
    respond({ channels: [{ kind: 'vk' }, { kind: 'telegram', url: 'https://t.me/x' }] })
    expect((await load()).channels).toHaveLength(1)
  })
})

describe('appearance', () => {
  it('rejects a non-hex accent', async () => {
    respond({ appearance: { accent: 'rebeccapurple' } })
    expect((await load()).appearance.accent).toBe('#6a4ce0')
  })

  it('rejects an unknown position so the widget cannot land off-screen', async () => {
    respond({ appearance: { position: 'top-middle' } })
    expect((await load()).appearance.position).toBe('bottom-right')
  })

  it('rejects an unknown launcher', async () => {
    respond({ appearance: { launcher: 'hologram' } })
    expect((await load()).appearance.launcher).toBe('mascot')
  })
})

describe('null means off, undefined means "no opinion"', () => {
  it('hides the greeting on an explicit null', async () => {
    respond({ greeting: null, reply_time: null })
    const c = await load()
    expect(c.greeting).toBeUndefined()
    expect(c.replyTime).toBeUndefined()
  })

  it('keeps the default when the key is absent', async () => {
    respond({})
    expect((await load()).greeting).toBe('Hi! 👋 Question about your order or setup?')
  })
})

describe('modal mode', () => {
  it('is off unless the API turns it on', async () => {
    respond({})
    expect((await load()).appearance.modal).toBe(false)
  })

  it('is read from the API response', async () => {
    respond({ appearance: { modal: true } })
    expect((await load()).appearance.modal).toBe(true)
  })

  it('ignores a non-boolean value', async () => {
    respond({ appearance: { modal: 'yes' } })
    expect((await load()).appearance.modal).toBe(false)
  })
})

describe('pre-chat fields', () => {
  it('renders in canonical order and drops unknown fields', async () => {
    respond({ pre_chat: { enabled: true, fields: ['phone', 'nickname', 'name'] } })
    expect((await load()).preChat.fields).toEqual(['name', 'phone'])
  })
})

describe('failure', () => {
  it('falls back to defaults when the endpoint is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const c = await load()
    expect(c.agentName).toBe('TalkyHub Support')
    expect(c.channels).toEqual([])
  })
})
