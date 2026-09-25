// Link target for the "Powered by TalkyHub" credit.

/** Public marketing origin — the same value as threadhub-web-landing's SITE_URL. */
export const SITE_URL = 'https://talkyhub.ru/'

/**
 * Where the credit points. UTM parameters are the ONLY attribution: the link is rel="noreferrer",
 * so talkyhub.ru never receives a Referer, and the widget sends no impression beacon of its own —
 * nothing is recorded unless a visitor chooses to click. utm_source is the embedding site's host,
 * which is what makes "which customers' widgets bring signups" answerable.
 */
export function creditUrl(host: string | undefined): string {
  const url = new URL(SITE_URL)
  const source = (host ?? '').trim().toLowerCase().replace(/^www\./, '')
  if (source) url.searchParams.set('utm_source', source)
  url.searchParams.set('utm_medium', 'widget')
  url.searchParams.set('utm_campaign', 'powered_by')
  return url.href
}
