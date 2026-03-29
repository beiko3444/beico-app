import soap from 'soap';

// 바로빌 테스트 서버 WSDL (운영: https://ws.baroservice.com/TI.asmx?WSDL)
const WSDL_URL = 'https://testws.baroservice.com/TI.asmx?WSDL';

const CERTKEY = process.env.BAROBILL_CERTKEY || '';
const CORP_NUM = process.env.BAROBILL_CORP_NUM || '';
const CORP_NAME = process.env.BAROBILL_CORP_NAME || '';
const CEO_NAME = process.env.BAROBILL_CEO_NAME || '';
const ADDR = process.env.BAROBILL_ADDR || '';
const BIZ_TYPE = process.env.BAROBILL_BIZ_TYPE || '';
const BIZ_CLASS = process.env.BAROBILL_BIZ_CLASS || '';
const EMAIL = process.env.BAROBILL_EMAIL || '';
const CONTACT_ID = process.env.BAROBILL_CONTACT_ID || '';

export interface TradeLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  tax: number;
  purchaseExpiry?: string; // YYYYMMDD
  description?: string;
}

export interface InvoiceeInfo {
  corpNum: string;      // 사업자번호 (하이픈 제외)
  corpName: string;     // 상호
  ceoName: string;      // 대표자명
  addr?: string;        // 주소
  bizType?: string;     // 업태
  bizClass?: string;    // 업종
  email?: string;       // 이메일
  contactName?: string; // 담당자
  tel?: string;         // 전화번호
}

export interface IssueTaxInvoiceParams {
  mgtKey: string;             // 관리번호 (고유)
  writeDate: string;          // 작성일 YYYYMMDD
  invoicee: InvoiceeInfo;     // 공급받는자
  items: TradeLineItem[];     // 품목
  amountTotal: number;        // 공급가액 합계
  taxTotal: number;           // 세액 합계
  totalAmount: number;        // 합계금액
  remark1?: string;           // 비고1
}

/**
 * 바로빌 API로 세금계산서를 저장 + 발급합니다.
 * RegistAndIssueTaxInvoice 메서드 사용
 */
export async function issueTaxInvoice(params: IssueTaxInvoiceParams): Promise<{
  success: boolean;
  resultCode: number;
  message: string;
}> {
  try {
    const client = await soap.createClientAsync(WSDL_URL);

    // TaxInvoice 객체 구성
    const invoice = {
      InvoicerParty: {
        CorpNum: CORP_NUM,
        CorpName: CORP_NAME,
        CEOName: CEO_NAME,
        Addr: ADDR,
        BizType: BIZ_TYPE,
        BizClass: BIZ_CLASS,
        ContactID: CONTACT_ID,
        ContactName: CEO_NAME,
        Email: EMAIL,
        MgtNum: params.mgtKey,
      },
      InvoiceeParty: {
        CorpNum: params.invoicee.corpNum,
        CorpName: params.invoicee.corpName,
        CEOName: params.invoicee.ceoName,
        Addr: params.invoicee.addr || '',
        BizType: params.invoicee.bizType || '',
        BizClass: params.invoicee.bizClass || '',
        ContactName: params.invoicee.contactName || params.invoicee.ceoName,
        Email: params.invoicee.email || '',
        TEL: params.invoicee.tel || '',
      },
      IssueDirection: 1,      // 정발행
      TaxInvoiceType: 1,      // 세금계산서
      TaxType: 1,             // 과세
      TaxCalcType: 1,         // 자동계산
      PurposeType: 1,         // 영수
      WriteDate: params.writeDate,
      AmountTotal: String(params.amountTotal),
      TaxTotal: String(params.taxTotal),
      TotalAmount: String(params.totalAmount),
      Remark1: params.remark1 || '',
      TaxInvoiceTradeLineItems: {
        TaxInvoiceTradeLineItem: params.items.map(item => ({
          PurchaseExpiry: item.purchaseExpiry || params.writeDate,
          Name: item.name,
          Information: '',
          ChargeableUnit: String(item.quantity),
          UnitPrice: String(item.unitPrice),
          Amount: String(item.amount),
          Tax: String(item.tax),
          Description: item.description || '',
        })),
      },
    };

    const args = {
      CERTKEY: CERTKEY,
      CorpNum: CORP_NUM,
      Invoice: invoice,
      SendSMS: false,       // SMS 미전송
      ForceIssue: false,    // 가산세 예상 시 발급 안 함
      MailTitle: '',        // 기본 이메일 제목 사용
    };

    const [result] = await client.RegistAndIssueTaxInvoiceAsync(args);
    const resultCode = result.RegistAndIssueTaxInvoiceResult;

    if (resultCode > 0) {
      return {
        success: true,
        resultCode,
        message: '세금계산서가 성공적으로 발급되었습니다.',
      };
    } else {
      // 오류 정보를 가져오기 위해 에러 코드 매핑
      const errorMessage = getBarobillErrorMessage(resultCode);
      return {
        success: false,
        resultCode,
        message: `발급 실패: ${errorMessage} (코드: ${resultCode})`,
      };
    }
  } catch (error: any) {
    console.error('[Barobill] 세금계산서 발급 오류:', error);
    return {
      success: false,
      resultCode: -999,
      message: `통신 오류: ${error.message || '알 수 없는 오류'}`,
    };
  }
}

