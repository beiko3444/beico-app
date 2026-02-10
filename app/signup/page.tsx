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
                throw new Error(data.error || '登録中にエラーが発生しました。 / An error occurred during registration.')
            }

            alert('会員登録が完了しました。管理者の承認をお待ちください。\nRegistration complete. Please wait for admin approval.')
            router.push('/login')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#Fdfdfd] flex flex-col items-center justify-center p-4 font-sans text-[#333] py-6">

            <div className="w-full max-w-[500px] mb-5">
                <div className="flex items-center gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="w-[77px] h-auto relative shrink-0">
                        <img
                            src="/logo.png"
                            alt="BEIKO BAIT"
                            className="w-full h-full object-contain"
                        />
                    </div>

                    <div className="flex flex-col justify-center mt-2">
                        <h1 className="text-xl font-bold text-gray-800 tracking-tight mb-1">業者向け会員登録</h1>
                        <p className="text-[9px] font-bold tracking-[0.4em] uppercase text-slate-400 whitespace-nowrap">
                            Wholesale Registration
                        </p>
                    </div>
                </div>
            </div>

            <div className="w-full max-w-[500px] animate-in fade-in zoom-in duration-500 delay-100">

                {error && (
                    <div className="mb-6 bg-red-50 border-l-4 border-[#e34219] text-[#e34219] px-4 py-3 rounded-r-lg text-sm font-medium animate-in fade-in slide-in-from-top-2">
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">

                    {/* User ID */}
                    <div className="space-y-1.5">
                        <label className="text-[12px] font-semibold text-[#1e293b] tracking-tight ml-1 block">
                            <span className="text-[#e34219]">*</span> ユーザーID / User ID
                        </label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                <User size={18} strokeWidth={1.5} />
                            </div>
                            <input
                                type="text"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                required
                                className="w-full h-12 pl-11 pr-4 bg-white border border-gray-200 rounded-lg outline-none focus:border-gray-400 transition-all text-sm font-medium placeholder:text-gray-300 shadow-sm"
                                placeholder="Desired User ID"
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                        <label className="text-[12px] font-semibold text-[#1e293b] tracking-tight ml-1 block">
                            <span className="text-[#e34219]">*</span> パスワード / Password
                        </label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                <Lock size={18} strokeWidth={1.5} />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                className="w-full h-12 pl-11 pr-11 bg-white border border-gray-200 rounded-lg outline-none focus:border-gray-400 transition-all text-sm font-medium placeholder:text-gray-300 tracking-widest shadow-sm"
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* Company Name */}
                    <div className="space-y-1.5">
                        <label className="text-[12px] font-semibold text-[#1e293b] tracking-tight ml-1 block">
                            <span className="text-[#e34219]">*</span> 商号 / Company Name
                        </label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                <Building2 size={18} strokeWidth={1.5} />
                            </div>
                            <input
                                type="text"
                                name="businessName"
                                value={formData.businessName}
                                onChange={handleChange}
                                required
                                className="w-full h-12 pl-11 pr-4 bg-white border border-gray-200 rounded-lg outline-none focus:border-gray-400 transition-all text-sm font-medium placeholder:text-gray-300 shadow-sm"
                                placeholder="Your Company Name"
                            />
                        </div>
                    </div>

                    {/* Contact Person */}
                    <div className="space-y-1.5">
                        <label className="text-[12px] font-semibold text-[#1e293b] tracking-tight ml-1 block">
                            <span className="text-[#e34219]">*</span> 担当者名 / Contact Person
                        </label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                <User size={18} strokeWidth={1.5} />
                            </div>
                            <input
                                type="text"
                                name="representativeName"
                                value={formData.representativeName}
                                onChange={handleChange}
                                required
                                className="w-full h-12 pl-11 pr-4 bg-white border border-gray-200 rounded-lg outline-none focus:border-gray-400 transition-all text-sm font-medium placeholder:text-gray-300 shadow-sm"
                                placeholder="Full Name"
                            />
                        </div>
                    </div>

                    {/* Business Reg Number */}
                    <div className="space-y-1.5">
                        <label className="text-[12px] font-semibold text-[#1e293b] tracking-tight ml-1 block">
                            <span className="text-[#e34219]">*</span> 事業者登録番号 / Business Registration Number
                        </label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                <span className="text-lg font-bold">#</span>
                            </div>
                            <input
                                type="text"
                                name="businessRegNumber"
                                value={formData.businessRegNumber}
                                onChange={handleChange}
                                required
                                maxLength={13}
                                className="w-full h-12 pl-11 pr-4 bg-white border border-gray-200 rounded-lg outline-none focus:border-gray-400 transition-all text-sm font-medium placeholder:text-gray-300 shadow-sm"
                                placeholder="123-45-67890"
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                        <label className="text-[12px] font-semibold text-[#1e293b] tracking-tight ml-1 block">
                            <span className="text-[#e34219]">*</span> メールアドレス / Email
                        </label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                <Mail size={18} strokeWidth={1.5} />
                            </div>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                className="w-full h-12 pl-11 pr-4 bg-white border border-gray-200 rounded-lg outline-none focus:border-gray-400 transition-all text-sm font-medium placeholder:text-gray-300 shadow-sm"
                                placeholder="example@company.com"
                            />
                        </div>
                    </div>

                    {/* Phone & Fax Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Phone */}
                        <div className="space-y-1.5">
                            <label className="text-[12px] font-semibold text-[#1e293b] tracking-tight ml-1 block">
                                <span className="text-[#e34219]">*</span> 電話番号 / Phone
                            </label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                    <Phone size={18} strokeWidth={1.5} />
                                </div>
                                <input
                                    type="text"
                                    name="contact"
                                    value={formData.contact}
                                    onChange={handleChange}
                                    required
                                    maxLength={13}
                                    className="w-full h-12 pl-11 pr-4 bg-white border border-gray-200 rounded-lg outline-none focus:border-gray-400 transition-all text-sm font-medium placeholder:text-gray-300 shadow-sm"
                                    placeholder="03-1234-5678"
                                />
                            </div>
                        </div>

                        {/* Fax */}
                        <div className="space-y-1.5">
                            <label className="text-[12px] font-semibold text-[#1e293b] tracking-tight ml-1 block">ファックス / Fax</label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                    <Printer size={18} strokeWidth={1.5} />
                                </div>
                                <input
                                    type="text"
                                    name="fax"
                                    value={formData.fax}
                                    onChange={handleChange}
                                    className="w-full h-12 pl-11 pr-4 bg-white border border-gray-200 rounded-lg outline-none focus:border-gray-400 transition-all text-sm font-medium placeholder:text-gray-300 shadow-sm"
                                    placeholder="(Optional)"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Address 1 */}
                    <div className="space-y-1.5">
                        <label className="text-[12px] font-semibold text-[#1e293b] tracking-tight ml-1 block">
                            <span className="text-[#e34219]">*</span> 住所1 / Address 1
                        </label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                <MapPin size={18} strokeWidth={1.5} />
                            </div>
                            <input
                                type="text"
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                required
                                className="w-full h-12 pl-11 pr-4 bg-white border border-gray-200 rounded-lg outline-none focus:border-gray-400 transition-all text-sm font-medium placeholder:text-gray-300 shadow-sm"
                                placeholder="Prefecture, City, District"
                            />
                        </div>
                    </div>

                    {/* Address 2 */}
                    <div className="space-y-1.5">
                        <label className="text-[12px] font-semibold text-[#1e293b] tracking-tight ml-1 block">住所2 / Address 2</label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                <Home size={18} strokeWidth={1.5} />
                            </div>
                            <input
                                type="text"
                                name="addressDetail"
                                value={formData.addressDetail}
                                onChange={handleChange}
                                className="w-full h-12 pl-11 pr-4 bg-white border border-gray-200 rounded-lg outline-none focus:border-gray-400 transition-all text-sm font-medium placeholder:text-gray-300 shadow-sm"
                                placeholder="Building, Apt, Suite"
                            />
                        </div>
                    </div>


                    {/* Submit Button */}
                    <div className="pt-6">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-[#e34219] hover:bg-[#d03a15] text-white rounded-lg shadow-[0_4px_14px_0_rgba(227,66,25,0.12)] hover:shadow-[0_6px_20px_0_rgba(227,66,25,0.18)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 font-bold text-[15px] tracking-tight disabled:opacity-70 disabled:cursor-not-allowed group"
                        >
                            {loading ? (
                                <span className="animate-pulse">Processing...</span>
                            ) : (
                                <>
                                    <span>業者向け会員登録 / Register</span>
                                    <ArrowRight size={18} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform" />
                                </>
                            )}
                        </button>
                    </div>
                </form>

                {/* Footer */}
                <div className="mt-8 text-center">
                    <p className="text-xs text-gray-500 font-medium tracking-wide">
                        すでにアカウントをお持ちですか？ <Link href="/login" className="text-[#e34219] hover:underline font-bold ml-1">ログイン Login</Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
