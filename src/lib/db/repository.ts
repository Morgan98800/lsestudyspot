import { HourlyStat, Report, Zone } from '@/types/database';
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
}

declare global {
  // eslint-disable-next-line no-var
  var __lseSpotsSimpleStore: InMemoryStore | undefined;
}

function computeHourlyStats(reports: Report[]): HourlyStat[] {
  const map: Record<string, { sum: number; count: number }> = {};

  for (const r of reports) {
    if (r.is_flagged) continue;
    const d = new Date(r.created_at);
    const w = d.getDay();
    const h = d.getHours();
    const key = `${r.zone_id}_${w}_${h}`;
    if (!map[key]) map[key] = { sum: 0, count: 0 };
    map[key].sum += r.level;
    map[key].count += 1;
  }

  const result: HourlyStat[] = [];
  for (const [key, data] of Object.entries(map)) {
    const [zone_id, wStr, hStr] = key.split('_');
    result.push({
      zone_id,
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
  const hourlyStats = computeHourlyStats(reports);

  const store = { zones, reports, hourlyStats, recommendationEvents: [] };
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
      this.store.hourlyStats = computeHourlyStats(this.store.reports);
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
}
