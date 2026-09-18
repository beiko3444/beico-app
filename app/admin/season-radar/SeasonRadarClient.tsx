'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  CalendarRange,
  Database,
  Fish,
  MapPin,
  MousePointerClick,
  TrendingUp,
} from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'

const BRAND = '#e43d20'
const BRAND_SOFT = '#fff3ef'
const AXIS_TEXT = '#64748b'
const AXIS_LINE = '#cbd5e1'
const GRID_LINE = '#e2e8f0'
const MUTED_BUBBLE = '#94a3b8'

type RegionCount = [string, number]
type MonthRecord = { total: number; regions: RegionCount[] }
type FishData = Record<string, Record<string, MonthRecord>>
type CoordinateData = Record<string, [number, number]>
type ArcPoint = [number, number]

type TopologyGeometry = {
  type: 'Polygon' | 'MultiPolygon'
  arcs: number[][] | number[][][]
  properties?: { name?: string }
}

type TopologyData = {
  transform?: { scale: [number, number]; translate: [number, number] }
  arcs: ArcPoint[][]
  objects: Record<string, { geometries: TopologyGeometry[] }>
}

const FISH_ORDER = [
  '문어',
  '주꾸미',
  '갈치',
  '갑오징어',
  '참돔',
  '우럭',
  '한치',
  '광어',
  '감성돔',
  '무늬오징어',
  '대구',
  '붉바리',
]

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)
const MAP_WIDTH = 620
const MAP_HEIGHT = 560
const MAP_BOUNDS = { minLon: 124.1, maxLon: 131.5, minLat: 32.7, maxLat: 39.4 }

function formatCount(value: number) {
  return value.toLocaleString('ko-KR')
}

function shortRegionName(region: string) {
  const [, ...rest] = region.split(' ')
  return rest.join(' ') || region
}

function getPeakSeason(values: number[]) {
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  const peakIndex = values.reduce(
    (best, value, index) => (value > values[best] ? index : best),
    0,
  )
  const active = values.map((value) => value >= average)
  let startIndex = peakIndex
  let endIndex = peakIndex
  let length = 1

  while (length < values.length && active[(startIndex + values.length - 1) % values.length]) {
    startIndex = (startIndex + values.length - 1) % values.length
    length += 1
  }
  while (length < values.length && active[(endIndex + 1) % values.length]) {
    endIndex = (endIndex + 1) % values.length
    length += 1
  }

  return {
    start: startIndex + 1,
    end: endIndex + 1,
    peak: peakIndex + 1,
    average,
  }
}

function projectPoint([longitude, latitude]: ArcPoint): ArcPoint {
  const x = ((longitude - MAP_BOUNDS.minLon) / (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon)) * MAP_WIDTH
  const y = ((MAP_BOUNDS.maxLat - latitude) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * MAP_HEIGHT
  return [x, y]
}

function decodeArc(topology: TopologyData, reference: number) {
  const index = reference >= 0 ? reference : ~reference
  const source = topology.arcs[index] || []
  const scale = topology.transform?.scale || [1, 1]
  const translate = topology.transform?.translate || [0, 0]
  let x = 0
  let y = 0
  const points = source.map(([deltaX, deltaY]) => {
    x += deltaX
    y += deltaY
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]] as ArcPoint
  })
  return reference >= 0 ? points : points.reverse()
}

function stitchRing(topology: TopologyData, references: number[]) {
  return references.flatMap((reference, index) => {
    const points = decodeArc(topology, reference)
    return index === 0 ? points : points.slice(1)
  })
}

function ringPath(points: ArcPoint[]) {
  if (!points.length) return ''
  return `${points
    .map((point, index) => {
      const [x, y] = projectPoint(point)
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join('')}Z`
}

function geometryPath(topology: TopologyData, geometry: TopologyGeometry) {
  const polygons = geometry.type === 'Polygon'
    ? [geometry.arcs as number[][]]
    : geometry.arcs as number[][][]
  return polygons
    .flatMap((polygon) => polygon.map((ring) => ringPath(stitchRing(topology, ring))))
    .join('')
}

