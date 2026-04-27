import "server-only"

import { fromR2AssetReference, toR2AssetReference } from "@/lib/asset-reference"
import { getR2PresignedUrl, isR2Configured, uploadToR2 } from "@/lib/r2"

export type FileLike = {
    arrayBuffer(): Promise<ArrayBuffer>
    type?: string | null
}

export type ResolvedStoredAsset =
    | {
        kind: "redirect"
        location: string
        migratedAssetUrl?: string
    }
    | {
        kind: "binary"
        body: Uint8Array
        contentType: string
        migratedAssetUrl?: string
    }

type NormalizeStoredAssetOptions = {
    keyPrefix: string
    isProxyUrl?: (assetUrl: string | null | undefined) => boolean
}

type ResolveStoredAssetOptions = NormalizeStoredAssetOptions & {
    assetUrl: string | null | undefined
    filenameBase: string
    disposition?: "attachment" | "inline"
}

const MIME_TYPE_TO_EXTENSION: Record<string, string> = {
    "application/pdf": "pdf",
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/svg+xml": "svg",
    "image/webp": "webp",
}

const EXTENSION_TO_MIME_TYPE: Record<string, string> = {
    gif: "image/gif",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    pdf: "application/pdf",
    png: "image/png",
    svg: "image/svg+xml",
    webp: "image/webp",
}

function getExtensionForMimeType(contentType: string): string {
    return MIME_TYPE_TO_EXTENSION[contentType.toLowerCase()] || "bin"
}

function getExtensionFromPath(value: string): string {
    const withoutQuery = value.split("?")[0] || value
    const extension = withoutQuery.split(".").pop()?.trim().toLowerCase()
    return extension || "bin"
}

function getContentTypeFromExtension(extension: string): string | null {
    return EXTENSION_TO_MIME_TYPE[extension.toLowerCase()] || null
}

function buildAssetFilename(filenameBase: string, key: string): string {
    return `${filenameBase}.${getExtensionFromPath(key)}`
}

export function parseDataUrl(dataUrl: string): { contentType: string, body: Uint8Array } | null {
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

export function inferStoredAssetContentType(assetUrl: string | null | undefined): string | null {
    if (!assetUrl) {
        return null
    }

    if (assetUrl.startsWith("data:")) {
        return parseDataUrl(assetUrl)?.contentType || null
    }

    const r2Key = fromR2AssetReference(assetUrl)
    if (r2Key) {
        return getContentTypeFromExtension(getExtensionFromPath(r2Key))
    }

    if (assetUrl.startsWith("http://") || assetUrl.startsWith("https://")) {
        try {
            return getContentTypeFromExtension(getExtensionFromPath(new URL(assetUrl).pathname))
        } catch {
            return null
        }
    }

    if (assetUrl.startsWith("/")) {
        return getContentTypeFromExtension(getExtensionFromPath(assetUrl))
    }

    return null
}

export function isStoredAssetImage(assetUrl: string | null | undefined): boolean {
    const contentType = inferStoredAssetContentType(assetUrl)
    return typeof contentType === "string" && contentType.startsWith("image/")
}

export function isStoredAssetPdf(assetUrl: string | null | undefined): boolean {
    return inferStoredAssetContentType(assetUrl) === "application/pdf"
}

export async function fileLikeToDataUrl(file: FileLike): Promise<string> {
    const bytes = await file.arrayBuffer()
    const contentType = file.type || "application/octet-stream"
    return `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`
}

export async function normalizeIncomingStoredAsset(
    assetUrl: string | null | undefined,
    options: NormalizeStoredAssetOptions
): Promise<string | null> {
    if (!assetUrl) {
        return null
    }

    if (options.isProxyUrl?.(assetUrl)) {
        throw new Error("Proxy asset URLs cannot be stored directly.")
    }

    if (!assetUrl.startsWith("data:") || !isR2Configured()) {
        return assetUrl
    }

    const parsedAsset = parseDataUrl(assetUrl)
    if (!parsedAsset) {
        return assetUrl
    }

    const key = `${options.keyPrefix}/${crypto.randomUUID()}.${getExtensionForMimeType(parsedAsset.contentType)}`
    await uploadToR2(key, parsedAsset.body, parsedAsset.contentType)

    return toR2AssetReference(key)
}

export async function resolveStoredAsset(options: ResolveStoredAssetOptions): Promise<ResolvedStoredAsset | null> {
    const { assetUrl, filenameBase, keyPrefix, disposition = "inline", isProxyUrl } = options

    if (!assetUrl || isProxyUrl?.(assetUrl)) {
        return null
    }

    const r2Key = fromR2AssetReference(assetUrl)
    if (r2Key) {
        const location = await getR2PresignedUrl(
            r2Key,
            buildAssetFilename(filenameBase, r2Key),
            { disposition }
        )

        return {
            kind: "redirect",
            location,
        }
    }

    if (assetUrl.startsWith("http://") || assetUrl.startsWith("https://") || assetUrl.startsWith("/")) {
        return {
            kind: "redirect",
            location: assetUrl,
        }
    }

    if (!assetUrl.startsWith("data:")) {
        return null
    }

    if (isR2Configured()) {
        const migratedAssetUrl = await normalizeIncomingStoredAsset(assetUrl, { keyPrefix, isProxyUrl })
        if (migratedAssetUrl && migratedAssetUrl !== assetUrl) {
            const migratedKey = fromR2AssetReference(migratedAssetUrl)
            if (migratedKey) {
                const location = await getR2PresignedUrl(
                    migratedKey,
                    buildAssetFilename(filenameBase, migratedKey),
                    { disposition }
                )

                return {
                    kind: "redirect",
                    location,
                    migratedAssetUrl,
                }
            }
        }
    }

    const parsedAsset = parseDataUrl(assetUrl)
    if (!parsedAsset) {
        return null
    }

    return {
        kind: "binary",
        body: parsedAsset.body,
        contentType: parsedAsset.contentType,
    }
}
