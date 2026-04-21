'use client'

import { useState } from 'react'
import { Package, Search, Plus, Truck, Box, Calendar, Loader2, ChevronDown, X } from 'lucide-react'

type WarehousingItem = {
    slipNo: string
    ordDt: string
    inWay: string
    wrkStat: string
    wrkStatNm?: string
    parcelComp?: string
    parcelInvoiceNo?: string
    godCds?: any[]
    cstSupCd?: string
    memo?: string
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
    '1': { label: '입고요청', color: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800' },
    '2': { label: '검수중', color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' },
    '3': { label: '검수완료', color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800' },
    '4': { label: '입고완료', color: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' },
    '5': { label: '입고취소', color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' },
}

const IN_WAY_MAP: Record<string, string> = {
    '01': '택배',
    '02': '차량',
}

function formatDate(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function WarehousingPage() {
    const now = new Date()
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [startDate, setStartDate] = useState(formatDate(thirtyDaysAgo))
    const [endDate, setEndDate] = useState(formatDate(now))
    const [items, setItems] = useState<WarehousingItem[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [creating, setCreating] = useState(false)
    const [formData, setFormData] = useState({
        inWay: '01',
        ordDt: formatDate(now),
        parcelComp: '',
        parcelInvoiceNo: '',
        memo: '',
        godCds: [{ cstGodCd: '', ordQty: '1' }],
    })

    async function handleSearch() {
        setLoading(true)
        setError('')
        try {
            const res = await fetch(`/api/admin/fassto/warehousing?start=${startDate}&end=${endDate}`)
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || '조회 실패')
            setItems(json.data || [])
        } catch (e: any) {
            setError(e.message)
            setItems([])
        } finally {
            setLoading(false)
        }
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault()
        setCreating(true)
        setError('')
        try {
            const payload = {
                inWay: formData.inWay,
                ordDt: formData.ordDt,
                parcelComp: formData.parcelComp || undefined,
                parcelInvoiceNo: formData.parcelInvoiceNo || undefined,
                memo: formData.memo || undefined,
                godCds: formData.godCds
                    .filter(g => g.cstGodCd.trim())
                    .map(g => ({ cstGodCd: g.cstGodCd, ordQty: parseInt(g.ordQty) || 1 })),
            }
            if (payload.godCds.length === 0) {
                setError('상품을 1개 이상 입력해주세요.')
                setCreating(false)
                return
            }
            const res = await fetch('/api/admin/fassto/warehousing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || '입고 등록 실패')
            alert('입고 요청이 등록되었습니다.')
            setShowForm(false)
            setFormData({
                inWay: '01', ordDt: formatDate(now), parcelComp: '', parcelInvoiceNo: '', memo: '',
                godCds: [{ cstGodCd: '', ordQty: '1' }],
            })
            handleSearch()
        } catch (e: any) {
            setError(e.message)
        } finally {
            setCreating(false)
        }
    }

    function addGodRow() {
        setFormData(prev => ({ ...prev, godCds: [...prev.godCds, { cstGodCd: '', ordQty: '1' }] }))
    }

    function removeGodRow(idx: number) {
        setFormData(prev => ({ ...prev, godCds: prev.godCds.filter((_, i) => i !== idx) }))
    }

    function updateGod(idx: number, field: 'cstGodCd' | 'ordQty', value: string) {
        setFormData(prev => ({
            ...prev,
            godCds: prev.godCds.map((g, i) => i === idx ? { ...g, [field]: value } : g),
        }))
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-orange-50 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                        <Package size={18} className="text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">입고하기</h1>
                        <p className="text-[11px] text-gray-400 font-medium">FASSTO 물류센터 입고 관리</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#d9361b] text-white rounded-lg text-xs font-bold hover:bg-[#c0301a] transition-colors"
                >
                    <Plus size={14} />
                    입고 등록
                </button>
            </div>

            {/* Create form */}
            {showForm && (
                <form onSubmit={handleCreate} className="bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-[#2a2a2a] rounded-xl p-5 space-y-4">
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Truck size={16} />
                        입고 등록
                    </h2>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400">입고방법</label>
                            <select
                                value={formData.inWay}
                                onChange={e => setFormData(p => ({ ...p, inWay: e.target.value }))}
                                className="w-full h-9 px-3 text-xs bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg outline-none dark:text-white"
                            >
                                <option value="01">택배</option>
                                <option value="02">차량</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400">요청일자</label>
                            <input
                                type="date"
                                value={formData.ordDt}
                                onChange={e => setFormData(p => ({ ...p, ordDt: e.target.value }))}
                                className="w-full h-9 px-3 text-xs bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg outline-none dark:text-white"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400">택배사</label>
                            <input
                                type="text"
                                value={formData.parcelComp}
                                onChange={e => setFormData(p => ({ ...p, parcelComp: e.target.value }))}
                                placeholder="택배사명"
                                className="w-full h-9 px-3 text-xs bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg outline-none dark:text-white placeholder:text-gray-300"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400">송장번호</label>
                            <input
                                type="text"
                                value={formData.parcelInvoiceNo}
                                onChange={e => setFormData(p => ({ ...p, parcelInvoiceNo: e.target.value }))}
                                placeholder="송장번호"
                                className="w-full h-9 px-3 text-xs bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg outline-none dark:text-white placeholder:text-gray-300"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400">메모</label>
                        <input
                            type="text"
                            value={formData.memo}
                            onChange={e => setFormData(p => ({ ...p, memo: e.target.value }))}
                            placeholder="메모 (선택)"
                            className="w-full h-9 px-3 text-xs bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg outline-none dark:text-white placeholder:text-gray-300"
                        />
                    </div>

                    {/* 상품 목록 */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400">입고 상품</label>
                            <button type="button" onClick={addGodRow} className="text-[11px] font-bold text-blue-600 hover:text-blue-800">
                                + 상품 추가
                            </button>
                        </div>
                        {formData.godCds.map((g, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={g.cstGodCd}
                                    onChange={e => updateGod(idx, 'cstGodCd', e.target.value)}
                                    placeholder="상품코드 (cstGodCd)"
                                    className="flex-1 h-9 px-3 text-xs bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg outline-none dark:text-white placeholder:text-gray-300"
                                />
                                <input
                                    type="number"
                                    min="1"
                                    value={g.ordQty}
                                    onChange={e => updateGod(idx, 'ordQty', e.target.value)}
                                    placeholder="수량"
                                    className="w-20 h-9 px-3 text-xs bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg outline-none dark:text-white text-center"
                                />
                                {formData.godCds.length > 1 && (
                                    <button type="button" onClick={() => removeGodRow(idx)} className="text-red-400 hover:text-red-600">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#252525] rounded-lg transition-colors">
                            취소
                        </button>
                        <button type="submit" disabled={creating} className="px-4 py-2 text-xs font-bold text-white bg-[#d9361b] hover:bg-[#c0301a] rounded-lg transition-colors disabled:opacity-50">
                            {creating ? '등록 중...' : '입고 요청'}
                        </button>
                    </div>
                </form>
            )}

            {/* Search bar */}
            <div className="flex items-center gap-3 bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-[#2a2a2a] rounded-xl p-3">
                <Calendar size={14} className="text-gray-400" />
                <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="h-8 px-2 text-xs bg-gray-50 dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg outline-none dark:text-white"
                />
                <span className="text-gray-400 text-xs">~</span>
                <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="h-8 px-2 text-xs bg-gray-50 dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg outline-none dark:text-white"
                />
                <button
                    onClick={handleSearch}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-xs font-bold hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                    {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                    조회
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-xs font-medium">
                    {error}
                </div>
            )}

            {/* Results */}
            {items.length > 0 ? (
                <div className="bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-[#2a2a2a] rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-[#2a2a2a]">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">입고내역 {items.length}건</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                            <thead className="bg-gray-50 dark:bg-[#1a1a1a]">
                                <tr>
                                    <th className="px-3 py-2 text-left font-bold text-gray-500 dark:text-gray-400">전표번호</th>
                                    <th className="px-3 py-2 text-center font-bold text-gray-500 dark:text-gray-400">요청일</th>
                                    <th className="px-3 py-2 text-center font-bold text-gray-500 dark:text-gray-400">입고방법</th>
                                    <th className="px-3 py-2 text-center font-bold text-gray-500 dark:text-gray-400">상태</th>
                                    <th className="px-3 py-2 text-center font-bold text-gray-500 dark:text-gray-400">택배사</th>
                                    <th className="px-3 py-2 text-center font-bold text-gray-500 dark:text-gray-400">송장번호</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-[#2a2a2a]">
                                {items.map((item) => {
                                    const status = STATUS_MAP[item.wrkStat] || { label: item.wrkStatNm || item.wrkStat, color: 'bg-gray-50 text-gray-600' }
                                    return (
                                        <tr key={item.slipNo} className="hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors">
                                            <td className="px-3 py-2.5 font-bold text-gray-900 dark:text-white">{item.slipNo}</td>
                                            <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">{item.ordDt}</td>
                                            <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">{IN_WAY_MAP[item.inWay] || item.inWay}</td>
                                            <td className="px-3 py-2.5 text-center">
                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${status.color}`}>
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-center text-gray-500 dark:text-gray-400">{item.parcelComp || '-'}</td>
                                            <td className="px-3 py-2.5 text-center text-gray-500 dark:text-gray-400 font-mono">{item.parcelInvoiceNo || '-'}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : !loading && (
                <div className="bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-[#2a2a2a] rounded-xl p-12 text-center">
                    <Box size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-sm font-bold text-gray-400 dark:text-gray-500">조회된 입고 내역이 없습니다</p>
                    <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-1">기간을 선택하고 조회 버튼을 눌러주세요</p>
                </div>
            )}
        </div>
    )
}
