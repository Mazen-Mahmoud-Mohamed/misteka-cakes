import { useEffect, useState } from 'react'
import { AdminAlert, useFlash } from '@/components/admin/AdminAlert'
import { Button } from '@/components/ui/Button'
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { listAdminFillings, upsertAdminFilling, type AdminFillingRow } from '@/services/admin/adminCatalogService'
import type { ChargeStatus } from '@/types'
import { formatEgp } from '@/utils/format'

const empty: AdminFillingRow = {
  id: '',
  name: '',
  description: '',
  price: null,
  price_status: 'pending',
  sort_order: 100,
  enabled: true,
}

export function AdminFillingsPage() {
  const [rows, setRows] = useState<AdminFillingRow[]>([])
  const [draft, setDraft] = useState<AdminFillingRow>(empty)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { flash, setFlash, clearFlash } = useFlash()

  async function load() {
    setLoading(true)
    const res = await listAdminFillings()
    if (res.error) {
      setError(res.error)
      setRows([])
    } else {
      setError('')
      setRows(res.data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  async function save() {
    if (!draft.id.trim() || !draft.name.trim()) {
      setFlash({ tone: 'error', text: 'أدخلي المعرّف والاسم.' })
      return
    }
    setSaving(true)
    const result = await upsertAdminFilling({
      ...draft,
      id: draft.id.trim(),
      price: draft.price == null || Number.isNaN(Number(draft.price)) ? null : Number(draft.price),
      sort_order: Number(draft.sort_order) || 0,
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
          <h2 className="font-display text-4xl text-rose-deep">الحشوات</h2>
          <p className="mt-2 text-muted">إدارة الحشوات وأسعارها المعروضة في الطلب.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => void load()}>تحديث</Button>
          <Button type="button" onClick={() => { setDraft({ ...empty, sort_order: (rows.at(-1)?.sort_order ?? 0) + 10 }); setEditing(true) }}>إضافة حشوة</Button>
        </div>
      </header>

      {flash ? <div className="mb-4"><AdminAlert tone={flash.tone} onClose={clearFlash}>{flash.text}</AdminAlert></div> : null}
      {loading ? <p className="text-muted">جاري التحميل...</p> : null}
      {error ? <p role="alert" className="text-rose-deep">{error}</p> : null}
      {!loading && !error && rows.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line bg-paper p-8 text-center text-muted">لا توجد حشوات.</p>
      ) : null}

      <ul className="grid gap-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-3xl border border-line bg-paper p-4 shadow-soft">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{row.name} <span className="text-muted">({row.id})</span></p>
                <p className="mt-1 text-sm text-muted">
                  {row.price == null ? 'السعر غير محدد' : formatEgp(Number(row.price))} ·{' '}
                  {row.price_status === 'known'
                    ? 'معروف'
                    : row.price_status === 'pending'
                      ? 'غير محدد بعد'
                      : row.price_status === 'quote'
                        ? 'يُحدَّد بعد المعاينة'
                        : 'خارج السعر'}
                  {row.enabled ? '' : ' · معطّلة'}
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={() => { setDraft({ ...row }); setEditing(true) }}>تعديل</Button>
            </div>
          </li>
        ))}
      </ul>

      {editing ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-line bg-paper p-6 shadow-soft">
            <h3 className="font-display text-2xl text-rose-deep">حفظ الحشوة</h3>
            <div className="mt-4 grid gap-3">
              <TextField id="fill-id" label="المعرّف" dir="ltr" className="text-start" value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} />
              <TextField id="fill-name" label="الاسم" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              <TextAreaField id="fill-desc" label="الوصف" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              <TextField
                id="fill-price"
                label="السعر (اتركه فارغًا إذا غير محدد)"
                type="number"
                dir="ltr"
                className="text-start"
                value={draft.price == null ? '' : String(draft.price)}
                onChange={(e) => setDraft({ ...draft, price: e.target.value === '' ? null : Number(e.target.value) })}
              />
              <SelectField id="fill-status" label="حالة السعر" value={draft.price_status} onChange={(e) => setDraft({ ...draft, price_status: e.target.value as ChargeStatus })}>
                <option value="known">معروف</option>
                <option value="pending">غير محدد بعد</option>
                <option value="quote">يُحدَّد بعد المعاينة</option>
                <option value="outside">خارج السعر</option>
              </SelectField>
              <TextField id="fill-sort" label="ترتيب العرض" type="number" dir="ltr" className="text-start" value={String(draft.sort_order)} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} />
              <label className="flex min-h-11 items-center gap-2 font-semibold">
                <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
                مفعّلة في الموقع
              </label>
            </div>
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
