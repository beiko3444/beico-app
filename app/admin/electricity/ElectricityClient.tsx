'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'

type BillData = {
    year: number
    month: number
    readingDate: string
    usagePeriod: string
    meterCurrent: string
    meterPrevious: string
    currentUsage: number
    totalAmount: number
    parsedDetails: Record<string, number>
}

type LandlordData = {
    prevMeter: number
    currMeter: number
    waterHeaterKw: number
    outdoorLightKw: number
    photo: string | null
}

type DetailKey =
    | 'baseFee'
    | 'usageFee'
    | 'envFee'
    | 'fuelFee'
    | 'powerFactorFee'
    | 'tvFee'
    | 'vat'
    | 'fund'

type PaymentChecklistStatus = {
    rentTaxInvoiceIssued: boolean
    electricityPaid: boolean
    electricityPaidAt: string | null
}

const PAYMENT_STORAGE_KEY = 'beico-payment-checklist-v1'
const PAYMENT_START_YEAR = 2025

export default function ElectricityClient() {
    const today = new Date()
    const [selectedYear, setSelectedYear] = useState(Math.max(today.getFullYear(), PAYMENT_START_YEAR))
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1)
    const [activeTab, setActiveTab] = useState<'analysis' | 'payment'>('analysis')

    const [billData, setBillData] = useState<BillData | null>(null)
    const [landlordData, setLandlordData] = useState<LandlordData | null>(null)
    const [prevMonthPhoto, setPrevMonthPhoto] = useState<string | null>(null)

    // UI States
    const [isUsageModalOpen, setIsUsageModalOpen] = useState(false)
    const [isLandlordModalOpen, setIsLandlordModalOpen] = useState(false)
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false)
    const [isInvoiceOpen, setIsInvoiceOpen] = useState(false)
    const [rawText, setRawText] = useState('')
    const [extractionHistory, setExtractionHistory] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [prevMonthData, setPrevMonthData] = useState<any>(null)
    const [invoiceRemarks, setInvoiceRemarks] = useState('')
    const [paymentChecklist, setPaymentChecklist] = useState<Record<string, PaymentChecklistStatus>>({})
    const [monthlyLandlordTotals, setMonthlyLandlordTotals] = useState<Record<number, number | null>>({})

    // Landlord Input States
    const [landlordInputs, setLandlordInputs] = useState({
        prevMeter: '',
        currMeter: '',
        waterHeaterKw: '',
        outdoorLightKw: '110'
    })
    const [landlordPhoto, setLandlordPhoto] = useState<string | null>(null)

    // Manual Input States (for Usage Modal persistence)
    const [manualInputs, setManualInputs] = useState({
        totalAmount: '',
        currentUsage: '',
        baseFee: '',
        usageFee: '',
        envFee: '',
        fuelFee: '',
        powerFactorFee: '',
        tvFee: '',
        vat: '',
        fund: '',
        readingDate: '',
        usagePeriod: '',
        meterCurrent: '',
        meterPrevious: ''
    })

    const formatWithCommas = (val: string | number) => {
        const s = String(val).replace(/[^0-9-]/g, '');
        if (!s) return '';
        return parseInt(s, 10).toLocaleString();
    };

    const legacyDetailKeys: Record<DetailKey, string[]> = {
        baseFee: ['旮半掣?旉笀'],
        usageFee: ['?勲牓?夓殧旮?', ''],
        envFee: ['旮绊泟?橁步?旉笀'],
        fuelFee: ['?半牍勳“?曥暋'],
        powerFactorFee: ['???旉笀'],
        tvFee: ['TV?橃嫚耄?', ''],
        vat: ['攵€臧€臧€旃橃劯'],
        fund: ['?勲牓旮瓣笀']
    }

    const parseNumber = (value: unknown) => {
        const num = Number(value)
        return Number.isFinite(num) ? num : 0
    }

    const getParsedAmount = (source: Record<string, unknown> | null | undefined, key: DetailKey) => {
        if (!source) return 0
        const candidates = [key, ...legacyDetailKeys[key]]
        for (const candidate of candidates) {
            if (candidate in source) {
                return parseNumber(source[candidate])
            }
        }
        return 0
    }

    const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`

    const defaultPaymentStatus: PaymentChecklistStatus = {
        rentTaxInvoiceIssued: false,
        electricityPaid: false,
        electricityPaidAt: null
    }

    const yearOptions = Array.from(
        { length: Math.max(today.getFullYear() + 1 - PAYMENT_START_YEAR + 1, 1) },
        (_, idx) => PAYMENT_START_YEAR + idx
    )

    const getPaymentStatus = (year: number, month: number) => {
        return paymentChecklist[monthKey(year, month)] || defaultPaymentStatus
    }

    const updatePaymentStatus = (
        year: number,
        month: number,
        updater: (prev: PaymentChecklistStatus) => PaymentChecklistStatus
    ) => {
        const key = monthKey(year, month)
        setPaymentChecklist(prev => {
            const nextStatus = updater(prev[key] || defaultPaymentStatus)
            return { ...prev, [key]: nextStatus }
        })
    }

    // Fetch data when Year/Month changes
    useEffect(() => {
        const fetchData = async () => {
            setBillData(null)
            setLandlordData(null)
            setPrevMonthPhoto(null)
            setRawText('')
            setExtractionHistory([])
            setLandlordInputs({
                prevMeter: '',
                currMeter: '',
                waterHeaterKw: '',
                outdoorLightKw: '110'
            })

            try {
                // 1. Fetch Current Month
                const res = await fetch(`/api/admin/electricity?year=${selectedYear}&month=${selectedMonth}`)
                if (res.ok) {
                    const data = await res.json()
                    if (data && data.year) {
                        const parsed = data.rawBillData ? JSON.parse(data.rawBillData) : {}
                        setBillData({
                            year: data.year,
                            month: data.month,
                            readingDate: data.readingDate,
                            usagePeriod: data.usagePeriod,
                            meterCurrent: data.meterCurrent,
                            meterPrevious: data.meterPrevious,
                            currentUsage: data.totalUsage,
                            totalAmount: data.totalAmount,
                            parsedDetails: parsed
                        })

                        // Load into Manual Inputs for Editing
                        setManualInputs({
                            totalAmount: formatWithCommas(data.totalAmount),
                            currentUsage: formatWithCommas(data.totalUsage),
                            baseFee: formatWithCommas(getParsedAmount(parsed, 'baseFee')),
                            usageFee: formatWithCommas(getParsedAmount(parsed, 'usageFee')),
                            envFee: formatWithCommas(getParsedAmount(parsed, 'envFee')),
                            fuelFee: formatWithCommas(getParsedAmount(parsed, 'fuelFee')),
                            powerFactorFee: formatWithCommas(getParsedAmount(parsed, 'powerFactorFee')),
                            tvFee: formatWithCommas(getParsedAmount(parsed, 'tvFee')),
                            vat: formatWithCommas(getParsedAmount(parsed, 'vat')),
                            fund: formatWithCommas(getParsedAmount(parsed, 'fund')),
                            readingDate: data.readingDate || '',
                            usagePeriod: data.usagePeriod || '',
                            meterCurrent: data.meterCurrent || '',
                            meterPrevious: data.meterPrevious || ''
                        })

                        if (data.landlordMeterCurr !== null) {
                            setLandlordData({
                                prevMeter: data.landlordMeterPrev || 0,
                                currMeter: data.landlordMeterCurr || 0,
                                waterHeaterKw: data.waterHeaterKw || 0,
                                outdoorLightKw: data.outdoorLightKw || 0,
                                photo: data.meterPhotoUrl || null
                            })
                            // Init inputs
                            setLandlordInputs({
                                prevMeter: formatWithCommas(data.landlordMeterPrev || 0),
                                currMeter: formatWithCommas(data.landlordMeterCurr || 0),
                                waterHeaterKw: formatWithCommas(data.waterHeaterKw || 0),
                                outdoorLightKw: formatWithCommas(data.outdoorLightKw || 0)
                            })
                            setLandlordPhoto(data.meterPhotoUrl || null)
                        }

                        setRawText(data.rawText || '')
                        if (data.extractionHistory) {
                            try {
                                setExtractionHistory(JSON.parse(data.extractionHistory))
                            } catch (e) {
                                setExtractionHistory([])
                            }
                        } else {
                            setExtractionHistory([])
                        }
                    } else {
                        // Reset if no data
                        setRawText('')
                        setExtractionHistory([])
                        setManualInputs({
                            totalAmount: '',
                            currentUsage: '',
                            baseFee: '',
                            usageFee: '',
                            envFee: '',
                            fuelFee: '',
                            powerFactorFee: '',
                            tvFee: '',
                            vat: '',
                            fund: '',
                            readingDate: '',
                            usagePeriod: '',
                            meterCurrent: '',
                            meterPrevious: ''
                        })
                    }
                }

                // 2. Fetch Previous Month for Photo and Comparison
                let prevYear = selectedYear
                let prevMonth = selectedMonth - 1
                if (prevMonth < 1) {
                    prevMonth = 12
                    prevYear -= 1
                }
                const resPrev = await fetch(`/api/admin/electricity?year=${prevYear}&month=${prevMonth}`)
                if (resPrev.ok) {
                    const prevData = await resPrev.json()
                    if (prevData && prevData.year) {
                        setPrevMonthData(prevData)
                        if (prevData.meterPhotoUrl) {
                            setPrevMonthPhoto(prevData.meterPhotoUrl)
                        }
                        // Set previous meter reading for landlord if current month data doesn't exist or doesn't have it
                        if (prevData.landlordMeterCurr !== undefined) {
                            setLandlordInputs(p => ({
                                ...p,
                                prevMeter: formatWithCommas(prevData.landlordMeterCurr || 0)
                            }))
                        }
                    } else {
                        setPrevMonthData(null)
                    }
                }

            } catch (e) {
                console.error("Failed to fetch data", e)
            }
        }
        fetchData()
    }, [selectedYear, selectedMonth])

    useEffect(() => {
        if (typeof window === 'undefined') return
        try {
            const raw = window.localStorage.getItem(PAYMENT_STORAGE_KEY)
            if (!raw) return
            const parsed = JSON.parse(raw)
            if (parsed && typeof parsed === 'object') {
                setPaymentChecklist(parsed)
            }
        } catch (error) {
            console.error('Failed to restore payment checklist', error)
        }
    }, [])

    useEffect(() => {
        if (typeof window === 'undefined') return
        window.localStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(paymentChecklist))
    }, [paymentChecklist])

    useEffect(() => {
        if (activeTab !== 'payment') return

        const fetchMonthlyLandlordTotals = async () => {
            try {
                const monthEntries = await Promise.all(
                    Array.from({ length: 12 }, (_, idx) => idx + 1).map(async (month) => {
                        const res = await fetch(`/api/admin/electricity?year=${selectedYear}&month=${month}`)
                        if (!res.ok) return [month, null] as const

                        const data = await res.json()
                        if (!data || !data.year || !data.rawBillData) return [month, null] as const

                        try {
                            const parsedRaw = JSON.parse(data.rawBillData)
                            const amount = typeof parsedRaw.landlordTotal === 'number' ? parsedRaw.landlordTotal : null
                            return [month, amount] as const
                        } catch {
                            return [month, null] as const
                        }
                    })
                )

                setMonthlyLandlordTotals(Object.fromEntries(monthEntries))
            } catch (error) {
                console.error('Failed to fetch monthly landlord totals', error)
            }
        }

        fetchMonthlyLandlordTotals()
    }, [activeTab, selectedYear])

    const saveData = async (bData: BillData | null, lData: LandlordData | null, currentRawText?: string, currentHistory?: any[]) => {
        setLoading(true)
        try {
            const shares = calculateCurrentShares(bData, lData)

            const payload = {
                year: bData ? bData.year : selectedYear,
                month: bData ? bData.month : selectedMonth,
                readingDate: bData ? bData.readingDate : null,
                usagePeriod: bData ? bData.usagePeriod : null,
                meterCurrent: bData ? bData.meterCurrent : null,
                meterPrevious: bData ? bData.meterPrevious : null,
                totalUsage: bData ? bData.currentUsage : null,
                totalAmount: bData ? bData.totalAmount : null,
                rawBillData: bData ? JSON.stringify({
                    ...bData.parsedDetails,
                    beicoTotal: shares.beicoTotal,
                    landlordTotal: shares.landlordTotal
                }) : null,
                landlordMeterPrev: lData ? lData.prevMeter : null,
                landlordMeterCurr: lData ? lData.currMeter : null,
                landlordUsage: lData ? (lData.currMeter - lData.prevMeter + lData.waterHeaterKw + lData.outdoorLightKw) : null,
                waterHeaterKw: lData ? lData.waterHeaterKw : null,
                outdoorLightKw: lData ? lData.outdoorLightKw : null,
                meterPhotoUrl: lData ? lData.photo : null,
                rawText: currentRawText !== undefined ? currentRawText : rawText,
                extractionHistory: JSON.stringify(currentHistory !== undefined ? currentHistory : extractionHistory)
            }

            const res = await fetch('/api/admin/electricity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (!res.ok) {
                const err = await res.json()
                alert(`????ㅽ뙣: ${err.error}`)
            }
        } catch (e) {
            console.error(e)
            alert('???以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.')
        } finally {
            setLoading(false)
        }
    }

    const parseBillText = async () => {
        try {
            const getNum = (keyword: string) => {
                const regex = new RegExp(`${keyword}\\s*([\\d,]+)`)
                const match = rawText.match(regex)
                return match ? parseInt(match[1].replace(/,/g, '')) : 0
            }
            const getStr = (keyword: string) => {
                const regex = new RegExp(`${keyword}\\s*([\\d,.~\\- a-zA-Z]+)`)
                const match = rawText.match(regex)
                return match ? match[1].trim() : ''
            }
            const getSignedNum = (keyword: string) => {
                const regex = new RegExp(`${keyword}\\s*([-\\d,]+)`)
                const match = rawText.match(regex)
                return match ? parseInt(match[1].replace(/,/g, '')) : 0
            }

            if (!rawText.trim()) return

            const total = rawText.match(/([\d,]+)\s*원/)?.[1]
                ? parseInt(rawText.match(/([\d,]+)\s*원/)![1].replace(/,/g, ''))
                : 0

            const inputs = {
                totalAmount: formatWithCommas(total || 0),
                currentUsage: formatWithCommas(getNum('사용량')),
                baseFee: formatWithCommas(getNum('기본요금')),
                usageFee: formatWithCommas(getNum('전력량요금')),
                envFee: formatWithCommas(getNum('기후환경요금')),
                fuelFee: formatWithCommas(getSignedNum('연료비조정액')),
                powerFactorFee: formatWithCommas(getSignedNum('역률요금')),
                tvFee: formatWithCommas(getNum('TV수신료')),
                vat: formatWithCommas(getNum('부가가치세')),
                fund: formatWithCommas(getNum('전력기금')),
                readingDate: getStr('검침일'),
                usagePeriod: getStr('사용기간'),
                meterCurrent: manualInputs.meterCurrent,
                meterPrevious: manualInputs.meterPrevious,
            }
            setManualInputs(inputs)

            const newHistoryItem = {
                id: Date.now().toString(),
                timestamp: new Date().toLocaleString(),
                rawText,
                inputs
            }
            setExtractionHistory(prev => [newHistoryItem, ...prev])
        } catch (e) {
            alert('텍스트 분석 오류')
        }
    }
    const deleteHistoryItem = (id: string) => {
        setExtractionHistory(prev => prev.filter(item => item.id !== id))
    }

    const resetManualInputs = () => {
        setManualInputs({
            totalAmount: '',
            currentUsage: '',
            baseFee: '',
            usageFee: '',
            envFee: '',
            fuelFee: '',
            powerFactorFee: '',
            tvFee: '',
            vat: '',
            fund: '',
            readingDate: '',
            usagePeriod: '',
            meterCurrent: '',
            meterPrevious: ''
        })
    }

    const confirmBillInput = async () => {
        const parsedDetails = {
            baseFee: parseInt(manualInputs.baseFee.replace(/,/g, '')) || 0,
            usageFee: parseInt(manualInputs.usageFee.replace(/,/g, '')) || 0,
            envFee: parseInt(manualInputs.envFee.replace(/,/g, '')) || 0,
            fuelFee: parseInt(manualInputs.fuelFee.replace(/,/g, '')) || 0,
            powerFactorFee: parseInt(manualInputs.powerFactorFee.replace(/,/g, '')) || 0,
            tvFee: parseInt(manualInputs.tvFee.replace(/,/g, '')) || 0,
            vat: parseInt(manualInputs.vat.replace(/,/g, '')) || 0,
            fund: parseInt(manualInputs.fund.replace(/,/g, '')) || 0,
        }

        const newData: BillData = {
            year: selectedYear,
            month: selectedMonth,
            readingDate: manualInputs.readingDate,
            usagePeriod: manualInputs.usagePeriod,
            meterCurrent: manualInputs.meterCurrent,
            meterPrevious: manualInputs.meterPrevious,
            currentUsage: parseInt(manualInputs.currentUsage.replace(/,/g, '')) || 0,
            totalAmount: parseInt(manualInputs.totalAmount.replace(/,/g, '')) || 0,
            parsedDetails: parsedDetails
        }

        setBillData(newData)
        await saveData(newData, landlordData, rawText, extractionHistory)
        setIsUsageModalOpen(false)
    }
    const calculateLandlordBill = async () => {
        const prev = parseFloat(landlordInputs.prevMeter.replace(/,/g, '')) || 0
        const curr = parseFloat(landlordInputs.currMeter.replace(/,/g, '')) || 0
        const water = parseFloat(landlordInputs.waterHeaterKw.replace(/,/g, '')) || 0
        const light = parseFloat(landlordInputs.outdoorLightKw.replace(/,/g, '')) || 0

        const newLandlordData = {
            prevMeter: prev,
            currMeter: curr,
            waterHeaterKw: water,
            outdoorLightKw: light,
            photo: landlordPhoto
        }

        setLandlordData(newLandlordData)
        setIsLandlordModalOpen(false)
        await saveData(billData, newLandlordData, rawText, extractionHistory)
    }

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (ev) => {
            const img = new Image()
            img.onload = () => {
                const canvas = document.createElement('canvas')
                // Resize to max 800px while maintaining aspect ratio
                const MAX_WIDTH = 800
                const MAX_HEIGHT = 800
                let width = img.width
                let height = img.height

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width
                        width = MAX_WIDTH
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height
                        height = MAX_HEIGHT
                    }
                }

                canvas.width = width
                canvas.height = height
                const ctx = canvas.getContext('2d')
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height)
                    const base64 = canvas.toDataURL('image/jpeg', 0.7) // Compress to 70% quality
                    setLandlordPhoto(base64)
                }
            }
            img.src = ev.target?.result as string
        }
        reader.readAsDataURL(file)
    }

    const calculateCurrentShares = (bData: BillData | null, lData: LandlordData | null) => {
        if (!bData) return { landlordTotal: 0, beicoTotal: 0 }
        const baseTotal = getParsedAmount(bData.parsedDetails, 'baseFee')
        const usageTotal = getParsedAmount(bData.parsedDetails, 'usageFee')
        const envTotal = getParsedAmount(bData.parsedDetails, 'envFee')
        const fuelTotal = getParsedAmount(bData.parsedDetails, 'fuelFee')
        const powerFactorTotal = getParsedAmount(bData.parsedDetails, 'powerFactorFee')
        const tvTotal = getParsedAmount(bData.parsedDetails, 'tvFee')
        const totalVat = getParsedAmount(bData.parsedDetails, 'vat')
        const totalFund = getParsedAmount(bData.parsedDetails, 'fund')

        const landlordBaseCost = Math.round(baseTotal * (20 / 30))
        const landlordUsageKwh = lData ? (lData.currMeter - lData.prevMeter) + lData.waterHeaterKw + lData.outdoorLightKw : 0
        const totalKwh = bData.currentUsage || 0
        const usageRatioLandlord = totalKwh > 0 ? (landlordUsageKwh / totalKwh) : 0

        const landlordUsageCost = Math.round(usageTotal * usageRatioLandlord)
        const landlordEnvCost = Math.round(envTotal * usageRatioLandlord)
        const landlordFuelCost = Math.round(fuelTotal * usageRatioLandlord)
        const landlordPowerFactor = Math.round(powerFactorTotal * usageRatioLandlord)
        const landlordTvFee = Math.round(tvTotal / 2)

        const landlordSubTotal = landlordBaseCost + landlordUsageCost + landlordEnvCost + landlordFuelCost + landlordPowerFactor
        const beicoSubTotal = (baseTotal - landlordBaseCost) + (usageTotal - landlordUsageCost) + (envTotal - landlordEnvCost) + (fuelTotal - landlordFuelCost) + (powerFactorTotal - landlordPowerFactor)

        const totalBillingAmount = landlordSubTotal + beicoSubTotal
        const taxRatioLandlord = totalBillingAmount !== 0 ? (landlordSubTotal / totalBillingAmount) : 0

        const landlordVat = Math.round(totalVat * taxRatioLandlord)
        const landlordFund = Math.round(totalFund * taxRatioLandlord)

        const landlordTotal = landlordSubTotal + landlordVat + landlordFund + landlordTvFee
        const beicoTotal = bData.totalAmount - landlordTotal

        return { landlordTotal, beicoTotal }
    }

    const prevShares = prevMonthData ? calculateSharesFromRecord(prevMonthData) : { beicoTotal: 0, landlordTotal: 0 }

    function calculateSharesFromRecord(record: any) {
        if (!record) return { beicoTotal: 0, landlordTotal: 0 }
        let parsed: any = {}
        try { parsed = JSON.parse(record.rawBillData || '{}') } catch { }

        if (parsed.beicoTotal !== undefined) {
            return { beicoTotal: parsed.beicoTotal, landlordTotal: parsed.landlordTotal }
        }
        const baseTotal = getParsedAmount(parsed, 'baseFee')
        const usageTotal = getParsedAmount(parsed, 'usageFee')
        const envTotal = getParsedAmount(parsed, 'envFee')
        const fuelTotal = getParsedAmount(parsed, 'fuelFee')
        const powerFactorTotal = getParsedAmount(parsed, 'powerFactorFee')
        const tvTotal = getParsedAmount(parsed, 'tvFee')
        const totalVat = getParsedAmount(parsed, 'vat')
        const totalFund = getParsedAmount(parsed, 'fund')

        const landlordBaseCost = Math.round(baseTotal * (20 / 30))
        const landlordUsageKwh = record.landlordUsage || 0
        const totalKwh = record.totalUsage || 1
        const usageRatioLandlord = landlordUsageKwh / totalKwh

        const landlordUsageCost = Math.round(usageTotal * usageRatioLandlord)
        const landlordEnvCost = Math.round(envTotal * usageRatioLandlord)
        const landlordFuelCost = Math.round(fuelTotal * usageRatioLandlord)
        const landlordPowerFactor = Math.round(powerFactorTotal * usageRatioLandlord)
        const landlordTvFee = Math.round(tvTotal / 2)

        const landlordSubTotal = landlordBaseCost + landlordUsageCost + landlordEnvCost + landlordFuelCost + landlordPowerFactor
        const beicoSubTotal = (baseTotal - landlordBaseCost) + (usageTotal - landlordUsageCost) + (envTotal - landlordEnvCost) + (fuelTotal - landlordFuelCost) + (powerFactorTotal - landlordPowerFactor)

        const totalBillingAmount = landlordSubTotal + beicoSubTotal
        const taxRatioLandlord = totalBillingAmount !== 0 ? (landlordSubTotal / totalBillingAmount) : 0

        const landlordVat = Math.round(totalVat * taxRatioLandlord)
        const landlordFund = Math.round(totalFund * taxRatioLandlord)

        const landlordTotal = landlordSubTotal + landlordVat + landlordFund + landlordTvFee
        const beicoTotal = record.totalAmount - landlordTotal

        return { beicoTotal, landlordTotal }
    }

    // --- Calculations ---
    const baseTotal = getParsedAmount(billData?.parsedDetails, 'baseFee')
    const usageTotal = getParsedAmount(billData?.parsedDetails, 'usageFee')
    const envTotal = getParsedAmount(billData?.parsedDetails, 'envFee')
    const fuelTotal = getParsedAmount(billData?.parsedDetails, 'fuelFee')
    const powerFactorTotal = getParsedAmount(billData?.parsedDetails, 'powerFactorFee')
    const tvTotal = getParsedAmount(billData?.parsedDetails, 'tvFee')
    const totalVat = getParsedAmount(billData?.parsedDetails, 'vat')
    const totalFund = getParsedAmount(billData?.parsedDetails, 'fund')

    const landlordBaseCost = Math.round(baseTotal * (20 / 30))
    const beicoBaseCost = baseTotal - landlordBaseCost

    const landlordUsageKwh = landlordData
        ? (landlordData.currMeter - landlordData.prevMeter) + landlordData.waterHeaterKw + landlordData.outdoorLightKw
        : 0
    const totalKwh = billData?.currentUsage || 1
    const beicoUsageKwh = Math.max(0, totalKwh - landlordUsageKwh)

    const usageRatioLandlord = totalKwh > 0 ? (landlordUsageKwh / totalKwh) : 0

    const landlordUsageCost = Math.round(usageTotal * usageRatioLandlord)
    const beicoUsageCost = usageTotal - landlordUsageCost

    const landlordEnvCost = Math.round(envTotal * usageRatioLandlord)
    const beicoEnvCost = envTotal - landlordEnvCost

    const landlordFuelCost = Math.round(fuelTotal * usageRatioLandlord)
    const beicoFuelCost = fuelTotal - landlordFuelCost

    const landlordPowerFactor = Math.round(powerFactorTotal * usageRatioLandlord)
    const beicoPowerFactor = powerFactorTotal - landlordPowerFactor

    const landlordTvFee = Math.round(tvTotal / 2)
    const beicoTvFee = tvTotal - landlordTvFee

    const landlordSubTotal = landlordBaseCost + landlordUsageCost + landlordEnvCost + landlordFuelCost + landlordPowerFactor
    const beicoSubTotal = beicoBaseCost + beicoUsageCost + beicoEnvCost + beicoFuelCost + beicoPowerFactor

    const totalBillingAmount = landlordSubTotal + beicoSubTotal
    const taxRatioLandlord = totalBillingAmount !== 0 ? (landlordSubTotal / totalBillingAmount) : 0

    const landlordVat = Math.round(totalVat * taxRatioLandlord)
    const beicoVat = totalVat - landlordVat

    const landlordFund = Math.round(totalFund * taxRatioLandlord)
    const beicoFund = totalFund - landlordFund

    const sumOfParts = baseTotal + usageTotal + envTotal + fuelTotal + powerFactorTotal + totalVat + totalFund + tvTotal
    const roundingDiff = billData && billData.totalAmount ? (billData.totalAmount - sumOfParts) : 0

    const landlordTotal = landlordSubTotal + landlordVat + landlordFund + landlordTvFee
    const beicoTotal = (beicoSubTotal + beicoVat + beicoFund + beicoTvFee) + roundingDiff

    const shareRatioLandlord = billData && billData.totalAmount > 0 ? (landlordTotal / billData.totalAmount) * 100 : 0
    const shareRatioBeico = billData && billData.totalAmount > 0 ? (beicoTotal / billData.totalAmount) * 100 : 0

    const unitCostPerKwh = totalKwh > 0 ? Math.round((billData?.totalAmount || 0) / totalKwh) : 0
    const currentPaymentStatus = getPaymentStatus(selectedYear, selectedMonth)
    const rentAutoTransferDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-14`
    const selectedMonthLandlordTotal = monthlyLandlordTotals[selectedMonth] ?? null
    const formatChecklistTimestamp = (value: string | null) => {
        if (!value) return '-'
        return new Date(value).toLocaleString('ko-KR')
    }

    return (
        <div id="electricity-main" className="space-y-8 font-sans pb-20 print:pb-0 print:space-y-0">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 border-b border-gray-100 shadow-sm transition-all">
                <div className="flex flex-col gap-4 py-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <Link href="/admin" className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-[#d9361b] transition-all">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                            </Link>
                            <h1 className="text-lg font-black text-gray-900 tracking-tight">?꾨젰 愿由?</h1>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-1 flex gap-1">
                <button
                    type="button"
                    onClick={() => setActiveTab('analysis')}
                    className={`flex-1 rounded-xl px-4 py-2 text-sm font-bold transition-all ${activeTab === 'analysis'
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                >
                    전력관리
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('payment')}
                    className={`flex-1 rounded-xl px-4 py-2 text-sm font-bold transition-all ${activeTab === 'payment'
                        ? 'bg-[#d9361b] text-white'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                >
                    납부관리
                </button>
            </div>

            {/* Month Selection */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex gap-4 items-center overflow-x-auto pb-2">
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-[#d9361b] focus:border-[#d9361b] block p-2 font-bold min-w-[100px]"
                    >
                        {yearOptions.map(y => <option key={y} value={y}>{y}년</option>)}
                    </select>
                    <div className="flex gap-2 min-w-max">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                            <button
                                key={month}
                                onClick={() => setSelectedMonth(month)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedMonth === month
                                    ? 'bg-[#d9361b] text-white shadow-md transform scale-105'
                                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                {month}??
                            </button>
                        ))}
                    </div>
                </div>

                {activeTab === 'analysis' && billData && (
                    <div className="flex flex-wrap gap-2 justify-start pt-2 border-t border-gray-50">
                        <button onClick={() => setIsPhotoModalOpen(true)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-green-700 shadow-sm">
                            怨꾨웾湲??뺤씤?섍린
                        </button>
                        <button onClick={() => setIsLandlordModalOpen(true)} className="px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs font-bold text-gray-700 transition-all border border-gray-100">
                            {landlordData ? '임대인 사용량 수정' : '임대인 사용량 입력'}
                        </button>
                        <button onClick={() => setIsUsageModalOpen(true)} className="px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs font-bold text-gray-700 transition-all border border-gray-100">
                            怨좎????섏젙
                        </button>
                        <button onClick={() => setIsInvoiceOpen(true)} className="px-5 py-2.5 bg-[#d9361b] hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm ml-auto">
                            ?뱞 泥?뎄??諛쒗뻾
                        </button>
                    </div>
                )}
            </div>

            {activeTab === 'analysis' && (billData ? (
                <>
                    {/* Total Bill Summary */}
                    <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
                        <div className="bg-gray-900 p-6 text-white flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <span>?∽툘</span> {selectedMonth}???꾧린?붽툑 珥앷큵??
                                </h2>
                                <p className="text-sm text-gray-400 mt-1">{billData.usagePeriod}</p>
                            </div>
                            <div className="text-right">
                                <div className="text-3xl font-black tracking-tight">{billData.totalAmount.toLocaleString()}??</div>
                                <div className="text-xs text-gray-400 mt-1 flex flex-col items-end gap-1">
                                    <div>珥??ъ슜?? <span className="text-white font-bold">{billData.currentUsage.toLocaleString()} kWh</span></div>
                                    {prevMonthData && (
                                        <div className="flex items-center gap-2 text-[10px]">
                                            <span>?꾩썡?鍮?</span>
                                            <span className={billData.currentUsage - prevMonthData.totalUsage >= 0 ? 'text-red-400' : 'text-blue-400'}>
                                                {billData.currentUsage - prevMonthData.totalUsage >= 0 ? '▲' : '▼'} {(Math.abs(billData.currentUsage - prevMonthData.totalUsage)).toLocaleString()} kWh
                                            </span>
                                            <span className={billData.totalAmount - prevMonthData.totalAmount >= 0 ? 'text-red-400' : 'text-blue-400'}>
                                                {billData.totalAmount - prevMonthData.totalAmount >= 0 ? '▲' : '▼'} {(Math.abs(billData.totalAmount - prevMonthData.totalAmount)).toLocaleString()} ??
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 p-5 rounded-3xl border border-gray-100 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 text-gray-100 group-hover:text-gray-200 transition-colors">
                                    <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.39 2.1-1.39 1.47 0 2.01.59 2.06 1.71h1.73c-.05-1.94-1.29-3.21-3.12-3.62V4h-1.5v2.15c-1.54.34-2.82 1.31-2.82 2.92 0 1.89 1.55 2.83 3.8 3.4 2.02.5 2.42 1.2 2.42 2.03 0 1.15-1.13 1.63-2.39 1.63-1.76 0-2.43-.88-2.51-2.11H7.28c.08 2.3 1.65 3.39 3.27 3.73V20h1.5v-2.15c1.65-.31 3.13-1.2 3.13-3.05 0-1.99-1.63-2.86-3.79-3.41z" /></svg>
                                </div>
                                <div className="text-[10px] text-gray-400 font-bold mb-1 tracking-widest uppercase">Beico Share ({shareRatioBeico.toFixed(1)}%)</div>
                                <div className="text-2xl font-black text-gray-900 tracking-tight">{beicoTotal.toLocaleString()}??</div>
                                <div className="text-xs text-gray-400 mt-1">踰좎씠肄??댁슜?붽툑</div>
                                {prevMonthData && (
                                    <div className={`text-[10px] mt-2 font-bold `}>
                                        ?꾩썡鍮?{beicoTotal - prevShares.beicoTotal >= 0 ? '▲' : '▼'}{Math.abs(beicoTotal - prevShares.beicoTotal).toLocaleString()}??
                                    </div>
                                )}
                            </div>
                            <div className="bg-red-50 p-5 rounded-3xl border border-red-100 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 text-red-100 group-hover:text-red-200 transition-colors">
                                    <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.39 2.1-1.39 1.47 0 2.01.59 2.06 1.71h1.73c-.05-1.94-1.29-3.21-3.12-3.62V4h-1.5v2.15c-1.54.34-2.82 1.31-2.82 2.92 0 1.89 1.55 2.83 3.8 3.4 2.02.5 2.42 1.2 2.42 2.03 0 1.15-1.13 1.63-2.39 1.63-1.76 0-2.43-.88-2.51-2.11H7.28c.08 2.3 1.65 3.39 3.27 3.73V20h1.5v-2.15c1.65-.31 3.13-1.2 3.13-3.05 0-1.99-1.63-2.86-3.79-3.41z" /></svg>
                                </div>
                                <div className="text-[10px] text-red-400 font-bold mb-1 tracking-widest uppercase">Landlord Share ({shareRatioLandlord.toFixed(1)}%)</div>
                                <div className="text-2xl font-black text-red-600 tracking-tight">{landlordTotal.toLocaleString()}??</div>
                                <div className="text-xs text-red-400 mt-1">?꾨????댁슜?붽툑</div>
                                {prevMonthData && (
                                    <div className={`text-[10px] mt-2 font-bold `}>
                                        ?꾩썡鍮?{landlordTotal - prevShares.landlordTotal >= 0 ? '▲' : '▼'}{Math.abs(landlordTotal - prevShares.landlordTotal).toLocaleString()}??
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Detailed Comparison Table */}
                    <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h3 className="text-base font-bold text-gray-800">?붽툑 遺꾨떞 ?곸꽭 ?댁뿭</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-[11px] text-left">
                                <thead className="bg-gray-100 text-gray-600 font-bold uppercase border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-2">??ぉ</th>
                                        <th className="px-4 py-2 text-right">?꾩껜 湲덉븸</th>
                                        <th className="px-4 py-2 text-right">踰좎씠肄?({shareRatioBeico.toFixed(1)}%)</th>
                                        <th className="px-4 py-2 text-right">?꾨???({shareRatioLandlord.toFixed(1)}%)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 [&>tr:nth-child(even)]:bg-gray-50">
                                    <tr className="bg-blue-50/20 text-blue-900 font-bold">
                                        <td className="px-4 py-2">珥??ъ슜 ?꾨젰??</td>
                                        <td className="px-4 py-2 text-right">{totalKwh.toLocaleString()}kWh</td>
                                        <td className="px-4 py-2 text-right">{beicoUsageKwh.toLocaleString()}kWh</td>
                                        <td className="px-4 py-2 text-right">{landlordUsageKwh.toLocaleString()}kWh</td>
                                    </tr>
                                    <tr className="hover:bg-gray-50">
                                        <td className="px-4 py-1.5">湲곕낯?붽툑</td>
                                        <td className="px-4 py-1.5 text-right">{baseTotal.toLocaleString()}??</td>
                                        <td className="px-4 py-1.5 text-right">{beicoBaseCost.toLocaleString()}??</td>
                                        <td className="px-4 py-1.5 text-right">{landlordBaseCost.toLocaleString()}??</td>
                                    </tr>
                                    <tr className="hover:bg-gray-50">
                                        <td className="px-4 py-1.5">?꾨젰?됱슂湲?</td>
                                        <td className="px-4 py-1.5 text-right">{usageTotal.toLocaleString()}??</td>
                                        <td className="px-4 py-1.5 text-right">{beicoUsageCost.toLocaleString()}??</td>
                                        <td className="px-4 py-1.5 text-right">{landlordUsageCost.toLocaleString()}??</td>
                                    </tr>
                                    <tr className="hover:bg-gray-50">
                                        <td className="px-4 py-1.5">湲고썑?섍꼍?붽툑</td>
                                        <td className="px-4 py-1.5 text-right">{envTotal.toLocaleString()}??</td>
                                        <td className="px-4 py-1.5 text-right">{beicoEnvCost.toLocaleString()}??</td>
                                        <td className="px-4 py-1.5 text-right">{landlordEnvCost.toLocaleString()}??</td>
                                    </tr>
                                    <tr className="hover:bg-gray-50">
                                        <td className="px-4 py-1.5">?곕즺鍮꾩“?뺤븸</td>
                                        <td className="px-4 py-1.5 text-right">{fuelTotal.toLocaleString()}??</td>
                                        <td className="px-4 py-1.5 text-right">{beicoFuelCost.toLocaleString()}??</td>
                                        <td className="px-4 py-1.5 text-right">{landlordFuelCost.toLocaleString()}??</td>
                                    </tr>
                                    <tr className="hover:bg-gray-50">
                                        <td className="px-4 py-1.5">??쪧?붽툑</td>
                                        <td className="px-4 py-1.5 text-right">{powerFactorTotal.toLocaleString()}??</td>
                                        <td className="px-4 py-1.5 text-right">{beicoPowerFactor.toLocaleString()}??</td>
                                        <td className="px-4 py-1.5 text-right">{landlordPowerFactor.toLocaleString()}??</td>
                                    </tr>
                                    <tr className="hover:bg-gray-50 text-gray-500">
                                        <td className="px-4 py-1.5">遺媛媛移섏꽭</td>
                                        <td className="px-4 py-1.5 text-right">{totalVat.toLocaleString()}??</td>
                                        <td className="px-4 py-1.5 text-right">{beicoVat.toLocaleString()}??</td>
                                        <td className="px-4 py-1.5 text-right">{landlordVat.toLocaleString()}??</td>
                                    </tr>
                                    <tr className="hover:bg-gray-50 text-gray-500">
                                        <td className="px-4 py-1.5">?꾨젰湲곌툑</td>
                                        <td className="px-4 py-1.5 text-right">{totalFund.toLocaleString()}??</td>
                                        <td className="px-4 py-1.5 text-right">{beicoFund.toLocaleString()}??</td>
                                        <td className="px-4 py-1.5 text-right">{landlordFund.toLocaleString()}??</td>
                                    </tr>
                                    <tr className="hover:bg-gray-50 text-gray-500">
                                        <td className="px-4 py-1.5">TV ?섏떊猷?</td>
                                        <td className="px-4 py-1.5 text-right">{tvTotal.toLocaleString()}??</td>
                                        <td className="px-4 py-1.5 text-right">{beicoTvFee.toLocaleString()}??</td>
                                        <td className="px-4 py-1.5 text-right">{landlordTvFee.toLocaleString()}??</td>
                                    </tr>
                                    {roundingDiff !== 0 && (
                                        <tr className="hover:bg-gray-50 text-gray-400 italic">
                                            <td className="px-4 py-1.5">?먮떒???덉궗</td>
                                            <td className="px-4 py-1.5 text-right">{roundingDiff.toLocaleString()}??</td>
                                            <td className="px-4 py-1.5 text-right">{roundingDiff.toLocaleString()}??</td>
                                            <td className="px-4 py-1.5 text-right">0??</td>
                                        </tr>
                                    )}
                                    <tr className="bg-gray-900 text-white font-black border-t-2 border-gray-900">
                                        <td className="px-4 py-3 text-sm">理쒖쥌 泥?뎄 湲덉븸</td>
                                        <td className="px-4 py-3 text-right text-gray-400 text-sm">{billData.totalAmount.toLocaleString()}??</td>
                                        <td className="px-4 py-3 text-right text-[#d9361b] text-sm">{beicoTotal.toLocaleString()}??</td>
                                        <td className="px-4 py-3 text-right text-sm font-black">{landlordTotal.toLocaleString()}??</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                </>
            ) : (
                <div className="h-[50vh] flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{selectedYear}??{selectedMonth}???곗씠???놁쓬</h3>
                    <p className="text-gray-500 text-sm mb-6">?깅줉???꾧린?붽툑 紐낆꽭?쒓? ?놁뒿?덈떎.</p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsLandlordModalOpen(true)}
                            className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold shadow-md transition-all flex items-center gap-2 border border-green-700"
                        >
                            ?벝 ?⑥옄???ъ쭊 ?낅줈??
                        </button>
                        <button
                            onClick={() => setIsUsageModalOpen(true)}
                            className="bg-[#d9361b] text-white px-6 py-2.5 rounded-xl font-bold hover:shadow-lg transition-all text-sm"
                        >
                            紐낆꽭???낅젰?섍린
                        </button>
                    </div>
                </div>
            ))}

            {activeTab === 'payment' && (
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-black text-gray-900">납부관리 체크리스트</h2>
                                <p className="text-xs text-gray-500 mt-1">기준 시작: 2025년 1월, 월세 자동이체일: 매월 14일</p>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-gray-500">선택 월</div>
                                <div className="text-sm font-bold text-gray-900">{selectedYear}년 {selectedMonth}월</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <label className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 bg-gray-50">
                                <div>
                                    <div className="text-sm font-bold text-gray-900">월세 납부 세금계산서 발행</div>
                                    <div className="text-xs text-gray-500 mt-1">자동이체 납부 예정일: {rentAutoTransferDate}</div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={currentPaymentStatus.rentTaxInvoiceIssued}
                                    onChange={(e) => updatePaymentStatus(selectedYear, selectedMonth, prev => ({
                                        ...prev,
                                        rentTaxInvoiceIssued: e.target.checked
                                    }))}
                                    className="h-5 w-5 accent-[#d9361b]"
                                />
                            </label>

                            <label className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 bg-gray-50">
                                <div>
                                    <div className="text-sm font-bold text-gray-900">전기세 납부 완료</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        임대인 월별 전기세: {selectedMonthLandlordTotal !== null ? `${selectedMonthLandlordTotal.toLocaleString()}원` : '계산 데이터 없음'}
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={currentPaymentStatus.electricityPaid}
                                    onChange={(e) => updatePaymentStatus(selectedYear, selectedMonth, prev => ({
                                        ...prev,
                                        electricityPaid: e.target.checked,
                                        electricityPaidAt: e.target.checked ? new Date().toISOString() : null
                                    }))}
                                    className="h-5 w-5 accent-[#d9361b]"
                                />
                            </label>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-800">{selectedYear}년 월별 납부 현황</h3>
                            <div className="text-xs text-gray-500">체크 결과는 현재 브라우저에 저장됩니다.</div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-white text-gray-600 border-b border-gray-100">
                                    <tr>
                                        <th className="text-left px-4 py-3">월</th>
                                        <th className="text-right px-4 py-3">임대인 전기세</th>
                                        <th className="text-center px-4 py-3">월세 세금계산서</th>
                                        <th className="text-center px-4 py-3">전기세 납부</th>
                                        <th className="text-center px-4 py-3">전기세 체크 시각</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Array.from({ length: 12 }, (_, idx) => idx + 1).map(month => {
                                        const status = getPaymentStatus(selectedYear, month)
                                        const landlordAmount = monthlyLandlordTotals[month]
                                        return (
                                            <tr key={month} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="px-4 py-3 font-semibold text-gray-900">{month}월</td>
                                                <td className="px-4 py-3 text-right text-gray-700">
                                                    {landlordAmount !== null && landlordAmount !== undefined ? `${landlordAmount.toLocaleString()}원` : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={status.rentTaxInvoiceIssued}
                                                        onChange={(e) => updatePaymentStatus(selectedYear, month, prev => ({
                                                            ...prev,
                                                            rentTaxInvoiceIssued: e.target.checked
                                                        }))}
                                                        className="h-4 w-4 accent-[#d9361b]"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={status.electricityPaid}
                                                        onChange={(e) => updatePaymentStatus(selectedYear, month, prev => ({
                                                            ...prev,
                                                            electricityPaid: e.target.checked,
                                                            electricityPaidAt: e.target.checked ? new Date().toISOString() : null
                                                        }))}
                                                        className="h-4 w-4 accent-[#d9361b]"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center text-xs text-gray-500">{formatChecklistTimestamp(status.electricityPaidAt)}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {isUsageModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setIsUsageModalOpen(false)}>
                    <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 my-8" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <h3 className="text-lg font-bold">{selectedYear}??{selectedMonth}??怨좎????곸꽭 ?낅젰</h3>
                            <button onClick={() => setIsUsageModalOpen(false)} className="text-gray-400 hover:text-black">??</button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <label className="block text-xs font-bold text-gray-500">臾몄옄/紐낆꽭???댁슜 遺숈뿬?ｊ린</label>
                                <textarea
                                    value={rawText}
                                    onChange={(e) => setRawText(e.target.value)}
                                    className="w-full h-40 p-3 text-xs font-mono bg-gray-50 border rounded-xl resize-none focus:ring-2 focus:ring-[#d9361b]"
                                    placeholder="?ш린???띿뒪?몃? 遺숈뿬?ｊ퀬 [異붿텧?섍린]瑜??꾨Ⅴ硫??곗륫 ?쇱씠 ?먮룞?쇰줈 梨꾩썙吏묐땲??"
                                />
                                <button type="button" onClick={parseBillText} className="w-full py-2 bg-gray-800 text-white rounded-lg text-xs font-bold hover:bg-black transition-all">?띿뒪?몄뿉???곗씠??異붿텧?섍린</button>

                                {extractionHistory.length > 0 && (
                                    <div className="mt-4 space-y-2">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">異붿텧 ?덉뒪?좊━</label>
                                        <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                                            {extractionHistory.map((item) => (
                                                <div key={item.id} className="flex gap-1">
                                                    <button
                                                        onClick={() => {
                                                            setRawText(item.rawText)
                                                            setManualInputs(item.inputs)
                                                        }}
                                                        className="flex-1 text-left px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-lg text-[10px] text-gray-600 flex justify-between items-center transition-colors"
                                                    >
                                                        <span>{item.timestamp}</span>
                                                        <span className="font-bold text-gray-400">遺덈윭?ㅺ린</span>
                                                    </button>
                                                    <button
                                                        onClick={() => deleteHistoryItem(item.id)}
                                                        className="px-2 text-gray-300 hover:text-red-500 transition-colors"
                                                        title="??젣"
                                                    >
                                                        ??
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                                <h4 className="font-bold text-sm border-b pb-2">?곸꽭 ?댁뿭 (吏곸젒 ?섏젙 媛??</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <InputGroup label="珥?泥?뎄湲덉븸" value={manualInputs.totalAmount} onChange={v => setManualInputs({ ...manualInputs, totalAmount: v })} />
                                    <InputGroup label="?뱀썡 ?ъ슜??kWh)" value={manualInputs.currentUsage} onChange={v => setManualInputs({ ...manualInputs, currentUsage: v })} />
                                </div>
                                <div className="h-px bg-gray-100 my-2"></div>
                                <div className="grid grid-cols-2 gap-3">
                                    <InputGroup label="기본요금" value={manualInputs.baseFee} onChange={v => setManualInputs({ ...manualInputs, baseFee: v })} />
                                    <InputGroup label="전력량요금" value={manualInputs.usageFee} onChange={v => setManualInputs({ ...manualInputs, usageFee: v })} />
                                    <InputGroup label="기후환경요금" value={manualInputs.envFee} onChange={v => setManualInputs({ ...manualInputs, envFee: v })} />
                                    <InputGroup label="연료비조정액" value={manualInputs.fuelFee} onChange={v => setManualInputs({ ...manualInputs, fuelFee: v })} />
                                    <InputGroup label="역률요금" value={manualInputs.powerFactorFee} onChange={v => setManualInputs({ ...manualInputs, powerFactorFee: v })} />
                                    <InputGroup label="TV수신료" value={manualInputs.tvFee} onChange={v => setManualInputs({ ...manualInputs, tvFee: v })} />
                                </div>
                                <div className="h-px bg-gray-100 my-2"></div>
                                <div className="grid grid-cols-2 gap-3">
                                    <InputGroup label="遺媛媛移섏꽭" value={manualInputs.vat} onChange={v => setManualInputs({ ...manualInputs, vat: v })} />
                                    <InputGroup label="?꾨젰湲곌툑" value={manualInputs.fund} onChange={v => setManualInputs({ ...manualInputs, fund: v })} />
                                </div>
                                <div className="h-px bg-gray-100 my-2"></div>
                                <div className="space-y-2">
                                    <InputGroup label="寃移⑥씪" value={manualInputs.readingDate} onChange={v => setManualInputs({ ...manualInputs, readingDate: v })} placeholder="YYYY-MM-DD" isNumeric={false} />
                                    <InputGroup label="?ъ슜湲곌컙" value={manualInputs.usagePeriod} onChange={v => setManualInputs({ ...manualInputs, usagePeriod: v })} isNumeric={false} />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 justify-end mt-6 border-t pt-4">
                            <button onClick={resetManualInputs} className="px-4 py-2 text-gray-500 text-sm font-medium hover:text-red-500 transition-colors">?곸꽭?댁뿭 珥덇린??</button>
                            <button onClick={confirmBillInput} disabled={loading} className="bg-[#d9361b] text-white px-8 py-2 rounded-lg font-bold text-sm shadow-md hover:brightness-110 disabled:opacity-50">
                                {loading ? '저장 중...' : '저장 완료'}
                            </button>
                        </div>
                    </div>
                </div>
            )
            }

            {
                isLandlordModalOpen && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsLandlordModalOpen(false)}>
                        <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                            <h3 className="text-lg font-bold mb-4">?꾨????ъ슜???낅젰</h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <InputGroup label="?꾩썡 吏移?(?먮룞)" value={landlordInputs.prevMeter} onChange={v => setLandlordInputs({ ...landlordInputs, prevMeter: v })} />
                                    <InputGroup label="당월 지침" value={landlordInputs.currMeter} onChange={v => setLandlordInputs({ ...landlordInputs, currMeter: v })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-dashed">
                                    <InputGroup label="?⑥닔湲?(kWh)" value={landlordInputs.waterHeaterKw} onChange={v => setLandlordInputs({ ...landlordInputs, waterHeaterKw: v })} />
                                    <InputGroup label="?몃벑 (kWh)" value={landlordInputs.outdoorLightKw} onChange={v => setLandlordInputs({ ...landlordInputs, outdoorLightKw: v })} />
                                </div>

                                <div className="pt-4">
                                    <label className="block text-xs font-bold text-gray-500 mb-2">怨꾨웾湲??ъ쭊 ?낅줈??</label>
                                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:bg-gray-50 transition-colors cursor-pointer relative overflow-hidden">
                                        <input type="file" accept="image/*" onChange={handlePhotoChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                        {landlordPhoto ? (
                                            <div className="relative h-40 w-full rounded-lg overflow-hidden">
                                                <img src={landlordPhoto} alt="Meter Preview" className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className="py-4">
                                                <div className="text-3xl mb-2">?벝</div>
                                                <div className="text-gray-400 text-xs font-bold">?대┃?섏뿬 怨꾨웾湲??ъ쭊 ?낅줈??</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end mt-6">
                                <button onClick={() => setIsLandlordModalOpen(false)} className="px-4 py-2 text-gray-500 text-sm font-medium">痍⑥냼</button>
                                <button onClick={calculateLandlordBill} disabled={loading} className="bg-gray-800 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-md hover:bg-black disabled:opacity-50">
                                    {loading ? '저장 중...' : '계산하기'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                isPhotoModalOpen && landlordData && (
                    <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-md" onClick={() => setIsPhotoModalOpen(false)}>
                        <div className="bg-white rounded-3xl p-8 max-w-5xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-8 border-b pb-4">
                                <h3 className="text-2xl font-black text-gray-900">怨꾨웾湲??ъ쭊 ?뺤씤 (?꾩썡 vs ?뱀썡)</h3>
                                <button onClick={() => setIsPhotoModalOpen(false)} className="bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-sans">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-end">
                                        <span className="px-4 py-1.5 bg-gray-500 text-white rounded-full text-sm font-bold">?꾩썡 怨꾨웾湲?</span>
                                        <div className="text-right">
                                            <div className="text-xs text-gray-400">?꾩썡 吏移?</div>
                                            <div className="text-xl font-black">{landlordData.prevMeter.toLocaleString()} <span className="text-sm font-normal text-gray-400">kWh</span></div>
                                        </div>
                                    </div>
                                    <div className="aspect-[4/3] bg-gray-100 rounded-2xl border-4 border-gray-100 overflow-hidden shadow-inner">
                                        {prevMonthPhoto ? (
                                            <img src={prevMonthPhoto} className="w-full h-full object-contain" alt="Prev month meter" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300 font-bold italic">?ъ쭊 ?곗씠???놁쓬</div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-end">
                                        <span className="px-4 py-1.5 bg-[#d9361b] text-white rounded-full text-sm font-bold shadow-md">?뱀썡 怨꾨웾湲?</span>
                                        <div className="text-right">
                                            <div className="text-xs text-gray-400">?뱀썡 吏移?</div>
                                            <div className="text-xl font-black text-[#d9361b]">{landlordData.currMeter.toLocaleString()} <span className="text-sm font-normal text-gray-400">kWh</span></div>
                                        </div>
                                    </div>
                                    <div className="aspect-[4/3] bg-gray-100 rounded-2xl border-4 border-red-50 overflow-hidden shadow-xl">
                                        {landlordData.photo ? (
                                            <img src={landlordData.photo} className="w-full h-full object-contain" alt="Current month meter" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300 font-bold italic">?ъ쭊 ?곗씠???놁쓬</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 p-6 bg-red-50 rounded-2xl border border-red-100 text-center">
                                <div className="text-xs text-red-400 font-bold mb-1 tracking-widest uppercase">Usage Delta</div>
                                <div className="text-3xl font-black text-red-600">
                                    {(landlordData.currMeter - landlordData.prevMeter).toLocaleString()} <span className="text-lg font-bold">kWh 利앷?</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                isInvoiceOpen && landlordData && billData && (
                    <div id="print-modal"
                        className="fixed inset-0 bg-gray-950/95 z-[150] flex items-center justify-center p-0 sm:p-4 backdrop-blur-xl overflow-y-auto print:absolute print:inset-0 print:block print:p-0"
                    >
                        <div
                            className="bg-white w-full max-w-[210mm] shadow-2xl relative print:static print:transform-none print:m-0 print:shadow-none animate-in fade-in zoom-in-95 duration-300 my-10 print:my-0"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Floating Side Buttons - Fixed Right */}
                            <div className="fixed top-1/2 right-6 -translate-y-1/2 z-[200] flex flex-col gap-4 print:hidden">
                                {/* Remarks Input Modal Tool */}
                                <div className="absolute right-full top-0 mr-4 w-64 bg-white p-3 rounded-2xl shadow-xl border border-gray-100 mb-4 hover:shadow-2xl transition-all">
                                    <div className="text-xs font-bold text-gray-700 mb-2">?섎떒 鍮꾧퀬? ?낅젰</div>
                                    <textarea
                                        value={invoiceRemarks}
                                        onChange={(e) => setInvoiceRemarks(e.target.value)}
                                        placeholder="泥?뎄???섎떒???몄뇙???덈궡?ы빆?대굹 ?낃툑 怨꾩쥖 蹂寃??깆쓽 ?댁슜???먯쑀濡?쾶 ?곸뼱二쇱꽭??"
                                        rows={4}
                                        className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-[#d9361b] focus:border-[#d9361b] transition-all resize-none"
                                    />
                                </div>
                                <button
                                    onClick={() => window.print()}
                                    title="PDF 저장"
                                    className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl transition-all border border-white/20 active:scale-90"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </button>
                                <button
                                    onClick={() => window.print()}
                                    title="泥?뎄???몄뇙"
                                    className="p-3 bg-gray-900 hover:bg-black text-white rounded-full shadow-2xl transition-all border border-white/20 active:scale-90"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                </button>
                                <button
                                    onClick={() => setIsInvoiceOpen(false)}
                                    title="?リ린"
                                    className="p-3 bg-white hover:bg-gray-50 text-gray-900 rounded-full shadow-2xl border border-gray-200 active:scale-90"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            {/* Invoice Content */}
                            {(() => {
                                const usageYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
                                const usageMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
                                const lastDay = new Date(usageYear, usageMonth, 0).getDate();
                                const usagePeriodStr = `${usageYear}.${usageMonth.toString().padStart(2, '0')}.01 ~ ${lastDay}??;

                                return (
                                    <div className="p-[10mm] bg-white flex flex-col w-[210mm] mx-auto text-black font-sans" id="invoice-content">
                                        {/* Title Section */}
                                        <div className="text-center mb-2">
                                            <h1 className="text-[14px] font-bold tracking-[0.2em] border-b border-black pb-0.5 inline-block px-8">{selectedMonth}???꾧린?붽툑 泥?뎄 紐낆꽭??</h1>
                                        </div>

                                        <div className="flex justify-between mb-2 text-[10px] gap-2">
                                            <div className="flex-1">
                                                <table className="w-full border-collapse border border-black h-full">
                                                    <tbody>
                                                        <tr>
                                                            <td className="border border-black bg-gray-50 p-0.5 w-16 font-bold text-center">泥?뎄 ???</td>
                                                            <td className="border border-black p-0.5 font-bold italic underline decoration-gray-400">(二??먯퐫紐⑦꽣??洹??</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="border border-black bg-gray-50 p-0.5 text-center font-bold">泥?뎄 ?꾩썡</td>
                                                            <td className="border border-black p-0.5">{selectedYear}??{selectedMonth}?붾텇</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="border border-black bg-gray-50 p-0.5 text-center font-bold">?ъ슜 湲곌컙</td>
                                                            <td className="border border-black p-0.5">{usagePeriodStr}</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="border border-black bg-gray-50 p-0.5 text-center font-bold">泥?뎄 湲덉븸</td>
                                                            <td className="border border-black p-0.5 font-bold text-xs">湲?{landlordTotal.toLocaleString()} ?먯젙</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="border border-black bg-gray-50 p-0.5 text-center font-bold">?낃툑 怨꾩쥖</td>
                                                            <td className="border border-black p-0.5 font-medium tracking-tighter">?좎뒪諭낇겕 1000-0918-2374 ?덇툑二??대떎鍮?</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                            <div className="flex-1">
                                                <table className="w-full border-collapse border border-black h-full">
                                                    <tbody>
                                                        <tr>
                                                            <td rowSpan={5} className="border border-black bg-gray-50 p-0.5 w-8 font-bold text-center leading-none text-[9px]">泥?<br />援?<br />??</td>
                                                            <td className="border border-black bg-gray-50 p-0.5 w-16 text-center font-bold">????</td>
                                                            <td className="border border-black p-0.5 font-bold">二쇱떇?뚯궗 踰좎씠肄?</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="border border-black bg-gray-50 p-0.5 text-center font-bold">? ??</td>
                                                            <td className="border border-black p-0.5">????鍮?</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="border border-black bg-gray-50 p-0.5 text-center font-bold">?곕씫泥?</td>
                                                            <td className="border border-black p-0.5">010-3444-3467</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="border border-black bg-gray-50 p-0.5 text-center font-bold">二???</td>
                                                            <td className="border border-black p-0.5 leading-none font-medium text-[8px]">遺??媛뺤꽌援??먯퐫?명?1濡?42 e쨌112-903</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="border border-black bg-gray-50 p-0.5 text-center font-bold">?대찓??</td>
                                                            <td className="border border-black p-0.5 font-medium text-[8px]">vdvin@naver.com</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        <div className="mb-2">
                                            <div className="text-[10px] font-bold mb-0.5">1. 怨꾨웾湲?寃移??댁뿭</div>
                                            <table className="w-full border-collapse border border-black text-[10px]">
                                                <thead>
                                                    <tr className="bg-gray-50">
                                                        <th className="border border-black p-0.5 w-1/2">?꾩썡 吏移?</th>
                                                        <th className="border border-black p-0.5 w-1/2">?뱀썡 吏移?</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td className="border border-black p-1">
                                                            <div className="h-48 print:h-[180px] bg-white flex items-center justify-center overflow-hidden border border-gray-100">
                                                                {prevMonthPhoto ? <img src={prevMonthPhoto} className="w-full h-full object-contain" alt="prev" /> : "?ъ쭊 ?놁쓬"}
                                                            </div>
                                                            <div className="text-center mt-1 font-bold text-[11px]">?꾩썡 吏移? {landlordData.prevMeter.toLocaleString()} kWh</div>
                                                        </td>
                                                        <td className="border border-black p-1">
                                                            <div className="h-48 print:h-[180px] bg-white flex items-center justify-center overflow-hidden border border-gray-100">
                                                                {landlordData.photo ? <img src={landlordData.photo} className="w-full h-full object-contain" alt="curr" /> : "?ъ쭊 ?놁쓬"}
                                                            </div>
                                                            <div className="text-center mt-1 font-bold text-[11px]">?뱀썡 吏移? {landlordData.currMeter.toLocaleString()} kWh</div>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td colSpan={2} className="border border-black p-0.5 bg-gray-50">
                                                            <div className="flex justify-between items-center px-1">
                                                                <span className="text-[9px] tracking-tighter">?곗텧: (?뱀썡 {landlordData.currMeter.toLocaleString()} - ?꾩썡 {landlordData.prevMeter.toLocaleString()}) + ?⑥닔湲?{landlordData.waterHeaterKw} + ?몃벑 {landlordData.outdoorLightKw}</span>
                                                                <span className="text-[10px] font-bold underline decoration-double">珥??ъ슜?? {landlordUsageKwh.toLocaleString()} kWh</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Breakdown Table */}
                                        <div className="flex-1">
                                            <div className="text-[10px] font-bold mb-0.5">2. ?ъ슜 ?붽툑 ?몃? ?곗텧 ?댁뿭</div>
                                            <table className="w-full border-collapse border border-black text-[10px] text-right">
                                                <thead>
                                                    <tr className="bg-gray-50 text-center">
                                                        <th className="border border-black p-0.5">??ぉ</th>
                                                        <th className="border border-black p-0.5">?꾩껜 湲덉븸</th>
                                                        <th className="border border-black p-0.5">踰좎씠肄?遺꾨떞</th>
                                                        <th className="border border-black p-0.5 bg-gray-100 font-bold">?먯퐫紐⑦꽣??泥?뎄??</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td className="border border-black p-0.5 text-center bg-gray-50 font-bold">?꾨젰 ?ъ슜??(kWh)</td>
                                                        <td className="border border-black p-0.5">{(beicoUsageKwh + landlordUsageKwh).toLocaleString()} kWh</td>
                                                        <td className="border border-black p-0.5">{beicoUsageKwh.toLocaleString()} kWh</td>
                                                        <td className="border border-black p-0.5 font-bold bg-gray-100">{landlordUsageKwh.toLocaleString()} kWh</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="border border-black border-b-2 p-0.5 text-center">湲곕낯 ?붽툑 (30kw)</td>
                                                        <td className="border border-black border-b-2 p-0.5">{baseTotal.toLocaleString()} ??</td>
                                                        <td className="border border-black border-b-2 p-0.5">{beicoBaseCost.toLocaleString()} ??(10kWh)</td>
                                                        <td className="border border-black border-b-2 p-0.5 font-bold bg-gray-100">{landlordBaseCost.toLocaleString()} ??(20kWh)</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="border border-black p-0.5 text-center">?꾨젰???붽툑</td>
                                                        <td className="border border-black p-0.5">{usageTotal.toLocaleString()} ??</td>
                                                        <td className="border border-black p-0.5">{beicoUsageCost.toLocaleString()} ??</td>
                                                        <td className="border border-black p-0.5 font-bold bg-gray-100">{landlordUsageCost.toLocaleString()} ??</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="border border-black p-0.5 text-center">湲고썑?섍꼍 ?붽툑</td>
                                                        <td className="border border-black p-0.5">{envTotal.toLocaleString()} ??</td>
                                                        <td className="border border-black p-0.5">{beicoEnvCost.toLocaleString()} ??</td>
                                                        <td className="border border-black p-0.5 font-medium bg-gray-100">{landlordEnvCost.toLocaleString()} ??</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="border border-black p-0.5 text-center">?곕즺鍮?議곗젙??</td>
                                                        <td className="border border-black p-0.5">{fuelTotal.toLocaleString()} ??</td>
                                                        <td className="border border-black p-0.5">{beicoFuelCost.toLocaleString()} ??</td>
                                                        <td className="border border-black p-0.5 font-medium bg-gray-100">{landlordFuelCost.toLocaleString()} ??</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="border border-black p-0.5 text-center font-bold italic">遺媛媛移섏꽭</td>
                                                        <td className="border border-black p-0.5">{totalVat.toLocaleString()} ??</td>
                                                        <td className="border border-black p-0.5">{beicoVat.toLocaleString()} ??</td>
                                                        <td className="border border-black p-0.5 font-bold bg-gray-100">{landlordVat.toLocaleString()} ??</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="border border-black p-0.5 text-center">?꾨젰?곗뾽湲곌툑</td>
                                                        <td className="border border-black p-0.5">{totalFund.toLocaleString()} ??</td>
                                                        <td className="border border-black p-0.5">{beicoFund.toLocaleString()} ??</td>
                                                        <td className="border border-black p-0.5 font-medium bg-gray-100">{landlordFund.toLocaleString()} ??</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="border border-black p-0.5 text-center">TV ?섏떊猷?</td>
                                                        <td className="border border-black p-0.5">{tvTotal.toLocaleString()} ??</td>
                                                        <td className="border border-black p-0.5">{beicoTvFee.toLocaleString()} ??</td>
                                                        <td className="border border-black p-0.5 font-medium bg-gray-100">{landlordTvFee.toLocaleString()} ??</td>
                                                    </tr>
                                                    <tr className="bg-gray-100 font-bold border-t border-black">
                                                        <td className="border border-black p-0.5 text-center text-[9px]">??怨?</td>
                                                        <td className="border border-black p-0.5">{billData.totalAmount.toLocaleString()} ??</td>
                                                        <td className="border border-black p-0.5">{beicoTotal.toLocaleString()} ??</td>
                                                        <td className="border border-black p-0.5 text-[10px] bg-gray-200">{landlordTotal.toLocaleString()} ??</td>
                                                    </tr>
                                                    <tr className="bg-gray-200 font-black border-t-2 border-black">
                                                        <td colSpan={3} className="border border-black p-1 text-center text-[10px]">理쒖쥌 泥?뎄 湲덉븸 (?⑸??섏떎 湲덉븸)</td>
                                                        <td className="border border-black p-1 text-sm text-right">{landlordTotal.toLocaleString()}??</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="mt-1 text-center border-t border-gray-100 pt-1">
                                            <p className="text-[9px] font-medium text-gray-500 italic">?꾩? 媛숈씠 ?꾨젰 ?ъ슜 ?붽툑??泥?뎄?⑸땲??</p>
                                        </div>

                                        {invoiceRemarks && invoiceRemarks.trim() !== '' && (
                                            <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded-lg text-left">
                                                <div className="text-[10px] font-bold text-gray-800 mb-1">??鍮꾧퀬</div>
                                                <div className="text-[9px] text-gray-600 whitespace-pre-wrap leading-relaxed">
                                                    {invoiceRemarks}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>

                        <style jsx global>{`
                            @media print {
                                @page { size: A4 portrait; margin: 0; }
                                html, body { 
                                    width: 210mm !important;
                                    height: 297mm !important;
                                    margin: 0 !important; 
                                    padding: 0 !important; 
                                    background: white !important;
                                    overflow: hidden !important; 
                                }
                                
                                /* Completely remove background layout elements from print flow */
                                #electricity-main > div:not(#print-modal) {
                                    display: none !important;
                                }
                                
                                /* Show only the invoice */
                                #print-modal, #print-modal * { 
                                    visibility: visible !important; 
                                }
                                
                                #invoice-content {
                                    position: fixed !important;
                                    top: 0 !important;
                                    left: 0 !important;
                                    width: 210mm !important;
                                    height: 297mm !important;
                                    margin: 0 !important;
                                    padding: 8mm !important;
                                    background: white !important;
                                    z-index: 99999 !important;
                                    box-sizing: border-box !important;
                                    overflow: hidden !important; 
                                }
                                
                                table { border-collapse: collapse !important; width: 100% !important; table-layout: fixed; }
                                td, th { border: 1px solid black !important; word-break: break-all; }
                                .bg-gray-50 { background-color: #f9fafb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                                .bg-gray-100 { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                                .bg-gray-200 { background-color: #e5e7eb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                            }
                        `}</style>
                    </div>
                )
            }
        </div>
    )
}

function InputGroup({ label, value, onChange, placeholder = '0', isNumeric = true }: { label: string, value: string, onChange: (v: string) => void, placeholder?: string, isNumeric?: boolean }) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (!isNumeric) {
            onChange(val);
            return;
        }
        const numeric = val.replace(/[^0-9-]/g, '');
        if (!numeric) {
            onChange('');
            return;
        }
        const formatted = parseInt(numeric, 10).toLocaleString();
        onChange(formatted);
    };

    return (
        <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1">{label}</label>
            <input
                type="text"
                value={value}
                onChange={handleChange}
                className="w-full p-2 bg-white border border-gray-200 rounded text-xs font-medium focus:border-black outline-none transition-colors"
                placeholder={placeholder}
            />
        </div>
    )
}









