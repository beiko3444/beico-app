'use client'

import { useEffect, useState } from 'react'
import { CalendarClock, Loader2, MessageSquareText, Send, Smartphone } from 'lucide-react'

type SmsFromNumber = {
  number: string
  validDate: string
}

type SmsBootstrapResponse = {
  senderId: string
  defaultFromNumber: string
  fromNumbers: SmsFromNumber[]
}

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

export default function SmsClient() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState('')
  const [fromNumbers, setFromNumbers] = useState<SmsFromNumber[]>([])
  const [senderId, setSenderId] = useState('')
  const [fromNumber, setFromNumber] = useState('')
  const [toName, setToName] = useState('')
  const [toNumber, setToNumber] = useState('')
  const [contents, setContents] = useState('')
  const [sendAt, setSendAt] = useState('')

  useEffect(() => {
    let ignore = false

    async function bootstrap() {
      setLoading(true)
      setLoadError('')

      try {
        const response = await fetch('/api/admin/sms', { cache: 'no-store' })
        const result = (await response.json()) as Partial<SmsBootstrapResponse> & { error?: string }
        if (!response.ok) {
          throw new Error(result.error || '문자 발송 설정을 불러오지 못했습니다.')
        }
        if (ignore) return

        setSenderId(typeof result.senderId === 'string' ? result.senderId : '')
        setFromNumbers(Array.isArray(result.fromNumbers) ? result.fromNumbers : [])
        setFromNumber(typeof result.defaultFromNumber === 'string' ? result.defaultFromNumber : '')
      } catch (error) {
        if (ignore) return
        setLoadError(error instanceof Error ? error.message : '문자 발송 설정을 불러오지 못했습니다.')
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    bootstrap()
    return () => {
      ignore = true
    }
  }, [])

  const byteLength = getByteLength(contents)
  const sendType = byteLength <= 90 ? 'SMS' : 'LMS'

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
      setToName('')
      setToNumber('')
      setContents('')
      setSendAt('')
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '문자 발송에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold text-[#e34219] uppercase tracking-[0.2em]">Barobill Messaging</p>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">문자발송서비스</h1>
          <p className="text-sm text-gray-500 mt-1">
            바로빌 공식 `SendMessage` SOAP API를 사용해 SMS와 LMS를 발송합니다.
          </p>
        </div>
        <div className="hidden md:flex items-center justify-center w-12 h-12 rounded-2xl bg-[#fff4ef] text-[#e34219] shadow-sm">
          <MessageSquareText size={22} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-[28px] border border-gray-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="p-6 md:p-8 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500">Sender ID</label>
                <div className="h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-700 flex items-center">
                  {senderId || '미설정'}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="fromNumber" className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500">
                  From Number
                </label>
                <select
                  id="fromNumber"
                  value={fromNumber}
                  onChange={(event) => setFromNumber(event.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-900 outline-none focus:border-[#e34219]"
                  required
                  disabled={loading || fromNumbers.length === 0}
                >
                  <option value="">발신번호를 선택하세요</option>
                  {fromNumbers.map((item) => (
                    <option key={item.number} value={item.number}>
                      {item.number}{item.validDate ? ` (${item.validDate})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="toName" className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500">
                  수신자명
                </label>
                <input
                  id="toName"
                  type="text"
                  value={toName}
                  onChange={(event) => setToName(event.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-900 outline-none focus:border-[#e34219]"
                  placeholder="수신자 이름"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="toNumber" className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500">
                  수신번호
                </label>
                <input
                  id="toNumber"
                  type="text"
                  inputMode="numeric"
                  value={toNumber}
                  onChange={(event) => setToNumber(formatPhoneNumber(event.target.value))}
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-900 outline-none focus:border-[#e34219]"
                  placeholder="010-0000-0000"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="contents" className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500">
                문자 내용
              </label>
              <textarea
                id="contents"
                value={contents}
                onChange={(event) => setContents(event.target.value)}
                className="w-full min-h-[220px] px-4 py-4 rounded-2xl border border-gray-200 bg-white text-sm leading-6 text-gray-900 outline-none focus:border-[#e34219] resize-y"
                placeholder="발송할 문자를 입력하세요."
                required
              />
            </div>
          </div>

          <div className="p-6 md:p-8 bg-[linear-gradient(180deg,#fff7f3_0%,#ffffff_100%)] border-t xl:border-t-0 xl:border-l border-gray-100 space-y-5">
            <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500">발송 타입</span>
                <span className={`px-3 py-1 rounded-full text-[11px] font-black ${sendType === 'SMS' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {sendType}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">바이트</div>
                  <div className="text-2xl font-black text-gray-900 mt-2">{byteLength}</div>
                </div>
                <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">기준</div>
                  <div className="text-sm font-bold text-gray-900 mt-2 leading-5">
                    90 bytes 이하 SMS
                    <br />
                    90 bytes 초과 LMS
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="sendAt" className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500">
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
    </div>
  )
}
