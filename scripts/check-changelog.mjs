// Validates docs/changelog/{ru,en}.md before they're published to talkyhub-docs (see docs/changelog/README.md).
// Fails the build when the front matter is incomplete, the two locales disagree, or the newest release isn't
// the package.json version. Same rules as talkyhub-web-app's checker, so every product's page reads alike.
// Node built-ins only.
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const errors = []

function parse(locale) {
  const text = readFileSync(new URL(`../docs/changelog/${locale}.md`, import.meta.url), 'utf8')
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text)
  if (!fm) errors.push(`${locale}.md: missing front matter`)
  for (const key of ['title', 'sidebar_label', 'sidebar_position']) {
    if (!fm || !new RegExp(`^${key}:\\s*\\S`, 'm').test(fm[1])) errors.push(`${locale}.md: front matter lacks "${key}"`)
  }
  const date = locale === 'ru' ? '\\d{2}\\.\\d{2}\\.\\d{4}' : '\\d{4}-\\d{2}-\\d{2}'
  const releases = []
  for (const line of text.split('\n')) {
    if (!line.startsWith('## ')) continue
    const m = new RegExp(`^## (\\d+\\.\\d+\\.\\d+) — (${date})$`).exec(line)
    if (!m) errors.push(`${locale}.md: bad release heading "${line}" (want "## 1.2.3 — ${locale === 'ru' ? 'DD.MM.YYYY' : 'YYYY-MM-DD'}")`)
    else releases.push(m[1])
  }
  if (releases.length === 0) errors.push(`${locale}.md: no releases`)
  return releases
}

const ru = parse('ru')
const en = parse('en')
if (ru.join() !== en.join()) errors.push(`ru.md and en.md list different releases: [${ru}] vs [${en}]`)
if (ru[0] !== pkg.version) errors.push(`newest release ${ru[0]} ≠ package.json version ${pkg.version}`)

if (errors.length) {
  console.error('Changelog check failed:\n  - ' + errors.join('\n  - '))
  process.exit(1)
}
console.log(`Changelog OK — ${ru.length} release(s), newest ${ru[0]}`)
