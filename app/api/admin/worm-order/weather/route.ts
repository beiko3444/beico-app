import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/requireAdmin'

export const dynamic = 'force-dynamic'

type LocationConfig = {
  key: 'shanghai' | 'busanGangseo'
  label: string
  latitude: number
  longitude: number
  timezone: string
}

type LocationDailyWeather = {
  date: string
  weatherCode: number | null
  weatherText: string
  maxTempC: number | null
  minTempC: number | null
}

const LOCATIONS: LocationConfig[] = [
  {
    key: 'shanghai',
    label: '중국 상해',
    latitude: 31.2304,
    longitude: 121.4737,
    timezone: 'Asia/Shanghai',
  },
  {
    key: 'busanGangseo',
    label: '부산 강서구',
    latitude: 35.2122,
    longitude: 128.9806,
    timezone: 'Asia/Seoul',
  },
]

const WEATHER_CODE_LABELS: Record<number, string> = {
  0: '맑음',
  1: '대체로 맑음',
  2: '부분 흐림',
  3: '흐림',
  45: '안개',
  48: '서리 안개',
  51: '이슬비',
  53: '이슬비',
  55: '강한 이슬비',
  56: '약한 어는 이슬비',
  57: '강한 어는 이슬비',
  61: '약한 비',
  63: '비',
  65: '강한 비',
  66: '약한 어는 비',
  67: '강한 어는 비',
  71: '약한 눈',
  73: '눈',
  75: '강한 눈',
  77: '진눈깨비',
  80: '소나기',
  81: '강한 소나기',
  82: '매우 강한 소나기',
  85: '약한 눈 소나기',
  86: '강한 눈 소나기',
  95: '뇌우',
  96: '뇌우/우박',
  99: '강한 뇌우/우박',
}

function isValidYmd(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function toWeatherText(code: number | null) {
  if (code === null) return '정보 없음'
  return WEATHER_CODE_LABELS[code] || '정보 없음'
}

async function fetchLocationWeather(
  location: LocationConfig,
  startDate: string,
  endDate: string,
) {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    timezone: location.timezone,
    start_date: startDate,
    end_date: endDate,
  })

  let payload: any = null
  let lastError: Error | null = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'beico-app-weather/1.0',
        },
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new Error(`날씨 조회 실패 (${location.label}, ${response.status})`)
      }

      payload = await response.json()
      lastError = null
      clearTimeout(timeoutId)
      break
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('날씨 조회 실패')
      clearTimeout(timeoutId)
      if (attempt === 1) {
        throw lastError
      }
    }
  }

  if (!payload) {
    throw lastError || new Error(`날씨 조회 실패 (${location.label})`)
  }

  const daily = payload?.daily

  const dates: string[] = Array.isArray(daily?.time) ? daily.time : []
  const weatherCodes: unknown[] = Array.isArray(daily?.weather_code) ? daily.weather_code : []
  const maxTemps: unknown[] = Array.isArray(daily?.temperature_2m_max) ? daily.temperature_2m_max : []
  const minTemps: unknown[] = Array.isArray(daily?.temperature_2m_min) ? daily.temperature_2m_min : []

  const list: LocationDailyWeather[] = dates.map((date, index) => {
    const rawCode = weatherCodes[index]
    const rawMax = maxTemps[index]
    const rawMin = minTemps[index]

    const weatherCode = typeof rawCode === 'number' && Number.isFinite(rawCode)
      ? rawCode
      : null
    const maxTempC = typeof rawMax === 'number' && Number.isFinite(rawMax)
      ? Math.round(rawMax)
      : null
    const minTempC = typeof rawMin === 'number' && Number.isFinite(rawMin)
      ? Math.round(rawMin)
      : null

    return {
      date,
      weatherCode,
      weatherText: toWeatherText(weatherCode),
      maxTempC,
      minTempC,
    }
  })

  return {
    key: location.key,
    label: location.label,
    daily: list,
  }
}

export async function GET(request: NextRequest) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  const startDate = (request.nextUrl.searchParams.get('start') || '').trim()
  const endDate = (request.nextUrl.searchParams.get('end') || '').trim()

  if (!isValidYmd(startDate) || !isValidYmd(endDate)) {
    return NextResponse.json(
      { error: '유효한 날짜 범위(start/end)가 필요합니다. (YYYY-MM-DD)' },
      { status: 400 },
    )
  }

  const startMs = Date.parse(`${startDate}T00:00:00Z`)
  const endMs = Date.parse(`${endDate}T00:00:00Z`)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
    return NextResponse.json({ error: '날짜 범위가 올바르지 않습니다.' }, { status: 400 })
  }

  const diffDays = Math.floor((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1
  if (diffDays > 62) {
    return NextResponse.json({ error: '조회 기간은 최대 62일까지 가능합니다.' }, { status: 400 })
  }

  const settled = await Promise.allSettled(
    LOCATIONS.map((location) => fetchLocationWeather(location, startDate, endDate)),
  )

  const locations = settled
    .filter((entry): entry is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchLocationWeather>>> => entry.status === 'fulfilled')
    .map((entry) => entry.value)
  const warnings = settled
    .filter((entry): entry is PromiseRejectedResult => entry.status === 'rejected')
    .map((entry) => (entry.reason instanceof Error ? entry.reason.message : '날씨 조회 실패'))

  if (locations.length === 0) {
    return NextResponse.json(
      { error: '날씨 정보를 불러오지 못했습니다.', warnings },
      { status: 502 },
    )
  }

  return NextResponse.json(
    {
      startDate,
      endDate,
      generatedAt: new Date().toISOString(),
      locations,
      warnings,
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  )
}
