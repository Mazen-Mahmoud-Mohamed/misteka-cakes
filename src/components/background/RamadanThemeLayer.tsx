import { useEffect, useState, type CSSProperties } from 'react'
import { useTheme } from '@/providers/ThemeProvider'
import type { RamadanIntensity } from '@/types/theme'
import { cx } from '@/utils/cx'

type Band = 'mobile' | 'tablet' | 'desktop'
type LanternSize = 'xs' | 'sm' | 'md' | 'lg'

const INTENSITY: Record<
  RamadanIntensity,
  {
    opacity: number
    glow: number
    goldBoost: number
    maxLanterns: Record<Band, number>
    showExtraOrnaments: boolean
  }
> = {
  low: {
    opacity: 0.58,
    glow: 0.12,
    goldBoost: 0.85,
    maxLanterns: { mobile: 3, tablet: 4, desktop: 5 },
    showExtraOrnaments: false,
  },
  medium: {
    opacity: 0.92,
    glow: 0.3,
    goldBoost: 1,
    maxLanterns: { mobile: 4, tablet: 6, desktop: 8 },
    showExtraOrnaments: true,
  },
  high: {
    opacity: 0.98,
    glow: 0.38,
    goldBoost: 1.1,
    maxLanterns: { mobile: 5, tablet: 7, desktop: 9 },
    showExtraOrnaments: true,
  },
}

function normalizeIntensity(value: RamadanIntensity | undefined): RamadanIntensity {
  if (value === 'low' || value === 'medium' || value === 'high') return value
  return 'medium'
}

function useBand(): Band {
  const [band, setBand] = useState<Band>(() => {
    if (typeof window === 'undefined') return 'desktop'
    if (window.innerWidth < 640) return 'mobile'
    if (window.innerWidth < 1024) return 'tablet'
    return 'desktop'
  })

  useEffect(() => {
    const mqMobile = window.matchMedia('(max-width: 639px)')
    const mqTablet = window.matchMedia('(max-width: 1023px)')
    function update() {
      if (mqMobile.matches) setBand('mobile')
      else if (mqTablet.matches) setBand('tablet')
      else setBand('desktop')
    }
    update()
    mqMobile.addEventListener('change', update)
    mqTablet.addEventListener('change', update)
    window.addEventListener('resize', update, { passive: true })
    return () => {
      mqMobile.removeEventListener('change', update)
      mqTablet.removeEventListener('change', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return band
}

function CrescentMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      <path
        d="M40.5 10.5c-11.8 1.8-20.8 12-20.8 24.3 0 13.5 11 24.5 24.5 24.5 4.8 0 9.3-1.4 13.1-3.8C51.5 61.2 43.2 64 34 64 17.4 64 4 50.6 4 34S17.4 4 34 4c2.2 0 4.4.2 6.5.6z"
        fill="currentColor"
        opacity="0.95"
      />
    </svg>
  )
}

function FourPointStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M12 1.8 13.4 9.1 20.5 12 13.4 14.9 12 22.2 10.6 14.9 3.5 12l7.1-2.9L12 1.8Z"
        fill="currentColor"
      />
    </svg>
  )
}

function EightPointStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <path
        d="M16 2.5 18.2 11.2 27 13.5 18.2 15.8 16 24.5 13.8 15.8 5 13.5l8.8-2.3L16 2.5Z"
        fill="currentColor"
        opacity="0.85"
      />
      <path
        d="M16 6.2 17.4 12.1 23.2 13.5 17.4 14.9 16 20.8 14.6 14.9 8.8 13.5l5.8-1.4L16 6.2Z"
        fill="#f4ece4"
        opacity="0.35"
      />
    </svg>
  )
}

function DiamondMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 20" className={className} fill="none" aria-hidden="true">
      <path d="M8 1.5 14 10 8 18.5 2 10 8 1.5Z" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.22" />
    </svg>
  )
}

