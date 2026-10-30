'use client'

import { type DragEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  ChevronRight,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Link as LinkIcon,
  Lock,
  Paperclip,
  Pin,
  Plus,
  Save,
  Search,
  StickyNote,
  Trash2,
  User,
  X,
} from 'lucide-react'
import Button, { buttonClass } from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import ModalCloseButton from '@/components/ui/ModalCloseButton'
import { fieldClass, labelClass } from '@/components/ui/field'
import { formatDateTime } from '@/lib/format'

export type AdminMemoAttachmentItem = {
  id: string
  memoId: string
  fileName: string
  contentType: string
  size: number
  assetUrl: string
  createdAt: string
  updatedAt: string
}

export type AdminMemoItem = {
  id: string
  title: string
  content: string
  category: string
  color: string
  pinned: boolean
  archived: boolean
  username: string | null
  password: string | null
  siteUrl: string | null
  attachments: AdminMemoAttachmentItem[]
  createdAt: string
  updatedAt: string
}

type MemoForm = {
  id?: string
  title: string
  content: string
  category: string
  color: string
  pinned: boolean
  archived: boolean
  username: string
  password: string
  siteUrl: string
}

const emptyForm = (): MemoForm => ({
  title: '',
  content: '',
  category: '일반',
  color: 'gray',
  pinned: false,
  archived: false,
  username: '',
  password: '',
  siteUrl: '',
})

const categories = ['전체', '일반', '주문', '재고', '수출', '카드', '거래처', '아이디어', '기타']
const formCategories = categories.slice(1)

// Fades a horizontally scrolling row at both ends so a cut-off chip reads as "more this way".
const scrollFade = '[mask-image:linear-gradient(to_right,transparent,#000_16px,#000_calc(100%-24px),transparent)]'

// A memo's colour is a left accent bar on a white card, so colour stays a label and never reads as a status fill.
const colorOptions = [
  { value: 'gray', label: '기본', accent: 'border-l-slate-300', dot: 'bg-slate-400', active: 'border-slate-500 bg-slate-100 text-slate-800' },
  { value: 'green', label: '녹색', accent: 'border-l-emerald-400', dot: 'bg-emerald-500', active: 'border-emerald-500 bg-emerald-100 text-emerald-800' },
  { value: 'yellow', label: '노랑', accent: 'border-l-amber-400', dot: 'bg-amber-500', active: 'border-amber-500 bg-amber-100 text-amber-900' },
  { value: 'blue', label: '파랑', accent: 'border-l-sky-400', dot: 'bg-sky-500', active: 'border-sky-500 bg-sky-100 text-sky-800' },
  { value: 'red', label: '빨강', accent: 'border-l-red-400', dot: 'bg-red-500', active: 'border-red-500 bg-red-100 text-red-800' },
]

const getColor = (value: string) => colorOptions.find((color) => color.value === value) || colorOptions[0]

type StatusFilter = 'active' | 'pinned' | 'archived'

// Roughly three lines of the card body; only longer memos get a 더보기 toggle.
const isLongContent = (value: string) => value.split('\n').length > 3 || value.length > 120

const includes = (value: string, query: string) => value.toLowerCase().includes(query)

const formatFileSize = (bytes: number) => {
  if (!bytes) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024).toLocaleString('ko-KR')} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const MAX_ATTACHMENT_SIZE = 15 * 1024 * 1024

const getFileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`

export default function MemosClient({ initialMemos }: { initialMemos: AdminMemoItem[] }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formFlash, setFormFlash] = useState(false)
  const [expandedMemoIds, setExpandedMemoIds] = useState<string[]>([])
  const [memos, setMemos] = useState(initialMemos)
  const [form, setForm] = useState<MemoForm>(emptyForm)
  const [keepAttachmentIds, setKeepAttachmentIds] = useState<string[]>([])
  const [newAttachments, setNewAttachments] = useState<File[]>([])
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('전체')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [saving, setSaving] = useState(false)
  const [showFormPassword, setShowFormPassword] = useState(false)
  const [customCategoryOpen, setCustomCategoryOpen] = useState(false)
  const [revealedPasswordIds, setRevealedPasswordIds] = useState<string[]>([])

  const togglePasswordReveal = (memoId: string) => {
    setRevealedPasswordIds((prev) => (prev.includes(memoId) ? prev.filter((id) => id !== memoId) : [...prev, memoId]))
  }

  const copyPassword = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      alert('클립보드에 복사하지 못했습니다.')
    }
  }

  const activeMemos = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return memos.filter((memo) => {
      if (statusFilter === 'archived' ? !memo.archived : memo.archived) return false
      if (statusFilter === 'pinned' && !memo.pinned) return false
      if (category !== '전체' && memo.category !== category) return false
      if (!normalized) return true
      return [
        memo.title,
        memo.content,
        memo.category,
        memo.username || '',
        memo.siteUrl || '',
        ...memo.attachments.map((attachment) => attachment.fileName),
      ].some((value) => includes(value || '', normalized))
    })
  }, [category, memos, query, statusFilter])

  const activeCount = memos.filter((memo) => !memo.archived).length
  const pinnedCount = memos.filter((memo) => !memo.archived && memo.pinned).length
  const archivedCount = memos.filter((memo) => memo.archived).length
  const editingMemo = form.id ? memos.find((memo) => memo.id === form.id) : null
  const visibleAttachments = editingMemo
    ? editingMemo.attachments.filter((attachment) => keepAttachmentIds.includes(attachment.id))
    : []

  const resetForm = () => {
    setForm(emptyForm())
    setCustomCategoryOpen(false)
    setKeepAttachmentIds([])
    setNewAttachments([])
    setIsDraggingFiles(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  useEffect(() => {
    if (!formFlash) return
    const timer = window.setTimeout(() => setFormFlash(false), 900)
    return () => window.clearTimeout(timer)
  }, [formFlash])

  // 새 메모 and 수정 both land on the form: open it on phones, bring it into view, focus the title and flash its border.
  const revealForm = () => {
    setFormOpen(true)
    setFormFlash(true)
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      titleRef.current?.focus({ preventScroll: true })
    })
  }

  const startNewMemo = () => {
    resetForm()
    revealForm()
  }

  const closeForm = () => {
    resetForm()
    setFormOpen(false)
  }

  const toggleMemoExpanded = (memoId: string) => {
    setExpandedMemoIds((prev) => (prev.includes(memoId) ? prev.filter((id) => id !== memoId) : [...prev, memoId]))
  }

  const emptyCopy = statusFilter === 'archived'
    ? { title: '보관한 메모가 없습니다.', description: '메모 카드의 [보관]을 누르면 이곳으로 옮겨집니다.' }
    : statusFilter === 'pinned'
      ? { title: '고정한 메모가 없습니다.', description: '메모 카드의 [고정]을 누르면 목록 맨 위에 모입니다.' }
      : memos.some((memo) => !memo.archived)
        ? { title: '조건에 맞는 메모가 없습니다.', description: '검색어나 카테고리를 바꿔 보세요.' }
        : { title: '아직 메모가 없습니다.', description: '[새 메모]를 눌러 첫 메모를 작성해 보세요.' }

  const addAttachments = (files: FileList | File[]) => {
    const incomingFiles = Array.from(files)
    const oversizedFiles = incomingFiles.filter((file) => file.size > MAX_ATTACHMENT_SIZE)

    if (oversizedFiles.length > 0) {
      alert(`${oversizedFiles.map((file) => file.name).join(', ')} 파일은 15MB 이하만 등록할 수 있습니다.`)
    }

    const validFiles = incomingFiles.filter((file) => file.size > 0 && file.size <= MAX_ATTACHMENT_SIZE)
    setNewAttachments((currentFiles) => {
      const existingKeys = new Set(currentFiles.map(getFileKey))
      return [...currentFiles, ...validFiles.filter((file) => !existingKeys.has(getFileKey(file)))]
    })

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleAttachmentDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDraggingFiles(false)
    addAttachments(event.dataTransfer.files)
  }

  const applySavedMemo = (memo: AdminMemoItem) => {
    setMemos((prev) => {
      const exists = prev.some((item) => item.id === memo.id)
      const next = exists ? prev.map((item) => (item.id === memo.id ? memo : item)) : [memo, ...prev]
      return next.sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    })
  }

  const saveMemo = async () => {
    const hasNewFiles = newAttachments.length > 0
    if (
      !form.title.trim() &&
      !form.content.trim() &&
      !form.username.trim() &&
      !form.password.trim() &&
      !form.siteUrl.trim() &&
      keepAttachmentIds.length === 0 &&
      !hasNewFiles
    ) {
      alert('제목, 내용, 계정 정보 또는 첨부 문서 중 하나는 입력해주세요.')
      return
    }

    setSaving(true)
    try {
      const formData = new FormData()
      if (form.id) formData.set('id', form.id)
      formData.set('title', form.title)
      formData.set('content', form.content)
      formData.set('category', form.category)
      formData.set('color', form.color)
      formData.set('pinned', String(form.pinned))
      formData.set('archived', String(form.archived))
      formData.set('username', form.username)
      formData.set('password', form.password)
      formData.set('siteUrl', form.siteUrl)
      formData.set('keepAttachmentIds', JSON.stringify(keepAttachmentIds))
      newAttachments.forEach((file) => {
        formData.append('attachments', file)
      })

      const response = await fetch('/api/admin/memos', {
        method: form.id ? 'PATCH' : 'POST',
        body: formData,
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || '메모를 저장하지 못했습니다.')
      applySavedMemo(data.memo)
      resetForm()
      setFormOpen(false)
    } catch (error) {
      alert(error instanceof Error ? error.message : '메모를 저장하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const editMemo = (memo: AdminMemoItem) => {
    setForm({
      id: memo.id,
      title: memo.title,
      content: memo.content,
      category: memo.category,
      color: memo.color,
      pinned: memo.pinned,
      archived: memo.archived,
      username: memo.username || '',
      password: memo.password || '',
      siteUrl: memo.siteUrl || '',
    })
    setKeepAttachmentIds(memo.attachments.map((attachment) => attachment.id))
    setCustomCategoryOpen(false)
    setNewAttachments([])
    setIsDraggingFiles(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    revealForm()
  }

  const patchMemo = async (memo: AdminMemoItem, payload: Record<string, unknown>) => {
    try {
      const response = await fetch('/api/admin/memos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: memo.id, ...payload }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || '메모를 수정하지 못했습니다.')
      applySavedMemo(data.memo)
    } catch (error) {
      alert(error instanceof Error ? error.message : '메모를 수정하지 못했습니다.')
    }
  }

  const deleteMemo = async (memo: AdminMemoItem) => {
    if (!confirm(`"${memo.title}" 메모를 삭제할까요?`)) return
    try {
      const response = await fetch(`/api/admin/memos?id=${encodeURIComponent(memo.id)}`, { method: 'DELETE' })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || '메모를 삭제하지 못했습니다.')
      setMemos((prev) => prev.filter((item) => item.id !== memo.id))
      if (form.id === memo.id) resetForm()
    } catch (error) {
      alert(error instanceof Error ? error.message : '메모를 삭제하지 못했습니다.')
    }
  }

  const inputClass = fieldClass()
  // A category typed earlier that isn't one of the presets still shows as a chip.
  const customCategory = formCategories.includes(form.category) ? '' : form.category

  return (
    <div className="min-w-0 text-slate-950">
      <div className="min-w-0 space-y-4">
        <PageHeader
          title="메모"
          description="업무 중 필요한 내용을 빠르게 기록하고 다시 찾습니다."
          actions={(
            <Button type="button" variant="secondary" onClick={startNewMemo} icon={<Plus size={16} />}>
              새 메모
            </Button>
          )}
        />

        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
          {/* Phones open the list first; the form appears when 새 메모 or 수정 is pressed. Desktop always shows it. */}
          <section
            ref={formRef}
            className={`min-w-0 scroll-mt-20 rounded-2xl border bg-white p-4 shadow-sm transition-shadow duration-500 ${formOpen ? '' : 'hidden lg:block'} ${
              formFlash ? 'border-brand-orange ring-2 ring-brand-orange/30' : 'border-slate-200'
            }`}
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-black">
                <StickyNote size={17} />
                {form.id ? '메모 수정' : '메모 작성'}
              </h2>
              {form.id ? (
                <ModalCloseButton onClick={closeForm} label="수정 취소" className="-my-2 -mr-2" />
              ) : (
                <ModalCloseButton onClick={closeForm} label="작성 닫기" className="-my-2 -mr-2 lg:hidden" />
              )}
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className={labelClass}>제목</span>
                <input
                  ref={titleRef}
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  className={inputClass}
                  placeholder="예: 수출 신고 확인사항"
                />
              </label>

              <label className="block">
                <span className={labelClass}>내용</span>
                <textarea
                  value={form.content}
                  onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                  className={fieldClass('h-auto min-h-[160px] resize-y py-2.5 leading-6')}
                  placeholder="메모 내용을 입력하세요."
                />
              </label>

              {/* The same chips as the list filter, single choice, with a free-text option at the end. */}
              <div>
                <span id="memo-category-label" className={labelClass}>카테고리</span>
                <div role="radiogroup" aria-labelledby="memo-category-label" className="flex flex-wrap gap-1.5">
                  {[...formCategories, ...(customCategory ? [customCategory] : [])].map((item) => {
                    const selected = form.category === item && !customCategoryOpen
                    return (
                      <button
                        key={item}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          setCustomCategoryOpen(false)
                          setForm((prev) => ({ ...prev, category: item }))
                        }}
                        className={`inline-flex h-7 items-center rounded-full border px-3 text-xs font-bold transition-colors ${
                          selected
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900'
                        }`}
                      >
                        {item}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    aria-expanded={customCategoryOpen}
                    onClick={() => setCustomCategoryOpen((open) => !open)}
                    className={`inline-flex h-7 items-center gap-1 rounded-full border border-dashed px-3 text-xs font-bold transition-colors ${
                      customCategoryOpen ? 'border-slate-900 text-slate-900' : 'border-slate-300 text-slate-600 hover:border-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Plus size={12} />
                    직접 입력
                  </button>
                </div>
                {customCategoryOpen ? (
                  <input
                    autoFocus
                    aria-label="카테고리 직접 입력"
                    value={customCategory}
                    onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value || '일반' }))}
                    className={fieldClass('mt-2')}
                    placeholder="새 카테고리 이름"
                  />
                ) : null}
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="text-[12px] font-bold text-slate-700">색상</span>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.pinned}
                      onChange={(event) => setForm((prev) => ({ ...prev, pinned: event.target.checked }))}
                      className="h-4 w-4 accent-brand-orange"
                    />
                    상단 고정
                  </label>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      aria-pressed={form.color === color.value}
                      onClick={() => setForm((prev) => ({ ...prev, color: color.value }))}
                      className={`h-10 whitespace-nowrap rounded-xl border text-xs font-black transition ${form.color === color.value ? color.active : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                    >
                      <span className={`mr-1 inline-block h-2.5 w-2.5 rounded-full ${color.dot}`} />
                      {color.label}
                    </button>
                  ))}
                </div>
              </div>

              <details className="group rounded-xl border border-slate-200 px-3">
                <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 py-2 text-sm font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
                  <ChevronRight size={15} className="shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                  사이트·계정 정보 (선택)
                </summary>
                <div className="space-y-3 pb-3 pt-1">
                  <label className="block">
                    <span className={labelClass}>사이트 링크</span>
                    <div className="relative">
                      <LinkIcon size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={form.siteUrl}
                        onChange={(event) => setForm((prev) => ({ ...prev, siteUrl: event.target.value }))}
                        className={`${inputClass} pl-9`}
                        placeholder="https://example.com"
                      />
                    </div>
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className={labelClass}>아이디</span>
                      <div className="relative">
                        <User size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          value={form.username}
                          onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                          className={`${inputClass} pl-9`}
                          placeholder="아이디"
                        />
                      </div>
                    </label>
                    <label className="block">
                      <span className={labelClass}>패스워드</span>
                      <div className="relative">
                        <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type={showFormPassword ? 'text' : 'password'}
                          autoComplete="off"
                          value={form.password}
                          onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                          className={`${inputClass} pl-9 pr-10`}
                          placeholder="패스워드"
                        />
                        <button
                          type="button"
                          onClick={() => setShowFormPassword((prev) => !prev)}
                          aria-label={showFormPassword ? '패스워드 숨기기' : '패스워드 표시'}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                        >
                          {showFormPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </label>
                  </div>
                </div>
              </details>

              {/* One drop zone: the whole box takes dropped files, its header row opens the picker. */}
              <div
                onDragEnter={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setIsDraggingFiles(true)
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  event.dataTransfer.dropEffect = 'copy'
                  setIsDraggingFiles(true)
                }}
                onDragLeave={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setIsDraggingFiles(false)
                  }
                }}
                onDrop={handleAttachmentDrop}
                className={`rounded-xl border border-dashed transition ${
                  isDraggingFiles
                    ? 'border-brand-orange bg-brand-orange-soft ring-2 ring-brand-orange/15'
                    : 'border-slate-300 bg-slate-50 hover:border-slate-400'
                }`}
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left"
                >
                  <Paperclip size={16} className={`shrink-0 ${isDraggingFiles ? 'text-brand-orange' : 'text-slate-400'}`} />
                  <span className="min-w-0">
                    <span className="block text-xs font-black text-slate-700">첨부 문서</span>
                    <span className="mt-0.5 block break-keep text-[11px] font-bold text-slate-500">
                      {isDraggingFiles ? '여기에 놓으면 첨부됩니다.' : '파일을 끌어놓거나 눌러서 선택하세요. 사업자등록증, PDF, JPG 등'}
                    </span>
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.hwp,.hwpx,.txt,.csv"
                  onChange={(event) => addAttachments(event.target.files || [])}
                />
                {newAttachments.length > 0 && (
                  <div className="space-y-1.5 px-3 pb-3">
                    {newAttachments.map((file) => (
                      <div key={getFileKey(file)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs">
                        <Paperclip size={14} className="shrink-0 text-slate-500" />
                        <span className="min-w-0 flex-1 truncate font-black text-slate-700">{file.name}</span>
                        <span className="shrink-0 font-bold tabular-nums text-slate-500">{formatFileSize(file.size)}</span>
                        <span className="shrink-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-black text-blue-700">신규</span>
                        <button
                          type="button"
                          onClick={() => setNewAttachments((files) => files.filter((item) => getFileKey(item) !== getFileKey(file)))}
                          className={buttonClass('dangerGhost', 'icon', 'h-7 w-7 text-slate-400')}
                          aria-label={`${file.name} 첨부 취소`}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {visibleAttachments.length > 0 ? (
                  <div className="space-y-1.5 px-3 pb-3">
                    {visibleAttachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs">
                        <FileText size={14} className="shrink-0 text-slate-500" />
                        <span className="min-w-0 flex-1 truncate font-black text-slate-700">{attachment.fileName}</span>
                        <span className="shrink-0 font-bold tabular-nums text-slate-500">{formatFileSize(attachment.size)}</span>
                        <a
                          href={`/api/admin/memos/${editingMemo?.id}/attachments/${attachment.id}`}
                          className="shrink-0 whitespace-nowrap rounded-lg px-1.5 py-1 font-black text-slate-700 hover:bg-slate-100"
                        >
                          다운로드
                        </a>
                        <button
                          type="button"
                          onClick={() => setKeepAttachmentIds((prev) => prev.filter((id) => id !== attachment.id))}
                          className={buttonClass('dangerGhost', 'icon', 'h-7 w-7 text-slate-400')}
                          aria-label={`${attachment.fileName} 삭제`}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : editingMemo ? (
                  <p className="px-3 pb-3 text-[11px] font-bold text-slate-500">선택한 기존 첨부가 없습니다.</p>
                ) : null}
              </div>

              <Button
                type="button"
                variant="primary"
                loading={saving}
                onClick={saveMemo}
                icon={<Save size={16} />}
                className="h-12 w-full"
              >
                {saving ? '저장 중' : form.id ? '수정 저장' : '메모 저장'}
              </Button>
            </div>
          </section>

          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative min-w-0 flex-1">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="메모 검색"
                  className={`${inputClass} pl-9`}
                  placeholder="제목, 내용, 카테고리 검색"
                />
              </div>
              <Tabs
                aria-label="메모 상태"
                className="shrink-0"
                items={[
                  { key: 'active', label: '활성', count: activeCount },
                  { key: 'pinned', label: '고정', count: pinnedCount },
                  { key: 'archived', label: '보관함', count: archivedCount },
                ]}
                value={statusFilter}
                onChange={setStatusFilter}
              />
            </div>

            {/* Category is a second-level filter, so it reads as chips rather than another tab bar. */}
            <div role="group" aria-label="카테고리" className={`-mx-4 mt-3 flex flex-nowrap gap-1.5 overflow-x-auto px-4 pb-1 ${scrollFade}`}>
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={category === item}
                  onClick={() => setCategory(item)}
                  className={`inline-flex h-7 shrink-0 items-center rounded-full border px-3 text-xs font-bold transition-colors ${
                    category === item
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {activeMemos.length ? (
                activeMemos.map((memo) => {
                  const color = getColor(memo.color)
                  const passwordRevealed = revealedPasswordIds.includes(memo.id)
                  const expanded = expandedMemoIds.includes(memo.id)
                  const longContent = isLongContent(memo.content)
                  return (
                    <article key={memo.id} className={`flex min-w-0 flex-col rounded-2xl border border-l-4 border-slate-200 bg-white p-4 shadow-sm ${color.accent}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <Badge outline className="max-w-full"><span className="truncate">{memo.category}</span></Badge>
                          {memo.pinned ? <Pin size={13} className="shrink-0 text-amber-600" aria-label="고정됨" /> : null}
                        </div>
                        <span className="shrink-0 text-[11px] font-medium tabular-nums text-slate-500">수정 {formatDateTime(memo.updatedAt)}</span>
                      </div>
                      <h3 className="mt-2 line-clamp-2 text-base font-black leading-6 text-slate-950 break-keep">{memo.title}</h3>

                      {memo.content ? (
                        <div className="mt-2">
                          <p className={`whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 ${expanded ? '' : 'line-clamp-3'}`}>{memo.content}</p>
                          {longContent ? (
                            <button
                              type="button"
                              onClick={() => toggleMemoExpanded(memo.id)}
                              aria-expanded={expanded}
                              className="mt-1 text-xs font-bold text-slate-500 hover:text-slate-900 hover:underline"
                            >
                              {expanded ? '접기' : '더보기'}
                            </button>
                          ) : null}
                        </div>
                      ) : null}

                      {(memo.siteUrl || memo.username || memo.password) ? (
                        <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-700">
                          {memo.siteUrl ? (
                            <a
                              href={memo.siteUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex min-w-0 items-center gap-2 font-black text-blue-700 hover:underline"
                            >
                              <ExternalLink size={14} className="shrink-0" />
                              <span className="truncate">{memo.siteUrl}</span>
                            </a>
                          ) : null}
                          {memo.username ? (
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-black text-slate-500">아이디</span>
                              <span className="min-w-0 truncate font-black text-slate-950">{memo.username}</span>
                            </div>
                          ) : null}
                          {memo.password ? (
                            <div className="flex items-center justify-between gap-3">
                              <span className="shrink-0 font-black text-slate-500">패스워드</span>
                              <span className="flex min-w-0 items-center gap-1">
                                <span className="min-w-0 truncate font-mono font-black text-slate-950">
                                  {passwordRevealed ? memo.password : '••••••••'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => togglePasswordReveal(memo.id)}
                                  className="shrink-0 whitespace-nowrap rounded-lg px-1.5 py-1 text-[11px] font-black text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                                  aria-label={passwordRevealed ? '패스워드 숨기기' : '패스워드 표시'}
                                >
                                  {passwordRevealed ? '숨김' : '표시'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => copyPassword(memo.password || '')}
                                  className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-1.5 py-1 text-[11px] font-black text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                                  aria-label="패스워드 복사"
                                >
                                  <Copy size={12} />
                                  복사
                                </button>
                              </span>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {memo.attachments.length > 0 ? (
                        <details className="group mt-3">
                          <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-xs font-bold text-slate-600 [&::-webkit-details-marker]:hidden">
                            <ChevronRight size={14} className="shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                            첨부 문서 {memo.attachments.length}개
                          </summary>
                          <div className="space-y-1.5">
                            {memo.attachments.map((attachment) => (
                              <a
                                key={attachment.id}
                                href={`/api/admin/memos/${memo.id}/attachments/${attachment.id}`}
                                className="flex items-center gap-2 rounded-xl bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                              >
                                <FileText size={14} className="shrink-0 text-slate-500" />
                                <span className="min-w-0 flex-1 truncate">{attachment.fileName}</span>
                                <span className="shrink-0 tabular-nums text-slate-500">{formatFileSize(attachment.size)}</span>
                                <Download size={14} className="shrink-0 text-slate-500" />
                              </a>
                            ))}
                          </div>
                        </details>
                      ) : null}

                      {/* Every action on this memo lives in one footer row. */}
                      <div aria-hidden="true" className="min-h-4 flex-1" />
                      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                        <div className="flex gap-1">
                          <button type="button" onClick={() => editMemo(memo)} className={buttonClass('ghost', 'sm', 'px-2')}>
                            <Edit3 size={14} />
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => patchMemo(memo, { togglePinned: true, pinned: !memo.pinned })}
                            aria-pressed={memo.pinned}
                            className={buttonClass('ghost', 'sm', 'px-2')}
                          >
                            <Pin size={14} className={memo.pinned ? 'text-amber-600' : 'text-slate-400'} />
                            {memo.pinned ? '고정 해제' : '고정'}
                          </button>
                        </div>
                        <div className="flex gap-1">
                          {/* On phones these shrink to icons so the gap between the two groups shows. */}
                          <button
                            type="button"
                            onClick={() => patchMemo(memo, { toggleArchived: true, archived: !memo.archived })}
                            aria-label={memo.archived ? '복원' : '보관'}
                            title={memo.archived ? '복원' : '보관'}
                            className={buttonClass('ghost', 'sm', 'px-2 max-sm:w-9 max-sm:px-0')}
                          >
                            {memo.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                            <span className="max-sm:sr-only">{memo.archived ? '복원' : '보관'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMemo(memo)}
                            aria-label="삭제"
                            title="삭제"
                            className={buttonClass('dangerGhost', 'sm', 'px-2 max-sm:w-9 max-sm:px-0')}
                          >
                            <Trash2 size={14} />
                            <span className="max-sm:sr-only">삭제</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })
              ) : (
                <EmptyState
                  compact
                  bare
                  className="col-span-full"
                  icon={statusFilter === 'archived' ? <Archive size={20} /> : <StickyNote size={20} />}
                  {...emptyCopy}
                />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
