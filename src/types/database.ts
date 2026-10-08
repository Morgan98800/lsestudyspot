/**
 * LSE Spots Data Model Types
 * Exact specification:
 * - zones: id, slug, name, descriptor, building, floor, noise, opening_hours, is_active, qr_token
 * - reports: id, zone_id, level (0 | 1 | 2), created_at, device_hash, is_flagged
 * - hourly_stats: zone_id, weekday (0-6), hour (0-23), avg_level (number 0.0 - 2.0), n_reports, updated_at
 */

export type BusynessLevel = 0 | 1 | 2; // 0 = Plenty of seats, 1 = Filling up, 2 = Full

export type NoiseType = 'silent' | 'quiet' | 'social';

export interface TimeInterval {
  open: string;  // e.g. "08:00"
  close: string; // e.g. "22:00", "24:00", or "02:00"
}

export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type WeekdayIntervals = {
  [K in WeekdayKey]?: TimeInterval[];
};

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

export interface OpeningException {
  id: string;
  zone_id: string | null;     // null = applies to all zones
  start_date: string;         // "YYYY-MM-DD"
  end_date: string;           // "YYYY-MM-DD"
  is_closed: boolean;
  open_time: string | null;   // "HH:MM"
  close_time: string | null;  // "HH:MM"
  reason: string;
  created_at?: string;
  updated_at?: string;
}

export interface Zone {
  id: string;
  slug: string;
  name: string;
  descriptor: string;
  building: string;
  floor: string;
  noise: NoiseType;
  opening_hours: WeekdayIntervals | WeekdayHours | null;
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

export type AcademicPeriodType = 'teaching' | 'reading' | 'exam' | 'vacation';
export type PredictionBucket = 'early' | 'mid' | 'late' | 'reading' | 'exam' | 'vacation';

export interface AcademicPeriod {
  id: string;
  academic_year: string;
  name: string;
  type: AcademicPeriodType;
  start_date: string;
  end_date: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PeriodInfo {
  type: AcademicPeriodType;
  name: string;
  termWeek: number | null;
  bucket: PredictionBucket;
}

export interface HourlyStat {
  zone_id: string;
  bucket?: PredictionBucket;
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
  closes_at?: string | null;
  closes_soon?: boolean;     // true if closes within 60 minutes
  is_exam_period?: boolean;  // true if current academic bucket is 'exam'
  updated_at: string | null; // null if predicted
  freshness_text: string;    // "just now", "9 min ago", "Closed, opens HH:MM", or "Usual level"
  minutes_ago: number | null;
  insight_text: string;
  hourly_bars: { hour: number; avg_level: number; is_current: boolean }[];
}

export interface ZoneWithEstimate extends Zone {
  estimate: ZoneEstimate;
}

export type FeedbackKind = 'wrong' | 'idea' | 'other';
export type FeedbackStatus = 'new' | 'seen' | 'done';

export interface Feedback {
  id: string;
  created_at: string;
  kind: FeedbackKind;
  message: string;
  email: string | null;
  page_path: string | null;
  zone_slug: string | null;
  app_version: string;
  status: FeedbackStatus;
  device_hash: string | null;
  ip_hash: string | null;
}

