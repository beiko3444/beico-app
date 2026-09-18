'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'

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

    return (
        <Button variant="danger" size={size} onClick={handleDelete} loading={loading}>
            {loading ? '삭제 중...' : '삭제'}
        </Button>
    )
}
