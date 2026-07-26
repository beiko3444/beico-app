import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import {
  deviceHasClimateCapabilities,
  extractSmartThingsSensorReading,
  readingBucketIso,
} from '@/lib/smartThingsSensorData.mjs'

type RawRecord = Record<string, unknown>

const SMARTTHINGS_API_BASE = 'https://api.smartthings.com/v1'
const SMARTTHINGS_TOKEN_URL = 'https://api.smartthings.com/oauth/token'
const CONNECTION_ID = 'primary'

export class SmartThingsIntegrationError extends Error {
  status: number

  constructor(message: string, status = 502) {
    super(message)
    this.name = 'SmartThingsIntegrationError'
    this.status = status
  }
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function recordValue(value: unknown): RawRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as RawRecord
    : null
}

function requiredConfig() {
  return {
    clientId: stringValue(process.env.SMARTTHINGS_CLIENT_ID),
    clientSecret: stringValue(process.env.SMARTTHINGS_CLIENT_SECRET),
    encryptionKey: stringValue(process.env.SMARTTHINGS_TOKEN_ENCRYPTION_KEY),
  }
}

export function smartThingsConfiguration() {
  const config = requiredConfig()
  const missing = [
    !config.clientId ? 'SMARTTHINGS_CLIENT_ID' : '',
    !config.clientSecret ? 'SMARTTHINGS_CLIENT_SECRET' : '',
    !config.encryptionKey ? 'SMARTTHINGS_TOKEN_ENCRYPTION_KEY' : '',
  ].filter(Boolean)
  return {
    ready: missing.length === 0,
    missing,
    redirectUri: smartThingsRedirectUri(),
    webhookUrl: absoluteAppUrl('/api/smartthings/webhook'),
  }
}

function assertConfiguration() {
  const config = requiredConfig()
  const status = smartThingsConfiguration()
  if (!status.ready) {
    throw new SmartThingsIntegrationError(
      `SmartThings 연결 설정이 필요합니다: ${status.missing.join(', ')}`,
      503,
    )
  }
  return config
}

function absoluteAppUrl(path: string) {
  const base = stringValue(process.env.NEXTAUTH_URL) || 'https://www.beiko.co.kr'
  return new URL(path, base.endsWith('/') ? base : `${base}/`).toString()
}

export function smartThingsRedirectUri() {
  return stringValue(process.env.SMARTTHINGS_REDIRECT_URI)
    || absoluteAppUrl('/api/admin/smartthings/callback')
}

export function smartThingsAuthorizationUrl(state: string) {
  const { clientId } = assertConfiguration()
  const url = new URL('https://api.smartthings.com/v1/oauth/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', smartThingsRedirectUri())
  url.searchParams.set('scope', 'r:devices:*')
  url.searchParams.set('state', state)
  return url.toString()
}

function tokenEncryptionKey() {
  const { encryptionKey } = assertConfiguration()
  return createHash('sha256').update(encryptionKey, 'utf8').digest()
}

function encryptToken(token: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', tokenEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`
}

function decryptToken(payload: string) {
  const [version, ivValue, tagValue, encryptedValue] = payload.split(':')
  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
    throw new SmartThingsIntegrationError('저장된 SmartThings 연결 정보가 올바르지 않습니다.', 500)
  }
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      tokenEncryptionKey(),
      Buffer.from(ivValue, 'base64url'),
    )
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    throw new SmartThingsIntegrationError(
      'SmartThings 연결 정보를 해독하지 못했습니다. 다시 연결해 주세요.',
      500,
    )
  }
}

