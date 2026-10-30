'use client'

import { useMemo, useState } from 'react'
import { FileDown, Plus, RefreshCw, Send, Trash2 } from 'lucide-react'
import { buttonClass } from '@/components/ui/buttonClass'
import Badge, { type BadgeTone } from '@/components/ui/Badge'
import { fieldClass, labelClass as fieldLabelClass, selectClass } from '@/components/ui/field'
import { formatDateTime } from '@/lib/format'
import type { CargoFaxLogRecord, CargoFaxRecipientRecord, CargoProxyRecord } from '@/lib/cargoDeliveryProxy'

type Props = {
    proxy: CargoProxyRecord
    recipients: CargoFaxRecipientRecord[]
    logs: CargoFaxLogRecord[]
    onRecipientsChange: (next: CargoFaxRecipientRecord[]) => void
    onLogsChange: (updater: (prev: CargoFaxLogRecord[]) => CargoFaxLogRecord[]) => void
}

type CheckResult = {
    fromNumbers: { ok: boolean; numbers: { number: string; validDate: string }[]; message?: string }
    ftp: { ok: boolean; host: string; user: string; message?: string }
}

const inputClass = fieldClass('placeholder:text-slate-300 dark:border-[#2a2a2a] dark:bg-[#1e1e1e] dark:text-white')
const labelClass = fieldLabelClass

const formatFaxNumber = (value: string) => {
    const digits = value.replace(/[^0-9]/g, '')
    if (digits.length === 8) return digits.replace(/(\d{4})(\d{4})/, '$1-$2')
    if (digits.startsWith('02') && digits.length >= 9) return digits.replace(/^(02)(\d{3,4})(\d{4})$/, '$1-$2-$3')
    if (digits.length >= 10) return digits.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3')
    return value
}

// 바로빌 SendState: 0~2 진행중, 3 전송완료(결과코드 802만 성공), 4 예약취소, 5 변환실패, 6 전송실패, 7 부분성공, 8 용량초과
const stateTone = (log: CargoFaxLogRecord): BadgeTone => {
    const failed = 'danger'
    const success = 'success'
    const pending = 'warning'
    if (log.error) return failed
    switch (log.sendState) {
        case 3:
            return !log.sendResult || log.sendResult === '802' ? success : failed
        case 7:
            return pending
        case 4:
        case 5:
        case 6:
        case 8:
            return failed
        default:
            return pending
    }
}

