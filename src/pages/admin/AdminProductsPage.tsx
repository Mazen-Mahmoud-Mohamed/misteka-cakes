import { useEffect, useRef, useState } from 'react'
import { resolveCakeImage } from '@/data/localCatalog'
import { AdminAlert } from '@/components/admin/AdminAlert'
import { AdminBadge, EnabledBadge } from '@/components/admin/AdminBadge'
import { AdminButton } from '@/components/admin/AdminButton'
import { AdminPage, AdminPageHeader } from '@/components/admin/AdminCard'
import {
  AdminSelectField,
  AdminSwitch,
  AdminTextAreaField,
  AdminTextField,
} from '@/components/admin/AdminField'
import { AdminList, AdminTable, Td, Th, Tr } from '@/components/admin/AdminTable'
import {
  CatalogEditor,
  CatalogListItem,
  CatalogResults,
  CatalogToolbar,
  EditButton,
  SORT_HINT,
  useCatalogCrud,
  useCatalogFilter,
} from '@/components/admin/catalog'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { IconCake, IconImage, IconPlus, IconRefresh } from '@/components/admin/icons'
import { usePageTitle } from '@/hooks/usePageTitle'
import {
  deleteAdminOptionValue,
  deleteAdminProduct,
  deleteAdminProductOption,
  deleteCatalogMedia,
  generateId,
  listAdminOptionValues,
  listAdminProductCategories,
  listAdminProductOptions,
  listAdminProducts,
  uploadCatalogMedia,
  upsertAdminOptionValue,
  upsertAdminProduct,
  upsertAdminProductOption,
  type AdminProductCategoryRow,
  type AdminProductOptionRow,
  type AdminProductOptionValueRow,
  type AdminProductRow,
} from '@/services/admin/adminProductService'
import type { ProductOptionSelection, ProductPricingMode } from '@/types/products'
import { formatEgp } from '@/utils/format'
import { cx } from '@/utils/cx'

const PRICING_LABELS: Record<ProductPricingMode, string> = {
  cake_sizes: 'حسب مقاس التورت',
  fixed: 'سعر ثابت',
  quote: 'عند التأكيد',
}

const SELECTION_LABELS: Record<ProductOptionSelection, string> = {
  toggle: 'تشغيل / إيقاف',
  single: 'اختيار واحد',
  multi: 'اختيار متعدد',
}

const emptyProduct: AdminProductRow = {
  id: '',
  name: '',
  description: '',
  category_id: '',
  pricing_mode: 'fixed',
  fixed_price: null,
  price_note: '',
  legacy_cake_id: null,
  image_key: '',
  image_alt: '',
  sort_order: 100,
  enabled: true,
}

const emptyOption = (productId: string, sort: number): AdminProductOptionRow => ({
  id: '',
  product_id: productId,
  name: '',
  description: '',
  selection_type: 'single',
  required: false,
  sort_order: sort,
  enabled: true,
})

const emptyValue = (optionId: string, sort: number): AdminProductOptionValueRow => ({
  id: '',
  option_id: optionId,
  name: '',
  price_adjustment: 0,
  sort_order: sort,
  enabled: true,
})

function Thumb({ imageKey, className = 'size-12' }: { imageKey: string; className?: string }) {
  const src = imageKey ? resolveCakeImage(imageKey) : ''
  return (
    <span className={`block shrink-0 overflow-hidden rounded-lg border border-line bg-cream ${className}`}>
      {src ? <img src={src} alt="" loading="lazy" className="size-full object-cover" /> : null}
    </span>
  )
}

