# TalkyHub web widget — configuration reference

Everything the embedded widget reads, where each value comes from, and the conventions the
widget↔API contract follows. Companion to `docs/webchat-widget.md` in **threadhub-api**,
which owns the transport design; this file owns the **configuration surface**.

Three layers decide what a visitor sees, later layers winning over earlier ones:

1. **Widget defaults** — `DEFAULT_CONFIG` in [`src/core/config.ts`](../src/core/config.ts).
   Used as-is when there's no token or no `data-api`, so the widget always renders.
2. **Dashboard config** — `GET /api/v1/widget/{token}/config`, from the inbox's
   `WebChatChannelConfig` row. The normal source of truth.
3. **Per-page overrides** — `window.talkyhubSettings.appearance` or `data-*` attributes on
   the embed script. Appearance only; never business rules like pre-chat.

---

## Embedding

```html
<script async src="https://cdn.talkyhub.ru/widget/v1/loader.js"
  data-token="wgt_…" data-api="https://api.talkyhub.ru"></script>
```

| Attribute | Required | Meaning |
|---|---|---|
| `data-token` | yes | The channel's public widget token. Safe to expose — it grants only the anonymous visitor endpoints. |
| `data-api` | yes in production | API origin. Without it the widget runs on defaults with `MockTransport` — handy for a static preview, useless for real chat. |
| `data-accent` | no | Appearance override, see below. |
| `data-position` | no | Appearance override. |
| `data-launcher` | no | Appearance override. |

The equivalent object form, which takes precedence if present:

```html
<script>
  window.talkyhubSettings = {
    token: 'wgt_…',
    apiBase: 'https://api.talkyhub.ru',
    appearance: { position: 'bottom-left' },   // optional
  };
</script>
```

Overrides exist for sites that need placement to differ per page (a checkout flow moving the
launcher off the "Pay" button, say). They're validated exactly like remote values, and
deliberately cover **appearance only** — pre-chat and greetings are inbox policy and stay
server-owned. `window.chatwootSettings` draws the same line.

`talkyhubSettings.user` identifies a signed-in user — prefill for the pre-chat form, and with
an HMAC, verified identity that follows the user across devices. It has its own reference:
[identity.md](identity.md).

---

## `GET /api/v1/widget/{token}/config`

Anonymous, CORS-any-origin, snake_case. `404` for an unknown token.

```json
{
  "agent_name": "VerificaHub - Поддержка",
  "greeting": null,
  "reply_time": null,
  "appearance": {
    "accent": "#B6E22F",
    "position": "bottom-right",
    "launcher": "label",
    "launcher_text": "Напишите нам, мы онлайн!"
  },
  "pre_chat": { "enabled": true, "fields": ["name", "email", "phone"] },
  "channels": [
    { "kind": "telegram", "url": "https://t.me/verificahub" },
    { "kind": "whatsapp", "url": "https://wa.me/79991234567" },
    { "kind": "vk", "url": "https://vk.com/verificahub" },
    { "kind": "max", "url": "https://max.ru/verificahub", "color": "#6E4BF4" }
  ]
}
```

| Field | Type | Default | Effect |
|---|---|---|---|
| `agent_name` | string | `"TalkyHub Support"` | Panel header; the launcher's `aria-label`. |
| `greeting` | string \| null | built-in copy | First bubble in the thread, and the pre-chat form's intro line. |
| `reply_time` | string \| null | `"replies in ~2 min"` | Appended to the header's presence line (`online · …`). |
| `appearance.accent` | hex string | `#6a4ce0` | Seeds the entire palette. See **Colour**. |
| `appearance.on_accent` | hex string \| null | derived | Forces the text/icon colour drawn on the accent. Only needed when the derived choice is wrong for a brand. |
| `appearance.position` | `bottom-right` \| `bottom-left` | `bottom-right` | Which corner the launcher and panel dock to. |
| `appearance.launcher` | `mascot` \| `bubble` \| `label` | `mascot` | Launcher shape. See **Launchers**. |
| `appearance.launcher_text` | string \| null | `"Chat with us — we're online"` | Copy inside the `label` launcher. Ignored by the others. |
| `pre_chat.enabled` | bool | `false` | Gate the thread behind a form. |
| `pre_chat.fields` | `("name"\|"email"\|"phone")[]` | `["name","email"]` | Which fields to collect. Rendered in canonical order regardless of array order; unknown values are dropped. |
| `channels` | `Channel[]` | `[]` | Messenger links offered beside the chat. See **Channel links**. |

