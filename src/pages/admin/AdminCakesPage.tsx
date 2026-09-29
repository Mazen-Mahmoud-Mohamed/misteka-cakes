import { useEffect, useState } from 'react'
import { cakeImageMap } from '@/data/localCatalog'
import { AdminAlert, useFlash } from '@/components/admin/AdminAlert'
import { Button } from '@/components/ui/Button'
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field'
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

function toggleId(list: string[] | null, id: string): string[] {
  const current = list ?? []
  return current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
}

export function AdminCakesPage() {
  const [rows, setRows] = useState<AdminCakeRow[]>([])
  const [sizes, setSizes] = useState<AdminCakeSizeRow[]>([])
  const [fillings, setFillings] = useState<AdminFillingRow[]>([])
  const [extras, setExtras] = useState<AdminExtraRow[]>([])
  const [draft, setDraft] = useState<AdminCakeRow>(empty)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { flash, setFlash, clearFlash } = useFlash()

  async function load() {
    setLoading(true)
    const [cakesRes, sizesRes, fillingsRes, extrasRes] = await Promise.all([
      listAdminCakes(),
      listAdminSizes(),
      listAdminFillings(),
      listAdminExtras(),
    ])
    if (cakesRes.error) {
      setError(cakesRes.error)
      setRows([])
    } else {
      setError('')
      setRows(cakesRes.data ?? [])
    }
    setSizes(sizesRes.data ?? [])
    setFillings(fillingsRes.data ?? [])
    setExtras(extrasRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  function startNew() {
    setDraft({
      ...empty,
      sort_order: (rows.at(-1)?.sort_order ?? 0) + 10,
      available_size_ids: sizes.filter((s) => s.enabled).map((s) => s.id),
      filling_ids: fillings.filter((f) => f.enabled).map((f) => f.id),
      extra_ids: extras.filter((e) => e.enabled).map((e) => e.id),
    })
    setEditing(true)
  }

  async function save() {
    if (!draft.id.trim() || !draft.name.trim()) {
      setFlash({ tone: 'error', text: 'أدخلي المعرّف والاسم.' })
      return
    }
    setSaving(true)
    const result = await upsertAdminCake({
      ...draft,
      id: draft.id.trim(),
      sort_order: Number(draft.sort_order) || 0,
      base_price: draft.base_price == null || Number.isNaN(Number(draft.base_price)) ? null : Number(draft.base_price),
    })
    setSaving(false)
    setFlash({ tone: result.ok ? 'success' : 'error', text: result.message })
    if (result.ok) {
      setEditing(false)
      await load()
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-4xl text-rose-deep">التورت</h2>
          <p className="mt-2 text-muted">إدارة تصاميم الكتالوج المتاحة للعملاء.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => void load()}>تحديث</Button>
          <Button type="button" onClick={startNew}>إضافة تورتة</Button>
        </div>
      </header>

      {flash ? <div className="mb-4"><AdminAlert tone={flash.tone} onClose={clearFlash}>{flash.text}</AdminAlert></div> : null}
      {loading ? <p className="text-muted">جاري التحميل...</p> : null}
      {error ? <p role="alert" className="text-rose-deep">{error}</p> : null}
      {!loading && !error && rows.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line bg-paper p-8 text-center text-muted">لا توجد تورت.</p>
      ) : null}

      <ul className="grid gap-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-3xl border border-line bg-paper p-4 shadow-soft">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{row.name} <span className="text-muted">({row.id})</span></p>
                <p className="mt-1 text-sm text-muted">
                  {row.category === 'birthday' ? 'عيد ميلاد' : 'مناسبة'} · صورة: {row.image_key}
                  {row.enabled ? '' : ' · معطّلة'}
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={() => { setDraft({ ...row, available_size_ids: row.available_size_ids ?? [], filling_ids: row.filling_ids ?? [], extra_ids: row.extra_ids ?? [] }); setEditing(true) }}>
                تعديل
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {editing ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-line bg-paper p-6 shadow-soft">
            <h3 className="font-display text-2xl text-rose-deep">تعديل التورتة</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <TextField id="cake-id" label="المعرّف" dir="ltr" className="text-start" value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} />
              <TextField id="cake-name" label="الاسم" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              <SelectField id="cake-category" label="التصنيف" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as 'birthday' | 'celebration' })}>
                <option value="birthday">عيد ميلاد</option>
                <option value="celebration">مناسبة</option>
              </SelectField>
              <SelectField id="cake-image" label="مفتاح الصورة" value={draft.image_key} onChange={(e) => setDraft({ ...draft, image_key: e.target.value })}>
                {Object.keys(cakeImageMap).map((key) => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </SelectField>
              <div className="sm:col-span-2">
                <TextAreaField id="cake-desc" label="الوصف" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </div>
              <TextField id="cake-alt" label="وصف الصورة" value={draft.image_alt} onChange={(e) => setDraft({ ...draft, image_alt: e.target.value })} />
              <TextField id="cake-sort" label="ترتيب العرض" type="number" dir="ltr" className="text-start" value={String(draft.sort_order)} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} />
              <div className="sm:col-span-2">
                <TextField id="cake-note" label="ملاحظة السعر" value={draft.price_note} onChange={(e) => setDraft({ ...draft, price_note: e.target.value })} />
              </div>
              <label className="flex min-h-11 items-center gap-2 font-semibold sm:col-span-2">
                <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
                مفعّلة في الموقع
              </label>
            </div>

            <fieldset className="mt-5">
              <legend className="font-semibold">المقاسات المتاحة</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {sizes.map((size) => (
                  <label key={size.id} className="flex min-h-10 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={(draft.available_size_ids ?? []).includes(size.id)}
                      onChange={() => setDraft({ ...draft, available_size_ids: toggleId(draft.available_size_ids, size.id) })}
                    />
                    {size.label} ({size.id})
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-5">
              <legend className="font-semibold">الحشوات المتاحة</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {fillings.map((item) => (
                  <label key={item.id} className="flex min-h-10 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={(draft.filling_ids ?? []).includes(item.id)}
                      onChange={() => setDraft({ ...draft, filling_ids: toggleId(draft.filling_ids, item.id) })}
                    />
                    {item.name}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-5">
              <legend className="font-semibold">الإضافات المتاحة</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {extras.map((item) => (
                  <label key={item.id} className="flex min-h-10 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={(draft.extra_ids ?? []).includes(item.id)}
                      onChange={() => setDraft({ ...draft, extra_ids: toggleId(draft.extra_ids, item.id) })}
                    />
                    {item.name}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" disabled={saving} onClick={() => setEditing(false)}>إلغاء</Button>
              <Button type="button" disabled={saving} onClick={() => void save()}>{saving ? 'جارٍ الحفظ...' : 'حفظ'}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
