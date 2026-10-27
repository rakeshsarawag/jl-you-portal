-- ============================================================
-- JESHAN LABS HR PORTAL - 05_business_extensions.sql
-- Current business-module extensions, identifiers, and corrective migrations.
-- Superseded chat alterations (legacy 09-10) are intentionally excluded;
-- legacy 11 removes those retired tables on old databases.
-- Idempotent: safe to run repeatedly after schema, seeds, and platform services.
-- ============================================================

-- >>> LEGACY SOURCE: 07_project_tasks_columns.sql

-- Add missing columns to project_tasks
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES project_sprints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sprint_change_reason TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sprint_change_history JSONB DEFAULT '[]'::jsonb;

-- Add index for sprint lookups
CREATE INDEX IF NOT EXISTS idx_project_tasks_sprint_id ON project_tasks (sprint_id);

-- >>> LEGACY SOURCE: 08_communications_columns.sql

-- ============================================================
-- MIGRATION 08: Communications Hub column additions
-- ============================================================

-- communications_posts: add likes tracking
-- (image_urls, file_attachment_urls, is_pinned, scheduled_at already added in 01_schema.sql ALTER TABLE)
ALTER TABLE communications_posts
  ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS likes_by JSONB DEFAULT '[]'::jsonb;

-- communications_polls: add voters tracking for dedup / already-voted checks
ALTER TABLE communications_polls
  ADD COLUMN IF NOT EXISTS voters JSONB DEFAULT '[]'::jsonb;

-- communications_channels: add member_count for display
ALTER TABLE communications_channels
  ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 0;

-- communications_event_rsvps: the component identifies users via user_id (not employee_id)
-- Add user_id column so upsert ON CONFLICT (event_id, user_id) works
ALTER TABLE communications_event_rsvps
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- Unique constraint matching the component's onConflict target
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'communications_event_rsvps_event_id_user_id_key'
  ) THEN
    ALTER TABLE communications_event_rsvps
      ADD CONSTRAINT communications_event_rsvps_event_id_user_id_key
      UNIQUE (event_id, user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_comm_event_rsvps_user ON communications_event_rsvps(event_id, user_id);

-- >>> LEGACY SOURCE: 11_drop_chat_tables.sql

-- ============================================================
-- MIGRATION 11: Drop Collaboration Hub (chat) tables
-- The Collaboration Hub feature has been removed from the app.
-- This migration cleans up all chat-related tables and indexes.
-- Safe to run multiple times — all statements use IF EXISTS guards.
-- ============================================================

DROP TABLE IF EXISTS chat_message_attachments  CASCADE;
DROP TABLE IF EXISTS chat_message_reactions     CASCADE;
DROP TABLE IF EXISTS chat_messages              CASCADE;
DROP TABLE IF EXISTS chat_channel_members       CASCADE;
DROP TABLE IF EXISTS chat_channels              CASCADE;
DROP TABLE IF EXISTS user_presence              CASCADE;

-- >>> LEGACY SOURCE: 12_jl_sequences.sql

-- ============================================================
-- Migration 12: JL prefix sequential IDs
-- Adds JL-JRQ (Job Requisitions), JL-LVE (Leave Requests),
-- JL-PAY (Payroll Records), and upgrades JL-AST (Assets)
-- ============================================================

-- ── JL-JRQ: Job Requisitions ────────────────────────────────

ALTER TABLE job_requisitions
  ADD COLUMN IF NOT EXISTS requisition_number TEXT UNIQUE;

CREATE SEQUENCE IF NOT EXISTS jl_jrq_seq START 1001 INCREMENT 1;

CREATE OR REPLACE FUNCTION generate_jl_jrq()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.requisition_number IS NULL OR NEW.requisition_number = '' THEN
    NEW.requisition_number := 'JL-JRQ-' || LPAD(nextval('jl_jrq_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jl_jrq ON job_requisitions;
CREATE TRIGGER trg_jl_jrq
  BEFORE INSERT ON job_requisitions
  FOR EACH ROW EXECUTE FUNCTION generate_jl_jrq();

-- Backfill existing rows
DO $$
DECLARE max_num INT;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(requisition_number, '[^0-9]', '', 'g'), '')::INT), 1000)
    INTO max_num FROM job_requisitions WHERE requisition_number LIKE 'JL-JRQ-%';
  PERFORM setval('jl_jrq_seq', max_num + 1, false);
END $$;

UPDATE job_requisitions
SET requisition_number = 'JL-JRQ-' || LPAD(nextval('jl_jrq_seq')::TEXT, 5, '0')
WHERE requisition_number IS NULL;

-- ── JL-LVE: Leave Requests ─────────────────────────────────

ALTER TABLE leaves
  ADD COLUMN IF NOT EXISTS leave_number TEXT UNIQUE;

CREATE SEQUENCE IF NOT EXISTS jl_lve_seq START 1001 INCREMENT 1;

CREATE OR REPLACE FUNCTION generate_jl_lve()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.leave_number IS NULL OR NEW.leave_number = '' THEN
    NEW.leave_number := 'JL-LVE-' || LPAD(nextval('jl_lve_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jl_lve ON leaves;
CREATE TRIGGER trg_jl_lve
  BEFORE INSERT ON leaves
  FOR EACH ROW EXECUTE FUNCTION generate_jl_lve();

-- Sync sequence then backfill
DO $$
DECLARE max_num INT;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(leave_number, '[^0-9]', '', 'g'), '')::INT), 1000)
    INTO max_num FROM leaves WHERE leave_number LIKE 'JL-LVE-%';
  PERFORM setval('jl_lve_seq', max_num + 1, false);
END $$;

UPDATE leaves
SET leave_number = 'JL-LVE-' || LPAD(nextval('jl_lve_seq')::TEXT, 6, '0')
WHERE leave_number IS NULL;

-- ── JL-PAY: Payroll Records ────────────────────────────────

ALTER TABLE payroll_records
  ADD COLUMN IF NOT EXISTS payroll_number TEXT UNIQUE;

CREATE SEQUENCE IF NOT EXISTS jl_pay_seq START 1001 INCREMENT 1;

CREATE OR REPLACE FUNCTION generate_jl_pay()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payroll_number IS NULL OR NEW.payroll_number = '' THEN
    NEW.payroll_number := 'JL-PAY-' || LPAD(nextval('jl_pay_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jl_pay ON payroll_records;
CREATE TRIGGER trg_jl_pay
  BEFORE INSERT ON payroll_records
  FOR EACH ROW EXECUTE FUNCTION generate_jl_pay();

DO $$
DECLARE max_num INT;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(payroll_number, '[^0-9]', '', 'g'), '')::INT), 1000)
    INTO max_num FROM payroll_records WHERE payroll_number LIKE 'JL-PAY-%';
  PERFORM setval('jl_pay_seq', max_num + 1, false);
END $$;

UPDATE payroll_records
SET payroll_number = 'JL-PAY-' || LPAD(nextval('jl_pay_seq')::TEXT, 6, '0')
WHERE payroll_number IS NULL;

-- ── JL-AST: Assets ────────────────────────────────────────
-- asset_tag column already exists. Upgrade trigger to use JL-AST- prefix.

CREATE SEQUENCE IF NOT EXISTS jl_ast_seq START 1001 INCREMENT 1;

CREATE OR REPLACE FUNCTION generate_jl_ast()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.asset_tag IS NULL OR NEW.asset_tag = '' THEN
    NEW.asset_tag := 'JL-AST-' || LPAD(nextval('jl_ast_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jl_ast ON assets;
CREATE TRIGGER trg_jl_ast
  BEFORE INSERT ON assets
  FOR EACH ROW EXECUTE FUNCTION generate_jl_ast();

-- Sync sequence to max existing JL-AST tag
DO $$
DECLARE max_num INT;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(asset_tag, '[^0-9]', '', 'g'), '')::INT), 1000)
    INTO max_num FROM assets WHERE asset_tag LIKE 'JL-AST-%';
  PERFORM setval('jl_ast_seq', max_num + 1, false);