> `launcher: "label"` and `launcher_text` are **not yet served** by
> `GetWidgetConfigEndpoint` — the widget honours them and falls back cleanly, but the
> columns and the dashboard form still need adding on the API side.

### `null` means *off*, not *use the default*

A **missing** key means the backend didn't express an opinion, so the widget default stands.
An **explicit `null`** is a deliberate "don't show this."

That distinction is load-bearing: `GetWidgetConfigEndpoint` sends `greeting: null` exactly
when the inbox greeting is disabled, so collapsing the two with `??` resurrects the built-in
English copy on precisely the sites that turned it off. Applies to `greeting`, `reply_time`
and `launcher_text`.

### Validate, don't trust

This response is unauthenticated public JSON. The widget re-validates everything: a
non-hex `accent`, an unknown `position`, an unknown `pre_chat` field are each dropped in
favour of the default rather than rendering a broken gradient, an off-screen widget, or a
field the form can't build. Keep this property when adding config — a bad row in the
database should degrade, not break the customer's page.

---

## Channel links

Round brand-coloured links to the messengers support also answers on — the Jivo/Bitrix
multi-channel pattern, for a visitor who would rather continue somewhere they already are.

```json
{ "url": "https://t.me/verificahub" }
```

| Field | Required | Notes |
|---|---|---|
| `url` | **yes** | `http:`, `https:`, `mailto:` or `tel:` only — see below. |
| `kind` | no | `telegram`, `whatsapp`, `vk`, `max`, `instagram`, `email`, `phone`, `link`. **Inferred from the URL when omitted** or unrecognised. |
| `label` | no | Accessible name and tooltip. Defaults to the brand's name, or the host for an unknown one. |
| `color` | no | Hex override, for a brand with no built-in mark. Ignored for full-bleed marks. |

### `kind` is optional

`kind` is a display hint, and the URL already carries the answer — so the dashboard can just
store a pasted link. `inferKind()` maps the host:

| URL | Resolves to |
|---|---|
| `t.me`, `telegram.me`, `telegram.org`, `telegram.dog` | `telegram` |
| `wa.me`, `whatsapp.com` (incl. `api.`/`chat.`) | `whatsapp` |
| `vk.com`, `vk.ru`, `vk.me`, `vkontakte.ru` | `vk` |
| `max.ru` | `max` |
| `instagram.com`, `instagr.am` | `instagram` |
| `mailto:` / `tel:` | `email` / `phone` |
| anything else | `link` |

Matching is on the exact host or a subdomain of it. A bare `endsWith('t.me')` would hand
`evil-t.me` the Telegram mark, so `t.me.attacker.com` and `evil-t.me` both resolve to `link`.

An unresolved channel is **not** a dead placeholder: it is labelled with its host
(`signal.me`), which is what the visitor recognises, and the monogram takes its initial from
that — an `S`, not the letter `L` from the word "Link". An explicit `kind` still wins over
inference, and an explicit `label` over both.

**Where they appear.** Only while the panel is open — the row is an alternative to the
conversation, so it belongs where the conversation already has the visitor's attention. On
desktop it floats to the left of the launcher (right, for `bottom-left`); under 480px, where
the panel goes full-screen and a floating row would cover the conversation, the same
component moves **inside** the panel above the composer. `useCompact()` makes that a DOM
move, not a restyle, so the links are never layered over the chat.

**⚠️ URL scheme allow-listing is the important part.** These URLs come from public,
unauthenticated JSON and end up in an `href` on the customer's page. A `javascript:` or
`data:` URL there is stored XSS on every site embedding the widget. `safeUrl()` parses each
one and keeps only the four safe schemes; everything else — including relative URLs, which
are meaningless on someone else's origin — is dropped, and the channel with it. A channel
with an unusable URL is removed rather than rendered dead: a button that does nothing costs
more trust than a missing one. Pinned by tests in `src/core/__tests__/config.test.ts`.

Links also carry `target="_blank" rel="noopener noreferrer"`. Without `noopener` the opened
tab gets `window.opener` on the **customer's** page, not ours.

