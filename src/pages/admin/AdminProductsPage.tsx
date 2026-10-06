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
import { Link } from 'react-router-dom'
import {
  deleteAdminProduct,
  deleteAdminProductOptionLink,
  deleteAdminProductPriceTier,
  deleteCatalogMedia,
  generateId,
  listAdminOptionDefinitions,
  listAdminProductCategories,
  listAdminProductOptionLinks,
  listAdminProductPriceTiers,
  listAdminProducts,
  uploadCatalogMedia,
  upsertAdminProduct,
  upsertAdminProductOptionLink,
  upsertAdminProductPriceTier,
  type AdminOptionDefinitionRow,
  type AdminProductCategoryRow,
  type AdminProductOptionLinkRow,
  type AdminProductPriceTierRow,
  type AdminProductRow,
} from '@/services/admin/adminProductService'
import type { ProductOrderingModel, ProductPriceTierKind, ProductPricingMode } from '@/types/products'
import { formatEgp } from '@/utils/format'
import { cx } from '@/utils/cx'

const ORDERING_LABELS: Record<ProductOrderingModel, string> = {
  cake_servings: 'بعدد الأفراد / مقاس التورت',
  quantity: 'بالكمية / باكدجات',
  fixed_item: 'سعر ثابت للقطعة',
  weight: 'بالوزن',
  quote: 'اطلب السعر',
  custom: 'مخصص',
}

const PRICING_LABELS: Record<ProductPricingMode, string> = {
  cake_sizes: 'حسب مقاس التورت',
  fixed: 'سعر ثابت',
  quote: 'عند التأكيد',
}

const TIER_KIND_LABELS: Record<ProductPriceTierKind, string> = {
  package: 'باكدج ثابت',
  quantity_range: 'شريحة كمية',
  weight: 'وزن',
  unit: 'وحدة',
}

function pricingModeFromOrdering(mode: ProductOrderingModel): ProductPricingMode {
  if (mode === 'cake_servings') return 'cake_sizes'
  if (mode === 'quote') return 'quote'
  return 'fixed'
}

const emptyProduct: AdminProductRow = {
  id: '',
  name: '',
  description: '',
  category_id: '',
  pricing_mode: 'fixed',
  ordering_model: 'fixed_item',
  fixed_price: null,
  price_note: '',
  legacy_cake_id: null,
  qty_min: 1,
  qty_max: 99,
  qty_step: 1,
  image_key: '',
  image_alt: '',
  sort_order: 100,
  enabled: true,
}