END $$;

-- ── Knowledge Base Bookmarks ───────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  article_id UUID NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_kb_bookmarks_user ON knowledge_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_kb_bookmarks_article ON knowledge_bookmarks(article_id);

-- RLS: users can only see/manage their own bookmarks
ALTER TABLE knowledge_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kb_bookmarks_select ON knowledge_bookmarks;
CREATE POLICY kb_bookmarks_select ON knowledge_bookmarks
  FOR SELECT USING (user_id = auth.uid()::TEXT OR auth.uid()::TEXT IN (
    SELECT auth_user_id::TEXT FROM app_users WHERE role IN ('admin','hr')
  ));

DROP POLICY IF EXISTS kb_bookmarks_insert ON knowledge_bookmarks;
CREATE POLICY kb_bookmarks_insert ON knowledge_bookmarks
  FOR INSERT WITH CHECK (user_id = auth.uid()::TEXT);

DROP POLICY IF EXISTS kb_bookmarks_delete ON knowledge_bookmarks;
CREATE POLICY kb_bookmarks_delete ON knowledge_bookmarks
  FOR DELETE USING (user_id = auth.uid()::TEXT);

-- >>> LEGACY SOURCE: 13_tds_slabs.sql

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

DROP POLICY IF EXISTS "authenticated_read_pt_slabs" ON professional_tax_slabs;
DROP POLICY IF EXISTS "authenticated_read_it_slabs" ON income_tax_slabs;
DROP POLICY IF EXISTS "authenticated_read_rebates" ON tax_rebates;
CREATE POLICY "authenticated_read_pt_slabs" ON professional_tax_slabs FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_it_slabs" ON income_tax_slabs FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_rebates" ON tax_rebates FOR SELECT TO authenticated USING (true);

-- >>> LEGACY SOURCE: 14_temp_access_grants.sql

-- Temporary Access Grants (M-24: RBAC time-limited permissions)
-- Note: FK constraints to app_users omitted for portability;
-- referential integrity enforced at application layer.

CREATE TABLE IF NOT EXISTS temporary_access_grants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  granted_by    UUID,
  app_id        TEXT NOT NULL,
  section_id    TEXT,
  reason        TEXT NOT NULL DEFAULT '',
  expires_at    TIMESTAMPTZ NOT NULL,
  is_revoked    BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_by    UUID,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_temp_grants_user    ON temporary_access_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_temp_grants_app     ON temporary_access_grants(app_id);
CREATE INDEX IF NOT EXISTS idx_temp_grants_expires ON temporary_access_grants(expires_at);

-- RLS
ALTER TABLE temporary_access_grants ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
DROP POLICY IF EXISTS "admin_all_temp_grants" ON temporary_access_grants;
CREATE POLICY "admin_all_temp_grants"
  ON temporary_access_grants
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Auto-updated timestamp
CREATE OR REPLACE FUNCTION update_temp_grants_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_temp_grants_updated_at ON temporary_access_grants;
CREATE TRIGGER trg_temp_grants_updated_at
  BEFORE UPDATE ON temporary_access_grants
  FOR EACH ROW EXECUTE FUNCTION update_temp_grants_updated_at();

-- >>> LEGACY SOURCE: 16_employee_code_jl.sql

-- Migration 16: Change employee code format from JSN#### to JL###
-- New format: JL001, JL002, ... JL999, JL1000 (no zero-padding cap)

-- Drop old sequence and recreate starting at 1
DROP SEQUENCE IF EXISTS employee_code_seq CASCADE;
CREATE SEQUENCE employee_code_seq START 1 INCREMENT 1;

-- Sync sequence to current max to avoid collisions with existing rows
DO $$
DECLARE max_num INT;
BEGIN
  SELECT COALESCE(
    MAX(
      NULLIF(
        regexp_replace(employee_code, '[^0-9]', '', 'g'),
        ''
      )::INT
    ), 0
  )
  INTO max_num
  FROM employees
  WHERE employee_code IS NOT NULL;

  IF max_num > 0 THEN
    PERFORM setval('employee_code_seq', max_num, true);
  END IF;
END $$;

-- Replace generator function with new JL prefix + zero-padded 3-digit (then 4+)
CREATE OR REPLACE FUNCTION generate_employee_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  next_num BIGINT;
BEGIN
  IF NEW.employee_code IS NULL THEN
    next_num := nextval('employee_code_seq');
    -- Zero-pad to at least 3 digits: JL001, JL010, JL100, JL1000 ...
    NEW.employee_code := 'JL' || LPAD(next_num::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS trg_employee_code ON employees;
CREATE TRIGGER trg_employee_code
  BEFORE INSERT ON employees
  FOR EACH ROW EXECUTE FUNCTION generate_employee_code();

-- Backfill existing employees that still have JSN-prefixed codes
-- Maps them to JL codes in the same numeric order they were assigned
DO $$
DECLARE
  rec RECORD;
  new_code TEXT;
BEGIN
  FOR rec IN
    SELECT id, employee_code,
           regexp_replace(employee_code, '[^0-9]', '', 'g')::INT AS num
    FROM employees
    WHERE employee_code LIKE 'JSN%'
    ORDER BY num
  LOOP
    new_code := 'JL' || LPAD(rec.num::TEXT, 3, '0');
    -- Avoid collision if target code already exists
    IF NOT EXISTS (SELECT 1 FROM employees WHERE employee_code = new_code AND id <> rec.id) THEN
      UPDATE employees SET employee_code = new_code WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;

-- >>> LEGACY SOURCE: 17_recruitment_expertise.sql

-- Add expertise column to recruitment_candidates
ALTER TABLE recruitment_candidates
  ADD COLUMN IF NOT EXISTS expertise TEXT;

-- >>> LEGACY SOURCE: 18_task_comments.sql

-- Migration 18: Task comments for project_tasks
-- Allows users to add threaded comments on individual tasks

CREATE TABLE IF NOT EXISTS task_comments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id      UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  author_id    UUID REFERENCES employees(id) ON DELETE SET NULL,
  author_name  TEXT NOT NULL DEFAULT '',
  content      TEXT NOT NULL,
  created_by   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON task_comments(task_id, created_at DESC);

-- Enable RLS to match project_tasks pattern
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_comments_select" ON task_comments;
DROP POLICY IF EXISTS "task_comments_insert" ON task_comments;
DROP POLICY IF EXISTS "task_comments_update" ON task_comments;
DROP POLICY IF EXISTS "task_comments_delete" ON task_comments;
CREATE POLICY "task_comments_select" ON task_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "task_comments_insert" ON task_comments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "task_comments_update" ON task_comments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "task_comments_delete" ON task_comments FOR DELETE TO authenticated USING (true);

-- >>> LEGACY SOURCE: 19_project_tasks_timestamps.sql

-- Migration 19: Ensure timestamp audit columns exist on project_tasks
-- These may be missing if the DB was initialised from an older schema snapshot.

ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS started_at   TIMESTAMPTZ;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS closed_at    TIMESTAMPTZ;

-- >>> LEGACY SOURCE: 26_allow_general_defects.sql

-- Allow defects that are not associated with a project.
-- The UI stores these records with project_id = NULL and project_name = 'General'.
ALTER TABLE public.project_defects
  ALTER COLUMN project_id DROP NOT NULL;

-- >>> LEGACY SOURCE: 27_fix_invoice_client_fk_and_fields.sql

-- Align invoices with the current clients table and persist all create-form fields.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_period_from DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_period_to DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS po_number TEXT;

-- Preserve legacy invoice rows by clearing only IDs that have no modern client match.
-- client_name remains available on those historical invoices.
UPDATE invoices
SET client_id = NULL
WHERE client_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM clients WHERE clients.id = invoices.client_id);

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_client_id_fkey;
ALTER TABLE invoices
  ADD CONSTRAINT invoices_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

