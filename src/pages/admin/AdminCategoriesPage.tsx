import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminAlert } from '@/components/admin/AdminAlert'
import { AdminBadge, EnabledBadge } from '@/components/admin/AdminBadge'
import { AdminButton, AdminIconButton } from '@/components/admin/AdminButton'
import { AdminPage, AdminPageHeader, adminSurfaceClass } from '@/components/admin/AdminCard'
import { AdminSelectField, AdminSwitch, AdminTextAreaField, AdminTextField } from '@/components/admin/AdminField'
import { AdminEmptyState, AdminErrorState, AdminListSkeleton } from '@/components/admin/AdminStates'
import {
  CatalogEditor,
  CatalogToolbar,
  EditButton,
  SORT_HINT,
  useCatalogCrud,
  useCatalogFilter,
} from '@/components/admin/catalog'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import {
  IconArrowDown,
  IconArrowUp,
  IconChevronForward,
  IconEye,
  IconEyeOff,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTag,
} from '@/components/admin/icons'
import { usePageTitle } from '@/hooks/usePageTitle'
import { cx } from '@/utils/cx'
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
  const [rowBusy, setRowBusy] = useState(false)
  const [rowError, setRowError] = useState('')
  const [confirmHide, setConfirmHide] = useState<AdminProductCategoryRow | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
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
  const tree = flattenTree(crud.rows)
  const groups = tree
    .filter(({ depth }) => depth === 0)
    .map(({ row }) => ({
      root: row,
      rootMatches: filteredIds.has(row.id),
      children: tree
        .filter(({ row: c, depth }) => depth > 0 && c.parent_id === row.id && filteredIds.has(c.id))
        .map(({ row: c }) => c),
    }))
    .filter((g) => g.rootMatches || g.children.length > 0)

  function toggleCollapsed(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function metaBadges(row: AdminProductCategoryRow, childCount = 0) {
    return (
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-xs text-muted">
        {row.kind === 'offers' ? (
          <AdminBadge tone="neutral">العروض والباقات</AdminBadge>
        ) : (
          <Link
            to={`/admin/products?category=${row.parent_id ?? row.id}${row.parent_id ? `&sub=${row.id}` : ''}`}
            className="rounded-full"
          >
            <AdminBadge tone="info">{treeCountLabel(row)}</AdminBadge>
          </Link>
        )}
        {childCount ? <AdminBadge tone="neutral">{childCount} فرعي</AdminBadge> : null}
        <EnabledBadge enabled={row.enabled} />
        <span className="tabular-nums" title="ترتيب العرض">
          ترتيب {row.sort_order}
        </span>
      </div>
    )
  }

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

  function treeCountLabel(row: AdminProductCategoryRow) {
    if (row.parent_id) return countLabel(row.id)
    const own = productCounts[row.id] ?? 0
    const total = crud.rows
      .filter((c) => c.parent_id === row.id)
      .reduce((sum, c) => sum + (productCounts[c.id] ?? 0), own)
    return total === 0 ? 'لا توجد منتجات' : total === 1 ? 'منتج واحد' : `${total} منتجات`
  }

  function siblingsOf(row: AdminProductCategoryRow) {
    return crud.rows
      .filter((c) => c.parent_id === row.parent_id)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'ar'))
  }

  async function move(row: AdminProductCategoryRow, delta: -1 | 1) {
    const siblings = siblingsOf(row)
    const index = siblings.findIndex((c) => c.id === row.id)
    const other = siblings[index + delta]
    if (!other) return
    setRowBusy(true)
    const rowOrder = row.sort_order === other.sort_order ? other.sort_order + delta : other.sort_order
    const [a, b] = await Promise.all([
      upsertAdminProductCategory({ ...row, sort_order: rowOrder }),
      upsertAdminProductCategory({ ...other, sort_order: row.sort_order }),
    ])
    setRowBusy(false)
    if (!a.ok || !b.ok) setRowError('تعذّر تغيير الترتيب. حاولي مرة أخرى.')
    else setRowError('')
    await crud.load(true)
  }

  async function setVisibility(row: AdminProductCategoryRow, enabled: boolean) {
    setRowBusy(true)
    const result = await upsertAdminProductCategory({ ...row, enabled })
    setRowBusy(false)
    setConfirmHide(null)
    setRowError(result.ok ? '' : 'تعذّر تغيير الظهور. حاولي مرة أخرى.')
    await crud.load(true)
  }

  function rowActions(row: AdminProductCategoryRow) {
    const siblings = siblingsOf(row)
    const index = siblings.findIndex((c) => c.id === row.id)
    const canHaveChildren = !row.parent_id && row.kind !== 'offers'
    return (
      <div className="ms-auto flex shrink-0 flex-wrap items-center justify-end gap-0.5">
        {canHaveChildren ? (
          <AdminIconButton label={`إضافة تصنيف فرعي تحت ${row.name}`} disabled={rowBusy} onClick={() => startNew(row.id)}>
            <IconPlus size={18} />
          </AdminIconButton>
        ) : null}
        <AdminIconButton label={`نقل ${row.name} لأعلى`} disabled={rowBusy || index <= 0} onClick={() => void move(row, -1)}>
          <IconArrowUp size={18} />
        </AdminIconButton>
        <AdminIconButton
          label={`نقل ${row.name} لأسفل`}
          disabled={rowBusy || index === siblings.length - 1}
          onClick={() => void move(row, 1)}
        >
          <IconArrowDown size={18} />
        </AdminIconButton>
        <AdminIconButton
          label={row.enabled ? `إخفاء ${row.name}` : `إظهار ${row.name}`}
          disabled={rowBusy}
          onClick={() => (row.enabled ? setConfirmHide(row) : void setVisibility(row, true))}
        >
          {row.enabled ? <IconEyeOff size={18} /> : <IconEye size={18} />}
        </AdminIconButton>
        <EditButton label={`تعديل ${row.name}`} onClick={() => crud.open({ ...row }, row)} />
      </div>
    )
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

      {rowError ? (
        <AdminAlert tone="error" className="mb-4" onClose={() => setRowError('')}>
          {rowError}
        </AdminAlert>
      ) : null}

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

      {crud.loading ? <AdminListSkeleton rows={5} label="جاري تحميل التصنيفات" /> : null}

      {!crud.loading && crud.error ? (
        <AdminErrorState description={crud.error} onRetry={() => void crud.load(true)} retrying={crud.refreshing} />
      ) : null}

      {!crud.loading && !crud.error && crud.rows.length === 0 ? (
        <AdminEmptyState
          icon={<IconTag />}
          title="لا توجد تصنيفات"
          description="أضيفي أول تصنيف لتنظيم المنتجات في الموقع."
          action={
            <AdminButton variant="primary" icon={<IconPlus size={18} />} onClick={() => startNew(null)}>
              إضافة تصنيف
            </AdminButton>
          }
        />
      ) : null}

      {!crud.loading && !crud.error && crud.rows.length > 0 && groups.length === 0 ? (
        <AdminEmptyState
          icon={<IconSearch />}
          title="لا توجد نتائج مطابقة"
          description="جرّبي كلمة بحث أخرى أو غيّري تصفية الحالة."
          action={
            <AdminButton
              onClick={() => {
                filter.setQuery('')
                filter.setEnabled('all')
              }}
            >
              مسح التصفية
            </AdminButton>
          }
        />
      ) : null}

      {!crud.loading && !crud.error && groups.length > 0 ? (
        <ul className="grid gap-3" aria-label="التصنيفات">
          {groups.map(({ root, rootMatches, children }) => {
            const allChildren = crud.rows.filter((c) => c.parent_id === root.id)
            const open = filter.active ? true : !collapsed.has(root.id)
            const panelId = `category-children-${root.id}`
            return (
              <li key={root.id} className={cx(adminSurfaceClass, 'overflow-hidden', !root.enabled && 'bg-ivory/60')}>
                <div
                  className={cx(
                    'flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4',
                    !rootMatches && 'opacity-70',
                  )}
                >
                  <div className="flex min-w-0 flex-1 basis-56 items-center gap-1.5">
                    {allChildren.length ? (
                      <AdminIconButton
                        label={open ? `طي فروع ${root.name}` : `عرض فروع ${root.name}`}
                        aria-expanded={open}
                        aria-controls={panelId}
                        disabled={filter.active}
                        onClick={() => toggleCollapsed(root.id)}
                        className="-ms-1.5"
                      >
                        <IconChevronForward
                          size={18}
                          className={cx(
                            'transition-transform duration-150 motion-reduce:transition-none',
                            open && 'rtl:-rotate-90 ltr:rotate-90',
                          )}
                        />
                      </AdminIconButton>
                    ) : (
                      <span className="grid size-11 shrink-0 place-items-center text-muted -ms-1.5" aria-hidden="true">
                        <IconTag size={16} />
                      </span>
                    )}
                    <div className="min-w-0">
                      <h2 className="truncate text-[0.9375rem] font-bold text-ink">{root.name}</h2>
                      {root.description || root.kind === 'offers' ? (
                        <p className="truncate text-xs leading-5 text-muted">
                          {root.kind === 'offers' ? 'قسم العروض' : root.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {metaBadges(root, allChildren.length)}
                  {rowActions(root)}
                </div>

                {open && children.length ? (
                  <ul id={panelId} className="border-t border-line/80 bg-ivory/40 py-1" aria-label={`فروع ${root.name}`}>
                    {children.map((child) => (
                      <li
                        key={child.id}
                        className={cx(
                          'flex flex-wrap items-center gap-x-3 gap-y-1 py-1 ps-6 pe-3 sm:ps-12 sm:pe-4',
                          !child.enabled && 'opacity-75',
                        )}
                      >
                        <div className="flex min-w-0 flex-1 basis-48 items-center gap-2">
                          <span className="h-5 w-3 shrink-0 rounded-es-md border-s-2 border-b-2 border-line" aria-hidden="true" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">{child.name}</p>
                            {child.description ? (
                              <p className="truncate text-xs leading-5 text-muted">{child.description}</p>
                            ) : null}
                          </div>
                        </div>
                        {metaBadges(child)}
                        {rowActions(child)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}

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
        open={Boolean(confirmHide)}
        title="إخفاء التصنيف؟"
        body={`سيختفي «${confirmHide?.name ?? ''}» ومنتجاته من الموقع. المنتجات لا تُحذف، ويمكنك إظهاره مرة أخرى لاحقًا.`}
        confirmLabel="إخفاء"
        cancelLabel="رجوع"
        busy={rowBusy}
        onCancel={() => setConfirmHide(null)}
        onConfirm={() => confirmHide && void setVisibility(confirmHide, false)}
      />

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
