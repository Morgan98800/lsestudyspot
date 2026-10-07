import { BusynessLevel, DayHours, HourlyStat, Report, Zone, ZoneEstimate } from '@/types/database';

export const BUCKET_THRESHOLDS = {
  plentyMax: 0.7,
  fillingUpMax: 1.4,
};

export function scoreToBucket(score: number): BusynessLevel {
  if (score < BUCKET_THRESHOLDS.plentyMax) return 0; // Plenty of seats
  if (score < BUCKET_THRESHOLDS.fillingUpMax) return 1; // Filling up
  return 2; // Full
}

/**
 * Exponential decay weight:
 * weight = 0.5 ** (ageMinutes / 20)
 */
export function calculateDecayedWeight(
  reportDate: Date,
  now: Date = new Date(),
  halfLifeMinutes = 20
): number {
  const ageMinutes = Math.max(0, (now.getTime() - reportDate.getTime()) / (60 * 1000));
  return Math.pow(0.5, ageMinutes / halfLifeMinutes);
}

/**
 * Format relative freshness text:
 * "just now", "9 min ago", "1h ago"
 */
export function formatFreshness(reportDate: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - reportDate.getTime();
  const mins = Math.max(0, Math.floor(diffMs / (60 * 1000)));

  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

/**
 * Check if a zone is currently open
 */
export function checkZoneOpen(
  openingHours: Zone['opening_hours'],
  now: Date = new Date()
): { isOpen: boolean; opensAt?: string } {
  if (!openingHours) {
    return { isOpen: true }; // Open by default if unconstrained
  }

  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
  const dayKey = days[now.getDay()];
  const todaySchedule: DayHours | undefined = openingHours[dayKey];

  if (!todaySchedule || todaySchedule.is_closed) {
    // Check next open day
    for (let i = 1; i <= 7; i++) {
      const nextKey = days[(now.getDay() + i) % 7];
      const nextSched = openingHours[nextKey];
      if (nextSched && !nextSched.is_closed) {
        return { isOpen: false, opensAt: nextSched.open };
      }
    }
    return { isOpen: false, opensAt: '08:30' };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [openH, openM] = todaySchedule.open.split(':').map((x) => parseInt(x, 10));
  const [closeH, closeM] = todaySchedule.close.split(':').map((x) => parseInt(x, 10));

  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH === 0 && closeM === 0 ? 24 * 60 : closeH * 60 + closeM;

  if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
    return { isOpen: true };
  }

  if (currentMinutes < openMinutes) {
    return { isOpen: false, opensAt: todaySchedule.open };
  }

  // After closing, look for tomorrow
  const tomorrowKey = days[(now.getDay() + 1) % 7];
  const tomorrowSched = openingHours[tomorrowKey];
  return { isOpen: false, opensAt: tomorrowSched?.open || '08:30' };
}

/**
 * Generate plain-language insight text from hourly_stats:
 * "Usually busiest 12:00 to 17:00. Usually calmer from 18:00."
 */
export function generateInsightText(
  hourlyStats: HourlyStat[],
  currentHour: number = new Date().getHours()
): string {
  if (!hourlyStats || hourlyStats.length === 0) {
    return 'Usually busiest 12:00 to 15:00. Usually calmer from 18:00.';
  }

  // Find busy hours (avg_level >= 1.4)
  const busyHours = hourlyStats
    .filter((s) => s.avg_level >= 1.4 && s.hour >= 8 && s.hour <= 21)
    .map((s) => s.hour)
    .sort((a, b) => a - b);

  let busyPhrase = '';
  if (busyHours.length > 0) {
    const minBusy = busyHours[0];
    const maxBusy = busyHours[busyHours.length - 1];
    if (minBusy === maxBusy) {
      busyPhrase = `Usually busiest around ${String(minBusy).padStart(2, '0')}:00.`;
    } else {
      busyPhrase = `Usually busiest ${String(minBusy).padStart(2, '0')}:00 to ${String(
        maxBusy + 1
      ).padStart(2, '0')}:00.`;
    }
  }

  // Find next calmer hour after currentHour (avg_level < 1.0)
  const calmerAfterNow = hourlyStats.find(
    (s) => s.hour > currentHour && s.hour <= 22 && s.avg_level < 1.0
  );

  let calmerPhrase = '';
  if (calmerAfterNow) {
    calmerPhrase = `Usually calmer from ${String(calmerAfterNow.hour).padStart(2, '0')}:00.`;
  } else {
    calmerPhrase = 'Usually calmer early morning and late evening.';
  }

  return busyPhrase ? `${busyPhrase} ${calmerPhrase}` : calmerPhrase;
}

/**
 * Compute Live Estimate + Prediction for a zone
 */
export function computeZoneEstimate(
  zone: Zone,
  recentReports: Report[],
  hourlyStats: HourlyStat[],
  now: Date = new Date()
): ZoneEstimate {
  const openCheck = checkZoneOpen(zone.opening_hours, now);
  const currentHour = now.getHours();
  const currentWeekday = now.getDay();

  // 14 bars (08:00 to 21:00)
  const hourlyBars = Array.from({ length: 14 }).map((_, idx) => {
    const h = idx + 8;
    // Find stat for today's weekday
    let stat = hourlyStats.find((s) => s.weekday === currentWeekday && s.hour === h);
    // Fall back to weekday-agnostic average if n_reports < 5 or missing
    if (!stat || stat.n_reports < 5) {
      const allForHour = hourlyStats.filter((s) => s.hour === h);
      if (allForHour.length > 0) {
        const sum = allForHour.reduce((acc, curr) => acc + curr.avg_level, 0);
        stat = {
          zone_id: zone.id,
          weekday: currentWeekday,
          hour: h,
          avg_level: Number((sum / allForHour.length).toFixed(2)),
          n_reports: allForHour.reduce((acc, curr) => acc + curr.n_reports, 0),
        };
      }
    }

    const avg = stat ? stat.avg_level : 0.4;
    return {
      hour: h,
      avg_level: avg,
      is_current: h === currentHour,
    };
  });

  const insightText = generateInsightText(hourlyStats, currentHour);

  // Closed space
  if (!openCheck.isOpen) {
    return {
      zone_id: zone.id,
      level: 2, // Full / unavailable
      is_predicted: false,
      is_closed: true,
      closed_reason: openCheck.opensAt ? `opens ${openCheck.opensAt}` : 'closed today',
      updated_at: null,
      freshness_text: openCheck.opensAt ? `opens ${openCheck.opensAt}` : 'closed',
      minutes_ago: null,
      insight_text: insightText,
      hourly_bars: hourlyBars,
    };
  }

  // Filter valid reports in the last 90 minutes
  const cutoff = now.getTime() - 90 * 60 * 1000;
  const validReports = recentReports.filter(
    (r) => !r.is_flagged && new Date(r.created_at).getTime() >= cutoff
  );

  // LIVE ESTIMATE
  if (validReports.length > 0) {
    let totalWeight = 0;
    let weightedSum = 0;

    for (const r of validReports) {
      const rDate = new Date(r.created_at);
      const w = calculateDecayedWeight(rDate, now, 20);
      totalWeight += w;
      weightedSum += w * r.level;
    }

    const score = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const bucket = scoreToBucket(score);

    const latest = validReports[0];
    const latestDate = new Date(latest.created_at);
    const minsAgo = Math.max(0, Math.floor((now.getTime() - latestDate.getTime()) / (60 * 1000)));

    return {
      zone_id: zone.id,
      level: bucket,
      is_predicted: false,
      is_closed: false,
      updated_at: latest.created_at,
      freshness_text: formatFreshness(latestDate, now),
      minutes_ago: minsAgo,
      insight_text: insightText,
      hourly_bars: hourlyBars,
    };
  }

  // PREDICTION FALLBACK (no reports in last 90 minutes)
  const currentBar = hourlyBars.find((b) => b.hour === currentHour);
  const predictedScore = currentBar ? currentBar.avg_level : 0.4;
  const predictedBucket = scoreToBucket(predictedScore);

  return {
    zone_id: zone.id,
    level: predictedBucket,
    is_predicted: true,
    is_closed: false,
    updated_at: null,
    freshness_text: 'Usual level',
    minutes_ago: null,
    insight_text: insightText,
    hourly_bars: hourlyBars,
  };
}