-- >>> LEGACY SOURCE: 28_mandatory_training_assessments.sql

-- Mandatory onboarding training, detailed course content, and scored assessments.
ALTER TABLE training_courses ADD COLUMN IF NOT EXISTS mandatory BOOLEAN DEFAULT false;
ALTER TABLE training_courses ADD COLUMN IF NOT EXISTS assessment_required BOOLEAN DEFAULT false;
ALTER TABLE training_courses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE training_courses ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'beginner';
ALTER TABLE training_courses ADD COLUMN IF NOT EXISTS content JSONB DEFAULT '[]'::jsonb;
ALTER TABLE training_courses ADD COLUMN IF NOT EXISTS deadline_days INTEGER DEFAULT 30;
ALTER TABLE training_courses ADD COLUMN IF NOT EXISTS renewal_months INTEGER DEFAULT 12;
ALTER TABLE training_courses ADD COLUMN IF NOT EXISTS standard_references JSONB DEFAULT '[]'::jsonb;

ALTER TABLE training_enrollments ADD COLUMN IF NOT EXISTS mandatory BOOLEAN DEFAULT false;
ALTER TABLE training_enrollments ADD COLUMN IF NOT EXISTS assessment_required BOOLEAN DEFAULT false;
ALTER TABLE training_enrollments ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE training_enrollments ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMPTZ;
ALTER TABLE training_enrollments ADD COLUMN IF NOT EXISTS assessment_passed BOOLEAN DEFAULT false;
ALTER TABLE training_enrollments ADD COLUMN IF NOT EXISTS best_score INTEGER;
ALTER TABLE training_enrollments ADD COLUMN IF NOT EXISTS assessment_attempts INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS training_assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_option_index INTEGER NOT NULL CHECK (correct_option_index >= 0),
  explanation TEXT,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, sort_order)
);

