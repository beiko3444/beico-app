'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function InvoiceButtons() {
    const router = useRouter()

    const handlePrint = () => {
        window.print()
    }

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                handlePrint()
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="mt-8 text-center print:hidden">
            <button
                onClick={handlePrint}
                className="bg-gray-800 text-white px-8 py-3 rounded-xl font-bold hover:bg-black transition-all shadow-lg active:scale-95"
            >
                거래명세서 인쇄하기
            </button>
            <button
                onClick={() => router.back()}
                className="ml-4 text-gray-500 hover:text-black font-medium transition-colors"
            >
                닫기 (ESC)
            </button>
        </div>
    )
}
