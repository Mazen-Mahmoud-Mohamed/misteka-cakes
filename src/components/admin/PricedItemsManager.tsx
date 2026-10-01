import type { ReactNode } from 'react'
import { EnabledBadge, PRICE_STATUS_LABELS, PriceStatusBadge } from '@/components/admin/AdminBadge'
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
  ID_HINT_EDIT,
  ID_HINT_NEW,
  IdText,
  SORT_HINT,
  useCatalogCrud,
  useCatalogFilter,
} from '@/components/admin/catalog'
import { IconPlus, IconRefresh } from '@/components/admin/icons'
import type { ChargeStatus } from '@/types'
import { formatEgp } from '@/utils/format'

export type PricedItemRow = {
  id: string
  name: string
  description: string
  price: number | null
  price_status: ChargeStatus
  sort_order: number
  enabled: boolean
}

/** Shared management screen for fillings and design extras (same row shape). */
export function PricedItemsManager<T extends PricedItemRow>({
  idPrefix,
  title,
  description,
  noun,
  addLabel,
  newTitle,
  editTitle,
  disableTitle,
  disableBody,
  emptyTitle,
  emptyDescription,
  icon,
  defaultStatus,
  list,
  upsert,
}: {
  idPrefix: string
  title: string
  description: string
  noun: string
  addLabel: string
  newTitle: string
  editTitle: string
  disableTitle: string
  disableBody: string
  emptyTitle: string
  emptyDescription: string
  icon: ReactNode
  defaultStatus: ChargeStatus
  list: () => Promise<{ data: T[] | null; error: string | null }>
  upsert: (row: T) => Promise<{ ok: boolean; message: string }>
}) {
  const crud = useCatalogCrud<T>({
    list,
    upsert,
    prepare: (draft) => ({
      ...draft,
      id: draft.id.trim(),
      price: draft.price == null || Number.isNaN(Number(draft.price)) ? null : Number(draft.price),
      sort_order: Number(draft.sort_order) || 0,
    }),
    validate: (draft) => ({
      id: draft.id.trim() ? undefined : 'أدخلي المعرّف.',
      name: draft.name.trim() ? undefined : 'أدخلي الاسم.',
    }),
  })
  const filter = useCatalogFilter(crud.rows, (row) => [row.name, row.id, row.description])

  function startNew() {
    crud.open(
      {
        id: '',
        name: '',
        description: '',
        price: null,
        price_status: defaultStatus,
        sort_order: (crud.rows.at(-1)?.sort_order ?? 0) + 10,
        enabled: true,
      } as T,
      null,
    )
  }

  const priceText = (row: T) => (row.price == null ? '—' : formatEgp(Number(row.price)))
  const draft = crud.draft

  return (
    <AdminPage>
      <AdminPageHeader
        title={title}
        description={description}
        actions={
          <>
            <AdminButton icon={<IconRefresh size={18} />} loading={crud.refreshing} disabled={crud.loading} onClick={() => void crud.load(true)}>
              تحديث
            </AdminButton>
            <AdminButton variant="primary" icon={<IconPlus size={18} />} onClick={startNew}>
              {addLabel}
            </AdminButton>
          </>
        }
      />

      {!crud.loading && !crud.error && crud.rows.length > 0 ? (
        <CatalogToolbar
          id={`${idPrefix}-search`}
          placeholder="ابحثي بالاسم أو المعرّف"
          filter={filter}
          total={crud.rows.length}
          visible={filter.filtered.length}
          noun={noun}
        />
      ) : null}

      <CatalogResults
        loading={crud.loading}
        error={crud.error}
        onRetry={() => void crud.load(true)}
        retrying={crud.refreshing}
        total={crud.rows.length}
        visible={filter.filtered.length}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        emptyIcon={icon}
        addLabel={addLabel}
        onAdd={startNew}
        onClearFilters={() => {
          filter.setQuery('')
          filter.setEnabled('all')
        }}
        table={
          <AdminTable
            caption={title}
            head={
              <>
                <Th>الاسم</Th>
                <Th className="text-end">السعر</Th>
                <Th>حالة السعر</Th>
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
                <Td className="max-w-md">
                  <p className="font-bold">{row.name}</p>
                  <IdText>{row.id}</IdText>
                  {row.description ? <p className="mt-0.5 line-clamp-1 text-xs text-muted">{row.description}</p> : null}
                </Td>
                <Td className="text-end font-bold whitespace-nowrap tabular-nums">{priceText(row)}</Td>
                <Td>
                  <PriceStatusBadge status={row.price_status} />
                </Td>
                <Td className="text-center text-muted tabular-nums">{row.sort_order}</Td>
                <Td>
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
          <AdminList label={title}>
            {filter.filtered.map((row) => (
              <CatalogListItem
                key={row.id}
                title={row.name}
                subtitle={<IdText>{row.id}</IdText>}
                meta={
                  <>
                    <span className="font-bold tabular-nums">{priceText(row)}</span>
                    {row.description ? <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{row.description}</span> : null}
                  </>
                }
                badges={
                  <>
                    <EnabledBadge enabled={row.enabled} />
                    <PriceStatusBadge status={row.price_status} />
                  </>
                }
                editLabel={`تعديل ${row.name}`}
                onEdit={() => crud.open({ ...row }, row)}
              />
            ))}
          </AdminList>
        }
      />

      <CatalogEditor crud={crud} newTitle={newTitle} editTitle={editTitle} disableTitle={disableTitle} disableBody={disableBody}>
        {draft ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminTextField
              id={`${idPrefix}-name`}
              label="الاسم"
              required
              value={draft.name}
              error={crud.fieldErrors.name}
              onChange={(e) => crud.update({ name: e.target.value } as Partial<T>)}
            />
            <AdminTextField
              id={`${idPrefix}-id`}
              label="المعرّف"
              required
              dir="ltr"
              className="text-start"
              value={draft.id}
              error={crud.fieldErrors.id}
              hint={crud.isNew ? ID_HINT_NEW : ID_HINT_EDIT}
              onChange={(e) => crud.update({ id: e.target.value } as Partial<T>)}
            />
            <AdminTextAreaField
              id={`${idPrefix}-desc`}
              label="الوصف"
              wrapperClassName="sm:col-span-2"
              value={draft.description}
              onChange={(e) => crud.update({ description: e.target.value } as Partial<T>)}
            />
            <AdminTextField
              id={`${idPrefix}-price`}
              label="السعر (جنيه)"
              type="number"
              inputMode="numeric"
              min={0}
              dir="ltr"
              className="text-start"
              hint="اتركيه فارغًا إذا لم يُحدَّد السعر بعد."
              value={draft.price == null ? '' : String(draft.price)}
              onChange={(e) => crud.update({ price: e.target.value === '' ? null : Number(e.target.value) } as Partial<T>)}
            />
            <AdminSelectField
              id={`${idPrefix}-status`}
              label="حالة السعر"
              value={draft.price_status}
              onChange={(e) => crud.update({ price_status: e.target.value as ChargeStatus } as Partial<T>)}
            >
              {(Object.keys(PRICE_STATUS_LABELS) as ChargeStatus[]).map((status) => (
                <option key={status} value={status}>
                  {PRICE_STATUS_LABELS[status]}
                </option>
              ))}
            </AdminSelectField>
            <AdminTextField
              id={`${idPrefix}-sort`}
              label="ترتيب العرض"
              type="number"
              inputMode="numeric"
              dir="ltr"
              className="text-start"
              hint={SORT_HINT}
              value={String(draft.sort_order)}
              onChange={(e) => crud.update({ sort_order: Number(e.target.value) } as Partial<T>)}
            />
            <div className="sm:col-span-2">
              <AdminSwitch
                id={`${idPrefix}-enabled`}
                label="مفعّل في الموقع"
                description="عند التعطيل لا يظهر هذا الخيار للعملاء في الطلب."
                checked={draft.enabled}
                onChange={(enabled) => crud.update({ enabled } as Partial<T>)}
              />
            </div>
          </div>
        ) : null}
      </CatalogEditor>
    </AdminPage>
  )
}