CREATE TABLE IF NOT EXISTS training_assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES training_enrollments(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  course_id UUID NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  score INTEGER NOT NULL,
  passed BOOLEAN NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE training_assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_assessment_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "training_questions_authenticated_read" ON training_assessment_questions;
DROP POLICY IF EXISTS "training_attempts_authenticated" ON training_assessment_attempts;
-- These tables are deliberately service-role only. The training API removes
-- answer keys and applies employee ownership checks before returning data.

INSERT INTO training_courses (
  title, description, category, instructor, duration_hours, type, status,
  passing_score, tags, mandatory, assessment_required, is_active, level, deadline_days,
  renewal_months, content, standard_references
) VALUES
(
  'Prevention of Sexual Harassment & Respectful Workplace',
  'Mandatory workplace-respect programme covering prohibited conduct, bystander action, reporting channels, confidentiality, non-retaliation, and manager duties.',
  'Compliance', 'People & Legal Team', 2.5, 'Online', 'Active', 80,
  '["mandatory","posh","workplace-respect","annual","onboarding"]'::jsonb,
  true, true, true, 'beginner', 30, 12,
  '[
    {"title":"1. Dignity, equality, and a respectful workplace","body":"Every employee has the right to work with dignity and without unwelcome sexual conduct. Respect applies in person and in digital communication, regardless of seniority, employment type, gender, gender identity, sexual orientation, or location. Consent must be voluntary, informed, specific, and reversible; silence, past agreement, or a power imbalance must never be treated as consent.\n\nProfessional feedback, reasonable performance management, and respectful disagreement are not harassment merely because they are uncomfortable. They cross a line when they become discriminatory, sexual, humiliating, threatening, retaliatory, or are used to demand personal attention.","bullets":["Maintain professional boundaries in offices, remote work, travel, client sites, transport, and social events","Consider impact and context, not only claimed intention","A single serious incident can violate policy","Power differences can make refusal difficult and require extra care"]},
    {"title":"2. Conduct that may amount to sexual harassment","body":"Sexual harassment includes unwelcome physical, verbal, non-verbal, visual, or digital conduct of a sexual nature. Quid pro quo harassment links employment benefits or threats to sexual cooperation. A hostile environment arises when conduct is severe or persistent enough to make work intimidating, offensive, or unsafe.\n\nExamples include sexual comments or jokes, repeated invitations after refusal, intrusive questions, staring or gestures, sharing sexual images, unwanted touching, sexual rumours, stalking, and inappropriate messages or video-call behaviour. Conduct by customers, vendors, contractors, or visitors must also be addressed.","bullets":["A joke can still be unwelcome harassment","Conduct can affect people of any gender","Online and after-hours work channels remain workplace environments","Do not assume friendship or informality removes professional boundaries"]},
    {"title":"3. India POSH framework and organizational duties","body":"The Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013 requires covered employers to prevent sexual harassment and provide a redressal mechanism. Organizations meeting the statutory threshold must constitute an Internal Committee, display consequences and committee details, support awareness, and cooperate with inquiries. Local Committee mechanisms may apply where an Internal Committee is unavailable or where the complaint concerns the employer.\n\nThis course explains workplace policy and awareness obligations; it is not legal advice. The Internal Committee or designated HR contact will explain applicable limitation periods, interim protections, inquiry procedure, representation, and appeal rights for the relevant jurisdiction.","bullets":["Use the published Internal Committee or HR channel","Formal processes must follow principles of natural justice","The employer must support prevention as well as redressal","Local legal requirements override generic course guidance"]},
    {"title":"4. Reporting, evidence, confidentiality, and support","body":"A person may report directly, seek help from HR or the Internal Committee, or ask a trusted colleague for support. Record dates, locations, words or actions, witnesses, and relevant messages without editing or circulating them. Immediate danger should be reported through emergency and safety channels.\n\nConfidentiality protects the complainant, respondent, witnesses, and integrity of the process. It does not mean concerns should be hidden from designated responders. Managers who receive a concern should listen without blame, check immediate safety, explain that they must escalate, and avoid conducting a private investigation.","bullets":["Preserve original messages, files, and contemporaneous notes","Do not demand confrontation or mediation","Do not promise absolute secrecy","Only share information with people who have an authorized need to know"]},
    {"title":"5. Non-retaliation and fair process","body":"Retaliation is any adverse treatment because a person raised a concern, supported another person, participated in an inquiry, or refused unwelcome conduct. Examples include threats, exclusion, poor assignments, schedule manipulation, hostile references, intimidation, or misuse of performance processes.\n\nA report does not predetermine guilt. Both complainant and respondent must be treated respectfully while trained, impartial decision-makers establish facts. Knowingly false evidence is different from a complaint that cannot be substantiated; lack of proof alone must not be treated as misconduct.","bullets":["Report suspected retaliation immediately","Continue ordinary work decisions only with objective documentation","Do not pressure witnesses or discuss testimony","Interim measures should protect safety without presuming the outcome"]},
    {"title":"6. Safe bystander action and practical scenarios","body":"Bystanders can interrupt harm without placing themselves at risk. Use the five approaches: Directly name the behaviour when safe; Distract to change the situation; Delegate to a manager, HR, security, or the Internal Committee; Delay and check on the affected person later; Document facts when requested and safe.\n\nIf a client repeatedly comments on a colleague’s appearance, redirect the conversation, support the colleague, and report through the defined channel. If a senior employee sends suggestive messages, do not forward them as gossip; preserve the originals and escalate. If someone discloses an experience, listen, thank them, avoid blame, and offer reporting and support options.","bullets":["Choose the safest intervention rather than the most confrontational one","Ask the affected person what support they want where possible","Managers still have a duty to escalate even if informal help is requested","Never retaliate, shame, or spread rumours"]}
  ]'::jsonb,
  '[{"name":"India POSH Act, 2013 and Rules","url":"https://legislative.gov.in/"},{"name":"EEOC Sexual Harassment Guidance","url":"https://www.eeoc.gov/sexual-harassment"}]'::jsonb
),
(
  'Information Security, Phishing & Account Protection',
  'Mandatory security awareness for protecting accounts, devices, source code, cloud services, and company information against phishing and social engineering.',
  'Compliance', 'Information Security Team', 2, 'Online', 'Active', 85,
  '["mandatory","security","phishing","mfa","annual","onboarding"]'::jsonb,
  false, true, true, 'beginner', 14, 12,
  '[
    {"title":"1. How attackers target employees","body":"Attackers exploit trust, urgency, authority, curiosity, and routine business processes. Phishing may arrive through email, chat, SMS, phone calls, QR codes, shared documents, calendar invitations, social media, or fake support requests. Business email compromise often impersonates leaders or suppliers to change payment details, request gift cards, or obtain confidential records.\n\nModern attacks can use convincing language, cloned login pages, malicious OAuth consent, MFA fatigue, deepfake audio, and compromised vendor accounts. A familiar sender or grammatically correct message is not proof of legitimacy.","bullets":["Pause when a request is urgent, secret, unusual, or bypasses normal process","Verify sensitive requests through a separate trusted channel","Inspect the actual destination before opening links","Report suspicious messages through the approved mechanism"]},
    {"title":"2. Passwords, passkeys, and multi-factor authentication","body":"Use a unique credential for every work service and store it only in the approved password manager. Prefer long generated passwords or approved passkeys. Multi-factor authentication reduces risk, but approval prompts and one-time codes can still be stolen through social engineering.\n\nNever approve an unexpected prompt, disclose an OTP, scan an unknown login QR code, or let another person use your authenticated session. If credentials may have been exposed, report immediately and change them from a known-clean device when instructed.","bullets":["Do not reuse work passwords on personal services","Use phishing-resistant MFA where offered","Reject and report unexpected MFA prompts","Keep recovery codes in the approved secure location"]},
    {"title":"3. Access control and privileged accounts","body":"Least privilege means receiving only the access needed for current duties and only for as long as needed. Administrative access should use a separate approved account, stronger authentication, logging, and time-limited elevation where available. Shared accounts weaken accountability and should be avoided unless formally controlled.\n\nManagers and system owners must review access when roles change and remove access promptly when it is no longer required. Never borrow credentials, bypass approval, or retain copied secrets for convenience.","bullets":["Request access through the documented approval process","Separate daily work from privileged administration","Review group memberships and service accounts regularly","Report excessive or unexplained access"]},
    {"title":"4. Secure devices and remote work","body":"Install approved updates promptly, keep endpoint protection enabled, lock the screen whenever unattended, and use only authorized software and storage. Do not disable security controls to solve a performance problem. Lost or stolen equipment must be reported immediately, even when encrypted.\n\nWhen working remotely, protect screens and conversations, use approved connectivity, and avoid unknown removable media. Public Wi-Fi and charging facilities may be hostile; follow organizational VPN and hardware guidance. Family members and visitors must not use company devices or accounts.","bullets":["Keep company information in approved systems","Do not connect unknown USB devices","Use privacy screens or private spaces for sensitive work","Report loss, theft, or suspicious device behaviour immediately"]},
    {"title":"5. Email, browsing, cloud, and software safety","body":"Confirm senders, recipients, attachment context, and domain names before acting. Macros, archives, installers, browser extensions, and OAuth applications can grant broad access or run malicious code. Use approved repositories and verify packages according to engineering policy; dependency confusion and compromised updates can affect entire environments.\n\nDo not upload company information to personal storage or unapproved AI, transcription, translation, or file-conversion services. Authorization to view information does not authorize copying it into another platform.","bullets":["Use bookmarks or known addresses for sensitive logins","Review OAuth permissions before consenting","Install software only through approved channels","Treat unexpected shared documents as potential phishing"]},
    {"title":"6. Responding to a suspected compromise","body":"Report quickly through the security channel and provide what happened, when it happened, the device or account involved, and actions already taken. Preserve the original message and relevant evidence. Do not delete files, wipe the device, investigate other users, or communicate publicly unless the response team instructs you.\n\nIf you entered credentials, approved MFA, opened a suspicious attachment, or disclosed data, say so plainly. Fast, accurate reporting reduces harm and is encouraged; hiding an honest mistake increases risk.","bullets":["Do not wait for proof before reporting","Follow containment instructions from authorized responders","Use a known-clean device for resets when directed","Continue providing factual updates as new information appears"]}
  ]'::jsonb,
  '[{"name":"NIST SP 800-50 Rev. 1","url":"https://csrc.nist.gov/publications/detail/sp/800-50/rev-1/final"},{"name":"CISA Phishing Guidance","url":"https://www.cisa.gov/secure-our-world/recognize-and-report-phishing"}]'::jsonb
),
(
  'Data Privacy & Secure Data Handling',
  'Mandatory privacy and data-handling programme covering classification, lawful use, minimisation, secure sharing, retention, disposal, and data-subject requests.',
  'Compliance', 'Privacy & Legal Team', 2, 'Online', 'Active', 80,
  '["mandatory","privacy","data-protection","gdpr","annual","onboarding"]'::jsonb,
  false, true, true, 'beginner', 30, 12,
  '[
    {"title":"1. Understanding personal and sensitive data","body":"Personal data is information that identifies or can reasonably be linked to a person, directly or indirectly. Examples include names, identifiers, contact details, location, online identifiers, employment information, device data, and combinations of otherwise ordinary facts. Sensitive or special-category data can include health, biometrics, financial details, government identifiers, beliefs, sexuality, or information about children, depending on applicable law.\n\nCompany-confidential information, authentication secrets, source code, and production data may not always be personal data, but they still require classification and protection. When uncertain, apply the more protective classification and consult Privacy or Information Security.","bullets":["Classify information before collecting, storing, exporting, or sharing it","Treat credentials and security tokens as highly sensitive","Do not use real personal data in testing without explicit approval and safeguards","Small datasets can identify people when combined"]},
    {"title":"2. Purpose limitation, fairness, and transparency","body":"Use personal data only for a specific, authorized, and communicated purpose. A person having access to a system does not mean they may reuse its data for analytics, product experiments, AI training, demonstrations, or another team’s project. New uses require review for compatibility, legal basis, transparency, and risk.\n\nCollect data fairly and avoid misleading interfaces or unnecessary monitoring. Notices should explain what is collected, why, who receives it, how long it is kept, and how individuals can exercise applicable rights.","bullets":["Confirm the approved purpose before beginning processing","Do not silently repurpose data","Escalate high-risk profiling, monitoring, biometric, or children’s-data use","Document decisions through the privacy review process"]},
    {"title":"3. Data minimization and accuracy","body":"Collect only the fields necessary to achieve the approved purpose and provide access only to people who need it. More data creates more breach impact, storage cost, and compliance risk. Avoid free-text collection when structured, limited choices will meet the need.\n\nTake reasonable steps to keep important data accurate and allow corrections through authorized processes. Do not overwrite authoritative records or create uncontrolled local copies to work around a quality issue.","bullets":["Challenge fields requested merely in case they become useful","Mask or pseudonymize data where full identity is unnecessary","Limit exports by rows, columns, time period, and recipient","Correct errors in the authoritative system"]},
    {"title":"4. Secure storage, access, and transfer","body":"Store data only in approved systems with appropriate encryption, access control, logging, backup, and residency arrangements. Verify every recipient before sending sensitive material and use approved secure transfer methods. Public links, personal email, consumer file-sharing, and unapproved collaboration tools are not acceptable substitutes.\n\nThird-party and international transfers may require contracts, security review, privacy assessment, and transfer safeguards. Procurement approval alone does not automatically authorize every category or volume of data.","bullets":["Apply least privilege and review access regularly","Expire links and remove access when work ends","Double-check recipients and attachments before sending","Use approved vendor and cross-border review processes"]},
    {"title":"5. Retention, deletion, and physical records","body":"Keep records for the approved retention period and no longer, except where a legal hold or documented business requirement applies. Retention covers databases, exports, email attachments, collaboration spaces, backups, paper, recordings, and removable media. Moving a file to an archive does not necessarily satisfy deletion.\n\nUse approved secure deletion and destruction methods. Do not place sensitive paper in ordinary waste or sell, donate, or repurpose devices before authorized sanitization.","bullets":["Avoid convenience copies and forgotten exports","Follow legal holds even when normal deletion is due","Use approved shredding and media-sanitization services","Record disposal where policy requires evidence"]},
    {"title":"6. Individual requests and privacy incidents","body":"People may have rights to access, correct, delete, restrict, object, withdraw consent, or receive information, depending on jurisdiction and context. Forward requests immediately to the privacy process; do not promise an outcome, disclose records before identity verification, or independently delete evidence.\n\nMisdirected email, excessive access, lost records, public links, unauthorized screenshots, and incorrect disposal can be privacy incidents. Report immediately with factual details so authorized teams can contain harm and assess notification duties.","bullets":["Do not wait for certainty before reporting a potential breach","Preserve evidence and identify affected systems and recipients","Never conceal an accidental disclosure","Only authorized teams communicate with regulators or affected individuals"]}
  ]'::jsonb,
  '[{"name":"EU GDPR","url":"https://eur-lex.europa.eu/eli/reg/2016/679/oj"},{"name":"ISO/IEC 27001 Information Security Management","url":"https://www.iso.org/isoiec-27001-information-security.html"}]'::jsonb
),
(
  'Security Incident Recognition & Reporting',
  'Mandatory programme for recognising and rapidly escalating suspected security, privacy, availability, and insider-risk incidents.',
  'Compliance', 'Security Operations Team', 1.5, 'Online', 'Active', 85,
  '["mandatory","incident-response","cert-in","annual","onboarding"]'::jsonb,
  false, true, true, 'beginner', 14, 12,
  '[
    {"title":"1. Recognizing security and privacy incidents","body":"An incident is an event that may threaten confidentiality, integrity, availability, privacy, safety, or compliance. It includes more than confirmed hacking: suspicious access, malware alerts, exposed credentials, lost equipment, accidental data sharing, service disruption, unauthorized software, unusual cloud changes, policy bypass, and insider-risk indicators can all qualify.\n\nA near miss should also be reported because it can expose a control weakness. Employees are not expected to prove impact or assign severity before raising an alert; trained responders perform triage.","bullets":["Report uncertainty rather than waiting for proof","Treat exposed production secrets as urgent","Include accidental events and near misses","Do not assume another person has already reported"]},
    {"title":"2. Immediate priorities and personal safety","body":"Protect people first, then contact the defined incident channel. Note what you observed, when it occurred, the account or device involved, and what actions have already been taken. Follow responder instructions because an intuitive action such as rebooting, deleting, or disconnecting can destroy evidence or disrupt containment.\n\nDo not confront a suspected insider, contact an attacker, run unapproved forensic tools, or discuss the event publicly. For physical danger, use emergency and site-security procedures before technical reporting.","bullets":["Use the security hotline or incident channel","Preserve screens, messages, logs, and original files","Do not wipe or reimage equipment without authorization","Escalate safety threats through emergency procedures"]},
    {"title":"3. Writing a useful initial report","body":"A useful report separates observation from assumption. State who noticed the event, what was seen, when and where it occurred, affected systems or records, indicators such as sender addresses or alert names, business impact, and actions already taken. Mention whether credentials, data, payments, or privileged systems may be involved.\n\nDo not delay the initial alert while producing a perfect report. Send the essential facts first and add updates through the assigned incident record as information changes.","bullets":["Use exact times and time zones where possible","Quote error messages rather than paraphrasing","Identify data types and approximate volume if known","Avoid blame, speculation, and unsupported attribution"]},
    {"title":"4. Containment and evidence preservation","body":"Containment limits further harm while maintaining business operations and evidence. Only authorized responders should isolate systems, revoke access, rotate production secrets, block indicators, or engage vendors unless emergency instructions say otherwise. Keep a record of every action and its time.\n\nEvidence can include logs, emails, cloud audit trails, files, device state, photographs, and witness notes. Preserve originals and maintain authorized handling; editing, forwarding, or collecting more than necessary can damage integrity and privacy.","bullets":["Follow the incident commander or response lead","Do not alter logs or timestamps","Use approved evidence locations and access controls","Record containment actions and outcomes"]},
    {"title":"5. Communication and regulatory coordination","body":"Incident details are sensitive. Use designated channels and share only with responders who need the information. Do not notify customers, regulators, media, law enforcement, insurers, or vendors unless authorized. Security, Privacy, Legal, Communications, and leadership coordinate external obligations and consistent messaging.\n\nSome laws and contracts impose short reporting periods, but employees should focus on immediate internal escalation. Rapid reporting gives authorized teams the time needed to investigate and meet any applicable deadline.","bullets":["Do not post incident details in broad chats or social media","Forward external inquiries to authorized Communications or Legal contacts","Mark facts as confirmed, probable, or unknown","Continue updates through the official incident record"]},
    {"title":"6. Recovery and learning","body":"Recovery restores services safely, validates that threats are removed, monitors for recurrence, and communicates operational status. Employees may be asked to reset credentials, verify records, test workflows, or follow temporary controls. Do not bypass temporary restrictions merely to restore speed.\n\nPost-incident reviews should be blameless and evidence-based. They identify root causes, control improvements, owners, and due dates. Completing assigned corrective actions is part of incident response, not optional administrative work.","bullets":["Validate recovery through approved checks","Keep temporary controls until formally withdrawn","Participate honestly in lessons-learned reviews","Track remediation to verified completion"]}
  ]'::jsonb,
  '[{"name":"CERT-In Cyber Security Directions","url":"https://www.cert-in.org.in/Directions70B.jsp"},{"name":"NIST SP 800-61 Incident Handling Guide","url":"https://csrc.nist.gov/publications/detail/sp/800-61/rev-2/final"}]'::jsonb
),
(
  'Code of Conduct, Ethics & Acceptable Use',
  'Mandatory standards for ethical decisions, conflicts of interest, anti-bribery, respectful collaboration, acceptable technology use, and speaking up.',
  'Compliance', 'People & Compliance Team', 1.5, 'Online', 'Active', 80,
  '["mandatory","ethics","acceptable-use","anti-bribery","annual","onboarding"]'::jsonb,
  false, true, true, 'beginner', 30, 12,
  '[
    {"title":"1. The code and ethical decision-making","body":"The code of conduct sets minimum standards for lawful, honest, respectful, and accountable work. When a rule does not provide a clear answer, ask whether the action is legal, consistent with policy and company values, fair to affected people, defensible if made public, and likely to preserve customer and colleague trust.\n\nTargets, deadlines, seniority, and commercial pressure do not excuse misconduct. Pause and seek guidance when facts are incomplete or when an instruction appears inconsistent with law, policy, or professional duty.","bullets":["Apply the same standards regardless of seniority","Document approvals for unusual decisions","Escalate instructions that appear unlawful or unethical","When in doubt, ask before acting"]},
    {"title":"2. Conflicts of interest","body":"A conflict exists when personal interests could influence—or reasonably appear to influence—a work decision. Examples include family or financial interests in a supplier, outside employment, personal relationships in reporting lines, investments, board roles, and using company opportunities for private gain.\n\nA conflict is not automatically wrongdoing, but hiding it prevents proper management. Disclose promptly and follow measures such as recusal, independent review, reassignment, or divestment. Update disclosures when circumstances change.","bullets":["Disclose actual, potential, and perceived conflicts","Do not participate in decisions while a conflict is being reviewed","Never direct business to benefit yourself or a close relation","Keep conflict records current"]},
    {"title":"3. Gifts, hospitality, bribery, and fraud","body":"Never offer, request, authorize, or accept anything of value intended to improperly influence a decision. Value can include cash, gifts, travel, meals, jobs, discounts, donations, favors, or benefits for relatives. Facilitation payments and kickbacks are prohibited even when described as customary.\n\nGifts and hospitality must be modest, infrequent, transparent, lawful, and permitted by policy. Government officials and procurement processes require particular caution. Record transactions accurately; false descriptions, side agreements, and off-book funds are prohibited.","bullets":["Use the gifts-and-hospitality approval process","Decline cash and cash equivalents","Escalate suspicious invoices, commissions, or payment routes","Never retaliate against someone who refuses an improper payment"]},
    {"title":"4. Respect, inclusion, and professional conduct","body":"Treat colleagues, candidates, customers, suppliers, and community members fairly and professionally. Discrimination, bullying, threats, humiliation, sexual harassment, and retaliation are inconsistent with the code. Employment decisions must be based on legitimate, documented criteria rather than protected characteristics or favoritism.\n\nProfessional conduct also applies to chat, social media, remote meetings, travel, and work events. Debate ideas without personal attacks and make reasonable efforts to include different perspectives and accessibility needs.","bullets":["Challenge disrespectful conduct safely or report it","Use objective criteria for work decisions","Do not circulate offensive or humiliating material","Respect privacy and personal boundaries"]},
    {"title":"5. Acceptable use, confidential information, and records","body":"Use company systems, data, and intellectual property for authorized purposes. Install only licensed, approved software and use approved cloud and AI services. Never bypass monitoring, endpoint protection, access controls, or retention rules. Limited personal use may be allowed only where policy permits and must not create security, legal, or productivity risk.\n\nCreate complete and accurate records. Do not falsify time, expenses, approvals, test results, financial entries, or business communications. Protect confidential information during employment and after departure.","bullets":["Do not upload confidential data to unapproved AI tools","Never share accounts or authentication factors","Preserve records subject to a legal hold","Report accidental disclosure or inaccurate records promptly"]},
    {"title":"6. Speaking up, investigations, and non-retaliation","body":"Raise concerns through a manager, HR, Compliance, Legal, Information Security, or the confidential reporting channel. Provide facts and documents in good faith; you do not need to investigate or prove the case yourself. Immediate threats should use emergency channels.\n\nCooperate honestly with authorized investigations, preserve relevant information, and maintain confidentiality. Retaliation against good-faith reporters, witnesses, or investigators is prohibited. A deliberately false statement is misconduct, but an unsubstantiated good-faith concern is not.","bullets":["Report suspected retaliation immediately","Do not alert subjects or coach witnesses","Keep investigation information need-to-know","Seek guidance if local law or professional obligations differ"]}
  ]'::jsonb,
  '[{"name":"ISO 37301 Compliance Management Systems","url":"https://www.iso.org/standard/75080.html"},{"name":"OECD Anti-Bribery Convention","url":"https://www.oecd.org/corruption/oecdantibriberyconvention.htm"}]'::jsonb
)
ON CONFLICT (lower(title)) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  instructor = EXCLUDED.instructor,
  duration_hours = EXCLUDED.duration_hours,
  type = EXCLUDED.type,
  status = EXCLUDED.status,
  passing_score = EXCLUDED.passing_score,
  tags = EXCLUDED.tags,
  mandatory = EXCLUDED.mandatory,
  assessment_required = EXCLUDED.assessment_required,
  is_active = EXCLUDED.is_active,
  level = EXCLUDED.level,
  deadline_days = EXCLUDED.deadline_days,
  renewal_months = EXCLUDED.renewal_months,
  content = EXCLUDED.content,
  standard_references = EXCLUDED.standard_references;