function GeometricRosette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="1.1" opacity="0.55" />
      <path
        d="M20 6.5 23.2 16.8 33.5 20 23.2 23.2 20 33.5 16.8 23.2 6.5 20l10.3-3.2L20 6.5Z"
        stroke="currentColor"
        strokeWidth="1"
        fill="currentColor"
        fillOpacity="0.18"
      />
      <circle cx="20" cy="20" r="3.2" fill="currentColor" opacity="0.45" />
    </svg>
  )
}

const SIZE_CLASS: Record<LanternSize, string> = {
  xs: 'w-[1.7rem] sm:w-[1.9rem]',
  sm: 'w-[2.25rem] sm:w-[2.55rem]',
  md: 'w-[3.1rem] sm:w-[3.55rem]',
  lg: 'w-[4rem] sm:w-[4.75rem]',
}

function Lantern({
  className,
  size = 'md',
  delay = '0s',
  stringPx = 56,
  rotate = 0,
  opacity = 1,
  variant = 'classic',
}: {
  className?: string
  size?: LanternSize
  delay?: string
  stringPx?: number
  rotate?: number
  opacity?: number
  variant?: 'classic' | 'slim' | 'wide'
}) {
  return (
    <div
      className={cx('absolute origin-top', SIZE_CLASS[size], className)}
      style={{
        opacity,
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
      }}
    >
      <div className="ramadan-sway origin-top" style={{ animationDelay: delay }}>
      <div
        className="mx-auto w-px bg-gradient-to-b from-[#b58b4a]/20 via-[#b58b4a]/90 to-[#6d3b44]"
        style={{ height: stringPx }}
      />
      <svg
        viewBox={variant === 'slim' ? '0 0 40 78' : '0 0 48 72'}
        className="block w-full drop-shadow-[0_4px_10px_rgba(109,59,68,0.2)]"
        fill="none"
        aria-hidden="true"
      >
        {variant === 'slim' ? (
          <>
            <path d="M15 12h10l2.5 4.5H12.5L15 12Z" fill="#b58b4a" opacity="0.95" />
            <ellipse cx="20" cy="12" rx="4" ry="1.8" fill="#6d3b44" opacity="0.75" />
            <path
              d="M12 17.5c0-1.2 1-2 2.4-2h11.2c1.4 0 2.4.8 2.4 2v28c0 7.2-3.6 12.5-8 14.2V66c0 1-.8 1.8-1.8 1.8h-1.6c-1 0-1.8-.8-1.8-1.8V59.7C13.8 58 10 52.8 10 45.5v-28Z"
              fill="#6d3b44"
              opacity="0.9"
            />
            <path
              d="M14.2 20h11.6v24.5c0 5.2-2.5 9-5.8 10.4-3.3-1.4-5.8-5.2-5.8-10.4V20Z"
              fill="#b58b4a"
              opacity="0.38"
            />
            <rect x="16.2" y="26" width="3.4" height="8" rx="0.7" fill="#fbf7f2" opacity="0.7" className="ramadan-glow" />
            <rect x="20.6" y="26" width="3.4" height="8" rx="0.7" fill="#f4ece4" opacity="0.58" className="ramadan-glow" />
            <rect x="16.2" y="36.5" width="3.4" height="6" rx="0.7" fill="#e7d3b0" opacity="0.5" className="ramadan-glow" />
            <rect x="20.6" y="36.5" width="3.4" height="6" rx="0.7" fill="#e7d3b0" opacity="0.45" className="ramadan-glow" />
            <path
              d="M12 17.5c0-1.2 1-2 2.4-2h11.2c1.4 0 2.4.8 2.4 2v28c0 7.2-3.6 12.5-8 14.2V66c0 1-.8 1.8-1.8 1.8h-1.6c-1 0-1.8-.8-1.8-1.8V59.7C13.8 58 10 52.8 10 45.5v-28Z"
              stroke="#b58b4a"
              strokeWidth="1.15"
              opacity="0.95"
            />
            <circle cx="20" cy="70.5" r="1.9" fill="#b58b4a" />
          </>
        ) : (
          <>
            <path d="M18 10h12l3 5H15l3-5Z" fill="#b58b4a" opacity="0.96" />
            <ellipse cx="24" cy="10" rx="5" ry="2.2" fill="#6d3b44" opacity="0.72" />
            <path
              d="M14 16c0-1.5 1.2-2.5 3-2.5h14c1.8 0 3 1 3 2.5v6c2.5 2 4 5.2 4 9 0 7.5-5.4 14-12 16.2V56c0 1.2-.9 2.2-2 2.2h-2c-1.1 0-2-1-2-2.2V47.2C14.4 45 9 38.5 9 31c0-3.8 1.5-7 4-9v-6Z"
              fill="#6d3b44"
              opacity="0.9"
            />
            <path
              d="M16.5 18.5h15v5.5c2 1.7 3.2 4.3 3.2 7.2 0 6-4.2 11.2-9.7 13.1-5.5-1.9-9.7-7.1-9.7-13.1 0-2.9 1.2-5.5 3.2-7.2V18.5Z"
              fill="#b58b4a"
              opacity={variant === 'wide' ? 0.48 : 0.4}
            />
            <rect x="19" y="24" width="4.2" height="7" rx="0.8" fill="#fbf7f2" opacity="0.74" className="ramadan-glow" />
            <rect x="25" y="24" width="4.2" height="7" rx="0.8" fill="#f4ece4" opacity="0.64" className="ramadan-glow" />
            <rect x="19" y="33.5" width="4.2" height="5.5" rx="0.8" fill="#e7d3b0" opacity="0.55" className="ramadan-glow" />
            <rect x="25" y="33.5" width="4.2" height="5.5" rx="0.8" fill="#e7d3b0" opacity="0.5" className="ramadan-glow" />
            <path
              d="M14 16c0-1.5 1.2-2.5 3-2.5h14c1.8 0 3 1 3 2.5v6c2.5 2 4 5.2 4 9 0 7.5-5.4 14-12 16.2V56c0 1.2-.9 2.2-2 2.2h-2c-1.1 0-2-1-2-2.2V47.2C14.4 45 9 38.5 9 31c0-3.8 1.5-7 4-9v-6Z"
              stroke="#b58b4a"
              strokeWidth="1.25"
              opacity="0.96"
            />
            <circle cx="24" cy="61.5" r="2.2" fill="#b58b4a" opacity="0.94" />
            <path d="M24 63.5v4" stroke="#b58b4a" strokeWidth="1.2" opacity="0.85" />
          </>
        )}
      </svg>
      </div>
    </div>
  )
}

