import { DateTime } from 'luxon';
import { z } from 'zod';

export const TIME_ZONE = 'Europe/London';

export interface TimeInterval {
  open: string;  // "HH:MM", e.g. "08:00" or "00:00"
  close: string; // "HH:MM", e.g. "22:00", "24:00", or "02:00" (if overnight)
}

export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const WEEKDAYS: WeekdayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export type WeekdayIntervals = {
  [K in WeekdayKey]?: TimeInterval[];
};

export interface OpeningException {
  id: string;
  zone_id: string | null;     // null = applies to all zones
  start_date: string;         // "YYYY-MM-DD" in London time
  end_date: string;           // "YYYY-MM-DD" in London time (inclusive)
  is_closed: boolean;
  open_time: string | null;   // "HH:MM" override
  close_time: string | null;  // "HH:MM" override
  reason: string;
  created_at?: string;
  updated_at?: string;
}

export interface OpenState {
  isOpen: boolean;
  closesAt: string | null; // "HH:MM" when open, or null for 24h
  nextOpenAt: {
    day: 'today' | 'tomorrow' | string; // e.g. "Friday"
    time: string; // "HH:MM"
  } | null;
  reason?: string;
}

// -----------------------------------------------------------------------------
// Zod Validation for Write Operations
// -----------------------------------------------------------------------------

const timeRegex = /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/;

export const timeIntervalSchema = z
  .object({
    open: z.string().regex(timeRegex, 'Open time must be in HH:MM format (00:00 - 24:00)'),
    close: z.string().regex(timeRegex, 'Close time must be in HH:MM format (00:00 - 24:00)'),
  })
  .refine(
    (val) => val.open !== val.close,
    { message: 'Interval open and close time cannot be identical' }
  );

export function timeToMinutes(timeStr: string): number {
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const weekdayIntervalsSchema = z
  .object({
    mon: z.array(timeIntervalSchema).optional(),
    tue: z.array(timeIntervalSchema).optional(),
    wed: z.array(timeIntervalSchema).optional(),
    thu: z.array(timeIntervalSchema).optional(),
    fri: z.array(timeIntervalSchema).optional(),
    sat: z.array(timeIntervalSchema).optional(),
    sun: z.array(timeIntervalSchema).optional(),
  })
  .refine(
    (schedule) => {
      // Validate non-overlapping intervals within each day
      for (const [, intervals] of Object.entries(schedule)) {
        if (!intervals || intervals.length <= 1) continue;

        // Convert intervals to ranges for overlap checking
        // Standard interval: [open, close]
        // Overnight interval (close < open): [open, 1440]
        const sorted = [...intervals].sort((a, b) => timeToMinutes(a.open) - timeToMinutes(b.open));

        for (let i = 0; i < sorted.length - 1; i++) {
          const current = sorted[i];
          const next = sorted[i + 1];

          const curOpen = timeToMinutes(current.open);
          const curClose = timeToMinutes(current.close);
          const nextOpen = timeToMinutes(next.open);

          // If current is overnight, it runs until midnight (1440) on that day
          const curEnd = curClose < curOpen ? 1440 : curClose;

          if (curEnd > nextOpen) {
            return false; // Overlap detected
          }
        }
      }
      return true;
    },
    { message: 'Intervals must not overlap on any given day' }
  );

// -----------------------------------------------------------------------------
// Normalization of Legacy or Unknown Hours
// -----------------------------------------------------------------------------

export function normalizeDayIntervals(raw: unknown): TimeInterval[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((item): item is TimeInterval => Boolean(item?.open && item?.close));
  }
  // Legacy object format: { open: "08:30", close: "00:00", is_closed?: boolean }
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (obj.is_closed) return [];
    if (typeof obj.open === 'string' && typeof obj.close === 'string') {
      // In legacy format, close: '00:00' meant end of day (24:00)
      const close = obj.close === '00:00' ? '24:00' : obj.close;
      return [{ open: obj.open, close }];
    }
  }
  return [];
}

/**
 * Maps Luxon 1-based ISO weekday (1=Mon, 7=Sun) to WeekdayKey
 */
