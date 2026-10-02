// DriftWall homepage showcase; CakeCarousel stays available behind PREVIEW_DRIFTWALL in DesignsSection.
import { useEffect, useState } from 'react'
import bouquet from '@/assets/drift/bouquet.webp'
import butterflyBirthday from '@/assets/drift/butterfly-birthday.webp'
import goldScript from '@/assets/drift/gold-script.webp'
import kpop from '@/assets/drift/kpop.webp'
import lavenderRuffles from '@/assets/drift/lavender-ruffles.webp'
import marieCat from '@/assets/drift/marie-cat.webp'
import ourFamily from '@/assets/drift/our-family.webp'
import peachRoses from '@/assets/drift/peach-roses.webp'
import petalFlowers from '@/assets/drift/petal-flowers.webp'
import pinkButterflies from '@/assets/drift/pink-butterflies.webp'
import redHearts from '@/assets/drift/red-hearts.webp'
import spiderman from '@/assets/drift/spiderman.webp'
import whiteFlowers from '@/assets/drift/white-flowers.webp'
import { ButtonLink } from '@/components/ui/Button'
// @ts-expect-error untyped React Bits source
import DriftWall from './DriftWall.jsx'

/**
 * Dealt round-robin into columns, so neighbours alternate warm / cool / white / bold
 * at 2, 3 and 4 columns and the two butterfly cakes never share a row.
 */
const PHOTOS = [
  { image: peachRoses, title: 'تورتة الورد الخوخي' },
  { image: lavenderRuffles, title: 'تورتة الكشكشة البنفسجية' },
  { image: bouquet, title: 'بوكيه الورد' },
  { image: pinkButterflies, title: 'تورتة الفراشات الوردية' },
  { image: ourFamily, title: 'تورتة العائلة' },
  { image: goldScript, title: 'تورتة الكتابة الذهبية' },
  { image: redHearts, title: 'تورتة القلوب' },
  { image: kpop, title: 'تورتة كيبوب' },
  { image: butterflyBirthday, title: 'تورتة الفراشات' },
  { image: whiteFlowers, title: 'تورتة الورد الأبيض' },
  { image: marieCat, title: 'تورتة القطة ماري' },
  { image: spiderman, title: 'تورتة سبايدرمان' },
  { image: petalFlowers, title: 'تورتة البتلات' },
].map((photo, i) => ({ ...photo, id: `drift-${i}` }))

type Layout = {
  columns: number
  tile: [number, number]
  gap: number
  height: number
  tilt: number
  turn: number
  parallax: number
  /** Wall width in px when it should break out of the page container (large desktops only). */
  wide?: number
  /** Leftward recentring in px; the negative turn pushes the near (right) side outward. */
  shift?: number
}

/** Tuned per breakpoint rather than scaled, so phones get fewer, larger cakes. */
function layoutFor(width: number): Layout {
  if (width < 420) return { columns: 2, tile: [144, 180], gap: 18, height: 540, tilt: 6, turn: -4, parallax: 0 }
  if (width < 640) return { columns: 2, tile: [160, 200], gap: 20, height: 580, tilt: 6, turn: -4, parallax: 0 }
  if (width < 900) return { columns: 3, tile: [186, 232], gap: 22, height: 580, tilt: 9, turn: -6, parallax: 0.2, shift: 20 }
  if (width < 1200) return { columns: 4, tile: [188, 235], gap: 24, height: 600, tilt: 10, turn: -7, parallax: 0.25, shift: 25 }
  if (width < 1360) return { columns: 4, tile: [222, 278], gap: 26, height: 640, tilt: 10, turn: -7, parallax: 0.25, wide: width - 112, shift: 32 }
  if (width < 1600) return { columns: 4, tile: [228, 285], gap: 30, height: 680, tilt: 10, turn: -7, parallax: 0.25, wide: Math.min(1240, width - 160), shift: 34 }
  return { columns: 4, tile: [226, 282], gap: 34, height: 700, tilt: 10, turn: -7, parallax: 0.25, wide: 1240, shift: 34 }
}

/** Slight counter-clockwise roll so the columns lean toward the left. */
const ROLL = -3

/**
 * Centre tiles at full strength with the periphery eased back, intersected with a
 * vertical fade so the bottom dissolves into the page like DriftWall's own top fade.
 */
const FOCUS_MASK = [
  'linear-gradient(to bottom, #000 0%, #000 78%, transparent 100%)',
  'radial-gradient(ellipse 72% 80% at 50% 50%, #000 52%, rgba(0,0,0,0.5) 100%)',
].join(', ')

export function DriftWallShowcase() {
  const [width, setWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const layout = layoutFor(width)

  return (
    <div className="grid gap-8">
      <div
        data-showcase
        className="-mx-4 overflow-hidden sm:mx-0 sm:rounded-3xl"
        style={{
          height: layout.height,
          maskImage: FOCUS_MASK,
          WebkitMaskImage: FOCUS_MASK,
          maskComposite: 'intersect',
          WebkitMaskComposite: 'source-in',
          ...(layout.wide && { width: layout.wide, marginInline: `calc((100% - ${layout.wide}px) / 2)` }),
        }}
      >
        <DriftWall
          items={PHOTOS}
          columns={layout.columns}
          tileWidth={layout.tile[0]}
          tileHeight={layout.tile[1]}
          gap={layout.gap}
          radius={20}
          tilt={layout.tilt}
          turn={layout.turn}
          roll={ROLL}
          perspective={1600}
          depth={70}
          speed={12}
          direction="up"
          variance={0.3}
          parallax={layout.parallax}
          lift={28}
          fade={0.35}
          dim={1}
          shade={0.04}
          overlayColor="#faf6f0"
          style={{ height: '100%', width: `calc(100% + ${2 * (layout.shift ?? 0)}px)`, marginLeft: -2 * (layout.shift ?? 0) }}
        />
      </div>
      <div className="flex justify-center">
        <ButtonLink to="/catalog" variant="secondary">
          شاهدي كل التصاميم
        </ButtonLink>
      </div>
    </div>
  )
}