async function requestToken(params: URLSearchParams) {
  const { clientId, clientSecret } = assertConfiguration()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(SMARTTHINGS_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params,
      cache: 'no-store',
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null) as RawRecord | null
    if (!response.ok) {
      throw new SmartThingsIntegrationError(
        stringValue(payload?.error_description)
          || stringValue(payload?.error)
          || `SmartThings 인증에 실패했습니다. (${response.status})`,
        response.status,
      )
    }
    const accessToken = stringValue(payload?.access_token)
    const refreshToken = stringValue(payload?.refresh_token)
    if (!accessToken || !refreshToken) {
      throw new SmartThingsIntegrationError('SmartThings가 연결 토큰을 반환하지 않았습니다.')
    }
    return {
      accessToken,
      refreshToken,
      expiresIn: Math.max(60, Number(payload?.expires_in) || 86_399),
      installedAppId: stringValue(payload?.installed_app_id) || null,
      scope: Array.isArray(payload?.scope)
        ? payload.scope.map(String).join(' ')
        : stringValue(payload?.scope) || null,
    }
  } catch (error) {
    if (error instanceof SmartThingsIntegrationError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new SmartThingsIntegrationError('SmartThings 인증 응답 시간이 초과되었습니다.', 504)
    }
    throw new SmartThingsIntegrationError(
      error instanceof Error ? error.message : 'SmartThings 인증에 실패했습니다.',
    )
  } finally {
    clearTimeout(timer)
  }
}

export async function exchangeSmartThingsAuthorizationCode(code: string) {
  if (!code) throw new SmartThingsIntegrationError('SmartThings 승인 코드가 없습니다.', 400)
  const { clientId } = assertConfiguration()
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: smartThingsRedirectUri(),
    client_id: clientId,
  })
  const token = await requestToken(params)
  const expiresAt = new Date(Date.now() + token.expiresIn * 1000)
  return prisma.smartThingsConnection.upsert({
    where: { id: CONNECTION_ID },
    update: {
      accessTokenEncrypted: encryptToken(token.accessToken),
      refreshTokenEncrypted: encryptToken(token.refreshToken),
      expiresAt,
      installedAppId: token.installedAppId,
      scope: token.scope,
      connectedAt: new Date(),
      lastError: null,
    },
    create: {
      id: CONNECTION_ID,
      accessTokenEncrypted: encryptToken(token.accessToken),
      refreshTokenEncrypted: encryptToken(token.refreshToken),
      expiresAt,
      installedAppId: token.installedAppId,
      scope: token.scope,
    },
  })
}

async function getValidAccessToken() {
  const connection = await prisma.smartThingsConnection.findUnique({
    where: { id: CONNECTION_ID },
  })
  if (!connection) {
    throw new SmartThingsIntegrationError('SmartThings 계정을 먼저 연결해 주세요.', 409)
  }
  if (connection.expiresAt.getTime() > Date.now() + 10 * 60_000) {
    return decryptToken(connection.accessTokenEncrypted)
  }

  const { clientId } = assertConfiguration()
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: decryptToken(connection.refreshTokenEncrypted),
    client_id: clientId,
  })
  try {
    const token = await requestToken(params)
    await prisma.smartThingsConnection.update({
      where: { id: CONNECTION_ID },
      data: {
        accessTokenEncrypted: encryptToken(token.accessToken),
        refreshTokenEncrypted: encryptToken(token.refreshToken),
        expiresAt: new Date(Date.now() + token.expiresIn * 1000),
        installedAppId: token.installedAppId || connection.installedAppId,
        scope: token.scope || connection.scope,
        lastError: null,
      },
    })
    return token.accessToken
  } catch (error) {
    await prisma.smartThingsConnection.update({
      where: { id: CONNECTION_ID },
      data: {
        lastError: error instanceof Error ? error.message : 'SmartThings 토큰 갱신에 실패했습니다.',
      },
    })
    throw error
  }
}

async function smartThingsRequest(urlOrPath: string, accessToken: string) {
  const url = urlOrPath.startsWith('https://')
    ? new URL(urlOrPath)
    : urlOrPath.startsWith('/v1/')
      ? new URL(urlOrPath, 'https://api.smartthings.com')
      : new URL(urlOrPath.replace(/^\/+/, ''), `${SMARTTHINGS_API_BASE}/`)
  if (url.origin !== 'https://api.smartthings.com') {
    throw new SmartThingsIntegrationError('허용되지 않은 SmartThings API 주소입니다.', 500)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null) as RawRecord | null
    if (!response.ok) {
      throw new SmartThingsIntegrationError(
        stringValue(payload?.message) || `SmartThings API 호출에 실패했습니다. (${response.status})`,
        response.status,
      )
    }
    return payload || {}
  } catch (error) {
    if (error instanceof SmartThingsIntegrationError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new SmartThingsIntegrationError('SmartThings 응답 시간이 초과되었습니다.', 504)
    }
    throw new SmartThingsIntegrationError(
      error instanceof Error ? error.message : 'SmartThings API 호출에 실패했습니다.',
    )
  } finally {
    clearTimeout(timer)
  }
}

