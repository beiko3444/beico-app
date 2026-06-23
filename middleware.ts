import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_ONLY_API_PREFIXES = [
    '/api/products',
    '/api/admin',
    '/api/tasks',
    '/api/production',
    '/api/partners',
    '/api/coupang',
    '/api/naver',
    '/api/mindboard',
]

const PUBLIC_API_PATHS = [
    '/api/admin/deposit-sms/ingest',
]

function isPublicPath(pathname: string) {
    if (pathname === '/inventory' || pathname.startsWith('/inventory/')) return true
    if (pathname === '/api/admin/inventory/inbounds' || pathname.startsWith('/api/admin/inventory/inbounds/')) return true
    if (/^\/api\/products\/[^/]+\/image$/.test(pathname)) return true
    return PUBLIC_API_PATHS.includes(pathname)
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    if (isPublicPath(pathname)) {
        return NextResponse.next()
    }

    if (pathname.startsWith('/admin')) {
        const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
        if (!token || token.role !== 'ADMIN') {
            return NextResponse.redirect(new URL('/login', request.url))
        }
    }

    if (ADMIN_ONLY_API_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
        const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
        if (!token || token.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        '/admin/:path*',
        '/inventory/:path*',
        '/api/products/:path*',
        '/api/admin/:path*',
        '/api/tasks/:path*',
        '/api/production/:path*',
        '/api/partners/:path*',
        '/api/coupang/:path*',
        '/api/naver/:path*',
        '/api/mindboard/:path*',
    ],
}
