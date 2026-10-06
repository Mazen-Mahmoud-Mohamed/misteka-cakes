import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { resolveCakeImage } from '@/data/localCatalog'
import { AdminAlert } from '@/components/admin/AdminAlert'
import { AdminBadge, EnabledBadge } from '@/components/admin/AdminBadge'
import { AdminButton } from '@/components/admin/AdminButton'
import { AdminPage, AdminPageHeader } from '@/components/admin/AdminCard'
import {
  AdminCheckboxTile,
  AdminSelect,
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
import { Link, useSearchParams } from 'react-router-dom'
import {
  listAdminCakes,
  listAdminExtras,
  listAdminFillings,
  listAdminSizes,
  type AdminCakeRow,
  type AdminCakeSizeRow,
  type AdminExtraRow,
  type AdminFillingRow,
} from '@/services/admin/adminCatalogService'
import { listAllAdminPriceTiers } from '@/services/admin/adminPricingService'
import {
  deleteAdminProduct,
  getAdminCakeConfig,
  listAdminProductIdsWithOrders,
  upsertAdminCakeProduct,
  type AdminCakeConfig,
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
        <h3 className="text-sm font-bold text-ink">الباكدجات وشرائح السعر</h3>
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
        <AdminAlert tone="info">مقاسات وحشوات وإضافات التورتة تُختار من «إعدادات التورتة» أعلاه.</AdminAlert>
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

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

function OptionGroup({
  legend,
  selected,
  total,
  error,
  children,
}: {
  legend: string
  selected: number
  total: number
  error?: string
  children: ReactNode
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 flex w-full items-center justify-between gap-2 text-sm font-bold text-ink">
        {legend}
        <span className="text-xs font-semibold text-muted">
          {selected} من {total} محدد
        </span>
      </legend>
      {children}
      {error ? (
        <p className="text-[0.8125rem] font-semibold text-[#8a2e2e]" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}

function CakeConfigSection({
  config,
  onChange,
  sizes,
  fillings,
  extras,
  error,
}: {
  config: AdminCakeConfig
  onChange: (patch: Partial<AdminCakeConfig>) => void
  sizes: AdminCakeSizeRow[]
  fillings: AdminFillingRow[]
  extras: AdminExtraRow[]
  error?: string
}) {
  const groups = [
    { group: 'single', label: 'دور واحد', items: sizes.filter((s) => s.pricing_group === 'single') },
    { group: 'two-tier', label: 'دورين', items: sizes.filter((s) => s.pricing_group === 'two-tier') },
  ]
  return (
    <section aria-labelledby="product-cake" className="grid gap-5 border-t border-line pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="product-cake" className="text-sm font-bold text-ink">
          إعدادات التورتة
        </h3>
        <Link to="/admin/sizes" className="text-[0.8125rem] font-semibold text-rose-deep underline-offset-4 hover:underline">
          تعديل المقاسات والأسعار
        </Link>
      </div>
      <p className="text-[0.8125rem] leading-6 text-muted">
        السعر يُحسب تلقائيًا من المقاس الذي يختاره العميل. اختاري المقاسات والحشوات والإضافات المتاحة لهذه التورتة.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminSelectField
          id="cake-structure"
          label="الشكل الافتراضي"
          value={config.pricing_group}
          onChange={(e) => onChange({ pricing_group: e.target.value as AdminCakeConfig['pricing_group'] })}
        >
          <option value="single">دور واحد</option>
          <option value="two-tier">دورين</option>
        </AdminSelectField>
        <AdminTextField
          id="cake-serving-info"
          label="معلومة عن عدد الأفراد"
          hint="اختياري. مثال: مناسبة لـ 10 إلى 15 فرد."
          value={config.serving_info}
          onChange={(e) => onChange({ serving_info: e.target.value })}
        />
      </div>

      <OptionGroup legend="المقاسات" selected={config.available_size_ids.length} total={sizes.length} error={error}>
        {groups.map(({ group, label, items }) =>
          items.length ? (
            <div key={group} className="grid gap-2">
              <p className="text-xs font-semibold text-muted">{label}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {items.map((size) => (
                  <AdminCheckboxTile
                    key={size.id}
                    checked={config.available_size_ids.includes(size.id)}
                    onChange={() => onChange({ available_size_ids: toggleId(config.available_size_ids, size.id) })}
                    hint={size.enabled ? formatEgp(size.price) : 'غير مفعّل'}
                  >
                    {size.label}
                  </AdminCheckboxTile>
                ))}
              </div>
            </div>
          ) : null,
        )}
      </OptionGroup>

      <OptionGroup legend="الحشوات" selected={config.filling_ids.length} total={fillings.length}>
        <div className="grid gap-2 sm:grid-cols-2">
          {fillings.map((item) => (
            <AdminCheckboxTile
              key={item.id}
              checked={config.filling_ids.includes(item.id)}
              onChange={() => onChange({ filling_ids: toggleId(config.filling_ids, item.id) })}
              hint={item.enabled ? undefined : 'غير مفعّل'}
            >
              {item.name}
            </AdminCheckboxTile>
          ))}
        </div>
      </OptionGroup>

      <OptionGroup legend="الإضافات والتصميم" selected={config.extra_ids.length} total={extras.length}>
        <div className="grid gap-2 sm:grid-cols-2">
          {extras.map((item) => (
            <AdminCheckboxTile
              key={item.id}
              checked={config.extra_ids.includes(item.id)}
              onChange={() => onChange({ extra_ids: toggleId(config.extra_ids, item.id) })}
              hint={item.enabled ? undefined : 'غير مفعّل'}
            >
              {item.name}
            </AdminCheckboxTile>
          ))}
        </div>
      </OptionGroup>
    </section>
  )
}

type PriceSummary = { text: string; tone: 'info' | 'pending' | 'danger' }

const CAKES_ROOT = 'cat-cakes'

export function AdminProductsPage() {
  usePageTitle('المنتجات | مستكة')
  const [searchParams, setSearchParams] = useSearchParams()
  const [categories, setCategories] = useState<AdminProductCategoryRow[]>([])
  const [sizes, setSizes] = useState<AdminCakeSizeRow[]>([])
  const [fillings, setFillings] = useState<AdminFillingRow[]>([])
  const [extras, setExtras] = useState<AdminExtraRow[]>([])
  const [cakes, setCakes] = useState<AdminCakeRow[]>([])
  const [tiers, setTiers] = useState<Array<{ product_id: string; price: number; enabled: boolean }>>([])
  const [cakeConfig, setCakeConfig] = useState<AdminCakeConfig | null>(null)
  const [cakeConfigError, setCakeConfigError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [modelFilter, setModelFilter] = useState<ProductOrderingModel | 'all'>('all')
  const [withHistory, setWithHistory] = useState<Set<string> | null>(null)
  const sessionUploads = useRef(new Set<string>())
  const productIds = useRef<string[]>([])
  const nextSort = useRef(10)
  const cakeConfigRef = useRef<AdminCakeConfig | null>(null)
  cakeConfigRef.current = cakeConfig

  const topFilter = searchParams.get('category') ?? 'all'
  const subFilter = searchParams.get('sub') ?? 'all'

  function setCategoryFilter(top: string, sub = 'all') {
    const next = new URLSearchParams(searchParams)
    if (top === 'all') next.delete('category')
    else next.set('category', top)
    if (sub === 'all') next.delete('sub')
    else next.set('sub', sub)
    setSearchParams(next, { replace: true })
  }

  function resetSession() {
    setUploading(false)
    setDeleteError('')
    setCakeConfig(null)
    setCakeConfigError('')
  }

  function defaultCakeConfig(): AdminCakeConfig {
    return {
      pricing_group: 'single',
      serving_info: '',
      available_size_ids: sizes.filter((s) => s.enabled).map((s) => s.id),
      filling_ids: fillings.filter((f) => f.enabled).map((f) => f.id),
      extra_ids: extras.filter((e) => e.enabled).map((e) => e.id),
      base_price: null,
      image_position: 'center',
    }
  }

  const crud = useCatalogCrud<AdminProductRow>({
    list: async () => {
      const [productsRes, categoriesRes, sizesRes, fillingsRes, extrasRes, cakesRes, tiersRes, historyRes] = await Promise.all([
        listAdminProducts(),
        listAdminProductCategories(),
        listAdminSizes(),
        listAdminFillings(),
        listAdminExtras(),
        listAdminCakes(),
        listAllAdminPriceTiers(),
        listAdminProductIdsWithOrders(),
      ])
      setWithHistory(historyRes.data)
      setCategories(categoriesRes.data ?? [])
      setSizes(sizesRes.data ?? [])
      setFillings(fillingsRes.data ?? [])
      setExtras(extrasRes.data ?? [])
      setCakes(cakesRes.data ?? [])
      setTiers(tiersRes.data ?? [])
      productIds.current = [
        ...(productsRes.data ?? []).map((row) => row.id),
        ...(cakesRes.data ?? []).map((row) => row.id),
      ]
      nextSort.current = Math.max(0, ...(productsRes.data ?? []).map((row) => row.sort_order), 0) + 10
      return productsRes
    },
    upsert: (row) =>
      row.ordering_model === 'cake_servings'
        ? upsertAdminCakeProduct(row, cakeConfigRef.current ?? defaultCakeConfig())
        : upsertAdminProduct(row),
    prepare: (draft) => {
      const isCake = Boolean(draft.legacy_cake_id) || draft.ordering_model === 'cake_servings'
      const ordering = (isCake ? 'cake_servings' : draft.ordering_model || 'fixed_item') as ProductOrderingModel
      const pricing = pricingModeFromOrdering(ordering)
      const id = draft.id || generateId(draft.name, 'product', productIds.current)
      return {
        ...draft,
        id,
        name: draft.name.trim(),
        description: draft.description.trim(),
        price_note: draft.price_note.trim(),
        image_alt: draft.image_alt.trim(),
        ordering_model: ordering,
        pricing_mode: pricing,
        legacy_cake_id: isCake ? draft.legacy_cake_id || id : null,
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
      const isCake = Boolean(draft.legacy_cake_id) || draft.ordering_model === 'cake_servings'
      const ordering = (draft.ordering_model || 'fixed_item') as ProductOrderingModel
      const parentId = categories.find((c) => c.id === draft.category_id)?.parent_id
      const errors = {
        name: draft.name.trim() ? undefined : 'أدخلي اسم المنتج.',
        category_id: !draft.category_id
          ? 'اختاري التصنيف.'
          : isCake && parentId !== CAKES_ROOT
            ? 'التورت تحتاج تصنيفًا فرعيًا تحت «التورت».'
            : undefined,
        fixed_price:
          !isCake &&
          ordering === 'fixed_item' &&
          (draft.fixed_price == null || Number.isNaN(Number(draft.fixed_price)))
            ? 'أدخلي السعر الثابت.'
            : undefined,
        image_key: uploading ? 'انتظري حتى يكتمل رفع الصورة.' : undefined,
      }
      const sizeError =
        isCake && cakeConfigRef.current && cakeConfigRef.current.available_size_ids.length === 0
          ? 'اختاري مقاسًا واحدًا على الأقل.'
          : isCake && !cakeConfigRef.current
            ? 'انتظري تحميل إعدادات التورتة.'
            : ''
      setCakeConfigError(sizeError)
      return { ...errors, cake_config: sizeError || undefined }
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

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const topCategories = useMemo(
    () =>
      categories
        .filter((c) => c.parent_id === null && c.kind !== 'offers')
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'ar')),
    [categories],
  )
  const childrenOf = (parentId: string) =>
    categories
      .filter((c) => c.parent_id === parentId && c.kind !== 'offers')
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'ar'))
  const rootOf = (categoryId: string) => {
    const category = byId.get(categoryId)
    return category?.parent_id ?? category?.id ?? ''
  }

  const scopedRows = crud.rows.filter((row) => {
    if (topFilter !== 'all' && rootOf(row.category_id) !== topFilter) return false
    if (subFilter !== 'all' && row.category_id !== subFilter) return false
    if (modelFilter !== 'all' && (row.ordering_model ?? 'fixed_item') !== modelFilter) return false
    return true
  })

  const filter = useCatalogFilter(scopedRows, (row) => [row.name, row.description, categoryPath(categories, row.category_id)])
  function priceSummary(row: AdminProductRow): PriceSummary {
    const ordering = row.ordering_model ?? 'fixed_item'
    if (ordering === 'cake_servings' || row.legacy_cake_id) {
      const cake = cakes.find((c) => c.id === row.legacy_cake_id)
      const prices = sizes
        .filter((s) => s.enabled && (cake?.available_size_ids ?? []).includes(s.id))
        .map((s) => s.price)
      return prices.length
        ? { text: `حسب المقاس · من ${formatEgp(Math.min(...prices))}`, tone: 'info' }
        : { text: 'لا توجد مقاسات متاحة', tone: 'danger' }
    }
    if (ordering === 'quote' || row.pricing_mode === 'quote') return { text: 'اطلب السعر', tone: 'pending' }
    const tierPrices = tiers.filter((t) => t.product_id === row.id && t.enabled).map((t) => t.price)
    if (tierPrices.length) {
      return { text: `من ${formatEgp(Math.min(...tierPrices))} · ${tierPrices.length} سعر`, tone: 'info' }
    }
    if (row.fixed_price != null) {
      return { text: ordering === 'fixed_item' ? formatEgp(row.fixed_price) : `${formatEgp(row.fixed_price)} للقطعة`, tone: 'info' }
    }
    return { text: 'بدون سعر', tone: 'danger' }
  }

  function startNew() {
    const top =
      (topFilter !== 'all' && topCategories.find((c) => c.id === topFilter)) || topCategories.find((c) => c.enabled)
    const sub = top ? childrenOf(top.id).find((c) => (subFilter === 'all' ? c.enabled : c.id === subFilter)) : undefined
    resetSession()
    crud.open({ ...emptyProduct, category_id: sub?.id ?? top?.id ?? '', sort_order: nextSort.current }, null)
  }

  function startEdit(row: AdminProductRow) {
    resetSession()
    crud.open({ ...row }, row)
    if (row.legacy_cake_id) {
      const cakeId = row.legacy_cake_id
      void getAdminCakeConfig(cakeId).then((res) => {
        if (res.error) setCakeConfigError(res.error)
        else setCakeConfig(res.data ?? defaultCakeConfig())
      })
    }
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

  /** null = unknown (history could not be loaded) → treat as protected. */
  function hasHistory(row: AdminProductRow): boolean {
    return Boolean(row.legacy_cake_id) || withHistory === null || withHistory.has(row.id)
  }

  const draft = crud.draft
  const isCakeLinked = Boolean(draft?.legacy_cake_id)
  const isCake = isCakeLinked || draft?.ordering_model === 'cake_servings'
  const isEditing = Boolean(crud.original)
  const draftTop = draft ? rootOf(draft.category_id) : ''
  const draftSubs = draftTop ? childrenOf(draftTop) : []
  const ordering = (draft?.ordering_model ?? 'fixed_item') as ProductOrderingModel
  const orderingChoices = (Object.keys(ORDERING_LABELS) as ProductOrderingModel[]).filter(
    (m) => m !== 'cake_servings' || !isEditing,
  )

  return (
    <AdminPage>
      <AdminPageHeader
        title="المنتجات"
        description="كل منتجات الكتالوج: التورت وغيرها. التصنيف وطريقة البيع والسعر والخيارات من مكان واحد."
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
        <>
          <CatalogToolbar
            id="products-search"
            placeholder="ابحثي باسم المنتج"
            filter={filter}
            total={crud.rows.length}
            visible={filter.filtered.length}
            noun="منتج"
          />
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-xs font-semibold text-muted">
              التصنيف الرئيسي
              <AdminSelect value={topFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">كل التصنيفات</option>
                {topCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.enabled ? '' : ' (مخفي)'}
                  </option>
                ))}
              </AdminSelect>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-muted">
              التصنيف الفرعي
              <AdminSelect
                value={subFilter}
                disabled={topFilter === 'all' || childrenOf(topFilter).length === 0}
                onChange={(e) => setCategoryFilter(topFilter, e.target.value)}
              >
                <option value="all">كل الفرعية</option>
                {topFilter !== 'all'
                  ? childrenOf(topFilter).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.enabled ? '' : ' (مخفي)'}
                      </option>
                    ))
                  : null}
              </AdminSelect>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-muted">
              طريقة البيع
              <AdminSelect value={modelFilter} onChange={(e) => setModelFilter(e.target.value as ProductOrderingModel | 'all')}>
                <option value="all">كل الطرق</option>
                {(Object.keys(ORDERING_LABELS) as ProductOrderingModel[]).map((m) => (
                  <option key={m} value={m}>
                    {ORDERING_LABELS[m]}
                  </option>
                ))}
              </AdminSelect>
            </label>
          </div>
        </>
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
          setModelFilter('all')
          setCategoryFilter('all')
        }}
        table={
          <AdminTable
            caption="المنتجات"
            head={
              <>
                <Th>المنتج</Th>
                <Th>التصنيف</Th>
                <Th className="hidden lg:table-cell">طريقة البيع</Th>
                <Th>السعر</Th>
                <Th>الحالة</Th>
                <Th>
                  <span className="sr-only">إجراء</span>
                </Th>
              </>
            }
          >
            {filter.filtered.map((row) => {
              const price = priceSummary(row)
              return (
                <Tr key={row.id} className={row.enabled ? undefined : 'bg-cream/30'}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Thumb imageKey={row.image_key} />
                      <p className="min-w-0 font-bold">{row.name}</p>
                    </div>
                  </Td>
                  <Td>
                    <AdminBadge tone="info">{categoryPath(categories, row.category_id)}</AdminBadge>
                  </Td>
                  <Td className="hidden text-[0.8125rem] text-muted lg:table-cell">
                    {ORDERING_LABELS[row.ordering_model ?? 'fixed_item']}
                  </Td>
                  <Td className="text-[0.8125rem]">
                    <AdminBadge tone={price.tone}>{price.text}</AdminBadge>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      <EnabledBadge enabled={row.enabled} />
                      {withHistory?.has(row.id) ? <AdminBadge tone="neutral">له طلبات سابقة</AdminBadge> : null}
                    </div>
                  </Td>
                  <Td className="w-px text-end">
                    <EditButton label={`تعديل ${row.name}`} onClick={() => startEdit(row)} />
                  </Td>
                </Tr>
              )
            })}
          </AdminTable>
        }
        list={
          <AdminList label="المنتجات">
            {filter.filtered.map((row) => {
              const price = priceSummary(row)
              return (
                <CatalogListItem
                  key={row.id}
                  media={<Thumb imageKey={row.image_key} className="size-14" />}
                  title={row.name}
                  subtitle={categoryPath(categories, row.category_id)}
                  meta={<span className="text-xs text-muted">{ORDERING_LABELS[row.ordering_model ?? 'fixed_item']}</span>}
                  badges={
                    <>
                      <EnabledBadge enabled={row.enabled} />
                      <AdminBadge tone={price.tone}>{price.text}</AdminBadge>
                      {withHistory?.has(row.id) ? <AdminBadge tone="neutral">له طلبات سابقة</AdminBadge> : null}
                    </>
                  }
                  editLabel={`تعديل ${row.name}`}
                  onEdit={() => startEdit(row)}
                />
              )
            })}
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
            <section aria-labelledby="product-general" className="grid gap-4">
              <h3 id="product-general" className="text-sm font-bold text-ink">
                البيانات العامة
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminTextField
                  id="product-name"
                  label="اسم المنتج"
                  required
                  wrapperClassName="sm:col-span-2"
                  value={draft.name}
                  error={crud.fieldErrors.name}
                  onChange={(e) => crud.update({ name: e.target.value })}
                />
                <AdminSelectField
                  id="product-category"
                  label="التصنيف الرئيسي"
                  required
                  value={draftTop}
                  error={draftSubs.length ? undefined : crud.fieldErrors.category_id}
                  onChange={(e) => {
                    const top = e.target.value
                    const firstSub = childrenOf(top)[0]
                    crud.update({ category_id: firstSub?.id ?? top })
                  }}
                >
                  {!draftTop ? <option value="">اختاري التصنيف</option> : null}
                  {topCategories
                    .filter((c) => !isCake || c.id === CAKES_ROOT)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.enabled ? '' : ' (مخفي)'}
                      </option>
                    ))}
                </AdminSelectField>
                <AdminSelectField
                  id="product-subcategory"
                  label="التصنيف الفرعي"
                  required={isCake}
                  disabled={draftSubs.length === 0}
                  hint={draftSubs.length === 0 ? 'لا توجد تصنيفات فرعية لهذا التصنيف.' : undefined}
                  value={draft.category_id === draftTop ? '' : draft.category_id}
                  error={draftSubs.length ? crud.fieldErrors.category_id : undefined}
                  onChange={(e) => crud.update({ category_id: e.target.value || draftTop })}
                >
                  {!isCake ? <option value="">بدون تصنيف فرعي</option> : null}
                  {isCake && draft.category_id === draftTop ? <option value="">اختاري التصنيف الفرعي</option> : null}
                  {draftSubs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.enabled ? '' : ' (مخفي)'}
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

            <section aria-labelledby="product-selling" className="grid gap-4 border-t border-line pt-5">
              <h3 id="product-selling" className="text-sm font-bold text-ink">
                طريقة البيع
              </h3>
              {isCakeLinked ? (
                <AdminTextField id="product-ordering-ro" label="طريقة البيع" value={ORDERING_LABELS.cake_servings} readOnly />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <AdminSelectField
                    id="product-ordering"
                    label="طريقة البيع"
                    required
                    wrapperClassName="sm:col-span-2"
                    value={ordering}
                    onChange={(e) => {
                      const mode = e.target.value as ProductOrderingModel
                      if (mode === 'cake_servings') {
                        const firstCakeSub = childrenOf(CAKES_ROOT)[0]
                        setCakeConfig(cakeConfig ?? defaultCakeConfig())
                        crud.update({
                          ordering_model: mode,
                          pricing_mode: 'cake_sizes',
                          fixed_price: null,
                          category_id: rootOf(draft.category_id) === CAKES_ROOT ? draft.category_id : (firstCakeSub?.id ?? ''),
                        })
                        return
                      }
                      setCakeConfig(null)
                      setCakeConfigError('')
                      crud.update({
                        ordering_model: mode,
                        pricing_mode: pricingModeFromOrdering(mode),
                        fixed_price: mode === 'quote' ? null : draft.fixed_price,
                      })
                    }}
                  >
                    {orderingChoices.map((m) => (
                      <option key={m} value={m}>
                        {ORDERING_LABELS[m]}
                      </option>
                    ))}
                  </AdminSelectField>
                  {ordering === 'quantity' || ordering === 'custom' ? (
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
                </div>
              )}
            </section>

            <section aria-labelledby="product-pricing" className="grid gap-4 border-t border-line pt-5">
              <h3 id="product-pricing" className="text-sm font-bold text-ink">
                التسعير
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {!isCake && (ordering === 'fixed_item' || ordering === 'quantity' || ordering === 'custom') ? (
                  <AdminTextField
                    id="product-fixed-price"
                    label={ordering === 'fixed_item' ? 'السعر الثابت' : 'سعر القطعة (إن وُجد)'}
                    required={ordering === 'fixed_item'}
                    type="number"
                    inputMode="decimal"
                    dir="ltr"
                    className="text-start"
                    value={draft.fixed_price == null ? '' : String(draft.fixed_price)}
                    error={crud.fieldErrors.fixed_price}
                    onChange={(e) => crud.update({ fixed_price: e.target.value === '' ? null : Number(e.target.value) })}
                  />
                ) : null}
                {isCake ? (
                  <p className="text-[0.8125rem] leading-6 text-muted sm:col-span-2">
                    السعر يُحسب من مقاس التورتة الذي يختاره العميل (من إعدادات التورتة بالأسفل).
                  </p>
                ) : null}
                {ordering === 'quote' ? (
                  <p className="text-[0.8125rem] leading-6 text-muted sm:col-span-2">
                    يظهر للعميل «اطلب السعر»، ويُحدَّد السعر عند تأكيد الطلب.
                  </p>
                ) : null}
                <AdminTextField
                  id="product-price-note"
                  label="ملاحظة السعر"
                  wrapperClassName="sm:col-span-2"
                  hint="تظهر للعميل بجانب معلومات التسعير."
                  value={draft.price_note}
                  onChange={(e) => crud.update({ price_note: e.target.value })}
                />
              </div>
              {!isCake && (ordering === 'quantity' || ordering === 'custom' || ordering === 'weight') && !isEditing ? (
                <AdminAlert tone="info">احفظي المنتج أولًا ثم أضيفي الباكدجات أو الشرائح.</AdminAlert>
              ) : null}
            </section>

            {isEditing && crud.original && !isCake ? (
              <PriceTierSection productId={crud.original.id} orderingModel={ordering} />
            ) : null}

            {isCake ? (
              cakeConfig ? (
                <CakeConfigSection
                  config={cakeConfig}
                  onChange={(patch) => {
                    setCakeConfig({ ...cakeConfig, ...patch })
                    setCakeConfigError('')
                  }}
                  sizes={sizes}
                  fillings={fillings}
                  extras={extras}
                  error={cakeConfigError}
                />
              ) : (
                <section className="grid gap-2 border-t border-line pt-5">
                  <h3 className="text-sm font-bold text-ink">إعدادات التورتة</h3>
                  {cakeConfigError ? (
                    <AdminAlert tone="error">{cakeConfigError}</AdminAlert>
                  ) : (
                    <p className="text-sm text-muted">جاري التحميل…</p>
                  )}
                </section>
              )
            ) : null}

            {isEditing && crud.original ? (
              <OptionLinkSection productId={crud.original.id} isCakeLinked={isCake} />
            ) : null}

            {isEditing && crud.original ? (
              <div className="grid gap-2 border-t border-line pt-4">
                {isCakeLinked ? (
                  <p className="text-[0.8125rem] leading-6 text-muted">
                    التورت لا تُحذف حتى لا تتأثر الطلبات السابقة. أخفيها بدلًا من ذلك.
                  </p>
                ) : hasHistory(crud.original) ? (
                  <AdminAlert tone="info" title="له طلبات سابقة — يمكن إخفاؤه ولا يمكن حذفه">
                    {withHistory === null
                      ? 'تعذّر التحقق من الطلبات السابقة، لذلك الحذف غير متاح الآن. يمكنك إخفاء المنتج من «ظاهر في الموقع».'
                      : 'للحفاظ على سجل الطلبات، أوقفي «ظاهر في الموقع» بالأعلى ثم احفظي لإخفاء المنتج عن العملاء.'}
                  </AdminAlert>
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
        body="الحذف النهائي متاح فقط للمنتجات التي ليس لها طلبات سابقة. سيتم حذف هذا المنتج وأسعاره وخياراته نهائيًا، ولا يمكن التراجع. إن كنتِ تريدين إيقافه مؤقتًا فاختاري الإخفاء بدلًا من ذلك."
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

