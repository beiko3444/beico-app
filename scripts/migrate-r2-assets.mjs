import fs from "fs"
import path from "path"
import crypto from "crypto"

import { PrismaClient } from "@prisma/client"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

const cwd = process.cwd()
const prisma = new PrismaClient()

const MIME_TYPE_TO_EXTENSION = {
  "application/pdf": "pdf",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return

  const content = fs.readFileSync(filePath, "utf8")
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue

    const separatorIndex = line.indexOf("=")
    if (separatorIndex === -1) continue

    const key = line.slice(0, separatorIndex).trim()
    let value = line.slice(separatorIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    limit: null,
    only: "all",
  }

  for (const arg of argv) {
    if (arg === "--dry-run") {
      args.dryRun = true
    } else if (arg.startsWith("--limit=")) {
      const limit = Number(arg.split("=")[1])
      if (!Number.isNaN(limit) && limit > 0) {
        args.limit = limit
      }
    } else if (arg.startsWith("--only=")) {
      const only = arg.split("=")[1]
      if (["all", "products", "partners"].includes(only)) {
        args.only = only
      }
    }
  }

  return args
}

function parseDataUrl(dataUrl) {
  const commaIndex = dataUrl.indexOf(",")
  if (commaIndex === -1) return null

  const metadata = dataUrl.slice(0, commaIndex)
  const payload = dataUrl.slice(commaIndex + 1)
  const contentTypeMatch = metadata.match(/^data:([^;]+)/)
  const contentType = contentTypeMatch?.[1] || "application/octet-stream"

  return {
    contentType,
    body: metadata.includes(";base64")
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8"),
  }
}

function getExtensionForMimeType(contentType) {
  return MIME_TYPE_TO_EXTENSION[contentType.toLowerCase()] || "bin"
}

function buildR2Client() {
  const accountId = (process.env.R2_ACCOUNT_ID || "").trim()
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || "").trim()
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || "").trim()
  const bucketName = (process.env.R2_BUCKET_NAME || "").trim()

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error("R2 env vars are missing. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME.")
  }

  return {
    bucketName,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    }),
  }
}

async function uploadDataUrlToR2(r2, dataUrl, keyPrefix) {
  if (!r2) {
    throw new Error("R2 client is not configured")
  }

  const parsed = parseDataUrl(dataUrl)
  if (!parsed) {
    throw new Error("Invalid data URL")
  }

  const key = `${keyPrefix}/${crypto.randomUUID()}.${getExtensionForMimeType(parsed.contentType)}`
  await r2.client.send(
    new PutObjectCommand({
      Bucket: r2.bucketName,
      Key: key,
      Body: parsed.body,
      ContentType: parsed.contentType,
    })
  )

  return `r2:${key}`
}

async function migrateProducts(r2, { dryRun, limit }) {
  const products = await prisma.product.findMany({
    where: {
      imageUrl: {
        startsWith: "data:",
      },
    },
    select: {
      id: true,
      name: true,
      imageUrl: true,
    },
    take: limit || undefined,
    orderBy: {
      createdAt: "asc",
    },
  })

  let migrated = 0
  let failed = 0

  for (const product of products) {
    try {
      if (!product.imageUrl) continue

      const nextImageUrl = dryRun
        ? "[dry-run]"
        : await uploadDataUrlToR2(r2, product.imageUrl, "products")

      if (!dryRun) {
        await prisma.product.update({
          where: { id: product.id },
          data: { imageUrl: nextImageUrl },
        })
      }

      migrated += 1
      console.log(`[product] ${dryRun ? "would migrate" : "migrated"} ${product.id} ${product.name || ""}`)
    } catch (error) {
      failed += 1
      console.error(`[product] failed ${product.id}:`, error.message || error)
    }
  }

  return { found: products.length, migrated, failed }
}

async function migratePartnerDocuments(r2, { dryRun, limit }) {
  const profiles = await prisma.partnerProfile.findMany({
    where: {
      businessRegistrationUrl: {
        startsWith: "data:",
      },
    },
    select: {
      id: true,
      userId: true,
      businessName: true,
      representativeName: true,
      businessRegistrationUrl: true,
    },
    take: limit || undefined,
    orderBy: {
      id: "asc",
    },
  })

  let migrated = 0
  let failed = 0

  for (const profile of profiles) {
    try {
      if (!profile.businessRegistrationUrl) continue

      const nextDocumentUrl = dryRun
        ? "[dry-run]"
        : await uploadDataUrlToR2(r2, profile.businessRegistrationUrl, "partner-business-registrations")

      if (!dryRun) {
        await prisma.partnerProfile.update({
          where: { id: profile.id },
          data: { businessRegistrationUrl: nextDocumentUrl },
        })
      }

      migrated += 1
      console.log(
        `[partner] ${dryRun ? "would migrate" : "migrated"} ${profile.userId} ${profile.businessName || profile.representativeName || ""}`
      )
    } catch (error) {
      failed += 1
      console.error(`[partner] failed ${profile.userId}:`, error.message || error)
    }
  }

  return { found: profiles.length, migrated, failed }
}

async function main() {
  loadEnvFile(path.join(cwd, ".env"))
  loadEnvFile(path.join(cwd, ".env.local"))

  const args = parseArgs(process.argv.slice(2))
  const r2 = args.dryRun ? null : buildR2Client()
  const results = {}

  if (args.only === "all" || args.only === "products") {
    results.products = await migrateProducts(r2, args)
  }
  if (args.only === "all" || args.only === "partners") {
    results.partners = await migratePartnerDocuments(r2, args)
  }

  console.log("")
  console.log("Migration summary")
  console.log(JSON.stringify({ dryRun: args.dryRun, results }, null, 2))
}

main()
  .catch((error) => {
    console.error("Migration failed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
