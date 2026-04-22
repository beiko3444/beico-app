'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { getPartnerBusinessRegistrationUrl } from '@/lib/partner-business-registration-url'

interface PartnerFormProps {
    initialData?: any
    trigger?: React.ReactNode
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
                {trigger || (
                    <button className="bg-[#d9361b] text-white px-5 py-2 rounded-lg font-bold hover:brightness-110 transition-all shadow-md hover:shadow-lg text-xs">
                        ＋ 새 파트너 등록
                    </button>
                )}
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[99999] flex items-center justify-center p-4 overflow-hidden" onClick={() => setIsOpen(false)}>
            <div
                className="bg-white p-8 rounded-2xl w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[95vh] overflow-y-auto relative border border-gray-100"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                        {initialData ? '파트너 정보 수정' : '새 파트너 계정 등록'}
                    </h3>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
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
                    className="space-y-4 text-xs"
                >
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block font-medium text-gray-700 mb-1">상호명 (Business Name)</label>
                            <input name="name" type="text" value={formData.name} onChange={handleChange} className="w-full px-3 py-1.5 border rounded-md text-xs" required />
                        </div>
                        <div>
                            <label className="block font-medium text-gray-700 mb-1">담당자 명 (Representative)</label>
                            <input name="representativeName" type="text" value={formData.representativeName} onChange={handleChange} className="w-full px-3 py-1.5 border rounded-md text-xs" placeholder="성함 입력" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block font-medium text-gray-700 mb-1">로그인 아이디 (Username)</label>
                            <input name="username" type="text" value={formData.username} onChange={handleChange} className="w-full px-3 py-1.5 border rounded-md text-xs" required />
                        </div>
                        <div>
                            <label className="block font-medium text-gray-700 mb-1">비밀번호 {initialData && '(변경 시에만 입력)'}</label>
                            <input name="password" type="password" value={formData.password} onChange={handleChange} className="w-full px-3 py-1.5 border rounded-md text-xs" required={!initialData} placeholder={initialData ? '••••••••' : '비밀번호 입력'} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block font-medium text-gray-700 mb-1">파트너 등급 (Pricing Tier)</label>
                            <select name="grade" value={formData.grade} onChange={handleChange} className="w-full px-3 py-1.5 border rounded-md bg-white font-bold text-xs">
                                <option value="A">A 등급 (최적가)</option>
                                <option value="B">B 등급</option>
                                <option value="C">C 등급 (기본)</option>
                                <option value="D">D 등급</option>
                            </select>
                        </div>
                        <div>
                            <label className="block font-medium text-gray-700 mb-1">계정 권한 (Role)</label>
                            <select name="role" value={formData.role} onChange={handleChange} className="w-full px-3 py-1.5 border rounded-md bg-white font-bold text-xs">
                                <option value="PARTNER">PARTNER (일반 파트너)</option>
                                <option value="ADMIN">ADMIN (최고 관리자)</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block font-medium text-gray-700 mb-1">전화번호 (Mobile)</label>
                            <input name="contact" type="text" value={formData.contact} onChange={handleChange} className="w-full px-3 py-1.5 border rounded-md text-xs" placeholder="010-0000-0000" />
                        </div>

                        <div>
                            <label className="block font-medium text-gray-700 mb-1">이메일 주소</label>
                            <input name="email" type="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-1.5 border rounded-md text-xs" placeholder="example@email.com" />
                        </div>
                    </div>

                    {/* Move Address immediately below phone number section */}
                    <div>
                        <label className="block font-medium text-gray-700 mb-1">배송지 주소 (Address)</label>
                        <input name="address" type="text" value={formData.address} onChange={handleChange} className="w-full px-3 py-1.5 border rounded-md text-xs" placeholder="상세 주소 입력" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block font-medium text-gray-700 mb-1">국적 / Nationality</label>
                            <select name="country" value={formData.country} onChange={handleChange} className="w-full px-3 py-1.5 border rounded-md bg-white font-bold text-xs" required>
                                <option value="">국적 선택</option>
                                <option value="Japan">🇯🇵 일본 (Japan)</option>
                                <option value="Korea">🇰🇷 한국 (Korea)</option>
                                <option value="USA">🇺🇸 미국 (USA)</option>
                                <option value="China">🇨🇳 중국 (China)</option>
                                <option value="Turkey">🇹🇷 투르키예 (Türkiye)</option>
                                <option value="Indonesia">🇮🇩 印度尼西亜 (Indonesia)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block font-medium text-gray-700 mb-1">사업자 등록 번호</label>
                            <input name="businessRegNumber" type="text" value={formData.businessRegNumber} onChange={handleChange} className="w-full px-3 py-1.5 border rounded-md text-xs" placeholder="숫자만 입력 (Length irrelevant)" />
                        </div>
                    </div>