**Brand marks** are inline SVG in `src/widget/brands.tsx` — the bundle is a single
self-contained IIFE served onto arbitrary origins, so every asset travels inside it (no
`<img src>`, no CDN sprite). Marks exist for Telegram, WhatsApp, VK, MAX, Instagram, email
and phone. Anything else renders as a **monogram** on the brand colour, which doubles as the
fallback for arbitrary "other" links.

Two marks don't follow the plain glyph-on-a-colour pattern:

- **Instagram** is a gradient, not a colour. Flattening it to one stop is the single most
  recognisable way to get it wrong, so the button paints `INSTAGRAM_STOPS` as a gradient.
- **MAX** is **full-bleed**: its artwork is a complete tile whose gradient *is* the logo. It
  is listed in `FULL_BLEED`, which makes the button paint no background and render the mark
  at full size, clipped to the circle. Passing `color` for MAX does nothing — there is no
  visible surface behind the tile to colour. Its gradient ids are uniquified per instance, or
  a second MAX button on the page would reference the first one's `<defs>`.

Usage is nominative — each mark links to that company's own service and nothing else.

---

## Attribution

A quiet "Powered by TalkyHub" credit sits at the very foot of the panel — under the composer or
the pre-chat form — and a small wordmark rides on the `label` launcher. Both are **always on**
and are not configurable: there is no `branding` field, so nothing in the config or the page can
turn them off. The art comes from **threadhub-web-landing**, so the credit matches the site it
links to: the mark is `public/favicon.svg` (drawn for small sizes), the wordmark is `Logo.tsx`'s
"Talky" plus an outlined "Hub" badge. Colours are TalkyHub's, fixed — the credit never follows
the customer's `--accent`. On the label launcher the wordmark switches to `tone="current"`,
since a violet badge on a lime card would clash with both brands at once.

