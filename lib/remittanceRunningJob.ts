export const REMITTANCE_RUNNING_JOB_STALE_MS = 330 * 1000

export const getRemittanceRunningJobElapsedMs = (startedAt: number, now = Date.now()) => {
    if (!Number.isFinite(startedAt) || !Number.isFinite(now)) return 0
    return Math.max(0, now - startedAt)
}

export const isRemittanceRunningJobStale = (
    startedAt: number,
    now = Date.now(),
    staleMs = REMITTANCE_RUNNING_JOB_STALE_MS,
) => getRemittanceRunningJobElapsedMs(startedAt, now) > staleMs
