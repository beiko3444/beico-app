export const PRODUCT_TABLE_COLUMNS_STORAGE_KEY = 'admin-product-table-visible-columns-v5'

export const PRODUCT_TABLE_COLUMN_OPTIONS = [
    { key: 'barcode', label: '바코드번호', width: 160 },
    { key: 'stock', label: '재고', width: 104 },
    { key: 'safetyStock', label: '안전재고', width: 92 },
    { key: 'stockStatus', label: '재고상태', width: 104 },
    { key: 'cnyCost', label: '외화 매입가', width: 124 },
    { key: 'cost', label: '한화 매입가', width: 124 },
    { key: 'retail', label: '판매가', width: 112 },
    { key: 'availability', label: '파트너 상태', width: 112 },
    { key: 'moq', label: '최소수량', width: 90 },
    { key: 'orderUnit', label: '주문단위', width: 90 },
    { key: 'wholesale', label: '도매가', width: 112 },
    { key: 'margin', label: '마진', width: 104 },
    { key: 'productCode', label: '상품코드', width: 128 },
    { key: 'hsCode', label: 'HS Code', width: 96 },
    { key: 'japanHsCode', label: 'JP HS', width: 96 },
    { key: 'actions', label: '관리', width: 132 },
] as const

export type ProductTableColumnKey = typeof PRODUCT_TABLE_COLUMN_OPTIONS[number]['key']

export const DEFAULT_PRODUCT_TABLE_COLUMNS: ProductTableColumnKey[] = [
    'stock',
    'safetyStock',
    'stockStatus',
    'availability',
    'cnyCost',
    'cost',
    'wholesale',
    'retail',
]

const PRODUCT_TABLE_COLUMN_KEYS = new Set<ProductTableColumnKey>(
    PRODUCT_TABLE_COLUMN_OPTIONS.map(option => option.key),
)

export function normalizeProductTableColumns(value: unknown): ProductTableColumnKey[] {
    if (!Array.isArray(value)) return [...DEFAULT_PRODUCT_TABLE_COLUMNS]

    const selected = new Set(
        value.filter((key): key is ProductTableColumnKey => (
            typeof key === 'string' && PRODUCT_TABLE_COLUMN_KEYS.has(key as ProductTableColumnKey)
        )),
    )

    const normalized = PRODUCT_TABLE_COLUMN_OPTIONS
        .map(option => option.key)
        .filter(key => selected.has(key))

    return normalized
}
