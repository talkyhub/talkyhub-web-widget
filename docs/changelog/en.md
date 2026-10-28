---
title: What's new in the website widget
sidebar_label: Website widget
sidebar_position: 3
---

# What's new in the website widget

Changes to the website chat widget (cdn.talkyhub.ru/widget/v1/loader.js), newest first. The embed snippet
never changes: updates reach every site on their own, within five minutes of a release.

## 1.5.0 — 2026-10-28

### Added

- **Your own fields on the pre-chat form** — after name, email and phone, the form asks the contact
  fields you chose for the channel: text, a number, a link, a date, a checkbox or a choice from a list.
  Required fields can't be skipped, and answers are checked before they're sent. They're saved to the
  contact's card and arrive with the visitor's first message.

## 1.4.0 — 2026-10-25

### Added

- **Preview in the channel settings** — it's now the real widget on a test chat: it updates as you edit
  colours, texts and the pre-chat form, and stores nothing in the browser.
- **Hide the chat button** — `hideLauncher: 'mobile'` hides it on phones only, `true` everywhere. The chat
  opens from your own button.
- **Open the chat from your own button** — the `data-talkyhub-open` attribute on any button or link, a link to
  `#talkyhub-open` (works from an email or a QR code too), or `TalkyHub.open()`, `close()`, `toggle()`.
- **Events for your own button** — `talkyhub:unread` with the unread count, `talkyhub:open` and
  `talkyhub:close`, so your button can show a badge when the default one is hidden.
- **Full-page chat** — `container: '#support-chat'` puts the conversation inside an element of your page, such
  as a "Support" page or an app. It's the same visitor and the same conversation as the regular widget.

## 1.3.1 — 2026-10-19

### Fixed

- Reloading the page after a conversation was closed no longer creates an empty conversation: a new one
  appears only when the visitor sends their first message.
- When the connection drops, the widget reconnects on its own and shows replies that arrived meanwhile.
  Previously, after 15 minutes on a page, replies stopped arriving until a reload.

## 1.3.0 — 2026-09-27

### Changed

- Unsigned user details (`setUser` without `identifier_hash`) now fill in the pre-chat form instead of
  replacing it: the visitor sees what will be sent on their behalf and can correct it.

## 1.2.0 — 2026-09-27

### Added

- **Channel labels** — the Telegram, WhatsApp, VK and other buttons now have tooltips, and the card launcher
  has a menu with every way to reach you.

## 1.1.1 — 2026-09-27

### Fixed

- A conversation an agent closed no longer counts as active: on the next visit the visitor sees the pre-chat
  form again, and no empty conversation is created.

## 1.1.0 — 2026-09-27

The first versioned release of the widget.

### Added

- **Signed-in users** — `TalkyHub.setUser()` passes name, email and phone, and with an `identifier_hash`
  signature the conversation follows the user to any device. `TalkyHub.reset()` on logout.
- **Modal mode** — the chat centred over a dimmed page.
- **Messenger links** — Telegram, WhatsApp, VK, MAX, Instagram, email and phone next to the chat.
- The build number in `TalkyHub.version`.

### Changed

- A conversation is created only with the visitor's first message: opening the widget or filling in the
  pre-chat form doesn't start one.
- The pre-chat form is asked once per conversation, not once per browser.
