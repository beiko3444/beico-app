export type FasstoGoodsRow = {
  cstGodCd: string
  godNm: string
  godType: string
  giftDiv: string
  useYn: string | null
  raw: any
}

export type FasstoStockRow = {
  cstGodCd: string
  stockQty: number
  canStockQty: number
  badStockQty: number
  goodsSerialNo: string | null
  raw: any
}

export type FasstoDeliveryRow = {
  slipNo: string
  ordNo: string
  ordDt: string
  status: string
  statusNm: string
  outDiv: string
  custNm: string
  invoiceNo: string | null
  parcelCd: string | null
  parcelNm: string | null
  raw: any
}

function firstDefined<T>(...values: T[]): T | undefined {
  return values.find((value) => value !== undefined && value !== null && value !== '')
}

function toText(value: unknown): string {
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = Number(String(value ?? '').replace(/,/g, '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

export function extractFasstoList(data: unknown): any[] {
  if (Array.isArray(data)) return data
  if (!data || typeof data !== 'object') return []

  const record = data as Record<string, unknown>
  const arrayKeys = ['list', 'rows', 'items', 'contents', 'content', 'result', 'data']
  for (const key of arrayKeys) {
    const value = record[key]
    if (Array.isArray(value)) return value
  }

  for (const value of Object.values(record)) {
    if (Array.isArray(value)) return value
  }

  return []
}

export function normalizeFasstoGoods(rows: any[]): FasstoGoodsRow[] {
  return rows
    .map((row) => {
      const cstGodCd = toText(firstDefined(row?.cstGodCd, row?.godCd, row?.goodsCd, row?.itemCd))
      const godNm = toText(firstDefined(row?.godNm, row?.goodsNm, row?.itemNm, row?.godName))
      const godType = toText(firstDefined(row?.godType, row?.goodsType, '1')) || '1'
      const giftDiv = toText(firstDefined(row?.giftDiv, '01')) || '01'
      const useYn = toText(firstDefined(row?.useYn, row?.use_yn)) || null
      if (!cstGodCd) return null
      return {
        cstGodCd,
        godNm,
        godType,
        giftDiv,
        useYn,
        raw: row,
      }
    })
    .filter((row): row is FasstoGoodsRow => row !== null)
}

export function normalizeFasstoStocks(rows: any[]): FasstoStockRow[] {
  return rows
    .map((row) => {
      const cstGodCd = toText(firstDefined(row?.cstGodCd, row?.godCd, row?.goodsCd, row?.itemCd))
      if (!cstGodCd) return null
      return {
        cstGodCd,
        stockQty: toNumber(firstDefined(row?.stockQty, row?.stockQnt, row?.stock, 0)),
        canStockQty: toNumber(firstDefined(row?.canStockQty, row?.canStockQnt, row?.canStock, 0)),
        badStockQty: toNumber(firstDefined(row?.badStockQty, row?.badStockQnt, row?.badStock, 0)),
        goodsSerialNo: toText(firstDefined(row?.goodsSerialNo, row?.goodsSerno, row?.goodsSerialNumber)) || null,
        raw: row,
      }
    })
    .filter((row): row is FasstoStockRow => row !== null)
}

export function normalizeFasstoDeliveries(rows: any[]): FasstoDeliveryRow[] {
  return rows
    .map((row) => {
      const slipNo = toText(firstDefined(row?.slipNo, row?.fmsSlipNo, row?.outReqNo))
      const ordNo = toText(firstDefined(row?.ordNo, row?.orderNo, row?.custOrdNo))
      const status = toText(firstDefined(row?.status, row?.crgSt, row?.wrkStat, ''))
      if (!slipNo && !ordNo) return null
      return {
        slipNo,
        ordNo,
        ordDt: toText(firstDefined(row?.ordDt, row?.orderDate, row?.outReqDt)),
        status,
        statusNm: toText(firstDefined(row?.statusNm, row?.crgStNm, row?.statusName)),
        outDiv: toText(firstDefined(row?.outDiv, row?.deliveryDiv, row?.outType)),
        custNm: toText(firstDefined(row?.custNm, row?.customerName, row?.recvNm)),
        invoiceNo: toText(firstDefined(row?.invoiceNo, row?.parcelInvoiceNo, row?.waybillNo)) || null,
        parcelCd: toText(firstDefined(row?.parcelCd, row?.deliveryCd)) || null,
        parcelNm: toText(firstDefined(row?.parcelNm, row?.deliveryNm, row?.parcelComp)) || null,
        raw: row,
      }
    })
    .filter((row): row is FasstoDeliveryRow => row !== null)
}
