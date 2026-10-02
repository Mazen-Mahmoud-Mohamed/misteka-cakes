import { useRef, useState } from 'react'
import { AdminBadge, EnabledBadge } from '@/components/admin/AdminBadge'
import { AdminButton } from '@/components/admin/AdminButton'
import { AdminPage, AdminPageHeader } from '@/components/admin/AdminCard'
import { AdminSwitch, AdminTextAreaField, AdminTextField } from '@/components/admin/AdminField'
import { AdminList, AdminTable, Td, Th, Tr } from '@/components/admin/AdminTable'
import {
  CatalogEditor,
  CatalogListItem,
  CatalogResults,
  CatalogToolbar,
  EditButton,
  useCatalogCrud,
  useCatalogFilter,
} from '@/components/admin/catalog'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { IconPlus, IconRefresh, IconTag } from '@/components/admin/icons'
import { usePageTitle } from '@/hooks/usePageTitle'
import {
  deleteAdminCategory,
  generateId,
  listAdminCakes,
  listAdminCategories,
  upsertAdminCategory,
  type AdminCategoryRow,
} from '@/services/admin/adminCatalogService'

export function AdminCategoriesPage() {
  usePageTitle('التصنيفات | مستكة')
  const [cakeCounts, setCakeCounts] = useState<Record<string, number>>({})
  const [deleteError, setDeleteError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const categoryIds = useRef<string[]>([])
  const nextSort = useRef(10)

  const crud = useCatalogCrud<AdminCategoryRow>({
    list: async () => {
      const [categoriesRes, cakesRes] = await Promise.all([listAdminCategories(), listAdminCakes()])
      const counts: Record<string, number> = {}
      for (const cake of cakesRes.data ?? []) counts[cake.category] = (counts[cake.category] ?? 0) + 1
      setCakeCounts(counts)
      categoryIds.current = (categoriesRes.data ?? []).map((row) => row.id)
      nextSort.current = Math.max(0, ...(categoriesRes.data ?? []).map((row) => row.sort_order)) + 10
      return categoriesRes
    },
    upsert: upsertAdminCategory,
    prepare: (draft) => ({
      ...draft,
      id: draft.id || generateId(draft.name, 'category', categoryIds.current),
      name: draft.name.trim(),
      description: draft.description.trim(),
      sort_order: Number(draft.sort_order) || nextSort.current,
    }),
    validate: (draft) => ({
      name: draft.name.trim() ? undefined : 'أدخلي اسم التصنيف.',
    }),
    onDiscard: () => setDeleteError(''),
    onSaved: () => setDeleteError(''),
  })
  const filter = useCatalogFilter(crud.rows, (row) => [row.name, row.description])

  function startNew() {
    crud.open(
      {
        id: '',
        name: '',
        description: '',
        enabled: true,
        sort_order: nextSort.current,
      },
      null,
    )
  }

  async function runDelete() {
    if (!crud.original) return
    setDeleting(true)
    const result = await deleteAdminCategory(crud.original.id)
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
  const draftCount = crud.original ? (cakeCounts[crud.original.id] ?? 0) : 0

  function countLabel(id: string) {
    const n = cakeCounts[id] ?? 0
    return n === 0 ? 'لا توجد تورت' : n === 1 ? 'تورتة واحدة' : `${n} تورت`
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="التصنيفات"
        description="تصنيفات التورت التي تظهر كفلاتر في صفحة التورت."
        actions={
          <>
            <AdminButton icon={<IconRefresh size={18} />} loading={crud.refreshing} disabled={crud.loading} onClick={() => void crud.load(true)}>
              تحديث
            </AdminButton>
            <AdminButton variant="primary" icon={<IconPlus size={18} />} disabled={crud.loading} onClick={startNew}>
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
        emptyDescription="أضيفي أول تصنيف لتنظيم التورت في الموقع."
        emptyIcon={<IconTag />}
        addLabel="إضافة تصنيف"
        onAdd={startNew}
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
                <Th>عدد التورت</Th>
                <Th className="text-center">ترتيب الظهور</Th>
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
                  <p className="font-bold">{row.name}</p>
                  {row.description ? <p className="text-xs text-muted">{row.description}</p> : null}
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
            {filter.filtered.map((row) => (
              <CatalogListItem
                key={row.id}
                title={row.name}
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
        disableBody="سيختفي هذا التصنيف وكل التورت التابعة له من الموقع بعد الحفظ. لا يتم حذف أي تورتة، ويمكنك إظهاره مرة أخرى لاحقًا."
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
              hint="اختياري، للاستخدام الداخلي."
              value={draft.description}
              onChange={(e) => crud.update({ description: e.target.value })}
            />
            <AdminTextField
              id="category-sort"
              label="ترتيب الظهور"
              type="number"
              inputMode="numeric"
              dir="ltr"
              className="text-start"
              hint="رقم أصغر يعني ظهور التصنيف قبل غيره."
              value={String(draft.sort_order)}
              onChange={(e) => crud.update({ sort_order: Number(e.target.value) })}
            />
            <AdminSwitch
              id="category-enabled"
              label="إظهار التصنيف في الموقع"
              description="عند إيقافه يختفي التصنيف والتورت التابعة له من الموقع."
              checked={draft.enabled}
              onChange={(enabled) => crud.update({ enabled })}
            />
            {crud.original ? (
              <div className="grid gap-2 border-t border-line pt-4">
                {draftCount > 0 ? (
                  <p className="text-[0.8125rem] leading-6 text-muted">
                    لا يمكن حذف هذا التصنيف لأنه مرتبط بـ {countLabel(crud.original.id)}. يمكنك إخفاؤه بدلًا من ذلك.
                  </p>
                ) : (
                  <div>
                    <AdminButton size="sm" variant="dangerOutline" onClick={() => setConfirmDelete(true)}>
                      حذف التصنيف
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
          </div>
        ) : null}
      </CatalogEditor>

      <ConfirmDialog
        open={confirmDelete}
        title="حذف التصنيف؟"
        body="سيتم حذف هذا التصنيف نهائيًا. لا توجد تورت مرتبطة به."
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