const emptyTier = (productId: string, kind: ProductPriceTierKind, sort: number): AdminProductPriceTierRow => ({
  id: '',
  product_id: productId,
  tier_kind: kind,
  label: '',
  package_qty: kind === 'package' ? 6 : null,
  qty_min: kind === 'quantity_range' ? 1 : null,
  qty_max: kind === 'quantity_range' ? 5 : null,
  weight_grams: kind === 'weight' ? 500 : null,
  price: 0,
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

function PriceTierSection({
  productId,
  orderingModel,
}: {
  productId: string
  orderingModel: ProductOrderingModel
}) {
  const [tiers, setTiers] = useState<AdminProductPriceTierRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [draft, setDraft] = useState<AdminProductPriceTierRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busyDelete, setBusyDelete] = useState(false)
  const tierIds = useRef<string[]>([])

  const showPackages = orderingModel === 'quantity' || orderingModel === 'custom'
  const showWeight = orderingModel === 'weight'
  const showRanges = orderingModel === 'quantity' || orderingModel === 'custom'
  const showSection = showPackages || showWeight || showRanges

  async function reload() {
    setLoading(true)
    setError('')
    const res = await listAdminProductPriceTiers(productId)
    if (res.error) {
      setError(res.error)
      setTiers([])
    } else {
      setTiers(res.data ?? [])
      tierIds.current = (res.data ?? []).map((t) => t.id)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!showSection) return
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, showSection])

  async function save() {
    if (!draft) return
    if (!draft.label.trim()) {
      setMessage('أدخلي تسمية الشريحة.')
      return
    }
    if (!(Number(draft.price) >= 0)) {
      setMessage('أدخلي سعرًا صالحًا.')
      return
    }
    setSaving(true)
    setMessage('')
    const payload: AdminProductPriceTierRow = {
      ...draft,
      id: draft.id || generateId(draft.label, 'tier', tierIds.current),
      label: draft.label.trim(),
      price: Number(draft.price) || 0,
      package_qty: draft.tier_kind === 'package' ? Number(draft.package_qty) || null : null,
      qty_min: draft.tier_kind === 'quantity_range' ? Number(draft.qty_min) || null : null,
      qty_max: draft.tier_kind === 'quantity_range' ? Number(draft.qty_max) || null : null,
      weight_grams: draft.tier_kind === 'weight' ? Number(draft.weight_grams) || null : null,
      sort_order: Number(draft.sort_order) || 0,
    }
    const result = await upsertAdminProductPriceTier(payload)
    setSaving(false)
    if (!result.ok) {
      setMessage(result.message)
      return
    }
    setMessage(result.message)
    setDraft(null)
    await reload()
  }

  async function runDelete() {
    if (!confirmId) return
    setBusyDelete(true)
    const result = await deleteAdminProductPriceTier(confirmId)
    setBusyDelete(false)
    setConfirmId(null)
    setMessage(result.message)
    if (result.ok) await reload()
  }

  function startNew(kind: ProductPriceTierKind) {
    const sort = Math.max(0, ...tiers.map((t) => t.sort_order)) + 10
    setDraft(emptyTier(productId, kind, sort))
    setMessage('')
  }

  if (!showSection) return null

  return (
    <section className="grid gap-4 border-t border-line pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-ink">شرائح التسعير</h3>
        <div className="flex flex-wrap gap-2">
          {showPackages ? (
            <AdminButton
              size="sm"
              variant="secondary"
              icon={<IconPlus size={16} />}
              disabled={Boolean(draft)}
              onClick={() => startNew('package')}
            >
              باكدج
            </AdminButton>
          ) : null}
          {showRanges ? (
            <AdminButton
              size="sm"
              variant="secondary"
              icon={<IconPlus size={16} />}
              disabled={Boolean(draft)}
              onClick={() => startNew('quantity_range')}
            >
              شريحة كمية
            </AdminButton>
          ) : null}
          {showWeight ? (
            <AdminButton
              size="sm"
              variant="secondary"
              icon={<IconPlus size={16} />}
              disabled={Boolean(draft)}
              onClick={() => startNew('weight')}
            >
              وزن
            </AdminButton>
          ) : null}
        </div>
      </div>
      <p className="text-[0.8125rem] leading-6 text-muted">
        الباكدجات تظهر للعميل كخيارات جاهزة (مثل 6 / 12 / 24). شرائح الكمية تُسعّر حسب المدى. الأوزان تظهر كخيارات وزن
        فقط.
      </p>
      {loading ? <p className="text-sm text-muted">جارٍ تحميل الشرائح...</p> : null}
      {error ? <AdminAlert tone="error">{error}</AdminAlert> : null}
      {message ? <AdminAlert tone={message.includes('تعذّر') ? 'error' : 'success'}>{message}</AdminAlert> : null}
      {!loading && tiers.length === 0 && !draft ? (
        <p className="text-[0.8125rem] text-muted">لا توجد شرائح بعد. أضيفي باكدجًا أو وزنًا حسب طريقة البيع.</p>
      ) : null}
      <div className="grid gap-2">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-ivory/40 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">
                {tier.label} <span className="font-normal text-muted">· {TIER_KIND_LABELS[tier.tier_kind]}</span>
              </p>
              <p className="text-[0.8125rem] text-muted">
                {formatEgp(tier.price)}
                {tier.package_qty ? ` · ${tier.package_qty} قطعة` : ''}
                {tier.weight_grams ? ` · ${tier.weight_grams} جم` : ''}
                {tier.tier_kind === 'quantity_range' ? ` · من ${tier.qty_min ?? '?'} إلى ${tier.qty_max ?? '∞'}` : ''}
                {!tier.enabled ? ' · مخفي' : ''}
              </p>
            </div>
            <div className="flex gap-1.5">
              <AdminButton size="sm" onClick={() => setDraft({ ...tier })}>
                تعديل
              </AdminButton>
              <AdminButton size="sm" variant="dangerOutline" onClick={() => setConfirmId(tier.id)}>
                حذف
              </AdminButton>
            </div>
          </div>
        ))}
      </div>
      {draft ? (
        <div className="grid gap-3 rounded-lg border border-line bg-ivory/40 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminTextField
              id="tier-label"
              label="التسمية"
              required
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            />
            <AdminTextField
              id="tier-price"
              label="السعر"
              required
              type="number"
              inputMode="decimal"
              dir="ltr"
              className="text-start"
              value={String(draft.price)}
              onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
            />
            {draft.tier_kind === 'package' ? (
              <AdminTextField
                id="tier-pkg"
                label="عدد القطع"
                type="number"
                value={String(draft.package_qty ?? '')}
                onChange={(e) => setDraft({ ...draft, package_qty: Number(e.target.value) || null })}
              />
            ) : null}
            {draft.tier_kind === 'weight' ? (
              <AdminTextField
                id="tier-weight"
                label="الوزن (جرام)"
                type="number"
                value={String(draft.weight_grams ?? '')}
                onChange={(e) => setDraft({ ...draft, weight_grams: Number(e.target.value) || null })}
              />
            ) : null}
            {draft.tier_kind === 'quantity_range' ? (
              <>
                <AdminTextField
                  id="tier-qmin"
                  label="من كمية"
                  type="number"
                  value={String(draft.qty_min ?? '')}
                  onChange={(e) => setDraft({ ...draft, qty_min: Number(e.target.value) || null })}
                />
                <AdminTextField
                  id="tier-qmax"
                  label="إلى كمية"
                  type="number"
                  value={String(draft.qty_max ?? '')}
                  onChange={(e) => setDraft({ ...draft, qty_max: Number(e.target.value) || null })}
                />
              </>
            ) : null}
            <AdminTextField
              id="tier-sort"
              label="الترتيب"
              type="number"
              value={String(draft.sort_order)}
              onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
            />
          </div>
          <AdminSwitch
            id="tier-enabled"
            label="ظاهر للعملاء"
            checked={draft.enabled}
            onChange={(enabled) => setDraft({ ...draft, enabled })}
          />
          <div className="flex flex-wrap gap-2">
            <AdminButton size="sm" variant="primary" loading={saving} onClick={() => void save()}>
              حفظ الشريحة
            </AdminButton>
            <AdminButton size="sm" disabled={saving} onClick={() => setDraft(null)}>
              إلغاء
            </AdminButton>
          </div>
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(confirmId)}
        title="حذف الشريحة؟"
        body="سيتم حذف شريحة التسعير نهائيًا."
        confirmLabel="حذف"
        cancelLabel="رجوع"
        danger
        busy={busyDelete}
        onCancel={() => setConfirmId(null)}
        onConfirm={() => void runDelete()}
      />
    </section>
  )
}