function PeakBand({ start, end }: { start: number; end: number }) {
  if (start <= end) {
    return <ReferenceArea x1={start} x2={end} fill={BRAND_SOFT} fillOpacity={0.9} strokeOpacity={0} />
  }
  return (
    <>
      <ReferenceArea x1={start} x2={12} fill={BRAND_SOFT} fillOpacity={0.9} strokeOpacity={0} />
      <ReferenceArea x1={1} x2={end} fill={BRAND_SOFT} fillOpacity={0.9} strokeOpacity={0} />
    </>
  )
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { month: number; value: number } }> }) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <div className="text-[11px] font-black text-slate-500">{item.month}월 조황 언급</div>
      <div className="mt-0.5 text-[17px] font-black tabular-nums text-slate-900">{formatCount(item.value)}건</div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string
  value: string
  detail: string
  icon: React.ReactNode
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-2 text-[11px] font-black text-slate-500">
        <span className="break-keep">{label}</span>
        <span className="text-slate-400">{icon}</span>
      </div>
      <div className="mt-1 truncate text-[22px] font-black tabular-nums text-slate-900">{value}</div>
      <div className="mt-0.5 truncate text-[11px] font-bold text-slate-500">{detail}</div>
    </div>
  )
}

function KoreaActivityMap({
  topology,
  coordinates,
  regions,
  selectedRegion,
  onSelectRegion,
}: {
  topology: TopologyData | null
  coordinates: CoordinateData
  regions: RegionCount[]
  selectedRegion: string
  onSelectRegion: (region: string) => void
}) {
  const provincePaths = useMemo(() => {
    if (!topology) return []
    const object = Object.values(topology.objects)[0]
    return object.geometries.map((geometry, index) => ({
      key: `${geometry.properties?.name || 'province'}-${index}`,
      path: geometryPath(topology, geometry),
    }))
  }, [topology])

  const mappableRegions = regions.filter(([region]) => coordinates[region])
  const maxValue = Math.max(...mappableRegions.map(([, value]) => value), 1)

  return (
    <div className="relative mx-auto w-full max-w-[680px]">
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        className="block h-auto w-full"
        role="img"
        aria-label="선택 월의 지역별 조황 게시글 분포 지도"
      >
        <g>
          {provincePaths.map((province) => (
            <path
              key={province.key}
              d={province.path}
              fill="#f1f5f9"
              stroke={MUTED_BUBBLE}
              strokeWidth="1.2"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
        <g>
          {mappableRegions.map(([region, value], index) => {
            const [x, y] = projectPoint(coordinates[region])
            const isSelected = selectedRegion === region
            const isTop = index === 0
            const highlighted = isSelected || isTop
            const radius = 11 + Math.sqrt(value / maxValue) * 28
            const showLabel = index < 4 || isSelected
            return (
              <g
                key={region}
                role="button"
                tabIndex={0}
                aria-label={`${region} ${formatCount(value)}건`}
                onClick={() => onSelectRegion(region)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onSelectRegion(region)
                }}
                className="cursor-pointer"
              >
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  fill={highlighted ? BRAND : MUTED_BUBBLE}
                  fillOpacity={highlighted ? 0.96 : 0.8}
                  stroke="#FFFFFF"
                  strokeWidth={isSelected ? 4 : 2}
                />
                {showLabel ? (
                  <text x={x} y={y - 2} textAnchor="middle" className="pointer-events-none fill-white text-[12px] font-black">
                    <tspan x={x}>{shortRegionName(region)}</tspan>
                    <tspan x={x} dy="14" className="text-[11px] font-bold">{formatCount(value)}</tspan>
                  </text>
                ) : null}
              </g>
            )
          })}
        </g>
      </svg>
      {!topology ? (
        <div className="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-slate-500">지도를 불러오는 중</div>
      ) : null}
    </div>
  )
}

export default function SeasonRadarClient() {
  const [data, setData] = useState<FishData | null>(null)
  const [coordinates, setCoordinates] = useState<CoordinateData>({})
  const [topology, setTopology] = useState<TopologyData | null>(null)
  const [selectedFish, setSelectedFish] = useState('갑오징어')
  const [selectedMonth, setSelectedMonth] = useState(10)
  const [selectedRegion, setSelectedRegion] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      fetch('/data/fishing-season/month-region.json').then((response) => response.json()),
      fetch('/data/fishing-season/region-coordinates.json').then((response) => response.json()),
      fetch('/data/fishing-season/skorea-provinces.topo.json').then((response) => response.json()),
    ])
      .then(([fishData, coordinateData, topologyData]) => {
        if (!active) return
        setData(fishData)
        setCoordinates(coordinateData)
        setTopology(topologyData)
      })
      .catch(() => {
        if (active) setLoadError('시즌 데이터를 불러오지 못했습니다. 잠시 후 다시 열어주세요.')
      })
    return () => {
      active = false
    }
  }, [])

  const fishRecord = data?.[selectedFish]
  const chartData = MONTHS.map((month) => ({
    month,
    value: fishRecord?.[String(month)]?.total || 0,
  }))
  const values = chartData.map((item) => item.value)
  const season = getPeakSeason(values)
  const selectedRecord = fishRecord?.[String(selectedMonth)] || { total: 0, regions: [] }
  const yearTotal = values.reduce((sum, value) => sum + value, 0)
  const topRegion = selectedRecord.regions[0]

  useEffect(() => {
    setSelectedRegion(selectedRecord.regions[0]?.[0] || '')
  }, [selectedFish, selectedMonth, selectedRecord.regions])

  function handleFishChange(fish: string) {
    const nextRecord = data?.[fish]
    const nextValues = MONTHS.map((month) => nextRecord?.[String(month)]?.total || 0)
    const nextSeason = getPeakSeason(nextValues)
    setSelectedFish(fish)
    setSelectedMonth(nextSeason.peak)
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-8 text-center text-[14px] font-bold text-rose-700">
        {loadError}
      </div>
    )
  }

  return (
    <div className="min-w-0 text-slate-900">
      <PageHeader
        title="시즌레이더"
        description="어종별 월별 수요 흐름과 출조 지역을 함께 확인합니다."
        actions={(
          <label className="flex min-w-0 items-center gap-2">
            <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] font-black text-slate-600">
              <Fish size={14} className="text-brand-orange" />
              분석 어종
            </span>
            <select
              value={selectedFish}
              onChange={(event) => handleFishChange(event.target.value)}
              className="h-10 w-full min-w-[140px] rounded-xl border border-slate-200 bg-white px-3 text-[14px] font-black text-slate-900 shadow-sm focus:border-brand-orange sm:w-[200px]"
            >
              {FISH_ORDER.map((fish) => <option key={fish}>{fish}</option>)}
            </select>
          </label>
        )}
      />

      <div className="space-y-4">
        <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <MetricCard
            label="피크 시즌"
            value={`${season.start}월-${season.end}월`}
            detail={`평균 ${formatCount(Math.round(season.average))}건 이상`}
            icon={<CalendarRange size={16} />}
          />
          <MetricCard
            label="최고 활발 월"
            value={`${season.peak}월`}
            detail={`${formatCount(values[season.peak - 1])}건 언급`}
            icon={<TrendingUp size={16} />}
          />
          <MetricCard
            label={`${selectedMonth}월 1위 지역`}
            value={topRegion ? shortRegionName(topRegion[0]) : '-'}
            detail={topRegion ? `${formatCount(topRegion[1])}건` : '집계 없음'}
            icon={<MapPin size={16} />}
          />
          <MetricCard
            label="전체 분석량"
            value={`${formatCount(yearTotal)}건`}
            detail="2015.01-2026.09 게시글 언급"
            icon={<Database size={16} />}
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
            <div className="min-w-0">
              <h2 className="text-[16px] font-black text-slate-900 break-keep">{selectedFish} 월별 조황 추세</h2>
              <p className="mt-0.5 text-[11px] font-bold text-slate-500">연한 주황 구간은 평균 이상이 이어지는 시즌, 진한 주황 선은 최고점입니다.</p>
            </div>
            <div className="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-black text-slate-500">
              <MousePointerClick size={14} />
              월을 누르면 지도가 바뀝니다
            </div>
          </div>
          <div className="h-[270px] px-1 pb-1 pt-4 sm:h-[330px] sm:px-4">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart
                data={chartData}
                margin={{ top: 14, right: 12, left: -12, bottom: 4 }}
                onClick={(state) => {
                  const month = Number(state?.activeLabel)
                  if (month >= 1 && month <= 12) setSelectedMonth(month)
                }}
              >
                <CartesianGrid vertical={false} stroke={GRID_LINE} />
                <PeakBand start={season.start} end={season.end} />
                <XAxis
                  dataKey="month"
                  type="number"
                  domain={[1, 12]}
                  ticks={MONTHS}
                  tickFormatter={(month) => `${month}월`}
                  tick={{ fontSize: 11, fontWeight: 800, fill: AXIS_TEXT }}
                  tickLine={false}
                  axisLine={{ stroke: AXIS_LINE }}
                />
                <YAxis
                  width={58}
                  tickFormatter={(value) => value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)}
                  tick={{ fontSize: 11, fontWeight: 800, fill: AXIS_TEXT }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: MUTED_BUBBLE, strokeDasharray: '4 4' }} />
                <ReferenceLine
                  x={season.start}
                  stroke={MUTED_BUBBLE}
                  strokeDasharray="4 4"
                  label={{ value: '시작', position: 'insideTopLeft', fill: AXIS_TEXT, fontSize: 11, fontWeight: 900 }}
                />
                <ReferenceLine
                  x={season.end}
                  stroke={MUTED_BUBBLE}
                  strokeDasharray="4 4"
                  label={{ value: '끝', position: 'insideTopRight', fill: AXIS_TEXT, fontSize: 11, fontWeight: 900 }}
                />
                <ReferenceLine x={season.peak} stroke={BRAND} strokeWidth={2} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={BRAND}
                  strokeWidth={3}
                  isAnimationActive={false}
                  activeDot={{ r: 7, fill: BRAND, stroke: '#FFFFFF', strokeWidth: 3, cursor: 'pointer' }}
                  dot={(props) => {
                    const month = Number(props.payload?.month)
                    const active = month === selectedMonth
                    return (
                      <circle
                        key={`dot-${month}`}
                        cx={props.cx}
                        cy={props.cy}
                        r={active ? 6 : 4}
                        fill={active ? BRAND : '#FFFFFF'}
                        stroke={BRAND}
                        strokeWidth={2}
                        className="cursor-pointer"
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelectedMonth(month)
                        }}
                      />
                    )
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="border-t border-slate-100 px-3 py-3 sm:px-5">
            <Tabs
              aria-label="월 선택"
              items={MONTHS.map((month) => ({ key: String(month), label: `${month}월` }))}
              value={String(selectedMonth)}
              onChange={(key) => setSelectedMonth(Number(key))}
            />
          </div>
        </section>

        <section className="grid min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.75fr)]">
          <div className="min-w-0 border-b border-slate-100 xl:border-b-0 xl:border-r">
            <div className="flex flex-col justify-between gap-1 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
              <h2 className="text-[16px] font-black text-slate-900 break-keep">{selectedFish} · {selectedMonth}월 활발 지역</h2>
              <span className="whitespace-nowrap text-[11px] font-bold text-slate-500">원 크기 = 지역별 조황 언급 수</span>
            </div>
            <div className="bg-slate-50 p-3 sm:p-5">
              <KoreaActivityMap
                topology={topology}
                coordinates={coordinates}
                regions={selectedRecord.regions}
                selectedRegion={selectedRegion}
                onSelectRegion={setSelectedRegion}
              />
            </div>
          </div>

          <aside className="min-w-0 bg-white">
            <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
              <div className="text-[11px] font-black text-brand-orange">{selectedFish} · {selectedMonth}월</div>
              <div className="mt-1 text-[22px] font-black text-slate-900 break-keep">{selectedRegion ? shortRegionName(selectedRegion) : '지역 없음'}</div>
              <div className="mt-0.5 text-[12px] font-bold text-slate-500">
                월 전체 {formatCount(selectedRecord.total)}건
              </div>
            </div>
            <ol className="divide-y divide-slate-100 px-3 py-2 sm:px-4">
              {selectedRecord.regions.map(([region, value], index) => (
                <li key={region}>
                  <button
                    type="button"
                    onClick={() => setSelectedRegion(region)}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${selectedRegion === region ? 'bg-brand-orange-soft' : 'hover:bg-slate-50'}`}
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${index === 0 ? 'bg-brand-orange text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-black text-slate-800">{region}</span>
                    <span className="shrink-0 text-[13px] font-black tabular-nums text-slate-900">{formatCount(value)}건</span>
                  </button>
                </li>
              ))}
            </ol>
          </aside>
        </section>

        <footer className="px-1 pb-2 text-[11px] font-bold leading-5 text-slate-500">
          선상24 전체 조황 게시글의 어종 언급 빈도를 월·지역별로 집계했습니다. 게시글 활동도이며 실제 어획량과 다를 수 있습니다. 지도 경계: KOSTAT 2018, 위치: OpenStreetMap.
        </footer>
      </div>
    </div>
  )
}
