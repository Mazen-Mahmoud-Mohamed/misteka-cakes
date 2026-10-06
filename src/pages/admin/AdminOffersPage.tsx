import { useRef, useState } from 'react'
import { resolveCakeImage } from '@/data/localCatalog'
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
import { IconImage, IconPlus, IconRefresh, IconSparkles } from '@/components/admin/icons'
import { usePageTitle } from '@/hooks/usePageTitle'
import {
  deleteAdminOffer,
  deleteAdminOfferComponent,
  deleteCatalogMedia,
  generateId,
  listAdminOfferComponents,
  listAdminOffers,
  listAdminProductCategories,
  listAdminProducts,
  uploadCatalogMedia,
  upsertAdminOffer,
  upsertAdminOfferComponent,
  type AdminOfferComponentRow,
  type AdminOfferRow,
  type AdminProductCategoryRow,
  type AdminProductRow,
} from '@/services/admin/adminProductService'
import type { OfferComponentPricing, OfferPricingRule } from '@/types/products'
import { formatEgp } from '@/utils/format'
import { cx } from '@/utils/cx'

const ACCEPT = 'image/jpeg,image/png,image/webp'

const PRICING_RULE_LABELS: Record<OfferPricingRule, string> = {
  components: 'مكوّنات',
  custom_bundle: 'سعر باقة مخصص',
}

const COMPONENT_PRICING_LABELS: Record<OfferComponentPricing, string> = {
  full_price: 'سعر كامل',
  percent_off: 'خصم نسبة',
  fixed_off: 'خصم مبلغ',
  free: 'مجاني',
  included_in_bundle: 'ضمن الباقة',
}

const emptyOffer: AdminOfferRow = {
  id: '',
  name: '',
  description: '',
  image_key: '',
  image_alt: '',
  badge_label: 'عرض خاص',
  pricing_rule: 'components',
  custom_bundle_price: null,
  starts_at: null,
  ends_at: null,
  sort_order: 100,
  enabled: true,
}

type ComponentTarget = 'product' | 'category'

function emptyComponent(offerId: string, sortOrder: number): AdminOfferComponentRow {
  return {
    id: '',
    offer_id: offerId,
    product_id: null,
    category_id: null,
    quantity: 1,
    role_label: '',
    component_pricing: 'full_price',
    discount_percent: null,
    discount_amount: null,
    customer_picks: false,
    sort_order: sortOrder,
  }
}

function toDateInput(value: string | null): string {
  if (!value) return ''
  return value.slice(0, 10)
}

function fromDateInput(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  return `${trimmed}T00:00:00.000Z`
}

function Thumb({ imageKey, className = 'size-12' }: { imageKey: string; className?: string }) {
  const src = imageKey ? resolveCakeImage(imageKey) : ''
  return (
    <span className={`block shrink-0 overflow-hidden rounded-lg border border-line bg-cream ${className}`}>
      {src ? <img src={src} alt="" loading="lazy" className="size-full object-cover" /> : null}
    </span>
  )
}