                    <div>
                        <label className="block font-medium text-gray-700 mb-1">사업자 등록증 (첨부)</label>
                        <div className="flex flex-col gap-3">
                            <input
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={handleFileChange}
                                className="block w-full text-xs text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                            />
                            {formData.businessRegistrationUrl && (
                                <div className="flex flex-col gap-2 border rounded-md p-3 bg-gray-50/50">
                                    {isDocumentImage ? (
                                        <div className="relative group cursor-pointer" onClick={() => setEnlargedImage(formData.businessRegistrationUrl)}>
                                            <img
                                                src={formData.businessRegistrationUrl}
                                                alt="사업자 등록증 미리보기"
                                                className="h-32 object-contain bg-white border border-gray-200 rounded-md transition-all group-hover:brightness-90"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="bg-black/60 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1">
                                                    <span>🔍</span> <span>클릭하여 확대</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-md">
                                            <span className="text-xl">📄</span>
                                            <span className="text-gray-600 font-medium">문서 파일이 첨부되었습니다.</span>
                                        </div>
                                    )}
                                    <div className="flex gap-2 mt-2">
                                        <a
                                            href={businessRegistrationDownloadUrl}
                                            download="사업자등록증"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md text-xs font-bold hover:bg-gray-50 transition-colors whitespace-nowrap flex items-center gap-1 shadow-sm w-fit"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <span>💾</span> 다운로드
                                        </a>
                                        {isDocumentPdf && (
                                            <a
                                                href={formData.businessRegistrationUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md text-xs font-bold hover:bg-gray-50 transition-colors whitespace-nowrap flex items-center gap-1 shadow-sm w-fit"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <span>🔗</span> 새 탭에서 열기
                                            </a>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setHasBusinessRegistrationChanged(true)
                                                setFormData(prev => ({
                                                    ...prev,
                                                    businessRegistrationUrl: '',
                                                    businessRegistrationContentType: ''
                                                }))
                                            }}
                                            className="bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-md text-xs font-bold hover:bg-red-50 transition-colors whitespace-nowrap flex items-center gap-1 shadow-sm w-fit"
                                        >
                                            <span>✕</span> 첨부 제거
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-4 border-t mt-4">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsOpen(false);
                            }}
                            className="px-4 py-2 text-gray-600 hover:text-gray-800 text-xs font-bold"
                        >
                            취소
                        </button>
                        <button type="submit" disabled={loading} className="bg-[#d9361b] text-white px-8 py-3 rounded-xl font-bold hover:brightness-110 disabled:opacity-50 transition-all text-xs shadow-lg">
                            {loading ? '저장 중...' : initialData ? '파트너 수정' : '계정 생성'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )

    return (
        <>
            <div onClick={() => setIsOpen(true)} className="inline-block">
                {trigger || (
                    <button className="bg-[#d9361b] text-white px-5 py-2 rounded-lg font-bold hover:brightness-110 transition-all shadow-md hover:shadow-lg text-xs">
                        ＋ 새 파트너 등록
                    </button>
                )}
            </div>
            {isOpen && mounted && createPortal(modalContent, document.body)}

            {/* Image Enlargement Modal */}
            {enlargedImage && mounted && createPortal(
                <div
                    className="fixed inset-0 bg-black/90 z-[999999] flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setEnlargedImage(null)}
                >
                    <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col items-center">
                        <div className="absolute top-0 right-0 -translate-y-full mb-4">
                            <button
                                onClick={() => setEnlargedImage(null)}
                                className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors backdrop-blur-md border border-white/20"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
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
