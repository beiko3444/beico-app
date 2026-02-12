'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import html2canvas from 'html2canvas'

interface InvoiceButtonsProps {
    orderNumber: string
}

export default function InvoiceButtons({ orderNumber }: InvoiceButtonsProps) {
    const router = useRouter()
    const [isDownloading, setIsDownloading] = useState(false)

    const handlePrint = () => {
        window.print()
    }

    const handleDownloadJPG = async () => {
        const element = document.getElementById('invoice-content')
        if (!element) return

        setIsDownloading(true)
        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            })

            const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
            const link = document.createElement('a')
            link.download = `Invoice_${orderNumber}.jpg`
            link.href = dataUrl
            link.click()
        } catch (error) {
            console.error('Download failed:', error)
            alert('Download failed.')
        } finally {
            setIsDownloading(false)
        }
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
        <div className="mt-8 mb-20 text-center flex flex-col items-center gap-4 print:hidden">
            <div className="flex gap-4">
                <button
                    onClick={handlePrint}
                    className="bg-gray-800 text-white px-8 py-3 rounded-xl font-bold hover:bg-black transition-all shadow-lg active:scale-95"
                >
                    取引明細書を印刷する / 인쇄하기
                </button>
                <button
                    onClick={handleDownloadJPG}
                    disabled={isDownloading}
                    className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                    {isDownloading ? 'Saving...' : 'JPGで保存 / JPG 다운로드'}
                </button>
            </div>
            <button
                onClick={() => router.back()}
                className="text-gray-500 hover:text-black font-medium transition-colors"
            >
                닫기 (ESC)
            </button>
        </div>
    )
}
