import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminAlert, AdminToast, SAVE_ERROR, SAVE_SUCCESS, useFlash } from '@/components/admin/AdminAlert'
import { AdminBadge, EnabledBadge } from '@/components/admin/AdminBadge'
import { AdminButton, AdminIconButton } from '@/components/admin/AdminButton'
import { AdminCard, AdminPage, AdminPageHeader } from '@/components/admin/AdminCard'
import { AdminSelectField, AdminSwitch, AdminTextAreaField, AdminTextField } from '@/components/admin/AdminField'
import { AdminModal } from '@/components/admin/AdminModal'
import { AdminEmptyState, AdminErrorState, AdminListSkeleton } from '@/components/admin/AdminStates'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import {
  IconArrowDown,
  IconArrowUp,
  IconExternal,
  IconPencil,
  IconPlus,
  IconReceipt,
  IconRefresh,
  IconTrash,
} from '@/components/admin/icons'
import { usePageTitle } from '@/hooks/usePageTitle'
import { generateId, listAdminSizes, type AdminCakeSizeRow } from '@/services/admin/adminCatalogService'
import {
  deleteAdminPricingItem,
  deleteAdminPricingSection,
  listAdminPricingContent,
  listAllAdminPriceTiers,
  swapAdminPricingOrder,
  upsertAdminPricingItem,
  upsertAdminPricingSection,
  type AdminPricingItemRow,
  type AdminPricingSectionRow,
} from '@/services/admin/adminPricingService'
import { listAdminProducts, type AdminProductRow } from '@/services/admin/adminProductService'
import type { PricingItemKind } from '@/types/pricing'
import { formatEgp } from '@/utils/format'

const KIND_LABELS: Record<PricingItemKind, string> = {
  cake_size: 'مقاس تورتة (سعر تلقائي)',
  product: 'منتج (سعر تلقائي)',
  product_tier: 'باكدج أو شريحة منتج (سعر تلقائي)',
  price: 'سطر سعر يدوي',
  note: 'ملاحظة',
  text: 'نص حر',
}

const KIND_SHORT: Record<PricingItemKind, string> = {
  cake_size: 'مقاس تورتة',
  product: 'منتج',
  product_tier: 'باكدج / شريحة',
  price: 'سعر يدوي',
  note: 'ملاحظة',
  text: 'نص',
}

const LINKED: PricingItemKind[] = ['cake_size', 'product', 'product_tier']

type Tier = { id: string; product_id: string; tier_kind: string; label: string; price: number; enabled: boolean }

type Sources = { sizes: AdminCakeSizeRow[]; products: AdminProductRow[]; tiers: Tier[] }

type Preview = { label: string; price: string; hidden: boolean; missing: boolean }

function previewItem(item: AdminPricingItemRow, src: Sources): Preview {
  const unit = (text: string, fallback = '') => {
    const u = item.unit.trim() || fallback
    return u ? `${text} / ${u}` : text
  }
  switch (item.item_kind) {
    case 'note':
    case 'text':
      return { label: item.label, price: '', hidden: false, missing: false }
    case 'price':
      return {
        label: item.label,
        price: item.price == null ? '' : unit(formatEgp(item.price)),
        hidden: false,
        missing: false,
      }
    case 'cake_size': {
      const size = src.sizes.find((s) => s.id === item.cake_size_id)
      if (!size) return { label: item.label || 'مقاس غير موجود', price: '', hidden: true, missing: true }
      return {
        label: item.label || `${size.label} · ${size.servings_label}`,
        price: unit(formatEgp(size.price)),
        hidden: !size.enabled,
        missing: false,
      }
    }
    case 'product': {
      const p = src.products.find((x) => x.id === item.product_id)
      if (!p) return { label: item.label || 'منتج غير موجود', price: '', hidden: true, missing: true }
      const quote = p.ordering_model === 'quote' || p.pricing_mode === 'quote'
      const tierPrices = src.tiers.filter((t) => t.product_id === p.id && t.enabled).map((t) => t.price)
      const price = quote
        ? 'اطلب السعر'
        : p.fixed_price != null
          ? unit(formatEgp(p.fixed_price), p.ordering_model === 'quantity' ? 'قطعة' : '')
          : tierPrices.length
            ? `من ${formatEgp(Math.min(...tierPrices))}`
            : ''
      return { label: item.label || p.name, price, hidden: !p.enabled || !price, missing: false }
    }
    case 'product_tier': {
      const t = src.tiers.find((x) => x.id === item.price_tier_id)
      const p = t ? src.products.find((x) => x.id === t.product_id) : undefined
      if (!t || !p) return { label: item.label || 'سعر غير موجود', price: '', hidden: true, missing: true }
      return {
        label: item.label || `${p.name} — ${t.label}`,
        price: unit(formatEgp(t.price), t.tier_kind === 'quantity_range' || t.tier_kind === 'unit' ? 'قطعة' : ''),
        hidden: !t.enabled || !p.enabled,
        missing: false,
      }
    }
  }
}

