'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
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
  MousePointerClick,
  TrendingUp,
} from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import { selectClass } from '@/components/ui/field'

const BRAND = '#d9341a'
const BRAND_STRONG = '#b32d17'
const BRAND_SOFT = '#fff3ef'
const INK = '#0f172a'
const AXIS_TEXT = '#64748b'
const AXIS_LINE = '#cbd5e1'
const GRID_LINE = '#e2e8f0'
const GUIDE_LINE = '#94a3b8'
// Land and borders stay pale so the muted bubbles (dark slate) never blend into the province lines.
const LAND_FILL = '#e2e8f0'
const LAND_STROKE = '#cbd5e1'
const MUTED_BUBBLE = '#475569'
const LABEL_HALO = '#334155'

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

function provinceName(region: string) {
  return region.includes(' ') ? region.split(' ')[0] : ''
}

// "중구" or "고성" alone doesn't say which one, so those keep their province.
function labelRegionName(region: string, ambiguous: Set<string>) {
  const short = shortRegionName(region)
  return ambiguous.has(short) || /^(중|동|서|남|북)구$/.test(short) ? region : short
}

function findAmbiguousShortNames(regions: string[]) {
  const counts = new Map<string, number>()
  regions.forEach((region) => counts.set(shortRegionName(region), (counts.get(shortRegionName(region)) || 0) + 1))
  return new Set([...counts].filter(([, count]) => count > 1).map(([name]) => name))
}

// 2,500 → "2.5k", not "3k", so evenly spaced ticks read as evenly spaced.
function formatAxisCount(value: number) {
  return value >= 1000 ? `${(value / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}k` : String(value)
}

function useIsNarrow() {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)')
    const apply = () => setNarrow(media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])
  return narrow
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

type MapBubble = {
  region: string
  value: number
  rank: number
  /** Where the region really is; the circle moves away from it only to avoid overlapping. */
  anchorX: number
  anchorY: number
  x: number
  y: number
  radius: number
  /** Ranks 5+ are small dots with a rank chip so they never hide the leaders. */
  dot: boolean
  /** Space the mark needs; a dot reserves room for the rank chip beside it. */
  reserve: number
  isSelected: boolean
}

const DOT_RADIUS = 5

const footprint = (bubble: MapBubble) => bubble.reserve
// Pushes the smaller of two overlapping marks outward until none overlap, so a circle
// never covers another circle's label; a leader line then points back to the real spot.
function spreadBubbles(bubbles: MapBubble[]) {
  const placed = bubbles.map((bubble) => ({ ...bubble }))
  for (let pass = 0; pass < 60; pass += 1) {
    let moved = false
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        const a = placed[i]
        const b = placed[j]
        let dx = b.x - a.x
        let dy = b.y - a.y
        let distance = Math.hypot(dx, dy)
        if (distance < 0.01) {
          dx = 1
          dy = 0
          distance = 1
        }
        const overlap = footprint(a) + footprint(b) + 4 - distance
        if (overlap <= 0) continue
        const mover = footprint(b) <= footprint(a) ? b : a
        const direction = mover === b ? 1 : -1
        mover.x += (dx / distance) * overlap * direction
        mover.y += (dy / distance) * overlap * direction
        moved = true
      }
    }
    if (!moved) break
  }
  return placed.map((bubble) => ({
    ...bubble,
    x: Math.min(MAP_WIDTH - footprint(bubble), Math.max(footprint(bubble), bubble.x)),
    y: Math.min(MAP_HEIGHT - footprint(bubble), Math.max(footprint(bubble), bubble.y)),
  }))
}

function RankChip({ x, y, rank, large }: { x: number; y: number; rank: number; large: boolean }) {
  const size = large ? 26 : 16
  return (
    <g>
      <rect x={x} y={y - size / 2} width={size} height={size} rx={size / 2} fill="#FFFFFF" stroke={AXIS_LINE} strokeWidth={1} />
      <text x={x + size / 2} y={y} dy="0.35em" textAnchor="middle" fill="#334155" fontSize={large ? 18 : 11} fontWeight={900}>
        {rank}
      </text>
    </g>
  )
}

