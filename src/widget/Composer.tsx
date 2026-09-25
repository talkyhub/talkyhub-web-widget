import { useRef, useState } from 'preact/hooks'
import { sendMessage } from '../core/store'
import { EmojiIcon, PaperclipIcon, SendIcon } from './icons'
import { Credit } from './Credit'

// Laid out like Jivo's: a borderless field that grows with the message, a round send button on
// its right, and a row of tools underneath. Attach and emoji are rendered but disabled — the
// widget has neither file upload nor an emoji picker yet, and a button that silently does
// nothing is worse than one that says it isn't ready.
export function Composer() {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  function grow() {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    // 80px == 4 lines of 20px, matching .tk-input's max-height. The field carries no vertical
    // padding, so this always lands on a whole line and scrolls past it.
    el.style.height = Math.min(el.scrollHeight, 80) + 'px'
  }

  // Every blank pixel of the composer belongs to the message box, so clicking one should put
  // the cursor there instead of doing nothing. Clicks that land on a real control fall through.
  function focusField(e: MouseEvent) {
    const target = e.target as HTMLElement | null
    if (target?.closest('button, a, textarea')) return
    e.preventDefault() // keep the field from blurring before we refocus it
    ref.current?.focus()
  }

  function submit() {
    if (!text.trim()) return
    sendMessage(text)
    setText('')
    const el = ref.current
    if (el) el.style.height = 'auto'
  }

  return (
    <div class="tk-compose" onMouseDown={focusField}>
      <div class="tk-compose-row">
        <textarea
          ref={ref}
          class="tk-input"
          rows={1}
          placeholder="Write a message…"
          value={text}
          onInput={(e) => {
            setText((e.currentTarget as HTMLTextAreaElement).value)
            grow()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <button class="tk-send" onClick={submit} disabled={!text.trim()} aria-label="Send message">
          <SendIcon size={18} />
        </button>
      </div>
      {/* Tools and the credit share one line — each on its own row left two dead bands of
          whitespace and pushed the field up the panel for nothing. */}
      <div class="tk-compose-foot">
        <div class="tk-compose-tools">
          <button class="tk-tool" type="button" disabled title="Attachments — coming soon" aria-label="Attach a file (coming soon)">
            <PaperclipIcon size={17} />
          </button>
          <button class="tk-tool" type="button" disabled title="Emoji — coming soon" aria-label="Emoji (coming soon)">
            <EmojiIcon size={17} />
          </button>
        </div>
        <Credit />
      </div>
    </div>
  )
}
