'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'

interface PartnerFormProps {
    initialData?: any
    trigger?: React.ReactNode
}

export default function PartnerForm({ initialData, trigger }: PartnerFormProps) {
    const router = useRouter()
    const [mounted, setMounted] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)

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
        businessRegistrationUrl: ''
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
                businessRegistrationUrl: initialData.partnerProfile?.businessRegistrationUrl || ''
            })
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
                businessRegistrationUrl: ''
            })
        }
    }, [isOpen, initialData])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const result = event.target?.result as string
            setFormData(prev => ({ ...prev, businessRegistrationUrl: result }))
        }
        reader.readAsDataURL(file)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const url = initialData ? `/api/partners/${initialData.id}` : '/api/partners'
            const method = initialData ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            })

            if (res.ok) {
                setIsOpen(false)
                router.refresh()
                if (!initialData) {
                    setFormData({ username: '', password: '', name: '', contact: '', email: '', representativeName: '', businessRegNumber: '', address: '', grade: 'C', businessRegistrationUrl: '' })
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
                            <label className="block font-medium text-gray-700 mb-1">전화번호 (Mobile)</label>
                            <input name="contact" type="text" value={formData.contact} onChange={handleChange} className="w-full px-3 py-1.5 border rounded-md text-xs" placeholder="010-0000-0000" />
                        </div>
                    </div>

                    <div>
                        <label className="block font-medium text-gray-700 mb-1">이메일 주소</label>
                        <input name="email" type="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-1.5 border rounded-md text-xs" placeholder="example@email.com" />
                    </div>

                    <div>
                        <label className="block font-medium text-gray-700 mb-1">사업자 등록 번호</label>
                        <input name="businessRegNumber" type="text" value={formData.businessRegNumber} onChange={handleChange} className="w-full px-3 py-1.5 border rounded-md text-xs" placeholder="000-00-00000" />
                    </div>

                    <div>
                        <label className="block font-medium text-gray-700 mb-1">사업자 등록증 (첨부)</label>
                        <div className="flex items-center gap-4">
                            <input
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={handleFileChange}
                                className="block w-full text-xs text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                            />
                            {formData.businessRegistrationUrl && (
                                <a
                                    href={formData.businessRegistrationUrl}
                                    download="business_registration"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md text-xs font-bold hover:bg-gray-200 transition-colors whitespace-nowrap flex items-center gap-1"
                                >
                                    <span>📄</span> 확인/다운로드
                                </a>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block font-medium text-gray-700 mb-1">배송지 주소</label>
                        <input name="address" type="text" value={formData.address} onChange={handleChange} className="w-full px-3 py-1.5 border rounded-md text-xs" placeholder="상세 주소 입력" />
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
        </>
    )
}
