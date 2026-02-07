'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
    const router = useRouter()
    const [formData, setFormData] = useState({
        businessName: '',
        representativeName: '',
        username: '',
        password: '',
        contact: '',
        fax: '',
        email: '',
        businessRegNumber: '',
        address: '',
        addressDetail: ''
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        let finalValue = value

        // Auto-format phone number
        if (name === 'contact') {
            const numbers = value.replace(/[^\d]/g, '')
            if (numbers.length <= 3) {
                finalValue = numbers
            } else if (numbers.length <= 7) {
                finalValue = `${numbers.slice(0, 3)}-${numbers.slice(3)}`
            } else {
                finalValue = `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`
            }
        } else if (name === 'businessRegNumber') {
            const numbers = value.replace(/[^\d]/g, '')
            if (numbers.length <= 3) {
                finalValue = numbers
            } else if (numbers.length <= 5) {
                finalValue = `${numbers.slice(0, 3)}-${numbers.slice(3)}`
            } else {
                finalValue = `${numbers.slice(0, 3)}-${numbers.slice(3, 5)}-${numbers.slice(5, 10)}`
            }
        }

        setFormData(prev => ({ ...prev, [name]: finalValue }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            // Combine address and detail address
            const submitData = {
                ...formData,
                address: `${formData.address} ${formData.addressDetail}`.trim()
            }

            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submitData)
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || '회원가입 처리 중 오류가 발생했습니다.')
            }

            alert('회원가입이 완료되었습니다. 관리자 승인 후 이용 가능합니다.')
            router.push('/login')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] relative overflow-hidden font-sans py-12">
            {/* Background Accent */}
            <div className="absolute top-0 left-0 w-full h-[40vh] bg-[#d9361b] z-0">
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
            </div>

            <div className="w-full max-w-[600px] px-6 z-10 animate-in fade-in zoom-in duration-500">
                <div className="bg-white rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.12)] overflow-hidden border border-white/20">
                    {/* Header */}
                    <div className="bg-[#d9361b] pt-10 pb-8 px-8 flex flex-col items-center relative overflow-hidden">
                        <div className="relative z-10 text-center">
                            <h2 className="text-white text-2xl font-bold tracking-tight">Partner Registration</h2>
                            <p className="text-white/60 text-xs mt-1 font-medium tracking-widest uppercase">Join the Beico Ecosystem</p>
                        </div>
                    </div>

                    <div className="px-8 py-10">
                        {error && (
                            <div className="bg-red-50 border-l-4 border-[#d9361b] text-[#d9361b] text-sm px-4 py-3 rounded-r-xl mb-6">
                                <p className="font-bold flex items-center gap-2 text-xs">⚠️ {error}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider ml-1">아이디 (ID) <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        name="username"
                                        value={formData.username}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 focus:bg-white focus:border-[#d9361b] outline-none transition-all text-sm"
                                        placeholder="User ID"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider ml-1">비밀번호 (Password) <span className="text-red-500">*</span></label>
                                    <input
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 focus:bg-white focus:border-[#d9361b] outline-none transition-all text-sm"
                                        placeholder="Password"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider ml-1">상호명 (Business Name) <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        name="businessName"
                                        value={formData.businessName}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 focus:bg-white focus:border-[#d9361b] outline-none transition-all text-sm"
                                        placeholder="Company Name"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider ml-1">담당자명 (Representative) <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        name="representativeName"
                                        value={formData.representativeName}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 focus:bg-white focus:border-[#d9361b] outline-none transition-all text-sm"
                                        placeholder="Name"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider ml-1">사업자등록번호 (Biz Reg #) <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        name="businessRegNumber"
                                        value={formData.businessRegNumber}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 focus:bg-white focus:border-[#d9361b] outline-none transition-all text-sm"
                                        placeholder="000-00-00000"
                                        maxLength={12}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider ml-1">이메일 (Email) <span className="text-red-500">*</span></label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 focus:bg-white focus:border-[#d9361b] outline-none transition-all text-sm"
                                        placeholder="email@example.com"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider ml-1">전화번호 (Phone) <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        name="contact"
                                        value={formData.contact}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 focus:bg-white focus:border-[#d9361b] outline-none transition-all text-sm"
                                        placeholder="010-0000-0000"
                                        maxLength={13}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider ml-1">팩스 (Fax) <span className="text-gray-400 font-normal normal-case">(Optional)</span></label>
                                    <input
                                        type="text"
                                        name="fax"
                                        value={formData.fax}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 focus:bg-white focus:border-[#d9361b] outline-none transition-all text-sm"
                                        placeholder="Fax Number"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider ml-1">주소 (Address) <span className="text-red-500">*</span></label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <input
                                        type="text"
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 focus:bg-white focus:border-[#d9361b] outline-none transition-all text-sm"
                                        placeholder="Basic Address"
                                    />
                                    <input
                                        type="text"
                                        name="addressDetail"
                                        value={formData.addressDetail}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 focus:bg-white focus:border-[#d9361b] outline-none transition-all text-sm"
                                        placeholder="Detailed Address (Optional)"
                                    />
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-4 rounded-xl bg-[#d9361b] text-white font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50"
                                >
                                    {loading ? '처리 중...' : '회원가입 요청 (Submit Registration)'}
                                </button>
                                <div className="text-center mt-4">
                                    <Link href="/login" className="text-xs text-gray-500 hover:text-[#d9361b] font-medium transition-colors">
                                        이미 계정이 있으신가요? 로그인하기
                                    </Link>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}
