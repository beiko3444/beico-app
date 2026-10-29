'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function ApproveUserButton({ userId, currentStatus }: { userId: string, currentStatus: string }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    const updateStatus = async (newStatus: string) => {
        if (!confirm(`${newStatus === 'APPROVED' ? '승인' : '거절/보류'} 하시겠습니까?`)) return
        setLoading(true)
        try {
            const res = await fetch(`/api/users/${userId}/approve`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            })

            if (res.ok) {
                router.refresh()
            } else {
                const data = await res.json()
                alert(`처리 실패: ${data.error || '알 수 없는 오류'}`)
            }
        } catch (e: any) {
            console.error(e)
            alert(`오류 발생: ${e.message}`)
        } finally {
            setLoading(false)
        }
    }

    if (currentStatus === 'APPROVED') {
        return null; // Don't show anything for approved partners to reduce clutter
    }

    return (
        <div className="flex items-center gap-1.5">
            {/* Approving is a positive row action, not the page's primary: an outlined green button
                keeps it apart from the red 삭제 next to it and from the one orange button on the page. */}
            {currentStatus === 'PENDING' && (
                <button
                    type="button"
                    onClick={() => updateStatus('APPROVED')}
                    disabled={loading}
                    className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-300 bg-white px-3 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {loading ? <Loader2 size={13} className="animate-spin" /> : null}
                    승인하기
                </button>
            )}
            {currentStatus === 'REJECTED' && (
                <span className="whitespace-nowrap text-[12px] font-bold text-red-700">거절됨</span>
            )}
        </div>
    )
}
