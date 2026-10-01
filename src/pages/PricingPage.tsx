import { useEffect } from 'react'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useCatalog } from '@/providers/CatalogProvider'
import { PricingSection } from '@/sections/PricingSection'

export function PricingPage() {
  usePageTitle('الأسعار | مستكة')
  const { reload } = useCatalog()

  // Always refresh from Supabase when opening /pricing so admin edits appear after reload/navigation.
  useEffect(() => {
    void reload()
  }, [reload])

  return <PricingSection headingAs="h1" />
}
