'use client'

import { type DragEvent, useMemo, useRef, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  Lock,
  Paperclip,
  Pin,
  PinOff,
  Plus,
  Save,
  Search,
  StickyNote,
  Trash2,
  User,
  X,
} from 'lucide-react'

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
  color: 'green',
  pinned: false,
  archived: false,
  username: '',
  password: '',
  siteUrl: '',
})

const categories = ['전체', '일반', '주문', '재고', '수출', '카드', '거래처', '아이디어', '기타']

const colorOptions = [
  { value: 'green', label: '녹색', card: 'border-emerald-200 bg-emerald-50', dot: 'bg-emerald-500', active: 'border-emerald-500 bg-emerald-100 text-emerald-800' },
  { value: 'yellow', label: '노랑', card: 'border-amber-200 bg-amber-50', dot: 'bg-amber-500', active: 'border-amber-500 bg-amber-100 text-amber-900' },
  { value: 'blue', label: '파랑', card: 'border-sky-200 bg-sky-50', dot: 'bg-sky-500', active: 'border-sky-500 bg-sky-100 text-sky-800' },
  { value: 'red', label: '빨강', card: 'border-red-200 bg-red-50', dot: 'bg-red-500', active: 'border-red-500 bg-red-100 text-red-800' },
  { value: 'gray', label: '회색', card: 'border-slate-200 bg-white', dot: 'bg-slate-400', active: 'border-slate-500 bg-slate-100 text-slate-800' },
]