/**
 * 관리번호 중복 체크
 */
export async function checkMgtNumExists(mgtKey: string): Promise<boolean> {
  try {
    const client = await soap.createClientAsync(WSDL_URL);
    const [result] = await client.CheckMgtNumIsExistsAsync({
      CERTKEY: CERTKEY,
      CorpNum: CORP_NUM,
      MgtKey: mgtKey,
    });
    // 1: 존재, 0: 미존재, 음수: 오류
    return result.CheckMgtNumIsExistsResult === 1;
  } catch (error) {
    console.error('[Barobill] 관리번호 중복 체크 오류:', error);
    return false;
  }
}

/**
 * 주문 데이터에서 세금계산서 발급 파라미터를 구성합니다.
 */
export function buildTaxInvoiceParams(order: any): IssueTaxInvoiceParams {
  const now = new Date();
  const writeDate = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

  // 관리번호: 주문번호 기반 (고유해야 함)
  const orderNum = order.orderNumber || order.id.slice(0, 8);
  const mgtKey = `BEICO-${orderNum}-${Date.now().toString(36).toUpperCase()}`;

  // 공급받는자 정보
  const partner = order.user?.partnerProfile;
  const invoicee: InvoiceeInfo = {
    corpNum: (partner?.businessRegNumber || '').replace(/-/g, ''),
    corpName: partner?.businessName || order.user?.name || '',
    ceoName: partner?.representativeName || '',
    addr: partner?.address || '',
    email: partner?.email || '',
    tel: partner?.contact || '',
  };

  // 품목 목록 구성
  const items: TradeLineItem[] = order.items.map((item: any) => {
    const amount = Math.round(item.price * item.quantity);
    const tax = Math.round(amount * 0.1);
    return {
      name: item.product?.name || '상품',
      quantity: item.quantity,
      unitPrice: Math.round(item.price),
      amount,
      tax,
      purchaseExpiry: writeDate,
    };
  });

  // 배송비 계산 및 품목 추가
  const totalQuantity = order.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
  const shippingFee = totalQuantity > 0 ? Math.ceil(totalQuantity / 100) * 3000 : 0;

  if (shippingFee > 0) {
    const shippingTax = Math.round(shippingFee * 0.1);
    items.push({
      name: '배송비',
      quantity: 1,
      unitPrice: shippingFee,
      amount: shippingFee,
      tax: shippingTax,
      purchaseExpiry: writeDate,
    });
  }

  // 합계 계산
  const amountTotal = items.reduce((sum, item) => sum + item.amount, 0);
  const taxTotal = items.reduce((sum, item) => sum + item.tax, 0);
  const totalAmount = amountTotal + taxTotal;

  return {
    mgtKey,
    writeDate,
    invoicee,
    items,
    amountTotal,
    taxTotal,
    totalAmount,
    remark1: `주문번호: ${orderNum}`,
  };
}

/**
 * 바로빌 에러 코드 → 한글 메시지 매핑
 */
function getBarobillErrorMessage(code: number): string {
  const errors: Record<number, string> = {
    [-2]: '인증키가 유효하지 않습니다.',
    [-3]: '사업자번호가 유효하지 않습니다.',
    [-4]: '등록되지 않은 사업자입니다.',
    [-11]: '관리번호가 이미 존재합니다.',
    [-12]: '전자서명용 인증서가 등록되지 않았습니다.',
    [-13]: '세금계산서 데이터가 유효하지 않습니다.',
    [-14]: '발급 권한이 없습니다.',
    [-20]: '작성일자가 유효하지 않습니다.',
    [-21]: '공급가액이 유효하지 않습니다.',
    [-22]: '세액이 유효하지 않습니다.',
    [-23]: '합계금액이 유효하지 않습니다.',
    [-30]: '공급받는자 사업자번호가 유효하지 않습니다.',
    [-99]: '시스템 오류가 발생했습니다.',
  };
  return errors[code] || `알 수 없는 오류 (코드: ${code})`;
}
