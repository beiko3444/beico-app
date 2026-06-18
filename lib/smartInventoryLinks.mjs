const CHANNEL_BASE_URL = {
  naver: 'https://smartstore.naver.com',
  coupang: 'https://www.coupang.com',
}

export function externalProductHref(value, channel) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^\/\//.test(trimmed)) return `https:${trimmed}`
  if (/^\//.test(trimmed)) {
    return `${CHANNEL_BASE_URL[channel] || 'https://smartstore.naver.com'}${trimmed}`
  }
  return `https://${trimmed}`
}
