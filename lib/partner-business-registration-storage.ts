import "server-only"

import {
    fileLikeToDataUrl,
    inferStoredAssetContentType,
    isStoredAssetImage,
    isStoredAssetPdf,
    normalizeIncomingStoredAsset,
    resolveStoredAsset,
    type FileLike,
} from "@/lib/stored-asset"
import { isPartnerBusinessRegistrationProxyUrl } from "@/lib/partner-business-registration-url"

export type PartnerBusinessRegistrationRecord = {
    userId: string
    businessRegistrationUrl: string | null
}

const PARTNER_DOCUMENT_R2_PREFIX = "partner-business-registrations"

export async function normalizeIncomingBusinessRegistration(assetUrl: string | null | undefined): Promise<string | null> {
    return normalizeIncomingStoredAsset(assetUrl, {
        keyPrefix: PARTNER_DOCUMENT_R2_PREFIX,
        isProxyUrl: isPartnerBusinessRegistrationProxyUrl,
    })
}

export async function normalizeUploadedBusinessRegistration(file: FileLike): Promise<string | null> {
    return normalizeIncomingBusinessRegistration(await fileLikeToDataUrl(file))
}

export async function resolvePartnerBusinessRegistration(
    record: PartnerBusinessRegistrationRecord,
    disposition: "attachment" | "inline" = "inline"
) {
    return resolveStoredAsset({
        assetUrl: record.businessRegistrationUrl,
        keyPrefix: PARTNER_DOCUMENT_R2_PREFIX,
        filenameBase: `business-registration-${record.userId}`,
        isProxyUrl: isPartnerBusinessRegistrationProxyUrl,
        disposition,
    })
}

export function inferBusinessRegistrationContentType(assetUrl: string | null | undefined): string | null {
    return inferStoredAssetContentType(assetUrl)
}

export function isBusinessRegistrationImage(assetUrl: string | null | undefined): boolean {
    return isStoredAssetImage(assetUrl)
}

export function isBusinessRegistrationPdf(assetUrl: string | null | undefined): boolean {
    return isStoredAssetPdf(assetUrl)
}