function ProductImageField({
  id,
  value,
  error,
  onUploaded,
  onRemove,
  onBusyChange,
}: {
  id: string
  value: string
  error?: string
  onUploaded: (path: string) => void
  onRemove: () => void
  onBusyChange?: (busy: boolean) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [localError, setLocalError] = useState('')
  const uploading = progress !== null
  const shownError = localError || error

  async function handleFile(file: File | undefined) {
    if (!file) return
    setLocalError('')
    setProgress(0)
    onBusyChange?.(true)
    const result = await uploadCatalogMedia(file, 'products', setProgress)
    setProgress(null)
    onBusyChange?.(false)
    if (result.error || !result.path) {
      setLocalError(result.error ?? 'تعذّر رفع الصورة.')
      return
    }
    onUploaded(result.path)
  }

  return (
    <div className="grid content-start gap-1.5 sm:col-span-2">
      <p id={`${id}-label`} className="text-sm font-semibold text-ink">
        صورة المنتج
      </p>
      <div
        className={cx(
          'flex flex-col gap-4 rounded-lg border bg-ivory/60 p-3 sm:flex-row sm:items-center',
          shownError ? 'border-[#9a3434]' : 'border-line',
        )}
      >
        <div className="grid aspect-[4/5] w-28 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-cream">
          {value ? (
            <img src={resolveCakeImage(value)} alt="معاينة صورة المنتج" className="size-full object-cover" />
          ) : (
            <IconImage className="text-muted" />
          )}
        </div>
        <div className="grid min-w-0 flex-1 gap-2">
          {uploading ? (
            <div className="grid gap-1.5" aria-live="polite">
              <p className="text-sm font-semibold text-ink">جارٍ رفع الصورة... {progress}%</p>
              <div
                className="h-2 overflow-hidden rounded-full bg-cream"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress ?? 0}
                aria-labelledby={`${id}-label`}
              >
                <div className="h-full rounded-full bg-rose-deep transition-[width] duration-150" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <AdminButton size="sm" variant={value ? 'secondary' : 'primary'} onClick={() => inputRef.current?.click()}>
                {value ? 'استبدال الصورة' : 'رفع صورة'}
              </AdminButton>
              {value ? (
                <AdminButton size="sm" variant="dangerOutline" onClick={onRemove}>
                  حذف الصورة
                </AdminButton>
              ) : null}
            </div>
          )}
          <p id={`${id}-hint`} className="text-[0.8125rem] leading-6 text-muted">
            JPG أو PNG أو WEBP، بحد أقصى 5 ميجابايت.
          </p>
        </div>
      </div>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
        onChange={(e) => {
          void handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {shownError ? (
        <p className="text-[0.8125rem] leading-6 font-semibold text-[#8a2e2e]" role="alert">
          {shownError}
        </p>
      ) : null}
    </div>
  )
}

function categoryPath(categories: AdminProductCategoryRow[], id: string): string {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const parts: string[] = []
  let current = byId.get(id)
  while (current) {
    parts.unshift(current.name)
    current = current.parent_id ? byId.get(current.parent_id) : undefined
  }
  return parts.join(' › ') || id
}

function leafCategoryIds(categories: AdminProductCategoryRow[]): Set<string> {
  const parents = new Set(categories.map((c) => c.parent_id).filter(Boolean) as string[])
  return new Set(categories.filter((c) => c.kind !== 'offers' && !parents.has(c.id)).map((c) => c.id))
}

function OptionSection({
  productId,
  isCakeLinked,
}: {
  productId: string
  isCakeLinked: boolean
}) {
  const [options, setOptions] = useState<AdminProductOptionRow[]>([])
  const [valuesByOption, setValuesByOption] = useState<Record<string, AdminProductOptionValueRow[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [optionDraft, setOptionDraft] = useState<AdminProductOptionRow | null>(null)
  const [optionOriginal, setOptionOriginal] = useState<AdminProductOptionRow | null>(null)
  const [valueDraft, setValueDraft] = useState<AdminProductOptionValueRow | null>(null)
  const [savingOption, setSavingOption] = useState(false)
  const [savingValue, setSavingValue] = useState(false)
  const [confirmOptionId, setConfirmOptionId] = useState<string | null>(null)
  const [confirmValueId, setConfirmValueId] = useState<string | null>(null)
  const [busyDelete, setBusyDelete] = useState(false)
  const optionIds = useRef<string[]>([])
  const valueIds = useRef<Record<string, string[]>>({})

  async function reload() {
    setLoading(true)
    setError('')
    const optsRes = await listAdminProductOptions(productId)
    if (optsRes.error) {
      setError(optsRes.error)
      setOptions([])
      setValuesByOption({})
      setLoading(false)
      return
    }
    const opts = optsRes.data ?? []
    setOptions(opts)
    optionIds.current = opts.map((o) => o.id)
    const nextValues: Record<string, AdminProductOptionValueRow[]> = {}
    const nextValueIds: Record<string, string[]> = {}
    await Promise.all(
      opts.map(async (opt) => {
        const res = await listAdminOptionValues(opt.id)
        nextValues[opt.id] = res.data ?? []
        nextValueIds[opt.id] = (res.data ?? []).map((v) => v.id)
      }),
    )
    setValuesByOption(nextValues)
    valueIds.current = nextValueIds
    setLoading(false)
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  async function saveOption() {
    if (!optionDraft) return
    if (!optionDraft.name.trim()) {
      setMessage('أدخلي اسم الخيار.')
      return
    }
    setSavingOption(true)
    setMessage('')
    const payload: AdminProductOptionRow = {
      ...optionDraft,
      id: optionDraft.id || generateId(optionDraft.name, 'opt', optionIds.current),
      name: optionDraft.name.trim(),
      description: optionDraft.description.trim(),
      sort_order: Number(optionDraft.sort_order) || 0,
    }
    const result = await upsertAdminProductOption(payload)
    setSavingOption(false)
    if (!result.ok) {
      setMessage(result.message)
      return
    }
    setMessage(result.message)
    setOptionDraft(null)
    setOptionOriginal(null)
    await reload()
  }

  async function saveValue() {
    if (!valueDraft) return
    if (!valueDraft.name.trim()) {
      setMessage('أدخلي اسم القيمة.')
      return
    }
    setSavingValue(true)
    setMessage('')
    const taken = valueIds.current[valueDraft.option_id] ?? []
    const payload: AdminProductOptionValueRow = {
      ...valueDraft,
      id: valueDraft.id || generateId(valueDraft.name, 'val', taken),
      name: valueDraft.name.trim(),
      price_adjustment: Number(valueDraft.price_adjustment) || 0,
      sort_order: Number(valueDraft.sort_order) || 0,
    }
    const result = await upsertAdminOptionValue(payload)
    setSavingValue(false)
    if (!result.ok) {
      setMessage(result.message)
      return
    }
    setMessage(result.message)
    setValueDraft(null)
    await reload()
  }

  async function runDeleteOption() {
    if (!confirmOptionId) return
    setBusyDelete(true)
    const result = await deleteAdminProductOption(confirmOptionId)
    setBusyDelete(false)
    setConfirmOptionId(null)
    setMessage(result.message)
    if (result.ok) await reload()
  }

  async function runDeleteValue() {
    if (!confirmValueId) return
    setBusyDelete(true)
    const result = await deleteAdminOptionValue(confirmValueId)
    setBusyDelete(false)
    setConfirmValueId(null)
    setMessage(result.message)
    if (result.ok) await reload()
  }

  if (isCakeLinked) {
    return (
      <section className="grid gap-2 border-t border-line pt-5">
        <h3 className="text-sm font-bold text-ink">الخيارات</h3>
        <AdminAlert tone="info">خيارات مقاسات وحشوات التورت تُدار من صفحة التورت.</AdminAlert>
      </section>
    )
  }

  return (
    <section className="grid gap-4 border-t border-line pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-ink">الخيارات</h3>
        <AdminButton
          size="sm"
          variant="secondary"
          icon={<IconPlus size={16} />}
          disabled={loading || Boolean(optionDraft)}
          onClick={() => {
            const sort = Math.max(0, ...options.map((o) => o.sort_order)) + 10
            setOptionOriginal(null)
            setOptionDraft(emptyOption(productId, sort))
            setValueDraft(null)
            setMessage('')
          }}
        >
          إضافة خيار
        </AdminButton>
      </div>

      {loading ? <p className="text-sm text-muted">جارٍ تحميل الخيارات...</p> : null}
      {error ? <AdminAlert tone="error">{error}</AdminAlert> : null}
      {message ? <AdminAlert tone={message.includes('تعذّر') || message.includes('لا يمكن') ? 'error' : 'success'}>{message}</AdminAlert> : null}

      {!loading && !error && options.length === 0 && !optionDraft ? (
        <p className="text-[0.8125rem] text-muted">لا توجد خيارات لهذا المنتج بعد.</p>
      ) : null}

      <div className="grid gap-3">
        {options.map((opt) => {
          const values = valuesByOption[opt.id] ?? []
          const editingThis = optionDraft?.id === opt.id && optionOriginal
          return (
            <div key={opt.id} className="grid gap-3 rounded-lg border border-line bg-ivory/40 p-3">
              {editingThis && optionDraft ? (
                <OptionForm
                  draft={optionDraft}
                  onChange={setOptionDraft}
                  saving={savingOption}
                  onSave={() => void saveOption()}
                  onCancel={() => {
                    setOptionDraft(null)
                    setOptionOriginal(null)
                  }}
                />
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-ink">{opt.name}</p>
                    <p className="text-xs text-muted">
                      {SELECTION_LABELS[opt.selection_type]}
                      {opt.required ? ' · مطلوب' : ''}
                      {!opt.enabled ? ' · مخفي' : ''}
                    </p>
                    {opt.description ? <p className="mt-1 text-xs text-muted">{opt.description}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <AdminButton
                      size="sm"
                      onClick={() => {
                        setOptionDraft({ ...opt })
                        setOptionOriginal(opt)
                        setValueDraft(null)
                        setMessage('')
                      }}
                    >
                      تعديل
                    </AdminButton>
                    <AdminButton size="sm" variant="dangerOutline" onClick={() => setConfirmOptionId(opt.id)}>
                      حذف
                    </AdminButton>
                  </div>
                </div>
              )}

              <div className="grid gap-2 border-t border-line/80 pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-muted">القيم ({values.length})</p>
                  <AdminButton
                    size="sm"
                    variant="secondary"
                    disabled={Boolean(valueDraft) || !opt.id}
                    onClick={() => {
                      const sort = Math.max(0, ...values.map((v) => v.sort_order)) + 10
                      setValueDraft(emptyValue(opt.id, sort))
                      setMessage('')
                    }}
                  >
                    إضافة قيمة
                  </AdminButton>
                </div>
                {valueDraft?.option_id === opt.id ? (
                  <ValueForm
                    draft={valueDraft}
                    onChange={setValueDraft}
                    saving={savingValue}
                    onSave={() => void saveValue()}
                    onCancel={() => setValueDraft(null)}
                  />
                ) : null}
                {values.map((val) =>
                  valueDraft?.id === val.id ? (
                    <ValueForm
                      key={val.id}
                      draft={valueDraft}
                      onChange={setValueDraft}
                      saving={savingValue}
                      onSave={() => void saveValue()}
                      onCancel={() => setValueDraft(null)}
                    />
                  ) : (
                    <div key={val.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-paper/80 px-2.5 py-2">
                      <p className="text-sm text-ink">
                        {val.name}
                        <span className="ms-2 text-xs text-muted">
                          {val.price_adjustment === 0
                            ? 'بدون تعديل سعر'
                            : val.price_adjustment > 0
                              ? `+ ${formatEgp(val.price_adjustment)}`
                              : formatEgp(val.price_adjustment)}
                        </span>
                      </p>
                      <div className="flex gap-1.5">
                        <AdminButton size="sm" onClick={() => setValueDraft({ ...val })}>
                          تعديل
                        </AdminButton>
                        <AdminButton size="sm" variant="dangerOutline" onClick={() => setConfirmValueId(val.id)}>
                          حذف
                        </AdminButton>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          )
        })}
      </div>

      {optionDraft && !optionOriginal ? (
        <div className="rounded-lg border border-line bg-ivory/40 p-3">
          <OptionForm
            draft={optionDraft}
            onChange={setOptionDraft}
            saving={savingOption}
            onSave={() => void saveOption()}
            onCancel={() => setOptionDraft(null)}
          />
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmOptionId)}
        title="حذف الخيار؟"
        body="سيتم حذف الخيار وكل قيمه نهائيًا."
        confirmLabel="حذف"
        cancelLabel="رجوع"
        danger
        busy={busyDelete}
        onCancel={() => setConfirmOptionId(null)}
        onConfirm={() => void runDeleteOption()}
      />
      <ConfirmDialog
        open={Boolean(confirmValueId)}
        title="حذف القيمة؟"
        body="سيتم حذف هذه القيمة نهائيًا."
        confirmLabel="حذف"
        cancelLabel="رجوع"
        danger
        busy={busyDelete}
        onCancel={() => setConfirmValueId(null)}
        onConfirm={() => void runDeleteValue()}
      />
    </section>
  )
}

function OptionForm({
  draft,
  onChange,
  saving,
  onSave,
  onCancel,
}: {
  draft: AdminProductOptionRow
  onChange: (next: AdminProductOptionRow) => void
  saving: boolean
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <AdminTextField
          id="opt-name"
          label="اسم الخيار"
          required
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
        <AdminSelectField
          id="opt-selection"
          label="نوع الاختيار"
          value={draft.selection_type}
          onChange={(e) => onChange({ ...draft, selection_type: e.target.value as ProductOptionSelection })}
        >
          {(Object.keys(SELECTION_LABELS) as ProductOptionSelection[]).map((key) => (
            <option key={key} value={key}>
              {SELECTION_LABELS[key]}
            </option>
          ))}
        </AdminSelectField>
        <AdminTextAreaField
          id="opt-desc"
          label="وصف الخيار"
          wrapperClassName="sm:col-span-2"
          value={draft.description}
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
        />
        <AdminTextField
          id="opt-sort"
          label="ترتيب العرض"
          type="number"
          inputMode="numeric"
          dir="ltr"
          className="text-start"
          hint={SORT_HINT}
          value={String(draft.sort_order)}
          onChange={(e) => onChange({ ...draft, sort_order: Number(e.target.value) })}
        />
      </div>
      <AdminSwitch
        id="opt-required"
        label="مطلوب"
        description="يلزم العميل اختيار قيمة قبل المتابعة."
        checked={draft.required}
        onChange={(required) => onChange({ ...draft, required })}
      />
      <AdminSwitch
        id="opt-enabled"
        label="ظاهر في الموقع"
        description="عند إيقافه لن يظهر هذا الخيار للعملاء."
        checked={draft.enabled}
        onChange={(enabled) => onChange({ ...draft, enabled })}
      />
      <div className="flex flex-wrap gap-2">
        <AdminButton size="sm" variant="primary" loading={saving} onClick={onSave}>
          حفظ الخيار
        </AdminButton>
        <AdminButton size="sm" disabled={saving} onClick={onCancel}>
          إلغاء
        </AdminButton>
      </div>
    </div>
  )
}

function ValueForm({
  draft,
  onChange,
  saving,
  onSave,
  onCancel,
}: {
  draft: AdminProductOptionValueRow
  onChange: (next: AdminProductOptionValueRow) => void
  saving: boolean
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="grid gap-3 rounded-md border border-dashed border-line bg-paper p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <AdminTextField
          id="val-name"
          label="اسم القيمة"
          required
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
        <AdminTextField
          id="val-price"
          label="تعديل السعر"
          type="number"
          inputMode="decimal"
          dir="ltr"
          className="text-start"
          hint="موجب يزيد السعر، سالب يخصم منه."
          value={String(draft.price_adjustment)}
          onChange={(e) => onChange({ ...draft, price_adjustment: Number(e.target.value) })}
        />
        <AdminTextField
          id="val-sort"
          label="ترتيب العرض"
          type="number"
          inputMode="numeric"
          dir="ltr"
          className="text-start"
          value={String(draft.sort_order)}
          onChange={(e) => onChange({ ...draft, sort_order: Number(e.target.value) })}
        />
      </div>
      <AdminSwitch
        id="val-enabled"
        label="ظاهر في الموقع"
        checked={draft.enabled}
        onChange={(enabled) => onChange({ ...draft, enabled })}
      />
      <div className="flex flex-wrap gap-2">
        <AdminButton size="sm" variant="primary" loading={saving} onClick={onSave}>
          حفظ القيمة
        </AdminButton>
        <AdminButton size="sm" disabled={saving} onClick={onCancel}>
          إلغاء
        </AdminButton>
      </div>
    </div>
  )
}

export function AdminProductsPage() {
  usePageTitle('المنتجات | مستكة')
  const [categories, setCategories] = useState<AdminProductCategoryRow[]>([])
  const [uploading, setUploading] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const sessionUploads = useRef(new Set<string>())
  const productIds = useRef<string[]>([])
  const nextSort = useRef(10)

  function resetSession() {
    setUploading(false)
    setDeleteError('')
  }

  const crud = useCatalogCrud<AdminProductRow>({
    list: async () => {
      const [productsRes, categoriesRes] = await Promise.all([listAdminProducts(), listAdminProductCategories()])
      setCategories(categoriesRes.data ?? [])
      productIds.current = (productsRes.data ?? []).map((row) => row.id)
      nextSort.current = Math.max(0, ...(productsRes.data ?? []).map((row) => row.sort_order), 0) + 10
      return productsRes
    },
    upsert: upsertAdminProduct,
    prepare: (draft) => {
      const isCake = Boolean(draft.legacy_cake_id) || draft.pricing_mode === 'cake_sizes'
      return {
        ...draft,
        id: draft.id || generateId(draft.name, 'product', productIds.current),
        name: draft.name.trim(),
        description: draft.description.trim(),
        price_note: draft.price_note.trim(),
        image_alt: draft.image_alt.trim(),
        sort_order: draft.id ? Number(draft.sort_order) || 0 : nextSort.current,
        fixed_price:
          isCake || draft.pricing_mode !== 'fixed' || draft.fixed_price == null || Number.isNaN(Number(draft.fixed_price))
            ? isCake
              ? draft.fixed_price
              : null
            : Number(draft.fixed_price),
      }
    },
    validate: (draft) => {
      const isCake = Boolean(draft.legacy_cake_id)
      return {
        name: draft.name.trim() ? undefined : 'أدخلي اسم المنتج.',
        category_id: draft.category_id ? undefined : 'اختاري التصنيف.',
        fixed_price:
          !isCake && draft.pricing_mode === 'fixed' && (draft.fixed_price == null || Number.isNaN(Number(draft.fixed_price)))
            ? 'أدخلي السعر الثابت.'
            : undefined,
        image_key: uploading ? 'انتظري حتى يكتمل رفع الصورة.' : undefined,
        pricing_mode:
          !isCake && draft.pricing_mode === 'cake_sizes' ? 'هذا النمط متاح فقط للمنتجات المرتبطة بالتورت.' : undefined,
      }
    },
    onSaved: async (saved, previous) => {
      const stale = [...sessionUploads.current].filter((path) => path !== saved.image_key)
      if (previous?.image_key && previous.image_key !== saved.image_key) stale.push(previous.image_key)
      sessionUploads.current.clear()
      resetSession()
      await Promise.all(stale.map(deleteCatalogMedia))
    },
    onDiscard: () => {
      const unsaved = [...sessionUploads.current]
      sessionUploads.current.clear()
      resetSession()
      void Promise.all(unsaved.map(deleteCatalogMedia))
    },
  })

  const filter = useCatalogFilter(crud.rows, (row) => [
    row.name,
    row.description,
    categoryPath(categories, row.category_id),
    PRICING_LABELS[row.pricing_mode],
  ])

  const leaves = leafCategoryIds(categories)
  const categoryChoices = [...categories]
    .filter((c) => c.kind !== 'offers')
    .sort((a, b) => {
      const aLeaf = leaves.has(a.id) ? 0 : 1
      const bLeaf = leaves.has(b.id) ? 0 : 1
      if (aLeaf !== bLeaf) return aLeaf - bLeaf
      return a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'ar')
    })

  function startNew() {
    const preferred =
      categoryChoices.find((c) => leaves.has(c.id) && c.enabled)?.id ??
      categoryChoices.find((c) => c.enabled)?.id ??
      ''
    crud.open({ ...emptyProduct, category_id: preferred, sort_order: nextSort.current }, null)
  }

  function startEdit(row: AdminProductRow) {
    crud.open({ ...row }, row)
  }

  async function runDelete() {
    if (!crud.original) return
    setDeleting(true)
    const result = await deleteAdminProduct(crud.original.id)
    setDeleting(false)
    setConfirmDelete(false)
    if (!result.ok) {
      setDeleteError(result.message)
      return
    }
    crud.close()
    await crud.load(true)
  }

  const draft = crud.draft
  const isCakeLinked = Boolean(draft?.legacy_cake_id)
  const isEditing = Boolean(crud.original)

  return (
    <AdminPage>
      <AdminPageHeader
        title="المنتجات"
        description="منتجات الكتالوج وتصنيفاتها وأسعارها وخياراتها كما تظهر للعملاء."
        actions={
          <>
            <AdminButton icon={<IconRefresh size={18} />} loading={crud.refreshing} disabled={crud.loading} onClick={() => void crud.load(true)}>
              تحديث
            </AdminButton>
            <AdminButton variant="primary" icon={<IconPlus size={18} />} disabled={crud.loading} onClick={startNew}>
              إضافة منتج
            </AdminButton>
          </>
        }
      />

      {!crud.loading && !crud.error && crud.rows.length > 0 ? (
        <CatalogToolbar
          id="products-search"
          placeholder="ابحثي باسم المنتج أو التصنيف"
          filter={filter}
          total={crud.rows.length}
          visible={filter.filtered.length}
          noun="منتج"
        />
      ) : null}

      <CatalogResults
        loading={crud.loading}
        error={crud.error}
        onRetry={() => void crud.load(true)}
        retrying={crud.refreshing}
        total={crud.rows.length}
        visible={filter.filtered.length}
        emptyTitle="لا توجد منتجات"
        emptyDescription="أضيفي أول منتج ليظهر في كتالوج العملاء."
        emptyIcon={<IconCake />}
        addLabel="إضافة منتج"
        onAdd={startNew}
        onClearFilters={() => {
          filter.setQuery('')
          filter.setEnabled('all')
        }}
        table={
          <AdminTable
            caption="المنتجات"
            head={
              <>
                <Th>المنتج</Th>
                <Th>التصنيف</Th>
                <Th className="hidden lg:table-cell">التسعير</Th>
                <Th>الحالة</Th>
                <Th>
                  <span className="sr-only">إجراء</span>
                </Th>
              </>
            }
          >
            {filter.filtered.map((row) => (
              <Tr key={row.id} className={row.enabled ? undefined : 'bg-cream/30'}>
                <Td>
                  <div className="flex items-center gap-3">
                    <Thumb imageKey={row.image_key} />
                    <div className="min-w-0">
                      <p className="font-bold">{row.name}</p>
                      {row.legacy_cake_id ? <p className="text-xs text-muted">مرتبط بالتورت</p> : null}
                    </div>
                  </div>
                </Td>
                <Td>
                  <AdminBadge tone="info">{categoryPath(categories, row.category_id)}</AdminBadge>
                </Td>
                <Td className="hidden text-[0.8125rem] text-muted lg:table-cell">
                  {PRICING_LABELS[row.pricing_mode]}
                  {row.pricing_mode === 'fixed' && row.fixed_price != null ? ` · ${formatEgp(row.fixed_price)}` : ''}
                </Td>
                <Td>
                  <EnabledBadge enabled={row.enabled} />
                </Td>
                <Td className="w-px text-end">
                  <EditButton label={`تعديل ${row.name}`} onClick={() => startEdit(row)} />
                </Td>
              </Tr>
            ))}
          </AdminTable>
        }
        list={
          <AdminList label="المنتجات">
            {filter.filtered.map((row) => (
              <CatalogListItem
                key={row.id}
                media={<Thumb imageKey={row.image_key} className="size-14" />}
                title={row.name}
                meta={
                  <span className="text-xs text-muted">
                    {PRICING_LABELS[row.pricing_mode]}
                    {row.legacy_cake_id ? ' · مرتبط بالتورت' : ''}
                  </span>
                }
                badges={
                  <>
                    <EnabledBadge enabled={row.enabled} />
                    <AdminBadge tone="info">{categoryPath(categories, row.category_id)}</AdminBadge>
                  </>
                }
                editLabel={`تعديل ${row.name}`}
                onEdit={() => startEdit(row)}
              />
            ))}
          </AdminList>
        }
      />

      <CatalogEditor
        crud={crud}
        size="lg"
        newTitle="منتج جديد"
        editTitle="تعديل المنتج"
        disableTitle="إخفاء المنتج؟"
        disableBody="لن يظهر هذا المنتج للعملاء بعد الحفظ. الطلبات السابقة لا تتأثر، ويمكنك إظهاره مرة أخرى لاحقًا."
      >
        {draft ? (
          <>
            {isCakeLinked ? (
              <AdminAlert tone="info">
                هذا المنتج مرتبط بتورتة. يمكن تعديل الاسم والوصف والتصنيف والصورة والترتيب والظهور هنا. المقاسات تُدار من صفحة
                التورت.
              </AdminAlert>
            ) : null}

            <section aria-labelledby="product-basic" className="grid gap-4">
              <h3 id="product-basic" className="text-sm font-bold text-ink">
                البيانات الأساسية
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminTextField
                  id="product-name"
                  label="اسم المنتج"
                  required
                  value={draft.name}
                  error={crud.fieldErrors.name}
                  onChange={(e) => crud.update({ name: e.target.value })}
                />
                <AdminSelectField
                  id="product-category"
                  label="التصنيف"
                  required
                  value={draft.category_id}
                  error={crud.fieldErrors.category_id}
                  onChange={(e) => crud.update({ category_id: e.target.value })}
                >
                  {!draft.category_id ? <option value="">اختاري التصنيف</option> : null}
                  {categoryChoices.map((c) => (
                    <option key={c.id} value={c.id}>
                      {categoryPath(categories, c.id)}
                      {c.enabled ? '' : ' (مخفي)'}
                      {leaves.has(c.id) ? '' : ' — رئيسي'}
                    </option>
                  ))}
                </AdminSelectField>
                <AdminTextAreaField
                  id="product-desc"
                  label="وصف المنتج"
                  wrapperClassName="sm:col-span-2"
                  value={draft.description}
                  onChange={(e) => crud.update({ description: e.target.value })}
                />
                {isCakeLinked ? (
                  <AdminTextField
                    id="product-pricing-ro"
                    label="طريقة التسعير"
                    value={PRICING_LABELS.cake_sizes}
                    readOnly
                    wrapperClassName="sm:col-span-2"
                  />
                ) : (
                  <>
                    <AdminSelectField
                      id="product-pricing"
                      label="طريقة التسعير"
                      required
                      value={draft.pricing_mode === 'cake_sizes' ? 'fixed' : draft.pricing_mode}
                      error={crud.fieldErrors.pricing_mode}
                      onChange={(e) => {
                        const mode = e.target.value as ProductPricingMode
                        crud.update({
                          pricing_mode: mode,
                          fixed_price: mode === 'fixed' ? draft.fixed_price : null,
                        })
                      }}
                    >
                      <option value="fixed">{PRICING_LABELS.fixed}</option>
                      <option value="quote">{PRICING_LABELS.quote}</option>
                    </AdminSelectField>
                    {draft.pricing_mode === 'fixed' ? (
                      <AdminTextField
                        id="product-fixed-price"
                        label="السعر الثابت"
                        required
                        type="number"
                        inputMode="decimal"
                        dir="ltr"
                        className="text-start"
                        value={draft.fixed_price == null ? '' : String(draft.fixed_price)}
                        error={crud.fieldErrors.fixed_price}
                        onChange={(e) =>
                          crud.update({
                            fixed_price: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                      />
                    ) : (
                      <div />
                    )}
                  </>
                )}
                <AdminTextField
                  id="product-price-note"
                  label="ملاحظة السعر"
                  wrapperClassName="sm:col-span-2"
                  hint="تظهر للعميل بجانب معلومات التسعير."
                  value={draft.price_note}
                  onChange={(e) => crud.update({ price_note: e.target.value })}
                />
                <ProductImageField
                  id="product-image"
                  value={draft.image_key}
                  error={crud.fieldErrors.image_key}
                  onBusyChange={setUploading}
                  onUploaded={(path) => {
                    sessionUploads.current.add(path)
                    crud.update({ image_key: path })
                  }}
                  onRemove={() => crud.update({ image_key: '' })}
                />
                <AdminTextField
                  id="product-alt"
                  label="وصف الصورة"
                  wrapperClassName="sm:col-span-2"
                  value={draft.image_alt}
                  onChange={(e) => crud.update({ image_alt: e.target.value })}
                />
                <AdminTextField
                  id="product-sort"
                  label="ترتيب العرض"
                  type="number"
                  inputMode="numeric"
                  dir="ltr"
                  className="text-start"
                  hint={SORT_HINT}
                  value={String(draft.sort_order)}
                  onChange={(e) => crud.update({ sort_order: Number(e.target.value) })}
                />
              </div>
              <AdminSwitch
                id="product-enabled"
                label="ظاهر في الموقع"
                description="عند إيقافه لن يظهر المنتج للعملاء."
                checked={draft.enabled}
                onChange={(enabled) => crud.update({ enabled })}
              />
            </section>

            {isEditing && crud.original ? (
              <OptionSection productId={crud.original.id} isCakeLinked={isCakeLinked} />
            ) : null}

            {isEditing && crud.original ? (
              <div className="grid gap-2 border-t border-line pt-4">
                {isCakeLinked ? (
                  <p className="text-[0.8125rem] leading-6 text-muted">
                    منتجات التورت المرتبطة لا تُحذف من هنا. أخفيها أو أديريها من صفحة التورت.
                  </p>
                ) : (
                  <div>
                    <AdminButton size="sm" variant="dangerOutline" onClick={() => setConfirmDelete(true)}>
                      حذف المنتج
                    </AdminButton>
                  </div>
                )}
                {deleteError ? (
                  <p className="text-[0.8125rem] leading-6 font-semibold text-[#8a2e2e]" role="alert">
                    {deleteError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </CatalogEditor>

      <ConfirmDialog
        open={confirmDelete}
        title="حذف المنتج؟"
        body="سيتم حذف هذا المنتج وخياراته نهائيًا إن لم يكن مستخدمًا في عرض."
        confirmLabel="حذف"
        cancelLabel="رجوع"
        danger
        busy={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void runDelete()}
      />
    </AdminPage>
  )
}