function KoreaActivityMap({
  topology,
  coordinates,
  regions,
  selectedRegion,
  onSelectRegion,
  ambiguousNames,
  hideLabels,
}: {
  topology: TopologyData | null
  coordinates: CoordinateData
  regions: RegionCount[]
  selectedRegion: string
  onSelectRegion: (region: string) => void
  ambiguousNames: Set<string>
  hideLabels: boolean
}) {
  const provincePaths = useMemo(() => {
    if (!topology) return []
    const object = Object.values(topology.objects)[0]
    return object.geometries.map((geometry, index) => ({
      key: `${geometry.properties?.name || 'province'}-${index}`,
      path: geometryPath(topology, geometry),
    }))
  }, [topology])

  const bubbles = useMemo(() => {
    const ranked = regions.map(([region, value], index) => ({ region, value, rank: index + 1 }))
      .filter(({ region }) => coordinates[region])
    const maxValue = Math.max(...ranked.map(({ value }) => value), 1)
    return spreadBubbles(ranked.map(({ region, value, rank }) => {
      const [x, y] = projectPoint(coordinates[region])
      const isSelected = selectedRegion === region
      const radius = 11 + Math.sqrt(value / maxValue) * 20
      const dot = rank > 4 && !isSelected
      return {
        region,
        value,
        rank,
        anchorX: x,
        anchorY: y,
        x,
        y,
        radius,
        dot,
        reserve: dot ? (hideLabels ? 26 : 16) : radius,
        isSelected,
      }
    }))
  }, [regions, coordinates, selectedRegion, hideLabels])

  return (
    <div className="relative mx-auto w-full max-w-[480px]">
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
              fill={LAND_FILL}
              stroke={LAND_STROKE}
              strokeWidth="1.2"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
        {/* Leader lines for marks moved off their spot, then circles, then labels on top. */}
        <g aria-hidden="true">
          {bubbles.map((bubble) => Math.hypot(bubble.x - bubble.anchorX, bubble.y - bubble.anchorY) > 4 ? (
            <g key={bubble.region}>
              <line x1={bubble.anchorX} y1={bubble.anchorY} x2={bubble.x} y2={bubble.y} stroke={GUIDE_LINE} strokeWidth={1.5} />
              <circle cx={bubble.anchorX} cy={bubble.anchorY} r={2.5} fill={GUIDE_LINE} />
            </g>
          ) : null)}
        </g>
        <g>
          {bubbles.map((bubble) => (
            <g
              key={bubble.region}
              role="button"
              tabIndex={0}
              aria-label={`${bubble.rank}위 ${bubble.region} ${formatCount(bubble.value)}건`}
              aria-pressed={bubble.isSelected}
              onClick={() => onSelectRegion(bubble.region)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onSelectRegion(bubble.region)
              }}
              className="cursor-pointer"
            >
              {bubble.isSelected ? (
                <circle cx={bubble.x} cy={bubble.y} r={bubble.radius + 5} fill="none" stroke={BRAND} strokeWidth={2} />
              ) : null}
              <circle
                cx={bubble.x}
                cy={bubble.y}
                r={bubble.dot ? DOT_RADIUS : bubble.radius}
                fill={bubble.isSelected ? BRAND : MUTED_BUBBLE}
                stroke="#FFFFFF"
                strokeWidth={bubble.dot ? 1.5 : 2}
              />
              {/* A larger invisible target keeps small dots easy to tap. */}
              {bubble.dot ? <circle cx={bubble.x} cy={bubble.y} r={14} fill="transparent" /> : null}
            </g>
          ))}
        </g>
        <g className="pointer-events-none" aria-hidden="true">
          {bubbles.map((bubble) => {
            if (bubble.dot) {
              return <RankChip key={bubble.region} x={bubble.x + DOT_RADIUS + 3} y={bubble.y} rank={bubble.rank} large={hideLabels} />
            }
            // Narrow screens show only the rank, sized to stay ~11px once the map is scaled down.
            if (hideLabels) {
              return (
                <text key={bubble.region} x={bubble.x} y={bubble.y} dy="0.35em" textAnchor="middle" fill="#FFFFFF" fontSize={20} fontWeight={900}>
                  {bubble.rank}
                </text>
              )
            }
            return (
              <text
                key={bubble.region}
                x={bubble.x}
                y={bubble.y - 2}
                textAnchor="middle"
                fill="#FFFFFF"
                stroke={LABEL_HALO}
                strokeWidth={3}
                strokeLinejoin="round"
                paintOrder="stroke"
                className="text-[12px] font-black"
              >
                <tspan x={bubble.x}>{labelRegionName(bubble.region, ambiguousNames)}</tspan>
                <tspan x={bubble.x} dy="14" className="text-[11px] font-bold">{formatCount(bubble.value)}</tspan>
              </text>
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
  const selectedValue = selectedRecord.regions.find(([region]) => region === selectedRegion)?.[1] || 0
  const selectedShare = selectedRecord.total ? Math.round((selectedValue / selectedRecord.total) * 100) : 0
  const isNarrow = useIsNarrow()
  const ambiguousNames = useMemo(() => findAmbiguousShortNames(Object.keys(coordinates)), [coordinates])
  // The month buttons double as the x-axis labels, so they share the plot's left/right insets.
  const yAxisWidth = isNarrow ? 44 : 58
  const plotLeft = yAxisWidth - 12
  const plotRight = isNarrow ? 12 : 24

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
        description="어종별로 조황 게시글이 많은 달과 지역을 봅니다."
        actions={(
          <label className="flex min-w-0 items-center gap-2">
            <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] font-bold text-slate-700">
              <Fish size={14} className="text-slate-400" />
              분석 어종
            </span>
            <select
              value={selectedFish}
              onChange={(event) => handleFishChange(event.target.value)}
              className={selectClass(true, 'min-w-[140px] sm:w-[200px]')}
            >
              {FISH_ORDER.map((fish) => <option key={fish}>{fish}</option>)}
            </select>
          </label>
        )}
      />

      <div className="space-y-4">
        <section className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          <StatCard
            label="피크 시즌"
            value={`${season.start}–${season.end}`}
            unit="월"
            caption={`평균 ${formatCount(Math.round(season.average))}건 이상`}
            icon={<CalendarRange />}
          />
          <StatCard
            label="최고 활발 월"
            value={season.peak}
            unit="월"
            caption={`${formatCount(values[season.peak - 1])}건 언급`}
            icon={<TrendingUp />}
          />
          <StatCard
            className="col-span-2 lg:col-span-1"
            label="전체 분석량"
            value={formatCount(yearTotal)}
            unit="건"
            caption="2015.01–2026.09 게시글 언급"
            icon={<Database />}
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
            <div className="min-w-0">
              <h2 className="text-[16px] font-black text-slate-900 break-keep">{selectedFish} 월별 조황 추세</h2>
              <p className="mt-0.5 break-keep text-[11px] font-bold text-slate-500">연한 주황 구간은 평균 이상이 이어지는 시즌, 검은 세로선은 선택한 월, 동그라미는 최고점입니다.</p>
            </div>
            <div className="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-black text-slate-500">
              <MousePointerClick size={14} />
              월을 누르면 지도가 바뀝니다
            </div>
          </div>
          <div className="h-[240px] px-1 pt-4 sm:h-[300px] sm:px-4">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart
                data={chartData}
                margin={{ top: 28, right: plotRight, left: -12, bottom: 0 }}
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
                  tick={false}
                  height={6}
                  tickLine={false}
                  axisLine={{ stroke: AXIS_LINE }}
                />
                <YAxis
                  width={yAxisWidth}
                  tickFormatter={formatAxisCount}
                  tick={{ fontSize: 11, fontWeight: 800, fill: AXIS_TEXT }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: GUIDE_LINE, strokeDasharray: '4 4' }} />
                <ReferenceLine
                  x={season.start}
                  stroke={GUIDE_LINE}
                  strokeDasharray="4 4"
                  label={isNarrow ? undefined : { value: '시작', position: 'insideTopLeft', fill: AXIS_TEXT, fontSize: 11, fontWeight: 900 }}
                />
                <ReferenceLine
                  x={season.end}
                  stroke={GUIDE_LINE}
                  strokeDasharray="4 4"
                  label={isNarrow ? undefined : { value: '끝', position: 'insideTopRight', fill: AXIS_TEXT, fontSize: 11, fontWeight: 900 }}
                />
                {/* The strongest mark follows the user's choice; the peak is a labelled ring, not a second full-height line. */}
                <ReferenceLine x={selectedMonth} stroke={INK} strokeWidth={1.5} />
                <ReferenceDot
                  x={season.peak}
                  y={values[season.peak - 1]}
                  r={9}
                  fill="none"
                  stroke={BRAND}
                  strokeWidth={1.5}
                  label={{ value: '최고', position: 'top', offset: 8, fill: BRAND_STRONG, fontSize: 11, fontWeight: 900 }}
                />
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
                        fill={active ? INK : '#FFFFFF'}
                        stroke={active ? INK : BRAND}
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
          <div className="overflow-hidden border-t border-slate-100 px-1 pb-3 pt-1 sm:px-4">
            <div
              role="group"
              aria-label="월 선택"
              className="grid grid-cols-12"
              style={{
                marginLeft: `calc(${plotLeft}px - (100% - ${plotLeft + plotRight}px) / 22)`,
                width: `calc((100% - ${plotLeft + plotRight}px) * 12 / 11)`,
              }}
            >
              {MONTHS.map((month) => {
                const active = month === selectedMonth
                return (
                  <button
                    key={month}
                    type="button"
                    aria-pressed={active}
                    aria-label={`${month}월`}
                    onClick={() => setSelectedMonth(month)}
                    className={`mx-auto h-8 w-full max-w-[44px] rounded-md text-[11px] font-extrabold tabular-nums transition-colors ${
                      active ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {isNarrow ? month : `${month}월`}
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <section className="grid min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,1fr)]">
          <div className="min-w-0 border-b border-slate-100 xl:border-b-0 xl:border-r">
            <div className="flex flex-col justify-between gap-1 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
              <h2 className="text-[16px] font-black text-slate-900 break-keep">{selectedFish} · {selectedMonth}월 활발 지역</h2>
              <span className="whitespace-nowrap text-[11px] font-bold text-slate-500">원 크기 = 지역별 조황 언급 수</span>
            </div>
            <div className="bg-slate-50 p-3">
              <KoreaActivityMap
                topology={topology}
                coordinates={coordinates}
                regions={selectedRecord.regions}
                selectedRegion={selectedRegion}
                onSelectRegion={setSelectedRegion}
                ambiguousNames={ambiguousNames}
                hideLabels={isNarrow}
              />
            </div>
          </div>

          <aside className="min-w-0 bg-white">
            <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
              <div className="text-[12px] font-bold text-slate-500">선택 지역</div>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 break-keep">
                <span className="text-[22px] font-black text-slate-900">
                  {selectedRegion ? (
                    <>
                      <span className="mr-1.5 text-[15px] font-bold text-slate-400">{provinceName(selectedRegion)}</span>
                      {shortRegionName(selectedRegion)}
                    </>
                  ) : '지역 없음'}
                </span>
                {selectedRegion ? (
                  <span className="text-[14px] font-bold tabular-nums text-slate-700">
                    {formatCount(selectedValue)}건
                    <span className="ml-1 text-[12px] text-slate-500">({selectedMonth}월의 {selectedShare}%)</span>
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-2 px-4 pt-3 sm:px-5">
              <h3 className="text-[13px] font-black text-slate-900">{selectedMonth}월 지역 순위</h3>
              <span className="text-[12px] font-bold tabular-nums text-slate-500">전체 {formatCount(selectedRecord.total)}건</span>
            </div>
            <ol className="divide-y divide-slate-100 px-3 py-2 sm:px-4">
              {selectedRecord.regions.map(([region, value], index) => {
                const selected = selectedRegion === region
                return (
                  <li key={region}>
                    <button
                      type="button"
                      onClick={() => setSelectedRegion(region)}
                      aria-pressed={selected}
                      className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${selected ? 'bg-brand-orange-soft shadow-[inset_2px_0_0_var(--color-brand-orange)]' : 'hover:bg-slate-50'}`}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-black tabular-nums text-slate-600">
                        {index + 1}
                      </span>
                      <span className={`min-w-0 flex-1 truncate text-[13px] font-black ${selected ? 'text-brand-orange-strong' : 'text-slate-800'}`}>
                        <span className="mr-1 font-bold text-slate-400">{provinceName(region)}</span>
                        {shortRegionName(region)}
                      </span>
                      <span className="shrink-0 text-[13px] font-black tabular-nums text-slate-900">{formatCount(value)}건</span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </aside>
        </section>

        <footer className="break-keep px-1 pb-2 text-[11px] font-bold leading-5 text-slate-500">
          선상24 전체 조황 게시글(2015.01–2026.09)의 어종 언급 빈도를 월·지역별로 집계한 계절 패턴입니다. 게시글 활동도이며 판매 수요나 실제 어획량과 다를 수 있고, 실시간 전망이 아닙니다. 지도 경계: KOSTAT 2018, 위치: OpenStreetMap.
        </footer>
      </div>
    </div>
  )
}
