'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Download, Printer, X } from 'lucide-react'
import { buttonClass } from '@/components/ui/buttonClass'
import { themedGhost, themedSecondary } from '@/app/order/partner-ui'

interface InvoiceButtonsProps {
    orderNumber: string
    isKorean?: boolean
}

export default function InvoiceButtons({ orderNumber, isKorean = true }: InvoiceButtonsProps) {
    const router = useRouter()
    const [isDownloading, setIsDownloading] = useState(false)
    const t = isKorean
        ? { title: '거래명세표', close: '닫기', png: 'PNG 저장', saving: '저장 중…', print: '인쇄', missing: '문서 내용을 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요.', failed: '이미지를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
        : { title: '取引明細書', close: '閉じる', png: 'PNG保存', saving: '保存中…', print: '印刷', missing: '書類が見つかりません。再読み込みしてからお試しください。', failed: '画像を保存できませんでした。しばらくしてから再度お試しください。' }

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

    const handleDownloadPNG = async () => {
        const element = document.getElementById('invoice-content')
        if (!element) {
            alert(t.missing)
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
            alert(t.failed)
        } finally {
            setIsDownloading(false)
        }
    }

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Enter on a focused button or link is that control's own action, not "print".
            const onControl = e.target instanceof Element && e.target.closest('button, a, input, select, textarea')
            if (e.key === 'Enter' && !onControl) {
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
        <div className="sticky top-0 z-40 mb-4 border-b border-[var(--border)] bg-[var(--card)] print:hidden">
            <div className="mx-auto flex max-w-[calc(210mm+48px)] items-center gap-2 px-3 py-2 sm:px-6 sm:py-3">
                <button type="button" onClick={handleClose} className={buttonClass('ghost', 'iconMd', themedGhost)} aria-label={t.close} title={t.close}>
                    <X size={20} aria-hidden />
                </button>
                {/* Phones show just the order number, the part that tells documents apart; the PNG button drops to its icon to make room. */}
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--foreground)] tabular-nums">
                    <span className="hidden font-bold sm:inline">{t.title} </span><span className="sr-only sm:hidden">{t.title} </span>{orderNumber}
                </p>
                <button type="button" onClick={handleDownloadPNG} disabled={isDownloading} aria-label={isDownloading ? t.saving : t.png} title={t.png} className={buttonClass('secondary', 'md', `w-10 px-0 sm:w-auto sm:px-4 ${themedSecondary}`)}>
                    <Download size={16} aria-hidden />
                    <span className="hidden sm:inline">{isDownloading ? t.saving : t.png}</span>
                </button>
                <button type="button" onClick={handlePrint} className={buttonClass('primary', 'md')}>
                    <Printer size={16} aria-hidden />
                    {t.print}
                </button>
            </div>
        </div>
    )
}
