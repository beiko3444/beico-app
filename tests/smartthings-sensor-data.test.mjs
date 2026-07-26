import assert from 'node:assert/strict'
import {
  deviceHasClimateCapabilities,
  extractSmartThingsSensorReading,
  readingBucketIso,
} from '../lib/smartThingsSensorData.mjs'

assert.equal(
  deviceHasClimateCapabilities({
    components: [
      {
        id: 'main',
        capabilities: [
          { id: 'temperatureMeasurement' },
          { id: 'relativeHumidityMeasurement' },
        ],
      },
    ],
  }),
  true,
)
assert.equal(deviceHasClimateCapabilities({ components: [{ capabilities: [{ id: 'switch' }] }] }), false)

const reading = extractSmartThingsSensorReading({
  components: {
    main: {
      temperatureMeasurement: {
        temperature: {
          value: 77,
          unit: 'F',
          timestamp: '2026-07-26T01:02:03.000Z',
        },
      },
      relativeHumidityMeasurement: {
        humidity: {
          value: 61.34,
          unit: '%',
          timestamp: '2026-07-26T01:02:04.000Z',
        },
      },
      battery: {
        battery: {
          value: 92,
          unit: '%',
          timestamp: '2026-07-26T00:00:00.000Z',
        },
      },
    },
  },
})

assert.deepEqual(reading, {
  temperatureC: 25,
  humidityPercent: 61.34,
  batteryPercent: 92,
  sourceUpdatedAt: '2026-07-26T01:02:04.000Z',
})
assert.equal(extractSmartThingsSensorReading({ components: { main: {} } }), null)
assert.equal(readingBucketIso('2026-07-26T01:07:59.999Z'), '2026-07-26T01:05:00.000Z')

console.log('smartthings sensor data ok')
