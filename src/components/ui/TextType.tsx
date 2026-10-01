import { useEffect, useState } from 'react'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia(REDUCED_MOTION).matches)

  useEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION)
    const update = () => setReduced(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return reduced
}

/**
 * Types `text`, pauses, deletes it and loops. An invisible copy of the full
 * text reserves the final size, so surrounding layout never shifts.
 */
export function TextType({
  text,
  typingSpeed = 110,
  deletingSpeed = 70,
  pauseDuration = 2500,
  restDuration = 600,
  initialDelay = 300,
}: {
  text: string
  typingSpeed?: number
  deletingSpeed?: number
  pauseDuration?: number
  restDuration?: number
  initialDelay?: number
}) {
  const reduced = usePrefersReducedMotion()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (reduced) return
    const total = Array.from(text).length
    let shown = 0
    let deleting = false
    let timer: ReturnType<typeof setTimeout>

    const step = () => {
      if (!deleting) {
        shown += 1
        setCount(shown)
        if (shown >= total) {
          deleting = true
          timer = setTimeout(step, pauseDuration)
          return
        }
        timer = setTimeout(step, typingSpeed)
      } else {
        shown -= 1
        setCount(shown)
        if (shown <= 0) {
          deleting = false
          timer = setTimeout(step, restDuration)
          return
        }
        timer = setTimeout(step, deletingSpeed)
      }
    }

    setCount(0)
    timer = setTimeout(step, initialDelay)
    return () => clearTimeout(timer)
  }, [text, reduced, typingSpeed, deletingSpeed, pauseDuration, restDuration, initialDelay])

  if (reduced) return <>{text}</>

  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="grid">
        <span className="invisible [grid-area:1/1]">{text}</span>
        <span className="[grid-area:1/1]" data-text-type>
          {Array.from(text).slice(0, count).join('')}
          <span className="text-type-cursor" />
        </span>
      </span>
    </>
  )
}
