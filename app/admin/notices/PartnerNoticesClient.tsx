'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, BellRing, CalendarClock, Edit3, Info, Megaphone, Plus, Power, Trash2, X } from 'lucide-react'

export type PartnerNoticeItem = {
  id: string
  title: string
  content: string
  tone: string
  isActive: boolean
  startsAt: string | null
  endsAt: string | null
  createdByName: string | null
  createdAt: string
  updatedAt: string
}

type NoticeForm = {
  id?: string
  title: string
  content: string
  tone: 'INFO' | 'IMPORTANT' | 'URGENT'
  isActive: boolean
  startsAt: string
  endsAt: string
}

const emptyForm = (): NoticeForm => ({
  title: '',
  content: '',
  tone: 'INFO',
  isActive: true,
  startsAt: '',
  endsAt: '',
})

const toneOptions = [
  { value: 'INFO' as const, label: '일반', icon: Info, active: 'border-blue-500 bg-blue-50 text-blue-700' },
  { value: 'IMPORTANT' as const, label: '중요', icon: BellRing, active: 'border-amber-500 bg-amber-50 text-amber-800' },
  { value: 'URGENT' as const, label: '긴급', icon: AlertTriangle, active: 'border-rose-500 bg-rose-50 text-rose-700' },
]

const toneCard = {
  INFO: 'border-blue-200 bg-blue-50/50',
  IMPORTANT: 'border-amber-200 bg-amber-50/60',
  URGENT: 'border-rose-200 bg-rose-50/60',
} as const

const formatDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  : '제한 없음'

