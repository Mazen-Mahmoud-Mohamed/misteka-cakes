import { Container } from '@/components/layout/Container'
import { ButtonLink } from '@/components/ui/Button'
import { usePageTitle } from '@/hooks/usePageTitle'

export function NotFoundPage() {
  usePageTitle('الصفحة غير موجودة | مستكة')

  return (
    <Container className="py-20 text-center">
      <h1 className="font-display text-4xl text-rose-deep">الصفحة غير موجودة</h1>
      <ButtonLink to="/" className="mt-6">
        العودة للرئيسية
      </ButtonLink>
    </Container>
  )
}
