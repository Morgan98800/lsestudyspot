import {
  AcademicPeriod,
  Feedback,
  FeedbackKind,
  FeedbackStatus,
  HourlyStat,
  OpeningException,
  PredictionBucket,
  Report,
  WeekdayIntervals,
  Zone,
} from '@/types/database';
import { weekdayIntervalsSchema } from '../algo/opening-hours';
import { DEFAULT_MULTIPLIERS, getPeriod } from '../algo/calendar';
import { STARTER_ZONES } from '../data/starter-zones';
import { generateSeedReports } from '../data/seed-reports';
import { isSupabaseConfigured, supabase } from './supabase';

export interface RecommendationEvent {
  id: string;
  zone_id: string;
  created_at: string;
  device_hash: string;
}

interface InMemoryStore {
  zones: Zone[];
  reports: Report[];
  hourlyStats: HourlyStat[];
  recommendationEvents: RecommendationEvent[];
  openingExceptions: OpeningException[];
  academicPeriods: AcademicPeriod[];
  bucketMultipliers: Record<PredictionBucket, number>;
  feedbacks: Feedback[];
}

declare global {
  // eslint-disable-next-line no-var
  var __lseSpotsSimpleStore: InMemoryStore | undefined;
}

const DEFAULT_SAMPLE_PERIODS: AcademicPeriod[] = [
  {
    id: 'period_2026_27_1',
    academic_year: '2026/27',
    name: 'Michaelmas Term',
    type: 'teaching',
    start_date: '2026-09-28',
    end_date: '2026-12-11',
    notes: 'TODO_VERIFY: Sample dates - verify against official LSE 2026/27 term calendar',
  },
  {
    id: 'period_2026_27_2',
    academic_year: '2026/27',
    name: 'Reading Week (Michaelmas)',
    type: 'reading',
    start_date: '2026-11-02',
    end_date: '2026-11-06',
    notes: 'TODO_VERIFY: Week 6 reading week',
  },
  {
    id: 'period_2026_27_3',
    academic_year: '2026/27',
    name: 'Christmas Vacation',
    type: 'vacation',
    start_date: '2026-12-12',
    end_date: '2027-01-17',
    notes: 'TODO_VERIFY: Winter university closure and break',
  },
  {
    id: 'period_2026_27_4',
    academic_year: '2026/27',
    name: 'Lent Term',
    type: 'teaching',
    start_date: '2027-01-18',
    end_date: '2027-04-02',
    notes: 'TODO_VERIFY: Lent term teaching period',
  },
  {
    id: 'period_2026_27_5',
    academic_year: '2026/27',
    name: 'Spring Vacation',
    type: 'vacation',
    start_date: '2027-04-03',
    end_date: '2027-05-02',
    notes: 'TODO_VERIFY: Spring Easter break',
  },
  {
    id: 'period_2026_27_6',
    academic_year: '2026/27',
    name: 'Spring Exam Period',
    type: 'exam',
    start_date: '2027-05-03',
    end_date: '2027-06-18',
    notes: 'TODO_VERIFY: Main university examination period',
  },
];

function computeHourlyStats(
  reports: Report[],
  periods: AcademicPeriod[] = DEFAULT_SAMPLE_PERIODS
): HourlyStat[] {
  const map: Record<string, { sum: number; count: number }> = {};

  for (const r of reports) {
    if (r.is_flagged) continue;
    const d = new Date(r.created_at);
    const w = d.getDay();
    const h = d.getHours();
    const periodInfo = getPeriod(d, periods);
    const bucket = periodInfo.bucket;
    const key = `${r.zone_id}_${bucket}_${w}_${h}`;
    if (!map[key]) map[key] = { sum: 0, count: 0 };
    map[key].sum += r.level;
    map[key].count += 1;
  }

  const result: HourlyStat[] = [];
  for (const [key, data] of Object.entries(map)) {
    const [zone_id, bucketStr, wStr, hStr] = key.split('_');
    result.push({
      zone_id,
      bucket: bucketStr as PredictionBucket,
      weekday: parseInt(wStr, 10),
      hour: parseInt(hStr, 10),
      avg_level: Number((data.sum / data.count).toFixed(2)),
      n_reports: data.count,
      updated_at: new Date().toISOString(),
    });
  }
  return result;
}

