const YMD_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseKoreanYmd(value) {
  if (typeof value !== 'string' || !YMD_PATTERN.test(value)) return null
  const date = new Date(`${value}T00:00:00+09:00`)
  return Number.isNaN(date.getTime()) || formatKoreanYmd(date) !== value ? null : date
}

export function formatKoreanYmd(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = (type) => parts.find((part) => part.type === type)?.value || ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

export function koreanMonthRange(value) {
  const match = typeof value === 'string' ? value.match(YMD_PATTERN) : null
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return null

  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const monthText = String(month).padStart(2, '0')
  const nextMonthText = String(nextMonth).padStart(2, '0')
  const start = parseKoreanYmd(`${year}-${monthText}-01`)
  const end = parseKoreanYmd(`${nextYear}-${nextMonthText}-01`)
  return start && end ? { start, end } : null
}