type LanternSpec = {
  id: string
  size: LanternSize
  className: string
  delay: string
  stringPx: number
  rotate?: number
  opacity?: number
  variant?: 'classic' | 'slim' | 'wide'
  bands: Band[]
  priority: number
}

/** Asymmetric lantern composition — ordered by priority for intensity culling. */
const LANTERNS: LanternSpec[] = [
  // Left primary cluster
  {
    id: 'L-left-lg',
    size: 'lg',
    className: 'top-0 start-[1%] sm:start-[1.8%]',
    delay: '0s',
    stringPx: 72,
    rotate: -2,
    variant: 'classic',
    bands: ['mobile', 'tablet', 'desktop'],
    priority: 1,
  },
  {
    id: 'L-left-md',
    size: 'md',
    className: 'top-8 start-[7%] sm:top-10 sm:start-[8%]',
    delay: '1.1s',
    stringPx: 108,
    rotate: 1.5,
    opacity: 1,
    variant: 'slim',
    bands: ['tablet', 'desktop'],
    priority: 3,
  },
  {
    id: 'L-left-sm',
    size: 'md',
    className: 'top-16 start-[3.5%] sm:top-20 sm:start-[4.5%]',
    delay: '2.2s',
    stringPx: 148,
    rotate: -1,
    opacity: 1,
    variant: 'classic',
    bands: ['desktop'],
    priority: 5,
  },
  // Right primary cluster (different rhythm)
  {
    id: 'L-right-lg',
    size: 'lg',
    className: 'top-0 end-[0.8%] sm:end-[1.5%]',
    delay: '0.7s',
    stringPx: 64,
    rotate: 2.2,
    variant: 'wide',
    bands: ['mobile', 'tablet', 'desktop'],
    priority: 2,
  },
  {
    id: 'L-right-md',
    size: 'md',
    className: 'top-6 end-[7%] sm:top-8 sm:end-[8.5%]',
    delay: '1.6s',
    stringPx: 120,
    rotate: -1.8,
    opacity: 1,
    variant: 'classic',
    bands: ['tablet', 'desktop'],
    priority: 4,
  },
  {
    id: 'L-right-sm-a',
    size: 'sm',
    className: 'top-14 end-[3%] sm:top-[4.5rem] sm:end-[4%]',
    delay: '2.8s',
    stringPx: 160,
    rotate: 1.2,
    opacity: 1,
    variant: 'slim',
    bands: ['desktop'],
    priority: 6,
  },
  {
    id: 'L-right-xs',
    size: 'sm',
    className: 'top-10 end-[13%] hidden lg:block',
    delay: '3.4s',
    stringPx: 96,
    rotate: -2.5,
    opacity: 0.95,
    variant: 'slim',
    bands: ['desktop'],
    priority: 7,
  },
  // Mid-upper accents
  {
    id: 'L-mid-left',
    size: 'sm',
    className: 'top-2 start-[16%] hidden md:block',
    delay: '1.9s',
    stringPx: 54,
    rotate: 0.8,
    opacity: 0.95,
    variant: 'classic',
    bands: ['tablet', 'desktop'],
    priority: 8,
  },
  {
    id: 'L-mid-right',
    size: 'xs',
    className: 'top-3 end-[18%] hidden lg:block',
    delay: '2.5s',
    stringPx: 44,
    rotate: -0.6,
    opacity: 0.92,
    variant: 'slim',
    bands: ['desktop'],
    priority: 9,
  },
  // Mobile-only extra side mini
  {
    id: 'L-mobile-side',
    size: 'sm',
    className: 'top-12 start-[14%] sm:hidden',
    delay: '1.4s',
    stringPx: 88,
    rotate: 1.4,
    opacity: 1,
    variant: 'slim',
    bands: ['mobile'],
    priority: 3,
  },
  {
    id: 'L-mobile-deep',
    size: 'md',
    className: 'top-[4.5rem] end-[12%] sm:hidden',
    delay: '2s',
    stringPx: 70,
    rotate: -1.2,
    opacity: 1,
    variant: 'classic',
    bands: ['mobile'],
    priority: 4,
  },
]

