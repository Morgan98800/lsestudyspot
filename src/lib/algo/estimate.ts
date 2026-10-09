import {
  AcademicPeriod,
  BusynessLevel,
  HourlyStat,
  OpeningException,
  PredictionBucket,
  Report,
  Zone,
  ZoneEstimate,
} from '@/types/database';
import { getOpenState, timeToMinutes } from './opening-hours';
import { DEFAULT_MULTIPLIERS, getPeriod } from './calendar';
import { lookupHourlyPrediction } from './prediction';

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

export interface LondonDateTime {
  weekdayKey: 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
  weekdayIndex: number;
  hour: number;
  minute: number;
  minutesSinceMidnight: number;
  formattedTime: string;
}

/**
 * Compute current time in Europe/London timezone (BST / GMT aware)
 */
export function getLondonTime(date: Date = new Date()): LondonDateTime {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  let weekdayStr = '';
  let hour = 0;
  let minute = 0;

  for (const part of parts) {
    if (part.type === 'weekday') weekdayStr = part.value.toLowerCase().slice(0, 3);
    if (part.type === 'hour') hour = parseInt(part.value, 10);
    if (part.type === 'minute') minute = parseInt(part.value, 10);
  }

  const days: Array<'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'> = [
    'sun',
    'mon',
    'tue',
    'wed',
    'thu',
    'fri',
    'sat',
  ];

  const idx = days.indexOf(weekdayStr as typeof days[number]);
  const weekdayIndex = idx >= 0 ? idx : 1;
  const weekdayKey = days[weekdayIndex] || 'mon';
  const minutesSinceMidnight = hour * 60 + minute;
  const formattedTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return {
    weekdayKey,
    weekdayIndex,
    hour,
    minute,
    minutesSinceMidnight,
    formattedTime,
  };
}

/**
 * Check if a zone is currently open, evaluated in Europe/London timezone
 */
export function checkZoneOpen(
  openingHours: Zone['opening_hours'],
  now: Date = new Date(),
  exceptions: OpeningException[] = []
): { isOpen: boolean; opensAt?: string; reason?: string } {
  const state = getOpenState({ id: 'zone', opening_hours: openingHours }, exceptions, now);
  if (state.isOpen) {
    return { isOpen: true };
  }

  let opensAt = '08:00';
  if (state.nextOpenAt) {
    opensAt = state.nextOpenAt.day === 'today'
      ? state.nextOpenAt.time
      : `${state.nextOpenAt.day} ${state.nextOpenAt.time}`;
  }

  return {
    isOpen: false,
    opensAt,
    reason: state.reason,
  };
}

/**
 * Generate plain-language insight text from hourly_stats:
 * "Usually busiest 12:00 to 17:00. Usually calmer from 18:00."
 */
export function generateInsightText(
  hourlyStats: HourlyStat[],
  currentHour: number = getLondonTime().hour
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
  now: Date = new Date(),
  exceptions: OpeningException[] = [],
  periods: AcademicPeriod[] = [],
  multipliers: Record<PredictionBucket, number> = DEFAULT_MULTIPLIERS
): ZoneEstimate {
  const london = getLondonTime(now);
  const openState = getOpenState(zone, exceptions, now);
  const currentHour = london.hour;
  const currentWeekday = london.weekdayIndex;

  const periodInfo = getPeriod(now, periods);
  const currentBucket = periodInfo.bucket;
  const isExamPeriod = currentBucket === 'exam';

  // 14 bars (08:00 to 21:00) using 5-step fallback chain
  const hourlyBars = Array.from({ length: 14 }).map((_, idx) => {
    const h = idx + 8;
    const pred = lookupHourlyPrediction(
      zone.id,
      currentBucket,
      currentWeekday,
      h,
      hourlyStats,
      multipliers
    );
    return {
      hour: h,
      avg_level: pred.avg_level,
      is_current: h === currentHour,
    };
  });

  // Filter stats for current bucket to generate insight text
  const bucketStats = hourlyStats.filter(
    (s) => s.zone_id === zone.id && (s.bucket === currentBucket || !s.bucket)
  );
  const insightText = generateInsightText(
    bucketStats.length > 0 ? bucketStats : hourlyStats,
    currentHour
  );

  // Closed space
  if (!openState.isOpen) {
    let closedReason = 'closed';
    let freshnessText = 'Closed';
    if (openState.nextOpenAt) {
      const dayPart = openState.nextOpenAt.day === 'today' ? '' : `${openState.nextOpenAt.day} `;
      closedReason = `opens ${dayPart}${openState.nextOpenAt.time}`;
      freshnessText = `Closed, opens ${dayPart}${openState.nextOpenAt.time}`;
    }
    if (openState.reason) {
      closedReason += ` — ${openState.reason}`;
    }

    return {
      zone_id: zone.id,
      level: 2, // Full / unavailable
      is_predicted: false,
      is_closed: true,
      closed_reason: closedReason,
      closes_at: null,
      closes_soon: false,
      is_exam_period: isExamPeriod,
      updated_at: null,
      freshness_text: freshnessText,
      minutes_ago: null,
      insight_text: insightText,
      hourly_bars: hourlyBars,
    };
  }

  // Calculate if space closes within 60 minutes
  let closesSoon = false;
  if (openState.closesAt) {
    const currentM = london.minutesSinceMidnight;
    const closeM = timeToMinutes(openState.closesAt);
    let minsUntilClose = closeM - currentM;
    if (minsUntilClose < 0) {
      minsUntilClose += 1440; // overnight interval crossing midnight
    }
    if (minsUntilClose > 0 && minsUntilClose <= 60) {
      closesSoon = true;
    }
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
      closes_at: openState.closesAt,
      closes_soon: closesSoon,
      is_exam_period: isExamPeriod,
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
    closes_at: openState.closesAt,
    closes_soon: closesSoon,
    is_exam_period: isExamPeriod,
    updated_at: null,
    freshness_text: 'Usual level',
    minutes_ago: null,
    insight_text: insightText,
    hourly_bars: hourlyBars,
  };
}
