import { ZoneWithEstimate } from '@/types/database';
import { BUILDINGS_METADATA, getBuildingKeyForZone } from './map-color';

/**
 * Multi-word search matching:
 * A zone matches if every word in query appears in
 * (zone name + descriptor + floor + building name + building short name), case-insensitive.
 */
export function matchZoneSearch(zone: ZoneWithEstimate, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  const bKey = getBuildingKeyForZone(zone.building);
  const bMeta = BUILDINGS_METADATA[bKey] || { name: zone.building, shortName: zone.building };

  const haystack = [
    zone.name,
    zone.descriptor,
    zone.floor,
    zone.building,
    bMeta.name,
    bMeta.shortName,
  ]
    .join(' ')
    .toLowerCase();

  return words.every((word) => haystack.includes(word));
}

/**
 * Filter and sort search results:
 * Open zones first, then most available (level 0 < 1 < 2), then name
 */
export function searchZones(
  zones: ZoneWithEstimate[],
  query: string,
  quietOnly: boolean = false
): ZoneWithEstimate[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const matched = zones.filter((zone) => {
    if (quietOnly && zone.noise !== 'silent' && zone.noise !== 'quiet') return false;
    return matchZoneSearch(zone, query);
  });

  return matched.sort((a, b) => {
    // 1. Open spaces first
    const aClosed = a.estimate.is_closed ? 1 : 0;
    const bClosed = b.estimate.is_closed ? 1 : 0;
    if (aClosed !== bClosed) return aClosed - bClosed;

    // 2. Most available first (level 0 Plenty < 1 Filling up < 2 Full)
    if (a.estimate.level !== b.estimate.level) {
      return a.estimate.level - b.estimate.level;
    }

    // 3. Name alphabetical
    return a.name.localeCompare(b.name);
  });
}
