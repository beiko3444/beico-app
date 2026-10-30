// Shared display formats, so dates and amounts read the same on every screen.
const pad = (n: number) => String(n).padStart(2, '0')

function toDate(value: Date | string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** 2026.10.29 */
export function formatDate(value: Date | string | number | null | undefined) {
  const d = toDate(value)
  return d ? `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}` : '-'
}

/** 10.29 19:43 this year, 2025.10.29 19:43 otherwise */
export function formatDateTime(value: Date | string | number | null | undefined) {
  const d = toDate(value)
  if (!d) return '-'
  const day = d.getFullYear() === new Date().getFullYear() ? `${pad(d.getMonth() + 1)}.${pad(d.getDate())}` : formatDate(d)
  return `${day} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 10.01–10.29 (with years when they differ) */
export function formatDateRange(start: Date | string | null | undefined, end: Date | string | null | undefined) {
  const a = toDate(start)
  const b = toDate(end)
  if (!a || !b) return '-'
  const short = (d: Date) => `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
  return a.getFullYear() === b.getFullYear() ? `${short(a)}–${short(b)}` : `${formatDate(a)}–${formatDate(b)}`
}

/** 22,605원 — admin screens write KRW with a trailing 원. */
export function formatWon(amount: number | null | undefined) {
  return typeof amount === 'number' && Number.isFinite(amount) ? `${Math.round(amount).toLocaleString('ko-KR')}원` : '-'
}

export function formatCount(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('ko-KR') : '-'
}
