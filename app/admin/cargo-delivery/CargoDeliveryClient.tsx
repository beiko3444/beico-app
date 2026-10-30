'use client'

import { useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, Pencil, Plus, Printer, Trash2, UserPlus, UserRoundCheck, X } from 'lucide-react'
import Button, { buttonClass } from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import EmptyState from '@/components/ui/EmptyState'
import { ProxySheet } from './ProxySheet'
import FaxPanel from './FaxPanel'
import { fieldClass, labelClass, selectClass } from '@/components/ui/field'
import DocumentPreview from '../proforma/DocumentPreview'
import {
    CARGO_PROXY_DEFAULT_CARGO_NAME,
    CARGO_PROXY_PRINCIPAL,
    formatProxyDate,
    toDateInputValue,
    type CargoDriverRecord,
    type CargoFaxLogRecord,
    type CargoFaxRecipientRecord,
    type CargoProxyDocument,
    type CargoProxyRecord,
} from '@/lib/cargoDeliveryProxy'

type Props = {
    initialDrivers: CargoDriverRecord[]
    initialProxies: CargoProxyRecord[]
    recentAwbNumbers: string[]
    initialFaxRecipients: CargoFaxRecipientRecord[]
    initialFaxLogs: CargoFaxLogRecord[]
}

type DraftState = Omit<CargoProxyDocument, 'documentNo'> & { driverId: string }

const EMPTY_DRIVER_FORM = { name: '', phone: '', vehicleNo: '' }

const buildEmptyDraft = (): DraftState => ({
    issueDate: toDateInputValue(new Date()),
    blNumber: '',
    cargoName: CARGO_PROXY_DEFAULT_CARGO_NAME,
    quantityText: '',
    driverId: '',
    driverName: '',
    driverPhone: '',
    driverVehicle: '',
    principalName: CARGO_PROXY_PRINCIPAL.name,
    principalAddress: CARGO_PROXY_PRINCIPAL.address,
    principalPhone: CARGO_PROXY_PRINCIPAL.phone,
    principalBusinessNo: CARGO_PROXY_PRINCIPAL.businessNo,
})

// Example placeholders are prefixed with 예: and kept lighter so they don't read as entered values.
const inputClass = fieldClass('placeholder:text-slate-300 dark:border-[#2a2a2a] dark:bg-[#1e1e1e] dark:text-white')
const groupTitleClass = 'text-[13px] font-black text-slate-900 dark:text-white'
const iconButtonClass = buttonClass('ghost', 'icon', 'text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:bg-[#2a2a2a]')
const deleteIconButtonClass = buttonClass('dangerGhost', 'icon', 'dark:hover:bg-[#2a2a2a]')

