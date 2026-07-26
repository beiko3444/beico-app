function recordValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function finiteNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function capabilityIds(device) {
  const ids = new Set()
  const components = Array.isArray(device?.components) ? device.components : []
  for (const component of components) {
    const capabilities = Array.isArray(component?.capabilities) ? component.capabilities : []
    for (const capability of capabilities) {
      const id = String(capability?.id || '').trim()
      if (id) ids.add(id)
    }
  }
  return ids
}

export function deviceHasClimateCapabilities(device) {
  const ids = capabilityIds(device)
  return ids.has('temperatureMeasurement') || ids.has('relativeHumidityMeasurement')
}

function findAttribute(status, capabilityId, attributeId) {
  const components = recordValue(status?.components)
  if (!components) return null

  for (const componentValue of Object.values(components)) {
    const component = recordValue(componentValue)
    if (!component) continue
    const capability = recordValue(component[capabilityId])
    const attribute = recordValue(capability?.[attributeId])
    if (attribute) return attribute
  }
  return null
}

function dateValue(value) {
  if (!value) return null
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function extractSmartThingsSensorReading(status) {
  const temperature = findAttribute(status, 'temperatureMeasurement', 'temperature')
  const humidity = findAttribute(status, 'relativeHumidityMeasurement', 'humidity')
  const battery = findAttribute(status, 'battery', 'battery')

  let temperatureC = finiteNumber(temperature?.value)
  const temperatureUnit = String(temperature?.unit || '').trim().toUpperCase()
  if (temperatureC !== null && (temperatureUnit === 'F' || temperatureUnit === '°F')) {
    temperatureC = (temperatureC - 32) * (5 / 9)
  }

  const humidityPercent = finiteNumber(humidity?.value)
  const batteryPercent = finiteNumber(battery?.value)
  if (temperatureC === null && humidityPercent === null) return null

  const sourceDates = [temperature?.timestamp, humidity?.timestamp, battery?.timestamp]
    .map(dateValue)
    .filter(Boolean)
  const sourceUpdatedAt = sourceDates.length
    ? new Date(Math.max(...sourceDates.map((value) => value.getTime()))).toISOString()
    : null

  return {
    temperatureC: temperatureC === null ? null : Math.round(temperatureC * 100) / 100,
    humidityPercent: humidityPercent === null ? null : Math.round(humidityPercent * 100) / 100,
    batteryPercent: batteryPercent === null ? null : Math.round(batteryPercent * 100) / 100,
    sourceUpdatedAt,
  }
}

export function readingBucketIso(value = new Date(), bucketMinutes = 5) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('기록 시간이 올바르지 않습니다.')
  const bucketMs = Math.max(1, Math.trunc(Number(bucketMinutes) || 5)) * 60_000
  return new Date(Math.floor(date.getTime() / bucketMs) * bucketMs).toISOString()
}