const emptySection = (sort: number): AdminPricingSectionRow => ({
  id: '',
  title: '',
  description: '',
  width: 'full',
  sort_order: sort,
  enabled: true,
})

const emptyItem = (sectionId: string, sort: number): AdminPricingItemRow => ({
  id: '',
  section_id: sectionId,
  item_kind: 'price',
  label: '',
  sublabel: '',
  price: null,
  unit: '',
  note: '',
  cake_size_id: null,
  product_id: null,
  price_tier_id: null,
  sort_order: sort,
  enabled: true,
})

/** Clears fields that do not belong to the chosen item kind so the row passes pricing_items_link_shape. */
function normalizeItem(item: AdminPricingItemRow): AdminPricingItemRow {
  const kind = item.item_kind
  return {
    ...item,
    label: item.label.trim(),
    sublabel: kind === 'note' || kind === 'text' ? '' : item.sublabel.trim(),
    unit: kind === 'note' || kind === 'text' ? '' : item.unit.trim(),
    note: kind === 'note' || kind === 'text' ? '' : item.note.trim(),
    price: kind === 'price' ? item.price : null,
    cake_size_id: kind === 'cake_size' ? item.cake_size_id : null,
    product_id: kind === 'product' ? item.product_id : null,
    price_tier_id: kind === 'product_tier' ? item.price_tier_id : null,
  }
}

function validateItem(item: AdminPricingItemRow): Record<string, string | undefined> {
  const kind = item.item_kind
  return {
    label:
      (kind === 'price' || kind === 'note' || kind === 'text') && !item.label.trim() ? 'هذا الحقل مطلوب.' : undefined,
    price: kind === 'price' && (item.price == null || Number.isNaN(item.price) || item.price < 0) ? 'أدخلي سعرًا صحيحًا.' : undefined,
    cake_size_id: kind === 'cake_size' && !item.cake_size_id ? 'اختاري المقاس.' : undefined,
    product_id: kind === 'product' && !item.product_id ? 'اختاري المنتج.' : undefined,
    price_tier_id: kind === 'product_tier' && !item.price_tier_id ? 'اختاري الباكدج أو الشريحة.' : undefined,
  }
}

