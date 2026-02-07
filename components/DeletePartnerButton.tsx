'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeletePartnerButton({ partnerId, size = 'md' }: { partnerId: string, size?: 'sm' | 'md' }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    const handleDelete = async () => {
        if (!confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return

        setLoading(true)
        try {
            const res = await fetch(`/api/partners/${partnerId}`, {
                method: 'DELETE'
            })

            if (res.ok) {
                router.refresh()
            } else {
                alert('삭제 실패했습니다.')
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
                onClick={handleDelete}
                disabled={loading}
                className="bg-red-50 text-red-600 px-2 py-1 rounded-md text-[10px] hover:bg-red-100 font-bold transition-colors border border-red-100"
            >
                {loading ? '...' : '삭제'}
            </button>
        )
    }

    return (
        <button
            onClick={handleDelete}
            disabled={loading}
            className="text-red-500 hover:text-red-700 font-medium ml-4 text-xs"
        >
            {loading ? '삭제중...' : '삭제'}
        </button>
    )
}