export default function FaxPanel({ proxy, recipients, logs, onRecipientsChange, onLogsChange }: Props) {
    const [selectedRecipientId, setSelectedRecipientId] = useState('')
    const [toName, setToName] = useState('')
    const [toNumber, setToNumber] = useState('')
    const [isSending, setIsSending] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [isChecking, setIsChecking] = useState(false)
    const [checkResult, setCheckResult] = useState<CheckResult | null>(null)
    const [showRecipientForm, setShowRecipientForm] = useState(false)
    const [recipientForm, setRecipientForm] = useState({ name: '', faxNumber: '' })
    const [isSavingRecipient, setIsSavingRecipient] = useState(false)

    const proxyLogs = useMemo(() => logs.filter((log) => log.proxyId === proxy.id), [logs, proxy.id])

    const applyRecipient = (id: string) => {
        setSelectedRecipientId(id)
        const recipient = recipients.find((item) => item.id === id)
        if (recipient) {
            setToName(recipient.name)
            setToNumber(recipient.faxNumber)
        }
    }

    const handleSend = async () => {
        if (toNumber.replace(/[^0-9]/g, '').length < 8) {
            alert('수신 팩스번호를 입력하세요.')
            return
        }
        if (!confirm(`${proxy.documentNo} 위임장을 ${toName || '수신처'} (${formatFaxNumber(toNumber)}) 로 팩스 발송할까요?\n건당 팩스 요금이 차감됩니다.`)) return

        setIsSending(true)
        try {
            const response = await fetch('/api/admin/cargo-delivery/fax', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ proxyId: proxy.id, toName, toNumber }),
            })
            const data: (CargoFaxLogRecord & { error?: string; log?: CargoFaxLogRecord }) | null = await response.json().catch(() => null)
            const log = data?.log ?? (data && 'id' in data ? data : null)
            if (log) {
                onLogsChange((prev) => [log, ...prev.filter((item) => item.id !== log.id)])
            }
            if (!response.ok || !data || data.error) {
                alert(data?.error || '팩스 발송에 실패했습니다.')
                return
            }
            alert('팩스가 접수되었습니다. 전송 결과는 잠시 후 "상태 새로고침"으로 확인하세요.')
        } catch (error) {
            console.error(error)
            alert('팩스 발송 중 오류가 발생했습니다.')
        } finally {
            setIsSending(false)
        }
    }

    const handleRefresh = async () => {
        setIsRefreshing(true)
        try {
            const response = await fetch(`/api/admin/cargo-delivery/fax?refresh=1&proxyId=${encodeURIComponent(proxy.id)}`)
            const data: CargoFaxLogRecord[] | { error?: string } = await response.json().catch(() => ({}))
            if (!response.ok || !Array.isArray(data)) {
                alert((data as { error?: string })?.error || '상태를 불러오지 못했습니다.')
                return
            }
            onLogsChange((prev) => {
                const byId = new Map(data.map((log) => [log.id, log]))
                const merged = prev.map((log) => byId.get(log.id) ?? log)
                const known = new Set(merged.map((log) => log.id))
                return [...data.filter((log) => !known.has(log.id)), ...merged]
            })
        } catch (error) {
            console.error(error)
            alert('상태 조회 중 오류가 발생했습니다.')
        } finally {
            setIsRefreshing(false)
        }
    }

    const handleDeleteLog = async (log: CargoFaxLogRecord) => {
        if (!confirm('이 전송 내역을 삭제할까요? (바로빌 전송 자체가 취소되지는 않습니다)')) return
        try {
            const response = await fetch(`/api/admin/cargo-delivery/fax?id=${encodeURIComponent(log.id)}`, { method: 'DELETE' })
            const data: { error?: string } | null = await response.json().catch(() => null)
            if (!response.ok) {
                alert(data?.error || '삭제에 실패했습니다.')
                return
            }
            onLogsChange((prev) => prev.filter((item) => item.id !== log.id))
        } catch (error) {
            console.error(error)
            alert('삭제 중 오류가 발생했습니다.')
        }
    }

    const handleCheck = async () => {
        setIsChecking(true)
        setCheckResult(null)
        try {
            const response = await fetch('/api/admin/cargo-delivery/fax?check=1')
            const data: CheckResult | { error?: string } = await response.json().catch(() => ({}))
            if (!response.ok || !('fromNumbers' in data)) {
                alert((data as { error?: string })?.error || '설정 점검에 실패했습니다.')
                return
            }
            setCheckResult(data)
        } catch (error) {
            console.error(error)
            alert('설정 점검 중 오류가 발생했습니다.')
        } finally {
            setIsChecking(false)
        }
    }

    const handleSaveRecipient = async () => {
        const name = recipientForm.name.trim()
        const faxNumber = recipientForm.faxNumber.trim()
        if (!name || faxNumber.replace(/[^0-9]/g, '').length < 8) {
            alert('수신처 이름과 팩스번호를 입력하세요.')
            return
        }
        setIsSavingRecipient(true)
        try {
            const response = await fetch('/api/admin/cargo-delivery/fax/recipients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, faxNumber }),
            })
            const data: (CargoFaxRecipientRecord & { error?: string }) | null = await response.json().catch(() => null)
            if (!response.ok || !data || data.error) {
                alert(data?.error || '수신처 저장에 실패했습니다.')
                return
            }
            onRecipientsChange([...recipients, data])
            setRecipientForm({ name: '', faxNumber: '' })
            setShowRecipientForm(false)
            applyRecipient(data.id)
            // applyRecipient는 기존 목록에서 찾으므로 새 항목은 직접 반영
            setSelectedRecipientId(data.id)
            setToName(data.name)
            setToNumber(data.faxNumber)
        } catch (error) {
            console.error(error)
            alert('수신처 저장 중 오류가 발생했습니다.')
        } finally {
            setIsSavingRecipient(false)
        }
    }

    const handleDeleteRecipient = async (recipient: CargoFaxRecipientRecord) => {
        if (!confirm(`${recipient.name} 수신처를 삭제할까요?`)) return
        try {
            const response = await fetch(`/api/admin/cargo-delivery/fax/recipients?id=${encodeURIComponent(recipient.id)}`, { method: 'DELETE' })
            const data: { error?: string } | null = await response.json().catch(() => null)
            if (!response.ok) {
                alert(data?.error || '삭제에 실패했습니다.')
                return
            }
            onRecipientsChange(recipients.filter((item) => item.id !== recipient.id))
            if (selectedRecipientId === recipient.id) setSelectedRecipientId('')
        } catch (error) {
            console.error(error)
            alert('삭제 중 오류가 발생했습니다.')
        }
    }

    return (
        <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-[#2a2a2a]">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="text-[13px] font-black text-slate-900 dark:text-white">팩스 발송 · {proxy.documentNo}</h3>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-gray-400">서버에서 위임장 PDF를 만들어 바로빌 팩스로 보냅니다.</p>
                </div>
                <div className="flex items-center gap-2">
                    <a
                        href={`/api/admin/cargo-delivery/pdf?id=${encodeURIComponent(proxy.id)}`}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonClass('secondary', 'sm')}
                        title="팩스로 나가는 PDF 미리보기"
                    >
                        <FileDown size={14} /> PDF 확인
                    </a>
                    <button type="button" onClick={handleCheck} disabled={isChecking} className={buttonClass('secondary', 'sm')}>
                        {isChecking ? '점검 중...' : '설정 점검'}
                    </button>
                </div>
            </div>

            {checkResult && (
                <div className="space-y-1 rounded-lg bg-slate-50 p-2.5 text-[11px] font-bold dark:bg-[#1a1a1a]">
                    <div className={checkResult.fromNumbers.ok ? 'text-emerald-600' : 'text-red-600'}>
                        발신번호: {checkResult.fromNumbers.ok
                            ? checkResult.fromNumbers.numbers.length > 0
                                ? checkResult.fromNumbers.numbers.map((item) => formatFaxNumber(item.number)).join(', ')
                                : '등록된 팩스 발신번호가 없습니다'
                            : checkResult.fromNumbers.message}
                    </div>
                    <div className={checkResult.ftp.ok ? 'text-emerald-600' : 'text-red-600'}>
                        FTP 업로드: {checkResult.ftp.ok ? `접속 성공 (${checkResult.ftp.host}, ${checkResult.ftp.user})` : checkResult.ftp.message}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3">
                <div>
                    <div className="flex items-center justify-between gap-2">
                        <label className={labelClass}>저장된 수신처</label>
                        <button
                            type="button"
                            onClick={() => setShowRecipientForm((prev) => !prev)}
                            aria-expanded={showRecipientForm}
                            className="inline-flex items-center gap-0.5 rounded text-[11px] font-bold text-slate-600 hover:text-slate-900 dark:text-gray-300"
                        >
                            <Plus size={12} /> 수신처 관리
                        </button>
                    </div>
                    <select
                        value={selectedRecipientId}
                        onChange={(event) => applyRecipient(event.target.value)}
                        className={selectClass(!!selectedRecipientId, 'dark:border-[#2a2a2a] dark:bg-[#1e1e1e]')}
                    >
                        <option value="">직접 입력</option>
                        {recipients.map((recipient) => (
                            <option key={recipient.id} value={recipient.id}>
                                {recipient.name} · {formatFaxNumber(recipient.faxNumber)}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className={labelClass}>수신처 이름</label>
                    <input type="text" value={toName} onChange={(event) => setToName(event.target.value)} className={inputClass} placeholder="예: ○○물류 / 포워더" />
                </div>
                <div>
                    <label className={labelClass}>수신 팩스번호</label>
                    <input type="tel" value={toNumber} onChange={(event) => setToNumber(event.target.value)} className={inputClass} placeholder="예: 051-000-0000" />
                </div>
            </div>
            <div className="flex justify-end">
                <button type="button" onClick={handleSend} disabled={isSending} className={buttonClass('primary', 'md')}>
                    <Send size={15} /> {isSending ? '발송 중...' : '팩스 발송'}
                </button>
            </div>

            {showRecipientForm && (
                <div className="space-y-2 rounded-lg bg-slate-50 p-3 dark:bg-[#1a1a1a]">
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                        <div>
                            <label className={labelClass}>이름</label>
                            <input type="text" value={recipientForm.name} onChange={(event) => setRecipientForm((prev) => ({ ...prev, name: event.target.value }))} className={inputClass} placeholder="수신처 이름" />
                        </div>
                        <div>
                            <label className={labelClass}>팩스번호</label>
                            <input type="tel" value={recipientForm.faxNumber} onChange={(event) => setRecipientForm((prev) => ({ ...prev, faxNumber: event.target.value }))} className={inputClass} placeholder="예: 051-000-0000" />
                        </div>
                        <button type="button" onClick={handleSaveRecipient} disabled={isSavingRecipient} className={buttonClass('secondary', 'md')}>
                            {isSavingRecipient ? '저장 중...' : '저장'}
                        </button>
                    </div>
                    {recipients.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {recipients.map((recipient) => (
                                <span key={recipient.id} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700 dark:border-[#2a2a2a] dark:bg-[#1e1e1e] dark:text-gray-300">
                                    {recipient.name} · {formatFaxNumber(recipient.faxNumber)}
                                    <button type="button" onClick={() => void handleDeleteRecipient(recipient)} className={buttonClass('dangerGhost', 'icon', 'h-6 w-6 rounded-full')} title="삭제" aria-label={`${recipient.name} 수신처 삭제`}>
                                        <Trash2 size={13} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-slate-700 dark:text-gray-300">전송 내역 ({proxyLogs.length})</span>
                <button type="button" onClick={handleRefresh} disabled={isRefreshing} className={buttonClass('ghost', 'sm')}>
                    <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} /> 상태 새로고침
                </button>
            </div>
            {proxyLogs.length === 0 ? (
                <p className="text-[11px] text-slate-500">아직 발송한 팩스가 없습니다.</p>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-[#2a2a2a] dark:bg-[#1e1e1e]">
                    <table className="w-full text-xs">
                        <thead className="ux-thead">
                            <tr>
                                <th className="text-left">발송</th>
                                <th className="text-left">수신처</th>
                                <th className="text-left">상태</th>
                                <th className="text-left">결과</th>
                                <th className="text-center">삭제</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#2a2a2a]">
                            {proxyLogs.map((log) => (
                                <tr key={log.id}>
                                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-700 dark:text-gray-300">{formatDateTime(log.createdAt)}</td>
                                    <td className="whitespace-nowrap px-3 py-2 text-slate-700 dark:text-gray-300">{log.toName} · {formatFaxNumber(log.toNumber)}</td>
                                    <td className="whitespace-nowrap px-3 py-2">
                                        <Badge tone={stateTone(log)}>{log.sendStateLabel}</Badge>
                                    </td>
                                    <td className="break-all px-3 py-2 text-slate-600 dark:text-gray-400">
                                        {log.error
                                            ? log.error
                                            : [
                                                  log.sendResultLabel || null,
                                                  log.sendPageCount !== null ? `${log.successPageCount ?? 0}/${log.sendPageCount}장` : null,
                                              ].filter(Boolean).join(' · ') || '-'}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <button type="button" onClick={() => void handleDeleteLog(log)} className={buttonClass('dangerGhost', 'icon')} title="내역 삭제" aria-label="전송 내역 삭제">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
