import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
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
        <div className="space-y-6">
            <div className="sticky top-0 z-40 bg-white/80 dark:bg-[#1e1e1e]/80 backdrop-blur-xl pt-2 pb-2 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 border-b border-gray-100 dark:border-[#2a2a2a] shadow-sm dark:shadow-none transition-all duration-300">
                <div className="flex items-center gap-3">
                    <Link href="/admin" className="p-1.5 hover:bg-gray-100 dark:hover:bg-[#252525] rounded-full text-gray-400 dark:text-gray-400 hover:text-[#e53b19] transition-all" title="Dashboard">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </Link>
                    <h1 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">수입화물 인도 위임장</h1>
                </div>
            </div>

            <div className="w-[min(1720px,calc(100vw-2rem))] mx-auto">
                <CargoDeliveryClient
                    initialDrivers={drivers}
                    initialProxies={proxies}
                    recentAwbNumbers={recentAwbNumbers}
                    initialFaxRecipients={faxRecipients}
                    initialFaxLogs={faxLogs}
                />
            </div>
        </div>
    )
}
