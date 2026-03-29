'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, Search } from 'lucide-react'

type CardUsageItem = {
  id: string
  corpNum: string
  cardNum: string
  useKey: string
  useDT: string
  usedAt: string | null
  approvalType: string | null
  approvalNum: string | null
  totalAmount: number | null
  approvalAmount: number | null
  amount: number | null
  tax: number | null
  serviceCharge: number | null
  useStoreName: string | null
  paymentPlan: string | null
  installmentMonths: string | null
  currencyCode: string | null
  memo: string | null
  userMemo: string | null
  syncedAt: string
}

type CardUsageResponse = {
  items: CardUsageItem[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  summary: {
    totalAmount: number
    lastSyncedAt: string | null
  }
}

function formatInputDate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

function maskCard(cardNum: string) {
  const clean = cardNum.replace(/[^\d]/g, '')
  if (clean.length < 8) return cardNum
  return `${clean.slice(0, 4)}-****-****-${clean.slice(-4)}`
}

function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  return '요청 처리 중 오류가 발생했습니다.'
}

function resolveAmount(item: Pick<CardUsageItem, 'totalAmount' | 'approvalAmount' | 'amount' | 'tax' | 'serviceCharge'>) {
  if (typeof item.totalAmount === 'number') return item.totalAmount
  if (typeof item.approvalAmount === 'number') return item.approvalAmount
  if (
    typeof item.amount === 'number' ||
    typeof item.tax === 'number' ||
    typeof item.serviceCharge === 'number'
  ) {
    return (item.amount || 0) + (item.tax || 0) + (item.serviceCharge || 0)
  }
  return 0
}

