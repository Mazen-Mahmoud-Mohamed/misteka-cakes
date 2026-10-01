import type { ChargeStatus, Order, PriceLine } from '@/types'

export function formatEgp(amount: number): string {
  return `${new Intl.NumberFormat('en-US').format(amount)} جنيه`
}

export function chargeAmountLabel(status: ChargeStatus, amount: number | null): string {
  if (status === 'known' && amount != null) {
    if (amount === 0) return 'بدون إضافة'
    return formatEgp(amount)
  }
  if (status === 'quote') return 'يُحدَّد بعد المعاينة'
  if (status === 'outside') return 'خارج سعر التورتة'
  return 'السعر غير محدد بعد'
}

export function formatOrderText(order: Order, lines: PriceLine[]): string {
  const extraNames = order.extras.map((extra) => extra.name).join('، ') || 'بدون'
  const total = order.totalPrice == null ? 'يُحدَّد لاحقًا' : formatEgp(order.totalPrice)
  const priceLines = lines
    .map((line) => `${line.label}: ${chargeAmountLabel(line.status, line.amount)}`)
    .join('\n')

  return [
    `طلب مستكة ${order.orderNumber}`,
    `الاسم: ${order.customerName}`,
    `الموبايل: ${order.phone}`,
    `الخدمة: ${order.serviceType === 'delivery' ? 'توصيل' : 'استلام'}`,
    `المنطقة: ${order.area ?? 'استلام'}`,
    order.addressNotes ? `العنوان: ${order.addressNotes}` : '',
    `التورتة: ${order.cakeName ?? 'تصميم مخصص'}`,
    `المقاس: ${order.size}`,
    `عدد الأفراد: ${order.servings}`,
    `الحشوة: ${order.filling}`,
    `الإضافات: ${extraNames}`,
    `التاريخ: ${order.date}`,
    `الوقت: ${order.time}`,
    order.notes ? `ملاحظات: ${order.notes}` : '',
    '',
    priceLines,
    `الإجمالي التقريبي: ${total}`,
  ]
    .filter(Boolean)
    .join('\n')
}