function OptionLinkSection({
  productId,
  isCakeLinked,
}: {
  productId: string
  isCakeLinked: boolean
}) {
  const [links, setLinks] = useState<AdminProductOptionLinkRow[]>([])
  const [library, setLibrary] = useState<AdminOptionDefinitionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [draft, setDraft] = useState<AdminProductOptionLinkRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busyDelete, setBusyDelete] = useState(false)
  const [attachId, setAttachId] = useState('')
  const linkIds = useRef<string[]>([])

  async function reload() {
    setLoading(true)
    setError('')
    const [linksRes, libRes] = await Promise.all([
      listAdminProductOptionLinks(productId),
      listAdminOptionDefinitions(),
    ])
    if (linksRes.error) setError(linksRes.error)
    setLinks(linksRes.data ?? [])
    linkIds.current = (linksRes.data ?? []).map((l) => l.id)
    setLibrary(libRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  if (isCakeLinked) {
    return (
      <section className="grid gap-2 border-t border-line pt-5">
        <h3 className="text-sm font-bold text-ink">الخيارات</h3>
        <AdminAlert tone="info">خيارات مقاسات وحشوات التورت تُدار من صفحة التورت.</AdminAlert>
      </section>
    )
  }

  const linkedDefs = new Set(links.map((l) => l.definition_id))
  const available = library.filter((d) => d.enabled && !linkedDefs.has(d.id))

  async function attach() {
    if (!attachId) {
      setMessage('اختاري خيارًا من المكتبة.')
      return
    }
    setSaving(true)
    setMessage('')
    const sort = Math.max(0, ...links.map((l) => l.sort_order)) + 10
    const row: AdminProductOptionLinkRow = {
      id: generateId(attachId, 'plink', linkIds.current),
      product_id: productId,
      definition_id: attachId,
      required: false,
      sort_order: sort,
      enabled: true,
    }
    const result = await upsertAdminProductOptionLink(row)
    setSaving(false)
    setMessage(result.message)
    if (result.ok) {
      setAttachId('')
      await reload()
    }
  }

  async function saveDraft() {
    if (!draft) return
    setSaving(true)
    setMessage('')
    const result = await upsertAdminProductOptionLink({
      ...draft,
      sort_order: Number(draft.sort_order) || 0,
    })
    setSaving(false)
    setMessage(result.message)
    if (result.ok) {
      setDraft(null)
      await reload()
    }
  }

  async function runDelete() {
    if (!confirmId) return
    setBusyDelete(true)
    const result = await deleteAdminProductOptionLink(confirmId)
    setBusyDelete(false)
    setConfirmId(null)
    setMessage(result.message)
    if (result.ok) await reload()
  }

  function defName(id: string) {
    return library.find((d) => d.id === id)?.name ?? id
  }

  return (
    <section className="grid gap-4 border-t border-line pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-ink">الخيارات (من المكتبة)</h3>
        <Link
          to="/admin/options"
          className="text-[0.8125rem] font-semibold text-rose-deep underline-offset-2 hover:underline"
        >
          إدارة مكتبة الخيارات
        </Link>
      </div>
      <p className="text-[0.8125rem] leading-6 text-muted">
        اربطي خيارات قابلة لإعادة الاستخدام (مثل النكهة أو عجينة السكر) دون تكرار تعريفها لكل منتج.
      </p>
      {loading ? <p className="text-sm text-muted">جارٍ تحميل الخيارات...</p> : null}
      {error ? <AdminAlert tone="error">{error}</AdminAlert> : null}
      {message ? (
        <AdminAlert tone={message.includes('تعذّر') || message.includes('اختاري') ? 'error' : 'success'}>
          {message}
        </AdminAlert>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <AdminSelectField
          id="attach-option"
          label="ربط خيار من المكتبة"
          value={attachId}
          onChange={(e) => setAttachId(e.target.value)}
          wrapperClassName="min-w-[14rem] flex-1"
        >
          <option value="">— اختاري —</option>
          {available.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </AdminSelectField>
        <AdminButton
          size="sm"
          variant="secondary"
          loading={saving && !draft}
          disabled={!attachId}
          onClick={() => void attach()}
        >
          ربط
        </AdminButton>
      </div>
      {!loading && links.length === 0 ? (
        <p className="text-[0.8125rem] text-muted">
          لا توجد خيارات مربوطة. أنشئيها من مكتبة الخيارات ثم اربطيها هنا.
        </p>
      ) : null}
      <div className="grid gap-2">
        {links.map((link) => {
          const editing = draft?.id === link.id
          return (
            <div key={link.id} className="rounded-lg border border-line bg-ivory/40 p-3">
              {editing && draft ? (
                <div className="grid gap-3">
                  <p className="text-sm font-semibold text-ink">{defName(draft.definition_id)}</p>
                  <AdminTextField
                    id="link-sort"
                    label="الترتيب"
                    type="number"
                    value={String(draft.sort_order)}
                    onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
                  />
                  <AdminSwitch
                    id="link-required"
                    label="مطلوب"
                    checked={draft.required}
                    onChange={(required) => setDraft({ ...draft, required })}
                  />
                  <AdminSwitch
                    id="link-enabled"
                    label="مفعّل لهذا المنتج"
                    checked={draft.enabled}
                    onChange={(enabled) => setDraft({ ...draft, enabled })}
                  />
                  <div className="flex flex-wrap gap-2">
                    <AdminButton size="sm" variant="primary" loading={saving} onClick={() => void saveDraft()}>
                      حفظ
                    </AdminButton>
                    <AdminButton size="sm" disabled={saving} onClick={() => setDraft(null)}>
                      إلغاء
                    </AdminButton>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-ink">{defName(link.definition_id)}</p>
                    <p className="text-[0.8125rem] text-muted">
                      {link.required ? 'مطلوب' : 'اختياري'}
                      {!link.enabled ? ' · معطّل' : ''}
                      {' · ترتيب '}
                      {link.sort_order}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <AdminButton size="sm" onClick={() => setDraft({ ...link })}>
                      تعديل
                    </AdminButton>
                    <AdminButton size="sm" variant="dangerOutline" onClick={() => setConfirmId(link.id)}>
                      فك الربط
                    </AdminButton>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <ConfirmDialog
        open={Boolean(confirmId)}
        title="فك ربط الخيار؟"
        body="سيتم إزالة الخيار من هذا المنتج فقط. التعريف يبقى في المكتبة."
        confirmLabel="فك الربط"
        cancelLabel="رجوع"
        danger
        busy={busyDelete}
        onCancel={() => setConfirmId(null)}
        onConfirm={() => void runDelete()}
      />
    </section>
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
      const isCake = Boolean(draft.legacy_cake_id) || draft.ordering_model === 'cake_servings'
      const ordering = (isCake ? 'cake_servings' : draft.ordering_model || 'fixed_item') as ProductOrderingModel
      const pricing = pricingModeFromOrdering(ordering)
      return {
        ...draft,
        id: draft.id || generateId(draft.name, 'product', productIds.current),
        name: draft.name.trim(),
        description: draft.description.trim(),
        price_note: draft.price_note.trim(),
        image_alt: draft.image_alt.trim(),
        ordering_model: ordering,
        pricing_mode: pricing,
        qty_min: ordering === 'quantity' || ordering === 'custom' ? Number(draft.qty_min) || 1 : null,
        qty_max: ordering === 'quantity' || ordering === 'custom' ? Number(draft.qty_max) || 99 : null,
        qty_step: ordering === 'quantity' || ordering === 'custom' ? Number(draft.qty_step) || 1 : null,
        sort_order: draft.id ? Number(draft.sort_order) || 0 : nextSort.current,
        fixed_price:
          isCake || ordering === 'quote' || ordering === 'weight'
            ? isCake
              ? draft.fixed_price
              : null
            : draft.fixed_price == null || Number.isNaN(Number(draft.fixed_price))
              ? null
              : Number(draft.fixed_price),
      }
    },
    validate: (draft) => {
      const isCake = Boolean(draft.legacy_cake_id)
      const ordering = (draft.ordering_model || 'fixed_item') as ProductOrderingModel
      return {
        name: draft.name.trim() ? undefined : 'أدخلي اسم المنتج.',
        category_id: draft.category_id ? undefined : 'اختاري التصنيف.',
        fixed_price:
          !isCake &&
          ordering === 'fixed_item' &&
          (draft.fixed_price == null || Number.isNaN(Number(draft.fixed_price)))
            ? 'أدخلي السعر الثابت.'
            : undefined,
        image_key: uploading ? 'انتظري حتى يكتمل رفع الصورة.' : undefined,
        ordering_model:
          !isCake && ordering === 'cake_servings' ? 'هذا النمط متاح فقط للمنتجات المرتبطة بالتورت.' : undefined,
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
    ORDERING_LABELS[row.ordering_model ?? 'fixed_item'],
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
                  {ORDERING_LABELS[row.ordering_model ?? 'fixed_item']}
                  {(row.ordering_model === 'fixed_item' || row.pricing_mode === 'fixed') &&
                  row.fixed_price != null
                    ? ` · ${formatEgp(row.fixed_price)}`
                    : ''}
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
                    {ORDERING_LABELS[row.ordering_model ?? 'fixed_item']}
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
                    id="product-ordering-ro"
                    label="طريقة البيع"
                    value={ORDERING_LABELS.cake_servings}
                    readOnly
                    wrapperClassName="sm:col-span-2"
                  />
                ) : (
                  <>
                    <AdminSelectField
                      id="product-ordering"
                      label="طريقة البيع"
                      required
                      value={draft.ordering_model ?? 'fixed_item'}
                      onChange={(e) => {
                        const mode = e.target.value as ProductOrderingModel
                        crud.update({
                          ordering_model: mode,
                          pricing_mode:
                            mode === 'quote' ? 'quote' : mode === 'cake_servings' ? 'cake_sizes' : 'fixed',
                          fixed_price: mode === 'quote' ? null : draft.fixed_price,
                        })
                      }}
                    >
                      {(Object.keys(ORDERING_LABELS) as ProductOrderingModel[])
                        .filter((m) => m !== 'cake_servings')
                        .map((m) => (
                          <option key={m} value={m}>
                            {ORDERING_LABELS[m]}
                          </option>
                        ))}
                    </AdminSelectField>
                    {(draft.ordering_model === 'fixed_item' ||
                      draft.ordering_model === 'quantity' ||
                      draft.ordering_model === 'custom' ||
                      !draft.ordering_model) ? (
                      <AdminTextField
                        id="product-fixed-price"
                        label={
                          draft.ordering_model === 'quantity' || draft.ordering_model === 'custom'
                            ? 'سعر القطعة (إن وُجد)'
                            : 'السعر الثابت'
                        }
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
                    {draft.ordering_model === 'quantity' || draft.ordering_model === 'custom' ? (
                      <>
                        <AdminTextField
                          id="product-qty-min"
                          label="أقل كمية"
                          type="number"
                          value={String(draft.qty_min ?? 1)}
                          onChange={(e) => crud.update({ qty_min: Number(e.target.value) || 1 })}
                        />
                        <AdminTextField
                          id="product-qty-max"
                          label="أعلى كمية"
                          type="number"
                          value={String(draft.qty_max ?? 99)}
                          onChange={(e) => crud.update({ qty_max: Number(e.target.value) || 99 })}
                        />
                        <AdminTextField
                          id="product-qty-step"
                          label="خطوة الكمية"
                          type="number"
                          value={String(draft.qty_step ?? 1)}
                          onChange={(e) => crud.update({ qty_step: Number(e.target.value) || 1 })}
                        />
                      </>
                    ) : null}
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
              <>
                <PriceTierSection
                  productId={crud.original.id}
                  orderingModel={(draft.ordering_model ?? 'fixed_item') as ProductOrderingModel}
                />
                <OptionLinkSection productId={crud.original.id} isCakeLinked={isCakeLinked} />
              </>
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
