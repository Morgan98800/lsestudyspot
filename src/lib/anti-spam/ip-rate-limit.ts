import crypto from 'crypto';

const SALT = process.env.DEVICE_HASH_SALT || 'lse_spots_privacy_salt_2026_w10';

interface RateLimitEntry {
  timestamps: number[];
}

// In-memory rate limiting map keyed by hashed IP
const ipLimits = new Map<string, RateLimitEntry>();

/**
 * Creates a one-way pseudonymous hash of an IP address.
 * Never stores raw IP addresses, complying with UK GDPR.
 */
export function hashIp(rawIp: string): string {
  const normalized = (rawIp || '127.0.0.1').split(',')[0].trim();
  return crypto.createHash('sha256').update(`${normalized}::${SALT}`).digest('hex').substring(0, 32);
}

/**
 * Checks and records a rate-limited request for an IP address.
 * Default: 5 requests per hour.
 */
export function checkIpRateLimit(
  rawIp: string,
  maxRequests = 5,
  windowMs = 60 * 60 * 1000 // 1 hour
): { allowed: boolean; remaining: number; resetMs: number } {
  const ipHash = hashIp(rawIp);
  const now = Date.now();
  const windowStart = now - windowMs;

  let entry = ipLimits.get(ipHash);
  if (!entry) {
    entry = { timestamps: [] };
    ipLimits.set(ipHash, entry);
  }

  // Filter timestamps within sliding window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= maxRequests) {
    const oldest = entry.timestamps[0];
    const resetMs = Math.max(0, oldest + windowMs - now);
    return {
      allowed: false,
      remaining: 0,
      resetMs,
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    resetMs: windowMs,
  };
}

/**
 * Purge rate limit entries older than retention period (e.g. 24 hours).
 */
export function purgeOldIpRateLimits(retentionMs = 24 * 60 * 60 * 1000): number {
  const now = Date.now();
  const cutoff = now - retentionMs;
  let purged = 0;

  for (const [key, entry] of ipLimits.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) {
      ipLimits.delete(key);
      purged++;
    }
  }

  return purged;
}

/**
 * Reset all rate limits (for testing purposes).
 */
export function resetIpRateLimits(): void {
  ipLimits.clear();
}
