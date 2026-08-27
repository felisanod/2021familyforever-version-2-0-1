/** Format a number as Tanzanian Shillings, e.g. TZS 10,000 */
export function formatTZS(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0)
  return `TZS ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

/** Compact TZS for dashboards, e.g. TZS 4.8M */
export function formatTZSCompact(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0)
  if (n >= 1_000_000) return `TZS ${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `TZS ${(n / 1_000).toFixed(0)}K`
  return formatTZS(n)
}

const MONTHS_SW = [
  'Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun',
  'Jul', 'Ago', 'Sep', 'Okt', 'Nov', 'Des',
] as const

const MONTHS_SW_FULL = [
  'Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni',
  'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba',
] as const

const WEEKDAYS_SW = [
  'Jumapili', 'Jumatatu', 'Jumanne', 'Jumatano', 'Alhamisi', 'Ijumaa', 'Wikendi',
] as const

function safeDate(value: string | Date | null | undefined): Date | null {
  const d = typeof value === 'string' ? new Date(value) : value
  if (!d || isNaN(d.getTime())) return null
  return d
}

/** "30 Ago 2026" */
export function formatDate(value: string | Date | null | undefined): string {
  const d = safeDate(value)
  if (!d) return '—'
  return `${d.getDate()} ${MONTHS_SW[d.getMonth()]} ${d.getFullYear()}`
}

/** "24 AGO" editorial style */
export function formatDateShort(value: string | Date | null | undefined): { day: string; month: string } {
  const d = safeDate(value)
  if (!d) return { day: '—', month: '' }
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: MONTHS_SW[d.getMonth()].toUpperCase(),
  }
}

/** "Leo", "Jana", or "24 Ago 2026" */
export function formatRelativeDay(value: string | Date | null | undefined): string {
  const d = safeDate(value)
  if (!d) return ''
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Leo'
  if (diffDays === 1) return 'Jana'
  if (diffDays < 7 && diffDays > 0) return `Siku ${diffDays} zilizopita`
  return formatDate(d)
}

/** "Dakika 5 zilizopita" style relative time */
export function timeAgo(value: string | Date | null | undefined): string {
  const d = safeDate(value)
  if (!d) return ''
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return 'Sasa hivi'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `Dakika ${minutes} zilizopita`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Saa ${hours} zilizopita`
  return formatRelativeDay(d)
}

/** "Jumatatu, 24 Agosti 2026" — full Kiswahili date for the admin dashboard. */
export function formatDateFullSw(value: string | Date = new Date()): string {
  const d = safeDate(value)
  if (!d) return ''
  return `${WEEKDAYS_SW[d.getDay()]}, ${d.getDate()} ${MONTHS_SW_FULL[d.getMonth()]} ${d.getFullYear()}`
}

export function greetingForHour(hour = new Date().getHours()): string {
  if (hour < 12) return 'Habari za asubuhi'
  if (hour < 17) return 'Habari za mchana'
  return 'Habari za jioni'
}

export function initialsOf(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('')
}