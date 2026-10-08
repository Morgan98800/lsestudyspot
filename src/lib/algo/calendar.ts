import { DateTime } from 'luxon';
import { AcademicPeriod, AcademicPeriodType, PeriodInfo, PredictionBucket } from '@/types/database';

export const TIME_ZONE = 'Europe/London';

export const DEFAULT_MULTIPLIERS: Record<PredictionBucket, number> = {
  exam: 1.15,
  reading: 1.1,
  vacation: 0.6,
  early: 1.0,
  mid: 1.0,
  late: 1.0,
};

const warnedDates = new Set<string>();

/**
 * Determine the academic period, term week (Monday-start), and bucket for a given date.
 * Evaluated in Europe/London timezone.
 *
 * Specific periods (reading weeks, exam periods, vacations) take precedence over general teaching terms.
 */
export function getPeriod(
  date: Date | DateTime | string = new Date(),
  periods: AcademicPeriod[] = []
): PeriodInfo {
  let dt: DateTime;
  if (date instanceof DateTime) {
    dt = date.setZone(TIME_ZONE);
  } else if (date instanceof Date) {
    dt = DateTime.fromJSDate(date, { zone: 'utc' }).setZone(TIME_ZONE);
  } else if (typeof date === 'string') {
    dt = DateTime.fromISO(date, { zone: 'utc' }).setZone(TIME_ZONE);
  } else {
    dt = DateTime.utc().setZone(TIME_ZONE);
  }

  const dateIso = dt.toISODate(); // "YYYY-MM-DD"
  if (!dateIso) {
    return {
      type: 'teaching',
      name: 'Default Teaching',
      termWeek: 4,
      bucket: 'mid',
    };
  }

  // 1. Check for specific overrides first (reading, exam, vacation)
  const specificPeriod = periods.find(
    (p) => p.type !== 'teaching' && p.start_date <= dateIso && dateIso <= p.end_date
  );

  if (specificPeriod) {
    return {
      type: specificPeriod.type,
      name: specificPeriod.name,
      termWeek: null,
      bucket: specificPeriod.type as PredictionBucket,
    };
  }

  // 2. Check for teaching periods
  const teachingPeriod = periods.find(
    (p) => p.type === 'teaching' && p.start_date <= dateIso && dateIso <= p.end_date
  );

  if (teachingPeriod) {
    // Derive 1-based term week with Monday-start
    const startDt = DateTime.fromISO(teachingPeriod.start_date, { zone: TIME_ZONE });
    const startMonday = startDt.startOf('week');
    const currentMonday = dt.startOf('week');

    const diffWeeks = Math.floor(currentMonday.diff(startMonday, 'weeks').weeks);
    const termWeek = Math.max(1, diffWeeks + 1);

    let bucket: PredictionBucket;
    if (termWeek <= 3) {
      bucket = 'early';
    } else if (termWeek <= 7) {
      bucket = 'mid';
    } else {
      bucket = 'late';
    }

    return {
      type: 'teaching',
      name: teachingPeriod.name,
      termWeek,
      bucket,
    };
  }

  // 3. Fallback: date is in no period (default to teaching with a logged warning)
  if (!warnedDates.has(dateIso)) {
    warnedDates.add(dateIso);
    console.warn(
      `[getPeriod] Date ${dateIso} does not fall within any defined academic periods. Defaulting to teaching (mid).`
    );
  }

  return {
    type: 'teaching',
    name: 'Default Teaching (Outside Calendar)',
    termWeek: 4,
    bucket: 'mid',
  };
}

/**
 * Validate that dates are real and there are no invalid overlapping periods within any academic year:
 * - Two teaching periods must not overlap.
 * - Two non-teaching periods (reading, exam, vacation) must not overlap.
 */
export function validateNoPeriodOverlaps(
  periods: Array<Pick<AcademicPeriod, 'academic_year' | 'start_date' | 'end_date' | 'name' | 'type'>>
): { isValid: boolean; error?: string } {
  const byYear: Record<string, typeof periods> = {};

  for (const p of periods) {
    if (!p.academic_year) continue;

    // Validate real dates
    const start = DateTime.fromISO(p.start_date);
    const end = DateTime.fromISO(p.end_date);
    if (!start.isValid || !end.isValid) {
      return { isValid: false, error: `Invalid date format in period "${p.name}". Dates must be valid YYYY-MM-DD.` };
    }
    if (p.start_date > p.end_date) {
      return { isValid: false, error: `start_date (${p.start_date}) cannot be after end_date (${p.end_date}) in "${p.name}".` };
    }

    if (!byYear[p.academic_year]) byYear[p.academic_year] = [];
    byYear[p.academic_year].push(p);
  }

  for (const [year, yearPeriods] of Object.entries(byYear)) {
    // 1. Check teaching vs teaching overlaps
    const teaching = yearPeriods
      .filter((p) => p.type === 'teaching')
      .sort((a, b) => a.start_date.localeCompare(b.start_date));

    for (let i = 0; i < teaching.length - 1; i++) {
      if (teaching[i].end_date >= teaching[i + 1].start_date) {
        return {
          isValid: false,
          error: `Overlap in academic year ${year}: Teaching period "${teaching[i].name}" (${teaching[i].start_date} to ${teaching[i].end_date}) overlaps with "${teaching[i + 1].name}" (${teaching[i + 1].start_date} to ${teaching[i + 1].end_date})`,
        };
      }
    }

    // 2. Check non-teaching vs non-teaching overlaps (e.g. reading week vs vacation vs exam)
    const nonTeaching = yearPeriods
      .filter((p) => p.type !== 'teaching')
      .sort((a, b) => a.start_date.localeCompare(b.start_date));

    for (let i = 0; i < nonTeaching.length - 1; i++) {
      if (nonTeaching[i].end_date >= nonTeaching[i + 1].start_date) {
        return {
          isValid: false,
          error: `Overlap in academic year ${year}: Specific period "${nonTeaching[i].name}" (${nonTeaching[i].start_date} to ${nonTeaching[i].end_date}) overlaps with "${nonTeaching[i + 1].name}" (${nonTeaching[i + 1].start_date} to ${nonTeaching[i + 1].end_date})`,
        };
      }
    }
  }

  return { isValid: true };
}

/**
 * Parse a CSV string containing academic periods:
 * Columns: academic_year,name,type,start_date,end_date,notes
 */
export function parseAcademicPeriodsCsv(csvText: string): AcademicPeriod[] {
  const lines = csvText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length <= 1) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const yearIdx = headers.indexOf('academic_year');
  const nameIdx = headers.indexOf('name');
  const typeIdx = headers.indexOf('type');
  const startIdx = headers.indexOf('start_date');
  const endIdx = headers.indexOf('end_date');
  const notesIdx = headers.indexOf('notes');

  const result: AcademicPeriod[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const tokens: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        tokens.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    tokens.push(cur.trim());

    const year = tokens[yearIdx] || '';
    const name = tokens[nameIdx] || '';
    const type = (tokens[typeIdx] || 'teaching').toLowerCase() as AcademicPeriodType;
    const startDate = tokens[startIdx] || '';
    const endDate = tokens[endIdx] || '';
    const notes = notesIdx >= 0 ? tokens[notesIdx] : '';

    if (year && name && startDate && endDate) {
      result.push({
        id: `period_${year.replace(/\//g, '_')}_${result.length + 1}`,
        academic_year: year,
        name,
        type,
        start_date: startDate,
        end_date: endDate,
        notes,
      });
    }
  }

  return result;
}
