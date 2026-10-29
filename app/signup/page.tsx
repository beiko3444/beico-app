'use client'

import { useState } from 'react'
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
    const [submitted, setSubmitted] = useState(false)
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

            setSubmitted(true)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="min-h-screen bg-[var(--background)] px-4 py-8 text-[var(--foreground)] sm:px-6">
            <div className="mx-auto mb-6 w-full max-w-[560px]">
                <div className="flex items-center gap-4">
                    <div className="h-auto w-[72px] shrink-0">
                        <img
                            src="/logo.png"
                            alt="BEIKO BAIT"
                            className="w-full h-full object-contain"
                        />
                    </div>
                    <div className="flex min-w-0 flex-col justify-center">
                        <h1 className="text-xl font-black text-[var(--foreground)]">{t.title}</h1>
                        <p className="mt-1 text-xs font-semibold text-[var(--muted-foreground)]">
                            {t.subtitle}
                        </p>
                    </div>
                </div>
            </div>

            <div className="mx-auto w-full max-w-[560px]">
                {error && (
                    <div role="alert" className="mb-5 rounded-md border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-sm font-semibold text-[var(--danger)]">
                        {error}
                    </div>
                )}

                {submitted ? (
                    <section className="ux-panel space-y-4 p-6 text-center" role="status">
                        <h2 className="text-xl font-bold">{formData.country === 'Korea' ? '가입 신청이 접수되었습니다' : formData.country === 'Japan' ? '申請を受け付けました' : 'Application received'}</h2>
                        <p className="text-sm leading-7 text-[var(--muted-foreground)]">{t.successMsg}</p>
                        <p className="ux-context">{formData.country === 'Korea' ? '현재 관리자 승인 대기 중입니다. 승인 후 신청한 아이디로 로그인해 주세요.' : formData.country === 'Japan' ? '現在、管理者の承認待ちです。承認後にログインしてください。' : 'Your account is awaiting administrator approval. Please sign in once approved.'}</p>
                        <Link href="/login" className="ux-button-primary w-full">{t.loginLink}</Link>
                    </section>
                ) : step === 1 ? (
                    <form onSubmit={handleNextStep} className="ux-panel space-y-5 p-5 sm:p-7">
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
                                className="ux-button ux-button-primary h-12 w-full text-[15px]"
                            >
                                <span>Next / 次へ / 다음</span>
                                <ArrowRight size={18} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform" />
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleSubmit} className="ux-panel space-y-5 p-5 sm:p-7">
                        <div className="flex justify-between items-center mb-6">
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="ux-button min-h-10 border border-[var(--border)] bg-[var(--card)] px-3 text-[11px] text-[var(--muted-foreground)] hover:bg-[var(--card-hover)]"
                            >
                                <ArrowLeft size={12} strokeWidth={3} />
                                Change Nationality / 国籍変更 / 국가 변경
                            </button>
                            <div className="rounded-md border border-[var(--danger-border)] bg-[var(--danger-soft)] px-3 py-1 text-[10px] font-black text-[var(--danger)]">
                                Step 2/2
                            </div>
                        </div>

                        <fieldset className="space-y-5"><legend className="mb-4 text-base font-bold">{formData.country === 'Korea' ? '1. 로그인 정보' : formData.country === 'Japan' ? '1. ログイン情報' : '1. Account details'}</legend>
                        {/* User ID */}
                        <div className="space-y-1.5">
                            <label htmlFor="signup-username" className="text-[12px] font-semibold text-[#1e293b] dark:text-gray-300 tracking-tight ml-1 block">
                                <span className="text-[#e34219]">*</span> {t.userId}
                            </label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                    <User size={18} strokeWidth={1.5} />
                                </div>
                                <input
                                    type="text"
                                    id="signup-username" name="username" autoComplete="username" autoCapitalize="none"
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
                            <label htmlFor="signup-password" className="text-[12px] font-semibold text-[#1e293b] dark:text-gray-300 tracking-tight ml-1 block">
                                <span className="text-[#e34219]">*</span> {t.password}
                            </label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                    <Lock size={18} strokeWidth={1.5} />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    id="signup-password" name="password" autoComplete="new-password"
                                    value={formData.password}
                                    onChange={handleChange as any}
                                    required
                                    className="w-full h-12 pl-11 pr-11 bg-white border border-gray-200 rounded-lg outline-none focus:border-gray-400 transition-all text-sm font-medium placeholder:text-gray-300 tracking-widest shadow-sm"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? 'Hide password / 비밀번호 숨기기' : 'Show password / 비밀번호 표시'} aria-pressed={showPassword}
                                    className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-50"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div className="space-y-1.5">
                            <label htmlFor="signup-confirmPassword" className="text-[12px] font-semibold text-[#1e293b] dark:text-gray-300 tracking-tight ml-1 block">
                                <span className="text-[#e34219]">*</span> {t.confirmPassword}
                            </label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                    <Lock size={18} strokeWidth={1.5} />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    id="signup-confirmPassword" name="confirmPassword" autoComplete="new-password"
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

                        </fieldset>
                        <fieldset className="space-y-5 border-t border-[var(--border)] pt-5"><legend className="pr-3 text-base font-bold">{formData.country === 'Korea' ? '2. 사업자 정보 및 증빙' : formData.country === 'Japan' ? '2. 事業者情報・書類' : '2. Business details'}</legend>
                        {/* Company Name */}
                        <div className="space-y-1.5">
                            <label htmlFor="signup-businessName" className="text-[12px] font-semibold text-[#1e293b] dark:text-gray-300 tracking-tight ml-1 block">
                                <span className="text-[#e34219]">*</span> {t.companyName}
                            </label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                    <Building2 size={18} strokeWidth={1.5} />
                                </div>
                                <input
                                    type="text"
                                    id="signup-businessName" name="businessName"
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
                            <label htmlFor="signup-representativeName" className="text-[12px] font-semibold text-[#1e293b] dark:text-gray-300 tracking-tight ml-1 block">
                                <span className="text-[#e34219]">*</span> {t.contactPerson}
                            </label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                    <User size={18} strokeWidth={1.5} />
                                </div>
                                <input
                                    type="text"
                                    id="signup-representativeName" name="representativeName"
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
                            <label htmlFor="signup-businessRegNumber" className="text-[12px] font-semibold text-[#1e293b] dark:text-gray-300 tracking-tight ml-1 block">
                                <span className="text-[#e34219]">*</span> {t.registrationNumber}
                            </label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                    <span className="text-lg font-bold">#</span>
                                </div>
                                <input
                                    type="text"
                                    id="signup-businessRegNumber" name="businessRegNumber"
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
                                <span className="text-[#e34219]">*</span> {formData.country === 'Korea' ? '사업자등록증' : formData.country === 'Japan' ? '事業者登録証' : 'Business registration document'}
                            </label>
                            <label className="flex items-center justify-center w-full h-12 px-4 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] border-dashed rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-[#252525] focus:border-gray-400 transition-all shadow-sm dark:shadow-none">
                                <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                                    <Printer size={18} strokeWidth={1.5} />
                                    <span>
                                        {formData.businessRegistrationDocument ?
                                            formData.businessRegistrationDocument.name :
                                            (formData.country === 'Korea' ? '파일 선택 (이미지 또는 PDF)' : formData.country === 'Japan' ? '画像・PDFを選択' : 'Choose an image or PDF')
                                        }
                                    </span>
                                </div>
                                <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={handleFileChange}
                                    required
                                    className="sr-only"
                                />
                            </label>
                            {formData.businessRegistrationDocument && (
                                <p className="text-[10px] text-green-600 font-bold ml-1">
                                    {formData.country === 'Korea' ? '파일 선택됨 · 가입 신청 시 함께 전송됩니다.' : formData.country === 'Japan' ? '選択済み · 申請時に送信されます。' : 'Selected · uploaded when you submit your application.'}
                                </p>
                            )}
                        </div>

                        </fieldset>
                        <fieldset className="space-y-5 border-t border-[var(--border)] pt-5"><legend className="pr-3 text-base font-bold">{formData.country === 'Korea' ? '3. 연락처 및 배송 주소' : formData.country === 'Japan' ? '3. 連絡先・配送先' : '3. Contact and delivery'}</legend>
                        {/* Email */}
                        <div className="space-y-1.5">
                            <label htmlFor="signup-email" className="text-[12px] font-semibold text-[#1e293b] dark:text-gray-300 tracking-tight ml-1 block">
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
                                    id="signup-email" name="email"
                                    value={formData.email}
                                    onChange={handleChange as any}
                                    required
                                    className="w-full h-12 pl-11 pr-4 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] rounded-lg outline-none focus:border-gray-400 dark:focus:border-[#555] transition-all text-sm font-medium placeholder:text-gray-300 dark:placeholder:text-gray-600 dark:text-white shadow-sm dark:shadow-none"
                                    placeholder={t.emailPlaceholder}
                                />
                            </div>
                        </div>

                        {/* Phone & Fax Grid */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {/* Phone */}
                            <div className="space-y-1.5">
                                <label htmlFor="signup-contact" className="text-[12px] font-semibold text-[#1e293b] dark:text-gray-300 tracking-tight ml-1 block">
                                    <span className="text-[#e34219]">*</span> {t.phone}
                                </label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                        <Phone size={18} strokeWidth={1.5} />
                                    </div>
                                    <input
                                        type="text"
                                        id="signup-contact" name="contact"
                                        value={formData.contact}
                                        onChange={handleChange as any}
                                        required
                                        maxLength={13}
                                        className="w-full h-12 pl-11 pr-4 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] rounded-lg outline-none focus:border-gray-400 dark:focus:border-[#555] transition-all text-sm font-medium placeholder:text-gray-300 dark:placeholder:text-gray-600 dark:text-white shadow-sm dark:shadow-none"
                                        placeholder={formData.country === 'Korea' ? '010-1234-5678' : formData.country === 'Japan' ? '03-1234-5678' : '+1 555 123 4567'}
                                    />
                                </div>
                            </div>

                            {/* Fax */}
                            <div className="space-y-1.5">
                                <label htmlFor="signup-fax" className="text-[12px] font-semibold text-[#1e293b] dark:text-gray-300 tracking-tight ml-1 block">{t.fax}</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                        <Printer size={18} strokeWidth={1.5} />
                                    </div>
                                    <input
                                        type="text"
                                        id="signup-fax" name="fax"
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
                            <label htmlFor="signup-address" className="text-[12px] font-semibold text-[#1e293b] dark:text-gray-300 tracking-tight ml-1 block">
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
                                    id="signup-address" name="address"
                                    value={formData.address}
                                    onChange={handleChange as any}
                                    required
                                    className="w-full h-12 pl-11 pr-4 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] rounded-lg outline-none focus:border-gray-400 dark:focus:border-[#555] transition-all text-sm font-medium placeholder:text-gray-300 dark:placeholder:text-gray-600 dark:text-white shadow-sm dark:shadow-none"
                                    placeholder={formData.country === 'Korea' ? '도로명 주소 및 건물번호' : formData.country === 'Japan' ? '都道府県・市区町村・番地' : 'Street address, city and region'}
                                />
                            </div>
                        </div>

                        {/* Address 2 */}
                        <div className="space-y-1.5">
                            <label htmlFor="signup-addressDetail" className="text-[12px] font-semibold text-[#1e293b] dark:text-gray-300 tracking-tight ml-1 block">{t.address2}</label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                    <Home size={18} strokeWidth={1.5} />
                                </div>
                                <input
                                    type="text"
                                    id="signup-addressDetail" name="addressDetail"
                                    value={formData.addressDetail}
                                    onChange={handleChange as any}
                                    className="w-full h-12 pl-11 pr-4 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] rounded-lg outline-none focus:border-gray-400 dark:focus:border-[#555] transition-all text-sm font-medium placeholder:text-gray-300 dark:placeholder:text-gray-600 dark:text-white shadow-sm dark:shadow-none"
                                    placeholder={formData.country === 'Korea' ? '건물명, 층, 호수 (선택)' : formData.country === 'Japan' ? '建物名・部屋番号' : 'Building, apartment or suite'}
                                />
                            </div>
                        </div>

                        </fieldset>
                        {/* Submit Button */}
                        <div className="pt-6">
                            <button
                                type="submit"
                                disabled={loading}
                                className="ux-button ux-button-primary h-12 w-full text-[15px] disabled:opacity-70"
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
                <div className="mt-6 text-center">
                    <p className="text-xs font-medium text-[var(--muted-foreground)]">
                        {t.loginText} <Link href="/login" className="text-[#e34219] hover:underline font-bold ml-1">{t.loginLink}</Link>
                    </p>
                </div>
            </div>
        </main>
    )
}
