'use client'

import { useRouter } from 'next/navigation'

export default function InvoiceWrapper({ children }: { children: React.ReactNode }) {
    const router = useRouter()

    return (
        <div
            className="min-h-screen bg-gray-100 py-10 print:bg-white print:py-0 font-sans cursor-pointer"
            onClick={() => router.back()}
        >
            <div onClick={(e) => e.stopPropagation()} className="cursor-default">
                {children}
            </div>
        </div>
    )
}
