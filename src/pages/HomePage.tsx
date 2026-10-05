import { usePageTitle } from '@/hooks/usePageTitle'
import { ClosingSection } from '@/sections/ClosingSection'
import { CustomSection } from '@/sections/CustomSection'
import { DesignsSection } from '@/sections/DesignsSection'
import { HeroSection } from '@/sections/HeroSection'
import { ReviewsSection } from '@/sections/ReviewsSection'
import { StepsSection } from '@/sections/StepsSection'

export function HomePage() {
  usePageTitle('مستكة | تورت أعياد ميلاد ومناسبات حسب الطلب')

  return (
    <>
      <HeroSection />
      <DesignsSection />
      <ReviewsSection />
      <CustomSection />
      <StepsSection />
      <ClosingSection />
    </>
  )
}
