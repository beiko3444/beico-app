'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import {
    User, Lock, Building2, Mail, Phone, Printer, MapPin, Home, ArrowRight, Eye, EyeOff, Globe, ArrowLeft, Check, ChevronDown, Hash, FileUp
} from 'lucide-react'
import AuthShell, { AuthField, authInput, authPrimaryClass, authSecondaryClass, useAuthLanguage, type AuthLanguage } from '../login/AuthShell'
import { buttonClass } from '@/components/ui/buttonClass'
import { selectClass } from '@/components/ui/field'
import { themedSecondary } from '@/app/order/partner-ui'

// One language at a time, chosen with the switch in AuthShell (or by the country picked in step 1).
const TRANSLATIONS = {
    ko: {
        title: '도매 계정 신청',
        intro: '승인 후 도매 주문을 시작할 수 있습니다.',
        stepsLabel: '가입 단계',
        stepCountry: '국가 선택',
        stepAccount: '계정·사업자 정보',
        nationality: '거래 국가',
        countryPlaceholder: '국가를 선택해 주세요',
        selectCountryFirst: '국가를 먼저 선택해 주세요.',
        nextButton: '다음',
        changeCountry: '국가 변경',
        sectionLogin: '1. 로그인 정보',
        sectionBusiness: '2. 사업자 정보 및 증빙',
        sectionContact: '3. 연락처 및 배송 주소',
        userId: '로그인 아이디',
        password: '비밀번호',
        confirmPassword: '비밀번호 확인',
        showPassword: '비밀번호 표시',
        hidePassword: '비밀번호 숨기기',
        companyName: '상호명',
        contactPerson: '대표자명',
        registrationNumber: '사업자등록번호',
        registrationPlaceholder: '숫자만 입력',
        document: '사업자등록증',
        chooseFile: '파일 선택 (이미지 또는 PDF)',
        fileSelected: '파일 선택됨 · 가입 신청 시 함께 전송됩니다.',
        email: '이메일',
        emailMemo: '세금계산서 발급용 이메일',
        phone: '전화번호',
        fax: '팩스 (선택)',
        address1: '기본 주소',
        address1Memo: '해당 주소지로 도매상품이 배송됩니다.',
        address1Placeholder: '도로명 주소 및 건물번호',
        address2: '상세 주소 (선택)',
        address2Placeholder: '건물명, 층, 호수',
        submit: '가입 신청',
        processing: '신청 중…',
        passwordMismatch: '비밀번호가 일치하지 않습니다.',
        successTitle: '가입 신청이 접수되었습니다',
        successMsg: '회원가입이 완료되었습니다. 관리자 승인을 기다려주세요.',
        successNote: '현재 관리자 승인 대기 중입니다. 승인 후 신청한 아이디로 로그인해 주세요.',
        errorPrefix: '등록 중 오류가 발생했습니다.',
        loginText: '이미 계정이 있으신가요?',
        loginLink: '로그인',
    },
    ja: {
        title: '業者向け会員登録',
        intro: '承認後に卸売のご注文を開始できます。',
        stepsLabel: '登録の手順',
        stepCountry: '国籍の選択',
        stepAccount: 'アカウント・事業者情報',
        nationality: '国籍',
        countryPlaceholder: '国籍を選択してください',
        selectCountryFirst: '先に国籍を選択してください。',
        nextButton: '次へ',
        changeCountry: '国籍を変更',
        sectionLogin: '1. ログイン情報',
        sectionBusiness: '2. 事業者情報・書類',
        sectionContact: '3. 連絡先・配送先',
        userId: 'ユーザーID',
        password: 'パスワード',
        confirmPassword: 'パスワードの確認',
        showPassword: 'パスワードを表示',
        hidePassword: 'パスワードを隠す',
        companyName: '商号',
        contactPerson: '担当者名',
        registrationNumber: '事業者登録番号',
        registrationPlaceholder: '数字のみ',
        document: '事業者登録証',
        chooseFile: '画像・PDFを選択',
        fileSelected: '選択済み · 申請時に送信されます。',
        email: 'メールアドレス',
        emailMemo: '税金計算書発行用メールアドレス',
        phone: '電話番号',
        fax: 'ファックス（任意）',
        address1: '住所',
        address1Memo: 'この住所に卸売商品が配送されます。',
        address1Placeholder: '都道府県・市区町村・番地',
        address2: '詳細住所（任意）',
        address2Placeholder: '建物名・部屋番号',
        submit: '登録する',
        processing: '送信中…',
        passwordMismatch: 'パスワードが一致しません。',
        successTitle: '申請を受け付けました',
        successMsg: '会員登録が完了しました。管理者の承認をお待ちください。',
        successNote: '現在、管理者の承認待ちです。承認後にログインしてください。',
        errorPrefix: '登録中にエラーが発生しました。',
        loginText: 'すでにアカウントをお持ちですか？',
        loginLink: 'ログイン',
    },
    en: {
        title: 'Wholesale registration',
        intro: 'You can place wholesale orders once your account is approved.',
        stepsLabel: 'Registration steps',
        stepCountry: 'Country',
        stepAccount: 'Account and business',
        nationality: 'Nationality',
        countryPlaceholder: 'Select your country',
        selectCountryFirst: 'Please select a nationality first.',
        nextButton: 'Next',
        changeCountry: 'Change country',
        sectionLogin: '1. Account details',
        sectionBusiness: '2. Business details',
        sectionContact: '3. Contact and delivery',
        userId: 'User ID',
        password: 'Password',
        confirmPassword: 'Confirm password',
        showPassword: 'Show password',
        hidePassword: 'Hide password',
        companyName: 'Company name',
        contactPerson: 'Contact person',
        registrationNumber: 'Business registration number',
        registrationPlaceholder: 'Numbers only',
        document: 'Business registration document',
        chooseFile: 'Choose an image or PDF',
        fileSelected: 'Selected · uploaded when you submit your application.',
        email: 'Email',
        emailMemo: 'Used for tax invoices',
        phone: 'Phone',
        fax: 'Fax (optional)',
        address1: 'Address',
        address1Memo: 'Wholesale products will be shipped to this address.',
        address1Placeholder: 'Street address, city and region',
        address2: 'Address 2 (optional)',
        address2Placeholder: 'Building, apartment or suite',
        submit: 'Register',
        processing: 'Processing…',
        passwordMismatch: 'Passwords do not match.',
        successTitle: 'Application received',
        successMsg: 'Registration complete. Please wait for admin approval.',
        successNote: 'Your account is awaiting administrator approval. Please sign in once approved.',
        errorPrefix: 'An error occurred during registration.',
        loginText: 'Already have an account?',
        loginLink: 'Log in',
    },
} satisfies Record<AuthLanguage, Record<string, string>>