function OfferImageField({
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
    const result = await uploadCatalogMedia(file, 'offers', setProgress)
    setProgress(null)
    onBusyChange?.(false)
    if (result.error || !result.path) {
      setLocalError(result.error ?? 'تعذّر رفع الصورة.')
      return
    }
    onUploaded(result.path)
  }

  return (
    <div className="grid content-start gap-1.5">
      <p id={`${id}-label`} className="text-sm font-semibold text-ink">
        صورة
      </p>
      <div
        className={cx(
          'flex flex-col gap-4 rounded-lg border bg-ivory/60 p-3 sm:flex-row sm:items-center',
          shownError ? 'border-[#9a3434]' : 'border-line',
        )}
      >
        <div className="grid aspect-[4/5] w-28 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-cream">
          {value ? (
            <img src={resolveCakeImage(value)} alt="معاينة صورة العرض" className="size-full object-cover" />
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
        accept={ACCEPT}
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

export function AdminOffersPage() {
  usePageTitle('العروض والباقات | مستكة')
  const [products, setProducts] = useState<AdminProductRow[]>([])
  const [categories, setCategories] = useState<AdminProductCategoryRow[]>([])
  const [components, setComponents] = useState<AdminOfferComponentRow[]>([])
  const [componentsLoading, setComponentsLoading] = useState(false)
  const [componentsError, setComponentsError] = useState('')
  const [componentDraft, setComponentDraft] = useState<AdminOfferComponentRow | null>(null)
  const [componentOriginal, setComponentOriginal] = useState<AdminOfferComponentRow | null>(null)
  const [componentTarget, setComponentTarget] = useState<ComponentTarget>('product')
  const [componentFieldErrors, setComponentFieldErrors] = useState<Partial<Record<string, string>>>({})
  const [componentFormError, setComponentFormError] = useState('')
  const [componentSaving, setComponentSaving] = useState(false)
  const [confirmDeleteOffer, setConfirmDeleteOffer] = useState(false)
  const [deletingOffer, setDeletingOffer] = useState(false)
  const [deleteOfferError, setDeleteOfferError] = useState('')
  const [confirmDeleteComponent, setConfirmDeleteComponent] = useState<AdminOfferComponentRow | null>(null)
  const [deletingComponent, setDeletingComponent] = useState(false)
  const [uploading, setUploading] = useState(false)
  const sessionUploads = useRef(new Set<string>())
  const offerIds = useRef<string[]>([])
  const componentIds = useRef<string[]>([])
  const nextSort = useRef(10)
  const nextComponentSort = useRef(10)

  function resetEditorExtras() {
    setComponents([])
    setComponentsError('')
    setComponentsLoading(false)
    setComponentDraft(null)
    setComponentOriginal(null)
    setComponentTarget('product')
    setComponentFieldErrors({})
    setComponentFormError('')
    setComponentSaving(false)
    setConfirmDeleteOffer(false)
    setDeleteOfferError('')
    setConfirmDeleteComponent(null)
    setUploading(false)
  }

  async function loadComponents(offerId: string) {
    setComponentsLoading(true)
    setComponentsError('')
    const res = await listAdminOfferComponents(offerId)
    setComponentsLoading(false)
    if (res.error) {
      setComponents([])
      setComponentsError(res.error)
      return
    }
    const rows = res.data ?? []
    setComponents(rows)
    componentIds.current = rows.map((row) => row.id)
    nextComponentSort.current = Math.max(0, ...rows.map((row) => row.sort_order), 0) + 10
  }

  const crud = useCatalogCrud<AdminOfferRow>({
    list: async () => {
      const [offersRes, productsRes, categoriesRes] = await Promise.all([
        listAdminOffers(),
        listAdminProducts(),
        listAdminProductCategories(),
      ])
      setProducts(productsRes.data ?? [])
      setCategories(categoriesRes.data ?? [])
      offerIds.current = (offersRes.data ?? []).map((row) => row.id)
      nextSort.current = Math.max(0, ...(offersRes.data ?? []).map((row) => row.sort_order), 0) + 10
      return offersRes
    },
    upsert: upsertAdminOffer,
    prepare: (draft) => ({
      ...draft,
      id: draft.id || generateId(draft.name, 'offer', offerIds.current),
      name: draft.name.trim(),
      description: draft.description.trim(),
      image_alt: draft.image_alt.trim(),
      badge_label: draft.badge_label.trim() || 'عرض خاص',
      custom_bundle_price:
        draft.pricing_rule === 'custom_bundle'
          ? draft.custom_bundle_price == null || Number.isNaN(Number(draft.custom_bundle_price))
            ? null
            : Number(draft.custom_bundle_price)
          : null,
      sort_order: draft.id ? Number(draft.sort_order) || 0 : nextSort.current,
    }),
    validate: (draft) => ({
      name: draft.name.trim() ? undefined : 'أدخلي اسم العرض.',
      image_key: uploading ? 'انتظري حتى يكتمل رفع الصورة.' : undefined,
      custom_bundle_price:
        draft.pricing_rule === 'custom_bundle' &&
        (draft.custom_bundle_price == null || Number.isNaN(Number(draft.custom_bundle_price)))
          ? 'أدخلي سعر الباقة.'
          : undefined,
      ends_at:
        draft.starts_at && draft.ends_at && draft.ends_at < draft.starts_at
          ? 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية.'
          : undefined,
    }),
    onSaved: async (saved, previous) => {
      const stale = [...sessionUploads.current].filter((path) => path !== saved.image_key)
      if (previous?.image_key && previous.image_key !== saved.image_key) stale.push(previous.image_key)
      sessionUploads.current.clear()
      resetEditorExtras()
      await Promise.all(stale.map(deleteCatalogMedia))
    },
    onDiscard: () => {
      const unsaved = [...sessionUploads.current]
      sessionUploads.current.clear()
      resetEditorExtras()
      void Promise.all(unsaved.map(deleteCatalogMedia))
    },
  })
  const filter = useCatalogFilter(crud.rows, (row) => [row.name, row.description, row.badge_label])

  function startNew() {
    resetEditorExtras()
    crud.open({ ...emptyOffer, sort_order: nextSort.current }, null)
  }

  function startEdit(row: AdminOfferRow) {
    resetEditorExtras()
    crud.open({ ...row }, row)
    void loadComponents(row.id)
  }

  async function runDeleteOffer() {
    if (!crud.original) return
    setDeletingOffer(true)
    const result = await deleteAdminOffer(crud.original.id)
    setDeletingOffer(false)
    setConfirmDeleteOffer(false)
    if (!result.ok) {
      setDeleteOfferError(result.message)
      return
    }
    if (crud.original.image_key) void deleteCatalogMedia(crud.original.image_key)
    crud.close()
    await crud.load(true)
  }

  function productName(id: string | null) {
    if (!id) return ''
    return products.find((p) => p.id === id)?.name ?? 'منتج'
  }

  function categoryName(id: string | null) {
    if (!id) return ''
    return categories.find((c) => c.id === id)?.name ?? 'تصنيف'
  }

  function componentSummary(row: AdminOfferComponentRow) {
    const target = row.product_id
      ? productName(row.product_id)
      : row.category_id
        ? `تصنيف: ${categoryName(row.category_id)}`
        : '—'
    const role = row.role_label.trim() ? ` · ${row.role_label.trim()}` : ''
    return `${target}${role} · ×${row.quantity} · ${COMPONENT_PRICING_LABELS[row.component_pricing]}`
  }

  function startNewComponent() {
    if (!crud.original) return
    setComponentFieldErrors({})
    setComponentFormError('')
    setComponentOriginal(null)
    setComponentTarget('product')
    setComponentDraft(emptyComponent(crud.original.id, nextComponentSort.current))
  }

  function startEditComponent(row: AdminOfferComponentRow) {
    setComponentFieldErrors({})
    setComponentFormError('')
    setComponentOriginal(row)
    setComponentTarget(row.category_id && !row.product_id ? 'category' : 'product')
    setComponentDraft({ ...row })
  }

  function updateComponent(patch: Partial<AdminOfferComponentRow>) {
    setComponentDraft((current) => (current ? { ...current, ...patch } : current))
    const keys = Object.keys(patch)
    if (keys.some((k) => componentFieldErrors[k])) {
      setComponentFieldErrors((current) => {
        const next = { ...current }
        for (const k of keys) delete next[k]
        return next
      })
    }
  }

  function setComponentKind(kind: ComponentTarget) {
    setComponentTarget(kind)
    if (kind === 'product') {
      updateComponent({ category_id: null, product_id: componentDraft?.product_id ?? products[0]?.id ?? null })
    } else {
      updateComponent({ product_id: null, category_id: componentDraft?.category_id ?? categories[0]?.id ?? null })
    }
  }

  async function saveComponent() {
    if (!componentDraft || !crud.original) return
    const errors: Partial<Record<string, string>> = {}
    if (componentTarget === 'product' && !componentDraft.product_id) errors.product_id = 'اختاري المنتج.'
    if (componentTarget === 'category' && !componentDraft.category_id) errors.category_id = 'اختاري التصنيف.'
    if (!componentDraft.quantity || componentDraft.quantity < 1) errors.quantity = 'أدخلي كمية صحيحة.'
    if (componentDraft.component_pricing === 'percent_off') {
      if (componentDraft.discount_percent == null || Number.isNaN(Number(componentDraft.discount_percent))) {
        errors.discount_percent = 'أدخلي نسبة الخصم.'
      }
    }
    if (componentDraft.component_pricing === 'fixed_off') {
      if (componentDraft.discount_amount == null || Number.isNaN(Number(componentDraft.discount_amount))) {
        errors.discount_amount = 'أدخلي مبلغ الخصم.'
      }
    }
    if (Object.values(errors).some(Boolean)) {
      setComponentFieldErrors(errors)
      setComponentFormError('راجعي حقول المكوّن قبل الحفظ.')
      return
    }

    const payload: AdminOfferComponentRow = {
      ...componentDraft,
      id: componentDraft.id || generateId(componentDraft.role_label || 'component', 'offer-comp', componentIds.current),
      offer_id: crud.original.id,
      product_id: componentTarget === 'product' ? componentDraft.product_id : null,
      category_id: componentTarget === 'category' ? componentDraft.category_id : null,
      quantity: Number(componentDraft.quantity) || 1,
      role_label: componentDraft.role_label.trim(),
      discount_percent:
        componentDraft.component_pricing === 'percent_off' ? Number(componentDraft.discount_percent) : null,
      discount_amount:
        componentDraft.component_pricing === 'fixed_off' ? Number(componentDraft.discount_amount) : null,
      sort_order: componentDraft.id ? Number(componentDraft.sort_order) || 0 : nextComponentSort.current,
    }

    setComponentSaving(true)
    setComponentFormError('')
    const result = await upsertAdminOfferComponent(payload)
    setComponentSaving(false)
    if (!result.ok) {
      setComponentFormError(result.message)
      return
    }
    setComponentDraft(null)
    setComponentOriginal(null)
    await loadComponents(crud.original.id)
  }

  async function runDeleteComponent() {
    if (!confirmDeleteComponent || !crud.original) return
    setDeletingComponent(true)
    const result = await deleteAdminOfferComponent(confirmDeleteComponent.id)
    setDeletingComponent(false)
    if (!result.ok) {
      setComponentsError(result.message)
      setConfirmDeleteComponent(null)
      return
    }
    if (componentDraft?.id === confirmDeleteComponent.id) {
      setComponentDraft(null)
      setComponentOriginal(null)
    }
    setConfirmDeleteComponent(null)
    await loadComponents(crud.original.id)
  }

  const draft = crud.draft
  const dateRangeLabel = (row: AdminOfferRow) => {
    const start = toDateInput(row.starts_at)
    const end = toDateInput(row.ends_at)
    if (!start && !end) return 'بدون مدة'
    if (start && end) return `${start} → ${end}`
    if (start) return `من ${start}`
    return `حتى ${end}`
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="العروض والباقات"
        description="باقات وعروض خاصة تظهر في الكتالوج، مع مكوّنات وتسعير مرن."
        actions={
          <>
            <AdminButton icon={<IconRefresh size={18} />} loading={crud.refreshing} disabled={crud.loading} onClick={() => void crud.load(true)}>
              تحديث
            </AdminButton>
            <AdminButton variant="primary" icon={<IconPlus size={18} />} disabled={crud.loading} onClick={startNew}>
              إضافة عرض
            </AdminButton>
          </>
        }
      />

      {!crud.loading && !crud.error && crud.rows.length > 0 ? (
        <CatalogToolbar
          id="offers-search"
          placeholder="ابحثي باسم العرض أو الشارة"
          filter={filter}
          total={crud.rows.length}
          visible={filter.filtered.length}
          noun="عرض"
        />
      ) : null}

      <CatalogResults
        loading={crud.loading}
        error={crud.error}
        onRetry={() => void crud.load(true)}
        retrying={crud.refreshing}
        total={crud.rows.length}
        visible={filter.filtered.length}
        emptyTitle="لا توجد عروض"
        emptyDescription="أضيفي أول عرض أو باقة لتظهر في الموقع."
        emptyIcon={<IconSparkles />}
        addLabel="إضافة عرض"
        onAdd={startNew}
        onClearFilters={() => {
          filter.setQuery('')
          filter.setEnabled('all')
        }}
        table={
          <AdminTable
            caption="العروض والباقات"
            head={
              <>
                <Th>العرض</Th>
                <Th>التسعير</Th>
                <Th>المدة</Th>
                <Th className="text-center">ترتيب العرض</Th>
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
                  <div className="flex items-start gap-3">
                    <Thumb imageKey={row.image_key} />
                    <div className="min-w-0">
                      <p className="font-bold">{row.name}</p>
                      {row.badge_label ? (
                        <div className="mt-1">
                          <AdminBadge tone="info">{row.badge_label}</AdminBadge>
                        </div>
                      ) : null}
                      {row.description ? <p className="mt-1 text-xs text-muted line-clamp-2">{row.description}</p> : null}
                    </div>
                  </div>
                </Td>
                <Td>
                  <p className="text-sm">{PRICING_RULE_LABELS[row.pricing_rule]}</p>
                  {row.pricing_rule === 'custom_bundle' && row.custom_bundle_price != null ? (
                    <p className="text-xs text-muted tabular-nums" dir="ltr">
                      {formatEgp(row.custom_bundle_price)}
                    </p>
                  ) : null}
                </Td>
                <Td className="text-xs text-muted">{dateRangeLabel(row)}</Td>
                <Td className="w-28 text-center text-muted tabular-nums">{row.sort_order}</Td>
                <Td className="w-36">
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
          <AdminList label="العروض والباقات">
            {filter.filtered.map((row) => (
              <CatalogListItem
                key={row.id}
                title={row.name}
                subtitle={row.description || undefined}
                media={<Thumb imageKey={row.image_key} className="size-14" />}
                meta={
                  <>
                    {PRICING_RULE_LABELS[row.pricing_rule]}
                    {row.pricing_rule === 'custom_bundle' && row.custom_bundle_price != null
                      ? ` · ${formatEgp(row.custom_bundle_price)}`
                      : ''}
                    {` · ${dateRangeLabel(row)}`}
                  </>
                }
                badges={
                  <>
                    <EnabledBadge enabled={row.enabled} />
                    {row.badge_label ? <AdminBadge tone="info">{row.badge_label}</AdminBadge> : null}
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
        newTitle="عرض جديد"
        editTitle="تعديل العرض"
        disableTitle="إخفاء العرض؟"
        disableBody="سيختفي هذا العرض من الموقع بعد الحفظ. يمكنك إظهاره مرة أخرى لاحقًا."
      >
        {draft ? (
          <div className="grid gap-5">
            <div className="grid gap-4">
              <AdminTextField
                id="offer-name"
                label="الاسم"
                required
                value={draft.name}
                error={crud.fieldErrors.name}
                onChange={(e) => crud.update({ name: e.target.value })}
              />
              <AdminTextAreaField
                id="offer-desc"
                label="الوصف"
                value={draft.description}
                onChange={(e) => crud.update({ description: e.target.value })}
              />
              <AdminTextField
                id="offer-badge"
                label="شارة العرض"
                hint="تظهر كشارة صغيرة على بطاقة العرض. الافتراضي: عرض خاص."
                value={draft.badge_label}
                onChange={(e) => crud.update({ badge_label: e.target.value })}
              />
              <OfferImageField
                id="offer-image"
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
                id="offer-alt"
                label="وصف الصورة"
                hint="اختياري، لتحسين الوصول ومحركات البحث."
                value={draft.image_alt}
                onChange={(e) => crud.update({ image_alt: e.target.value })}
              />
              <AdminSelectField
                id="offer-pricing-rule"
                label="قاعدة التسعير"
                value={draft.pricing_rule}
                onChange={(e) => {
                  const pricing_rule = e.target.value as OfferPricingRule
                  crud.update({
                    pricing_rule,
                    custom_bundle_price: pricing_rule === 'custom_bundle' ? draft.custom_bundle_price : null,
                  })
                }}
              >
                <option value="components">{PRICING_RULE_LABELS.components}</option>
                <option value="custom_bundle">{PRICING_RULE_LABELS.custom_bundle}</option>
              </AdminSelectField>
              {draft.pricing_rule === 'custom_bundle' ? (
                <AdminTextField
                  id="offer-bundle-price"
                  label="سعر الباقة"
                  required
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  dir="ltr"
                  className="text-start"
                  value={draft.custom_bundle_price == null ? '' : String(draft.custom_bundle_price)}
                  error={crud.fieldErrors.custom_bundle_price}
                  onChange={(e) =>
                    crud.update({
                      custom_bundle_price: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminTextField
                  id="offer-starts"
                  label="تاريخ البداية"
                  type="date"
                  dir="ltr"
                  className="text-start"
                  hint="اختياري."
                  value={toDateInput(draft.starts_at)}
                  onChange={(e) => crud.update({ starts_at: fromDateInput(e.target.value) })}
                />
                <AdminTextField
                  id="offer-ends"
                  label="تاريخ النهاية"
                  type="date"
                  dir="ltr"
                  className="text-start"
                  hint="اختياري."
                  value={toDateInput(draft.ends_at)}
                  error={crud.fieldErrors.ends_at}
                  onChange={(e) => crud.update({ ends_at: fromDateInput(e.target.value) })}
                />
              </div>
              <AdminTextField
                id="offer-sort"
                label="ترتيب العرض"
                type="number"
                inputMode="numeric"
                dir="ltr"
                className="text-start"
                hint={SORT_HINT}
                value={String(draft.sort_order)}
                onChange={(e) => crud.update({ sort_order: Number(e.target.value) })}
              />
              <AdminSwitch
                id="offer-enabled"
                label="منشور"
                description="عند إيقافه لن يظهر العرض للعملاء."
                checked={draft.enabled}
                onChange={(enabled) => crud.update({ enabled })}
              />
            </div>

            {crud.original ? (
              <section aria-labelledby="offer-components" className="grid gap-4 border-t border-line pt-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 id="offer-components" className="text-sm font-bold text-ink">
                      مكوّنات العرض
                    </h3>
                    <p className="mt-0.5 text-[0.8125rem] leading-6 text-muted">
                      أضيفي منتجات ثابتة أو تصنيفات يختار منها العميل.
                    </p>
                  </div>
                  <AdminButton
                    size="sm"
                    variant="secondary"
                    icon={<IconPlus size={16} />}
                    disabled={Boolean(componentDraft) || componentsLoading}
                    onClick={startNewComponent}
                  >
                    إضافة مكوّن
                  </AdminButton>
                </div>

                {componentsLoading ? (
                  <p className="text-sm text-muted">جارٍ تحميل المكوّنات...</p>
                ) : null}
                {componentsError ? (
                  <p className="text-[0.8125rem] leading-6 font-semibold text-[#8a2e2e]" role="alert">
                    {componentsError}
                  </p>
                ) : null}

                {!componentsLoading && !componentsError && components.length === 0 && !componentDraft ? (
                  <p className="rounded-lg border border-dashed border-line bg-ivory/50 px-4 py-3 text-sm text-muted">
                    لا توجد مكوّنات بعد. أضيفي منتجًا أو تصنيفًا لهذا العرض.
                  </p>
                ) : null}

                {components.length > 0 ? (
                  <ul className="grid gap-2">
                    {components.map((row) => (
                      <li
                        key={row.id}
                        className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line bg-ivory/40 px-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">{componentSummary(row)}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {row.customer_picks ? <AdminBadge tone="info">العميل يختار</AdminBadge> : null}
                            <AdminBadge tone="neutral">ترتيب {row.sort_order}</AdminBadge>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <AdminButton size="sm" disabled={Boolean(componentDraft)} onClick={() => startEditComponent(row)}>
                            تعديل
                          </AdminButton>
                          <AdminButton
                            size="sm"
                            variant="dangerOutline"
                            disabled={Boolean(componentDraft)}
                            onClick={() => setConfirmDeleteComponent(row)}
                          >
                            حذف
                          </AdminButton>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {componentDraft ? (
                  <div className="grid gap-3 rounded-lg border border-line bg-paper p-4">
                    <p className="text-sm font-bold text-ink">
                      {componentOriginal ? 'تعديل المكوّن' : 'مكوّن جديد'}
                    </p>
                    {componentFormError ? (
                      <p className="text-[0.8125rem] leading-6 font-semibold text-[#8a2e2e]" role="alert">
                        {componentFormError}
                      </p>
                    ) : null}

                    <div className="grid gap-2">
                      <p className="text-sm font-semibold text-ink">نوع المكوّن</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label
                          className={cx(
                            'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold',
                            componentTarget === 'product'
                              ? 'border-rose-deep/40 bg-blush/40'
                              : 'border-line bg-paper hover:border-rose/30',
                          )}
                        >
                          <input
                            type="radio"
                            name="component-target"
                            className="accent-[var(--color-rose-deep,#9a4a5a)]"
                            checked={componentTarget === 'product'}
                            onChange={() => setComponentKind('product')}
                          />
                          منتج ثابت
                        </label>
                        <label
                          className={cx(
                            'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold',
                            componentTarget === 'category'
                              ? 'border-rose-deep/40 bg-blush/40'
                              : 'border-line bg-paper hover:border-rose/30',
                          )}
                        >
                          <input
                            type="radio"
                            name="component-target"
                            className="accent-[var(--color-rose-deep,#9a4a5a)]"
                            checked={componentTarget === 'category'}
                            onChange={() => setComponentKind('category')}
                          />
                          تصنيف للاختيار
                        </label>
                      </div>
                    </div>

                    {componentTarget === 'product' ? (
                      <AdminSelectField
                        id="component-product"
                        label="المنتج"
                        required
                        value={componentDraft.product_id ?? ''}
                        error={componentFieldErrors.product_id}
                        onChange={(e) => updateComponent({ product_id: e.target.value || null, category_id: null })}
                      >
                        <option value="">اختاري منتجًا</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                            {product.enabled ? '' : ' (غير مفعّل)'}
                          </option>
                        ))}
                      </AdminSelectField>
                    ) : (
                      <AdminSelectField
                        id="component-category"
                        label="التصنيف"
                        required
                        value={componentDraft.category_id ?? ''}
                        error={componentFieldErrors.category_id}
                        onChange={(e) => updateComponent({ category_id: e.target.value || null, product_id: null })}
                      >
                        <option value="">اختاري تصنيفًا</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                            {category.enabled ? '' : ' (غير مفعّل)'}
                          </option>
                        ))}
                      </AdminSelectField>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <AdminTextField
                        id="component-qty"
                        label="الكمية"
                        required
                        type="number"
                        inputMode="numeric"
                        min={1}
                        dir="ltr"
                        className="text-start"
                        value={String(componentDraft.quantity)}
                        error={componentFieldErrors.quantity}
                        onChange={(e) => updateComponent({ quantity: Number(e.target.value) })}
                      />
                      <AdminTextField
                        id="component-role"
                        label="تسمية الدور"
                        hint="مثال: هدية، أساسي، اختيار العميل."
                        value={componentDraft.role_label}
                        onChange={(e) => updateComponent({ role_label: e.target.value })}
                      />
                    </div>

                    <AdminSelectField
                      id="component-pricing"
                      label="تسعير المكوّن"
                      value={componentDraft.component_pricing}
                      onChange={(e) => {
                        const component_pricing = e.target.value as OfferComponentPricing
                        updateComponent({
                          component_pricing,
                          discount_percent: component_pricing === 'percent_off' ? componentDraft.discount_percent : null,
                          discount_amount: component_pricing === 'fixed_off' ? componentDraft.discount_amount : null,
                        })
                      }}
                    >
                      {(Object.keys(COMPONENT_PRICING_LABELS) as OfferComponentPricing[]).map((key) => (
                        <option key={key} value={key}>
                          {COMPONENT_PRICING_LABELS[key]}
                        </option>
                      ))}
                    </AdminSelectField>

                    {componentDraft.component_pricing === 'percent_off' ? (
                      <AdminTextField
                        id="component-discount-percent"
                        label="نسبة الخصم"
                        required
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={100}
                        dir="ltr"
                        className="text-start"
                        value={componentDraft.discount_percent == null ? '' : String(componentDraft.discount_percent)}
                        error={componentFieldErrors.discount_percent}
                        onChange={(e) =>
                          updateComponent({
                            discount_percent: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                      />
                    ) : null}

                    {componentDraft.component_pricing === 'fixed_off' ? (
                      <AdminTextField
                        id="component-discount-amount"
                        label="مبلغ الخصم"
                        required
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        dir="ltr"
                        className="text-start"
                        value={componentDraft.discount_amount == null ? '' : String(componentDraft.discount_amount)}
                        error={componentFieldErrors.discount_amount}
                        onChange={(e) =>
                          updateComponent({
                            discount_amount: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                      />
                    ) : null}

                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-line bg-ivory/60 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--color-rose-deep,#9a4a5a)]"
                        checked={componentDraft.customer_picks}
                        onChange={(e) => updateComponent({ customer_picks: e.target.checked })}
                      />
                      <span className="font-semibold text-ink">العميل يختار عند الطلب</span>
                    </label>

                    <AdminTextField
                      id="component-sort"
                      label="ترتيب"
                      type="number"
                      inputMode="numeric"
                      dir="ltr"
                      className="text-start"
                      hint={SORT_HINT}
                      value={String(componentDraft.sort_order)}
                      onChange={(e) => updateComponent({ sort_order: Number(e.target.value) })}
                    />

                    <div className="flex flex-wrap gap-2">
                      <AdminButton
                        size="sm"
                        variant="primary"
                        type="button"
                        loading={componentSaving}
                        onClick={() => void saveComponent()}
                      >
                        حفظ المكوّن
                      </AdminButton>
                      <AdminButton
                        size="sm"
                        type="button"
                        disabled={componentSaving}
                        onClick={() => {
                          setComponentDraft(null)
                          setComponentOriginal(null)
                          setComponentFieldErrors({})
                          setComponentFormError('')
                        }}
                      >
                        إلغاء
                      </AdminButton>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-2 border-t border-line pt-4">
                  <div>
                    <AdminButton size="sm" variant="dangerOutline" onClick={() => setConfirmDeleteOffer(true)}>
                      حذف العرض
                    </AdminButton>
                  </div>
                  {deleteOfferError ? (
                    <p className="text-[0.8125rem] leading-6 font-semibold text-[#8a2e2e]" role="alert">
                      {deleteOfferError}
                    </p>
                  ) : null}
                </div>
              </section>
            ) : (
              <p className="rounded-lg border border-dashed border-line bg-ivory/50 px-4 py-3 text-[0.8125rem] leading-6 text-muted">
                احفظي العرض أولًا لإضافة المكوّنات (منتجات أو تصنيفات).
              </p>
            )}
          </div>
        ) : null}
      </CatalogEditor>

      <ConfirmDialog
        open={confirmDeleteOffer}
        title="حذف العرض؟"
        body="سيتم حذف هذا العرض وجميع مكوّناته نهائيًا."
        confirmLabel="حذف"
        cancelLabel="رجوع"
        danger
        busy={deletingOffer}
        onCancel={() => setConfirmDeleteOffer(false)}
        onConfirm={() => void runDeleteOffer()}
      />

      <ConfirmDialog
        open={Boolean(confirmDeleteComponent)}
        title="حذف المكوّن؟"
        body="سيتم حذف هذا المكوّن من العرض نهائيًا."
        confirmLabel="حذف"
        cancelLabel="رجوع"
        danger
        busy={deletingComponent}
        onCancel={() => setConfirmDeleteComponent(null)}
        onConfirm={() => void runDeleteComponent()}
      />
    </AdminPage>
  )
}
