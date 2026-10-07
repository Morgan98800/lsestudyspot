import { describe, it, expect } from 'vitest';
import { generateDeviceHash } from '../src/lib/anti-spam/device-hash';

describe('Rate Limiter & Device Hash Tests', () => {
  it('generates consistent pseudonymised hash for the same client ID and subnet', () => {
    const hash1 = generateDeviceHash('client_123', '192.168.1.45');
    const hash2 = generateDeviceHash('client_123', '192.168.1.99'); // Same /24 subnet

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(32);
  });

  it('produces different hash for different devices or subnets', () => {
    const hashA = generateDeviceHash('client_A', '192.168.1.45');
    const hashB = generateDeviceHash('client_B', '192.168.1.45');
    const hashC = generateDeviceHash('client_A', '10.0.0.1');

    expect(hashA).not.toBe(hashB);
    expect(hashA).not.toBe(hashC);
  });
});
