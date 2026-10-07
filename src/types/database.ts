/**
 * LSE Spots Data Model Types
 * Exact specification:
 * - zones: id, slug, name, descriptor, building, floor, noise, has_power, has_group_tables, has_pcs, opening_hours, is_active, qr_token
 * - reports: id, zone_id, level (0 | 1 | 2), created_at, device_hash, is_flagged
 * - hourly_stats: zone_id, weekday (0-6), hour (0-23), avg_level (number 0.0 - 2.0), n_reports, updated_at
 */

export type BusynessLevel = 0 | 1 | 2; // 0 = Plenty of seats, 1 = Filling up, 2 = Full

export type NoiseType = 'silent' | 'quiet' | 'social';

export interface DayHours {
  open: string;  // e.g. "08:30"
  close: string; // e.g. "23:00"
  is_closed?: boolean;
}

export type WeekdayHours = {
  mon?: DayHours;
  tue?: DayHours;
  wed?: DayHours;
  thu?: DayHours;
  fri?: DayHours;
  sat?: DayHours;
  sun?: DayHours;
};

export interface Zone {
  id: string;
  slug: string;
  name: string;
  descriptor: string;
  building: string;
  floor: string;
  noise: NoiseType;
  has_power: boolean;
  has_group_tables: boolean;
  has_pcs: boolean;
  opening_hours: WeekdayHours | null;
  is_active: boolean;
  qr_token: string;
  todo_verify_notes?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface Report {
  id: string;
  zone_id: string;
  level: BusynessLevel;
  created_at: string;
  device_hash: string;
  is_flagged: boolean;
}

export interface HourlyStat {
  zone_id: string;
  weekday: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  hour: number;    // 0 - 23
  avg_level: number; // 0.0 to 2.0
  n_reports: number;
  updated_at?: string;
}

export interface ZoneEstimate {
  zone_id: string;
  level: BusynessLevel;
  is_predicted: boolean;
  is_closed: boolean;
  closed_reason?: string;
  updated_at: string | null; // null if predicted
  freshness_text: string;    // "just now", "9 min ago", or "Usual level"
  minutes_ago: number | null;
  insight_text: string;
  hourly_bars: { hour: number; avg_level: number; is_current: boolean }[];
}

export interface ZoneWithEstimate extends Zone {
  estimate: ZoneEstimate;
}
