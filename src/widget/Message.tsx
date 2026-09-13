import type { Message as Msg } from '../core/types'

function fmtTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

interface Props {
  m: Msg
  firstOfGroup: boolean
  lastOfGroup: boolean
}

// Body is rendered as text (Preact escapes it) — no innerHTML, so no XSS surface.
export function Message({ m, firstOfGroup, lastOfGroup }: Props) {
  // A lifecycle notice is not a participant's turn: centred, ruled, no bubble or timestamp,
  // so it reads as the thread changing state rather than as someone saying something.
  if (m.author === 'system') {
    return (
      <div class="tk-note" role="status">
        <span>{m.body}</span>
      </div>
    )
  }

  const out = m.author === 'visitor'
  return (
    <div class={`tk-row ${out ? 'out' : 'in'} ${firstOfGroup ? 'first' : ''} ${lastOfGroup ? 'last' : ''}`}>
      <div class={`tk-bub ${out ? 'out' : 'in'}`}>{m.body}</div>
      {lastOfGroup && <div class="tk-time">{fmtTime(m.at)}</div>}
    </div>
  )
}
