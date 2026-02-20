'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import RestorePartnerButton from './RestorePartnerButton'

export default function PartnerTrashbin({ deletedPartners }: { deletedPartners: any[] }) {
    const [isOpen, setIsOpen] = useState(false)
    const [isEmptying, setIsEmptying] = useState(false)
    const router = useRouter()

    if (deletedPartners.length === 0) return null

    const handleEmptyTrash = async () => {
        if (!confirm('휴지통을 정말 비우시겠습니까? 이 작업은 영구적이며 데이터를 복구할 수 없습니다.')) return
        setIsEmptying(true)
        try {
            const res = await fetch('/api/partners/empty-trash', {
                method: 'DELETE'
            })
            if (res.ok) {
                setIsOpen(false)
                router.refresh()
            } else {
                alert('휴지통 비우기에 실패했습니다.')
            }
        } catch (error) {
            console.error(error)
            alert('오류가 발생했습니다.')
        } finally {
            setIsEmptying(false)
        }
    }

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-bold text-sm tracking-tight transition-colors border border-red-100"
            >
                <span>🗑️ 휴지통</span>
                <span className="bg-white text-red-600 px-1.5 py-0.5 rounded-md text-[10px]">{deletedPartners.length}</span>
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-red-50/30">
                            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <span>🗑️ 삭제된 파트너 휴지통</span>
                                <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-xs">{deletedPartners.length}명</span>
                            </h2>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="overflow-y-auto p-4 flex-1">
                            <div className="border border-red-100 rounded-xl overflow-hidden">
                                <table className="table-auto min-w-full border-collapse text-xs">
                                    <thead className="bg-red-50 text-red-800 h-8">
                                        <tr>
                                            <th className="px-3 py-2 text-center font-bold whitespace-nowrap w-12 border-b border-red-100">No</th>
                                            <th className="px-3 py-2 text-left font-bold whitespace-nowrap border-b border-red-100">상호명</th>
                                            <th className="px-3 py-2 text-center font-bold whitespace-nowrap border-b border-red-100">사업자번호</th>
                                            <th className="px-3 py-2 text-center font-bold whitespace-nowrap w-24 border-b border-red-100">복구</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-red-50">
                                        {deletedPartners.map((partner, index) => (
                                            <tr key={partner.id} className="hover:bg-red-50/50 transition-colors">
                                                <td className="px-3 py-2.5 text-center text-red-400 font-bold">{deletedPartners.length - index}</td>
                                                <td className="px-3 py-2.5 text-left">
                                                    <div className="font-bold text-gray-700">{partner.name}</div>
                                                    <div className="text-[10px] text-gray-400">담당자: {partner.partnerProfile?.representativeName || '-'}</div>
                                                </td>
                                                <td className="px-3 py-2.5 text-center text-gray-500 font-mono tracking-tight">{partner.partnerProfile?.businessRegNumber || '-'}</td>
                                                <td className="px-3 py-2.5 text-center">
                                                    <RestorePartnerButton partnerId={partner.id} size="sm" />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                            <p className="text-xs text-gray-500">
                                휴지통을 비우면 데이터가 데이터베이스에서 영구히 삭제됩니다.
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="px-4 py-2 text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg font-medium text-sm transition-colors"
                                >
                                    닫기
                                </button>
                                <button
                                    onClick={handleEmptyTrash}
                                    disabled={isEmptying}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isEmptying ? '비우는 중...' : '휴지통 완전히 비우기'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
