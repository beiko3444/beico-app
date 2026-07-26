'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BatteryMedium,
  CheckCircle2,
  Cloud,
  Droplets,
  Loader2,
  RefreshCw,
  ThermometerSun,
  TriangleAlert,
} from 'lucide-react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type SensorReading = {
  recordedAt: string
  temperatureC: number | null
  humidityPercent: number | null
  batteryPercent: number | null
}

type EnvironmentSensor = {
  id: string
  deviceId: string
  label: string
  manufacturer: string | null
  model: string | null
  lastTemperature: number | null
  lastHumidity: number | null
  lastBattery: number | null
  lastSeenAt: string | null
  readings: SensorReading[]
}

type EnvironmentPayload = {
  configuration: {
    ready: boolean
    missing: string[]
    redirectUri: string
    webhookUrl: string
  }
  connected: boolean
  connection: {
    connectedAt: string
    expiresAt: string
    lastSyncAt: string | null
    lastError: string | null
  } | null
  range: {
    days: number
    since: string
  }
  sensors: EnvironmentSensor[]
}

const dayOptions = [1, 7, 30]

function formatValue(value: number | null, suffix: string) {
  return value === null ? '-' : `${value.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}${suffix}`
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function ConnectionNotice({
  tone,
  children,
}: {
  tone: 'success' | 'error'
  children: React.ReactNode
}) {
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-[13px] font-bold ${
      tone === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'border-red-200 bg-red-50 text-red-700'
    }`}>
      {tone === 'success' ? <CheckCircle2 size={18} /> : <TriangleAlert size={18} />}
      <span>{children}</span>
    </div>
  )
}

export default function EnvironmentClient() {
  const [days, setDays] = useState(7)
  const [data, setData] = useState<EnvironmentPayload | null>(null)
  const [selectedSensorId, setSelectedSensorId] = useState('')
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/smartthings?days=${days}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || '온습도 정보를 불러오지 못했습니다.')
      const next = payload as EnvironmentPayload
      setData(next)
      setSelectedSensorId((current) => {
        if (current && next.sensors.some((sensor) => sensor.id === current)) return current
        return next.sensors[0]?.id || ''
      })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '온습도 정보를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('smartthings')
    if (status === 'connected') {
      setNotice({
        tone: 'success',
        message: params.get('collect') === 'failed'
          ? 'SmartThings 계정은 연결됐습니다. 센서 값은 아래의 지금 수집 버튼으로 다시 확인해 주세요.'
          : 'SmartThings 계정 연결과 첫 온습도 저장이 완료됐습니다.',
      })
    } else if (status === 'error') {
      setNotice({
        tone: 'error',
        message: params.get('message') || 'SmartThings 연결에 실패했습니다.',
      })
    }
    if (status) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const collectNow = async () => {
    setCollecting(true)
    setError('')
    try {
      const response = await fetch('/api/admin/smartthings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || '온습도 값을 저장하지 못했습니다.')
      setNotice({
        tone: 'success',
        message: `${payload.savedCount || 0}개 센서의 최신 값을 DB에 저장했습니다.`,
      })
      await loadDashboard()
    } catch (collectError) {
      setError(collectError instanceof Error ? collectError.message : '온습도 값을 저장하지 못했습니다.')
    } finally {
      setCollecting(false)
    }
  }

  const selectedSensor = data?.sensors.find((sensor) => sensor.id === selectedSensorId) || null
  const chartData = useMemo(() => {
    const readings = selectedSensor?.readings || []
    const stride = Math.max(1, Math.ceil(readings.length / 1200))
    return readings
      .filter((_, index) => index % stride === 0 || index === readings.length - 1)
      .map((reading) => ({
        ...reading,
        label: formatDateTime(reading.recordedAt),
      }))
  }, [selectedSensor])

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-5 pb-16">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#EF3B2D]">
            <ThermometerSun size={25} />
          </span>
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#EF3B2D]">SmartThings Climate</div>
            <h1 className="mt-1 text-[25px] font-black tracking-tight text-slate-950">온습도 관리</h1>
            <p className="mt-1 text-[12px] font-bold text-slate-500">
              외부 H200의 T310·T315 값을 SmartThings에서 받아 라즈베리파이 DB에 저장합니다.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {data?.connected ? (
            <button
              type="button"
              onClick={collectNow}
              disabled={collecting}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[#07122F] px-4 text-[12px] font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {collecting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <RefreshCw size={16} className="mr-2" />}
              지금 수집
            </button>
          ) : null}
          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>
      </header>

      {notice ? <ConnectionNotice tone={notice.tone}>{notice.message}</ConnectionNotice> : null}
      {error ? <ConnectionNotice tone="error">{error}</ConnectionNotice> : null}

      {loading && !data ? (
        <div className="flex h-[320px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-[13px] font-black text-slate-500">
          <Loader2 size={20} className="mr-2 animate-spin text-[#EF3B2D]" />
          온습도 정보를 불러오는 중입니다.
        </div>
      ) : data ? (
        <>
          {!data.configuration.ready ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <TriangleAlert size={20} className="mt-0.5 shrink-0 text-amber-600" />
                <div>
                  <h2 className="text-[15px] font-black text-amber-950">SmartThings 앱 등록이 필요합니다</h2>
                  <p className="mt-1 text-[12px] font-bold leading-5 text-amber-800">
                    연결 주소를 등록한 뒤 서버 환경설정에 Client ID, Client Secret, 암호화 키를 넣으면 삼성 계정 연결 버튼이 활성화됩니다.
                  </p>
                  <div className="mt-3 space-y-1 text-[11px] font-bold text-amber-900">
                    <div>승인 후 돌아올 주소: <span className="break-all font-mono">{data.configuration.redirectUri}</span></div>
                    <div>SmartThings 대상 주소: <span className="break-all font-mono">{data.configuration.webhookUrl}</span></div>
                    <div>미설정 항목: {data.configuration.missing.join(', ')}</div>
                  </div>
                </div>
              </div>
            </section>
          ) : !data.connected ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <Cloud size={34} className="mx-auto text-sky-500" />
              <h2 className="mt-3 text-[19px] font-black text-slate-950">삼성 계정을 연결해 주세요</h2>
              <p className="mx-auto mt-2 max-w-[560px] text-[12px] font-bold leading-5 text-slate-500">
                기기 읽기 권한만 요청합니다. Tapo 계정 비밀번호는 이 앱에 전달되거나 저장되지 않습니다.
              </p>
              <a
                href="/api/admin/smartthings/connect"
                className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[#07122F] px-6 text-[13px] font-black text-white no-underline transition hover:bg-slate-800"
              >
                SmartThings 연결
              </a>
            </section>
          ) : (
            <>
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-[11px] font-black text-slate-500">연결 상태</div>
                  <div className="mt-2 flex items-center gap-2 text-[17px] font-black text-emerald-700">
                    <CheckCircle2 size={19} /> 정상 연결
                  </div>
                  <div className="mt-2 text-[10px] font-bold text-slate-400">토큰은 자동 갱신됩니다.</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-[11px] font-black text-slate-500">등록 센서</div>
                  <div className="mt-2 text-[22px] font-black text-slate-950">{data.sensors.length}개</div>
                  <div className="mt-2 text-[10px] font-bold text-slate-400">T310·T315 자동 검색</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-[11px] font-black text-slate-500">마지막 저장</div>
                  <div className="mt-2 text-[17px] font-black text-slate-950">{formatDateTime(data.connection?.lastSyncAt || null)}</div>
                  <div className="mt-2 text-[10px] font-bold text-slate-400">라즈베리파이에서 5분 간격 수집</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-[11px] font-black text-slate-500">최근 오류</div>
                  <div className={`mt-2 truncate text-[13px] font-black ${data.connection?.lastError ? 'text-red-600' : 'text-slate-950'}`} title={data.connection?.lastError || ''}>
                    {data.connection?.lastError || '없음'}
                  </div>
                  <div className="mt-2 text-[10px] font-bold text-slate-400">연결 이상 자동 기록</div>
                </div>
              </section>

              {data.sensors.length ? (
                <>
                  <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {data.sensors.map((sensor) => (
                      <button
                        key={sensor.id}
                        type="button"
                        onClick={() => setSelectedSensorId(sensor.id)}
                        className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition ${
                          selectedSensorId === sensor.id
                            ? 'border-[#EF3B2D] ring-2 ring-[#EF3B2D]/10'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="truncate text-[15px] font-black text-slate-950" title={sensor.label}>{sensor.label}</div>
                          <span className="shrink-0 text-[10px] font-black text-emerald-600">ONLINE</span>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <div>
                            <ThermometerSun size={17} className="text-[#EF3B2D]" />
                            <div className="mt-1 text-[20px] font-black text-slate-950">{formatValue(sensor.lastTemperature, '℃')}</div>
                            <div className="text-[10px] font-bold text-slate-400">온도</div>
                          </div>
                          <div>
                            <Droplets size={17} className="text-sky-500" />
                            <div className="mt-1 text-[20px] font-black text-slate-950">{formatValue(sensor.lastHumidity, '%')}</div>
                            <div className="text-[10px] font-bold text-slate-400">습도</div>
                          </div>
                          <div>
                            <BatteryMedium size={17} className="text-emerald-600" />
                            <div className="mt-1 text-[20px] font-black text-slate-950">{formatValue(sensor.lastBattery, '%')}</div>
                            <div className="text-[10px] font-bold text-slate-400">배터리</div>
                          </div>
                        </div>
                        <div className="mt-4 text-[10px] font-bold text-slate-400">최근 확인 {formatDateTime(sensor.lastSeenAt)}</div>
                      </button>
                    ))}
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-[18px] font-black text-slate-950">{selectedSensor?.label || '센서'} 이력</h2>
                        <p className="mt-1 text-[11px] font-bold text-slate-500">온도와 습도 변화가 DB에 저장된 시간 순서대로 표시됩니다.</p>
                      </div>
                      <div className="flex gap-2">
                        {dayOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setDays(option)}
                            className={`h-9 rounded-lg border px-4 text-[11px] font-black ${
                              days === option
                                ? 'border-[#07122F] bg-[#07122F] text-white'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {option === 1 ? '오늘' : `${option}일`}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mt-5 h-[380px]">
                      {chartData.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 8, right: 5, left: -15, bottom: 0 }}>
                            <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" vertical={false} />
                            <XAxis dataKey="label" minTickGap={42} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }} />
                            <YAxis yAxisId="temperature" tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }} unit="℃" />
                            <YAxis yAxisId="humidity" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }} unit="%" />
                            <Tooltip
                              contentStyle={{ borderRadius: 12, borderColor: '#E2E8F0', fontSize: 11, fontWeight: 700 }}
                              formatter={(value, name) => [
                                `${Number(value).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}${name === '온도' ? '℃' : '%'}`,
                                name,
                              ]}
                            />
                            <Legend wrapperStyle={{ fontSize: 11, fontWeight: 800 }} />
                            <Line yAxisId="temperature" type="monotone" dataKey="temperatureC" name="온도" stroke="#EF3B2D" strokeWidth={2.5} dot={false} connectNulls />
                            <Line yAxisId="humidity" type="monotone" dataKey="humidityPercent" name="습도" stroke="#0EA5E9" strokeWidth={2.5} dot={false} connectNulls />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center text-[12px] font-black text-slate-400">
                          아직 저장된 이력이 없습니다. 지금 수집을 눌러 첫 값을 저장해 주세요.
                        </div>
                      )}
                    </div>
                  </section>
                </>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-[13px] font-bold text-slate-500">
                  연결된 온습도 센서가 아직 없습니다. 지금 수집을 눌러 확인해 주세요.
                </div>
              )}
            </>
          )}
        </>
      ) : null}
    </div>
  )
}
