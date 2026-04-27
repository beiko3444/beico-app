import type { Product } from '@prisma/client'

import type { FasstoGoodsRow, FasstoStockRow } from '@/lib/fassto-data'
import { prisma } from '@/lib/prisma'

const localFasstoProductSelect = {
  id: true,
  name: true,
  productCode: true,
  barcode: true,
  stock: true,
  safetyStock: true,
  wholesaleAvailable: true,
  updatedAt: true,
  sortOrder: true,
  createdAt: true,
} as const

export type LocalFasstoProduct = Pick<
  Product,
  'id' | 'name' | 'productCode' | 'barcode' | 'stock' | 'safetyStock' | 'wholesaleAvailable' | 'updatedAt'
> & {
  sortOrder: number
  createdAt: Date
}

export type GoodsSyncAction = 'CREATE' | 'UPDATE' | 'SYNCED' | 'MISSING_CODE' | 'DUPLICATE_CODE'

export type GoodsSyncPreviewItem = {
  productId: string
  name: string
  productCode: string | null
  barcode: string | null
  action: GoodsSyncAction
  reason: string
  mismatchFields: string[]
  remoteGoodsName: string | null
  remoteUseYn: string | null
  remoteBarcode: string | null
  localUseYn: 'Y' | 'N'
}

export type GoodsSyncPreviewSummary = {
  totalProducts: number
  createCount: number
  updateCount: number
  syncedCount: number
  missingCodeCount: number
  duplicateCodeCount: number
}

export type StockCompareStatus =
  | 'MATCHED'
  | 'MISMATCH'
  | 'NOT_REGISTERED'
  | 'NO_STOCK_ROW'
  | 'MISSING_CODE'
  | 'DUPLICATE_CODE'

export type StockComparisonItem = {
  productId: string
  name: string
  productCode: string | null
  status: StockCompareStatus
  reason: string
  localStock: number
  safetyStock: number
  remoteGoodsName: string | null
  remoteAvailableStock: number | null
  remoteTotalStock: number | null
  remoteBadStock: number | null
  diff: number | null
}

export type StockComparisonSummary = {
  totalProducts: number
  matchedCount: number
  mismatchCount: number
  notRegisteredCount: number
  noStockRowCount: number
  missingCodeCount: number
  duplicateCodeCount: number
}

export function normalizeProductCode(value: string | null | undefined) {
  const normalized = String(value || '').trim().toUpperCase()
  return normalized || null
}

function normalizeText(value: string | null | undefined) {
  const normalized = String(value || '').trim()
  return normalized || null
}

function desiredUseYn(product: Pick<LocalFasstoProduct, 'wholesaleAvailable'>): 'Y' | 'N' {
  return product.wholesaleAvailable ? 'Y' : 'N'
}

function getDuplicateCodeMap(products: LocalFasstoProduct[]) {
  const counter = new Map<string, number>()

  for (const product of products) {
    const code = normalizeProductCode(product.productCode)
    if (!code) continue
    counter.set(code, (counter.get(code) || 0) + 1)
  }

  return counter
}

function previewPriority(action: GoodsSyncAction) {
  switch (action) {
    case 'MISSING_CODE':
      return 0
    case 'DUPLICATE_CODE':
      return 1
    case 'CREATE':
      return 2
    case 'UPDATE':
      return 3
    case 'SYNCED':
    default:
      return 4
  }
}

function stockPriority(status: StockCompareStatus) {
  switch (status) {
    case 'MISSING_CODE':
      return 0
    case 'DUPLICATE_CODE':
      return 1
    case 'NOT_REGISTERED':
      return 2
    case 'NO_STOCK_ROW':
      return 3
    case 'MISMATCH':
      return 4
    case 'MATCHED':
    default:
      return 5
  }
}

export async function getFasstoLocalProducts() {
  return prisma.product.findMany({
    select: localFasstoProductSelect,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  })
}

export function buildGoodsPayload(product: LocalFasstoProduct) {
  const productCode = normalizeProductCode(product.productCode)
  if (!productCode) {
    throw new Error(`상품코드가 없어 파스토 상품으로 보낼 수 없습니다: ${product.name}`)
  }

  return {
    cstGodCd: productCode,
    godNm: product.name.trim(),
    giftDiv: '01',
    godType: '1',
    barcode: normalizeText(product.barcode) || undefined,
    useYn: desiredUseYn(product),
  }
}

