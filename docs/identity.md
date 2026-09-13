# Identifying signed-in users

For embedding the widget inside your own app — a support panel for users who are already
logged in, where asking for a name and email they've already given you is pure friction.

> **Status.** Widget side is shipped. API side is **implemented** in threadhub-api (identity secret +
> constant-time HMAC verify on `POST /session`, `identity` in the response, `IdentityRequired`, and the
> reveal/rotate admin endpoints). The [API contract](#api-contract-threadhub-api) below documents what it does.

## Two tiers, and the difference is a security boundary

| | You pass | What it does | Trusted |
|---|---|---|---|
| **Prefill** | `name`, `email`, `phone` | Skips those pre-chat fields (the whole form, if they cover it) and labels the contact. | No |
| **Identity** | `identifier` + `identifier_hash` | Same contact and same conversation on every device the user signs in from. | Once the hash verifies |

Anything in a web page can be edited from devtools, so:

- **Prefill is a label, never a key.** The API resolves a visitor by the browser's own
  `source_id` only (`ContactResolver.FindAsync`). An email you pass can't find someone else's
  contact or open their history; the worst a visitor can do is mislabel *their own* chat.
- **An identifier is only trusted with a valid hash.** If the API keyed contacts on a raw
  `identifier`, anyone could run `TalkyHub.setUser({ identifier: '42' })` in the console and
  read user 42's support thread. The hash proves your backend issued that identifier.

## Host integration

### At boot, when you render the page for a signed-in user

```html
<script>
  window.talkyhubSettings = {
    token: 'wgt_…',
    apiBase: 'https://api.talkyhub.ru',
    user: {
      identifier: 'user-42',            // your stable user id
      identifier_hash: '9f86d081…',     // computed on your server, see below
      name: 'Айгиз Искужин',
      email: 'aigiz@example.com',
      phone: '+7 999 123-45-67',
    },
  };
</script>
<script async src="https://cdn.talkyhub.ru/widget/v1/loader.js"></script>
```

Prefer this for in-app use. The identity is known before the widget chooses between the form
and a session, so a signed-in user never sees the form flash or opens an anonymous session
first. All fields are optional — pass what you have.

`user: null` is an explicit "nobody is signed in": an identified session left on this browser
is discarded. Leaving `user` out means you aren't managing identity.

### At runtime, for login and logout in a single-page app

```js
// once your auth resolves
window.TalkyHub.setUser({ identifier: me.id, identifier_hash, name: me.name, email: me.email })

// on logout — required on any device more than one person uses
window.TalkyHub.reset()
```

`window.TalkyHub` exists as soon as the loader script has run; calls made before the widget
finishes mounting are queued and replayed. For code that can run before the script has loaded
at all, use `talkyhubSettings.user`, or wait for the event:

```js
window.addEventListener('talkyhub:ready', () => window.TalkyHub.setUser(user))
```

`setUser` is safe to call repeatedly, from a React effect on every render say: the same user
with the same details is a no-op.

### Computing `identifier_hash` on your server

HMAC-SHA256 over the identifier, keyed with the inbox's **identity secret**, as lowercase hex.
Encoding mismatches are the usual integration bug, so exactly:

- **key**: the UTF-8 bytes of the secret string
- **message**: the UTF-8 bytes of the identifier, exactly as passed to the widget
- **output**: 64 lowercase hex characters

```js
// Node
import { createHmac } from 'node:crypto'
const identifier_hash = createHmac('sha256', process.env.TALKYHUB_IDENTITY_SECRET)
  .update(String(user.id))
  .digest('hex')
```

```csharp
// .NET 9+
var identifierHash = Convert.ToHexStringLower(
    HMACSHA256.HashData(Encoding.UTF8.GetBytes(identitySecret), Encoding.UTF8.GetBytes(userId)));
```

```php
// PHP
$identifierHash = hash_hmac('sha256', (string) $user->id, $identitySecret);
```

```python
# Python
identifier_hash = hmac.new(secret.encode(), str(user_id).encode(), hashlib.sha256).hexdigest()
```

**The secret never goes to the browser.** Whoever holds it can sign any identifier and read any
of your users' support threads. Keep it in a server-side environment variable, and rotate it if
it leaks.

## What the widget does

| Situation | Behaviour |
|---|---|
| Pre-chat on, host supplied every configured field | Form skipped; session opens with those details. |
| Host supplied some of the fields | Form shows **only the missing ones**; answers are merged with the prefill. |
| A supplied field fails validation | Dropped with a console warning, and the form asks for it. Prefill is not a way around validation. |
| `identifier_hash` isn't 64 hex characters, or has no `identifier` | Dropped with a warning. It could never verify, so it isn't sent to earn a guaranteed 401. |
| `setUser` after the session started | Details re-posted to `/session`. If a verified identity resolves to a different conversation (the user's thread from another device), the widget switches to it: history replaced, stream re-ticketed. |
| A **different** `identifier` than this browser's session belongs to | Treated as a user switch: visitor session wiped, panel closed, started fresh as the new user. |
| Anonymous → identified | Not a switch. The anonymous thread is **not** merged into the account; on a shared device it may be someone else's. |
| `reset()` or `setUser(null)` | New `source_id`, no token, no conversation, no stored answers; panel closed. |
| `/session` returns 401 while an identifier was sent | `console.error` saying the hash was rejected. The widget does **not** quietly fall back to anonymous, which would hide a broken integration. |

Kept in `localStorage` under `talkyhub:session:{token}`: the `identifier` (to detect a switch)
and the contact details. **`identifier_hash` is never persisted**; you re-supply it each load.

## API contract (threadhub-api)

### Inbox configuration

| Field | Notes |
|---|---|
| `IdentitySecret` | 32 random bytes, stored encrypted. Unlike the public `Token`, this **is** a secret. Generated for every WebChat inbox, existing rows included. Readable by admins through an authenticated endpoint, rotatable, and **never** serialised into `GET /config`. |
| `IdentityRequired` | `bool`, default `false`. When `true`, only verified users can open a session — for an in-app-only inbox. |

### `POST /api/v1/widget/{token}/session`

New optional request fields:

```json
{
  "source_id": "src_…",
  "contact": { "name": "…", "email": "…", "phone": "…" },
  "identifier": "user-42",
  "identifier_hash": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
}
```

| `identifier` | `identifier_hash` | `IdentityRequired` | Result |
|---|---|---|---|
| absent | — | `false` | Anonymous. Resolve by `source_id`, as today. `identity: "anonymous"` |
| absent | — | `true` | **401** |
| present | valid | either | **Verified.** Resolve by the derived source id below. `identity: "verified"` |
| present | present, invalid | either | **401.** Never downgrade to anonymous. |
| present | absent | `false` | `identifier` **ignored entirely**: not stored, not used for lookup. Resolve by `source_id`. `identity: "unverified"` |
| present | absent | `true` | **401** |

Reserve 401 on this endpoint for identity failures; the widget relies on it to report a bad
hash. Origin stays 403 and an unknown token stays 404.

Verify in constant time. Chatwoot's `valid_hmac?` compares with `==`, which leaks timing:

```csharp
static bool VerifyIdentity(string secret, string identifier, string? hashHex)
{
    if (hashHex is not { Length: 64 }) return false;
    byte[] supplied;
    try { supplied = Convert.FromHexString(hashHex); }
    catch (FormatException) { return false; }
    var expected = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(identifier));
    return CryptographicOperations.FixedTimeEquals(expected, supplied);
}
```

Cap `identifier` at 256 characters before hashing.

### Resolving a verified user

- **Source id = `uid:{identifier}`**, derived server-side; the request's `source_id` is ignored
  for resolution. Every device the user signs in from reaches the same `ContactInbox`, so
  `ConversationResolutionService` returns the same open conversation and its history. The
  `uid:` prefix can't collide with browser ids (`src_…`).
- **Issue the session token with the derived source id.** The rollover in
  `PostWidgetMessageEndpoint` (c2e4488) re-issues from `session.SourceId`, so this keeps a
  rolled-over conversation on the verified contact.
- Mark the `ContactInbox` verified, so agents can tell a verified contact from a self-described one.

### Contact attributes

`ContactResolver` only writes `name`/`email`/`phone` when it **creates** a contact. A returning
visitor's details are silently dropped, so prefill never reaches a contact first seen
anonymously. Proposed:

| Identity | Rule |
|---|---|
| Verified | **Overwrite** each supplied non-empty field. The host's record of its own user is authoritative. |
| Unverified or anonymous | **Fill empty fields only**, treating the placeholder name `Посетитель` as empty. Never overwrite: an agent's correction shouldn't be undoable from devtools. |

### Response

Add an optional `identity: "verified" | "unverified" | "anonymous"`. The widget warns when it
sent an identifier and gets back anything but `verified`. In optional mode that warning is the
only symptom of a wrong hash.

### Tests worth having

- Invalid hash, malformed hex, and a valid hash for a *different* identifier all return 401.
- **Impersonation:** with `IdentityRequired=false`, two browsers sending the same identifier
  without a hash get two **different** contacts.
- A verified identity from two different `source_id`s gets the same conversation and history.
- Verified overwrites a set name; unverified fills an empty one but leaves a set one alone.
- `GET /config` never contains the secret.
- A rollover after verification stays on the verified contact.
