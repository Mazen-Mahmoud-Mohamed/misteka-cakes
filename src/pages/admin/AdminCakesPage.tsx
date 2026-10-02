import { useRef, useState, type ReactNode } from 'react'
import { resolveCakeImage } from '@/data/localCatalog'
import { AdminBadge, EnabledBadge } from '@/components/admin/AdminBadge'
import { AdminButton } from '@/components/admin/AdminButton'
import { AdminPage, AdminPageHeader } from '@/components/admin/AdminCard'
import {
  AdminCheckboxTile,
  AdminSelectField,
  AdminSwitch,
  AdminTextAreaField,
  AdminTextField,
} from '@/components/admin/AdminField'
import { AdminList, AdminTable, Td, Th, Tr } from '@/components/admin/AdminTable'
import { CakeImageField } from '@/components/admin/CakeImageField'
import {
  CatalogEditor,
  CatalogListItem,
  CatalogResults,
  CatalogToolbar,
  EditButton,
  useCatalogCrud,
  useCatalogFilter,
} from '@/components/admin/catalog'
import { IconCake, IconPlus, IconRefresh } from '@/components/admin/icons'
import { usePageTitle } from '@/hooks/usePageTitle'
import {
  deleteCakeImage,
  generateId,
  listAdminCakes,
  listAdminCategories,
  listAdminExtras,
  listAdminFillings,
  listAdminSizes,
  upsertAdminCake,
  upsertAdminCategory,
  type AdminCakeRow,
  type AdminCakeSizeRow,
  type AdminCategoryRow,
  type AdminExtraRow,
  type AdminFillingRow,
} from '@/services/admin/adminCatalogService'

const NEW_CATEGORY = '__new__'

const empty: AdminCakeRow = {
  id: '',
  name: '',
  description: '',
  image_key: '',
  image_alt: '',
  image_position: 'center',
  category: '',
  pricing_group: 'single',
  base_price: null,
  price_note: '',
  serving_info: '',
  available_size_ids: [],
  filling_ids: [],
  extra_ids: [],
  sort_order: 100,
  enabled: true,
}

function toggleId(list: string[] | null, id: string): string[] {
  const current = list ?? []
  return current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
}

function Thumb({ imageKey, className = 'size-12' }: { imageKey: string; className?: string }) {
  const src = imageKey ? resolveCakeImage(imageKey) : ''
  return (
    <span className={`block shrink-0 overflow-hidden rounded-lg border border-line bg-cream ${className}`}>
      {src ? <img src={src} alt="" loading="lazy" className="size-full object-cover" /> : null}
    </span>
  )
}

function OptionGroup({
  legend,
  selected,
  total,
  children,
}: {
  legend: string
  selected: number
  total: number
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
    </fieldset>
  )
}