async function listSmartThingsDevices(accessToken: string) {
  const devices: RawRecord[] = []
  let nextUrl: string | null = `${SMARTTHINGS_API_BASE}/devices`

  for (let page = 0; page < 10 && nextUrl; page += 1) {
    const payload = await smartThingsRequest(nextUrl, accessToken)
    const items = Array.isArray(payload.items)
      ? payload.items.filter((item): item is RawRecord => Boolean(recordValue(item)))
      : []
    devices.push(...items)
    const links = recordValue(payload._links) || recordValue(payload.links)
    const next = recordValue(links?.next)
    nextUrl = stringValue(next?.href) || null
  }
  return devices
}

function sensorMetadata(device: RawRecord) {
  return {
    presentationId: stringValue(device.presentationId) || null,
    manufacturerName: stringValue(device.manufacturerName) || null,
    deviceTypeName: stringValue(device.deviceTypeName) || null,
    deviceNetworkType: stringValue(device.deviceNetworkType) || null,
  }
}

export async function collectSmartThingsSensors(now = new Date()) {
  const accessToken = await getValidAccessToken()
  const devices = await listSmartThingsDevices(accessToken)
  const climateDevices = devices.filter(deviceHasClimateCapabilities)
  if (!climateDevices.length) {
    const message = 'SmartThings에서 온습도 센서를 찾지 못했습니다. 센서 공유 상태를 확인해 주세요.'
    await prisma.smartThingsConnection.update({
      where: { id: CONNECTION_ID },
      data: { lastError: message },
    })
    throw new SmartThingsIntegrationError(message, 404)
  }

  const activeDeviceIds = climateDevices.map((device) => stringValue(device.deviceId)).filter(Boolean)
  const bucketAt = new Date(readingBucketIso(now))
  const results = await Promise.allSettled(climateDevices.map(async (device) => {
    const deviceId = stringValue(device.deviceId)
    if (!deviceId) throw new Error('센서 기기 번호가 없습니다.')
    const label = stringValue(device.label) || stringValue(device.name) || `SmartThings 센서 ${deviceId.slice(0, 8)}`
    const status = await smartThingsRequest(`/devices/${encodeURIComponent(deviceId)}/status`, accessToken)
    const reading = extractSmartThingsSensorReading(status)
    if (!reading) throw new Error(`${label}의 온습도 값이 없습니다.`)

    const sensor = await prisma.smartThingsSensor.upsert({
      where: { deviceId },
      update: {
        label,
        manufacturer: stringValue(device.manufacturerName) || null,
        model: stringValue(device.deviceTypeName) || stringValue(device.name) || null,
        active: true,
        lastTemperature: reading.temperatureC,
        lastHumidity: reading.humidityPercent,
        lastBattery: reading.batteryPercent,
        lastSeenAt: now,
        metadata: sensorMetadata(device),
      },
      create: {
        deviceId,
        label,
        manufacturer: stringValue(device.manufacturerName) || null,
        model: stringValue(device.deviceTypeName) || stringValue(device.name) || null,
        active: true,
        lastTemperature: reading.temperatureC,
        lastHumidity: reading.humidityPercent,
        lastBattery: reading.batteryPercent,
        lastSeenAt: now,
        metadata: sensorMetadata(device),
      },
    })
    await prisma.smartThingsReading.upsert({
      where: {
        sensorId_recordedAt: {
          sensorId: sensor.id,
          recordedAt: bucketAt,
        },
      },
      update: {
        sourceUpdatedAt: reading.sourceUpdatedAt ? new Date(reading.sourceUpdatedAt) : null,
        temperatureC: reading.temperatureC,
        humidityPercent: reading.humidityPercent,
        batteryPercent: reading.batteryPercent,
        collectedAt: now,
      },
      create: {
        sensorId: sensor.id,
        recordedAt: bucketAt,
        sourceUpdatedAt: reading.sourceUpdatedAt ? new Date(reading.sourceUpdatedAt) : null,
        temperatureC: reading.temperatureC,
        humidityPercent: reading.humidityPercent,
        batteryPercent: reading.batteryPercent,
        collectedAt: now,
      },
    })
    return {
      deviceId,
      label,
      model: stringValue(device.deviceTypeName) || stringValue(device.name) || 'SmartThings Climate Sensor',
      temperatureC: reading.temperatureC,
      humidityPercent: reading.humidityPercent,
      batteryPercent: reading.batteryPercent,
    }
  }))

  if (activeDeviceIds.length) {
    await prisma.smartThingsSensor.updateMany({
      where: { deviceId: { notIn: activeDeviceIds } },
      data: { active: false },
    })
  }

  const collected: Array<{
    deviceId: string
    label: string
    model: string
    temperatureC: number | null
    humidityPercent: number | null
    batteryPercent: number | null
  }> = []
  const errors: string[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      collected.push(result.value)
    } else {
      errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason))
    }
  }

  if (!collected.length) {
    const message = errors[0] || '온습도 값을 저장하지 못했습니다.'
    await prisma.smartThingsConnection.update({
      where: { id: CONNECTION_ID },
      data: { lastError: message },
    })
    throw new SmartThingsIntegrationError(message)
  }

  await prisma.smartThingsConnection.update({
    where: { id: CONNECTION_ID },
    data: {
      lastSyncAt: now,
      lastError: errors.length ? `${errors.length}개 센서 수집 실패: ${errors.join(' · ')}` : null,
    },
  })

  return {
    collectedAt: now.toISOString(),
    sensorCount: climateDevices.length,
    savedCount: collected.length,
    sensors: collected,
    warnings: errors,
  }
}

