'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'

export default function DeleteMobileMessageButton({ id }: { id: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (deleting) return
    if (!window.confirm('이 문자를 수신문자함에서 삭제할까요?')) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/admin/mobile-messages/${id}`, {
        method: 'DELETE',
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof result?.error === 'string' ? result.error : '문자 삭제에 실패했습니다.')
      }
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : '문자 삭제에 실패했습니다.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60"
      title="문자 삭제"
      aria-label="문자 삭제"
    >
      {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
    </button>
  )
}
