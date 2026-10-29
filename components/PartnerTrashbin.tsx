'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, X } from 'lucide-react'
import Modal from '@/components/Modal'
import { buttonClass } from '@/components/ui/buttonClass'
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
            <button type="button" onClick={() => setIsOpen(true)} className={buttonClass('secondary')}>
                <Trash2 size={15} />
                휴지통
                <span className="text-[12px] font-bold tabular-nums text-slate-500">{deletedPartners.length}</span>
            </button>

            {isOpen && (
                <Modal labelledBy="partner-trash-title" onClose={() => { if (!isEmptying) setIsOpen(false) }} className="flex items-center justify-center bg-slate-950/50 p-4">
                    <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
                            <h2 id="partner-trash-title" className="flex items-center gap-2 text-lg font-black text-slate-900">
                                삭제된 파트너
                                <span className="text-[13px] font-bold tabular-nums text-slate-500">{deletedPartners.length}명</span>
                            </h2>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                aria-label="휴지통 닫기"
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="overflow-hidden rounded-[10px] border border-slate-200">
                                <table className="min-w-full table-auto border-collapse text-[13px]">
                                    <thead className="ux-thead">
                                        <tr>
                                            <th className="w-12 text-right">No</th>
                                            <th className="text-left">상호명</th>
                                            <th className="text-left">사업자번호</th>
                                            <th className="w-24 text-center">복구</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {deletedPartners.map((partner, index) => (
                                            <tr key={partner.id} className="transition-colors hover:bg-slate-50">
                                                <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-500">{deletedPartners.length - index}</td>
                                                <td className="px-3 py-2.5 text-left">
                                                    <div className="break-keep font-bold text-slate-800">{partner.name}</div>
                                                    <div className="text-[12px] text-slate-500">담당자 {partner.partnerProfile?.representativeName || '-'}</div>
                                                </td>
                                                <td className="px-3 py-2.5 text-left font-mono tabular-nums text-slate-600">{partner.partnerProfile?.businessRegNumber || '-'}</td>
                                                <td className="px-3 py-2.5 text-center">
                                                    <RestorePartnerButton partnerId={partner.id} size="sm" />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="break-keep text-[12px] text-slate-500">
                                휴지통을 비우면 데이터가 데이터베이스에서 영구히 삭제됩니다.
                            </p>
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setIsOpen(false)} className={buttonClass('secondary')}>
                                    닫기
                                </button>
                                <button type="button" onClick={handleEmptyTrash} disabled={isEmptying} className={buttonClass('danger')}>
                                    {isEmptying ? '비우는 중...' : '휴지통 완전히 비우기'}
                                </button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    )
}
