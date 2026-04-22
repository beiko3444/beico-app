import { NextResponse } from 'next/server'

import { requireAdminApi, apiErrorResponse } from '@/lib/admin-api'
import { extractFasstoList, normalizeFasstoGoods, normalizeFasstoStocks } from '@/lib/fassto-data'
import { getFasstoConfigSummary, getGoodsList, getStockList, isFasstoConfigured } from '@/lib/fassto'
import { buildGoodsSyncPreview, buildStockComparison, getFasstoLocalProducts, normalizeProductCode } from '@/lib/fassto-sync'

function serializeReason(error: unknown) {
  if (error instanceof Error) return error.message
  return '알 수 없는 오류'
}

export async function GET() {
  const unauthorized = await requireAdminApi()
  if (unauthorized) return unauthorized

  try {
    const products = await getFasstoLocalProducts()
    const config = getFasstoConfigSummary()
    const duplicateCodes = new Set<string>()
    const productCodeSeen = new Set<string>()

    for (const product of products) {
      const productCode = normalizeProductCode(product.productCode)
      if (!productCode) continue
      if (productCodeSeen.has(productCode)) duplicateCodes.add(productCode)
      productCodeSeen.add(productCode)
    }

    const localSummary = {
      totalProducts: products.length,
      productsWithCode: products.filter((product) => normalizeProductCode(product.productCode)).length,
      productsMissingCode: products.filter((product) => !normalizeProductCode(product.productCode)).length,
      lowStockProducts: products.filter((product) => product.stock <= product.safetyStock).length,
      duplicateProductCodes: duplicateCodes.size,
    }

    if (!isFasstoConfigured()) {
      return NextResponse.json({
        config,
        connection: {
          ok: false,
          message: 'FASSTO 환경변수가 모두 설정되어야 원격 조회를 시작할 수 있습니다.',
        },
        localSummary,
        remoteSummary: null,
        syncSummary: null,
        stockSummary: null,
        warnings: ['파스토는 고정 IP와 환경별 인증키 확인이 선행되어야 운영 연결이 안정적입니다.'],
      })
    }

    const [goodsResult, stockResult] = await Promise.allSettled([getGoodsList(), getStockList()])
    const remoteGoods = goodsResult.status === 'fulfilled' ? normalizeFasstoGoods(extractFasstoList(goodsResult.value.data)) : []
    const remoteStocks = stockResult.status === 'fulfilled' ? normalizeFasstoStocks(extractFasstoList(stockResult.value.data)) : []
    const goodsPreview = buildGoodsSyncPreview(products, remoteGoods)
    const stockComparison = buildStockComparison(products, remoteGoods, remoteStocks)

    const errors = [] as string[]
    if (goodsResult.status === 'rejected') errors.push(`상품 조회 실패: ${serializeReason(goodsResult.reason)}`)
    if (stockResult.status === 'rejected') errors.push(`재고 조회 실패: ${serializeReason(stockResult.reason)}`)

    return NextResponse.json({
      config,
      connection: {
        ok: errors.length === 0,
        message: errors.length === 0 ? '파스토 상품/재고 조회에 성공했습니다.' : '일부 파스토 조회가 실패했습니다.',
      },
      localSummary,
      remoteSummary: {
        goodsCount: remoteGoods.length,
        stockRows: remoteStocks.length,
      },
      syncSummary: goodsPreview.summary,
      stockSummary: stockComparison.summary,
      warnings: [
        '파스토 실운영 연결은 허용 고정 IP, api_cd, api_key, cstCd가 모두 맞아야 합니다.',
        ...errors,
      ],
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
