-- ==============================================================================
-- LSE Spots Schema Migration: Academic Periods & Bucketed Predictions
-- ==============================================================================

-- 1. ACADEMIC PERIODS TABLE
CREATE TABLE IF NOT EXISTS public.academic_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('teaching', 'reading', 'exam', 'vacation')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_period_dates CHECK (start_date <= end_date)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_periods_dates ON public.academic_periods(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_periods_year ON public.academic_periods(academic_year);

-- 2. BUCKET MULTIPLIERS (Admin configurable multipliers for cold-start buckets)
CREATE TABLE IF NOT EXISTS public.bucket_multipliers (
    bucket TEXT PRIMARY KEY CHECK (bucket IN ('early', 'mid', 'late', 'reading', 'exam', 'vacation')),
    multiplier NUMERIC(3, 2) NOT NULL DEFAULT 1.00,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default multipliers
INSERT INTO public.bucket_multipliers (bucket, multiplier)
VALUES
    ('exam', 1.15),
    ('reading', 1.10),
    ('vacation', 0.60),
    ('early', 1.00),
    ('mid', 1.00),
    ('late', 1.00)
ON CONFLICT (bucket) DO NOTHING;

-- 3. EXTEND HOURLY STATS KEY TO (zone_id, bucket, weekday, hour)
ALTER TABLE public.hourly_stats
    DROP CONSTRAINT IF EXISTS hourly_stats_pkey;

ALTER TABLE public.hourly_stats
    ADD COLUMN IF NOT EXISTS bucket TEXT NOT NULL DEFAULT 'mid' CHECK (bucket IN ('early', 'mid', 'late', 'reading', 'exam', 'vacation'));

ALTER TABLE public.hourly_stats
    ADD PRIMARY KEY (zone_id, bucket, weekday, hour);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE public.academic_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bucket_multipliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Academic periods are viewable by everyone" ON public.academic_periods
    FOR SELECT USING (true);

CREATE POLICY "Bucket multipliers are viewable by everyone" ON public.bucket_multipliers
    FOR SELECT USING (true);