export function buildGoodsSyncPreview(localProducts: LocalFasstoProduct[], remoteGoods: FasstoGoodsRow[]) {
  const goodsByCode = new Map(remoteGoods.map((row) => [normalizeProductCode(row.cstGodCd) as string, row]))
  const duplicateCodeMap = getDuplicateCodeMap(localProducts)

  const items = localProducts
    .map<GoodsSyncPreviewItem>((product) => {
      const productCode = normalizeProductCode(product.productCode)
      const barcode = normalizeText(product.barcode)
      const localUseYn = desiredUseYn(product)

      if (!productCode) {
        return {
          productId: product.id,
          name: product.name,
          productCode: null,
          barcode,
          action: 'MISSING_CODE',
          reason: '상품코드가 없어 파스토 상품코드(cstGodCd)로 보낼 수 없습니다.',
          mismatchFields: [],
          remoteGoodsName: null,
          remoteUseYn: null,
          remoteBarcode: null,
          localUseYn,
        }
      }

      if ((duplicateCodeMap.get(productCode) || 0) > 1) {
        return {
          productId: product.id,
          name: product.name,
          productCode,
          barcode,
          action: 'DUPLICATE_CODE',
          reason: '같은 상품코드를 가진 로컬 상품이 2개 이상이라 자동 동기화하면 위험합니다.',
          mismatchFields: [],
          remoteGoodsName: null,
          remoteUseYn: null,
          remoteBarcode: null,
          localUseYn,
        }
      }

      const remote = goodsByCode.get(productCode)
      if (!remote) {
        return {
          productId: product.id,
          name: product.name,
          productCode,
          barcode,
          action: 'CREATE',
          reason: '파스토에 아직 등록되지 않은 상품입니다.',
          mismatchFields: [],
          remoteGoodsName: null,
          remoteUseYn: null,
          remoteBarcode: null,
          localUseYn,
        }
      }

      const mismatchFields: string[] = []
      const remoteName = normalizeText(remote.godNm)
      const remoteBarcode = normalizeText(remote.barcode)
      const remoteUseYn = normalizeText(remote.useYn)

      if ((remoteName || '') !== product.name.trim()) mismatchFields.push('상품명')
      if ((remoteBarcode || '') !== (barcode || '')) mismatchFields.push('바코드')
      if ((remoteUseYn || '') !== localUseYn) mismatchFields.push('사용여부')

      if (mismatchFields.length > 0) {
        return {
          productId: product.id,
          name: product.name,
          productCode,
          barcode,
          action: 'UPDATE',
          reason: `파스토와 다른 항목: ${mismatchFields.join(', ')}`,
          mismatchFields,
          remoteGoodsName: remoteName,
          remoteUseYn,
          remoteBarcode,
          localUseYn,
        }
      }

      return {
        productId: product.id,
        name: product.name,
        productCode,
        barcode,
        action: 'SYNCED',
        reason: '파스토와 기본 상품 정보가 일치합니다.',
        mismatchFields: [],
        remoteGoodsName: remoteName,
        remoteUseYn,
        remoteBarcode,
        localUseYn,
      }
    })
    .sort((a, b) => previewPriority(a.action) - previewPriority(b.action) || a.name.localeCompare(b.name, 'ko'))

  const summary: GoodsSyncPreviewSummary = {
    totalProducts: localProducts.length,
    createCount: items.filter((item) => item.action === 'CREATE').length,
    updateCount: items.filter((item) => item.action === 'UPDATE').length,
    syncedCount: items.filter((item) => item.action === 'SYNCED').length,
    missingCodeCount: items.filter((item) => item.action === 'MISSING_CODE').length,
    duplicateCodeCount: items.filter((item) => item.action === 'DUPLICATE_CODE').length,
  }

  return { items, summary }
}

