import { prisma } from "@/lib/prisma"
import { inferBusinessRegistrationContentType } from "@/lib/partner-business-registration-storage"
import { getPartnerBusinessRegistrationUrl } from "@/lib/partner-business-registration-url"
import { unstable_cache } from "next/cache"
import PartnerForm from "./partner-form"
import DeletePartnerButton from '@/components/DeletePartnerButton'
import Link from 'next/link'
import ApproveUserButton from '@/components/ApproveUserButton'
import PartnerTrashbin from '@/components/PartnerTrashbin'

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

        <div className="space-y-6">
            {/* Sticky Header */}
            <div className="sticky top-0 z-40 bg-white/80 dark:bg-[#1e1e1e]/80 backdrop-blur-xl pt-2 pb-2 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 border-b border-gray-100 dark:border-[#2a2a2a] shadow-sm dark:shadow-none transition-all duration-300">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                            <Link href="/admin" className="p-1.5 hover:bg-gray-100 dark:hover:bg-[#252525] rounded-full text-gray-400 dark:text-gray-500 hover:text-[#d9361b] transition-all" title="Dashboard">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                            </Link>
                            <h1 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">파트너 관리</h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <PartnerTrashbin deletedPartners={mappedDeletedPartners} />
                        <PartnerForm />
                    </div>
                </div>
            </div>

            <div className="glass-panel rounded-2xl shadow-sm dark:shadow-none bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-[#2a2a2a] overflow-x-auto">
                <table className="table-auto min-w-full border-collapse text-xs">
                    <thead className="bg-[#d9361b] text-white h-8">
                        <tr>
                            <th className="px-3 py-1.5 text-center font-bold border-r border-white/20 whitespace-nowrap w-12">No</th>
                            <th className="px-3 py-1.5 text-left font-bold border-r border-white/20 whitespace-nowrap">상호명</th>
                            <th className="px-3 py-1.5 text-center font-bold border-r border-white/20 whitespace-nowrap w-16">등급</th>
                            <th className="px-3 py-1.5 text-center font-bold border-r border-white/20 whitespace-nowrap">사업자번호</th>
                            <th className="px-3 py-1.5 text-center font-bold border-r border-white/20 whitespace-nowrap w-20">국가</th>
                            <th className="px-3 py-1.5 text-left font-bold border-r border-white/20 whitespace-nowrap">주소</th>
                            <th className="px-3 py-1.5 text-left font-bold border-r border-white/20 whitespace-nowrap">연락처</th>
                            <th className="px-3 py-1.5 text-left font-bold border-r border-white/20 whitespace-nowrap">이메일</th>
                            <th className="px-3 py-1.5 text-center font-bold whitespace-nowrap w-24">관리</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-[#2a2a2a]">
                        {mappedActivePartners.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400 font-medium">
                                    등록된 파트너가 없습니다. 새 파트너 계정을 생성해주세요.
                                </td>
                            </tr>
                        ) : (
                            mappedActivePartners.map((partner, index) => (
                                <tr key={partner.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors group even:bg-gray-50/50 dark:even:bg-[#1a1a1a]">
                                    <td className="px-3 py-1.5 text-center font-bold text-gray-400 dark:text-gray-500">{mappedActivePartners.length - index}</td>
                                    <td className="px-3 py-1.5 text-left">
                                        <PartnerForm
                                            initialData={partner}
                                            trigger={
                                                <button className="text-left hover:underline decoration-gray-400 dark:decoration-gray-500 underline-offset-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="font-bold text-gray-900 dark:text-white group-hover:text-[var(--color-brand-blue)] transition-colors text-sm">{partner.name}</div>
                                                        {partner.role === 'ADMIN' && (
                                                            <span className="px-1 py-0.5 bg-gray-900 text-white text-[8px] font-black rounded uppercase">Admin</span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] text-gray-400 dark:text-gray-500">담당자: {partner.partnerProfile?.representativeName || '-'}</div>
                                                </button>
                                            }
                                        />
                                    </td>
                                    <td className="px-3 py-1.5 text-center">
                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${partner.partnerProfile?.grade === 'A' ? 'bg-red-50 text-red-600 border border-red-100' :
                                            partner.partnerProfile?.grade === 'B' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                                                partner.partnerProfile?.grade === 'C' ? 'bg-green-50 text-green-600 border border-green-100' :
                                                    'bg-gray-50 text-gray-500 border border-gray-100'
                                            }`}>
                                            {partner.partnerProfile?.grade || 'C'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-1.5 text-center text-gray-600 dark:text-gray-400 font-mono tracking-tight">{partner.partnerProfile?.businessRegNumber || '-'}</td>
                                    <td className="px-3 py-1.5 text-center">
                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${partner.country === 'Korea' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                            partner.country === 'Japan' ? 'bg-red-50 text-red-600 border border-red-100' :
                                                partner.country === 'USA' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                                                    'bg-gray-50 text-gray-500 border border-gray-100'
                                            }`}>
                                            {partner.country === 'Korea' ? '🇰🇷 한국' :
                                                partner.country === 'Japan' ? '🇯🇵 일본' :
                                                    partner.country === 'USA' ? '🇺🇸 미국' :
                                                        partner.country === 'China' ? '🇨🇳 중국' :
                                                            partner.country === 'Turkey' ? '🇹🇷 투르키예' :
                                                                partner.country === 'Indonesia' ? '🇮🇩 인도네시아' :
                                                                    partner.country || '-'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-1.5 text-left text-gray-600 dark:text-gray-400 truncate max-w-[200px]" title={partner.partnerProfile?.address || ''}>{partner.partnerProfile?.address || '-'}</td>
                                    <td className="px-3 py-1.5 text-left text-gray-700 dark:text-gray-400 font-medium">{partner.partnerProfile?.contact || '-'}</td>
                                    <td className="px-3 py-1.5 text-left text-gray-500 dark:text-gray-400 font-mono text-[10px]">{partner.partnerProfile?.email || '-'}</td>
                                    <td className="px-3 py-1.5 text-center">
                                        <div className="flex items-center justify-center gap-1">
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
