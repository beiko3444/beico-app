'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RestorePartnerButton({ partnerId, size = 'md' }: { partnerId: string, size?: 'sm' | 'md' }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    const handleRestore = async () => {
        if (!confirm('복구하시겠습니까? (상태가 대기중으로 변경됩니다)')) return

        setLoading(true)
        try {
            const res = await fetch(`/api/users/${partnerId}/approve`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'PENDING' })
            })

            if (res.ok) {
                router.refresh()
            } else {
                alert('복구에 실패했습니다.')
            }
        } catch (error) {
            console.error(error)
            alert('오류가 발생했습니다.')
        } finally {
            setLoading(false)
        }
    }

    if (size === 'sm') {
        return (
            <button
                onClick={handleRestore}
                disabled={loading}
                className="bg-green-50 text-green-600 px-2 py-1 rounded-md text-[10px] hover:bg-green-100 font-bold transition-colors border border-green-100"
            >
                {loading ? '...' : '되돌리기'}
            </button>
        )
    }

    return (
        <button
            onClick={handleRestore}
            disabled={loading}
            className="text-green-500 hover:text-green-700 font-medium ml-4 text-xs"
        >
            {loading ? '처리중...' : '되돌리기'}
        </button>
    )
}
