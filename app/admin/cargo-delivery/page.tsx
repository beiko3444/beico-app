import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import {
    toFaxLogRecord,
    toProxyRecord,
    type CargoDriverRecord,
    type CargoFaxLogRecord,
    type CargoFaxRecipientRecord,
    type CargoProxyRecord,
} from "@/lib/cargoDeliveryProxy"
import { describeBarobillFaxLog, describeBarobillFaxResult } from "@/lib/barobillFax"
import CargoDeliveryClient from "./CargoDeliveryClient"

export const metadata = { title: '인도 위임장' }

export const dynamic = 'force-dynamic'

export default async function CargoDeliveryPage() {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        redirect('/login')
    }

    let drivers: CargoDriverRecord[] = []
    let proxies: CargoProxyRecord[] = []
    let recentAwbNumbers: string[] = []
    let faxRecipients: CargoFaxRecipientRecord[] = []
    let faxLogs: CargoFaxLogRecord[] = []
    try {
        const [driverRows, proxyRows, awbRows, recipientRows, faxRows] = await Promise.all([
            prisma.cargoDeliveryDriver.findMany({
                orderBy: { createdAt: 'asc' },
                select: { id: true, name: true, phone: true, vehicleNo: true },
            }),
            prisma.cargoDeliveryProxy.findMany({
                orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
                take: 200,
            }),
            // 지렁이 발주 메일에서 수집된 AWB 번호를 B/L 입력 자동완성으로 제공
            prisma.wormEmailAwbCache.findMany({
                orderBy: { updatedAt: 'desc' },
                take: 40,
                select: { awbNumber: true },
            }),
            prisma.cargoFaxRecipient.findMany({
                orderBy: { createdAt: 'asc' },
                select: { id: true, name: true, faxNumber: true },
            }),
            prisma.cargoDeliveryFaxLog.findMany({
                orderBy: { createdAt: 'desc' },
                take: 200,
            }),
        ])
        drivers = driverRows
        proxies = proxyRows.map(toProxyRecord)
        recentAwbNumbers = Array.from(new Set(awbRows.map((row) => row.awbNumber.trim()).filter(Boolean))).slice(0, 20)
        faxRecipients = recipientRows
        faxLogs = faxRows.map((row) => toFaxLogRecord(row, { state: describeBarobillFaxLog, result: describeBarobillFaxResult }))
    } catch (error) {
        console.error('Failed to load cargo delivery page data:', error)
    }

    return (
        <CargoDeliveryClient
            initialDrivers={drivers}
            initialProxies={proxies}
            recentAwbNumbers={recentAwbNumbers}
            initialFaxRecipients={faxRecipients}
            initialFaxLogs={faxLogs}
        />
    )
}
