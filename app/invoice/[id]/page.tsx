import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import InvoiceButtons from "@/components/InvoiceButtons"
import InvoiceWrapper from "@/components/InvoiceWrapper"
import InvoiceFit from "./InvoiceFit"

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) redirect('/login')

    const { id } = await params
    const order = await prisma.order.findUnique({
        where: { id },
        select: {
            id: true,
            userId: true,
            orderNumber: true,
            shippingFeeOverride: true,
            createdAt: true,
            user: {
                select: {
                    name: true,
                    country: true,
                    partnerProfile: {
                        select: {
                            businessRegNumber: true,
                            businessName: true,
                            representativeName: true,
                            address: true,
                            contact: true,
                            email: true,
                        },
                    },
                },
            },
            items: {
                select: {
                    id: true,
                    quantity: true,
                    price: true,
                    product: {
                        select: {
                            name: true,
                            nameJP: true,
                        },
                    },
                },
            },
        }
    })

    if (!order || order.items.length === 0) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center shadow-sm">
                    <p className="text-sm font-semibold text-[var(--muted-foreground)]">{session.user.country === 'Japan' ? '注文履歴がありません。' : '주문내역이 없습니다.'}</p>
                </div>
            </div>
        )
    }

    // Security Check: Only Admin or the Order Owner can view
    if (session.user.role !== 'ADMIN' && order.userId !== session.user.id) {
        return <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4 text-sm font-semibold text-[var(--muted-foreground)]">{session.user.country === 'Japan' ? 'この書類を表示する権限がありません。' : '이 문서를 볼 권한이 없습니다.'}</div>
    }

    // Generate Info (Formatted to match other views)
    const date = new Date(order.createdAt)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const ampm = date.getHours() >= 12 ? '오후' : '오전'
    let hour = date.getHours() % 12
    if (hour === 0) hour = 12
    const minute = String(date.getMinutes()).padStart(2, '0')
    const formattedDate = `${year}년 ${month}월 ${day}일 ${ampm} ${hour}:${minute}`

    const displayOrderNumber = order.orderNumber || order.id.slice(0, 8);

    // Calculate Totals based on items + shipping fee logic
    const productTotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const shippingFee = order.shippingFeeOverride ?? (totalQuantity > 0 ? Math.ceil(totalQuantity / 100) * 3000 : 0);

    const supplyTotal = productTotal + shippingFee
    const taxTotal = Math.round(supplyTotal * 0.1)
    const grandTotal = supplyTotal + taxTotal

    // The document is bilingual by design; the partner's own language goes first in item names.
    // The toolbar and phone summary follow the viewer (admins are Korean staff).
    const partnerIsKorean = order.user.country === 'Korea'
    const viewerIsKorean = session.user.role === 'ADMIN' || session.user.country === 'Korea'
    const issueDate = `${year}.${month}.${day}`

    return (
        <InvoiceWrapper>
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

            <InvoiceButtons orderNumber={displayOrderNumber} isKorean={viewerIsKorean} />
            <div className="px-3 sm:px-6 print:p-0">
            {/* On phones the sheet is scaled down, so the figures a partner needs come first at a readable size. */}
            <section aria-label={viewerIsKorean ? '거래 요약' : '取引の概要'} className="mx-auto mb-4 max-w-[210mm] rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-[var(--foreground)] sm:hidden print:hidden">
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1.5 text-sm">
                    <dt className="text-[var(--muted-foreground)]">{viewerIsKorean ? '주문번호' : '注文番号'}</dt>
                    <dd className="font-semibold tabular-nums">{displayOrderNumber}</dd>
                    <dt className="text-[var(--muted-foreground)]">{viewerIsKorean ? '발행일' : '発行日'}</dt>
                    <dd className="tabular-nums">{issueDate}</dd>
                    <dt className="text-[var(--muted-foreground)]">{viewerIsKorean ? '합계 (VAT 포함)' : '合計（税込）'}</dt>
                    <dd className="text-xl font-bold tabular-nums">₩{grandTotal.toLocaleString()}</dd>
                </dl>
                <div className="mt-3 border-t border-[var(--border)] pt-3 text-sm">
                    <p className="text-xs font-semibold text-[var(--muted-foreground)]">{viewerIsKorean ? '입금 계좌' : 'お振込先'}</p>
                    <p className="mt-1 font-semibold tabular-nums">{viewerIsKorean ? 'IBK기업은행' : 'IBK Industrial Bank of Korea'} 656-045236-01-013</p>
                    <p className="text-[var(--muted-foreground)]">{viewerIsKorean ? '예금주' : '名義人'} 주식회사 베이코</p>
                </div>
                <p className="ux-helper mt-3 break-keep">{viewerIsKorean ? '아래 문서는 화면 폭에 맞춰 축소해 보여 줍니다. 인쇄와 PNG 저장은 원래 A4 크기로 됩니다.' : '下の書類は画面幅に合わせて縮小表示しています。印刷・PNG保存は元のA4サイズで出力されます。'}</p>
            </section>
            <InvoiceFit><div id="invoice-content" className="relative mx-auto flex min-h-[280mm] w-[210mm] flex-col bg-white px-[15mm] pb-[5mm] pt-[30mm] font-sans text-black shadow-xl print:shadow-none">

                {/* Formal Header */}
                <div className="text-center mb-4 border-b-4 border-black pb-2">
                    <h1 className="mb-1 text-2xl font-extrabold">取引明細書 / 거래명세표</h1>
                    <div className="flex justify-between items-end mt-2 text-xs">
                        <div className="text-left space-y-1">
                            <p>注文番号 (주문번호): <span className="font-bold">{displayOrderNumber}</span></p>
                            <p>発行日 (발행일자): <span className="font-bold">{formattedDate.split(' ')[0]} {formattedDate.split(' ')[1]} {formattedDate.split(' ')[2]}</span></p>
                        </div>
                        <div className="text-right font-medium">
                            <p className="text-[10px] text-gray-500 leading-tight">(貴社の益々のご清栄をお祈り申し上げます)</p>
                            <p className="text-[10px] text-gray-500 leading-tight">(귀하의 일익 번창을 기원합니다)</p>
                        </div>
                    </div>
                </div>

                {/* Info Section - Traditional Box Style */}
                <div className="grid grid-cols-2 gap-0 mb-2">
                    {/* Recipient Side */}
                    <div className="border-r border-black pr-4 py-1">
                        <div className="mb-1 flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-500 leading-none">供給先</span>
                                <span className="text-sm font-bold border-b-2 border-black pb-0.5">공급받는자</span>
                            </div>
                            <div className="border border-black px-2 py-0.5 text-xs items-center flex gap-1 font-bold font-sans">
                                <span>登録番号 / 등록번호:</span>
                                <span>{order.user.partnerProfile?.businessRegNumber || '-'}</span>
                            </div>
                        </div>
                        <table className="w-full text-sm border-collapse border border-black">
                            <tbody className="divide-y divide-black">
                                <tr>
                                    <td className="py-1 px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">商号<br />상 호</td>
                                    <td className="py-1 px-2 text-xs font-bold">{order.user.partnerProfile?.businessName || order.user.name} 殿/귀하</td>
                                </tr>
                                <tr>
                                    <td className="py-1 px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">代表者<br />대 표 자</td>
                                    <td className="py-1 px-2 text-xs font-bold">{order.user.partnerProfile?.representativeName || order.user.name}</td>
                                </tr>
                                <tr>
                                    <td className="py-1 px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">住所<br />주 소</td>
                                    <td className="py-1 px-2 text-xs leading-tight font-bold">{order.user.partnerProfile?.address || '-'}</td>
                                </tr>
                                <tr>
                                    <td className="py-1 px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">電話番号<br />전화번호</td>
                                    <td className="py-1 px-2 text-xs font-bold">{order.user.partnerProfile?.contact || '-'}</td>
                                </tr>
                                <tr>
                                    <td className="py-1 px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">E-mail<br />이메일</td>
                                    <td className="py-1 px-2 text-xs font-bold">{order.user.partnerProfile?.email || '-'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Supplier Side */}
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
                                <span>881-88-03836</span>
                            </div>
                        </div>
                        <table className="w-full text-sm border-collapse border border-black">
                            <tbody className="divide-y divide-black">
                                <tr>
                                    <td className="py-1 px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">商号<br />상 호</td>
                                    <td className="py-1 px-2 text-xs font-bold border-r border-black">주식회사 베이코</td>
                                    <td rowSpan={2} className="w-20 relative p-0 overflow-hidden text-center align-middle bg-white">
                                        {/* Background text (underneath) */}
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <span className="text-[14px] text-gray-300 font-black opacity-30">(印)</span>
                                        </div>
                                        {/* Seal image (on top) */}
                                        <div className="absolute inset-0 flex items-center justify-center z-10">
                                            <img src="/seal.png" alt="Seal" style={{ width: '60px', height: 'auto', mixBlendMode: 'multiply' }} className="opacity-100 contrast-125 select-none" />
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="py-1 px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">代表者<br />대 표 자</td>
                                    <td className="py-1 px-2 text-xs font-bold border-r border-black">이다빈</td>
                                </tr>
                                <tr>
                                    <td className="py-1 px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">住所<br />주 소</td>
                                    <td colSpan={2} className="py-1 px-2 text-xs leading-tight font-bold">부산시 강서구 낙동남로 1013번길 35</td>
                                </tr>
                                <tr>
                                    <td className="py-1 px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">電話番号<br />전화번호</td>
                                    <td colSpan={2} className="py-1 px-2 text-xs font-bold">010-8119-3313</td>
                                </tr>
                                <tr>
                                    <td className="py-1 px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">E-mail<br />이메일</td>
                                    <td colSpan={2} className="py-1 px-2 text-xs font-bold">contact@beiko.co.kr</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Item List Table & Total Summary Container - Removed flex-grow to close gap */}
                <div className="">
                    <table className="w-full border-collapse border-y-2 border-black text-[10px]">
                        <thead className="bg-gray-100 border-b border-black">
                            <tr className="text-center font-bold text-[10px]">
                                <th className="border-x border-black py-0.5 w-6">No</th>
                                <th className="border-x border-black py-0.5 px-1">品名及び規格<br />품 명 및 규 격</th>
                                <th className="border-x border-black py-0.5 w-10">数量<br />수량</th>
                                <th className="border-x border-black py-0.5 w-16">単価<br />단 가</th>
                                <th className="border-x border-black py-0.5 w-20">供給価額<br />공급가액</th>
                                <th className="border-x border-black py-0.5 w-16">税額<br />세 액</th>
                                <th className="border-x border-black py-0.5 w-20 font-black">合計<br />합 계</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-300">
                            {order.items.map((item, index) => {
                                const itemSupply = item.price * item.quantity
                                const itemTax = Math.round(itemSupply * 0.1)
                                const itemTotal = itemSupply + itemTax

                                return (
                                    <tr key={item.id} className="h-8 text-center text-[11px]">
                                        <td className="border-x border-black py-0.5 text-gray-500 font-inter">{index + 1}</td>
                                        <td className="border-x border-black py-0.5 px-2 text-left leading-tight">
                                            <span className="block text-[11px] font-bold">{partnerIsKorean ? item.product.name : (item.product.nameJP || item.product.name)}</span>
                                            {partnerIsKorean
                                                ? (item.product.nameJP && item.product.nameJP !== item.product.name ? <span className="block text-[10px] text-gray-600">{item.product.nameJP}</span> : null)
                                                : (item.product.nameJP ? <span className="block text-[10px] text-gray-600">{item.product.name}</span> : null)}
                                        </td>
                                        <td className="border-x border-black py-0.5 font-inter">{item.quantity.toLocaleString()}</td>
                                        <td className="border-x border-black py-0.5 px-1 text-right font-inter">{item.price.toLocaleString()}</td>
                                        <td className="border-x border-black py-0.5 px-1 text-right font-inter">{itemSupply.toLocaleString()}</td>
                                        <td className="border-x border-black py-0.5 px-1 text-right font-inter">{itemTax.toLocaleString()}</td>
                                        <td className="border-x border-black py-0.5 px-1 text-right font-bold bg-gray-50/30 font-inter">{itemTotal.toLocaleString()}</td>
                                    </tr>
                                )
                            })}

                            {/* Shipping Fee */}
                            {shippingFee > 0 && (
                                <tr className="h-8 text-center text-[11px]">
                                    <td className="border-x border-black py-0.5 text-gray-500 font-inter">-</td>
                                    <td className="border-x border-black py-0.5 px-2 text-left leading-tight">
                                        <span className="block text-[11px] font-bold">{partnerIsKorean ? '배송비' : '送料'}</span>
                                        <span className="block text-[10px] text-gray-600">{partnerIsKorean ? '送料' : '배송비'}</span>
                                    </td>
                                    <td className="border-x border-black py-0.5 font-inter">1</td>
                                    <td className="border-x border-black py-0.5 px-1 text-right font-inter">{shippingFee.toLocaleString()}</td>
                                    <td className="border-x border-black py-0.5 px-1 text-right font-inter">{shippingFee.toLocaleString()}</td>
                                    <td className="border-x border-black py-0.5 px-1 text-right font-inter">{Math.round(shippingFee * 0.1).toLocaleString()}</td>
                                    <td className="border-x border-black py-0.5 px-1 text-right font-bold bg-gray-50/30 font-inter">{Math.round(shippingFee * 1.1).toLocaleString()}</td>
                                </tr>
                            )}

                            {/* Blank Rows - Reduced count and height to fit 1 page */}
                            {[...Array(Math.max(0, 5 - order.items.length - (shippingFee > 0 ? 1 : 0)))].map((_, i) => (
                                <tr key={`blank-${i}`} className="h-8">
                                    <td className="border-x border-black py-0.5"></td>
                                    <td className="border-x border-black py-0.5"></td>
                                    <td className="border-x border-black py-0.5"></td>
                                    <td className="border-x border-black py-0.5"></td>
                                    <td className="border-x border-black py-0.5"></td>
                                    <td className="border-x border-black py-0.5"></td>
                                    <td className="border-x border-black py-0.5 font-bold bg-gray-50/30"></td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-100 border-t-2 border-black font-bold text-center">
                            <tr>
                                <td colSpan={2} className="border-x border-black p-3 text-[11px]">合計 / 합계</td>
                                <td className="border-x border-black p-3 font-inter">{totalQuantity.toLocaleString()}</td>
                                <td className="border-x border-black p-3 bg-gray-200">-</td>
                                <td className="border-x border-black p-3 text-right font-inter">{supplyTotal.toLocaleString()}</td>
                                <td className="border-x border-black p-3 text-right font-inter">{taxTotal.toLocaleString()}</td>
                                <td className="border-x border-black p-3 text-right bg-gray-200 font-inter whitespace-nowrap">₩{grandTotal.toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>

                    {/* Total Summary Bar - Reduced margin */}
                    <div className="mt-2 flex break-inside-avoid items-center border-2 border-t-4 border-black">
                        <div className="w-48 border-r-2 border-black px-6 py-3 text-center text-sm font-extrabold leading-tight text-black">
                            合計金額<br />합계금액
                        </div>
                        <div className="flex-grow px-8 py-3 text-right font-inter text-2xl font-black text-black">
                            ₩{grandTotal.toLocaleString()} <span className="ml-2 text-xs font-normal">(税込 / VAT 포함)</span>
                        </div>
                    </div>
                </div>

                {/* Footer Section - Removed margin */}
                <div className="break-inside-avoid border-t border-black pt-2">
                    <div className="space-y-4">
                        <div>
                            <p className="mb-2 text-xs font-bold">お支払い情報 / 입금 계좌 정보</p>
                            <dl className="grid w-fit grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] font-bold">
                                <dt className="font-normal text-gray-500">銀行名 / 은행:</dt>
                                <dd>IBK Industrial Bank of Korea (기업은행)</dd>
                                <dt className="font-normal text-gray-500">口座番号 / 계좌:</dt>
                                <dd>656-045236-01-013</dd>
                                <dt className="font-normal text-gray-500">名義人 / 예금주:</dt>
                                <dd>주식회사 베이코</dd>
                            </dl>
                        </div>
                        <div className="text-[10px] italic text-gray-500">
                            * 本取引明細書は印影省略時にも有効な文書です。 / 본 거래명세표는 인장 생략 시에도 유효한 문서입니다.
                        </div>
                    </div>
                </div>

            </div></InvoiceFit>
            </div>
        </InvoiceWrapper>
    )
}
