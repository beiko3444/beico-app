import { prisma } from "@/lib/prisma"
import { inferBusinessRegistrationContentType } from "@/lib/partner-business-registration-storage"
import { getPartnerBusinessRegistrationUrl } from "@/lib/partner-business-registration-url"
import { unstable_cache } from "next/cache"
import PartnerForm from "./partner-form"
import DeletePartnerButton from '@/components/DeletePartnerButton'
import Link from 'next/link'
import ApproveUserButton from '@/components/ApproveUserButton'
import PartnerTrashbin from '@/components/PartnerTrashbin'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import { buttonClass } from '@/components/ui/buttonClass'
import { Megaphone } from 'lucide-react'

const COUNTRY_LABELS: Record<string, string> = {
    Korea: '한국',
    Japan: '일본',
    USA: '미국',
    China: '중국',
    Turkey: '투르키예',
    Indonesia: '인도네시아',
}

function gradeBadgeClass(grade?: string | null) {
    if (grade === 'A') return 'border-red-100 bg-red-50 text-red-600'
    if (grade === 'B') return 'border-orange-200 bg-brand-orange-soft text-brand-orange'
    if (grade === 'C') return 'border-emerald-100 bg-emerald-50 text-emerald-600'
    return 'border-slate-200 bg-slate-50 text-slate-600'
}

// Force dynamic to ensure we get fresh data
export const dynamic = 'force-dynamic'

const getCachedPartnersPageData = unstable_cache(
    async () => {
        const partnerListSelect = {
            id: true,
            username: true,
            name: true,
            role: true,
            status: true,
            country: true,
            createdAt: true,
            updatedAt: true,
            partnerProfile: {
                select: {
                    id: true,
                    contact: true,
                    email: true,
                    businessName: true,
                    representativeName: true,
                    businessRegNumber: true,
                    address: true,
                    businessRegistrationUrl: true,
                    grade: true,
                }
            }
        } as const

        const [activePartners, deletedPartners] = await Promise.all([
            prisma.user.findMany({
                where: { role: { in: ['PARTNER', 'ADMIN'] }, status: { not: 'DELETED' } },
                select: partnerListSelect,
                orderBy: [{ role: 'asc' }, { createdAt: 'desc' }]
            }),
            prisma.user.findMany({
                where: { role: { in: ['PARTNER', 'ADMIN'] }, status: 'DELETED' },
                select: partnerListSelect,
                orderBy: [{ createdAt: 'desc' }]
            })
        ])
        return { activePartners, deletedPartners }
    },
    ['admin-partners-page-v2'],
    { revalidate: 60, tags: ['partners'] }
)

export default async function PartnersPage() {
    const { activePartners, deletedPartners } = await getCachedPartnersPageData()

    const mapPartnerDocuments = (partners: typeof activePartners) => partners.map(({ partnerProfile, updatedAt, ...partner }) => ({
        ...partner,
        updatedAt,
        partnerProfile: partnerProfile ? {
            ...partnerProfile,
            businessRegistrationContentType: inferBusinessRegistrationContentType(partnerProfile.businessRegistrationUrl),
            businessRegistrationUrl: partnerProfile.businessRegistrationUrl
                ? getPartnerBusinessRegistrationUrl(partner.id, updatedAt)
                : null,
        } : null,
    }))

    const mappedActivePartners = mapPartnerDocuments(activePartners)
    const mappedDeletedPartners = mapPartnerDocuments(deletedPartners)

    return (
        <div className="min-w-0 space-y-5">
            <PageHeader
                title="파트너관리"
                count={mappedActivePartners.length}
                description="파트너 계정을 등록·수정하고 가입 승인과 등급을 관리합니다."
                actions={(
                    <>
                        <Link href="/admin/notices" className={buttonClass('secondary', 'md')}>
                            <Megaphone size={15} />
                            파트너 공지
                        </Link>
                        <PartnerTrashbin deletedPartners={mappedDeletedPartners} />
                        <PartnerForm />
                    </>
                )}
            />

            <div className="min-w-0 overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:bg-[#1e1e1e] dark:border-[#2a2a2a]">
                <table className="w-full min-w-[960px] table-auto border-collapse text-xs">
                    <thead className="ux-thead">
                        <tr>
                            <th className="w-12 text-center">No</th>
                            <th className="text-left">상호명</th>
                            <th className="w-16 text-center">등급</th>
                            <th className="text-center">사업자번호</th>
                            <th className="w-24 text-center">국가</th>
                            <th className="text-left">주소</th>
                            <th className="text-left">연락처</th>
                            <th className="text-left">이메일</th>
                            <th className="min-w-[150px] text-center">관리</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#2a2a2a]">
                        {mappedActivePartners.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="p-4">
                                    <EmptyState compact title="등록된 파트너가 없습니다." />
                                </td>
                            </tr>
                        ) : (
                            mappedActivePartners.map((partner, index) => (
                                <tr key={partner.id} className="group transition-colors hover:bg-slate-50 dark:hover:bg-blue-900/20">
                                    <td className="whitespace-nowrap px-3 py-2 text-center font-bold text-slate-500 dark:text-gray-500">{mappedActivePartners.length - index}</td>
                                    <td className="min-w-[180px] px-3 py-2 text-left">
                                        <PartnerForm
                                            initialData={partner}
                                            trigger={
                                                <button type="button" className="text-left underline-offset-4 decoration-slate-400 hover:underline dark:decoration-gray-500">
                                                    <div className="flex items-center gap-2 whitespace-nowrap">
                                                        <div className="text-sm font-bold text-slate-900 transition-colors group-hover:text-brand-orange dark:text-white">{partner.name}</div>
                                                        {partner.role === 'ADMIN' && (
                                                            <span className="inline-flex h-5 items-center whitespace-nowrap rounded-full bg-brand-ink px-2 text-[11px] font-bold text-white">관리자</span>
                                                        )}
                                                    </div>
                                                    <div className="mt-0.5 text-[11px] text-slate-500 dark:text-gray-500">담당자: {partner.partnerProfile?.representativeName || '-'}</div>
                                                </button>
                                            }
                                        />
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <span className={`inline-flex h-6 items-center whitespace-nowrap rounded-full border px-2.5 text-[11px] font-bold ${gradeBadgeClass(partner.partnerProfile?.grade)}`}>
                                            {partner.partnerProfile?.grade || 'C'}
                                        </span>
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2 text-center text-slate-600 dark:text-gray-400">{partner.partnerProfile?.businessRegNumber || '-'}</td>
                                    <td className="px-3 py-2 text-center">
                                        <span className="inline-flex h-6 items-center whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-bold text-slate-600">
                                            {(partner.country && COUNTRY_LABELS[partner.country]) || partner.country || '-'}
                                        </span>
                                    </td>
                                    <td className="max-w-[220px] truncate px-3 py-2 text-left text-slate-600 dark:text-gray-400" title={partner.partnerProfile?.address || ''}>{partner.partnerProfile?.address || '-'}</td>
                                    <td className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-700 dark:text-gray-400">{partner.partnerProfile?.contact || '-'}</td>
                                    <td className="whitespace-nowrap px-3 py-2 text-left text-[12px] text-slate-600 dark:text-gray-400">{partner.partnerProfile?.email || '-'}</td>
                                    <td className="px-3 py-2 text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                            <ApproveUserButton userId={partner.id} currentStatus={partner.status} />
                                            <DeletePartnerButton partnerId={partner.id} size="sm" />
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
