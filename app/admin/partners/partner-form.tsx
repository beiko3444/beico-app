'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { Download, ExternalLink, FileText, Plus, X, ZoomIn } from 'lucide-react'
import { getPartnerBusinessRegistrationUrl } from '@/lib/partner-business-registration-url'
import Button, { buttonClass } from '@/components/ui/Button'

interface PartnerFormProps {
    initialData?: any
    trigger?: React.ReactNode
}

const inputClass =
    'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 transition ' +
    'focus:border-brand-orange focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40'
const labelClass = 'mb-1.5 block text-[12px] font-bold text-slate-600'

function TriggerButton() {
    return (
        <button type="button" className={buttonClass('primary', 'md')}>
            <Plus size={15} />
            새 파트너 등록
        </button>
    )
}

export default function PartnerForm({ initialData, trigger }: PartnerFormProps) {
    const router = useRouter()
    const [mounted, setMounted] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [enlargedImage, setEnlargedImage] = useState<string | null>(null)
    const [hasBusinessRegistrationChanged, setHasBusinessRegistrationChanged] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const [formData, setFormData] = useState({
        username: '',
        password: '',
        name: '',
        contact: '',
        email: '',
        representativeName: '',
        businessRegNumber: '',
        address: '',
        grade: 'C',
        role: 'PARTNER',
        country: '',
        businessRegistrationUrl: '',
        businessRegistrationContentType: ''
    })

    useEffect(() => {
        if (isOpen && initialData) {
            setFormData({
                username: initialData.username || '',
                password: '', // Don't populate password
                name: initialData.name || '',
                contact: initialData.partnerProfile?.contact || '',
                email: initialData.partnerProfile?.email || '',
                representativeName: initialData.partnerProfile?.representativeName || '',
                businessRegNumber: initialData.partnerProfile?.businessRegNumber || '',
                address: initialData.partnerProfile?.address || '',
                grade: initialData.partnerProfile?.grade || 'C',
                role: initialData.role || 'PARTNER',
                country: initialData.country || '',
                businessRegistrationUrl: initialData.partnerProfile?.businessRegistrationUrl || '',
                businessRegistrationContentType: initialData.partnerProfile?.businessRegistrationContentType || ''
            })
            setHasBusinessRegistrationChanged(false)
        } else if (isOpen && !initialData) {
            setFormData({
                username: '',
                password: '',
                name: '',
                contact: '',
                email: '',
                representativeName: '',
                businessRegNumber: '',
                address: '',
                grade: 'C',
                role: 'PARTNER',
                country: '',
                businessRegistrationUrl: '',
                businessRegistrationContentType: ''
            })
            setHasBusinessRegistrationChanged(false)
        }
    }, [isOpen, initialData])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        let finalValue = value;
        if (name === 'businessRegNumber') {
            finalValue = value.replace(/[^\d]/g, '');
        }
        setFormData(prev => ({ ...prev, [name]: finalValue }))
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const result = event.target?.result as string
            setFormData(prev => ({
                ...prev,
                businessRegistrationUrl: result,
                businessRegistrationContentType: file.type || (result.match(/^data:([^;]+)/)?.[1] || '')
            }))
            setHasBusinessRegistrationChanged(true)
        }
        reader.readAsDataURL(file)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const url = initialData ? `/api/partners/${initialData.id}` : '/api/partners'
            const method = initialData ? 'PUT' : 'POST'

            const payload: Record<string, unknown> = {
                username: formData.username,
                password: formData.password,
                name: formData.name,
                contact: formData.contact,
                email: formData.email,
                representativeName: formData.representativeName,
                businessRegNumber: formData.businessRegNumber,
                address: formData.address,
                grade: formData.grade,
                role: formData.role,
                country: formData.country,
            }

            if (!initialData || hasBusinessRegistrationChanged) {
                payload.businessRegistrationUrl = formData.businessRegistrationUrl || null
            } else if (initialData && !formData.businessRegistrationUrl) {
                delete payload.businessRegistrationUrl
            }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (res.ok) {
                setIsOpen(false)
                router.refresh()
                if (!initialData) {
                    setFormData({
                        username: '',
                        password: '',
                        name: '',
                        contact: '',
                        email: '',
                        representativeName: '',
                        businessRegNumber: '',
                        address: '',
                        grade: 'C',
                        role: 'PARTNER',
                        country: '',
                        businessRegistrationUrl: '',
                        businessRegistrationContentType: ''
                    })
                    setHasBusinessRegistrationChanged(false)
                }
            } else {
                const data = await res.json()
                alert(`오류: ${data.message || '파트너 정보를 저장하지 못했습니다.'}`)
            }
        } catch (error) {
            console.error(error)
            alert('오류가 발생했습니다. 연결 상태를 확인해주세요.')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) {
        return (
            <div onClick={() => setIsOpen(true)} className="inline-block">
                {trigger || <TriggerButton />}
            </div>
        )
    }

    const documentContentType = formData.businessRegistrationContentType
    const isDocumentImage =
        documentContentType.startsWith('image/') ||
        formData.businessRegistrationUrl.startsWith('data:image') ||
        formData.businessRegistrationUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i)

    const isDocumentPdf =
        documentContentType === 'application/pdf' ||
        formData.businessRegistrationUrl.startsWith('data:application/pdf') ||
        formData.businessRegistrationUrl.match(/\.pdf$/i)

    const businessRegistrationDownloadUrl =
        initialData && !hasBusinessRegistrationChanged && formData.businessRegistrationUrl
            ? getPartnerBusinessRegistrationUrl(initialData.id, initialData.updatedAt, { download: true })
            : formData.businessRegistrationUrl

    const modalContent = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-slate-950/55 p-4 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
            <div
                className="relative flex max-h-[95vh] w-full min-w-0 max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <h3 className="text-[20px] font-black tracking-tight text-slate-900">
                        {initialData ? '파트너 정보 수정' : '새 파트너 계정 등록'}
                    </h3>
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        aria-label="닫기"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <form
                    onSubmit={handleSubmit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            const target = e.target as HTMLElement;
                            if (target.tagName === 'INPUT' || target.tagName === 'SELECT') {
                                e.preventDefault();
                                handleSubmit(e as any);
                            }
                        }
                    }}
                    className="min-w-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 text-xs sm:px-6"
                >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className={labelClass}>상호명</label>
                            <input name="name" type="text" value={formData.name} onChange={handleChange} className={inputClass} required />
                        </div>
                        <div>
                            <label className={labelClass}>담당자명</label>
                            <input name="representativeName" type="text" value={formData.representativeName} onChange={handleChange} className={inputClass} placeholder="성함 입력" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className={labelClass}>로그인 아이디</label>
                            <input name="username" type="text" value={formData.username} onChange={handleChange} className={inputClass} required />
                        </div>
                        <div>
                            <label className={labelClass}>비밀번호 {initialData && '(변경 시에만 입력)'}</label>
                            <input name="password" type="password" value={formData.password} onChange={handleChange} className={inputClass} required={!initialData} placeholder={initialData ? '••••••••' : '비밀번호 입력'} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className={labelClass}>파트너 등급</label>
                            <select name="grade" value={formData.grade} onChange={handleChange} className={`${inputClass} font-bold`}>
                                <option value="A">A 등급 (최적가)</option>
                                <option value="B">B 등급</option>
                                <option value="C">C 등급 (기본)</option>
                                <option value="D">D 등급</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>계정 권한</label>
                            <select name="role" value={formData.role} onChange={handleChange} className={`${inputClass} font-bold`}>
                                <option value="PARTNER">일반 파트너</option>
                                <option value="ADMIN">최고 관리자</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className={labelClass}>전화번호</label>
                            <input name="contact" type="text" value={formData.contact} onChange={handleChange} className={inputClass} placeholder="010-0000-0000" />
                        </div>

                        <div>
                            <label className={labelClass}>이메일 주소</label>
                            <input name="email" type="email" value={formData.email} onChange={handleChange} className={inputClass} placeholder="example@email.com" />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>배송지 주소</label>
                        <input name="address" type="text" value={formData.address} onChange={handleChange} className={inputClass} placeholder="상세 주소 입력" />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className={labelClass}>국적</label>
                            <select name="country" value={formData.country} onChange={handleChange} className={`${inputClass} font-bold`} required>
                                <option value="">국적 선택</option>
                                <option value="Japan">일본</option>
                                <option value="Korea">한국</option>
                                <option value="USA">미국</option>
                                <option value="China">중국</option>
                                <option value="Turkey">투르키예</option>
                                <option value="Indonesia">인도네시아</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>사업자 등록 번호</label>
                            <input name="businessRegNumber" type="text" value={formData.businessRegNumber} onChange={handleChange} className={inputClass} placeholder="숫자만 입력" />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>사업자 등록증 (첨부)</label>
                        <div className="flex flex-col gap-3">
                            <input
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={handleFileChange}
                                className="block w-full text-xs text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-orange-soft file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-brand-orange hover:file:bg-orange-100"
                            />
                            {formData.businessRegistrationUrl && (
                                <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                                    {isDocumentImage ? (
                                        <div className="group relative cursor-pointer" onClick={() => setEnlargedImage(formData.businessRegistrationUrl)}>
                                            <img
                                                src={formData.businessRegistrationUrl}
                                                alt="사업자 등록증 미리보기"
                                                className="h-32 rounded-xl border border-slate-200 bg-white object-contain transition-all group-hover:brightness-90"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                                                <div className="flex items-center gap-1.5 rounded-full bg-brand-ink/80 px-3 py-1.5 text-xs font-bold text-white">
                                                    <ZoomIn size={14} /> <span>클릭하여 확대</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
                                            <FileText size={18} className="shrink-0 text-slate-500" />
                                            <span className="font-medium text-slate-600">문서 파일이 첨부되었습니다.</span>
                                        </div>
                                    )}
                                    <div className="mt-1 flex flex-wrap gap-2">
                                        <a
                                            href={businessRegistrationDownloadUrl}
                                            download="사업자등록증"
                                            target="_blank"
                                            rel="noreferrer"
                                            className={buttonClass('secondary', 'sm')}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Download size={13} /> 다운로드
                                        </a>
                                        {isDocumentPdf && (
                                            <a
                                                href={formData.businessRegistrationUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className={buttonClass('secondary', 'sm')}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <ExternalLink size={13} /> 새 탭에서 열기
                                            </a>
                                        )}
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            icon={<X size={13} />}
                                            onClick={() => {
                                                setHasBusinessRegistrationChanged(true)
                                                setFormData(prev => ({
                                                    ...prev,
                                                    businessRegistrationUrl: '',
                                                    businessRegistrationContentType: ''
                                                }))
                                            }}
                                        >
                                            첨부 제거
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
                        <Button
                            variant="secondary"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsOpen(false);
                            }}
                        >
                            취소
                        </Button>
                        <Button type="submit" variant="primary" loading={loading}>
                            {loading ? '저장 중...' : initialData ? '파트너 수정' : '계정 생성'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )

    return (
        <>
            <div onClick={() => setIsOpen(true)} className="inline-block">
                {trigger || <TriggerButton />}
            </div>
            {isOpen && mounted && createPortal(modalContent, document.body)}

            {/* Image Enlargement Modal */}
            {enlargedImage && mounted && createPortal(
                <div
                    className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setEnlargedImage(null)}
                >
                    <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col items-center">
                        <div className="absolute right-0 top-0 mb-4 -translate-y-full">
                            <button
                                type="button"
                                onClick={() => setEnlargedImage(null)}
                                aria-label="닫기"
                                className="rounded-full border border-white/20 bg-white/10 p-2 text-white backdrop-blur-md transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        <img
                            src={enlargedImage}
                            alt="사업자 등록증 확대"
                            className="w-auto h-auto max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/20"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div className="mt-6 text-white/70 text-sm font-medium">
                            아무 곳이나 클릭하여 닫기
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}