-- Consolidate legacy seed titles into the detailed canonical courses. This
-- preserves related records and makes the migration safe for databases where
-- both the old summary course and the new course were previously created.
DO $$
DECLARE
  course_alias RECORD;
  canonical_id UUID;
  duplicate_id UUID;
BEGIN
  FOR course_alias IN
    SELECT *
    FROM (VALUES
      ('Information Security Awareness', 'Information Security, Phishing & Account Protection'),
      ('Prevention of Sexual Harassment (POSH)', 'Prevention of Sexual Harassment & Respectful Workplace'),
      ('Code of Conduct & Ethics', 'Code of Conduct, Ethics & Acceptable Use'),
      ('Data Privacy & GDPR Compliance', 'Data Privacy & Secure Data Handling')
    ) AS aliases(legacy_title, canonical_title)
  LOOP
    SELECT id INTO canonical_id
    FROM training_courses
    WHERE lower(title) = lower(course_alias.canonical_title)
    LIMIT 1;

    FOR duplicate_id IN
      SELECT id
      FROM training_courses
      WHERE lower(title) = lower(course_alias.legacy_title)
        AND id <> canonical_id
    LOOP
      -- Preserve the strongest enrollment outcome when an employee has both.
      UPDATE training_enrollments canonical
      SET
        progress = GREATEST(canonical.progress, legacy.progress),
        status = CASE
          WHEN canonical.status = 'Completed' OR legacy.status = 'Completed' THEN 'Completed'
          WHEN canonical.status = 'In Progress' OR legacy.status = 'In Progress' THEN 'In Progress'
          ELSE canonical.status
        END,
        completed_date = COALESCE(canonical.completed_date, legacy.completed_date),
        score = GREATEST(canonical.score, legacy.score),
        best_score = GREATEST(canonical.best_score, legacy.best_score),
        assessment_passed = canonical.assessment_passed OR legacy.assessment_passed,
        assessment_attempts = canonical.assessment_attempts + legacy.assessment_attempts
      FROM training_enrollments legacy
      WHERE legacy.course_id = duplicate_id
        AND canonical.course_id = canonical_id
        AND canonical.employee_id IS NOT DISTINCT FROM legacy.employee_id;

      UPDATE training_assessment_attempts attempt
      SET
        enrollment_id = canonical.id,
        course_id = canonical_id
      FROM training_enrollments legacy
      JOIN training_enrollments canonical
        ON canonical.course_id = canonical_id
       AND canonical.employee_id IS NOT DISTINCT FROM legacy.employee_id
      WHERE attempt.enrollment_id = legacy.id
        AND legacy.course_id = duplicate_id;

      DELETE FROM training_enrollments legacy
      WHERE legacy.course_id = duplicate_id
        AND EXISTS (
          SELECT 1
          FROM training_enrollments canonical
          WHERE canonical.course_id = canonical_id
            AND canonical.employee_id IS NOT DISTINCT FROM legacy.employee_id
        );
      UPDATE training_enrollments SET course_id = canonical_id WHERE course_id = duplicate_id;

      DELETE FROM training_path_courses legacy
      WHERE legacy.course_id = duplicate_id
        AND EXISTS (
          SELECT 1
          FROM training_path_courses canonical
          WHERE canonical.course_id = canonical_id
            AND canonical.path_id = legacy.path_id
        );
      UPDATE training_path_courses SET course_id = canonical_id WHERE course_id = duplicate_id;

      DELETE FROM training_assessment_questions legacy
      WHERE legacy.course_id = duplicate_id
        AND EXISTS (
          SELECT 1
          FROM training_assessment_questions canonical
          WHERE canonical.course_id = canonical_id
            AND canonical.sort_order = legacy.sort_order
        );
      UPDATE training_assessment_questions SET course_id = canonical_id WHERE course_id = duplicate_id;
      UPDATE training_assessment_attempts SET course_id = canonical_id WHERE course_id = duplicate_id;
      UPDATE training_sessions SET course_id = canonical_id WHERE course_id = duplicate_id;
      UPDATE training_certificates SET course_id = canonical_id WHERE course_id = duplicate_id;
      UPDATE training_certificates SET renewal_course_id = canonical_id WHERE renewal_course_id = duplicate_id;
      DELETE FROM training_courses WHERE id = duplicate_id;
    END LOOP;

    UPDATE learning_paths
    SET courses = replace(
      courses::text,
      to_jsonb(course_alias.legacy_title)::text,
      to_jsonb(course_alias.canonical_title)::text
    )::jsonb
    WHERE courses::text LIKE '%' || course_alias.legacy_title || '%';

    UPDATE training_needs
    SET course_name = course_alias.canonical_title
    WHERE lower(course_name) = lower(course_alias.legacy_title);
  END LOOP;
