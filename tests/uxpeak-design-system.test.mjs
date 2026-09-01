import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('provides an accessible, motion-safe global interface system', () => {
    const css = read('../app/globals.css')

    assert.match(css, /:focus-visible/)
    assert.match(css, /prefers-reduced-motion: reduce/)
    assert.match(css, /\.ux-panel/)
    assert.match(css, /\.ux-button-primary/)
    assert.match(css, /body \*[\s\S]*letter-spacing: 0 !important/)
})

test('uses responsive navigation shells for admin and partner areas', () => {
    const adminLayout = read('../app/admin/layout.tsx')
    const adminNav = read('../app/admin/AdminNav.tsx')
    const partnerLayout = read('../app/order/layout.tsx')
    const partnerNav = read('../components/UserNavbar.tsx')

    assert.match(adminLayout, /lg:ml-\[248px\]/)
    assert.match(adminNav, /aria-label="관리자 메뉴"/)
    assert.match(partnerLayout, /max-w-\[1440px\]/)
    assert.match(partnerNav, /aria-current=/)
    assert.match(partnerNav, /fixed inset-x-0 bottom-0/)
})

test('login has semantic fields, a real checkbox and recoverable errors', () => {
    const login = read('../app/login/page.tsx')

    assert.match(login, /htmlFor="username"/)
    assert.match(login, /autoComplete="username"/)
    assert.match(login, /autoComplete="current-password"/)
    assert.match(login, /type="checkbox"/)
    assert.match(login, /role="alert"/)
    assert.doesNotMatch(login, /Forgot Password/)
})
