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
        email: "メールアドレス / Email",
        emailPlaceholder: "name@company.com",
        emailMemo: "(税金計算書発行用メールアドレス)",
        phone: "電話番号 / Phone",
        fax: "ファックス / Fax",
        address1: "住所 / Address",
        address1Memo: "(この住所に卸売商品が配送されます)",
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
        email: "이메일 (Email)",
        emailPlaceholder: "name@company.com",
        emailMemo: "(세금계산서 발급용 이메일)",
        phone: "전화번호 (Phone)",
        fax: "팩스 (Fax)",
        address1: "기본 주소 (Address)",
        address1Memo: "(해당 주소지로 도매상품이 배송됩니다)",
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
        email: "Email",
        emailPlaceholder: "name@company.com",
        emailMemo: "(For tax invoice issuance)",
        phone: "Phone",
        fax: "Fax",
        address1: "Address",
        address1Memo: "(Wholesale products will be shipped to this address)",
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
        <div className="min-h-screen apple-page relative overflow-hidden py-10">
            <div className="absolute inset-0 bg-[var(--surface-parchment)]" />
            <div className="absolute inset-x-0 top-0 h-[34vh] bg-white" />

            <div className="relative z-10 mx-auto flex w-full max-w-[1120px] flex-col gap-10 px-4 lg:grid lg:grid-cols-[1.05fr_500px] lg:items-start">
                <div className="px-2 pt-6 lg:sticky lg:top-16">
                    <p className="mb-4 text-[12px] uppercase tracking-[0.18em] text-[#6e6e73]">WHOLESALE REGISTRATION</p>
                    <h1 className="apple-hero-title mb-4">파트너 온보딩도 제품처럼 단정하게.</h1>
                    <p className="apple-lead max-w-[600px]">
                        가입 단계는 최소한의 장식으로 정리하고, 정보 입력과 승인 흐름만 또렷하게 남겼습니다.
                        로그인 화면과 같은 톤으로 연결되도록 표면, 버튼, 타이포를 통일했습니다.
                    </p>
                </div>

                <div className="w-full">
                    <div className="mb-5 flex items-center gap-6">
                        <div className="w-[77px] h-auto relative shrink-0">
                            <img
                                src="/logo.png"
                                alt="BEIKO BAIT"
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <div className="mt-2 flex flex-col justify-center">
                            <h1 className="mb-1 text-[28px] font-semibold tracking-[-0.03em] text-[var(--foreground)]">{t.title}</h1>
                            <p className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.32em] text-[#6e6e73]">
                                {t.subtitle}
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 rounded-[14px] border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                            {error}
                        </div>
                    )}

                    {step === 1 ? (
                        <form onSubmit={handleNextStep} className="apple-panel space-y-5 p-6 md:p-8">
                            <div className="space-y-1.5">
                                <label className="ml-1 block text-[12px] font-medium tracking-tight text-[#6e6e73]">
                                    <span className="text-[var(--primary)]">*</span> 国籍 / Nationality / 국가
                                </label>
                                <div className="relative group">
                                    <div className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[#8d8d92]">
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
                                        className="apple-input h-12 w-full cursor-pointer appearance-none pl-12 pr-10 text-[15px] font-normal"
                                    >
                                        <option value="" disabled>{t.countryPlaceholder}</option>
                                        <option value="Japan">🇯🇵 日本 / Japan / 일본</option>
                                        <option value="Korea">🇰🇷 韓国 / Korea / 한국</option>
                                        <option value="USA">🇺🇸 米国 / USA / 미국</option>
                                        <option value="China">🇨🇳 中国 / China / 중국</option>
                                        <option value="Turkey">🇹🇷 トルコ / Türkiye / 투르키예</option>
                                        <option value="Indonesia">🇮🇩 印度尼西亜 / Indonesia / 인도네시아</option>
                                    </select>
                                    <div className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-[#8d8d92]">
                                        <ArrowRight size={14} className="rotate-90" />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    className="apple-button group w-full active:scale-[0.99]"
                                >
                                    <span>{t.nextButton}</span>
                                    <ArrowRight size={18} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform" />
                                </button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handleSubmit} className="apple-panel space-y-5 p-6 md:p-8">
                            <div className="flex justify-between items-center mb-6">
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="flex items-center gap-1.5 rounded-full border border-[var(--hairline)] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[#6e6e73] transition-colors hover:text-[var(--foreground)]"
                                >
                                    <ArrowLeft size={12} strokeWidth={3} />
                                    Change Nationality / 国籍変更 / 국가 변경
                                </button>
                                <div className="rounded-full border border-[var(--hairline)] bg-[var(--surface-parchment)] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--primary)]">
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
                            <p className="ml-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                                {t.emailMemo}
                            </p>
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
                            <p className="ml-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                                {t.address1Memo}
                            </p>
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

                <div className="mt-8 text-center">
                    <p className="text-xs font-medium tracking-wide text-[#6e6e73]">
                        {t.loginText} <Link href="/login" className="ml-1 font-medium text-[var(--primary)] hover:underline">{t.loginLink}</Link>
                    </p>
                </div>
            </div>
            </div>
        </div>
    )
}
