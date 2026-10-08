-- Feedback Table and RLS
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  kind TEXT NOT NULL CHECK (kind IN ('wrong', 'idea', 'other')),
  message TEXT NOT NULL,
  email TEXT,
  page_path TEXT,
  zone_slug TEXT,
  app_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'seen', 'done')),
  device_hash TEXT,
  ip_hash TEXT
);

-- Index for status and date sorting
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);

-- Row Level Security: no public read, writes only through API / service_role
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Disallow public read"
  ON feedback FOR SELECT
  USING (false);

CREATE POLICY "Allow service role all"
  ON feedback FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
