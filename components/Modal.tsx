'use client'

import { useEffect, useRef, type ReactNode } from 'react'

const scrollLocks = new WeakMap<Document, { count: number; overflow: string }>()

/** Native modal semantics, focus containment, Escape and focus restoration. */
export default function Modal({ children, onClose, labelledBy, label, className = '' }: {
    children: ReactNode
    onClose: () => void
    labelledBy?: string
    label?: string
    className?: string
}) {
    const dialogRef = useRef<HTMLDialogElement>(null)
    const onCloseRef = useRef(onClose)
    useEffect(() => { onCloseRef.current = onClose }, [onClose])

    useEffect(() => {
        const dialog = dialogRef.current
        if (!dialog) return
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
        const lock = scrollLocks.get(document) || { count: 0, overflow: document.body.style.overflow }
        lock.count += 1
        scrollLocks.set(document, lock)
        document.body.style.overflow = 'hidden'
        dialog.showModal()
        return () => {
            dialog.close()
            lock.count -= 1
            if (lock.count === 0) {
                document.body.style.overflow = lock.overflow
                scrollLocks.delete(document)
            }
            if (previousFocus?.isConnected) previousFocus.focus()
        }
    }, [])

    return <dialog
        ref={dialogRef}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        className={`ux-modal ${className}`}
        onCancel={event => { event.preventDefault(); onCloseRef.current() }}
    >{children}</dialog>
}
