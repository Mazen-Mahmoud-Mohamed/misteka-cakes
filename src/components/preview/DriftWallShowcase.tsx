// TEMPORARY DriftWall preview for the homepage; CakeCarousel remains the production showcase.
import { useEffect, useState } from 'react'
import { ButtonLink } from '@/components/ui/Button'
import lavenderRuffles from '../../../examples/677098133_122103641816737429_1362524322146171530_n.jpg'
import peachRoses from '../../../examples/682819553_122107658456737429_7236436308465021773_n.jpg'
import butterflyBirthday from '../../../examples/WhatsApp Image 2026-09-28 at 6.30.09 PM (1).jpeg'
import ourFamily from '../../../examples/WhatsApp Image 2026-09-28 at 6.30.10 PM (1).jpeg'
import redHearts from '../../../examples/WhatsApp Image 2026-09-28 at 6.30.11 PM (2).jpeg'
import pinkButterflies from '../../../examples/WhatsApp Image 2026-09-28 at 6.30.11 PM (5).jpeg'
import bouquet from '../../../examples/WhatsApp Image 2026-09-28 at 6.30.11 PM (7).jpeg'
import marieCat from '../../../examples/WhatsApp Image 2026-09-28 at 6.30.11 PM.jpeg'
import petalFlowers from '../../../examples/WhatsApp Image 2026-09-28 at 6.30.12 PM (1).jpeg'
import goldScript from '../../../examples/WhatsApp Image 2026-09-28 at 6.30.12 PM (2).jpeg'
import whiteFlowers from '../../../examples/WhatsApp Image 2026-09-28 at 6.30.12 PM.jpeg'
import kpop from '../../../examples/WhatsApp Image 2026-09-28 at 6.30.10 PM.jpeg'
import spiderman from '../../../examples/WhatsApp Image 2026-09-28 at 6.30.09 PM (2).jpeg'
// @ts-expect-error untyped React Bits source kept as-is for the preview
import DriftWall from './DriftWall.jsx'

/** Ordered so neighbouring columns alternate colour (blush / lavender / white / warm) when dealt round-robin. */
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

export function DriftWallShowcase() {
  const [width, setWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const mobile = width < 640
  const tablet = !mobile && width < 1024

  return (
    <div className="grid gap-8">
      <div className="-mx-4 overflow-hidden sm:mx-0 sm:rounded-3xl" style={{ height: mobile ? 520 : 660 }}>
        <DriftWall
          items={PHOTOS}
          columns={mobile ? 3 : 4}
          tileWidth={mobile ? 136 : tablet ? 184 : 250}
          tileHeight={mobile ? 170 : tablet ? 230 : 312}
          gap={mobile ? 12 : 20}
          radius={20}
          tilt={mobile ? 10 : 14}
          turn={mobile ? -8 : -12}
          perspective={1400}
          depth={90}
          speed={20}
          direction="up"
          variance={0.35}
          parallax={mobile ? 0 : 0.4}
          lift={48}
          fade={0.3}
          dim={1}
          shade={0.06}
          overlayColor="#faf6f0"
          style={{ height: '100%' }}
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