END $$;

WITH questions(course_title, sort_order, question, options, correct_index, explanation) AS (
  VALUES
  ('Prevention of Sexual Harassment & Respectful Workplace',1,'Which factor is most important when deciding whether conduct may be harassment?','["Whether it was unwelcome and its impact/context","Whether it happened after work","Whether the speaker says it was a joke","Whether anyone else saw it"]'::jsonb,0,'Unwelcome conduct and its context or impact are central; intent alone does not decide the issue.'),
  ('Prevention of Sexual Harassment & Respectful Workplace',2,'A colleague reports unwelcome messages from a client. What should a manager do first?','["Privately investigate the client","Tell the colleague to ignore it","Ensure safety, listen, preserve facts, and escalate through the defined channel","Post a warning in the team chat"]'::jsonb,2,'Managers should support, document factual information, and promptly use the formal escalation process.'),
  ('Prevention of Sexual Harassment & Respectful Workplace',3,'Which is an appropriate bystander response?','["Share screenshots widely","Use direct, distract, delegate, delay, or document techniques when safe","Confront everyone publicly","Wait until the annual survey"]'::jsonb,1,'The five intervention approaches provide proportionate and safer options.'),
  ('Prevention of Sexual Harassment & Respectful Workplace',4,'What does non-retaliation mean?','["Reports must always be anonymous","Good-faith reporters and participants must not be punished for raising or supporting a concern","Managers cannot ask factual questions","Every complaint must produce dismissal"]'::jsonb,1,'Retaliation against good-faith reporting or participation is prohibited.'),
  ('Prevention of Sexual Harassment & Respectful Workplace',5,'Where can workplace harassment occur?','["Only in the office","Only during working hours","Across offices, remote channels, travel, events, and work-related third-party interactions","Only between a manager and direct report"]'::jsonb,2,'Workplace obligations extend to work-connected physical and digital environments.'),

  ('Information Security, Phishing & Account Protection',1,'You receive an unexpected MFA approval prompt. What should you do?','["Approve it to stop the prompts","Reject it and report possible credential compromise","Ignore it for a week","Ask for the OTP by email"]'::jsonb,1,'Unexpected MFA prompts can indicate stolen credentials and should be rejected and reported.'),
  ('Information Security, Phishing & Account Protection',2,'A senior leader sends an urgent secret request to buy gift cards. What is the safest response?','["Act immediately","Reply with card numbers","Verify through a separate trusted channel and report suspicion","Forward it to external contacts"]'::jsonb,2,'Urgency, secrecy, and unusual payment requests are common social-engineering indicators.'),
  ('Information Security, Phishing & Account Protection',3,'Where should unique work passwords be stored?','["A shared spreadsheet","The approved enterprise password manager","A note attached to the monitor","A personal messaging app"]'::jsonb,1,'Approved password managers protect unique credentials and support controlled sharing.'),
  ('Information Security, Phishing & Account Protection',4,'After clicking a suspicious link and entering credentials, what should you do first?','["Delete the message and say nothing","Report immediately and follow credential-reset/containment instructions","Wait to see whether anything happens","Post the event publicly"]'::jsonb,1,'Rapid reporting enables containment; preserve evidence and follow the response team’s direction.'),
  ('Information Security, Phishing & Account Protection',5,'Which access principle should be used for cloud and production systems?','["Permanent administrator rights for everyone","Least privilege with separate approved privileged access","Shared root credentials","Access based only on seniority"]'::jsonb,1,'Least privilege limits exposure and supports accountability.'),

  ('Data Privacy & Secure Data Handling',1,'What does data minimisation require?','["Collect all available information","Collect and retain only what is necessary for the authorised purpose","Keep data forever","Copy production data into every test system"]'::jsonb,1,'Only necessary data should be collected, used, and retained.'),
  ('Data Privacy & Secure Data Handling',2,'You receive a customer request to delete their data. What should you do?','["Delete records immediately without verification","Ignore it","Forward it promptly to the privacy process and preserve required records","Ask the customer to contact engineering directly"]'::jsonb,2,'Formal requests require identity verification, legal checks, and tracked response timelines.'),
  ('Data Privacy & Secure Data Handling',3,'What is the correct way to share sensitive data with a vendor?','["Any free file-sharing site","An approved channel after confirming purpose, access, and contractual controls","Personal email","Public source repository"]'::jsonb,1,'Sensitive transfers require approved technical and contractual safeguards.'),
  ('Data Privacy & Secure Data Handling',4,'A spreadsheet containing personal data is sent to the wrong recipient. What is this?','["Not an issue if accidental","A potential data incident that must be reported immediately","Only a problem after 30 days","The recipient’s responsibility"]'::jsonb,1,'Accidental disclosure is a potential incident; authorised teams determine notification duties.'),
  ('Data Privacy & Secure Data Handling',5,'Does having system access permit reuse of personal data for a new purpose?','["Yes, access equals permission","Only if the new use is authorised and has an appropriate basis","Yes, for any internal project","Yes, if no one notices"]'::jsonb,1,'Access is limited to authorised purposes; new uses require review.'),

  ('Security Incident Recognition & Reporting',1,'When should a suspected security incident be reported internally?','["After collecting proof for several days","Immediately through the defined incident channel","At the next monthly meeting","Only if a customer complains"]'::jsonb,1,'Fast internal reporting lets authorised responders meet containment and regulatory timelines.'),
  ('Security Incident Recognition & Reporting',2,'What information is most useful in an initial report?','["Rumours and blame","Who, what, when, where, observed indicators, actions taken, and impact","Only a screenshot","A proposed public statement"]'::jsonb,1,'Factual context enables triage without contaminating evidence.'),
  ('Security Incident Recognition & Reporting',3,'What should you do with an affected device?','["Wipe it immediately","Follow response-team instructions and preserve evidence","Post its logs publicly","Continue testing random fixes"]'::jsonb,1,'Uncoordinated actions can destroy evidence or worsen impact.'),
  ('Security Incident Recognition & Reporting',4,'Which event should be reported?','["Only confirmed malware","Lost equipment, exposed secrets, suspicious access, misdirected data, or unusual service activity","Only incidents affecting executives","Only incidents during office hours"]'::jsonb,1,'Report suspected incidents and near misses; the response team determines severity.'),
  ('Security Incident Recognition & Reporting',5,'Who decides whether external notification is required?','["Any employee involved","Authorised security, privacy, legal, and leadership responders","The first person who sees the alert","A public chat group"]'::jsonb,1,'External reporting is coordinated by authorised teams against applicable obligations.'),

  ('Code of Conduct, Ethics & Acceptable Use',1,'You are evaluating a vendor owned by a close relative. What should you do?','["Hide the relationship","Disclose the conflict and step back as directed","Approve the vendor quickly","Ask the relative for a gift"]'::jsonb,1,'Actual or perceived conflicts must be disclosed and managed.'),
  ('Code of Conduct, Ethics & Acceptable Use',2,'Can confidential source code be uploaded to an unapproved public AI tool?','["Yes, if the answer is useful","No; use only approved tools and permitted data","Yes, outside office hours","Yes, after removing one file name"]'::jsonb,1,'Confidential information must stay within approved services and controls.'),
  ('Code of Conduct, Ethics & Acceptable Use',3,'A supplier offers an expensive personal gift during a tender. What should you do?','["Accept it secretly","Disclose and decline or follow the gifts-and-hospitality approval process","Give it to a colleague without recording it","Promise the supplier favourable treatment"]'::jsonb,1,'Gifts that could influence—or appear to influence—a decision require disclosure and control.'),
  ('Code of Conduct, Ethics & Acceptable Use',4,'What protects a good-faith employee who reports suspected misconduct?','["A non-retaliation commitment","A guarantee that every allegation is proven","Permission to share confidential investigations","Automatic promotion"]'::jsonb,0,'Good-faith reporters and investigation participants must not face retaliation.'),
  ('Code of Conduct, Ethics & Acceptable Use',5,'Which is acceptable use of company systems?','["Installing unlicensed software","Bypassing endpoint protection","Using approved tools for authorised work and following security policy","Sharing an account with a friend"]'::jsonb,2,'Company systems must be used lawfully, professionally, and within approved controls.')
)
INSERT INTO training_assessment_questions (
  course_id, sort_order, question, options, correct_option_index, explanation
)
SELECT c.id, q.sort_order, q.question, q.options, q.correct_index, q.explanation
FROM questions q
JOIN training_courses c ON lower(c.title) = lower(q.course_title)
ON CONFLICT (course_id, sort_order) DO UPDATE SET
  question = EXCLUDED.question,
  options = EXCLUDED.options,
  correct_option_index = EXCLUDED.correct_option_index,
  explanation = EXCLUDED.explanation;