function TopGarland({ band, rich }: { band: Band; rich: boolean }) {
  const h = band === 'desktop' ? 72 : 56
  return (
    <div
      className={cx(
        'absolute overflow-visible',
        band === 'mobile' ? 'inset-x-[4%] top-[3.4rem] h-14' : 'inset-x-[8%] top-[3.5rem] h-16 sm:inset-x-[10%] sm:top-[3.8rem]',
      )}
    >
      <svg viewBox={`0 0 640 ${h}`} className="h-full w-full overflow-visible" aria-hidden="true">
        {/* Asymmetric multi-string garland */}
        <path
          d="M20 18 C90 38, 150 8, 230 24 S360 48, 440 18 S560 6, 620 22"
          stroke="#b58b4a"
          strokeWidth="1.45"
          fill="none"
          opacity="0.72"
        />
        <path
          d="M40 28 C120 8, 190 36, 280 16 S430 40, 520 14 S600 34, 630 20"
          stroke="#8c4e58"
          strokeWidth="1.1"
          fill="none"
          opacity="0.42"
        />
        {/* Beads / diamonds along the path */}
        <g fill="#b58b4a">
          <circle cx="78" cy="28" r="2.2" opacity="0.55" />
          <circle cx="168" cy="16" r="1.7" opacity="0.45" />
          <circle cx="255" cy="26" r="2.4" opacity="0.6" />
          <circle cx="340" cy="34" r="1.8" opacity="0.4" />
          <circle cx="420" cy="20" r="2.1" opacity="0.55" />
          <circle cx="510" cy="16" r="1.6" opacity="0.42" />
          <circle cx="580" cy="22" r="2" opacity="0.5" />
        </g>
        <g fill="#6d3b44" opacity="0.45">
          <path d="M120 22 124 28 120 34 116 28Z" />
          <path d="M300 18 305 25 300 32 295 25Z" />
          <path d="M470 24 474 30 470 36 466 30Z" />
        </g>
        {rich ? (
          <g>
            {/* Tiny hanging mini-lanterns on garland */}
            <g transform="translate(200,26)" opacity="0.75">
              <line x1="8" y1="0" x2="8" y2="10" stroke="#b58b4a" strokeWidth="1" />
              <rect x="3" y="10" width="10" height="14" rx="2" fill="#6d3b44" />
              <rect x="5" y="13" width="2.5" height="5" fill="#f4ece4" opacity="0.65" />
              <rect x="8.5" y="13" width="2.5" height="5" fill="#e7d3b0" opacity="0.55" />
              <circle cx="8" cy="26" r="1.4" fill="#b58b4a" />
            </g>
            <g transform="translate(390,20)" opacity="0.7">
              <line x1="7" y1="0" x2="7" y2="8" stroke="#b58b4a" strokeWidth="1" />
              <rect x="2.5" y="8" width="9" height="12" rx="1.8" fill="#6d3b44" />
              <rect x="4.2" y="11" width="2.2" height="4" fill="#fbf7f2" opacity="0.6" />
              <rect x="7.2" y="11" width="2.2" height="4" fill="#e7d3b0" opacity="0.5" />
              <circle cx="7" cy="22" r="1.2" fill="#b58b4a" />
            </g>
            <g transform="translate(545,24)" opacity="0.65">
              <line x1="6" y1="0" x2="6" y2="7" stroke="#8c4e58" strokeWidth="1" />
              <path d="M6 7 10 12 6 18 2 12Z" fill="#b58b4a" opacity="0.8" />
            </g>
          </g>
        ) : null}
      </svg>

      {/* Floating ornaments attached near garland */}
      <FourPointStar className="ramadan-drift absolute start-[18%] top-8 size-2.5 text-[#b58b4a] opacity-70 sm:top-9 sm:size-3" />
      <EightPointStar className="absolute start-[42%] top-5 size-3.5 text-[#8c4e58] opacity-55 sm:top-6 sm:size-4" />
      <DiamondMark className="absolute end-[28%] top-9 size-3 text-[#b58b4a] opacity-65 sm:top-10" />
      {rich && band !== 'mobile' ? (
        <FourPointStar className="ramadan-drift absolute end-[16%] top-6 size-2 text-[#6d3b44] opacity-60" />
      ) : null}
    </div>
  )
}

