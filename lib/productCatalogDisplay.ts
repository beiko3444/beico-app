export const PRODUCT_CATALOG_CATEGORIES = ['soft', 'hard', 'quick', 'accessory'] as const

export type ProductCatalogCategory = typeof PRODUCT_CATALOG_CATEGORIES[number]

export const PRODUCT_CATALOG_CATEGORY_LABELS: Record<ProductCatalogCategory, string> = {
    soft: '소프트베이트',
    hard: '하드베이트',
    quick: '퀵베이트',
    accessory: '기타용품',
}

type ProductCatalogIdentity = {
    name?: string | null
    nameJP?: string | null
    nameEN?: string | null
    groupName?: string | null
    productCode?: string | null
}

type GroupedSkuLabelInput = {
    productName?: string | null
    groupName?: string | null
    productCode?: string | null
}

const QUICK_BAIT_PATTERN = /퀵\s*베이트|quick\s*bait|beiko[\s-]*qb/i
const ACCESSORY_PATTERN = /플라이어|니퍼|스플릿\s*링|싱커|봉돌|가드\s*훅|웜\s*훅|옵셋\s*훅|와이드\s*갭\s*훅|지그\s*헤드|퀵\s*스냅|스냅\s*도래|롤링\s*스위블|스위블|맨도래|언로딩\s*도래|바라클라바|넥\s*워머|채비\s*터짐|연결\s*고리/i
const HARD_BAIT_PATTERN = /하드\s*베이트|토부\s*에기|캐스팅\s*에기|에깅|에기|미노우|크랭크|메탈\s*바이브|메탈\s*지그|바이브레이션|플로퍼|프롭\s*베이트|탑\s*워터|관절\s*베이트|관절\s*루어|빅\s*베이트|싱킹\s*미노우|플로팅\s*미노우|저크\s*베이트/i
const SOFT_BAIT_PATTERN = /소프트\s*베이트|쉐드\s*웜|패들\s*웜|그럽\s*웜|센코\s*웜|샌드\s*웜|갈치\s*웜|새우\s*웜|오징어\s*웜|호그\s*웜|크랩\s*베이트|스퀴드\s*베이트|코튼\s*볼|콘\s*베이트|야광\s*옥수수|떡밥|지렁이|웜|soft\s*bait/i

const normalizeDisplayText = (value?: string | null) => String(value || '').replace(/\s+/g, ' ').trim()

export function classifyProductCatalogCategory(product: ProductCatalogIdentity): ProductCatalogCategory {
    const searchText = [
        product.name,
        product.nameJP,
        product.nameEN,
        product.groupName,
        product.productCode,
    ].map(normalizeDisplayText).filter(Boolean).join(' ')

    if (QUICK_BAIT_PATTERN.test(searchText)) return 'quick'
    if (ACCESSORY_PATTERN.test(searchText)) return 'accessory'
    if (HARD_BAIT_PATTERN.test(searchText)) return 'hard'
    if (SOFT_BAIT_PATTERN.test(searchText)) return 'soft'
    return 'accessory'
}

export function getGroupedSkuLabel({ productName, groupName, productCode }: GroupedSkuLabelInput) {
    const normalizedProductName = normalizeDisplayText(productName)
    const normalizedGroupName = normalizeDisplayText(groupName)
    const normalizedProductCode = normalizeDisplayText(productCode)

    if (!normalizedProductName) return normalizedProductCode || '-'
    if (!normalizedGroupName) return normalizedProductName

    if (normalizedProductName.toLocaleLowerCase('ko-KR').startsWith(normalizedGroupName.toLocaleLowerCase('ko-KR'))) {
        const suffix = normalizedProductName
            .slice(normalizedGroupName.length)
            .replace(/^[\s:：\-–—·|/]+/, '')
            .trim()
        return suffix || normalizedProductCode || normalizedProductName
    }

    return normalizedProductName
}
