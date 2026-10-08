import { HourlyStat, PredictionBucket } from '@/types/database';
import { DEFAULT_MULTIPLIERS } from './calendar';

export interface PredictionResult {
  avg_level: number;
  n_reports: number;
  fallbackStep: 1 | 2 | 3 | 4 | 5;
  multiplierApplied: boolean;
}

/**
 * Synthetic default curve for zones when no report data exists anywhere.
 * Realistic bell curve for student library occupancy peaking in afternoon.
 */
export function getDefaultHourlyCurve(hour: number): number {
  if (hour < 8) return 0.1;
  if (hour <= 10) return 0.4;
  if (hour <= 12) return 0.8;
  if (hour <= 16) return 1.3;
  if (hour <= 18) return 1.1;
  if (hour <= 20) return 0.7;
  if (hour <= 22) return 0.4;
  return 0.2;
}

/**
 * 5-Step Prediction Fallback Chain:
 * Requires n_reports >= 5 at each step.
 *
 * 1. zone + bucket + weekday + hour
 * 2. zone + bucket + hour (all weekdays)
 * 3. zone + weekday + hour (all buckets) + multiplier
 * 4. zone + hour (all weekdays & buckets) + multiplier
 * 5. zone-type default synthetic curve + multiplier
 *
 * Multiplier applies only when falling back from a bucket with no data (steps 3-5),
 * and is always clamped to [0.0, 2.0].
 */
export function lookupHourlyPrediction(
  zoneId: string,
  targetBucket: PredictionBucket,
  weekday: number,
  hour: number,
  allStats: HourlyStat[],
  multipliers: Record<PredictionBucket, number> = DEFAULT_MULTIPLIERS
): PredictionResult {
  // Step 1: zone + bucket + weekday + hour
  const step1Stat = allStats.find(
    (s) =>
      s.zone_id === zoneId &&
      s.bucket === targetBucket &&
      s.weekday === weekday &&
      s.hour === hour
  );

  if (step1Stat && step1Stat.n_reports >= 5) {
    return {
      avg_level: step1Stat.avg_level,
      n_reports: step1Stat.n_reports,
      fallbackStep: 1,
      multiplierApplied: false,
    };
  }

  // Step 2: zone + bucket + hour (all weekdays)
  const step2Stats = allStats.filter(
    (s) => s.zone_id === zoneId && s.bucket === targetBucket && s.hour === hour
  );
  const step2Reports = step2Stats.reduce((sum, s) => sum + s.n_reports, 0);

  if (step2Reports >= 5) {
    const weightedSum = step2Stats.reduce((sum, s) => sum + s.avg_level * s.n_reports, 0);
    const avg = Number((weightedSum / step2Reports).toFixed(2));
    return {
      avg_level: avg,
      n_reports: step2Reports,
      fallbackStep: 2,
      multiplierApplied: false,
    };
  }

  // Steps 3-5: Falling back from a bucket with no data -> apply multiplier
  const multiplier = multipliers[targetBucket] ?? 1.0;
  const applyMultiplier = (base: number): number => {
    return Math.min(2.0, Math.max(0.0, Number((base * multiplier).toFixed(2))));
  };

  // Step 3: zone + weekday + hour (all buckets)
  const step3Stats = allStats.filter(
    (s) => s.zone_id === zoneId && s.weekday === weekday && s.hour === hour
  );
  const step3Reports = step3Stats.reduce((sum, s) => sum + s.n_reports, 0);

  if (step3Reports >= 5) {
    const weightedSum = step3Stats.reduce((sum, s) => sum + s.avg_level * s.n_reports, 0);
    const baseAvg = weightedSum / step3Reports;
    return {
      avg_level: applyMultiplier(baseAvg),
      n_reports: step3Reports,
      fallbackStep: 3,
      multiplierApplied: true,
    };
  }

  // Step 4: zone + hour (all weekdays and buckets)
  const step4Stats = allStats.filter((s) => s.zone_id === zoneId && s.hour === hour);
  const step4Reports = step4Stats.reduce((sum, s) => sum + s.n_reports, 0);

  if (step4Reports >= 5) {
    const weightedSum = step4Stats.reduce((sum, s) => sum + s.avg_level * s.n_reports, 0);
    const baseAvg = weightedSum / step4Reports;
    return {
      avg_level: applyMultiplier(baseAvg),
      n_reports: step4Reports,
      fallbackStep: 4,
      multiplierApplied: true,
    };
  }

  // Step 5: Zone-type default synthetic curve
  const defaultBase = getDefaultHourlyCurve(hour);
  return {
    avg_level: applyMultiplier(defaultBase),
    n_reports: 0,
    fallbackStep: 5,
    multiplierApplied: true,
  };
}