function SideCluster({
  side,
  band,
  rich,
}: {
  side: 'start' | 'end'
  band: Band
  rich: boolean
}) {
  const isStart = side === 'start'
  return (
    <div
      className={cx(
        'absolute top-[7.5rem] flex flex-col items-center gap-3 sm:top-[8.5rem]',
        isStart ? 'start-[1.5%] sm:start-[2%]' : 'end-[1.2%] sm:end-[1.8%]',
        band === 'mobile' ? 'gap-2' : 'gap-3.5',
      )}
    >
      {/* Vertical decorative string */}
      <div
        className={cx(
          'w-px bg-gradient-to-b from-[#b58b4a] via-[#8c4e58]/55 to-transparent',
          band === 'mobile' ? 'h-28' : band === 'tablet' ? 'h-40' : 'h-56',
        )}
      />
      <div className={cx('absolute top-6', isStart ? 'start-2' : 'end-2')}>
        <FourPointStar className="ramadan-drift size-3 text-[#b58b4a] opacity-75" />
      </div>
      <div className={cx('absolute top-16', isStart ? 'start-0' : 'end-0')}>
        <DiamondMark className="size-3.5 text-[#8c4e58] opacity-65" />
      </div>
      {rich && band !== 'mobile' ? (
        <>
          <div className={cx('absolute top-28', isStart ? 'start-3' : 'end-1')}>
            <EightPointStar className="size-5 text-[#b58b4a] opacity-60" />
          </div>
          <div className={cx('absolute top-44', isStart ? 'start-1' : 'end-3')}>
            <GeometricRosette className="size-6 text-[#6d3b44] opacity-55" />
          </div>
        </>
      ) : null}
      {band === 'desktop' && rich ? (
        <div className={cx('absolute top-[13.5rem]', isStart ? 'start-2' : 'end-2')}>
          <FourPointStar className="size-2 text-[#b58b4a] opacity-45" />
        </div>
      ) : null}
    </div>
  )
}