function initializeStore(): InMemoryStore {
  if (global.__lseSpotsSimpleStore) {
    return global.__lseSpotsSimpleStore;
  }

  const zones = JSON.parse(JSON.stringify(STARTER_ZONES)) as Zone[];
  const reports = generateSeedReports(new Date());
  const academicPeriods = [...DEFAULT_SAMPLE_PERIODS];
  const hourlyStats = computeHourlyStats(reports, academicPeriods);

  const store: InMemoryStore = {
    zones,
    reports,
    hourlyStats,
    recommendationEvents: [],
    openingExceptions: [],
    academicPeriods,
    bucketMultipliers: { ...DEFAULT_MULTIPLIERS },
    feedbacks: [],
  };
  global.__lseSpotsSimpleStore = store;
  return store;
}

export class SpotsRepository {
  private static store = initializeStore();

  static async getZones(filterActive = true): Promise<Zone[]> {
    if (isSupabaseConfigured && supabase) {
      let query = supabase.from('zones').select('*');
      if (filterActive) query = query.eq('is_active', true);
      const { data, error } = await query;
      if (!error && data) return data as Zone[];
    }
    return filterActive
      ? this.store.zones.filter((z) => z.is_active)
      : this.store.zones;
  }

  static async getZoneBySlug(slug: string): Promise<Zone | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('zones')
        .select('*')
        .eq('slug', slug)
        .single();
      if (!error && data) return data as Zone;
    }
    return this.store.zones.find((z) => z.slug === slug) || null;
  }

  static async getZoneById(id: string): Promise<Zone | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('zones')
        .select('*')
        .eq('id', id)
        .single();
      if (!error && data) return data as Zone;
    }
    return this.store.zones.find((z) => z.id === id) || null;
  }

  static async getRecentReports(zoneId: string, minutes = 90): Promise<Report[]> {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('zone_id', zoneId)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false });
      if (!error && data) return data as Report[];
    }
    return this.store.reports
      .filter((r) => r.zone_id === zoneId && r.created_at >= cutoff && !r.is_flagged)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  static async getAllRecentReports(minutes = 90): Promise<Report[]> {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false });
      if (!error && data) return data as Report[];
    }
    return this.store.reports
      .filter((r) => r.created_at >= cutoff && !r.is_flagged)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  static async getHourlyStatsForZone(zoneId: string): Promise<HourlyStat[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('hourly_stats')
        .select('*')
        .eq('zone_id', zoneId);
      if (!error && data) return data as HourlyStat[];
    }
    return this.store.hourlyStats.filter((s) => s.zone_id === zoneId);
  }

  static async upsertHourlyStat(stat: HourlyStat): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      await supabase.from('hourly_stats').upsert(stat);
    }
    const idx = this.store.hourlyStats.findIndex(
      (s) =>
        s.zone_id === stat.zone_id &&
        s.bucket === stat.bucket &&
        s.weekday === stat.weekday &&
        s.hour === stat.hour
    );
    if (idx >= 0) {
      this.store.hourlyStats[idx] = stat;
    } else {
      this.store.hourlyStats.push(stat);
    }
  }

  static async createReport(reportData: Omit<Report, 'id' | 'created_at'>): Promise<Report> {
    const newReport: Report = {
      ...reportData,
      id: `rep-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('reports')
        .insert([newReport])
        .select()
        .single();
      if (!error && data) return data as Report;
    }

    this.store.reports.unshift(newReport);
    return newReport;
  }

  static async replaceLatestReportFromDevice(
    zoneId: string,
    deviceHash: string,
    newLevel: 0 | 1 | 2
  ): Promise<Report> {
    // Find previous report from this device
    const existing = this.store.reports.find(
      (r) => r.zone_id === zoneId && r.device_hash === deviceHash
    );

    if (existing) {
      existing.level = newLevel;
      existing.created_at = new Date().toISOString();
      return existing;
    }

    return this.createReport({
      zone_id: zoneId,
      level: newLevel,
      device_hash: deviceHash,
      is_flagged: false,
    });
  }

  static async rotateZoneToken(zoneId: string): Promise<string> {
    const newToken = `qr_tok_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const zone = this.store.zones.find((z) => z.id === zoneId);
    if (zone) {
      zone.qr_token = newToken;
    }
    if (isSupabaseConfigured && supabase) {
      await supabase
        .from('zones')
        .update({ qr_token: newToken, updated_at: new Date().toISOString() })
        .eq('id', zoneId);
    }
    return newToken;
  }

  static async toggleZoneActive(zoneId: string, isActive: boolean): Promise<boolean> {
    const zone = this.store.zones.find((z) => z.id === zoneId);
    if (zone) {
      zone.is_active = isActive;
    }
    if (isSupabaseConfigured && supabase) {
      await supabase
        .from('zones')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', zoneId);
    }
    return true;
  }

  static async resetToSeed(clearFakeReports = false): Promise<void> {
    this.store.zones = JSON.parse(JSON.stringify(STARTER_ZONES));
    if (clearFakeReports) {
      this.store.reports = [];
      this.store.hourlyStats = [];
    } else {
      this.store.reports = generateSeedReports(new Date());
      this.store.hourlyStats = computeHourlyStats(this.store.reports, this.store.academicPeriods);
    }
  }

  static async getReportVolumePerZone(): Promise<Record<string, number>> {
    const volume: Record<string, number> = {};
    for (const r of this.store.reports) {
      volume[r.zone_id] = (volume[r.zone_id] || 0) + 1;
    }
    return volume;
  }

  static async recordRecommendationSend(zoneId: string, deviceHash: string): Promise<void> {
    const event: RecommendationEvent = {
      id: 'rec_' + Math.random().toString(36).substring(2, 11),
      zone_id: zoneId,
      created_at: new Date().toISOString(),
      device_hash: deviceHash,
    };

    if (!this.store.recommendationEvents) {
      this.store.recommendationEvents = [];
    }
    this.store.recommendationEvents.push(event);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('recommendation_events').insert(event);
      } catch (err) {
        console.error('Failed to log recommendation event to supabase:', err);
      }
    }
  }

  static async getRecentRecommendationSends(cutoffMinutes = 15): Promise<Record<string, number>> {
    const now = Date.now();
    const cutoffTime = now - cutoffMinutes * 60 * 1000;
    const result: Record<string, number> = {};

    const events = this.store.recommendationEvents || [];
    for (const e of events) {
      const eventTime = new Date(e.created_at).getTime();
      if (eventTime >= cutoffTime) {
        const ageMinutes = Math.max(0, (now - eventTime) / (60 * 1000));
        // Exponential decay with 15 min half-life
        const weight = Math.pow(0.5, ageMinutes / 15);
        result[e.zone_id] = (result[e.zone_id] || 0) + weight;
      }
    }

    return result;
  }

  static async getOpeningExceptions(zoneId?: string): Promise<OpeningException[]> {
    if (isSupabaseConfigured && supabase) {
      let query = supabase.from('opening_exceptions').select('*');
      if (zoneId) {
        query = query.or(`zone_id.is.null,zone_id.eq.${zoneId}`);
      }
      const { data, error } = await query;
      if (!error && data) return data as OpeningException[];
    }
    if (!this.store.openingExceptions) this.store.openingExceptions = [];
    return zoneId
      ? this.store.openingExceptions.filter((e) => e.zone_id === null || e.zone_id === zoneId)
      : this.store.openingExceptions;
  }

  static async createOpeningException(
    exception: Omit<OpeningException, 'id' | 'created_at' | 'updated_at'>
  ): Promise<OpeningException> {
    const id = `exc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const newExc: OpeningException = {
      ...exception,
      id,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('opening_exceptions')
        .insert([newExc])
        .select()
        .single();
      if (!error && data) return data as OpeningException;
    }

    if (!this.store.openingExceptions) this.store.openingExceptions = [];
    this.store.openingExceptions.push(newExc);
    return newExc;
  }

  static async deleteOpeningException(id: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('opening_exceptions').delete().eq('id', id);
      if (error) return false;
    }
    if (!this.store.openingExceptions) this.store.openingExceptions = [];
    this.store.openingExceptions = this.store.openingExceptions.filter((e) => e.id !== id);
    return true;
  }

  static async updateZoneOpeningHours(
    zoneId: string,
    openingHours: WeekdayIntervals
  ): Promise<Zone | null> {
    // Validate with zod
    const validation = weekdayIntervalsSchema.safeParse(openingHours);
    if (!validation.success) {
      throw new Error(`Invalid opening hours: ${validation.error.message}`);
    }

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('zones')
        .update({ opening_hours: openingHours, updated_at: new Date().toISOString() })
        .eq('id', zoneId)
        .select()
        .single();
      if (!error && data) return data as Zone;
    }

    const zone = this.store.zones.find((z) => z.id === zoneId);
    if (zone) {
      zone.opening_hours = openingHours;
      zone.updated_at = new Date().toISOString();
      return zone;
    }
    return null;
  }

  static async getAcademicPeriods(): Promise<AcademicPeriod[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('academic_periods')
        .select('*')
        .order('start_date', { ascending: true });
      if (!error && data) return data as AcademicPeriod[];
    }
    if (!this.store.academicPeriods) this.store.academicPeriods = [...DEFAULT_SAMPLE_PERIODS];
    return [...this.store.academicPeriods].sort((a, b) => a.start_date.localeCompare(b.start_date));
  }

  static async createAcademicPeriod(
    period: Omit<AcademicPeriod, 'id' | 'created_at' | 'updated_at'> & { id?: string }
  ): Promise<AcademicPeriod> {
    const id = period.id || `period_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const newPeriod: AcademicPeriod = {
      ...period,
      id,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('academic_periods')
        .insert([newPeriod])
        .select()
        .single();
      if (!error && data) return data as AcademicPeriod;
    }

    if (!this.store.academicPeriods) this.store.academicPeriods = [];
    this.store.academicPeriods.push(newPeriod);
    return newPeriod;
  }

  static async updateAcademicPeriod(
    id: string,
    updates: Partial<Omit<AcademicPeriod, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<AcademicPeriod | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('academic_periods')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (!error && data) return data as AcademicPeriod;
    }

    if (!this.store.academicPeriods) this.store.academicPeriods = [];
    const idx = this.store.academicPeriods.findIndex((p) => p.id === id);
    if (idx >= 0) {
      this.store.academicPeriods[idx] = {
        ...this.store.academicPeriods[idx],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      return this.store.academicPeriods[idx];
    }
    return null;
  }

  static async deleteAcademicPeriod(id: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('academic_periods').delete().eq('id', id);
      if (error) return false;
    }
    if (!this.store.academicPeriods) this.store.academicPeriods = [];
    this.store.academicPeriods = this.store.academicPeriods.filter((p) => p.id !== id);
    return true;
  }

  static async getBucketMultipliers(): Promise<Record<PredictionBucket, number>> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('bucket_multipliers').select('*');
      if (!error && data && data.length > 0) {
        const result = { ...DEFAULT_MULTIPLIERS };
        for (const row of data) {
          result[row.bucket as PredictionBucket] = Number(row.multiplier);
        }
        return result;
      }
    }
    if (!this.store.bucketMultipliers) {
      this.store.bucketMultipliers = { ...DEFAULT_MULTIPLIERS };
    }
    return { ...this.store.bucketMultipliers };
  }

  static async updateBucketMultipliers(
    multipliers: Partial<Record<PredictionBucket, number>>
  ): Promise<Record<PredictionBucket, number>> {
    if (!this.store.bucketMultipliers) {
      this.store.bucketMultipliers = { ...DEFAULT_MULTIPLIERS };
    }
    this.store.bucketMultipliers = {
      ...this.store.bucketMultipliers,
      ...multipliers,
    };

    if (isSupabaseConfigured && supabase) {
      for (const [bucket, multiplier] of Object.entries(multipliers)) {
        if (multiplier !== undefined) {
          await supabase.from('bucket_multipliers').upsert({
            bucket,
            multiplier,
            updated_at: new Date().toISOString(),
          });
        }
      }
    }

    return { ...this.store.bucketMultipliers };
  }

  static async deleteDataByDeviceHashes(
    hashes: string[]
  ): Promise<{ deletedReports: number; deletedEvents: number }> {
    const hashSet = new Set(hashes);

    // In-memory reports purge
    const initialReportsCount = this.store.reports.length;
    this.store.reports = this.store.reports.filter((r) => !hashSet.has(r.device_hash));
    const deletedReports = initialReportsCount - this.store.reports.length;

    // In-memory recommendation events purge
    const initialEventsCount = (this.store.recommendationEvents || []).length;
    if (this.store.recommendationEvents) {
      this.store.recommendationEvents = this.store.recommendationEvents.filter(
        (e) => !hashSet.has(e.device_hash)
      );
    }
    const deletedEvents = initialEventsCount - (this.store.recommendationEvents || []).length;

    // Supabase
    if (isSupabaseConfigured && supabase) {
      for (const h of hashes) {
        await supabase.from('reports').delete().eq('device_hash', h);
        await supabase.from('recommendation_events').delete().eq('device_hash', h);
      }
    }

    return { deletedReports, deletedEvents };
  }

  static async runDataRetentionPurge(): Promise<{
    deletedReports: number;
    deletedEvents: number;
  }> {
    const now = Date.now();
    const twelveMonthsAgoIso = new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgoIso = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

    // In-memory reports purge (> 12 months)
    const initialReports = this.store.reports.length;
    this.store.reports = this.store.reports.filter((r) => r.created_at >= twelveMonthsAgoIso);
    const deletedReports = initialReports - this.store.reports.length;

    // In-memory recommendation events purge (> 7 days)
    const initialEvents = (this.store.recommendationEvents || []).length;
    if (this.store.recommendationEvents) {
      this.store.recommendationEvents = this.store.recommendationEvents.filter(
        (e) => e.created_at >= sevenDaysAgoIso
      );
    }
    const deletedEvents = initialEvents - (this.store.recommendationEvents || []).length;

    // Supabase purge
    if (isSupabaseConfigured && supabase) {
      await supabase.from('reports').delete().lt('created_at', twelveMonthsAgoIso);
      await supabase.from('recommendation_events').delete().lt('created_at', sevenDaysAgoIso);
    }

    return { deletedReports, deletedEvents };
  }

  static async createFeedback(item: {
    kind: FeedbackKind;
    message: string;
    email: string | null;
    page_path: string | null;
    zone_slug: string | null;
    app_version: string;
    device_hash: string | null;
    ip_hash: string | null;
  }): Promise<Feedback> {
    if (!this.store.feedbacks) {
      this.store.feedbacks = [];
    }

    const feedback: Feedback = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'fb_' + Math.random().toString(36).substring(2, 11),
      created_at: new Date().toISOString(),
      status: 'new',
      ...item,
    };

    this.store.feedbacks.unshift(feedback);

    if (isSupabaseConfigured && supabase) {
      await supabase.from('feedback').insert(feedback);
    }

    return feedback;
  }

  static async getFeedbackList(statusFilter?: FeedbackStatus): Promise<Feedback[]> {
    if (!this.store.feedbacks) {
      this.store.feedbacks = [];
    }

    if (isSupabaseConfigured && supabase) {
      let query = supabase.from('feedback').select('*').order('created_at', { ascending: false });
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }
      const { data, error } = await query;
      if (!error && data) return data as Feedback[];
    }

    let items = [...this.store.feedbacks];
    if (statusFilter) {
      items = items.filter((f) => f.status === statusFilter);
    }
    return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  static async updateFeedbackStatus(id: string, status: FeedbackStatus): Promise<Feedback | null> {
    if (!this.store.feedbacks) {
      this.store.feedbacks = [];
    }

    const item = this.store.feedbacks.find((f) => f.id === id);
    if (item) {
      item.status = status;
    }

    if (isSupabaseConfigured && supabase) {
      await supabase.from('feedback').update({ status }).eq('id', id);
    }

    return item || null;
  }

  static async deleteFeedback(id: string): Promise<boolean> {
    if (!this.store.feedbacks) {
      this.store.feedbacks = [];
    }

    const prevLength = this.store.feedbacks.length;
    this.store.feedbacks = this.store.feedbacks.filter((f) => f.id !== id);

    if (isSupabaseConfigured && supabase) {
      await supabase.from('feedback').delete().eq('id', id);
    }

    return this.store.feedbacks.length < prevLength;
  }

  static async purgeOldFeedback(
    retentionMs = 365 * 24 * 60 * 60 * 1000,
    ipHashRetentionMs = 24 * 60 * 60 * 1000
  ): Promise<{ deleted: number; nulledIps: number }> {
    if (!this.store.feedbacks) {
      this.store.feedbacks = [];
    }

    const now = Date.now();
    const twelveMonthsAgoIso = new Date(now - retentionMs).toISOString();
    const twentyFourHoursAgoIso = new Date(now - ipHashRetentionMs).toISOString();

    const initialCount = this.store.feedbacks.length;
    this.store.feedbacks = this.store.feedbacks.filter((f) => f.created_at >= twelveMonthsAgoIso);
    const deleted = initialCount - this.store.feedbacks.length;

    let nulledIps = 0;
    for (const f of this.store.feedbacks) {
      if (f.created_at < twentyFourHoursAgoIso && f.ip_hash !== null) {
        f.ip_hash = null;
        nulledIps++;
      }
    }

    if (isSupabaseConfigured && supabase) {
      await supabase.from('feedback').delete().lt('created_at', twelveMonthsAgoIso);
      await supabase.from('feedback').update({ ip_hash: null }).lt('created_at', twentyFourHoursAgoIso);
    }

    return { deleted, nulledIps };
  }
}
