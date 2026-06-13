import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { BarChart3, RefreshCw } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defaultDateRange, normalizeYmdDate, toYmd, ymdToUtcDate } from '@/lib/naverSales'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function StatisticsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const params = (await searchParams) || {}
  const fallback = defaultDateRange(30)
  const startText = normalizeYmdDate(readParam(params.start)) || fallback.start
  const endText = normalizeYmdDate(readParam(params.end)) || fallback.end
  const start = ymdToUtcDate(startText) || ymdToUtcDate(fallback.start)!
  const end = ymdToUtcDate(endText) || ymdToUtcDate(fallback.end)!

  const [rows, latestLog, logs] = await Promise.all([
    prisma.naverSalesDaily.findMany({
      where: { saleDate: { gte: start, lte: end } },
      orderBy: [{ quantity: 'desc' }, { netAmount: 'desc' }, { productName: 'asc' }],
      take: 500,
    }),
    prisma.naverSalesSyncLog.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.naverSalesSyncLog.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
  ])

  const totals = rows.reduce(
    (acc, row) => {
      acc.orders += row.orders
      acc.quantity += row.quantity
      acc.payAmount += row.payAmount
      acc.refundAmount += row.refundAmount
      acc.netAmount += row.netAmount
      return acc
    },
    { orders: 0, quantity: 0, payAmount: 0, refundAmount: 0, netAmount: 0 },
  )

  const byDate = Array.from(
    rows.reduce((map, row) => {
      const key = toYmd(row.saleDate)
      const current = map.get(key) || { saleDate: key, orders: 0, quantity: 0, netAmount: 0 }
      current.orders += row.orders
      current.quantity += row.quantity
      current.netAmount += row.netAmount
      map.set(key, current)
      return map
    }, new Map<string, { saleDate: string; orders: number; quantity: number; netAmount: number }>()),
  )
    .map(([, value]) => value)
    .sort((a, b) => b.saleDate.localeCompare(a.saleDate))

  return (
    <div className="min-h-screen bg-[#F6F8FB] -mx-4 px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <section className="border border-slate-200 bg-white px-5 py-5 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[13px] font-black text-blue-600">
                <BarChart3 className="h-4 w-4" />
                네이버 판매 통계
              </div>
              <h1 className="mt-2 text-[28px] font-black tracking-tight text-slate-950">통계</h1>
              <p className="mt-1 text-[13px] font-medium text-slate-500">
                라즈베리파이가 수집해 업로드한 네이버 상품별 판매량 집계입니다.
              </p>
            </div>

            <form className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-[11px] font-black text-slate-500">
                시작일
                <input
                  type="date"
                  name="start"
                  defaultValue={startText}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-800 outline-none focus:border-blue-500"
                />
              </label>
              <label className="grid gap-1 text-[11px] font-black text-slate-500">
                종료일
                <input
                  type="date"
                  name="end"
                  defaultValue={endText}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-800 outline-none focus:border-blue-500"
                />
              </label>
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-blue-600 bg-blue-600 px-4 text-[13px] font-black text-white transition hover:bg-blue-700"
              >
                조회
              </button>
            </form>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-5">
          <SummaryTile label="주문수" value={`${totals.orders.toLocaleString('ko-KR')}건`} />
          <SummaryTile label="판매수량" value={`${totals.quantity.toLocaleString('ko-KR')}개`} />
          <SummaryTile label="판매금액" value={formatWon(totals.payAmount)} />
          <SummaryTile label="환불금액" value={formatWon(totals.refundAmount)} tone="red" />
          <SummaryTile label="순매출" value={formatWon(totals.netAmount)} tone="blue" />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-[15px] font-black text-slate-900">상품별 판매량</h2>
              <span className="text-[12px] font-bold text-slate-400">상위 {rows.length.toLocaleString('ko-KR')}개</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-[12px]">
                <thead className="bg-slate-50 text-[11px] font-black text-slate-500">
                  <tr>
                    <th className="px-3 py-2">일자</th>
                    <th className="px-3 py-2">상품</th>
                    <th className="px-3 py-2">코드</th>
                    <th className="px-3 py-2 text-right">주문</th>
                    <th className="px-3 py-2 text-right">수량</th>
                    <th className="px-3 py-2 text-right">판매</th>
                    <th className="px-3 py-2 text-right">환불</th>
                    <th className="px-3 py-2 text-right">순매출</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-12 text-center text-[13px] font-bold text-slate-400">
                        저장된 네이버 판매 통계가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/80">
                        <td className="whitespace-nowrap px-3 py-2 font-bold text-slate-500">{toYmd(row.saleDate)}</td>
                        <td className="px-3 py-2">
                          <div className="max-w-[360px] truncate font-black text-slate-900">
                            {row.dbProductName || row.productName || '-'}
                          </div>
                          {row.dbProductName && row.productName && row.dbProductName !== row.productName ? (
                            <div className="mt-0.5 max-w-[360px] truncate text-[11px] font-medium text-slate-400">
                              네이버: {row.productName}
                            </div>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 font-bold text-slate-500">
                          {row.sellerManagementCode || row.channelProductNo}
                        </td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-700">{row.orders.toLocaleString('ko-KR')}</td>
                        <td className="px-3 py-2 text-right font-black tabular-nums text-blue-700">{row.quantity.toLocaleString('ko-KR')}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-700">{formatWon(row.payAmount)}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-rose-600">{formatWon(row.refundAmount)}</td>
                        <td className="px-3 py-2 text-right font-black tabular-nums text-slate-950">{formatWon(row.netAmount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-[14px] font-black text-slate-900">
                <RefreshCw className="h-4 w-4 text-blue-600" />
                최근 수집
              </div>
              <div className="mt-3 space-y-2 text-[12px] font-bold text-slate-500">
                <div>상태: <span className="text-slate-900">{latestLog?.status || '-'}</span></div>
                <div>수집기: <span className="text-slate-900">{latestLog?.sourceDevice || '-'}</span></div>
                <div>업로드: <span className="text-slate-900">{latestLog ? formatDateTime(latestLog.createdAt) : '-'}</span></div>
                <div>저장: <span className="text-slate-900">{latestLog?.rowsUpserted?.toLocaleString('ko-KR') || 0}건</span></div>
              </div>
              {latestLog?.errorMessage ? (
                <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[12px] font-bold leading-5 text-rose-700">
                  {latestLog.errorMessage}
                </p>
              ) : null}
            </div>

            <div className="border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-[14px] font-black text-slate-900">일자별 요약</h2>
              <div className="mt-3 space-y-2">
                {byDate.length === 0 ? (
                  <p className="text-[12px] font-bold text-slate-400">기간 내 판매량이 없습니다.</p>
                ) : (
                  byDate.map((row) => (
                    <div key={row.saleDate} className="grid grid-cols-[82px_1fr] gap-2 border-b border-slate-100 pb-2 last:border-0">
                      <div className="text-[12px] font-black text-slate-700">{row.saleDate}</div>
                      <div className="text-right text-[12px] font-bold text-slate-500">
                        {row.quantity.toLocaleString('ko-KR')}개 · {formatWon(row.netAmount)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-[14px] font-black text-slate-900">최근 업로드 로그</h2>
              <div className="mt-3 space-y-2">
                {logs.map((log) => (
                  <div key={log.id} className="text-[12px] font-bold leading-5 text-slate-500">
                    <span className="text-slate-900">{log.status}</span> · {log.rowsUpserted.toLocaleString('ko-KR')}건 · {formatDateTime(log.createdAt)}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  )
}

function SummaryTile({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'blue' | 'red' }) {
  const valueColor = tone === 'blue' ? 'text-blue-700' : tone === 'red' ? 'text-rose-600' : 'text-slate-950'
  return (
    <div className="border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-[11px] font-black text-slate-400">{label}</div>
      <div className={`mt-1 text-[20px] font-black tracking-tight tabular-nums ${valueColor}`}>{value}</div>
    </div>
  )
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function formatWon(value: number) {
  return `${Math.round(value).toLocaleString('ko-KR')}원`
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}