-- Assign the new mandatory curriculum to employees who are already onboarded.
INSERT INTO training_enrollments (
  employee_id, employee_name, course_id, mandatory, assessment_required, status, progress,
  enrolled_date, enrolled_at, due_date
)
SELECT
  e.id,
  e.name,
  c.id,
  true,
  c.assessment_required,
  'Enrolled',
  0,
  CURRENT_DATE,
  now(),
  CURRENT_DATE + c.deadline_days
FROM employees e
CROSS JOIN training_courses c
WHERE e.status = 'Active'
  AND c.mandatory = true
  AND c.is_active = true
ON CONFLICT (employee_id, course_id) DO NOTHING;

UPDATE training_enrollments e
SET
  mandatory = c.mandatory,
  assessment_required = c.assessment_required
FROM training_courses c
WHERE e.course_id = c.id;

INSERT INTO notifications (user_id, title, body, message, type, link)
SELECT
  e.auth_user_id::text,
  'Mandatory training assigned',
  'Prevention of Sexual Harassment and Respectful Workplace training has been assigned as mandatory. Complete it within the organizational 30-day timeline and achieve at least 80% on the assessment.',
  'Prevention of Sexual Harassment and Respectful Workplace training has been assigned as mandatory. Complete it within the organizational 30-day timeline and achieve at least 80% on the assessment.',
  'mandatory_training_assigned',
  '/training'
