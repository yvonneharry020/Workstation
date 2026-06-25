// Sliding window in-memory rate limiter.
// Suitable for single-instance servers and low-traffic admin panels.
// For multi-instance distributed deployments, replace with Upstash Redis.

interface Entry {
  timestamps: number[]
}

const store = new Map<string, Entry>()
let lastCleanup = Date.now()
const CLEANUP_INTERVAL = 5 * 60 * 1000

function lazyCleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, entry] of store.entries()) {
    const recent = entry.timestamps.filter(t => now - t < 60 * 60 * 1000)
    if (recent.length === 0) store.delete(key)
    else store.set(key, { timestamps: recent })
  }
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  lazyCleanup()

  const now = Date.now()
  const existing = store.get(key) ?? { timestamps: [] }
  const active = existing.timestamps.filter(t => now - t < windowMs)

  if (active.length >= maxRequests) {
    const oldest = Math.min(...active)
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, windowMs - (now - oldest)),
    }
  }

  store.set(key, { timestamps: [...active, now] })
  return { allowed: true, remaining: maxRequests - active.length - 1, retryAfterMs: 0 }
}
