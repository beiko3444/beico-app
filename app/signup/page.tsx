'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    User, Lock, Building2, Mail, Phone, Printer, MapPin, Home, ArrowRight, Eye, EyeOff, Globe, ArrowLeft
} from 'lucide-react'

const TRANSLATIONS: Record<string, any> = {
    Japan: {
        title: "業者向け会員登録",
        subtitle: "WHOLESALE REGISTRATION",
        userId: "ユーザーID / User ID",
        password: "パスワード / Password",
        confirmPassword: "パスワードの確認 / Confirm Password",
        companyName: "商号 / Company Name",
        contactPerson: "担当者名 / Contact Person",
        nationality: "国籍 / Nationality",
        registrationNumber: "事業者登録番号 / Business Reg. Number",
        email: "メールアドレス (税金計算書発行用) / Email (for Tax Invoice)",
        phone: "電話番号 / Phone",
        fax: "ファックス / Fax",
        address1: "住所 (この住所に卸売商品が配送されます) / Address (Delivery)",
        address2: "詳細住所 / Address 2",
        submit: "登録する / Register",
        passwordMismatch: "パスワードが一致しません。 / Passwords do not match.",
        successMsg: "会員登録が完了しました。管理者の承認をお待ちください。\nRegistration complete. Please wait for admin approval.",
        errorPrefix: "登録中にエラーが発生しました。 / An error occurred during registration.",
        loginText: "すでにアカウントをお持ちですか？",
        loginLink: "ログイン Login",
        countryPlaceholder: "国籍を選択 / Select Nationality",
        nextButton: "次へ / Next"
    },
    Korea: {
        title: "도매상 회원가입",
        subtitle: "WHOLESALE REGISTRATION",
        userId: "로그인 아이디 (User ID)",
        password: "비밀번호 (Password)",
        confirmPassword: "비밀번호 확인 (Confirm Password)",
        companyName: "상호명 (Company Name)",
        contactPerson: "대표자명 (Contact Person)",
        nationality: "국가 (Nationality)",
        registrationNumber: "사업자등록번호 (Business Reg. Number)",
        email: "이메일 (세금계산서 발급용)",
        phone: "전화번호 (Phone)",
        fax: "팩스 (Fax)",
        address1: "기본 주소 (해당 주소지로 도매상품이 배송됩니다)",
        address2: "상세 주소 (Address 2)",
        submit: "가입하기 (Register)",
        passwordMismatch: "비밀번호가 일치하지 않습니다.",
        successMsg: "회원가입이 완료되었습니다. 관리자 승인을 기다려주세요.",
        errorPrefix: "등록 중 오류가 발생했습니다.",
        loginText: "이미 계정이 있으신가요?",
        loginLink: "로그인 Login",
        countryPlaceholder: "국가 선택 / Select Nationality",
        nextButton: "다음 / Next"
    },
    Default: {
        title: "Wholesale Registration",
        subtitle: "WHOLESALE REGISTRATION",
        userId: "User ID",
        password: "Password",
        confirmPassword: "Confirm Password",
        companyName: "Company Name",
        contactPerson: "Contact Person",
        nationality: "Nationality",
        registrationNumber: "Business Registration Number",
        email: "Email (for Tax Invoice)",
        phone: "Phone",
        fax: "Fax",
        address1: "Address (Wholesale products will be shipped to this address)",
        address2: "Address 2",
        submit: "Register",
        passwordMismatch: "Passwords do not match.",
        successMsg: "Registration complete. Please wait for admin approval.",
        errorPrefix: "An error occurred during registration.",
        loginText: "Already have an account?",
        loginLink: "Log in",
        countryPlaceholder: "Select Nationality",
        nextButton: "Next"
    }
}

