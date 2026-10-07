-- ==============================================================================
-- LSE Spots Schema Migration (2026-10-08)
-- Exact specification: zones, reports, hourly_stats
-- ==============================================================================

-- 1. ZONES TABLE
CREATE TABLE IF NOT EXISTS public.zones (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    descriptor TEXT NOT NULL,
    building TEXT NOT NULL,
    floor TEXT NOT NULL,
    noise TEXT NOT NULL CHECK (noise IN ('silent', 'quiet', 'social')),
    has_power BOOLEAN NOT NULL DEFAULT true,
    has_group_tables BOOLEAN NOT NULL DEFAULT false,
    has_pcs BOOLEAN NOT NULL DEFAULT false,
    opening_hours JSONB,
    is_active BOOLEAN NOT NULL DEFAULT true,
    qr_token TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. REPORTS TABLE (level 0=Plenty, 1=Filling up, 2=Full)
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id TEXT NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
    level INTEGER NOT NULL CHECK (level IN (0, 1, 2)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    device_hash TEXT NOT NULL,
    is_flagged BOOLEAN NOT NULL DEFAULT false
);

-- 3. HOURLY STATS (Historical aggregated predictions)
CREATE TABLE IF NOT EXISTS public.hourly_stats (
    zone_id TEXT NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
    weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=Sun, 1=Mon, ..., 6=Sat
    hour INTEGER NOT NULL CHECK (hour BETWEEN 0 AND 23),
    avg_level NUMERIC(3, 2) NOT NULL DEFAULT 0.00,
    n_reports INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (zone_id, weekday, hour)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_reports_zone_created ON public.reports(zone_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_device_rate ON public.reports(device_hash, zone_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_zones_active ON public.zones(is_active);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hourly_stats ENABLE ROW LEVEL SECURITY;

-- Zones: public read
CREATE POLICY "Zones are viewable by everyone" ON public.zones
    FOR SELECT USING (true);

-- Reports: public read non-flagged
CREATE POLICY "Reports are viewable by everyone" ON public.reports
    FOR SELECT USING (is_flagged = false);

-- Reports: insert only (via API)
CREATE POLICY "Anyone can insert a report" ON public.reports
    FOR INSERT WITH CHECK (true);

-- Hourly stats: public read
CREATE POLICY "Hourly stats are viewable by everyone" ON public.hourly_stats
    FOR SELECT USING (true);

-- ==============================================================================
-- RECOMPUTE HOURLY STATS (Nightly cron job: last 6 weeks / 42 days)
-- Fall back to weekday-agnostic hourly average when n_reports < 5
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.recompute_hourly_stats()
RETURNS void AS $$
BEGIN
    -- 1. Insert/update primary stats by zone, weekday, and hour
    INSERT INTO public.hourly_stats (zone_id, weekday, hour, avg_level, n_reports, updated_at)
    SELECT
        zone_id,
        EXTRACT(DOW FROM created_at)::INTEGER AS weekday,
        EXTRACT(HOUR FROM created_at)::INTEGER AS hour,
        ROUND(AVG(level)::NUMERIC, 2) AS avg_level,
        COUNT(*)::INTEGER AS n_reports,
        NOW() AS updated_at
    FROM public.reports
    WHERE is_flagged = false
      AND created_at >= NOW() - INTERVAL '42 days'
    GROUP BY zone_id, EXTRACT(DOW FROM created_at), EXTRACT(HOUR FROM created_at)
    ON CONFLICT (zone_id, weekday, hour)
    DO UPDATE SET
        avg_level = EXCLUDED.avg_level,
        n_reports = EXCLUDED.n_reports,
        updated_at = NOW();

    -- 2. Fall back to weekday-agnostic average when n_reports < 5
    UPDATE public.hourly_stats hs
    SET avg_level = sub.weekday_agnostic_avg,
        updated_at = NOW()
    FROM (
        SELECT
            zone_id,
            EXTRACT(HOUR FROM created_at)::INTEGER AS hour,
            ROUND(AVG(level)::NUMERIC, 2) AS weekday_agnostic_avg
        FROM public.reports
        WHERE is_flagged = false
          AND created_at >= NOW() - INTERVAL '42 days'
        GROUP BY zone_id, EXTRACT(HOUR FROM created_at)
    ) sub
    WHERE hs.zone_id = sub.zone_id
      AND hs.hour = sub.hour
      AND hs.n_reports < 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- AUTO-PURGE RAW REPORTS OLDER THAN 12 MONTHS (UK GDPR)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.purge_expired_reports()
RETURNS void AS $$
BEGIN
    DELETE FROM public.reports
    WHERE created_at < NOW() - INTERVAL '365 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