export async function getSmartThingsEnvironmentDashboard(days = 7) {
  const safeDays = Math.max(1, Math.min(90, Math.trunc(Number(days) || 7)))
  const since = new Date(Date.now() - safeDays * 86_400_000)
  const [connection, sensors] = await Promise.all([
    prisma.smartThingsConnection.findUnique({
      where: { id: CONNECTION_ID },
      select: {
        connectedAt: true,
        expiresAt: true,
        lastSyncAt: true,
        lastError: true,
      },
    }),
    prisma.smartThingsSensor.findMany({
      where: { active: true },
      orderBy: [{ label: 'asc' }],
      include: {
        readings: {
          where: { recordedAt: { gte: since } },
          orderBy: { recordedAt: 'asc' },
        },
      },
    }),
  ])

  return {
    configuration: smartThingsConfiguration(),
    connected: Boolean(connection),
    connection: connection
      ? {
          connectedAt: connection.connectedAt.toISOString(),
          expiresAt: connection.expiresAt.toISOString(),
          lastSyncAt: connection.lastSyncAt?.toISOString() || null,
          lastError: connection.lastError,
        }
      : null,
    range: { days: safeDays, since: since.toISOString() },
    sensors: sensors.map((sensor) => ({
      id: sensor.id,
      deviceId: sensor.deviceId,
      label: sensor.label,
      manufacturer: sensor.manufacturer,
      model: sensor.model,
      lastTemperature: sensor.lastTemperature,
      lastHumidity: sensor.lastHumidity,
      lastBattery: sensor.lastBattery,
      lastSeenAt: sensor.lastSeenAt?.toISOString() || null,
      readings: sensor.readings.map((reading) => ({
        recordedAt: reading.recordedAt.toISOString(),
        temperatureC: reading.temperatureC,
        humidityPercent: reading.humidityPercent,
        batteryPercent: reading.batteryPercent,
      })),
    })),
  }
}
