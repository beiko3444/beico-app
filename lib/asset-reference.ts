const R2_ASSET_PREFIX = "r2:"

export function toR2AssetReference(key: string): string {
    return `${R2_ASSET_PREFIX}${key}`
}

export function fromR2AssetReference(assetUrl: string | null | undefined): string | null {
    if (typeof assetUrl !== "string" || !assetUrl.startsWith(R2_ASSET_PREFIX)) {
        return null
    }

    const key = assetUrl.slice(R2_ASSET_PREFIX.length)
    return key || null
}

export function isR2AssetReference(assetUrl: string | null | undefined): boolean {
    return fromR2AssetReference(assetUrl) !== null
}
