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
  // Geometry is symmetric about the viewBox centre — x 6..18, y 5..19 — so it lands dead centre
  // in the round button with no nudging.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" class={cls} aria-hidden="true"
      stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 19V5.6" />
      <path d="M6.2 11.4L12 5.6l5.8 5.8" />
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

export function PaperclipIcon({ size = 17, class: cls }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" class={cls} aria-hidden="true"
      stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20.4 11.2l-8.2 8.2a5 5 0 01-7.1-7.1l8.6-8.6a3.3 3.3 0 014.7 4.7l-8.5 8.5a1.7 1.7 0 01-2.4-2.4l7.8-7.8" />
    </svg>
  )
}

export function EmojiIcon({ size = 17, class: cls }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" class={cls} aria-hidden="true"
      stroke="currentColor" stroke-width="1.9" stroke-linecap="round">
      <circle cx="12" cy="12" r="9.2" />
      <path d="M8.4 14.2a4.6 4.6 0 007.2 0" />
      <path d="M9 9.4h.01M15 9.4h.01" stroke-width="2.4" />
    </svg>
  )
}
