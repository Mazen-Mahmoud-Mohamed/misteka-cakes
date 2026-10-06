import { useRef, useState } from 'react'
import { AdminBadge, EnabledBadge } from '@/components/admin/AdminBadge'
import { AdminButton } from '@/components/admin/AdminButton'
import { AdminPage, AdminPageHeader } from '@/components/admin/AdminCard'
import { AdminSelectField, AdminSwitch, AdminTextAreaField, AdminTextField } from '@/components/admin/AdminField'
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
import { IconPlus, IconRefresh, IconTag } from '@/components/admin/icons'
import { usePageTitle } from '@/hooks/usePageTitle'
import {
  deleteAdminProductCategory,
  generateId,
  listAdminCategoryProductCounts,
  listAdminProductCategories,
  upsertAdminProductCategory,
  type AdminProductCategoryRow,
} from '@/services/admin/adminProductService'

const OFFERS_ID = 'cat-offers'
const CAKES_ID = 'cat-cakes'

const empty: AdminProductCategoryRow = {
  id: '',
  parent_id: null,
  name: '',
  description: '',
  kind: 'standard',
  sort_order: 100,
  enabled: true,
}

type FlatRow = { row: AdminProductCategoryRow; depth: number }

function flattenTree(categories: AdminProductCategoryRow[]): FlatRow[] {
  const childrenOf = (parentId: string | null) =>
    categories
      .filter((c) => c.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'ar'))

  const out: FlatRow[] = []
  function walk(parentId: string | null, depth: number) {
    for (const row of childrenOf(parentId)) {
      out.push({ row, depth })
      walk(row.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

export function AdminCategoriesPage() {
  usePageTitle('التصنيفات | مستكة')
  const [productCounts, setProductCounts] = useState<Record<string, number>>({})
  const [deleteError, setDeleteError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const categoryIds = useRef<string[]>([])
  const categoriesRef = useRef<AdminProductCategoryRow[]>([])
  const nextSort = useRef(10)

  const crud = useCatalogCrud<AdminProductCategoryRow>({
    list: async () => {
      const [categoriesRes, countsRes] = await Promise.all([
        listAdminProductCategories(),
        listAdminCategoryProductCounts(),
      ])
      setProductCounts(countsRes.data ?? {})
      categoriesRef.current = categoriesRes.data ?? []
      categoryIds.current = (categoriesRes.data ?? []).map((row) => row.id)
      nextSort.current = Math.max(0, ...(categoriesRes.data ?? []).map((row) => row.sort_order), 0) + 10
      return categoriesRes
    },
    upsert: upsertAdminProductCategory,
    prepare: (draft) => {
      const isOffers = draft.id === OFFERS_ID || draft.kind === 'offers'
      return {
        ...draft,
        id: draft.id || generateId(draft.name, 'cat', categoryIds.current),
        name: draft.name.trim(),
        description: draft.description.trim(),
        parent_id: isOffers ? null : draft.parent_id || null,
        kind: isOffers ? 'offers' : 'standard',
        sort_order: Number(draft.sort_order) || nextSort.current,
      }
    },
    validate: (draft) => {
      const errors: Record<string, string | undefined> = {
        name: draft.name.trim() ? undefined : 'أدخلي اسم التصنيف.',
      }
      if (draft.parent_id === draft.id && draft.id) {
        errors.parent_id = 'لا يمكن أن يكون التصنيف أبًا لنفسه.'
      }
      if (draft.parent_id) {
        const parent = categoriesRef.current.find((c) => c.id === draft.parent_id)
        if (parent?.kind === 'offers') {
          errors.parent_id = 'لا يمكن إضافة تصنيفات فرعية تحت العروض.'
        }
        if (parent?.parent_id) {
          errors.parent_id = 'اختاري تصنيفًا رئيسيًا فقط كأب.'
        }
      }
      return errors
    },
    onDiscard: () => setDeleteError(''),
    onSaved: () => setDeleteError(''),
  })

  const filter = useCatalogFilter(crud.rows, (row) => [row.name, row.description])
  const filteredIds = new Set(filter.filtered.map((row) => row.id))
  const tree = flattenTree(crud.rows).filter(({ row }) => filteredIds.has(row.id))

  function startNew(parentId: string | null = null) {
    const siblings = crud.rows.filter((c) => c.parent_id === parentId)
    const sort = Math.max(0, ...siblings.map((c) => c.sort_order), 0) + 10
    crud.open(
      {
        ...empty,
        parent_id: parentId,
        sort_order: sort,
      },
      null,
    )
  }

  async function runDelete() {
    if (!crud.original) return
    setDeleting(true)
    const result = await deleteAdminProductCategory(crud.original.id)
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
  const draftCount = crud.original ? (productCounts[crud.original.id] ?? 0) : 0
  const childCount = crud.original ? crud.rows.filter((c) => c.parent_id === crud.original!.id).length : 0
  const isProtectedOffers = crud.original?.id === OFFERS_ID || crud.original?.kind === 'offers'
  const canDelete = Boolean(crud.original) && !isProtectedOffers && draftCount === 0 && childCount === 0

  function countLabel(id: string) {
    const n = productCounts[id] ?? 0
    return n === 0 ? 'لا توجد منتجات' : n === 1 ? 'منتج واحد' : `${n} منتجات`
  }

  const parentChoices = crud.rows.filter(
    (c) => !c.parent_id && c.kind !== 'offers' && c.id !== draft?.id,
  )

  return (
    <AdminPage>
      <AdminPageHeader
        title="التصنيفات"
        description="تصنيفات المنتجات الهرمية التي تنظّم الكتالوج للعملاء."
        actions={
          <>
            <AdminButton icon={<IconRefresh size={18} />} loading={crud.refreshing} disabled={crud.loading} onClick={() => void crud.load(true)}>
              تحديث
            </AdminButton>
            <AdminButton variant="primary" icon={<IconPlus size={18} />} disabled={crud.loading} onClick={() => startNew(null)}>
              إضافة تصنيف
            </AdminButton>
          </>
        }
      />

      {!crud.loading && !crud.error && crud.rows.length > 0 ? (
        <CatalogToolbar
          id="categories-search"
          placeholder="ابحثي باسم التصنيف"
          filter={filter}
          total={crud.rows.length}
          visible={filter.filtered.length}
          noun="تصنيف"
        />
      ) : null}

      <CatalogResults
        loading={crud.loading}
        error={crud.error}
        onRetry={() => void crud.load(true)}
        retrying={crud.refreshing}
        total={crud.rows.length}
        visible={filter.filtered.length}
        emptyTitle="لا توجد تصنيفات"
        emptyDescription="أضيفي أول تصنيف لتنظيم المنتجات في الموقع."
        emptyIcon={<IconTag />}
        addLabel="إضافة تصنيف"
        onAdd={() => startNew(null)}
        onClearFilters={() => {
          filter.setQuery('')
          filter.setEnabled('all')
        }}
        table={
          <AdminTable
            caption="التصنيفات"
            head={
              <>
                <Th>التصنيف</Th>
                <Th>عدد المنتجات</Th>
                <Th className="text-center">ترتيب العرض</Th>
                <Th>الحالة</Th>
                <Th>
                  <span className="sr-only">إجراء</span>
                </Th>
              </>
            }
          >
            {tree.map(({ row, depth }) => (
              <Tr key={row.id} className={row.enabled ? undefined : 'bg-cream/30'}>
                <Td>
                  <div style={{ paddingInlineStart: depth * 1.25 + 'rem' }}>
                    <p className="font-bold">
                      {depth > 0 ? <span className="me-1 text-muted">└</span> : null}
                      {row.name}
                    </p>
                    {row.description ? <p className="text-xs text-muted">{row.description}</p> : null}
                    {row.kind === 'offers' ? <p className="text-xs text-muted">قسم العروض</p> : null}
                  </div>
                </Td>
                <Td>
                  <AdminBadge tone="info">{countLabel(row.id)}</AdminBadge>
                </Td>
                <Td className="w-28 text-center text-muted tabular-nums">{row.sort_order}</Td>
                <Td className="w-36">
                  <EnabledBadge enabled={row.enabled} />
                </Td>
                <Td className="w-px text-end">
                  <EditButton label={`تعديل ${row.name}`} onClick={() => crud.open({ ...row }, row)} />
                </Td>
              </Tr>
            ))}
          </AdminTable>
        }
        list={
          <AdminList label="التصنيفات">
            {tree.map(({ row, depth }) => (
              <CatalogListItem
                key={row.id}
                title={
                  <span style={{ paddingInlineStart: depth * 0.75 + 'rem' }}>
                    {depth > 0 ? '└ ' : ''}
                    {row.name}
                  </span>
                }
                subtitle={row.description || undefined}
                badges={
                  <>
                    <EnabledBadge enabled={row.enabled} />
                    <AdminBadge tone="info">{countLabel(row.id)}</AdminBadge>
                  </>
                }
                editLabel={`تعديل ${row.name}`}
                onEdit={() => crud.open({ ...row }, row)}
              />
            ))}
          </AdminList>
        }
      />

      <CatalogEditor
        crud={crud}
        size="sm"
        newTitle="تصنيف جديد"
        editTitle="تعديل التصنيف"
        disableTitle="إخفاء التصنيف؟"
        disableBody="سيختفي هذا التصنيف من الموقع بعد الحفظ. المنتجات لا تُحذف، ويمكنك إظهاره مرة أخرى لاحقًا."
      >
        {draft ? (
          <div className="grid gap-4">
            <AdminTextField
              id="category-name"
              label="اسم التصنيف"
              required
              value={draft.name}
              error={crud.fieldErrors.name}
              onChange={(e) => crud.update({ name: e.target.value })}
            />
            <AdminTextAreaField
              id="category-desc"
              label="وصف التصنيف"
              hint="اختياري، يظهر للدعم الداخلي أو الوصف في الموقع."
              value={draft.description}
              onChange={(e) => crud.update({ description: e.target.value })}
            />
            {draft.kind === 'offers' || draft.id === OFFERS_ID ? (
              <AdminTextField
                id="category-parent-ro"
                label="التصنيف الأب"
                value="رئيسي"
                readOnly
                hint="قسم العروض يبقى تصنيفًا رئيسيًا بدون فروع."
              />
            ) : (
              <AdminSelectField
                id="category-parent"
                label="التصنيف الأب"
                value={draft.parent_id ?? ''}
                error={crud.fieldErrors.parent_id}
                hint={
                  draft.parent_id === CAKES_ID
                    ? 'التصنيفات الفرعية تحت التورت تُزامَن تلقائيًا مع تصنيفات التورت.'
                    : 'اختاري «رئيسي» للقسم الأعلى، أو تصنيفًا رئيسيًا لإنشاء فرع.'
                }
                onChange={(e) => crud.update({ parent_id: e.target.value || null })}
              >
                <option value="">رئيسي</option>
                {parentChoices.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.enabled ? c.name : `${c.name} (مخفي)`}
                  </option>
                ))}
              </AdminSelectField>
            )}
            <AdminTextField
              id="category-sort"
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
              id="category-enabled"
              label="ظاهر في الموقع"
              description="عند إيقافه يختفي التصنيف من الموقع."
              checked={draft.enabled}
              onChange={(enabled) => crud.update({ enabled })}
            />
            {crud.original ? (
              <div className="grid gap-2 border-t border-line pt-4">
                {isProtectedOffers ? (
                  <p className="text-[0.8125rem] leading-6 text-muted">
                    قسم العروض لا يُحذف. يمكنك إخفاؤه من الموقع بدلًا من ذلك.
                  </p>
                ) : childCount > 0 ? (
                  <p className="text-[0.8125rem] leading-6 text-muted">
                    لا يمكن حذف هذا التصنيف لأنه يحتوي تصنيفات فرعية. انقليها أو أخفيه.
                  </p>
                ) : draftCount > 0 ? (
                  <p className="text-[0.8125rem] leading-6 text-muted">
                    لا يمكن حذف هذا التصنيف لأنه مرتبط بـ {countLabel(crud.original.id)}. يمكنك إخفاؤه بدلًا من ذلك.
                  </p>
                ) : canDelete ? (
                  <div>
                    <AdminButton size="sm" variant="dangerOutline" onClick={() => setConfirmDelete(true)}>
                      حذف التصنيف
                    </AdminButton>
                  </div>
                ) : null}
                {deleteError ? (
                  <p className="text-[0.8125rem] leading-6 font-semibold text-[#8a2e2e]" role="alert">
                    {deleteError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </CatalogEditor>

      <ConfirmDialog
        open={confirmDelete}
        title="حذف التصنيف؟"
        body="سيتم حذف هذا التصنيف نهائيًا. لا توجد منتجات أو فروع مرتبطة به."
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
