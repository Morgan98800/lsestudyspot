import { describe, it, expect } from 'vitest';
import { matchZoneSearch, searchZones } from '../src/lib/algo/search';
import { ZoneWithEstimate } from '../src/types/database';

describe('Search Matching and Sorting', () => {
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
        level: 1, // Filling up
        is_predicted: false,
        is_closed: false,
        updated_at: new Date().toISOString(),
        freshness_text: '5 min ago',
        minutes_ago: 5,
        insight_text: 'Busiest around 14:00.',
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
        level: 0, // Plenty of seats
        is_predicted: false,
        is_closed: false,
        updated_at: new Date().toISOString(),
        freshness_text: '2 min ago',
        minutes_ago: 2,
        insight_text: 'Busiest around 14:00.',
        hourly_bars: [],
      },
    },
    {
      id: 'mar-atr',
      slug: 'marshall-atrium',
      name: 'Marshall Building atrium',
      descriptor: 'Social study and cafe',
      building: 'Marshall Building',
      floor: 'Ground floor',
      noise: 'social',
      opening_hours: null,
      is_active: true,
      qr_token: 't3',
      estimate: {
        zone_id: 'mar-atr',
        level: 0,
        is_predicted: false,
        is_closed: false,
        updated_at: new Date().toISOString(),
        freshness_text: 'just now',
        minutes_ago: 0,
        insight_text: 'Calmer in evening.',
        hourly_bars: [],
      },
    },
    {
      id: 'shaw-lib',
      slug: 'shaw-library',
      name: 'Shaw Library',
      descriptor: 'Silent reading room',
      building: 'Old Building',
      floor: 'Floor 1',
      noise: 'silent',
      opening_hours: null,
      is_active: true,
      qr_token: 't4',
      estimate: {
        zone_id: 'shaw-lib',
        level: 2,
        is_predicted: false,
        is_closed: true, // Closed
        closed_reason: 'opens 09:00',
        updated_at: null,
        freshness_text: 'opens 09:00',
        minutes_ago: null,
        insight_text: 'Calmer in evening.',
        hourly_bars: [],
      },
    },
  ];

  it('matches single word search case-insensitively', () => {
    expect(matchZoneSearch(mockZones[2], 'marshall')).toBe(true);
    expect(matchZoneSearch(mockZones[2], 'MARSHALL')).toBe(true);
    expect(matchZoneSearch(mockZones[0], 'marshall')).toBe(false);
  });

  it('matches multi-word queries across name, floor, and building', () => {
    // "floor 2" should match Library Floor 2
    expect(matchZoneSearch(mockZones[1], 'floor 2')).toBe(true);
    expect(matchZoneSearch(mockZones[0], 'floor 2')).toBe(false);

    // "library floor 1"
    expect(matchZoneSearch(mockZones[0], 'library floor 1')).toBe(true);
    expect(matchZoneSearch(mockZones[2], 'library floor 1')).toBe(false);
  });

  it('sorts search results: open first, then most available', () => {
    // Search "library" matches lib-1, lib-2, and shaw-lib
    const results = searchZones(mockZones, 'library');
    expect(results.length).toBe(3);

    // lib-2 has level 0 (Plenty of seats) -> first
    // lib-1 has level 1 (Filling up) -> second
    // shaw-lib is closed -> last
    expect(results[0].id).toBe('lib-2');
    expect(results[1].id).toBe('lib-1');
    expect(results[2].id).toBe('shaw-lib');
  });

  it('filters by quietOnly in search', () => {
    const results = searchZones(mockZones, 'ground', true);
    // Marshall ground floor is social, so quietOnly filters it out
    expect(results.length).toBe(0);
  });

  it('returns empty array when query is empty', () => {
    expect(searchZones(mockZones, '')).toEqual([]);
    expect(searchZones(mockZones, '   ')).toEqual([]);
  });
});
