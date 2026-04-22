type ProductImageVersion = string | number | Date | null | undefined

const PRODUCT_IMAGE_PROXY_PREFIX = "/api/products/"

export function getProductImageUrl(productId: string, version?: ProductImageVersion): string {
    const baseUrl = `${PRODUCT_IMAGE_PROXY_PREFIX}${productId}/image`

    if (version === null || version === undefined) {
        return baseUrl
    }

    const normalizedVersion = version instanceof Date ? String(version.getTime()) : String(version)
    if (!normalizedVersion) {
        return baseUrl
    }

    return `${baseUrl}?v=${encodeURIComponent(normalizedVersion)}`
}

export function isProductImageProxyUrl(imageUrl: string | null | undefined): boolean {
    return typeof imageUrl === "string" && /^\/api\/products\/[^/]+\/image(?:\?.*)?$/.test(imageUrl)
}
