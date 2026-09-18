'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'

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
            {currentStatus === 'PENDING' && (
                <Button variant="primary" size="sm" onClick={() => updateStatus('APPROVED')} loading={loading}>
                    승인하기
                </Button>
            )}
            {currentStatus === 'REJECTED' && (
                <span className="whitespace-nowrap text-[11px] font-bold text-red-500">거절됨</span>
            )}
        </div>
    )
}
