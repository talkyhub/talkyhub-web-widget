// A stand-in for the widget's public API, for local development: `npm run dev:api`.
//
// The dev page alone (npm run dev) stubs GET /config and uses MockTransport, which is enough for
// appearance work. This serves the rest of the surface for the things that need a real server —
// identity (docs/identity.md), the SSE stream, an agent resolving a conversation, and the cold
// resolved-thread rollover (docs/widget.md § Conversation lifecycle).
//
//   npm run dev:api
//   open "http://localhost:5173/?api=http://localhost:5178&token=wgt_test"
//
// Not a reimplementation of threadhub-api: it is the smallest thing that exercises the widget's
// side of the contract, including the failure paths the real API is specified to produce.
import http from 'node:http'
import { randomUUID, createHmac } from 'node:crypto'

const PORT = 5178
// Stands in for the inbox's identity secret. Your backend computes identifier_hash with it:
//   createHmac('sha256', SECRET).update(String(userId)).digest('hex')
const SECRET = 'test-identity-secret'
const sign = (id) => createHmac('sha256', SECRET).update(String(id)).digest('hex')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
}
const json = (res, body, status = 200) => {
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}
const readBody = (req) =>
  new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => r(b ? JSON.parse(b) : {})) })
const now = () => new Date().toISOString()

let S
function conv(key) {
  if (!S.convs.has(key)) S.convs.set(key, { id: randomUUID(), key, messages: [], resolved: false })
  return S.convs.get(key)
}
function reset() {
  S = {
    convs: new Map(),
    byToken: new Map(),
    streams: new Map(),
    sessionLog: [],
    rollNext: false,
    config: {
      preChat: { enabled: false, fields: [] },
      launcher: 'mascot',
      accent: '#6a4ce0',
    },
  }
  // A verified user's thread "from another device", so signing in shows real history.
  conv('uid:user-42').messages.push({
    id: randomUUID(),
    content: 'Ваш заказ отправлен, трек в письме.',
    author: 'agent',
    created_at: new Date(Date.now() - 864e5).toISOString(),
  })
}
function emit(c, event, data) {
  for (const res of S.streams.get(c.id) ?? []) {
    res.write(`id: ${randomUUID()}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }
}
function issue(c) {
  const token = 'sess_' + randomUUID()
  S.byToken.set(token, c)
  return token
}
reset()

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  const p = url.pathname
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end() }

  if (p.endsWith('/config')) {
    const c = S.config
    return json(res, {
      agent_name: 'VerificaHub - Поддержка',
      greeting: 'Привет! 👋 Чем можем помочь?',
      reply_time: null,
      appearance: {
        accent: c.accent,
        position: 'bottom-right',
        launcher: c.launcher,
        launcher_text: 'Напишите нам, мы онлайн!',
      },
      pre_chat: c.preChat,
      channels: [
        { kind: 'telegram', url: 'https://t.me/verificahub' },
        { kind: 'whatsapp', url: 'https://wa.me/79991234567' },
        { kind: 'vk', url: 'https://vk.ru/verificahub' },
        { kind: 'max', url: 'https://max.ru/verificahub' },
      ],
    })
  }

  // POST /session — anonymous, unverified or verified (docs/identity.md decision table).
  if (p.endsWith('/session')) {
    const b = await readBody(req)
    S.sessionLog.push(b)
    let key = 'src:' + b.source_id
    let identity = 'anonymous'
    if (b.identifier) {
      if (b.identifier_hash) {
        if (b.identifier_hash !== sign(b.identifier)) return json(res, { detail: 'identifier_hash invalid' }, 401)
        key = 'uid:' + b.identifier // verified: same contact on every device
        identity = 'verified'
      } else {
        identity = 'unverified' // identifier ignored entirely, resolved by source_id
      }
    }
    const c = conv(key)
    return json(res, { session_token: issue(c), conversation_id: c.id, messages: c.messages, identity })
  }

  if (p.endsWith('/realtime/ticket')) {
    const c = S.byToken.get(req.headers['x-talkyhub-session'])
    if (!c) return json(res, {}, 401)
    return json(res, {
      ticket: c.id,
      stream_url: `/api/v1/widget/wgt_test/realtime/stream?ticket=${c.id}`,
      expires_in_seconds: 60,
    })
  }

  // One stream per conversation, so a widget that fails to re-ticket after a rollover goes quiet.
  if (p.endsWith('/realtime/stream')) {
    const id = url.searchParams.get('ticket')
    res.writeHead(200, { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' })
    res.write(': connected\n\n')
    if (!S.streams.has(id)) S.streams.set(id, new Set())
    S.streams.get(id).add(res)
    req.on('close', () => S.streams.get(id)?.delete(res))
    return
  }

  if (p.endsWith('/messages')) {
    const b = await readBody(req)
    let c = S.byToken.get(req.headers['x-talkyhub-session'])
    if (!c) return json(res, {}, 401)

    // A resolved thread that has gone cold rolls over to a new conversation, and the widget
    // follows via the fresh session_token. Arm it with GET /__cold.
    let rolled = null
    if (S.rollNext && c.resolved) {
      S.rollNext = false
      c = conv(`${c.key}#${S.convs.size}`)
      rolled = issue(c)
    }
    c.resolved = false

    const msg = { id: randomUUID(), content: b.content, author: 'visitor', created_at: now(), echo_id: b.echo_id }
    c.messages.push({ ...msg, echo_id: undefined })
    setTimeout(() => emit(c, 'message', { id: randomUUID(), content: 'Принято, смотрим.', author: 'agent', created_at: now() }), 500)
    return json(res, { message: msg, conversation_id: c.id, session_token: rolled })
  }

  // ---- dev controls -------------------------------------------------------------------
  if (p === '/__reset') { reset(); return json(res, { ok: true }) }
  if (p === '/__config') {
    const q = url.searchParams
    if (q.has('prechat')) {
      const f = q.get('prechat') || ''
      S.config.preChat = { enabled: !!f, fields: f ? f.split(',') : [] }
    }
    if (q.has('launcher')) S.config.launcher = q.get('launcher')
    if (q.has('accent')) S.config.accent = q.get('accent')
    return json(res, S.config)
  }
  if (p === '/__resolve') {
    // What an agent clicking "Resolve" looks like to the widget.
    let n = 0
    for (const c of S.convs.values()) {
      if (!S.streams.get(c.id)?.size) continue
      c.resolved = true
      emit(c, 'conversation.resolved', { conversation_id: c.id })
      n++
    }
    return json(res, { resolved: n })
  }
  if (p === '/__cold') { S.rollNext = true; return json(res, { ok: true, note: 'next message on a resolved thread starts a new conversation' }) }
  if (p === '/__state') {
    return json(res, {
      sessionLog: S.sessionLog,
      conversations: [...S.convs.values()].map((c) => ({ id: c.id, key: c.key, messages: c.messages.length, resolved: c.resolved })),
      sign: { 'user-42': sign('user-42'), 'user-7': sign('user-7') },
    })
  }

  res.writeHead(404, CORS)
  res.end()
}).listen(PORT, () => {
  console.log(`widget stub API on http://localhost:${PORT}`)
  console.log(`open  http://localhost:5173/?api=http://localhost:${PORT}&token=wgt_test`)
  console.log(`verified user-42 hash: ${sign('user-42')}`)
})
