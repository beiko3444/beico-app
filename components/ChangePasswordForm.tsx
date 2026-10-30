'use client'

import { useState } from 'react'
import { buttonClass } from '@/components/ui/buttonClass'
import { fieldClass } from '@/components/ui/field'

export default function ChangePasswordForm({ isKorean = false }: { isKorean?: boolean }) {
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState({ type: '', text: '' })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setMessage({ type: '', text: '' })

        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: isKorean ? '새 비밀번호가 일치하지 않습니다.' : '新しいパスワードが一致しません。' })
            return
        }

        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: isKorean ? '새 비밀번호는 6자 이상이어야 합니다.' : '新しいパスワードは少なくとも6文字以上である必要があります。' })
            return
        }

        setLoading(true)

        try {
            const res = await fetch('/api/user/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword })
            })

            const data = await res.json()

            if (res.ok) {
                setMessage({ type: 'success', text: isKorean ? '비밀번호가 변경되었습니다.' : 'パスワードが正常に変更されました。' })
                setCurrentPassword('')
                setNewPassword('')
                setConfirmPassword('')
            } else {
                setMessage({ type: 'error', text: data.error === 'Invalid current password' ? (isKorean ? '현재 비밀번호가 올바르지 않습니다.' : '現在のパスワードが正しくありません。') : (isKorean ? '비밀번호 변경에 실패했습니다.' : (data.error || 'パスワードの変更に失敗しました。')) })
            }
        } catch {
            setMessage({ type: 'error', text: isKorean ? '오류가 발생했습니다.' : 'エラーが発生しました。' })
        } finally {
            setLoading(false)
        }
    }

    const inputClass = fieldClass('h-12 bg-[var(--input-bg)] text-base text-[var(--foreground)]')
    const ready = Boolean(currentPassword && newPassword && confirmPassword)

    return (
        <form
            onSubmit={handleSubmit}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    const target = e.target as HTMLElement;
                    if (target.tagName === 'INPUT') {
                        e.preventDefault();
                        e.currentTarget.requestSubmit();
                    }
                }
            }}
            className="space-y-5"
        >
            <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                    <label htmlFor="current-password" className="block text-sm font-semibold">{isKorean ? '현재 비밀번호' : '現在のパスワード'}</label>
                    <input
                        id="current-password"
                        type="password"
                        required
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className={inputClass}
                    />
                </div>

                <div className="space-y-2 sm:col-start-1">
                    <label htmlFor="new-password" className="block text-sm font-semibold">{isKorean ? '새 비밀번호' : '新しいパスワード'}</label>
                    <input
                        id="new-password"
                        type="password"
                        required
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={inputClass}
                        minLength={6}
                        aria-describedby="new-password-help"
                    />
                    <p id="new-password-help" className="ux-helper">{isKorean ? '6자 이상' : '6文字以上'}</p>
                </div>

                <div className="space-y-2">
                    <label htmlFor="confirm-password" className="block text-sm font-semibold">{isKorean ? '새 비밀번호 확인' : '新しいパスワード（確認）'}</label>
                    <input
                        id="confirm-password"
                        type="password"
                        required
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={inputClass}
                        minLength={6}
                    />
                </div>
            </div>

            {message.text && (
                <p role={message.type === 'success' ? 'status' : 'alert'} className={`rounded-lg border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]'}`}>
                    {message.text}
                </p>
            )}

            {/* Stays grey until all three fields are filled, so the profile save above remains the one active primary. */}
            <button
                type="submit"
                disabled={loading || !ready}
                className={buttonClass('primary', 'md')}
            >
                {loading ? (isKorean ? '변경 중…' : '変更中…') : (isKorean ? '비밀번호 변경' : 'パスワードを変更')}
            </button>
        </form>
    )
}
