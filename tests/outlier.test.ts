import { describe, it, expect } from 'vitest';
import { isReportOutlier } from '../src/lib/anti-spam/outlier';
import { BusynessLevel, Report } from '../src/types/database';

function mockReport(level: BusynessLevel, minsAgo: number): Report {
  return {
    id: `rep-${Math.random()}`,
    zone_id: 'test-zone',
    level,
    device_hash: 'hash-1',
    is_flagged: false,
    created_at: new Date(Date.now() - minsAgo * 60 * 1000).toISOString(),
  };
}

describe('Outlier Detection', () => {
  it('does not flag reports when there are fewer than 3 recent reports', () => {
    const recent = [mockReport(0, 5), mockReport(0, 10)];
    const result = isReportOutlier(2, recent);
    expect(result.isOutlier).toBe(false);
  });

  it('flags Full (2) report when 3 recent reports say Plenty (0) - 2-level contradiction', () => {
    const recent = [mockReport(0, 5), mockReport(0, 12), mockReport(0, 20)];
    const result = isReportOutlier(2, recent);
    expect(result.isOutlier).toBe(true);
    expect(result.reason).toContain('contradicts');
  });

  it('flags Plenty (0) report when 3 recent reports say Full (2)', () => {
    const recent = [mockReport(2, 5), mockReport(2, 15), mockReport(2, 25)];
    const result = isReportOutlier(0, recent);
    expect(result.isOutlier).toBe(true);
  });

  it('does NOT flag Filling up (1) when recent reports say Plenty or Full (only 1-level difference)', () => {
    const recent = [mockReport(0, 5), mockReport(0, 10), mockReport(0, 15)];
    const result = isReportOutlier(1, recent);
    expect(result.isOutlier).toBe(false);
  });
});
