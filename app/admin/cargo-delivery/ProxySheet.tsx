import { formatProxyDate, type CargoProxyDocument } from '@/lib/cargoDeliveryProxy'

const SHEET_FONT = '"Nanum Myeongjo", "Batang", "바탕", "BatangChe", "Noto Serif KR", "Nanum Myeongjo", "Apple Myungjo", serif'

const sheetStyles = {
    sheet: {
        width: '210mm',
        minHeight: '297mm',
        padding: '28mm 22mm 24mm',
        background: '#ffffff',
        color: '#111111',
        fontFamily: SHEET_FONT,
        fontSize: '14px',
        lineHeight: 1.8,
        boxSizing: 'border-box',
        position: 'relative',
        wordBreak: 'keep-all',
    },
    title: { fontSize: '26px', fontWeight: 900, margin: '0 0 22px', letterSpacing: '-0.5px', lineHeight: 1.3 },
    block: { margin: '18px 0 0' },
    indent: { paddingLeft: '10px' },
    sealRow: { margin: '18px 0 0', position: 'relative', display: 'inline-block', paddingRight: '70px' },
    seal: {
        position: 'absolute',
        right: '0',
        top: '50%',
        height: '64px',
        width: '64px',
        transform: 'translateY(-50%)',
        objectFit: 'contain',
        opacity: 0.85,
    },
    docNo: { position: 'absolute', right: '22mm', bottom: '12mm', fontSize: '10px', color: '#888888', fontFamily: 'sans-serif' },
} as const

/** 인쇄용 시트. 인라인 스타일만 사용해서 outerHTML 그대로 iframe에 복사해 인쇄한다. */
export function ProxySheet({ doc, sealSrc = '/seal.png' }: { doc: CargoProxyDocument; sealSrc?: string }) {
    const dash = (value: string) => (value.trim().length > 0 ? value : ' ')
    return (
        <div className="cargo-proxy-sheet" style={sheetStyles.sheet}>
            <h1 style={sheetStyles.title}>수입화물 인도 위임장</h1>

            <p style={{ margin: 0 }}>위임인(수입자) 정보를 아래와 같이 명시합니다.</p>

            <p style={sheetStyles.block}>
                위임인 이름: {dash(doc.principalName)}<br />
                위임인 주소: {dash(doc.principalAddress)}<br />
                위임인 전화번호: {dash(doc.principalPhone)}<br />
                사업자등록번호: {dash(doc.principalBusinessNo)}
            </p>

            <p style={sheetStyles.block}>아래 수입화물의 인도를 대리인에게 위임합니다.</p>

            <p style={sheetStyles.block}>
                화물 정보:<br />
                <span style={sheetStyles.indent}>- B/L 번호(또는 AWB 번호): {dash(doc.blNumber)}</span><br />
                <span style={sheetStyles.indent}>- 화물명: {dash(doc.cargoName)}</span><br />
                <span style={sheetStyles.indent}>- 수량: {dash(doc.quantityText)}</span>
            </p>

            <p style={sheetStyles.block}>
                대리인 정보:<br />
                <span style={sheetStyles.indent}>- 대리인 이름: {dash(doc.driverName)}</span><br />
                <span style={sheetStyles.indent}>- 대리인 연락처: {dash(doc.driverPhone)}</span><br />
                <span style={sheetStyles.indent}>- 대리인 차량정보: {dash(doc.driverVehicle)}</span>
            </p>

            <p style={sheetStyles.block}>
                위임인의 서명 및 확인:<br />
                <span style={sheetStyles.indent}>
                    본인은 상기 화물의 인도 절차를 위임합니다. 대리인이 위임장의 조건에 따라 화물을 수령할 수 있도록 허가합니다.
                </span>
            </p>

            <div style={sheetStyles.sealRow}>
                날짜: {formatProxyDate(doc.issueDate)}<br />
                위임인 서명: {dash(doc.principalName)}
                <img src={sealSrc} alt="인감" style={sheetStyles.seal} />
            </div>

            <p style={{ margin: '24px 0 0' }}>본 위임장은 화물 인도 과정에서만 사용되며, 그 외 용도로 사용할 수 없습니다.</p>

            {doc.documentNo && <div style={sheetStyles.docNo}>문서번호 {doc.documentNo}</div>}
        </div>
    )
}
