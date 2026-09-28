import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { usePageTitle } from '@/hooks/usePageTitle'
import { ClosingSection } from '@/sections/ClosingSection'
import { CustomSection } from '@/sections/CustomSection'
import { DesignsSection } from '@/sections/DesignsSection'
import { HeroSection } from '@/sections/HeroSection'
import { PricingSection } from '@/sections/PricingSection'
import { StepsSection } from '@/sections/StepsSection'

export function HomePage() {
  const location = useLocation()
  usePageTitle('مستيكا | Misteka Cakes')

  useEffect(() => {
    const id = (location.state as { scrollTo?: string } | null)?.scrollTo
    if (!id) return
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 40)
    return () => window.clearTimeout(timer)
  }, [location.state])

  return (
    <>
      <HeroSection />
      <DesignsSection />
      <PricingSection />
      <CustomSection />
      <StepsSection />
      <ClosingSection />
    </>
  )
}
