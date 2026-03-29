import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { issueTaxInvoice, buildTaxInvoiceParams } from '@/lib/barobill';

export async function POST(req: Request) {
  try {
    // 관리자 인증 확인
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await req.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: '주문 ID가 필요합니다.' }, { status: 400 });
    }

    // 주문 데이터 조회
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          include: {
            partnerProfile: true,
          },
        },
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (order.taxInvoiceIssued) {
      return NextResponse.json({ error: '이미 세금계산서가 발급된 주문입니다.' }, { status: 400 });
    }

    // 거래처 사업자번호 확인
    const bizRegNum = order.user?.partnerProfile?.businessRegNumber;
    if (!bizRegNum) {
      return NextResponse.json({ error: '거래처 사업자번호가 등록되어 있지 않습니다.' }, { status: 400 });
    }

    // 세금계산서 파라미터 구성
    const invoiceParams = buildTaxInvoiceParams(order);

    // 바로빌 API 호출
    const result = await issueTaxInvoice(invoiceParams);

    if (result.success) {
      // 성공 시 주문 상태 업데이트
      await prisma.order.update({
        where: { id: orderId },
        data: { taxInvoiceIssued: true },
      });

      return NextResponse.json({
        success: true,
        message: result.message,
        resultCode: result.resultCode,
        mgtKey: invoiceParams.mgtKey,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.message,
        resultCode: result.resultCode,
      }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[TaxInvoice API] 오류:', error);
    return NextResponse.json({
      error: `서버 오류: ${error.message || '알 수 없는 오류'}`,
    }, { status: 500 });
  }
}
