const MILLISECOND_TIMESTAMP_THRESHOLD = BigInt(1_000_000_000_000)

export function normalizeUnixTimestampSeconds(value?: unknown): bigint {
  if (value instanceof Date) {
    return BigInt(Math.floor(value.getTime() / 1000))
  }

  if (typeof value === 'bigint') {
    return value >= MILLISECOND_TIMESTAMP_THRESHOLD ? value / BigInt(1000) : value
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) {
      return BigInt(Math.floor(Date.now() / 1000))
    }
    return BigInt(Math.floor(value >= 1_000_000_000_000 ? value / 1000 : value))
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') {
      return BigInt(Math.floor(Date.now() / 1000))
    }
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return BigInt(Math.floor(Date.now() / 1000))
    }
    return BigInt(Math.floor(parsed >= 1_000_000_000_000 ? parsed / 1000 : parsed))
  }

  return BigInt(Math.floor(Date.now() / 1000))
}

export function normalizeUnixTimestampSecondsNumber(value?: unknown): number {
  return Number(normalizeUnixTimestampSeconds(value))
}
