import { useMemo } from 'preact/hooks'
import { creditUrl } from '../core/credit'

// TalkyHub's own brand art, taken from threadhub-web-landing so the credit matches the site it
// links to: the mark is public/favicon.svg (drawn for small sizes, which is all this ever is) and
// the wordmark is Logo.tsx's "Talky" + outlined "Hub" badge. Fixed brand colours on purpose —
// this is TalkyHub's mark, not the customer's, so it never follows --accent.

let uid = 0

export function TalkyHubMark({ size = 14 }: { size?: number }) {
  // Unique per instance, or a second mark on the page would reference the first one's <defs>.
  const id = useMemo(() => `tk-th-mark${++uid}`, [])
  return (
    <svg width={size} height={size} viewBox="103.47 62.08 319.9 319.9" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="113.452" y1="79.399" x2="413.389" y2="344.703" gradientUnits="userSpaceOnUse">
          <stop stop-color="#6a4ce0" />
          <stop offset="1" stop-color="#4a2fc4" />
        </linearGradient>
      </defs>
      <path
        d="M 113.452 163.096 C 113.452 123.249 183.929 79.399 261.712 79.399 C 343.929 79.399 413.389 122.79 413.389 163.096 L 413.389 325.071 C 413.389 338.404 405.616 344.703 392.283 344.703 C 392.283 344.703 261.712 344.703 243.904 344.703 C 214.025 344.703 190.265 325.003 183.929 325.071 C 177.332 325.142 167.107 344.703 118.292 344.703 C 118.197 344.703 113.452 343.17 113.452 325.071 Z"
        fill={`url(#${id})`}
      />
      <circle cx="203.929" cy="194.493" r="20" fill="#fff" />
      <circle cx="323.929" cy="194.493" r="20" fill="#fff" />
      <path
        d="M 223.637 253.359 C 223.496 260.278 242.351 267.437 261.712 267.663 C 282.376 267.903 303.929 260.744 303.929 253.359 C 301.516 253.359 275.951 261.722 261.712 261.542 C 248.789 261.379 228.9 253.359 223.637 253.359 Z"
        fill="#fff"
      />
    </svg>
  )
}

/**
 * "Talky" + outlined "Hub" badge. `tone="brand"` uses the landing's violet; `tone="current"`
 * inherits the surrounding colour, for sitting on a customer's accent card (the label launcher)
 * where a violet badge on, say, lime would clash with both brands at once.
 */
export function Wordmark({ tone = 'brand' }: { tone?: 'brand' | 'current' }) {
  return (
    <span class={`tk-wordmark is-${tone}`}>
      Talky<span class="tk-wordmark-badge">Hub</span>
    </span>
  )
}

/**
 * "Powered by TalkyHub" at the very foot of the panel, below everything the visitor actually
 * uses, so it never competes with the conversation. Always rendered: there is no config field to
 * switch it off.
 */
export function Credit() {
  // The widget lives in a shadow root on the customer's own page, not in an iframe, so this is the
  // embedding site's host directly — no Referer needed, and none is sent.
  const href = useMemo(() => creditUrl(typeof location !== 'undefined' ? location.hostname : ''), [])
  return (
    <div class="tk-credit">
      <a
        class="tk-credit-link"
        href={href}
        target="_blank"
        // nofollow: a link injected into the footer of every site embedding a widget is the textbook
        // "link scheme" in Google's guidelines. Passing no ranking signal protects talkyhub.ru from a
        // penalty and keeps customers' pages clean. noopener/noreferrer: the new tab gets no handle
        // on the customer's page, and no URL of it.
        rel="noopener noreferrer nofollow"
        aria-label="Powered by TalkyHub (opens in a new tab)"
      >
        {/* The space is for plain-text readers (reader mode, copy, assistive tech that skips
            aria-label). Whitespace-only text isn't a flex item, so the layout doesn't move. */}
        <span>Powered by</span> <TalkyHubMark size={13} />
        <Wordmark />
      </a>
    </div>
  )
}
