import { usePageTitle } from '@/hooks/usePageTitle'
import { PricingSection } from '@/sections/PricingSection'

export function PricingPage() {
  usePageTitle('الأسعار | مستكة')

  return <PricingSection headingAs="h1" />
}
