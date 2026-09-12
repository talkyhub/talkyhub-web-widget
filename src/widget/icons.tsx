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
