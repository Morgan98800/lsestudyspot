import { describe, it, expect, vi } from 'vitest';
import {
  getPeriod,
  validateNoPeriodOverlaps,
  parseAcademicPeriodsCsv,
  DEFAULT_MULTIPLIERS,
} from '../src/lib/algo/calendar';
import { lookupHourlyPrediction, getDefaultHourlyCurve } from '../src/lib/algo/prediction';
import { AcademicPeriod, HourlyStat, PredictionBucket } from '../src/types/database';
import { SpotsRepository } from '../src/lib/db/repository';

describe('Academic Calendar & getPeriod', () => {
  const samplePeriods: AcademicPeriod[] = [
    {
      id: 'p1',
      academic_year: '2026/27',
      name: 'Michaelmas Term',
      type: 'teaching',
      start_date: '2026-09-28', // Monday
      end_date: '2026-12-11',   // Friday
      notes: 'Autumn term',
    },
    {
      id: 'p2',
      academic_year: '2026/27',
      name: 'Michaelmas Reading Week',
      type: 'reading',
      start_date: '2026-11-02', // Monday of Week 6
      end_date: '2026-11-08',   // Sunday
      notes: 'Week 6 reading week',
    },
    {
      id: 'p3',
      academic_year: '2026/27',
      name: 'Christmas Vacation',
      type: 'vacation',
      start_date: '2026-12-14',
      end_date: '2027-01-15',
      notes: 'Winter break',
    },
    {
      id: 'p4',
      academic_year: '2026/27',
      name: 'Spring Exam Period',
      type: 'exam',
      start_date: '2027-05-03',
      end_date: '2027-06-11',
      notes: 'Main exam period',
    },
  ];

  it('correctly maps the first and last day of a teaching period', () => {
    // First day: 2026-09-28 (Week 1 Monday)
    const firstDay = getPeriod('2026-09-28', samplePeriods);
    expect(firstDay.type).toBe('teaching');
    expect(firstDay.name).toBe('Michaelmas Term');
    expect(firstDay.termWeek).toBe(1);
    expect(firstDay.bucket).toBe('early');

    // Last day: 2026-12-11 (Week 11 Friday)
    const lastDay = getPeriod('2026-12-11', samplePeriods);
    expect(lastDay.type).toBe('teaching');
    expect(lastDay.name).toBe('Michaelmas Term');
    expect(lastDay.termWeek).toBe(11);
    expect(lastDay.bucket).toBe('late');
  });

  it('correctly derives Monday-start 1-based term weeks and buckets', () => {
    // Week 1 (early): 2026-09-30 (Wednesday)
    expect(getPeriod('2026-09-30', samplePeriods).bucket).toBe('early');
    expect(getPeriod('2026-09-30', samplePeriods).termWeek).toBe(1);

    // Week 3 (early): 2026-10-14 (Wednesday)
    expect(getPeriod('2026-10-14', samplePeriods).bucket).toBe('early');
    expect(getPeriod('2026-10-14', samplePeriods).termWeek).toBe(3);

    // Week 4 (mid): 2026-10-21 (Wednesday)
    expect(getPeriod('2026-10-21', samplePeriods).bucket).toBe('mid');
    expect(getPeriod('2026-10-21', samplePeriods).termWeek).toBe(4);

    // Week 7 (mid): 2026-11-11 (Wednesday)
    expect(getPeriod('2026-11-11', samplePeriods).bucket).toBe('mid');
    expect(getPeriod('2026-11-11', samplePeriods).termWeek).toBe(7);

    // Week 8 (late): 2026-11-18 (Wednesday)
    expect(getPeriod('2026-11-18', samplePeriods).bucket).toBe('late');
    expect(getPeriod('2026-11-18', samplePeriods).termWeek).toBe(8);
  });

  it('prioritizes reading, exam, and vacation periods over teaching', () => {
    // Reading week inside Michaelmas: 2026-11-04 (Wednesday)
    const reading = getPeriod('2026-11-04', samplePeriods);
    expect(reading.type).toBe('reading');
    expect(reading.bucket).toBe('reading');
    expect(reading.termWeek).toBeNull();

    // Vacation: 2026-12-25
    const vacation = getPeriod('2026-12-25', samplePeriods);
    expect(vacation.type).toBe('vacation');
    expect(vacation.bucket).toBe('vacation');
    expect(vacation.termWeek).toBeNull();

    // Exam period: 2027-05-15
    const exam = getPeriod('2027-05-15', samplePeriods);
    expect(exam.type).toBe('exam');
    expect(exam.bucket).toBe('exam');
    expect(exam.termWeek).toBeNull();
  });

  it('falls back to teaching (mid) with a logged warning when a date is outside any period', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const outside = getPeriod('2028-01-01', samplePeriods);
    expect(outside.type).toBe('teaching');
    expect(outside.bucket).toBe('mid');
    expect(outside.termWeek).toBe(4);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('does not fall within any defined academic periods')
    );

    consoleSpy.mockRestore();
  });

  it('validates period overlaps and rejects duplicate periods of same type or invalid dates', () => {
    // Overlapping teaching periods
    const invalidTeaching = [
      { academic_year: '2026/27', name: 'Term 1', type: 'teaching' as const, start_date: '2026-09-01', end_date: '2026-10-15' },
      { academic_year: '2026/27', name: 'Term 2', type: 'teaching' as const, start_date: '2026-10-10', end_date: '2026-11-30' },
    ];
    const res1 = validateNoPeriodOverlaps(invalidTeaching);
    expect(res1.isValid).toBe(false);
    expect(res1.error).toContain('Overlap in academic year 2026/27');

    // Invalid start > end
    const invalidDates = [
      { academic_year: '2026/27', name: 'Bad Dates', type: 'teaching' as const, start_date: '2026-12-01', end_date: '2026-10-01' },
    ];
    const res2 = validateNoPeriodOverlaps(invalidDates);
    expect(res2.isValid).toBe(false);
    expect(res2.error).toContain('cannot be after end_date');

    // Reading week inside teaching period is valid
    const validNested = [
      { academic_year: '2026/27', name: 'Term 1', type: 'teaching' as const, start_date: '2026-09-28', end_date: '2026-12-11' },
      { academic_year: '2026/27', name: 'Reading W6', type: 'reading' as const, start_date: '2026-11-02', end_date: '2026-11-08' },
    ];
    expect(validateNoPeriodOverlaps(validNested).isValid).toBe(true);
  });

  it('parses academic periods CSV correctly', () => {
    const csv = `academic_year,name,type,start_date,end_date,notes
2026/27,Michaelmas Term,teaching,2026-09-28,2026-12-11,Autumn
2026/27,Spring Exam,exam,2027-05-03,2027-06-11,Exams`;

    const parsed = parseAcademicPeriodsCsv(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe('Michaelmas Term');
    expect(parsed[0].type).toBe('teaching');
    expect(parsed[1].type).toBe('exam');
  });
});

