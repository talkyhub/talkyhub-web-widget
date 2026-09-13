// Small stroke icons (currentColor) — crisp at any size, no font-glyph rendering surprises.

interface IconProps {
  size?: number
  class?: string
}

export function ChevronDown({ size = 18, class: cls }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" class={cls} aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  )
}

export function SendIcon({ size = 18, class: cls }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" class={cls} aria-hidden="true"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  )
}

export function ChatIcon({ size = 24, class: cls }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" class={cls} aria-hidden="true">
      <path
        d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.1 9.1 0 0 1-3.3-.7L3 21l1.9-5.1A8.2 8.2 0 0 1 4 11.5 8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z"
        fill="currentColor"
      />
    </svg>
  )
}

export function CloseIcon({ size = 22, class: cls }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" class={cls} aria-hidden="true"
      stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
