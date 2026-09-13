import { useState } from 'preact/hooks'
import type { Contact, PreChatField, WidgetConfig } from '../core/types'
import { submitPreChat } from '../core/store'
import { validateEmail, validateName, validatePhone } from '../core/validate'
import type { FieldResult } from '../core/validate'

const LABELS: Record<PreChatField, string> = {
  name: 'Your name',
  email: 'Email',
  phone: 'Phone',
}

const PLACEHOLDERS: Record<PreChatField, string> = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+1 555 123 4567',
}

const INPUT_TYPE: Record<PreChatField, string> = {
  name: 'text',
  email: 'email',
  phone: 'tel',
}

const VALIDATORS: Record<PreChatField, (raw: string) => FieldResult> = {
  name: validateName,
  email: validateEmail,
  phone: validatePhone,
}

// Shown in place of the thread while appearance-configured pre-chat fields are unanswered.
// Submitting is what opens the session (POST /session with `contact`), so no conversation
// reaches the agent console until the visitor has actually identified themselves.
export function PreChat({ config }: { config: WidgetConfig }) {
  const fields = config.preChat.fields
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState(false)

  function set(field: PreChatField, value: string): void {
    setValues((v) => ({ ...v, [field]: value }))
    // Re-check on every keystroke only once the visitor has already hit submit: flagging a
    // half-typed address as invalid while it is still being typed is just nagging.
    if (touched) setErrors((e) => ({ ...e, [field]: VALIDATORS[field](value).error ?? '' }))
  }

  function submit(e: Event): void {
    e.preventDefault()
    setTouched(true)
    const next: Record<string, string> = {}
    const contact: Contact = {}
    for (const f of fields) {
      const { error, value } = VALIDATORS[f](values[f] ?? '')
      if (error) next[f] = error
      else contact[f] = value
    }
    setErrors(next)
    if (Object.keys(next).length) return
    // The normalised value goes to the API, not the raw input: a phone typed as
    // `8 (999) 123-45-67` and one typed as `89991234567` must resolve to one contact.
    submitPreChat(contact)
  }

  return (
    <form class="tk-prechat" onSubmit={submit} novalidate>
      <p class="tk-prechat-intro">
        {config.greeting ?? 'Leave your details and we’ll get right back to you.'}
      </p>
      {fields.map((f) => {
        const err = touched ? errors[f] : ''
        const id = `tk-pc-${f}`
        return (
          <label class="tk-field" key={f} for={id}>
            <span class="tk-field-label">{LABELS[f]}</span>
            <input
              id={id}
              class={`tk-field-input ${err ? 'has-error' : ''}`}
              type={INPUT_TYPE[f]}
              name={f}
              // Lets the browser offer the visitor's saved details instead of making them
              // retype what every other site already knows.
              autocomplete={f === 'name' ? 'name' : f === 'email' ? 'email' : 'tel'}
              // Our own check is the authority (the native one rejects nothing useful and
              // its bubble can't be styled), but the right keyboard on mobile is free.
              inputMode={f === 'email' ? 'email' : f === 'phone' ? 'tel' : undefined}
              placeholder={PLACEHOLDERS[f]}
              value={values[f] ?? ''}
              aria-invalid={!!err}
              aria-describedby={err ? `${id}-err` : undefined}
              onInput={(e) => set(f, (e.currentTarget as HTMLInputElement).value)}
            />
            {err && (
              <span class="tk-field-err" id={`${id}-err`}>
                {err}
              </span>
            )}
          </label>
        )
      })}
      <button class="tk-prechat-go" type="submit">
        Start chat
      </button>
    </form>
  )
}
