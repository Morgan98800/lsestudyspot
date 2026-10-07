import { describe, it, expect } from 'vitest';
import {
  getGradientRgb,
  getRelativeLuminance,
  getContrastingTextColor,
  computeBuildingSummary,
} from '../src/lib/algo/map-color';
import { ZoneWithEstimate } from '../src/types/database';

describe('Map Colors, Contrast and Building Summary', () => {
  it('correctly interpolates gradient colors at stops 0, 1, 2', () => {
    // 0 = Plenty (#2EAA70 -> 46, 170, 112)
    const rgb0 = getGradientRgb(0);
    expect(rgb0).toEqual([46, 170, 112]);

    // 1 = Filling up (#F5B83A -> 245, 184, 58)
    const rgb1 = getGradientRgb(1);
    expect(rgb1).toEqual([245, 184, 58]);

    // 2 = Full (#CD302C -> 205, 48, 44)
    const rgb2 = getGradientRgb(2);
    expect(rgb2).toEqual([205, 48, 44]);
  });

  it('computes readable contrast text color (black vs white)', () => {
    // Amber / Yellow #F5B83A has high luminance -> text should be dark (#161616)
    const amberFg = getContrastingTextColor([245, 184, 58]);
    expect(amberFg).toBe('#161616');

    // Deep Red #CD302C has low luminance -> text should be white (#FFFFFF)
    const redFg = getContrastingTextColor([205, 48, 44]);
    expect(redFg).toBe('#FFFFFF');
  });

  it('computes building summary with correct mean availability and live flag', () => {
    const mockZones: ZoneWithEstimate[] = [
      {
        id: 'lib-1',
        slug: 'library-floor-1',
        name: 'Library, floor 1',
        descriptor: 'PCs and quiet study',
        building: 'Lionel Robbins Building',
        floor: 'Floor 1',
        noise: 'quiet',
        opening_hours: null,
        is_active: true,
        qr_token: 't1',
        estimate: {
          zone_id: 'lib-1',
          level: 0,
          is_predicted: false,
          is_closed: false,
          updated_at: new Date().toISOString(),
          freshness_text: '5 min ago',
          minutes_ago: 5,
          insight_text: 'Calm',
          hourly_bars: [],
        },
      },
      {
        id: 'lib-2',
        slug: 'library-floor-2',
        name: 'Library, floor 2',
        descriptor: 'Quiet study',
        building: 'Lionel Robbins Building',
        floor: 'Floor 2',
        noise: 'quiet',
        opening_hours: null,
        is_active: true,
        qr_token: 't2',
        estimate: {
          zone_id: 'lib-2',
          level: 1,
          is_predicted: false,
          is_closed: false,
          updated_at: new Date().toISOString(),
          freshness_text: '2 min ago',
          minutes_ago: 2,
          insight_text: 'Calm',
          hourly_bars: [],
        },
      },
    ];

    const summary = computeBuildingSummary('LIB', mockZones, false);

    expect(summary.buildingKey).toBe('LIB');
    expect(summary.totalSpaces).toBe(2);
    expect(summary.spacesWithSeats).toBe(2);
    // (0 + 1) / 2 = 0.5 -> Plenty of seats (< 0.7)
    expect(summary.avgLevel).toBe(0.5);
    expect(summary.bucketWord).toBe('Plenty of seats');
    expect(summary.hasLiveReport).toBe(true);
    expect(summary.isDashed).toBe(false);
  });

  it('marks closed buildings and filter exclusions cleanly', () => {
    const closedZone: ZoneWithEstimate = {
      id: 'old-1',
      slug: 'shaw-library',
      name: 'Shaw Library',
      descriptor: 'Silent reading room',
      building: 'Old Building',
      floor: 'Floor 1',
      noise: 'silent',
      opening_hours: null,
      is_active: true,
      qr_token: 't3',
      estimate: {
        zone_id: 'old-1',
        level: 2,
        is_predicted: true,
        is_closed: true,
        closed_reason: 'opens 09:00',
        updated_at: null,
        freshness_text: 'opens 09:00',
        minutes_ago: null,
        insight_text: 'Closed',
        hourly_bars: [],
      },
    };

    const summary = computeBuildingSummary('OLD', [closedZone], false);
    expect(summary.isClosed).toBe(true);
    expect(summary.offReason).toBe('Closed');
    expect(summary.isDashed).toBe(true);
  });
});
