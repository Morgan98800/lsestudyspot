import crypto from 'crypto';

const SALT = process.env.DEVICE_HASH_SALT || 'lse_spots_privacy_salt_2026_w10';

/**
 * Creates a one-way pseudonymous device hash.
 * Combines the client's local anonymous UUID and a coarse IP prefix.
 * Never stores raw IP addresses, complying with UK GDPR.
 */
export function generateDeviceHash(clientRandomId: string, ipHeader?: string | null): string {
  // Coarse IP: only use /24 for IPv4 (e.g. 192.168.1.xxx) or /48 for IPv6
  let coarseIp = '0.0.0.0';
  if (ipHeader) {
    const rawIp = ipHeader.split(',')[0].trim();
    if (rawIp.includes('.')) {
      const parts = rawIp.split('.');
      coarseIp = `${parts[0]}.${parts[1]}.${parts[2]}.0`;
    } else if (rawIp.includes(':')) {
      const parts = rawIp.split(':');
      coarseIp = parts.slice(0, 3).join(':');
    }
  }

  const raw = `${clientRandomId || 'anon'}::${coarseIp}::${SALT}`;
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
}
