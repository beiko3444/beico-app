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
import Badge from '@/components/ui/Badge'
import { Megaphone } from 'lucide-react'

const COUNTRY_LABELS: Record<string, string> = {
    Korea: '한국',
    Japan: '일본',
    USA: '미국',
    China: '중국',
    Turkey: '투르키예',
    Indonesia: '인도네시아',
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

export default async function PartnersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; country?: string }> }) {
    const filters = await searchParams
    const query = (filters.q || '').trim().toLocaleLowerCase()
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

    const mappedActivePartners = mapPartnerDocuments(activePartners).filter(partner => {
        if (filters.status && partner.status !== filters.status) return false
        if (filters.country && partner.country !== filters.country) return false
        return !query || [partner.name, partner.username, partner.partnerProfile?.businessName, partner.partnerProfile?.representativeName].some(value => value?.toLocaleLowerCase().includes(query))
    })
    const mappedDeletedPartners = mapPartnerDocuments(deletedPartners)

    const partnerCount = mappedActivePartners.length
    const countryLabel = (country?: string | null) => (country && COUNTRY_LABELS[country]) || country || '-'
    // Grade and country only tell partners apart, so they use the outline badge rather than a status colour.
    // Accounts without a profile grade (administrators) show "-" instead of a made-up C.
    const gradeLabel = (grade?: string | null) => grade || '-'
    const fieldClass = 'ux-input h-10 min-h-10 py-0'
    type PartnerRow = (typeof mappedActivePartners)[number]
    const renderName = (partner: PartnerRow) => (
        <PartnerForm
            initialData={partner}
            trigger={
                <button type="button" className="max-w-full text-left">
                    <span className="flex flex-wrap items-center gap-1.5">
                        <span className="break-keep text-[14px] font-bold text-slate-900 underline-offset-4 hover:underline">{partner.partnerProfile?.businessName || partner.name}</span>
                        {partner.role === 'ADMIN' ? <Badge outline>관리자</Badge> : null}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-slate-500">{partner.username} · 담당자 {partner.partnerProfile?.representativeName || '-'}</span>
                </button>
            }
        />
    )
    // The approve slot keeps its width when empty, so 수정 and 삭제 stay in the same place on every row.
    const renderActions = (partner: PartnerRow) => (
        <div className="flex items-center justify-end gap-1.5">
            <div className="flex w-[76px] justify-end">
                <ApproveUserButton userId={partner.id} currentStatus={partner.status} />
            </div>
            <PartnerForm initialData={partner} trigger={<button type="button" className={buttonClass('secondary', 'sm')}>수정</button>} />
            <DeletePartnerButton partnerId={partner.id} size="sm" />
        </div>
    )

    return (
        <div className="min-w-0 space-y-4">
            <PageHeader title="파트너 관리" count={partnerCount} description="거래처 정보를 조회하고 승인 상태를 관리합니다. 등급은 거래 단가에 적용됩니다." actions={<>
                <Link href="/admin/notices" className={buttonClass('secondary')}><Megaphone size={15} />파트너 공지</Link>
                <PartnerTrashbin deletedPartners={mappedDeletedPartners} /><PartnerForm />
            </>} />

            <form className="ux-panel flex flex-wrap items-end gap-3 p-4" method="get">
                <label className="min-w-0 basis-full sm:min-w-[260px] sm:flex-1 sm:basis-auto"><span className="mb-1 block text-xs font-semibold text-slate-600">상호·아이디·담당자</span><input name="q" type="search" defaultValue={filters.q || ''} placeholder="파트너 검색" className={fieldClass} /></label>
                <label className="min-w-[140px] flex-1 sm:flex-none"><span className="mb-1 block text-xs font-semibold text-slate-600">승인 상태</span><select name="status" defaultValue={filters.status || ''} className={fieldClass}><option value="">전체</option><option value="PENDING">승인 대기</option><option value="APPROVED">승인 완료</option></select></label>
                <label className="min-w-[140px] flex-1 sm:flex-none"><span className="mb-1 block text-xs font-semibold text-slate-600">거래 국가</span><select name="country" defaultValue={filters.country || ''} className={fieldClass}><option value="">전체</option><option value="Korea">한국</option><option value="Japan">일본</option><option value="USA">미국</option><option value="China">중국</option><option value="Turkey">투르키예</option><option value="Indonesia">인도네시아</option></select></label>
                <div className="flex basis-full gap-2 sm:basis-auto">
                    <button type="submit" className={buttonClass('secondary', 'md', 'flex-1 sm:flex-none')}>조회</button>
                    <Link href="/admin/partners" className={buttonClass('ghost', 'md', 'flex-1 sm:flex-none')}>초기화</Link>
                </div>
            </form>

            <section className="ux-panel overflow-hidden" aria-label="파트너 목록">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
                    <span className="text-sm font-semibold tabular-nums">조회 결과 {partnerCount}개</span>
                    <span className="text-xs text-[var(--muted-foreground)]">상호를 누르거나 수정을 눌러 정보를 바꿀 수 있습니다.</span>
                </div>
                {partnerCount === 0 ? (
                    <EmptyState bare compact title="등록된 파트너가 없습니다." />
                ) : (
                    <>
                        {/* Below lg the nine columns do not fit, so each partner becomes a card with its actions in reach. */}
                        <ul className="divide-y divide-[var(--border)] lg:hidden">
                            {mappedActivePartners.map(partner => (
                                <li key={partner.id} className="space-y-3 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">{renderName(partner)}</div>
                                        <div className="flex shrink-0 items-center gap-1">
                                            <Badge outline>{gradeLabel(partner.partnerProfile?.grade)}</Badge>
                                            <Badge outline>{countryLabel(partner.country)}</Badge>
                                        </div>
                                    </div>
                                    <dl className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-1 text-[13px]">
                                        <dt className="text-slate-500">연락처</dt><dd className="tabular-nums text-slate-700">{partner.partnerProfile?.contact || '-'}</dd>
                                        <dt className="text-slate-500">이메일</dt><dd className="truncate text-slate-700">{partner.partnerProfile?.email || '-'}</dd>
                                        <dt className="text-slate-500">사업자번호</dt><dd className="tabular-nums text-slate-700">{partner.partnerProfile?.businessRegNumber || '-'}</dd>
                                        <dt className="text-slate-500">주소</dt><dd className="line-clamp-2 break-keep text-slate-700">{partner.partnerProfile?.address || '-'}</dd>
                                    </dl>
                                    {renderActions(partner)}
                                </li>
                            ))}
                        </ul>
                        <div className="hidden overflow-x-auto lg:block">
                            <table className="min-w-full table-auto border-collapse text-[13px]">
                                <thead className="ux-thead">
                                    <tr>
                                        <th className="w-12 text-right">No</th>
                                        <th className="min-w-[240px] text-left">상호명</th>
                                        <th className="w-16 text-center">등급</th>
                                        <th className="w-20 text-center">국가</th>
                                        <th className="text-left">사업자번호</th>
                                        <th className="min-w-[200px] text-left">주소</th>
                                        <th className="text-left">연락처</th>
                                        {/* Pinned right so 승인·수정·삭제 stay visible when the table scrolls sideways. */}
                                        <th className="sticky right-0 z-[1] text-right shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.18)]">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {mappedActivePartners.map((partner, index) => (
                                        <tr key={partner.id} className="group bg-white transition-colors hover:bg-slate-50">
                                            <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-slate-500">{partnerCount - index}</td>
                                            <td className="min-w-[240px] px-3 py-2.5 text-left">{renderName(partner)}</td>
                                            <td className="px-3 py-2.5 text-center"><Badge outline>{gradeLabel(partner.partnerProfile?.grade)}</Badge></td>
                                            <td className="px-3 py-2.5 text-center"><Badge outline>{countryLabel(partner.country)}</Badge></td>
                                            <td className="whitespace-nowrap px-3 py-2.5 text-left tabular-nums text-slate-600">{partner.partnerProfile?.businessRegNumber || '-'}</td>
                                            <td className="max-w-[260px] px-3 py-2.5 text-left text-slate-600" title={partner.partnerProfile?.address || ''}><span className="line-clamp-2 whitespace-normal break-keep">{partner.partnerProfile?.address || '-'}</span></td>
                                            <td className="whitespace-nowrap px-3 py-2.5 text-left tabular-nums text-slate-600">
                                                <div>{partner.partnerProfile?.contact || '-'}</div>
                                                <div className="mt-0.5 text-[12px] text-slate-500">{partner.partnerProfile?.email || '-'}</div>
                                            </td>
                                            <td className="sticky right-0 bg-white px-3 py-2.5 shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.18)] group-hover:bg-slate-50">{renderActions(partner)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </section>
        </div>
    )
}
