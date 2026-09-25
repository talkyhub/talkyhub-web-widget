# TalkyHub Web Widget

The embeddable live-chat widget — a small **Preact + TypeScript** bundle a customer drops onto
their site. Inbound messages become conversations in the TalkyHub inbox (`ChannelType.WebChat`),
answered from the existing agent console. See the design note for the full architecture.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 — a fake host page with Talky bottom-right
```

Click Talky → the panel springs open → type a message → the **mock transport** replies. No
backend needed for local dev.

The dev page also stubs `GET /api/v1/widget/demo/config`, so the real `loadConfig()` path runs
against a fake response you can change from the on-page panel: accent, position, launcher,
pre-chat fields, and `greeting: null`. Everything is a query param, so a variant is a URL:

    http://localhost:5173/?accent=%23b6e22f&position=bottom-left&launcher=bubble&prechat=name,email

### Against a stub API

`MockTransport` can't reach the parts that need a server — identity, the SSE stream, an agent
resolving a conversation. `dev/stub-api.mjs` serves those, including the failure paths the real
API is specified to produce:

```bash
npm run dev:api    # http://localhost:5178, in a second terminal
open "http://localhost:5173/?api=http://localhost:5178&token=wgt_test"
```

| Control | Does |
|---|---|
| `GET /__config?prechat=name,email&launcher=label` | Change what `/config` serves |
| `GET /__resolve` | What an agent clicking **Resolve** looks like — the widget shows the resolved notice |
| `GET /__cold` | Arms the cold-thread rollover: the next message starts a new conversation and the widget re-binds |
| `GET /__state` | Session requests received, conversations, and the `identifier_hash` values for the test users |
| `GET /__reset` | Fresh server state |

Sign in as a verified user by passing `?userjson=` (see [docs/identity.md](docs/identity.md));
`/__state` prints the hash to use. `user-42` has a seeded thread, so a verified sign-in shows
history that arrived "from another device".

## Build

```bash
npm test           # vitest — the validation rules are specified by their tests
npm run build      # → dist/widget/v1/  (self-contained IIFE: Preact + CSS inlined)
```

The build emits three files: `loader.js` (the stable embed URL, short-cached),
`loader.<hash>.js` (immutable, for pinning or rollback) and `manifest.json`. See
[docs/widget.md](docs/widget.md#releases-and-cdn-caching).

The customer install snippet is one async script:

```html
<script async src="https://cdn.talkyhub.ru/widget/v1/loader.js" data-token="wgt_…"></script>
```

## How it's put together

| Piece | File | Role |
|---|---|---|
| Loader | `src/loader.ts` | Reads the token, creates a **Shadow DOM** host, injects CSS, mounts the widget. |
| Widget | `src/widget/Widget.tsx` | Wires the transport; renders the launcher + panel. |
| Launcher | `src/widget/Launcher.tsx` | `mascot` (the full mascot, no circle) or `bubble` (accent-filled circle). |
| Panel | `src/widget/{Panel,Header,MessageList,Message,TypingIndicator,Composer}.tsx` | The chat dialog. |
| Pre-chat | `src/widget/PreChat.tsx` | Gates the thread on `config.preChat.fields`; submitting is what opens the session. |
| Channels | `src/widget/{Channels,brands}.tsx` | Round messenger links beside the launcher (inside the panel on phones). |
| Credit | `src/widget/Credit.tsx` | "Powered by TalkyHub" footer and wordmark, art from threadhub-web-landing. Always shown. |
| Identity | `src/core/identity.ts` | Host-app prefill and verified identity (`TalkyHub.setUser` / `reset`). |
| Validation | `src/core/validate.ts` | Email/phone/name rules + normalisation. Hand-rolled — see the doc for why, and `npm test`. |
| Mascot | `src/widget/Mascot.tsx` | Refined Talky SVG — `brand` / `white` / `wink` variants, accent-driven. |
| Theme | `src/core/theme.ts` | Derives the whole palette (gradient stops, foreground, shadows, tints) from one accent. |
| State | `src/core/store.ts` | `@preact/signals` — `isOpen`, `messages`, `agentTyping`, `unread`, `preChatPending`. |
| Transport | `src/core/transport.ts` | `Transport` interface + `MockTransport` + `SseTransport` (incl. resolve/rollover). |
| Config | `src/core/config.ts` | `loadConfig(token)` → `GET /api/v1/widget/{token}/config`, falls back to defaults. |

## Applying the config

`GET /widget/{token}/config` drives every visible knob, not just the agent name:

| Field | Effect |
|---|---|
| `agent_name` | Panel header, launcher `aria-label`. |
| `greeting` | First bubble in the thread, and the pre-chat form's intro line. |
| `reply_time` | Appended to the header's presence line. |
| `appearance.accent` | Seeds `theme.ts`; every surface follows. `on_accent` overrides the colour drawn on top of it. |
| `appearance.position` | `bottom-right` / `bottom-left`. |
| `appearance.launcher` | `mascot` / `bubble` / `label` (+ `launcher_text`). |
| `pre_chat` | When enabled, the form replaces the thread until it's submitted. |
| `channels` | Round brand links (Telegram, WhatsApp, VK, MAX, Instagram, …) shown while the panel is open. |

**[`docs/widget.md`](docs/widget.md) is the full reference** — every value, the `null`-means-off
rule, how the accent derives the palette, what's in the visitor's stored session (and why the
same thread comes back after a refresh), and the conventions the API side needs to hold up.

**Embedding in your own app?** Pass the signed-in user and the pre-chat form is skipped —
`window.talkyhubSettings.user`, or `TalkyHub.setUser()` / `TalkyHub.reset()` at runtime. See
[docs/identity.md](docs/identity.md) for the prefill vs. verified-identity split and the
HMAC contract.

**Isolation:** v0 uses Shadow DOM (blocks CSS bleed both ways; single bundle, easy to run). The
mount seam in `loader.ts` is deliberately thin so it can be swapped for an **iframe** when full
origin isolation is wanted — the design note's recommended production hardening.

The realtime transport is **SSE** (`src/core/transport.ts` `SseTransport`), mirroring the
threadhub-api agent console — `POST /session` → history → `EventSource` in, REST out. It falls
back to `MockTransport` for local dev (no `data-api`). See `docs/webchat-widget.md` in threadhub-api.

Conversation lifecycle (an agent resolving, and the server's grace window rolling a cold thread
into a new conversation) is handled in the transport and rendered as centred system notices —
see [docs/widget.md](docs/widget.md#conversation-lifecycle). To exercise it locally you need a
real API rather than the mock transport; point the harness at one with
`?api=https://…&token=wgt_…`.

