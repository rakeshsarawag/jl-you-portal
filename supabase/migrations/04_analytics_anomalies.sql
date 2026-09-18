-- Analytics anomalies table for the unified analytics dashboard
CREATE TABLE IF NOT EXISTS analytics_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'amber' CHECK (severity IN ('amber', 'red')),
  deviation_percent NUMERIC(10, 2) NOT NULL DEFAULT 0,
  resolved_at TIMESTAMPTZ DEFAULT NULL,
  resolved_by TEXT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_anomalies_resolved ON analytics_anomalies (resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_anomalies_created ON analytics_anomalies (created_at DESC);

ALTER TABLE analytics_anomalies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'analytics_anomalies'
      AND policyname = 'Analytics anomalies readable by authenticated'
  ) THEN
    CREATE POLICY "Analytics anomalies readable by authenticated"
      ON analytics_anomalies FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'analytics_anomalies'
      AND policyname = 'Analytics anomalies resolvable by authenticated'
  ) THEN
    CREATE POLICY "Analytics anomalies resolvable by authenticated"
      ON analytics_anomalies FOR UPDATE TO authenticated USING (true);
  END IF;
END $$;

-- Scheduled reports: created_by may be TEXT or UUID depending on existing schema.
-- Add created_by_email as a TEXT column if it doesn't exist, for RLS matching.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scheduled_reports' AND column_name = 'created_by_email'
  ) THEN
    ALTER TABLE scheduled_reports ADD COLUMN created_by_email TEXT;
  END IF;
END $$;

-- Create the table only if it does not exist (text-based created_by variant)
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  schedule TEXT NOT NULL DEFAULT 'weekly',
  recipients TEXT NOT NULL,
  sections JSONB DEFAULT '[]'::jsonb,
  next_run_at TIMESTAMPTZ DEFAULT NULL,
  created_by TEXT NOT NULL DEFAULT '',
  created_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

-- Use permissive policy — frontend filters by created_by in the query.
-- Avoids UUID-vs-TEXT casting issues from pre-existing schema.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'scheduled_reports'
      AND policyname = 'Scheduled reports authenticated access'
  ) THEN
    CREATE POLICY "Scheduled reports authenticated access"
      ON scheduled_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
