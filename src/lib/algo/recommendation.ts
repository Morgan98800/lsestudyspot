import { ZoneWithEstimate } from '@/types/database';

export interface RecommendationCandidate {
  zone: ZoneWithEstimate;
  score: number;
  recentSends: number;
  predictedNext2Hours: number;
  reasonText: string;
}

/**
 * Calculates exponential decay weight for sends within the last 15 minutes
 * half-life = 15 minutes
 */
export function calculateSendDecay(sendTimestampMs: number, nowMs: number = Date.now()): number {
  const ageMinutes = Math.max(0, (nowMs - sendTimestampMs) / (60 * 1000));
  if (ageMinutes > 15) return 0;
  return Math.pow(0.5, ageMinutes / 15);
}

/**
 * Mean predicted busyness level for the next 2 hours from hourly_bars
 */
export function getPredictedNext2Hours(zone: ZoneWithEstimate, currentHour: number): number {
  const bars = zone.estimate.hourly_bars || [];
  const next1 = bars.find((b) => b.hour === currentHour + 1)?.avg_level;
  const next2 = bars.find((b) => b.hour === currentHour + 2)?.avg_level;

  if (next1 !== undefined && next2 !== undefined) {
    return (next1 + next2) / 2;
  }
  if (next1 !== undefined) return next1;
  return zone.estimate.level;
}

/**
 * Score a candidate zone according to the exact spec:
 * Score = (2 - level) * 10 + (has live report ? 2 : 0) - 0.6 * recent_sends - 3 * mean(predicted level over the next 2 hours)
 */
export function scoreZone(
  zone: ZoneWithEstimate,
  recentSends: number,
  predictedNext2Hours: number
): number {
  const base = (2 - zone.estimate.level) * 10;
  const liveBonus = !zone.estimate.is_predicted ? 2 : 0;
  const sendsPenalty = 0.6 * recentSends;
  const futureBusyPenalty = 3 * predictedNext2Hours;

  return base + liveBonus - sendsPenalty - futureBusyPenalty;
}

/**
 * Format the single friendly reason line:
 * "<status>, and fewer students are heading there." when below candidate average,
 * otherwise just "<status>." (or "Usually <status>" for predictions)
 */
export function formatRecommendationReason(
  zone: ZoneWithEstimate,
  zoneSends: number,
  candidateAvgSends: number
): string {
  const statusWord =
    zone.estimate.level === 0 ? 'Plenty of seats' : zone.estimate.level === 1 ? 'Filling up' : 'Full';

  const prefix = zone.estimate.is_predicted ? `Usually ${statusWord.toLowerCase()}` : statusWord;

  if (zoneSends < candidateAvgSends) {
    return `${prefix}, and fewer students are heading there.`;
  }
  return `${prefix}.`;
}

/**
 * Rank and score all open, non-full, filter-matching candidates
 */
export function getRankedRecommendations(
  zones: ZoneWithEstimate[],
  quietOnly: boolean,
  sendCountsByZoneId: Record<string, number> = {},
  currentHour: number = new Date().getHours()
): RecommendationCandidate[] {
  // Filter candidates: open, match filter, not full (level < 2)
  const candidates = zones.filter((z) => {
    if (z.estimate.is_closed) return false;
    if (z.estimate.level >= 2) return false;
    if (quietOnly && z.noise !== 'silent' && z.noise !== 'quiet') return false;
    return true;
  });

  if (candidates.length === 0) return [];

  // Calculate average sends across candidates
  const totalSends = candidates.reduce((acc, z) => acc + (sendCountsByZoneId[z.id] || 0), 0);
  const avgSends = totalSends / candidates.length;

  const scored: RecommendationCandidate[] = candidates.map((zone) => {
    const recentSends = sendCountsByZoneId[zone.id] || 0;
    const predictedNext2Hours = getPredictedNext2Hours(zone, currentHour);
    const score = scoreZone(zone, recentSends, predictedNext2Hours);
    const reasonText = formatRecommendationReason(zone, recentSends, avgSends);

    return {
      zone,
      score,
      recentSends,
      predictedNext2Hours,
      reasonText,
    };
  });

  // Sort descending by score
  return scored.sort((a, b) => b.score - a.score);
}
