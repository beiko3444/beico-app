type InventorySyncLink = {
  syncedAt: string | null
}

type InventorySyncRow = {
  updatedAt: string | null
  linked: InventorySyncLink[]
}

export function resolveInventoryRowSyncedAt(row: InventorySyncRow): string | null {
  let latestValue: string | null = null
  let latestTimestamp = Number.NEGATIVE_INFINITY
  let firstUnparsedValue: string | null = null

  for (const link of row.linked) {
    if (!link.syncedAt) continue
    const timestamp = Date.parse(link.syncedAt)
    if (!Number.isFinite(timestamp)) {
      firstUnparsedValue ??= link.syncedAt
      continue
    }
    if (timestamp > latestTimestamp) {
      latestTimestamp = timestamp
      latestValue = link.syncedAt
    }
  }

  return latestValue ?? firstUnparsedValue ?? row.updatedAt
}
