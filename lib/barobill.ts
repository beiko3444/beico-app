// 바로빌 세금계산서 API - 직접 SOAP XML 방식 (서버리스 호환)

// 바로빌 운영 서버 (테스트: https://testws.baroservice.com/TI.asmx)
const SOAP_URL = 'https://ws.baroservice.com/TI.asmx';

function getConfig() {
  return {
    CERTKEY: process.env.BAROBILL_CERTKEY || '',
    CORP_NUM: process.env.BAROBILL_CORP_NUM || '',
    CORP_NAME: process.env.BAROBILL_CORP_NAME || '',
    CEO_NAME: process.env.BAROBILL_CEO_NAME || '',
    ADDR: process.env.BAROBILL_ADDR || '',
    BIZ_TYPE: process.env.BAROBILL_BIZ_TYPE || '',
    BIZ_CLASS: process.env.BAROBILL_BIZ_CLASS || '',
    EMAIL: process.env.BAROBILL_EMAIL || '',
    CONTACT_ID: process.env.BAROBILL_CONTACT_ID || '',
  };
}

export interface TradeLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  tax: number;
  purchaseExpiry?: string;
  description?: string;
}

export interface InvoiceeInfo {
  corpNum: string;
  corpName: string;
  ceoName: string;
  addr?: string;
  bizType?: string;
  bizClass?: string;
  email?: string;
  contactName?: string;
  tel?: string;
}

