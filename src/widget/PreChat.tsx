import { useState } from 'preact/hooks'
import type { Attributes, Contact, PreChatCustomField, PreChatField, WidgetConfig } from '../core/types'
import { prefill, prefillSkips, submitPreChat } from '../core/store'
import { remainingFields } from '../core/identity'
import { validateCustom, validateEmail, validateName, validatePhone } from '../core/validate'
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

// Typed into a phone box, a letter can only ever become a validation error, so it is dropped as
// it is typed instead of being accepted and then rejected. Everything a real number is written
// with — +, spaces, dashes, dots, parens — still goes through, so pasting "+7 (999) 123-45-67"
// works and normalises later.
const SANITIZE: Partial<Record<PreChatField, (raw: string) => string>> = {
  phone: (raw) => raw.replace(/[^\d+()\-.\s]/g, ''),
}

const VALIDATORS: Record<PreChatField, (raw: string) => FieldResult> = {
  name: validateName,
  email: validateEmail,
  phone: validatePhone,
}

// Custom fields render as the closest native input. Numbers stay a text box: <input type=number>
// rejects the "1 234,5" people actually type and reports it as empty, so the visitor's answer
// would vanish instead of being read.
const CUSTOM_INPUT: Record<string, { type: string; inputMode?: string }> = {
  number: { type: 'text', inputMode: 'decimal' },
  link: { type: 'url', inputMode: 'url' },
  date: { type: 'date' },
}

// Shown in place of the thread while appearance-configured pre-chat fields are unanswered.
// Submitting arms the session with the answers; the visitor's first message opens it (POST
// /session with `contact`), so no conversation reaches the agent console before then.
export function PreChat({ config }: { config: WidgetConfig }) {
  // Verified details replace their fields; unverified ones only fill them in, so the form still
  // shows every configured field. Both read signals, so a TalkyHub.setUser() landing while the
  // form is open takes effect immediately.
  const fields = prefillSkips.value
    ? remainingFields(config.preChat.fields, prefill.value)
    : config.preChat.fields
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState(false)
  // Custom-field answers, apart from the standard ones: their keys are the workspace's, and could
  // be `name` too.
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({})
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({})
  const custom = config.preChat.customFields

  // Prefill is the starting value, not the state: keeping it out of `values` means a setUser
  // arriving later still shows up, and an untouched field never goes stale.
  const valueOf = (field: PreChatField) => values[field] ?? prefill.value[field] ?? ''

  function set(field: PreChatField, raw: string): void {
    const value = SANITIZE[field]?.(raw) ?? raw
    setValues((v) => ({ ...v, [field]: value }))
    // Re-check on every keystroke only once the visitor has already hit submit: flagging a
    // half-typed address as invalid while it is still being typed is just nagging.
    if (touched) setErrors((e) => ({ ...e, [field]: VALIDATORS[field](value).error ?? '' }))
  }

  function answer(field: PreChatCustomField, raw: string | boolean): void {
    setAnswers((a) => ({ ...a, [field.key]: raw }))
    if (touched) setCustomErrors((e) => ({ ...e, [field.key]: validateCustom(field, raw).error ?? '' }))
  }

  function submit(e: Event): void {
    e.preventDefault()
    setTouched(true)
    const next: Record<string, string> = {}
    const contact: Contact = {}
    for (const f of fields) {
      const { error, value } = VALIDATORS[f](valueOf(f))
      if (error) next[f] = error
      else contact[f] = value
    }
    const nextCustom: Record<string, string> = {}
    const attributes: Attributes = {}
    for (const f of custom) {
      const { error, value } = validateCustom(f, answers[f.key] ?? (f.type === 'checkbox' ? false : ''))
      if (error) nextCustom[f.key] = error
      else if (value !== undefined) attributes[f.key] = value
    }
    setErrors(next)
    setCustomErrors(nextCustom)
    if (Object.keys(next).length || Object.keys(nextCustom).length) return
    // The normalised value goes to the API, not the raw input: a phone typed as
    // `8 (999) 123-45-67` and one typed as `89991234567` must resolve to one contact.
    // What the visitor confirmed wins over what the page claimed. For a verified user the two
    // never overlap, since those fields were dropped from the form above.
    submitPreChat({ ...prefill.value, ...contact }, Object.keys(attributes).length ? attributes : undefined)
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
              value={valueOf(f)}
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
      {custom.map((f, i) => (
        <CustomInput
          key={f.key}
          field={f}
          id={`tk-pc-x${i}`}
          value={answers[f.key]}
          error={touched ? customErrors[f.key] : ''}
          onAnswer={(raw) => answer(f, raw)}
        />
      ))}
      <button class="tk-prechat-go" type="submit">
        Start chat
      </button>
    </form>
  )
}

// One of the workspace's own fields. Ids are positional: a key is the workspace's to choose and
// need not be a valid id.
function CustomInput({
  field,
  id,
  value,
  error,
  onAnswer,
}: {
  field: PreChatCustomField
  id: string
  value: string | boolean | undefined
  error: string
  onAnswer: (raw: string | boolean) => void
}) {
  const describedBy = [field.description && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ') || undefined
  const hint = field.description && (
    <span class="tk-field-hint" id={`${id}-hint`}>
      {field.description}
    </span>
  )
  const err = error && (
    <span class="tk-field-err" id={`${id}-err`}>
      {error}
    </span>
  )

  if (field.type === 'checkbox') {
    return (
      <div class="tk-field">
        <label class="tk-check" for={id}>
          <input
            id={id}
            type="checkbox"
            checked={value === true}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            onChange={(e) => onAnswer((e.currentTarget as HTMLInputElement).checked)}
          />
          <span>{field.label}</span>
        </label>
        {hint}
        {err}
      </div>
    )
  }

  const text = typeof value === 'string' ? value : ''
  const common = {
    id,
    class: `tk-field-input ${error ? 'has-error' : ''}`,
    'aria-invalid': !!error,
    'aria-describedby': describedBy,
  }
  return (
    <label class="tk-field" for={id}>
      <span class="tk-field-label">
        {field.label}
        {!field.required && <span class="tk-field-optional"> · optional</span>}
      </span>
      {field.type === 'list' ? (
        <select {...common} value={text} onChange={(e) => onAnswer((e.currentTarget as HTMLSelectElement).value)}>
          <option value="">Choose…</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...common}
          type={CUSTOM_INPUT[field.type]?.type ?? 'text'}
          inputMode={CUSTOM_INPUT[field.type]?.inputMode as 'decimal' | 'url' | undefined}
          value={text}
          onInput={(e) => onAnswer((e.currentTarget as HTMLInputElement).value)}
        />
      )}
      {hint}
      {err}
    </label>
  )
}