FROM employees e
WHERE e.status = 'Active'
  AND e.auth_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM notifications n
    WHERE n.user_id = e.auth_user_id::text
      AND n.type = 'mandatory_training_assigned'
      AND n.title = 'Mandatory training assigned'
  );

-- >>> LEGACY SOURCE: 29_workflow_reliability.sql

-- Workflow automation contract and trace hardening.
-- Safe to run repeatedly after 01_schema.sql and 02_seed_data.sql.

-- Older bundled workflows use the pre-builder node format (`next`, root-level
-- approval config, and trigger names in trigger_type). Keep them available for
-- reference, but do not leave definitions active when the executor cannot run
-- them safely. The mounted API can seed compatible replacements.
UPDATE workflow_definitions
SET
  status = 'paused',
  updated_at = NOW()
WHERE status = 'active'
  AND (
    trigger_type NOT IN ('manual', 'event', 'scheduled')
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(nodes, '[]'::jsonb)) AS node
      WHERE node ? 'next'
        AND NOT node ? 'connections'
    )
  );

-- Install a small, fully executable starter set. These definitions deliberately
-- use only node types supported by the durable executor.
INSERT INTO workflow_definitions (
  name,
  description,
  status,
  trigger_type,
  trigger_config,
  nodes,
  version,
  is_template,
  category,
  tags
) VALUES
(
  'Leave Request Approval',
  'Routes a submitted leave request to a manager for approval.',
  'active',
  'event',
  '{"event_key":"leave_applied"}'::jsonb,
  '[
    {"id":"leave-start","type":"trigger","label":"Leave submitted","config":{},"position":{"x":100,"y":160},"connections":["leave-notify"]},
    {"id":"leave-notify","type":"notification","label":"Notify managers","config":{"recipients_role":"manager","title":"Leave request pending","message":"A leave request requires review.","link":"/workflow-dashboard"},"position":{"x":320,"y":160},"connections":["leave-approval"]},
    {"id":"leave-approval","type":"approval","label":"Manager approval","config":{"approver_role":"manager","step_name":"Manager approval"},"position":{"x":540,"y":160},"connections":["leave-end"]},
    {"id":"leave-end","type":"end","label":"Complete","config":{},"position":{"x":760,"y":160},"connections":[]}
  ]'::jsonb,
  1,
  FALSE,
  'HR',
  '["default"]'::jsonb
),
(
  'Payroll Run Approval',
  'Routes an initiated payroll run to Finance for approval.',
  'active',
  'event',
  '{"event_key":"payroll_run_initiated"}'::jsonb,
  '[
    {"id":"payroll-start","type":"trigger","label":"Payroll initiated","config":{},"position":{"x":100,"y":160},"connections":["payroll-notify"]},
    {"id":"payroll-notify","type":"notification","label":"Notify Finance","config":{"recipients_role":"finance","title":"Payroll approval required","message":"A payroll run requires approval.","link":"/workflow-dashboard"},"position":{"x":320,"y":160},"connections":["payroll-approval"]},
    {"id":"payroll-approval","type":"approval","label":"Finance approval","config":{"approver_role":"finance","step_name":"Finance approval"},"position":{"x":540,"y":160},"connections":["payroll-end"]},
    {"id":"payroll-end","type":"end","label":"Complete","config":{},"position":{"x":760,"y":160},"connections":[]}
  ]'::jsonb,
  1,
  FALSE,
  'Finance',
  '["default"]'::jsonb
),
(
  'Onboarding Team Notification',
  'Notifies HR and IT when an onboarding record is started.',
  'active',
  'event',
  '{"event_key":"onboarding_started"}'::jsonb,
  '[
    {"id":"onboarding-start","type":"trigger","label":"Onboarding started","config":{},"position":{"x":100,"y":160},"connections":["onboarding-it"]},
    {"id":"onboarding-it","type":"notification","label":"Notify IT","config":{"recipients_role":"it","title":"New onboarding started","message":"Please prepare access and equipment.","link":"/onboarding"},"position":{"x":320,"y":100},"connections":["onboarding-hr"]},
    {"id":"onboarding-hr","type":"notification","label":"Notify HR","config":{"recipients_role":"hr","title":"Onboarding workflow started","message":"A new employee onboarding record has been created.","link":"/onboarding"},"position":{"x":540,"y":220},"connections":["onboarding-end"]},
    {"id":"onboarding-end","type":"end","label":"Complete","config":{},"position":{"x":760,"y":160},"connections":[]}
  ]'::jsonb,
  1,
  FALSE,
  'HR',
  '["default"]'::jsonb
)
ON CONFLICT (lower(name)) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_wf_definitions_trigger
  ON workflow_definitions (status, trigger_type);

CREATE INDEX IF NOT EXISTS idx_wf_instances_definition_started
  ON workflow_instances (definition_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_wf_instance_steps_status
  ON workflow_instance_steps (instance_id, status);

-- The original gap migration intentionally omitted the foreign key. Add it
-- only when it is not already present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workflow_instance_steps_instance_id_fkey'
  ) THEN
    ALTER TABLE workflow_instance_steps
      ADD CONSTRAINT workflow_instance_steps_instance_id_fkey
      FOREIGN KEY (instance_id)
      REFERENCES workflow_instances(id)
      ON DELETE CASCADE;
  END IF;
END;
$$;
