import { useEffect, useState } from 'preact/hooks'

// Matches the breakpoint at which styles.css takes the panel full-screen. Kept in JS as well
// as CSS because the channel row has to move in the DOM at that size, not just restyle: a
// floating row would cover the conversation once the panel fills the viewport.
const FULLSCREEN_PANEL = '(max-width: 480px)'

export function useCompact(): boolean {
  const [compact, setCompact] = useState(
    () => typeof matchMedia === 'function' && matchMedia(FULLSCREEN_PANEL).matches,
  )
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia(FULLSCREEN_PANEL)
    const onChange = () => setCompact(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return compact
}
