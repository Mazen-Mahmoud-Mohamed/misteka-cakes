import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { ButtonLink } from '@/components/ui/Button'
import { getCategoryLabel } from '@/services/catalogService'
import type { Cake } from '@/types'
import { cx } from '@/utils/cx'

/*
 * Adapted from React Bits «CircularCarousel»: cards sit on a 3D ring that
 * rotates, billboarded (as in its «orbit» preset) so photos always face the
 * viewer undistorted. Kept: spring snap, velocity-projected drag,
 * focus-on-click, depth fade, keyboard + trackpad. Dropped: autoplay,
 * parallax, stretch, intro, back faces and bent tiles.
 * Fewer than 6 cakes use an open arc (no wrap) so the ring never looks sparse.
 */

const STEP = 60
const GAP = 22
const PERSPECTIVE = 1800
const SPRING = 118
const DRAG_THRESHOLD = 6
const DEPTH_FADE = 0.65
const TO_RAD = Math.PI / 180

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const wrap = (degrees: number) => ((((degrees + 180) % 360) + 360) % 360) - 180

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}

export function CakeCarousel({ cakes }: { cakes: Cake[] }) {
  const count = cakes.length
  const ring = count * STEP >= 360
  const step = ring ? 360 / count : STEP
  const reduced = useReducedMotion()

  const rootRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Array<HTMLLIElement | null>>([])
  const [cardWidth, setCardWidth] = useState(260)
  const [spread, setSpread] = useState(1.3)
  const [active, setActive] = useState(0)
  const [dragging, setDragging] = useState(false)

  const radius = (spread * (cardWidth + GAP)) / (2 * Math.sin(Math.PI / Math.max(360 / step, 3)))
  const cardHeight = Math.round(cardWidth * 1.25)

  const state = useRef({
    angle: 0,
    velocity: 0,
    target: null as number | null,
    raf: 0,
    last: 0,
    activeIndex: 0,
    suppressClick: false,
    wheelTimer: 0 as ReturnType<typeof setTimeout> | 0,
    press: null as null | { id: number; x: number; y: number; angle: number; moved: boolean; samples: Array<{ t: number; a: number }> },
  })
  const settings = useRef({ count, ring, step, radius, reduced })
  settings.current = { count, ring, step, radius, reduced }

  const bounds = useCallback(() => {
    const s = settings.current
    return s.ring ? null : ([0, (s.count - 1) * s.step] as const)
  }, [])

  const render = useCallback(() => {
    const s = settings.current
    const st = state.current
    if (ringRef.current) ringRef.current.style.transform = `translateZ(${-s.radius}px) rotateY(${st.angle}deg)`
    for (let i = 0; i < s.count; i++) {
      const card = cardRefs.current[i]
      if (!card) continue
      const world = s.ring ? wrap(st.angle - i * s.step) : st.angle - i * s.step
      card.style.transform = `rotateY(${-i * s.step}deg) translateZ(${s.radius}px) rotateY(${-(st.angle - i * s.step)}deg)`
      card.style.visibility = Math.abs(world) > 100 ? 'hidden' : ''
      const facing = Math.cos(clamp(world, -180, 180) * TO_RAD)
      card.style.setProperty('--cake-depth', (DEPTH_FADE * Math.pow((1 - facing) / 2, 0.9)).toFixed(3))
    }
    const raw = Math.round(st.angle / s.step)
    const index = s.ring ? ((raw % s.count) + s.count) % s.count : clamp(raw, 0, s.count - 1)
    if (index !== st.activeIndex) {
      st.activeIndex = index
      setActive(index)
    }
  }, [])

  const frame = useCallback(
    (now: number) => {
      const st = state.current
      st.raf = 0
      const dt = st.last ? Math.min((now - st.last) / 1000, 0.05) : 1 / 60
      st.last = now
      let busy = false
      if (st.target !== null && !st.press?.moved) {
        let remaining = dt
        const damping = 2 * Math.sqrt(SPRING)
        while (remaining > 0) {
          const h = Math.min(remaining, 1 / 240)
          st.velocity += (SPRING * (st.target - st.angle) - damping * st.velocity) * h
          st.angle += st.velocity * h
          remaining -= h
        }
        if (Math.abs(st.target - st.angle) < 0.01 && Math.abs(st.velocity) < 0.05) {
          st.angle = st.target
          st.velocity = 0
          st.target = null
        } else busy = true
      }
      render()
      if (busy) st.raf = requestAnimationFrame(frame)
      else st.last = 0
    },
    [render],
  )

  const settleTo = useCallback(
    (target: number) => {
      const st = state.current
      const range = bounds()
      st.target = range ? clamp(target, range[0], range[1]) : target
      if (settings.current.reduced) {
        st.angle = st.target
        st.velocity = 0
        st.target = null
        render()
        return
      }
      if (!st.raf) st.raf = requestAnimationFrame(frame)
    },
    [bounds, frame, render],
  )

  const focusIndex = useCallback(
    (index: number) => {
      const s = settings.current
      const st = state.current
      let target = index * s.step
      if (s.ring) target += 360 * Math.round((st.angle - target) / 360)
      settleTo(target)
    },
    [settleTo],
  )

  const stepBy = useCallback(
    (delta: number) => {
      const s = settings.current
      const st = state.current
      const base = st.target ?? Math.round(st.angle / s.step) * s.step
      settleTo(base + delta * s.step)
    },
    [settleTo],
  )

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const measure = () => {
      setCardWidth(Math.round(clamp(root.clientWidth * 0.6, 200, 300)))
      setSpread(root.clientWidth < 640 ? 1 : 1.3)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return
      event.preventDefault()
      const s = settings.current
      const st = state.current
      st.target = null
      st.angle -= event.deltaX * (180 / (Math.PI * s.radius))
      const range = s.ring ? null : [0, (s.count - 1) * s.step]
      if (range) st.angle = clamp(st.angle, range[0] - s.step * 0.3, range[1] + s.step * 0.3)
      render()
      clearTimeout(st.wheelTimer)
      st.wheelTimer = setTimeout(() => settleTo(Math.round(st.angle / s.step) * s.step), 140)
    }
    root.addEventListener('wheel', onWheel, { passive: false })
    const st = state.current
    return () => {
      observer.disconnect()
      root.removeEventListener('wheel', onWheel)
      clearTimeout(st.wheelTimer)
      cancelAnimationFrame(st.raf)
      st.raf = 0
    }
  }, [render, settleTo])

  useLayoutEffect(() => {
    render()
  }, [render, radius, count])

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    const st = state.current
    st.suppressClick = false
    if (event.pointerType === 'mouse' && event.button !== 0) return
    st.press = { id: event.pointerId, x: event.clientX, y: event.clientY, angle: st.angle, moved: false, samples: [{ t: performance.now(), a: st.angle }] }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const st = state.current
    const press = st.press
    if (!press || press.id !== event.pointerId) return
    const dx = event.clientX - press.x
    const dy = event.clientY - press.y
    if (!press.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD) {
        if (event.pointerType !== 'mouse' && Math.abs(dy) > DRAG_THRESHOLD) st.press = null
        return
      }
      if (event.pointerType !== 'mouse' && Math.abs(dy) > Math.abs(dx) * 1.2) {
        st.press = null
        return
      }
      press.moved = true
      st.target = null
      st.velocity = 0
      setDragging(true)
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        /* pointer already released */
      }
    }
    const s = settings.current
    let angle = press.angle + dx * (180 / (Math.PI * s.radius))
    if (!s.ring) angle = clamp(angle, -s.step * 0.3, (s.count - 1) * s.step + s.step * 0.3)
    st.angle = angle
    const now = performance.now()
    press.samples.push({ t: now, a: angle })
    while (press.samples.length > 2 && now - press.samples[0].t > 110) press.samples.shift()
    render()
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const st = state.current
    const press = st.press
    if (!press || press.id !== event.pointerId) return
    st.press = null
    if (!press.moved) return
    setDragging(false)
    st.suppressClick = true
    const s = settings.current
    const first = press.samples[0]
    const last = press.samples[press.samples.length - 1]
    const span = (last.t - first.t) / 1000
    const velocity = span > 0.008 ? clamp((last.a - first.a) / span, -900, 900) : 0
    const projected = Math.round((st.angle + velocity * 0.2) / s.step)
    const origin = Math.round(press.angle / s.step)
    settleTo(clamp(projected, origin - 2, origin + 2) * s.step)
  }

  function onClickCapture(index: number) {
    const st = state.current
    if (st.suppressClick) {
      st.suppressClick = false
      return
    }
    if (index !== st.activeIndex) focusIndex(index)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft') stepBy(1)
    else if (event.key === 'ArrowRight') stepBy(-1)
    else if (event.key === 'Home') focusIndex(0)
    else if (event.key === 'End') focusIndex(count - 1)
    else return
    event.preventDefault()
  }

  const cake = cakes[active] ?? cakes[0]
  if (!cake) return null
  const atStart = !ring && active === 0
  const atEnd = !ring && active === count - 1

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 sm:gap-7">
      <div
        ref={rootRef}
        role="region"
        aria-roledescription="معرض"
        aria-label="معرض التورت، استخدمي الأسهم للتنقل بين التصميمات"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cx(
          'relative -mx-4 overflow-hidden rounded-3xl outline-none [contain:paint] select-none [-webkit-tap-highlight-color:transparent] [touch-action:pan-y] focus-visible:ring-2 focus-visible:ring-rose/40 focus-visible:ring-offset-4 focus-visible:ring-offset-ivory sm:mx-0',
          '[mask-image:linear-gradient(to_right,transparent,#000_9%,#000_91%,transparent)] sm:[mask-image:none]',
          dragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
        style={{ height: cardHeight + 56, perspective: PERSPECTIVE }}
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center [transform-style:preserve-3d]">
          <div ref={ringRef} className="pointer-events-none relative h-0 w-0 [transform-style:preserve-3d]">
            <ul className="contents">
              {cakes.map((item, index) => {
                const isActive = index === active
                return (
                  <li
                    key={item.id}
                    ref={(el) => {
                      cardRefs.current[index] = el
                    }}
                    data-cake-slide={item.id}
                    data-active={isActive || undefined}
                    className="pointer-events-auto absolute"
                    style={{ width: cardWidth, height: cardHeight, left: -cardWidth / 2, top: -cardHeight / 2 }}
                  >
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-hidden={!isActive}
                      aria-label={isActive ? `${item.name}، التصميم المعروض` : `عرض ${item.name}`}
                      onClick={() => onClickCapture(index)}
                      className={cx(
                        'relative block h-full w-full overflow-hidden rounded-3xl bg-cream shadow-soft',
                        isActive ? 'cursor-default ring-1 ring-gold/70 ring-offset-[5px] ring-offset-ivory' : 'cursor-pointer',
                      )}
                    >
                      <img
                        src={item.image}
                        alt={isActive ? item.imageAlt : ''}
                        draggable={false}
                        decoding="async"
                        style={{ objectPosition: item.imagePosition }}
                        className="pointer-events-none h-full w-full object-cover select-none"
                      />
                      <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-ivory opacity-[var(--cake-depth,0)]" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => stepBy(-1)}
          disabled={atStart}
          aria-label="التصميم السابق"
          className="inline-flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-paper text-rose-deep transition duration-200 hover:border-gold disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>

        <div role="group" aria-label="اختيار التصميم" className="flex items-center">
          {cakes.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => focusIndex(index)}
              aria-label={item.name}
              aria-current={index === active ? 'true' : undefined}
              className="group inline-flex h-10 w-8 cursor-pointer items-center justify-center rounded-full sm:w-10"
            >
              <span
                aria-hidden="true"
                className={cx(
                  'block h-2 rounded-full transition-all duration-300 motion-reduce:transition-none',
                  index === active ? 'w-6 bg-rose-deep' : 'w-2 bg-line group-hover:bg-gold',
                )}
              />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => stepBy(1)}
          disabled={atEnd}
          aria-label="التصميم التالي"
          className="inline-flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-paper text-rose-deep transition duration-200 hover:border-gold disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 6-6 6 6 6" />
          </svg>
        </button>
      </div>

      <div className="mx-auto w-full max-w-md text-center">
        <p className="text-xs font-semibold text-rose">
          {getCategoryLabel(cake.category)}
          <span className="text-muted"> · </span>
          <span className="text-muted tabular-nums">
            {active + 1} من {count}
          </span>
        </p>
        <h3 className="mt-1.5 font-display text-3xl leading-snug text-rose-deep sm:text-4xl">{cake.name}</h3>
        <div className="mt-6 flex justify-center">
          <ButtonLink to="/catalog" variant="secondary">
            شاهدي كل التصاميم
          </ButtonLink>
        </div>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {`${cake.name}، ${active + 1} من ${count}`}
      </p>
    </div>
  )
}