## Deploy

Self-hosted static bundle, served by host nginx at **cdn.talkyhub.ru** (same server as the API/docs).

- `.github/workflows/deploy.yml` — on push to `production` (or manual): `npm run build` →
  `dist/widget/v1/loader.js`, then rsync `dist/` to the server over SSH (additive — older
  `/widget/vN/` stay live). Uses the **production** environment: secret `SSH_KEY` + vars
  `SSH_HOST`/`SSH_USER`/`SSH_PORT`/`CDN_DEPLOY_PATH` (same values as the api/docs repos).
- `deploy/nginx/cdn.talkyhub.ru.conf` — host nginx vhost (exact `server_name`, `*.talkyhub.ru`
  wildcard cert, immutable cache on hashed builds only — `loader.js` itself revalidates).
  Install to `sites-available` + symlink + reload.

Embed on a customer site (token from `POST /api/v1/workspaces/{ws}/channels/webchat`):

    <script async src="https://cdn.talkyhub.ru/widget/v1/loader.js"
      data-token="wgt_…" data-api="https://api.talkyhub.ru"></script>

## Roadmap

1. **Offline form** — when the inbox is outside business hours (pre-chat itself is done).
2. **Identity, API side** — the widget ships `TalkyHub.setUser` / `reset` and sends
   `identifier` + `identifier_hash`; verification is specified in [docs/identity.md](docs/identity.md).
3. **iframe isolation** + lazy-loaded panel chunk (keep the loader small).
4. **Localisation** — the pre-chat labels and composer placeholder are still English-only.
5. **Attachments & emoji** — the composer renders both buttons but keeps them `disabled`; they
   go live when file upload and an emoji picker exist. A button that silently does nothing is
   worse than one that says it isn't ready.
