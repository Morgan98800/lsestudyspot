import { BusynessLevel, Report } from '@/types/database';

/**
 * Flag a report that contradicts 3+ recent reports by 2 levels.
 * 0 = Plenty, 1 = Filling up, 2 = Full
 */
export function isReportOutlier(
  incomingLevel: BusynessLevel,
  recentReports: Report[]
): { isOutlier: boolean; reason?: string } {
  const validRecent = recentReports.filter((r) => !r.is_flagged);

  if (validRecent.length < 3) {
    return { isOutlier: false };
  }

  const firstThree = validRecent.slice(0, 3);
  const allZeros = firstThree.every((r) => r.level === 0);
  const allTwos = firstThree.every((r) => r.level === 2);

  // Contradiction by 2 levels
  if (incomingLevel === 2 && allZeros) {
    return {
      isOutlier: true,
      reason: "Incoming 'Full' contradicts 3 recent 'Plenty of seats' reports",
    };
  }

  if (incomingLevel === 0 && allTwos) {
    return {
      isOutlier: true,
      reason: "Incoming 'Plenty of seats' contradicts 3 recent 'Full' reports",
    };
  }

  return { isOutlier: false };
}
