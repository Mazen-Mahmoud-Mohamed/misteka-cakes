import { usePageTitle } from '@/hooks/usePageTitle'
import { ClosingSection } from '@/sections/ClosingSection'
import { CustomSection } from '@/sections/CustomSection'
import { DesignsSection } from '@/sections/DesignsSection'
import { HeroSection } from '@/sections/HeroSection'
import { StepsSection } from '@/sections/StepsSection'

export function HomePage() {
  usePageTitle('مستكة | Mestika')

  return (
    <>
      <HeroSection />
      <DesignsSection />
      <CustomSection />
      <StepsSection />
      <ClosingSection />
    </>
  )
}
