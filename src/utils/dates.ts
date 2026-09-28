import { bookingRules } from '@/data/options'

export function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseISODate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  next.setDate(next.getDate() + days)
  return next
}

export function minBookableDate(from = new Date(), advanceDays = bookingRules.minAdvanceDays): string {
  return toISODate(addDays(from, advanceDays))
}

export function isBookableDate(value: string, from = new Date()): boolean {
  const selected = parseISODate(value)
  if (!selected) return false
  return toISODate(selected) >= minBookableDate(from)
}

export function formatArabicDate(value: string): string {
  const date = parseISODate(value)
  if (!date) return value
  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function formatTimeLabel(time: string): string {
  const [hourText, minuteText] = time.split(':')
  const hour = Number(hourText)
  const minute = minuteText ?? '00'
  if (Number.isNaN(hour)) return time
  if (hour === 12) return `12:${minute} ظهرًا`
  const suffix = hour > 12 ? 'مساءً' : 'صباحًا'
  const hour12 = hour > 12 ? hour - 12 : hour
  return `${hour12}:${minute} ${suffix}`
}

export function tooSoonMessage(days = bookingRules.minAdvanceDays): string {
  if (days === 3) return bookingRules.tooSoonMessage
  return `الحجز يجب أن يكون قبل موعد الاستلام بـ ${days} أيام على الأقل.`
}