const toLocalDateTime = (value: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

const getStatus = (notice: PartnerNoticeItem) => {
  const now = Date.now()
  if (!notice.isActive) return { label: '사용 중지', style: 'bg-slate-100 text-slate-600' }
  if (notice.startsAt && new Date(notice.startsAt).getTime() > now) return { label: '노출 예약', style: 'bg-violet-100 text-violet-700' }
  if (notice.endsAt && new Date(notice.endsAt).getTime() < now) return { label: '노출 종료', style: 'bg-slate-100 text-slate-500' }
  return { label: '게시 중', style: 'bg-emerald-100 text-emerald-700' }
}

export default function PartnerNoticesClient({ initialNotices }: { initialNotices: PartnerNoticeItem[] }) {
  const [notices, setNotices] = useState(initialNotices)
  const [form, setForm] = useState<NoticeForm>(emptyForm)
  const [editorOpen, setEditorOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const liveCount = useMemo(
    () => notices.filter((notice) => getStatus(notice).label === '게시 중').length,
    [notices],
  )

  const openCreate = () => {
    setForm(emptyForm())
    setError('')
    setEditorOpen(true)
  }

  const openEdit = (notice: PartnerNoticeItem) => {
    setForm({
      id: notice.id,
      title: notice.title,
      content: notice.content,
      tone: toneOptions.some((option) => option.value === notice.tone) ? notice.tone as NoticeForm['tone'] : 'INFO',
      isActive: notice.isActive,
      startsAt: toLocalDateTime(notice.startsAt),
      endsAt: toLocalDateTime(notice.endsAt),
    })
    setError('')
    setEditorOpen(true)
  }

  const saveNotice = async () => {
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/admin/partner-notices', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.notice) throw new Error(payload?.error || '공지를 저장하지 못했습니다.')

      setNotices((current) => [payload.notice, ...current.filter((notice) => notice.id !== payload.notice.id)])
      setEditorOpen(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '공지를 저장하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const toggleNotice = async (notice: PartnerNoticeItem) => {
    setError('')
    try {
      const response = await fetch('/api/admin/partner-notices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notice.id, toggleActive: true, isActive: !notice.isActive }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.notice) throw new Error(payload?.error || '공지 상태를 변경하지 못했습니다.')
      setNotices((current) => current.map((item) => item.id === notice.id ? payload.notice : item))
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : '공지 상태를 변경하지 못했습니다.')
    }
  }

  const deleteNotice = async (notice: PartnerNoticeItem) => {
    if (!window.confirm(`“${notice.title}” 공지를 삭제할까요?`)) return
    setError('')
    try {
      const response = await fetch(`/api/admin/partner-notices?id=${encodeURIComponent(notice.id)}`, { method: 'DELETE' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || '공지를 삭제하지 못했습니다.')
      setNotices((current) => current.filter((item) => item.id !== notice.id))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '공지를 삭제하지 못했습니다.')
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-[#2a2a2a] dark:bg-[#1e1e1e]">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-[#d9361b]">
              <Megaphone size={19} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-950 dark:text-white">파트너 팝업 공지</h1>
              <p className="mt-0.5 text-xs font-medium text-slate-500">현재 파트너에게 노출 중인 공지 {liveCount}개</p>
            </div>
          </div>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#d9361b] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[#c52e16]">
          <Plus size={17} /> 새 공지 등록
        </button>
      </header>

      {error && !editorOpen ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>
      ) : null}

      {notices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center dark:border-[#333] dark:bg-[#1e1e1e]">
          <Megaphone className="mx-auto text-slate-300" size={38} />
          <p className="mt-4 text-base font-black text-slate-700 dark:text-slate-200">등록된 공지가 없습니다.</p>
          <p className="mt-1 text-sm text-slate-400">새 공지를 등록하면 파트너 주문 화면에 팝업으로 표시됩니다.</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {notices.map((notice) => {
            const status = getStatus(notice)
            const cardTone = toneCard[notice.tone as keyof typeof toneCard] || toneCard.INFO
            return (
              <article key={notice.id} className={`rounded-2xl border p-5 shadow-sm ${cardTone} dark:border-[#333] dark:bg-[#1e1e1e]`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${status.style}`}>{status.label}</span>
                      <span className="text-[10px] font-bold text-slate-400">{toneOptions.find((option) => option.value === notice.tone)?.label || '일반'}</span>
                    </div>
                    <h2 className="mt-3 text-lg font-black leading-snug text-slate-950 dark:text-white">{notice.title}</h2>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => openEdit(notice)} aria-label="공지 수정" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-600 dark:border-[#333] dark:bg-[#242424]"><Edit3 size={15} /></button>
                    <button type="button" onClick={() => toggleNotice(notice)} aria-label={notice.isActive ? '공지 중지' : '공지 사용'} className={`flex h-9 w-9 items-center justify-center rounded-lg border bg-white dark:border-[#333] dark:bg-[#242424] ${notice.isActive ? 'border-emerald-200 text-emerald-600' : 'border-slate-200 text-slate-400'}`}><Power size={15} /></button>
                    <button type="button" onClick={() => deleteNotice(notice)} aria-label="공지 삭제" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:border-rose-200 hover:text-rose-600 dark:border-[#333] dark:bg-[#242424]"><Trash2 size={15} /></button>
                  </div>
                </div>
                <p className="mt-4 line-clamp-4 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">{notice.content}</p>
                <div className="mt-5 grid gap-2 rounded-xl border border-white/80 bg-white/65 p-3 text-[11px] font-medium text-slate-500 sm:grid-cols-2 dark:border-[#333] dark:bg-[#242424]">
                  <span className="flex items-center gap-1.5"><CalendarClock size={13} /> 시작: {formatDate(notice.startsAt)}</span>
                  <span className="flex items-center gap-1.5"><CalendarClock size={13} /> 종료: {formatDate(notice.endsAt)}</span>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {editorOpen ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="notice-editor-title" className="max-h-[calc(100dvh-32px)] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl dark:bg-[#1e1e1e]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-5 backdrop-blur dark:border-[#303030] dark:bg-[#1e1e1e]/95">
              <div>
                <p className="text-[10px] font-black tracking-[0.15em] text-[#d9361b]">PARTNER NOTICE</p>
                <h2 id="notice-editor-title" className="mt-1 text-xl font-black text-slate-950 dark:text-white">{form.id ? '공지 수정' : '새 공지 등록'}</h2>
              </div>
              <button type="button" onClick={() => setEditorOpen(false)} aria-label="닫기" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-[#292929] dark:text-slate-300"><X size={18} /></button>
            </div>

            <div className="space-y-5 p-6">
              <label className="block">
                <span className="mb-2 block text-xs font-black text-slate-700 dark:text-slate-200">공지 제목</span>
                <input value={form.title} maxLength={120} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="예: 추석 연휴 배송 일정 안내" className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-[#d9361b] dark:border-[#333] dark:bg-[#242424]" />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black text-slate-700 dark:text-slate-200">공지 내용</span>
                <textarea value={form.content} maxLength={5000} rows={8} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} placeholder="파트너에게 전달할 내용을 입력하세요." className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium leading-6 outline-none focus:border-[#d9361b] dark:border-[#333] dark:bg-[#242424]" />
                <span className="mt-1 block text-right text-[10px] font-medium text-slate-400">{form.content.length.toLocaleString()} / 5,000</span>
              </label>

              <fieldset>
                <legend className="mb-2 text-xs font-black text-slate-700 dark:text-slate-200">공지 중요도</legend>
                <div className="grid grid-cols-3 gap-2">
                  {toneOptions.map((option) => {
                    const Icon = option.icon
                    return (
                      <button key={option.value} type="button" onClick={() => setForm((current) => ({ ...current, tone: option.value }))} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border text-sm font-black transition ${form.tone === option.value ? option.active : 'border-slate-200 bg-white text-slate-500 dark:border-[#333] dark:bg-[#242424]'}`}>
                        <Icon size={16} /> {option.label}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-2 block text-xs font-black text-slate-700 dark:text-slate-200">노출 시작</span>
                  <input type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold dark:border-[#333] dark:bg-[#242424]" />
                  <span className="mt-1 block text-[10px] text-slate-400">비워두면 즉시 시작</span>
                </label>
                <label>
                  <span className="mb-2 block text-xs font-black text-slate-700 dark:text-slate-200">노출 종료</span>
                  <input type="datetime-local" value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold dark:border-[#333] dark:bg-[#242424]" />
                  <span className="mt-1 block text-[10px] text-slate-400">비워두면 계속 노출</span>
                </label>
              </div>

              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-[#333] dark:bg-[#242424]">
                <span>
                  <span className="block text-sm font-black text-slate-800 dark:text-white">공지 사용</span>
                  <span className="mt-0.5 block text-[11px] text-slate-400">끄면 기간과 관계없이 파트너에게 표시되지 않습니다.</span>
                </span>
                <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} className="h-5 w-5 accent-[#d9361b]" />
              </label>

              {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}
            </div>

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur dark:border-[#303030] dark:bg-[#1e1e1e]/95">
              <button type="button" onClick={() => setEditorOpen(false)} className="min-h-11 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-600 dark:border-[#333] dark:text-slate-300">취소</button>
              <button type="button" disabled={saving} onClick={saveNotice} className="min-h-11 rounded-xl bg-[#d9361b] px-6 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60">{saving ? '저장 중...' : '저장하기'}</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
