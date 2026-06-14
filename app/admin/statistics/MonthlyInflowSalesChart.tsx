export type MonthlyInflowSalesPoint = {
  monthKey: string
  label: string
  inflow: number
  interactions: number
  sales: number
  orders: number
}

export default function MonthlyInflowSalesChart({
  points,
}: {
  points: MonthlyInflowSalesPoint[]
}) {
  const totalInflow = points.reduce((sum, point) => sum + point.inflow, 0)
  const totalSales = points.reduce((sum, point) => sum + point.sales, 0)
  const totalOrders = points.reduce((sum, point) => sum + point.orders, 0)
  const peak = points.reduce((best, point) => point.sales > best.sales ? point : best, points[0] || null)
  const maxSales = Math.max(...points.map((point) => point.sales), 1)
  const maxInflow = Math.max(...points.map((point) => point.inflow), 1)
  const linePoints = points.map((point, index) => {
    const x = 36 + index * (528 / Math.max(points.length - 1, 1))
    const y = 166 - (point.inflow / maxInflow) * 124
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  return (
    <section className="border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[12px] font-black uppercase tracking-[0.18em] text-blue-600">Traffic & Sales</div>
          <h2 className="mt-1 text-[22px] font-black tracking-tight text-slate-950">월별 유입량 / 매출</h2>
          <p className="mt-1 text-[13px] font-medium text-slate-500">
            상단 조회 기간 안에서 월 단위로 유입량과 순매출을 비교합니다.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right">
          <Metric label="유입량" value={totalInflow.toLocaleString('ko-KR')} />
          <Metric label="순매출" value={formatWon(totalSales)} />
          <Metric label="주문" value={`${totalOrders.toLocaleString('ko-KR')}건`} />
        </div>
      </div>

      <div className="mt-5 overflow-hidden border border-slate-200 bg-slate-50/60">
        <div className="h-[300px] overflow-x-auto px-4 py-5">
          <div className="relative h-full min-w-[720px]">
            <svg viewBox="0 0 600 190" className="h-[205px] w-full overflow-visible" role="img" aria-label="월별 유입량과 매출 그래프">
              {[42, 73, 104, 135, 166].map((y) => (
                <line key={y} x1="28" x2="578" y1={y} y2={y} stroke="#E2E8F0" strokeDasharray="4 4" />
              ))}
              {points.map((point, index) => {
                const x = 24 + index * (552 / Math.max(points.length, 1))
                const height = Math.max(point.sales > 0 ? 6 : 0, (point.sales / maxSales) * 124)
                return (
                  <g key={point.monthKey}>
                    <rect x={x} y={166 - height} width="30" height={height} rx="7" fill="#2563EB" opacity="0.78" />
                    <title>{`${point.label} 순매출 ${formatWon(point.sales)} / 유입 ${point.inflow.toLocaleString('ko-KR')}`}</title>
                  </g>
                )
              })}
              <polyline points={linePoints} fill="none" stroke="#E34219" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((point, index) => {
                const x = 36 + index * (528 / Math.max(points.length - 1, 1))
                const y = 166 - (point.inflow / maxInflow) * 124
                return <circle key={point.monthKey} cx={x} cy={y} r={point.inflow > 0 ? 5 : 3} fill="#E34219" stroke="#fff" strokeWidth="2" />
              })}
            </svg>
            <div className="grid grid-cols-12 gap-1">
              {points.map((point) => (
                <div key={point.monthKey} className="min-h-[60px] rounded-xl bg-white px-1 py-2 text-center">
                  <div className="text-[11px] font-black text-slate-700">{point.label}</div>
                  <div className="mt-0.5 text-[10px] font-bold text-blue-700">{formatCompactWon(point.sales)}</div>
                  <div className="text-[10px] font-bold text-[#e34219]">{point.inflow.toLocaleString('ko-KR')}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 bg-white px-4 py-3 text-[11px] font-bold text-slate-500">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-600" /> 순매출</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#e34219]" /> 유입량</span>
          <span>피크월 {peak ? `${peak.label} · ${formatWon(peak.sales)}` : '-'}</span>
        </div>
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[96px] border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">{label}</div>
      <div className="mt-1 text-[14px] font-black text-slate-950">{value}</div>
    </div>
  )
}

function formatWon(value: number) {
  return `${Math.round(value).toLocaleString('ko-KR')}원`
}

function formatCompactWon(value: number) {
  if (Math.abs(value) >= 100_000_000) return `${Math.round(value / 100_000_000).toLocaleString('ko-KR')}억`
  if (Math.abs(value) >= 10_000) return `${Math.round(value / 10_000).toLocaleString('ko-KR')}만`
  return value.toLocaleString('ko-KR')
}
