'use client'

import { useMemo, useState } from 'react'

export type ProductSalesTrendPoint = {
  monthKey: string
  label: string
  quantity: number
  total: number
  orders: number
}

export type ProductSalesTrendRow = {
  productId: string
  productName: string
  productCode: string | null
  imageUrl: string | null
  quantity: number
  total: number
  points: ProductSalesTrendPoint[]
}

export default function ProductSalesTrend({
  products,
  allPoints,
}: {
  products: ProductSalesTrendRow[]
  allPoints: ProductSalesTrendPoint[]
}) {
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.productId || 'all')
  const selectedProduct = products.find((product) => product.productId === selectedProductId) || null
  const points = selectedProduct ? selectedProduct.points : allPoints
  const selectedName = selectedProduct?.productName || '전체 상품'
  const total = points.reduce((sum, point) => sum + point.total, 0)
  const quantity = points.reduce((sum, point) => sum + point.quantity, 0)
  const orderCount = points.reduce((sum, point) => sum + point.orders, 0)
  const peak = points.reduce((best, point) => point.total > best.total ? point : best, points[0] || null)
  const maxSales = Math.max(...points.map((point) => point.total), 1)
  const maxQuantity = Math.max(...points.map((point) => point.quantity), 1)
  const linePoints = points.map((point, index) => {
    const x = 36 + index * (528 / Math.max(points.length - 1, 1))
    const y = 166 - (point.quantity / maxQuantity) * 124
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const productOptions = useMemo(() => {
    return products.slice().sort((a, b) => b.total - a.total || b.quantity - a.quantity || a.productName.localeCompare(b.productName, 'ko'))
  }, [products])

  return (
    <section className="border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-[12px] font-black uppercase tracking-[0.18em] text-blue-600">Product Trend</div>
          <h2 className="mt-1 text-[22px] font-black tracking-tight text-slate-950">상품별 판매추세</h2>
          <p className="mt-1 text-[13px] font-medium text-slate-500">
            상품을 지정하면 베이코 주문 DB 기준 최근 12개월 월별 매출과 판매수량을 보여줍니다.
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setSelectedProductId('all')}
          className={`flex min-w-[160px] items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
            selectedProductId === 'all'
              ? 'border-blue-600 bg-blue-50 text-blue-700'
              : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200'
          }`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-[11px] font-black text-white">ALL</div>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-black">전체 상품</div>
            <div className="mt-0.5 text-[10px] font-bold text-slate-400">통합 추세</div>
          </div>
        </button>

        {productOptions.map((product) => (
          <button
            key={product.productId}
            type="button"
            onClick={() => setSelectedProductId(product.productId)}
            className={`flex min-w-[220px] items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
              selectedProductId === product.productId
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200'
            }`}
          >
            <ProductThumb src={product.imageUrl} name={product.productName} />
            <div className="min-w-0">
              <div className="truncate text-[12px] font-black">{product.productName}</div>
              <div className="mt-0.5 text-[10px] font-bold text-slate-400">
                {product.quantity.toLocaleString('ko-KR')}개 · {formatWon(product.total)}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="flex items-center gap-3 border border-slate-200 bg-slate-50 px-4 py-3">
          {selectedProduct ? <ProductThumb src={selectedProduct.imageUrl} name={selectedProduct.productName} /> : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-[11px] font-black text-white">ALL</div>}
          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase tracking-[0.08em] text-slate-400">선택 상품</div>
            <div className="mt-1 truncate text-[16px] font-black text-slate-950" title={selectedName}>{selectedName}</div>
          </div>
        </div>
        <Metric label="판매수량" value={`${quantity.toLocaleString('ko-KR')}개`} />
        <Metric label="매출" value={formatWon(total)} />
        <Metric label="피크월" value={peak ? `${peak.label} · ${formatWon(peak.total)}` : '-'} />
      </div>

      <div className="mt-5 overflow-hidden border border-slate-200 bg-slate-50/60">
        <div className="h-[300px] overflow-x-auto px-4 py-5">
          <div className="relative h-full min-w-[720px]">
            <svg viewBox="0 0 600 190" className="h-[205px] w-full overflow-visible" role="img" aria-label={`${selectedName} 판매추세`}>
              {[42, 73, 104, 135, 166].map((y) => (
                <line key={y} x1="28" x2="578" y1={y} y2={y} stroke="#E2E8F0" strokeDasharray="4 4" />
              ))}
              {points.map((point, index) => {
                const x = 24 + index * (552 / Math.max(points.length, 1))
                const height = Math.max(point.total > 0 ? 6 : 0, (point.total / maxSales) * 124)
                return (
                  <g key={point.monthKey}>
                    <rect x={x} y={166 - height} width="30" height={height} rx="7" fill="#CBD5E1" />
                    <title>{`${point.label} 매출 ${formatWon(point.total)} / ${point.quantity.toLocaleString('ko-KR')}개`}</title>
                  </g>
                )
              })}
              <polyline points={linePoints} fill="none" stroke="#E34219" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((point, index) => {
                const x = 36 + index * (528 / Math.max(points.length - 1, 1))
                const y = 166 - (point.quantity / maxQuantity) * 124
                return <circle key={point.monthKey} cx={x} cy={y} r={point.quantity > 0 ? 5 : 3} fill="#E34219" stroke="#fff" strokeWidth="2" />
              })}
            </svg>
            <div className="grid grid-cols-12 gap-1">
              {points.map((point) => (
                <div key={point.monthKey} className="min-h-[54px] rounded-xl bg-white px-1 py-2 text-center">
                  <div className="text-[11px] font-black text-slate-700">{point.label}</div>
                  <div className="mt-0.5 text-[10px] font-bold text-slate-500">{point.quantity.toLocaleString('ko-KR')}개</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 bg-white px-4 py-3 text-[11px] font-bold text-slate-500">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-300" /> 월 매출</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#e34219]" /> 판매수량</span>
          <span>주문 {orderCount.toLocaleString('ko-KR')}건</span>
        </div>
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-black uppercase tracking-[0.08em] text-slate-400">{label}</div>
      <div className="mt-1 truncate text-[16px] font-black text-slate-950" title={value}>{value}</div>
    </div>
  )
}

function ProductThumb({ src, name }: { src: string | null; name: string }) {
  return (
    <div
      className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 bg-slate-100 bg-cover bg-center"
      style={src ? { backgroundImage: `url(${src})` } : undefined}
      aria-label={name}
    >
      {!src ? (
        <div className="flex h-full w-full items-center justify-center text-[10px] font-black text-slate-400">
          IMG
        </div>
      ) : null}
    </div>
  )
}

function formatWon(value: number) {
  return `${Math.round(value).toLocaleString('ko-KR')}원`
}
