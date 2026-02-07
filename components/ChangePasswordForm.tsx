'use client'

import { useState } from 'react'

export default function ChangePasswordForm() {
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState({ type: '', text: '' })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setMessage({ type: '', text: '' })

        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: '새 비밀번호가 일치하지 않습니다.' })
            return
        }

        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: '새 비밀번호는 최소 6자 이상이어야 합니다.' })
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
                setMessage({ type: 'success', text: '비밀번호가 성공적으로 변경되었습니다.' })
                setCurrentPassword('')
                setNewPassword('')
                setConfirmPassword('')
            } else {
                setMessage({ type: 'error', text: data.error === 'Invalid current password' ? '현재 비밀번호가 올바르지 않습니다.' : (data.error || '비밀번호 변경에 실패했습니다.') })
            }
        } catch (error) {
            setMessage({ type: 'error', text: '오류가 발생했습니다.' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    const target = e.target as HTMLElement;
                    if (target.tagName === 'INPUT') {
                        e.preventDefault();
                        handleSubmit(e as any);
                    }
                }
            }}
            className="space-y-4 max-w-md"
        >
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">현재 비밀번호</label>
                <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="현재 비밀번호를 입력하세요"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">새 비밀번호</label>
                <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    minLength={6}
                    placeholder="새 비밀번호 (6자 이상)"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">새 비밀번호 확인</label>
                <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    minLength={6}
                    placeholder="새 비밀번호를 다시 입력하세요"
                />
            </div>

            {message.text && (
                <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {message.text}
                </div>
            )}

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-[var(--color-brand-blue)] text-white py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
                {loading ? '변경 중...' : '비밀번호 변경'}
            </button>
        </form>
    )
}
