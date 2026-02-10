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
            className="space-y-6"
        >
            <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-[#1e293b] tracking-tight ml-1">현재의 패스워드 / Current Password</label>
                <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full h-12 px-4 bg-white border border-gray-200 rounded-lg outline-none focus:border-gray-300 transition-all text-[14px] font-medium placeholder:text-gray-300 shadow-sm"
                    placeholder="현재의 패스워드를 입력해 주세요"
                />
            </div>

            <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-[#1e293b] tracking-tight ml-1">새로운 패스워드 / New Password</label>
                <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full h-12 px-4 bg-white border border-gray-200 rounded-lg outline-none focus:border-gray-300 transition-all text-[14px] font-medium placeholder:text-gray-300 shadow-sm"
                    minLength={6}
                    placeholder="새로운 패스워드 (6자 이상)"
                />
            </div>

            <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-[#1e293b] tracking-tight ml-1">패스워드 확인 / Confirm Password</label>
                <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-12 px-4 bg-white border border-gray-200 rounded-lg outline-none focus:border-gray-300 transition-all text-[14px] font-medium placeholder:text-gray-300 shadow-sm"
                    minLength={6}
                    placeholder="새로운 패스워드를 다시 입력해 주세요"
                />
            </div>

            {message.text && (
                <div className={`p-4 rounded-xl text-xs font-bold ${message.type === 'success' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                    {message.text}
                </div>
            )}

            <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-[#e34219] hover:bg-[#d03a15] text-white rounded-lg shadow-[0_4px_14px_0_rgba(227,66,25,0.12)] hover:shadow-[0_6px_20px_0_rgba(227,66,25,0.18)] transition-all active:scale-[0.98] flex items-center justify-center font-bold text-[15px] tracking-wide disabled:opacity-70 mt-2"
            >
                {loading ? 'Processing...' : '패스워드 변경 / Change Password'}
            </button>
        </form>
    )
}
