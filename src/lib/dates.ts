/* ============================================================================
   Date helpers
   ----------------------------------------------------------------------------
   Every date in the domain is a date-only ISO string (`YYYY-MM-DD`). Parsing
   happens at UTC noon so that a local timezone can never shift a date by a day
   — the bug that silently breaks every streak calculation.
   ========================================================================= */

import type { ISODate } from './types'

export function parseDate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0))
}

export function toISO(date: Date): ISODate {
  return date.toISOString().slice(0, 10)
}

/** Today in the user's local calendar, expressed as a date-only string. */
export function today(): ISODate {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(iso: ISODate, days: number): ISODate {
  const date = parseDate(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return toISO(date)
}

export function addMonths(iso: ISODate, months: number): ISODate {
  const date = parseDate(iso)
  const targetMonth = date.getUTCMonth() + months
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(targetMonth)
  // Clamp to the last day of the target month (31 Jan + 1 month → 28/29 Feb).
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(day, lastDay))
  return toISO(date)
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000)
}

export function monthsBetween(from: ISODate, to: ISODate): number {
  const a = parseDate(from)
  const b = parseDate(to)
  return (
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
    (b.getUTCMonth() - a.getUTCMonth()) +
    (b.getUTCDate() >= a.getUTCDate() ? 0 : -1)
  )
}

/** Monday-start week containing `iso`, unless `weekStartsOn` says otherwise. */
export function startOfWeek(iso: ISODate, weekStartsOn: 0 | 1 = 1): ISODate {
  const date = parseDate(iso)
  const day = date.getUTCDay()
  const diff = weekStartsOn === 1 ? (day === 0 ? -6 : 1 - day) : -day
  return addDays(iso, diff)
}

export function endOfWeek(iso: ISODate, weekStartsOn: 0 | 1 = 1): ISODate {
  return addDays(startOfWeek(iso, weekStartsOn), 6)
}

export function startOfMonth(iso: ISODate): ISODate {
  return `${iso.slice(0, 7)}-01`
}

export function endOfMonth(iso: ISODate): ISODate {
  const date = parseDate(iso)
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
  return toISO(last)
}

export function startOfQuarter(iso: ISODate): ISODate {
  const date = parseDate(iso)
  const quarterMonth = Math.floor(date.getUTCMonth() / 3) * 3
  return toISO(new Date(Date.UTC(date.getUTCFullYear(), quarterMonth, 1)))
}

export function endOfQuarter(iso: ISODate): ISODate {
  const date = parseDate(iso)
  const quarterMonth = Math.floor(date.getUTCMonth() / 3) * 3
  return toISO(new Date(Date.UTC(date.getUTCFullYear(), quarterMonth + 3, 0)))
}

/* ------------------------------------------------------------ formatting -- */

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** `12 Aug` — or `12 Aug 2027` when the year differs from today's. */
export function formatDate(iso: ISODate | undefined, opts: { year?: boolean } = {}): string {
  if (!iso) return '—'
  const date = parseDate(iso)
  const showYear = opts.year ?? date.getUTCFullYear() !== parseDate(today()).getUTCFullYear()
  const base = `${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]}`
  return showYear ? `${base} ${date.getUTCFullYear()}` : base
}

/** `August 2027` */
export function formatMonthYear(iso: ISODate): string {
  const date = parseDate(iso)
  return `${MONTHS_LONG[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

/** `Aug 27` — compact, for axis labels. */
export function formatMonthShort(iso: ISODate): string {
  const date = parseDate(iso)
  return `${MONTHS_SHORT[date.getUTCMonth()]} ${String(date.getUTCFullYear()).slice(2)}`
}

export function formatWeekday(iso: ISODate): string {
  return DAYS_SHORT[parseDate(iso).getUTCDay()]
}

/** `Today`, `Yesterday`, `in 3 days`, `4 days ago`. */
export function formatRelative(iso: ISODate | undefined, from: ISODate = today()): string {
  if (!iso) return '—'
  const diff = daysBetween(from, iso)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 0) {
    if (diff < 7) return `in ${diff} days`
    if (diff < 30) return `in ${Math.round(diff / 7)} wk`
    if (diff < 365) return `in ${Math.round(diff / 30)} mo`
    return `in ${(diff / 365).toFixed(1)} yr`
  }
  const past = -diff
  if (past < 7) return `${past} days ago`
  if (past < 30) return `${Math.round(past / 7)} wk ago`
  if (past < 365) return `${Math.round(past / 30)} mo ago`
  return `${(past / 365).toFixed(1)} yr ago`
}

/** Inclusive list of dates from `from` to `to`. */
export function dateRange(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = []
  const total = daysBetween(from, to)
  for (let i = 0; i <= total; i += 1) out.push(addDays(from, i))
  return out
}

/** `1h 45m`, `12h`, `45m`. */
export function formatHours(hours: number): string {
  if (hours === 0) return '0h'
  if (hours < 1) return `${Math.round(hours * 60)}m`
  const whole = Math.floor(hours)
  const minutes = Math.round((hours - whole) * 60)
  if (minutes === 0) return `${whole}h`
  if (minutes === 60) return `${whole + 1}h`
  return `${whole}h ${minutes}m`
}

/** Compact numbers for stat tiles: 1.2k, 45.3k, 1.1M. */
export function formatCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`
  return String(Math.round(value))
}

/** `$150k`, `$1.2M` — for the compensation table. */
export function formatMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1000) return `$${Math.round(value / 1000)}k`
  return `$${value}`
}
