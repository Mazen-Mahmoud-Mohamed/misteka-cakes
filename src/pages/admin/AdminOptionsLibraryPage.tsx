import { useEffect, useRef, useState } from 'react'
import { AdminAlert } from '@/components/admin/AdminAlert'
import { EnabledBadge } from '@/components/admin/AdminBadge'
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
import { IconLayers, IconPlus, IconRefresh } from '@/components/admin/icons'
import { usePageTitle } from '@/hooks/usePageTitle'
import {
  deleteAdminOptionDefinition,
  deleteAdminOptionDefinitionValue,
  generateId,
  listAdminOptionDefinitionValues,
  listAdminOptionDefinitions,
  upsertAdminOptionDefinition,
  upsertAdminOptionDefinitionValue,
  type AdminOptionDefinitionRow,
  type AdminOptionDefinitionValueRow,
} from '@/services/admin/adminProductService'
import type { ProductOptionSelection } from '@/types/products'
import { formatEgp } from '@/utils/format'

const SELECTION_LABELS: Record<ProductOptionSelection, string> = {
  single: 'اختيار واحد',
  multi: 'اختيار متعدد',
  toggle: 'مفتاح تشغيل',
  text: 'نص',
  textarea: 'نص طويل',
  quantity: 'كمية',
}

const emptyDefinition: AdminOptionDefinitionRow = {
  id: '',
  name: '',
  description: '',
  selection_type: 'single',
  sort_order: 100,
  enabled: true,
}

const emptyValue = (definitionId: string, sort: number): AdminOptionDefinitionValueRow => ({
  id: '',
  definition_id: definitionId,
  name: '',
  price_adjustment: 0,
  sort_order: sort,
  enabled: true,
})