| Practice | How |
|---|---|
| Never competes with the conversation | Last element in the panel, 11px, greyscale at rest; brand colour only on hover or focus (Chatwoot's pattern). |
| Stays readable | "Powered by" uses `--muted`, above 4.5:1 on white even at its resting opacity. |
| Attributed without tracking | `https://talkyhub.ru/?utm_source={embedding host}&utm_medium=widget&utm_campaign=powered_by`. No impression beacon, no pixel: nothing is recorded unless a visitor clicks. |
| Safe for SEO | `rel="nofollow"`. A link injected into the footer of every embedding site is the textbook link scheme in Google's guidelines; passing no ranking signal protects talkyhub.ru from a penalty and keeps customers' pages clean. |
| Safe for the host page | `noopener noreferrer`, `target="_blank"`, and an accessible name that says it opens a new tab. |

It is still client code in an open shadow root, so a determined site could hide it. As with
every vendor, that's a terms-of-service matter rather than a technical one. If removing the
credit ever becomes a paid perk, the lever belongs in `PlanEntitlements` next to `Export` and
`AllChannels`, with the config endpoint computing the field — not a dashboard toggle a free
workspace can flip.

---

## Colour

One accent drives everything. [`src/core/theme.ts`](../src/core/theme.ts) derives, and sets
as CSS custom properties on the widget root:

| Property | Derivation |
|---|---|
| `--accent` | the accent itself |
| `--grad-a` / `--grad-b` | accent at fixed hue, ±tuned lightness/saturation — the two gradient stops |
| `--on-accent` | white or ink, whichever reads better **on both stops** |
| `--on-accent-soft` | `--on-accent` pulled toward the background, for secondary text |
| `--shadow-rgb` | the dark stop, as an `r, g, b` triple for `rgba()` |
| `--surface-2` / `--border` | faint accent washes for incoming bubbles, inputs, hairlines |

Two things worth knowing:

**The design paints surfaces with a gradient, not the flat accent,** so a single `--accent`
var isn't enough — the header, outgoing bubbles, send button and the mascot's own SVG stops
all need to move together. Deriving both stops from one accent keeps a single source of
truth. The deltas are reverse-engineered from the original hand-picked purple pair, so the
stock accent still renders as designed.

**Foreground is chosen by the accent's own luminance**, not by which candidate wins a contrast
comparison. Above 0.45 the accent counts as light and takes dark ink; everything else takes
white. Picking strictly by contrast is measurably more readable but flips mid-tone brands to
dark text — `#1f93ff` scores 3.96 for ink against 2.71 for white — and dark text on a blue reads
as broken next to every other chat widget. The threshold keeps white on blues, reds and purples
while still giving ink to limes and yellows, where white genuinely fails (white on `#B6E22F` is
about 1.7:1). The preference is overruled only when it would be unreadable at both gradient
stops, and `appearance.on_accent` overrides it outright for a brand that needs something
specific.

Never hardcode a brand colour in `styles.css`. The values there are fallbacks for a root
rendered without the inline properties; anything else will be purple on a customer's
lime-green site.

---

## Launchers

| Value | Shape | Use when |
|---|---|---|
| `mascot` | The full Talky mascot, no circle. | Default. Friendly, distinctive. |
| `bubble` | Accent-filled circle, swaps to a close glyph when open. | The character would fight the customer's brand. |
| `label` | Greeting card: mascot + `launcher_text` + optional wordmark. | You want to *invite*, not just offer. The Jivo/Intercom shape; Chatwoot's `expanded_bubble` + `launcherTitle`. |

The `label` card has no dismiss control: opening the panel collapses it to a plain `bubble`,
and closing brings the card back. The invitation is the whole reason to pick this launcher, so
there is no state in which it is gone for good.

---

## Pre-chat validation

[`src/core/validate.ts`](../src/core/validate.ts), specified by
[`src/core/__tests__/validate.test.ts`](../src/core/__tests__/validate.test.ts) — 50 cases
that are the real contract. `npm test`.

Each validator returns `{ error, value }`: `error` is the message shown under the field,
`value` the **normalised** form that goes to the API. Normalising matters as much as
rejecting — `8 (999) 123-45-67` and `89991234567` have to resolve to one contact, not two.

| Field | Accepts | Rejects | Normalises to |
|---|---|---|---|
| `name` | anything non-empty up to 150 chars | empty, whitespace-only, over-long | whitespace collapsed |
| `email` | the WHATWG HTML `<input type=email>` grammar, plus a required dot in the domain and a ≥2-char alphabetic or punycode TLD; RFC 5321 length limits | `jane@localhost`, `jane@example`, one-char or numeric TLD, over-long local part | domain lowercased, local part preserved |
| `phone` | `+`-prefixed E.164, the `00` international prefix, and national-format digits; spaces, dashes, dots and parens anywhere | letters (vanity numbers), <7 or >15 digits, country code starting `0`, stray `+` | E.164 when a country code is present, bare digits when not |

### Why not libphonenumber-js

Measured against this bundle: importing `isValidPhoneNumber` from `libphonenumber-js/min`
takes the widget from **16.5 KB to 46.8 KB gzip — a 2.8× increase**, on a script that loads
on every page view of every customer site. That is not a trade worth making for one optional
field. Chatwoot reached the same conclusion from the other direction: `libphonenumber-js` is
in their dependencies but reaches only the dashboard bundle, and their *widget* validates
with a handful of regexes in `shared/helpers/Validators.js`.

What this costs us is per-country plausibility — nothing here knows that a Moscow number is
one digit short. What it buys is catching every typo that actually makes a contact
unreachable. If per-country validation becomes a requirement, the right move is not to
inline the library but to code-split it behind the pre-chat form, so only inboxes that
collect phone numbers pay for it (roadmap item 3).

### Email: use the browser's grammar, not your own

`HTML_EMAIL` in `validate.ts` is the WHATWG spec's regex, the one browsers apply to
`<input type=email>`. The spec calls it "a willful violation of RFC 5322", deliberately:
the full grammar accepts quoted strings, comments and folding whitespace that no signup form
should take, while rejecting nothing a visitor is likely to type. Hand-rolled "stricter"
patterns are how forms end up bouncing `jane.doe+support@example.co.uk`.

The one place we are stricter than the spec is requiring a dot in the domain. `jane@localhost`
is a valid address on a LAN and always a typo in a support form on the public web.

### ⚠️ The API does not validate any of this

`CreateWidgetSessionEndpoint` takes `contact: { name, email, phone }` and only trims it.
Client-side validation is UX — it stops honest typos at the point where the visitor can fix
them. It is **not** enforcement: `POST /session` is anonymous and CORS-open, so anything can
put arbitrary strings into your contacts table. The same rules need to exist server-side,
where they are the authority, with the widget's copy treated as a convenience.

---

## Conversation lifecycle

### When the session opens

`POST /session` is what creates the conversation, so the widget never calls it just because a
page loaded. It waits for the visitor to do something:

| Visitor | When `/session` is called |
|---|---|
| First-timer, no pre-chat form | The first time they **open** the widget |
| First-timer, pre-chat form on | When they **submit** the form |
| Returning visitor who already has a thread | On load — this resumes an existing conversation rather than creating one |

Without this, everyone who merely landed on the page became a row in the agent console.

The returning-visitor exception is deliberate: defer that one too and an agent's follow-up
would never raise an unread badge, because the SSE stream would not be connected while the
panel is shut. Resuming costs nothing, since the conversation already exists.

One implementation note: the open-watcher reads a plain `gated` flag rather than the
`preChatPending` signal. `submitPreChat()` clears that signal *before* handing over the
answers, so a tracked read would re-run the effect and open the session with the pre-form
contact instead of what the visitor typed.

**Why the same thread comes back after a refresh.** On first load the widget mints a random
`sourceId` and stores it in `localStorage` under `talkyhub:session:{token}`. `POST /session`
resolves that id through `ContactResolver` → `ConversationResolutionService`, which reuses the
visitor's open conversation (a partial unique index guarantees at most one non-resolved
conversation per `ContactInbox`) and returns its last 50 messages. That history replaces the
client-side greeting.

