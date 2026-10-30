'use client'

import { useMemo, useState } from 'react'
import { CalendarClock, ChevronDown, Edit3, Megaphone, Plus, Trash2 } from 'lucide-react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import { buttonClass } from '@/components/ui/buttonClass'
import Badge, { type BadgeTone } from '@/components/ui/Badge'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import EmptyState from '@/components/ui/EmptyState'
import ModalCloseButton from '@/components/ui/ModalCloseButton'
import { fieldClass, labelClass, selectClass } from '@/components/ui/field'
import { formatDateTime } from '@/lib/format'

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

// Importance shows as a pill and a thin left bar; the card itself stays white so tone colours don't flood the page.
const toneOptions = [
  { value: 'INFO' as const, label: '일반', badge: 'neutral' as BadgeTone, bar: 'border-l-slate-300' },
  { value: 'IMPORTANT' as const, label: '중요', badge: 'warning' as BadgeTone, bar: 'border-l-amber-400' },
  { value: 'URGENT' as const, label: '긴급', badge: 'danger' as BadgeTone, bar: 'border-l-rose-500' },
]

const formatDate = (value: string | null) => value ? formatDateTime(value) : '제한 없음'

const toLocalDateTime = (value: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

const getStatus = (notice: PartnerNoticeItem): { label: string; tone: BadgeTone } => {
  const now = Date.now()
  if (!notice.isActive) return { label: '사용 중지', tone: 'neutral' }
  if (notice.startsAt && new Date(notice.startsAt).getTime() > now) return { label: '노출 예약', tone: 'info' }
  if (notice.endsAt && new Date(notice.endsAt).getTime() < now) return { label: '노출 종료', tone: 'neutral' }
  return { label: '노출 중', tone: 'success' }
}

/**
 * The browser's datetime-local shows its own locale template ("mm/dd/yyyy, --:-- --") that reads like a value.
 * Separate date and time boxes stay grey until filled, and the time box only opens once a date is set.
 */
function DateTimeField({ id, value, onChange, defaultTime }: { id: string; value: string; onChange: (value: string) => void; defaultTime: string }) {
  const [date = '', time = ''] = value ? value.split('T') : []
  return (
    <div className="flex gap-2">
      <input id={id} type="date" lang="ko-KR" value={date} max="9999-12-31"
        onChange={(event) => onChange(event.target.value ? `${event.target.value}T${time || defaultTime}` : '')}
        className={selectClass(Boolean(date), 'min-w-0 flex-1 pr-3 tabular-nums')} />
      <input type="time" lang="ko-KR" aria-label="시각" value={date ? time : ''} disabled={!date}
        onChange={(event) => onChange(`${date}T${event.target.value || defaultTime}`)}
        className={selectClass(Boolean(date && time), 'w-[112px] shrink-0 pr-3 tabular-nums')} />
    </div>
  )
}

/** Visual track for an on/off switch; the caller supplies the control and its label. */
function SwitchTrack({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${on ? 'bg-emerald-600' : 'bg-slate-300'}`}>
      <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-4' : 'translate-x-0'}`} />
    </span>
  )
}

const fieldLabelClass = labelClass

