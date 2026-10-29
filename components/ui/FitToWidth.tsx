'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * On-screen preview of a fixed-size printed sheet (A4 = 210mm ≈ 794px). The sheet keeps its print width and
 * is zoomed down to the column it sits in, so the preview never clips or pushes the page sideways.
 * Print output is built from separate markup and is not affected.
 */
export default function FitToWidth({ width, children, className = '' }: {
  width: number
  children: ReactNode
  /** Applied to the visible frame (border, shadow) — it is exactly as wide as the scaled sheet. */
  className?: string
}) {
  const boundsRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const bounds = boundsRef.current
    if (!bounds) return
    const update = () => {
      if (bounds.clientWidth > 0) setScale(Math.min(1, bounds.clientWidth / width))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(bounds)
    return () => observer.disconnect()
  }, [width])

  return (
    <div ref={boundsRef} className="w-full min-w-0">
      <div className={`max-w-full overflow-hidden ${className}`} style={{ width: width * scale }}>
        <div style={{ width, zoom: scale }}>{children}</div>
      </div>
    </div>
  )
}
