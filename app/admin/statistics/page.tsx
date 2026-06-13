import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { Activity, BarChart3, Package, RefreshCw, Search, TrendingUp } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defaultDateRange, normalizeYmdDate, toYmd, ymdToUtcDate } from '@/lib/naverSales'
import { buildNaverSalesDashboard, summarizeInsightRows } from '@/lib/naverSalesAnalytics.mjs'

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

  const [salesRows, insightRows, realtimeSnapshot, latestLog, logs] = await Promise.all([
    prisma.naverSalesDaily.findMany({
      where: { saleDate: { gte: start, lte: end } },
      orderBy: [{ saleDate: 'desc' }, { netAmount: 'desc' }],
      take: 5000,
    }),
    prisma.naverSalesInsightDaily.findMany({
      where: { saleDate: { gte: start, lte: end } },
      orderBy: [{ payAmount: 'desc' }, { orders: 'desc' }, { label: 'asc' }],
      take: 5000,
    }),
    prisma.naverSalesRealtimeSnapshot.findFirst({
      where: { snapshotDate: { gte: start, lte: end } },
      orderBy: { collectedAt: 'desc' },
    }),
    prisma.naverSalesSyncLog.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.naverSalesSyncLog.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
  ])

  const dashboard = buildNaverSalesDashboard(salesRows)
  const keywordRows = summarizeInsightRows(
    insightRows.filter((row) => row.category === 'KEYWORD' || row.category === 'PRODUCT_KEYWORD'),
    12,
  )
  const channelRows = summarizeInsightRows(
    insightRows.filter((row) => row.category === 'CHANNEL' || row.category === 'PRODUCT_MARKETING'),
    12,
  )
  const maxDailyNet = Math.max(...dashboard.byDate.map((row) => row.netAmount), 1)

  return (
    <div className="min-h-screen bg-[#F6F8FB] -mx-4 px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <section className="border border-slate-200 bg-white px-5 py-5 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[13px] font-black text-blue-600">
                <BarChart3 className="h-4 w-4" />
                네이버 전체 통계
              </div>
              <h1 className="mt-2 text-[28px] font-black tracking-tight text-slate-950">상품별 매출 대시보드</h1>
              <p className="mt-1 text-[13px] font-medium text-slate-500">
                선택한 기간의 상품 매출, 검색어, 마케팅 채널, 오늘 수집값을 한 화면에서 봅니다.
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
                className="inline-flex h-9 items-center justify-center rounded-lg border border-blue-600 bg-blue-600 px-4 text-[13px] font-black text-white transition hover:bg-blue-700"
              >
                조회
              </button>
            </form>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <SummaryTile label="총 매출" value={formatWon(dashboard.totals.payAmount)} icon={<TrendingUp className="h-4 w-4" />} tone="blue" />
          <SummaryTile label="순매출" value={formatWon(dashboard.totals.netAmount)} icon={<BarChart3 className="h-4 w-4" />} />
          <SummaryTile label="주문수" value={`${dashboard.totals.orders.toLocaleString('ko-KR')}건`} icon={<Package className="h-4 w-4" />} />
          <SummaryTile label="판매수량" value={`${dashboard.totals.quantity.toLocaleString('ko-KR')}개`} icon={<Activity className="h-4 w-4" />} />
          <SummaryTile label="환불금액" value={formatWon(dashboard.totals.refundAmount)} tone="red" />
          <SummaryTile label="평균 주문" value={formatWon(dashboard.totals.averageOrderAmount)} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-[15px] font-black text-slate-900">상품별 매출금액</h2>
              <span className="text-[12px] font-bold text-slate-400">
                {dashboard.products.length.toLocaleString('ko-KR')}개 상품
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px] border-collapse text-left text-[12px]">
                <thead className="bg-slate-50 text-[11px] font-black text-slate-500">
                  <tr>
                    <th className="px-3 py-2">상품</th>
                    <th className="px-3 py-2">코드</th>
                    <th className="px-3 py-2 text-right">주문</th>
                    <th className="px-3 py-2 text-right">수량</th>
                    <th className="px-3 py-2 text-right">매출금액</th>
                    <th className="px-3 py-2 text-right">환불</th>
                    <th className="px-3 py-2 text-right">순매출</th>
                    <th className="px-3 py-2 text-right">비중</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dashboard.products.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-12 text-center text-[13px] font-bold text-slate-400">
                        선택한 기간에 저장된 네이버 판매 통계가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    dashboard.products.map((row) => (
                      <tr key={row.channelProductNo} className="hover:bg-slate-50/80">
                        <td className="px-3 py-2">
                          <div className="max-w-[420px] truncate font-black text-slate-900">{row.productName || '-'}</div>
                          {row.naverProductName && row.naverProductName !== row.productName ? (
                            <div className="mt-0.5 max-w-[420px] truncate text-[11px] font-medium text-slate-400">
                              네이버: {row.naverProductName}
                            </div>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 font-bold text-slate-500">
                          {row.sellerManagementCode || row.channelProductNo}
                        </td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-700">{row.orders.toLocaleString('ko-KR')}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-700">{row.quantity.toLocaleString('ko-KR')}</td>
                        <td className="px-3 py-2 text-right font-black tabular-nums text-blue-700">{formatWon(row.payAmount)}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-rose-600">{formatWon(row.refundAmount)}</td>
                        <td className="px-3 py-2 text-right font-black tabular-nums text-slate-950">{formatWon(row.netAmount)}</td>
                        <td className="px-3 py-2 text-right font-black tabular-nums text-slate-700">{row.salesShare.toFixed(2)}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="space-y-5">
            <InfoPanel title="오늘 수집값" icon={<Activity className="h-4 w-4 text-blue-600" />}>
              {realtimeSnapshot ? (
                <div className="grid grid-cols-2 gap-2 text-[12px] font-bold">
                  <MetricLine label="매출" value={formatWon(realtimeSnapshot.payAmount)} />
                  <MetricLine label="주문" value={`${realtimeSnapshot.orders.toLocaleString('ko-KR')}건`} />
                  <MetricLine label="수량" value={`${realtimeSnapshot.quantity.toLocaleString('ko-KR')}개`} />
                  <MetricLine label="수집" value={formatDateTime(realtimeSnapshot.collectedAt)} />
                </div>
              ) : (
                <EmptyText text="오늘 통계 스냅샷이 없습니다." />
              )}
            </InfoPanel>

            <InfoPanel title="최근 수집" icon={<RefreshCw className="h-4 w-4 text-blue-600" />}>
              <div className="space-y-2 text-[12px] font-bold text-slate-500">
                <div>상태: <span className="text-slate-900">{latestLog?.status || '-'}</span></div>
                <div>수집기: <span className="text-slate-900">{latestLog?.sourceDevice || '-'}</span></div>
                <div>업로드: <span className="text-slate-900">{latestLog ? formatDateTime(latestLog.createdAt) : '-'}</span></div>
                <div>저장: <span className="text-slate-900">{latestLog?.rowsUpserted?.toLocaleString('ko-KR') || 0}건</span></div>
              </div>
            </InfoPanel>

            <InfoPanel title="일자별 매출 흐름">
              {dashboard.byDate.length === 0 ? (
                <EmptyText text="기간 내 판매량이 없습니다." />
              ) : (
                <div className="space-y-2">
                  {dashboard.byDate.map((row) => (
                    <div key={row.saleDate}>
                      <div className="mb-1 flex items-center justify-between text-[12px] font-bold text-slate-600">
                        <span>{row.saleDate}</span>
                        <span className="tabular-nums text-slate-900">{formatWon(row.netAmount)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(4, (row.netAmount / maxDailyNet) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </InfoPanel>
          </aside>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <InsightTable title="검색어별 매출" icon={<Search className="h-4 w-4 text-blue-600" />} rows={keywordRows} />
          <InsightTable title="마케팅 채널별 매출" icon={<BarChart3 className="h-4 w-4 text-blue-600" />} rows={channelRows} />
        </section>

        <section className="border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-[14px] font-black text-slate-900">최근 업로드 로그</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {logs.map((log) => (
              <div key={log.id} className="border border-slate-100 px-3 py-2 text-[12px] font-bold leading-5 text-slate-500">
                <div className="text-slate-900">{log.status}</div>
                <div>{log.rowsUpserted.toLocaleString('ko-KR')}건</div>
                <div>{formatDateTime(log.createdAt)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function SummaryTile({
  label,
  value,
  icon,
  tone = 'slate',
}: {
  label: string
  value: string
  icon?: ReactNode
  tone?: 'slate' | 'blue' | 'red'
}) {
  const valueColor = tone === 'blue' ? 'text-blue-700' : tone === 'red' ? 'text-rose-600' : 'text-slate-950'
  return (
    <div className="border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-2 text-[11px] font-black text-slate-400">
        <span>{label}</span>
        {icon ? <span className="text-blue-600">{icon}</span> : null}
      </div>
      <div className={`mt-1 text-[19px] font-black tracking-tight tabular-nums ${valueColor}`}>{value}</div>
    </div>
  )
}

function InfoPanel({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-[14px] font-black text-slate-900">
        {icon}
        {title}
      </div>
      {children}
    </div>
  )
}

function InsightTable({ title, icon, rows }: { title: string; icon: ReactNode; rows: Array<{ label: string; interactions: number; orders: number; payAmount: number; netAmount: number }> }) {
  return (
    <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-[15px] font-black text-slate-900">
        {icon}
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left text-[12px]">
          <thead className="bg-slate-50 text-[11px] font-black text-slate-500">
            <tr>
              <th className="px-3 py-2">이름</th>
              <th className="px-3 py-2 text-right">유입/반응</th>
              <th className="px-3 py-2 text-right">주문</th>
              <th className="px-3 py-2 text-right">매출</th>
              <th className="px-3 py-2 text-right">순매출</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-[13px] font-bold text-slate-400">
                  저장된 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.label} className="hover:bg-slate-50/80">
                  <td className="max-w-[240px] truncate px-3 py-2 font-black text-slate-900">{row.label}</td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-600">{row.interactions.toLocaleString('ko-KR')}</td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-600">{row.orders.toLocaleString('ko-KR')}</td>
                  <td className="px-3 py-2 text-right font-black tabular-nums text-blue-700">{formatWon(row.payAmount)}</td>
                  <td className="px-3 py-2 text-right font-black tabular-nums text-slate-950">{formatWon(row.netAmount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-100 px-3 py-2">
      <div className="text-[11px] font-black text-slate-400">{label}</div>
      <div className="mt-1 font-black tabular-nums text-slate-900">{value}</div>
    </div>
  )
}

function EmptyText({ text }: { text: string }) {
  return <p className="text-[12px] font-bold text-slate-400">{text}</p>
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
