'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { buttonClass } from '@/components/ui/buttonClass'

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

    // Only pending accounts get an action; the row's status badge already says 승인 대기 / 거절됨.
    if (currentStatus !== 'PENDING') return null

    return (
        <button
            type="button"
            onClick={() => updateStatus('APPROVED')}
            disabled={loading}
            className={buttonClass('secondary', 'sm')}
        >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} aria-hidden="true" />}
            승인
        </button>
    )
}
