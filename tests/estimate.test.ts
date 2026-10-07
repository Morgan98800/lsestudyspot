import { describe, it, expect } from 'vitest';
import {
  calculateDecayedWeight,
  scoreToBucket,
  computeZoneEstimate,
  generateInsightText,
  formatFreshness,
  checkZoneOpen,
} from '../src/lib/algo/estimate';
import { Zone, Report, HourlyStat } from '../src/types/database';

describe('Live Estimate & Prediction Tests', () => {
  it('correctly maps scores to bucket thresholds (<0.7 Plenty, <1.4 Filling up, else Full)', () => {
    expect(scoreToBucket(0.0)).toBe(0);
    expect(scoreToBucket(0.69)).toBe(0);
    expect(scoreToBucket(0.70)).toBe(1);
    expect(scoreToBucket(1.39)).toBe(1);
    expect(scoreToBucket(1.40)).toBe(2);
    expect(scoreToBucket(2.0)).toBe(2);
  });

  it('exponentially decays reports with a 20-minute half-life', () => {
    const now = new Date('2026-10-08T12:00:00Z');
    const t0 = new Date('2026-10-08T12:00:00Z');
    const t20 = new Date('2026-10-08T11:40:00Z');
    const t40 = new Date('2026-10-08T11:20:00Z');

    expect(calculateDecayedWeight(t0, now, 20)).toBeCloseTo(1.0, 4);
    expect(calculateDecayedWeight(t20, now, 20)).toBeCloseTo(0.5, 4);
    expect(calculateDecayedWeight(t40, now, 20)).toBeCloseTo(0.25, 4);
  });

  it('formats relative freshness text', () => {
    const now = new Date('2026-10-08T12:00:00Z');
    expect(formatFreshness(new Date('2026-10-08T11:59:30Z'), now)).toBe('just now');
    expect(formatFreshness(new Date('2026-10-08T11:51:00Z'), now)).toBe('9 min ago');
    expect(formatFreshness(new Date('2026-10-08T10:45:00Z'), now)).toBe('1h ago');
  });

  it('falls back to prediction and displays Usual level when no reports in 90 minutes', () => {
    const zone: Zone = {
      id: 'z-test',
      slug: 'test-zone',
      name: 'Library, floor 2',
      descriptor: 'Quiet study',
      building: 'Lionel Robbins Building',
      floor: 'Floor 2',
      noise: 'quiet',
      has_power: true,
      has_pcs: false,
      opening_hours: null,
      is_active: true,
      qr_token: 'tok-1',
    };

    const now = new Date();
    const stats: HourlyStat[] = [
      {
        zone_id: 'z-test',
        weekday: now.getDay(),
        hour: now.getHours(),
        avg_level: 0.3,
        n_reports: 8,
      },
    ];

    const estimate = computeZoneEstimate(zone, [], stats, now);
    expect(estimate.is_predicted).toBe(true);
    expect(estimate.level).toBe(0); // Plenty
    expect(estimate.freshness_text).toBe('Usual level');
  });

  it('generates plain-language insight text from hourly_stats', () => {
    const stats: HourlyStat[] = [
      { zone_id: 'z1', weekday: 1, hour: 12, avg_level: 1.6, n_reports: 10 },
      { zone_id: 'z1', weekday: 1, hour: 13, avg_level: 1.8, n_reports: 10 },
      { zone_id: 'z1', weekday: 1, hour: 14, avg_level: 1.5, n_reports: 10 },
      { zone_id: 'z1', weekday: 1, hour: 18, avg_level: 0.6, n_reports: 10 },
    ];

    const text = generateInsightText(stats, 13);
    expect(text).toContain('Usually busiest');
    expect(text).toContain('12:00 to 15:00');
    expect(text).toContain('calmer from 18:00');
  });

  it('detects closed zone and shows opening time', () => {
    const openingHours = {
      wed: { open: '08:30', close: '22:00' },
    };
    // Wednesday 07:00
    const earlyWed = new Date('2026-10-07T07:00:00');
    const res = checkZoneOpen(openingHours, earlyWed);
    expect(res.isOpen).toBe(false);
    expect(res.opensAt).toBe('08:30');
  });
});