export function getWeekdayKey(dt: DateTime): WeekdayKey {
  return WEEKDAYS[dt.weekday - 1];
}

/**
 * Get effective intervals for a zone on a specific London date, accounting for exceptions.
 */
export function getEffectiveIntervalsForDate(
  zoneId: string,
  openingHours: WeekdayIntervals | Record<string, unknown> | null | undefined,
  exceptions: OpeningException[],
  londonDate: DateTime
): { intervals: TimeInterval[]; reason?: string } {
  // If opening_hours is null/undefined: unknown hours, always open
  if (openingHours === null || openingHours === undefined) {
    return { intervals: [{ open: '00:00', close: '24:00' }] };
  }

  const dateIso = londonDate.toISODate(); // "YYYY-MM-DD"
  if (!dateIso) {
    return { intervals: [] };
  }

  // 1. Check for matching exceptions on this date
  // Specific zone exception takes precedence over global (zone_id === null)
  const matchingExceptions = exceptions.filter(
    (e) =>
      (e.zone_id === zoneId || e.zone_id === null) &&
      e.start_date <= dateIso &&
      dateIso <= e.end_date
  );

  matchingExceptions.sort((a, b) => {
    // Specific zone exception first
    if (a.zone_id === zoneId && b.zone_id !== zoneId) return -1;
    if (b.zone_id === zoneId && a.zone_id !== zoneId) return 1;
    return 0;
  });

  const activeException = matchingExceptions[0];

  if (activeException) {
    if (activeException.is_closed) {
      return { intervals: [], reason: activeException.reason };
    }
    if (activeException.open_time && activeException.close_time) {
      return {
        intervals: [{ open: activeException.open_time, close: activeException.close_time }],
        reason: activeException.reason,
      };
    }
    // If exception specifies neither closed nor override hours, reason applies to regular hours
  }

  // 2. Regular weekly intervals
  const weekdayKey = getWeekdayKey(londonDate);
  const rawDay = (openingHours as Record<string, unknown>)[weekdayKey];
  const intervals = normalizeDayIntervals(rawDay);

  return {
    intervals,
    reason: activeException?.reason,
  };
}

// -----------------------------------------------------------------------------
// Pure, Server-Side getOpenState
// -----------------------------------------------------------------------------

/**
 * Determine if a zone is currently open, when it closes, and when it next opens.
 *
 * All decisions are evaluated in the Europe/London timezone.
 * Pure function: no side effects, deterministic given inputs.
 */
