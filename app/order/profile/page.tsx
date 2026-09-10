import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ChangePasswordForm from '@/components/ChangePasswordForm'
import PartnerProfileForm from '@/components/PartnerProfileForm'

export default async function ProfilePage() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) redirect('/login')
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, username: true, country: true, role: true, status: true,
            partnerProfile: { select: { contact: true, email: true, fax: true, address: true, businessName: true, representativeName: true, businessRegNumber: true } } },
    })
    if (!user) redirect('/login')
    const isKorean = user.country === 'Korea'
    const profile = user.partnerProfile
    const accountFields = [
        [isKorean ? '로그인 아이디' : 'ログインID', user.username],
        [isKorean ? '업체명' : '会社名', profile?.businessName],
        [isKorean ? '대표자명' : '代表者名', profile?.representativeName],
        [isKorean ? '사업자등록번호' : '事業者登録番号', profile?.businessRegNumber],
        [isKorean ? '거래 국가' : '取引国', user.country],
    ]
    return <div className="mx-auto max-w-4xl space-y-6 pb-16">
        <header>
            <h1 className="text-3xl font-bold">{isKorean ? '내 정보' : 'マイページ'}</h1>
            <p className="mt-2 text-base text-[var(--muted-foreground)]">{isKorean ? '연락처와 주소를 최신 정보로 관리해 주세요.' : '連絡先と住所を最新の情報に更新してください。'}</p>
        </header>
        {user.role === 'PARTNER' && user.status === 'APPROVED' && <PartnerProfileForm isKorean={isKorean} initial={{
            name: user.name, contact: profile?.contact || '', email: profile?.email || '', fax: profile?.fax || '', address: profile?.address || '',
        }} />}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-7">
            <h2 className="text-xl font-bold">{isKorean ? '계정 및 사업자 정보' : 'アカウント・事業者情報'}</h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">{isKorean ? '아래 정보의 변경은 관리자에게 요청해 주세요. 연락용 이메일을 바꿔도 로그인 아이디는 유지됩니다.' : '以下の情報の変更は管理者にご依頼ください。連絡先メールを変更してもログインIDは変わりません。'}</p>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                {accountFields.map(([label, value]) => <div key={label}><dt className="text-sm text-[var(--muted-foreground)]">{label}</dt><dd className="mt-1 break-words text-base font-semibold">{value || '—'}</dd></div>)}
            </dl>
        </section>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-7">
            <h2 className="mb-5 text-xl font-bold">{isKorean ? '비밀번호 변경' : 'パスワード変更'}</h2>
            <div className="max-w-lg"><ChangePasswordForm isKorean={isKorean} /></div>
        </section>
    </div>
}
