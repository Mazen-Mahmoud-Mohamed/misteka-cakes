import { useSearchParams } from 'react-router-dom'
import { Container } from '@/components/layout/Container'
import { OrderWizard } from '@/components/order/OrderWizard'
import { usePageTitle } from '@/hooks/usePageTitle'
import type { DesignMode, OrderDraft } from '@/types'

function readInitial(params: URLSearchParams): Partial<OrderDraft> {
  const initial: Partial<OrderDraft> = {}
  const mode = params.get('mode')
  const cake = params.get('cake')
  const product = params.get('product')
  const offer = params.get('offer')
  const options = params.get('options')
  const picks = params.get('picks')
  if (mode === 'catalog' || mode === 'similar' || mode === 'custom') {
    initial.designMode = mode satisfies DesignMode
  }
  if (cake) initial.cakeId = cake
  if (product) initial.productId = product
  if (offer) initial.offerId = offer
  if (options) {
    initial.optionValueIds = options
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  }
  if (picks) {
    const map: Record<string, string> = {}
    for (const part of picks.split(',')) {
      const [componentId, productId] = part.split(':')
      if (componentId?.trim() && productId?.trim()) map[componentId.trim()] = productId.trim()
    }
    initial.offerPicks = map
  }
  return initial
}

export function OrderPage() {
  usePageTitle('طلب تورتة | مستكة')
  const [params] = useSearchParams()

  return (
    <Container className="py-8 sm:py-12">
      <header className="mb-6 max-w-2xl">
        <h1 className="font-display text-4xl text-rose-deep sm:text-5xl">اطلبي تورتتك</h1>
        <p className="mt-3 leading-8 text-muted">
          نبدأ بالموعد والمنطقة، ثم التصميم والحشوة. الحجز قبل الاستلام بثلاثة أيام على الأقل.
        </p>
      </header>
      <div className="mx-auto max-w-3xl rounded-3xl border border-line bg-paper p-4 shadow-soft sm:p-8">
        <OrderWizard key={params.toString()} initial={readInitial(params)} />
      </div>
    </Container>
  )
}