/**
 * Premium Ramadan decorative layer for customer pages.
 * Registry-gated by CustomerThemeEffects; reads config from ThemeProvider.
 */
export function RamadanThemeLayer() {
  const { themes } = useTheme()
  const band = useBand()
  const config = themes.ramadan.config
  const intensity = normalizeIntensity(config.intensity)
  const tune = INTENSITY[intensity]

  const showLanterns = config.lanterns !== false
  const showCrescent = config.crescent !== false
  const showDecorations = config.decorations !== false

  const lanterns = showLanterns
    ? LANTERNS.filter((item) => item.bands.includes(band))
        .sort((a, b) => a.priority - b.priority)
        .slice(0, tune.maxLanterns[band])
    : []

  const rich = tune.showExtraOrnaments

  return (
    <div
      aria-hidden="true"
      data-ramadan-theme="true"
      data-ramadan-intensity={intensity}
      data-ramadan-band={band}
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={
        {
          '--ramadan-opacity': String(tune.opacity),
          '--ramadan-glow': String(tune.glow),
          '--ramadan-gold': String(tune.goldBoost),
        } as CSSProperties
      }
    >
      <style>{`
        [data-ramadan-theme] .ramadan-layer {
          opacity: var(--ramadan-opacity);
        }
        [data-ramadan-theme] .ramadan-sway {
          animation: ramadan-sway 7.8s ease-in-out infinite;
          transform-origin: top center;
        }
        [data-ramadan-theme] .ramadan-glow {
          animation: ramadan-glow 5.8s ease-in-out infinite;
        }
        [data-ramadan-theme] .ramadan-ambient {
          animation: ramadan-ambient 8.5s ease-in-out infinite;
        }
        [data-ramadan-theme] .ramadan-drift {
          animation: ramadan-drift 9s ease-in-out infinite;
        }
        @keyframes ramadan-sway {
          0%, 100% { transform: rotate(-1.25deg); }
          50% { transform: rotate(1.25deg); }
        }
        @keyframes ramadan-glow {
          0%, 100% { opacity: 0.38; }
          50% { opacity: 0.72; }
        }
        @keyframes ramadan-ambient {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 0.9; }
        }
        @keyframes ramadan-drift {
          0%, 100% { transform: translateY(0); opacity: 0.55; }
          50% { transform: translateY(2px); opacity: 0.8; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-ramadan-theme] .ramadan-sway,
          [data-ramadan-theme] .ramadan-glow,
          [data-ramadan-theme] .ramadan-ambient,
          [data-ramadan-theme] .ramadan-drift {
            animation: none !important;
          }
        }
      `}</style>

      <div className="ramadan-layer relative h-full w-full">
        {/* Ambient clusters */}
        <div
          className="ramadan-ambient absolute -top-6 start-[-6%] h-56 w-56 rounded-full sm:h-64 sm:w-64"
          style={{
            background: `radial-gradient(circle, rgba(181,139,74,${tune.glow * tune.goldBoost}) 0%, rgba(140,78,88,${tune.glow * 0.35}) 42%, transparent 72%)`,
          }}
        />
        <div
          className="ramadan-ambient absolute -top-8 end-[-5%] h-60 w-60 rounded-full sm:h-72 sm:w-72"
          style={{
            background: `radial-gradient(circle, rgba(140,78,88,${tune.glow * 0.9}) 0%, rgba(181,139,74,${tune.glow * 0.45}) 40%, transparent 74%)`,
            animationDelay: '1.8s',
          }}
        />
        {band !== 'mobile' ? (
          <div
            className="ramadan-ambient absolute top-[9rem] start-[-2%] h-40 w-32 rounded-full"
            style={{
              background: `radial-gradient(circle, rgba(181,139,74,${tune.glow * 0.45}) 0%, transparent 70%)`,
              animationDelay: '3s',
            }}
          />
        ) : null}

        {showDecorations ? <TopGarland band={band} rich={rich} /> : null}

        {showDecorations ? (
          <>
            <SideCluster side="start" band={band} rich={rich} />
            <SideCluster side="end" band={band} rich={rich && band !== 'mobile'} />
          </>
        ) : null}

        {/* Floating geometric accents in upper side margins */}
        {showDecorations && band === 'desktop' ? (
          <>
            <GeometricRosette className="absolute start-[11%] top-[11.5rem] size-7 text-[#b58b4a] opacity-40" />
            <EightPointStar className="ramadan-drift absolute end-[11.5%] top-[12.5rem] size-5 text-[#8c4e58] opacity-50" />
            <DiamondMark className="absolute start-[5%] top-[17rem] size-3.5 text-[#6d3b44] opacity-45" />
            {rich ? (
              <FourPointStar className="absolute end-[5.5%] top-[18rem] size-2.5 text-[#b58b4a] opacity-50" />
            ) : null}
          </>
        ) : null}

        {showDecorations && band === 'tablet' ? (
          <>
            <EightPointStar className="absolute start-[9%] top-[12rem] size-4 text-[#b58b4a] opacity-45" />
            <DiamondMark className="absolute end-[8%] top-[13rem] size-3 text-[#8c4e58] opacity-50" />
          </>
        ) : null}

        {showDecorations && band === 'mobile' ? (
          <>
            <FourPointStar className="ramadan-drift absolute start-[8%] top-[11rem] size-2.5 text-[#b58b4a] opacity-55" />
            <DiamondMark className="absolute end-[7%] top-[12rem] size-2.5 text-[#8c4e58] opacity-50" />
          </>
        ) : null}

        {lanterns.map((item) => (
          <Lantern
            key={item.id}
            size={item.size}
            className={item.className}
            delay={item.delay}
            stringPx={item.stringPx}
            rotate={item.rotate}
            opacity={item.opacity}
            variant={item.variant}
          />
        ))}

        {showCrescent ? (
          <div
            className={cx(
              'absolute',
              band === 'mobile'
                ? 'top-[5.1rem] start-[22%]'
                : band === 'tablet'
                  ? 'top-[5.4rem] start-[20%]'
                  : 'top-[5.6rem] start-[18%]',
            )}
          >
            <div
              className="ramadan-ambient absolute -inset-3 rounded-full"
              style={{
                background: `radial-gradient(circle, rgba(181,139,74,${tune.glow * 0.7}) 0%, transparent 70%)`,
              }}
            />
            <div
              className={cx(
                'ramadan-sway relative text-[#b58b4a]',
                band === 'mobile' ? 'size-11' : band === 'tablet' ? 'size-14' : 'size-16',
              )}
              style={{ animationDelay: '2.6s', animationDuration: '9.2s' }}
            >
              <CrescentMark className="size-full drop-shadow-[0_3px_10px_rgba(181,139,74,0.4)]" />
            </div>
            <FourPointStar
              className={cx(
                'ramadan-drift absolute text-[#8c4e58]',
                band === 'mobile' ? '-end-1 top-0 size-3' : '-end-2.5 top-0.5 size-3.5',
              )}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
