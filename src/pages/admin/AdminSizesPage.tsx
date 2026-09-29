import { useEffect, useState } from 'react'
import { AdminAlert, useFlash } from '@/components/admin/AdminAlert'
import { Button } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/Field'
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

export function AdminSizesPage() {
  const [rows, setRows] = useState<AdminCakeSizeRow[]>([])
  const [draft, setDraft] = useState<AdminCakeSizeRow>(empty)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { flash, setFlash, clearFlash } = useFlash()

  async function load() {
    setLoading(true)
    const res = await listAdminSizes()
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

  function startNew() {
    setDraft({ ...empty, sort_order: (rows.at(-1)?.sort_order ?? 0) + 10 })
    setEditing(true)
  }

  function startEdit(row: AdminCakeSizeRow) {
    setDraft({ ...row })
    setEditing(true)
  }

  async function save() {
    if (!draft.id.trim() || !draft.label.trim()) {
      setFlash({ tone: 'error', text: 'أدخلي المعرّف والاسم.' })
      return
    }
    setSaving(true)
    const result = await upsertAdminSize({
      ...draft,
      id: draft.id.trim(),
      price: Number(draft.price) || 0,
      sort_order: Number(draft.sort_order) || 0,
      servings_min: draft.servings_min == null || Number.isNaN(Number(draft.servings_min)) ? null : Number(draft.servings_min),
      servings_max: draft.servings_max == null || Number.isNaN(Number(draft.servings_max)) ? null : Number(draft.servings_max),
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
          <h2 className="font-display text-4xl text-rose-deep">المقاسات والأسعار</h2>
          <p className="mt-2 text-muted">مصدر أسعار التورت في الطلبات والكتالوج.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => void load()}>
            تحديث
          </Button>
          <Button type="button" onClick={startNew}>
            إضافة مقاس
          </Button>
        </div>
      </header>

      {flash ? <div className="mb-4"><AdminAlert tone={flash.tone} onClose={clearFlash}>{flash.text}</AdminAlert></div> : null}
      {loading ? <p className="text-muted">جاري التحميل...</p> : null}
      {error ? <p role="alert" className="text-rose-deep">{error}</p> : null}
      {!loading && !error && rows.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line bg-paper p-8 text-center text-muted">لا توجد مقاسات.</p>
      ) : null}

      <ul className="grid gap-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-3xl border border-line bg-paper p-4 shadow-soft">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-ink">{row.label} <span className="text-muted">({row.id})</span></p>
                <p className="mt-1 text-sm text-muted">
                  {row.pricing_group === 'single' ? 'طبقة واحدة' : 'طابقين'} · {row.servings_label} · {formatEgp(Number(row.price))}
                  {row.enabled ? '' : ' · معطّل'}
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={() => startEdit(row)}>
                تعديل
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {editing ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-line bg-paper p-6 shadow-soft">
            <h3 className="font-display text-2xl text-rose-deep">{draft.id && rows.some((r) => r.id === draft.id) ? 'تعديل مقاس' : 'مقاس جديد'}</h3>
            <div className="mt-4 grid gap-3">
              <TextField id="size-id" label="المعرّف" dir="ltr" className="text-start" value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} hint="مثل single-24" />
              <TextField id="size-label" label="الاسم" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
              <SelectField id="size-group" label="النوع" value={draft.pricing_group} onChange={(e) => setDraft({ ...draft, pricing_group: e.target.value as 'single' | 'two-tier' })}>
                <option value="single">طبقة واحدة</option>
                <option value="two-tier">طابقين</option>
              </SelectField>
              <TextField id="size-servings-label" label="وصف الأفراد" value={draft.servings_label} onChange={(e) => setDraft({ ...draft, servings_label: e.target.value })} />
              <TextField id="size-price" label="السعر (جنيه)" type="number" dir="ltr" className="text-start" value={String(draft.price)} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} />
              <TextField id="size-sort" label="ترتيب العرض" type="number" dir="ltr" className="text-start" value={String(draft.sort_order)} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} />
              <label className="flex min-h-11 items-center gap-2 font-semibold">
                <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
                مفعّل في الموقع
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
