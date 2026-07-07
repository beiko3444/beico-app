import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const MAX_FIELD_LENGTH = 8000

const readString = (value: unknown, maxLength = MAX_FIELD_LENGTH) => {
    if (typeof value === 'string') return value.slice(0, maxLength)
    if (value === null || value === undefined) return undefined
    return String(value).slice(0, maxLength)
}

export async function POST(request: Request) {
    let payload: Record<string, unknown> = {}

    try {
        payload = await request.json()
    } catch {
        payload = { message: 'Invalid client error payload' }
    }

    console.error('[client-error]', {
        type: readString(payload.type, 80),
        route: readString(payload.pathname, 500),
        href: readString(payload.href, 1000),
        message: readString(payload.message),
        stack: readString(payload.stack),
        source: readString(payload.source, 1000),
        lineno: payload.lineno,
        colno: payload.colno,
        userAgent: readString(payload.userAgent, 1000),
    })

    return NextResponse.json({ ok: true })
}