function ValuesEditor({
  definitionId,
  selectionType,
}: {
  definitionId: string
  selectionType: ProductOptionSelection
}) {
  const needsValues =
    selectionType === 'single' || selectionType === 'multi' || selectionType === 'toggle' || selectionType === 'quantity'
  const [values, setValues] = useState<AdminOptionDefinitionValueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [draft, setDraft] = useState<AdminOptionDefinitionValueRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busyDelete, setBusyDelete] = useState(false)
  const valueIds = useRef<string[]>([])

  async function reload() {
    setLoading(true)
    const res = await listAdminOptionDefinitionValues(definitionId)
    setValues(res.data ?? [])
    valueIds.current = (res.data ?? []).map((v) => v.id)
    setLoading(false)
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definitionId])

  if (!needsValues) {
    return (
      <p className="text-[0.8125rem] leading-6 text-muted">
        هذا النوع لا يحتاج قيمًا محددة مسبقًا — العميل يدخل النص عند الطلب.
      </p>
    )
  }

  async function save() {
    if (!draft) return
    if (!draft.name.trim()) {
      setMessage('أدخلي اسم القيمة.')
      return
    }
    setSaving(true)
    setMessage('')
    const payload: AdminOptionDefinitionValueRow = {
      ...draft,
      id: draft.id || generateId(draft.name, 'odefval', valueIds.current),
      name: draft.name.trim(),
      price_adjustment: Number(draft.price_adjustment) || 0,
      sort_order: Number(draft.sort_order) || 0,
    }
    const result = await upsertAdminOptionDefinitionValue(payload)
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
    const result = await deleteAdminOptionDefinitionValue(confirmId)
    setBusyDelete(false)
    setConfirmId(null)
    setMessage(result.message)
    if (result.ok) await reload()
  }

  return (
    <div className="grid gap-3 border-t border-line pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-ink">قيم الخيار</h3>
        <AdminButton
          size="sm"
          variant="secondary"
          icon={<IconPlus size={16} />}
          disabled={Boolean(draft)}
          onClick={() => {
            const sort = Math.max(0, ...values.map((v) => v.sort_order)) + 10
            setDraft(emptyValue(definitionId, sort))
            setMessage('')
          }}
        >
          إضافة قيمة
        </AdminButton>
      </div>
      {loading ? <p className="text-sm text-muted">جارٍ التحميل...</p> : null}
      {message ? (
        <AdminAlert tone={message.includes('تعذّر') ? 'error' : 'success'}>{message}</AdminAlert>
      ) : null}
      <div className="grid gap-2">
        {values.map((val) => (
          <div
            key={val.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-ivory/40 px-3 py-2"
          >
            <p className="text-sm text-ink">
              <span className="font-semibold">{val.name}</span>
              <span className="text-muted">
                {' · '}
                {val.price_adjustment > 0 ? `+ ${formatEgp(val.price_adjustment)}` : 'بدون تعديل سعر'}
                {!val.enabled ? ' · مخفي' : ''}
              </span>
            </p>
            <div className="flex gap-1.5">
              <AdminButton size="sm" onClick={() => setDraft({ ...val })}>
                تعديل
              </AdminButton>
              <AdminButton size="sm" variant="dangerOutline" onClick={() => setConfirmId(val.id)}>
                حذف
              </AdminButton>
            </div>
          </div>
        ))}
      </div>
      {draft ? (
        <div className="grid gap-3 rounded-lg border border-line bg-paper p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminTextField
              id="odef-val-name"
              label="اسم القيمة"
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <AdminTextField
              id="odef-val-price"
              label="تعديل السعر"
              type="number"
              inputMode="decimal"
              dir="ltr"
              className="text-start"
              value={String(draft.price_adjustment)}
              onChange={(e) => setDraft({ ...draft, price_adjustment: Number(e.target.value) })}
            />
            <AdminTextField
              id="odef-val-sort"
              label="الترتيب"
              type="number"
              value={String(draft.sort_order)}
              onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
            />
          </div>
          <AdminSwitch
            id="odef-val-enabled"
            label="ظاهر"
            checked={draft.enabled}
            onChange={(enabled) => setDraft({ ...draft, enabled })}
          />
          <div className="flex flex-wrap gap-2">
            <AdminButton size="sm" variant="primary" loading={saving} onClick={() => void save()}>
              حفظ القيمة
            </AdminButton>
            <AdminButton size="sm" disabled={saving} onClick={() => setDraft(null)}>
              إلغاء
            </AdminButton>
          </div>
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(confirmId)}
        title="حذف القيمة؟"
        body="سيتم حذف هذه القيمة من التعريف."
        confirmLabel="حذف"
        cancelLabel="رجوع"
        danger
        busy={busyDelete}
        onCancel={() => setConfirmId(null)}
        onConfirm={() => void runDelete()}
      />
    </div>
  )
}

export function AdminOptionsLibraryPage() {
  usePageTitle('مكتبة الخيارات | مستكة')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const defIds = useRef<string[]>([])
  const nextSort = useRef(10)

  const crud = useCatalogCrud<AdminOptionDefinitionRow>({
    list: async () => {
      const res = await listAdminOptionDefinitions()
      defIds.current = (res.data ?? []).map((r) => r.id)
      nextSort.current = Math.max(0, ...(res.data ?? []).map((r) => r.sort_order), 0) + 10
      return res
    },
    upsert: upsertAdminOptionDefinition,
    prepare: (draft) => ({
      ...draft,
      id: draft.id || generateId(draft.name, 'odef', defIds.current),
      name: draft.name.trim(),
      description: draft.description.trim(),
      sort_order: draft.id ? Number(draft.sort_order) || 0 : nextSort.current,
    }),
    validate: (draft) => ({
      name: draft.name.trim() ? undefined : 'أدخلي اسم الخيار.',
    }),
  })

  const filter = useCatalogFilter(crud.rows, (row) => [
    row.name,
    row.description,
    SELECTION_LABELS[row.selection_type],
  ])

  async function runDelete() {
    if (!crud.original) return
    setDeleting(true)
    setDeleteError('')
    const result = await deleteAdminOptionDefinition(crud.original.id)
    setDeleting(false)
    if (!result.ok) {
      setDeleteError(result.message)
      setConfirmDelete(false)
      return
    }
    setConfirmDelete(false)
    crud.close()
    await crud.load(true)
  }

  const draft = crud.draft
  const isEditing = Boolean(crud.original)

  return (
    <AdminPage>
      <AdminPageHeader
        title="مكتبة الخيارات"
        description="تعريفات خيارات قابلة لإعادة الاستخدام تُربط بأي منتج (نكهة، عجينة سكر، إضافات…)."
        actions={
          <>
            <AdminButton
              icon={<IconRefresh size={18} />}
              loading={crud.refreshing}
              disabled={crud.loading}
              onClick={() => void crud.load(true)}
            >
              تحديث
            </AdminButton>
            <AdminButton
              variant="primary"
              icon={<IconPlus size={18} />}
              disabled={crud.loading}
              onClick={() => crud.open({ ...emptyDefinition, sort_order: nextSort.current }, null)}
            >
              خيار جديد
            </AdminButton>
          </>
        }
      />

      {!crud.loading && !crud.error && crud.rows.length > 0 ? (
        <CatalogToolbar
          id="options-search"
          placeholder="ابحثي باسم الخيار"
          filter={filter}
          total={crud.rows.length}
          visible={filter.filtered.length}
          noun="خيار"
        />
      ) : null}

      <CatalogResults
        loading={crud.loading}
        error={crud.error}
        onRetry={() => void crud.load(true)}
        retrying={crud.refreshing}
        total={crud.rows.length}
        visible={filter.filtered.length}
        emptyTitle="لا توجد خيارات"
        emptyDescription="أضيفي أول تعريف قابل لإعادة الاستخدام ثم اربطه بالمنتجات."
        emptyIcon={<IconLayers />}
        addLabel="خيار جديد"
        onAdd={() => crud.open({ ...emptyDefinition, sort_order: nextSort.current }, null)}
        onClearFilters={() => {
          filter.setQuery('')
          filter.setEnabled('all')
        }}
        table={
          <AdminTable
            caption="مكتبة الخيارات"
            head={
              <>
                <Th>الاسم</Th>
                <Th>النوع</Th>
                <Th className="hidden lg:table-cell">الترتيب</Th>
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
                <Td>{SELECTION_LABELS[row.selection_type]}</Td>
                <Td className="hidden lg:table-cell" dir="ltr">
                  {row.sort_order}
                </Td>
                <Td>
                  <EnabledBadge enabled={row.enabled} />
                </Td>
                <Td>
                  <EditButton label={`تعديل ${row.name}`} onClick={() => crud.open({ ...row }, row)} />
                </Td>
              </Tr>
            ))}
          </AdminTable>
        }
        list={
          <AdminList>
            {filter.filtered.map((row) => (
              <CatalogListItem
                key={row.id}
                title={row.name}
                subtitle={SELECTION_LABELS[row.selection_type]}
                meta={`ترتيب ${row.sort_order}`}
                badges={<EnabledBadge enabled={row.enabled} />}
                editLabel={`تعديل ${row.name}`}
                onEdit={() => crud.open({ ...row }, row)}
              />
            ))}
          </AdminList>
        }
      />

      <CatalogEditor
        crud={crud}
        size="lg"
        newTitle="خيار جديد"
        editTitle="تعديل الخيار"
        disableTitle="إخفاء الخيار؟"
        disableBody="لن يظهر هذا التعريف للربط بمنتجات جديدة بعد الحفظ. الروابط الحالية تبقى حسب إعداد كل منتج."
      >
        {draft ? (
          <>
            <section className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <AdminTextField
                  id="odef-name"
                  label="اسم الخيار"
                  required
                  value={draft.name}
                  error={crud.fieldErrors.name}
                  onChange={(e) => crud.update({ name: e.target.value })}
                />
                <AdminSelectField
                  id="odef-type"
                  label="نوع الواجهة"
                  required
                  value={draft.selection_type}
                  onChange={(e) => crud.update({ selection_type: e.target.value as ProductOptionSelection })}
                >
                  {(Object.keys(SELECTION_LABELS) as ProductOptionSelection[]).map((key) => (
                    <option key={key} value={key}>
                      {SELECTION_LABELS[key]}
                    </option>
                  ))}
                </AdminSelectField>
                <AdminTextAreaField
                  id="odef-desc"
                  label="الوصف"
                  wrapperClassName="sm:col-span-2"
                  value={draft.description}
                  onChange={(e) => crud.update({ description: e.target.value })}
                />
                <AdminTextField
                  id="odef-sort"
                  label="ترتيب العرض"
                  type="number"
                  hint={SORT_HINT}
                  value={String(draft.sort_order)}
                  onChange={(e) => crud.update({ sort_order: Number(e.target.value) })}
                />
              </div>
              <AdminSwitch
                id="odef-enabled"
                label="مفعّل في المكتبة"
                description="عند إيقافه لن يظهر للربط بمنتجات جديدة."
                checked={draft.enabled}
                onChange={(enabled) => crud.update({ enabled })}
              />
            </section>

            {isEditing && crud.original ? (
              <ValuesEditor definitionId={crud.original.id} selectionType={draft.selection_type} />
            ) : (
              <p className="text-[0.8125rem] text-muted">احفظي الخيار أولًا ثم أضيفي القيم.</p>
            )}

            {isEditing && crud.original ? (
              <div className="grid gap-2 border-t border-line pt-4">
                <AdminButton size="sm" variant="dangerOutline" onClick={() => setConfirmDelete(true)}>
                  حذف التعريف
                </AdminButton>
                {deleteError ? (
                  <p className="text-[0.8125rem] font-semibold text-[#8a2e2e]" role="alert">
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
        title="حذف تعريف الخيار؟"
        body="لا يمكن الحذف إذا كان مربوطًا بمنتجات. افصلي الروابط أولًا أو أخفي التعريف."
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
