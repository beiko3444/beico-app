import "server-only"

import {
    normalizeIncomingStoredAsset,
    resolveStoredAsset,
} from "@/lib/stored-asset"
import { isProductImageProxyUrl } from "@/lib/product-image-url"

type ProductImageRecord = {
    id: string
    imageUrl: string | null
}

export async function normalizeIncomingProductImage(imageUrl: string | null | undefined): Promise<string | null> {
    return normalizeIncomingStoredAsset(imageUrl, {
        keyPrefix: "products",
        isProxyUrl: isProductImageProxyUrl,
    })
}

export async function resolveProductImage(product: ProductImageRecord) {
    const resolvedAsset = await resolveStoredAsset({
        assetUrl: product.imageUrl,
        keyPrefix: "products",
        filenameBase: `product-${product.id}`,
        isProxyUrl: isProductImageProxyUrl,
        disposition: "inline",
    })

    if (!resolvedAsset) {
        return null
    }

    return {
        ...resolvedAsset,
        migratedImageUrl: resolvedAsset.migratedAssetUrl,
    }
}