describe('5-Step Prediction Fallback Chain & Multipliers', () => {
  const zoneId = 'zone_library_f1';

  it('uses Step 1 when zone + bucket + weekday + hour has n_reports >= 5 without multiplier', () => {
    const stats: HourlyStat[] = [
      {
        zone_id: zoneId,
        bucket: 'exam',
        weekday: 3, // Wednesday
        hour: 14,
        avg_level: 1.8,
        n_reports: 6,
      },
    ];

    const res = lookupHourlyPrediction(zoneId, 'exam', 3, 14, stats);
    expect(res.fallbackStep).toBe(1);
    expect(res.avg_level).toBe(1.8);
    expect(res.n_reports).toBe(6);
    expect(res.multiplierApplied).toBe(false);
  });

  it('falls back to Step 2 when step 1 has n < 5 but zone + bucket + hour across weekdays has n >= 5 without multiplier', () => {
    const stats: HourlyStat[] = [
      { zone_id: zoneId, bucket: 'exam', weekday: 1, hour: 14, avg_level: 1.6, n_reports: 3 },
      { zone_id: zoneId, bucket: 'exam', weekday: 2, hour: 14, avg_level: 1.8, n_reports: 3 },
      // Wednesday (weekday 3) has only 1 report
      { zone_id: zoneId, bucket: 'exam', weekday: 3, hour: 14, avg_level: 2.0, n_reports: 1 },
    ];

    const res = lookupHourlyPrediction(zoneId, 'exam', 3, 14, stats);
    expect(res.fallbackStep).toBe(2);
    // Total reports = 7 >= 5
    expect(res.n_reports).toBe(7);
    expect(res.multiplierApplied).toBe(false);
    // Weighted avg: (1.6*3 + 1.8*3 + 2.0*1) / 7 = 12.2 / 7 = 1.74
    expect(res.avg_level).toBe(1.74);
  });

  it('falls back to Step 3 and applies multiplier when step 1 & 2 have n < 5 but zone + weekday + hour has n >= 5', () => {
    // Target is 'exam', which has 0 reports.
    // But other buckets ('mid', 'late') on Wednesday at 14:00 have reports
    const stats: HourlyStat[] = [
      { zone_id: zoneId, bucket: 'mid', weekday: 3, hour: 14, avg_level: 1.0, n_reports: 4 },
      { zone_id: zoneId, bucket: 'late', weekday: 3, hour: 14, avg_level: 1.2, n_reports: 2 },
    ];

    // Multiplier for exam is 1.15
    const multipliers = { ...DEFAULT_MULTIPLIERS, exam: 1.15 };
    const res = lookupHourlyPrediction(zoneId, 'exam', 3, 14, stats, multipliers);

    expect(res.fallbackStep).toBe(3);
    expect(res.n_reports).toBe(6);
    expect(res.multiplierApplied).toBe(true);
    // Base avg: (1.0*4 + 1.2*2) / 6 = 6.4 / 6 = 1.0667
    // Multiplied by 1.15 = 1.23
    expect(res.avg_level).toBe(1.23);
  });

  it('falls back to Step 4 when steps 1-3 have n < 5 but zone + hour has n >= 5', () => {
    // Only reports on other weekdays and other buckets for 14:00
    const stats: HourlyStat[] = [
      { zone_id: zoneId, bucket: 'early', weekday: 1, hour: 14, avg_level: 0.8, n_reports: 5 },
    ];

    const multipliers = { ...DEFAULT_MULTIPLIERS, vacation: 0.6 };
    const res = lookupHourlyPrediction(zoneId, 'vacation', 3, 14, stats, multipliers);

    expect(res.fallbackStep).toBe(4);
    expect(res.n_reports).toBe(5);
    expect(res.multiplierApplied).toBe(true);
    // 0.8 * 0.6 = 0.48
    expect(res.avg_level).toBe(0.48);
  });

  it('falls back to Step 5 (synthetic default curve) and clamps multiplier between 0.0 and 2.0', () => {
    // No stats anywhere for this zone
    const stats: HourlyStat[] = [];

    // Hour 14 synthetic curve is 1.3
    const syntheticBase = getDefaultHourlyCurve(14); // 1.3

    // Test with multiplier 1.15 (exam)
    const resExam = lookupHourlyPrediction(zoneId, 'exam', 3, 14, stats, {
      ...DEFAULT_MULTIPLIERS,
      exam: 1.15,
    });
    expect(resExam.fallbackStep).toBe(5);
    expect(resExam.multiplierApplied).toBe(true);
    expect(resExam.avg_level).toBe(Number((syntheticBase * 1.15).toFixed(2))); // 1.50

    // Test clamping upper bound: multiplier 2.5
    const resHigh = lookupHourlyPrediction(zoneId, 'exam', 3, 14, stats, {
      ...DEFAULT_MULTIPLIERS,
      exam: 2.5,
    });
    expect(resHigh.avg_level).toBe(2.0); // Clamped at 2.0

    // Test clamping lower bound: multiplier -0.5
    const resLow = lookupHourlyPrediction(zoneId, 'vacation', 3, 14, stats, {
      ...DEFAULT_MULTIPLIERS,
      vacation: -0.5,
    });
    expect(resLow.avg_level).toBe(0.0); // Clamped at 0.0
  });

  it('recomputes bucketed hourly stats across academic periods via cron endpoint logic', async () => {
    const zones = await SpotsRepository.getZones(false);
    expect(zones.length).toBeGreaterThan(0);

    const testZoneId = zones[0].id;

    // Insert reports in different buckets
    const testStatExam: HourlyStat = {
      zone_id: testZoneId,
      bucket: 'exam',
      weekday: 3,
      hour: 11,
      avg_level: 1.9,
      n_reports: 8,
    };

    const testStatVacation: HourlyStat = {
      zone_id: testZoneId,
      bucket: 'vacation',
      weekday: 3,
      hour: 11,
      avg_level: 0.3,
      n_reports: 8,
    };

    await SpotsRepository.upsertHourlyStat(testStatExam);
    await SpotsRepository.upsertHourlyStat(testStatVacation);

    const zoneStats = await SpotsRepository.getHourlyStatsForZone(testZoneId);
    const examStat = zoneStats.find((s) => s.bucket === 'exam' && s.weekday === 3 && s.hour === 11);
    const vacStat = zoneStats.find((s) => s.bucket === 'vacation' && s.weekday === 3 && s.hour === 11);

    expect(examStat).toBeDefined();
    expect(examStat?.avg_level).toBe(1.9);

    expect(vacStat).toBeDefined();
    expect(vacStat?.avg_level).toBe(0.3);
  });
});
