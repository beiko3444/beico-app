export type SmartThingsSensorReadingValue = {
  temperatureC: number | null
  humidityPercent: number | null
  batteryPercent: number | null
  sourceUpdatedAt: string | null
}

export function deviceHasClimateCapabilities(device: unknown): boolean
export function extractSmartThingsSensorReading(status: unknown): SmartThingsSensorReadingValue | null
export function readingBucketIso(value?: Date | string | number, bucketMinutes?: number): string
