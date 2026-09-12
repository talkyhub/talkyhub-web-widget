import { useMemo } from 'preact/hooks'

type Variant = 'brand' | 'white' | 'wink'

interface MascotProps {
  size?: number
  variant?: Variant
  class?: string
}

// Refined, symmetric Talky: domed top, soft two-scallop base, top gloss highlight.
const BODY =
  'M16 116C16 55 62 16 120 16C178 16 224 55 224 116L224 168C224 186 212 196 194 196C181 196 170 210 157 210C144 210 133 196 120 196C107 196 96 210 83 210C70 210 59 196 46 196C28 196 16 186 16 168Z'
const SMILE = 'M94 150C107 166 133 166 146 150'

let counter = 0

export function Mascot({ size = 32, variant = 'brand', class: cls }: MascotProps) {
  const uid = useMemo(() => ++counter, [])
  const grad = `tk-g${uid}`
  const gloss = `tk-gl${uid}`
  const white = variant === 'white'
  const face = white ? '#5B3FD6' : '#ffffff'

  return (
    <svg width={size} height={size} viewBox="0 0 240 232" fill="none" class={cls} aria-hidden="true">
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#7B5CF0" />
          <stop offset="1" stop-color="#4A2FC4" />
        </linearGradient>
        <radialGradient id={gloss} cx="36%" cy="24%" r="70%">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.42" />
          <stop offset="0.55" stop-color="#ffffff" stop-opacity="0" />
        </radialGradient>
      </defs>
      <path d={BODY} fill={white ? '#ffffff' : `url(#${grad})`} />
      {!white && <path d={BODY} fill={`url(#${gloss})`} />}
      <circle cx="80" cy="106" r="14" fill={face} />
      {variant === 'wink' ? (
        <path d="M147 105C153 114 167 114 173 105" stroke={face} stroke-width="10" stroke-linecap="round" />
      ) : (
        <circle cx="160" cy="106" r="14" fill={face} />
      )}
      <path d={SMILE} stroke={face} stroke-width="13" stroke-linecap="round" />
    </svg>
  )
}
