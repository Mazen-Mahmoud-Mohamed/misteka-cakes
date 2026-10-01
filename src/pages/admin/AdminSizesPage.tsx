import { EnabledBadge } from '@/components/admin/AdminBadge'
import { AdminButton } from '@/components/admin/AdminButton'
import { AdminPage, AdminPageHeader } from '@/components/admin/AdminCard'
import { AdminSelectField, AdminSwitch, AdminTextField } from '@/components/admin/AdminField'
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
import { IconPlus, IconRefresh, IconRuler } from '@/components/admin/icons'
import { usePageTitle } from '@/hooks/usePageTitle'
import {
  listAdminSizes,
  upsertAdminSize,
  type AdminCakeSizeRow,
} from '@/services/admin/adminCatalogService'
import { formatEgp } from '@/utils/format'

const empty: AdminCakeSizeRow = {
  id: '',
  pricing_group: 'single',
  label: '',
  servings_label: '',
  servings_min: null,
  servings_max: null,
  price: 0,
  sort_order: 100,
  enabled: true,
}

const GROUP_LABELS: Record<AdminCakeSizeRow['pricing_group'], string> = {
  single: 'طبقة واحدة',
  'two-tier': 'طابقين',
}

export function AdminSizesPage() {
  usePageTitle('المقاسات والأسعار | مستكة')
  const crud = useCatalogCrud<AdminCakeSizeRow>({
    list: listAdminSizes,
    upsert: upsertAdminSize,
    prepare: (draft) => ({
      ...draft,
      id: draft.id.trim(),
      price: Number(draft.price) || 0,
      sort_order: Number(draft.sort_order) || 0,
      servings_min: draft.servings_min == null || Number.isNaN(Number(draft.servings_min)) ? null : Number(draft.servings_min),
      servings_max: draft.servings_max == null || Number.isNaN(Number(draft.servings_max)) ? null : Number(draft.servings_max),
    }),
    validate: (draft) => ({
      id: draft.id.trim() ? undefined : 'أدخلي المعرّف.',
      label: draft.label.trim() ? undefined : 'أدخلي اسم المقاس.',
    }),
  })
  const filter = useCatalogFilter(crud.rows, (row) => [row.label, row.id, row.servings_label])

  function startNew() {
    crud.open({ ...empty, sort_order: (crud.rows.at(-1)?.sort_order ?? 0) + 10 }, null)
  }

  const groups = (['single', 'two-tier'] as const)
    .map((group) => ({ group, rows: filter.filtered.filter((r) => r.pricing_group === group) }))
    .filter((g) => g.rows.length > 0)

  const draft = crud.draft

  return (
    <AdminPage>
      <AdminPageHeader
        title="المقاسات والأسعار"
        description="مصدر أسعار التورت في الطلبات والكتالوج. المقاسات غير المفعّلة لا تظهر للعملاء."
        actions={
          <>
            <AdminButton icon={<IconRefresh size={18} />} loading={crud.refreshing} disabled={crud.loading} onClick={() => void crud.load(true)}>
              تحديث
            </AdminButton>
            <AdminButton variant="primary" icon={<IconPlus size={18} />} onClick={startNew}>
              إضافة مقاس
            </AdminButton>
          </>
        }
      />

      {!crud.loading && !crud.error && crud.rows.length > 0 ? (
        <CatalogToolbar
          id="sizes-search"
          placeholder="ابحثي بالمقاس أو المعرّف"
          filter={filter}
          total={crud.rows.length}
          visible={filter.filtered.length}
          noun="مقاس"
        />
      ) : null}

      <CatalogResults
        loading={crud.loading}
        error={crud.error}
        onRetry={() => void crud.load(true)}
        retrying={crud.refreshing}
        total={crud.rows.length}
        visible={filter.filtered.length}
        emptyTitle="لا توجد مقاسات"
        emptyDescription="أضيفي أول مقاس وسعره ليظهر في الطلب والكتالوج."
        emptyIcon={<IconRuler />}
        addLabel="إضافة مقاس"
        onAdd={startNew}
        onClearFilters={() => {
          filter.setQuery('')
          filter.setEnabled('all')
        }}
        table={
          <div className="grid gap-5">
            {groups.map(({ group, rows }) => (
              <section key={group} aria-labelledby={`group-${group}`}>
                <h2 id={`group-${group}`} className="mb-2 text-sm font-bold text-ink">
                  {GROUP_LABELS[group]} <span className="font-semibold text-muted">({rows.length})</span>
                </h2>
                <AdminTable
                  caption={`مقاسات ${GROUP_LABELS[group]}`}
                  head={
                    <>
                      <Th>المقاس</Th>
                      <Th>عدد الأفراد</Th>
                      <Th className="text-end">السعر</Th>
                      <Th className="text-center">الترتيب</Th>
                      <Th>الحالة</Th>
                      <Th>
                        <span className="sr-only">إجراء</span>
                      </Th>
                    </>
                  }
                >
                  {rows.map((row) => (
                    <Tr key={row.id} className={row.enabled ? undefined : 'bg-cream/30'}>
                      <Td>
                        <p className="font-bold">{row.label}</p>
                        <IdText>{row.id}</IdText>
                      </Td>
                      <Td>{row.servings_label || '—'}</Td>
                      <Td className="text-end font-bold whitespace-nowrap tabular-nums">{formatEgp(Number(row.price))}</Td>
                      <Td className="text-center text-muted tabular-nums">{row.sort_order}</Td>
                      <Td>
                        <EnabledBadge enabled={row.enabled} />
                      </Td>
                      <Td className="w-px text-end">
                        <EditButton label={`تعديل ${row.label}`} onClick={() => crud.open({ ...row }, row)} />
                      </Td>
                    </Tr>
                  ))}
                </AdminTable>
              </section>
            ))}
          </div>
        }
        list={
          <div className="grid gap-5">
            {groups.map(({ group, rows }) => (
              <section key={group} aria-labelledby={`group-m-${group}`}>
                <h2 id={`group-m-${group}`} className="mb-2 text-sm font-bold text-ink">
                  {GROUP_LABELS[group]} <span className="font-semibold text-muted">({rows.length})</span>
                </h2>
                <AdminList>
                  {rows.map((row) => (
                    <CatalogListItem
                      key={row.id}
                      title={row.label}
                      subtitle={<IdText>{row.id}</IdText>}
                      meta={
                        <>
                          <span className="font-bold tabular-nums">{formatEgp(Number(row.price))}</span>
                          {row.servings_label ? <span className="text-muted"> · يكفي {row.servings_label}</span> : null}
                        </>
                      }
                      badges={<EnabledBadge enabled={row.enabled} />}
                      editLabel={`تعديل ${row.label}`}
                      onEdit={() => crud.open({ ...row }, row)}
                    />
                  ))}
                </AdminList>
              </section>
            ))}
          </div>
        }
      />

      <CatalogEditor
        crud={crud}
        newTitle="مقاس جديد"
        editTitle="تعديل المقاس"
        disableTitle="تعطيل المقاس؟"
        disableBody="لن يظهر هذا المقاس للعملاء في الطلب والكتالوج بعد الحفظ. يمكنك إعادة تفعيله لاحقًا."
      >
        {draft ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminTextField
              id="size-label"
              label="اسم المقاس"
              required
              value={draft.label}
              error={crud.fieldErrors.label}
              hint="مثل: 24 سم"
              onChange={(e) => crud.update({ label: e.target.value })}
            />
            <AdminTextField
              id="size-id"
              label="المعرّف"
              required
              dir="ltr"
              className="text-start"
              value={draft.id}
              error={crud.fieldErrors.id}
              hint={crud.isNew ? `${ID_HINT_NEW} مثل single-24` : ID_HINT_EDIT}
              onChange={(e) => crud.update({ id: e.target.value })}
            />
            <AdminSelectField
              id="size-group"
              label="النوع"
              value={draft.pricing_group}
              onChange={(e) => crud.update({ pricing_group: e.target.value as AdminCakeSizeRow['pricing_group'] })}
            >
              <option value="single">طبقة واحدة</option>
              <option value="two-tier">طابقين</option>
            </AdminSelectField>
            <AdminTextField
              id="size-servings-label"
              label="وصف الأفراد"
              value={draft.servings_label}
              hint="مثل: 20 - 23 فرد"
              onChange={(e) => crud.update({ servings_label: e.target.value })}
            />
            <AdminTextField
              id="size-price"
              label="السعر (جنيه)"
              type="number"
              inputMode="numeric"
              min={0}
              dir="ltr"
              className="text-start"
              value={String(draft.price)}
              onChange={(e) => crud.update({ price: Number(e.target.value) })}
            />
            <AdminTextField
              id="size-sort"
              label="ترتيب العرض"
              type="number"
              inputMode="numeric"
              dir="ltr"
              className="text-start"
              value={String(draft.sort_order)}
              hint={SORT_HINT}
              onChange={(e) => crud.update({ sort_order: Number(e.target.value) })}
            />
            <div className="sm:col-span-2">
              <AdminSwitch
                id="size-enabled"
                label="مفعّل في الموقع"
                description="عند التعطيل يختفي المقاس من الطلب والكتالوج."
                checked={draft.enabled}
                onChange={(enabled) => crud.update({ enabled })}
              />
            </div>
          </div>
        ) : null}
      </CatalogEditor>
    </AdminPage>
  )
}