const getColor = (value: string) => colorOptions.find((color) => color.value === value) || colorOptions[0]

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

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
  const [memos, setMemos] = useState(initialMemos)
  const [form, setForm] = useState<MemoForm>(emptyForm)
  const [keepAttachmentIds, setKeepAttachmentIds] = useState<string[]>([])
  const [newAttachments, setNewAttachments] = useState<File[]>([])
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('전체')
  const [showArchived, setShowArchived] = useState(false)
  const [saving, setSaving] = useState(false)

  const activeMemos = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return memos.filter((memo) => {
      if (memo.archived !== showArchived) return false
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
  }, [category, memos, query, showArchived])

  const activeCount = memos.filter((memo) => !memo.archived).length
  const pinnedCount = memos.filter((memo) => !memo.archived && memo.pinned).length
  const archivedCount = memos.filter((memo) => memo.archived).length
  const editingMemo = form.id ? memos.find((memo) => memo.id === form.id) : null
  const visibleAttachments = editingMemo
    ? editingMemo.attachments.filter((attachment) => keepAttachmentIds.includes(attachment.id))
    : []

  const resetForm = () => {
    setForm(emptyForm())
    setKeepAttachmentIds([])
    setNewAttachments([])
    setIsDraggingFiles(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

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
    setNewAttachments([])
    setIsDraggingFiles(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
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

  return (
    <div className="min-h-screen bg-[#F6F8FB] px-4 py-5 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1680px] space-y-4">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#EF3B1D]">Admin Notes</div>
            <h1 className="mt-1 text-[26px] font-black tracking-tight">메모</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">업무 중 필요한 내용을 빠르게 기록하고 다시 찾습니다.</p>
          </div>
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
          >
            <Plus size={16} />
            새 메모
          </button>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-xs font-black text-slate-500">활성 메모</div>
            <div className="mt-1 text-2xl font-black">{activeCount.toLocaleString('ko-KR')}</div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
            <div className="text-xs font-black text-emerald-700">고정 메모</div>
            <div className="mt-1 text-2xl font-black text-emerald-900">{pinnedCount.toLocaleString('ko-KR')}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-xs font-black text-slate-500">보관 메모</div>
            <div className="mt-1 text-2xl font-black">{archivedCount.toLocaleString('ko-KR')}</div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-black">
                <StickyNote size={17} />
                {form.id ? '메모 수정' : '메모 작성'}
              </h2>
              {form.id ? (
                <button type="button" onClick={resetForm} className="inline-flex items-center gap-1 text-xs font-black text-slate-500 hover:text-slate-950">
                  <X size={14} />
                  취소
                </button>
              ) : null}
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-black text-slate-600">제목</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-bold outline-none transition focus:border-slate-950"
                  placeholder="예: 수출 신고 확인사항"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-black text-slate-600">카테고리</span>
                  <input
                    value={form.category}
                    onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value || '일반' }))}
                    className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-bold outline-none transition focus:border-slate-950"
                    placeholder="일반"
                  />
                </label>
                <label className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, pinned: !prev.pinned }))}
                    className={`flex h-11 w-full items-center justify-center gap-2 rounded-md border text-sm font-black transition ${form.pinned ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-300 bg-white text-slate-600'}`}
                  >
                    {form.pinned ? <Pin size={16} /> : <PinOff size={16} />}
                    상단고정
                  </button>
                </label>
              </div>

              <div>
                <span className="mb-1 block text-xs font-black text-slate-600">색상</span>
                <div className="grid grid-cols-5 gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, color: color.value }))}
                      className={`h-10 rounded-md border text-xs font-black transition ${form.color === color.value ? color.active : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                    >
                      <span className={`mr-1 inline-block h-2.5 w-2.5 rounded-full ${color.dot}`} />
                      {color.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-black text-slate-600">사이트 링크</span>
                <div className="relative">
                  <LinkIcon size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={form.siteUrl}
                    onChange={(event) => setForm((prev) => ({ ...prev, siteUrl: event.target.value }))}
                    className="h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm font-bold outline-none transition focus:border-slate-950"
                    placeholder="https://example.com"
                  />
                </div>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-black text-slate-600">아이디</span>
                  <div className="relative">
                    <User size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={form.username}
                      onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                      className="h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm font-bold outline-none transition focus:border-slate-950"
                      placeholder="아이디"
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-black text-slate-600">패스워드</span>
                  <div className="relative">
                    <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={form.password}
                      onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                      className="h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm font-bold outline-none transition focus:border-slate-950"
                      placeholder="패스워드"
                    />
                  </div>
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-black text-slate-600">내용</span>
                <textarea
                  value={form.content}
                  onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                  className="min-h-[240px] w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-3 text-sm font-bold leading-6 outline-none transition focus:border-slate-950"
                  placeholder="메모 내용을 입력하세요."
                />
              </label>

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
                className={`rounded-md border border-dashed p-3 transition ${
                  isDraggingFiles
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                    : 'border-slate-300 bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black text-slate-700">첨부 문서</div>
                    <div className="mt-1 text-[11px] font-bold text-slate-500">사업자등록증, PDF, JPG 등 회사 업무서류</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-100"
                  >
                    <Paperclip size={14} />
                    파일 추가
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.hwp,.hwpx,.txt,.csv"
                  onChange={(event) => addAttachments(event.target.files || [])}
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`mt-3 cursor-pointer rounded-md border border-dashed px-3 py-4 text-center text-xs font-black transition ${
                    isDraggingFiles
                      ? 'border-blue-400 bg-white text-blue-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-700'
                  }`}
                >
                  {isDraggingFiles ? '여기에 놓으면 첨부됩니다.' : '파일을 이곳에 끌어놓거나 클릭해서 선택하세요.'}
                </div>
                {newAttachments.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {newAttachments.map((file) => (
                      <div key={getFileKey(file)} className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-2 text-xs">
                        <Paperclip size={14} className="shrink-0 text-blue-600" />
                        <span className="min-w-0 flex-1 truncate font-black text-slate-700">{file.name}</span>
                        <span className="shrink-0 font-bold text-slate-500">{formatFileSize(file.size)}</span>
                        <span className="shrink-0 font-black text-blue-700">신규</span>
                        <button
                          type="button"
                          onClick={() => setNewAttachments((files) => files.filter((item) => getFileKey(item) !== getFileKey(file)))}
                          className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          aria-label={`${file.name} 첨부 취소`}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {visibleAttachments.length > 0 ? (
                  <div className="mt-3 space-y-1.5">
                    {visibleAttachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs">
                        <FileText size={14} className="shrink-0 text-slate-500" />
                        <span className="min-w-0 flex-1 truncate font-black text-slate-700">{attachment.fileName}</span>
                        <span className="shrink-0 font-bold text-slate-400">{formatFileSize(attachment.size)}</span>
                        <a
                          href={`/api/admin/memos/${editingMemo?.id}/attachments/${attachment.id}`}
                          className="shrink-0 rounded px-1.5 py-1 font-black text-blue-600 hover:bg-blue-50"
                        >
                          다운로드
                        </a>
                        <button
                          type="button"
                          onClick={() => setKeepAttachmentIds((prev) => prev.filter((id) => id !== attachment.id))}
                          className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          aria-label={`${attachment.fileName} 삭제`}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : editingMemo ? (
                  <div className="mt-3 rounded-md border border-dashed border-slate-200 bg-white px-3 py-3 text-center text-xs font-bold text-slate-400">
                    선택한 기존 첨부가 없습니다.
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={saveMemo}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-slate-950 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? '저장 중' : form.id ? '수정 저장' : '메모 저장'}
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative min-w-0 flex-1">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm font-bold outline-none transition focus:border-slate-950"
                  placeholder="제목, 내용, 카테고리 검색"
                />
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowArchived(false)}
                  className={`h-10 rounded-md px-4 text-xs font-black ${!showArchived ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
                >
                  활성
                </button>
                <button
                  type="button"
                  onClick={() => setShowArchived(true)}
                  className={`h-10 rounded-md px-4 text-xs font-black ${showArchived ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
                >
                  보관함
                </button>
              </div>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`h-9 shrink-0 rounded-full px-4 text-xs font-black transition ${category === item ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {activeMemos.length ? (
                activeMemos.map((memo) => {
                  const color = getColor(memo.color)
                  return (
                    <article key={memo.id} className={`rounded-lg border p-4 shadow-sm ${color.card}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${color.dot}`} />
                            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-black text-slate-600">{memo.category}</span>
                            {memo.pinned ? <Pin size={13} className="text-amber-600" /> : null}
                          </div>
                          <h3 className="mt-2 line-clamp-2 text-base font-black leading-6 text-slate-950">{memo.title}</h3>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button type="button" onClick={() => editMemo(memo)} className="rounded-md bg-white/80 p-2 text-slate-500 transition hover:text-slate-950" title="수정">
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => patchMemo(memo, { togglePinned: true, pinned: !memo.pinned })}
                            className="rounded-md bg-white/80 p-2 text-slate-500 transition hover:text-slate-950"
                            title={memo.pinned ? '고정 해제' : '고정'}
                          >
                            {memo.pinned ? <PinOff size={15} /> : <Pin size={15} />}
                          </button>
                        </div>
                      </div>

                      <p className="mt-3 whitespace-pre-wrap break-words text-sm font-bold leading-6 text-slate-700">{memo.content || '-'}</p>

                      {(memo.siteUrl || memo.username || memo.password) ? (
                        <div className="mt-3 grid gap-2 rounded-md bg-white/75 p-3 text-xs font-bold text-slate-700">
                          {memo.siteUrl ? (
                            <a
                              href={memo.siteUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex min-w-0 items-center gap-2 font-black text-blue-600 hover:underline"
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
                              <span className="font-black text-slate-500">패스워드</span>
                              <span className="min-w-0 truncate font-mono font-black text-slate-950">{memo.password}</span>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {memo.attachments.length > 0 ? (
                        <div className="mt-3 space-y-1.5">
                          {memo.attachments.map((attachment) => (
                            <a
                              key={attachment.id}
                              href={`/api/admin/memos/${memo.id}/attachments/${attachment.id}`}
                              className="flex items-center gap-2 rounded-md bg-white/80 px-2.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-white"
                            >
                              <FileText size={14} className="shrink-0 text-slate-500" />
                              <span className="min-w-0 flex-1 truncate">{attachment.fileName}</span>
                              <span className="shrink-0 text-slate-400">{formatFileSize(attachment.size)}</span>
                              <Download size={14} className="shrink-0 text-blue-600" />
                            </a>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-black/5 pt-3 text-[11px] font-black text-slate-500">
                        <span>수정 {formatDate(memo.updatedAt)}</span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => patchMemo(memo, { toggleArchived: true, archived: !memo.archived })}
                            className="inline-flex items-center gap-1 rounded-md bg-white/80 px-2 py-1.5 text-slate-600 transition hover:text-slate-950"
                          >
                            {memo.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                            {memo.archived ? '복원' : '보관'}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMemo(memo)}
                            className="inline-flex items-center gap-1 rounded-md bg-white/80 px-2 py-1.5 text-red-600 transition hover:bg-red-50"
                          >
                            <Trash2 size={14} />
                            삭제
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })
              ) : (
                <div className="col-span-full rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
                    <StickyNote size={22} />
                  </div>
                  <p className="mt-3 text-sm font-black text-slate-700">표시할 메모가 없습니다.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
