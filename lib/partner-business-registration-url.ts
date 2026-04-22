type PartnerDocumentVersion = string | number | Date | null | undefined

export function getPartnerBusinessRegistrationUrl(
    partnerId: string,
    version?: PartnerDocumentVersion,
    options: { download?: boolean } = {}
): string {
    const baseUrl = `/api/partners/${partnerId}/business-registration`
    const searchParams = new URLSearchParams()

    if (version !== null && version !== undefined) {
        const normalizedVersion = version instanceof Date ? String(version.getTime()) : String(version)
        if (normalizedVersion) {
            searchParams.set("v", normalizedVersion)
        }
    }

    if (options.download) {
        searchParams.set("download", "1")
    }

    const queryString = searchParams.toString()
    return queryString ? `${baseUrl}?${queryString}` : baseUrl
}

export function isPartnerBusinessRegistrationProxyUrl(assetUrl: string | null | undefined): boolean {
    return typeof assetUrl === "string" && /^\/api\/partners\/[^/]+\/business-registration(?:\?.*)?$/.test(assetUrl)
}
