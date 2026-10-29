'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Scales the fixed 210mm sheet down to the screen width on phones so the whole document,
 * including the totals column, is visible. Print and the PNG export use the unscaled sheet.
 */
export default function InvoiceFit({ children }: { children: ReactNode }) {
    const frameRef = useRef<HTMLDivElement>(null)
    const sheetRef = useRef<HTMLDivElement>(null)
    const [fit, setFit] = useState<{ scale: number; height: number } | null>(null)

    useEffect(() => {
        const frame = frameRef.current
        const sheet = sheetRef.current
        if (!frame || !sheet) return
        const update = () => {
            // offsetWidth/offsetHeight ignore the transform, so this never feeds back on itself.
            const scale = Math.min(1, frame.clientWidth / sheet.offsetWidth)
            const next = scale < 0.999 ? { scale, height: Math.ceil(sheet.offsetHeight * scale) } : null
            setFit(current => (current?.scale === next?.scale && current?.height === next?.height ? current : next))
        }
        update()
        const observer = new ResizeObserver(update)
        observer.observe(frame)
        observer.observe(sheet)
        return () => observer.disconnect()
    }, [])

    return (
        <div
            ref={frameRef}
            className={`mx-auto w-full max-w-[210mm] max-sm:overflow-hidden print:h-auto! print:max-w-none print:overflow-visible ${fit ? 'overflow-hidden' : ''}`}
            style={fit ? { height: fit.height } : undefined}
        >
            <div
                ref={sheetRef}
                className="w-[210mm] origin-top-left print:transform-none!"
                style={fit ? { transform: `scale(${fit.scale})` } : undefined}
            >
                {children}
            </div>
        </div>
    )
}
