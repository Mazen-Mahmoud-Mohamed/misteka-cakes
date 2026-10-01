import { EnabledBadge } from '@/components/admin/AdminBadge'
import { AdminAlert } from '@/components/admin/AdminAlert'
import { AdminButton } from '@/components/admin/AdminButton'
import { AdminPage, AdminPageHeader } from '@/components/admin/AdminCard'
import { AdminSwitch, AdminTextField } from '@/components/admin/AdminField'
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
import { IconMapPin, IconPlus, IconRefresh } from '@/components/admin/icons'
import { usePageTitle } from '@/hooks/usePageTitle'
import { listAdminZones, upsertAdminZone, type AdminZoneRow } from '@/services/admin/adminCatalogService'

export function AdminZonesPage() {
  usePageTitle('مناطق التوصيل | مستكة')
  const crud = useCatalogCrud<AdminZoneRow>({
    list: listAdminZones,
    upsert: upsertAdminZone,
    prepare: (draft) => ({
      ...draft,
      id: draft.id.trim(),
      sort_order: Number(draft.sort_order) || 0,
    }),
    validate: (draft) => ({
      id: draft.id.trim() ? undefined : 'أدخلي المعرّف.',
      name: draft.name.trim() ? undefined : 'أدخلي اسم المنطقة.',
    }),
  })
  const filter = useCatalogFilter(crud.rows, (row) => [row.name, row.id])

  function startNew() {
    crud.open({ id: '', name: '', enabled: true, sort_order: (crud.rows.at(-1)?.sort_order ?? 0) + 10 }, null)
  }

  const draft = crud.draft

  return (
    <AdminPage>
      <AdminPageHeader
        title="مناطق التوصيل"
        description="المناطق المفعّلة فقط تظهر للعميل عند اختيار التوصيل."
        actions={
          <>
            <AdminButton icon={<IconRefresh size={18} />} loading={crud.refreshing} disabled={crud.loading} onClick={() => void crud.load(true)}>
              تحديث
            </AdminButton>
            <AdminButton variant="primary" icon={<IconPlus size={18} />} onClick={startNew}>
              إضافة منطقة
            </AdminButton>
          </>
        }
      />

      <AdminAlert tone="info" className="mb-4">
        سعر التوصيل حاليًا عبر أوبر وعلى حساب العميل، وخارج سعر التورتة.
      </AdminAlert>

      {!crud.loading && !crud.error && crud.rows.length > 0 ? (
        <CatalogToolbar
          id="zones-search"
          placeholder="ابحثي باسم المنطقة أو المعرّف"
          filter={filter}
          total={crud.rows.length}
          visible={filter.filtered.length}
          noun="منطقة"
        />
      ) : null}

      <CatalogResults
        loading={crud.loading}
        error={crud.error}
        onRetry={() => void crud.load(true)}
        retrying={crud.refreshing}
        total={crud.rows.length}
        visible={filter.filtered.length}
        emptyTitle="لا توجد مناطق توصيل"
        emptyDescription="أضيفي المناطق التي يتوفر فيها التوصيل لتظهر للعملاء."
        emptyIcon={<IconMapPin />}
        addLabel="إضافة منطقة"
        onAdd={startNew}
        onClearFilters={() => {
          filter.setQuery('')
          filter.setEnabled('all')
        }}
        table={
          <AdminTable
            caption="مناطق التوصيل"
            head={
              <>
                <Th>المنطقة</Th>
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
                  <p className="font-bold">{row.name}</p>
                  <IdText>{row.id}</IdText>
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
          <AdminList label="مناطق التوصيل">
            {filter.filtered.map((row) => (
              <CatalogListItem
                key={row.id}
                title={row.name}
                subtitle={<IdText>{row.id}</IdText>}
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
        size="sm"
        newTitle="منطقة جديدة"
        editTitle="تعديل المنطقة"
        disableTitle="تعطيل المنطقة؟"
        disableBody="لن تظهر هذه المنطقة للعملاء عند اختيار التوصيل بعد الحفظ. الطلبات السابقة لا تتأثر."
      >
        {draft ? (
          <div className="grid gap-4">
            <AdminTextField
              id="zone-name"
              label="اسم المنطقة"
              required
              value={draft.name}
              error={crud.fieldErrors.name}
              onChange={(e) => crud.update({ name: e.target.value })}
            />
            <AdminTextField
              id="zone-id"
              label="المعرّف"
              required
              dir="ltr"
              className="text-start"
              value={draft.id}
              error={crud.fieldErrors.id}
              hint={crud.isNew ? `${ID_HINT_NEW} مثل cairo` : ID_HINT_EDIT}
              onChange={(e) => crud.update({ id: e.target.value })}
            />
            <AdminTextField
              id="zone-sort"
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
              id="zone-enabled"
              label="مفعّلة في الموقع"
              description="عند التعطيل لا تظهر المنطقة في خيارات التوصيل."
              checked={draft.enabled}
              onChange={(enabled) => crud.update({ enabled })}
            />
          </div>
        ) : null}
      </CatalogEditor>
    </AdminPage>
  )
}
