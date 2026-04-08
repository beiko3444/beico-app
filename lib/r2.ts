import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

type R2Config = {
    accountId: string
    accessKeyId: string
    secretAccessKey: string
    bucketName: string
}

let cachedR2Client: S3Client | null = null
let cachedClientKey = ''

function readR2Config(): R2Config | null {
    const accountId = (process.env.R2_ACCOUNT_ID || '').trim()
    const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim()
    const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim()
    const bucketName = (process.env.R2_BUCKET_NAME || '').trim()

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
        return null
    }

    return { accountId, accessKeyId, secretAccessKey, bucketName }
}

function getRequiredR2Config(): R2Config {
    const config = readR2Config()
    if (config) return config

    const missing: string[] = []
    if (!(process.env.R2_ACCOUNT_ID || '').trim()) missing.push('R2_ACCOUNT_ID')
    if (!(process.env.R2_ACCESS_KEY_ID || '').trim()) missing.push('R2_ACCESS_KEY_ID')
    if (!(process.env.R2_SECRET_ACCESS_KEY || '').trim()) missing.push('R2_SECRET_ACCESS_KEY')
    if (!(process.env.R2_BUCKET_NAME || '').trim()) missing.push('R2_BUCKET_NAME')

    throw new Error(`R2 is not configured. Missing env: ${missing.join(', ')}`)
}

function getR2Client(config: R2Config) {
    const nextClientKey = `${config.accountId}|${config.accessKeyId}|${config.bucketName}`
    if (cachedR2Client && cachedClientKey === nextClientKey) {
        return cachedR2Client
    }

    cachedR2Client = new S3Client({
        region: 'auto',
        endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
        },
    })
    cachedClientKey = nextClientKey
    return cachedR2Client
}

export function isR2Configured(): boolean {
    return readR2Config() !== null
}

export async function uploadToR2(key: string, body: Uint8Array, contentType: string): Promise<void> {
    const config = getRequiredR2Config()
    const r2 = getR2Client(config)
    await r2.send(new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
    }))
}

// 1시간 유효한 presigned URL 반환 (파일이 브라우저로 직접 전달됨 - Vercel 트래픽 없음)
export async function getR2PresignedUrl(key: string, filename: string): Promise<string> {
    const config = getRequiredR2Config()
    const r2 = getR2Client(config)
    return getSignedUrl(
        r2,
        new GetObjectCommand({
            Bucket: config.bucketName,
            Key: key,
            ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        }),
        { expiresIn: 3600 }
    )
}
