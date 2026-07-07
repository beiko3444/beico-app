'use client'

import { useEffect } from 'react'

let lastSignature = ''
let lastSentAt = 0

const MAX_STACK_LENGTH = 8000
const REPEAT_WINDOW_MS = 3000

type ClientErrorPayload = {
    type: 'error' | 'unhandledrejection'
    message: string
    stack?: string
    source?: string
    lineno?: number
    colno?: number
    pathname: string
    href: string
    userAgent: string
}

const toMessage = (value: unknown) => {
    if (value instanceof Error) return value.message || value.name
    if (typeof value === 'string') return value
    try {
        return JSON.stringify(value)
    } catch {
        return String(value)
    }
}

const toStack = (value: unknown) => {
    const stack = value instanceof Error ? value.stack : undefined
    return stack ? stack.slice(0, MAX_STACK_LENGTH) : undefined
}

const sendClientError = (payload: ClientErrorPayload) => {
    const signature = `${payload.type}:${payload.pathname}:${payload.message}:${payload.stack?.slice(0, 200) || ''}`
    const now = Date.now()

    if (signature === lastSignature && now - lastSentAt < REPEAT_WINDOW_MS) {
        return
    }

    lastSignature = signature
    lastSentAt = now

    const body = JSON.stringify(payload)

    if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' })
        if (navigator.sendBeacon('/api/client-errors', blob)) return
    }

    void fetch('/api/client-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
    }).catch(() => undefined)
}

export default function ClientErrorReporter() {
    useEffect(() => {
        const basePayload = () => ({
            pathname: window.location.pathname,
            href: window.location.href,
            userAgent: navigator.userAgent,
        })

        const handleError = (event: ErrorEvent) => {
            sendClientError({
                type: 'error',
                message: event.message || toMessage(event.error),
                stack: toStack(event.error),
                source: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                ...basePayload(),
            })
        }

        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            sendClientError({
                type: 'unhandledrejection',
                message: toMessage(event.reason),
                stack: toStack(event.reason),
                ...basePayload(),
            })
        }

        window.addEventListener('error', handleError)
        window.addEventListener('unhandledrejection', handleUnhandledRejection)

        return () => {
            window.removeEventListener('error', handleError)
            window.removeEventListener('unhandledrejection', handleUnhandledRejection)
        }
    }, [])

    return null
}