// Each country in its own language, so it reads the same whatever the page language is.
const COUNTRIES = [
    { value: 'Japan', label: '🇯🇵 日本' },
    { value: 'Korea', label: '🇰🇷 한국' },
    { value: 'USA', label: '🇺🇸 United States' },
    { value: 'China', label: '🇨🇳 中国' },
    { value: 'Turkey', label: '🇹🇷 Türkiye' },
    { value: 'Indonesia', label: '🇮🇩 Indonesia' },
]

const countryLanguage = (country: string): AuthLanguage => country === 'Korea' ? 'ko' : country === 'Japan' ? 'ja' : 'en'

export default function SignupPage() {
    const [language, setLanguage] = useAuthLanguage()
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

    const t = TRANSLATIONS[language]
    const passwordMismatch = Boolean(formData.confirmPassword) && formData.password !== formData.confirmPassword

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
            setError(t.selectCountryFirst)
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
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t.errorPrefix)
        } finally {
            setLoading(false)
        }
    }

    const steps = (
        <ol aria-label={t.stepsLabel} className="mb-6 flex items-center gap-3 text-sm">
            {[t.stepCountry, t.stepAccount].map((label, index) => {
                const number = index + 1
                const done = step > number
                const current = step === number
                return (
                    <Fragment key={label}>
                        {index > 0 ? <li aria-hidden className="h-px min-w-6 flex-1 bg-[var(--border-strong)]" /> : null}
                        <li aria-current={current ? 'step' : undefined} className="flex min-w-0 items-center gap-2">
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                done
                                    ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900'
                                    : current
                                        ? 'border-2 border-brand-orange text-brand-orange-strong dark:text-[var(--brand-accent)]'
                                        : 'border-2 border-[var(--border-strong)] text-[var(--muted-foreground)]'
                            }`}>
                                {done ? <Check size={14} strokeWidth={3} aria-hidden /> : number}
                            </span>
                            <span className={`truncate font-semibold ${done || current ? '' : 'text-[var(--muted-foreground)]'}`}>{label}</span>
                        </li>
                    </Fragment>
                )
            })}
        </ol>
    )

    return (
        <AuthShell language={language} onLanguageChange={setLanguage} title={t.title} intro={t.intro}>
            {error && (
                <div role="alert" className="mb-5 rounded-lg border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-sm font-semibold text-[var(--danger)]">
                    {error}
                </div>
            )}

            {submitted ? (
                <section className="ux-panel space-y-4 p-6 text-center" role="status">
                    <h2 className="text-xl font-bold">{t.successTitle}</h2>
                    <p className="text-sm leading-7 text-[var(--muted-foreground)]">{t.successMsg}</p>
                    <p className="ux-context">{t.successNote}</p>
                    <Link href="/login" className={authPrimaryClass}>{t.loginLink}</Link>
                </section>
            ) : step === 1 ? (
                <form onSubmit={handleNextStep} className="ux-panel space-y-5 p-5 sm:p-7">
                    {steps}
                    <div className="space-y-1.5">
                        <label htmlFor="signup-country" className="block text-sm font-semibold">
                            {t.nationality}
                            <span aria-hidden className="ml-0.5 text-[var(--danger)]">*</span>
                        </label>
                        <div className="relative">
                            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">
                                <Globe size={18} strokeWidth={1.5} />
                            </span>
                            <select
                                id="signup-country"
                                name="country"
                                value={formData.country}
                                onChange={(e) => {
                                    handleChange(e)
                                    setError('')
                                    // The form follows the partner's country, as before; the switch above can still change it.
                                    if (e.target.value) setLanguage(countryLanguage(e.target.value), false)
                                }}
                                required
                                className={selectClass(Boolean(formData.country), `h-12 cursor-pointer appearance-none bg-[var(--input-bg)] pl-11 pr-11 text-base ${formData.country ? 'text-[var(--foreground)]' : ''}`)}
                            >
                                <option value="" disabled>{t.countryPlaceholder}</option>
                                {COUNTRIES.map(country => <option key={country.value} value={country.value}>{country.label}</option>)}
                            </select>
                            <ChevronDown size={16} aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
                        </div>
                    </div>

                    <button type="submit" className={authPrimaryClass}>
                        {t.nextButton}
                        <ArrowRight size={18} strokeWidth={2.5} aria-hidden />
                    </button>
                </form>
            ) : (
                <form onSubmit={handleSubmit} className="ux-panel space-y-5 p-5 sm:p-7">
                    {steps}
                    <button
                        type="button"
                        onClick={() => setStep(1)}
                        className={buttonClass('secondary', 'md', `${themedSecondary} text-[var(--muted-foreground)]`)}
                    >
                        <ArrowLeft size={14} strokeWidth={2.5} aria-hidden />
                        {t.changeCountry} · {COUNTRIES.find(country => country.value === formData.country)?.label}
                    </button>

                    <fieldset className="space-y-5"><legend className="mb-4 text-base font-bold">{t.sectionLogin}</legend>
                        <AuthField id="signup-username" label={t.userId} required icon={<User size={18} strokeWidth={1.5} />}>
                            <input
                                type="text"
                                id="signup-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false}
                                value={formData.username}
                                onChange={handleChange}
                                required
                                className={authInput()}
                            />
                        </AuthField>

                        <AuthField id="signup-password" label={t.password} required icon={<Lock size={18} strokeWidth={1.5} />}>
                            <input
                                type={showPassword ? "text" : "password"}
                                id="signup-password" name="password" autoComplete="new-password"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                className={authInput('pr-12')}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? t.hidePassword : t.showPassword} aria-pressed={showPassword}
                                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--card-hover)]"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </AuthField>

                        <AuthField
                            id="signup-confirmPassword"
                            label={t.confirmPassword}
                            required
                            icon={<Lock size={18} strokeWidth={1.5} />}
                            after={passwordMismatch ? <p id="signup-confirmPassword-error" className="text-xs font-semibold text-[var(--danger)]">{t.passwordMismatch}</p> : null}
                        >
                            <input
                                type={showPassword ? "text" : "password"}
                                id="signup-confirmPassword" name="confirmPassword" autoComplete="new-password"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                                aria-invalid={passwordMismatch}
                                aria-describedby={passwordMismatch ? 'signup-confirmPassword-error' : undefined}
                                className={authInput(passwordMismatch ? 'border-[var(--danger)]' : '')}
                            />
                        </AuthField>
                    </fieldset>

                    <fieldset className="space-y-5 border-t border-[var(--border)] pt-5"><legend className="pr-3 text-base font-bold">{t.sectionBusiness}</legend>
                        <AuthField id="signup-businessName" label={t.companyName} required icon={<Building2 size={18} strokeWidth={1.5} />}>
                            <input
                                type="text"
                                id="signup-businessName" name="businessName" autoComplete="organization"
                                value={formData.businessName}
                                onChange={handleChange}
                                required
                                className={authInput()}
                            />
                        </AuthField>

                        <AuthField id="signup-representativeName" label={t.contactPerson} required icon={<User size={18} strokeWidth={1.5} />}>
                            <input
                                type="text"
                                id="signup-representativeName" name="representativeName" autoComplete="name"
                                value={formData.representativeName}
                                onChange={handleChange}
                                required
                                className={authInput()}
                            />
                        </AuthField>

                        <AuthField id="signup-businessRegNumber" label={t.registrationNumber} required icon={<Hash size={18} strokeWidth={1.5} />}>
                            <input
                                type="text"
                                inputMode="numeric"
                                id="signup-businessRegNumber" name="businessRegNumber"
                                value={formData.businessRegNumber}
                                onChange={handleChange}
                                required
                                className={authInput('tabular-nums')}
                                placeholder={t.registrationPlaceholder}
                            />
                        </AuthField>

                        <div className="space-y-1.5">
                            <label htmlFor="signup-document" className="block text-sm font-semibold">
                                {t.document}
                                <span aria-hidden className="ml-0.5 text-[var(--danger)]">*</span>
                            </label>
                            <label className="flex h-12 w-full cursor-pointer items-center justify-center rounded-lg border border-dashed border-[var(--input-border)] bg-[var(--input-bg)] px-4 transition-colors hover:bg-[var(--card-hover)] focus-within:border-brand-orange focus-within:ring-2 focus-within:ring-brand-orange/20">
                                <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-[var(--muted-foreground)]">
                                    <FileUp size={18} strokeWidth={1.5} aria-hidden />
                                    <span className="truncate">{formData.businessRegistrationDocument ? formData.businessRegistrationDocument.name : t.chooseFile}</span>
                                </span>
                                <input
                                    id="signup-document"
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={handleFileChange}
                                    required
                                    className="sr-only"
                                />
                            </label>
                            {formData.businessRegistrationDocument && (
                                <p className="text-xs font-semibold text-[var(--success)]">{t.fileSelected}</p>
                            )}
                        </div>
                    </fieldset>

                    <fieldset className="space-y-5 border-t border-[var(--border)] pt-5"><legend className="pr-3 text-base font-bold">{t.sectionContact}</legend>
                        <AuthField id="signup-email" label={t.email} required hint={t.emailMemo} icon={<Mail size={18} strokeWidth={1.5} />}>
                            <input
                                type="email"
                                id="signup-email" name="email" autoComplete="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                aria-describedby="signup-email-hint"
                                className={authInput()}
                                placeholder="name@company.com"
                            />
                        </AuthField>

                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-3">
                            <AuthField id="signup-contact" label={t.phone} required icon={<Phone size={18} strokeWidth={1.5} />}>
                                <input
                                    type="tel"
                                    id="signup-contact" name="contact" autoComplete="tel"
                                    value={formData.contact}
                                    onChange={handleChange}
                                    required
                                    maxLength={13}
                                    className={authInput('tabular-nums')}
                                    placeholder={formData.country === 'Korea' ? '010-1234-5678' : formData.country === 'Japan' ? '03-1234-5678' : '+1 555 123 4567'}
                                />
                            </AuthField>

                            <AuthField id="signup-fax" label={t.fax} icon={<Printer size={18} strokeWidth={1.5} />}>
                                <input
                                    type="tel"
                                    id="signup-fax" name="fax"
                                    value={formData.fax}
                                    onChange={handleChange}
                                    className={authInput('tabular-nums')}
                                />
                            </AuthField>
                        </div>

                        <AuthField id="signup-address" label={t.address1} required hint={t.address1Memo} icon={<MapPin size={18} strokeWidth={1.5} />}>
                            <input
                                type="text"
                                id="signup-address" name="address" autoComplete="street-address"
                                value={formData.address}
                                onChange={handleChange}
                                required
                                aria-describedby="signup-address-hint"
                                className={authInput()}
                                placeholder={t.address1Placeholder}
                            />
                        </AuthField>

                        <AuthField id="signup-addressDetail" label={t.address2} icon={<Home size={18} strokeWidth={1.5} />}>
                            <input
                                type="text"
                                id="signup-addressDetail" name="addressDetail"
                                value={formData.addressDetail}
                                onChange={handleChange}
                                className={authInput()}
                                placeholder={t.address2Placeholder}
                            />
                        </AuthField>
                    </fieldset>

                    <button
                        type="submit"
                        disabled={loading}
                        className={authPrimaryClass}
                    >
                        {loading ? t.processing : (
                            <>
                                {t.submit}
                                <ArrowRight size={18} strokeWidth={2.5} aria-hidden />
                            </>
                        )}
                    </button>
                </form>
            )}

            {!submitted && (
                <section className="mt-6 text-center">
                    <p className="text-sm text-[var(--muted-foreground)]">{t.loginText}</p>
                    <Link href="/login" className={`${authSecondaryClass} mt-3`}>{t.loginLink}</Link>
                </section>
            )}
        </AuthShell>
    )
}
