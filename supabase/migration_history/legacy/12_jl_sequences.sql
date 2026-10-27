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
