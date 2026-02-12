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
                    margin: 15mm; 
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

            <div id="invoice-content" className="w-[210mm] min-h-[297mm] mx-auto bg-white p-[15mm] shadow-xl print:shadow-none relative overflow-hidden flex flex-col text-black">

                {/* Formal Header */}
                <div className="text-center mb-10 border-b-4 border-black pb-4">
                    <h1 className="text-3xl font-extrabold tracking-[0.5em] mb-2 uppercase">거 래 명 세 표</h1>
                    <div className="flex justify-between items-end mt-6 text-xs">
                        <div className="text-left space-y-1">
                            <p>주문번호: <span className="font-bold">{displayOrderNumber}</span></p>
                            <p>발행일자: <span className="font-bold">{formattedDate.split(' ')[0]} {formattedDate.split(' ')[1]} {formattedDate.split(' ')[2]}</span></p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-500">(귀하의 일익 번창을 기원합니다)</p>
                        </div>
                    </div>
                </div>

                {/* Info Section - Traditional Box Style */}
                <div className="grid grid-cols-2 gap-0 mb-10">
                    {/* Recipient Side */}
                    <div className="border-r border-black p-4">
                        <div className="mb-4 flex justify-between items-center">
                            <span className="text-sm font-bold border-b-2 border-black pb-0.5">공급받는자</span>
                            <div className="border border-black px-2 py-0.5 text-xs items-center flex gap-1 font-bold">
                                <span>등록번호:</span>
                                <span>{order.user.partnerProfile?.businessRegNumber || '-'}</span>
                            </div>
                        </div>
                        <table className="w-full text-sm border-collapse border border-black">
                            <tbody className="divide-y divide-black">
                                <tr>
                                    <td className="py-1.5 px-2 font-bold w-16 border-r border-black text-xs">상 호</td>
                                    <td className="py-1.5 px-2 text-xs">{order.user.partnerProfile?.businessName || order.user.name} 귀하</td>
                                </tr>
                                <tr>
                                    <td className="py-1.5 px-2 font-bold w-16 border-r border-black text-xs">대 표 자</td>
                                    <td className="py-1.5 px-2 text-xs">{order.user.partnerProfile?.representativeName || order.user.name}</td>
                                </tr>
                                <tr>
                                    <td className="py-1.5 px-2 font-bold w-16 border-r border-black text-xs">주 소</td>
                                    <td className="py-1.5 px-2 text-xs leading-tight">{order.user.partnerProfile?.address || '-'}</td>
                                </tr>
                                <tr>
                                    <td className="py-1.5 px-2 font-bold w-16 border-r border-black text-xs">전화번호</td>
                                    <td className="py-1.5 px-2 text-xs">{order.user.partnerProfile?.contact || '-'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Supplier Side */}
                    <div className="p-4 bg-gray-50/50">
                        <div className="mb-4 flex justify-between items-center">
                            <span className="text-sm font-bold border-b-2 border-black pb-0.5">공급자</span>
                            <div className="border border-black px-2 py-0.5 text-xs items-center flex gap-1 font-bold">
                                <span>등록번호:</span>
                                <span>123-45-67890</span>
                            </div>
                        </div>
                        <table className="w-full text-sm border-collapse border border-black">
                            <tbody className="divide-y divide-black">
                                <tr>
                                    <td className="py-1.5 px-2 font-bold w-16 border-r border-black text-xs">상 호</td>
                                    <td className="py-1.5 px-2 text-xs">Beico (베이코)</td>
                                </tr>
                                <tr>
                                    <td className="py-1.5 px-2 font-bold w-16 border-r border-black text-xs">대 표 자</td>
                                    <td className="py-1.5 px-2 text-xs relative">
                                        Kim Beico
                                    </td>
                                </tr>
                                <tr>
                                    <td className="py-1.5 px-2 font-bold w-16 border-r border-black text-xs">주 소</td>
                                    <td className="py-1.5 px-2 text-xs leading-tight">Seoul, Gangnam-gu, Teheran-ro 123</td>
                                </tr>
                                <tr>
                                    <td className="py-1.5 px-2 font-bold w-16 border-r border-black text-xs">전화번호</td>
                                    <td className="py-1.5 px-2 text-xs">02-1234-5678</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Item List Table & Total Summary Container */}
                <div className="flex-grow">
                    <table className="w-full border-collapse border-y-2 border-black text-xs">
                        <thead className="bg-gray-100 border-b border-black">
                            <tr className="text-center font-bold">
                                <th className="border-x border-black p-2 w-10">No</th>
                                <th className="border-x border-black p-2">품 명 및 규 격</th>
                                <th className="border-x border-black p-2 w-16">수량</th>
                                <th className="border-x border-black p-2 w-24">단 가</th>
                                <th className="border-x border-black p-2 w-24">공급가액</th>
                                <th className="border-x border-black p-2 w-20">세 액</th>
                                <th className="border-x border-black p-2 w-24 font-black">합 계</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-300">
                            {order.items.map((item: any, index: number) => {
                                const itemSupply = item.price * item.quantity
                                const itemTax = Math.round(itemSupply * 0.1)
                                const itemTotal = itemSupply + itemTax

                                return (
                                    <tr key={item.id} className="text-center h-10">
                                        <td className="border-x border-black p-2 text-gray-500 font-mono">{index + 1}</td>
                                        <td className="border-x border-black p-2 text-left px-4">
                                            <span className="font-bold block">{item.product.name}</span>
                                            {item.product.nameJP && <span className="text-[10px] text-gray-500 block leading-tight">{item.product.nameJP}</span>}
                                        </td>
                                        <td className="border-x border-black p-2">{item.quantity.toLocaleString()}</td>
                                        <td className="border-x border-black p-2 text-right">{item.price.toLocaleString()}</td>
                                        <td className="border-x border-black p-2 text-right">{itemSupply.toLocaleString()}</td>
                                        <td className="border-x border-black p-2 text-right">{itemTax.toLocaleString()}</td>
                                        <td className="border-x border-black p-2 text-right font-bold bg-gray-50/30">{itemTotal.toLocaleString()}</td>
                                    </tr>
                                )
                            })}

                            {/* Shipping Fee */}
                            {shippingFee > 0 && (
                                <tr className="text-center h-10">
                                    <td className="border-x border-black p-2 text-gray-500">-</td>
                                    <td className="border-x border-black p-2 text-left px-4">
                                        <span className="text-gray-600">배송비 (Shipping Fee)</span>
                                    </td>
                                    <td className="border-x border-black p-2">1</td>
                                    <td className="border-x border-black p-2 text-right">{shippingFee.toLocaleString()}</td>
                                    <td className="border-x border-black p-2 text-right">{shippingFee.toLocaleString()}</td>
                                    <td className="border-x border-black p-2 text-right">{Math.round(shippingFee * 0.1).toLocaleString()}</td>
                                    <td className="border-x border-black p-2 text-right font-bold bg-gray-50/30">{Math.round(shippingFee * 1.1).toLocaleString()}</td>
                                </tr>
                            )}

                            {/* Blank Rows */}
                            {[...Array(Math.max(0, 10 - order.items.length - (shippingFee > 0 ? 1 : 0)))].map((_, i) => (
                                <tr key={`blank-${i}`} className="h-8">
                                    <td className="border-x border-black p-2"></td>
                                    <td className="border-x border-black p-2"></td>
                                    <td className="border-x border-black p-2"></td>
                                    <td className="border-x border-black p-2"></td>
                                    <td className="border-x border-black p-2"></td>
                                    <td className="border-x border-black p-2"></td>
                                    <td className="border-x border-black p-2 font-bold bg-gray-50/30"></td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-100 border-t-2 border-black font-bold text-center">
                            <tr>
                                <td colSpan={2} className="border-x border-black p-3">합 계 (TOTAL)</td>
                                <td className="border-x border-black p-3">{totalQuantity.toLocaleString()}</td>
                                <td className="border-x border-black p-3 bg-gray-200">-</td>
                                <td className="border-x border-black p-3 text-right">{supplyTotal.toLocaleString()}</td>
                                <td className="border-x border-black p-3 text-right">{taxTotal.toLocaleString()}</td>
                                <td className="border-x border-black p-3 text-right bg-gray-200">₩ {grandTotal.toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>

                    {/* Total Summary Bar - Moved Below Table */}
                    <div className="flex border-4 border-black mt-10 items-center">
                        <div className="text-black border-r-4 border-black px-6 py-3 font-extrabold text-center w-40 text-base">
                            합계금액
                        </div>
                        <div className="flex-grow px-8 py-3 text-2xl font-black text-right tracking-tight text-black">
                            ₩ {grandTotal.toLocaleString()} <span className="text-sm font-normal ml-2">(VAT 포함)</span>
                        </div>
                    </div>
                </div>

                {/* Footer Section */}
                <div className="mt-10 border-t border-black pt-6 flex justify-between items-start">
                    <div className="space-y-4">
                        <div>
                            <p className="font-bold text-xs mb-2 underline undecoration-2 underline-offset-4">입금 계좌 정보</p>
                            <div className="text-xs font-medium">
                                <p><span className="text-gray-500 mr-2">은행명:</span> 토스뱅크 (Toss Bank)</p>
                                <p><span className="text-gray-500 mr-2">계좌번호:</span> 1000-0918-2374</p>
                                <p><span className="text-gray-500 mr-2">예금주:</span> BEIKO (베이코)</p>
                            </div>
                        </div>
                        <div className="text-xs text-gray-500 italic">
                            * 본 거래명세표는 인장 생략 시에도 유효한 문서입니다.
                        </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1 relative mt-8">
                        <div className="absolute right-0 bottom-0 pointer-events-none translate-x-[-100px] translate-y-[25px]">
                            <img src="/bko.png" alt="Seal" className="w-[100px] h-auto opacity-100 contrast-125 select-none mix-blend-multiply" />
                        </div>
                        <p className="text-sm font-bold">주식회사 베이코</p>
                        <p className="text-[10px] text-gray-400">BEIKO CORPORATION</p>
                    </div>
                </div>

            </div>

            {/* Interactive Buttons - Outside A4 container */}
            <InvoiceButtons orderNumber={displayOrderNumber} />
        </InvoiceWrapper>
    )
}
