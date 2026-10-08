-- ==============================================================================
-- LSE Spots Schema Migration: Opening Hours & Opening Exceptions
-- ==============================================================================

-- 1. OPENING EXCEPTIONS TABLE
-- For bank holidays, emergency closures, and extended exam-period hours.
-- Exceptions override weekly hours.
CREATE TABLE IF NOT EXISTS public.opening_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id TEXT REFERENCES public.zones(id) ON DELETE CASCADE, -- NULL = applies to all campus zones
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT false,
    open_time TEXT CHECK (open_time IS NULL OR open_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$|^24:00$'),
    close_time TEXT CHECK (close_time IS NULL OR close_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$|^24:00$'),
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_exception_dates CHECK (start_date <= end_date)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_exceptions_dates ON public.opening_exceptions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_exceptions_zone ON public.opening_exceptions(zone_id);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE public.opening_exceptions ENABLE ROW LEVEL SECURITY;

-- Public read for exceptions
CREATE POLICY "Opening exceptions are viewable by everyone" ON public.opening_exceptions
    FOR SELECT USING (true);
