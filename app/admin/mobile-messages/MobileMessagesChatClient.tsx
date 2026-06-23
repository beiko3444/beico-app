'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, MessageSquareText, RefreshCcw, Search, Send, Smartphone, Trash2, X } from 'lucide-react'

export type MobileMessagesChatMessage = {
  id: string
  direction: 'INBOUND' | 'OUTBOUND'
  body: string
  at: string
  status: string
  label: string
  sourceDevice: string | null
  error: string | null
}

export type MobileMessagesChatThread = {
  id: string
  contactName: string
  phoneNumber: string
  lastMessagePreview: string
  lastMessageAt: string
  inboundCount: number
  outboundCount: number
  messages: MobileMessagesChatMessage[]
}

type Props = {
  initialQuery: string
  threads: MobileMessagesChatThread[]
  totalInboundCount: number
  totalOutgoingCount: number
}

const statusLabel: Record<string, string> = {
  PENDING: '대기',
  CLAIMED: '전송중',
  SENT: '전송됨',
  FAILED: '실패',
}

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

const formatTime = (value: string) =>
  new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

function compactPreview(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function formatPhoneNumber(value: string) {
  if (value.length === 11) return `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`
  if (value.length === 10) return `${value.slice(0, 3)}-${value.slice(3, 6)}-${value.slice(6)}`
  return value || '-'
}

export default function MobileMessagesChatClient({
  initialQuery,
  threads,
  totalInboundCount,
  totalOutgoingCount,
}: Props) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [localThreads, setLocalThreads] = useState(threads)
  const [selectedThreadId, setSelectedThreadId] = useState(threads[0]?.id || '')
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLocalThreads(threads)
    setSelectedThreadId((current) => {
      if (current && threads.some((thread) => thread.id === current)) return current
      return threads[0]?.id || ''
    })
  }, [threads])

  const selectedThread = useMemo(
    () => localThreads.find((thread) => thread.id === selectedThreadId) || localThreads[0] || null,
    [localThreads, selectedThreadId]
  )

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [selectedThread?.id, selectedThread?.messages.length])

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    router.push(params.toString() ? `/admin/mobile-messages?${params}` : '/admin/mobile-messages')
  }

  async function handleReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedThread || sending) return
    const contents = replyText.trim()
    if (!contents) return
    if (!selectedThread.phoneNumber) {
      alert('답장할 전화번호가 없습니다.')
      return
    }

    setSending(true)
    try {
      const response = await fetch('/api/admin/mobile-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toName: selectedThread.contactName,
          toNumber: selectedThread.phoneNumber,
          contents,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof result?.error === 'string' ? result.error : '답장 발송 등록에 실패했습니다.')
      }

      const createdAt = typeof result?.message?.createdAt === 'string' ? result.message.createdAt : new Date().toISOString()
      const optimisticMessage: MobileMessagesChatMessage = {
        id: typeof result?.message?.id === 'string' ? result.message.id : `pending-${Date.now()}`,
        direction: 'OUTBOUND',
        body: contents,
        at: createdAt,
        status: 'PENDING',
        label: '대기',
        sourceDevice: null,
        error: null,
      }

      setLocalThreads((current) =>
        current
          .map((thread) => {
            if (thread.id !== selectedThread.id) return thread
            return {
              ...thread,
              lastMessagePreview: contents,
              lastMessageAt: createdAt,
              outboundCount: thread.outboundCount + 1,
              messages: [...thread.messages, optimisticMessage],
            }
          })
          .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
      )
      setReplyText('')
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : '답장 발송 등록에 실패했습니다.')
    } finally {
      setSending(false)
    }
  }

  async function handleDeleteMessage(messageId: string) {
    if (deletingId) return
    if (!window.confirm('이 수신 문자를 삭제할까요?')) return

    setDeletingId(messageId)
    try {
      const response = await fetch(`/api/admin/mobile-messages/${messageId}`, {
        method: 'DELETE',
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof result?.error === 'string' ? result.error : '문자 삭제에 실패했습니다.')
      }
      setLocalThreads((current) =>
        current
          .map((thread) => ({
            ...thread,
            messages: thread.messages.filter((message) => message.id !== messageId),
            inboundCount: thread.messages.some((message) => message.id === messageId && message.direction === 'INBOUND')
              ? Math.max(thread.inboundCount - 1, 0)
              : thread.inboundCount,
          }))
          .filter((thread) => thread.messages.length > 0)
      )
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : '문자 삭제에 실패했습니다.')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[720px] flex-col gap-4">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-blue-700">
            <MessageSquareText size={18} />
            Android SMS/MMS
          </div>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">문자 대화함</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            수신 {totalInboundCount.toLocaleString()}건 · 발신 {totalOutgoingCount.toLocaleString()}건 · 대화 {localThreads.length.toLocaleString()}개
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <RefreshCcw size={16} />
          새로고침
        </button>
      </header>

      <form onSubmit={handleSearch} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="연락처, 전화번호, 메시지 내용 검색"
            className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:bg-white"
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="h-12 rounded-lg bg-slate-950 px-5 text-sm font-black text-white">
            검색
          </button>
          {initialQuery ? (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                router.push('/admin/mobile-messages')
              }}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-black text-slate-600"
            >
              <X size={16} />
              초기화
            </button>
          ) : null}
        </div>
      </form>

      <section className="grid min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="min-h-0 border-b border-slate-200 bg-slate-50/70 lg:border-b-0 lg:border-r">
          {localThreads.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <Smartphone className="mb-3 text-slate-400" size={34} />
              <p className="font-black text-slate-700">대화 내역이 없습니다.</p>
              <p className="mt-1 text-sm font-semibold text-slate-400">휴대폰 앱 동기화 상태를 확인해 주세요.</p>
            </div>
          ) : (
            <div className="h-full overflow-y-auto">
              {localThreads.map((thread) => {
                const active = selectedThread?.id === thread.id
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={`flex w-full items-start gap-3 border-b border-slate-200 px-4 py-4 text-left transition ${
                      active ? 'bg-white' : 'hover:bg-white/80'
                    }`}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white">
                      {thread.contactName.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className="truncate text-sm font-black text-slate-950">{thread.contactName}</span>
                        <span className="shrink-0 text-[11px] font-bold text-slate-400">{formatDateTime(thread.lastMessageAt)}</span>
                      </span>
                      <span className="mt-1 block text-xs font-bold text-slate-500">{formatPhoneNumber(thread.phoneNumber)}</span>
                      <span className="mt-2 line-clamp-2 block text-sm font-semibold leading-5 text-slate-600">
                        {compactPreview(thread.lastMessagePreview)}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </aside>

        <div className="flex min-h-0 flex-col bg-[#F8FAFC]">
          {selectedThread ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-black text-slate-950">{selectedThread.contactName}</h2>
                  <p className="mt-1 text-sm font-bold text-slate-500">
                    {formatPhoneNumber(selectedThread.phoneNumber)} · 받은문자 {selectedThread.inboundCount}건 · 보낸문자 {selectedThread.outboundCount}건
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">대화</span>
              </div>

              <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
                {selectedThread.messages.map((message) => {
                  const outbound = message.direction === 'OUTBOUND'
                  const failed = message.status === 'FAILED'
                  return (
                    <div key={`${message.direction}-${message.id}`} className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
                      <div className={`group max-w-[78%] ${outbound ? 'items-end' : 'items-start'} flex flex-col`}>
                        <div
                          className={`rounded-2xl px-4 py-3 text-sm font-semibold leading-6 shadow-sm ${
                            outbound
                              ? failed
                                ? 'bg-red-600 text-white'
                                : 'bg-blue-600 text-white'
                              : 'border border-slate-200 bg-white text-slate-900'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{message.body}</p>
                        </div>
                        <div className={`mt-1 flex items-center gap-2 text-[11px] font-bold ${outbound ? 'justify-end' : 'justify-start'} text-slate-400`}>
                          <span>{formatTime(message.at)}</span>
                          <span>{outbound ? statusLabel[message.status] || message.status : message.status}</span>
                          {!outbound ? (
                            <button
                              type="button"
                              onClick={() => void handleDeleteMessage(message.id)}
                              disabled={deletingId === message.id}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-red-500 opacity-0 transition hover:bg-red-50 group-hover:opacity-100 disabled:opacity-50"
                              title="수신 문자 삭제"
                              aria-label="수신 문자 삭제"
                            >
                              {deletingId === message.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            </button>
                          ) : null}
                        </div>
                        {message.error ? <p className="mt-1 max-w-sm text-right text-[11px] font-bold text-red-500">{message.error}</p> : null}
                      </div>
                    </div>
                  )
                })}
              </div>

              <form onSubmit={handleReply} className="border-t border-slate-200 bg-white p-4">
                <div className="flex items-end gap-3">
                  <textarea
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    rows={2}
                    placeholder="답장 메시지를 입력하세요"
                    className="min-h-14 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-900 outline-none focus:border-blue-500 focus:bg-white"
                  />
                  <button
                    type="submit"
                    disabled={sending || !replyText.trim() || !selectedThread.phoneNumber}
                    className="inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                    답장
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <MessageSquareText className="mb-3 text-slate-400" size={36} />
              <p className="font-black text-slate-700">대화를 선택해 주세요.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
