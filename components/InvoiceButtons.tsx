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

    const handleClose = () => {
        if (window.history.length > 1) {
            router.back()
        } else {
            window.close()
        }
    }

    const handlePrint = () => {
        window.print()
    }

    const handleDownloadJPG = async () => {
        const element = document.getElementById('invoice-content')
        if (!element) {
            alert('Cannot find invoice content.')
            return
        }

        setIsDownloading(true)
        try {
            // Dynamic import to ensure client-side execution
            const { toPng } = await import('html-to-image')

            // Use toPng first as it handles transparency and blend modes better
            const dataUrl = await toPng(element, {
                quality: 1.0,
                backgroundColor: '#ffffff',
                width: element.offsetWidth,
                height: element.offsetHeight,
                style: {
                    margin: '0',
                    transform: 'none',
                    boxShadow: 'none'
                }
            })

            const link = document.createElement('a')
            link.download = `Invoice_${orderNumber}.png` // Changed to PNG for better quality
            link.href = dataUrl
            link.click()
        } catch (error) {
            console.error('Download failed:', error)
            alert('Failed to download JPG. Please check console for details.')
        } finally {
            setIsDownloading(false)
        }
    }

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                handlePrint()
            }
            if (e.key === 'Escape') {
                handleClose()
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [router]);

    return (
        <div className="mt-8 mb-20 text-center flex flex-col items-center gap-4 print:hidden">
            <div className="flex gap-4">
                <button
                    onClick={handlePrint}
                    className="bg-gray-800 text-white px-8 h-16 rounded-xl font-bold hover:bg-black transition-all shadow-lg active:scale-95 flex flex-col items-center justify-center leading-tight"
                >
                    <span className="text-[14px]">取引明細書を印刷する</span>
                    <span className="text-[11px] font-medium opacity-80">인쇄하기</span>
                </button>
                <button
                    onClick={handleDownloadJPG}
                    disabled={isDownloading}
                    className="bg-blue-600 text-white px-8 h-16 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg active:scale-95 disabled:opacity-50 flex flex-col items-center justify-center leading-tight"
                >
                    {isDownloading ? (
                        'Saving...'
                    ) : (
                        <>
                            <span className="text-[14px]">JPGで保存</span>
                            <span className="text-[11px] font-medium opacity-80">JPG 다운로드</span>
                        </>
                    )}
                </button>
                <button
                    onClick={handleClose}
                    className="bg-white text-gray-700 border-2 border-gray-200 px-8 h-16 rounded-xl font-bold hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95 flex flex-col items-center justify-center leading-tight"
                >
                    <span className="text-[14px]">閉じる</span>
                    <span className="text-[11px] font-medium opacity-80">닫기</span>
                </button>
            </div>
        </div>
    )
}
