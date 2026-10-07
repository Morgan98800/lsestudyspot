import { describe, it, expect } from 'vitest';
import {
  scoreZone,
  getRankedRecommendations,
  formatRecommendationReason,
  calculateSendDecay,
} from '../src/lib/algo/recommendation';
import { ZoneWithEstimate } from '../src/types/database';

describe('Recommendation Engine (Where to Go)', () => {
  const zoneA: ZoneWithEstimate = {
    id: 'zone-a',
    slug: 'nab-seating',
    name: 'NAB study seating',
    descriptor: 'Quiet study',
    building: 'New Academic Building',
    floor: 'Floor 1',
    noise: 'quiet',
    opening_hours: null,
    is_active: true,
    qr_token: 'tok-a',
    estimate: {
      zone_id: 'zone-a',
      level: 0, // Plenty of seats
      is_predicted: false, // Live
      is_closed: false,
      updated_at: new Date().toISOString(),
      freshness_text: '5 min ago',
      minutes_ago: 5,
      insight_text: 'Calm',
      hourly_bars: [
        { hour: 13, avg_level: 0.3, is_current: false },
        { hour: 14, avg_level: 0.3, is_current: false },
      ],
    },
  };

  const zoneB: ZoneWithEstimate = {
    id: 'zone-b',
    slug: 'library-floor-2',
    name: 'Library, floor 2',
    descriptor: 'Quiet study',
    building: 'Lionel Robbins Building',
    floor: 'Floor 2',
    noise: 'quiet',
    opening_hours: null,
    is_active: true,
    qr_token: 'tok-b',
    estimate: {
      zone_id: 'zone-b',
      level: 0, // Plenty of seats
      is_predicted: false, // Live
      is_closed: false,
      updated_at: new Date().toISOString(),
      freshness_text: '3 min ago',
      minutes_ago: 3,
      insight_text: 'Calm',
      hourly_bars: [
        { hour: 13, avg_level: 0.4, is_current: false },
        { hour: 14, avg_level: 0.4, is_current: false },
      ],
    },
  };

  const zoneFull: ZoneWithEstimate = {
    id: 'zone-c',
    slug: 'library-floor-3',
    name: 'Library, floor 3',
    descriptor: 'Silent study',
    building: 'Lionel Robbins Building',
    floor: 'Floor 3',
    noise: 'silent',
    opening_hours: null,
    is_active: true,
    qr_token: 'tok-c',
    estimate: {
      zone_id: 'zone-c',
      level: 2, // Full
      is_predicted: false,
      is_closed: false,
      updated_at: new Date().toISOString(),
      freshness_text: '1 min ago',
      minutes_ago: 1,
      insight_text: 'Full',
      hourly_bars: [],
    },
  };

  it('correctly calculates score based on exact formula', () => {
    // Score = (2 - level) * 10 + (live ? 2 : 0) - 0.6 * sends - 3 * future
    // Zone A: level = 0 -> base = 20
    // Live -> +2
    // sends = 0 -> -0
    // future = 0.3 -> -0.9
    // Total = 20 + 2 - 0 - 0.9 = 21.1
    const score = scoreZone(zoneA, 0, 0.3);
    expect(score).toBeCloseTo(21.1);
  });

  it('excludes closed and full zones from candidates', () => {
    const candidates = getRankedRecommendations([zoneA, zoneB, zoneFull], false, {}, 12);
    const candidateIds = candidates.map((c) => c.zone.id);
    expect(candidateIds).toContain('zone-a');
    expect(candidateIds).toContain('zone-b');
    expect(candidateIds).not.toContain('zone-c'); // Full is excluded
  });

  it('steers students elsewhere as sends increase (traffic spreading)', () => {
    // Initially, zone A has higher score than zone B
    const initial = getRankedRecommendations([zoneA, zoneB], false, {}, 12);
    expect(initial[0].zone.id).toBe('zone-a');

    // After sending 10 students to zone A:
    // Zone A penalty = 0.6 * 10 = 6.0 points drop
    const rotated = getRankedRecommendations([zoneA, zoneB], false, { 'zone-a': 10 }, 12);
    expect(rotated[0].zone.id).toBe('zone-b');
  });

  it('generates friendly reason line comparing against candidate average sends', () => {
    // Zone A has 2 sends, average across candidates is 5
    const reasonLow = formatRecommendationReason(zoneA, 2, 5);
    expect(reasonLow).toBe('Plenty of seats, and fewer students are heading there.');

    // Zone A has 8 sends, average across candidates is 5
    const reasonHigh = formatRecommendationReason(zoneA, 8, 5);
    expect(reasonHigh).toBe('Plenty of seats.');
  });

  it('computes 15-minute exponential decay for sends', () => {
    const now = Date.now();
    // Age = 0 min -> weight = 1
    expect(calculateSendDecay(now, now)).toBe(1);

    // Age = 15 min (half-life) -> weight = 0.5
    expect(calculateSendDecay(now - 15 * 60 * 1000, now)).toBeCloseTo(0.5);

    // Age > 15 min -> weight = 0 (cutoff)
    expect(calculateSendDecay(now - 16 * 60 * 1000, now)).toBe(0);
  });
});