export function getOpenState(
  zone: { id: string; opening_hours: WeekdayIntervals | Record<string, unknown> | null | undefined },
  exceptions: OpeningException[] = [],
  nowUtc: Date | DateTime | string = new Date()
): OpenState {
  // If opening_hours is null/undefined: "hours unknown", treat as open, never show as closed
  if (zone.opening_hours === null || zone.opening_hours === undefined) {
    return {
      isOpen: true,
      closesAt: null,
      nextOpenAt: null,
    };
  }

  // Convert nowUtc to Luxon DateTime in Europe/London timezone
  let londonNow: DateTime;
  if (nowUtc instanceof DateTime) {
    londonNow = nowUtc.setZone(TIME_ZONE);
  } else if (nowUtc instanceof Date) {
    londonNow = DateTime.fromJSDate(nowUtc, { zone: 'utc' }).setZone(TIME_ZONE);
  } else if (typeof nowUtc === 'string') {
    londonNow = DateTime.fromISO(nowUtc, { zone: 'utc' }).setZone(TIME_ZONE);
  } else {
    londonNow = DateTime.utc().setZone(TIME_ZONE);
  }

  const currentMinutes = londonNow.hour * 60 + londonNow.minute;

  // 1. Check yesterday's intervals for overnight spills into today
  const yesterday = londonNow.minus({ days: 1 });
  const yesterdaySchedule = getEffectiveIntervalsForDate(zone.id, zone.opening_hours, exceptions, yesterday);

  for (const interval of yesterdaySchedule.intervals) {
    const openM = timeToMinutes(interval.open);
    const closeM = timeToMinutes(interval.close);
    // Overnight: close < open means it runs until `close` the next day (today)
    if (closeM < openM) {
      if (currentMinutes < closeM) {
        return {
          isOpen: true,
          closesAt: interval.close,
          nextOpenAt: null,
          reason: yesterdaySchedule.reason,
        };
      }
    }
  }

  // 2. Check today's intervals
  const todaySchedule = getEffectiveIntervalsForDate(zone.id, zone.opening_hours, exceptions, londonNow);
  const todayIntervals = todaySchedule.intervals;

  // Check if current time falls within any of today's intervals
  for (const interval of todayIntervals) {
    const openM = timeToMinutes(interval.open);
    const closeM = timeToMinutes(interval.close);

    // 24-hour interval: 00:00 to 24:00
    if (openM === 0 && closeM === 1440) {
      // Check if tomorrow also opens at 00:00 (continuous 24h)
      const tomorrow = londonNow.plus({ days: 1 });
      const tomorrowSched = getEffectiveIntervalsForDate(zone.id, zone.opening_hours, exceptions, tomorrow);
      const isTomorrowContinuous = tomorrowSched.intervals.some((i) => timeToMinutes(i.open) === 0);

      return {
        isOpen: true,
        closesAt: isTomorrowContinuous ? null : '24:00',
        nextOpenAt: null,
        reason: todaySchedule.reason,
      };
    }

    // Overnight interval starting today: open <= current < midnight
    if (closeM < openM) {
      if (currentMinutes >= openM) {
        return {
          isOpen: true,
          closesAt: interval.close, // closes tomorrow morning at `interval.close`
          nextOpenAt: null,
          reason: todaySchedule.reason,
        };
      }
    } else {
      // Standard interval: open <= current < close
      if (currentMinutes >= openM && currentMinutes < closeM) {
        return {
          isOpen: true,
          closesAt: interval.close === '24:00' ? '24:00' : interval.close,
          nextOpenAt: null,
          reason: todaySchedule.reason,
        };
      }
    }
  }

  // 3. Zone is CLOSED right now. Compute `nextOpenAt`.

  // Check remaining intervals today
  const laterToday = todayIntervals
    .filter((i) => timeToMinutes(i.open) > currentMinutes)
    .sort((a, b) => timeToMinutes(a.open) - timeToMinutes(b.open));

  if (laterToday.length > 0) {
    return {
      isOpen: false,
      closesAt: null,
      nextOpenAt: {
        day: 'today',
        time: laterToday[0].open,
      },
      reason: todaySchedule.reason,
    };
  }

  // Check tomorrow
  const tomorrow = londonNow.plus({ days: 1 });
  const tomorrowSchedule = getEffectiveIntervalsForDate(zone.id, zone.opening_hours, exceptions, tomorrow);
  if (tomorrowSchedule.intervals.length > 0) {
    const sortedTomorrow = [...tomorrowSchedule.intervals].sort(
      (a, b) => timeToMinutes(a.open) - timeToMinutes(b.open)
    );
    return {
      isOpen: false,
      closesAt: null,
      nextOpenAt: {
        day: 'tomorrow',
        time: sortedTomorrow[0].open,
      },
      reason: todaySchedule.reason,
    };
  }

  // Check next 2 to 7 days
  for (let i = 2; i <= 7; i++) {
    const nextDay = londonNow.plus({ days: i });
    const nextDaySchedule = getEffectiveIntervalsForDate(zone.id, zone.opening_hours, exceptions, nextDay);
    if (nextDaySchedule.intervals.length > 0) {
      const sortedNextDay = [...nextDaySchedule.intervals].sort(
        (a, b) => timeToMinutes(a.open) - timeToMinutes(b.open)
      );
      const weekdayName = nextDay.toFormat('cccc'); // "Monday", "Tuesday", etc.
      return {
        isOpen: false,
        closesAt: null,
        nextOpenAt: {
          day: weekdayName,
          time: sortedNextDay[0].open,
        },
        reason: todaySchedule.reason,
      };
    }
  }

  return {
    isOpen: false,
    closesAt: null,
    nextOpenAt: null,
    reason: todaySchedule.reason,
  };
}
