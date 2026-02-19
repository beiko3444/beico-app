import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import InvoiceButtons from "@/components/InvoiceButtons"
import InvoiceWrapper from "@/components/InvoiceWrapper"

export default async function InvoicePage({ params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions)
    if (!session) redirect('/login')

    const { id } = await params
    const order = await prisma.order.findUnique({
        where: { id },
        include: {
            user: { include: { partnerProfile: true } },
            items: { include: { product: true } }
        }
    })

    if (!order || order.items.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-xs font-bold text-gray-400">주문내역이 없습니다.</p>
                </div>
            </div>
        )
    }

    // Security Check: Only Admin or the Order Owner can view
    if (session.user.role !== 'ADMIN' && order.userId !== session.user.id) {
        return <div>Unauthorized</div>
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
    const productTotal = order.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    const totalQuantity = order.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
    const shippingFee = totalQuantity > 0 ? Math.ceil(totalQuantity / 100) * 3000 : 0;

    const supplyTotal = productTotal + shippingFee
    const taxTotal = Math.round(supplyTotal * 0.1)
    const grandTotal = supplyTotal + taxTotal

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

            <div id="invoice-content" className="w-[210mm] h-[280mm] mx-auto bg-white pt-[30mm] px-[15mm] pb-[5mm] shadow-xl print:shadow-none relative overflow-hidden flex flex-col text-black font-sans">

                {/* Formal Header */}
                <div className="text-center mb-4 border-b-4 border-black pb-2">
                    <h1 className="text-2xl font-extrabold tracking-[0.2em] mb-1 uppercase">取引明細書 / 거 래 명 세 표</h1>
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
                    <div className="border-r border-black p-4 py-1">
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
                                    <td className="py-1.5 px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">商号<br />상 호</td>
                                    <td className="py-1.5 px-2 text-xs font-bold">{order.user.partnerProfile?.businessName || order.user.name} 殿/귀하</td>
                                </tr>
                                <tr>
                                    <td className="py-1.5 px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">代表者<br />대 표 자</td>
                                    <td className="py-1.5 px-2 text-xs font-bold">{order.user.partnerProfile?.representativeName || order.user.name}</td>
                                </tr>
                                <tr>
                                    <td className="py-1.5 px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">住所<br />주 소</td>
                                    <td className="py-1.5 px-2 text-xs leading-tight font-bold">{order.user.partnerProfile?.address || '-'}</td>
                                </tr>
                                <tr>
                                    <td className="py-1.5 px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">電話番号<br />전화번호</td>
                                    <td className="py-1.5 px-2 text-xs font-bold">{order.user.partnerProfile?.contact || '-'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Supplier Side */}
                    <div className="p-4 py-1 bg-white relative">
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
                                    <td className="py-1.5 px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">商号<br />상 호</td>
                                    <td className="py-1.5 px-2 text-xs font-bold border-r border-black">주식회사 베이코</td>
                                    <td rowSpan={2} className="w-20 relative p-0 overflow-hidden text-center align-middle bg-white">
                                        {/* Background text (underneath) */}
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <span className="text-[14px] text-gray-300 font-black opacity-30">(印)</span>
                                        </div>
                                        {/* Seal image (on top) */}
                                        <div className="absolute inset-0 flex items-center justify-center z-10">
                                            <img src="/bko.png" alt="Seal" style={{ width: '60px', height: 'auto', mixBlendMode: 'multiply' }} className="opacity-100 contrast-125 select-none" />
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="py-1.5 px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">代表者<br />대 표 자</td>
                                    <td className="py-1.5 px-2 text-xs font-bold border-r border-black">이다빈</td>
                                </tr>
                                <tr>
                                    <td className="py-1.5 px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">住所<br />주 소</td>
                                    <td colSpan={2} className="py-1.5 px-2 text-xs leading-tight font-bold">부산시 강서구 낙동남로 1013번길 35</td>
                                </tr>
                                <tr>
                                    <td className="py-1.5 px-2 font-bold w-20 whitespace-nowrap border-r border-black text-xs leading-tight text-center bg-gray-50/50">電話番号<br />전화번호</td>
                                    <td colSpan={2} className="py-1.5 px-2 text-xs font-bold">010-8119-3313</td>
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
                            {order.items.map((item: any, index: number) => {
                                const itemSupply = item.price * item.quantity
                                const itemTax = Math.round(itemSupply * 0.1)
                                const itemTotal = itemSupply + itemTax

                                return (
                                    <tr key={item.id} className="text-center h-7 text-[9px]">
                                        <td className="border-x border-black py-0.5 text-gray-500 font-inter">{index + 1}</td>
                                        <td className="border-x border-black py-0.5 px-2 text-left leading-tight">
                                            <span className="font-bold text-[10px] block">{item.product.nameJP || item.product.name}</span>
                                            <span className="text-[9px] text-gray-600 block">{item.product.name}</span>
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
                                <tr className="text-center h-7 text-[9px]">
                                    <td className="border-x border-black py-0.5 text-gray-500 font-inter">-</td>
                                    <td className="border-x border-black py-0.5 px-2 text-left">
                                        <span className="font-bold text-[10px] block">送料</span>
                                        <span className="text-[9px] text-gray-600 block">배송비 (Shipping)</span>
                                    </td>
                                    <td className="border-x border-black py-0.5 font-inter">{Math.ceil(totalQuantity / 100)}</td>
                                    <td className="border-x border-black py-0.5 px-1 text-right font-inter">3,000</td>
                                    <td className="border-x border-black py-0.5 px-1 text-right font-inter">{shippingFee.toLocaleString()}</td>
                                    <td className="border-x border-black py-0.5 px-1 text-right font-inter">{Math.round(shippingFee * 0.1).toLocaleString()}</td>
                                    <td className="border-x border-black py-0.5 px-1 text-right font-bold bg-gray-50/30 font-inter">{Math.round(shippingFee * 1.1).toLocaleString()}</td>
                                </tr>
                            )}

                            {/* Blank Rows - Reduced count and height to fit 1 page */}
                            {[...Array(Math.max(0, 5 - order.items.length - (shippingFee > 0 ? 1 : 0)))].map((_, i) => (
                                <tr key={`blank-${i}`} className="h-3">
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
                                <td colSpan={2} className="border-x border-black p-3 text-[11px]">合計 (TOTAL / 합 계)</td>
                                <td className="border-x border-black p-3 font-inter">{totalQuantity.toLocaleString()}</td>
                                <td className="border-x border-black p-3 bg-gray-200">-</td>
                                <td className="border-x border-black p-3 text-right font-inter">{supplyTotal.toLocaleString()}</td>
                                <td className="border-x border-black p-3 text-right font-inter">{taxTotal.toLocaleString()}</td>
                                <td className="border-x border-black p-3 text-right bg-gray-200 font-inter whitespace-nowrap">₩ {grandTotal.toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>

                    {/* Total Summary Bar - Reduced margin */}
                    <div className="flex border-4 border-black mt-2 items-center">
                        <div className="text-black border-r-4 border-black px-6 py-3 font-extrabold text-center w-48 text-sm leading-tight">
                            合計金額<br />합계금액
                        </div>
                        <div className="flex-grow px-8 py-3 text-2xl font-black text-right tracking-tight text-black font-inter">
                            ₩ {grandTotal.toLocaleString()} <span className="text-xs font-normal ml-2 tracking-normal">(VAT 含む / 포함)</span>
                        </div>
                    </div>
                </div>

                {/* Footer Section - Removed margin */}
                <div className="border-t border-black pt-2 flex justify-between items-start">
                    <div className="space-y-4">
                        <div>
                            <p className="font-bold text-xs mb-2 underline decoration-[#e34219]/30 decoration-2 underline-offset-4">お支払い情報 / 입금 계좌 정보</p>
                            <div className="text-[11px] font-bold space-y-1">
                                <p><span className="text-gray-500 mr-2 font-normal">銀行名 / 은행:</span> IBK Industrial Bank of Korea (기업은행)</p>
                                <p><span className="text-gray-500 mr-2 font-normal">口座番号 / 계좌:</span> 656-045236-01-013</p>
                                <p><span className="text-gray-500 mr-2 font-normal">名義人 / 예금주:</span> 주식회사 베이코</p>
                            </div>
                        </div>
                        <div className="text-[10px] text-gray-500 italic">
                            * 本取引明細書は印影省略時にも有効な文書です. / 본 거래명세표는 인장 생략 시에도 유효한 문서입니다。
                        </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                        <p className="text-sm font-bold">주식회사 베이코</p>
                    </div>
                </div>

            </div>

            {/* Interactive Buttons - Outside A4 container */}
            <InvoiceButtons orderNumber={displayOrderNumber} />
        </InvoiceWrapper>
    )
}
