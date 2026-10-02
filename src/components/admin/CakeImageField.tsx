import { useRef, useState } from 'react'
import { AdminButton } from '@/components/admin/AdminButton'
import { IconImage } from '@/components/admin/icons'
import { resolveCakeImage } from '@/data/localCatalog'
import { uploadCakeImage, validateCakeImage } from '@/services/admin/adminCatalogService'
import { cx } from '@/utils/cx'

const ACCEPT = 'image/jpeg,image/png,image/webp'

/**
 * Uploads immediately on pick so the admin sees real progress; the parent owns
 * cleanup of uploads that never get saved.
 */
export function CakeImageField({
  id,
  value,
  error,
  onUploaded,
  onRemove,
  onBusyChange,
}: {
  id: string
  value: string
  error?: string
  onUploaded: (path: string) => void
  onRemove: () => void
  onBusyChange?: (busy: boolean) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [localError, setLocalError] = useState('')
  const uploading = progress !== null
  const shownError = localError || error

  async function handleFile(file: File | undefined) {
    if (!file) return
    const invalid = validateCakeImage(file)
    if (invalid) {
      setLocalError(invalid)
      return
    }
    setLocalError('')
    setProgress(0)
    onBusyChange?.(true)
    const result = await uploadCakeImage(file, setProgress)
    setProgress(null)
    onBusyChange?.(false)
    if (result.error || !result.path) {
      setLocalError(result.error ?? 'تعذّر رفع الصورة.')
      return
    }
    onUploaded(result.path)
  }

  return (
    <div className="grid content-start gap-1.5 sm:col-span-2">
      <p id={`${id}-label`} className="text-sm font-semibold text-ink">
        صورة التورتة
        <span className="ms-1 text-[#8a2e2e]" aria-hidden="true">
          *
        </span>
      </p>
      <div
        className={cx(
          'flex flex-col gap-4 rounded-lg border bg-ivory/60 p-3 sm:flex-row sm:items-center',
          shownError ? 'border-[#9a3434]' : 'border-line',
        )}
      >
        <div className="grid aspect-[4/5] w-28 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-cream">
          {value ? (
            <img src={resolveCakeImage(value)} alt="معاينة صورة التورتة" className="size-full object-cover" />
          ) : (
            <IconImage className="text-muted" />
          )}
        </div>
        <div className="grid min-w-0 flex-1 gap-2">
          {uploading ? (
            <div className="grid gap-1.5" aria-live="polite">
              <p className="text-sm font-semibold text-ink">جارٍ رفع الصورة... {progress}%</p>
              <div
                className="h-2 overflow-hidden rounded-full bg-cream"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress ?? 0}
                aria-labelledby={`${id}-label`}
              >
                <div className="h-full rounded-full bg-rose-deep transition-[width] duration-150" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <AdminButton size="sm" variant={value ? 'secondary' : 'primary'} onClick={() => inputRef.current?.click()}>
                {value ? 'استبدال الصورة' : 'رفع صورة'}
              </AdminButton>
              {value ? (
                <AdminButton size="sm" variant="dangerOutline" onClick={onRemove}>
                  حذف الصورة
                </AdminButton>
              ) : null}
            </div>
          )}
          <p id={`${id}-hint`} className="text-[0.8125rem] leading-6 text-muted">
            JPG أو PNG أو WEBP، بحد أقصى 5 ميجابايت. يُفضّل صورة طولية.
          </p>
        </div>
      </div>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
        onChange={(e) => {
          void handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {shownError ? (
        <p className="text-[0.8125rem] leading-6 font-semibold text-[#8a2e2e]" role="alert">
          {shownError}
        </p>
      ) : null}
    </div>
  )
}
