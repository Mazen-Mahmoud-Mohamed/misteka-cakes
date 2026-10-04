import { useEffect, useRef } from 'react'

/**
 * Subtle pixel-dust ambient layer inspired by React Bits Pixel Snow.
 * Canvas 2D only — no Three.js — so it stays light next to DriftWall.
 *
 * Brand palette (site tokens):
 * - rose #8c4e58, rose-deep #6d3b44
 * - cream #f4ece4
 * - muted gold #b58b4a
 */

type Particle = {
  x: number
  y: number
  size: number
  speedY: number
  drift: number
  phase: number
  color: string
}

/** Weighted toward dusty rose / muted gold — readable on ivory at a glance. */
const COLORS = [
  'rgba(140, 78, 88, 0.50)', // rose
  'rgba(140, 78, 88, 0.42)',
  'rgba(109, 59, 68, 0.40)', // rose-deep
  'rgba(181, 139, 74, 0.44)', // muted gold
  'rgba(181, 139, 74, 0.34)',
  'rgba(232, 214, 196, 0.16)', // warm cream — sparse highlight only
] as const

/** Occasional brighter flakes for shallow depth (~16% of field). */
const ACCENT_COLORS = [
  'rgba(140, 78, 88, 0.60)',
  'rgba(181, 139, 74, 0.52)',
] as const

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** ~1.5× prior densities; still leaves empty negative space. */
function densityForWidth(width: number) {
  if (width < 390) return 18
  if (width < 768) return 28
  if (width < 1024) return 45
  if (width < 1440) return 70
  return 84
}

function createParticle(width: number, height: number, randomY: boolean): Particle {
  const accent = Math.random() < 0.16
  return {
    x: Math.random() * width,
    y: randomY ? Math.random() * height : -4,
    // Normal 2–4px; accents 4–5px
    size: accent ? 4 + Math.random() : 2 + Math.random() * 2,
    speedY: 0.07 + Math.random() * 0.16,
    drift: (Math.random() - 0.5) * 0.1,
    phase: Math.random() * Math.PI * 2,
    color: accent
      ? ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)]!
      : COLORS[Math.floor(Math.random() * COLORS.length)]!,
  }
}

function drawFrame(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  for (const p of particles) {
    ctx.fillStyle = p.color
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size)
  }
}

export function PixelSnowBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let particles: Particle[] = []
    let raf = 0
    let visible = true
    let reduced = prefersReducedMotion()
    let width = 0
    let height = 0

    function resize() {
      const nextW = window.innerWidth
      const nextH = window.innerHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      width = nextW
      height = nextH
      canvas!.width = Math.floor(nextW * dpr)
      canvas!.height = Math.floor(nextH * dpr)
      canvas!.style.width = `${nextW}px`
      canvas!.style.height = `${nextH}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

      const count = densityForWidth(nextW)
      particles = Array.from({ length: count }, () => createParticle(nextW, nextH, true))
      drawFrame(ctx!, particles)
    }

    function tick() {
      if (!visible || reduced) return
      for (const p of particles) {
        p.phase += 0.008
        p.y += p.speedY
        p.x += p.drift + Math.sin(p.phase) * 0.08
        if (p.y > height + 6) {
          p.y = -4
          p.x = Math.random() * width
        } else if (p.x < -6) {
          p.x = width + 4
        } else if (p.x > width + 6) {
          p.x = -4
        }
      }
      drawFrame(ctx!, particles)
      raf = requestAnimationFrame(tick)
    }

    function start() {
      cancelAnimationFrame(raf)
      if (!visible || document.hidden || reduced) {
        drawFrame(ctx!, particles)
        return
      }
      raf = requestAnimationFrame(tick)
    }

    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(raf)
      else start()
    }

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onMotion = () => {
      reduced = motionQuery.matches
      start()
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? true
        start()
      },
      { threshold: 0 },
    )
    io.observe(canvas)

    let resizeTimer = 0
    const onResize = () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        resize()
        start()
      }, 120)
    }

    resize()
    start()
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVisibility)
    motionQuery.addEventListener('change', onMotion)

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      motionQuery.removeEventListener('change', onMotion)
      io.disconnect()
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      data-pixel-snow="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <canvas ref={canvasRef} className="block size-full" />
    </div>
  )
}