export default function CargoDeliveryClient({ initialDrivers, initialProxies, recentAwbNumbers, initialFaxRecipients, initialFaxLogs }: Props) {
    const [drivers, setDrivers] = useState<CargoDriverRecord[]>(initialDrivers)
    const [driverForm, setDriverForm] = useState(EMPTY_DRIVER_FORM)
    const [editingDriverId, setEditingDriverId] = useState<string | null>(null)
    const [isSavingDriver, setIsSavingDriver] = useState(false)
    const [deletingDriverId, setDeletingDriverId] = useState<string | null>(null)

    const [draft, setDraft] = useState<DraftState>(buildEmptyDraft)
    const [showPrincipal, setShowPrincipal] = useState(false)
    const [isIssuing, setIsIssuing] = useState(false)

    const [proxies, setProxies] = useState<CargoProxyRecord[]>(initialProxies)
    const [leftTab, setLeftTab] = useState<'write' | 'issued'>('write')
    const [activeProxyId, setActiveProxyId] = useState<string | null>(null)
    const [deletingProxyId, setDeletingProxyId] = useState<string | null>(null)

    const [faxRecipients, setFaxRecipients] = useState<CargoFaxRecipientRecord[]>(initialFaxRecipients)
    const [faxLogs, setFaxLogs] = useState<CargoFaxLogRecord[]>(initialFaxLogs)

    const sheetRef = useRef<HTMLDivElement>(null)

    const activeProxy = useMemo(
        () => (activeProxyId ? proxies.find((proxy) => proxy.id === activeProxyId) ?? null : null),
        [activeProxyId, proxies]
    )

    const previewDoc: CargoProxyDocument = useMemo(() => {
        if (leftTab === 'issued' && activeProxy) return activeProxy
        return { ...draft, documentNo: null }
    }, [leftTab, activeProxy, draft])

    const updateDraft = (patch: Partial<DraftState>) => setDraft((prev) => ({ ...prev, ...patch }))

    // ---------- 기사 관리 ----------

    const applyDriverToDraft = (driver: CargoDriverRecord) => {
        updateDraft({
            driverId: driver.id,
            driverName: driver.name,
            driverPhone: driver.phone,
            driverVehicle: driver.vehicleNo,
        })
        setLeftTab('write')
    }

    const startEditDriver = (driver: CargoDriverRecord) => {
        setEditingDriverId(driver.id)
        setDriverForm({ name: driver.name, phone: driver.phone, vehicleNo: driver.vehicleNo })
    }

    const cancelEditDriver = () => {
        setEditingDriverId(null)
        setDriverForm(EMPTY_DRIVER_FORM)
    }

    const handleSaveDriver = async () => {
        const name = driverForm.name.trim()
        if (!name) {
            alert('기사 이름을 입력하세요.')
            return
        }

        setIsSavingDriver(true)
        try {
            const response = await fetch('/api/admin/cargo-delivery/drivers', {
                method: editingDriverId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingDriverId ?? undefined,
                    name,
                    phone: driverForm.phone.trim(),
                    vehicleNo: driverForm.vehicleNo.trim(),
                }),
            })
            const data: (CargoDriverRecord & { error?: string }) | null = await response.json().catch(() => null)
            if (!response.ok || !data) {
                alert(data?.error || '기사 저장에 실패했습니다.')
                return
            }

            if (editingDriverId) {
                setDrivers((prev) => prev.map((driver) => (driver.id === data.id ? data : driver)))
                if (draft.driverId === data.id) {
                    updateDraft({ driverName: data.name, driverPhone: data.phone, driverVehicle: data.vehicleNo })
                }
            } else {
                setDrivers((prev) => [...prev, data])
            }
            cancelEditDriver()
        } catch (error) {
            console.error(error)
            alert('기사 저장 중 오류가 발생했습니다.')
        } finally {
            setIsSavingDriver(false)
        }
    }

    const handleDeleteDriver = async (driver: CargoDriverRecord) => {
        if (!confirm(`${driver.name} 기사를 삭제할까요?`)) return

        setDeletingDriverId(driver.id)
        try {
            const response = await fetch(`/api/admin/cargo-delivery/drivers?id=${encodeURIComponent(driver.id)}`, {
                method: 'DELETE',
            })
            const data: { error?: string } | null = await response.json().catch(() => null)
            if (!response.ok) {
                alert(data?.error || '기사 삭제에 실패했습니다.')
                return
            }
            setDrivers((prev) => prev.filter((item) => item.id !== driver.id))
            if (editingDriverId === driver.id) cancelEditDriver()
            if (draft.driverId === driver.id) updateDraft({ driverId: '' })
        } catch (error) {
            console.error(error)
            alert('기사 삭제 중 오류가 발생했습니다.')
        } finally {
            setDeletingDriverId(null)
        }
    }

    /** 위임장 폼에 직접 입력한 대리인을 기사 목록에 저장 */
    const handleSaveDraftDriver = () => {
        if (!draft.driverName.trim()) {
            alert('대리인 이름을 먼저 입력하세요.')
            return
        }
        setEditingDriverId(null)
        setDriverForm({ name: draft.driverName, phone: draft.driverPhone, vehicleNo: draft.driverVehicle })
    }

    // ---------- 위임장 ----------

    const resetDraft = () => {
        setDraft(buildEmptyDraft())
        setActiveProxyId(null)
    }

    const loadProxyIntoDraft = (proxy: CargoProxyRecord) => {
        setDraft({
            issueDate: toDateInputValue(new Date()),
            blNumber: proxy.blNumber,
            cargoName: proxy.cargoName,
            quantityText: proxy.quantityText,
            driverId: proxy.driverId ?? '',
            driverName: proxy.driverName,
            driverPhone: proxy.driverPhone,
            driverVehicle: proxy.driverVehicle,
            principalName: proxy.principalName,
            principalAddress: proxy.principalAddress,
            principalPhone: proxy.principalPhone,
            principalBusinessNo: proxy.principalBusinessNo,
        })
        setLeftTab('write')
    }

    const handleIssue = async () => {
        if (!draft.blNumber.trim()) {
            alert('B/L 번호(또는 AWB 번호)를 입력하세요.')
            return
        }
        if (!draft.driverName.trim()) {
            alert('대리인(기사) 이름을 입력하세요.')
            return
        }

        setIsIssuing(true)
        try {
            const response = await fetch('/api/admin/cargo-delivery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(draft),
            })
            const data: (CargoProxyRecord & { error?: string }) | null = await response.json().catch(() => null)
            if (!response.ok || !data) {
                alert(data?.error || '위임장 발행에 실패했습니다.')
                return
            }

            setProxies((prev) => [data, ...prev])
            setActiveProxyId(data.id)
            setLeftTab('issued')
        } catch (error) {
            console.error(error)
            alert('위임장 발행 중 오류가 발생했습니다.')
        } finally {
            setIsIssuing(false)
        }
    }

    const handleDeleteProxy = async (proxy: CargoProxyRecord) => {
        if (!confirm(`${proxy.documentNo} 위임장을 삭제할까요?`)) return

        setDeletingProxyId(proxy.id)
        try {
            const response = await fetch(`/api/admin/cargo-delivery?id=${encodeURIComponent(proxy.id)}`, {
                method: 'DELETE',
            })
            const data: { error?: string } | null = await response.json().catch(() => null)
            if (!response.ok) {
                alert(data?.error || '위임장 삭제에 실패했습니다.')
                return
            }
            const next = proxies.filter((item) => item.id !== proxy.id)
            setProxies(next)
            setActiveProxyId((prev) => (prev === proxy.id ? next[0]?.id ?? null : prev))
        } catch (error) {
            console.error(error)
            alert('위임장 삭제 중 오류가 발생했습니다.')
        } finally {
            setDeletingProxyId(null)
        }
    }

    const handlePrint = () => {
        if (!previewDoc.blNumber.trim() || !previewDoc.driverName.trim()) {
            alert('B/L 번호와 대리인 이름을 입력한 뒤 출력하세요.')
            return
        }
        const sheet = sheetRef.current?.querySelector<HTMLElement>('.cargo-proxy-sheet')
        if (!sheet) {
            alert('출력할 위임장을 찾을 수 없습니다.')
            return
        }

        const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<base href="${window.location.origin}/">
<title></title>
<style>
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; background: #fff; width: 210mm; }
.cargo-proxy-sheet { height: 297mm; overflow: hidden; }
</style>
</head>
<body>${sheet.outerHTML}</body>
</html>`

        // PI발급과 동일하게 숨김 iframe으로 인쇄 (팝업 방식은 타이밍 문제가 있음)
        const existingFrame = document.getElementById('cargo-proxy-print-frame')
        if (existingFrame) existingFrame.remove()

        const iframe = document.createElement('iframe')
        iframe.id = 'cargo-proxy-print-frame'
        iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:210mm;height:297mm;border:none;'
        document.body.appendChild(iframe)

        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
        if (!iframeDoc || !iframe.contentWindow) {
            alert('인쇄 프레임을 생성할 수 없습니다.')
            iframe.remove()
            return
        }

        iframeDoc.open()
        iframeDoc.write(fullHtml)
        iframeDoc.close()

        iframe.onload = () => {
            setTimeout(() => {
                // 브라우저 머리글에 페이지 제목이 찍히지 않도록 잠시 비운다
                const originalTitle = document.title
                document.title = ' '

                iframe.contentWindow?.focus()
                iframe.contentWindow?.print()

                document.title = originalTitle
                setTimeout(() => { iframe.remove() }, 2000)
            }, 300)
        }
    }

    const selectedDriverId = drivers.some((driver) => driver.id === draft.driverId) ? draft.driverId : ''

    return (
        <div className="min-w-0">
            <PageHeader
                title="인도 위임장"
                description="수입화물 인도 위임장입니다. 대리인(기사)과 화물 정보를 입력하면 미리보기에 위임장이 실시간으로 만들어집니다."
                actions={
                    // Both stay in place on the 발행 리스트 tab (disabled) so the header doesn't shift; 출력 lives on the preview.
                    <>
                        <Button variant="secondary" onClick={resetDraft} disabled={leftTab !== 'write'}>초기화</Button>
                        <Button data-primary variant="primary" onClick={handleIssue} loading={isIssuing} disabled={leftTab !== 'write'}>
                            {isIssuing ? '발행 중...' : '발행하기'}
                        </Button>
                    </>
                }
            />

            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,600px)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,640px)]">
                <div className="min-w-0 space-y-6">
                    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2a2a2a] dark:bg-[#1e1e1e] dark:shadow-none sm:p-5">
                        <Tabs
                            aria-label="위임장 작업"
                            items={[
                                { key: 'write', label: '위임장 작성' },
                                { key: 'issued', label: '발행 리스트', count: proxies.length },
                            ]}
                            value={leftTab}
                            onChange={(key) => {
                                setLeftTab(key)
                                if (key === 'issued' && !activeProxyId && proxies[0]) setActiveProxyId(proxies[0].id)
                            }}
                        />

                        {leftTab === 'write' ? (
                            <div className="space-y-5">
                                <div className="space-y-3">
                                    <h2 className={groupTitleClass}>대리인 (기사)</h2>
                                    <Field label="기사 목록에서 선택">
                                        <select
                                            value={selectedDriverId}
                                            onChange={(event) => {
                                                const driver = drivers.find((item) => item.id === event.target.value)
                                                if (driver) applyDriverToDraft(driver)
                                                else updateDraft({ driverId: '' })
                                            }}
                                            className={selectClass(!!selectedDriverId, 'dark:border-[#2a2a2a] dark:bg-[#1e1e1e]')}
                                        >
                                            <option value="">선택 안 함 (아래에 직접 입력)</option>
                                            {drivers.map((driver) => (
                                                <option key={driver.id} value={driver.id}>
                                                    {driver.name} · {driver.phone || '-'} · {driver.vehicleNo || '-'}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        <Field label="대리인 이름">
                                            <input type="text" value={draft.driverName} onChange={(event) => updateDraft({ driverName: event.target.value })} className={inputClass} placeholder="예: 홍길동" />
                                        </Field>
                                        <Field label="대리인 연락처">
                                            <input type="tel" value={draft.driverPhone} onChange={(event) => updateDraft({ driverPhone: event.target.value })} className={inputClass} placeholder="예: 010-0000-0000" />
                                        </Field>
                                        <Field label="대리인 차량정보">
                                            <input type="text" value={draft.driverVehicle} onChange={(event) => updateDraft({ driverVehicle: event.target.value })} className={inputClass} placeholder="예: 부산 90자 0000" />
                                        </Field>
                                    </div>
                                    <div className="flex justify-end">
                                        <Button variant="ghost" size="sm" icon={<UserPlus size={14} />} onClick={handleSaveDraftDriver}>
                                            입력한 대리인을 기사 목록에 저장
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-3 border-t border-slate-100 pt-5 dark:border-[#2a2a2a]">
                                    <h2 className={groupTitleClass}>화물 정보</h2>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <Field label="B/L 번호 (또는 AWB 번호)">
                                            <input
                                                type="text"
                                                list="cargo-proxy-awb-list"
                                                value={draft.blNumber}
                                                onChange={(event) => updateDraft({ blNumber: event.target.value })}
                                                className={inputClass}
                                                placeholder="예: 112-0000-0000"
                                            />
                                            <datalist id="cargo-proxy-awb-list">
                                                {recentAwbNumbers.map((awb) => <option key={awb} value={awb} />)}
                                            </datalist>
                                        </Field>
                                        <Field label="날짜">
                                            <input type="date" value={draft.issueDate} onChange={(event) => updateDraft({ issueDate: event.target.value })} className={inputClass} />
                                        </Field>
                                        <Field label="화물명">
                                            <input type="text" value={draft.cargoName} onChange={(event) => updateDraft({ cargoName: event.target.value })} className={inputClass} placeholder={`예: ${CARGO_PROXY_DEFAULT_CARGO_NAME}`} />
                                        </Field>
                                        <Field label="수량">
                                            <input type="text" value={draft.quantityText} onChange={(event) => updateDraft({ quantityText: event.target.value })} className={inputClass} placeholder="예: 12박스 (144kg)" />
                                        </Field>
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 pt-5 dark:border-[#2a2a2a]">
                                    <button
                                        type="button"
                                        onClick={() => setShowPrincipal((prev) => !prev)}
                                        aria-expanded={showPrincipal}
                                        className="flex w-full items-center justify-between gap-3 text-left"
                                    >
                                        <span className={groupTitleClass}>위임인 (수입자) 정보</span>
                                        <span className="inline-flex min-w-0 items-center gap-1 text-xs font-bold text-slate-600 dark:text-gray-300">
                                            <span className="truncate">{showPrincipal ? '접기' : `${draft.principalName} · 수정`}</span>
                                            <ChevronDown size={15} className={`shrink-0 transition-transform ${showPrincipal ? 'rotate-180' : ''}`} />
                                        </span>
                                    </button>
                                    {showPrincipal && (
                                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <Field label="위임인 이름">
                                                <input type="text" value={draft.principalName} onChange={(event) => updateDraft({ principalName: event.target.value })} className={inputClass} />
                                            </Field>
                                            <Field label="위임인 전화번호">
                                                <input type="tel" value={draft.principalPhone} onChange={(event) => updateDraft({ principalPhone: event.target.value })} className={inputClass} />
                                            </Field>
                                            <Field label="위임인 주소" className="sm:col-span-2">
                                                <input type="text" value={draft.principalAddress} onChange={(event) => updateDraft({ principalAddress: event.target.value })} className={inputClass} />
                                            </Field>
                                            <Field label="사업자등록번호">
                                                <input type="text" value={draft.principalBusinessNo} onChange={(event) => updateDraft({ principalBusinessNo: event.target.value })} className={inputClass} />
                                            </Field>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#2a2a2a]">
                                    <table className="w-full text-sm">
                                        <thead className="ux-thead">
                                            <tr>
                                                <th className="text-left">날짜</th>
                                                <th className="text-left">문서번호</th>
                                                <th className="text-left">B/L 번호</th>
                                                <th className="text-left">대리인</th>
                                                <th className="hidden text-left sm:table-cell">차량</th>
                                                <th className="text-center">관리</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-[#2a2a2a]">
                                            {proxies.length === 0 && (
                                                <tr>
                                                    <td colSpan={6}>
                                                        <EmptyState bare compact title="발행된 위임장이 없습니다" description="위임장 작성 탭에서 내용을 입력하고 발행하세요." />
                                                    </td>
                                                </tr>
                                            )}
                                            {proxies.map((proxy) => {
                                                const isActive = proxy.id === activeProxyId
                                                return (
                                                    <tr
                                                        key={proxy.id}
                                                        onClick={() => setActiveProxyId(proxy.id)}
                                                        aria-selected={isActive}
                                                        className={`cursor-pointer transition-colors ${isActive ? 'bg-brand-orange-soft dark:bg-[#2a1d19]' : 'hover:bg-slate-50 dark:hover:bg-[#252525]'}`}
                                                    >
                                                        <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-700 dark:text-gray-300">{formatProxyDate(proxy.issueDate)}</td>
                                                        <td className="whitespace-nowrap px-3 py-2 font-bold text-slate-900 dark:text-white">{proxy.documentNo}</td>
                                                        <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-700 dark:text-gray-300">{proxy.blNumber}</td>
                                                        <td className="whitespace-nowrap px-3 py-2 text-slate-700 dark:text-gray-300">{proxy.driverName}</td>
                                                        <td className="hidden whitespace-nowrap px-3 py-2 text-slate-700 dark:text-gray-300 sm:table-cell">{proxy.driverVehicle || '-'}</td>
                                                        <td className="px-3 py-2">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={(event) => { event.stopPropagation(); loadProxyIntoDraft(proxy) }}
                                                                    className={iconButtonClass}
                                                                    title="이 내용으로 새로 작성"
                                                                    aria-label={`${proxy.documentNo} 내용으로 새로 작성`}
                                                                >
                                                                    <Pencil size={16} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={(event) => { event.stopPropagation(); void handleDeleteProxy(proxy) }}
                                                                    disabled={deletingProxyId === proxy.id}
                                                                    className={deleteIconButtonClass}
                                                                    title="삭제"
                                                                    aria-label={`${proxy.documentNo} 삭제`}
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {activeProxy && (
                                    <FaxPanel
                                        proxy={activeProxy}
                                        recipients={faxRecipients}
                                        logs={faxLogs}
                                        onRecipientsChange={setFaxRecipients}
                                        onLogsChange={setFaxLogs}
                                    />
                                )}
                            </div>
                        )}
                    </section>

                    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2a2a2a] dark:bg-[#1e1e1e] dark:shadow-none sm:p-5">
                        <div>
                            <h2 className="text-base font-black text-slate-900 dark:text-white">기사 관리</h2>
                            <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">자주 쓰는 기사를 등록해 두면 위임장 작성 시 바로 선택할 수 있습니다.</p>
                        </div>

                        <div className="space-y-3">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <Field label="이름">
                                    <input type="text" value={driverForm.name} onChange={(event) => setDriverForm((prev) => ({ ...prev, name: event.target.value }))} className={inputClass} placeholder="기사 이름" />
                                </Field>
                                <Field label="연락처">
                                    <input type="tel" value={driverForm.phone} onChange={(event) => setDriverForm((prev) => ({ ...prev, phone: event.target.value }))} className={inputClass} placeholder="예: 010-0000-0000" />
                                </Field>
                                <Field label="차량번호">
                                    <input type="text" value={driverForm.vehicleNo} onChange={(event) => setDriverForm((prev) => ({ ...prev, vehicleNo: event.target.value }))} className={inputClass} placeholder="예: 부산 90자 0000" />
                                </Field>
                            </div>
                            <div className="flex justify-end gap-2">
                                {editingDriverId && (
                                    <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={cancelEditDriver}>
                                        수정 취소
                                    </Button>
                                )}
                                <Button variant="secondary" size="sm" icon={editingDriverId ? <Pencil size={14} /> : <Plus size={14} />} onClick={handleSaveDriver} loading={isSavingDriver}>
                                    {editingDriverId ? '수정 저장' : '기사 추가'}
                                </Button>
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#2a2a2a]">
                            <table className="w-full text-sm">
                                <thead className="ux-thead">
                                    <tr>
                                        <th className="text-left">이름</th>
                                        <th className="hidden text-left sm:table-cell">연락처</th>
                                        <th className="hidden text-left sm:table-cell">차량번호</th>
                                        <th className="text-center">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-[#2a2a2a]">
                                    {drivers.length === 0 && (
                                        <tr>
                                            <td colSpan={4}>
                                                <EmptyState bare compact title="등록된 기사가 없습니다" />
                                            </td>
                                        </tr>
                                    )}
                                    {drivers.map((driver) => (
                                        <tr key={driver.id} className={draft.driverId === driver.id ? 'bg-brand-orange-soft dark:bg-[#2a1d19]' : ''}>
                                            {/* Phones: contact and vehicle move under the name so the actions column stays on screen. */}
                                            <td className="min-w-0 px-3 py-2 font-bold text-slate-900 dark:text-white sm:whitespace-nowrap">
                                                {driver.name}
                                                <span className="block break-keep text-[11px] font-medium tabular-nums text-slate-500 sm:hidden">
                                                    {driver.phone || '-'} · {driver.vehicleNo || '-'}
                                                </span>
                                            </td>
                                            <td className="hidden whitespace-nowrap px-3 py-2 tabular-nums text-slate-700 dark:text-gray-300 sm:table-cell">{driver.phone || '-'}</td>
                                            <td className="hidden whitespace-nowrap px-3 py-2 text-slate-700 dark:text-gray-300 sm:table-cell">{driver.vehicleNo || '-'}</td>
                                            <td className="w-px px-2 py-2 sm:px-3">
                                                <div className="flex items-center justify-center gap-0.5 sm:gap-1">
                                                    <button type="button" onClick={() => applyDriverToDraft(driver)} className={iconButtonClass} title="위임장 대리인으로 선택" aria-label={`${driver.name} 대리인으로 선택`}>
                                                        <UserRoundCheck size={16} />
                                                    </button>
                                                    <button type="button" onClick={() => startEditDriver(driver)} className={iconButtonClass} title="수정" aria-label={`${driver.name} 수정`}>
                                                        <Pencil size={16} />
                                                    </button>
                                                    <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-[#2a2a2a]" />
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleDeleteDriver(driver)}
                                                        disabled={deletingDriverId === driver.id}
                                                        className={deleteIconButtonClass}
                                                        title="삭제"
                                                        aria-label={`${driver.name} 삭제`}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                <DocumentPreview
                    title="인쇄 미리보기"
                    meta={leftTab === 'issued' && activeProxy ? activeProxy.documentNo : '작성 중인 위임장'}
                    actions={<Button variant="secondary" size="sm" icon={<Printer size={14} />} onClick={handlePrint}>출력 (PDF)</Button>}
                    footnote={<>인쇄창에서 &quot;PDF로 저장&quot;을 선택하면 PDF 파일로 저장됩니다. 머리글/바닥글을 해제하면 날짜/URL 표시가 사라집니다.</>}
                    sheetRef={sheetRef}
                    className="xl:sticky xl:top-[76px]"
                >
                    <ProxySheet doc={previewDoc} />
                </DocumentPreview>
            </div>
        </div>
    )
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
    return (
        <label className={`block min-w-0 ${className}`}>
            <span className={labelClass}>{label}</span>
            {children}
        </label>
    )
}
