import "server-only"

import { getR2PresignedUrl, isR2Configured, uploadToR2 } from "@/lib/r2"
import { fromR2ProductImageReference, isProductImageProxyUrl, toR2ProductImageReference } from "@/lib/product-image-url"

type ProductImageRecord = {
    id: string
    name: string | null
    imageUrl: string | null
}

type ProductImageResolution =
    | {
        kind: "redirect"
        location: string
        migratedImageUrl?: string
    }
    | {
        kind: "binary"
        body: Uint8Array
        contentType: string
        migratedImageUrl?: string
    }

const MIME_TYPE_TO_EXTENSION: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
}

function getExtensionForMimeType(contentType: string): string {
    return MIME_TYPE_TO_EXTENSION[contentType.toLowerCase()] || "bin"
}

function getExtensionFromKey(key: string): string {
    const extension = key.split(".").pop()?.trim().toLowerCase()
    return extension || "jpg"
}

function buildInlineFilename(product: ProductImageRecord, key: string): string {
    return `product-${product.id}.${getExtensionFromKey(key)}`
}

function parseDataUrl(dataUrl: string): { contentType: string, body: Uint8Array } | null {
    const commaIndex = dataUrl.indexOf(",")
    if (commaIndex === -1) {
        return null
    }

    const metadata = dataUrl.slice(0, commaIndex)
    const payload = dataUrl.slice(commaIndex + 1)

    const contentTypeMatch = metadata.match(/^data:([^;]+)/)
    const contentType = contentTypeMatch?.[1] || "application/octet-stream"
    const isBase64 = metadata.includes(";base64")

    const body = isBase64
        ? Buffer.from(payload, "base64")
        : Buffer.from(decodeURIComponent(payload), "utf8")

    return { contentType, body }
}

export async function normalizeIncomingProductImage(imageUrl: string | null | undefined): Promise<string | null> {
    if (!imageUrl) {
        return null
    }

    if (isProductImageProxyUrl(imageUrl)) {
        throw new Error("Product image proxy URLs cannot be stored directly.")
    }

    if (!imageUrl.startsWith("data:") || !isR2Configured()) {
        return imageUrl
    }

    const parsedImage = parseDataUrl(imageUrl)
    if (!parsedImage) {
        return imageUrl
    }

    const key = `products/${crypto.randomUUID()}.${getExtensionForMimeType(parsedImage.contentType)}`
    await uploadToR2(key, parsedImage.body, parsedImage.contentType)

    return toR2ProductImageReference(key)
}

export async function resolveProductImage(product: ProductImageRecord): Promise<ProductImageResolution | null> {
    if (!product.imageUrl || isProductImageProxyUrl(product.imageUrl)) {
        return null
    }

    const r2Key = fromR2ProductImageReference(product.imageUrl)
    if (r2Key) {
        const location = await getR2PresignedUrl(
            r2Key,
            buildInlineFilename(product, r2Key),
            { disposition: "inline" }
        )

        return {
            kind: "redirect",
            location,
        }
    }

    if (product.imageUrl.startsWith("http://") || product.imageUrl.startsWith("https://") || product.imageUrl.startsWith("/")) {
        return {
            kind: "redirect",
            location: product.imageUrl,
        }
    }

    if (!product.imageUrl.startsWith("data:")) {
        return null
    }

    if (isR2Configured()) {
        const migratedImageUrl = await normalizeIncomingProductImage(product.imageUrl)
        if (migratedImageUrl && migratedImageUrl !== product.imageUrl) {
            const migratedKey = fromR2ProductImageReference(migratedImageUrl)
            if (migratedKey) {
                const location = await getR2PresignedUrl(
                    migratedKey,
                    buildInlineFilename(product, migratedKey),
                    { disposition: "inline" }
                )

                return {
                    kind: "redirect",
                    location,
                    migratedImageUrl,
                }
            }
        }
    }

    const parsedImage = parseDataUrl(product.imageUrl)
    if (!parsedImage) {
        return null
    }

    return {
        kind: "binary",
        body: parsedImage.body,
        contentType: parsedImage.contentType,
    }
}
