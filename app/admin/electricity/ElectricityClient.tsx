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

type PaymentChecklistStatus = {
    rentTaxInvoiceIssued: boolean
    electricityPaid: boolean
    electricityPaidAt: string | null
}

const PAYMENT_STORAGE_KEY = 'beico-payment-checklist-v1'
const PAYMENT_START_YEAR = 2025

export default function ElectricityClient() {
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() + 1
    const currentDay = today.getDate()
    const [selectedYear, setSelectedYear] = useState(Math.max(today.getFullYear(), PAYMENT_START_YEAR))
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1)
    const [activeTab, setActiveTab] = useState<'analysis' | 'payment' | 'rent-receipt'>('analysis')

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
                            baseFee: formatWithCommas(parsed['기본요금'] || 0),
                            usageFee: formatWithCommas(parsed['전력량요금'] || 0),
                            envFee: formatWithCommas(parsed['기후환경요금'] || 0),
                            fuelFee: formatWithCommas(parsed['연료비조정액'] || 0),
                            powerFactorFee: formatWithCommas(parsed['역률요금'] || 0),
                            tvFee: formatWithCommas(parsed['TV수신료'] || 0),
                            vat: formatWithCommas(parsed['부가가치세'] || 0),
                            fund: formatWithCommas(parsed['전력기금'] || 0),
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
                            totalAmount: '', currentUsage: '', baseFee: '', usageFee: '',
                            envFee: '', fuelFee: '', powerFactorFee: '', tvFee: '', vat: '', fund: '',
                            readingDate: '', usagePeriod: '', meterCurrent: '', meterPrevious: ''
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
                alert(`저장 실패: ${err.error}`)
            }
        } catch (e) {
            console.error(e)
            alert('저장 중 오류가 발생했습니다.')
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

            if (rawText.trim()) {
                const total = rawText.match(/청구금액\(.*?\)\s*([\d,]+)/)?.[1]
                    ? parseInt(rawText.match(/청구금액\(.*?\)\s*([\d,]+)/)![1].replace(/,/g, ''))
                    : getNum('청구금액')

                const inputs = {
                    totalAmount: formatWithCommas(total || 0),
                    currentUsage: formatWithCommas(getNum('당월 사용량')),
                    baseFee: formatWithCommas(getNum('기본요금')),
                    usageFee: formatWithCommas(getNum('전력량요금')),
                    envFee: formatWithCommas(getNum('기후환경요금')),
                    fuelFee: formatWithCommas(getSignedNum('연료비조정액')),
                    powerFactorFee: formatWithCommas(getSignedNum('역률요금')),
                    tvFee: formatWithCommas(getNum('TV\\s*수신료') || getNum('ＴＶ수신료')),
                    vat: formatWithCommas(getNum('부가가치세')),
                    fund: formatWithCommas(getNum('전력기금')),
                    readingDate: getStr('검침일'),
                    usagePeriod: getStr('전기사용기간'),
                    meterCurrent: getStr('당월심야지침') + ' / ' + getStr('당월기타지침'),
                    meterPrevious: getStr('전월심야지침') + ' / ' + getStr('전월기타지침'),
                }
                setManualInputs(inputs)

                // Add to history
                const newHistoryItem = {
                    id: Date.now().toString(),
                    timestamp: new Date().toLocaleString(),
                    rawText: rawText,
                    inputs: inputs
                }
                const updatedHistory = [newHistoryItem, ...extractionHistory]
                setExtractionHistory(updatedHistory)
            }
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
            '기본요금': parseInt(manualInputs.baseFee.replace(/,/g, '')) || 0,
            '전력량요금': parseInt(manualInputs.usageFee.replace(/,/g, '')) || 0,
            '기후환경요금': parseInt(manualInputs.envFee.replace(/,/g, '')) || 0,
            '연료비조정액': parseInt(manualInputs.fuelFee.replace(/,/g, '')) || 0,
            '역률요금': parseInt(manualInputs.powerFactorFee.replace(/,/g, '')) || 0,
            'TV수신료': parseInt(manualInputs.tvFee.replace(/,/g, '')) || 0,
            '부가가치세': parseInt(manualInputs.vat.replace(/,/g, '')) || 0,
            '전력기금': parseInt(manualInputs.fund.replace(/,/g, '')) || 0,
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

        const baseTotal = bData.parsedDetails['기본요금'] || 0
        const usageTotal = bData.parsedDetails['전력량요금'] || 0
        const envTotal = bData.parsedDetails['기후환경요금'] || 0
        const fuelTotal = bData.parsedDetails['연료비조정액'] || 0
        const powerFactorTotal = bData.parsedDetails['역률요금'] || 0
        const tvTotal = bData.parsedDetails['TV수신료'] || 0
        const totalVat = bData.parsedDetails['부가가치세'] || 0
        const totalFund = bData.parsedDetails['전력기금'] || 0

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

        const baseTotal = parsed['기본요금'] || 0
        const usageTotal = parsed['전력량요금'] || 0
        const envTotal = parsed['기후환경요금'] || 0
        const fuelTotal = parsed['연료비조정액'] || 0
        const powerFactorTotal = parsed['역률요금'] || 0
        const tvTotal = parsed['TV수신료'] || 0
        const totalVat = parsed['부가가치세'] || 0
        const totalFund = parsed['전력기금'] || 0

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
    const baseTotal = billData?.parsedDetails['기본요금'] || 0
    const usageTotal = billData?.parsedDetails['전력량요금'] || 0
    const envTotal = billData?.parsedDetails['기후환경요금'] || 0
    const fuelTotal = billData?.parsedDetails['연료비조정액'] || 0
    const powerFactorTotal = billData?.parsedDetails['역률요금'] || 0
    const tvTotal = billData?.parsedDetails['TV수신료'] || 0

    const totalVat = billData?.parsedDetails['부가가치세'] || 0
    const totalFund = billData?.parsedDetails['전력기금'] || 0

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

    const currentPaymentStatus = getPaymentStatus(selectedYear, selectedMonth)
    const rentAutoTransferDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-14`
    const selectedMonthLandlordTotal = monthlyLandlordTotals[selectedMonth] ?? null
    const unpaidLandlordElectricitySummary = Array.from({ length: 12 }, (_, idx) => idx + 1)
        .filter(month => {
            if (selectedYear < currentYear) return true
            if (selectedYear > currentYear) return false
            return month < currentMonth
        })
        .reduce((acc, month) => {
            const amount = monthlyLandlordTotals[month]
            const status = getPaymentStatus(selectedYear, month)
            if (amount === null || amount === undefined || status.electricityPaid) {
                return acc
            }

            acc.total += amount
            acc.months += 1
            return acc
        }, { total: 0, months: 0 })
    const formatChecklistTimestamp = (value: string | null) => {
        if (!value) return '-'
        return new Date(value).toLocaleString('ko-KR')
    }

    const getRentPaymentInfo = (year: number, month: number) => {
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const periodStr = `${year}년 ${month}월 14일 ~ ${nextYear}년 ${nextMonth}월 13일`;
        const scheduledDepositDate = year === 2025 && month === 12 ? '12월 18일' : `${month}월 14일`
        const isPastMonth = year < currentYear || (year === currentYear && month < currentMonth)
        const isCurrentMonthDepositCompleted = year === currentYear && month === currentMonth && currentDay >= 14
        const isDeposited = isPastMonth || isCurrentMonthDepositCompleted

        return {
            period: periodStr,
            paidDate: scheduledDepositDate,
            amount: isDeposited ? "1,595,000원" : "-"
        };
    };

    const rentInfo = getRentPaymentInfo(selectedYear, selectedMonth);

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
                            <h1 className="text-lg font-black text-gray-900 tracking-tight">전력 관리</h1>
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
                <button
                    type="button"
                    onClick={() => setActiveTab('rent-receipt')}
                    className={`flex-1 rounded-xl px-4 py-2 text-sm font-bold transition-all ${activeTab === 'rent-receipt'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                >
                    임대료영수증
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
                        {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}년</option>)}
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
                                {month}월
                            </button>
                        ))}
                    </div>
                </div>

                {activeTab === 'analysis' && billData && (
                    <div className="flex flex-wrap gap-2 justify-start pt-2 border-t border-gray-50">
                        <button onClick={() => setIsPhotoModalOpen(true)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-green-700 shadow-sm">
                            계량기 확인하기
                        </button>
                        <button onClick={() => setIsLandlordModalOpen(true)} className="px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs font-bold text-gray-700 transition-all border border-gray-100">
                            {landlordData ? '임대인 데이터 수정' : '임대인 사용량 입력'}
                        </button>
                        <button onClick={() => setIsUsageModalOpen(true)} className="px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs font-bold text-gray-700 transition-all border border-gray-100">
                            고지서 수정
                        </button>
                        <button onClick={() => setIsInvoiceOpen(true)} className="px-5 py-2.5 bg-[#d9361b] hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm ml-auto">
                            📄 청구서 발행
                        </button>
                    </div>
                )}
            </div>

            {
                activeTab === 'analysis' && (billData ? (
                    <>
                        {/* Total Bill Summary */}
                        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
                            <div className="bg-gray-900 p-6 text-white flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold flex items-center gap-2">
                                        <span>⚡️</span> {selectedMonth}월 전기요금 총괄표
                                    </h2>
                                    <p className="text-sm text-gray-400 mt-1">{billData.usagePeriod}</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-3xl font-black tracking-tight">{billData.totalAmount.toLocaleString()}원</div>
                                    <div className="text-xs text-gray-400 mt-1 flex flex-col items-end gap-1">
                                        <div>총 사용량: <span className="text-white font-bold">{billData.currentUsage.toLocaleString()} kWh</span></div>
                                        {prevMonthData && (
                                            <div className="flex items-center gap-2 text-[10px]">
                                                <span>전월대비:</span>
                                                <span className={billData.currentUsage - prevMonthData.totalUsage >= 0 ? 'text-red-400' : 'text-blue-400'}>
                                                    {billData.currentUsage - prevMonthData.totalUsage >= 0 ? '▲' : '▼'} {(Math.abs(billData.currentUsage - prevMonthData.totalUsage)).toLocaleString()} kWh
                                                </span>
                                                <span className={billData.totalAmount - prevMonthData.totalAmount >= 0 ? 'text-red-400' : 'text-blue-400'}>
                                                    {billData.totalAmount - prevMonthData.totalAmount >= 0 ? '▲' : '▼'} {(Math.abs(billData.totalAmount - prevMonthData.totalAmount)).toLocaleString()} 원
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
                                    <div className="text-2xl font-black text-gray-900 tracking-tight">{beicoTotal.toLocaleString()}원</div>
                                    <div className="text-xs text-gray-400 mt-1">베이코 이용요금</div>
                                    {prevMonthData && (
                                        <div className={`text-[10px] mt-2 font-bold ${beicoTotal - prevShares.beicoTotal >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                            전월비 {beicoTotal - prevShares.beicoTotal >= 0 ? '▲' : '▼'}{Math.abs(beicoTotal - prevShares.beicoTotal).toLocaleString()}원
                                        </div>
                                    )}
                                </div>
                                <div className="bg-red-50 p-5 rounded-3xl border border-red-100 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 text-red-100 group-hover:text-red-200 transition-colors">
                                        <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.39 2.1-1.39 1.47 0 2.01.59 2.06 1.71h1.73c-.05-1.94-1.29-3.21-3.12-3.62V4h-1.5v2.15c-1.54.34-2.82 1.31-2.82 2.92 0 1.89 1.55 2.83 3.8 3.4 2.02.5 2.42 1.2 2.42 2.03 0 1.15-1.13 1.63-2.39 1.63-1.76 0-2.43-.88-2.51-2.11H7.28c.08 2.3 1.65 3.39 3.27 3.73V20h1.5v-2.15c1.65-.31 3.13-1.2 3.13-3.05 0-1.99-1.63-2.86-3.79-3.41z" /></svg>
                                    </div>
                                    <div className="text-[10px] text-red-400 font-bold mb-1 tracking-widest uppercase">Landlord Share ({shareRatioLandlord.toFixed(1)}%)</div>
                                    <div className="text-2xl font-black text-red-600 tracking-tight">{landlordTotal.toLocaleString()}원</div>
                                    <div className="text-xs text-red-400 mt-1">임대인 이용요금</div>
                                    {prevMonthData && (
                                        <div className={`text-[10px] mt-2 font-bold ${landlordTotal - prevShares.landlordTotal >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                            전월비 {landlordTotal - prevShares.landlordTotal >= 0 ? '▲' : '▼'}{Math.abs(landlordTotal - prevShares.landlordTotal).toLocaleString()}원
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Detailed Comparison Table */}
                        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
                            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                <h3 className="text-base font-bold text-gray-800">요금 분담 상세 내역</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-[11px] text-left">
                                    <thead className="bg-gray-100 text-gray-600 font-bold uppercase border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 py-2">항목</th>
                                            <th className="px-4 py-2 text-right">전체 금액</th>
                                            <th className="px-4 py-2 text-right">베이코 ({shareRatioBeico.toFixed(1)}%)</th>
                                            <th className="px-4 py-2 text-right">임대인 ({shareRatioLandlord.toFixed(1)}%)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 [&>tr:nth-child(even)]:bg-gray-50">
                                        <tr className="bg-blue-50/20 text-blue-900 font-bold">
                                            <td className="px-4 py-2">총 사용 전력량</td>
                                            <td className="px-4 py-2 text-right">{totalKwh.toLocaleString()}kWh</td>
                                            <td className="px-4 py-2 text-right">{beicoUsageKwh.toLocaleString()}kWh</td>
                                            <td className="px-4 py-2 text-right">{landlordUsageKwh.toLocaleString()}kWh</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="px-4 py-1.5">기본요금</td>
                                            <td className="px-4 py-1.5 text-right">{baseTotal.toLocaleString()}원</td>
                                            <td className="px-4 py-1.5 text-right">{beicoBaseCost.toLocaleString()}원</td>
                                            <td className="px-4 py-1.5 text-right">{landlordBaseCost.toLocaleString()}원</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="px-4 py-1.5">전력량요금</td>
                                            <td className="px-4 py-1.5 text-right">{usageTotal.toLocaleString()}원</td>
                                            <td className="px-4 py-1.5 text-right">{beicoUsageCost.toLocaleString()}원</td>
                                            <td className="px-4 py-1.5 text-right">{landlordUsageCost.toLocaleString()}원</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="px-4 py-1.5">기후환경요금</td>
                                            <td className="px-4 py-1.5 text-right">{envTotal.toLocaleString()}원</td>
                                            <td className="px-4 py-1.5 text-right">{beicoEnvCost.toLocaleString()}원</td>
                                            <td className="px-4 py-1.5 text-right">{landlordEnvCost.toLocaleString()}원</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="px-4 py-1.5">연료비조정액</td>
                                            <td className="px-4 py-1.5 text-right">{fuelTotal.toLocaleString()}원</td>
                                            <td className="px-4 py-1.5 text-right">{beicoFuelCost.toLocaleString()}원</td>
                                            <td className="px-4 py-1.5 text-right">{landlordFuelCost.toLocaleString()}원</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50">
                                            <td className="px-4 py-1.5">역률요금</td>
                                            <td className="px-4 py-1.5 text-right">{powerFactorTotal.toLocaleString()}원</td>
                                            <td className="px-4 py-1.5 text-right">{beicoPowerFactor.toLocaleString()}원</td>
                                            <td className="px-4 py-1.5 text-right">{landlordPowerFactor.toLocaleString()}원</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50 text-gray-500">
                                            <td className="px-4 py-1.5">부가가치세</td>
                                            <td className="px-4 py-1.5 text-right">{totalVat.toLocaleString()}원</td>
                                            <td className="px-4 py-1.5 text-right">{beicoVat.toLocaleString()}원</td>
                                            <td className="px-4 py-1.5 text-right">{landlordVat.toLocaleString()}원</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50 text-gray-500">
                                            <td className="px-4 py-1.5">전력기금</td>
                                            <td className="px-4 py-1.5 text-right">{totalFund.toLocaleString()}원</td>
                                            <td className="px-4 py-1.5 text-right">{beicoFund.toLocaleString()}원</td>
                                            <td className="px-4 py-1.5 text-right">{landlordFund.toLocaleString()}원</td>
                                        </tr>
                                        <tr className="hover:bg-gray-50 text-gray-500">
                                            <td className="px-4 py-1.5">TV 수신료</td>
                                            <td className="px-4 py-1.5 text-right">{tvTotal.toLocaleString()}원</td>
                                            <td className="px-4 py-1.5 text-right">{beicoTvFee.toLocaleString()}원</td>
                                            <td className="px-4 py-1.5 text-right">{landlordTvFee.toLocaleString()}원</td>
                                        </tr>
                                        {roundingDiff !== 0 && (
                                            <tr className="hover:bg-gray-50 text-gray-400 italic">
                                                <td className="px-4 py-1.5">원단위 절사</td>
                                                <td className="px-4 py-1.5 text-right">{roundingDiff.toLocaleString()}원</td>
                                                <td className="px-4 py-1.5 text-right">{roundingDiff.toLocaleString()}원</td>
                                                <td className="px-4 py-1.5 text-right">0원</td>
                                            </tr>
                                        )}
                                        <tr className="bg-gray-900 text-white font-black border-t-2 border-gray-900">
                                            <td className="px-4 py-3 text-sm">최종 청구 금액</td>
                                            <td className="px-4 py-3 text-right text-gray-400 text-sm">{billData.totalAmount.toLocaleString()}원</td>
                                            <td className="px-4 py-3 text-right text-[#d9361b] text-sm">{beicoTotal.toLocaleString()}원</td>
                                            <td className="px-4 py-3 text-right text-sm font-black">{landlordTotal.toLocaleString()}원</td>
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
                        <h3 className="text-lg font-bold text-gray-900 mb-1">{selectedYear}년 {selectedMonth}월 데이터 없음</h3>
                        <p className="text-gray-500 text-sm mb-6">등록된 전기요금 명세서가 없습니다.</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsLandlordModalOpen(true)}
                                className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold shadow-md transition-all flex items-center gap-2 border border-green-700"
                            >
                                📸 단자함 사진 업로드
                            </button>
                            <button
                                onClick={() => setIsUsageModalOpen(true)}
                                className="bg-[#d9361b] text-white px-6 py-2.5 rounded-xl font-bold hover:shadow-lg transition-all text-sm"
                            >
                                명세서 입력하기
                            </button>
                        </div>
                    </div>
                ))
            }

            {
                activeTab === 'payment' && (
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

                            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
                                <div className="text-xs font-bold text-red-600">현재 일자 기준 임대인 미납 전기세</div>
                                <div className="mt-1 text-lg font-black text-gray-900">
                                    {unpaidLandlordElectricitySummary.total.toLocaleString()}원
                                </div>
                                <div className="text-xs text-gray-600 mt-1">
                                    {selectedYear}년 도래분 중 미납 {unpaidLandlordElectricitySummary.months}개월 합계
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <label className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 bg-blue-50/50">
                                    <div>
                                        <div className="text-sm font-bold text-gray-900">월세 납부 세금계산서 발행</div>
                                        <div className="mt-1.5 space-y-0.5">
                                            <div className="text-[11px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded inline-block">
                                                임대기간: {rentInfo.period}
                                            </div>
                                            <div className="text-xs text-gray-600 mt-1">
                                                • 납부금액: <span className="font-bold text-gray-900">{rentInfo.amount}</span>
                                            </div>
                                            <div className="text-xs text-gray-600">
                                                • 납부상태: <span className="font-bold text-gray-900">{rentInfo.paidDate}</span>
                                            </div>
                                        </div>
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
                                            <th className="text-left px-4 py-3 whitespace-nowrap">월</th>
                                            <th className="text-center px-4 py-3 whitespace-nowrap">월세 입금일자</th>
                                            <th className="text-right px-4 py-3 whitespace-nowrap">입금액</th>
                                            <th className="text-center px-4 py-3 whitespace-nowrap">임대일자</th>
                                            <th className="text-center px-4 py-3 whitespace-nowrap">월세 세금계산서</th>
                                            <th className="text-right px-4 py-3 whitespace-nowrap">임대인 전기세</th>
                                            <th className="text-center px-4 py-3 whitespace-nowrap">전기세 납부</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {Array.from({ length: 12 }, (_, i) => i + 1)
                                            .filter(m => selectedYear > PAYMENT_START_YEAR || (selectedYear === PAYMENT_START_YEAR && m >= 1))
                                            .map(m => {
                                                const status = getPaymentStatus(selectedYear, m)
                                                const isSelected = m === selectedMonth
                                                const lTotal = monthlyLandlordTotals[m]
                                                const rowRentInfo = getRentPaymentInfo(selectedYear, m)

                                                return (
                                                    <tr key={m} className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-[#d9361b]/5' : ''}`}>
                                                        <td className="px-4 py-3 font-bold text-gray-900 cursor-pointer whitespace-nowrap" onClick={() => setSelectedMonth(m)}>
                                                            {m}월 {isSelected && <span className="ml-1 text-[10px] bg-[#d9361b] text-white px-1.5 py-0.5 rounded-md">선택됨</span>}
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-gray-700 whitespace-nowrap">
                                                            {rowRentInfo.paidDate}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-bold text-gray-900 whitespace-nowrap">
                                                            {rowRentInfo.amount}
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-xs text-gray-500 whitespace-nowrap">
                                                            {rowRentInfo.period}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${status.rentTaxInvoiceIssued ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                                                {status.rentTaxInvoiceIssued ? '✓' : '-'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">
                                                            {lTotal !== null && lTotal !== undefined ? `${lTotal.toLocaleString()}원` : '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex flex-col items-center">
                                                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${status.electricityPaid ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                                                    {status.electricityPaid ? '✓' : '-'}
                                                                </span>
                                                                {status.electricityPaid && <div className="text-[10px] text-gray-400 mt-1 whitespace-nowrap">{formatChecklistTimestamp(status.electricityPaidAt)}</div>}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                isUsageModalOpen && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setIsUsageModalOpen(false)}>
                        <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 my-8" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-6 border-b pb-4">
                                <h3 className="text-lg font-bold">{selectedYear}년 {selectedMonth}월 고지서 상세 입력</h3>
                                <button onClick={() => setIsUsageModalOpen(false)} className="text-gray-400 hover:text-black">✕</button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <label className="block text-xs font-bold text-gray-500">문자/명세서 내용 붙여넣기</label>
                                    <textarea
                                        value={rawText}
                                        onChange={(e) => setRawText(e.target.value)}
                                        className="w-full h-40 p-3 text-xs font-mono bg-gray-50 border rounded-xl resize-none focus:ring-2 focus:ring-[#d9361b]"
                                        placeholder="여기에 텍스트를 붙여넣고 [추출하기]를 누르면 우측 폼이 자동으로 채워집니다."
                                    />
                                    <button type="button" onClick={parseBillText} className="w-full py-2 bg-gray-800 text-white rounded-lg text-xs font-bold hover:bg-black transition-all">텍스트에서 데이터 추출하기</button>

                                    {extractionHistory.length > 0 && (
                                        <div className="mt-4 space-y-2">
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">추출 히스토리</label>
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
                                                            <span className="font-bold text-gray-400">불러오기</span>
                                                        </button>
                                                        <button
                                                            onClick={() => deleteHistoryItem(item.id)}
                                                            className="px-2 text-gray-300 hover:text-red-500 transition-colors"
                                                            title="삭제"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                                    <h4 className="font-bold text-sm border-b pb-2">상세 내역 (직접 수정 가능)</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <InputGroup label="총 청구금액" value={manualInputs.totalAmount} onChange={v => setManualInputs({ ...manualInputs, totalAmount: v })} />
                                        <InputGroup label="당월 사용량(kWh)" value={manualInputs.currentUsage} onChange={v => setManualInputs({ ...manualInputs, currentUsage: v })} />
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
                                        <InputGroup label="부가가치세" value={manualInputs.vat} onChange={v => setManualInputs({ ...manualInputs, vat: v })} />
                                        <InputGroup label="전력기금" value={manualInputs.fund} onChange={v => setManualInputs({ ...manualInputs, fund: v })} />
                                    </div>
                                    <div className="h-px bg-gray-100 my-2"></div>
                                    <div className="space-y-2">
                                        <InputGroup label="검침일" value={manualInputs.readingDate} onChange={v => setManualInputs({ ...manualInputs, readingDate: v })} placeholder="YYYY-MM-DD" isNumeric={false} />
                                        <InputGroup label="사용기간" value={manualInputs.usagePeriod} onChange={v => setManualInputs({ ...manualInputs, usagePeriod: v })} isNumeric={false} />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 justify-end mt-6 border-t pt-4">
                                <button onClick={resetManualInputs} className="px-4 py-2 text-gray-500 text-sm font-medium hover:text-red-500 transition-colors">상세내역 초기화</button>
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
                            <h3 className="text-lg font-bold mb-4">임대인 사용량 입력</h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <InputGroup label="전월 지침 (자동)" value={landlordInputs.prevMeter} onChange={v => setLandlordInputs({ ...landlordInputs, prevMeter: v })} />
                                    <InputGroup label="당월 지침" value={landlordInputs.currMeter} onChange={v => setLandlordInputs({ ...landlordInputs, currMeter: v })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-dashed">
                                    <InputGroup label="온수기 (kWh)" value={landlordInputs.waterHeaterKw} onChange={v => setLandlordInputs({ ...landlordInputs, waterHeaterKw: v })} />
                                    <InputGroup label="외등 (kWh)" value={landlordInputs.outdoorLightKw} onChange={v => setLandlordInputs({ ...landlordInputs, outdoorLightKw: v })} />
                                </div>

                                <div className="pt-4">
                                    <label className="block text-xs font-bold text-gray-500 mb-2">계량기 사진 업로드</label>
                                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:bg-gray-50 transition-colors cursor-pointer relative overflow-hidden">
                                        <input type="file" accept="image/*" onChange={handlePhotoChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                        {landlordPhoto ? (
                                            <div className="relative h-40 w-full rounded-lg overflow-hidden">
                                                <img src={landlordPhoto} alt="Meter Preview" className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className="py-4">
                                                <div className="text-3xl mb-2">📸</div>
                                                <div className="text-gray-400 text-xs font-bold">클릭하여 계량기 사진 업로드</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end mt-6">
                                <button onClick={() => setIsLandlordModalOpen(false)} className="px-4 py-2 text-gray-500 text-sm font-medium">취소</button>
                                <button onClick={calculateLandlordBill} disabled={loading} className="bg-gray-800 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-md hover:bg-black disabled:opacity-50">
                                    {loading ? '저장 중...' : '저장하기'}
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
                                <h3 className="text-2xl font-black text-gray-900">계량기 사진 확인 (전월 vs 당월)</h3>
                                <button onClick={() => setIsPhotoModalOpen(false)} className="bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-sans">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-end">
                                        <span className="px-4 py-1.5 bg-gray-500 text-white rounded-full text-sm font-bold">전월 계량기</span>
                                        <div className="text-right">
                                            <div className="text-xs text-gray-400">전월 지침</div>
                                            <div className="text-xl font-black">{landlordData.prevMeter.toLocaleString()} <span className="text-sm font-normal text-gray-400">kWh</span></div>
                                        </div>
                                    </div>
                                    <div className="aspect-[4/3] bg-gray-100 rounded-2xl border-4 border-gray-100 overflow-hidden shadow-inner">
                                        {prevMonthPhoto ? (
                                            <img src={prevMonthPhoto} className="w-full h-full object-contain" alt="Prev month meter" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300 font-bold italic">사진 데이터 없음</div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-end">
                                        <span className="px-4 py-1.5 bg-[#d9361b] text-white rounded-full text-sm font-bold shadow-md">당월 계량기</span>
                                        <div className="text-right">
                                            <div className="text-xs text-gray-400">당월 지침</div>
                                            <div className="text-xl font-black text-[#d9361b]">{landlordData.currMeter.toLocaleString()} <span className="text-sm font-normal text-gray-400">kWh</span></div>
                                        </div>
                                    </div>
                                    <div className="aspect-[4/3] bg-gray-100 rounded-2xl border-4 border-red-50 overflow-hidden shadow-xl">
                                        {landlordData.photo ? (
                                            <img src={landlordData.photo} className="w-full h-full object-contain" alt="Current month meter" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300 font-bold italic">사진 데이터 없음</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 p-6 bg-red-50 rounded-2xl border border-red-100 text-center">
                                <div className="text-xs text-red-400 font-bold mb-1 tracking-widest uppercase">Usage Delta</div>
                                <div className="text-3xl font-black text-red-600">
                                    {(landlordData.currMeter - landlordData.prevMeter).toLocaleString()} <span className="text-lg font-bold">kWh 증가</span>
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
                                    <div className="text-xs font-bold text-gray-700 mb-2">하단 비고란 입력</div>
                                    <textarea
                                        value={invoiceRemarks}
                                        onChange={(e) => setInvoiceRemarks(e.target.value)}
                                        placeholder="청구서 하단에 인쇄할 안내사항이나 입금 계좌 변경 등의 내용을 자유롭게 적어주세요."
                                        rows={4}
                                        className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-[#d9361b] focus:border-[#d9361b] transition-all resize-none"
                                    />
                                </div>
                                <button
                                    onClick={() => window.print()}
                                    title="PDF로 저장"
                                    className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl transition-all border border-white/20 active:scale-90"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </button>
                                <button
                                    onClick={() => window.print()}
                                    title="청구서 인쇄"
                                    className="p-3 bg-gray-900 hover:bg-black text-white rounded-full shadow-2xl transition-all border border-white/20 active:scale-90"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                </button>
                                <button
                                    onClick={() => setIsInvoiceOpen(false)}
                                    title="닫기"
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
                                const usagePeriodStr = `${usageYear}.${usageMonth.toString().padStart(2, '0')}.01 ~ ${lastDay}일`;

                                return (
                                    <div className="p-[10mm] bg-white flex flex-col w-[210mm] mx-auto text-black font-sans" id="invoice-content">
                                        {/* Title Section */}
                                        <div className="text-center mb-2">
                                            <h1 className="text-[14px] font-bold tracking-[0.2em] border-b border-black pb-0.5 inline-block px-8">{selectedMonth}월 전기요금 청구 명세서</h1>
                                        </div>

                                        <div className="flex justify-between mb-2 text-[10px] gap-2">
                                            <div className="flex-1">
                                                <table className="w-full border-collapse border border-black h-full">
                                                    <tbody>
                                                        <tr>
                                                            <td className="border border-black bg-gray-50 p-0.5 w-16 font-bold text-center">청구 대상</td>
                                                            <td className="border border-black p-0.5 font-bold italic underline decoration-gray-400">(주)에코모터스 귀하</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="border border-black bg-gray-50 p-0.5 text-center font-bold">청구 년월</td>
                                                            <td className="border border-black p-0.5">{selectedYear}년 {selectedMonth}월분</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="border border-black bg-gray-50 p-0.5 text-center font-bold">사용 기간</td>
                                                            <td className="border border-black p-0.5">{usagePeriodStr}</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="border border-black bg-gray-50 p-0.5 text-center font-bold">청구 금액</td>
                                                            <td className="border border-black p-0.5 font-bold text-xs">금 {landlordTotal.toLocaleString()} 원정</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="border border-black bg-gray-50 p-0.5 text-center font-bold">입금 계좌</td>
                                                            <td className="border border-black p-0.5 font-medium tracking-tighter">토스뱅크 1000-0918-2374 예금주 이다빈</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                            <div className="flex-1">
                                                <table className="w-full border-collapse border border-black h-full">
                                                    <tbody>
                                                        <tr>
                                                            <td rowSpan={5} className="border border-black bg-gray-50 p-0.5 w-8 font-bold text-center leading-none text-[9px]">청<br />구<br />자</td>
                                                            <td className="border border-black bg-gray-50 p-0.5 w-16 text-center font-bold">상 호</td>
                                                            <td className="border border-black p-0.5 font-bold">주식회사 베이코</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="border border-black bg-gray-50 p-0.5 text-center font-bold">대 표</td>
                                                            <td className="border border-black p-0.5">이 다 빈</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="border border-black bg-gray-50 p-0.5 text-center font-bold">연락처</td>
                                                            <td className="border border-black p-0.5">010-3444-3467</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="border border-black bg-gray-50 p-0.5 text-center font-bold">주 소</td>
                                                            <td className="border border-black p-0.5 leading-none font-medium text-[8px]">부산 강서구 에코델타1로 42 e·112-903</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="border border-black bg-gray-50 p-0.5 text-center font-bold">이메일</td>
                                                            <td className="border border-black p-0.5 font-medium text-[8px]">vdvin@naver.com</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        <div className="mb-2">
                                            <div className="text-[10px] font-bold mb-0.5">1. 계량기 검침 내역</div>
                                            <table className="w-full border-collapse border border-black text-[10px]">
                                                <thead>
                                                    <tr className="bg-gray-50">
                                                        <th className="border border-black p-0.5 w-1/2">전월 지침</th>
                                                        <th className="border border-black p-0.5 w-1/2">당월 지침</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td className="border border-black p-1">
                                                            <div className="h-48 print:h-[180px] bg-white flex items-center justify-center overflow-hidden border border-gray-100">
                                                                {prevMonthPhoto ? <img src={prevMonthPhoto} className="w-full h-full object-contain" alt="prev" /> : "사진 없음"}
                                                            </div>
                                                            <div className="text-center mt-1 font-bold text-[11px]">전월 지침: {landlordData.prevMeter.toLocaleString()} kWh</div>
                                                        </td>
                                                        <td className="border border-black p-1">
                                                            <div className="h-48 print:h-[180px] bg-white flex items-center justify-center overflow-hidden border border-gray-100">
                                                                {landlordData.photo ? <img src={landlordData.photo} className="w-full h-full object-contain" alt="curr" /> : "사진 없음"}
                                                            </div>
                                                            <div className="text-center mt-1 font-bold text-[11px]">당월 지침: {landlordData.currMeter.toLocaleString()} kWh</div>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td colSpan={2} className="border border-black p-0.5 bg-gray-50">
                                                            <div className="flex justify-between items-center px-1">
                                                                <span className="text-[9px] tracking-tighter">산출: (당월 {landlordData.currMeter.toLocaleString()} - 전월 {landlordData.prevMeter.toLocaleString()}) + 온수기 {landlordData.waterHeaterKw} + 외등 {landlordData.outdoorLightKw}</span>
                                                                <span className="text-[10px] font-bold underline decoration-double">총 사용량: {landlordUsageKwh.toLocaleString()} kWh</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Breakdown Table */}
                                        <div className="flex-1">
                                            <div className="text-[10px] font-bold mb-0.5">2. 사용 요금 세부 산출 내역</div>
                                            <table className="w-full border-collapse border border-black text-[10px] text-right">
                                                <thead>
                                                    <tr className="bg-gray-50 text-center">
                                                        <th className="border border-black p-0.5">항목</th>
                                                        <th className="border border-black p-0.5">전체 금액</th>
                                                        <th className="border border-black p-0.5">베이코 분담</th>
                                                        <th className="border border-black p-0.5 bg-gray-100 font-bold">에코모터스 청구액</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td className="border border-black p-0.5 text-center bg-gray-50 font-bold">전력 사용량 (kWh)</td>
                                                        <td className="border border-black p-0.5">{(beicoUsageKwh + landlordUsageKwh).toLocaleString()} kWh</td>
                                                        <td className="border border-black p-0.5">{beicoUsageKwh.toLocaleString()} kWh</td>
                                                        <td className="border border-black p-0.5 font-bold bg-gray-100">{landlordUsageKwh.toLocaleString()} kWh</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="border border-black border-b-2 p-0.5 text-center">기본 요금 (30kw)</td>
                                                        <td className="border border-black border-b-2 p-0.5">{baseTotal.toLocaleString()} 원</td>
                                                        <td className="border border-black border-b-2 p-0.5">{beicoBaseCost.toLocaleString()} 원 (10kWh)</td>
                                                        <td className="border border-black border-b-2 p-0.5 font-bold bg-gray-100">{landlordBaseCost.toLocaleString()} 원 (20kWh)</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="border border-black p-0.5 text-center">전력량 요금</td>
                                                        <td className="border border-black p-0.5">{usageTotal.toLocaleString()} 원</td>
                                                        <td className="border border-black p-0.5">{beicoUsageCost.toLocaleString()} 원</td>
                                                        <td className="border border-black p-0.5 font-bold bg-gray-100">{landlordUsageCost.toLocaleString()} 원</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="border border-black p-0.5 text-center">기후환경 요금</td>
                                                        <td className="border border-black p-0.5">{envTotal.toLocaleString()} 원</td>
                                                        <td className="border border-black p-0.5">{beicoEnvCost.toLocaleString()} 원</td>
                                                        <td className="border border-black p-0.5 font-medium bg-gray-100">{landlordEnvCost.toLocaleString()} 원</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="border border-black p-0.5 text-center">연료비 조정액</td>
                                                        <td className="border border-black p-0.5">{fuelTotal.toLocaleString()} 원</td>
                                                        <td className="border border-black p-0.5">{beicoFuelCost.toLocaleString()} 원</td>
                                                        <td className="border border-black p-0.5 font-medium bg-gray-100">{landlordFuelCost.toLocaleString()} 원</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="border border-black p-0.5 text-center font-bold italic">부가가치세</td>
                                                        <td className="border border-black p-0.5">{totalVat.toLocaleString()} 원</td>
                                                        <td className="border border-black p-0.5">{beicoVat.toLocaleString()} 원</td>
                                                        <td className="border border-black p-0.5 font-bold bg-gray-100">{landlordVat.toLocaleString()} 원</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="border border-black p-0.5 text-center">전력산업기금</td>
                                                        <td className="border border-black p-0.5">{totalFund.toLocaleString()} 원</td>
                                                        <td className="border border-black p-0.5">{beicoFund.toLocaleString()} 원</td>
                                                        <td className="border border-black p-0.5 font-medium bg-gray-100">{landlordFund.toLocaleString()} 원</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="border border-black p-0.5 text-center">TV 수신료</td>
                                                        <td className="border border-black p-0.5">{tvTotal.toLocaleString()} 원</td>
                                                        <td className="border border-black p-0.5">{beicoTvFee.toLocaleString()} 원</td>
                                                        <td className="border border-black p-0.5 font-medium bg-gray-100">{landlordTvFee.toLocaleString()} 원</td>
                                                    </tr>
                                                    <tr className="bg-gray-100 font-bold border-t border-black">
                                                        <td className="border border-black p-0.5 text-center text-[9px]">합 계</td>
                                                        <td className="border border-black p-0.5">{billData.totalAmount.toLocaleString()} 원</td>
                                                        <td className="border border-black p-0.5">{beicoTotal.toLocaleString()} 원</td>
                                                        <td className="border border-black p-0.5 text-[10px] bg-gray-200">{landlordTotal.toLocaleString()} 원</td>
                                                    </tr>
                                                    <tr className="bg-gray-200 font-black border-t-2 border-black">
                                                        <td colSpan={3} className="border border-black p-1 text-center text-[10px]">최종 청구 금액 (납부하실 금액)</td>
                                                        <td className="border border-black p-1 text-sm text-right">{landlordTotal.toLocaleString()}원</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="mt-1 text-center border-t border-gray-100 pt-1">
                                            <p className="text-[9px] font-medium text-gray-500 italic">위와 같이 전력 사용 요금을 청구합니다.</p>
                                        </div>

                                        {invoiceRemarks && invoiceRemarks.trim() !== '' && (
                                            <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded-lg text-left">
                                                <div className="text-[10px] font-bold text-gray-800 mb-1">※ 비고</div>
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

            {/* ── 임대료영수증 탭 ── */}
            {activeTab === 'rent-receipt' && (
                <RentReceipt selectedYear={selectedYear} selectedMonth={selectedMonth} />
            )}

        </div >
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

// ── 임대료영수증 컴포넌트 ──────────────────────────────────────────────────────
function RentReceipt({ selectedYear, selectedMonth }: { selectedYear: number; selectedMonth: number }) {
    // 계약 정보 (편집 가능)
    const [contractStart, setContractStart] = React.useState('2025. 12. 14')
    const [contractEnd, setContractEnd] = React.useState('2026. 12. 13')
    const [monthlyRent, setMonthlyRent] = React.useState('1,450,000')
    const [leasePeriod, setLeasePeriod] = React.useState(
        `${selectedMonth}월 (${selectedMonth}월 14일부터 ${selectedMonth === 12 ? 1 : selectedMonth + 1}월 13일까지)`
    )

    // 지급 정보 (편집 가능)
    const [payDate, setPayDate] = React.useState(`${selectedYear}년 ${String(selectedMonth).padStart(2, '0')}월 14일`)
    const [payAmount, setPayAmount] = React.useState('1,450,000')
    const [payMethod, setPayMethod] = React.useState('이체')

    // 발행일
    const [issueDate, setIssueDate] = React.useState(`${selectedYear}년 ${String(selectedMonth).padStart(2, '0')}월 14일`)

    const inputCls = 'outline-none text-sm w-full bg-transparent py-0.5'

    return (
        <div className="space-y-4 font-sans text-black pb-10 print:pb-0">
            {/* 인쇄 버튼 */}
            <div className="flex justify-end gap-2 print:hidden mb-4">
                <button
                    onClick={() => window.print()}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-sm"
                >
                    🖨 인쇄 / PDF 저장
                </button>
            </div>

            {/* Print Style Reset */}
            <style type="text/css" media="print">{`
                @page { 
                    size: A4; 
                    margin: 0; 
                }
                body { 
                    margin: 0px; 
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                    font-size: 10pt;
                }
                nav, header, footer, .no-print, .print\\:hidden { display: none !important; }
                .print\\:shadow-none { box-shadow: none !important; }
                .print\\:m-0 { margin: 0 !important; }
                .print\\:p-0 { padding: 0 !important; }
            `}</style>

            <div id="invoice-content" className="w-[210mm] min-h-[280mm] mx-auto bg-white pt-[30mm] px-[15mm] pb-[10mm] shadow-xl print:shadow-none relative flex flex-col box-border">
                {/* Formal Header */}
                <div className="text-center mb-6 pt-2 pb-3 border-b-4 border-black">
                    <h1 className="text-3xl font-black tracking-[0.4em] mb-2 uppercase">임 대 료 영 수 증</h1>
                    <div className="flex justify-between items-end mt-4 text-xs font-bold">
                        <div className="text-left space-y-1">
                            <p className="flex items-center gap-2">발행일자:
                                <input className="border-b border-gray-300 outline-none w-32 font-bold" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[11px] text-gray-500 font-medium">(귀하의 일익 번창을 기원합니다)</p>
                        </div>
                    </div>
                </div>

                {/* Info Section - Traditional Box Style */}
                <div className="grid grid-cols-2 gap-0 mb-8">
                    {/* Recipient Side (임차인) */}
                    <div className="border-r border-black pr-4 py-1">
                        <div className="mb-1 flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-500 leading-none">供給先</span>
                                <span className="text-sm font-bold border-b-2 border-black pb-0.5">공급받는자</span>
                            </div>
                            <div className="border border-black px-2 py-0.5 text-xs items-center flex gap-1 font-bold font-sans">
                                <span>登録番号 / 등록번호:</span>
                                <span>881-88-03836</span>
                            </div>
                        </div>
                        <table className="w-full text-sm border-collapse border border-black">
                            <tbody className="divide-y divide-black">
                                <tr>
                                    <td className="py-[6px] px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">商号<br />상 호</td>
                                    <td className="py-[6px] px-2 text-[11px] font-bold">주식회사 베이코 / beiko Inc.<br /><span className="text-[10px] text-gray-500 font-normal">殿/귀하</span></td>
                                </tr>
                                <tr>
                                    <td className="py-[6px] px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">代表者<br />대 표 자</td>
                                    <td className="py-[6px] px-2 text-xs font-bold">이다빈</td>
                                </tr>
                                <tr>
                                    <td className="py-[6px] px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">住所<br />주 소</td>
                                    <td className="py-[6px] px-2 text-[11px] leading-tight font-bold tracking-tight">부산시 강서구 낙동남로 1013번길 35 1층 베이코</td>
                                </tr>
                                <tr>
                                    <td className="py-[6px] px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">電話番号<br />전화번호</td>
                                    <td className="py-[6px] px-2 text-xs font-bold">010-3444-3467</td>
                                </tr>
                                <tr>
                                    <td className="py-[6px] px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">E-mail<br />이메일</td>
                                    <td className="py-[6px] px-2 text-xs font-bold">sales@beiko.co.kr</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Supplier Side (임대인) */}
                    <div className="pl-4 py-1 bg-white relative">
                        <div className="mb-1 flex justify-between items-center">
                            <div className="flex flex-col relative">
                                <span className="text-[10px] font-bold text-gray-500 leading-none">供給者</span>
                                <div className="flex items-center gap-1 relative">
                                    <span className="text-sm font-bold border-b-2 border-black pb-0.5">공급자</span>
                                </div>
                            </div>
                            <div className="border border-black px-2 py-0.5 text-xs items-center flex gap-1 font-bold">
                                <span>登録番号 / 등록번호:</span>
                                <span>110-27-04692</span>
                            </div>
                        </div>
                        <table className="w-full text-sm border-collapse border border-black">
                            <tbody className="divide-y divide-black">
                                <tr>
                                    <td className="py-[6px] px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">商号<br />상 호</td>
                                    <td className="py-[6px] px-2 text-xs font-bold border-r border-black">(주)에코모터스</td>
                                    <td rowSpan={2} className="w-[60px] relative p-0 m-0 overflow-hidden text-center align-middle bg-white">
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <span className="text-[14px] text-gray-300 font-black opacity-30">(印)</span>
                                        </div>
                                        <div className="absolute inset-0 flex items-center justify-center z-10 px-1 py-1">
                                            <img src="/stamp.png" alt="Seal" style={{ width: '100%', height: '100%', objectFit: 'contain', mixBlendMode: 'multiply' }} className="select-none" />
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="py-[6px] px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">代表者<br />대 표 자</td>
                                    <td className="py-[6px] px-2 text-xs font-bold border-r border-black">정창용</td>
                                </tr>
                                <tr>
                                    <td className="py-[6px] px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">住所<br />주 소</td>
                                    <td colSpan={2} className="py-[6px] px-2 text-[11px] leading-tight font-bold tracking-tight">부산시 사하구 낙동남로 1405번길 13</td>
                                </tr>
                                <tr>
                                    <td className="py-[6px] px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">電話번호<br />전화번호</td>
                                    <td colSpan={2} className="py-[6px] px-2 text-xs font-bold">010-9611-1818</td>
                                </tr>
                                <tr>
                                    <td className="py-[6px] px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">E-mail<br />이메일</td>
                                    <td colSpan={2} className="py-[6px] px-2 text-xs font-bold text-gray-400">-</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 내역 */}
                <div className="flex-1">
                    <table className="w-full border-collapse border border-black text-xs mb-6">
                        <thead className="bg-gray-100 border-b border-black">
                            <tr className="text-center font-bold">
                                <th colSpan={4} className="border-x border-black py-2 text-sm tracking-widest">임대차 계약 정보</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-300 font-bold">
                            <tr>
                                <td className="border-x border-black py-2 px-3 bg-gray-50 w-32 text-center text-xs">계약 시작일</td>
                                <td className="border-x border-black py-2 px-3 w-1/3">
                                    <input className={inputCls} value={contractStart} onChange={e => setContractStart(e.target.value)} />
                                </td>
                                <td className="border-x border-black py-2 px-3 bg-gray-50 w-32 text-center text-xs">계약 종료일</td>
                                <td className="border-x border-black py-2 px-3 w-1/3">
                                    <input className={inputCls} value={contractEnd} onChange={e => setContractEnd(e.target.value)} />
                                </td>
                            </tr>
                            <tr>
                                <td className="border-x border-black py-2 px-3 bg-gray-50 text-center text-xs">월 임대료</td>
                                <td className="border-x border-black py-2 px-3 flex items-center gap-1">
                                    <input className={inputCls} value={monthlyRent} onChange={e => setMonthlyRent(e.target.value)} />
                                    <span>원</span>
                                </td>
                                <td className="border-x border-black py-2 px-3 bg-gray-50 text-center text-xs">임대 기간</td>
                                <td className="border-x border-black py-2 px-3">
                                    <input className={inputCls} value={leasePeriod} onChange={e => setLeasePeriod(e.target.value)} />
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <table className="w-full border-collapse border border-black text-xs">
                        <thead className="bg-gray-100 border-b border-black">
                            <tr className="text-center font-bold">
                                <th colSpan={4} className="border-x border-black py-2 text-sm tracking-widest">지급 정보</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-300 font-bold">
                            <tr>
                                <td className="border-x border-black py-2 px-3 bg-gray-50 w-32 text-center text-xs">지급일자</td>
                                <td className="border-x border-black py-2 px-3 w-1/3">
                                    <input className={inputCls} value={payDate} onChange={e => setPayDate(e.target.value)} />
                                </td>
                                <td className="border-x border-black py-2 px-3 bg-gray-50 w-32 text-center text-xs">지급금액</td>
                                <td className="border-x border-black py-2 px-3 w-1/3">
                                    <div className="flex items-center gap-1">
                                        <input className={inputCls} value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                                        <span className="shrink-0">원</span>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td className="border-x border-black py-2 px-3 bg-gray-50 text-center text-xs">지급방법</td>
                                <td colSpan={3} className="border-x border-black py-2 px-3">
                                    <input className={inputCls} value={payMethod} onChange={e => setPayMethod(e.target.value)} />
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="flex border border-black mt-8 items-center">
                        <div className="text-black border-r border-black px-6 py-3 font-extrabold text-center w-48 text-sm leading-tight tracking-widest">
                            영 수 금 액<br />(Total)
                        </div>
                        <div className="flex-grow px-8 py-3 text-2xl font-black text-right tracking-tight text-black">
                            ₩ {payAmount}원
                        </div>
                    </div>
                </div>

                {/* Footer Section - 대리인 삭제, 단순 발급 정보 */}
                <div className="border-t border-black mt-12 pt-4 flex justify-between items-start pb-4">
                    <div className="space-y-4 max-w-[70%]">
                        <div className="text-[10px] text-gray-500 italic leading-relaxed font-bold">
                            * 본 영수증은 (주)에코모터스의 자산에 대한 일체의 임대료가 위에 명시된 지급일자와 지급방법에 따라<br />
                            정상적으로 납부 및 영수되었음을 증명합니다.
                            <br /><br />
                            This receipt certifies that the rental fee for the property belonging to Eco Motors Co., Ltd.<br />
                            has been fully paid and received in accordance with the specified payment date and method above.
                        </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1 shrink-0 pt-2">
                        <p className="text-xl font-black tracking-widest">(주)에코모터스</p>
                    </div>
                </div>

            </div>
        </div>
    )
}
