-- TDS (Income Tax) slabs and Professional Tax slabs for FY 2025-26

-- Professional Tax slabs table (already may exist, create if not)
CREATE TABLE IF NOT EXISTS professional_tax_slabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL DEFAULT 'Karnataka',
  fy TEXT NOT NULL DEFAULT '2025-26',
  min_salary NUMERIC NOT NULL,
  max_salary NUMERIC,
  monthly_tax NUMERIC NOT NULL,
  annual_tax NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add fy column in case table existed before this migration
ALTER TABLE professional_tax_slabs ADD COLUMN IF NOT EXISTS fy TEXT NOT NULL DEFAULT '2025-26';

-- Clear and seed Karnataka PT slabs FY 2025-26
DELETE FROM professional_tax_slabs WHERE state = 'Karnataka' AND fy = '2025-26';
INSERT INTO professional_tax_slabs (state, fy, min_salary, max_salary, monthly_tax, annual_tax) VALUES
  ('Karnataka', '2025-26', 0,       14999,  0,    0),
  ('Karnataka', '2025-26', 15000,   29999,  150,  1800),
  ('Karnataka', '2025-26', 30000,   44999,  200,  2400),
  ('Karnataka', '2025-26', 45000,   59999,  300,  3600),
  ('Karnataka', '2025-26', 60000,   74999,  400,  4800),
  ('Karnataka', '2025-26', 75000,   NULL,   200,  2400);  -- capped at ₹2400/yr for Karnataka

-- Maharashtra PT slabs
DELETE FROM professional_tax_slabs WHERE state = 'Maharashtra' AND fy = '2025-26';
INSERT INTO professional_tax_slabs (state, fy, min_salary, max_salary, monthly_tax, annual_tax) VALUES
  ('Maharashtra', '2025-26', 0,      7499,   0,    0),
  ('Maharashtra', '2025-26', 7500,   9999,   175,  2100),
  ('Maharashtra', '2025-26', 10000,  NULL,   200,  2500);  -- Feb ₹300, rest ₹200

-- Income Tax slabs table (New Regime FY 2025-26)
CREATE TABLE IF NOT EXISTS income_tax_slabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regime TEXT NOT NULL DEFAULT 'new',
  fy TEXT NOT NULL DEFAULT '2025-26',
  min_income NUMERIC NOT NULL,
  max_income NUMERIC,
  rate_pct NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add fy column in case table existed before this migration
ALTER TABLE income_tax_slabs ADD COLUMN IF NOT EXISTS fy TEXT NOT NULL DEFAULT '2025-26';

-- New Tax Regime FY 2025-26 (Budget 2025 changes effective from April 2025)
DELETE FROM income_tax_slabs WHERE regime = 'new' AND fy = '2025-26';
INSERT INTO income_tax_slabs (regime, fy, min_income, max_income, rate_pct, description) VALUES
  ('new', '2025-26', 0,        300000,   0,   'Nil slab'),
  ('new', '2025-26', 300001,   600000,   5,   '5% slab'),
  ('new', '2025-26', 600001,   900000,   10,  '10% slab'),
  ('new', '2025-26', 900001,   1200000,  15,  '15% slab'),
  ('new', '2025-26', 1200001,  1500000,  20,  '20% slab'),
  ('new', '2025-26', 1500001,  NULL,     30,  '30% slab');

-- Old Tax Regime FY 2025-26
DELETE FROM income_tax_slabs WHERE regime = 'old' AND fy = '2025-26';
INSERT INTO income_tax_slabs (regime, fy, min_income, max_income, rate_pct, description) VALUES
  ('old', '2025-26', 0,       250000,  0,  'Nil slab'),
  ('old', '2025-26', 250001,  500000,  5,  '5% slab'),
  ('old', '2025-26', 500001,  1000000, 20, '20% slab'),
  ('old', '2025-26', 1000001, NULL,    30, '30% slab');

-- Rebate u/s 87A (new regime: up to ₹7L → nil tax)
CREATE TABLE IF NOT EXISTS tax_rebates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regime TEXT NOT NULL,
  fy TEXT NOT NULL,
  max_income_for_rebate NUMERIC NOT NULL,
  rebate_amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tax_rebates ADD COLUMN IF NOT EXISTS fy TEXT NOT NULL DEFAULT '2025-26';

DELETE FROM tax_rebates WHERE fy = '2025-26';
INSERT INTO tax_rebates (regime, fy, max_income_for_rebate, rebate_amount) VALUES
  ('new', '2025-26', 700000,  25000),
  ('old', '2025-26', 500000,  12500);

-- RLS: allow authenticated reads
ALTER TABLE professional_tax_slabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_tax_slabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rebates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_pt_slabs" ON professional_tax_slabs FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_it_slabs" ON income_tax_slabs FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_rebates" ON tax_rebates FOR SELECT TO authenticated USING (true);
