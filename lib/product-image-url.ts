type ProductImageVersion = string | number | Date | null | undefined

const PRODUCT_IMAGE_PROXY_PREFIX = "/api/products/"
const R2_PRODUCT_IMAGE_PREFIX = "r2:"

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

export function toR2ProductImageReference(key: string): string {
    return `${R2_PRODUCT_IMAGE_PREFIX}${key}`
}

export function fromR2ProductImageReference(imageUrl: string | null | undefined): string | null {
    if (typeof imageUrl !== "string" || !imageUrl.startsWith(R2_PRODUCT_IMAGE_PREFIX)) {
        return null
    }

    const key = imageUrl.slice(R2_PRODUCT_IMAGE_PREFIX.length)
    return key || null
}
