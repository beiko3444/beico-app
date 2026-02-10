'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    User,
    Lock,
    Building2,
    FileText,
    Mail,
    Phone,
    Printer,
    MapPin,
    Home,
    ArrowRight,
    Eye,
    EyeOff
} from 'lucide-react'

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
    const [showPassword, setShowPassword] = useState(false)
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
        <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-4 font-sans text-[#333] py-12">

            {/* Logo Section */}
            <div className="mb-8 flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="w-24 h-24 bg-[#395c46] flex flex-col items-center justify-center text-white mb-6 shadow-sm">
                    <span className="text-lg font-bold tracking-[0.2em] leading-none mb-1">BEIKO</span>
                    <span className="text-[0.5em] tracking-[0.3em] font-light opacity-80">NATURAL</span>
                </div>

                <h1 className="text-xl font-bold text-gray-900 tracking-wide mb-1">新規会員登録</h1>
                <p className="text-sm text-gray-500 font-medium mb-2 tracking-wide">Wholesale Registration</p>
                <p className="text-[10px] font-bold text-[#ea4318] tracking-[0.2em] uppercase">Professional Bait Solutions</p>
            </div>

            <div className="w-full max-w-[640px] animate-in fade-in zoom-in duration-500 delay-100">
                <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-8">

                    {error && (
                        <div className="mb-6 bg-red-50 border-l-4 border-[#ea4318] text-[#ea4318] px-4 py-3 rounded-r-lg text-sm font-medium animate-in fade-in slide-in-from-top-2">
                            ⚠️ {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">

                        {/* Account Info Section */}
                        <div className="space-y-5">
                            <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 mb-4">계정 정보 (Account Info)</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* ID */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-700 tracking-wide ml-1">아이디 / User ID <span className="text-[#ea4318]">*</span></label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                            <User size={18} strokeWidth={2.5} />
                                        </div>
                                        <input
                                            type="text"
                                            name="username"
                                            value={formData.username}
                                            onChange={handleChange}
                                            required
                                            className="w-full h-11 pl-11 pr-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-gray-400 transition-all text-sm font-medium placeholder:text-gray-400"
                                            placeholder="User ID"
                                        />
                                    </div>
                                </div>

                                {/* Password */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-700 tracking-wide ml-1">비밀번호 / Password <span className="text-[#ea4318]">*</span></label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                            <Lock size={18} strokeWidth={2.5} />
                                        </div>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            name="password"
                                            value={formData.password}
                                            onChange={handleChange}
                                            required
                                            className="w-full h-11 pl-11 pr-11 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-gray-400 transition-all text-sm font-medium placeholder:text-gray-400 tracking-widest"
                                            placeholder="••••••••"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Company Info Section */}
                        <div className="space-y-5 pt-2">
                            <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 mb-4">사업자 정보 (Company Info)</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Company Name */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-700 tracking-wide ml-1">상호명 / Company Name <span className="text-[#ea4318]">*</span></label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                            <Building2 size={18} strokeWidth={2.5} />
                                        </div>
                                        <input
                                            type="text"
                                            name="businessName"
                                            value={formData.businessName}
                                            onChange={handleChange}
                                            required
                                            className="w-full h-11 pl-11 pr-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-gray-400 transition-all text-sm font-medium placeholder:text-gray-400"
                                            placeholder="Company Name"
                                        />
                                    </div>
                                </div>

                                {/* Representative */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-700 tracking-wide ml-1">대표자명 / Representative <span className="text-[#ea4318]">*</span></label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                            <User size={18} strokeWidth={2.5} />
                                        </div>
                                        <input
                                            type="text"
                                            name="representativeName"
                                            value={formData.representativeName}
                                            onChange={handleChange}
                                            required
                                            className="w-full h-11 pl-11 pr-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-gray-400 transition-all text-sm font-medium placeholder:text-gray-400"
                                            placeholder="Name"
                                        />
                                    </div>
                                </div>

                                {/* Business Reg Number */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-700 tracking-wide ml-1">사업자등록번호 / Biz Reg # <span className="text-[#ea4318]">*</span></label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                            <FileText size={18} strokeWidth={2.5} />
                                        </div>
                                        <input
                                            type="text"
                                            name="businessRegNumber"
                                            value={formData.businessRegNumber}
                                            onChange={handleChange}
                                            required
                                            maxLength={12}
                                            className="w-full h-11 pl-11 pr-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-gray-400 transition-all text-sm font-medium placeholder:text-gray-400"
                                            placeholder="000-00-00000"
                                        />
                                    </div>
                                </div>

                                {/* Email */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-700 tracking-wide ml-1">이메일 / Email <span className="text-[#ea4318]">*</span></label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                            <Mail size={18} strokeWidth={2.5} />
                                        </div>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            required
                                            className="w-full h-11 pl-11 pr-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-gray-400 transition-all text-sm font-medium placeholder:text-gray-400"
                                            placeholder="email@example.com"
                                        />
                                    </div>
                                </div>

                                {/* Phone */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-700 tracking-wide ml-1">전화번호 / Phone <span className="text-[#ea4318]">*</span></label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                            <Phone size={18} strokeWidth={2.5} />
                                        </div>
                                        <input
                                            type="text"
                                            name="contact"
                                            value={formData.contact}
                                            onChange={handleChange}
                                            required
                                            maxLength={13}
                                            className="w-full h-11 pl-11 pr-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-gray-400 transition-all text-sm font-medium placeholder:text-gray-400"
                                            placeholder="010-0000-0000"
                                        />
                                    </div>
                                </div>

                                {/* Fax */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-700 tracking-wide ml-1">팩스 / Fax <span className="text-gray-400 font-normal text-[0.8em]">(Optional)</span></label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                            <Printer size={18} strokeWidth={2.5} />
                                        </div>
                                        <input
                                            type="text"
                                            name="fax"
                                            value={formData.fax}
                                            onChange={handleChange}
                                            className="w-full h-11 pl-11 pr-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-gray-400 transition-all text-sm font-medium placeholder:text-gray-400"
                                            placeholder="Fax Number"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Address Section */}
                            <div className="pt-2">
                                <label className="text-xs font-bold text-gray-700 tracking-wide ml-1 mb-1.5 block">주소 / Address <span className="text-[#ea4318]">*</span></label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                            <MapPin size={18} strokeWidth={2.5} />
                                        </div>
                                        <input
                                            type="text"
                                            name="address"
                                            value={formData.address}
                                            onChange={handleChange}
                                            required
                                            className="w-full h-11 pl-11 pr-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-gray-400 transition-all text-sm font-medium placeholder:text-gray-400"
                                            placeholder="Basic Address"
                                        />
                                    </div>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                            <Home size={18} strokeWidth={2.5} />
                                        </div>
                                        <input
                                            type="text"
                                            name="addressDetail"
                                            value={formData.addressDetail}
                                            onChange={handleChange}
                                            className="w-full h-11 pl-11 pr-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-gray-400 transition-all text-sm font-medium placeholder:text-gray-400"
                                            placeholder="Detailed Address (Optional)"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="pt-6">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-14 bg-[#e34219] hover:bg-[#d03a15] text-white rounded-xl shadow-[0_4px_14px_0_rgba(227,66,25,0.39)] transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 font-bold text-base tracking-wide disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? '처리 중...' : (
                                    <>
                                        회원가입 신청 / Apply <ArrowRight size={20} strokeWidth={2.5} />
                                    </>
                                )}
                            </button>
                            <div className="text-center mt-6">
                                <Link href="/login" className="text-xs font-bold text-gray-500 hover:text-[#ea4318] transition-colors tracking-wide">
                                    이미 계정이 있으신가요? 로그인하기
                                </Link>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="mt-8 text-center">
                    <p className="text-[10px] text-gray-400 font-medium tracking-wide">
                        &copy; BEIKO NATURAL. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    )
}
