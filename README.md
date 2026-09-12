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

## Build

```bash
npm run build      # → dist/widget/v1/loader.js  (self-contained IIFE: Preact + CSS inlined)
```

The customer install snippet is one async script:

```html
<script async src="https://cdn.talkyhub.ru/widget/v1/loader.js" data-token="wgt_…"></script>
```

## How it's put together

| Piece | File | Role |
|---|---|---|
| Loader | `src/loader.ts` | Reads the token, creates a **Shadow DOM** host, injects CSS, mounts the widget. |
| Widget | `src/widget/Widget.tsx` | Wires the transport; renders the launcher + panel. |
| Launcher | `src/widget/Launcher.tsx` | The **full mascot** (no circle) as a padded, floating button. |
| Panel | `src/widget/{Panel,Header,MessageList,Message,TypingIndicator,Composer}.tsx` | The chat dialog. |
| Mascot | `src/widget/Mascot.tsx` | Refined Talky SVG — `brand` / `white` / `wink` variants. |
| State | `src/core/store.ts` | `@preact/signals` — `isOpen`, `messages`, `agentTyping`, `unread`. |
| Transport | `src/core/transport.ts` | `Transport` interface + `MockTransport`. **SignalR impl is the next step.** |
| Config | `src/core/config.ts` | `loadConfig(token)` → `GET /api/v1/widget/{token}/config`, falls back to defaults. |

**Isolation:** v0 uses Shadow DOM (blocks CSS bleed both ways; single bundle, easy to run). The
mount seam in `loader.ts` is deliberately thin so it can be swapped for an **iframe** when full
origin isolation is wanted — the design note's recommended production hardening.

The realtime transport is **SSE** (`src/core/transport.ts` `SseTransport`), mirroring the
threadhub-api agent console — `POST /session` → history → `EventSource` in, REST out. It falls
back to `MockTransport` for local dev (no `data-api`). See `docs/webchat-widget.md` in threadhub-api.

## Deploy

Self-hosted static bundle, served by host nginx at **cdn.talkyhub.ru** (same server as the API/docs).

- `.github/workflows/deploy.yml` — on push to `production` (or manual): `npm run build` →
  `dist/widget/v1/loader.js`, then rsync `dist/` to the server over SSH (additive — older
  `/widget/vN/` stay live). Uses the **production** environment: secret `SSH_KEY` + vars
  `SSH_HOST`/`SSH_USER`/`SSH_PORT`/`CDN_DEPLOY_PATH` (same values as the api/docs repos).
- `deploy/nginx/cdn.talkyhub.ru.conf` — host nginx vhost (exact `server_name`, `*.talkyhub.ru`
  wildcard cert, immutable cache on `/widget/v1/*`). Install to `sites-available` + symlink + reload.

Embed on a customer site (token from `POST /api/v1/workspaces/{ws}/channels/webchat`):

    <script async src="https://cdn.talkyhub.ru/widget/v1/loader.js"
      data-token="wgt_…" data-api="https://api.talkyhub.ru"></script>

## Roadmap

1. **Pre-chat & offline forms** — driven by `config.preChat` / business hours.
2. **Identity** — `identify({ email, hash })` with server-side HMAC verification (design §6).
3. **iframe isolation** + lazy-loaded panel chunk (keep the loader small).