export function AdminCakesPage() {
  usePageTitle('التورت | مستكة')
  const [sizes, setSizes] = useState<AdminCakeSizeRow[]>([])
  const [fillings, setFillings] = useState<AdminFillingRow[]>([])
  const [extras, setExtras] = useState<AdminExtraRow[]>([])
  const [categories, setCategories] = useState<AdminCategoryRow[]>([])
  const [uploading, setUploading] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState<string | null>(null)
  const [newCategoryError, setNewCategoryError] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const sessionUploads = useRef(new Set<string>())
  const cakeIds = useRef<string[]>([])
  const nextSort = useRef(10)

  function resetSession() {
    setNewCategoryName(null)
    setNewCategoryError('')
    setUploading(false)
  }

  const crud = useCatalogCrud<AdminCakeRow>({
    list: async () => {
      const [cakesRes, sizesRes, fillingsRes, extrasRes, categoriesRes] = await Promise.all([
        listAdminCakes(),
        listAdminSizes(),
        listAdminFillings(),
        listAdminExtras(),
        listAdminCategories(),
      ])
      setSizes(sizesRes.data ?? [])
      setFillings(fillingsRes.data ?? [])
      setExtras(extrasRes.data ?? [])
      setCategories(categoriesRes.data ?? [])
      cakeIds.current = (cakesRes.data ?? []).map((row) => row.id)
      nextSort.current = Math.max(0, ...(cakesRes.data ?? []).map((row) => row.sort_order)) + 10
      return cakesRes
    },
    upsert: upsertAdminCake,
    prepare: (draft) => ({
      ...draft,
      id: draft.id || generateId(draft.name, 'cake', cakeIds.current),
      name: draft.name.trim(),
      sort_order: draft.id ? Number(draft.sort_order) || 0 : nextSort.current,
      base_price: draft.base_price == null || Number.isNaN(Number(draft.base_price)) ? null : Number(draft.base_price),
    }),
    validate: (draft) => ({
      name: draft.name.trim() ? undefined : 'أدخلي اسم التورتة.',
      category: draft.category && draft.category !== NEW_CATEGORY ? undefined : 'اختاري التصنيف.',
      image_key: uploading ? 'انتظري حتى يكتمل رفع الصورة.' : draft.image_key ? undefined : 'أضيفي صورة للتورتة.',
    }),
    onSaved: async (saved, previous) => {
      const stale = [...sessionUploads.current].filter((path) => path !== saved.image_key)
      if (previous?.image_key && previous.image_key !== saved.image_key) stale.push(previous.image_key)
      sessionUploads.current.clear()
      resetSession()
      await Promise.all(stale.map(deleteCakeImage))
    },
    onDiscard: () => {
      const unsaved = [...sessionUploads.current]
      sessionUploads.current.clear()
      resetSession()
      void Promise.all(unsaved.map(deleteCakeImage))
    },
  })
  const filter = useCatalogFilter(crud.rows, (row) => [row.name, row.description, categoryName(row.category)])

  function categoryName(id: string) {
    return categories.find((c) => c.id === id)?.name ?? id
  }

  function startNew() {
    crud.open(
      {
        ...empty,
        category: categories.find((c) => c.enabled)?.id ?? '',
        available_size_ids: sizes.filter((s) => s.enabled).map((s) => s.id),
        filling_ids: fillings.filter((f) => f.enabled).map((f) => f.id),
        extra_ids: extras.filter((e) => e.enabled).map((e) => e.id),
      },
      null,
    )
  }

  function startEdit(row: AdminCakeRow) {
    crud.open(
      {
        ...row,
        available_size_ids: row.available_size_ids ?? [],
        filling_ids: row.filling_ids ?? [],
        extra_ids: row.extra_ids ?? [],
      },
      row,
    )
  }

  async function addCategory() {
    const name = (newCategoryName ?? '').trim()
    if (!name) {
      setNewCategoryError('أدخلي اسم التصنيف.')
      return
    }
    const existing = categories.find((c) => c.name.trim() === name)
    if (existing) {
      crud.update({ category: existing.id })
      setNewCategoryName(null)
      return
    }
    setAddingCategory(true)
    const row: AdminCategoryRow = {
      id: generateId(name, 'category', categories.map((c) => c.id)),
      name,
      description: '',
      sort_order: Math.max(0, ...categories.map((c) => c.sort_order)) + 10,
      enabled: true,
    }
    const result = await upsertAdminCategory(row)
    setAddingCategory(false)
    if (!result.ok) {
      setNewCategoryError(result.message)
      return
    }
    setCategories((current) => [...current, row])
    crud.update({ category: row.id })
    setNewCategoryName(null)
    setNewCategoryError('')
  }

  function optionsSummary(row: AdminCakeRow) {
    return `${(row.available_size_ids ?? []).length} مقاس · ${(row.filling_ids ?? []).length} حشوة · ${(row.extra_ids ?? []).length} إضافة`
  }

  const draft = crud.draft
  const sizeGroups = (['single', 'two-tier'] as const).map((group) => ({
    group,
    label: group === 'single' ? 'طبقة واحدة' : 'طابقين',
    items: sizes.filter((s) => s.pricing_group === group),
  }))

  return (
    <AdminPage>
      <AdminPageHeader
        title="التورت"
        description="تصاميم الكتالوج المتاحة للعملاء والخيارات المسموحة لكل تصميم."
        actions={
          <>
            <AdminButton icon={<IconRefresh size={18} />} loading={crud.refreshing} disabled={crud.loading} onClick={() => void crud.load(true)}>
              تحديث
            </AdminButton>
            <AdminButton variant="primary" icon={<IconPlus size={18} />} disabled={crud.loading} onClick={startNew}>
              إضافة تورتة
            </AdminButton>
          </>
        }
      />

      {!crud.loading && !crud.error && crud.rows.length > 0 ? (
        <CatalogToolbar
          id="cakes-search"
          placeholder="ابحثي باسم التورتة أو التصنيف"
          filter={filter}
          total={crud.rows.length}
          visible={filter.filtered.length}
          noun="تورتة"
        />
      ) : null}

      <CatalogResults
        loading={crud.loading}
        error={crud.error}
        onRetry={() => void crud.load(true)}
        retrying={crud.refreshing}
        total={crud.rows.length}
        visible={filter.filtered.length}
        emptyTitle="لا توجد تورت"
        emptyDescription="أضيفي أول تصميم ليظهر في كتالوج العملاء."
        emptyIcon={<IconCake />}
        addLabel="إضافة تورتة"
        onAdd={startNew}
        onClearFilters={() => {
          filter.setQuery('')
          filter.setEnabled('all')
        }}
        table={
          <AdminTable
            caption="التورت"
            head={
              <>
                <Th>التورتة</Th>
                <Th>التصنيف</Th>
                <Th className="hidden xl:table-cell">الخيارات المتاحة</Th>
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
                    <p className="min-w-0 font-bold">{row.name}</p>
                  </div>
                </Td>
                <Td>
                  <AdminBadge tone="info">{categoryName(row.category)}</AdminBadge>
                </Td>
                <Td className="hidden text-[0.8125rem] text-muted xl:table-cell">{optionsSummary(row)}</Td>
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
          <AdminList label="التورت">
            {filter.filtered.map((row) => (
              <CatalogListItem
                key={row.id}
                media={<Thumb imageKey={row.image_key} className="size-14" />}
                title={row.name}
                meta={<span className="text-xs text-muted">{optionsSummary(row)}</span>}
                badges={
                  <>
                    <EnabledBadge enabled={row.enabled} />
                    <AdminBadge tone="info">{categoryName(row.category)}</AdminBadge>
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
        newTitle="تورتة جديدة"
        editTitle="تعديل التورتة"
        disableTitle="إخفاء التورتة؟"
        disableBody="لن تظهر هذه التورتة للعملاء بعد الحفظ. الطلبات السابقة لا تتأثر، ويمكنك إظهارها مرة أخرى لاحقًا."
      >
        {draft ? (
          <>
            <section aria-labelledby="cake-basic" className="grid gap-4">
              <h3 id="cake-basic" className="text-sm font-bold text-ink">
                البيانات الأساسية
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminTextField
                  id="cake-name"
                  label="اسم التورتة"
                  required
                  value={draft.name}
                  error={crud.fieldErrors.name}
                  onChange={(e) => crud.update({ name: e.target.value })}
                />
                <div className="grid content-start gap-2">
                  <AdminSelectField
                    id="cake-category"
                    label="التصنيف"
                    required
                    value={newCategoryName !== null ? NEW_CATEGORY : draft.category}
                    error={crud.fieldErrors.category}
                    onChange={(e) => {
                      if (e.target.value === NEW_CATEGORY) {
                        setNewCategoryName('')
                        setNewCategoryError('')
                        return
                      }
                      setNewCategoryName(null)
                      crud.update({ category: e.target.value })
                    }}
                  >
                    {!draft.category ? <option value="">اختاري التصنيف</option> : null}
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.enabled ? c.name : `${c.name} (مخفي)`}
                      </option>
                    ))}
                    <option value={NEW_CATEGORY}>+ إضافة تصنيف جديد</option>
                  </AdminSelectField>
                  {newCategoryName !== null ? (
                    <div className="grid gap-2 rounded-lg border border-line bg-ivory/60 p-3">
                      <AdminTextField
                        id="cake-new-category"
                        label="اسم التصنيف الجديد"
                        autoFocus
                        value={newCategoryName}
                        error={newCategoryError}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            void addCategory()
                          }
                        }}
                      />
                      <div className="flex gap-2">
                        <AdminButton size="sm" variant="primary" loading={addingCategory} onClick={() => void addCategory()}>
                          إضافة التصنيف
                        </AdminButton>
                        <AdminButton size="sm" disabled={addingCategory} onClick={() => setNewCategoryName(null)}>
                          إلغاء
                        </AdminButton>
                      </div>
                    </div>
                  ) : null}
                </div>
                <CakeImageField
                  id="cake-image"
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
                  id="cake-alt"
                  label="وصف الصورة"
                  wrapperClassName="sm:col-span-2"
                  hint="وصف قصير للصورة يساعد الموقع ومحركات البحث على فهمها."
                  value={draft.image_alt}
                  onChange={(e) => crud.update({ image_alt: e.target.value })}
                />
                <AdminTextAreaField
                  id="cake-desc"
                  label="وصف التورتة"
                  wrapperClassName="sm:col-span-2"
                  hint="يظهر للعملاء أسفل اسم التورتة."
                  value={draft.description}
                  onChange={(e) => crud.update({ description: e.target.value })}
                />
                <AdminTextField
                  id="cake-note"
                  label="ملاحظة السعر"
                  wrapperClassName="sm:col-span-2"
                  hint="ملاحظة اختيارية عن تسعير هذا التصميم. السعر نفسه يُحسب تلقائيًا من المقاس الذي يختاره العميل."
                  value={draft.price_note}
                  onChange={(e) => crud.update({ price_note: e.target.value })}
                />
              </div>
              <AdminSwitch
                id="cake-enabled"
                label="إظهار التورتة في الموقع"
                description="عند إيقافه لن تظهر التورتة للعملاء."
                checked={draft.enabled}
                onChange={(enabled) => crud.update({ enabled })}
              />
            </section>

            <section aria-labelledby="cake-options" className="grid gap-5 border-t border-line pt-5">
              <h3 id="cake-options" className="text-sm font-bold text-ink">
                الخيارات المتاحة لهذه التورتة
              </h3>

              <OptionGroup
                legend="المقاسات"
                selected={(draft.available_size_ids ?? []).length}
                total={sizes.length}
              >
                {sizeGroups.map(({ group, label, items }) =>
                  items.length ? (
                    <div key={group} className="grid gap-2">
                      <p className="text-xs font-semibold text-muted">{label}</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {items.map((size) => (
                          <AdminCheckboxTile
                            key={size.id}
                            checked={(draft.available_size_ids ?? []).includes(size.id)}
                            onChange={() => crud.update({ available_size_ids: toggleId(draft.available_size_ids, size.id) })}
                            hint={size.enabled ? undefined : 'غير مفعّل'}
                          >
                            {size.label}
                          </AdminCheckboxTile>
                        ))}
                      </div>
                    </div>
                  ) : null,
                )}
              </OptionGroup>

              <OptionGroup legend="الحشوات" selected={(draft.filling_ids ?? []).length} total={fillings.length}>
                <div className="grid gap-2 sm:grid-cols-2">
                  {fillings.map((item) => (
                    <AdminCheckboxTile
                      key={item.id}
                      checked={(draft.filling_ids ?? []).includes(item.id)}
                      onChange={() => crud.update({ filling_ids: toggleId(draft.filling_ids, item.id) })}
                      hint={item.enabled ? undefined : 'غير مفعّل'}
                    >
                      {item.name}
                    </AdminCheckboxTile>
                  ))}
                </div>
              </OptionGroup>

              <OptionGroup legend="الإضافات" selected={(draft.extra_ids ?? []).length} total={extras.length}>
                <div className="grid gap-2 sm:grid-cols-2">
                  {extras.map((item) => (
                    <AdminCheckboxTile
                      key={item.id}
                      checked={(draft.extra_ids ?? []).includes(item.id)}
                      onChange={() => crud.update({ extra_ids: toggleId(draft.extra_ids, item.id) })}
                      hint={item.enabled ? undefined : 'غير مفعّل'}
                    >
                      {item.name}
                    </AdminCheckboxTile>
                  ))}
                </div>
              </OptionGroup>
            </section>
          </>
        ) : null}
      </CatalogEditor>
    </AdminPage>
  )
}
