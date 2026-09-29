'use client'

import { useMemo, useRef, useState } from 'react'
import { Pencil, Plus, Printer, Trash2, UserRoundCheck, X } from 'lucide-react'
import {
    CARGO_PROXY_DEFAULT_CARGO_NAME,
    CARGO_PROXY_PRINCIPAL,
    formatProxyDate,
    toDateInputValue,
    type CargoDriverRecord,
    type CargoProxyDocument,
    type CargoProxyRecord,
} from '@/lib/cargoDeliveryProxy'

type Props = {
    initialDrivers: CargoDriverRecord[]
    initialProxies: CargoProxyRecord[]
    recentAwbNumbers: string[]
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

const inputClass =
    'mt-1 w-full bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#2a2a2a] rounded-xl p-2.5 text-sm font-medium dark:text-white focus:ring-[#e53b19] focus:border-[#e53b19]'
const labelClass = 'text-xs font-bold text-gray-700 dark:text-gray-400'
const primaryButtonClass =
    'px-4 py-2 rounded-xl text-xs font-bold bg-[#e53b19] text-white hover:brightness-110 disabled:opacity-50 transition-all'
const secondaryButtonClass =
    'px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 dark:bg-[#252525] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#2a2a2a] disabled:opacity-50 transition-all'

const SHEET_FONT = '"Batang", "바탕", "BatangChe", "Noto Serif KR", "Nanum Myeongjo", "Apple Myungjo", serif'

const sheetStyles = {
    sheet: {
        width: '210mm',
        minHeight: '297mm',
        padding: '28mm 22mm 24mm',
        background: '#ffffff',
        color: '#111111',
        fontFamily: SHEET_FONT,
        fontSize: '14px',
        lineHeight: 1.8,
        boxSizing: 'border-box',
        position: 'relative',
        wordBreak: 'keep-all',
    },
    title: { fontSize: '26px', fontWeight: 900, margin: '0 0 22px', letterSpacing: '-0.5px', lineHeight: 1.3 },
    block: { margin: '18px 0 0' },
    indent: { paddingLeft: '10px' },
    sealRow: { margin: '18px 0 0', position: 'relative', display: 'inline-block', paddingRight: '70px' },
    seal: {
        position: 'absolute',
        right: '0',
        top: '50%',
        height: '64px',
        width: '64px',
        transform: 'translateY(-50%)',
        objectFit: 'contain',
        opacity: 0.85,
    },
    docNo: { position: 'absolute', right: '22mm', bottom: '12mm', fontSize: '10px', color: '#888888', fontFamily: 'sans-serif' },
} as const

/** 인쇄용 시트. 인라인 스타일만 사용해서 outerHTML 그대로 iframe에 복사해 인쇄한다. */
export function ProxySheet({ doc }: { doc: CargoProxyDocument }) {
    const dash = (value: string) => (value.trim().length > 0 ? value : ' ')
    return (
        <div className="cargo-proxy-sheet" style={sheetStyles.sheet}>
            <h1 style={sheetStyles.title}>수입화물 인도 위임장</h1>

            <p style={{ margin: 0 }}>위임인(수입자) 정보를 아래와 같이 명시합니다.</p>

            <p style={sheetStyles.block}>
                위임인 이름: {dash(doc.principalName)}<br />
                위임인 주소: {dash(doc.principalAddress)}<br />
                위임인 전화번호: {dash(doc.principalPhone)}<br />
                사업자등록번호: {dash(doc.principalBusinessNo)}
            </p>

            <p style={sheetStyles.block}>아래 수입화물의 인도를 대리인에게 위임합니다.</p>

            <p style={sheetStyles.block}>
                화물 정보:<br />
                <span style={sheetStyles.indent}>- B/L 번호(또는 AWB 번호): {dash(doc.blNumber)}</span><br />
                <span style={sheetStyles.indent}>- 화물명: {dash(doc.cargoName)}</span><br />
                <span style={sheetStyles.indent}>- 수량: {dash(doc.quantityText)}</span>
            </p>

            <p style={sheetStyles.block}>
                대리인 정보:<br />
                <span style={sheetStyles.indent}>- 대리인 이름: {dash(doc.driverName)}</span><br />
                <span style={sheetStyles.indent}>- 대리인 연락처: {dash(doc.driverPhone)}</span><br />
                <span style={sheetStyles.indent}>- 대리인 차량정보: {dash(doc.driverVehicle)}</span>
            </p>

            <p style={sheetStyles.block}>
                위임인의 서명 및 확인:<br />
                <span style={sheetStyles.indent}>
                    본인은 상기 화물의 인도 절차를 위임합니다. 대리인이 위임장의 조건에 따라 화물을 수령할 수 있도록 허가합니다.
                </span>
            </p>

            <div style={sheetStyles.sealRow}>
                날짜: {formatProxyDate(doc.issueDate)}<br />
                위임인 서명: {dash(doc.principalName)}
                <img src="/seal.png" alt="인감" style={sheetStyles.seal} />
            </div>

            <p style={{ margin: '24px 0 0' }}>본 위임장은 화물 인도 과정에서만 사용되며, 그 외 용도로 사용할 수 없습니다.</p>

            {doc.documentNo && <div style={sheetStyles.docNo}>문서번호 {doc.documentNo}</div>}
        </div>
    )
}

export default function CargoDeliveryClient({ initialDrivers, initialProxies, recentAwbNumbers }: Props) {
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
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(480px,1fr)_210mm] gap-8 items-start">
            <div className="space-y-6 xl:max-w-none">
                <section className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-gray-100 dark:border-[#2a2a2a] shadow-sm dark:shadow-none p-5 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                            <h2 className="text-base font-black text-gray-900 dark:text-white">인도 위임장 발행</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">대리인(기사)과 화물 정보를 입력하면 우측에 위임장이 실시간으로 만들어집니다.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button type="button" onClick={handlePrint} className={`${primaryButtonClass} inline-flex items-center gap-1.5`}>
                                <Printer size={14} /> 출력 (PDF 저장/인쇄)
                            </button>
                            {leftTab === 'write' && (
                                <>
                                    <button type="button" onClick={resetDraft} className={secondaryButtonClass}>초기화</button>
                                    <button type="button" onClick={handleIssue} disabled={isIssuing} className={primaryButtonClass}>
                                        {isIssuing ? '발행 중...' : '발행하기'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">인쇄창에서 &quot;PDF로 저장&quot;을 선택하면 PDF 파일로 저장됩니다. 머리글/바닥글을 해제하면 날짜/URL 표시가 사라집니다.</p>

                    <div className="inline-flex rounded-xl border border-gray-200 dark:border-[#2a2a2a] p-1 bg-gray-50 dark:bg-[#1a1a1a]">
                        <button
                            type="button"
                            onClick={() => setLeftTab('write')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${leftTab === 'write' ? 'bg-[#e53b19] text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#252525]'}`}
                        >
                            위임장 작성
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setLeftTab('issued')
                                if (!activeProxyId && proxies[0]) setActiveProxyId(proxies[0].id)
                            }}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${leftTab === 'issued' ? 'bg-[#e53b19] text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#252525]'}`}
                        >
                            발행 리스트 ({proxies.length})
                        </button>
                    </div>

                    {leftTab === 'write' ? (
                        <div className="space-y-4">
                            <div className="bg-gray-50 dark:bg-[#1a1a1a] rounded-xl p-3 border border-gray-100 dark:border-[#2a2a2a] space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                    <label className={labelClass}>대리인 (기사)</label>
                                    <button
                                        type="button"
                                        onClick={handleSaveDraftDriver}
                                        className="text-[11px] font-bold text-[#e53b19] hover:underline"
                                    >
                                        입력한 대리인을 기사 목록에 저장
                                    </button>
                                </div>
                                <select
                                    value={selectedDriverId}
                                    onChange={(event) => {
                                        const driver = drivers.find((item) => item.id === event.target.value)
                                        if (driver) applyDriverToDraft(driver)
                                        else updateDraft({ driverId: '' })
                                    }}
                                    className="w-full bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#2a2a2a] rounded-xl p-2.5 text-sm font-bold dark:text-white focus:ring-[#e53b19] focus:border-[#e53b19]"
                                >
                                    <option value="">기사 목록에서 선택 (또는 아래에 직접 입력)</option>
                                    {drivers.map((driver) => (
                                        <option key={driver.id} value={driver.id}>
                                            {driver.name} · {driver.phone || '-'} · {driver.vehicleNo || '-'}
                                        </option>
                                    ))}
                                </select>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className={labelClass}>대리인 이름</label>
                                        <input type="text" value={draft.driverName} onChange={(event) => updateDraft({ driverName: event.target.value })} className={inputClass} placeholder="윤정국" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>대리인 연락처</label>
                                        <input type="tel" value={draft.driverPhone} onChange={(event) => updateDraft({ driverPhone: event.target.value })} className={inputClass} placeholder="010-0000-0000" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>대리인 차량정보</label>
                                        <input type="text" value={draft.driverVehicle} onChange={(event) => updateDraft({ driverVehicle: event.target.value })} className={inputClass} placeholder="부산 90자 4951" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-50 dark:bg-[#1a1a1a] rounded-xl p-3 border border-gray-100 dark:border-[#2a2a2a] space-y-3">
                                <label className={labelClass}>화물 정보</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className={labelClass}>B/L 번호 (또는 AWB 번호)</label>
                                        <input
                                            type="text"
                                            list="cargo-proxy-awb-list"
                                            value={draft.blNumber}
                                            onChange={(event) => updateDraft({ blNumber: event.target.value })}
                                            className={inputClass}
                                            placeholder="112-9114-6230"
                                        />
                                        <datalist id="cargo-proxy-awb-list">
                                            {recentAwbNumbers.map((awb) => <option key={awb} value={awb} />)}
                                        </datalist>
                                    </div>
                                    <div>
                                        <label className={labelClass}>날짜</label>
                                        <input type="date" value={draft.issueDate} onChange={(event) => updateDraft({ issueDate: event.target.value })} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>화물명</label>
                                        <input type="text" value={draft.cargoName} onChange={(event) => updateDraft({ cargoName: event.target.value })} className={inputClass} placeholder={CARGO_PROXY_DEFAULT_CARGO_NAME} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>수량</label>
                                        <input type="text" value={draft.quantityText} onChange={(event) => updateDraft({ quantityText: event.target.value })} className={inputClass} placeholder="12박스 (144kg)" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-50 dark:bg-[#1a1a1a] rounded-xl p-3 border border-gray-100 dark:border-[#2a2a2a]">
                                <button
                                    type="button"
                                    onClick={() => setShowPrincipal((prev) => !prev)}
                                    className="w-full flex items-center justify-between text-left"
                                >
                                    <span className={labelClass}>위임인 (수입자) 정보</span>
                                    <span className="text-[11px] font-bold text-gray-400">{showPrincipal ? '접기' : `${draft.principalName} · 수정`}</span>
                                </button>
                                {showPrincipal && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                        <div>
                                            <label className={labelClass}>위임인 이름</label>
                                            <input type="text" value={draft.principalName} onChange={(event) => updateDraft({ principalName: event.target.value })} className={inputClass} />
                                        </div>
                                        <div>
                                            <label className={labelClass}>위임인 전화번호</label>
                                            <input type="tel" value={draft.principalPhone} onChange={(event) => updateDraft({ principalPhone: event.target.value })} className={inputClass} />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className={labelClass}>위임인 주소</label>
                                            <input type="text" value={draft.principalAddress} onChange={(event) => updateDraft({ principalAddress: event.target.value })} className={inputClass} />
                                        </div>
                                        <div>
                                            <label className={labelClass}>사업자등록번호</label>
                                            <input type="text" value={draft.principalBusinessNo} onChange={(event) => updateDraft({ principalBusinessNo: event.target.value })} className={inputClass} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto border border-gray-100 dark:border-[#2a2a2a] rounded-xl">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-[#2a2a2a] text-gray-600 dark:text-gray-400 text-xs">
                                    <tr>
                                        <th className="px-3 py-2 text-left">날짜</th>
                                        <th className="px-3 py-2 text-left">문서번호</th>
                                        <th className="px-3 py-2 text-left">B/L 번호</th>
                                        <th className="px-3 py-2 text-left">대리인</th>
                                        <th className="px-3 py-2 text-left">차량</th>
                                        <th className="px-3 py-2 text-center">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-[#2a2a2a]">
                                    {proxies.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-3 py-8 text-center text-xs text-gray-400">발행된 위임장이 없습니다.</td>
                                        </tr>
                                    )}
                                    {proxies.map((proxy) => {
                                        const isActive = proxy.id === activeProxyId
                                        return (
                                            <tr
                                                key={proxy.id}
                                                onClick={() => setActiveProxyId(proxy.id)}
                                                className={`cursor-pointer transition-colors ${isActive ? 'bg-[#e53b19]/5 dark:bg-[#e53b19]/10' : 'hover:bg-gray-50 dark:hover:bg-[#252525]'}`}
                                            >
                                                <td className="px-3 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">{formatProxyDate(proxy.issueDate)}</td>
                                                <td className="px-3 py-2 whitespace-nowrap font-bold text-gray-900 dark:text-white">{proxy.documentNo}</td>
                                                <td className="px-3 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">{proxy.blNumber}</td>
                                                <td className="px-3 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">{proxy.driverName}</td>
                                                <td className="px-3 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">{proxy.driverVehicle || '-'}</td>
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={(event) => { event.stopPropagation(); loadProxyIntoDraft(proxy) }}
                                                            className="p-1.5 rounded-lg text-gray-400 hover:text-[#e53b19] hover:bg-gray-100 dark:hover:bg-[#2a2a2a]"
                                                            title="이 내용으로 새로 작성"
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(event) => { event.stopPropagation(); void handleDeleteProxy(proxy) }}
                                                            disabled={deletingProxyId === proxy.id}
                                                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] disabled:opacity-50"
                                                            title="삭제"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                <section className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-gray-100 dark:border-[#2a2a2a] shadow-sm dark:shadow-none p-5 space-y-4">
                    <div>
                        <h2 className="text-base font-black text-gray-900 dark:text-white">기사 관리</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">자주 쓰는 기사를 등록해 두면 위임장 작성 시 바로 선택할 수 있습니다.</p>
                    </div>

                    <div className="bg-gray-50 dark:bg-[#1a1a1a] rounded-xl p-3 border border-gray-100 dark:border-[#2a2a2a]">
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
                            <div>
                                <label className={labelClass}>이름</label>
                                <input type="text" value={driverForm.name} onChange={(event) => setDriverForm((prev) => ({ ...prev, name: event.target.value }))} className={inputClass} placeholder="기사 이름" />
                            </div>
                            <div>
                                <label className={labelClass}>연락처</label>
                                <input type="tel" value={driverForm.phone} onChange={(event) => setDriverForm((prev) => ({ ...prev, phone: event.target.value }))} className={inputClass} placeholder="010-0000-0000" />
                            </div>
                            <div>
                                <label className={labelClass}>차량번호</label>
                                <input type="text" value={driverForm.vehicleNo} onChange={(event) => setDriverForm((prev) => ({ ...prev, vehicleNo: event.target.value }))} className={inputClass} placeholder="부산 90자 4951" />
                            </div>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={handleSaveDriver} disabled={isSavingDriver} className={`${primaryButtonClass} inline-flex items-center gap-1 whitespace-nowrap`}>
                                    <Plus size={14} /> {editingDriverId ? '수정 저장' : '기사 추가'}
                                </button>
                                {editingDriverId && (
                                    <button type="button" onClick={cancelEditDriver} className={secondaryButtonClass} title="수정 취소">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto border border-gray-100 dark:border-[#2a2a2a] rounded-xl">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-[#2a2a2a] text-gray-600 dark:text-gray-400 text-xs">
                                <tr>
                                    <th className="px-3 py-2 text-left">이름</th>
                                    <th className="px-3 py-2 text-left">연락처</th>
                                    <th className="px-3 py-2 text-left">차량번호</th>
                                    <th className="px-3 py-2 text-center">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-[#2a2a2a]">
                                {drivers.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-3 py-8 text-center text-xs text-gray-400">등록된 기사가 없습니다.</td>
                                    </tr>
                                )}
                                {drivers.map((driver) => (
                                    <tr key={driver.id} className={draft.driverId === driver.id ? 'bg-[#e53b19]/5 dark:bg-[#e53b19]/10' : ''}>
                                        <td className="px-3 py-2 font-bold text-gray-900 dark:text-white whitespace-nowrap">{driver.name}</td>
                                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{driver.phone || '-'}</td>
                                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{driver.vehicleNo || '-'}</td>
                                        <td className="px-3 py-2">
                                            <div className="flex items-center justify-center gap-1">
                                                <button type="button" onClick={() => applyDriverToDraft(driver)} className="p-1.5 rounded-lg text-gray-400 hover:text-[#e53b19] hover:bg-gray-100 dark:hover:bg-[#2a2a2a]" title="위임장 대리인으로 선택">
                                                    <UserRoundCheck size={14} />
                                                </button>
                                                <button type="button" onClick={() => startEditDriver(driver)} className="p-1.5 rounded-lg text-gray-400 hover:text-[#e53b19] hover:bg-gray-100 dark:hover:bg-[#2a2a2a]" title="수정">
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleDeleteDriver(driver)}
                                                    disabled={deletingDriverId === driver.id}
                                                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] disabled:opacity-50"
                                                    title="삭제"
                                                >
                                                    <Trash2 size={14} />
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

            <section className="xl:sticky xl:top-20">
                <div className="mb-3 text-xs font-black text-[#e53b19] tracking-wide">
                    실시간 인쇄 미리보기{leftTab === 'issued' && activeProxy ? ` · ${activeProxy.documentNo}` : ''}
                </div>
                <div ref={sheetRef} className="overflow-x-auto rounded-sm shadow-lg ring-1 ring-gray-200 dark:ring-[#2a2a2a] w-fit max-w-full">
                    <ProxySheet doc={previewDoc} />
                </div>
            </section>
        </div>
    )
}