This is intended, and it matches Chatwoot, Intercom and Jivo: a visitor who reloads
mid-question should not start over, and the agent should not get a second thread for the same
question. Clearing site data resets the visitor, because the `sourceId` goes with it.

### What happens when an agent resolves

The API decides, on a **time-based grace window** (`WebChat:ResolvedGraceWindowMinutes`,
default 30). The widget cannot override it — a stale cached bundle can't pick the other
semantic:

| Visitor sends a message… | Server behaviour | What the widget shows |
|---|---|---|
| to an open conversation | appends | nothing special |
| to a conversation resolved **within** the window | reopens it | nothing special — same thread continues |
| to a conversation resolved **before** the window | rolls over to a NEW conversation | `── Started a new conversation.` above that message |

The reasoning behind the window: a reply 30 seconds after resolution ("wait, that didn't
work") is the same issue, and a new conversation would make the agent re-read context they
just had. A reply three weeks later is a new issue, and reopening corrupts time-to-resolution,
CSAT attribution and queue ordering.

### The contract the widget implements

**`conversation.resolved` is a NAMED SSE frame.** The stream writes
`id: …\nevent: {name}\ndata: {json}`, so `EventSource.onmessage` only ever sees
`event: message`. Resolution needs `addEventListener('conversation.resolved', …)` or the
widget silently ignores an agent closing the thread. Payload is `{ conversation_id }`.

**`POST /messages` returns `{ message, conversation_id, session_token? }`.** `session_token`
is present **only** on rollover. When it is, the widget:

1. adopts the new token and `conversation_id` into its stored session;
2. raises the `Started a new conversation.` notice *before* the message that triggered it —
   the optimistic bubble is already in the list by the time the response lands, so
   `pushNotice(id, body, beforeEcho)` splices rather than appends;
3. **closes and re-opens the SSE stream.** The old `EventSource` is bound to the old
   conversation by its ticket; leaving it open means agent replies to the new conversation
   never arrive. This is the step that is easy to miss and silent when missed.

The response also carries the persisted message, which is the only place a visitor's own
message comes back — the stream deliberately omits it (§13) — so it is what reconciles the
optimistic bubble.

### System notices

`author: 'system'` is not a chat participant: it is the widget narrating a lifecycle change,
rendered as a centred ruled line, never a bubble, and it never increments the unread badge.
Wire messages with `author: "system"` map to it too; `bot` stays a normal bubble, because a
bot reply is chat. Notice ids are stable per conversation (`sys_resolved_{id}`,
`sys_new_{id}`), so a reconnect that redelivers an event can't duplicate the line.

The composer stays enabled after a resolve notice — within the grace window the API reopens
the thread, so typing again is a supported action, and greying out the box would be a lie.

### Blank threads

A cold-start after resolution is **not** blank: `/session` returns an empty message list for
the new conversation, `onHistory` is only called when non-empty, so the client greeting stays
— which is the right thing for what is genuinely a new conversation.

True cross-conversation history (showing the closed thread above the divider on a later
visit) is not possible today: `/session` returns only the current conversation's messages, and
caching transcripts in `localStorage` on the customer's domain trades a privacy and staleness
problem for a cosmetic one. It needs an API that can return the visitor's previous
conversations read-only.

## Best practices for the API side

Conventions this widget relies on. Breaking one usually shows up as a subtle production
problem rather than a test failure.

**Create the conversation lazily, on the first message.** ⚠️ *Partly open.*
`POST /session` calls `ConversationResolutionService.ResolveAsync` unconditionally, so any call
to it creates a `Conversation` row and fires `ConversationCreated`. The widget no longer calls
it on page load (see **Conversation lifecycle**), which removes the worst of it — a passer-by is
no longer a row in the console. What remains is the visitor who **opens the widget, reads the
greeting and types nothing**: that still creates a conversation, because opening the session is
what creates it.

Chatwoot avoids this entirely by making conversation creation a `before_action` on
`POST /messages` only (`Api::V1::Widget::MessagesController#set_conversation`). **The rest of the
fix belongs in the API:** have `/session` resolve the contact and return any existing open
conversation, and create one only when the first message arrives. The widget already follows a
`conversation_id` that appears later, so this needs no widget change.

**Serve config the widget can fall back from.** Every field optional-with-a-default, `null`
reserved for "off". Never send a partially-built object the widget has to repair.

**Keep `/config` cacheable and cheap.** It's on the critical path of every page view on
every customer site. One indexed lookup by token, no per-visitor state, and it should
tolerate being fronted by a CDN or `Cache-Control: public, max-age=…`.

**Snake_case on the wire, camelCase in the widget.** `JsonNamingPolicy.SnakeCaseLower` is
the contract; the mapping happens once, in `loadConfig`. Don't leak snake_case past it.

**Echo `echo_id` back, never store it.** It exists so the widget can reconcile its optimistic
bubble with the persisted message and de-duplicate the stream echo.

**Allow-list origins per inbox, and treat empty as dev-only.** `WidgetOrigin.IsAllowed`
matches on scheme+host. An empty list means any origin, which is right for local dev and
wrong for production — the dashboard should push customers to fill it in.

**Keep the session token opaque, short-lived and scoped.** 12h TTL, sealed by
`ISecretProtector`, bound to the widget token in the route so a session for one widget can't
act on another. A returning visitor just opens a new session; nothing in it is worth a long
life.

**Version the bundle path, not the config.** `/widget/v1/` is for **breaking** changes;
additive fields with defaults keep v1 working, which is why every new field above is
optional. Release-level versioning is the CDN's job, below.

**Rate-limit the anonymous endpoints per token and per source id.** They're
unauthenticated and CORS-open by design; `MaxContentLength` on messages is a floor, not a
strategy.


---

## Releases and CDN caching

Each build writes three files to `dist/widget/v1/`:

| File | Cached | Who uses it |
|---|---|---|
| `loader.js` | `max-age=300, stale-while-revalidate=86400` | Everyone. The stable embed URL, overwritten every release. |
| `loader.<hash>.js` | `max-age=31536000, immutable` | A customer pinning an exact build; us, rolling back. |
| `manifest.json` | short | Tells you which hash is live, its sha256 and build time. |

The deploy rsyncs additively, so **every past hashed build stays reachable** — a rollback is
pointing at an older hash, not a rebuild.

### The bug this replaced

`/widget/` previously served *everything* with `Cache-Control: public, max-age=31536000,
immutable`, while the deploy overwrote `loader.js` at that same path on every release.
`immutable` specifically instructs the browser not to revalidate — not on navigation, not on
an explicit reload. So a visitor who had loaded the widget once would keep that bundle for up
to a year, and no fix would ever reach them. The one escape hatch was bumping to
`/widget/v2/`, which means asking every customer to edit their HTML.

`immutable` is only ever correct for a URL whose bytes cannot change. That is what the hashed
copy is for; the stable entry point gets a short TTL and revalidates.
