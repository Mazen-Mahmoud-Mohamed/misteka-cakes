import { useState, type ReactNode } from 'react'
import { cakeImageMap } from '@/data/localCatalog'
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
import {
  CatalogEditor,
  CatalogListItem,
  CatalogResults,
  CatalogToolbar,
  EditButton,
  ID_HINT_EDIT,
  ID_HINT_NEW,
  IdText,
  SORT_HINT,
  useCatalogCrud,
  useCatalogFilter,
} from '@/components/admin/catalog'
import { IconCake, IconPlus, IconRefresh } from '@/components/admin/icons'
import { usePageTitle } from '@/hooks/usePageTitle'
import {
  listAdminCakes,
  listAdminExtras,
  listAdminFillings,
  listAdminSizes,
  upsertAdminCake,
  type AdminCakeRow,
  type AdminCakeSizeRow,
  type AdminExtraRow,
  type AdminFillingRow,
} from '@/services/admin/adminCatalogService'

const empty: AdminCakeRow = {
  id: '',
  name: '',
  description: '',
  image_key: 'butterflies',
  image_alt: '',
  image_position: 'center',
  category: 'birthday',
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

const CATEGORY_LABELS: Record<AdminCakeRow['category'], string> = {
  birthday: 'عيد ميلاد',
  celebration: 'مناسبة',
}

function toggleId(list: string[] | null, id: string): string[] {
  const current = list ?? []
  return current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
}

function Thumb({ imageKey, className = 'size-12' }: { imageKey: string; className?: string }) {
  const src = cakeImageMap[imageKey]
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

  const crud = useCatalogCrud<AdminCakeRow>({
    list: async () => {
      const [cakesRes, sizesRes, fillingsRes, extrasRes] = await Promise.all([
        listAdminCakes(),
        listAdminSizes(),
        listAdminFillings(),
        listAdminExtras(),
      ])
      setSizes(sizesRes.data ?? [])
      setFillings(fillingsRes.data ?? [])
      setExtras(extrasRes.data ?? [])
      return cakesRes
    },
    upsert: upsertAdminCake,
    prepare: (draft) => ({
      ...draft,
      id: draft.id.trim(),
      sort_order: Number(draft.sort_order) || 0,
      base_price: draft.base_price == null || Number.isNaN(Number(draft.base_price)) ? null : Number(draft.base_price),
    }),
    validate: (draft) => ({
      id: draft.id.trim() ? undefined : 'أدخلي المعرّف.',
      name: draft.name.trim() ? undefined : 'أدخلي اسم التورتة.',
    }),
  })
  const filter = useCatalogFilter(crud.rows, (row) => [row.name, row.id, row.description])

  function startNew() {
    crud.open(
      {
        ...empty,
        sort_order: (crud.rows.at(-1)?.sort_order ?? 0) + 10,
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
            <AdminButton variant="primary" icon={<IconPlus size={18} />} onClick={startNew}>
              إضافة تورتة
            </AdminButton>
          </>
        }
      />

      {!crud.loading && !crud.error && crud.rows.length > 0 ? (
        <CatalogToolbar
          id="cakes-search"
          placeholder="ابحثي باسم التورتة أو المعرّف"
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
                <Th className="text-center">الترتيب</Th>
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
                      <IdText>{row.id}</IdText>
                    </div>
                  </div>
                </Td>
                <Td>
                  <AdminBadge tone="info">{CATEGORY_LABELS[row.category] ?? row.category}</AdminBadge>
                </Td>
                <Td className="hidden text-[0.8125rem] text-muted xl:table-cell">{optionsSummary(row)}</Td>
                <Td className="text-center text-muted tabular-nums">{row.sort_order}</Td>
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
                subtitle={<IdText>{row.id}</IdText>}
                meta={<span className="text-xs text-muted">{optionsSummary(row)}</span>}
                badges={
                  <>
                    <EnabledBadge enabled={row.enabled} />
                    <AdminBadge tone="info">{CATEGORY_LABELS[row.category] ?? row.category}</AdminBadge>
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
        disableTitle="تعطيل التورتة؟"
        disableBody="لن تظهر هذه التورتة في كتالوج العملاء بعد الحفظ. الطلبات السابقة لا تتأثر، ويمكنك إعادة تفعيلها لاحقًا."
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
                  label="الاسم"
                  required
                  value={draft.name}
                  error={crud.fieldErrors.name}
                  onChange={(e) => crud.update({ name: e.target.value })}
                />
                <AdminTextField
                  id="cake-id"
                  label="المعرّف"
                  required
                  dir="ltr"
                  className="text-start"
                  value={draft.id}
                  error={crud.fieldErrors.id}
                  hint={crud.isNew ? ID_HINT_NEW : ID_HINT_EDIT}
                  onChange={(e) => crud.update({ id: e.target.value })}
                />
                <AdminSelectField
                  id="cake-category"
                  label="التصنيف"
                  value={draft.category}
                  onChange={(e) => crud.update({ category: e.target.value as AdminCakeRow['category'] })}
                >
                  <option value="birthday">عيد ميلاد</option>
                  <option value="celebration">مناسبة</option>
                </AdminSelectField>
                <div className="flex items-end gap-3">
                  <AdminSelectField
                    id="cake-image"
                    label="مفتاح الصورة"
                    wrapperClassName="min-w-0 flex-1"
                    value={draft.image_key}
                    onChange={(e) => crud.update({ image_key: e.target.value })}
                  >
                    {Object.keys(cakeImageMap).map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </AdminSelectField>
                  <Thumb imageKey={draft.image_key} className="size-11" />
                </div>
                <AdminTextAreaField
                  id="cake-desc"
                  label="الوصف"
                  wrapperClassName="sm:col-span-2"
                  value={draft.description}
                  onChange={(e) => crud.update({ description: e.target.value })}
                />
                <AdminTextField
                  id="cake-alt"
                  label="وصف الصورة"
                  hint="نص بديل يقرؤه قارئ الشاشة."
                  value={draft.image_alt}
                  onChange={(e) => crud.update({ image_alt: e.target.value })}
                />
                <AdminTextField
                  id="cake-sort"
                  label="ترتيب العرض"
                  type="number"
                  inputMode="numeric"
                  dir="ltr"
                  className="text-start"
                  hint={SORT_HINT}
                  value={String(draft.sort_order)}
                  onChange={(e) => crud.update({ sort_order: Number(e.target.value) })}
                />
                <AdminTextField
                  id="cake-note"
                  label="ملاحظة السعر"
                  wrapperClassName="sm:col-span-2"
                  value={draft.price_note}
                  onChange={(e) => crud.update({ price_note: e.target.value })}
                />
              </div>
              <AdminSwitch
                id="cake-enabled"
                label="مفعّلة في الموقع"
                description="عند التعطيل تختفي التورتة من كتالوج العملاء."
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
