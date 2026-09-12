import { useRef, useState } from 'preact/hooks'
import { sendMessage } from '../core/store'
import { SendIcon } from './icons'

export function Composer() {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  function grow() {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 96) + 'px'
  }

  function submit() {
    if (!text.trim()) return
    sendMessage(text)
    setText('')
    const el = ref.current
    if (el) el.style.height = 'auto'
  }

  return (
    <div class="tk-compose">
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
  )
}