export function buildStockComparison(
  localProducts: LocalFasstoProduct[],
  remoteGoods: FasstoGoodsRow[],
  remoteStocks: FasstoStockRow[]
) {
  const duplicateCodeMap = getDuplicateCodeMap(localProducts)
  const goodsByCode = new Map(remoteGoods.map((row) => [normalizeProductCode(row.cstGodCd) as string, row]))
  const stocksByCode = new Map(remoteStocks.map((row) => [normalizeProductCode(row.cstGodCd) as string, row]))

  const items = localProducts
    .map<StockComparisonItem>((product) => {
      const productCode = normalizeProductCode(product.productCode)

      if (!productCode) {
        return {
          productId: product.id,
          name: product.name,
          productCode: null,
          status: 'MISSING_CODE',
          reason: '상품코드가 없어 파스토 재고와 매칭할 수 없습니다.',
          localStock: product.stock,
          safetyStock: product.safetyStock,
          remoteGoodsName: null,
          remoteAvailableStock: null,
          remoteTotalStock: null,
          remoteBadStock: null,
          diff: null,
        }
      }

      if ((duplicateCodeMap.get(productCode) || 0) > 1) {
        return {
          productId: product.id,
          name: product.name,
          productCode,
          status: 'DUPLICATE_CODE',
          reason: '같은 상품코드가 여러 로컬 상품에 중복되어 비교 결과를 신뢰하기 어렵습니다.',
          localStock: product.stock,
          safetyStock: product.safetyStock,
          remoteGoodsName: null,
          remoteAvailableStock: null,
          remoteTotalStock: null,
          remoteBadStock: null,
          diff: null,
        }
      }

      const remoteGoods = goodsByCode.get(productCode)
      if (!remoteGoods) {
        return {
          productId: product.id,
          name: product.name,
          productCode,
          status: 'NOT_REGISTERED',
          reason: '파스토 상품 마스터에 등록되지 않았습니다.',
          localStock: product.stock,
          safetyStock: product.safetyStock,
          remoteGoodsName: null,
          remoteAvailableStock: null,
          remoteTotalStock: null,
          remoteBadStock: null,
          diff: null,
        }
      }

      const remoteStock = stocksByCode.get(productCode)
      if (!remoteStock) {
        return {
          productId: product.id,
          name: product.name,
          productCode,
          status: 'NO_STOCK_ROW',
          reason: '파스토 상품은 있으나 재고 응답 행이 없습니다.',
          localStock: product.stock,
          safetyStock: product.safetyStock,
          remoteGoodsName: remoteGoods.godNm,
          remoteAvailableStock: null,
          remoteTotalStock: null,
          remoteBadStock: null,
          diff: null,
        }
      }

      const remoteAvailableStock = remoteStock.canStockQty
      const remoteTotalStock = remoteStock.stockQty
      const remoteBadStock = remoteStock.badStockQty
      const diff = remoteAvailableStock - product.stock

      return {
        productId: product.id,
        name: product.name,
        productCode,
        status: diff === 0 ? 'MATCHED' : 'MISMATCH',
        reason: diff === 0 ? '로컬 재고와 파스토 가용재고가 일치합니다.' : '로컬 재고와 파스토 가용재고가 다릅니다.',
        localStock: product.stock,
        safetyStock: product.safetyStock,
        remoteGoodsName: remoteGoods.godNm,
        remoteAvailableStock,
        remoteTotalStock,
        remoteBadStock,
        diff,
      }
    })
    .sort((a, b) => stockPriority(a.status) - stockPriority(b.status) || a.name.localeCompare(b.name, 'ko'))

  const summary: StockComparisonSummary = {
    totalProducts: localProducts.length,
    matchedCount: items.filter((item) => item.status === 'MATCHED').length,
    mismatchCount: items.filter((item) => item.status === 'MISMATCH').length,
    notRegisteredCount: items.filter((item) => item.status === 'NOT_REGISTERED').length,
    noStockRowCount: items.filter((item) => item.status === 'NO_STOCK_ROW').length,
    missingCodeCount: items.filter((item) => item.status === 'MISSING_CODE').length,
    duplicateCodeCount: items.filter((item) => item.status === 'DUPLICATE_CODE').length,
  }

  return { items, summary }
}