export function AdminPricingPage() {
  usePageTitle('الأسعار | مستكة')
  const [sections, setSections] = useState<AdminPricingSectionRow[]>([])
  const [items, setItems] = useState<AdminPricingItemRow[]>([])
  const [sources, setSources] = useState<Sources>({ sizes: [], products: [], tiers: [] })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState(false)
  const { flash, setFlash, clearFlash } = useFlash()

  const [sectionDraft, setSectionDraft] = useState<AdminPricingSectionRow | null>(null)
  const [itemDraft, setItemDraft] = useState<AdminPricingItemRow | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({})
  const [confirm, setConfirm] = useState<{ kind: 'section' | 'item'; id: string; name: string } | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    const [contentRes, sizesRes, productsRes, tiersRes] = await Promise.all([
      listAdminPricingContent(),
      listAdminSizes(),
      listAdminProducts(),
      listAllAdminPriceTiers(),
    ])
    setMissing(Boolean(contentRes.missing))
    setError(contentRes.error ?? '')
    setSections(contentRes.data?.sections ?? [])
    setItems(contentRes.data?.items ?? [])
    setSources({ sizes: sizesRes.data ?? [], products: productsRes.data ?? [], tiers: tiersRes.data ?? [] })
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const ordered = useMemo(() => [...sections].sort((a, b) => a.sort_order - b.sort_order), [sections])
  const itemsBySection = useMemo(() => {
    const map = new Map<string, AdminPricingItemRow[]>()
    for (const item of [...items].sort((a, b) => a.sort_order - b.sort_order)) {
      map.set(item.section_id, [...(map.get(item.section_id) ?? []), item])
    }
    return map
  }, [items])

  async function run(action: () => Promise<{ ok: boolean; message: string }>) {
    setBusy(true)
    const result = await action()
    setBusy(false)
    setFlash({ tone: result.ok ? 'success' : 'error', text: result.ok ? SAVE_SUCCESS : SAVE_ERROR })
    if (result.ok) await load(true)
    return result.ok
  }

  async function saveSection() {
    if (!sectionDraft) return
    if (!sectionDraft.title.trim()) {
      setFieldErrors({ title: 'أدخلي عنوان القسم.' })
      return
    }
    const row = {
      ...sectionDraft,
      id: sectionDraft.id || `ps-${generateId(sectionDraft.title, 'section', sections.map((s) => s.id))}`,
      title: sectionDraft.title.trim(),
      description: sectionDraft.description.trim(),
    }
    if (await run(() => upsertAdminPricingSection(row))) setSectionDraft(null)
  }

  async function saveItem() {
    if (!itemDraft) return
    const errors = validateItem(itemDraft)
    if (Object.values(errors).some(Boolean)) {
      setFieldErrors(errors)
      return
    }
    const row = normalizeItem({
      ...itemDraft,
      id: itemDraft.id || `pi-${generateId(itemDraft.label, 'item', items.map((i) => i.id))}`,
    })
    if (await run(() => upsertAdminPricingItem(row))) setItemDraft(null)
  }

  async function move<T extends { id: string; sort_order: number }>(
    table: 'pricing_sections' | 'pricing_items',
    list: T[],
    index: number,
    delta: -1 | 1,
  ) {
    const other = list[index + delta]
    if (!other) return
    await run(() => swapAdminPricingOrder(table, list[index], other))
  }

  async function runDelete() {
    if (!confirm) return
    const ok = await run(() =>
      confirm.kind === 'section' ? deleteAdminPricingSection(confirm.id) : deleteAdminPricingItem(confirm.id),
    )
    if (ok) {
      setConfirm(null)
      setSectionDraft(null)
      setItemDraft(null)
    }
  }

  const nextSectionSort = Math.max(0, ...sections.map((s) => s.sort_order)) + 10
  const productName = (id: string) => sources.products.find((p) => p.id === id)?.name ?? id

  return (
    <AdminPage>
      <AdminToast flash={flash} onClose={clearFlash} />
      <AdminPageHeader
        title="الأسعار"
        description="محتوى صفحة الأسعار العامة: الأقسام والبنود وترتيبها وظهورها."
        actions={
          <>
            <AdminButton
              icon={<IconExternal size={18} />}
              onClick={() => window.open(`${window.location.origin}${window.location.pathname}#/pricing`, '_blank', 'noopener')}
            >
              عرض الصفحة
            </AdminButton>
            <AdminButton icon={<IconRefresh size={18} />} loading={refreshing} disabled={loading} onClick={() => void load(true)}>
              تحديث
            </AdminButton>
            <AdminButton
              variant="primary"
              icon={<IconPlus size={18} />}
              disabled={loading || missing}
              onClick={() => {
                setFieldErrors({})
                setSectionDraft(emptySection(nextSectionSort))
              }}
            >
              إضافة قسم
            </AdminButton>
          </>
        }
      />

      <AdminAlert tone="info" className="mb-4">
        البنود المرتبطة (مقاس تورتة، منتج، باكدج) تعرض السعر الحالي تلقائيًا، فلا داعي لتعديله هنا. هذه الصفحة للعرض فقط ولا تغيّر
        سعر الطلب الفعلي.
      </AdminAlert>

      {loading ? <AdminListSkeleton rows={4} label="جاري تحميل الأسعار" /> : null}

      {!loading && missing ? (
        <AdminAlert tone="error" title="صفحة الأسعار غير مُفعّلة بعد">
          يلزم تفعيل جداول صفحة الأسعار في قاعدة البيانات قبل التعديل من هنا. الصفحة العامة تعرض حاليًا الترتيب الافتراضي المأخوذ من
          المقاسات والمنتجات.
        </AdminAlert>
      ) : null}

      {!loading && !missing && error ? (
        <AdminErrorState title="تعذّر تحميل الأسعار" description={error} onRetry={() => void load(true)} retrying={refreshing} />
      ) : null}

      {!loading && !missing && !error && ordered.length === 0 ? (
        <AdminEmptyState
          icon={<IconReceipt />}
          title="لا توجد أقسام أسعار"
          description="أضيفي قسمًا ثم بنوده لتظهر في صفحة الأسعار."
          action={
            <AdminButton variant="primary" icon={<IconPlus size={18} />} onClick={() => setSectionDraft(emptySection(10))}>
              إضافة قسم
            </AdminButton>
          }
        />
      ) : null}

      {!loading && !missing && !error ? (
        <div className="grid gap-4">
          {ordered.map((section, sIndex) => {
            const rows = itemsBySection.get(section.id) ?? []
            return (
              <AdminCard
                key={section.id}
                className={section.enabled ? undefined : 'opacity-75'}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {section.title}
                    <EnabledBadge enabled={section.enabled} />
                    <AdminBadge tone="neutral">{section.width === 'half' ? 'نصف العرض' : 'عرض كامل'}</AdminBadge>
                  </span>
                }
                description={section.description || undefined}
                actions={
                  <div className="flex flex-wrap items-center">
                    <AdminIconButton
                      label={`نقل ${section.title} لأعلى`}
                      disabled={busy || sIndex === 0}
                      onClick={() => void move('pricing_sections', ordered, sIndex, -1)}
                    >
                      <IconArrowUp size={18} />
                    </AdminIconButton>
                    <AdminIconButton
                      label={`نقل ${section.title} لأسفل`}
                      disabled={busy || sIndex === ordered.length - 1}
                      onClick={() => void move('pricing_sections', ordered, sIndex, 1)}
                    >
                      <IconArrowDown size={18} />
                    </AdminIconButton>
                    <AdminIconButton
                      label={`تعديل ${section.title}`}
                      onClick={() => {
                        setFieldErrors({})
                        setSectionDraft({ ...section })
                      }}
                    >
                      <IconPencil size={18} />
                    </AdminIconButton>
                  </div>
                }
                bodyClassName="p-0"
              >
                {rows.length ? (
                  <ul className="divide-y divide-line/80">
                    {rows.map((item, iIndex) => {
                      const preview = previewItem(item, sources)
                      return (
                        <li
                          key={item.id}
                          className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                              <span className="min-w-0 break-words">{preview.label}</span>
                              {preview.price ? <span className="text-rose-deep">{preview.price}</span> : null}
                            </p>
                            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                              <AdminBadge tone="info">{KIND_SHORT[item.item_kind]}</AdminBadge>
                              {!item.enabled ? <EnabledBadge enabled={false} /> : null}
                              {preview.missing ? (
                                <AdminBadge tone="danger">العنصر المرتبط غير موجود</AdminBadge>
                              ) : preview.hidden ? (
                                <AdminBadge tone="pending">لن يظهر: العنصر المرتبط مخفي</AdminBadge>
                              ) : null}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center self-end sm:self-auto">
                            <AdminIconButton
                              label="نقل لأعلى"
                              disabled={busy || iIndex === 0}
                              onClick={() => void move('pricing_items', rows, iIndex, -1)}
                            >
                              <IconArrowUp size={18} />
                            </AdminIconButton>
                            <AdminIconButton
                              label="نقل لأسفل"
                              disabled={busy || iIndex === rows.length - 1}
                              onClick={() => void move('pricing_items', rows, iIndex, 1)}
                            >
                              <IconArrowDown size={18} />
                            </AdminIconButton>
                            <AdminIconButton
                              label={`تعديل ${preview.label}`}
                              onClick={() => {
                                setFieldErrors({})
                                setItemDraft({ ...item })
                              }}
                            >
                              <IconPencil size={18} />
                            </AdminIconButton>
                            <AdminIconButton
                              label={`حذف ${preview.label}`}
                              className="text-rose-deep"
                              onClick={() => setConfirm({ kind: 'item', id: item.id, name: preview.label })}
                            >
                              <IconTrash size={18} />
                            </AdminIconButton>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="px-4 py-4 text-sm text-muted sm:px-5">لا توجد بنود في هذا القسم بعد.</p>
                )}
                <div className="border-t border-line/80 px-4 py-3 sm:px-5">
                  <AdminButton
                    size="sm"
                    icon={<IconPlus size={16} />}
                    onClick={() => {
                      setFieldErrors({})
                      setItemDraft(emptyItem(section.id, Math.max(0, ...rows.map((r) => r.sort_order)) + 10))
                    }}
                  >
                    إضافة بند
                  </AdminButton>
                </div>
              </AdminCard>
            )
          })}
        </div>
      ) : null}

      <AdminModal
        open={Boolean(sectionDraft)}
        title={sectionDraft?.id ? 'تعديل القسم' : 'قسم جديد'}
        onClose={() => !busy && setSectionDraft(null)}
        busy={busy}
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            {sectionDraft?.id ? (
              <AdminButton
                variant="dangerOutline"
                disabled={busy}
                onClick={() => setConfirm({ kind: 'section', id: sectionDraft.id, name: sectionDraft.title })}
              >
                حذف القسم
              </AdminButton>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <AdminButton disabled={busy} onClick={() => setSectionDraft(null)}>
                إلغاء
              </AdminButton>
              <AdminButton variant="primary" loading={busy} onClick={() => void saveSection()}>
                حفظ
              </AdminButton>
            </div>
          </div>
        }
      >
        {sectionDraft ? (
          <div className="grid gap-4">
            <AdminTextField
              id="pricing-section-title"
              label="عنوان القسم"
              required
              value={sectionDraft.title}
              error={fieldErrors.title}
              onChange={(e) => setSectionDraft({ ...sectionDraft, title: e.target.value })}
            />
            <AdminTextAreaField
              id="pricing-section-desc"
              label="وصف مختصر"
              hint="اختياري. يظهر أسفل العنوان."
              value={sectionDraft.description}
              onChange={(e) => setSectionDraft({ ...sectionDraft, description: e.target.value })}
            />
            <AdminSelectField
              id="pricing-section-width"
              label="عرض القسم على الشاشات الكبيرة"
              hint="قسمان متتاليان بنصف العرض يظهران جنبًا إلى جنب."
              value={sectionDraft.width}
              onChange={(e) => setSectionDraft({ ...sectionDraft, width: e.target.value as 'full' | 'half' })}
            >
              <option value="full">عرض كامل</option>
              <option value="half">نصف العرض</option>
            </AdminSelectField>
            <AdminSwitch
              id="pricing-section-enabled"
              label="ظاهر في صفحة الأسعار"
              checked={sectionDraft.enabled}
              onChange={(enabled) => setSectionDraft({ ...sectionDraft, enabled })}
            />
          </div>
        ) : null}
      </AdminModal>

      <AdminModal
        open={Boolean(itemDraft)}
        title={itemDraft?.id ? 'تعديل البند' : 'بند جديد'}
        onClose={() => !busy && setItemDraft(null)}
        busy={busy}
        footer={
          <div className="flex w-full justify-end gap-2">
            <AdminButton disabled={busy} onClick={() => setItemDraft(null)}>
              إلغاء
            </AdminButton>
            <AdminButton variant="primary" loading={busy} onClick={() => void saveItem()}>
              حفظ
            </AdminButton>
          </div>
        }
      >
        {itemDraft ? (
          <div className="grid gap-4">
            <AdminSelectField
              id="pricing-item-kind"
              label="نوع البند"
              value={itemDraft.item_kind}
              onChange={(e) => {
                setFieldErrors({})
                setItemDraft({ ...itemDraft, item_kind: e.target.value as PricingItemKind })
              }}
            >
              {(Object.keys(KIND_LABELS) as PricingItemKind[]).map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_LABELS[kind]}
                </option>
              ))}
            </AdminSelectField>

            {itemDraft.item_kind === 'cake_size' ? (
              <AdminSelectField
                id="pricing-item-size"
                label="المقاس"
                required
                value={itemDraft.cake_size_id ?? ''}
                error={fieldErrors.cake_size_id}
                onChange={(e) => setItemDraft({ ...itemDraft, cake_size_id: e.target.value || null })}
              >
                <option value="">اختاري المقاس</option>
                {sources.sizes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.pricing_group === 'two-tier' ? 'دورين' : 'دور واحد'} · {s.label} · {formatEgp(s.price)}
                    {s.enabled ? '' : ' (مخفي)'}
                  </option>
                ))}
              </AdminSelectField>
            ) : null}

            {itemDraft.item_kind === 'product' ? (
              <AdminSelectField
                id="pricing-item-product"
                label="المنتج"
                required
                value={itemDraft.product_id ?? ''}
                error={fieldErrors.product_id}
                onChange={(e) => setItemDraft({ ...itemDraft, product_id: e.target.value || null })}
              >
                <option value="">اختاري المنتج</option>
                {sources.products
                  .filter((p) => p.ordering_model !== 'cake_servings')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.enabled ? '' : ' (مخفي)'}
                    </option>
                  ))}
              </AdminSelectField>
            ) : null}

            {itemDraft.item_kind === 'product_tier' ? (
              <AdminSelectField
                id="pricing-item-tier"
                label="الباكدج أو الشريحة"
                required
                value={itemDraft.price_tier_id ?? ''}
                error={fieldErrors.price_tier_id}
                onChange={(e) => setItemDraft({ ...itemDraft, price_tier_id: e.target.value || null })}
              >
                <option value="">اختاري</option>
                {sources.tiers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {productName(t.product_id)} — {t.label} · {formatEgp(t.price)}
                    {t.enabled ? '' : ' (مخفي)'}
                  </option>
                ))}
              </AdminSelectField>
            ) : null}

            {itemDraft.item_kind === 'text' ? (
              <AdminTextAreaField
                id="pricing-item-text"
                label="النص"
                required
                value={itemDraft.label}
                error={fieldErrors.label}
                onChange={(e) => setItemDraft({ ...itemDraft, label: e.target.value })}
              />
            ) : (
              <AdminTextField
                id="pricing-item-label"
                label={
                  itemDraft.item_kind === 'note'
                    ? 'نص الملاحظة'
                    : LINKED.includes(itemDraft.item_kind)
                      ? 'اسم مخصص (اختياري)'
                      : 'الاسم'
                }
                hint={LINKED.includes(itemDraft.item_kind) ? 'اتركيه فارغًا لاستخدام الاسم الحالي تلقائيًا.' : undefined}
                required={!LINKED.includes(itemDraft.item_kind)}
                value={itemDraft.label}
                error={fieldErrors.label}
                onChange={(e) => setItemDraft({ ...itemDraft, label: e.target.value })}
              />
            )}

            {itemDraft.item_kind !== 'note' && itemDraft.item_kind !== 'text' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminTextField
                  id="pricing-item-sublabel"
                  label="سطر توضيحي"
                  hint="مثال: يكفي 10 أفراد."
                  value={itemDraft.sublabel}
                  onChange={(e) => setItemDraft({ ...itemDraft, sublabel: e.target.value })}
                />
                <AdminTextField
                  id="pricing-item-unit"
                  label="الوحدة"
                  hint="مثال: قطعة، كيلو. اختياري."
                  value={itemDraft.unit}
                  onChange={(e) => setItemDraft({ ...itemDraft, unit: e.target.value })}
                />
                {itemDraft.item_kind === 'price' ? (
                  <AdminTextField
                    id="pricing-item-price"
                    label="السعر (ج.م)"
                    required
                    type="number"
                    inputMode="decimal"
                    min={0}
                    dir="ltr"
                    className="text-start"
                    value={itemDraft.price == null ? '' : String(itemDraft.price)}
                    error={fieldErrors.price}
                    onChange={(e) =>
                      setItemDraft({ ...itemDraft, price: e.target.value === '' ? null : Number(e.target.value) })
                    }
                  />
                ) : null}
                <AdminTextField
                  id="pricing-item-note"
                  label="ملاحظة صغيرة"
                  wrapperClassName={itemDraft.item_kind === 'price' ? undefined : 'sm:col-span-2'}
                  value={itemDraft.note}
                  onChange={(e) => setItemDraft({ ...itemDraft, note: e.target.value })}
                />
              </div>
            ) : null}

            {LINKED.includes(itemDraft.item_kind) ? (
              (() => {
                const preview = previewItem(normalizeItem(itemDraft), sources)
                return (
                  <AdminAlert tone={preview.hidden ? 'error' : 'info'} title="كما سيظهر للعملاء">
                    {preview.missing
                      ? 'اختاري العنصر المرتبط.'
                      : `${preview.label}${preview.price ? ` — ${preview.price}` : ''}${preview.hidden ? ' (مخفي حاليًا فلن يظهر)' : ''}`}
                  </AdminAlert>
                )
              })()
            ) : null}

            <AdminSwitch
              id="pricing-item-enabled"
              label="ظاهر في صفحة الأسعار"
              checked={itemDraft.enabled}
              onChange={(enabled) => setItemDraft({ ...itemDraft, enabled })}
            />

            {itemDraft.id ? (
              <div>
                <AdminButton
                  size="sm"
                  variant="dangerOutline"
                  disabled={busy}
                  onClick={() => setConfirm({ kind: 'item', id: itemDraft.id, name: itemDraft.label || 'هذا البند' })}
                >
                  حذف البند
                </AdminButton>
              </div>
            ) : null}
          </div>
        ) : null}
      </AdminModal>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.kind === 'section' ? 'حذف القسم؟' : 'حذف البند؟'}
        body={
          confirm?.kind === 'section'
            ? `سيتم حذف قسم "${confirm.name}" وكل بنوده من صفحة الأسعار. المنتجات والمقاسات نفسها لا تتأثر.`
            : 'سيتم حذف هذا البند من صفحة الأسعار فقط. المنتج أو المقاس نفسه لا يتأثر.'
        }
        confirmLabel="حذف"
        cancelLabel="رجوع"
        danger
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void runDelete()}
      />
    </AdminPage>
  )
}
