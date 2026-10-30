'use client'

import { useId, useState, type ReactNode, type Ref } from 'react'
import { Maximize2 } from 'lucide-react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import ModalCloseButton from '@/components/ui/ModalCloseButton'
import FitToWidth from '@/components/ui/FitToWidth'

/**
 * On-screen preview of a printed A4 sheet, shared by PI 발급, 인도 위임장 and 수출신고.
 * A panel whose header holds the title, the page's own actions (출력 …) and "크게 보기"; the sheet is scaled
 * to the column (on phones only a 160px thumbnail, since a 0.45× sheet can't be read) and the dialog shows it at 1×.
 * Print output is built from separate markup and is not affected.
 */
export default function DocumentPreview({
    title,
    meta,
    actions,
    footnote,
    width = 794,
    sheetRef,
    children,
    className = '',
}: {
    title: string
    /** Short line under the title, e.g. the document number being shown. */
    meta?: ReactNode
    actions?: ReactNode
    footnote?: ReactNode
    /** Width of the printed sheet in px (A4 = 794). */
    width?: number
    /** Wraps the in-page sheet only (not the dialog copy), for pages that print from its markup. */
    sheetRef?: Ref<HTMLDivElement>
    children: ReactNode
    className?: string
}) {
    const [open, setOpen] = useState(false)
    const titleId = useId()

    return (
        <section aria-label={title} className={`min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-[#2a2a2a] dark:bg-[#1e1e1e] dark:shadow-none ${className}`}>
            <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2 dark:border-[#2a2a2a]">
                <div className="min-w-0">
                    <h2 className="text-[13px] font-extrabold text-slate-900 dark:text-white">{title}</h2>
                    {meta ? <p className="truncate text-[11px] text-slate-500 dark:text-gray-400">{meta}</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    <Button variant="ghost" size="sm" icon={<Maximize2 size={14} />} onClick={() => setOpen(true)}>
                        크게 보기
                    </Button>
                    {actions}
                </div>
            </div>

            <div className="bg-slate-100 p-3 dark:bg-[#151515] sm:p-4">
                <div className="relative max-md:max-h-[160px] max-md:overflow-hidden">
                    <div ref={sheetRef}>
                        <FitToWidth width={width} className="bg-white shadow-lg ring-1 ring-slate-200 dark:ring-[#2a2a2a]">
                            {children}
                        </FitToWidth>
                    </div>
                    {/* Phones: the thumbnail fades out and the whole of it opens the 1× view. */}
                    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-100 dark:from-[#151515] md:hidden" />
                    <button type="button" onClick={() => setOpen(true)} className="absolute inset-0 md:hidden" aria-label={`${title} 크게 보기`} />
                </div>
            </div>

            {footnote ? <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500 dark:border-[#2a2a2a] dark:text-gray-400">{footnote}</p> : null}

            {open ? (
                <Modal labelledBy={titleId} onClose={() => setOpen(false)} className="bg-slate-950/50">
                    <div className="flex h-full w-full items-end justify-center sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
                        <div className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl" style={{ maxWidth: width + 48 }}>
                            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
                                <div className="min-w-0">
                                    <h2 id={titleId} className="text-lg font-extrabold text-slate-950">{title}</h2>
                                    {meta ? <p className="truncate text-xs text-slate-500">{meta}</p> : null}
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5">
                                    {actions}
                                    <ModalCloseButton onClick={() => setOpen(false)} />
                                </div>
                            </div>
                            {/* 1×: the sheet keeps its print width and scrolls sideways on narrow screens. */}
                            <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3 sm:p-6">
                                <div className="mx-auto bg-white shadow-lg ring-1 ring-slate-200" style={{ width }}>
                                    {children}
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal>
            ) : null}
        </section>
    )
}