export interface IssueTaxInvoiceParams {
  mgtKey: string;
  writeDate: string;
  invoicee: InvoiceeInfo;
  items: TradeLineItem[];
  amountTotal: number;
  taxTotal: number;
  totalAmount: number;
  remark1?: string;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildTradeLineItemsXml(items: TradeLineItem[], writeDate: string): string {
  return items.map(item => `
              <TaxInvoiceTradeLineItem>
                <PurchaseExpiry>${item.purchaseExpiry || writeDate}</PurchaseExpiry>
                <Name>${escapeXml(item.name)}</Name>
                <Information></Information>
                <ChargeableUnit>${item.quantity}</ChargeableUnit>
                <UnitPrice>${item.unitPrice}</UnitPrice>
                <Amount>${item.amount}</Amount>
                <Tax>${item.tax}</Tax>
                <Description>${escapeXml(item.description || '')}</Description>
              </TaxInvoiceTradeLineItem>`).join('');
}

/**
 * 바로빌 API로 세금계산서를 저장 + 발급합니다.
 */
export async function issueTaxInvoice(params: IssueTaxInvoiceParams): Promise<{
  success: boolean;
  resultCode: number;
  message: string;
}> {
  const cfg = getConfig();

  console.log('[Barobill] === 세금계산서 발급 시작 ===');
  console.log('[Barobill] CERTKEY:', cfg.CERTKEY ? `${cfg.CERTKEY.substring(0, 8)}...(${cfg.CERTKEY.length}자)` : '(empty)');
  console.log('[Barobill] CorpNum:', cfg.CORP_NUM);
  console.log('[Barobill] MgtKey:', params.mgtKey);
  console.log('[Barobill] 공급받는자:', params.invoicee.corpNum, params.invoicee.corpName);

  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <RegistAndIssueTaxInvoice xmlns="http://ws.baroservice.com/">
      <CERTKEY>${escapeXml(cfg.CERTKEY)}</CERTKEY>
      <CorpNum>${escapeXml(cfg.CORP_NUM)}</CorpNum>
      <Invoice>
        <InvoicerParty>
          <CorpNum>${escapeXml(cfg.CORP_NUM)}</CorpNum>
          <MgtNum>${escapeXml(params.mgtKey)}</MgtNum>
          <CorpName>${escapeXml(cfg.CORP_NAME)}</CorpName>
          <CEOName>${escapeXml(cfg.CEO_NAME)}</CEOName>
          <Addr>${escapeXml(cfg.ADDR)}</Addr>
          <BizType>${escapeXml(cfg.BIZ_TYPE)}</BizType>
          <BizClass>${escapeXml(cfg.BIZ_CLASS)}</BizClass>
          <ContactID>${escapeXml(cfg.CONTACT_ID)}</ContactID>
          <ContactName>${escapeXml(cfg.CEO_NAME)}</ContactName>
          <Email>${escapeXml(cfg.EMAIL)}</Email>
        </InvoicerParty>
        <InvoiceeParty>
          <CorpNum>${escapeXml(params.invoicee.corpNum)}</CorpNum>
          <CorpName>${escapeXml(params.invoicee.corpName)}</CorpName>
          <CEOName>${escapeXml(params.invoicee.ceoName)}</CEOName>
          <Addr>${escapeXml(params.invoicee.addr || '')}</Addr>
          <BizType>${escapeXml(params.invoicee.bizType || '')}</BizType>
          <BizClass>${escapeXml(params.invoicee.bizClass || '')}</BizClass>
          <ContactName>${escapeXml(params.invoicee.contactName || params.invoicee.ceoName)}</ContactName>
          <Email>${escapeXml(params.invoicee.email || '')}</Email>
          <TEL>${escapeXml(params.invoicee.tel || '')}</TEL>
        </InvoiceeParty>
        <IssueDirection>1</IssueDirection>
        <TaxInvoiceType>1</TaxInvoiceType>
        <TaxType>1</TaxType>
        <TaxCalcType>1</TaxCalcType>
        <PurposeType>1</PurposeType>
        <WriteDate>${params.writeDate}</WriteDate>
        <AmountTotal>${params.amountTotal}</AmountTotal>
        <TaxTotal>${params.taxTotal}</TaxTotal>
        <TotalAmount>${params.totalAmount}</TotalAmount>
        <Remark1>${escapeXml(params.remark1 || '')}</Remark1>
        <TaxInvoiceTradeLineItems>${buildTradeLineItemsXml(params.items, params.writeDate)}
        </TaxInvoiceTradeLineItems>
      </Invoice>
      <SendSMS>false</SendSMS>
      <ForceIssue>false</ForceIssue>
      <MailTitle></MailTitle>
    </RegistAndIssueTaxInvoice>
  </soap:Body>
</soap:Envelope>`;

  try {
    console.log('[Barobill] SOAP URL:', SOAP_URL);

    const response = await fetch(SOAP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://ws.baroservice.com/RegistAndIssueTaxInvoice',
      },
      body: soapBody,
    });

    const responseText = await response.text();
    console.log('[Barobill] HTTP Status:', response.status);
    console.log('[Barobill] Response:', responseText.substring(0, 500));

    // XML 응답에서 결과 코드 추출
    const resultMatch = responseText.match(/<RegistAndIssueTaxInvoiceResult>([-\d]+)<\/RegistAndIssueTaxInvoiceResult>/);

    if (!resultMatch) {
      console.error('[Barobill] 결과 코드를 파싱할 수 없습니다.');
      return {
        success: false,
        resultCode: -999,
        message: '바로빌 응답을 파싱할 수 없습니다.',
      };
    }

    const resultCode = parseInt(resultMatch[1], 10);
    console.log('[Barobill] Result Code:', resultCode);

    if (resultCode > 0) {
      return {
        success: true,
        resultCode,
        message: '세금계산서가 성공적으로 발급되었습니다.',
      };
    } else {
      const errorMessage = getBarobillErrorMessage(resultCode);
      return {
        success: false,
        resultCode,
        message: `발급 실패: ${errorMessage}`,
      };
    }
  } catch (error: any) {
    console.error('[Barobill] 통신 오류:', error);
    return {
      success: false,
      resultCode: -999,
      message: `통신 오류: ${error.message || '알 수 없는 오류'}`,
    };
  }
}

/**
 * 주문 데이터에서 세금계산서 발급 파라미터를 구성합니다.
 */
export function buildTaxInvoiceParams(order: any): IssueTaxInvoiceParams {
  const now = new Date();
  const writeDate = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

  const orderNum = order.orderNumber || order.id.slice(0, 8);
  const mgtKey = `BEICO-${orderNum}-${Date.now().toString(36).toUpperCase()}`;

  const partner = order.user?.partnerProfile;
  const invoicee: InvoiceeInfo = {
    corpNum: (partner?.businessRegNumber || '').replace(/-/g, ''),
    corpName: partner?.businessName || order.user?.name || '',
    ceoName: partner?.representativeName || '',
    addr: partner?.address || '',
    email: partner?.email || '',
    tel: partner?.contact || '',
  };

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

function getBarobillErrorMessage(code: number): string {
  const errors: Record<number, string> = {
    [-10000]: '알 수 없는 오류 발생 (서버오류)',
    [-10001]: '해당 인증키와 연결된 연계사가 아닙니다.',
    [-10002]: '해당 인증키를 찾을 수 없습니다. CERTKEY를 확인하세요.',
    [-10003]: '연동서비스가 점검 중입니다.',
    [-10008]: '날짜형식이 잘못되었습니다.',
    [-10010]: '입력된 건이 없습니다.',
    [-24005]: '사업자번호와 아이디가 맞지 않습니다.',
    [-24008]: '등록되지 않은 사업자입니다.',
    [-24011]: '관리번호가 이미 존재합니다.',
    [-24012]: '인증서가 등록되지 않았습니다.',
    [-24016]: '공급가액이 유효하지 않습니다.',
    [-24017]: '세액이 유효하지 않습니다.',
    [-24018]: '합계금액이 유효하지 않습니다.',
    [-24020]: '작성일자가 유효하지 않습니다.',
    [-24030]: '공급받는자 사업자번호가 유효하지 않습니다.',
  };
  return errors[code] || `알 수 없는 오류 (코드: ${code})`;
}