export default function CardUsageClient() {
  const [startDate, setStartDate] = useState(() => {
    const now = new Date()
    return formatInputDate(new Date(now.getFullYear(), now.getMonth(), 1))
  })
  const [endDate, setEndDate] = useState(() => formatInputDate(new Date()))
  const [cardNum, setCardNum] = useState('')
  const [storeName, setStoreName] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<CardUsageResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [refreshBeforeFetch, setRefreshBeforeFetch] = useState(false)
  const [error, setError] = useState('')
  const [syncMessage, setSyncMessage] = useState('')
  const [memoDrafts, setMemoDrafts] = useState<Record<string, string>>({})
  const [savingMemoId, setSavingMemoId] = useState<string | null>(null)

  const load = useCallback(async (targetPage = page) => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({
        page: String(targetPage),
        pageSize: '50',
        startDate,
        endDate,
      })
      if (cardNum.trim()) qs.set('cardNum', cardNum.trim())
      if (storeName.trim()) qs.set('storeName', storeName.trim())

      const res = await fetch(`/api/admin/card-usage?${qs.toString()}`)
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || '카드 사용내역 조회 실패')
      }
      setData(json)
      const nextDrafts: Record<string, string> = {}
      ;(json.items || []).forEach((item: CardUsageItem) => {
        nextDrafts[item.id] = item.userMemo ?? item.memo ?? ''
      })
      setMemoDrafts(nextDrafts)
      setPage(targetPage)
    } catch (err: unknown) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [page, startDate, endDate, cardNum, storeName])

  useEffect(() => {
    load(1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = () => {
    setSyncMessage('')
    load(1)
  }

  const handleSync = async () => {
    setSyncing(true)
    setError('')
    setSyncMessage('')
    try {
      const res = await fetch('/api/admin/card-usage/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          cardNum: cardNum.trim() || undefined,
          refreshBeforeFetch,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || '카드 사용내역 동기화 실패')
      }

      setSyncMessage(
        `동기화 완료: 조회 ${json.fetchedCount?.toLocaleString?.() ?? 0}건 / 저장 ${json.storedCount?.toLocaleString?.() ?? 0}건`,
      )
      await load(1)
    } catch (err: unknown) {
      setError(errorMessage(err))
    } finally {
      setSyncing(false)
    }
  }

  const handleSaveMemo = async (item: CardUsageItem) => {
    const memo = memoDrafts[item.id] ?? ''
    setSavingMemoId(item.id)
    setError('')
    setSyncMessage('')
    try {
      const res = await fetch('/api/admin/card-usage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, memo }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || '메모 저장 실패')
      }

      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          items: prev.items.map((row) => (
            row.id === item.id ? { ...row, userMemo: json.item?.userMemo ?? null } : row
          )),
        }
      })
      setSyncMessage('메모가 저장되었습니다.')
    } catch (err: unknown) {
      setError(errorMessage(err))
    } finally {
      setSavingMemoId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-black text-gray-900">카드사용내역</h1>
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="h-10 px-4 rounded-lg bg-black text-white text-sm font-bold inline-flex items-center gap-2 disabled:opacity-60"
            >
              {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              바로빌 동기화
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10 px-3 rounded-lg border border-gray-300 text-sm"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-10 px-3 rounded-lg border border-gray-300 text-sm"
            />
            <input
              type="text"
              value={cardNum}
              onChange={(e) => setCardNum(e.target.value)}
              placeholder="카드번호 필터 (선택)"
              className="h-10 px-3 rounded-lg border border-gray-300 text-sm"
            />
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="가맹점명 필터 (선택)"
              className="h-10 px-3 rounded-lg border border-gray-300 text-sm"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading}
              className="h-10 px-4 rounded-lg border border-gray-300 bg-gray-50 text-sm font-bold inline-flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              조회
            </button>
          </div>

          <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={refreshBeforeFetch}
              onChange={(e) => setRefreshBeforeFetch(e.target.checked)}
            />
            동기화 전 카드 즉시조회 요청(RefreshCard) 실행
          </label>

          <div className="text-xs text-gray-500">
            최근 동기화: {formatDateTime(data?.summary?.lastSyncedAt || null)}
            {' · '}
            조회 합계: {(data?.summary?.totalAmount || 0).toLocaleString()}원
            {' · '}
            총 건수: {(data?.totalCount || 0).toLocaleString()}건
          </div>

          {syncMessage ? (
            <div className="text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              {syncMessage}
            </div>
          ) : null}
          {error ? (
            <div className="text-sm font-bold text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          ) : null}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-bold">사용일시</th>
                <th className="text-left px-4 py-3 font-bold">카드번호</th>
                <th className="text-left px-4 py-3 font-bold">가맹점</th>
                <th className="text-left px-4 py-3 font-bold">승인번호</th>
                <th className="text-left px-4 py-3 font-bold">결제수단/할부</th>
                <th className="text-right px-4 py-3 font-bold">합계금액</th>
                <th className="text-left px-4 py-3 font-bold">통화</th>
                <th className="text-left px-4 py-3 font-bold">메모</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    <Loader2 size={16} className="animate-spin inline-block mr-2" />
                    불러오는 중...
                  </td>
                </tr>
              ) : (data?.items?.length || 0) > 0 ? (
                data!.items.map((item) => (
                  <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50/60">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(item.usedAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">{maskCard(item.cardNum)}</td>
                    <td className="px-4 py-3">{item.useStoreName || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{item.approvalNum || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {item.paymentPlan || '-'}
                      {item.installmentMonths ? ` / ${item.installmentMonths}` : ''}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {resolveAmount(item).toLocaleString()}원
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{item.currencyCode || 'KRW'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-[220px]">
                        <input
                          type="text"
                          value={memoDrafts[item.id] ?? ''}
                          onChange={(e) => setMemoDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder={item.memo || '메모 입력'}
                          className="h-8 px-2 w-full rounded-md border border-gray-300 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveMemo(item)}
                          disabled={savingMemoId === item.id}
                          className="h-8 px-2.5 rounded-md border border-gray-300 bg-gray-50 text-xs font-bold whitespace-nowrap disabled:opacity-60"
                        >
                          {savingMemoId === item.id ? '저장중' : '저장'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    조회된 카드 사용내역이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between text-sm">
          <span className="text-gray-500">
            페이지 {data?.page || 1} / {data?.totalPages || 1}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => load(Math.max(1, (data?.page || 1) - 1))}
              disabled={(data?.page || 1) <= 1 || loading}
              className="h-8 px-3 rounded-md border border-gray-300 text-sm font-bold disabled:opacity-50"
            >
              이전
            </button>
            <button
              type="button"
              onClick={() => load(Math.min(data?.totalPages || 1, (data?.page || 1) + 1))}
              disabled={(data?.page || 1) >= (data?.totalPages || 1) || loading}
              className="h-8 px-3 rounded-md border border-gray-300 text-sm font-bold disabled:opacity-50"
            >
              다음
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
