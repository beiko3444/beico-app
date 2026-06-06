export type ElectricityBillData = {
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

export type ElectricityLandlordData = {
    hasReading: boolean
    prevMeter: number
    currMeter: number
    waterHeaterKw: number
    outdoorLightKw: number
    photo: string | null
    photoUploadedAt: string | null
}

type ElectricityUsageRecordLike = {
    landlordMeterCurr?: number | null
}

type BuildElectricitySavePayloadInput = {
    selectedYear: number
    selectedMonth: number
    billData: ElectricityBillData | null
    landlordData: ElectricityLandlordData | null
    rawText: string
    extractionHistory: unknown[]
    currentRawText?: string
    currentHistory?: unknown[]
}

export type ElectricitySavePayload = {
    year: number
    month: number
} & Record<string, unknown>

export function hasSavedLandlordReading(data: ElectricityUsageRecordLike | null | undefined) {
    return data?.landlordMeterCurr !== null && data?.landlordMeterCurr !== undefined
}

function calculateElectricityShares(billData: ElectricityBillData | null, landlordData: ElectricityLandlordData | null) {
    if (!billData) return { landlordTotal: 0, beicoTotal: 0 }

    const baseTotal = billData.parsedDetails['기본요금'] || 0
    const usageTotal = billData.parsedDetails['전력량요금'] || 0
    const envTotal = billData.parsedDetails['기후환경요금'] || 0
    const fuelTotal = billData.parsedDetails['연료비조정액'] || 0
    const powerFactorTotal = billData.parsedDetails['역률요금'] || 0
    const tvTotal = billData.parsedDetails['TV수신료'] || 0
    const totalVat = billData.parsedDetails['부가가치세'] || 0
    const totalFund = billData.parsedDetails['전력기금'] || 0

    const landlordBaseCost = Math.round(baseTotal * (20 / 30))
    const landlordUsageKwh = landlordData?.hasReading
        ? (landlordData.currMeter - landlordData.prevMeter) + landlordData.waterHeaterKw + landlordData.outdoorLightKw
        : 0
    const totalKwh = billData.currentUsage || 0
    const usageRatioLandlord = totalKwh > 0 ? (landlordUsageKwh / totalKwh) : 0

    const landlordUsageCost = Math.round(usageTotal * usageRatioLandlord)
    const landlordEnvCost = Math.round(envTotal * usageRatioLandlord)
    const landlordFuelCost = Math.round(fuelTotal * usageRatioLandlord)
    const landlordPowerFactor = Math.round(powerFactorTotal * usageRatioLandlord)
    const landlordTvFee = Math.round(tvTotal / 2)

    const landlordSubTotal = landlordBaseCost + landlordUsageCost + landlordEnvCost + landlordFuelCost + landlordPowerFactor
    const beicoSubTotal = (baseTotal - landlordBaseCost)
        + (usageTotal - landlordUsageCost)
        + (envTotal - landlordEnvCost)
        + (fuelTotal - landlordFuelCost)
        + (powerFactorTotal - landlordPowerFactor)

    const totalBillingAmount = landlordSubTotal + beicoSubTotal
    const taxRatioLandlord = totalBillingAmount !== 0 ? (landlordSubTotal / totalBillingAmount) : 0

    const landlordVat = Math.round(totalVat * taxRatioLandlord)
    const landlordFund = Math.round(totalFund * taxRatioLandlord)

    const landlordTotal = landlordSubTotal + landlordVat + landlordFund + landlordTvFee
    const beicoTotal = billData.totalAmount - landlordTotal

    return { landlordTotal, beicoTotal }
}

export function buildElectricitySavePayload(input: BuildElectricitySavePayloadInput): ElectricitySavePayload {
    const { billData, landlordData } = input
    const payload: ElectricitySavePayload = {
        year: billData ? billData.year : input.selectedYear,
        month: billData ? billData.month : input.selectedMonth,
    }

    if (billData) {
        const shares = calculateElectricityShares(billData, landlordData)
        Object.assign(payload, {
            readingDate: billData.readingDate,
            usagePeriod: billData.usagePeriod,
            meterCurrent: billData.meterCurrent,
            meterPrevious: billData.meterPrevious,
            totalUsage: billData.currentUsage,
            totalAmount: billData.totalAmount,
            rawBillData: JSON.stringify({
                ...billData.parsedDetails,
                beicoTotal: shares.beicoTotal,
                landlordTotal: shares.landlordTotal,
            }),
            rawText: input.currentRawText !== undefined ? input.currentRawText : input.rawText,
            extractionHistory: JSON.stringify(input.currentHistory !== undefined ? input.currentHistory : input.extractionHistory),
        })
    }

    if (landlordData) {
        if (landlordData.hasReading) {
            Object.assign(payload, {
                landlordMeterPrev: landlordData.prevMeter,
                landlordMeterCurr: landlordData.currMeter,
                landlordUsage: landlordData.currMeter - landlordData.prevMeter + landlordData.waterHeaterKw + landlordData.outdoorLightKw,
                waterHeaterKw: landlordData.waterHeaterKw,
                outdoorLightKw: landlordData.outdoorLightKw,
            })
        }

        payload.meterPhotoUrl = landlordData.photo
    }

    return payload
}
