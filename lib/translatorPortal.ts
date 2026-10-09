import { createHmac } from 'node:crypto'

const DEFAULT_GIST = 'https://gist.githubusercontent.com/beiko3444/5a69e99d96fa2ae34ba4af96c117d5e0/raw/translator.json'

export function translatorLoginToken(secret: string, now = Date.now()) {
  const expires = Math.floor(now / 1000) + 120
  const signature = createHmac('sha256', secret).update(`translator-login:${expires}`).digest('hex')
  return `${expires}.${signature}`
}

export function translatorGistUrl(monitorGist: string) {
  const url = new URL(monitorGist)
  if (url.protocol !== 'https:' || url.hostname !== 'gist.githubusercontent.com') {
    throw new Error('번역기 주소 설정을 확인해 주세요.')
  }
  const raw = url.pathname.indexOf('/raw')
  if (raw < 0) throw new Error('번역기 주소 설정을 확인해 주세요.')
  url.pathname = `${url.pathname.slice(0, raw)}/raw/translator.json`
  url.search = ''
  url.hash = ''
  return url.toString()
}

export function validateTranslatorUrl(value: string, fromGist = false) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      (fromGist && !url.hostname.endsWith('.trycloudflare.com'))) {
    throw new Error('번역 서버 주소가 올바르지 않습니다.')
  }
  return url.toString().replace(/\/$/, '')
}

export async function resolveTranslatorUrl(env = process.env, fetcher = fetch) {
  const fixed = env.TRANSLATOR_URL?.trim()
  if (fixed) return validateTranslatorUrl(fixed)
  const gist = env.TRANSLATOR_URL_GIST?.trim() ||
    (env.SMARTINVENTORY_MONITOR_URL_GIST?.trim()
      ? translatorGistUrl(env.SMARTINVENTORY_MONITOR_URL_GIST.trim())
      : DEFAULT_GIST)
  const gistUrl = new URL(gist)
  if (gistUrl.protocol !== 'https:' || gistUrl.hostname !== 'gist.githubusercontent.com') {
    throw new Error('번역기 주소 설정을 확인해 주세요.')
  }
  gistUrl.searchParams.set('t', String(Date.now()))
  const response = await fetcher(gistUrl, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error('번역 서버 주소를 찾지 못했습니다.')
  const payload = await response.json()
  if (typeof payload?.url !== 'string') throw new Error('번역 서버 주소가 올바르지 않습니다.')
  return validateTranslatorUrl(payload.url, true)
}
