'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
        <div className="flex items-center gap-1">
            {currentStatus === 'PENDING' && (
                <button
                    onClick={() => updateStatus('APPROVED')}
                    disabled={loading}
                    className="bg-green-600 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-green-700 shadow-sm transition-colors"
                >
                    승인하기
                </button>
            )}
            {currentStatus === 'REJECTED' && (
                <span className="text-[10px] text-red-500 font-bold">거절됨</span>
            )}
        </div>
    )
}
