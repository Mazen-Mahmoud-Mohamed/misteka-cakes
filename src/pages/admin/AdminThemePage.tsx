import { useCallback, useEffect, useState } from 'react'
import { AdminAlert, AdminToast, useFlash } from '@/components/admin/AdminAlert'
import { AdminPage, AdminPageHeader, AdminCard } from '@/components/admin/AdminCard'
import { AdminSwitch } from '@/components/admin/AdminField'
import { AdminErrorState, AdminListSkeleton } from '@/components/admin/AdminStates'
import { usePageTitle } from '@/hooks/usePageTitle'
import { listAdminThemes, setThemeEnabled } from '@/services/admin/adminThemeService'
import type { SiteThemeRow, ThemeId } from '@/types/theme'

function rowMap(rows: SiteThemeRow[]): Record<ThemeId, SiteThemeRow | undefined> {
  return {
    pixel_snow: rows.find((r) => r.id === 'pixel_snow'),
    ramadan: rows.find((r) => r.id === 'ramadan'),
  }
}

export function AdminThemePage() {
  usePageTitle('المظهر | مستكة')
  const { flash, setFlash, clearFlash } = useFlash()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rows, setRows] = useState<SiteThemeRow[]>([])
  const [saving, setSaving] = useState<ThemeId | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await listAdminThemes()
    if (result.error || !result.data) {
      setError(result.error || 'تعذّر تحميل إعدادات المظهر.')
      setRows([])
    } else {
      setError('')
      setRows(result.data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function toggle(id: ThemeId, enabled: boolean) {
    setSaving(id)
    const previous = rows
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, enabled } : row)),
    )

    const result = await setThemeEnabled(id, enabled)
    if (!result.ok) {
      setRows(previous)
      setFlash({ tone: 'error', text: result.message })
      setSaving(null)
      return
    }

    setRows((prev) => {
      const without = prev.filter((row) => row.id !== id)
      return [...without, result.row]
    })
    setFlash({ tone: 'success', text: result.message })
    setSaving(null)
  }

  const map = rowMap(rows)
  const snowEnabled = map.pixel_snow?.enabled ?? true
  const ramadanEnabled = map.ramadan?.enabled ?? false

  return (
    <AdminPage width="narrow">
      <AdminPageHeader
        title="المظهر"
        description="تحكّمي في المؤثرات والمظاهر الموسمية الظاهرة لزوّار الموقع."
      />

      {loading ? <AdminListSkeleton rows={3} /> : null}

      {!loading && error ? (
        <AdminErrorState description={error} onRetry={() => void load()} />
      ) : null}

      {!loading && !error ? (
        <AdminCard title="المؤثرات والمظاهر" bodyClassName="grid gap-4">
          <AdminSwitch
            id="theme-pixel-snow"
            label="تأثير Pixel Snow"
            description="إظهار تأثير الثلج البكسلي في خلفية الموقع."
            checked={snowEnabled}
            onChange={(next) => {
              if (saving) return
              void toggle('pixel_snow', next)
            }}
          />

          <AdminSwitch
            id="theme-ramadan"
            label="المظهر الرمضاني"
            description="تفعيل الزينة الرمضانية (فوانيس، هلال، وزخارف خفيفة) في خلفية صفحات الزوّار."
            checked={ramadanEnabled}
            onChange={(next) => {
              if (saving) return
              void toggle('ramadan', next)
            }}
          />

          {ramadanEnabled ? (
            <AdminAlert tone="info" title="المظهر الرمضاني مفعّل">
              تظهر الزينة الرمضانية لزوّار الموقع بعد تحديث الصفحة. لوحة الإدارة تبقى بدون زينة.
            </AdminAlert>
          ) : null}
        </AdminCard>
      ) : null}

      <AdminToast flash={flash} onClose={clearFlash} />
    </AdminPage>
  )
}
