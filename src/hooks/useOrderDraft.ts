import { useEffect, useState } from 'react'
import { STORAGE_KEYS } from '@/lib/constants'
import type { OrderDraft } from '@/types'

const EMPTY: OrderDraft = {
  serviceType: '',
  areaId: '',
  addressNotes: '',
  servings: '',
  date: '',
  time: '',
  designMode: 'catalog',
  cakeId: '',
  productId: '',
  offerId: '',
  optionValueIds: [],
  offerPicks: {},
  structure: 'single',
  sizeId: '',
  designNotes: '',
  fillingId: 'none',
  extraIds: [],
  customerName: '',
  phone: '',
}

type DraftBundle = {
  draft: OrderDraft
  step: number
}

function readSaved(): DraftBundle | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.draft)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<OrderDraft> & { step?: number; draft?: OrderDraft }
    if (parsed.draft) {
      return {
        draft: { ...EMPTY, ...parsed.draft },
        step: Number.isInteger(parsed.step) ? Math.min(Math.max(parsed.step as number, 0), 3) : 0,
      }
    }
    // Backward compatible: older sessions stored the draft object directly.
    const { step: maybeStep, ...rest } = parsed
    return {
      draft: { ...EMPTY, ...(rest as Partial<OrderDraft>) },
      step: Number.isInteger(maybeStep) ? Math.min(Math.max(maybeStep as number, 0), 3) : 0,
    }
  } catch {
    return null
  }
}

function withInitial(initial: Partial<OrderDraft>): DraftBundle {
  const saved = readSaved()
  const next: OrderDraft = { ...EMPTY, ...(saved?.draft ?? {}) }
  for (const [key, value] of Object.entries(initial) as Array<[keyof OrderDraft, OrderDraft[keyof OrderDraft]]>) {
    if (value) next[key] = value as never
  }
  return { draft: next, step: saved?.step ?? 0 }
}

export function useOrderDraft(initial: Partial<OrderDraft>) {
  const [bundle, setBundle] = useState<DraftBundle>(() => withInitial(initial))

  useEffect(() => {
    sessionStorage.setItem(
      STORAGE_KEYS.draft,
      JSON.stringify({ draft: bundle.draft, step: bundle.step }),
    )
  }, [bundle])

  function update(patch: Partial<OrderDraft>) {
    setBundle((current) => ({ ...current, draft: { ...current.draft, ...patch } }))
  }

  function setStep(step: number | ((current: number) => number)) {
    setBundle((current) => ({
      ...current,
      step: typeof step === 'function' ? step(current.step) : step,
    }))
  }

  function reset() {
    sessionStorage.removeItem(STORAGE_KEYS.draft)
    setBundle({ draft: EMPTY, step: 0 })
  }

  return { draft: bundle.draft, step: bundle.step, update, setStep, reset }
}
