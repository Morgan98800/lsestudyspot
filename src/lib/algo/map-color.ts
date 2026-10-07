import { BusynessLevel, ZoneWithEstimate } from '@/types/database';

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export interface BuildingSummary {
  buildingKey: string;
  name: string;
  shortName: string;
  coordinates: [number, number]; // [lat, lng]
  avgLevel: number;
  bucketLevel: BusynessLevel;
  bucketWord: string;
  totalSpaces: number;
  spacesWithSeats: number;
  hasLiveReport: boolean;
  isClosed: boolean;
  statusLabel: string;
  offReason?: string; // 'Closed' | 'No quiet spaces'
  bgColor: string;
  textColor: string;
  isDashed: boolean;
}

export const BUILDINGS_METADATA: Record<
  string,
  { name: string; shortName: string; coordinates: [number, number] }
> = {
  LIB: {
    name: 'Lionel Robbins Building',
    shortName: 'Library',
    coordinates: [51.5141, -0.1163],
  },
  OLD: {
    name: 'Old Building',
    shortName: 'Old Building',
    coordinates: [51.5143, -0.1171],
  },
  CEN: {
    name: 'Centre Building',
    shortName: 'Centre Bldg',
    coordinates: [51.5146, -0.1168],
  },
  SSH: {
    name: 'Saw Swee Hock Student Centre',
    shortName: 'Saw Swee Hock',
    coordinates: [51.5140, -0.1158],
  },
  MAR: {
    name: 'Marshall Building',
    shortName: 'Marshall',
    coordinates: [51.5152, -0.1160],
  },
  NAB: {
    name: 'New Academic Building',
    shortName: 'NAB',
    coordinates: [51.5153, -0.1174],
  },
};

/**
 * Maps zone building name to Building key
 */
export function getBuildingKeyForZone(buildingName: string): string {
  const norm = buildingName.toLowerCase();
  if (norm.includes('lionel') || norm.includes('library')) return 'LIB';
  if (norm.includes('old')) return 'OLD';
  if (norm.includes('centre')) return 'CEN';
  if (norm.includes('saw') || norm.includes('swee') || norm.includes('student')) return 'SSH';
  if (norm.includes('marshall')) return 'MAR';
  if (norm.includes('academic') || norm.includes('nab')) return 'NAB';
  return 'LIB';
}

/**
 * Linear interpolation on continuous green -> amber -> red scale:
 * 0 = #2EAA70 (46, 170, 112)
 * 1 = #F5B83A (245, 184, 58)
 * 2 = #CD302C (205, 48, 44)
 */
export function getGradientRgb(value: number): [number, number, number] {
  const t = Math.min(2, Math.max(0, value));
  const stops: [number, number, number][] = [
    [46, 170, 112],
    [245, 184, 58],
    [205, 48, 44],
  ];

  const idx = t < 1 ? 0 : 1;
  const fraction = t < 1 ? t : t - 1;
  const start = stops[idx];
  const end = stops[idx + 1];

  return [
    Math.round(start[0] + (end[0] - start[0]) * fraction),
    Math.round(start[1] + (end[1] - start[1]) * fraction),
    Math.round(start[2] + (end[2] - start[2]) * fraction),
  ];
}

/**
 * Relative luminance per WCAG 2.1
 */
export function getRelativeLuminance(rgb: [number, number, number]): number {
  const [rs, gs, bs] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Choose black (#161616) or white (#FFFFFF) text per tile by computed WCAG contrast
 */
export function getContrastingTextColor(rgb: [number, number, number]): string {
  const lum = getRelativeLuminance(rgb);
  // Contrast against black (0) is (lum + 0.05) / 0.05
  // Contrast against white (1) is 1.05 / (lum + 0.05)
  const contrastBlack = (lum + 0.05) / 0.05;
  const contrastWhite = 1.05 / (lum + 0.05);
  return contrastBlack >= contrastWhite ? '#161616' : '#FFFFFF';
}

/**
 * Compute building summary for map tiles and building search list
 */
export function computeBuildingSummary(
  buildingKey: string,
  zones: ZoneWithEstimate[],
  quietOnly: boolean
): BuildingSummary {
  const meta = BUILDINGS_METADATA[buildingKey] || {
    name: buildingKey,
    shortName: buildingKey,
    coordinates: [51.5144, -0.1165],
  };

  const buildingZones = zones.filter((z) => getBuildingKeyForZone(z.building) === buildingKey);
  const openZones = buildingZones.filter((z) => !z.estimate.is_closed);
  const filteredZones = openZones.filter((z) => !quietOnly || z.noise === 'silent' || z.noise === 'quiet');

  // Closed building
  if (openZones.length === 0) {
    return {
      buildingKey,
      name: meta.name,
      shortName: meta.shortName,
      coordinates: meta.coordinates,
      avgLevel: 2,
      bucketLevel: 2,
      bucketWord: 'Closed',
      totalSpaces: buildingZones.length,
      spacesWithSeats: 0,
      hasLiveReport: false,
      isClosed: true,
      statusLabel: 'Closed',
      offReason: 'Closed',
      bgColor: 'var(--surface-2)',
      textColor: 'var(--ink-2)',
      isDashed: true,
    };
  }

  // Filter excluded all zones (e.g. Quiet only turned on for social building)
  if (filteredZones.length === 0) {
    return {
      buildingKey,
      name: meta.name,
      shortName: meta.shortName,
      coordinates: meta.coordinates,
      avgLevel: 2,
      bucketLevel: 2,
      bucketWord: 'No quiet spaces',
      totalSpaces: openZones.length,
      spacesWithSeats: 0,
      hasLiveReport: false,
      isClosed: false,
      statusLabel: 'No quiet spaces',
      offReason: 'No quiet spaces',
      bgColor: 'var(--surface-2)',
      textColor: 'var(--ink-2)',
      isDashed: true,
    };
  }

  // Compute average level across filtered zones
  const sumLevel = filteredZones.reduce((acc, z) => acc + z.estimate.level, 0);
  const avgLevel = sumLevel / filteredZones.length;
  const bucketLevel: BusynessLevel = avgLevel < 0.7 ? 0 : avgLevel < 1.4 ? 1 : 2;
  const bucketWord =
    bucketLevel === 0 ? 'Plenty of seats' : bucketLevel === 1 ? 'Filling up' : 'Full';

  const spacesWithSeats = filteredZones.filter(
    (z) => z.estimate.level === 0 || z.estimate.level === 1
  ).length;

  const hasLiveReport = filteredZones.some((z) => !z.estimate.is_predicted);
  const rgb = getGradientRgb(avgLevel);
  const bgColor = `rgb(${rgb.join(',')})`;
  const textColor = getContrastingTextColor(rgb);

  return {
    buildingKey,
    name: meta.name,
    shortName: meta.shortName,
    coordinates: meta.coordinates,
    avgLevel,
    bucketLevel,
    bucketWord,
    totalSpaces: filteredZones.length,
    spacesWithSeats,
    hasLiveReport,
    isClosed: false,
    statusLabel: `${spacesWithSeats} of ${filteredZones.length} with seats`,
    bgColor,
    textColor,
    isDashed: !hasLiveReport,
  };
}
