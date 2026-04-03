'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Loader2, MessageSquareText, RefreshCw, Save, Send, Smartphone, Trash2, UserPlus } from 'lucide-react'

type SmsFromNumber = {
  number: string
  validDate: string
}

type SmsRecipient = {
  id: string
  name: string
  phoneNumber: string
  createdAt: string
  updatedAt: string
}

type SmsHistoryItem = {
  sendKey: string
  id: string
  senderNum: string
  receiverName: string
  receiverNum: string
  message: string
  sendDT: string
  refKey: string
  sendState: number
}

type SmsHistoryResponse = {
  fromDate: string
  toDate: string
  currentPage: number
  maxIndex: number
  countPerPage: number
  maxPageNum: number
  messages: SmsHistoryItem[]
}

type SmsBootstrapResponse = {
  senderId: string
  defaultFromNumber: string
  fromNumbers: SmsFromNumber[]
  recipients: SmsRecipient[]
  history: SmsHistoryResponse
}

const HISTORY_PAGE_SIZE = 20

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  if (digits.length <= 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`
}

function getByteLength(value: string) {
  return new Blob([value]).size
}

function formatDateInput(date: Date) {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toCompactDate(value: string) {
  return value.replace(/\D/g, '')
}

function formatSendDateTime(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length < 12) return value || '-'

  const year = digits.slice(0, 4)
  const month = digits.slice(4, 6)
  const day = digits.slice(6, 8)
  const hour = digits.slice(8, 10)
  const minute = digits.slice(10, 12)
  return `${year}.${month}.${day} ${hour}:${minute}`
}

function getSendStateLabel(state: number) {
  if (state === 0) return '대기(0)'
  if (state === 1) return '완료(1)'
  return `상태코드 ${state}`
}

function getSendStateClass(state: number) {
  if (state === 1) return 'bg-emerald-100 text-emerald-700'
  if (state === 0) return 'bg-amber-100 text-amber-700'
  return 'bg-slate-100 text-slate-700'
}

export default function SmsClient() {
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savingRecipient, setSavingRecipient] = useState(false)
  const [deletingRecipientId, setDeletingRecipientId] = useState('')
  const [loadError, setLoadError] = useState('')
  const [historyError, setHistoryError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState('')
  const [recipientActionMessage, setRecipientActionMessage] = useState('')
  const [recipientActionError, setRecipientActionError] = useState('')
  const [fromNumbers, setFromNumbers] = useState<SmsFromNumber[]>([])
  const [recipients, setRecipients] = useState<SmsRecipient[]>([])
  const [selectedRecipientId, setSelectedRecipientId] = useState('')
  const [fromNumber, setFromNumber] = useState('')
  const [toName, setToName] = useState('')
  const [toNumber, setToNumber] = useState('')
  const [contents, setContents] = useState('')
  const [sendAt, setSendAt] = useState('')
  const [history, setHistory] = useState<SmsHistoryResponse | null>(null)
  const [historyFromDate, setHistoryFromDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return formatDateInput(date)
  })
  const [historyToDate, setHistoryToDate] = useState(() => formatDateInput(new Date()))

  const selectedRecipient = useMemo(
    () => recipients.find((item) => item.id === selectedRecipientId) || null,
    [recipients, selectedRecipientId]
  )

  async function loadSmsData(page = 1, showFullLoader = false) {
    if (showFullLoader) {
      setLoading(true)
      setLoadError('')
    } else {
      setHistoryLoading(true)
      setHistoryError('')
    }

    try {
      const query = new URLSearchParams({
        fromDate: toCompactDate(historyFromDate),
        toDate: toCompactDate(historyToDate),
        currentPage: String(page),
        countPerPage: String(HISTORY_PAGE_SIZE),
      })

      const response = await fetch(`/api/admin/sms?${query.toString()}`, { cache: 'no-store' })
      const result = (await response.json()) as Partial<SmsBootstrapResponse> & { error?: string }
      if (!response.ok) {
        throw new Error(result.error || '문자 발송 정보를 불러오지 못했습니다.')
      }

      const nextRecipients = Array.isArray(result.recipients) ? result.recipients : []

      setFromNumbers(Array.isArray(result.fromNumbers) ? result.fromNumbers : [])
      setRecipients(nextRecipients)
      setFromNumber((current) => {
        const currentExists = Array.isArray(result.fromNumbers) && result.fromNumbers.some((item) => item.number === current)
        if (currentExists) return current
        return typeof result.defaultFromNumber === 'string' ? result.defaultFromNumber : ''
      })
      setSelectedRecipientId((current) => {
        if (current && nextRecipients.some((item) => item.id === current)) {
          return current
        }
        return ''
      })
      setHistory(result.history ?? null)
    } catch (error) {
      const message = error instanceof Error ? error.message : '문자 발송 정보를 불러오지 못했습니다.'
      if (showFullLoader) {
        setLoadError(message)
      } else {
        setHistoryError(message)
      }
    } finally {
      if (showFullLoader) {
        setLoading(false)
      } else {
        setHistoryLoading(false)
      }
    }
  }

  useEffect(() => {
    void loadSmsData(1, true)
  }, [])

  const byteLength = getByteLength(contents)
  const sendType = byteLength <= 90 ? 'SMS' : 'LMS'

  function applyRecipient(recipient: SmsRecipient | null) {
    if (!recipient) return
    setToName(recipient.name)
    setToNumber(formatPhoneNumber(recipient.phoneNumber))
    setSelectedRecipientId(recipient.id)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setSubmitError('')
    setSubmitSuccess('')

    try {
      const response = await fetch('/api/admin/sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromNumber,
          toName,
          toNumber,
          contents,
          sendAt,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(typeof result?.error === 'string' ? result.error : '문자 발송에 실패했습니다.')
      }

      setSubmitSuccess(
        result?.scheduled
          ? `예약 발송이 등록되었습니다. 접수번호: ${result.receiptNum || '-'}`
          : `문자 발송이 완료되었습니다. 접수번호: ${result.receiptNum || '-'}`
      )
      setContents('')
      setSendAt('')
      await loadSmsData(history?.currentPage || 1, false)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '문자 발송에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSaveRecipient() {
    setRecipientActionMessage('')
    setRecipientActionError('')
    setSavingRecipient(true)

    try {
      const response = await fetch('/api/admin/sms/recipients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: toName,
          phoneNumber: toNumber,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(typeof result?.error === 'string' ? result.error : '수신자 저장에 실패했습니다.')
      }

      setRecipientActionMessage('수신자가 저장되었습니다.')
      await loadSmsData(history?.currentPage || 1, false)

      if (result?.recipient?.id) {
        setSelectedRecipientId(result.recipient.id)
      }
    } catch (error) {
      setRecipientActionError(error instanceof Error ? error.message : '수신자 저장에 실패했습니다.')
    } finally {
      setSavingRecipient(false)
    }
  }

  async function handleDeleteRecipient(id: string) {
    const target = recipients.find((item) => item.id === id)
    if (!target) return
    if (!window.confirm(`${target.name} 수신자를 삭제할까요?`)) return

    setRecipientActionMessage('')
    setRecipientActionError('')
    setDeletingRecipientId(id)

    try {
      const response = await fetch(`/api/admin/sms/recipients/${id}`, {
        method: 'DELETE',
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(typeof result?.error === 'string' ? result.error : '수신자 삭제에 실패했습니다.')
      }

      if (selectedRecipientId === id) {
        setSelectedRecipientId('')
      }
      setRecipientActionMessage('수신자가 삭제되었습니다.')
      await loadSmsData(history?.currentPage || 1, false)
    } catch (error) {
      setRecipientActionError(error instanceof Error ? error.message : '수신자 삭제에 실패했습니다.')
    } finally {
      setDeletingRecipientId('')
    }
  }

  function handleHistorySearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void loadSmsData(1, false)
  }

  function moveHistoryPage(nextPage: number) {
    if (!history) return
    if (nextPage < 1 || nextPage > history.maxPageNum) return
    void loadSmsData(nextPage, false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold text-[#e34219] uppercase tracking-[0.2em]">Barobill Messaging</p>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">문자발송서비스</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            바로빌 공식 `SendMessage` 및 `GetSMSSendMessagesByPaging` SOAP API를 사용합니다.
          </p>
        </div>
        <div className="hidden md:flex items-center justify-center w-12 h-12 rounded-2xl bg-[#fff4ef] text-[#e34219] shadow-sm dark:shadow-none">
          <MessageSquareText size={22} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-[#1e1e1e] rounded-[28px] border border-gray-200 dark:border-[#2a2a2a] shadow-sm dark:shadow-none overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="p-6 md:p-8 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="fromNumber" className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  From Number
                </label>
                <select
                  id="fromNumber"
                  value={fromNumber}
                  onChange={(event) => setFromNumber(event.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1e1e1e] text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-[#e34219]"
                  required
                  disabled={loading || fromNumbers.length === 0}
                >
                  <option value="">발신번호를 선택하세요</option>
                  {fromNumbers.map((item) => (
                    <option key={item.number} value={item.number}>
                      {formatPhoneNumber(item.number)}{item.validDate ? ` (${item.validDate})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="savedRecipient" className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  저장된 수신자
                </label>
                <div className="flex gap-2">
                  <select
                    id="savedRecipient"
                    value={selectedRecipientId}
                    onChange={(event) => setSelectedRecipientId(event.target.value)}
                    className="flex-1 h-12 px-4 rounded-xl border border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1e1e1e] text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-[#e34219]"
                  >
                    <option value="">수신자를 선택하세요</option>
                    {recipients.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} / {formatPhoneNumber(item.phoneNumber)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => applyRecipient(selectedRecipient)}
                    disabled={!selectedRecipient}
                    className="shrink-0 h-12 px-4 rounded-xl border border-gray-200 dark:border-[#2a2a2a] text-sm font-black text-gray-700 dark:text-gray-400 disabled:opacity-50"
                  >
                    적용
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="toName" className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  수신자명
                </label>
                <input
                  id="toName"
                  type="text"
                  value={toName}
                  onChange={(event) => setToName(event.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1e1e1e] text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-[#e34219]"
                  placeholder="수신자 이름"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="toNumber" className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  수신번호
                </label>
                <input
                  id="toNumber"
                  type="text"
                  inputMode="numeric"
                  value={toNumber}
                  onChange={(event) => setToNumber(formatPhoneNumber(event.target.value))}
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1e1e1e] text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-[#e34219]"
                  placeholder="010-0000-0000"
                  required
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSaveRecipient}
                disabled={savingRecipient}
                className="h-11 px-5 rounded-xl bg-[#101828] text-white text-sm font-black inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {savingRecipient ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
                수신자 등록하기
              </button>

              {recipientActionMessage && <p className="text-sm font-bold text-emerald-600">{recipientActionMessage}</p>}
              {recipientActionError && <p className="text-sm font-bold text-red-600">{recipientActionError}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="contents" className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                문자 내용
              </label>
              <textarea
                id="contents"
                value={contents}
                onChange={(event) => setContents(event.target.value)}
                className="w-full min-h-[220px] px-4 py-4 rounded-2xl border border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1e1e1e] text-sm leading-6 text-gray-900 dark:text-white outline-none focus:border-[#e34219] resize-y"
                placeholder="발송할 문자를 입력하세요."
                required
              />
            </div>
          </div>

          <div className="p-6 md:p-8 bg-[linear-gradient(180deg,#fff7f3_0%,#ffffff_100%)] dark:bg-[linear-gradient(180deg,#1a1a1a_0%,#1e1e1e_100%)] border-t xl:border-t-0 xl:border-l border-gray-100 dark:border-[#2a2a2a] space-y-5">
            <div className="rounded-2xl bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#2a2a2a] p-5 space-y-4 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">발송 타입</span>
                <span className={`px-3 py-1 rounded-full text-[11px] font-black ${sendType === 'SMS' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {sendType}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-gray-50 dark:bg-[#1a1a1a] border border-gray-100 dark:border-[#2a2a2a] p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-400 dark:text-gray-400">바이트</div>
                  <div className="text-2xl font-black text-gray-900 dark:text-white mt-2">{byteLength}</div>
                </div>
                <div className="rounded-2xl bg-gray-50 dark:bg-[#1a1a1a] border border-gray-100 dark:border-[#2a2a2a] p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-400 dark:text-gray-400">기준</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white mt-2 leading-5">
                    90 bytes 이하 SMS
                    <br />
                    90 bytes 초과 LMS
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="sendAt" className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  예약 발송 (선택)
                </label>
                <div className="relative">
                  <CalendarClock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    id="sendAt"
                    type="datetime-local"
                    value={sendAt}
                    onChange={(event) => setSendAt(event.target.value)}
                    className="w-full h-12 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-900 outline-none focus:border-[#e34219]"
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-[#101828] text-white p-4 space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-white/70">
                  <Smartphone size={14} />
                  미리보기
                </div>
                <div className="text-sm leading-6 whitespace-pre-wrap break-words min-h-[84px]">
                  {contents || '여기에 문자 미리보기가 표시됩니다.'}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || submitting}
                className="w-full h-12 rounded-xl bg-[#e34219] hover:bg-[#cf3b16] text-white font-black text-sm tracking-wide inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    발송 중...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    문자 발송
                  </>
                )}
              </button>
            </div>

            {loadError && <p className="text-sm font-bold text-red-600">{loadError}</p>}
            {submitError && <p className="text-sm font-bold text-red-600">{submitError}</p>}
            {submitSuccess && <p className="text-sm font-bold text-emerald-600">{submitSuccess}</p>}
          </div>
        </div>
      </form>

      <section className="bg-white rounded-[28px] border border-gray-200 shadow-sm p-6 md:p-8 space-y-5">
        <div>
          <p className="text-[11px] font-bold text-[#e34219] uppercase tracking-[0.2em]">Recipients</p>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">저장된 수신자</h2>
          <p className="text-sm text-gray-500 mt-1">
            등록한 수신자를 저장해두고 문자 발송 시 바로 불러올 수 있습니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {recipients.length ? (
            recipients.map((item) => (
              <div key={item.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                <div>
                  <div className="text-base font-black text-gray-900">{item.name}</div>
                  <div className="text-sm font-semibold text-gray-500 mt-1">{formatPhoneNumber(item.phoneNumber)}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => applyRecipient(item)}
                    className="flex-1 h-10 rounded-xl bg-white border border-gray-200 text-sm font-black text-gray-800 inline-flex items-center justify-center gap-2"
                  >
                    <Save size={14} />
                    불러오기
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteRecipient(item.id)}
                    disabled={deletingRecipientId === item.id}
                    className="h-10 px-3 rounded-xl border border-red-200 bg-white text-red-600 inline-flex items-center justify-center disabled:opacity-50"
                  >
                    {deletingRecipientId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm font-bold text-gray-400">
              저장된 수신자가 없습니다.
            </div>
          )}
        </div>
      </section>

      <section className="bg-white rounded-[28px] border border-gray-200 shadow-sm p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold text-[#e34219] uppercase tracking-[0.2em]">History</p>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">문자 발송내역</h2>
            <p className="text-sm text-gray-500 mt-1">
              기간별로 바로빌 문자 발송내역을 조회합니다.
            </p>
          </div>

          <form onSubmit={handleHistorySearch} className="flex flex-col md:flex-row gap-3 md:items-end">
            <div className="space-y-1">
              <label htmlFor="historyFromDate" className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-500">
                시작일
              </label>
              <input
                id="historyFromDate"
                type="date"
                value={historyFromDate}
                onChange={(event) => setHistoryFromDate(event.target.value)}
                className="h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-900 outline-none focus:border-[#e34219]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="historyToDate" className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-500">
                종료일
              </label>
              <input
                id="historyToDate"
                type="date"
                value={historyToDate}
                onChange={(event) => setHistoryToDate(event.target.value)}
                className="h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-900 outline-none focus:border-[#e34219]"
              />
            </div>

            <button
              type="submit"
              disabled={historyLoading || loading}
              className="h-11 px-5 rounded-xl bg-[#101828] text-white text-sm font-black inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {historyLoading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              조회
            </button>
          </form>
        </div>

        {historyError && <p className="text-sm font-bold text-red-600">{historyError}</p>}

        <div className="rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-black">발송일시</th>
                  <th className="px-4 py-3 text-left font-black">상태</th>
                  <th className="px-4 py-3 text-left font-black">수신자</th>
                  <th className="px-4 py-3 text-left font-black">수신번호</th>
                  <th className="px-4 py-3 text-left font-black">발신번호</th>
                  <th className="px-4 py-3 text-left font-black">내용</th>
                  <th className="px-4 py-3 text-left font-black">RefKey</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history?.messages.length ? (
                  history.messages.map((item) => (
                    <tr key={item.sendKey || `${item.refKey}-${item.receiverNum}-${item.sendDT}`} className="align-top">
                      <td className="px-4 py-4 font-semibold text-gray-900 whitespace-nowrap">
                        {formatSendDateTime(item.sendDT)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black ${getSendStateClass(item.sendState)}`}>
                          {getSendStateLabel(item.sendState)}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-semibold text-gray-900 whitespace-nowrap">{item.receiverName || '-'}</td>
                      <td className="px-4 py-4 text-gray-700 whitespace-nowrap">{formatPhoneNumber(item.receiverNum || '') || '-'}</td>
                      <td className="px-4 py-4 text-gray-700 whitespace-nowrap">{formatPhoneNumber(item.senderNum || '') || '-'}</td>
                      <td className="px-4 py-4 text-gray-700 min-w-[320px]">
                        <div className="line-clamp-2 whitespace-pre-wrap break-words">{item.message || '-'}</div>
                      </td>
                      <td className="px-4 py-4 text-gray-500 whitespace-nowrap">{item.refKey || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm font-bold text-gray-400">
                      {historyLoading ? '발송내역을 불러오는 중입니다.' : '조회된 문자 발송내역이 없습니다.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-sm font-semibold text-gray-500">
            {history ? `총 ${history.maxIndex}건 · ${history.currentPage} / ${history.maxPageNum} 페이지` : '발송내역을 불러오는 중입니다.'}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => moveHistoryPage((history?.currentPage || 1) - 1)}
              disabled={!history || history.currentPage <= 1 || historyLoading}
              className="h-10 px-4 rounded-xl border border-gray-200 text-sm font-black text-gray-700 disabled:opacity-50"
            >
              이전
            </button>
            <button
              type="button"
              onClick={() => moveHistoryPage((history?.currentPage || 1) + 1)}
              disabled={!history || history.currentPage >= history.maxPageNum || historyLoading}
              className="h-10 px-4 rounded-xl border border-gray-200 text-sm font-black text-gray-700 disabled:opacity-50"
            >
              다음
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