export default function PartnerNoticesClient({ initialNotices }: { initialNotices: PartnerNoticeItem[] }) {
  const [notices, setNotices] = useState(initialNotices)
  const [form, setForm] = useState<NoticeForm>(emptyForm)
  const [editorOpen, setEditorOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const liveCount = useMemo(
    () => notices.filter((notice) => getStatus(notice).label === '노출 중').length,
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

  const closeEditor = () => {
    if (!saving) setEditorOpen(false)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="파트너 공지"
        count={notices.length}
        description={`파트너 상품 목록 상단에 표시되는 공지입니다. 지금 노출 중인 공지 ${liveCount}개.`}
        backHref="/admin/partners"
        backLabel="파트너 관리로 돌아가기"
        actions={<button type="button" data-primary onClick={openCreate} className={buttonClass('primary', 'md')}><Plus size={15} />새 공지 등록</button>}
      />

      {error && !editorOpen ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>
      ) : null}

      {notices.length === 0 ? (
        <EmptyState
          icon={<Megaphone size={20} />}
          title="등록된 공지가 없습니다."
          description="새 공지를 등록하면 파트너 상품 목록 상단의 공지사항 영역에 표시됩니다."
          action={(
            <Button type="button" variant="secondary" size="sm" onClick={openCreate} icon={<Plus size={14} />}>
              새 공지 등록
            </Button>
          )}
        />
      ) : (
        <div className="grid gap-3">
          {notices.map((notice) => {
            const status = getStatus(notice)
            const tone = toneOptions.find((option) => option.value === notice.tone) || toneOptions[0]
            return (
              <article key={notice.id} className={`rounded-[10px] border border-l-4 border-slate-200 bg-white p-5 shadow-sm ${tone.bar}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <Badge tone={tone.badge}>{tone.label}</Badge>
                    </div>
                    <h2 className="mt-2 break-keep text-lg font-extrabold leading-snug text-slate-950">{notice.title}</h2>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {/* Same name as the editor's "공지 사용" switch; the text follows the state instead of staying "게시". */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notice.isActive}
                      aria-label="공지 사용"
                      onClick={() => toggleNotice(notice)}
                      className="inline-flex h-8 items-center gap-2 rounded-lg px-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40"
                      title={notice.isActive ? '끄면 기간과 관계없이 파트너에게 표시되지 않습니다.' : '켜면 노출 기간 동안 파트너에게 표시됩니다.'}
                    >
                      <SwitchTrack on={notice.isActive} />
                      <span className="w-6 text-left">{notice.isActive ? '사용' : '중지'}</span>
                    </button>
                    <button type="button" onClick={() => openEdit(notice)} className={buttonClass('secondary', 'sm')}><Edit3 size={13} />수정</button>
                    <button type="button" onClick={() => deleteNotice(notice)} className={buttonClass('danger', 'sm')}><Trash2 size={13} />삭제</button>
                  </div>
                </div>
                <details className="group mt-3">
                  <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 [&::-webkit-details-marker]:hidden">
                    공지 전문 보기
                    <ChevronDown size={15} className="text-slate-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-1 whitespace-pre-wrap break-keep text-sm font-medium leading-6 text-slate-600">{notice.content}</p>
                </details>
                <p className="mt-3 flex items-center gap-1.5 text-[12px] tabular-nums text-slate-500">
                  <CalendarClock size={13} className="shrink-0" />
                  기간 · {formatDate(notice.startsAt)} – {formatDate(notice.endsAt)}
                </p>
              </article>
            )
          })}
        </div>
      )}

      {editorOpen ? (
        <Modal labelledBy="notice-editor-title" onClose={closeEditor} className="flex items-center justify-center bg-slate-950/50 p-4">
          <section className="flex max-h-[calc(100dvh-32px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
              <h2 id="notice-editor-title" className="text-lg font-extrabold text-slate-950">{form.id ? '공지 수정' : '새 공지 등록'}</h2>
              <ModalCloseButton onClick={closeEditor} className="-mr-2" />
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
              <label className="block">
                <span className={fieldLabelClass}>공지 제목</span>
                <input value={form.title} maxLength={120} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="예: 추석 연휴 배송 일정 안내" className={fieldClass()} />
              </label>

              <label className="block">
                <span className={fieldLabelClass}>공지 내용</span>
                <textarea value={form.content} maxLength={5000} rows={8} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} placeholder="파트너에게 전달할 내용을 입력하세요." className={fieldClass('h-auto resize-y py-2.5 leading-6')} />
                <span className="mt-1 block text-right text-[11px] font-medium tabular-nums text-slate-500">{form.content.length.toLocaleString()} / 5,000</span>
              </label>

              <div>
                <span className={fieldLabelClass}>공지 중요도</span>
                <Tabs
                  aria-label="공지 중요도"
                  items={toneOptions.map((option) => ({ key: option.value, label: option.label }))}
                  value={form.tone}
                  onChange={(tone) => setForm((current) => ({ ...current, tone }))}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="notice-starts-at" className={fieldLabelClass}>노출 시작 <span className="font-normal text-slate-400">(날짜 · 시각)</span></label>
                  <DateTimeField id="notice-starts-at" value={form.startsAt} defaultTime="00:00" onChange={(startsAt) => setForm((current) => ({ ...current, startsAt }))} />
                  <span className="mt-1 block text-[11px] text-slate-500">비워두면 즉시 시작</span>
                </div>
                <div>
                  <label htmlFor="notice-ends-at" className={fieldLabelClass}>노출 종료 <span className="font-normal text-slate-400">(날짜 · 시각)</span></label>
                  <DateTimeField id="notice-ends-at" value={form.endsAt} defaultTime="23:59" onChange={(endsAt) => setForm((current) => ({ ...current, endsAt }))} />
                  <span className="mt-1 block text-[11px] text-slate-500">비워두면 계속 노출</span>
                </div>
              </div>

              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-[var(--border)] px-4 py-3">
                <span>
                  <span className="block text-sm font-bold text-slate-800">공지 사용</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">끄면 기간과 관계없이 파트너에게 표시되지 않습니다.</span>
                </span>
                <input type="checkbox" role="switch" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} className="peer sr-only" />
                <span className="rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-brand-orange/40 peer-focus-visible:ring-offset-2"><SwitchTrack on={form.isActive} /></span>
              </label>

              {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
              <Button type="button" variant="secondary" onClick={closeEditor}>취소</Button>
              <Button type="button" variant="primary" loading={saving} onClick={saveNotice}>{saving ? '저장 중...' : '저장하기'}</Button>
            </div>
          </section>
        </Modal>
      ) : null}
    </div>
  )
}
