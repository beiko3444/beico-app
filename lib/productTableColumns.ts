export const PRODUCT_TABLE_COLUMNS_STORAGE_KEY = 'admin-product-table-visible-columns-v5'

// This order is the on-screen column order: the table draws headers and cells from it,
// so any saved or preset selection lines up. Numbers are right-aligned.
export const PRODUCT_TABLE_COLUMN_OPTIONS = [
    { key: 'barcode', label: '바코드번호', width: 160, align: 'left' },
    { key: 'stock', label: '관리용 재고', width: 132, align: 'right' },
    { key: 'safetyStock', label: '안전재고', width: 92, align: 'right' },
    { key: 'stockStatus', label: '수량 상태', width: 100, align: 'center' },
    { key: 'availability', label: '파트너 노출', width: 112, align: 'center' },
    { key: 'cnyCost', label: '외화 매입가', width: 124, align: 'right' },
    { key: 'cost', label: '한화 매입가', width: 124, align: 'right' },
    { key: 'wholesale', label: '도매가', width: 112, align: 'right' },
    { key: 'retail', label: '판매가', width: 112, align: 'right' },
    { key: 'margin', label: '마진', width: 104, align: 'right' },
    { key: 'moq', label: '최소수량', width: 90, align: 'right' },
    { key: 'orderUnit', label: '주문단위', width: 90, align: 'right' },
    { key: 'productCode', label: '상품코드', width: 128, align: 'left' },
    { key: 'hsCode', label: 'HS Code', width: 96, align: 'left' },
    { key: 'japanHsCode', label: 'JP HS', width: 96, align: 'left' },
    { key: 'actions', label: '관리', width: 140, align: 'center' },
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

export function sameProductTableColumns(a: readonly ProductTableColumnKey[], b: readonly ProductTableColumnKey[]) {
    const left = normalizeProductTableColumns(a)
    const right = normalizeProductTableColumns(b)
    return left.length === right.length && left.every((key, index) => key === right[index])
}