export default function SignupPage() {
    const router = useRouter()
    const [step, setStep] = useState(1)
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
        addressDetail: '',
        country: '',
        confirmPassword: '',
        businessRegistrationDocument: null as File | null
    })
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const t = TRANSLATIONS[formData.country] || TRANSLATIONS['Default'];

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        let finalValue = value

        if (name === 'password' || name === 'confirmPassword') {
            setError('')
        }

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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setFormData(prev => ({ ...prev, businessRegistrationDocument: file }))
        } else {
            setFormData(prev => ({ ...prev, businessRegistrationDocument: null }))
        }
    }

    const handleNextStep = (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.country) {
            setError('Please select a nationality first.')
            return
        }
        setError('')
        setStep(2)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        if (formData.password !== formData.confirmPassword) {
            setError(t.passwordMismatch)
            setLoading(false)
            return
        }

        try {
            const submitData = new FormData()
            submitData.append('username', formData.username)
            submitData.append('password', formData.password)
            submitData.append('businessName', formData.businessName)
            submitData.append('representativeName', formData.representativeName)
            submitData.append('contact', formData.contact)
            submitData.append('fax', formData.fax)
            submitData.append('email', formData.email)
            submitData.append('businessRegNumber', formData.businessRegNumber)
            submitData.append('country', formData.country)
            submitData.append('address', `${formData.address} ${formData.addressDetail}`.trim())

            if (formData.businessRegistrationDocument) {
                // businessRegistrationDocument is a File object
                submitData.append('businessRegistrationDocument', formData.businessRegistrationDocument)
            }

            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                body: submitData
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || t.errorPrefix)
            }

            alert(t.successMsg)
            router.push('/login')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#f9f9f9] dark:bg-[#111111] flex flex-col items-center justify-center p-4 font-sans text-[#333] dark:text-gray-200 py-6">
            <div className="w-full max-w-[500px] mb-5">
                <div className="flex items-center gap-6">
                    <div className="w-[77px] h-auto relative shrink-0">
                        <img
                            src="/logo.png"
                            alt="BEIKO BAIT"
                            className="w-full h-full object-contain"
                        />
                    </div>
                    <div className="flex flex-col justify-center mt-2">
                        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 tracking-tight mb-1">{t.title}</h1>
                        <p className="text-[9px] font-bold tracking-[0.4em] uppercase text-slate-400 dark:text-slate-500 whitespace-nowrap">
                            {t.subtitle}
                        </p>
                    </div>
                </div>
            </div>

            <div className="w-full max-w-[500px]">
                {error && (
                    <div className="mb-6 bg-red-50 dark:bg-red-900/20 border-l-4 border-[#e34219] text-[#e34219] dark:text-red-400 px-4 py-3 rounded-r-lg text-sm font-medium">
                        ⚠️ {error}
                    </div>
                )}

                {step === 1 ? (
                    <form onSubmit={handleNextStep} className="space-y-5 bg-white dark:bg-[#1e1e1e] p-6 rounded-xl border border-gray-100 dark:border-[#2a2a2a] shadow-sm dark:shadow-none">
                        <div className="space-y-1.5">
                            <label className="text-[12px] font-semibold text-[#1e293b] dark:text-gray-300 tracking-tight ml-1 block">
                                <span className="text-[#e34219]">*</span> 国籍 / Nationality / 국가
                            </label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors pointer-events-none">
                                    <Globe size={18} strokeWidth={1.5} />
                                </div>
                                <select
                                    name="country"
                                    value={formData.country}
                                    onChange={(e) => {
                                        handleChange(e as any)
                                        setError('')
                                    }}
                                    required
                                    className="w-full h-12 pl-11 pr-4 bg-white border border-gray-200 rounded-lg outline-none focus:border-gray-400 transition-all text-sm font-medium shadow-sm appearance-none cursor-pointer"
                                >
                                    <option value="" disabled>Select Nationality</option>
                                    <option value="Japan">🇯🇵 日本 / Japan / 일본</option>
                                    <option value="Korea">🇰🇷 韓国 / Korea / 한국</option>
                                    <option value="USA">🇺🇸 米国 / USA / 미국</option>
                                    <option value="China">🇨🇳 中国 / China / 중국</option>
                                    <option value="Turkey">🇹🇷 トルコ / Türkiye / 투르키예</option>
                                    <option value="Indonesia">🇮🇩 印度尼西亜 / Indonesia / 인도네시아</option>
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                    <ArrowRight size={14} className="rotate-90" />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                className="w-full h-12 bg-[#e34219] hover:bg-[#d03a15] text-white rounded-lg shadow-[0_4px_14px_0_rgba(227,66,25,0.12)] hover:shadow-[0_6px_20px_0_rgba(227,66,25,0.18)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 font-bold text-[15px] tracking-tight group"
                            >
                                <span>Next / 次へ / 다음</span>
                                <ArrowRight size={18} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform" />
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="flex justify-between items-center mb-6">
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors uppercase tracking-widest px-3 py-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-[#2a2a2a]"
                            >
                                <ArrowLeft size={12} strokeWidth={3} />
                                Change Nationality / 国籍変更 / 국가 변경
                            </button>
                            <div className="px-3 py-1 text-[10px] font-black text-[#e34219] dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-full border border-red-100 dark:border-red-800 uppercase tracking-widest">
                                Step 2/2
                            </div>
                        </div>

                        {/* User ID */}
                        <div className="space-y-1.5">
                            <label className="text-[12px] font-semibold text-[#1e293b] dark:text-gray-300 tracking-tight ml-1 block">
                                <span className="text-[#e34219]">*</span> {t.userId}
                            </label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                    <User size={18} strokeWidth={1.5} />
                                </div>
                                <input
                                    type="text"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleChange as any}
                                    required
                                    className="w-full h-12 pl-11 pr-4 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] rounded-lg outline-none focus:border-gray-400 dark:focus:border-[#555] transition-all text-sm font-medium placeholder:text-gray-300 dark:placeholder:text-gray-600 dark:text-white shadow-sm dark:shadow-none"
                                    placeholder="your_id"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label className="text-[12px] font-semibold text-[#1e293b] dark:text-gray-300 tracking-tight ml-1 block">
                                <span className="text-[#e34219]">*</span> {t.password}
                            </label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                    <Lock size={18} strokeWidth={1.5} />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange as any}
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

                        {/* Confirm Password */}
                        <div className="space-y-1.5">
                            <label className="text-[12px] font-semibold text-[#1e293b] dark:text-gray-300 tracking-tight ml-1 block">
                                <span className="text-[#e34219]">*</span> {t.confirmPassword}
                            </label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                    <Lock size={18} strokeWidth={1.5} />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange as any}
                                    required
                                    className={`w-full h-12 pl-11 pr-11 bg-white border rounded-lg outline-none transition-all text-sm font-medium placeholder:text-gray-300 tracking-widest shadow-sm ${formData.confirmPassword && formData.password !== formData.confirmPassword
                                        ? 'border-red-300 focus:border-red-400'
                                        : 'border-gray-200 focus:border-gray-400'
                                        }`}
                                    placeholder="••••••••"
                                />
                            </div>
                            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                                <p className="text-[10px] text-[#e34219] font-bold ml-1 transition-all">
                                    {t.passwordMismatch}
                                </p>
                            )}
                        </div>

                        {/* Company Name */}
                        <div className="space-y-1.5">
                            <label className="text-[12px] font-semibold text-[#1e293b] dark:text-gray-300 tracking-tight ml-1 block">
                                <span className="text-[#e34219]">*</span> {t.companyName}
                            </label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                    <Building2 size={18} strokeWidth={1.5} />
                                </div>
                                <input
                                    type="text"
                                    name="businessName"
                                    value={formData.businessName}
                                    onChange={handleChange as any}
                                    required
                                    className="w-full h-12 pl-11 pr-4 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] rounded-lg outline-none focus:border-gray-400 dark:focus:border-[#555] transition-all text-sm font-medium placeholder:text-gray-300 dark:placeholder:text-gray-600 dark:text-white shadow-sm dark:shadow-none"
                                    placeholder="Your Company Name"
                                />
                            </div>
                        </div>

                        {/* Contact Person */}
                        <div className="space-y-1.5">
                            <label className="text-[12px] font-semibold text-[#1e293b] dark:text-gray-300 tracking-tight ml-1 block">
                                <span className="text-[#e34219]">*</span> {t.contactPerson}
                            </label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                    <User size={18} strokeWidth={1.5} />
                                </div>
                                <input
                                    type="text"
                                    name="representativeName"
                                    value={formData.representativeName}
                                    onChange={handleChange as any}
                                    required
                                    className="w-full h-12 pl-11 pr-4 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] rounded-lg outline-none focus:border-gray-400 dark:focus:border-[#555] transition-all text-sm font-medium placeholder:text-gray-300 dark:placeholder:text-gray-600 dark:text-white shadow-sm dark:shadow-none"
                                    placeholder="Full Name"
                                />
                            </div>
                        </div>

                        {/* Business Reg Number */}
                        <div className="space-y-1.5">
                            <label className="text-[12px] font-semibold text-[#1e293b] dark:text-gray-300 tracking-tight ml-1 block">
                                <span className="text-[#e34219]">*</span> {t.registrationNumber}
                            </label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                    <span className="text-lg font-bold">#</span>
                                </div>
                                <input
                                    type="text"
                                    name="businessRegNumber"
                                    value={formData.businessRegNumber}
                                    onChange={handleChange as any}
                                    required
                                    className="w-full h-12 pl-11 pr-4 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] rounded-lg outline-none focus:border-gray-400 dark:focus:border-[#555] transition-all text-sm font-medium placeholder:text-gray-300 dark:placeholder:text-gray-600 dark:text-white shadow-sm dark:shadow-none"
                                    placeholder="Business Registration Number (numbers only)"
                                />
                            </div>
                        </div>

                        {/* Business Registration Document */}
                        <div className="space-y-1.5">
                            <label className="text-[12px] font-semibold text-[#1e293b] dark:text-gray-300 tracking-tight ml-1 block">
                                <span className="text-[#e34219]">*</span> 事業者登録証 / Business Registration Document / 사업자등록증
                            </label>
                            <label className="flex items-center justify-center w-full h-12 px-4 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] border-dashed rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-[#252525] focus:border-gray-400 transition-all shadow-sm dark:shadow-none">
                                <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                                    <Printer size={18} strokeWidth={1.5} />
                                    <span>
                                        {formData.businessRegistrationDocument ?
                                            'ファイル選択済み / File Selected / 파일 선택됨' :
                                            'アップロード / Upload / 업로드'
                                        }
                                    </span>
                                </div>
                                <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={handleFileChange}
                                    required
                                    className="hidden"
                                />
                            </label>
                            {formData.businessRegistrationDocument && (
                                <p className="text-[10px] text-green-600 font-bold ml-1">
                                    アップロード完了 / Upload Completed / 업로드 완료
                                </p>
                            )}
                        </div>

                        {/* Email */}
                        <div className="space-y-1.5">
                            <label className="text-[12px] font-semibold text-[#1e293b] dark:text-gray-300 tracking-tight ml-1 block">
                                <span className="text-[#e34219]">*</span> {t.email}
                            </label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                    <Mail size={18} strokeWidth={1.5} />
                                </div>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange as any}
                                    required
                                    className="w-full h-12 pl-11 pr-4 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] rounded-lg outline-none focus:border-gray-400 dark:focus:border-[#555] transition-all text-sm font-medium placeholder:text-gray-300 dark:placeholder:text-gray-600 dark:text-white shadow-sm dark:shadow-none"
                                    placeholder={t.emailPlaceholder}
                                />
                            </div>
                        </div>

                        {/* Phone & Fax Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            {/* Phone */}
                            <div className="space-y-1.5">
                                <label className="text-[12px] font-semibold text-[#1e293b] dark:text-gray-300 tracking-tight ml-1 block">
                                    <span className="text-[#e34219]">*</span> {t.phone}
                                </label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                        <Phone size={18} strokeWidth={1.5} />
                                    </div>
                                    <input
                                        type="text"
                                        name="contact"
                                        value={formData.contact}
                                        onChange={handleChange as any}
                                        required
                                        maxLength={13}
                                        className="w-full h-12 pl-11 pr-4 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] rounded-lg outline-none focus:border-gray-400 dark:focus:border-[#555] transition-all text-sm font-medium placeholder:text-gray-300 dark:placeholder:text-gray-600 dark:text-white shadow-sm dark:shadow-none"
                                        placeholder="03-1234-5678"
                                    />
                                </div>
                            </div>

                            {/* Fax */}
                            <div className="space-y-1.5">
                                <label className="text-[12px] font-semibold text-[#1e293b] dark:text-gray-300 tracking-tight ml-1 block">{t.fax}</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                        <Printer size={18} strokeWidth={1.5} />
                                    </div>
                                    <input
                                        type="text"
                                        name="fax"
                                        value={formData.fax}
                                        onChange={handleChange as any}
                                        className="w-full h-12 pl-11 pr-4 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] rounded-lg outline-none focus:border-gray-400 dark:focus:border-[#555] transition-all text-sm font-medium placeholder:text-gray-300 dark:placeholder:text-gray-600 dark:text-white shadow-sm dark:shadow-none"
                                        placeholder="(Optional)"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Address 1 */}
                        <div className="space-y-1.5">
                            <label className="text-[12px] font-semibold text-[#1e293b] dark:text-gray-300 tracking-tight ml-1 block">
                                <span className="text-[#e34219]">*</span> {t.address1}
                            </label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                    <MapPin size={18} strokeWidth={1.5} />
                                </div>
                                <input
                                    type="text"
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange as any}
                                    required
                                    className="w-full h-12 pl-11 pr-4 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] rounded-lg outline-none focus:border-gray-400 dark:focus:border-[#555] transition-all text-sm font-medium placeholder:text-gray-300 dark:placeholder:text-gray-600 dark:text-white shadow-sm dark:shadow-none"
                                    placeholder="Prefecture, City, District"
                                />
                            </div>
                        </div>

                        {/* Address 2 */}
                        <div className="space-y-1.5">
                            <label className="text-[12px] font-semibold text-[#1e293b] dark:text-gray-300 tracking-tight ml-1 block">{t.address2}</label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                    <Home size={18} strokeWidth={1.5} />
                                </div>
                                <input
                                    type="text"
                                    name="addressDetail"
                                    value={formData.addressDetail}
                                    onChange={handleChange as any}
                                    className="w-full h-12 pl-11 pr-4 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] rounded-lg outline-none focus:border-gray-400 dark:focus:border-[#555] transition-all text-sm font-medium placeholder:text-gray-300 dark:placeholder:text-gray-600 dark:text-white shadow-sm dark:shadow-none"
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
                                        <span>{t.submit}</span>
                                        <ArrowRight size={18} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform" />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}

                {/* Footer */}
                <div className="mt-8 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium tracking-wide">
                        {t.loginText} <Link href="/login" className="text-[#e34219] hover:underline font-bold ml-1">{t.loginLink}</Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
