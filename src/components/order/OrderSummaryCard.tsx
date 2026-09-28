import type { SummaryView } from '@/services/orderService'
import { chargeAmountLabel, formatEgp } from '@/utils/format'

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line/80 py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="max-w-[60%] text-end font-semibold text-ink">{value}</dd>
    </div>
  )
}

export function OrderSummaryCard({ summary }: { summary: SummaryView }) {
  const total = summary.estimatedTotal == null ? 'يُحدَّد لاحقًا' : formatEgp(summary.estimatedTotal)

  return (
    <article className="rounded-[28px] border border-gold/50 bg-gold-soft/25 p-2">
      <div className="rounded-[22px] border border-line bg-paper p-5 sm:p-7">
        <h3 className="font-display text-4xl text-rose-deep">ملخص الطلب</h3>
        <dl className="mt-4">
          <Row label="الاسم" value={summary.customerName} />
          <Row label="الموبايل" value={summary.phone} />
          <Row label="التورتة" value={summary.cakeName} />
          <Row label="المقاس" value={summary.sizeLabel} />
          <Row label="عدد الأفراد" value={summary.servingsLabel} />
          <Row label="الحشوة" value={summary.fillingName} />
          <Row label="إضافات التصميم" value={summary.extraNames.length ? summary.extraNames.join('، ') : 'بدون'} />
          <Row label="الخدمة" value={summary.serviceLabel} />
          <Row label="المنطقة" value={summary.areaLabel} />
          <Row label="العنوان" value={summary.addressNotes} />
          <Row label="موعد الاستلام" value={summary.dateLabel} />
          <Row label="الوقت" value={summary.timeLabel} />
        </dl>

        {summary.notes ? (
          <p className="mt-4 rounded-2xl bg-ivory px-4 py-3 text-sm leading-7 text-ink">
            <span className="font-semibold">ملاحظات التصميم: </span>
            {summary.notes}
          </p>
        ) : null}

        <div className="mt-5 border-t border-dashed border-gold-soft pt-4">
          <p className="text-sm text-muted">الإجمالي التقريبي</p>
          <p className="mt-1 font-display text-4xl text-rose-deep">{total}</p>
          <ul className="mt-4 grid gap-2 text-sm leading-6 text-muted">
            {summary.lines.map((line) => (
              <li key={line.id} className="flex items-start justify-between gap-3">
                <span>{line.label}</span>
                <span className="text-end text-ink">{chargeAmountLabel(line.status, line.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-7 text-muted">
            الرقم مبني على سعر المقاس في قائمة التورت الأساسية. أي بند بدون سعر لا يدخل في الإجمالي إلى أن يُحدَّد.
          </p>
        </div>
      </div>
    </article>
  )
}
