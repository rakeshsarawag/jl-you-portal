-- ============================================================
-- Jeshan Labs HR Portal — Full Migration Suite
-- Generated from scripts/migration-manifest.mjs
--
-- HOW TO RUN:
--   1. Open the Supabase SQL editor:
--      https://supabase.com/dashboard/project/icmexriwtsjwpswexyrb/sql/new
--   2. Paste the entire contents of this file
--   3. Click "Run"
--
-- Statements are written for repeat execution using existence checks,
-- replacement guards, and conflict-safe data operations.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- File: 01_schema.sql
-- Purpose: Core schema, tables, indexes, functions, and base RLS
-- ────────────────────────────────────────────────────────────

-- ============================================================
-- JESHAN LABS HR PORTAL - 01_schema.sql
-- ALL DDL: extensions, tables, indexes, constraints, functions,
-- triggers, RLS policies. No seed/master/demo data.
-- Fully idempotent: safe to run multiple times.
-- ============================================================

-- ------------------------------------------------------------
-- SOURCE: 01_schema_and_seed.sql
-- ------------------------------------------------------------
-- ============================================================
-- JESHAN LABS HR PORTAL — CONSOLIDATED SCHEMA + SEED
-- Merged from: 01_schema.sql + 02_seed.sql + 03_defect_tracker.sql + 04_pm_master.sql
-- Fully idempotent: safe to run multiple times.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- SOURCE: 01_schema.sql
-- ────────────────────────────────────────────────────────────

-- ============================================================
-- JESHAN LABS HR PORTAL — COMPLETE CONSOLIDATED SCHEMA
-- Combines migrations 001 + 002 + 003 + 004 into a single file.
-- All 77 tables, audit columns baked in, idempotent.
-- Run this once in Supabase SQL Editor on a fresh database.
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── updated_at trigger function ───────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SECTION 1: CORE / SHARED TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  department TEXT,
  job_title TEXT,
  location TEXT DEFAULT 'Head Office',
  join_date DATE,
  manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'On Leave')),
  profile_picture TEXT,
  skills JSONB DEFAULT '[]'::jsonb,
  auth_user_id UUID,
  onboarding_id TEXT,
  emergency_contact JSONB DEFAULT NULL,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_auth_user_id ON employees(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager_id ON employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_created_by ON employees(created_by);

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  roles JSONB DEFAULT '["employee"]'::jsonb,
  primary_role TEXT DEFAULT 'employee',
  department TEXT,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  auth_user_id UUID,
  permission_overrides JSONB DEFAULT '[]'::jsonb,
  last_login TIMESTAMPTZ,
  onboarding_id TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);
CREATE INDEX IF NOT EXISTS idx_app_users_auth_user_id ON app_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_app_users_employee_id ON app_users(employee_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  details TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================================
-- SECTION 2: RECRUITMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS recruitment_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  department TEXT,
  location TEXT,
  type TEXT DEFAULT 'Full-time' CHECK (type IN ('Full-time', 'Part-time', 'Contract', 'Internship')),
  experience TEXT,
  description TEXT,
  requirements JSONB DEFAULT '[]'::jsonb,
  posted_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Closed')),
  applicants INTEGER DEFAULT 0,
  platforms JSONB DEFAULT '["Company Website"]'::jsonb,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recruitment_jobs_status ON recruitment_jobs(status);
CREATE INDEX IF NOT EXISTS idx_recruitment_jobs_department ON recruitment_jobs(department);

CREATE TABLE IF NOT EXISTS recruitment_candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  position TEXT,
  department TEXT,
  job_id UUID REFERENCES recruitment_jobs(id) ON DELETE SET NULL,
  experience INTEGER DEFAULT 0,
  current_company TEXT,
  current_salary TEXT,
  expected_salary TEXT,
  notice_period TEXT,
  source TEXT DEFAULT 'Job Portal' CHECK (source IN ('Email', 'Job Portal', 'Referral', 'LinkedIn', 'Walk-in', 'Excel Upload', 'Other')),
  stage TEXT DEFAULT 'Applied' CHECK (stage IN ('Applied', 'Screening', 'Interview Scheduled', 'Interview Done', 'HR Round Done', 'Offer Sent', 'Offer Accepted', 'Hired', 'Rejected')),
  applied_date DATE DEFAULT CURRENT_DATE,
  resume_url TEXT,
  rating DECIMAL(3,1) DEFAULT 0,
  skills JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'On Hold', 'Closed')),
  hiring_manager TEXT,
  notes TEXT,
  offer_sent_date DATE,
  offer_accepted_date DATE,
  expected_joining_date DATE,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recruitment_candidates_email ON recruitment_candidates(email);
CREATE INDEX IF NOT EXISTS idx_recruitment_candidates_stage ON recruitment_candidates(stage);
CREATE INDEX IF NOT EXISTS idx_recruitment_candidates_job_id ON recruitment_candidates(job_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_candidates_created_by ON recruitment_candidates(created_by);

CREATE TABLE IF NOT EXISTS recruitment_interviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES recruitment_candidates(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('Phone', 'Video', 'In-Person', 'Technical', 'HR')),
  interview_date DATE,
  interview_time TEXT,
  interviewer TEXT,
  duration TEXT,
  meeting_link TEXT,
  status TEXT DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Completed', 'Cancelled', 'Rescheduled')),
  notes TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recruitment_interviews_candidate_id ON recruitment_interviews(candidate_id);

CREATE TABLE IF NOT EXISTS recruitment_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES recruitment_candidates(id) ON DELETE CASCADE,
  interview_id UUID REFERENCES recruitment_interviews(id) ON DELETE SET NULL,
  interviewer TEXT,
  feedback_date DATE DEFAULT CURRENT_DATE,
  rating DECIMAL(3,1),
  technical_skills DECIMAL(3,1),
  communication DECIMAL(3,1),
  cultural_fit DECIMAL(3,1),
  comments TEXT,
  recommendation TEXT CHECK (recommendation IN ('Hire', 'Maybe', 'Reject')),
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recruitment_feedback_candidate_id ON recruitment_feedback(candidate_id);

-- ============================================================
-- SECTION 3: ONBOARDING
-- ============================================================

CREATE TABLE IF NOT EXISTS onboarding_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  candidate_id UUID REFERENCES recruitment_candidates(id) ON DELETE SET NULL,
  employee_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  department TEXT,
  position TEXT,
  start_date DATE,
  manager TEXT,
  buddy TEXT,
  location TEXT,
  status TEXT DEFAULT 'not-started' CHECK (status IN ('not-started', 'in-progress', 'completed', 'Pending', 'In Progress', 'Completed')),
  progress INTEGER DEFAULT 0,
  completed_tasks INTEGER DEFAULT 0,
  total_tasks INTEGER DEFAULT 0,
  notes TEXT,
  portal_access_enabled BOOLEAN DEFAULT FALSE,
  auth_user_id UUID,
  account_created_date TIMESTAMPTZ,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_records_email ON onboarding_records(email);
CREATE INDEX IF NOT EXISTS idx_onboarding_records_employee_id ON onboarding_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_records_candidate_id ON onboarding_records(candidate_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_records_status ON onboarding_records(status);

CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  onboarding_id UUID NOT NULL REFERENCES onboarding_records(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'Pending', 'In Progress', 'Completed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  assigned_to TEXT,
  due_date DATE,
  completed_date DATE,
  task_order INTEGER DEFAULT 0,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_onboarding_id ON onboarding_tasks(onboarding_id);

CREATE TABLE IF NOT EXISTS onboarding_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  onboarding_id UUID NOT NULL REFERENCES onboarding_records(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('Offer Letter', 'NDA', 'Policy', 'Tax Form', 'Other')),
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Signed', 'Approved')),
  url TEXT,
  uploaded_date TIMESTAMPTZ DEFAULT NOW(),
  signed_date TIMESTAMPTZ,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_documents_onboarding_id ON onboarding_documents(onboarding_id);

CREATE TABLE IF NOT EXISTS onboarding_welcome_kits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  onboarding_id UUID NOT NULL REFERENCES onboarding_records(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'Not Ordered' CHECK (status IN ('Not Ordered', 'Ordered', 'Shipped', 'Delivered')),
  items JSONB DEFAULT '[]'::jsonb,
  tracking_number TEXT,
  delivery_date DATE,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_welcome_kits_onboarding_id ON onboarding_welcome_kits(onboarding_id);

CREATE TABLE IF NOT EXISTS onboarding_workflow_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  department TEXT,
  steps JSONB DEFAULT '[]'::jsonb,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS onboarding_signature_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  onboarding_id UUID REFERENCES onboarding_records(id) ON DELETE CASCADE,
  employee_id UUID,
  document_name TEXT NOT NULL,
  document_type TEXT,
  document_url TEXT,
  signer_name TEXT,
  signer_email TEXT,
  due_date DATE,
  signed_date TIMESTAMPTZ,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Sent', 'Signed', 'Expired', 'Declined')),
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_signatures_onboarding ON onboarding_signature_requests(onboarding_id);

-- ============================================================
-- SECTION 4: EMPLOYEE DASHBOARD
-- ============================================================

CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  employee_name TEXT,
  user_id TEXT,
  attendance_date DATE DEFAULT CURRENT_DATE,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  duration_minutes INTEGER,
  status TEXT DEFAULT 'Present' CHECK (status IN ('Present', 'Absent', 'Late', 'Half Day', 'Work From Home')),
  notes TEXT,
  work_mode TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(user_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_created_by ON attendance(created_by);

CREATE TABLE IF NOT EXISTS leaves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  employee_name TEXT,
  user_id TEXT,
  leave_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days INTEGER DEFAULT 1,
  reason TEXT,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Cancelled')),
  approver TEXT,
  approved_date TIMESTAMPTZ,
  rejection_reason TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leaves_employee_id ON leaves(employee_id);
CREATE INDEX IF NOT EXISTS idx_leaves_user_id ON leaves(user_id);
CREATE INDEX IF NOT EXISTS idx_leaves_status ON leaves(status);
CREATE INDEX IF NOT EXISTS idx_leaves_created_by ON leaves(created_by);

CREATE TABLE IF NOT EXISTS leave_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  employee_name TEXT,
  user_id TEXT NOT NULL,
  user_email TEXT,
  year INTEGER DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER,
  annual_total INTEGER DEFAULT 18,
  annual_used INTEGER DEFAULT 0,
  annual_remaining INTEGER DEFAULT 18,
  sick_total INTEGER DEFAULT 12,
  sick_used INTEGER DEFAULT 0,
  sick_remaining INTEGER DEFAULT 12,
  casual_total INTEGER DEFAULT 6,
  casual_used INTEGER DEFAULT 0,
  casual_remaining INTEGER DEFAULT 6,
  maternity_total INTEGER DEFAULT 180,
  maternity_used INTEGER DEFAULT 0,
  maternity_remaining INTEGER DEFAULT 180,
  paternity_total INTEGER DEFAULT 15,
  paternity_used INTEGER DEFAULT 0,
  paternity_remaining INTEGER DEFAULT 15,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, year)
);

CREATE INDEX IF NOT EXISTS idx_leave_balances_user_id ON leave_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_id ON leave_balances(employee_id);

CREATE TABLE IF NOT EXISTS employee_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed')),
  completed_date TIMESTAMPTZ,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_tasks_user_id ON employee_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_tasks_employee_id ON employee_tasks(employee_id);

CREATE TABLE IF NOT EXISTS employee_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document_type TEXT,
  url TEXT,
  status TEXT DEFAULT 'Pending',
  expiry_date DATE,
  notes TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_documents_employee ON employee_documents(employee_id);

-- ============================================================
-- SECTION 5: PERFORMANCE
-- ============================================================

CREATE TABLE IF NOT EXISTS performance_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  employee_name TEXT,
  reviewer_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  reviewer_name TEXT,
  period TEXT,
  review_date DATE DEFAULT CURRENT_DATE,
  overall_rating DECIMAL(3,1),
  goals_rating DECIMAL(3,1),
  competencies_rating DECIMAL(3,1),
  manager_comments TEXT,
  employee_comments TEXT,
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'In Progress', 'Submitted', 'Acknowledged', 'Completed')),
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_performance_reviews_employee_id ON performance_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_reviewer_id ON performance_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_created_by ON performance_reviews(created_by);

CREATE TABLE IF NOT EXISTS performance_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  employee_name TEXT,
  title TEXT NOT NULL,
  description TEXT,
  target_value TEXT,
  current_value TEXT,
  weight DECIMAL(5,2) DEFAULT 0,
  status TEXT DEFAULT 'Not Started' CHECK (status IN ('Not Started', 'In Progress', 'Completed', 'Cancelled')),
  due_date DATE,
  period TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_performance_goals_employee_id ON performance_goals(employee_id);

CREATE TABLE IF NOT EXISTS performance_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  reviewer_name TEXT,
  feedback_type TEXT CHECK (feedback_type IN ('Peer', 'Manager', '360', 'Self')),
  rating DECIMAL(3,1),
  comments TEXT,
  period TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_performance_feedback_employee_id ON performance_feedback(employee_id);

CREATE TABLE IF NOT EXISTS performance_pips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  employee_name TEXT,
  manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  goals JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'Cancelled')),
  outcome TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_performance_pips_employee_id ON performance_pips(employee_id);

CREATE TABLE IF NOT EXISTS performance_cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Active', 'Closed')),
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECTION 6: TRAINING
-- ============================================================

CREATE TABLE IF NOT EXISTS training_courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  instructor TEXT,
  duration_hours DECIMAL(6,2),
  type TEXT DEFAULT 'Online' CHECK (type IN ('Online', 'In-Person', 'Blended', 'Self-paced')),
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Draft')),
  max_capacity INTEGER,
  passing_score INTEGER DEFAULT 70,
  tags JSONB DEFAULT '[]'::jsonb,
  thumbnail_url TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_courses_status ON training_courses(status);
CREATE INDEX IF NOT EXISTS idx_training_courses_category ON training_courses(category);

CREATE TABLE IF NOT EXISTS training_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  employee_name TEXT,
  course_id UUID NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
  enrolled_date DATE DEFAULT CURRENT_DATE,
  progress INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Enrolled' CHECK (status IN ('Enrolled', 'In Progress', 'Completed', 'Dropped')),
  completed_date DATE,
  score INTEGER,
  time_spent_minutes INTEGER DEFAULT 0,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_training_enrollments_employee_id ON training_enrollments(employee_id);
CREATE INDEX IF NOT EXISTS idx_training_enrollments_course_id ON training_enrollments(course_id);

CREATE TABLE IF NOT EXISTS training_certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  employee_name TEXT,
  course_id UUID REFERENCES training_courses(id) ON DELETE SET NULL,
  course_title TEXT,
  certificate_number TEXT UNIQUE,
  issued_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_certificates_employee_id ON training_certificates(employee_id);

CREATE TABLE IF NOT EXISTS learning_paths (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  target_role TEXT,
  courses JSONB DEFAULT '[]'::jsonb,
  estimated_hours INTEGER DEFAULT 0,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS path_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  path_id UUID REFERENCES learning_paths(id) ON DELETE CASCADE,
  employee_id UUID,
  current_course_index INTEGER DEFAULT 0,
  status TEXT DEFAULT 'In Progress',
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_by TEXT,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_path_enrollments_employee ON path_enrollments(employee_id);
CREATE INDEX IF NOT EXISTS idx_path_enrollments_path ON path_enrollments(path_id);

-- ============================================================
-- SECTION 7: IT SERVICES
-- ============================================================

CREATE TABLE IF NOT EXISTS it_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number TEXT UNIQUE,
  requester_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  requester_name TEXT,
  requester_email TEXT,
  category TEXT,
  sub_category TEXT,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  status TEXT DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Pending', 'Resolved', 'Closed')),
  assigned_to TEXT,
  resolution TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_it_tickets_requester_id ON it_tickets(requester_id);
CREATE INDEX IF NOT EXISTS idx_it_tickets_status ON it_tickets(status);
CREATE INDEX IF NOT EXISTS idx_it_tickets_priority ON it_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_it_tickets_created_by ON it_tickets(created_by);

CREATE TABLE IF NOT EXISTS it_ticket_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES it_tickets(id) ON DELETE CASCADE,
  author_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  author_name TEXT,
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_it_ticket_comments_ticket_id ON it_ticket_comments(ticket_id);

-- ============================================================
-- SECTION 8: INVOICES
-- ============================================================

CREATE TABLE IF NOT EXISTS invoice_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'India',
  postal_code TEXT,
  gst_number TEXT,
  pan_number TEXT,
  payment_terms TEXT DEFAULT 'Net 30',
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_clients_company_name ON invoice_clients(company_name);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT UNIQUE NOT NULL,
  client_id UUID REFERENCES invoice_clients(id) ON DELETE SET NULL,
  client_name TEXT,
  invoice_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled')),
  subtotal DECIMAL(14,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(14,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 18,
  tax_amount DECIMAL(14,2) DEFAULT 0,
  total DECIMAL(14,2) DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  notes TEXT,
  terms TEXT,
  bank_details JSONB DEFAULT '{}'::jsonb,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON invoices(created_by);

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit TEXT DEFAULT 'Unit',
  rate DECIMAL(14,2) DEFAULT 0,
  amount DECIMAL(14,2) DEFAULT 0,
  item_order INTEGER DEFAULT 0,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1001;

-- ============================================================
-- SECTION 9: PAYROLL
-- ============================================================

CREATE TABLE IF NOT EXISTS payroll_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  employee_email TEXT,
  department TEXT,
  designation TEXT,
  month TEXT NOT NULL,
  year INTEGER NOT NULL,
  basic_salary DECIMAL(14,2) DEFAULT 0,
  hra DECIMAL(14,2) DEFAULT 0,
  transport_allowance DECIMAL(14,2) DEFAULT 0,
  medical_allowance DECIMAL(14,2) DEFAULT 0,
  other_allowances DECIMAL(14,2) DEFAULT 0,
  gross_salary DECIMAL(14,2) DEFAULT 0,
  pf_deduction DECIMAL(14,2) DEFAULT 0,
  tax_deduction DECIMAL(14,2) DEFAULT 0,
  other_deductions DECIMAL(14,2) DEFAULT 0,
  total_deductions DECIMAL(14,2) DEFAULT 0,
  net_salary DECIMAL(14,2) DEFAULT 0,
  lop_days INTEGER DEFAULT 0,
  lop_deduction DECIMAL(14,2) DEFAULT 0,
  working_days INTEGER DEFAULT 26,
  present_days DECIMAL(4,1) DEFAULT 0,
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Processed', 'Approved', 'Rejected', 'Paid', 'On Hold')),
  payment_date DATE,
  payment_method TEXT DEFAULT 'Bank Transfer',
  bank_account TEXT,
  notes TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_payroll_records_employee_id ON payroll_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_month_year ON payroll_records(month, year);
CREATE INDEX IF NOT EXISTS idx_payroll_records_status ON payroll_records(status);
CREATE INDEX IF NOT EXISTS idx_payroll_records_created_by ON payroll_records(created_by);

CREATE TABLE IF NOT EXISTS salary_structures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  employee_name TEXT,
  basic_salary NUMERIC(12,2) DEFAULT 0,
  hra NUMERIC(12,2) DEFAULT 0,
  transport_allowance NUMERIC(12,2) DEFAULT 0,
  medical_allowance NUMERIC(12,2) DEFAULT 0,
  other_allowances NUMERIC(12,2) DEFAULT 0,
  effective_from DATE,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_salary_structures_employee ON salary_structures(employee_id);

CREATE TABLE IF NOT EXISTS leave_encashment_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  employee_name TEXT,
  leave_type TEXT,
  days INTEGER DEFAULT 0,
  encashment_amount NUMERIC(12,2) DEFAULT 0,
  reason TEXT,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Processed')),
  approver TEXT,
  approved_date TIMESTAMPTZ,
  rejection_reason TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_encashment_employee ON leave_encashment_requests(employee_id, status);

-- ============================================================
-- SECTION 10: PROJECTS
-- ============================================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES invoice_clients(id) ON DELETE SET NULL,
  client_name TEXT,
  manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  manager_name TEXT,
  status TEXT DEFAULT 'Planning' CHECK (status IN ('Planning', 'Active', 'On Hold', 'Completed', 'Cancelled')),
  priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  start_date DATE,
  end_date DATE,
  budget DECIMAL(14,2),
  spent DECIMAL(14,2) DEFAULT 0,
  progress INTEGER DEFAULT 0,
  tags JSONB DEFAULT '[]'::jsonb,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_manager_id ON projects(manager_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  employee_name TEXT,
  role TEXT DEFAULT 'Member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_employee_id ON project_members(employee_id);

CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  assignee_name TEXT,
  status TEXT DEFAULT 'Todo' CHECK (status IN ('Todo', 'In Progress', 'Review', 'Done', 'Cancelled')),
  priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  due_date DATE,
  estimated_hours DECIMAL(8,2),
  actual_hours DECIMAL(8,2),
  tags JSONB DEFAULT '[]'::jsonb,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_assignee_id ON project_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON project_tasks(status);

CREATE TABLE IF NOT EXISTS project_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Missed')),
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_milestones_project ON project_milestones(project_id);

CREATE TABLE IF NOT EXISTS project_sprints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'Planning' CHECK (status IN ('Planning', 'Active', 'Completed', 'Cancelled')),
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_sprints_project ON project_sprints(project_id, status);

-- ============================================================
-- SECTION 11: ASSETS
-- ============================================================

CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_tag TEXT UNIQUE,
  name TEXT NOT NULL,
  type TEXT,
  category TEXT,
  serial_number TEXT,
  purchase_date DATE,
  purchase_cost DECIMAL(14,2),
  vendor TEXT,
  warranty_expiry DATE,
  status TEXT DEFAULT 'Available' CHECK (status IN ('Available', 'Assigned', 'In Repair', 'Retired', 'Lost')),
  condition TEXT DEFAULT 'Good' CHECK (condition IN ('Excellent', 'Good', 'Fair', 'Poor')),
  location TEXT,
  current_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  current_employee_name TEXT,
  assigned_date DATE,
  notes TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_current_employee_id ON assets(current_employee_id);
CREATE INDEX IF NOT EXISTS idx_assets_created_by ON assets(created_by);

CREATE TABLE IF NOT EXISTS asset_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  employee_name TEXT,
  assigned_date DATE DEFAULT CURRENT_DATE,
  returned_date DATE,
  condition_at_assign TEXT,
  condition_at_return TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_assignments_asset_id ON asset_assignments(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_employee_id ON asset_assignments(employee_id);

CREATE TABLE IF NOT EXISTS asset_maintenance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('Preventive', 'Corrective', 'Repair', 'Upgrade', 'Inspection')),
  maintenance_date DATE DEFAULT CURRENT_DATE,
  cost DECIMAL(14,2),
  performed_by TEXT,
  description TEXT,
  next_due_date DATE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_maintenance_asset_id ON asset_maintenance(asset_id);

-- ============================================================
-- SECTION 12: OKRs
-- ============================================================

CREATE TABLE IF NOT EXISTS okrs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  owner_name TEXT,
  department TEXT,
  period TEXT,
  progress INTEGER DEFAULT 0,
  status TEXT DEFAULT 'On Track' CHECK (status IN ('On Track', 'At Risk', 'Behind', 'Completed', 'Cancelled')),
  type TEXT DEFAULT 'Individual' CHECK (type IN ('Company', 'Department', 'Team', 'Individual')),
  parent_okr_id UUID REFERENCES okrs(id) ON DELETE SET NULL,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_okrs_owner_id ON okrs(owner_id);
CREATE INDEX IF NOT EXISTS idx_okrs_department ON okrs(department);
CREATE INDEX IF NOT EXISTS idx_okrs_period ON okrs(period);
CREATE INDEX IF NOT EXISTS idx_okrs_created_by ON okrs(created_by);

CREATE TABLE IF NOT EXISTS okr_key_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  okr_id UUID NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_value DECIMAL(14,2),
  current_value DECIMAL(14,2) DEFAULT 0,
  unit TEXT DEFAULT '%',
  progress INTEGER DEFAULT 0,
  status TEXT DEFAULT 'On Track' CHECK (status IN ('On Track', 'At Risk', 'Behind', 'Completed')),
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_okr_key_results_okr_id ON okr_key_results(okr_id);

CREATE TABLE IF NOT EXISTS okr_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_result_id UUID NOT NULL REFERENCES okr_key_results(id) ON DELETE CASCADE,
  author_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  author_name TEXT,
  value DECIMAL(14,2),
  comment TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_okr_updates_key_result_id ON okr_updates(key_result_id);

-- ============================================================
-- SECTION 13: KNOWLEDGE BASE
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT,
  category TEXT,
  author_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  author_name TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Published' CHECK (status IN ('Draft', 'Published', 'Archived')),
  is_featured BOOLEAN DEFAULT FALSE,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_articles_category ON knowledge_articles(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_author_id ON knowledge_articles(author_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_status ON knowledge_articles(status);

CREATE TABLE IF NOT EXISTS knowledge_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID REFERENCES knowledge_articles(id) ON DELETE CASCADE,
  author_id UUID,
  author_name TEXT,
  content TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_comments_article ON knowledge_comments(article_id);

CREATE TABLE IF NOT EXISTS knowledge_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID REFERENCES knowledge_articles(id) ON DELETE CASCADE,
  title TEXT,
  content_snapshot TEXT,
  edited_by TEXT,
  edited_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_versions_article ON knowledge_versions(article_id, created_at);

-- ============================================================
-- SECTION 14: COMMUNICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS communications_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT DEFAULT 'post',
  title TEXT,
  content TEXT,
  author_id UUID,
  author_name TEXT,
  audience TEXT DEFAULT 'all',
  status TEXT DEFAULT 'published',
  attachments JSONB DEFAULT '[]'::jsonb,
  tags JSONB DEFAULT '[]'::jsonb,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_posts_author ON communications_posts(author_id);

CREATE TABLE IF NOT EXISTS communications_announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT,
  author_id UUID,
  author_name TEXT,
  audience TEXT DEFAULT 'all',
  priority TEXT DEFAULT 'normal',
  pinned BOOLEAN DEFAULT FALSE,
  attachments JSONB DEFAULT '[]'::jsonb,
  tags JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'published',
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_announcements_pinned ON communications_announcements(pinned, created_at);

CREATE TABLE IF NOT EXISTS communications_polls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question TEXT NOT NULL,
  options JSONB DEFAULT '[]'::jsonb,
  votes JSONB DEFAULT '{}'::jsonb,
  audience TEXT DEFAULT 'all',
  author_id UUID,
  author_name TEXT,
  status TEXT DEFAULT 'active',
  ends_at TIMESTAMPTZ,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS communications_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  audience TEXT DEFAULT 'all',
  organizer_id UUID,
  organizer_name TEXT,
  status TEXT DEFAULT 'upcoming',
  rsvp_count INTEGER DEFAULT 0,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS communications_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'public',
  members JSONB DEFAULT '[]'::jsonb,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcement_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  announcement_id UUID REFERENCES communications_announcements(id) ON DELETE CASCADE,
  author_id UUID,
  author_name TEXT,
  content TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ann_comments_announcement ON announcement_comments(announcement_id);

CREATE TABLE IF NOT EXISTS announcement_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  announcement_id UUID REFERENCES communications_announcements(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ann_reactions_announcement ON announcement_reactions(announcement_id);

-- ============================================================
-- SECTION 15: NOTIFICATIONS & PUSH
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  message TEXT,
  type TEXT DEFAULT 'info',
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);

-- ============================================================
-- REUSABLE ENTITY ATTACHMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS entity_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  context_type TEXT NOT NULL DEFAULT 'entity',
  context_id TEXT,
  storage_bucket TEXT NOT NULL DEFAULT 'portal-attachments',
  storage_path TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  uploaded_by TEXT NOT NULL,
  uploaded_by_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_attachments_entity
  ON entity_attachments(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entity_attachments_context
  ON entity_attachments(context_type, context_id)
  WHERE context_id IS NOT NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('portal-attachments', 'portal-attachments', FALSE, 5242880, NULL)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

-- ============================================================
-- SECTION 16: WORKFLOW
-- ============================================================

CREATE TABLE IF NOT EXISTS workflow_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  trigger_type TEXT,
  trigger_config JSONB DEFAULT '{}'::jsonb,
  nodes JSONB DEFAULT '[]'::jsonb,
  version INTEGER DEFAULT 1,
  is_template BOOLEAN DEFAULT FALSE,
  category TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  definition_id UUID REFERENCES workflow_definitions(id) ON DELETE SET NULL,
  workflow_name TEXT,
  status TEXT DEFAULT 'running',
  current_node_id TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  entity_type TEXT,
  entity_id TEXT,
  started_by TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  history JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_wf_instances_status ON workflow_instances(status);

CREATE TABLE IF NOT EXISTS workflow_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_id UUID REFERENCES workflow_instances(id) ON DELETE CASCADE,
  definition_id UUID,
  workflow_name TEXT,
  step_name TEXT,
  entity_type TEXT,
  entity_id TEXT,
  requested_by TEXT,
  assignee_id TEXT,
  assignee_role TEXT,
  status TEXT DEFAULT 'pending',
  context JSONB DEFAULT '{}'::jsonb,
  comment TEXT,
  responded_by TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  escalated BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_wf_approvals_assignee ON workflow_approvals(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_wf_approvals_instance ON workflow_approvals(instance_id);

-- ============================================================
-- SECTION 17: LINKEDIN
-- ============================================================

CREATE TABLE IF NOT EXISTS linkedin_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT,
  content TEXT,
  post_type TEXT,
  tone TEXT,
  status TEXT DEFAULT 'draft',
  author_id TEXT,
  author_name TEXT,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  engagement JSONB DEFAULT '{}'::jsonb,
  tags JSONB DEFAULT '[]'::jsonb,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS linkedin_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  content TEXT,
  post_type TEXT,
  tone TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS linkedin_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT,
  date TIMESTAMPTZ,
  location TEXT,
  attendees INTEGER DEFAULT 0,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECTION 18: MASTER DATA
-- ============================================================

CREATE TABLE IF NOT EXISTS master_departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  head_id UUID,
  parent_id UUID,
  is_active BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS master_job_titles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  department TEXT,
  level TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS master_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  country TEXT,
  city TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS master_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS master_employment_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS master_currencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT,
  symbol TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS master_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  industry TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS master_value_helps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity TEXT NOT NULL,
  field TEXT NOT NULL,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_master_value_helps_entity ON master_value_helps(entity, field);

-- ============================================================
-- SECTION 19: PERMISSIONS & ROLES
-- ============================================================

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role TEXT NOT NULL UNIQUE,
  permissions JSONB DEFAULT '{}'::jsonb,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB DEFAULT '{}'::jsonb,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permission_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL,
  target_user TEXT,
  changed_by TEXT,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECTION 20: HR CONFIG
-- ============================================================

CREATE TABLE IF NOT EXISTS leave_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  leave_type TEXT NOT NULL,
  annual_days INTEGER DEFAULT 0,
  carry_forward BOOLEAN DEFAULT FALSE,
  max_carry_forward INTEGER DEFAULT 0,
  applicable_to TEXT DEFAULT 'all',
  is_active BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  date DATE NOT NULL,
  type TEXT DEFAULT 'public',
  location TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  category TEXT,
  variables JSONB DEFAULT '[]'::jsonb,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'employees','app_users','audit_logs',
    'recruitment_jobs','recruitment_candidates','recruitment_interviews','recruitment_feedback',
    'onboarding_records','onboarding_tasks','onboarding_documents',
    'onboarding_welcome_kits','onboarding_workflow_templates','onboarding_signature_requests',
    'attendance','leaves','leave_balances','employee_tasks','employee_documents',
    'performance_reviews','performance_goals','performance_feedback','performance_pips','performance_cycles',
    'training_courses','training_enrollments','training_certificates','learning_paths','path_enrollments',
    'it_tickets','it_ticket_comments',
    'invoice_clients','invoices','invoice_line_items',
    'payroll_records','salary_structures','leave_encashment_requests',
    'projects','project_members','project_tasks','project_milestones','project_sprints',
    'assets','asset_assignments','asset_maintenance',
    'okrs','okr_key_results','okr_updates',
    'knowledge_articles','knowledge_comments','knowledge_versions',
    'communications_posts','communications_announcements','communications_polls',
    'communications_events','communications_channels',
    'announcement_comments','announcement_reactions',
    'notifications','push_subscriptions',
    'workflow_definitions','workflow_instances','workflow_approvals',
    'linkedin_posts','linkedin_templates','linkedin_events',
    'master_departments','master_job_titles','master_locations','master_skills',
    'master_employment_types','master_currencies','master_clients','master_value_helps',
    'role_permissions','custom_roles','permission_audit_log',
    'leave_policies','holidays','email_templates'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Allow public read on employees (directory lookups)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'employees' AND policyname = 'Allow anonymous read on employees'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow anonymous read on employees" ON employees FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'employees' AND policyname = 'Allow service role full access on employees'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow service role full access on employees" ON employees FOR ALL USING (auth.role() = ''service_role'')';
  END IF;
END $$;

-- ============================================================
-- UPDATED_AT TRIGGERS — all tables with updated_at
-- ============================================================

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'employees','app_users',
    'recruitment_jobs','recruitment_candidates','recruitment_interviews','recruitment_feedback',
    'onboarding_records','onboarding_tasks','onboarding_documents',
    'onboarding_welcome_kits','onboarding_workflow_templates','onboarding_signature_requests',
    'attendance','leaves','leave_balances','employee_tasks','employee_documents',
    'performance_reviews','performance_goals','performance_feedback','performance_pips','performance_cycles',
    'training_courses','training_enrollments','training_certificates','learning_paths',
    'it_tickets','it_ticket_comments',
    'invoice_clients','invoices','invoice_line_items',
    'payroll_records','salary_structures','leave_encashment_requests',
    'projects','project_members','project_tasks','project_milestones','project_sprints',
    'assets','asset_assignments','asset_maintenance',
    'okrs','okr_key_results','okr_updates',
    'knowledge_articles','knowledge_comments','knowledge_versions',
    'communications_posts','communications_announcements','communications_polls',
    'communications_events','communications_channels',
    'workflow_definitions',
    'linkedin_posts','linkedin_templates','linkedin_events',
    'master_departments','master_job_titles','master_locations','master_skills',
    'master_employment_types','master_currencies','master_clients','master_value_helps',
    'custom_roles','role_permissions','leave_policies','holidays','email_templates'
  ]
  LOOP
    EXECUTE format(
      'CREATE OR REPLACE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      t, t
    );
  END LOOP;
END $$;


-- ============================================================
-- RLS POLICIES FOR NEW TABLES (notifications, push_subscriptions, role_permissions)
-- ============================================================

-- notifications
DROP POLICY IF EXISTS "Users can read their own notifications" ON notifications;
CREATE POLICY "Users can read their own notifications"
  ON notifications FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Service role can manage notifications" ON notifications;
CREATE POLICY "Service role can manage notifications"
  ON notifications FOR ALL TO service_role USING (true);

-- push_subscriptions
DROP POLICY IF EXISTS "Users can manage their own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can manage their own push subscriptions"
  ON push_subscriptions FOR ALL TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Service role can manage push_subscriptions" ON push_subscriptions;
CREATE POLICY "Service role can manage push_subscriptions"
  ON push_subscriptions FOR ALL TO service_role USING (true);

-- role_permissions (readable by all authenticated users, writable only by service_role)
DROP POLICY IF EXISTS "Authenticated users can read role_permissions" ON role_permissions;
CREATE POLICY "Authenticated users can read role_permissions"
  ON role_permissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role can manage role_permissions" ON role_permissions;
CREATE POLICY "Service role can manage role_permissions"
  ON role_permissions FOR ALL TO service_role USING (true);


-- ============================================================
-- SECTION: RECRUITMENT COLUMN EXTENSIONS
-- ============================================================

ALTER TABLE recruitment_candidates
  ADD COLUMN IF NOT EXISTS nationality            TEXT,
  ADD COLUMN IF NOT EXISTS serving_notice_period  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notice_period_end_date DATE,
  ADD COLUMN IF NOT EXISTS part_of_organization   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS previous_company        TEXT,
  ADD COLUMN IF NOT EXISTS attachments             JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS user_notes              TEXT;

ALTER TABLE recruitment_jobs
  ADD COLUMN IF NOT EXISTS work_mode       TEXT,
  ADD COLUMN IF NOT EXISTS salary_min      TEXT,
  ADD COLUMN IF NOT EXISTS salary_max      TEXT,
  ADD COLUMN IF NOT EXISTS headcount       INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deadline        DATE,
  ADD COLUMN IF NOT EXISTS hiring_manager  TEXT,
  ADD COLUMN IF NOT EXISTS required_skills JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS benefits        TEXT;


-- ============================================================
-- SECTION: ONBOARDING COLUMN EXTENSIONS
-- ============================================================

ALTER TABLE onboarding_records
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'Direct'
    CHECK (source IN ('Recruitment', 'Direct', 'Referral', 'Bulk Upload', 'Other'));


-- ============================================================
-- SECTION: ADDITIONAL TABLES (project_backlog_items, project_defects,
-- project_methodologies, it_kb_articles, it_linked_items,
-- it_sla_policies, it_ticket_categories, it_resolution_codes,
-- asset_vendors, asset_categories, asset_maintenance_types,
-- asset_documents, kv_store_1fe2c468)
-- ============================================================

-- ============================================================
-- Migration 05: Missing Tables & Column Additions
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Safe to run multiple times — all statements use IF NOT EXISTS / IF EXISTS guards
-- ============================================================

-- Enable uuid extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. COLUMN ADDITIONS TO EXISTING TABLES
-- ============================================================

-- projects: add rag_status column
ALTER TABLE projects ADD COLUMN IF NOT EXISTS rag_status TEXT DEFAULT 'Green'
  CHECK (rag_status IN ('Green', 'Amber', 'Red'));

-- project_members: server inserts 'joined_date' (date) but schema only has 'joined_at' (timestamptz)
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS joined_date DATE;

-- it_tickets: status check constraint includes 'Pending User' in the app but schema only allows 'Pending'
-- Drop the old constraint and re-add with the full list
ALTER TABLE it_tickets DROP CONSTRAINT IF EXISTS it_tickets_status_check;
ALTER TABLE it_tickets ADD CONSTRAINT it_tickets_status_check
  CHECK (status IN ('Open', 'In Progress', 'Pending', 'Pending User', 'Resolved', 'Closed'));

-- it_tickets: add assigned_to_name column (server stores agent name separately)
ALTER TABLE it_tickets ADD COLUMN IF NOT EXISTS assigned_to_name TEXT;

-- it_tickets: add source and impact fields used in the enhanced IT Services component
ALTER TABLE it_tickets ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE it_tickets ADD COLUMN IF NOT EXISTS impact TEXT;
ALTER TABLE it_tickets ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE it_tickets ADD COLUMN IF NOT EXISTS watchers JSONB DEFAULT '[]'::jsonb;

-- assets: add assigned_to / assigned_to_name aliases used by the hook normalizer
-- (current_employee_id / current_employee_name already cover this but the API also returns assigned_to)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS assigned_to_name TEXT;

-- ============================================================
-- 2. PROJECT BACKLOG ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS project_backlog_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_id TEXT,                      -- e.g. 'BLI-0001'
  type TEXT DEFAULT 'story'
    CHECK (type IN ('story', 'task', 'bug', 'epic', 'spike')),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'Medium'
    CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  status TEXT DEFAULT 'Backlog'
    CHECK (status IN ('Backlog', 'Ready', 'In Progress', 'Done', 'Cancelled')),
  story_points INTEGER DEFAULT 0,
  sprint_id UUID REFERENCES project_sprints(id) ON DELETE SET NULL,
  assignee_name TEXT,
  acceptance_criteria JSONB DEFAULT '[]'::jsonb,
  linked_tickets JSONB DEFAULT '[]'::jsonb,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlog_project_id ON project_backlog_items(project_id);
CREATE INDEX IF NOT EXISTS idx_backlog_sprint_id ON project_backlog_items(sprint_id);
CREATE INDEX IF NOT EXISTS idx_backlog_status ON project_backlog_items(status);

-- ============================================================
-- 3. PROJECT DEFECTS
-- ============================================================

CREATE TABLE IF NOT EXISTS project_defects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  defect_id TEXT,                    -- e.g. 'DEF-1234'
  title TEXT NOT NULL,
  severity TEXT DEFAULT 'S3'
    CHECK (severity IN ('S1', 'S2', 'S3', 'S4')),
  status TEXT DEFAULT 'Open'
    CHECK (status IN ('Open', 'In Progress', 'Fixed', 'Verified', 'Closed', 'Reopened')),
  priority TEXT DEFAULT 'Medium'
    CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  environment TEXT DEFAULT 'staging'
    CHECK (environment IN ('dev', 'staging', 'uat', 'production')),
  assignee_name TEXT,
  steps_to_reproduce JSONB DEFAULT '[]'::jsonb,
  expected_result TEXT,
  actual_result TEXT,
  linked_tickets JSONB DEFAULT '[]'::jsonb,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_defects_project_id ON project_defects(project_id);
CREATE INDEX IF NOT EXISTS idx_defects_status ON project_defects(status);
CREATE INDEX IF NOT EXISTS idx_defects_severity ON project_defects(severity);

-- ============================================================
-- 4. PROJECT METHODOLOGIES (Master Data)
-- ============================================================

CREATE TABLE IF NOT EXISTS project_methodologies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. IT KNOWLEDGE BASE ARTICLES
-- ============================================================

CREATE TABLE IF NOT EXISTS it_kb_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  excerpt TEXT,
  content TEXT,
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  author_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  author_name TEXT,
  helpful_votes INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  tags JSONB DEFAULT '[]'::jsonb,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_articles_category ON it_kb_articles(category);
CREATE INDEX IF NOT EXISTS idx_kb_articles_status ON it_kb_articles(status);

-- ============================================================
-- 6. IT LINKED ITEMS (tickets linked to external items)
-- ============================================================

CREATE TABLE IF NOT EXISTS it_linked_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES it_tickets(id) ON DELETE CASCADE,
  type TEXT,                         -- e.g. 'change_request', 'problem', 'asset'
  external_id TEXT,
  title TEXT,
  status TEXT DEFAULT 'Open',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_linked_items_ticket_id ON it_linked_items(ticket_id);

-- ============================================================
-- 7. IT SLA POLICIES
-- ============================================================

CREATE TABLE IF NOT EXISTS it_sla_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  first_response_mins INTEGER DEFAULT 60,
  resolution_mins INTEGER DEFAULT 480,
  business_hours_only BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. IT TICKET CATEGORIES
-- ============================================================

CREATE TABLE IF NOT EXISTS it_ticket_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT 'folder',
  sort_order INTEGER DEFAULT 0,
  default_sla_policy_id UUID REFERENCES it_sla_policies(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. IT RESOLUTION CODES
-- ============================================================

CREATE TABLE IF NOT EXISTS it_resolution_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. ASSET VENDORS
-- ============================================================

CREATE TABLE IF NOT EXISTS asset_vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  country TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 11. ASSET CATEGORIES
-- ============================================================

CREATE TABLE IF NOT EXISTS asset_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT UNIQUE,
  depreciation_years INTEGER DEFAULT 3,
  warranty_months INTEGER DEFAULT 12,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 12. ASSET MAINTENANCE TYPES
-- ============================================================

CREATE TABLE IF NOT EXISTS asset_maintenance_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 13. ASSET DOCUMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS asset_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_type TEXT DEFAULT 'other',
  file_size_kb INTEGER DEFAULT 0,
  file_url TEXT,
  notes TEXT,
  uploaded_by TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_documents_asset_id ON asset_documents(asset_id);

-- ============================================================
-- 14. KV STORE (used by the app for persisting small blobs)
-- ============================================================

CREATE TABLE IF NOT EXISTS kv_store_1fe2c468 (
  key TEXT PRIMARY KEY,
  value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 15. ENABLE ROW LEVEL SECURITY (permissive for now — tighten later)
-- ============================================================

-- New tables: enable RLS but allow all authenticated + anon reads for now
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'project_backlog_items', 'project_defects', 'project_methodologies',
    'it_kb_articles', 'it_linked_items', 'it_sla_policies',
    'it_ticket_categories', 'it_resolution_codes',
    'asset_vendors', 'asset_categories', 'asset_maintenance_types',
    'asset_documents', 'kv_store_1fe2c468'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('
      DO $inner$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE tablename = %L AND policyname = %L
        ) THEN
          EXECUTE %L;
        END IF;
      END $inner$;
    ',
      tbl,
      tbl || '_open_access',
      format('CREATE POLICY %I ON %I FOR ALL USING (true) WITH CHECK (true)',
             tbl || '_open_access', tbl)
    );
  END LOOP;
END $$;

-- ============================================================
-- Done. Verify with:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' ORDER BY table_name;
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- SOURCE: 02_seed.sql
-- ────────────────────────────────────────────────────────────

-- ============================================================
-- JESHAN LABS HR PORTAL — SEED DATA
-- Run AFTER 01_schema.sql.
-- Fully idempotent: safe to re-run.
-- ============================================================


-- ── Part 1: Unique constraints & deduplication ──────────────

-- ── 1. DEDUPLICATE any rows that would violate the new constraints ────────────
-- Keeps the row with the smallest ctid (earliest insert) per natural key.

-- master_value_helps
DELETE FROM master_value_helps a
USING master_value_helps b
WHERE a.ctid > b.ctid
  AND a.entity = b.entity
  AND a.field  = b.field
  AND a.value  = b.value;

-- master_departments
DELETE FROM master_departments a
USING master_departments b
WHERE a.ctid > b.ctid AND lower(a.name) = lower(b.name);

-- master_job_titles
DELETE FROM master_job_titles a
USING master_job_titles b
WHERE a.ctid > b.ctid
  AND lower(a.name)       = lower(b.name)
  AND lower(a.department) = lower(b.department);

-- master_locations
DELETE FROM master_locations a
USING master_locations b
WHERE a.ctid > b.ctid AND lower(a.name) = lower(b.name);

-- master_employment_types
DELETE FROM master_employment_types a
USING master_employment_types b
WHERE a.ctid > b.ctid AND lower(a.name) = lower(b.name);

-- master_currencies
DELETE FROM master_currencies a
USING master_currencies b
WHERE a.ctid > b.ctid AND upper(a.code) = upper(b.code);

-- master_skills
DELETE FROM master_skills a
USING master_skills b
WHERE a.ctid > b.ctid
  AND lower(a.name)     = lower(b.name)
  AND lower(a.category) = lower(b.category);

-- master_clients
DELETE FROM master_clients a
USING master_clients b
WHERE a.ctid > b.ctid AND lower(a.name) = lower(b.name);

-- leave_policies
DELETE FROM leave_policies a
USING leave_policies b
WHERE a.ctid > b.ctid AND lower(a.leave_type) = lower(b.leave_type);

-- holidays
DELETE FROM holidays a
USING holidays b
WHERE a.ctid > b.ctid AND lower(a.name) = lower(b.name) AND a.date = b.date;

-- email_templates
DELETE FROM email_templates a
USING email_templates b
WHERE a.ctid > b.ctid AND lower(a.name) = lower(b.name);

-- workflow_definitions
DELETE FROM workflow_definitions a
USING workflow_definitions b
WHERE a.ctid > b.ctid AND lower(a.name) = lower(b.name);

-- training_courses
DELETE FROM training_courses a
USING training_courses b
WHERE a.ctid > b.ctid AND lower(a.title) = lower(b.title);

-- knowledge_articles
DELETE FROM knowledge_articles a
USING knowledge_articles b
WHERE a.ctid > b.ctid AND lower(a.title) = lower(b.title);

-- learning_paths
DELETE FROM learning_paths a
USING learning_paths b
WHERE a.ctid > b.ctid AND lower(a.name) = lower(b.name);

-- ── 2. CREATE UNIQUE INDEXES (idempotent) ─────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS uidx_master_value_helps
  ON master_value_helps (entity, field, value);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_master_departments_name
  ON master_departments (lower(name));

CREATE UNIQUE INDEX IF NOT EXISTS uidx_master_job_titles_name_dept
  ON master_job_titles (lower(name), lower(department));

CREATE UNIQUE INDEX IF NOT EXISTS uidx_master_locations_name
  ON master_locations (lower(name));

CREATE UNIQUE INDEX IF NOT EXISTS uidx_master_employment_types_name
  ON master_employment_types (lower(name));

CREATE UNIQUE INDEX IF NOT EXISTS uidx_master_currencies_code
  ON master_currencies (upper(code));

CREATE UNIQUE INDEX IF NOT EXISTS uidx_master_skills_name_category
  ON master_skills (lower(name), lower(category));

CREATE UNIQUE INDEX IF NOT EXISTS uidx_master_clients_name
  ON master_clients (lower(name));

CREATE UNIQUE INDEX IF NOT EXISTS uidx_leave_policies_type
  ON leave_policies (lower(leave_type));

CREATE UNIQUE INDEX IF NOT EXISTS uidx_holidays_name_date
  ON holidays (lower(name), date);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_email_templates_name
  ON email_templates (lower(name));

CREATE UNIQUE INDEX IF NOT EXISTS uidx_workflow_definitions_name
  ON workflow_definitions (lower(name));

CREATE UNIQUE INDEX IF NOT EXISTS uidx_training_courses_title
  ON training_courses (lower(title));

CREATE UNIQUE INDEX IF NOT EXISTS uidx_knowledge_articles_title
  ON knowledge_articles (lower(title));

CREATE UNIQUE INDEX IF NOT EXISTS uidx_learning_paths_name
  ON learning_paths (lower(name));

-- ============================================================
-- PAYROLL SCHEMA PATCHES (idempotent ALTER TABLE)
-- ============================================================
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS lop_days INTEGER DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS lop_deduction DECIMAL(14,2) DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS working_days INTEGER DEFAULT 26;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS present_days DECIMAL(4,1) DEFAULT 0;

-- Expand status CHECK constraint to include Approved / Rejected
DO $$
BEGIN
  ALTER TABLE payroll_records DROP CONSTRAINT IF EXISTS payroll_records_status_check;
  ALTER TABLE payroll_records
    ADD CONSTRAINT payroll_records_status_check
    CHECK (status IN ('Draft', 'Processed', 'Approved', 'Rejected', 'Paid', 'On Hold'));
EXCEPTION WHEN others THEN NULL;
END $$;


-- ────────────────────────────────────────────────────────────
-- SOURCE: 03_defect_tracker.sql
-- ────────────────────────────────────────────────────────────

-- ============================================================
-- Migration 03: Defect Tracker — Full Schema & Seed Data
-- Consolidates migrations 06, 07, 08, and 09 into one clean file.
-- Safe to run on a fresh DB (IF NOT EXISTS / ON CONFLICT guards throughout).
-- ============================================================

-- ── Step 1: Drop old check constraints that conflict with the current model ───
-- (project_defects is created in 01_schema.sql with restrictive CHECK values;
--  these are dropped here before the ADD COLUMN block below, so column adds
--  without conflicting inline CHECKs are safe.)

ALTER TABLE project_defects DROP CONSTRAINT IF EXISTS project_defects_environment_check;
ALTER TABLE project_defects DROP CONSTRAINT IF EXISTS project_defects_priority_check;
ALTER TABLE project_defects DROP CONSTRAINT IF EXISTS project_defects_severity_check;
ALTER TABLE project_defects DROP CONSTRAINT IF EXISTS project_defects_status_check;

-- ── Step 2: Extend project_defects with all additional columns ────────────────
-- (ADD COLUMN IF NOT EXISTS is idempotent; no inline CHECK constraints here)

ALTER TABLE project_defects
  ADD COLUMN IF NOT EXISTS description           TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS priority              TEXT        DEFAULT 'P3',
  ADD COLUMN IF NOT EXISTS project_name          TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS system_name           TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_name           TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS external_ticket_no    TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_request     TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS sprint_id             TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS sprint_name           TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS reporter_id           TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS reporter_name         TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS assignee_id           TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS build_version         TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS found_in_version      TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS fix_version           TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS fixed_in_version      TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_regression         BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_duplicate          BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS duplicate_of_id       TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS root_cause            TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS resolution_code       TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS rejection_reason      TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS fix_description       TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS fixed_by              TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS fixed_date            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by           TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS verified_date         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS test_evidence         TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS labels                TEXT[]      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS watchers              TEXT[]      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sla_paused            BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sla_pause_reason      TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS sla_paused_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_total_paused_mins INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_response_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_close_reference_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_close_warning_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_closed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS introduced_in_sprint  TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS os                    TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS browser               TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS duplicate_count       INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reopen_count          INTEGER     DEFAULT 0;

-- Enforce the workflow for direct Supabase writes as well as API writes.
CREATE OR REPLACE FUNCTION enforce_defect_workflow()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  allowed_transitions JSONB := '{
    "Open":["In Progress","Awaiting Info","Deferred","Won''t Fix","Duplicate"],
    "In Progress":["Open","Awaiting Info","Blocked","Resolved","Won''t Fix"],
    "Awaiting Info":["In Progress"],
    "Blocked":["In Progress","Won''t Fix"],
    "Resolved":["Verified","In Progress"],
    "Verified":["Closed"],
    "Deferred":["Open"],
    "Won''t Fix":["Open"],
    "Duplicate":[],
    "Closed":[]
  }'::JSONB;
BEGIN
  IF NEW.status = 'Fixed' THEN
    NEW.status := 'Resolved';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'Closed' THEN
      RAISE EXCEPTION 'Closed defects cannot be reopened';
    END IF;
    IF NOT (
      NEW.status = 'Closed'
      AND OLD.status IN ('Awaiting Info', 'Resolved')
      AND NEW.updated_by = 'system:auto-close'
    )
      AND NOT (OLD.status = 'Fixed' AND NEW.status = 'Resolved')
      AND NOT (COALESCE(allowed_transitions -> OLD.status, '[]'::JSONB) ? NEW.status) THEN
      RAISE EXCEPTION 'Invalid defect status transition from % to %', OLD.status, NEW.status;
    END IF;
    IF OLD.status IN ('Awaiting Info', 'Resolved') AND NEW.status = 'In Progress'
      AND NOT EXISTS (
        SELECT 1
        FROM defect_comments comment
        WHERE comment.defect_id = OLD.id
          AND (
            comment.author_id = OLD.reporter_id
            OR LOWER(comment.author_name) = LOWER(OLD.reporter_name)
          )
          AND comment.created_at >= COALESCE(OLD.sla_paused_at, OLD.fixed_date, OLD.updated_at)
      ) THEN
      RAISE EXCEPTION 'A reporter comment is required before returning this defect to In Progress';
    END IF;
    IF NEW.status = 'In Progress' AND OLD.first_response_at IS NULL THEN
      NEW.first_response_at := NOW();
    END IF;
    IF NEW.status IN ('Awaiting Info', 'Resolved') THEN
      NEW.auto_close_reference_at := NOW();
      NEW.auto_close_warning_at := NULL;
      NEW.auto_closed_at := NULL;
    ELSIF OLD.status IN ('Awaiting Info', 'Resolved') THEN
      NEW.auto_close_reference_at := NULL;
      NEW.auto_close_warning_at := NULL;
    END IF;
  END IF;

  IF NEW.status = 'Resolved' THEN
    IF NULLIF(BTRIM(NEW.root_cause), '') IS NULL
      OR NULLIF(BTRIM(NEW.resolution_code), '') IS NULL THEN
      RAISE EXCEPTION 'Root Cause and Resolution Code are required before resolving a defect';
    END IF;
    NEW.fixed_date := COALESCE(NEW.fixed_date, NOW());
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'Awaiting Info' AND OLD.status IS DISTINCT FROM 'Awaiting Info' THEN
    NEW.sla_paused := TRUE;
    NEW.sla_paused_at := COALESCE(NEW.sla_paused_at, NOW());
    NEW.sla_pause_reason := COALESCE(NULLIF(NEW.sla_pause_reason, ''), 'Awaiting reporter information');
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'Awaiting Info' AND NEW.status IS DISTINCT FROM 'Awaiting Info' THEN
    NEW.sla_total_paused_mins := COALESCE(OLD.sla_total_paused_mins, 0)
      + GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - COALESCE(OLD.sla_paused_at, NOW()))) / 60)::INTEGER);
    NEW.sla_paused := FALSE;
    NEW.sla_paused_at := NULL;
    NEW.sla_pause_reason := '';
  END IF;

  IF NEW.status = 'Verified' THEN
    NEW.verified_date := COALESCE(NEW.verified_date, NOW());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_defect_workflow ON project_defects;
CREATE TRIGGER trg_enforce_defect_workflow
  BEFORE INSERT OR UPDATE ON project_defects
  FOR EACH ROW EXECUTE FUNCTION enforce_defect_workflow();

-- ── Step 3: defect_sla_policies — created with final severity names directly ──
-- (Avoids the S1→'Very High' rename dance from migrations 06+07)

CREATE TABLE IF NOT EXISTS defect_sla_policies (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  severity             TEXT NOT NULL UNIQUE,
  first_response_mins  INTEGER NOT NULL,
  fix_mins             INTEGER NOT NULL,
  verification_mins    INTEGER NOT NULL,
  business_hours_only  BOOLEAN  DEFAULT FALSE,
  escalate_at_percent  INTEGER  DEFAULT 80,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── Step 4: defect_sla_events ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS defect_sla_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  defect_id   UUID NOT NULL REFERENCES project_defects(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL CHECK (event_type IN (
                'created','first_response','fix_breached','verify_breached',
                'paused','resumed','escalated')),
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  actor_id    TEXT,
  notes       TEXT,
  metadata    JSONB DEFAULT '{}'
);
ALTER TABLE defect_sla_events ADD COLUMN IF NOT EXISTS actor_id TEXT;
ALTER TABLE defect_sla_events ADD COLUMN IF NOT EXISTS notes TEXT;
CREATE INDEX IF NOT EXISTS idx_sla_events_defect ON defect_sla_events(defect_id);

-- ── Step 5: defect_activity_log ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS defect_activity_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  defect_id     UUID NOT NULL REFERENCES project_defects(id) ON DELETE CASCADE,
  actor_id      TEXT NOT NULL,
  actor_name    TEXT NOT NULL,
  action        TEXT NOT NULL,
  field_changed TEXT DEFAULT '',
  old_value     TEXT DEFAULT '',
  new_value     TEXT DEFAULT '',
  comment       TEXT DEFAULT '',
  occurred_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_defect ON defect_activity_log(defect_id);

-- ── Step 6: defect_comments ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS defect_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  defect_id   UUID NOT NULL REFERENCES project_defects(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL,
  author_name TEXT NOT NULL,
  content     TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comments_defect ON defect_comments(defect_id);

-- A non-reporter comment is also a qualifying first response. Enforce this in
-- the database so direct REST writes and Edge Function writes behave equally.
CREATE OR REPLACE FUNCTION mark_defect_first_response_from_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  defect_reporter_id TEXT;
  defect_reporter_name TEXT;
  defect_status TEXT;
  is_reporter_comment BOOLEAN;
BEGIN
  SELECT reporter_id, reporter_name, status
    INTO defect_reporter_id, defect_reporter_name, defect_status
  FROM public.project_defects
  WHERE id = NEW.defect_id;

  is_reporter_comment := (
    (NULLIF(defect_reporter_id, '') IS NOT NULL AND NEW.author_id = defect_reporter_id)
    OR (
      NULLIF(defect_reporter_name, '') IS NOT NULL
      AND LOWER(NEW.author_name) = LOWER(defect_reporter_name)
    )
  );

  IF is_reporter_comment AND defect_status IN ('Awaiting Info', 'Resolved') THEN
    UPDATE public.project_defects
    SET auto_close_reference_at = COALESCE(NEW.created_at, NOW()),
        auto_close_warning_at = NULL
    WHERE id = NEW.defect_id;
  ELSIF NOT is_reporter_comment AND NEW.author_id IS DISTINCT FROM 'system:auto-close' THEN
    UPDATE public.project_defects
    SET first_response_at = COALESCE(first_response_at, NEW.created_at, NOW())
    WHERE id = NEW.defect_id
      AND first_response_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_defect_first_response_from_comment ON defect_comments;
CREATE TRIGGER trg_mark_defect_first_response_from_comment
  AFTER INSERT ON defect_comments
  FOR EACH ROW EXECUTE FUNCTION mark_defect_first_response_from_comment();

-- Repair existing records whose response was already provided before the
-- automatic lifecycle tracking was introduced.
UPDATE project_defects AS defect
SET first_response_at = COALESCE(
  (
    SELECT MIN(comment.created_at)
    FROM defect_comments AS comment
    WHERE comment.defect_id = defect.id
      AND NOT (
        (NULLIF(defect.reporter_id, '') IS NOT NULL AND comment.author_id = defect.reporter_id)
        OR (
          NULLIF(defect.reporter_name, '') IS NOT NULL
          AND LOWER(comment.author_name) = LOWER(defect.reporter_name)
        )
      )
  ),
  (
    SELECT MIN(activity.occurred_at)
    FROM defect_activity_log AS activity
    WHERE activity.defect_id = defect.id
      AND activity.field_changed = 'status'
      AND activity.new_value = 'In Progress'
  ),
  CASE
    WHEN defect.status IN ('In Progress', 'Blocked', 'Resolved', 'Verified', 'Closed')
      THEN defect.updated_at
  END
)
WHERE defect.first_response_at IS NULL
  AND (
    defect.status IN ('In Progress', 'Blocked', 'Resolved', 'Verified', 'Closed')
    OR EXISTS (
      SELECT 1
      FROM defect_comments AS comment
      WHERE comment.defect_id = defect.id
        AND NOT (
          (NULLIF(defect.reporter_id, '') IS NOT NULL AND comment.author_id = defect.reporter_id)
          OR (
            NULLIF(defect.reporter_name, '') IS NOT NULL
            AND LOWER(comment.author_name) = LOWER(defect.reporter_name)
          )
        )
    )
  );

-- Existing Awaiting Info/Resolved defects begin their inactivity period from
-- their last recorded update. Future reporter comments reset this timestamp.
UPDATE project_defects
SET auto_close_reference_at = COALESCE(auto_close_reference_at, updated_at, NOW())
WHERE status IN ('Awaiting Info', 'Resolved')
  AND auto_close_reference_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_defects_auto_close_due
  ON project_defects(auto_close_reference_at)
  WHERE status IN ('Awaiting Info', 'Resolved');

CREATE OR REPLACE FUNCTION process_defect_auto_closure()
RETURNS TABLE(warned_count INTEGER, closed_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target RECORD;
  warned_total INTEGER := 0;
  closed_total INTEGER := 0;
  warning_message TEXT;
  closure_message TEXT;
BEGIN
  -- Warn once between day 25 and day 30. Reporter comments reset the
  -- reference timestamp and clear the warning marker.
  FOR target IN
    SELECT id, defect_id, title, status, reporter_id
    FROM public.project_defects
    WHERE status IN ('Awaiting Info', 'Resolved')
      AND auto_close_reference_at <= NOW() - INTERVAL '25 days'
      AND auto_close_reference_at > NOW() - INTERVAL '30 days'
      AND auto_close_warning_at IS NULL
    FOR UPDATE SKIP LOCKED
  LOOP
    warning_message := format(
      'System reminder: This defect has remained %s for 25 days without a reporter response. It will be automatically closed in 5 days unless the reporter comments or the status changes.',
      target.status
    );

    UPDATE public.project_defects
    SET auto_close_warning_at = NOW()
    WHERE id = target.id
      AND auto_close_warning_at IS NULL;

    INSERT INTO public.defect_comments (
      defect_id, author_id, author_name, content, is_internal
    ) VALUES (
      target.id, 'system:auto-close', 'System', warning_message, FALSE
    );

    IF NULLIF(target.reporter_id, '') IS NOT NULL THEN
      INSERT INTO public.notifications (
        user_id, title, body, message, type, link, read
      ) VALUES (
        target.reporter_id,
        format('%s will auto-close in 5 days', COALESCE(target.defect_id, 'Defect')),
        warning_message,
        warning_message,
        'defect_auto_close_warning',
        '/defect-tracker',
        FALSE
      );
    END IF;

    warned_total := warned_total + 1;
  END LOOP;

  -- Close after 30 days of reporter inactivity. The workflow trigger permits
  -- this otherwise-disallowed transition only for the system marker below.
  FOR target IN
    SELECT id, defect_id, title, status, reporter_id
    FROM public.project_defects
    WHERE status IN ('Awaiting Info', 'Resolved')
      AND auto_close_reference_at <= NOW() - INTERVAL '30 days'
    FOR UPDATE SKIP LOCKED
  LOOP
    closure_message := format(
      'System update: This defect was automatically closed after 30 days in %s without a reporter response or manual closure.',
      target.status
    );

    UPDATE public.project_defects
    SET status = 'Closed',
        auto_closed_at = NOW(),
        updated_by = 'system:auto-close',
        updated_at = NOW()
    WHERE id = target.id
      AND status IN ('Awaiting Info', 'Resolved');

    INSERT INTO public.defect_comments (
      defect_id, author_id, author_name, content, is_internal
    ) VALUES (
      target.id, 'system:auto-close', 'System', closure_message, FALSE
    );

    INSERT INTO public.defect_activity_log (
      defect_id, actor_id, actor_name, action, field_changed,
      old_value, new_value, comment
    ) VALUES (
      target.id, 'system:auto-close', 'System', 'status_changed', 'status',
      target.status, 'Closed', closure_message
    );

    IF NULLIF(target.reporter_id, '') IS NOT NULL THEN
      INSERT INTO public.notifications (
        user_id, title, body, message, type, link, read
      ) VALUES (
        target.reporter_id,
        format('%s was automatically closed', COALESCE(target.defect_id, 'Defect')),
        closure_message,
        closure_message,
        'defect_auto_closed',
        '/defect-tracker',
        FALSE
      );
    END IF;

    closed_total := closed_total + 1;
  END LOOP;

  RETURN QUERY SELECT warned_total, closed_total;
END;
$$;

REVOKE ALL ON FUNCTION public.process_defect_auto_closure() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_defect_auto_closure() TO service_role;

-- ── Step 7: defect_linked_items ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS defect_linked_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  defect_id   UUID NOT NULL REFERENCES project_defects(id) ON DELETE CASCADE,
  item_type   TEXT NOT NULL CHECK (item_type IN ('it_ticket','backlog_item','related_defect')),
  item_ref    TEXT NOT NULL,
  item_title  TEXT DEFAULT '',
  item_status TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_links_defect ON defect_linked_items(defect_id);

-- ── Step 8: defect_saved_filters ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS defect_saved_filters (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  filters    JSONB NOT NULL DEFAULT '{}',
  is_shared  BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Step 9: defect_resolution_codes ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS defect_resolution_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT NOT NULL UNIQUE,
  label      TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- ── Step 10: defect_root_cause_categories ────────────────────────────────────

CREATE TABLE IF NOT EXISTS defect_root_cause_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT NOT NULL UNIQUE,
  label      TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- ── Step 11: defect_rejection_reasons ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS defect_rejection_reasons (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code  TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL
);

-- ── Step 12: defect_labels ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS defect_labels (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code  TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280'
);

-- ── Step 13: defect_environments ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS defect_environments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Step 14: defect_priorities ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS defect_priorities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Step 15: defect_statuses ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS defect_statuses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  description TEXT,
  is_terminal BOOLEAN NOT NULL DEFAULT false,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Step 16: defect_status_transitions ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS defect_status_transitions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_status TEXT NOT NULL,
  to_status   TEXT NOT NULL,
  UNIQUE (from_status, to_status)
);

-- ── Step 17: defect_escalation_rules ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS defect_escalation_rules (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  severity             TEXT NOT NULL,
  condition            TEXT NOT NULL,
  threshold            INTEGER NOT NULL,
  action               TEXT NOT NULL,
  target_role          TEXT,
  description          TEXT,
  notification_message TEXT,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Step 18: Enable RLS on all new defect-tracker tables ─────────────────────

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'defect_sla_policies', 'defect_sla_events', 'defect_activity_log',
    'defect_comments', 'defect_linked_items', 'defect_saved_filters',
    'defect_resolution_codes', 'defect_root_cause_categories',
    'defect_rejection_reasons', 'defect_labels',
    'defect_environments', 'defect_priorities',
    'defect_statuses', 'defect_status_transitions',
    'defect_escalation_rules'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = tbl AND policyname = tbl || '_open_access'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL USING (true) WITH CHECK (true)',
        tbl || '_open_access', tbl
      );
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- Done. Run after 01_schema.sql and 02_seed.sql.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- SOURCE: 04_pm_master.sql
-- ────────────────────────────────────────────────────────────

-- ============================================================
-- MIGRATION 04: PROJECT MANAGEMENT — MASTER DATA & SCHEMA ENHANCEMENTS
-- ============================================================
-- Adds: pm_* master tables, schema columns for projects/tasks/milestones/sprints,
--       project_risks, project_epics, project_time_logs, project_sprint_backlog,
--       project_backlog_dependencies, project_budget_categories, project_rag_log,
--       project_activity_log, pm_saved_views
-- ============================================================

-- ============================================================
-- MASTER DATA: PM_PROJECT_CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS pm_project_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  default_methodology TEXT DEFAULT 'Scrum',
  icon TEXT,
  color TEXT DEFAULT '#6366F1',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MASTER DATA: PM_METHODOLOGIES
-- ============================================================
CREATE TABLE IF NOT EXISTS pm_methodologies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  methodology_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  has_sprints BOOLEAN DEFAULT FALSE,
  sprint_length_days INTEGER DEFAULT 14,
  story_points_enabled BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MASTER DATA: PM_TASK_TYPES
-- ============================================================
CREATE TABLE IF NOT EXISTS pm_task_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT DEFAULT '#6B7280',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MASTER DATA: PM_STORY_POINT_SCALES
-- ============================================================
CREATE TABLE IF NOT EXISTS pm_story_point_scales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scale_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  values JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MASTER DATA: PM_RISK_CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS pm_risk_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MASTER DATA: PM_BUDGET_CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS pm_budget_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MASTER DATA: PM_HEALTH_METRICS
-- ============================================================
CREATE TABLE IF NOT EXISTS pm_health_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  calculation_rule TEXT,
  green_threshold DECIMAL(5,2),
  yellow_threshold DECIMAL(5,2),
  weight DECIMAL(4,2) DEFAULT 1.0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SCHEMA CHANGES: projects table
-- ============================================================
ALTER TABLE projects ADD COLUMN IF NOT EXISTS rag_status TEXT DEFAULT 'Green' CHECK (rag_status IN ('Red','Amber','Green'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS methodology TEXT DEFAULT 'Scrum';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS methodology_id TEXT REFERENCES pm_methodologies(methodology_id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget_currency TEXT DEFAULT 'USD';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sprint_length INTEGER DEFAULT 14;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS story_point_scale TEXT DEFAULT 'fibonacci';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS forecast DECIMAL(14,2);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description_rich TEXT;

-- ============================================================
-- SCHEMA CHANGES: project_milestones table
-- ============================================================
-- Fix status check to match spec values
ALTER TABLE project_milestones DROP CONSTRAINT IF EXISTS project_milestones_status_check;
ALTER TABLE project_milestones ADD CONSTRAINT project_milestones_status_check
  CHECK (status IN ('Pending','Achieved','Missed','At Risk'));
-- Update any existing 'Completed' → 'Achieved', 'In Progress' → 'At Risk'
UPDATE project_milestones SET status = 'Achieved' WHERE status = 'Completed';
UPDATE project_milestones SET status = 'At Risk'  WHERE status = 'In Progress';

ALTER TABLE project_milestones ADD COLUMN IF NOT EXISTS milestone_type TEXT DEFAULT 'Phase'
  CHECK (milestone_type IN ('Phase','Release','Review','Contract','Internal'));
ALTER TABLE project_milestones ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE project_milestones ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE project_milestones ADD COLUMN IF NOT EXISTS linked_backlog_items JSONB DEFAULT '[]';
ALTER TABLE project_milestones ADD COLUMN IF NOT EXISTS completion_date DATE;
ALTER TABLE project_milestones ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE project_milestones ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- ============================================================
-- SCHEMA CHANGES: project_sprints table
-- ============================================================
ALTER TABLE project_sprints ADD COLUMN IF NOT EXISTS sprint_number INTEGER DEFAULT 1;
ALTER TABLE project_sprints ADD COLUMN IF NOT EXISTS capacity_points DECIMAL(8,2) DEFAULT 0;
ALTER TABLE project_sprints ADD COLUMN IF NOT EXISTS committed_points DECIMAL(8,2) DEFAULT 0;
ALTER TABLE project_sprints ADD COLUMN IF NOT EXISTS completed_points DECIMAL(8,2) DEFAULT 0;
ALTER TABLE project_sprints ADD COLUMN IF NOT EXISTS velocity DECIMAL(8,2) DEFAULT 0;
ALTER TABLE project_sprints ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ============================================================
-- SCHEMA CHANGES: project_tasks table
-- ============================================================
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'task';
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS story_points DECIMAL(5,1);
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES project_sprints(id) ON DELETE SET NULL;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES project_tasks(id) ON DELETE SET NULL;
-- Widen status check to include kanban values
ALTER TABLE project_tasks DROP CONSTRAINT IF EXISTS project_tasks_status_check;
ALTER TABLE project_tasks ADD CONSTRAINT project_tasks_status_check
  CHECK (status IN ('Todo','To Do','In Progress','In Review','Review','Done','Cancelled','Blocked'));

-- ============================================================
-- SCHEMA CHANGES: project_backlog_items table
-- ============================================================
ALTER TABLE project_backlog_items ADD COLUMN IF NOT EXISTS epic_id UUID;
ALTER TABLE project_backlog_items ADD COLUMN IF NOT EXISTS labels JSONB DEFAULT '[]';
ALTER TABLE project_backlog_items ADD COLUMN IF NOT EXISTS mid_sprint_added BOOLEAN DEFAULT FALSE;
ALTER TABLE project_backlog_items ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE project_backlog_items ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES project_backlog_items(id) ON DELETE SET NULL;
ALTER TABLE project_backlog_items ADD COLUMN IF NOT EXISTS linked_it_tickets JSONB DEFAULT '[]';
ALTER TABLE project_backlog_items ADD COLUMN IF NOT EXISTS watchers JSONB DEFAULT '[]';

-- ============================================================
-- NEW TABLE: project_sprint_backlog (junction: sprint ↔ backlog items)
-- ============================================================
CREATE TABLE IF NOT EXISTS project_sprint_backlog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sprint_id UUID NOT NULL REFERENCES project_sprints(id) ON DELETE CASCADE,
  backlog_item_id UUID NOT NULL REFERENCES project_backlog_items(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by TEXT,
  order_index INTEGER DEFAULT 0,
  mid_sprint_added BOOLEAN DEFAULT FALSE,
  UNIQUE(sprint_id, backlog_item_id)
);
CREATE INDEX IF NOT EXISTS idx_sprint_backlog_sprint ON project_sprint_backlog(sprint_id);
CREATE INDEX IF NOT EXISTS idx_sprint_backlog_item ON project_sprint_backlog(backlog_item_id);

-- ============================================================
-- NEW TABLE: project_epics
-- ============================================================
CREATE TABLE IF NOT EXISTS project_epics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366F1',
  status TEXT DEFAULT 'Not Started' CHECK (status IN ('Not Started','In Progress','Done','On Hold')),
  start_date DATE,
  end_date DATE,
  acceptance_criteria TEXT,
  owner_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  owner_name TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_epics_project ON project_epics(project_id);

-- FK from backlog items to epics (added after epics table exists)
ALTER TABLE project_backlog_items DROP CONSTRAINT IF EXISTS project_backlog_items_epic_id_fkey;
ALTER TABLE project_backlog_items ADD CONSTRAINT project_backlog_items_epic_id_fkey
  FOREIGN KEY (epic_id) REFERENCES project_epics(id) ON DELETE SET NULL;

-- ============================================================
-- NEW TABLE: project_risks
-- ============================================================
CREATE TABLE IF NOT EXISTS project_risks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  risk_number SERIAL,
  title TEXT NOT NULL,
  category TEXT REFERENCES pm_risk_categories(category_id) ON DELETE SET NULL,
  description TEXT,
  likelihood TEXT NOT NULL DEFAULT 'Medium' CHECK (likelihood IN ('High','Medium','Low')),
  likelihood_value INTEGER DEFAULT 2,
  impact TEXT NOT NULL DEFAULT 'Medium' CHECK (impact IN ('Critical','High','Medium','Low')),
  impact_value INTEGER DEFAULT 2,
  risk_score INTEGER GENERATED ALWAYS AS (likelihood_value * impact_value) STORED,
  status TEXT DEFAULT 'Identified'
    CHECK (status IN ('Identified','Assessed','Mitigated','Accepted','Closed','Triggered')),
  owner_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  owner_name TEXT,
  mitigation_plan TEXT,
  contingency_plan TEXT,
  due_date DATE,
  resolution_notes TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_risks_project ON project_risks(project_id);
CREATE INDEX IF NOT EXISTS idx_risks_status ON project_risks(status);

-- ============================================================
-- NEW TABLE: project_time_logs (enhanced time tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS project_time_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES project_tasks(id) ON DELETE SET NULL,
  backlog_item_id UUID REFERENCES project_backlog_items(id) ON DELETE SET NULL,
  sprint_id UUID REFERENCES project_sprints(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  employee_name TEXT NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  hours DECIMAL(5,2) NOT NULL,
  log_type TEXT DEFAULT 'Development'
    CHECK (log_type IN ('Development','Review','Testing','Meeting','Documentation','Other')),
  billable BOOLEAN DEFAULT TRUE,
  comment TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_time_logs_project ON project_time_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_task ON project_time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_employee ON project_time_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_date ON project_time_logs(log_date);

-- ============================================================
-- NEW TABLE: project_backlog_dependencies
-- ============================================================
CREATE TABLE IF NOT EXISTS project_backlog_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_item_id UUID NOT NULL REFERENCES project_backlog_items(id) ON DELETE CASCADE,
  target_item_id UUID NOT NULL REFERENCES project_backlog_items(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'Blocks'
    CHECK (dependency_type IN ('Finish-to-Start','Start-to-Start','Finish-to-Finish','Start-to-Finish','Blocks','Blocked By','Relates To','Duplicates')),
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_item_id, target_item_id, dependency_type)
);
CREATE INDEX IF NOT EXISTS idx_deps_source ON project_backlog_dependencies(source_item_id);
CREATE INDEX IF NOT EXISTS idx_deps_target ON project_backlog_dependencies(target_item_id);

-- ============================================================
-- NEW TABLE: project_budget_line_items
-- ============================================================
CREATE TABLE IF NOT EXISTS project_budget_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT REFERENCES pm_budget_categories(category_id) ON DELETE SET NULL,
  description TEXT,
  budgeted_amount DECIMAL(14,2) DEFAULT 0,
  actual_amount DECIMAL(14,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_budget_items_project ON project_budget_line_items(project_id);

-- ============================================================
-- NEW TABLE: project_rag_log (RAG history)
-- ============================================================
CREATE TABLE IF NOT EXISTS project_rag_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT,
  changed_by_id TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rag_log_project ON project_rag_log(project_id, created_at DESC);

-- ============================================================
-- NEW TABLE: project_activity_log
-- ============================================================
CREATE TABLE IF NOT EXISTS project_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  actor_id TEXT,
  actor_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,  -- 'task' | 'sprint' | 'milestone' | 'member' | 'defect' | 'risk'
  entity_id TEXT,
  entity_title TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_project ON project_activity_log(project_id, created_at DESC);

-- ============================================================
-- NEW TABLE: pm_saved_views (saved filter views per user/project)
-- ============================================================
CREATE TABLE IF NOT EXISTS pm_saved_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  screen TEXT NOT NULL,  -- 'backlog' | 'tasks' | 'mytasks'
  name TEXT NOT NULL,
  filters JSONB DEFAULT '{}',
  is_shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saved_views_user ON pm_saved_views(user_id, screen);

-- ============================================================
-- NEW TABLE: project_notifications (PM notification queue)
-- ============================================================
CREATE TABLE IF NOT EXISTS project_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  entity_type TEXT,
  entity_id TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pm_notifications_recipient ON project_notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_notifications_project ON project_notifications(project_id);

-- ============================================================
-- RLS POLICIES
-- ============================================================
DO $rlsblock$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'pm_project_categories', 'pm_methodologies', 'pm_task_types',
    'pm_story_point_scales', 'pm_risk_categories', 'pm_budget_categories',
    'pm_health_metrics', 'project_epics', 'project_risks', 'project_time_logs',
    'project_backlog_dependencies', 'project_budget_line_items', 'project_rag_log',
    'project_activity_log', 'pm_saved_views', 'project_notifications',
    'project_sprint_backlog'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    BEGIN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL USING (TRUE) WITH CHECK (TRUE)',
        tbl || '_all', tbl
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END;
$rlsblock$;
-- ------------------------------------------------------------
-- SOURCE: 02_hr_and_business.sql
-- ------------------------------------------------------------
-- ============================================================
-- JESHAN LABS HR PORTAL — HR SPEC GAPS + BUSINESS APPS
-- Merged from: 05_hr_spec_gaps.sql + 06_hr_master_data_seed.sql + 07_business_apps_spec.sql
-- Fully idempotent: safe to run multiple times.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- SOURCE: 05_hr_spec_gaps.sql
-- ────────────────────────────────────────────────────────────

-- ============================================================
-- HR SPEC GAPS MIGRATION — Part 5
-- New tables and ALTER statements for all 10 spec files
-- Idempotent: all CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- for full-text search on chat

-- ============================================================
-- SECTION 1: EMPLOYEE DASHBOARD GAPS
-- ============================================================

-- Shift definitions
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_duration_minutes INT DEFAULT 30,
  is_night_shift BOOLEAN DEFAULT false,
  location TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employee-to-shift assignments
CREATE TABLE IF NOT EXISTS employee_shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL,
  effective_to DATE,
  assigned_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_employee ON employee_shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_shift ON employee_shifts(shift_id);

-- Shift swap requests
CREATE TABLE IF NOT EXISTS shift_swap_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  swap_with_id UUID REFERENCES employees(id),
  shift_date DATE NOT NULL,
  requester_shift_id UUID REFERENCES shifts(id),
  swap_with_shift_id UUID REFERENCES shifts(id),
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by UUID REFERENCES employees(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payslips
CREATE TABLE IF NOT EXISTS payslips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL,
  gross_salary NUMERIC(12,2),
  net_salary NUMERIC(12,2),
  deductions JSONB DEFAULT '[]'::jsonb,
  earnings JSONB DEFAULT '[]'::jsonb,
  payslip_url TEXT,
  payment_date DATE,
  payment_mode TEXT DEFAULT 'Bank Transfer',
  status TEXT DEFAULT 'generated' CHECK (status IN ('draft','generated','paid')),
  uploaded_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, month, year)
);
CREATE INDEX IF NOT EXISTS idx_payslips_employee ON payslips(employee_id);

-- Attendance corrections / regularization requests
CREATE TABLE IF NOT EXISTS attendance_corrections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  original_check_in TIMESTAMPTZ,
  original_check_out TIMESTAMPTZ,
  requested_check_in TIMESTAMPTZ NOT NULL,
  requested_check_out TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_by UUID REFERENCES employees(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  workflow_instance_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comp-off requests
CREATE TABLE IF NOT EXISTS comp_off_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  worked_date DATE NOT NULL,
  comp_off_date DATE,
  hours_worked NUMERIC(4,2),
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','availed')),
  approved_by UUID REFERENCES employees(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  availed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WFH requests
CREATE TABLE IF NOT EXISTS wfh_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  wfh_type TEXT DEFAULT 'full_day' CHECK (wfh_type IN ('full_day','half_day','custom')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by UUID REFERENCES employees(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  workflow_instance_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wfh_requests_employee ON wfh_requests(employee_id);

-- ============================================================
-- SECTION 2: EMPLOYEE DIRECTORY GAPS
-- ============================================================

-- ALTER employees: add new columns
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS employee_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS blood_group TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS marital_status TEXT,
  ADD COLUMN IF NOT EXISTS nationality TEXT,
  ADD COLUMN IF NOT EXISTS permanent_address JSONB,
  ADD COLUMN IF NOT EXISTS current_address JSONB,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS github_url TEXT,
  ADD COLUMN IF NOT EXISTS twitter_url TEXT,
  ADD COLUMN IF NOT EXISTS personal_email TEXT,
  ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'Full-Time',
  ADD COLUMN IF NOT EXISTS probation_end_date DATE,
  ADD COLUMN IF NOT EXISTS confirmation_date DATE,
  ADD COLUMN IF NOT EXISTS notice_period_days INT DEFAULT 30,
  ADD COLUMN IF NOT EXISTS pf_number TEXT,
  ADD COLUMN IF NOT EXISTS uan_number TEXT,
  ADD COLUMN IF NOT EXISTS pan_number TEXT,
  ADD COLUMN IF NOT EXISTS aadhaar_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_ifsc TEXT,
  ADD COLUMN IF NOT EXISTS last_performance_rating NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS exit_date DATE,
  ADD COLUMN IF NOT EXISTS exit_reason TEXT;

-- Auto-generate employee_code trigger
CREATE OR REPLACE FUNCTION generate_employee_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.employee_code IS NULL THEN
    NEW.employee_code := 'JSN' || LPAD((
      SELECT COUNT(*) + 1 FROM employees
    )::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_employee_code ON employees;
CREATE TRIGGER trg_employee_code
  BEFORE INSERT ON employees
  FOR EACH ROW EXECUTE FUNCTION generate_employee_code();

-- Employee education
CREATE TABLE IF NOT EXISTS employee_education (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  institution TEXT NOT NULL,
  degree TEXT NOT NULL,
  field_of_study TEXT,
  start_year INT,
  end_year INT,
  grade TEXT,
  is_highest_qualification BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_employee_education_employee ON employee_education(employee_id);

-- Employee certifications
CREATE TABLE IF NOT EXISTS employee_certifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  certification_name TEXT NOT NULL,
  issuing_organization TEXT NOT NULL,
  issue_date DATE,
  expiry_date DATE,
  credential_id TEXT,
  credential_url TEXT,
  certificate_file_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','expired','revoked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_employee_certifications_employee ON employee_certifications(employee_id);

-- Employee previous employers
CREATE TABLE IF NOT EXISTS employee_previous_employers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  job_title TEXT,
  start_date DATE,
  end_date DATE,
  last_salary NUMERIC(12,2),
  reason_for_leaving TEXT,
  reference_name TEXT,
  reference_contact TEXT,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employee audit log (directory-specific field-level changes)
CREATE TABLE IF NOT EXISTS employee_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES employees(id),
  change_type TEXT NOT NULL, -- 'update', 'create', 'delete'
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  change_reason TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_employee_audit_log_employee ON employee_audit_log(employee_id);

-- ALTER employee_documents (already exists, add columns)
ALTER TABLE employee_documents
  ADD COLUMN IF NOT EXISTS document_type TEXT,
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS version_number INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS previous_version_id UUID REFERENCES employee_documents(id),
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES employees(id),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- ============================================================
-- SECTION 3: RECRUITMENT GAPS
-- ============================================================

-- Job requisitions (pre-job-posting approval)
CREATE TABLE IF NOT EXISTS job_requisitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  department TEXT NOT NULL,
  location TEXT,
  employment_type TEXT,
  number_of_positions INT DEFAULT 1,
  justification TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  requested_by UUID REFERENCES employees(id),
  approved_by UUID REFERENCES employees(id),
  approved_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','converted')),
  rejection_reason TEXT,
  converted_job_id UUID REFERENCES recruitment_jobs(id),
  workflow_instance_id UUID,
  budget_min NUMERIC(12,2),
  budget_max NUMERIC(12,2),
  target_start_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recruitment offers
CREATE TABLE IF NOT EXISTS recruitment_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID REFERENCES recruitment_candidates(id) ON DELETE CASCADE,
  job_id UUID REFERENCES recruitment_jobs(id),
  offer_letter_template_id TEXT,
  offered_ctc NUMERIC(12,2),
  offered_designation TEXT,
  joining_date DATE,
  offer_expiry_date DATE,
  offer_letter_url TEXT,
  signature_data JSONB,
  signed_pdf_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','negotiating','declined','expired','revoked')),
  candidate_response TEXT,
  negotiated_ctc NUMERIC(12,2),
  negotiation_notes TEXT,
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  generated_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Candidate communication log
CREATE TABLE IF NOT EXISTS recruitment_communication_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID REFERENCES recruitment_candidates(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email','phone','sms','linkedin','whatsapp','other')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  subject TEXT,
  body TEXT,
  sent_by UUID REFERENCES employees(id),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recruitment_comm_candidate ON recruitment_communication_log(candidate_id);

-- ALTER recruitment_candidates
ALTER TABLE recruitment_candidates
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS blacklisted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS blacklist_reason TEXT,
  ADD COLUMN IF NOT EXISTS aggregate_feedback_score NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS assigned_recruiter UUID REFERENCES employees(id),
  ADD COLUMN IF NOT EXISTS hired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS portal_link TEXT,
  ADD COLUMN IF NOT EXISTS referral_employee_id UUID REFERENCES employees(id);

-- ALTER recruitment_feedback
ALTER TABLE recruitment_feedback
  ADD COLUMN IF NOT EXISTS competency_ratings JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS strengths TEXT,
  ADD COLUMN IF NOT EXISTS concerns TEXT,
  ADD COLUMN IF NOT EXISTS recommendation TEXT CHECK (recommendation IN ('strong_hire','hire','neutral','no_hire','strong_no_hire'));

-- ALTER recruitment_interviews
ALTER TABLE recruitment_interviews
  ADD COLUMN IF NOT EXISTS calendar_event_url TEXT,
  ADD COLUMN IF NOT EXISTS location_type TEXT DEFAULT 'virtual' CHECK (location_type IN ('virtual','in_person','phone')),
  ADD COLUMN IF NOT EXISTS location_address TEXT,
  ADD COLUMN IF NOT EXISTS ics_uid TEXT;

-- ============================================================
-- SECTION 4: ONBOARDING GAPS
-- ============================================================

-- Pre-boarding submissions (public portal, unauthenticated)
CREATE TABLE IF NOT EXISTS preboarding_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT UNIQUE NOT NULL DEFAULT uuid_generate_v4()::TEXT,
  candidate_id UUID REFERENCES recruitment_candidates(id),
  employee_id UUID REFERENCES employees(id),
  personal_info JSONB DEFAULT '{}'::jsonb,
  emergency_contacts JSONB DEFAULT '[]'::jsonb,
  bank_details JSONB DEFAULT '{}'::jsonb,
  document_uploads JSONB DEFAULT '[]'::jsonb,
  submitted_at TIMESTAMPTZ,
  token_expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','submitted','expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Offboarding records
CREATE TABLE IF NOT EXISTS offboarding_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  resignation_date DATE,
  last_working_date DATE,
  exit_type TEXT CHECK (exit_type IN ('resignation','termination','retirement','contract_end','other')),
  exit_interview_date DATE,
  exit_interviewer_id UUID REFERENCES employees(id),
  exit_feedback JSONB,
  fnf_status TEXT DEFAULT 'pending' CHECK (fnf_status IN ('pending','in_progress','completed')),
  fnf_amount NUMERIC(12,2),
  fnf_paid_at DATE,
  workflow_instance_id UUID,
  status TEXT DEFAULT 'initiated' CHECK (status IN ('initiated','in_progress','completed','cancelled')),
  created_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Offboarding tasks
CREATE TABLE IF NOT EXISTS offboarding_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offboarding_id UUID REFERENCES offboarding_records(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  task_category TEXT CHECK (task_category IN ('it','finance','hr','manager','legal','other')),
  assigned_to UUID REFERENCES employees(id),
  due_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','skipped')),
  notes TEXT,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ALTER onboarding_records
ALTER TABLE onboarding_records
  ADD COLUMN IF NOT EXISTS pre_boarding_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS buddy_id UUID REFERENCES employees(id),
  ADD COLUMN IF NOT EXISTS it_ticket_id UUID,
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS personal_email TEXT;

-- ALTER onboarding_documents
ALTER TABLE onboarding_documents
  ADD COLUMN IF NOT EXISTS signed_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS signature_data JSONB;

-- ============================================================
-- SECTION 5: USER MANAGEMENT GAPS
-- ============================================================

-- App user sessions
CREATE TABLE IF NOT EXISTS app_user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT,
  location TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  revoked BOOLEAN DEFAULT false,
  revoked_by UUID REFERENCES app_users(id),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON app_user_sessions(user_id);

-- Login history
CREATE TABLE IF NOT EXISTS login_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES app_users(id),
  email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT,
  location TEXT,
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  mfa_used BOOLEAN DEFAULT false,
  logged_in_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id);

-- Access review cycles
CREATE TABLE IF NOT EXISTS access_review_cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  created_by UUID REFERENCES app_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User access reviews
CREATE TABLE IF NOT EXISTS user_access_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id UUID REFERENCES access_review_cycles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES app_users(id),
  current_roles JSONB DEFAULT '[]'::jsonb,
  current_permissions JSONB DEFAULT '[]'::jsonb,
  decision TEXT CHECK (decision IN ('certify','revoke','modify')),
  decision_reason TEXT,
  decided_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','reviewed','escalated')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ALTER app_users
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invitation_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS mfa_enrolled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_secret TEXT,
  ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS purge_scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS force_mfa BOOLEAN DEFAULT false;

-- ============================================================
-- SECTION 6: PERFORMANCE GAPS
-- ============================================================

-- Performance OKRs
CREATE TABLE IF NOT EXISTS performance_okrs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  level TEXT DEFAULT 'individual' CHECK (level IN ('company','team','individual')),
  owner_id UUID REFERENCES employees(id),
  department TEXT,
  cycle_id UUID REFERENCES performance_cycles(id),
  parent_okr_id UUID REFERENCES performance_okrs(id),
  progress NUMERIC(5,2) DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('draft','active','completed','cancelled')),
  start_date DATE,
  end_date DATE,
  created_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_performance_okrs_owner ON performance_okrs(owner_id);
CREATE INDEX IF NOT EXISTS idx_performance_okrs_cycle ON performance_okrs(cycle_id);

-- Key results for OKRs
CREATE TABLE IF NOT EXISTS performance_key_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  okr_id UUID REFERENCES performance_okrs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_value NUMERIC(12,2),
  current_value NUMERIC(12,2) DEFAULT 0,
  unit TEXT,
  progress NUMERIC(5,2) DEFAULT 0,
  status TEXT DEFAULT 'on_track' CHECK (status IN ('on_track','at_risk','behind','completed')),
  last_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 360 feedback requests
CREATE TABLE IF NOT EXISTS performance_feedback_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID REFERENCES performance_reviews(id) ON DELETE CASCADE,
  reviewee_id UUID REFERENCES employees(id),
  reviewer_id UUID REFERENCES employees(id),
  relationship TEXT CHECK (relationship IN ('manager','peer','direct_report','self','external')),
  is_anonymous BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','submitted','declined')),
  due_date DATE,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Continuous feedback
CREATE TABLE IF NOT EXISTS performance_continuous_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_employee_id UUID REFERENCES employees(id),
  to_employee_id UUID REFERENCES employees(id),
  feedback_text TEXT NOT NULL,
  feedback_type TEXT DEFAULT 'recognition' CHECK (feedback_type IN ('recognition','improvement','coaching')),
  is_anonymous BOOLEAN DEFAULT false,
  is_private BOOLEAN DEFAULT false,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cont_feedback_to ON performance_continuous_feedback(to_employee_id);

-- ALTER performance_reviews
ALTER TABLE performance_reviews
  ADD COLUMN IF NOT EXISTS self_assessment_data JSONB,
  ADD COLUMN IF NOT EXISTS self_assessment_locked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS competency_scores JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS skill_gap_notes TEXT,
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finalized_by UUID REFERENCES employees(id);

-- ALTER performance_pips
ALTER TABLE performance_pips
  ADD COLUMN IF NOT EXISTS milestones JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS weekly_checkins JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS escalated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outcome TEXT CHECK (outcome IN ('completed','extended','terminated','resigned')),
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- ============================================================
-- SECTION 7: TRAINING GAPS
-- ============================================================

-- Learning paths (replaces useState-only paths)
CREATE TABLE IF NOT EXISTS training_paths (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  category TEXT,
  level TEXT DEFAULT 'beginner' CHECK (level IN ('beginner','intermediate','advanced')),
  estimated_hours INT,
  is_mandatory BOOLEAN DEFAULT false,
  target_roles JSONB DEFAULT '[]'::jsonb,
  target_departments JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Courses in learning paths
CREATE TABLE IF NOT EXISTS training_path_courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  path_id UUID REFERENCES training_paths(id) ON DELETE CASCADE,
  course_id UUID REFERENCES training_courses(id) ON DELETE CASCADE,
  sequence_order INT NOT NULL,
  is_optional BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(path_id, course_id)
);

-- Employee enrollment in learning paths
CREATE TABLE IF NOT EXISTS training_path_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  path_id UUID REFERENCES training_paths(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  progress NUMERIC(5,2) DEFAULT 0,
  status TEXT DEFAULT 'enrolled' CHECK (status IN ('enrolled','in_progress','completed','dropped')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(path_id, employee_id)
);

-- Training sessions (instructor-led or scheduled virtual)
CREATE TABLE IF NOT EXISTS training_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES training_courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  session_type TEXT DEFAULT 'virtual' CHECK (session_type IN ('in_person','virtual','hybrid')),
  instructor_id UUID REFERENCES employees(id),
  instructor_name TEXT,
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ NOT NULL,
  location TEXT,
  meeting_url TEXT,
  max_participants INT,
  registered_count INT DEFAULT 0,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  recording_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_training_sessions_course ON training_sessions(course_id);

-- Session registrations
CREATE TABLE IF NOT EXISTS training_session_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES training_sessions(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  attended BOOLEAN,
  attendance_marked_at TIMESTAMPTZ,
  feedback JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, employee_id)
);

-- Training needs (employee requests)
CREATE TABLE IF NOT EXISTS training_needs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  course_name TEXT NOT NULL,
  category TEXT,
  justification TEXT,
  estimated_cost NUMERIC(10,2),
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted','approved','rejected','fulfilled')),
  approved_by UUID REFERENCES employees(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ALTER training_certificates
ALTER TABLE training_certificates
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS renewal_course_id UUID REFERENCES training_courses(id),
  ADD COLUMN IF NOT EXISTS expiry_status TEXT DEFAULT 'valid' CHECK (expiry_status IN ('valid','expiring_soon','expired'));

-- ============================================================
-- SECTION 8: COMMUNICATIONS GAPS
-- ============================================================

-- Post read tracking
CREATE TABLE IF NOT EXISTS communications_post_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES communications_posts(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  UNIQUE(post_id, employee_id)
);
CREATE INDEX IF NOT EXISTS idx_post_reads_post ON communications_post_reads(post_id);

-- @mentions in posts
CREATE TABLE IF NOT EXISTS communications_post_mentions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES communications_posts(id) ON DELETE CASCADE,
  mentioned_employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event RSVPs
CREATE TABLE IF NOT EXISTS communications_event_rsvps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES communications_events(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'yes' CHECK (status IN ('yes','no','maybe')),
  responded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, employee_id)
);

-- Recognitions
CREATE TABLE IF NOT EXISTS communications_recognitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_employee_id UUID REFERENCES employees(id),
  to_employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL,
  message TEXT,
  is_public BOOLEAN DEFAULT true,
  post_id UUID REFERENCES communications_posts(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recognitions_to ON communications_recognitions(to_employee_id);

-- ALTER communications_posts
ALTER TABLE communications_posts
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS file_attachment_urls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS read_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acknowledgement_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS audience JSONB DEFAULT '{}'::jsonb;

-- ============================================================
-- SECTION 9: COLLABORATION HUB GAPS (full migration from localStorage)
-- ============================================================


-- ============================================================
-- SECTION 10: WORKFLOW AUTOMATION GAPS
-- ============================================================

-- Workflow versions
CREATE TABLE IF NOT EXISTS workflow_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  definition_snapshot JSONB NOT NULL,
  created_by UUID REFERENCES employees(id),
  change_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workflow_id, version_number)
);

-- Workflow instance steps (execution trace)
CREATE TABLE IF NOT EXISTS workflow_instance_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_id UUID NOT NULL,
  step_id TEXT NOT NULL,
  step_type TEXT NOT NULL,
  step_name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','skipped')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  input_data JSONB,
  output_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wf_instance_steps_instance ON workflow_instance_steps(instance_id);

-- Workflow trigger event mappings
CREATE TABLE IF NOT EXISTS workflow_trigger_event_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  source_app TEXT NOT NULL,
  source_table TEXT,
  filter_conditions JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECTION 11: NOTIFICATION BELL GAPS
-- ============================================================

-- ALTER notifications table
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'info' CHECK (type IN ('info','success','warning','error','action_required')),
  ADD COLUMN IF NOT EXISTS app_filter TEXT,
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id UUID,
  ADD COLUMN IF NOT EXISTS deep_link TEXT,
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS action_data JSONB;

-- Notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE UNIQUE,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  in_app_enabled BOOLEAN DEFAULT true,
  channel_preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification quiet hours
CREATE TABLE IF NOT EXISTS notification_quiet_hours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, day_of_week)
);

-- User push subscriptions (Web Push API)
CREATE TABLE IF NOT EXISTS user_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, endpoint)
);

-- ============================================================
-- SECTION 12: UPDATED_AT TRIGGERS FOR ALL NEW TABLES
-- ============================================================

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'shifts','employee_shifts','shift_swap_requests','payslips',
    'attendance_corrections','comp_off_requests','wfh_requests',
    'employee_education','employee_certifications','employee_previous_employers',
    'job_requisitions','recruitment_offers',
    'preboarding_submissions','offboarding_records','offboarding_tasks',
    'app_user_sessions','access_review_cycles','user_access_reviews',
    'performance_okrs','performance_key_results','performance_feedback_requests',
    'training_paths','training_path_courses','training_path_enrollments',
    'training_sessions','training_needs',
    'notification_preferences','workflow_versions','workflow_trigger_event_mappings'
  ]) LOOP
    BEGIN
      EXECUTE format('
        CREATE TRIGGER trg_%I_updated_at
          BEFORE UPDATE ON %I
          FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
        t, t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END;
$$;

-- ============================================================
-- SECTION 13: RLS POLICIES (enable RLS on new tables)
-- ============================================================

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'shifts','employee_shifts','shift_swap_requests','payslips',
    'attendance_corrections','comp_off_requests','wfh_requests',
    'employee_education','employee_certifications','employee_previous_employers',
    'employee_audit_log',
    'job_requisitions','recruitment_offers','recruitment_communication_log',
    'preboarding_submissions','offboarding_records','offboarding_tasks',
    'app_user_sessions','access_review_cycles','user_access_reviews','login_history',
    'performance_okrs','performance_key_results','performance_feedback_requests',
    'performance_continuous_feedback',
    'training_paths','training_path_courses','training_path_enrollments',
    'training_sessions','training_session_registrations','training_needs',
    'communications_post_reads','communications_post_mentions',
    'communications_event_rsvps','communications_recognitions',
    'workflow_versions','workflow_instance_steps','workflow_trigger_event_mappings',
    'notification_preferences','notification_quiet_hours','user_push_subscriptions'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    -- Allow authenticated users to read/write their own data
    -- (permissive policy for now — tighten per app as needed)
    BEGIN
      EXECUTE format('
        CREATE POLICY "authenticated_access_%I"
          ON %I FOR ALL
          TO authenticated
          USING (true)
          WITH CHECK (true)',
        t, t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END;
$$;

-- Allow anon to access preboarding_submissions (public portal)
BEGIN;
  DROP POLICY IF EXISTS "anon_preboarding" ON preboarding_submissions;
  CREATE POLICY "anon_preboarding" ON preboarding_submissions
    FOR ALL TO anon USING (true) WITH CHECK (true);
COMMIT;


-- ────────────────────────────────────────────────────────────
-- SOURCE: 06_hr_master_data_seed.sql
-- ────────────────────────────────────────────────────────────

-- ============================================================
-- HR PORTAL — MASTER DATA SEED (Migration 06)
-- Source: HR_Spec_Part1a_MasterData_Permissions.txt
-- All statements are idempotent (ON CONFLICT DO NOTHING / DO UPDATE).
-- Run after 01_schema.sql and 02_seed.sql.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- SECTION 1: LEAVE_TYPES
-- Stored in master_value_helps (entity='leave_types') because
-- the existing leave_policies table has a simpler structure.
-- Full config stored as JSONB in the value column.
-- ============================================================

-- Unique index to make this idempotent
CREATE UNIQUE INDEX IF NOT EXISTS uidx_mvh_leave_types_name
  ON master_value_helps (entity, field, lower(label))
  WHERE entity = 'leave_types';


-- ============================================================
-- SECTION 14: ONBOARDING_CHECKLIST_TEMPLATES
-- Uses onboarding_workflow_templates table.
-- ============================================================

-- Unique index for idempotent inserts on name
CREATE UNIQUE INDEX IF NOT EXISTS uidx_onboarding_workflow_templates_name
  ON onboarding_workflow_templates (lower(name));


-- ============================================================
-- DONE
-- Migration 06: HR Master Data Seed — all 20 entities seeded.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- SOURCE: 07_business_apps_spec.sql
-- ────────────────────────────────────────────────────────────

-- =============================================================================
-- Migration 07: Business Apps Spec Tables
-- Created: 2026-09-05
-- Covers: OKR, Executive Dashboard, Analytics, Security & Compliance,
--         Advanced Features, Documentation, Invoice Generation, Payroll
-- =============================================================================

-- ========================
-- OKR MANAGEMENT
-- ========================

CREATE TABLE IF NOT EXISTS okr_cycles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('planning','active','grading','closed')),
  description     TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE okr_cycles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "okr_cycles_select" ON okr_cycles;
CREATE POLICY "okr_cycles_select" ON okr_cycles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "okr_cycles_insert" ON okr_cycles;
CREATE POLICY "okr_cycles_insert" ON okr_cycles FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "okr_cycles_update" ON okr_cycles;
CREATE POLICY "okr_cycles_update" ON okr_cycles FOR UPDATE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS okr_checkins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  okr_id          UUID NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
  checked_in_by   UUID REFERENCES auth.users(id),
  current_value   NUMERIC,
  confidence      INTEGER CHECK (confidence BETWEEN 1 AND 5),
  notes           TEXT,
  has_blocker     BOOLEAN NOT NULL DEFAULT FALSE,
  blocker_description TEXT,
  checked_in_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE okr_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "okr_checkins_select" ON okr_checkins;
CREATE POLICY "okr_checkins_select" ON okr_checkins FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "okr_checkins_insert" ON okr_checkins;
CREATE POLICY "okr_checkins_insert" ON okr_checkins FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS okr_cycle_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id        UUID NOT NULL REFERENCES okr_cycles(id) ON DELETE CASCADE,
  okr_id          UUID NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
  final_score     NUMERIC(4,3) CHECK (final_score BETWEEN 0 AND 1),
  grade           TEXT CHECK (grade IN ('A','B','C','D','F')),
  graded_by       UUID REFERENCES auth.users(id),
  graded_at       TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cycle_id, okr_id)
);

ALTER TABLE okr_cycle_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "okr_cycle_scores_select" ON okr_cycle_scores;
CREATE POLICY "okr_cycle_scores_select" ON okr_cycle_scores FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "okr_cycle_scores_insert" ON okr_cycle_scores;
CREATE POLICY "okr_cycle_scores_insert" ON okr_cycle_scores FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "okr_cycle_scores_update" ON okr_cycle_scores;
CREATE POLICY "okr_cycle_scores_update" ON okr_cycle_scores FOR UPDATE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS okr_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  category        TEXT,
  description     TEXT,
  objective_template TEXT NOT NULL,
  key_results_template JSONB NOT NULL DEFAULT '[]',
  created_by      UUID REFERENCES auth.users(id),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE okr_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "okr_templates_select" ON okr_templates;
CREATE POLICY "okr_templates_select" ON okr_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "okr_templates_insert" ON okr_templates;
CREATE POLICY "okr_templates_insert" ON okr_templates FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "okr_templates_update" ON okr_templates;
CREATE POLICY "okr_templates_update" ON okr_templates FOR UPDATE TO authenticated USING (true);

-- ========================
-- EXECUTIVE DASHBOARD
-- ========================

CREATE TABLE IF NOT EXISTS user_dashboard_layouts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  layout          JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

ALTER TABLE user_dashboard_layouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_dashboard_layouts_own" ON user_dashboard_layouts;
CREATE POLICY "user_dashboard_layouts_own" ON user_dashboard_layouts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  created_by      UUID NOT NULL REFERENCES auth.users(id),
  report_type     TEXT NOT NULL DEFAULT 'executive_summary',
  filter_config   JSONB NOT NULL DEFAULT '{}',
  schedule        TEXT CHECK (schedule IN ('daily','weekly','monthly','first_of_month')),
  recipients      TEXT[] DEFAULT '{}',
  last_run_at     TIMESTAMPTZ,
  next_run_at     TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scheduled_reports_select" ON scheduled_reports;
CREATE POLICY "scheduled_reports_select" ON scheduled_reports FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "scheduled_reports_insert" ON scheduled_reports;
CREATE POLICY "scheduled_reports_insert" ON scheduled_reports FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS "scheduled_reports_update" ON scheduled_reports;
CREATE POLICY "scheduled_reports_update" ON scheduled_reports FOR UPDATE TO authenticated USING (created_by = auth.uid());
DROP POLICY IF EXISTS "scheduled_reports_delete" ON scheduled_reports;
CREATE POLICY "scheduled_reports_delete" ON scheduled_reports FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE TABLE IF NOT EXISTS user_export_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id),
  export_type     TEXT NOT NULL,
  format          TEXT CHECK (format IN ('pdf','png','csv','xlsx')),
  file_url        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_export_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_export_log_own" ON user_export_log;
CREATE POLICY "user_export_log_own" ON user_export_log FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ========================
-- ANALYTICS
-- ========================

CREATE TABLE IF NOT EXISTS analytics_saved_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  created_by      UUID NOT NULL REFERENCES auth.users(id),
  domain          TEXT[] NOT NULL,
  metric_config   JSONB NOT NULL DEFAULT '{}',
  filter_config   JSONB NOT NULL DEFAULT '{}',
  date_from       DATE,
  date_to         DATE,
  schedule        TEXT CHECK (schedule IN ('one_off','daily','weekly','monday_morning','first_of_month')),
  recipients      TEXT[] DEFAULT '{}',
  last_run_at     TIMESTAMPTZ,
  next_run_at     TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name, created_by)
);

ALTER TABLE analytics_saved_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analytics_saved_reports_select" ON analytics_saved_reports;
CREATE POLICY "analytics_saved_reports_select" ON analytics_saved_reports FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "analytics_saved_reports_insert" ON analytics_saved_reports;
CREATE POLICY "analytics_saved_reports_insert" ON analytics_saved_reports FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS "analytics_saved_reports_update" ON analytics_saved_reports;
CREATE POLICY "analytics_saved_reports_update" ON analytics_saved_reports FOR UPDATE TO authenticated USING (created_by = auth.uid());
DROP POLICY IF EXISTS "analytics_saved_reports_delete" ON analytics_saved_reports;
CREATE POLICY "analytics_saved_reports_delete" ON analytics_saved_reports FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE TABLE IF NOT EXISTS analytics_report_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       UUID NOT NULL REFERENCES analytics_saved_reports(id) ON DELETE CASCADE,
  run_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  triggered_by    TEXT NOT NULL CHECK (triggered_by IN ('schedule','manual')),
  status          TEXT NOT NULL CHECK (status IN ('running','completed','failed')),
  output_url      TEXT,
  row_count       INTEGER,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE analytics_report_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analytics_report_runs_select" ON analytics_report_runs;
CREATE POLICY "analytics_report_runs_select" ON analytics_report_runs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "analytics_report_runs_insert" ON analytics_report_runs;
CREATE POLICY "analytics_report_runs_insert" ON analytics_report_runs FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS analytics_anomalies (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key       TEXT NOT NULL,
  detected_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_value    NUMERIC NOT NULL,
  baseline_value   NUMERIC NOT NULL,
  deviation_percent NUMERIC NOT NULL,
  severity         TEXT NOT NULL CHECK (severity IN ('amber','red')),
  resolved_at      TIMESTAMPTZ,
  acknowledged_by  UUID REFERENCES auth.users(id),
  filter_snapshot  JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE analytics_anomalies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analytics_anomalies_select" ON analytics_anomalies;
CREATE POLICY "analytics_anomalies_select" ON analytics_anomalies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "analytics_anomalies_insert" ON analytics_anomalies;
CREATE POLICY "analytics_anomalies_insert" ON analytics_anomalies FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "analytics_anomalies_update" ON analytics_anomalies;
CREATE POLICY "analytics_anomalies_update" ON analytics_anomalies FOR UPDATE TO authenticated USING (true);

-- ========================
-- SECURITY & COMPLIANCE
-- ========================

CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id         UUID REFERENCES auth.users(id),
  user_email      TEXT,
  user_role       TEXT,
  event_type      TEXT NOT NULL,
  action          TEXT NOT NULL,
  resource_type   TEXT,
  resource_id     TEXT,
  severity        TEXT NOT NULL CHECK (severity IN ('info','low','medium','high','critical')),
  status          TEXT NOT NULL CHECK (status IN ('success','failure')),
  ip_address      TEXT,
  user_agent      TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
-- Append-only: SELECT + INSERT for authenticated, no UPDATE or DELETE
DROP POLICY IF EXISTS "audit_logs_select" ON audit_logs;
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS compliance_frameworks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,
  version         TEXT,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE compliance_frameworks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "compliance_frameworks_select" ON compliance_frameworks;
CREATE POLICY "compliance_frameworks_select" ON compliance_frameworks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "compliance_frameworks_insert" ON compliance_frameworks;
CREATE POLICY "compliance_frameworks_insert" ON compliance_frameworks FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "compliance_frameworks_update" ON compliance_frameworks;
CREATE POLICY "compliance_frameworks_update" ON compliance_frameworks FOR UPDATE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS compliance_requirements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id    UUID NOT NULL REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,
  control_id      TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'non_compliant'
                    CHECK (status IN ('compliant','partial','in_progress','non_compliant')),
  assigned_to     UUID REFERENCES auth.users(id),
  evidence        JSONB DEFAULT '[]',
  last_assessed   DATE,
  assessment_notes TEXT,
  status_change_reason TEXT,
  due_date        DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (framework_id, control_id)
);

ALTER TABLE compliance_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "compliance_requirements_select" ON compliance_requirements;
CREATE POLICY "compliance_requirements_select" ON compliance_requirements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "compliance_requirements_insert" ON compliance_requirements;
CREATE POLICY "compliance_requirements_insert" ON compliance_requirements FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "compliance_requirements_update" ON compliance_requirements;
CREATE POLICY "compliance_requirements_update" ON compliance_requirements FOR UPDATE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS compliance_assessments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id    UUID NOT NULL REFERENCES compliance_frameworks(id),
  assessed_by     UUID NOT NULL REFERENCES auth.users(id),
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  overall_status  TEXT CHECK (overall_status IN ('compliant','partial','non_compliant')),
  findings        TEXT,
  recommendations TEXT,
  score_percent   NUMERIC(5,2) CHECK (score_percent BETWEEN 0 AND 100),
  evidence_files  JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE compliance_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "compliance_assessments_select" ON compliance_assessments;
CREATE POLICY "compliance_assessments_select" ON compliance_assessments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "compliance_assessments_insert" ON compliance_assessments;
CREATE POLICY "compliance_assessments_insert" ON compliance_assessments FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS privacy_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_name  TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  request_type    TEXT NOT NULL CHECK (request_type IN ('access','deletion','rectification','portability','objection')),
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','in_progress','completed','rejected')),
  assigned_to     UUID REFERENCES auth.users(id),
  received_at     DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE NOT NULL,
  completed_at    TIMESTAMPTZ,
  response_notes  TEXT,
  regulation      TEXT NOT NULL CHECK (regulation IN ('GDPR','CCPA')),
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE privacy_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "privacy_requests_select" ON privacy_requests;
CREATE POLICY "privacy_requests_select" ON privacy_requests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "privacy_requests_insert" ON privacy_requests;
CREATE POLICY "privacy_requests_insert" ON privacy_requests FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "privacy_requests_update" ON privacy_requests;
CREATE POLICY "privacy_requests_update" ON privacy_requests FOR UPDATE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS security_risks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN ('Data Breach','Unauthorized Access','System Failure','Compliance','Insider Threat')),
  likelihood      INTEGER NOT NULL CHECK (likelihood BETWEEN 1 AND 3),
  impact          INTEGER NOT NULL CHECK (impact BETWEEN 1 AND 3),
  risk_score      INTEGER GENERATED ALWAYS AS (likelihood * impact) STORED,
  mitigation_plan TEXT,
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','mitigating','resolved','accepted')),
  owner           UUID REFERENCES auth.users(id),
  review_date     DATE,
  last_reviewed_at DATE,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE security_risks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "security_risks_select" ON security_risks;
CREATE POLICY "security_risks_select" ON security_risks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "security_risks_insert" ON security_risks;
CREATE POLICY "security_risks_insert" ON security_risks FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "security_risks_update" ON security_risks;
CREATE POLICY "security_risks_update" ON security_risks FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "security_risks_delete" ON security_risks;
CREATE POLICY "security_risks_delete" ON security_risks FOR DELETE TO authenticated USING (true);

-- ========================
-- ADVANCED FEATURES
-- ========================

CREATE TABLE IF NOT EXISTS custom_reports (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL CHECK (length(name) BETWEEN 3 AND 100),
  description           TEXT,
  type                  TEXT NOT NULL CHECK (type IN ('table', 'chart', 'dashboard')),
  domain                TEXT NOT NULL,
  metric_config         JSONB NOT NULL DEFAULT '{}',
  filter_config         JSONB NOT NULL DEFAULT '{}',
  is_favorite           BOOLEAN NOT NULL DEFAULT false,
  schedule              TEXT CHECK (schedule IN ('daily', 'weekly', 'monthly', 'custom')),
  schedule_time         TEXT,
  schedule_cron         TEXT,
  schedule_recipients   TEXT[] NOT NULL DEFAULT '{}',
  next_run_at           TIMESTAMPTZ,
  last_run_at           TIMESTAMPTZ,
  last_run_output       JSONB,
  run_count             INTEGER NOT NULL DEFAULT 0,
  created_by            UUID NOT NULL REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, created_by)
);

ALTER TABLE custom_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "custom_reports_own" ON custom_reports;
CREATE POLICY "custom_reports_own" ON custom_reports FOR ALL TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE TABLE IF NOT EXISTS report_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       UUID NOT NULL REFERENCES custom_reports(id) ON DELETE CASCADE,
  run_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_by          UUID REFERENCES auth.users(id),
  trigger         TEXT NOT NULL CHECK (trigger IN ('manual', 'scheduled')),
  status          TEXT NOT NULL CHECK (status IN ('running', 'success', 'error')),
  row_count       INTEGER,
  output_url      TEXT,
  error_message   TEXT
);

ALTER TABLE report_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "report_runs_select" ON report_runs;
CREATE POLICY "report_runs_select" ON report_runs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "report_runs_insert" ON report_runs;
CREATE POLICY "report_runs_insert" ON report_runs FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS monitoring_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name     TEXT NOT NULL,
  value           NUMERIC NOT NULL,
  unit            TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('healthy', 'warning', 'critical')),
  source          TEXT,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE monitoring_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "monitoring_metrics_select" ON monitoring_metrics;
CREATE POLICY "monitoring_metrics_select" ON monitoring_metrics FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "monitoring_metrics_insert" ON monitoring_metrics;
CREATE POLICY "monitoring_metrics_insert" ON monitoring_metrics FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS integrations_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id  TEXT NOT NULL,
  workspace_id    UUID,
  credentials     JSONB,
  status          TEXT NOT NULL CHECK (status IN ('connected', 'disconnected', 'error', 'suspended')) DEFAULT 'disconnected',
  last_tested_at  TIMESTAMPTZ,
  last_synced_at  TIMESTAMPTZ,
  config          JSONB NOT NULL DEFAULT '{}',
  error_message   TEXT,
  created_by      UUID NOT NULL REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (integration_id)
);

ALTER TABLE integrations_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "integrations_config_select" ON integrations_config;
CREATE POLICY "integrations_config_select" ON integrations_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "integrations_config_insert" ON integrations_config;
CREATE POLICY "integrations_config_insert" ON integrations_config FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "integrations_config_update" ON integrations_config;
CREATE POLICY "integrations_config_update" ON integrations_config FOR UPDATE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS integration_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id  TEXT NOT NULL,
  direction       TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  event_type      TEXT NOT NULL,
  payload_preview TEXT,
  status          TEXT NOT NULL CHECK (status IN ('success', 'error', 'pending')),
  http_status     INTEGER,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "integration_events_select" ON integration_events;
CREATE POLICY "integration_events_select" ON integration_events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "integration_events_insert" ON integration_events;
CREATE POLICY "integration_events_insert" ON integration_events FOR INSERT TO authenticated WITH CHECK (true);

-- ========================
-- DOCUMENTATION / CMS
-- ========================

CREATE TABLE IF NOT EXISTS doc_apps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  icon            TEXT NOT NULL,
  description     TEXT NOT NULL,
  route           TEXT NOT NULL,
  category        TEXT DEFAULT 'general',
  role_access     TEXT[] NOT NULL DEFAULT '{}',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE doc_apps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "doc_apps_select" ON doc_apps;
CREATE POLICY "doc_apps_select" ON doc_apps FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "doc_apps_insert" ON doc_apps;
CREATE POLICY "doc_apps_insert" ON doc_apps FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "doc_apps_update" ON doc_apps;
CREATE POLICY "doc_apps_update" ON doc_apps FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "doc_apps_delete" ON doc_apps;
CREATE POLICY "doc_apps_delete" ON doc_apps FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS doc_sections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id          UUID NOT NULL REFERENCES doc_apps(id) ON DELETE CASCADE,
  section_type    TEXT NOT NULL CHECK (section_type IN ('quickstart', 'feature', 'faq', 'guide', 'video')),
  title           TEXT NOT NULL,
  content         JSONB NOT NULL DEFAULT '{}',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  required_role   TEXT,
  status          TEXT NOT NULL CHECK (status IN ('published', 'draft')) DEFAULT 'draft',
  view_count      INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE doc_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "doc_sections_select" ON doc_sections;
CREATE POLICY "doc_sections_select" ON doc_sections FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "doc_sections_insert" ON doc_sections;
CREATE POLICY "doc_sections_insert" ON doc_sections FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "doc_sections_update" ON doc_sections;
CREATE POLICY "doc_sections_update" ON doc_sections FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "doc_sections_delete" ON doc_sections;
CREATE POLICY "doc_sections_delete" ON doc_sections FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS doc_quick_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id          UUID NOT NULL REFERENCES doc_apps(id) ON DELETE CASCADE,
  step_number     INTEGER NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  screenshot_url  TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (app_id, step_number)
);

ALTER TABLE doc_quick_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "doc_quick_steps_select" ON doc_quick_steps;
CREATE POLICY "doc_quick_steps_select" ON doc_quick_steps FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "doc_quick_steps_insert" ON doc_quick_steps;
CREATE POLICY "doc_quick_steps_insert" ON doc_quick_steps FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "doc_quick_steps_update" ON doc_quick_steps;
CREATE POLICY "doc_quick_steps_update" ON doc_quick_steps FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "doc_quick_steps_delete" ON doc_quick_steps;
CREATE POLICY "doc_quick_steps_delete" ON doc_quick_steps FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS doc_faqs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id          UUID NOT NULL REFERENCES doc_apps(id) ON DELETE CASCADE,
  category        TEXT NOT NULL CHECK (category IN ('basic', 'technical', 'troubleshooting')),
  question        TEXT NOT NULL CHECK (length(question) >= 10),
  answer          TEXT NOT NULL CHECK (length(answer) >= 20),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL CHECK (status IN ('published', 'draft')) DEFAULT 'published',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE doc_faqs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "doc_faqs_select" ON doc_faqs;
CREATE POLICY "doc_faqs_select" ON doc_faqs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "doc_faqs_insert" ON doc_faqs;
CREATE POLICY "doc_faqs_insert" ON doc_faqs FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "doc_faqs_update" ON doc_faqs;
CREATE POLICY "doc_faqs_update" ON doc_faqs FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "doc_faqs_delete" ON doc_faqs;
CREATE POLICY "doc_faqs_delete" ON doc_faqs FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS doc_videos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id          UUID NOT NULL REFERENCES doc_apps(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  youtube_url     TEXT,
  vimeo_url       TEXT,
  thumbnail_url   TEXT,
  duration_mins   NUMERIC(5,1),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL CHECK (status IN ('published', 'draft')) DEFAULT 'draft',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE doc_videos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "doc_videos_select" ON doc_videos;
CREATE POLICY "doc_videos_select" ON doc_videos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "doc_videos_insert" ON doc_videos;
CREATE POLICY "doc_videos_insert" ON doc_videos FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "doc_videos_update" ON doc_videos;
CREATE POLICY "doc_videos_update" ON doc_videos FOR UPDATE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS doc_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type    TEXT NOT NULL CHECK (content_type IN ('faq', 'section', 'quickstep', 'video')),
  content_id      UUID NOT NULL,
  user_id         UUID REFERENCES auth.users(id),
  rating          INTEGER NOT NULL CHECK (rating IN (1, -1)),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (content_type, content_id, user_id)
);

ALTER TABLE doc_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "doc_feedback_select" ON doc_feedback;
CREATE POLICY "doc_feedback_select" ON doc_feedback FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "doc_feedback_insert" ON doc_feedback;
CREATE POLICY "doc_feedback_insert" ON doc_feedback FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ========================
-- INVOICE GENERATION
-- ========================

CREATE TABLE IF NOT EXISTS clients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT,
  address         TEXT,
  city            TEXT,
  country         TEXT DEFAULT 'India',
  gst_number      TEXT,
  pan_number      TEXT,
  currency        TEXT DEFAULT 'INR',
  payment_terms   TEXT DEFAULT 'NET30' CHECK (payment_terms IN ('NET15','NET30','NET45','NET60')),
  notes           TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clients_select" ON clients;
CREATE POLICY "clients_select" ON clients FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "clients_insert" ON clients;
CREATE POLICY "clients_insert" ON clients FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "clients_update" ON clients;
CREATE POLICY "clients_update" ON clients FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "clients_delete" ON clients;
CREATE POLICY "clients_delete" ON clients FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS invoice_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  line_items      JSONB DEFAULT '[]',
  notes_template  TEXT,
  payment_terms   TEXT DEFAULT 'NET30',
  tax_rate        NUMERIC(5,2) DEFAULT 18.00,
  is_default      BOOLEAN DEFAULT false,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE invoice_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoice_templates_select" ON invoice_templates;
CREATE POLICY "invoice_templates_select" ON invoice_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "invoice_templates_insert" ON invoice_templates;
CREATE POLICY "invoice_templates_insert" ON invoice_templates FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "invoice_templates_update" ON invoice_templates;
CREATE POLICY "invoice_templates_update" ON invoice_templates FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "invoice_templates_delete" ON invoice_templates;
CREATE POLICY "invoice_templates_delete" ON invoice_templates FOR DELETE TO authenticated USING (true);

-- Partial unique index: only one default template
CREATE UNIQUE INDEX IF NOT EXISTS invoice_templates_default_idx ON invoice_templates (is_default) WHERE is_default = true;

CREATE TABLE IF NOT EXISTS recurring_invoice_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID REFERENCES invoice_templates(id),
  client_id       UUID REFERENCES clients(id) NOT NULL,
  frequency       TEXT NOT NULL CHECK (frequency IN ('weekly','monthly','quarterly','annually')),
  start_date      DATE NOT NULL,
  end_date        DATE,
  next_run_date   DATE NOT NULL,
  auto_send       BOOLEAN DEFAULT false,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active','paused','completed')),
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE recurring_invoice_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recurring_invoice_configs_select" ON recurring_invoice_configs;
CREATE POLICY "recurring_invoice_configs_select" ON recurring_invoice_configs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "recurring_invoice_configs_insert" ON recurring_invoice_configs;
CREATE POLICY "recurring_invoice_configs_insert" ON recurring_invoice_configs FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "recurring_invoice_configs_update" ON recurring_invoice_configs;
CREATE POLICY "recurring_invoice_configs_update" ON recurring_invoice_configs FOR UPDATE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS invoice_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method  TEXT CHECK (payment_method IN ('bank_transfer','cheque','upi','cash','credit_card','other')),
  reference       TEXT,
  notes           TEXT,
  recorded_by     UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoice_payments_select" ON invoice_payments;
CREATE POLICY "invoice_payments_select" ON invoice_payments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "invoice_payments_insert" ON invoice_payments;
CREATE POLICY "invoice_payments_insert" ON invoice_payments FOR INSERT TO authenticated WITH CHECK (true);

-- Add columns to invoices table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='client_id') THEN
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='sent_at') THEN
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='email_sent_to') THEN
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS email_sent_to TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='amount_paid') THEN
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='balance_due') THEN
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS balance_due NUMERIC(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='recurring_config_id') THEN
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS recurring_config_id UUID REFERENCES recurring_invoice_configs(id);
  END IF;
  ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_period_from DATE;
  ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_period_to DATE;
  ALTER TABLE invoices ADD COLUMN IF NOT EXISTS po_number TEXT;
END $$;

-- The current Invoice Generation UI uses clients, not the legacy invoice_clients table.
UPDATE invoices
SET client_id = NULL
WHERE client_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM clients WHERE clients.id = invoices.client_id);
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_client_id_fkey;
ALTER TABLE invoices
  ADD CONSTRAINT invoices_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

-- ========================
-- PAYROLL
-- ========================

CREATE TABLE IF NOT EXISTS payroll_locks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month           INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year            INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2099),
  locked_by       UUID REFERENCES auth.users(id),
  locked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unlocked_by     UUID REFERENCES auth.users(id),
  unlocked_at     TIMESTAMPTZ,
  notes           TEXT,
  UNIQUE (month, year)
);

ALTER TABLE payroll_locks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payroll_locks_select" ON payroll_locks;
CREATE POLICY "payroll_locks_select" ON payroll_locks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "payroll_locks_insert" ON payroll_locks;
CREATE POLICY "payroll_locks_insert" ON payroll_locks FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "payroll_locks_update" ON payroll_locks;
CREATE POLICY "payroll_locks_update" ON payroll_locks FOR UPDATE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS salary_revision_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL,
  old_ctc         NUMERIC(12,2) NOT NULL,
  new_ctc         NUMERIC(12,2) NOT NULL,
  effective_from  DATE NOT NULL,
  revision_type   TEXT CHECK (revision_type IN ('annual_appraisal','promotion','correction','joining')),
  approved_by     UUID REFERENCES auth.users(id),
  submitted_by    UUID REFERENCES auth.users(id),
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE salary_revision_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "salary_revision_select" ON salary_revision_history;
CREATE POLICY "salary_revision_select" ON salary_revision_history FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "salary_revision_insert" ON salary_revision_history;
CREATE POLICY "salary_revision_insert" ON salary_revision_history FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "salary_revision_update" ON salary_revision_history;
CREATE POLICY "salary_revision_update" ON salary_revision_history FOR UPDATE TO authenticated USING (true);

-- Professional Tax slabs (state-wise)
CREATE TABLE IF NOT EXISTS professional_tax_slabs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state           TEXT NOT NULL,
  income_from     NUMERIC(12,2) NOT NULL,
  income_to       NUMERIC(12,2),
  monthly_pt      NUMERIC(8,2) NOT NULL,
  annual_pt       NUMERIC(8,2) NOT NULL,
  effective_from  DATE NOT NULL DEFAULT '2024-04-01',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (state, income_from)
);

ALTER TABLE professional_tax_slabs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pt_slabs_select" ON professional_tax_slabs;
CREATE POLICY "pt_slabs_select" ON professional_tax_slabs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pt_slabs_insert" ON professional_tax_slabs;
CREATE POLICY "pt_slabs_insert" ON professional_tax_slabs FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "pt_slabs_update" ON professional_tax_slabs;
CREATE POLICY "pt_slabs_update" ON professional_tax_slabs FOR UPDATE TO authenticated USING (true);

-- ============================================================
-- Task audit date columns
-- ============================================================
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'task';
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- ============================================================
-- Sequence-based ID generators
-- ============================================================

-- 1. Employee code: use a proper sequence to avoid COUNT(*) race conditions
CREATE SEQUENCE IF NOT EXISTS employee_code_seq START 1001 INCREMENT 1;

CREATE OR REPLACE FUNCTION generate_employee_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.employee_code IS NULL THEN
    NEW.employee_code := 'JSN' || LPAD(nextval('employee_code_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_employee_code ON employees;
CREATE TRIGGER trg_employee_code
  BEFORE INSERT ON employees
  FOR EACH ROW EXECUTE FUNCTION generate_employee_code();

-- Sync sequence to current max so existing rows are not re-used
DO $$
DECLARE max_num INT;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(employee_code, '[^0-9]', '', 'g'), '')::INT), 1000)
    INTO max_num FROM employees WHERE employee_code LIKE 'JSN%';
  PERFORM setval('employee_code_seq', max_num + 1, false);
END $$;

-- 2. Invoice number sequence — wire to a helper RPC so edge functions can use it
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1001 INCREMENT 1;

-- Sync to current max
DO $$
DECLARE max_num INT;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(invoice_number, '[^0-9]', '', 'g'), '')::INT), 1000)
    INTO max_num FROM invoices WHERE invoice_number LIKE 'JSN%';
  PERFORM setval('invoice_number_seq', max_num + 1, false);
END $$;

-- RPC callable by edge functions
CREATE OR REPLACE FUNCTION nextval_invoice_number()
RETURNS BIGINT
LANGUAGE sql SECURITY DEFINER
AS $$ SELECT nextval('invoice_number_seq'); $$;

-- 3. Defect ID sequence
CREATE SEQUENCE IF NOT EXISTS defect_id_seq START 1001 INCREMENT 1;

CREATE OR REPLACE FUNCTION generate_defect_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.defect_id IS NULL OR NEW.defect_id = '' THEN
    NEW.defect_id := 'DEF-' || LPAD(nextval('defect_id_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_defect_id ON project_defects;
CREATE TRIGGER trg_defect_id
  BEFORE INSERT ON project_defects
  FOR EACH ROW EXECUTE FUNCTION generate_defect_id();

-- Sync defect sequence
DO $$
DECLARE max_num INT;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(defect_id, '[^0-9]', '', 'g'), '')::INT), 1000)
    INTO max_num FROM project_defects WHERE defect_id LIKE 'DEF-%';
  PERFORM setval('defect_id_seq', max_num + 1, false);
END $$;

-- ============================================================
-- Sequential ID sequences for IT tickets and backlog items
-- ============================================================

-- IT Ticket numbers: INC-######
CREATE SEQUENCE IF NOT EXISTS it_ticket_number_seq START 1001 INCREMENT 1;

CREATE OR REPLACE FUNCTION generate_it_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := 'INC-' || LPAD(nextval('it_ticket_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_it_ticket_number ON it_tickets;
CREATE TRIGGER trg_it_ticket_number
  BEFORE INSERT ON it_tickets
  FOR EACH ROW EXECUTE FUNCTION generate_it_ticket_number();

-- Sync to current max
DO $$
DECLARE max_num INT;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(ticket_number, '[^0-9]', '', 'g'), '')::INT), 1000)
    INTO max_num FROM it_tickets WHERE ticket_number LIKE 'INC-%';
  PERFORM setval('it_ticket_number_seq', max_num + 1, false);
END $$;

-- Backlog item IDs: BLI-####
CREATE SEQUENCE IF NOT EXISTS backlog_item_id_seq START 1001 INCREMENT 1;

CREATE OR REPLACE FUNCTION generate_backlog_item_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.item_id IS NULL OR NEW.item_id = '' THEN
    NEW.item_id := 'BLI-' || LPAD(nextval('backlog_item_id_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_backlog_item_id ON project_backlog_items;
CREATE TRIGGER trg_backlog_item_id
  BEFORE INSERT ON project_backlog_items
  FOR EACH ROW EXECUTE FUNCTION generate_backlog_item_id();

-- Sync to current max
DO $$
DECLARE max_num INT;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(item_id, '[^0-9]', '', 'g'), '')::INT), 1000)
    INTO max_num FROM project_backlog_items WHERE item_id LIKE 'BLI-%';
  PERFORM setval('backlog_item_id_seq', max_num + 1, false);
END $$;

-- RPC: get next backlog item ID from sequence (call via supabase.rpc)
CREATE OR REPLACE FUNCTION nextval_backlog_item_id()
RETURNS TEXT AS $$
  SELECT 'BLI-' || LPAD(nextval('backlog_item_id_seq')::TEXT, 4, '0');
$$ LANGUAGE SQL SECURITY DEFINER;

-- ============================================================
-- MIGRATION 07: project_tasks sprint columns
-- (idempotent — mirrors 07_project_tasks_columns.sql)
-- ============================================================

ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES project_sprints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sprint_change_reason TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sprint_change_history JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_project_tasks_sprint_id ON project_tasks(sprint_id);

-- ============================================================
-- MIGRATION 08: Communications Hub column additions
-- (idempotent — mirrors 08_communications_columns.sql)
-- ============================================================

ALTER TABLE communications_posts
  ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS likes_by JSONB DEFAULT '[]'::jsonb;

ALTER TABLE communications_polls
  ADD COLUMN IF NOT EXISTS voters JSONB DEFAULT '[]'::jsonb;

ALTER TABLE communications_channels
  ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 0;

ALTER TABLE communications_event_rsvps
  ADD COLUMN IF NOT EXISTS user_id UUID;

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

-- ============================================================
-- MIGRATION 11: Drop Collaboration Hub chat tables
-- (chat tables were removed — see 11_drop_chat_tables.sql)
-- No DDL needed here; fresh installs never create them.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- File: 02_seed_data.sql
-- Purpose: Reference data, lookup values, and idempotent starter data
-- ────────────────────────────────────────────────────────────

-- ============================================================
-- JESHAN LABS HR PORTAL - 02_seed_data.sql
-- ALL seed data: master data, lookup values, defaults, demo rows.
-- Requires 01_schema.sql to have been run first.
-- Every insert uses ON CONFLICT - safe to run multiple times.
-- ============================================================

-- ------------------------------------------------------------
-- SOURCE: 01_schema_and_seed.sql
-- ------------------------------------------------------------


INSERT INTO project_methodologies (name, description) VALUES
  ('Agile', 'Iterative development with sprints'),
  ('Scrum', 'Scrum framework with ceremonies'),
  ('Kanban', 'Continuous flow with WIP limits'),
  ('Waterfall', 'Sequential phase-based approach'),
  ('SAFe', 'Scaled Agile Framework'),
  ('Prince2', 'Projects IN Controlled Environments'),
  ('PMP', 'Project Management Professional standard'),
  ('Lean', 'Lean methodology')
ON CONFLICT (name) DO NOTHING;

INSERT INTO it_sla_policies (name, priority, first_response_mins, resolution_mins) VALUES
  ('Low Priority SLA',      'Low',      240, 2880),
  ('Medium Priority SLA',   'Medium',   120, 1440),
  ('High Priority SLA',     'High',      60,  480),
  ('Critical Priority SLA', 'Critical',  15,  120)
ON CONFLICT DO NOTHING;

INSERT INTO it_ticket_categories (name, description, icon, sort_order) VALUES
  ('Hardware',         'Physical device issues',            'monitor',        1),
  ('Software',         'Application and OS issues',         'code',           2),
  ('Network',          'Connectivity and network access',   'wifi',           3),
  ('Access & Accounts','Password resets and access',        'key',            4),
  ('Email',            'Email client and delivery issues',  'mail',           5),
  ('Security',         'Security incidents and concerns',   'shield',         6),
  ('Other',            'General IT requests',               'folder',         7)
ON CONFLICT (name) DO NOTHING;

INSERT INTO it_resolution_codes (name, sort_order) VALUES
  ('Fixed - Root Cause Identified',  1),
  ('Fixed - Workaround Applied',     2),
  ('User Error - Training Provided', 3),
  ('No Issue Found',                 4),
  ('Third Party Vendor',             5),
  ('Known Issue - Patch Pending',    6),
  ('Duplicate Ticket',               7),
  ('Cancelled by User',              8)
ON CONFLICT (name) DO NOTHING;

INSERT INTO asset_vendors (name, code, country) VALUES
  ('Dell Technologies',  'DELL', 'USA'),
  ('HP Inc',             'HP',   'USA'),
  ('Apple Inc',          'AAPL', 'USA'),
  ('Lenovo',             'LNV',  'China'),
  ('Microsoft',          'MSFT', 'USA'),
  ('Logitech',           'LOGI', 'Switzerland'),
  ('Samsung',            'SAM',  'South Korea'),
  ('LG Electronics',     'LG',   'South Korea')
ON CONFLICT (name) DO NOTHING;

INSERT INTO asset_categories (name, slug, depreciation_years, warranty_months) VALUES
  ('Laptop',           'laptop',           3, 12),
  ('Desktop',          'desktop',          4, 12),
  ('Monitor',          'monitor',          5, 24),
  ('Mobile Phone',     'mobile-phone',     2, 12),
  ('Tablet',           'tablet',           3, 12),
  ('Printer',          'printer',          5, 12),
  ('Networking',       'networking',       7, 12),
  ('Server',           'server',          10, 36),
  ('Accessories',      'accessories',      2,  6),
  ('Furniture',        'furniture',       10, 12)
ON CONFLICT (name) DO NOTHING;

INSERT INTO asset_maintenance_types (name, sort_order) VALUES
  ('Preventive',   1),
  ('Corrective',   2),
  ('Repair',       3),
  ('Upgrade',      4),
  ('Inspection',   5),
  ('Calibration',  6),
  ('Replacement',  7)
ON CONFLICT (name) DO NOTHING;

-- role_permissions already has UNIQUE(role) from the schema


-- ── Part 2: Master data ─────────────────────────────────────


-- ============================================================
-- 1. ROLE PERMISSIONS
-- ============================================================

INSERT INTO role_permissions (role, permissions) VALUES
('admin', '{
  "apps": ["*"],
  "actions": ["create","read","update","delete","approve","export","import","admin"],
  "payroll": ["view","process","approve","export"],
  "users": ["create","read","update","delete","reset_password","assign_roles"],
  "settings": ["read","write"],
  "reports": ["*"]
}'::jsonb),
('hr', '{
  "apps": ["dashboard","directory","recruitment","onboarding","performance","training","payroll","communications","knowledge","workflow","master-data"],
  "actions": ["create","read","update","delete","approve","export"],
  "payroll": ["view","process"],
  "users": ["read","update"],
  "settings": ["read"],
  "reports": ["hr","attendance","headcount","training","performance"]
}'::jsonb),
('manager', '{
  "apps": ["dashboard","directory","performance","training","payroll","okr","projects","communications","knowledge","workflow"],
  "actions": ["create","read","update","approve"],
  "payroll": ["view"],
  "users": ["read"],
  "settings": [],
  "reports": ["team","attendance","performance","okr"]
}'::jsonb),
('employee', '{
  "apps": ["dashboard","directory","training","payroll","communications","knowledge","it-services"],
  "actions": ["create","read","update"],
  "payroll": ["view_own"],
  "users": [],
  "settings": [],
  "reports": ["self"]
}'::jsonb),
('finance', '{
  "apps": ["invoices","payroll","executive-dashboard","advanced-analytics","master-data"],
  "actions": ["create","read","update","approve","export"],
  "payroll": ["view","process","approve","export"],
  "users": ["read"],
  "settings": ["read"],
  "reports": ["finance","payroll","invoices"]
}'::jsonb),
('it', '{
  "apps": ["it-services","assets","directory"],
  "actions": ["create","read","update","delete"],
  "payroll": [],
  "users": ["read"],
  "settings": ["read"],
  "reports": ["it","assets"]
}'::jsonb),
('marketing', '{
  "apps": ["linkedin","communications","knowledge"],
  "actions": ["create","read","update","delete"],
  "payroll": [],
  "users": ["read"],
  "settings": [],
  "reports": []
}'::jsonb)
-- Never overwrite permissions edited through the Permission Manager.
ON CONFLICT (role) DO NOTHING;

-- ============================================================
-- 2. MASTER DEPARTMENTS
-- ============================================================

INSERT INTO master_departments (name, description, is_active) VALUES
('Engineering',         'Software development, architecture and QA',                         TRUE),
('Human Resources',     'People operations, recruitment and employee experience',            TRUE),
('Finance',             'Accounting, payroll, budgeting and financial planning',             TRUE),
('Marketing',           'Brand, content, campaigns and digital presence',                   TRUE),
('Sales',               'Revenue generation, client acquisition and account management',    TRUE),
('Operations',          'Business operations, facilities and process management',            TRUE),
('Product',             'Product strategy, roadmap and UX design',                          TRUE),
('Design',              'UI/UX design, branding and creative assets',                       TRUE),
('Customer Success',    'Client onboarding, support and retention',                         TRUE),
('IT & Infrastructure', 'IT support, DevOps, networking and security',                      TRUE),
('Legal',               'Contracts, compliance and regulatory affairs',                     TRUE),
('Administration',      'Executive support, office management and general administration',  TRUE)
ON CONFLICT (lower(name)) DO UPDATE SET
  description = EXCLUDED.description,
  is_active   = EXCLUDED.is_active;

-- ============================================================
-- 3. MASTER JOB TITLES
-- ============================================================

INSERT INTO master_job_titles (name, department, level, is_active) VALUES
('Software Engineer','Engineering','Mid',TRUE),('Senior Software Engineer','Engineering','Senior',TRUE),
('Lead Engineer','Engineering','Lead',TRUE),('Engineering Manager','Engineering','Manager',TRUE),
('VP Engineering','Engineering','VP',TRUE),('Frontend Developer','Engineering','Mid',TRUE),
('Backend Developer','Engineering','Mid',TRUE),('Full Stack Developer','Engineering','Mid',TRUE),
('DevOps Engineer','Engineering','Mid',TRUE),('QA Engineer','Engineering','Mid',TRUE),
('Site Reliability Engineer','Engineering','Senior',TRUE),('Solutions Architect','Engineering','Senior',TRUE),
('Data Engineer','Engineering','Mid',TRUE),
('Product Manager','Product','Mid',TRUE),('Senior Product Manager','Product','Senior',TRUE),
('Director of Product','Product','Director',TRUE),('UI/UX Designer','Design','Mid',TRUE),
('Senior Designer','Design','Senior',TRUE),('UX Researcher','Design','Mid',TRUE),
('Design Lead','Design','Lead',TRUE),
('HR Executive','Human Resources','Junior',TRUE),('HR Manager','Human Resources','Manager',TRUE),
('HR Business Partner','Human Resources','Senior',TRUE),
('Talent Acquisition Specialist','Human Resources','Mid',TRUE),
('Recruiter','Human Resources','Junior',TRUE),('L&D Specialist','Human Resources','Mid',TRUE),
('HR Director','Human Resources','Director',TRUE),('Chief People Officer','Human Resources','CXO',TRUE),
('Finance Executive','Finance','Junior',TRUE),('Financial Analyst','Finance','Mid',TRUE),
('Senior Financial Analyst','Finance','Senior',TRUE),('Finance Manager','Finance','Manager',TRUE),
('Finance Controller','Finance','Senior',TRUE),('Chief Financial Officer','Finance','CXO',TRUE),
('Payroll Specialist','Finance','Mid',TRUE),('Accounts Executive','Finance','Junior',TRUE),
('Marketing Executive','Marketing','Junior',TRUE),
('Digital Marketing Specialist','Marketing','Mid',TRUE),
('Content Writer','Marketing','Junior',TRUE),('SEO Specialist','Marketing','Mid',TRUE),
('Marketing Manager','Marketing','Manager',TRUE),('Brand Manager','Marketing','Senior',TRUE),
('VP Marketing','Marketing','VP',TRUE),
('Sales Executive','Sales','Junior',TRUE),
('Business Development Executive','Sales','Mid',TRUE),
('Account Manager','Sales','Mid',TRUE),('Sales Manager','Sales','Manager',TRUE),
('Key Account Manager','Sales','Senior',TRUE),('VP Sales','Sales','VP',TRUE),
('Chief Revenue Officer','Sales','CXO',TRUE),
('Operations Executive','Operations','Junior',TRUE),('Operations Analyst','Operations','Mid',TRUE),
('Operations Manager','Operations','Manager',TRUE),('Business Analyst','Operations','Mid',TRUE),
('Process Improvement Analyst','Operations','Mid',TRUE),('COO','Operations','CXO',TRUE),
('IT Support Engineer','IT & Infrastructure','Junior',TRUE),
('System Administrator','IT & Infrastructure','Mid',TRUE),
('Network Engineer','IT & Infrastructure','Mid',TRUE),
('Cloud Engineer','IT & Infrastructure','Senior',TRUE),
('Cybersecurity Analyst','IT & Infrastructure','Mid',TRUE),
('IT Manager','IT & Infrastructure','Manager',TRUE),('CTO','IT & Infrastructure','CXO',TRUE),
('Customer Success Executive','Customer Success','Junior',TRUE),
('Customer Success Manager','Customer Success','Manager',TRUE),
('Support Engineer','Customer Success','Mid',TRUE),
('Technical Account Manager','Customer Success','Senior',TRUE),
('Legal Executive','Legal','Junior',TRUE),('Legal Counsel','Legal','Mid',TRUE),
('Senior Legal Counsel','Legal','Senior',TRUE),('Compliance Officer','Legal','Mid',TRUE),
('General Counsel','Legal','CXO',TRUE),
('Administrative Executive','Administration','Junior',TRUE),
('Executive Assistant','Administration','Mid',TRUE),
('Office Manager','Administration','Manager',TRUE),
('CEO','Administration','CXO',TRUE),('Chief of Staff','Administration','Senior',TRUE)
ON CONFLICT (lower(name), lower(department)) DO UPDATE SET
  level     = EXCLUDED.level,
  is_active = EXCLUDED.is_active;

-- ============================================================
-- 4. MASTER LOCATIONS
-- ============================================================

INSERT INTO master_locations (name, country, city, address, is_active) VALUES
('Mumbai HQ',       'India',     'Mumbai',     'Bandra Kurla Complex, Bandra East, Mumbai 400051',  TRUE),
('Delhi Office',    'India',     'New Delhi',  'Connaught Place, New Delhi 110001',                 TRUE),
('Bangalore Office','India',     'Bangalore',  'Electronic City Phase 1, Bangalore 560100',         TRUE),
('Pune Office',     'India',     'Pune',       'Hinjewadi Phase 2, Pune 411057',                    TRUE),
('Hyderabad Office','India',     'Hyderabad',  'HITEC City, Madhapur, Hyderabad 500081',            TRUE),
('Chennai Office',  'India',     'Chennai',    'Tidel Park, Taramani, Chennai 600113',              TRUE),
('Kolkata Office',  'India',     'Kolkata',    'Sector V, Salt Lake, Kolkata 700091',               TRUE),
('Dubai Office',    'UAE',       'Dubai',      'DIFC, Gate Village, Dubai',                         TRUE),
('Singapore Office','Singapore', 'Singapore',  'One Raffles Quay, Singapore 048583',                TRUE),
('London Office',   'UK',        'London',     'Canary Wharf, London E14 5AB',                      TRUE),
('Remote — India',  'India',     'Remote',     NULL,                                                TRUE),
('Remote — Global', NULL,        'Remote',     NULL,                                                TRUE)
ON CONFLICT (lower(name)) DO UPDATE SET
  country   = EXCLUDED.country,
  city      = EXCLUDED.city,
  address   = EXCLUDED.address,
  is_active = EXCLUDED.is_active;

-- ============================================================
-- 5. MASTER EMPLOYMENT TYPES
-- ============================================================

INSERT INTO master_employment_types (name, description, is_active) VALUES
('Full-time',  'Permanent employee working standard hours (40h/week)',       TRUE),
('Part-time',  'Permanent employee working reduced hours',                   TRUE),
('Contract',   'Fixed-term contract employee',                               TRUE),
('Internship', 'Paid internship — typically 2-6 months',                    TRUE),
('Freelance',  'Independent contractor engaged on project basis',            TRUE),
('Consultant', 'External advisor or specialist engaged for a defined scope', TRUE),
('Apprentice', 'Skill-building engagement under a structured programme',     TRUE)
ON CONFLICT (lower(name)) DO UPDATE SET
  description = EXCLUDED.description,
  is_active   = EXCLUDED.is_active;

-- ============================================================
-- 6. MASTER CURRENCIES
-- ============================================================

INSERT INTO master_currencies (name, code, symbol, is_active) VALUES
('Indian Rupee',     'INR', '₹',    TRUE),
('US Dollar',        'USD', '$',    TRUE),
('Euro',             'EUR', '€',    TRUE),
('British Pound',    'GBP', '£',    TRUE),
('UAE Dirham',       'AED', 'د.إ',  TRUE),
('Singapore Dollar', 'SGD', 'S$',   TRUE),
('Australian Dollar','AUD', 'A$',   TRUE),
('Canadian Dollar',  'CAD', 'C$',   TRUE),
('Japanese Yen',     'JPY', '¥',    TRUE),
('Swiss Franc',      'CHF', 'Fr',   TRUE)
ON CONFLICT (upper(code)) DO UPDATE SET
  name      = EXCLUDED.name,
  symbol    = EXCLUDED.symbol,
  is_active = EXCLUDED.is_active;

-- ============================================================
-- 7. MASTER SKILLS
-- ============================================================

INSERT INTO master_skills (name, category, is_active) VALUES
('JavaScript','Engineering',TRUE),('TypeScript','Engineering',TRUE),('React','Engineering',TRUE),
('Node.js','Engineering',TRUE),('Python','Engineering',TRUE),('Java','Engineering',TRUE),
('Go','Engineering',TRUE),('Rust','Engineering',TRUE),('SQL','Engineering',TRUE),
('PostgreSQL','Engineering',TRUE),('MongoDB','Engineering',TRUE),('Redis','Engineering',TRUE),
('GraphQL','Engineering',TRUE),('REST APIs','Engineering',TRUE),
('Docker','Engineering',TRUE),('Kubernetes','Engineering',TRUE),
('AWS','Cloud',TRUE),('Azure','Cloud',TRUE),('GCP','Cloud',TRUE),('Terraform','Cloud',TRUE),
('CI/CD','DevOps',TRUE),('Git','DevOps',TRUE),('Linux','DevOps',TRUE),
('Networking','IT',TRUE),('Cybersecurity','IT',TRUE),
('Figma','Design',TRUE),('UI Design','Design',TRUE),('UX Research','Design',TRUE),
('Prototyping','Design',TRUE),('Adobe Creative Suite','Design',TRUE),
('Product Strategy','Product',TRUE),('Agile/Scrum','Product',TRUE),
('Roadmapping','Product',TRUE),('User Story Writing','Product',TRUE),
('Data Analysis','Analytics',TRUE),('Power BI','Analytics',TRUE),('Tableau','Analytics',TRUE),
('Excel','Analytics',TRUE),('Machine Learning','Analytics',TRUE),('Data Science','Analytics',TRUE),
('Project Management','Management',TRUE),('Team Leadership','Management',TRUE),
('Stakeholder Management','Management',TRUE),('Strategic Planning','Management',TRUE),
('Business Development','Sales',TRUE),('Account Management','Sales',TRUE),
('CRM Tools','Sales',TRUE),('Negotiation','Sales',TRUE),
('SEO/SEM','Marketing',TRUE),('Content Writing','Marketing',TRUE),
('Social Media','Marketing',TRUE),('Email Marketing','Marketing',TRUE),
('Google Analytics','Marketing',TRUE),
('Financial Analysis','Finance',TRUE),('Accounting','Finance',TRUE),
('Budgeting','Finance',TRUE),('Payroll Processing','Finance',TRUE),
('Tax & Compliance','Finance',TRUE),('SAP','Finance',TRUE),('Tally','Finance',TRUE),
('Communication','Soft Skills',TRUE),('Problem Solving','Soft Skills',TRUE),
('Critical Thinking','Soft Skills',TRUE),('Time Management','Soft Skills',TRUE),
('Adaptability','Soft Skills',TRUE),('Collaboration','Soft Skills',TRUE),
('Presentation Skills','Soft Skills',TRUE)
ON CONFLICT (lower(name), lower(category)) DO UPDATE SET
  is_active = EXCLUDED.is_active;

-- ============================================================
-- 8. MASTER CLIENTS
-- ============================================================

INSERT INTO master_clients (name, email, phone, industry, is_active) VALUES
('Reliance Industries Ltd',    'procurement@ril.com',        '+91-22-3555-5000', 'Conglomerate',      TRUE),
('Infosys Limited',            'vendor@infosys.com',         '+91-80-2852-0261', 'IT Services',       TRUE),
('Tata Consultancy Services',  'alliances@tcs.com',          '+91-22-6778-9999', 'IT Services',       TRUE),
('Wipro Technologies',         'partnerships@wipro.com',     '+91-80-2844-0011', 'IT Services',       TRUE),
('HDFC Bank',                  'corporate@hdfcbank.com',     '+91-22-6652-1000', 'Banking & Finance', TRUE),
('Mahindra & Mahindra',        'procurement@mahindra.com',   '+91-22-2490-1441', 'Automotive',        TRUE),
('Bajaj Auto',                 'vendor@bajajauto.com',       '+91-20-2747-2851', 'Automotive',        TRUE),
('Zomato',                     'partners@zomato.com',        '+91-124-415-7777', 'Food Tech',         TRUE),
('Swiggy',                     'enterprise@swiggy.com',      '+91-80-6777-0000', 'Food Tech',         TRUE),
('Flipkart',                   'b2b@flipkart.com',           '+91-80-4912-6000', 'E-commerce',        TRUE)
ON CONFLICT (lower(name)) DO UPDATE SET
  email     = EXCLUDED.email,
  phone     = EXCLUDED.phone,
  industry  = EXCLUDED.industry,
  is_active = EXCLUDED.is_active;

-- ============================================================
-- 9. LEAVE POLICIES
-- ============================================================

INSERT INTO leave_policies (leave_type, annual_days, carry_forward, max_carry_forward, applicable_to, is_active) VALUES
('Annual Leave',       18, TRUE,  6,   'all',       TRUE),
('Sick Leave',         12, FALSE, 0,   'all',       TRUE),
('Casual Leave',        6, FALSE, 0,   'all',       TRUE),
('Maternity Leave',   180, FALSE, 0,   'full-time', TRUE),
('Paternity Leave',    15, FALSE, 0,   'full-time', TRUE),
('Bereavement Leave',   5, FALSE, 0,   'all',       TRUE),
('Compensatory Off',   12, FALSE, 0,   'all',       TRUE),
('Marriage Leave',      5, FALSE, 0,   'all',       TRUE),
('Unpaid Leave',        0, FALSE, 0,   'all',       TRUE),
('Study Leave',         5, FALSE, 0,   'full-time', TRUE)
ON CONFLICT (lower(leave_type)) DO UPDATE SET
  annual_days        = EXCLUDED.annual_days,
  carry_forward      = EXCLUDED.carry_forward,
  max_carry_forward  = EXCLUDED.max_carry_forward,
  applicable_to      = EXCLUDED.applicable_to,
  is_active          = EXCLUDED.is_active;

-- ============================================================
-- 10. HOLIDAYS — India 2026 / 2027
-- ============================================================

INSERT INTO holidays (name, date, type, location, is_active) VALUES
('New Year''s Day',                 '2026-01-01', 'public',   NULL,    TRUE),
('Republic Day',                    '2026-01-26', 'national', 'India', TRUE),
('Holi',                            '2026-03-03', 'public',   'India', TRUE),
('Ram Navami',                      '2026-03-30', 'public',   'India', TRUE),
('Eid ul-Fitr',                     '2026-03-21', 'public',   'India', TRUE),
('Good Friday',                     '2026-04-03', 'public',   NULL,    TRUE),
('Dr. Ambedkar Jayanti',            '2026-04-14', 'national', 'India', TRUE),
('Mahavir Jayanti',                 '2026-04-16', 'public',   'India', TRUE),
('Eid ul-Adha',                     '2026-05-28', 'public',   'India', TRUE),
('Independence Day',                '2026-08-15', 'national', 'India', TRUE),
('Janmashtami',                     '2026-08-22', 'public',   'India', TRUE),
('Ganesh Chaturthi',                '2026-08-28', 'public',   'India', TRUE),
('Gandhi Jayanti / Dussehra',       '2026-10-02', 'national', 'India', TRUE),
('Dussehra',                        '2026-10-22', 'public',   'India', TRUE),
('Diwali',                          '2026-11-10', 'public',   'India', TRUE),
('Diwali (Bhai Dooj)',              '2026-11-12', 'public',   'India', TRUE),
('Guru Nanak Jayanti',              '2026-11-25', 'public',   'India', TRUE),
('Christmas Day',                   '2026-12-25', 'public',   NULL,    TRUE),
('New Year''s Day 2027',            '2027-01-01', 'public',   NULL,    TRUE),
('Republic Day 2027',               '2027-01-26', 'national', 'India', TRUE),
('Independence Day 2027',           '2027-08-15', 'national', 'India', TRUE),
('Gandhi Jayanti 2027',             '2027-10-02', 'national', 'India', TRUE),
('Christmas Day 2027',              '2027-12-25', 'public',   NULL,    TRUE)
ON CONFLICT (lower(name), date) DO UPDATE SET
  type      = EXCLUDED.type,
  location  = EXCLUDED.location,
  is_active = EXCLUDED.is_active;

-- ============================================================
-- 11. EMAIL TEMPLATES
-- ============================================================

INSERT INTO email_templates (name, subject, body, category, variables) VALUES
('Offer Letter',
 'Offer of Employment — {{position}} at Jeshan Labs',
 'Dear {{candidate_name}},

We are pleased to extend an offer of employment for the position of {{position}} in the {{department}} department.

Start Date: {{start_date}}
Compensation: {{salary}} per annum (CTC)
Reporting To: {{manager_name}}
Work Location: {{location}}

Please confirm your acceptance by {{acceptance_deadline}}.

We look forward to welcoming you to the Jeshan Labs family.

Warm regards,
{{hr_name}}
Human Resources, Jeshan Labs',
 'Recruitment',
 '["candidate_name","position","department","start_date","salary","manager_name","location","acceptance_deadline","hr_name"]'::jsonb),

('Welcome Aboard',
 'Welcome to Jeshan Labs, {{employee_name}}! 🎉',
 'Dear {{employee_name}},

Welcome to Jeshan Labs! We are thrilled to have you join us as {{position}} in the {{department}} team.

Your first day is {{start_date}}. Please report to {{location}} by {{report_time}}.

Your buddy for the first week is {{buddy_name}}, who will help you settle in.

Regards,
{{hr_name}}
Human Resources',
 'Onboarding',
 '["employee_name","position","department","start_date","location","report_time","buddy_name","hr_name"]'::jsonb),

('Leave Approved',
 'Leave Request Approved — {{leave_type}} ({{start_date}} to {{end_date}})',
 'Dear {{employee_name}},

Your leave request has been approved.

Leave Type: {{leave_type}}
From: {{start_date}}  To: {{end_date}}
Duration: {{days}} day(s)
Approved By: {{approver_name}}

Regards, HR Team',
 'Leave',
 '["employee_name","leave_type","start_date","end_date","days","approver_name"]'::jsonb),

('Leave Rejected',
 'Leave Request Not Approved — {{leave_type}}',
 'Dear {{employee_name}},

Your leave request has not been approved.

Leave Type: {{leave_type}}
From: {{start_date}}  To: {{end_date}}
Reason: {{rejection_reason}}

Regards, HR Team',
 'Leave',
 '["employee_name","leave_type","start_date","end_date","rejection_reason"]'::jsonb),

('Payslip Ready',
 'Your Payslip for {{month}} {{year}} is Ready',
 'Dear {{employee_name}},

Your payslip for {{month}} {{year}} has been generated.

Gross Salary: {{currency}} {{gross_salary}}
Total Deductions: {{currency}} {{deductions}}
Net Pay: {{currency}} {{net_salary}}
Payment Date: {{payment_date}}

Log in to the portal to view and download your full payslip.

Regards, Finance & Payroll Team',
 'Payroll',
 '["employee_name","month","year","currency","gross_salary","deductions","net_salary","payment_date"]'::jsonb),

('Performance Review Due',
 'Action Required: Performance Review for {{period}}',
 'Dear {{employee_name}},

Your performance review for {{period}} is now open. Please complete your self-assessment by {{deadline}}.

Your reviewer is {{reviewer_name}}.

Log in to the Performance module to begin.

Regards, HR Team',
 'Performance',
 '["employee_name","period","deadline","reviewer_name"]'::jsonb),

('IT Ticket Created',
 '[Ticket #{{ticket_number}}] {{title}} — Received',
 'Dear {{requester_name}},

Your IT support request has been received.

Ticket #: {{ticket_number}}  Category: {{category}}
Priority: {{priority}}  Expected Resolution: {{sla_time}}

IT Support Team',
 'IT',
 '["requester_name","ticket_number","title","category","priority","sla_time"]'::jsonb),

('IT Ticket Resolved',
 '[Ticket #{{ticket_number}}] Resolved',
 'Dear {{requester_name}},

Your IT support ticket has been resolved.

Ticket #: {{ticket_number}}
Resolution: {{resolution}}
Resolved By: {{resolved_by}}

IT Support Team',
 'IT',
 '["requester_name","ticket_number","resolution","resolved_by"]'::jsonb),

('Invoice Sent',
 'Invoice {{invoice_number}} from Jeshan Labs',
 'Dear {{client_name}},

Please find attached Invoice {{invoice_number}} for services rendered.

Invoice Date: {{invoice_date}}  Due Date: {{due_date}}
Amount Due: {{currency}} {{total}}

Regards, Finance Team, Jeshan Labs',
 'Finance',
 '["client_name","invoice_number","invoice_date","due_date","currency","total","contact_email"]'::jsonb),

('Training Enrollment Confirmed',
 'Enrollment Confirmed — {{course_title}}',
 'Dear {{employee_name}},

You have been enrolled in: {{course_title}}
Category: {{category}}  Duration: {{duration_hours}} hrs
Instructor: {{instructor}}  Format: {{type}}

L&D Team',
 'Training',
 '["employee_name","course_title","category","duration_hours","instructor","type"]'::jsonb),

('Training Certificate Issued',
 'Congratulations! Certificate of Completion — {{course_title}}',
 'Dear {{employee_name}},

Congratulations on completing {{course_title}}!

Certificate #: {{certificate_number}}
Issued: {{issued_date}}  Valid Until: {{expiry_date}}

L&D Team',
 'Training',
 '["employee_name","course_title","certificate_number","issued_date","expiry_date"]'::jsonb),

('Probation Confirmation',
 'Probation Confirmation — {{employee_name}}',
 'Dear {{employee_name}},

Your probation period has been successfully completed as of {{probation_end_date}}.

You are now confirmed as a permanent employee in the role of {{position}}.

Your updated appointment letter will be issued within 5 working days.

Congratulations!

Regards, HR Team',
 'HR',
 '["employee_name","probation_end_date","position"]'::jsonb),

('Salary Revision Letter',
 'Salary Revision — Effective {{effective_date}}',
 'Dear {{employee_name}},

We are pleased to inform you of a revision to your compensation effective {{effective_date}}.

Previous CTC: {{currency}} {{old_ctc}} p.a.
Revised CTC:  {{currency}} {{new_ctc}} p.a.
Reason: {{reason}}

Regards, HR & Finance Team',
 'HR',
 '["employee_name","effective_date","currency","old_ctc","new_ctc","reason","effective_month"]'::jsonb),

('Resignation Acknowledgement',
 'Resignation Acknowledgement — {{employee_name}}',
 'Dear {{employee_name}},

We acknowledge your resignation dated {{resignation_date}}, effective {{last_working_day}}.

Notice period: {{notice_period}} days.
Handover to: {{handover_person}} by {{last_working_day}}.

HR will contact you regarding exit formalities and final settlement.

Regards, HR Team',
 'HR',
 '["employee_name","resignation_date","last_working_day","notice_period","notice_start","handover_person"]'::jsonb),

('IT Asset Return Reminder',
 '[Action Required] Return Company Assets by {{return_date}}',
 'Dear {{employee_name}},

As your last working day is {{last_working_day}}, please return the following assets to IT by {{return_date}}:

{{asset_list}}

Contact {{it_contact}} to arrange the handover.

IT Team',
 'IT',
 '["employee_name","last_working_day","return_date","asset_list","it_contact"]'::jsonb),

('Workflow Approval Request',
 '[Action Required] Approval Needed — {{workflow_name}}',
 'Dear {{approver_name}},

An approval request has been assigned to you.

Workflow: {{workflow_name}}
Submitted By: {{requested_by}}
Details: {{context_summary}}
Due By: {{due_by}}

Log in to the Workflow Dashboard to approve or reject.

Jeshan Labs Portal',
 'Workflow',
 '["approver_name","workflow_name","requested_by","context_summary","requested_at","due_by"]'::jsonb),

('New IT Asset Assigned',
 'Asset Assigned to You — {{asset_name}} ({{asset_tag}})',
 'Dear {{employee_name}},

The following asset has been assigned to you:

Asset: {{asset_name}}  Tag: {{asset_tag}}
Serial #: {{serial_number}}  Condition: {{condition}}
Assigned By: {{assigned_by}}  Date: {{assigned_date}}

Please acknowledge receipt in the Asset Management portal.

IT Team',
 'IT',
 '["employee_name","asset_name","asset_tag","serial_number","condition","assigned_by","assigned_date"]'::jsonb)

ON CONFLICT (lower(name)) DO UPDATE SET
  subject   = EXCLUDED.subject,
  body      = EXCLUDED.body,
  category  = EXCLUDED.category,
  variables = EXCLUDED.variables;

-- ============================================================
-- 12. MASTER VALUE HELPS
-- Conflict target: (entity, field, value) — unique index created
-- by seed_unique_constraints.sql
-- ============================================================

INSERT INTO master_value_helps (entity, field, label, value, sort_order, is_active) VALUES
-- Attendance
('attendance','status','Present','Present',1,TRUE),
('attendance','status','Work From Home','Work From Home',2,TRUE),
('attendance','status','Absent','Absent',3,TRUE),
('attendance','status','Late','Late',4,TRUE),
('attendance','status','Half Day','Half Day',5,TRUE),
('attendance','work_mode','Office','office',1,TRUE),
('attendance','work_mode','Work From Home','wfh',2,TRUE),
('attendance','work_mode','Hybrid','hybrid',3,TRUE),
-- Leave
('leave','type','Annual Leave','Annual Leave',1,TRUE),
('leave','type','Sick Leave','Sick Leave',2,TRUE),
('leave','type','Casual Leave','Casual Leave',3,TRUE),
('leave','type','Maternity Leave','Maternity Leave',4,TRUE),
('leave','type','Paternity Leave','Paternity Leave',5,TRUE),
('leave','type','Bereavement Leave','Bereavement Leave',6,TRUE),
('leave','type','Compensatory Off','Compensatory Off',7,TRUE),
('leave','type','Marriage Leave','Marriage Leave',8,TRUE),
('leave','type','Study Leave','Study Leave',9,TRUE),
('leave','type','Unpaid Leave','Unpaid Leave',10,TRUE),
('leave','status','Pending','Pending',1,TRUE),
('leave','status','Approved','Approved',2,TRUE),
('leave','status','Rejected','Rejected',3,TRUE),
('leave','status','Cancelled','Cancelled',4,TRUE),
-- Payroll earnings
('payroll','earning_component','Basic Salary','basic_salary',1,TRUE),
('payroll','earning_component','House Rent Allowance','hra',2,TRUE),
('payroll','earning_component','Transport Allowance','transport_allowance',3,TRUE),
('payroll','earning_component','Medical Allowance','medical_allowance',4,TRUE),
('payroll','earning_component','Special Allowance','special_allowance',5,TRUE),
('payroll','earning_component','Performance Bonus','performance_bonus',6,TRUE),
('payroll','earning_component','Overtime Pay','overtime_pay',7,TRUE),
('payroll','earning_component','Leave Encashment','leave_encashment',8,TRUE),
-- Payroll deductions
('payroll','deduction_component','Provident Fund (12%)','pf_deduction',1,TRUE),
('payroll','deduction_component','ESI (0.75%)','esi_employee',2,TRUE),
('payroll','deduction_component','Professional Tax','professional_tax',3,TRUE),
('payroll','deduction_component','TDS','tds',4,TRUE),
('payroll','deduction_component','Loan Recovery','loan_recovery',5,TRUE),
('payroll','deduction_component','Advance Recovery','advance_recovery',6,TRUE),
-- Payroll statutory
('payroll','statutory','Employee PF Rate','employee_pf_12',1,TRUE),
('payroll','statutory','Employer PF Rate','employer_pf_12',2,TRUE),
('payroll','statutory','Employee ESI Rate','0.75',3,TRUE),
('payroll','statutory','Employer ESI Rate','3.25',4,TRUE),
('payroll','statutory','ESI Wage Ceiling (INR)','21000',5,TRUE),
('payroll','statutory','PF Wage Ceiling (INR)','15000',6,TRUE),
-- Payroll payment methods
('payroll','payment_method','Bank Transfer — NEFT','NEFT',1,TRUE),
('payroll','payment_method','Bank Transfer — RTGS','RTGS',2,TRUE),
('payroll','payment_method','Bank Transfer — IMPS','IMPS',3,TRUE),
('payroll','payment_method','Cheque','Cheque',4,TRUE),
('payroll','payment_method','Cash','Cash',5,TRUE),
-- Payroll status
('payroll','status','Draft','Draft',1,TRUE),
('payroll','status','Processing','Processing',2,TRUE),
('payroll','status','Approved','Approved',3,TRUE),
('payroll','status','Paid','Paid',4,TRUE),
('payroll','status','On Hold','On Hold',5,TRUE),
-- Payroll months
('payroll','month','January','January',1,TRUE),
('payroll','month','February','February',2,TRUE),
('payroll','month','March','March',3,TRUE),
('payroll','month','April','April',4,TRUE),
('payroll','month','May','May',5,TRUE),
('payroll','month','June','June',6,TRUE),
('payroll','month','July','July',7,TRUE),
('payroll','month','August','August',8,TRUE),
('payroll','month','September','September',9,TRUE),
('payroll','month','October','October',10,TRUE),
('payroll','month','November','November',11,TRUE),
('payroll','month','December','December',12,TRUE),
-- Payroll financial years
('payroll','financial_year','FY 2024-25','FY2024-25',1,TRUE),
('payroll','financial_year','FY 2025-26','FY2025-26',2,TRUE),
('payroll','financial_year','FY 2026-27','FY2026-27',3,TRUE),
-- Payroll pay grades
('payroll','pay_grade','L1 — 0-3 LPA','L1',1,TRUE),
('payroll','pay_grade','L2 — 3-6 LPA','L2',2,TRUE),
('payroll','pay_grade','L3 — 6-10 LPA','L3',3,TRUE),
('payroll','pay_grade','L4 — 10-15 LPA','L4',4,TRUE),
('payroll','pay_grade','L5 — 15-25 LPA','L5',5,TRUE),
('payroll','pay_grade','L6 — 25-40 LPA','L6',6,TRUE),
('payroll','pay_grade','L7 — 40-75 LPA','L7',7,TRUE),
('payroll','pay_grade','L8 — 75 LPA+','L8',8,TRUE),
-- Payroll revision reasons
('payroll','revision_reason','Annual Increment','increment',1,TRUE),
('payroll','revision_reason','Promotion','promotion',2,TRUE),
('payroll','revision_reason','Performance Bonus','bonus',3,TRUE),
('payroll','revision_reason','Market Correction','market',4,TRUE),
('payroll','revision_reason','Role Change','role_change',5,TRUE),
('payroll','revision_reason','Contract Renewal','renewal',6,TRUE),
-- Leave encashment status
('payroll','encashment_status','Pending','Pending',1,TRUE),
('payroll','encashment_status','Approved','Approved',2,TRUE),
('payroll','encashment_status','Rejected','Rejected',3,TRUE),
('payroll','encashment_status','Processed','Processed',4,TRUE),
-- Recruitment
('recruitment','stage','Applied','Applied',1,TRUE),
('recruitment','stage','Screening','Screening',2,TRUE),
('recruitment','stage','Interview Scheduled','Interview Scheduled',3,TRUE),
('recruitment','stage','Interview Done','Interview Done',4,TRUE),
('recruitment','stage','HR Round Done','HR Round Done',5,TRUE),
('recruitment','stage','Offer Sent','Offer Sent',6,TRUE),
('recruitment','stage','Offer Accepted','Offer Accepted',7,TRUE),
('recruitment','stage','Hired','Hired',8,TRUE),
('recruitment','stage','Rejected','Rejected',9,TRUE),
('recruitment','source','LinkedIn','LinkedIn',1,TRUE),
('recruitment','source','Naukri','Naukri',2,TRUE),
('recruitment','source','Indeed','Indeed',3,TRUE),
('recruitment','source','Referral','Referral',4,TRUE),
('recruitment','source','Company Website','Company Website',5,TRUE),
('recruitment','source','Campus','Campus',6,TRUE),
('recruitment','source','Recruitment Agency','Recruitment Agency',7,TRUE),
('recruitment','source','Walk-in','Walk-in',8,TRUE),
('recruitment','source','Excel Upload','Excel Upload',9,TRUE),
('recruitment','interview_type','Phone Screen','Phone',1,TRUE),
('recruitment','interview_type','Video Call','Video',2,TRUE),
('recruitment','interview_type','In-Person','In-Person',3,TRUE),
('recruitment','interview_type','Technical','Technical',4,TRUE),
('recruitment','interview_type','HR Round','HR',5,TRUE),
('recruitment','notice_period','Immediate','Immediate',1,TRUE),
('recruitment','notice_period','15 Days','15 Days',2,TRUE),
('recruitment','notice_period','1 Month','1 Month',3,TRUE),
('recruitment','notice_period','2 Months','2 Months',4,TRUE),
('recruitment','notice_period','3 Months','3 Months',5,TRUE),
('recruitment','job_type','Full-time','Full-time',1,TRUE),
('recruitment','job_type','Part-time','Part-time',2,TRUE),
('recruitment','job_type','Contract','Contract',3,TRUE),
('recruitment','job_type','Internship','Internship',4,TRUE),
('recruitment','job_type','Freelance','Freelance',5,TRUE),
('recruitment','job_status','Draft','Draft',1,TRUE),
('recruitment','job_status','Active','Active',2,TRUE),
('recruitment','job_status','On Hold','On Hold',3,TRUE),
('recruitment','job_status','Closed','Closed',4,TRUE),
('recruitment','candidate_status','Active','Active',1,TRUE),
('recruitment','candidate_status','On Hold','On Hold',2,TRUE),
('recruitment','candidate_status','Closed','Closed',3,TRUE),
('recruitment','interview_status','Scheduled','Scheduled',1,TRUE),
('recruitment','interview_status','Completed','Completed',2,TRUE),
('recruitment','interview_status','Cancelled','Cancelled',3,TRUE),
('recruitment','interview_status','Rescheduled','Rescheduled',4,TRUE),
('recruitment','recommendation','Hire','Hire',1,TRUE),
('recruitment','recommendation','Maybe','Maybe',2,TRUE),
('recruitment','recommendation','Reject','Reject',3,TRUE),
('recruitment','experience_range','0-1 Year','0-1',1,TRUE),
('recruitment','experience_range','1-3 Years','1-3',2,TRUE),
('recruitment','experience_range','3-5 Years','3-5',3,TRUE),
('recruitment','experience_range','5-8 Years','5-8',4,TRUE),
('recruitment','experience_range','8-12 Years','8-12',5,TRUE),
('recruitment','experience_range','12+ Years','12+',6,TRUE),
('recruitment','job_platform','Company Website','Company Website',1,TRUE),
('recruitment','job_platform','LinkedIn','LinkedIn',2,TRUE),
('recruitment','job_platform','Naukri','Naukri',3,TRUE),
('recruitment','job_platform','Indeed','Indeed',4,TRUE),
('recruitment','job_platform','Shine','Shine',5,TRUE),
('recruitment','job_platform','Monster','Monster',6,TRUE),
('recruitment','job_platform','Instahyre','Instahyre',7,TRUE),
('recruitment','job_platform','Campus','Campus',8,TRUE),
-- Performance
('performance','review_period','Q1 (Jan–Mar)','Q1',1,TRUE),
('performance','review_period','Q2 (Apr–Jun)','Q2',2,TRUE),
('performance','review_period','Q3 (Jul–Sep)','Q3',3,TRUE),
('performance','review_period','Q4 (Oct–Dec)','Q4',4,TRUE),
('performance','review_period','Mid-Year','Mid-Year',5,TRUE),
('performance','review_period','Annual','Annual',6,TRUE),
('performance','rating_label','1 — Needs Improvement','1',1,TRUE),
('performance','rating_label','2 — Below Expectations','2',2,TRUE),
('performance','rating_label','3 — Meets Expectations','3',3,TRUE),
('performance','rating_label','4 — Exceeds Expectations','4',4,TRUE),
('performance','rating_label','5 — Outstanding','5',5,TRUE),
('performance','competency','Technical Skills','technical',1,TRUE),
('performance','competency','Communication','communication',2,TRUE),
('performance','competency','Leadership','leadership',3,TRUE),
('performance','competency','Teamwork','teamwork',4,TRUE),
('performance','competency','Innovation','innovation',5,TRUE),
('performance','competency','Customer Focus','customer_focus',6,TRUE),
('performance','competency','Problem Solving','problem_solving',7,TRUE),
('performance','competency','Integrity','integrity',8,TRUE),
('performance','feedback_type','Peer Review','Peer',1,TRUE),
('performance','feedback_type','Manager Review','Manager',2,TRUE),
('performance','feedback_type','Self Assessment','Self',3,TRUE),
('performance','feedback_type','360° Review','360',4,TRUE),
('performance','review_status','Draft','Draft',1,TRUE),
('performance','review_status','In Progress','In Progress',2,TRUE),
('performance','review_status','Submitted','Submitted',3,TRUE),
('performance','review_status','Acknowledged','Acknowledged',4,TRUE),
('performance','review_status','Completed','Completed',5,TRUE),
('performance','goal_status','Not Started','Not Started',1,TRUE),
('performance','goal_status','In Progress','In Progress',2,TRUE),
('performance','goal_status','Completed','Completed',3,TRUE),
('performance','goal_status','Cancelled','Cancelled',4,TRUE),
('performance','pip_status','Active','Active',1,TRUE),
('performance','pip_status','Completed — Improved','Completed',2,TRUE),
('performance','pip_status','Extended','Extended',3,TRUE),
('performance','pip_status','Closed — No Improvement','Closed',4,TRUE),
('performance','cycle_status','Draft','Draft',1,TRUE),
('performance','cycle_status','Active','Active',2,TRUE),
('performance','cycle_status','Closed','Closed',3,TRUE),
('performance','pip_goal_type','Measurable Target','target',1,TRUE),
('performance','pip_goal_type','Behaviour Change','behaviour',2,TRUE),
('performance','pip_goal_type','Skill Development','skill',3,TRUE),
('performance','pip_goal_type','Attendance','attendance',4,TRUE),
('performance','pip_goal_type','Deliverable','deliverable',5,TRUE),
('performance','goal_category','Business','business',1,TRUE),
('performance','goal_category','Personal Development','development',2,TRUE),
('performance','goal_category','Team','team',3,TRUE),
('performance','goal_category','Compliance','compliance',4,TRUE),
('performance','goal_category','Innovation','innovation',5,TRUE),
-- Training
('training','category','Technical Skills','Technical',1,TRUE),
('training','category','Leadership & Management','Leadership',2,TRUE),
('training','category','Soft Skills','Soft Skills',3,TRUE),
('training','category','Compliance & Legal','Compliance',4,TRUE),
('training','category','Product & Domain','Domain',5,TRUE),
('training','category','Sales & Marketing','Sales',6,TRUE),
('training','category','Finance & Accounting','Finance',7,TRUE),
('training','category','Health & Safety','Safety',8,TRUE),
('training','type','Online Self-paced','Self-paced',1,TRUE),
('training','type','Instructor-led Online','Online',2,TRUE),
('training','type','In-Person Classroom','In-Person',3,TRUE),
('training','type','Blended','Blended',4,TRUE),
('training','difficulty','Beginner','Beginner',1,TRUE),
('training','difficulty','Intermediate','Intermediate',2,TRUE),
('training','difficulty','Advanced','Advanced',3,TRUE),
('training','enrollment_status','Enrolled','Enrolled',1,TRUE),
('training','enrollment_status','In Progress','In Progress',2,TRUE),
('training','enrollment_status','Completed','Completed',3,TRUE),
('training','enrollment_status','Dropped','Dropped',4,TRUE),
('training','course_status','Active','Active',1,TRUE),
('training','course_status','Draft','Draft',2,TRUE),
('training','course_status','Inactive','Inactive',3,TRUE),
('training','path_status','In Progress','In Progress',1,TRUE),
('training','path_status','Completed','Completed',2,TRUE),
('training','path_status','Dropped','Dropped',3,TRUE),
('training','mandatory_for','All Employees','all',1,TRUE),
('training','mandatory_for','New Joiners Only','new_joiners',2,TRUE),
('training','mandatory_for','Managers Only','managers',3,TRUE),
('training','mandatory_for','Technical Roles','technical',4,TRUE),
('training','mandatory_for','Client-facing Roles','client_facing',5,TRUE),
-- IT Ticket
('it_ticket','category','Hardware','Hardware',1,TRUE),
('it_ticket','category','Software','Software',2,TRUE),
('it_ticket','category','Network & Connectivity','Network',3,TRUE),
('it_ticket','category','Access & Permissions','Access',4,TRUE),
('it_ticket','category','Email & Collaboration','Email',5,TRUE),
('it_ticket','category','VPN & Remote Access','VPN',6,TRUE),
('it_ticket','category','Printer & Peripherals','Printer',7,TRUE),
('it_ticket','category','Mobile Device','Mobile',8,TRUE),
('it_ticket','category','Security & Compliance','Security',9,TRUE),
('it_ticket','category','Other','Other',10,TRUE),
('it_ticket','priority','Low','Low',1,TRUE),
('it_ticket','priority','Medium','Medium',2,TRUE),
('it_ticket','priority','High','High',3,TRUE),
('it_ticket','priority','Critical','Critical',4,TRUE),
('it_ticket','sla_hours_low','72 Hours','72',1,TRUE),
('it_ticket','sla_hours_medium','24 Hours','24',2,TRUE),
('it_ticket','sla_hours_high','8 Hours','8',3,TRUE),
('it_ticket','sla_hours_critical','4 Hours','4',4,TRUE),
('it_ticket','status','Open','Open',1,TRUE),
('it_ticket','status','In Progress','In Progress',2,TRUE),
('it_ticket','status','Pending User','Pending',3,TRUE),
('it_ticket','status','Resolved','Resolved',4,TRUE),
('it_ticket','status','Closed','Closed',5,TRUE),
('it_ticket','sub_category_hardware','Laptop','laptop',1,TRUE),
('it_ticket','sub_category_hardware','Desktop','desktop',2,TRUE),
('it_ticket','sub_category_hardware','Monitor','monitor',3,TRUE),
('it_ticket','sub_category_hardware','Keyboard / Mouse','keyboard_mouse',4,TRUE),
('it_ticket','sub_category_hardware','Printer','printer',5,TRUE),
('it_ticket','sub_category_hardware','Headset','headset',6,TRUE),
('it_ticket','sub_category_hardware','Mobile Device','mobile',7,TRUE),
('it_ticket','sub_category_hardware','UPS / Power','ups',8,TRUE),
('it_ticket','sub_category_software','Application Install','app_install',1,TRUE),
('it_ticket','sub_category_software','License Key','license',2,TRUE),
('it_ticket','sub_category_software','OS Issue','os',3,TRUE),
('it_ticket','sub_category_software','Browser Issue','browser',4,TRUE),
('it_ticket','sub_category_software','MS Office','ms_office',5,TRUE),
('it_ticket','sub_category_software','ERP / HR Portal','erp',6,TRUE),
('it_ticket','sub_category_network','Wi-Fi','wifi',1,TRUE),
('it_ticket','sub_category_network','Ethernet','ethernet',2,TRUE),
('it_ticket','sub_category_network','VPN','vpn',3,TRUE),
('it_ticket','sub_category_network','Firewall / Proxy','firewall',4,TRUE),
('it_ticket','sub_category_access','New User Account','new_account',1,TRUE),
('it_ticket','sub_category_access','Password Reset','password_reset',2,TRUE),
('it_ticket','sub_category_access','MFA Setup','mfa',3,TRUE),
('it_ticket','sub_category_access','Application Access','app_access',4,TRUE),
('it_ticket','sub_category_access','Role Change','role_change',5,TRUE),
('it_ticket','sub_category_access','Exit Revocation','exit_revocation',6,TRUE),
('it_ticket','resolution_type','Fixed — Configuration','config_fix',1,TRUE),
('it_ticket','resolution_type','Fixed — Hardware Replaced','hardware_replace',2,TRUE),
('it_ticket','resolution_type','Fixed — Software Reinstalled','software_fix',3,TRUE),
('it_ticket','resolution_type','User Training Provided','user_training',4,TRUE),
('it_ticket','resolution_type','Escalated to Vendor','vendor',5,TRUE),
('it_ticket','resolution_type','No Issue Found','no_issue',6,TRUE),
('it_ticket','resolution_type','Known Issue — Workaround','workaround',7,TRUE),
-- Asset
('asset','type','Laptop','Laptop',1,TRUE),
('asset','type','Desktop','Desktop',2,TRUE),
('asset','type','Monitor','Monitor',3,TRUE),
('asset','type','Mobile Phone','Mobile Phone',4,TRUE),
('asset','type','Tablet','Tablet',5,TRUE),
('asset','type','Printer','Printer',6,TRUE),
('asset','type','Server','Server',7,TRUE),
('asset','type','Networking Device','Networking Device',8,TRUE),
('asset','type','UPS / Power','UPS',9,TRUE),
('asset','type','Headset','Headset',10,TRUE),
('asset','type','Webcam','Webcam',11,TRUE),
('asset','type','Furniture','Furniture',12,TRUE),
('asset','type','Vehicle','Vehicle',13,TRUE),
('asset','type','Other','Other',14,TRUE),
('asset','category','Computing','Computing',1,TRUE),
('asset','category','Peripherals','Peripherals',2,TRUE),
('asset','category','Communication','Communication',3,TRUE),
('asset','category','Networking','Networking',4,TRUE),
('asset','category','Server & Storage','Server & Storage',5,TRUE),
('asset','category','Office Equipment','Office Equipment',6,TRUE),
('asset','category','Furniture','Furniture',7,TRUE),
('asset','category','Vehicles','Vehicles',8,TRUE),
('asset','category','Security','Security',9,TRUE),
('asset','category','AV & Conference','AV & Conference',10,TRUE),
('asset','category','Other','Other',11,TRUE),
('asset','condition','Excellent','Excellent',1,TRUE),
('asset','condition','Good','Good',2,TRUE),
('asset','condition','Fair','Fair',3,TRUE),
('asset','condition','Poor','Poor',4,TRUE),
('asset','maintenance_type','Preventive','Preventive',1,TRUE),
('asset','maintenance_type','Corrective','Corrective',2,TRUE),
('asset','maintenance_type','Repair','Repair',3,TRUE),
('asset','maintenance_type','Upgrade','Upgrade',4,TRUE),
('asset','maintenance_type','Inspection','Inspection',5,TRUE),
('asset','maintenance_type','Predictive','Predictive',6,TRUE),
('asset','status','Available','Available',1,TRUE),
('asset','status','Assigned','Assigned',2,TRUE),
('asset','status','In Repair','In Repair',3,TRUE),
('asset','status','Reserved','Reserved',4,TRUE),
('asset','status','Retired','Retired',5,TRUE),
('asset','status','Lost / Stolen','Lost',6,TRUE),
('asset','vendor_type','OEM / Direct','OEM',1,TRUE),
('asset','vendor_type','Authorised Reseller','Reseller',2,TRUE),
('asset','vendor_type','Marketplace','Marketplace',3,TRUE),
('asset','vendor_type','Internal Transfer','Internal',4,TRUE),
('asset','depreciation_method','Straight Line','SLM',1,TRUE),
('asset','depreciation_method','Written Down Value','WDV',2,TRUE),
-- Project
('project','category','Client Delivery','Client',1,TRUE),
('project','category','Internal','Internal',2,TRUE),
('project','category','R&D','R&D',3,TRUE),
('project','category','Infrastructure','Infrastructure',4,TRUE),
('project','category','Compliance','Compliance',5,TRUE),
('project','category','Marketing','Marketing',6,TRUE),
('project','member_role','Project Lead','Lead',1,TRUE),
('project','member_role','Developer','Developer',2,TRUE),
('project','member_role','Designer','Designer',3,TRUE),
('project','member_role','QA Engineer','QA',4,TRUE),
('project','member_role','Business Analyst','Analyst',5,TRUE),
('project','member_role','Observer','Observer',6,TRUE),
('project','task_status','To Do','Todo',1,TRUE),
('project','task_status','In Progress','In Progress',2,TRUE),
('project','task_status','In Review','Review',3,TRUE),
('project','task_status','Done','Done',4,TRUE),
('project','task_status','Blocked','Blocked',5,TRUE),
('project','task_status','Cancelled','Cancelled',6,TRUE),
('project','time_log_type','Development','Development',1,TRUE),
('project','time_log_type','Design','Design',2,TRUE),
('project','time_log_type','Testing','Testing',3,TRUE),
('project','time_log_type','Meetings','Meetings',4,TRUE),
('project','time_log_type','Documentation','Documentation',5,TRUE),
('project','time_log_type','Support','Support',6,TRUE),
('project','rag_status','Green','Green',1,TRUE),
('project','rag_status','Amber','Amber',2,TRUE),
('project','rag_status','Red','Red',3,TRUE),
('project','status','Planning','Planning',1,TRUE),
('project','status','Active','Active',2,TRUE),
('project','status','On Hold','On Hold',3,TRUE),
('project','status','Completed','Completed',4,TRUE),
('project','status','Cancelled','Cancelled',5,TRUE),
('project','priority','Low','Low',1,TRUE),
('project','priority','Medium','Medium',2,TRUE),
('project','priority','High','High',3,TRUE),
('project','priority','Critical','Critical',4,TRUE),
('project','sprint_status','Planning','Planning',1,TRUE),
('project','sprint_status','Active','Active',2,TRUE),
('project','sprint_status','Completed','Completed',3,TRUE),
('project','sprint_status','Cancelled','Cancelled',4,TRUE),
('project','milestone_status','Pending','Pending',1,TRUE),
('project','milestone_status','In Progress','In Progress',2,TRUE),
('project','milestone_status','Completed','Completed',3,TRUE),
('project','milestone_status','Missed','Missed',4,TRUE),
('project','task_priority','Low','Low',1,TRUE),
('project','task_priority','Medium','Medium',2,TRUE),
('project','task_priority','High','High',3,TRUE),
('project','task_priority','Critical','Critical',4,TRUE),
('project','velocity_unit','Story Points','sp',1,TRUE),
('project','velocity_unit','Hours','hours',2,TRUE),
('project','velocity_unit','Tasks','tasks',3,TRUE),
('project','budget_category','Development','Development',1,TRUE),
('project','budget_category','Design','Design',2,TRUE),
('project','budget_category','Testing','Testing',3,TRUE),
('project','budget_category','Infrastructure','Infrastructure',4,TRUE),
('project','budget_category','Licences','Licences',5,TRUE),
('project','budget_category','Travel','Travel',6,TRUE),
('project','budget_category','Other','Other',7,TRUE),
-- OKR
('okr','period','Q1 2026 (Jan–Mar)','Q1-2026',1,TRUE),
('okr','period','Q2 2026 (Apr–Jun)','Q2-2026',2,TRUE),
('okr','period','Q3 2026 (Jul–Sep)','Q3-2026',3,TRUE),
('okr','period','Q4 2026 (Oct–Dec)','Q4-2026',4,TRUE),
('okr','period','Annual 2026','FY-2026',5,TRUE),
('okr','period','Q1 2027 (Jan–Mar)','Q1-2027',6,TRUE),
('okr','period','Q2 2027 (Apr–Jun)','Q2-2027',7,TRUE),
('okr','period','Q3 2027 (Jul–Sep)','Q3-2027',8,TRUE),
('okr','period','Q4 2027 (Oct–Dec)','Q4-2027',9,TRUE),
('okr','period','Annual 2027','FY-2027',10,TRUE),
('okr','kr_unit','Percentage (%)','%',1,TRUE),
('okr','kr_unit','Number','Number',2,TRUE),
('okr','kr_unit','Currency (INR)','INR',3,TRUE),
('okr','kr_unit','Currency (USD)','USD',4,TRUE),
('okr','kr_unit','Boolean (Yes/No)','Boolean',5,TRUE),
('okr','kr_unit','Score (1–10)','Score',6,TRUE),
('okr','type','Company','Company',1,TRUE),
('okr','type','Department','Department',2,TRUE),
('okr','type','Team','Team',3,TRUE),
('okr','type','Individual','Individual',4,TRUE),
('okr','checkin_frequency','Weekly','weekly',1,TRUE),
('okr','checkin_frequency','Bi-weekly','biweekly',2,TRUE),
('okr','checkin_frequency','Monthly','monthly',3,TRUE),
('okr','checkin_frequency','Quarterly','quarterly',4,TRUE),
('okr','confidence','On Track','on_track',1,TRUE),
('okr','confidence','At Risk','at_risk',2,TRUE),
('okr','confidence','Behind','behind',3,TRUE),
('okr','alignment','Fully Aligned','aligned',1,TRUE),
('okr','alignment','Partially Aligned','partial',2,TRUE),
('okr','alignment','Standalone','standalone',3,TRUE),
-- Invoice
('invoice','status','Draft','Draft',1,TRUE),
('invoice','status','Sent','Sent',2,TRUE),
('invoice','status','Paid','Paid',3,TRUE),
('invoice','status','Overdue','Overdue',4,TRUE),
('invoice','status','Cancelled','Cancelled',5,TRUE),
('invoice','payment_terms','Immediate','Immediate',1,TRUE),
('invoice','payment_terms','Net 7','Net 7',2,TRUE),
('invoice','payment_terms','Net 15','Net 15',3,TRUE),
('invoice','payment_terms','Net 30','Net 30',4,TRUE),
('invoice','payment_terms','Net 45','Net 45',5,TRUE),
('invoice','payment_terms','Net 60','Net 60',6,TRUE),
('invoice','service_type','Software Development','Software Development',1,TRUE),
('invoice','service_type','IT Consulting','IT Consulting',2,TRUE),
('invoice','service_type','Managed Services','Managed Services',3,TRUE),
('invoice','service_type','Support & Maintenance','Support & Maintenance',4,TRUE),
('invoice','service_type','Training','Training',5,TRUE),
('invoice','service_type','Licensing','Licensing',6,TRUE),
('invoice','service_type','Other','Other',7,TRUE),
('invoice','line_item_unit','Hours','Hours',1,TRUE),
('invoice','line_item_unit','Days','Days',2,TRUE),
('invoice','line_item_unit','Units','Units',3,TRUE),
('invoice','line_item_unit','Months','Months',4,TRUE),
('invoice','line_item_unit','Fixed','Fixed',5,TRUE),
('invoice','line_item_unit','Pieces','Pieces',6,TRUE),
('invoice','line_item_unit','Licences','Licences',7,TRUE),
('invoice','tax_type','GST 0%','0',1,TRUE),
('invoice','tax_type','GST 5%','5',2,TRUE),
('invoice','tax_type','GST 12%','12',3,TRUE),
('invoice','tax_type','GST 18%','18',4,TRUE),
('invoice','tax_type','GST 28%','28',5,TRUE),
('invoice','tax_type','TDS 10%','TDS10',6,TRUE),
('invoice','tax_type','TDS 2%','TDS2',7,TRUE),
('invoice','tax_type','Zero Rated (Export)','ZERO',8,TRUE),
('invoice','discount_type','Percentage','percentage',1,TRUE),
('invoice','discount_type','Fixed Amount','fixed',2,TRUE),
-- Communication
('communication','audience','All Employees','all',1,TRUE),
('communication','audience','Engineering','Engineering',2,TRUE),
('communication','audience','Human Resources','Human Resources',3,TRUE),
('communication','audience','Finance','Finance',4,TRUE),
('communication','audience','Marketing','Marketing',5,TRUE),
('communication','audience','Sales','Sales',6,TRUE),
('communication','audience','Operations','Operations',7,TRUE),
('communication','audience','Leadership','leadership',8,TRUE),
('communication','priority','Normal','normal',1,TRUE),
('communication','priority','Medium','medium',2,TRUE),
('communication','priority','High','high',3,TRUE),
('communication','priority','Critical','critical',4,TRUE),
('communication','channel_type','General','public',1,TRUE),
('communication','channel_type','Announcements','announcements',2,TRUE),
('communication','channel_type','Department','department',3,TRUE),
('communication','channel_type','Private','private',4,TRUE),
('communication','post_type','Post','post',1,TRUE),
('communication','post_type','Announcement','announcement',2,TRUE),
('communication','post_type','Update','update',3,TRUE),
('communication','post_type','Event','event',4,TRUE),
('communication','post_type','Policy','policy',5,TRUE),
('communication','post_type','Achievement','achievement',6,TRUE),
('communication','reaction_type','Like','👍',1,TRUE),
('communication','reaction_type','Love','❤️',2,TRUE),
('communication','reaction_type','Celebrate','🎉',3,TRUE),
('communication','reaction_type','Support','🙌',4,TRUE),
('communication','reaction_type','Insightful','💡',5,TRUE),
('communication','post_status','Published','published',1,TRUE),
('communication','post_status','Draft','draft',2,TRUE),
('communication','post_status','Flagged','flagged',3,TRUE),
('communication','post_status','Removed','removed',4,TRUE),
('communication','event_status','Upcoming','upcoming',1,TRUE),
('communication','event_status','Live','live',2,TRUE),
('communication','event_status','Completed','completed',3,TRUE),
('communication','event_status','Cancelled','cancelled',4,TRUE),
('communication','poll_status','Active','active',1,TRUE),
('communication','poll_status','Closed','closed',2,TRUE),
('communication','poll_status','Draft','draft',3,TRUE),
-- Knowledge
('knowledge','category','HR Policies','HR Policies',1,TRUE),
('knowledge','category','IT & Infrastructure','IT & Infrastructure',2,TRUE),
('knowledge','category','Finance & Payroll','Finance & Payroll',3,TRUE),
('knowledge','category','Operations','Operations',4,TRUE),
('knowledge','category','Legal & Compliance','Legal & Compliance',5,TRUE),
('knowledge','category','Product','Product',6,TRUE),
('knowledge','category','Engineering','Engineering',7,TRUE),
('knowledge','category','Onboarding','Onboarding',8,TRUE),
('knowledge','category','Sales & Marketing','Sales & Marketing',9,TRUE),
('knowledge','category','Customer Success','Customer Success',10,TRUE),
('knowledge','category','General','General',11,TRUE),
('knowledge','article_status','Draft','Draft',1,TRUE),
('knowledge','article_status','Published','Published',2,TRUE),
('knowledge','article_status','Archived','Archived',3,TRUE),
-- Notification
('notification','type','Info','info',1,TRUE),
('notification','type','Success','success',2,TRUE),
('notification','type','Warning','warning',3,TRUE),
('notification','type','Error','error',4,TRUE),
('notification','category','Leave','leave',1,TRUE),
('notification','category','IT Ticket','ticket',2,TRUE),
('notification','category','Payroll','payroll',3,TRUE),
('notification','category','Onboarding','onboarding',4,TRUE),
('notification','category','Performance','performance',5,TRUE),
('notification','category','Recruitment','recruitment',6,TRUE),
('notification','category','Workflow','workflow',7,TRUE),
('notification','category','Training','training',8,TRUE),
('notification','category','System','system',9,TRUE),
('notification','category','General','general',10,TRUE),
-- Workflow
('workflow','trigger_type','Leave Submitted','leave.submitted',1,TRUE),
('workflow','trigger_type','Employee Joined','employee.joined',2,TRUE),
('workflow','trigger_type','Expense Submitted','expense.submitted',3,TRUE),
('workflow','trigger_type','Offer Letter Sent','offer.sent',4,TRUE),
('workflow','trigger_type','Invoice Raised','invoice.raised',5,TRUE),
('workflow','trigger_type','IT Ticket Critical','it_ticket.critical',6,TRUE),
('workflow','trigger_type','Performance Review Due','performance.review_due',7,TRUE),
('workflow','trigger_type','Probation Ending','employee.probation_end',8,TRUE),
('workflow','trigger_type','Contract Expiring','employee.contract_expiry',9,TRUE),
('workflow','trigger_type','Manual','manual',10,TRUE),
('workflow','status','Draft','draft',1,TRUE),
('workflow','status','Active','active',2,TRUE),
('workflow','status','Inactive','inactive',3,TRUE),
('workflow','status','Archived','archived',4,TRUE),
('workflow','instance_status','Running','running',1,TRUE),
('workflow','instance_status','Waiting','waiting',2,TRUE),
('workflow','instance_status','Completed','completed',3,TRUE),
('workflow','instance_status','Failed','failed',4,TRUE),
('workflow','instance_status','Cancelled','cancelled',5,TRUE),
('workflow','approval_status','Pending','pending',1,TRUE),
('workflow','approval_status','Approved','approved',2,TRUE),
('workflow','approval_status','Rejected','rejected',3,TRUE),
('workflow','approval_status','Escalated','escalated',4,TRUE),
('workflow','approval_status','Delegated','delegated',5,TRUE),
('workflow','approval_status','Timed Out','timed_out',6,TRUE),
('workflow','node_type','Trigger','trigger',1,TRUE),
('workflow','node_type','Condition','condition',2,TRUE),
('workflow','node_type','Approval','approval',3,TRUE),
('workflow','node_type','Task','task',4,TRUE),
('workflow','node_type','Notification','notification',5,TRUE),
('workflow','node_type','Action','action',6,TRUE),
('workflow','node_type','Delay','delay',7,TRUE),
('workflow','node_type','End','end',8,TRUE),
('workflow','category','HR','HR',1,TRUE),
('workflow','category','Finance','Finance',2,TRUE),
('workflow','category','IT','IT',3,TRUE),
('workflow','category','Performance','Performance',4,TRUE),
('workflow','category','Procurement','Procurement',5,TRUE),
('workflow','category','Operations','Operations',6,TRUE),
-- LinkedIn
('linkedin','post_type','Thought Leadership','thought_leadership',1,TRUE),
('linkedin','post_type','Product Update','product_update',2,TRUE),
('linkedin','post_type','Company Culture','company_culture',3,TRUE),
('linkedin','post_type','Job Posting','job_posting',4,TRUE),
('linkedin','post_type','Industry Insight','industry_insight',5,TRUE),
('linkedin','post_type','Case Study','case_study',6,TRUE),
('linkedin','post_type','Event','event',7,TRUE),
('linkedin','post_type','Achievement','achievement',8,TRUE),
('linkedin','tone','Professional','professional',1,TRUE),
('linkedin','tone','Conversational','conversational',2,TRUE),
('linkedin','tone','Inspirational','inspirational',3,TRUE),
('linkedin','tone','Educational','educational',4,TRUE),
('linkedin','tone','Storytelling','storytelling',5,TRUE),
('linkedin','tone','Witty','witty',6,TRUE),
('linkedin','event_type','Webinar','webinar',1,TRUE),
('linkedin','event_type','Conference','conference',2,TRUE),
('linkedin','event_type','Product Launch','product_launch',3,TRUE),
('linkedin','event_type','Networking Event','networking',4,TRUE),
('linkedin','event_type','Workshop','workshop',5,TRUE),
('linkedin','event_type','Hackathon','hackathon',6,TRUE),
('linkedin','event_type','Hiring Drive','hiring_drive',7,TRUE),
('linkedin','event_type','Award Ceremony','award',8,TRUE),
('linkedin','event_type','Press Release','press_release',9,TRUE),
('linkedin','post_status','Draft','draft',1,TRUE),
('linkedin','post_status','Scheduled','scheduled',2,TRUE),
('linkedin','post_status','Published','published',3,TRUE),
('linkedin','post_status','Archived','archived',4,TRUE),
('linkedin','engagement_metric','Impressions','impressions',1,TRUE),
('linkedin','engagement_metric','Likes','likes',2,TRUE),
('linkedin','engagement_metric','Comments','comments',3,TRUE),
('linkedin','engagement_metric','Shares','shares',4,TRUE),
('linkedin','engagement_metric','Clicks','clicks',5,TRUE),
('linkedin','engagement_metric','Followers Gained','followers',6,TRUE),
-- Onboarding
('onboarding','task_category','Documentation','documentation',1,TRUE),
('onboarding','task_category','System Setup','setup',2,TRUE),
('onboarding','task_category','Training','training',3,TRUE),
('onboarding','task_category','Meeting','meeting',4,TRUE),
('onboarding','task_category','Policy Review','policy',5,TRUE),
('onboarding','task_category','Equipment','equipment',6,TRUE),
('onboarding','task_category','Compliance','compliance',7,TRUE),
('onboarding','task_priority','Low','low',1,TRUE),
('onboarding','task_priority','Medium','medium',2,TRUE),
('onboarding','task_priority','High','high',3,TRUE),
('onboarding','document_type','Offer Letter','Offer Letter',1,TRUE),
('onboarding','document_type','Appointment Letter','Appointment Letter',2,TRUE),
('onboarding','document_type','NDA','NDA',3,TRUE),
('onboarding','document_type','Policy Acknowledgement','Policy',4,TRUE),
('onboarding','document_type','Tax Declaration (Form 12BB)','Tax Form',5,TRUE),
('onboarding','document_type','PF Nomination','PF Nomination',6,TRUE),
('onboarding','document_type','Bank Details Form','Bank Form',7,TRUE),
('onboarding','document_type','Other','Other',8,TRUE),
('onboarding','document_status','Pending','Pending',1,TRUE),
('onboarding','document_status','Sent for Signing','Sent',2,TRUE),
('onboarding','document_status','Signed','Signed',3,TRUE),
('onboarding','document_status','Approved','Approved',4,TRUE),
('onboarding','kit_status','Not Ordered','Not Ordered',1,TRUE),
('onboarding','kit_status','Ordered','Ordered',2,TRUE),
('onboarding','kit_status','Shipped','Shipped',3,TRUE),
('onboarding','kit_status','Delivered','Delivered',4,TRUE),
('onboarding','signature_status','Pending','Pending',1,TRUE),
('onboarding','signature_status','Sent','Sent',2,TRUE),
('onboarding','signature_status','Signed','Signed',3,TRUE),
('onboarding','signature_status','Expired','Expired',4,TRUE),
('onboarding','signature_status','Declined','Declined',5,TRUE),
('onboarding','record_status','Not Started','not-started',1,TRUE),
('onboarding','record_status','In Progress','in-progress',2,TRUE),
('onboarding','record_status','Completed','completed',3,TRUE),
('onboarding','welcome_kit_item','Laptop Bag','Laptop Bag',1,TRUE),
('onboarding','welcome_kit_item','Company T-Shirt','Company T-Shirt',2,TRUE),
('onboarding','welcome_kit_item','Welcome Letter','Welcome Letter',3,TRUE),
('onboarding','welcome_kit_item','Access Card','Access Card',4,TRUE),
('onboarding','welcome_kit_item','Notebook & Pen','Notebook & Pen',5,TRUE),
('onboarding','welcome_kit_item','Company Mug','Company Mug',6,TRUE),
('onboarding','welcome_kit_item','Headset','Headset',7,TRUE),
('onboarding','welcome_kit_item','Mouse & Keyboard','Mouse & Keyboard',8,TRUE),
-- Employee
('employee','status','Active','Active',1,TRUE),
('employee','status','Inactive','Inactive',2,TRUE),
('employee','status','On Leave','On Leave',3,TRUE),
('employee','blood_group','A+','A+',1,TRUE),
('employee','blood_group','A-','A-',2,TRUE),
('employee','blood_group','B+','B+',3,TRUE),
('employee','blood_group','B-','B-',4,TRUE),
('employee','blood_group','AB+','AB+',5,TRUE),
('employee','blood_group','AB-','AB-',6,TRUE),
('employee','blood_group','O+','O+',7,TRUE),
('employee','blood_group','O-','O-',8,TRUE),
('employee','gender','Male','Male',1,TRUE),
('employee','gender','Female','Female',2,TRUE),
('employee','gender','Non-binary','Non-binary',3,TRUE),
('employee','gender','Prefer not to say','Prefer not to say',4,TRUE),
('employee','marital_status','Single','Single',1,TRUE),
('employee','marital_status','Married','Married',2,TRUE),
('employee','marital_status','Divorced','Divorced',3,TRUE),
('employee','marital_status','Widowed','Widowed',4,TRUE),
('employee','lifecycle_stage','Hired','hired',1,TRUE),
('employee','lifecycle_stage','Pre-Onboarding','pre_onboarding',2,TRUE),
('employee','lifecycle_stage','Onboarding','onboarding',3,TRUE),
('employee','lifecycle_stage','Active','active',4,TRUE),
('employee','lifecycle_stage','On Leave','on_leave',5,TRUE),
('employee','lifecycle_stage','Probation Review','probation',6,TRUE),
('employee','lifecycle_stage','Performance Review','pip',7,TRUE),
('employee','lifecycle_stage','Resignation','resigned',8,TRUE),
('employee','lifecycle_stage','Notice Period','notice',9,TRUE),
('employee','lifecycle_stage','Exited','exited',10,TRUE),
('employee','separation_reason','Resignation','resignation',1,TRUE),
('employee','separation_reason','Termination','termination',2,TRUE),
('employee','separation_reason','End of Contract','contract_end',3,TRUE),
('employee','separation_reason','Retirement','retirement',4,TRUE),
('employee','separation_reason','Mutual Separation','mutual',5,TRUE),
('employee','separation_reason','Absconding','absconding',6,TRUE),
('employee','separation_reason','Deceased','deceased',7,TRUE),
('employee','relationship_type','Employee','employee',1,TRUE),
('employee','relationship_type','Contractor','contractor',2,TRUE),
('employee','relationship_type','Consultant','consultant',3,TRUE),
('employee','relationship_type','Intern','intern',4,TRUE),
('employee','work_auth','Indian Citizen','citizen',1,TRUE),
('employee','work_auth','OCI Card Holder','oci',2,TRUE),
('employee','work_auth','Work Visa','visa',3,TRUE),
-- Document
('document','type','Offer Letter','Offer Letter',1,TRUE),
('document','type','Appointment Letter','Appointment Letter',2,TRUE),
('document','type','Non-Disclosure Agreement','NDA',3,TRUE),
('document','type','Employment Contract','Contract',4,TRUE),
('document','type','Salary Revision Letter','Salary Revision',5,TRUE),
('document','type','Promotion Letter','Promotion Letter',6,TRUE),
('document','type','Warning Letter','Warning Letter',7,TRUE),
('document','type','Relieving Letter','Relieving Letter',8,TRUE),
('document','type','Experience Certificate','Experience Certificate',9,TRUE),
('document','type','Tax Form (Form 16)','Form 16',10,TRUE),
('document','type','Policy Document','Policy',11,TRUE),
('document','type','Other','Other',12,TRUE),
-- Permission
('permission','action','Create','create',1,TRUE),
('permission','action','Read / View','read',2,TRUE),
('permission','action','Update / Edit','update',3,TRUE),
('permission','action','Delete','delete',4,TRUE),
('permission','action','Approve','approve',5,TRUE),
('permission','action','Export','export',6,TRUE),
('permission','action','Import','import',7,TRUE),
('permission','action','Admin','admin',8,TRUE),
('permission','app','Employee Dashboard','dashboard',1,TRUE),
('permission','app','Employee Directory','directory',2,TRUE),
('permission','app','Recruitment','recruitment',3,TRUE),
('permission','app','Onboarding','onboarding',4,TRUE),
('permission','app','Performance','performance',5,TRUE),
('permission','app','Training','training',6,TRUE),
('permission','app','IT Services','it-services',7,TRUE),
('permission','app','Payroll','payroll',8,TRUE),
('permission','app','Invoices','invoices',9,TRUE),
('permission','app','Asset Management','assets',10,TRUE),
('permission','app','OKR','okr',11,TRUE),
('permission','app','Project Management','projects',12,TRUE),
('permission','app','Communications','communications',13,TRUE),
('permission','app','Knowledge Base','knowledge',14,TRUE),
('permission','app','User Management','user-management',15,TRUE),
('permission','app','Permissions','permissions',16,TRUE),
('permission','app','Master Data','master-data',17,TRUE),
('permission','app','Workflow Dashboard','workflow',18,TRUE),
('permission','app','LinkedIn Manager','linkedin',19,TRUE),
('permission','app','Executive Dashboard','executive',20,TRUE),
('permission','app','Advanced Analytics','analytics',21,TRUE),
('permission','app','AI Intelligence','ai',22,TRUE),
('permission','app','Security & Compliance','security',23,TRUE),
('permission','app','Advanced Features','advanced',24,TRUE),
('permission','app','Collaboration Hub','collaboration',25,TRUE),
-- Security & Compliance
('security','policy_type','Acceptable Use','acceptable_use',1,TRUE),
('security','policy_type','Password Policy','password',2,TRUE),
('security','policy_type','Data Classification','data_class',3,TRUE),
('security','policy_type','Incident Response','incident',4,TRUE),
('security','policy_type','Access Control','access_control',5,TRUE),
('security','policy_type','BYOD','byod',6,TRUE),
('security','policy_type','Remote Work Security','remote',7,TRUE),
('security','policy_type','Vendor Management','vendor',8,TRUE),
('security','risk_level','Critical','critical',1,TRUE),
('security','risk_level','High','high',2,TRUE),
('security','risk_level','Medium','medium',3,TRUE),
('security','risk_level','Low','low',4,TRUE),
('security','risk_level','Informational','info',5,TRUE),
('security','compliance_framework','ISO 27001','iso27001',1,TRUE),
('security','compliance_framework','SOC 2 Type II','soc2',2,TRUE),
('security','compliance_framework','GDPR','gdpr',3,TRUE),
('security','compliance_framework','IT Act 2000','it_act',4,TRUE),
('security','compliance_framework','DPDPA 2023','dpdpa',5,TRUE),
('security','compliance_framework','PCI-DSS','pcidss',6,TRUE),
('security','audit_action','Login','login',1,TRUE),
('security','audit_action','Logout','logout',2,TRUE),
('security','audit_action','Data Export','export',3,TRUE),
('security','audit_action','Permission Changed','perm_change',4,TRUE),
('security','audit_action','Record Created','create',5,TRUE),
('security','audit_action','Record Updated','update',6,TRUE),
('security','audit_action','Record Deleted','delete',7,TRUE),
('security','audit_action','Password Reset','pwd_reset',8,TRUE),
('security','audit_action','Failed Login','failed_login',9,TRUE),
-- Master general
('master','seniority_level','Intern','Intern',1,TRUE),
('master','seniority_level','Junior','Junior',2,TRUE),
('master','seniority_level','Mid-level','Mid',3,TRUE),
('master','seniority_level','Senior','Senior',4,TRUE),
('master','seniority_level','Lead','Lead',5,TRUE),
('master','seniority_level','Staff','Staff',6,TRUE),
('master','seniority_level','Principal','Principal',7,TRUE),
('master','seniority_level','Manager','Manager',8,TRUE),
('master','seniority_level','Senior Manager','Sr Manager',9,TRUE),
('master','seniority_level','Director','Director',10,TRUE),
('master','seniority_level','VP','VP',11,TRUE),
('master','seniority_level','SVP','SVP',12,TRUE),
('master','seniority_level','CXO','CXO',13,TRUE),
('master','qualification','Secondary (10th)','10th',1,TRUE),
('master','qualification','Higher Secondary (12th)','12th',2,TRUE),
('master','qualification','Diploma','Diploma',3,TRUE),
('master','qualification','B.Tech / B.E.','BTech',4,TRUE),
('master','qualification','BCA / B.Sc (CS)','BCA',5,TRUE),
('master','qualification','B.Com / BBA','BCom',6,TRUE),
('master','qualification','BA / B.Sc','BA',7,TRUE),
('master','qualification','MBA / PGDM','MBA',8,TRUE),
('master','qualification','M.Tech / M.E.','MTech',9,TRUE),
('master','qualification','MCA','MCA',10,TRUE),
('master','qualification','PhD','PhD',11,TRUE),
('master','qualification','CA / CPA','CA',12,TRUE),
('master','qualification','Other','Other',13,TRUE),
('master','state_india','Andhra Pradesh','AP',1,TRUE),
('master','state_india','Assam','AS',2,TRUE),
('master','state_india','Bihar','BR',3,TRUE),
('master','state_india','Delhi','DL',4,TRUE),
('master','state_india','Goa','GA',5,TRUE),
('master','state_india','Gujarat','GJ',6,TRUE),
('master','state_india','Haryana','HR',7,TRUE),
('master','state_india','Himachal Pradesh','HP',8,TRUE),
('master','state_india','Jharkhand','JH',9,TRUE),
('master','state_india','Karnataka','KA',10,TRUE),
('master','state_india','Kerala','KL',11,TRUE),
('master','state_india','Madhya Pradesh','MP',12,TRUE),
('master','state_india','Maharashtra','MH',13,TRUE),
('master','state_india','Odisha','OR',14,TRUE),
('master','state_india','Punjab','PB',15,TRUE),
('master','state_india','Rajasthan','RJ',16,TRUE),
('master','state_india','Tamil Nadu','TN',17,TRUE),
('master','state_india','Telangana','TS',18,TRUE),
('master','state_india','Uttar Pradesh','UP',19,TRUE),
('master','state_india','Uttarakhand','UK',20,TRUE),
('master','state_india','West Bengal','WB',21,TRUE)
ON CONFLICT (entity, field, value) DO UPDATE SET
  label      = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_active  = EXCLUDED.is_active;

-- ============================================================
-- 13. WORKFLOW DEFINITIONS
-- ============================================================

INSERT INTO workflow_definitions (name, description, status, trigger_type, trigger_config, nodes, is_template, category) VALUES
('Leave Approval',
 'Standard two-step leave approval: Manager → HR. Auto-approved for ≤1 day casual leave.',
 'active','leave.submitted','{"conditions":[]}'::jsonb,
 '[{"id":"start","type":"trigger","label":"Leave Submitted","next":"check_days"},{"id":"check_days","type":"condition","label":"Days > 1?","branches":[{"condition":"days > 1","next":"manager_approval"},{"condition":"else","next":"auto_approve"}]},{"id":"manager_approval","type":"approval","label":"Manager Approval","assignee_role":"manager","timeout_hours":24,"on_approve":"hr_approval","on_reject":"reject_leave"},{"id":"hr_approval","type":"approval","label":"HR Approval","assignee_role":"hr","timeout_hours":24,"on_approve":"approve_leave","on_reject":"reject_leave"},{"id":"auto_approve","type":"action","label":"Auto Approve","action":"update_leave_status","payload":{"status":"Approved"},"next":"notify_employee"},{"id":"approve_leave","type":"action","label":"Approve Leave","action":"update_leave_status","payload":{"status":"Approved"},"next":"notify_employee"},{"id":"reject_leave","type":"action","label":"Reject Leave","action":"update_leave_status","payload":{"status":"Rejected"},"next":"notify_employee"},{"id":"notify_employee","type":"notification","label":"Notify Employee","next":"end"},{"id":"end","type":"end","label":"Done"}]'::jsonb,
 TRUE,'HR'),
('Employee Onboarding',
 'Full onboarding: IT provisioning → buddy → document signing → manager check-in.',
 'active','employee.joined','{}'::jsonb,
 '[{"id":"start","type":"trigger","label":"New Employee Joined","next":"it_provisioning"},{"id":"it_provisioning","type":"task","label":"IT: Provision Laptop & Accounts","assignee_role":"it","due_days":1,"next":"hr_doc_signing"},{"id":"hr_doc_signing","type":"approval","label":"HR: Document Signing","assignee_role":"hr","due_days":3,"next":"buddy_assignment"},{"id":"buddy_assignment","type":"task","label":"HR: Assign Buddy","assignee_role":"hr","due_days":1,"next":"orientation"},{"id":"orientation","type":"task","label":"Manager: Schedule Orientation","assignee_role":"manager","due_days":2,"next":"day30_checkin"},{"id":"day30_checkin","type":"task","label":"Manager: 30-Day Check-in","assignee_role":"manager","due_days":30,"next":"day60_checkin"},{"id":"day60_checkin","type":"task","label":"HR: 60-Day Review","assignee_role":"hr","due_days":60,"next":"probation_review"},{"id":"probation_review","type":"approval","label":"Manager: Probation Confirmation","assignee_role":"manager","due_days":90,"next":"end"},{"id":"end","type":"end","label":"Onboarding Complete"}]'::jsonb,
 TRUE,'HR'),
('Invoice Approval',
 'Finance review and approval of invoices above ₹1,00,000.',
 'active','invoice.raised','{"threshold":100000}'::jsonb,
 '[{"id":"start","type":"trigger","label":"Invoice Raised","next":"amount_check"},{"id":"amount_check","type":"condition","label":"Amount > ₹1L?","branches":[{"condition":"total > 100000","next":"finance_approval"},{"condition":"else","next":"auto_approve"}]},{"id":"finance_approval","type":"approval","label":"Finance Manager Approval","assignee_role":"finance","timeout_hours":48,"on_approve":"mark_approved","on_reject":"mark_rejected"},{"id":"auto_approve","type":"action","label":"Mark Approved","action":"update_invoice_status","payload":{"status":"Approved"},"next":"notify_team"},{"id":"mark_approved","type":"action","label":"Mark Approved","action":"update_invoice_status","payload":{"status":"Approved"},"next":"notify_team"},{"id":"mark_rejected","type":"action","label":"Mark Rejected","action":"update_invoice_status","payload":{"status":"Cancelled"},"next":"notify_team"},{"id":"notify_team","type":"notification","label":"Notify Finance Team","next":"end"},{"id":"end","type":"end","label":"Done"}]'::jsonb,
 TRUE,'Finance'),
('IT Ticket Escalation',
 'Auto-escalate Critical IT tickets unresolved after 2 hours to IT Manager.',
 'active','it_ticket.critical','{"escalation_hours":2}'::jsonb,
 '[{"id":"start","type":"trigger","label":"Critical Ticket Raised","next":"assign_it"},{"id":"assign_it","type":"task","label":"IT: Acknowledge & Assign","assignee_role":"it","due_hours":1,"next":"resolve_check"},{"id":"resolve_check","type":"condition","label":"Resolved within 2h?","branches":[{"condition":"status == Resolved","next":"close_ticket"},{"condition":"else","next":"escalate"}]},{"id":"escalate","type":"approval","label":"IT Manager Escalation","assignee_role":"admin","timeout_hours":4,"on_approve":"close_ticket","on_reject":"close_ticket"},{"id":"close_ticket","type":"action","label":"Close Ticket","action":"update_ticket_status","payload":{"status":"Closed"},"next":"end"},{"id":"end","type":"end","label":"Done"}]'::jsonb,
 TRUE,'IT'),
('Performance Review Cycle',
 'Quarterly review: employee self-assessment → manager rating → HR sign-off.',
 'active','performance.review_due','{}'::jsonb,
 '[{"id":"start","type":"trigger","label":"Review Period Opens","next":"self_assessment"},{"id":"self_assessment","type":"task","label":"Employee: Self Assessment","assignee_role":"employee","due_days":7,"next":"manager_review"},{"id":"manager_review","type":"approval","label":"Manager: Rate & Comment","assignee_role":"manager","due_days":7,"next":"hr_signoff"},{"id":"hr_signoff","type":"approval","label":"HR: Final Sign-off","assignee_role":"hr","due_days":3,"next":"acknowledge"},{"id":"acknowledge","type":"task","label":"Employee: Acknowledge Review","assignee_role":"employee","due_days":3,"next":"end"},{"id":"end","type":"end","label":"Review Complete"}]'::jsonb,
 TRUE,'Performance')
ON CONFLICT (lower(name)) DO UPDATE SET
  description    = EXCLUDED.description,
  status         = EXCLUDED.status,
  trigger_type   = EXCLUDED.trigger_type,
  trigger_config = EXCLUDED.trigger_config,
  nodes          = EXCLUDED.nodes,
  is_template    = EXCLUDED.is_template,
  category       = EXCLUDED.category;

-- ============================================================
-- 14. TRAINING COURSES
-- ============================================================

INSERT INTO training_courses (title, description, category, instructor, duration_hours, type, status, passing_score, tags) VALUES
('New Employee Orientation','Mandatory first-day orientation covering company culture, values, policies, and systems.','Compliance','HR Team',4,'In-Person','Active',80,'["mandatory","orientation","onboarding"]'::jsonb),
('Information Security, Phishing & Account Protection','Covers data protection, phishing awareness, password hygiene, and incident reporting.','Compliance','IT Team',2,'Online','Active',85,'["security","compliance","annual"]'::jsonb),
('Prevention of Sexual Harassment & Respectful Workplace','Mandatory POSH training covering the law, workplace conduct expectations, and the reporting mechanism.','Compliance','Legal Team',3,'Online','Active',80,'["mandatory","posh","compliance","annual"]'::jsonb),
('Code of Conduct, Ethics & Acceptable Use','Company values, code of conduct, anti-bribery policy, acceptable use, and conflict of interest guidelines.','Compliance','HR Team',1.5,'Online','Active',80,'["ethics","compliance"]'::jsonb),
('Leadership Essentials','Core leadership skills for first-time and mid-level managers: delegation, feedback, conflict resolution.','Leadership & Management','External Trainer',16,'Blended','Active',75,'["leadership","management","managers"]'::jsonb),
('Effective Communication in the Workplace','Written and verbal communication, active listening, and stakeholder communication.','Soft Skills','HR Team',8,'Blended','Active',70,'["communication","soft-skills"]'::jsonb),
('Project Management Fundamentals','Introduction to agile methodology, Jira basics, and sprint planning.','Technical Skills','Engineering Lead',12,'Online','Active',75,'["project-management","agile","scrum"]'::jsonb),
('Data Privacy & Secure Data Handling','Personal data, data subject rights, processing lawfulness, secure handling, and breach procedures.','Compliance','Legal Team',2,'Online','Active',80,'["gdpr","data-privacy","compliance","annual"]'::jsonb),
('Financial Literacy for Managers','Reading P&L statements, budget management, cost centre ownership.','Finance & Accounting','Finance Manager',8,'Blended','Active',70,'["finance","managers","budgeting"]'::jsonb),
('Customer Success & Service Excellence','Client relationship management, SLA adherence, escalation handling.','Soft Skills','Customer Success Lead',8,'In-Person','Active',70,'["customer-success","service","client-facing"]'::jsonb),
('Public Cloud Fundamentals (AWS)','AWS core services: EC2, S3, RDS, Lambda, IAM and cost management basics.','Technical Skills','DevOps Team',20,'Online','Active',80,'["aws","cloud","devops","technical"]'::jsonb),
('React & TypeScript for Frontend Developers','Modern frontend development with React 19, TypeScript, hooks, state management and testing.','Technical Skills','Engineering Lead',24,'Online','Active',75,'["react","typescript","frontend","technical"]'::jsonb),
('Advanced Excel & Data Analysis','Pivot tables, VLOOKUP, Power Query, dashboards and advanced formula writing.','Technical Skills','Finance Team',8,'Online','Active',75,'["excel","data-analysis","productivity"]'::jsonb),
('Mental Health & Wellbeing at Work','Stress management techniques, identifying burnout, building resilience.','Soft Skills','HR Team',2,'Online','Active',0,'["wellbeing","mental-health","hr"]'::jsonb),
('Design Thinking & Innovation','Human-centred design process, ideation, rapid prototyping and usability testing.','Product & Domain','Product Team',16,'Blended','Active',70,'["design-thinking","innovation","product"]'::jsonb)
ON CONFLICT (lower(title)) DO UPDATE SET
  description   = EXCLUDED.description,
  category      = EXCLUDED.category,
  instructor    = EXCLUDED.instructor,
  duration_hours= EXCLUDED.duration_hours,
  type          = EXCLUDED.type,
  status        = EXCLUDED.status,
  passing_score = EXCLUDED.passing_score,
  tags          = EXCLUDED.tags;

-- ============================================================
-- 15. LEARNING PATHS
-- ============================================================

INSERT INTO learning_paths (name, description, target_role, courses, estimated_hours) VALUES
('Engineering Onboarding Track','Compliance and technical learning path for new engineering hires.','Software Engineer','["New Employee Orientation","Information Security, Phishing & Account Protection","Code of Conduct, Ethics & Acceptable Use","React & TypeScript for Frontend Developers","Project Management Fundamentals"]'::jsonb,51),
('Manager Readiness Programme','Prepares individual contributors transitioning into first-time management roles.','Engineering Manager','["Leadership Essentials","Effective Communication in the Workplace","Financial Literacy for Managers","Prevention of Sexual Harassment & Respectful Workplace","Data Privacy & Secure Data Handling"]'::jsonb,31),
('Mandatory Compliance Bundle','Core compliance learning bundle. Individual course requirements depend on law, role, and organizational policy.','All Employees','["Information Security, Phishing & Account Protection","Prevention of Sexual Harassment & Respectful Workplace","Code of Conduct, Ethics & Acceptable Use","Data Privacy & Secure Data Handling"]'::jsonb,9),
('Finance Fundamentals Track','Core finance knowledge for non-finance business stakeholders.','Operations / Product','["Financial Literacy for Managers","Advanced Excel & Data Analysis"]'::jsonb,16),
('Customer Success Excellence','Equips CS team members with tools, frameworks and soft skills.','Customer Success Manager','["Customer Success & Service Excellence","Effective Communication in the Workplace","Mental Health & Wellbeing at Work"]'::jsonb,18)
ON CONFLICT (lower(name)) DO UPDATE SET
  description    = EXCLUDED.description,
  target_role    = EXCLUDED.target_role,
  courses        = EXCLUDED.courses,
  estimated_hours= EXCLUDED.estimated_hours;

-- ============================================================
-- 16. KNOWLEDGE ARTICLES
-- ============================================================

INSERT INTO knowledge_articles (title, content, category, author_name, tags, status, is_featured) VALUES
('How to Apply for Leave','## Applying for Leave\n\n1. Log in to the portal and navigate to **Employee Dashboard → My Leaves**.\n2. Click **Apply Leave**.\n3. Select the leave type, date range, and enter a reason.\n4. Click **Submit**. Your manager will receive an approval request.\n\n**Leave balances** are visible on the same screen. Annual Leave carries forward up to 6 days.\n\nFor urgent medical leave, inform your manager by phone/WhatsApp first and then apply retrospectively.','HR Policies','HR Team','["leave","hr","how-to"]'::jsonb,'Published',TRUE),
('IT Support — How to Raise a Ticket','## Raising an IT Support Ticket\n\n1. Go to **IT Services** from the Launchpad.\n2. Click **New Ticket**.\n3. Select the **Category** and **Priority**.\n4. Describe the issue clearly and submit.\n\n**SLA targets:**\n| Priority | Resolution Target |\n|---|---|\n| Critical | 4 hours |\n| High | 8 hours |\n| Medium | 24 hours |\n| Low | 72 hours |','IT & Infrastructure','IT Team','["it","support","tickets","how-to"]'::jsonb,'Published',TRUE),
('Expense Reimbursement Policy','## Expense Reimbursement\n\nAll business expenses must be pre-approved by your manager except travel booked through the corporate travel tool.\n\n**Eligible expenses:**\n- Client entertainment (up to ₹2,000 per person)\n- Business travel within policy limits\n- Team meals approved by department head\n- Professional certifications (pre-approved only)\n\n**Process:**\n1. Collect GST invoices for all expenses.\n2. Submit via the Finance portal within 30 days.\n3. Reimbursement is processed with the next payroll cycle.','Finance & Payroll','Finance Team','["expense","finance","policy","reimbursement"]'::jsonb,'Published',TRUE),
('Performance Review Process','## Quarterly Performance Reviews\n\nReviews run in the last two weeks of each quarter.\n\n**Steps:**\n1. **Self Assessment** — complete within 7 days of the review period opening.\n2. **Manager Review** — your manager rates goals and competencies.\n3. **HR Sign-off** — HR finalises and locks the review.\n4. **Acknowledgement** — you acknowledge the review in the portal.\n\n**Rating Scale:**\n- 5 — Outstanding\n- 4 — Exceeds Expectations\n- 3 — Meets Expectations\n- 2 — Below Expectations\n- 1 — Needs Improvement','HR Policies','HR Team','["performance","review","hr","policy"]'::jsonb,'Published',TRUE),
('Onboarding Checklist — First Week','## Your First Week at Jeshan Labs\n\n**Day 1:** Collect laptop, complete HR docs, attend orientation, set up email & portal access.\n\n**Days 2–3:** Meet buddy and team, complete mandatory compliance training, review department OKRs.\n\n**Days 4–5:** Shadow team, 1:1 with manager, review Knowledge Base documentation.\n\nYour onboarding tasks are tracked in the **Onboarding Portal**.','Onboarding','HR Team','["onboarding","first-week","checklist","new-joiners"]'::jsonb,'Published',TRUE),
('Payroll & Payslip Guide','## Understanding Your Payslip\n\nYour payslip is available every month in the **Payroll** module.\n\n**Earnings:** Basic Salary, HRA, Transport Allowance, Medical Allowance, Special Allowance.\n\n**Deductions:** PF (12% of Basic), ESI (0.75% if gross ≤ ₹21,000), Professional Tax, TDS.\n\n**Investment Declarations:** Submit proof via the portal by 31st January each year to avoid excess TDS.','Finance & Payroll','Finance Team','["payroll","payslip","salary","deductions","pf","esi"]'::jsonb,'Published',TRUE),
('IT Security — Password & MFA Policy','## Password & MFA Requirements\n\n**Password Policy:** Minimum 12 characters, must include uppercase, lowercase, digit, and special character. Changed every 90 days, no reuse of last 10 passwords.\n\n**MFA:** Mandatory for all portal and cloud access. Use Microsoft Authenticator or Google Authenticator.\n\n**Phishing:** Jeshan Labs will never ask for your password via email.\n\n**Incidents:** Report any suspected breach within 1 hour by raising a Critical IT ticket.','IT & Infrastructure','IT Team','["security","password","mfa","phishing","compliance"]'::jsonb,'Published',TRUE),
('OKR Writing Guide','## Writing Effective OKRs\n\n**Objective (O):** Qualitative, aspirational, time-bound.\n\n**Key Results (KR):** Measurable, specific outcomes.\n\n**Good vs Bad OKR:**\n| Bad | Good |\n|---|---|\n| Improve customer satisfaction | Increase NPS from 42 to 60 by Q4 |\n| Grow revenue | Close ₹2Cr in new ARR in Q3 |\n\n**Tips:** 3–5 KRs per Objective. Update progress weekly. OKRs cascade: Company → Department → Team → Individual.','Operations','HR Team','["okr","goals","performance","how-to"]'::jsonb,'Published',FALSE),
('Asset Request & Return Process','## Requesting a Company Asset\n\n1. Raise an IT ticket: category **Hardware**, describe the asset needed.\n2. IT will assign from available inventory within 2 business days.\n3. Acknowledge receipt in the **Asset Management** portal.\n\n## Returning an Asset\n\nReturn on or before your last working day.\n1. Raise an IT ticket to inform IT of return intent.\n2. IT inspects and updates asset condition.\n3. IT issues a return receipt.','IT & Infrastructure','IT Team','["assets","it","hardware","return","request"]'::jsonb,'Published',FALSE)
ON CONFLICT (lower(title)) DO UPDATE SET
  content    = EXCLUDED.content,
  category   = EXCLUDED.category,
  tags       = EXCLUDED.tags,
  status     = EXCLUDED.status,
  is_featured= EXCLUDED.is_featured;

-- ============================================================
-- DONE — every table uses ON CONFLICT (...) DO UPDATE SET ...
-- Re-running this script will UPDATE existing rows and INSERT
-- new ones. No duplicates will ever be created.
-- ============================================================


-- ── Part 3: Supplemental master data ───────────────────────

-- ============================================================

-- ============================================================
-- 1. ADDITIONAL LEARNING PATHS
-- ============================================================

INSERT INTO learning_paths (name, description, target_role, courses, estimated_hours) VALUES
('Sales Excellence Programme','Core skills for sales reps and BDEs to accelerate pipeline.','Sales Executive','["Customer Success & Service Excellence","Effective Communication in the Workplace","Mental Health & Wellbeing at Work"]'::jsonb,18),
('DevOps & Cloud Track','Cloud-native operations for DevOps and SRE engineers.','DevOps Engineer','["Public Cloud Fundamentals (AWS)","Project Management Fundamentals","Information Security, Phishing & Account Protection"]'::jsonb,24),
('New Manager Onboarding','All-round preparation for a first-time people manager.','Engineering Manager','["Leadership Essentials","Effective Communication in the Workplace","Financial Literacy for Managers","Data Privacy & Secure Data Handling","Prevention of Sexual Harassment & Respectful Workplace"]'::jsonb,31),
('Annual Compliance Refresh','Annual compliance refresh; mandatory status is determined per course, role, and applicable law.','All Employees','["Information Security, Phishing & Account Protection","Prevention of Sexual Harassment & Respectful Workplace","Code of Conduct, Ethics & Acceptable Use","Data Privacy & Secure Data Handling"]'::jsonb,9)
ON CONFLICT (lower(name)) DO UPDATE SET
  description     = EXCLUDED.description,
  target_role     = EXCLUDED.target_role,
  courses         = EXCLUDED.courses,
  estimated_hours = EXCLUDED.estimated_hours;

-- ============================================================
-- 2. ADDITIONAL EMAIL TEMPLATES
-- ============================================================

INSERT INTO email_templates (name, subject, body, category, variables) VALUES
('OKR Check-in Reminder',
 'OKR Check-in Due — {{period}}',
 'Dear {{employee_name}},

This is a reminder that your OKR check-in for {{period}} is due by {{deadline}}.

Please log in to the OKR module and update progress on your Key Results.

Regards, HR & Strategy Team',
 'Performance',
 '["employee_name","period","deadline"]'::jsonb),

('Asset Assignment Notification',
 'Asset Assigned to You — {{asset_name}}',
 'Dear {{employee_name}},

A company asset has been assigned to you:

Asset: {{asset_name}}
Asset Tag: {{asset_tag}}
Assigned By: {{assigned_by}}

Please confirm receipt in the Asset Management portal.

IT Team',
 'IT',
 '["employee_name","asset_name","asset_tag","assigned_by"]'::jsonb),

('LinkedIn Post Scheduled',
 'LinkedIn Post Scheduled — {{scheduled_date}}',
 'Dear {{author_name}},

Your LinkedIn post has been scheduled for {{scheduled_date}}.

Preview: {{post_preview}}

Log in to the LinkedIn Manager to make any last-minute edits before it goes live.

Marketing Team',
 'Marketing',
 '["author_name","scheduled_date","post_preview"]'::jsonb),

('Contract Expiry Notice',
 'Contract Expiry Notice — {{employee_name}} ({{expiry_date}})',
 'Dear {{manager_name}},

This is a reminder that the contract for {{employee_name}} ({{designation}}) is due to expire on {{expiry_date}}.

Please initiate the renewal or offboarding process at least 30 days before the expiry date.

HR Team',
 'HR',
 '["manager_name","employee_name","designation","expiry_date"]'::jsonb),

('Survey Invitation',
 'Your Feedback Matters — {{survey_name}}',
 'Dear {{employee_name}},

You have been invited to participate in: {{survey_name}}

Deadline: {{deadline}}
Estimated time: {{duration}} minutes

Your responses are {{anonymity_note}}.

{{survey_link}}

HR Team',
 'HR',
 '["employee_name","survey_name","deadline","duration","anonymity_note","survey_link"]'::jsonb)

ON CONFLICT (lower(name)) DO UPDATE SET
  subject   = EXCLUDED.subject,
  body      = EXCLUDED.body,
  category  = EXCLUDED.category,
  variables = EXCLUDED.variables;

-- ============================================================
-- 3. ADDITIONAL KNOWLEDGE ARTICLES
-- ============================================================

INSERT INTO knowledge_articles (title, content, category, author_name, tags, status, is_featured) VALUES
('Company Travel Policy',
 '## Business Travel Policy

**Approval:** All travel must be pre-approved by your manager. International travel requires VP sign-off.

**Booking:**
- Book via the approved travel tool at least 5 business days in advance.
- Economy class for flights < 5 hours. Business class requires Finance Director approval.

**Per Diems (India):**
| City Tier | Daily Allowance |
|---|---|
| Metro (Mumbai/Delhi/BLR) | ₹3,000 |
| Tier 2 | ₹2,000 |
| Tier 3 | ₹1,500 |

**Reimbursement:** Submit receipts within 15 days of return via the Finance portal.',
 'Finance & Payroll', 'Finance Team', '["travel","policy","expense","finance"]'::jsonb, 'Published', FALSE),

('Work From Home Policy',
 '## Work From Home (WFH) Guidelines

**Eligibility:** Permanent full-time employees after 3 months. Interns and contractors are office-based unless otherwise approved.

**Approval:** Apply for WFH days via the Leave portal. Ad-hoc WFH (same-day) must be approved by your manager on WhatsApp or email and retrospectively filed.

**Expectations while WFH:**
- Be online and responsive on Slack during core hours (10 AM – 6 PM IST).
- Join all scheduled video calls with camera on.
- Secure your workspace — no confidential data on shared screens.

**Maximum WFH Days:** Up to 3 days per week for eligible employees. Subject to team and project requirements.',
 'HR Policies', 'HR Team', '["wfh","remote","policy","hr"]'::jsonb, 'Published', TRUE),

('How to Use the OKR Module',
 '## Setting and Tracking OKRs

**Step 1 — Create an Objective:** Go to OKR → My OKRs → + New Objective. Pick the period and write an aspirational statement.

**Step 2 — Add Key Results:** Each KR needs a measurable target, unit (%, INR, number, boolean), and a baseline.

**Step 3 — Align:** Link your Objective to a department or company Objective above it.

**Step 4 — Check-in:** Update KR progress weekly. Add confidence (On Track / At Risk / Behind) and a comment.

**Scoring:** Progress is auto-calculated from KR actuals vs targets. 0.7–1.0 = Green, 0.4–0.69 = Amber, <0.4 = Red.',
 'Operations', 'HR Team', '["okr","goals","how-to","performance"]'::jsonb, 'Published', FALSE),

('Invoice & Billing Process',
 '## Raising an Invoice

1. Go to **Invoices → New Invoice**.
2. Select the client, billing address, and payment terms.
3. Add line items (service, quantity, rate, unit, tax type).
4. Review the total — GST is auto-computed based on type.
5. Save as Draft or Send directly to the client.

**Payment Follow-up:**
- An automatic reminder is sent 3 days before the due date.
- Overdue invoices are flagged in the Finance Dashboard.

**Tax Codes:**
- GST 18% for IT services (most common)
- Zero-rated for export/SEZ clients (provide LUT copy)',
 'Finance & Payroll', 'Finance Team', '["invoices","billing","finance","gst","how-to"]'::jsonb, 'Published', FALSE),

('Onboarding FAQ — New Joiner',
 '## Frequently Asked Questions — New Joiners

**Q: When will I get my laptop?**
IT provisions your laptop on Day 1. Raise an IT ticket if it is not ready.

**Q: How do I submit my investment declaration?**
Go to Payroll → Tax Declaration. Submit by 31st January to avoid excess TDS.

**Q: Who is my buddy?**
Your buddy is assigned in the Onboarding portal. Reach out proactively — they are there to help.

**Q: How do I apply for leave in the first month?**
You can apply for leave from Day 1. Leave credits are prorated for your first month.

**Q: What is the probation period?**
Standard probation is 3 months (6 months for senior roles). Your manager will confirm at the end of the period.',
 'Onboarding', 'HR Team', '["onboarding","faq","new-joiners","hr"]'::jsonb, 'Published', TRUE),

('Recruitment Process for Hiring Managers',
 '## Hiring Manager Guide — Recruitment Portal

**Step 1 — Raise a Job Opening:** Go to Recruitment → Job Openings → + New Opening. Fill in title, department, JD, and approval details.

**Step 2 — Shortlisting:** Candidates appear in the pipeline. Move them through stages (Applied → Screening → Interview → Offer).

**Step 3 — Interview Scheduling:** Use Recruitment → Interviews → Schedule. Specify type (Technical / HR), panel, date and time.

**Step 4 — Feedback:** Submit interview feedback within 24 hours — rating, recommendation (Hire / Maybe / Reject), and comments.

**Step 5 — Offer Approval:** Once you decide to hire, raise an Offer from the candidate profile. It goes to HR and Finance for approval before being sent.',
 'HR Policies', 'HR Team', '["recruitment","hiring-manager","how-to","hr"]'::jsonb, 'Published', FALSE)

ON CONFLICT (lower(title)) DO UPDATE SET
  content    = EXCLUDED.content,
  category   = EXCLUDED.category,
  tags       = EXCLUDED.tags,
  status     = EXCLUDED.status,
  is_featured= EXCLUDED.is_featured;

-- ============================================================
-- 4. ADDITIONAL MASTER VALUE HELPS (gaps not in main seed)
-- ============================================================

INSERT INTO master_value_helps (entity, field, label, value, sort_order, is_active) VALUES
-- Advanced Analytics / Executive Dashboard
('analytics','period','Last 7 Days','7d',1,TRUE),
('analytics','period','Last 30 Days','30d',2,TRUE),
('analytics','period','Last 90 Days','90d',3,TRUE),
('analytics','period','This Quarter','quarter',4,TRUE),
('analytics','period','This Year','year',5,TRUE),
('analytics','period','Custom Range','custom',6,TRUE),
('analytics','metric_type','Headcount','headcount',1,TRUE),
('analytics','metric_type','Attrition Rate','attrition',2,TRUE),
('analytics','metric_type','Offer Acceptance','offer_acceptance',3,TRUE),
('analytics','metric_type','Training Completion','training_completion',4,TRUE),
('analytics','metric_type','Payroll Cost','payroll_cost',5,TRUE),
('analytics','metric_type','Revenue per Employee','rev_per_emp',6,TRUE),
('analytics','metric_type','Average Tenure','avg_tenure',7,TRUE),
('analytics','metric_type','NPS Score','nps',8,TRUE),
-- AI Intelligence
('ai','request_type','Generate Job Description','jd_gen',1,TRUE),
('ai','request_type','Summarise CV','cv_summary',2,TRUE),
('ai','request_type','Draft Email','email_draft',3,TRUE),
('ai','request_type','Write LinkedIn Post','linkedin_post',4,TRUE),
('ai','request_type','Write Knowledge Article','kb_article',5,TRUE),
('ai','request_type','Analyse Performance Data','perf_analysis',6,TRUE),
('ai','request_type','Generate OKR Suggestions','okr_suggest',7,TRUE),
('ai','request_type','Draft PIP Template','pip_draft',8,TRUE),
('ai','model','GPT-4o','gpt-4o',1,TRUE),
('ai','model','Claude 3.5 Sonnet','claude-3-5-sonnet',2,TRUE),
('ai','model','Gemini 1.5 Pro','gemini-1-5-pro',3,TRUE),
-- Collaboration Hub
('collaboration','space_type','Team Space','team',1,TRUE),
('collaboration','space_type','Project Space','project',2,TRUE),
('collaboration','space_type','Department Space','department',3,TRUE),
('collaboration','space_type','Cross-functional','cross_func',4,TRUE),
('collaboration','meeting_type','Stand-up','standup',1,TRUE),
('collaboration','meeting_type','Sprint Planning','sprint_plan',2,TRUE),
('collaboration','meeting_type','Retrospective','retro',3,TRUE),
('collaboration','meeting_type','1:1','one_on_one',4,TRUE),
('collaboration','meeting_type','All-hands','allhands',5,TRUE),
('collaboration','meeting_type','Client Call','client_call',6,TRUE),
('collaboration','meeting_type','Workshop','workshop',7,TRUE),
('collaboration','meeting_status','Scheduled','scheduled',1,TRUE),
('collaboration','meeting_status','In Progress','in_progress',2,TRUE),
('collaboration','meeting_status','Completed','completed',3,TRUE),
('collaboration','meeting_status','Cancelled','cancelled',4,TRUE),
-- Advanced features (experimental)
('advanced','feature_flag','AI Resume Parser','ai_cv_parse',1,TRUE),
('advanced','feature_flag','Payroll Anomaly Detection','payroll_anomaly',2,TRUE),
('advanced','feature_flag','Predictive Attrition','predict_attrition',3,TRUE),
('advanced','feature_flag','Auto JD Generator','auto_jd',4,TRUE),
('advanced','feature_flag','Smart Leave Forecasting','leave_forecast',5,TRUE),
('advanced','feature_flag','Dynamic Compensation Benchmarking','comp_bench',6,TRUE),
-- Survey
('survey','status','Draft','Draft',1,TRUE),
('survey','status','Active','Active',2,TRUE),
('survey','status','Closed','Closed',3,TRUE),
('survey','status','Archived','Archived',4,TRUE),
('survey','question_type','Rating (1-5)','rating_5',1,TRUE),
('survey','question_type','Rating (1-10)','rating_10',2,TRUE),
('survey','question_type','Single Choice','single_choice',3,TRUE),
('survey','question_type','Multiple Choice','multi_choice',4,TRUE),
('survey','question_type','Short Text','short_text',5,TRUE),
('survey','question_type','Long Text','long_text',6,TRUE),
('survey','question_type','Yes / No','yes_no',7,TRUE),
('survey','question_type','NPS (0-10)','nps',8,TRUE),
('survey','category','Employee Satisfaction','satisfaction',1,TRUE),
('survey','category','Pulse Check','pulse',2,TRUE),
('survey','category','Exit Interview','exit',3,TRUE),
('survey','category','Onboarding Feedback','onboarding',4,TRUE),
('survey','category','Manager Effectiveness','manager',5,TRUE),
('survey','category','Training Feedback','training',6,TRUE),
('survey','category','Benefits & Perks','benefits',7,TRUE),
-- Expense (if expense module is planned)
('expense','category','Travel','Travel',1,TRUE),
('expense','category','Accommodation','Accommodation',2,TRUE),
('expense','category','Client Entertainment','Entertainment',3,TRUE),
('expense','category','Team Meals','Team Meals',4,TRUE),
('expense','category','Professional Development','Learning',5,TRUE),
('expense','category','Office Supplies','Office',6,TRUE),
('expense','category','Software / Subscriptions','Software',7,TRUE),
('expense','category','Other','Other',8,TRUE),
('expense','status','Draft','Draft',1,TRUE),
('expense','status','Submitted','Submitted',2,TRUE),
('expense','status','Approved','Approved',3,TRUE),
('expense','status','Rejected','Rejected',4,TRUE),
('expense','status','Paid','Paid',5,TRUE)
ON CONFLICT (entity, field, value) DO UPDATE SET
  label      = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_active  = EXCLUDED.is_active;

-- ============================================================
-- DONE — all inserts are idempotent.
-- ============================================================


-- ============================================================
-- SECTION: VALUE HELPS EXTENSIONS
-- ============================================================

-- ============================================================
-- VALUE HELPS EXTENSIONS
-- Missing dropdown values not covered by 02_seed.sql
-- All statements are idempotent (ON CONFLICT DO UPDATE)
-- ============================================================

INSERT INTO master_value_helps (entity, field, label, value, sort_order, is_active) VALUES
-- ── Employment types (shared by onboarding, recruitment, directory) ──────────
('employee','employment_type','Full-time','Full-time',1,TRUE),
('employee','employment_type','Part-time','Part-time',2,TRUE),
('employee','employment_type','Contract','Contract',3,TRUE),
('employee','employment_type','Internship','Internship',4,TRUE),
('employee','employment_type','Freelance','Freelance',5,TRUE),

-- ── Work mode (shared by onboarding, recruitment) ────────────────────────────
('employee','work_mode','On-site','On-site',1,TRUE),
('employee','work_mode','Remote','Remote',2,TRUE),
('employee','work_mode','Hybrid','Hybrid',3,TRUE),

-- ── Employee document types (EmployeeDirectoryEnhanced) ──────────────────────
('employee','document_type','ID Proof','ID Proof',1,TRUE),
('employee','document_type','Educational Certificate','Educational Certificate',2,TRUE),
('employee','document_type','Experience Letter','Experience Letter',3,TRUE),
('employee','document_type','Offer Letter','Offer Letter',4,TRUE),
('employee','document_type','NDA','NDA',5,TRUE),
('employee','document_type','Appraisal Letter','Appraisal',6,TRUE),
('employee','document_type','Medical Certificate','Medical',7,TRUE),
('employee','document_type','Other','Other',8,TRUE),

-- ── Nationalities (onboarding + recruitment forms) ───────────────────────────
('employee','nationality','Afghan','Afghan',1,TRUE),
('employee','nationality','Albanian','Albanian',2,TRUE),
('employee','nationality','Algerian','Algerian',3,TRUE),
('employee','nationality','American','American',4,TRUE),
('employee','nationality','Andorran','Andorran',5,TRUE),
('employee','nationality','Angolan','Angolan',6,TRUE),
('employee','nationality','Argentinian','Argentinian',7,TRUE),
('employee','nationality','Armenian','Armenian',8,TRUE),
('employee','nationality','Australian','Australian',9,TRUE),
('employee','nationality','Austrian','Austrian',10,TRUE),
('employee','nationality','Azerbaijani','Azerbaijani',11,TRUE),
('employee','nationality','Bahamian','Bahamian',12,TRUE),
('employee','nationality','Bahraini','Bahraini',13,TRUE),
('employee','nationality','Bangladeshi','Bangladeshi',14,TRUE),
('employee','nationality','Barbadian','Barbadian',15,TRUE),
('employee','nationality','Belarusian','Belarusian',16,TRUE),
('employee','nationality','Belgian','Belgian',17,TRUE),
('employee','nationality','Belizean','Belizean',18,TRUE),
('employee','nationality','Beninese','Beninese',19,TRUE),
('employee','nationality','Bhutanese','Bhutanese',20,TRUE),
('employee','nationality','Bolivian','Bolivian',21,TRUE),
('employee','nationality','Bosnian','Bosnian',22,TRUE),
('employee','nationality','Brazilian','Brazilian',23,TRUE),
('employee','nationality','British','British',24,TRUE),
('employee','nationality','Bruneian','Bruneian',25,TRUE),
('employee','nationality','Bulgarian','Bulgarian',26,TRUE),
('employee','nationality','Burkinabe','Burkinabe',27,TRUE),
('employee','nationality','Burmese','Burmese',28,TRUE),
('employee','nationality','Burundian','Burundian',29,TRUE),
('employee','nationality','Cambodian','Cambodian',30,TRUE),
('employee','nationality','Cameroonian','Cameroonian',31,TRUE),
('employee','nationality','Canadian','Canadian',32,TRUE),
('employee','nationality','Cape Verdean','Cape Verdean',33,TRUE),
('employee','nationality','Chilean','Chilean',34,TRUE),
('employee','nationality','Chinese','Chinese',35,TRUE),
('employee','nationality','Colombian','Colombian',36,TRUE),
('employee','nationality','Congolese','Congolese',37,TRUE),
('employee','nationality','Costa Rican','Costa Rican',38,TRUE),
('employee','nationality','Croatian','Croatian',39,TRUE),
('employee','nationality','Cuban','Cuban',40,TRUE),
('employee','nationality','Cypriot','Cypriot',41,TRUE),
('employee','nationality','Czech','Czech',42,TRUE),
('employee','nationality','Danish','Danish',43,TRUE),
('employee','nationality','Djiboutian','Djiboutian',44,TRUE),
('employee','nationality','Dominican','Dominican',45,TRUE),
('employee','nationality','Dutch','Dutch',46,TRUE),
('employee','nationality','Ecuadorian','Ecuadorian',47,TRUE),
('employee','nationality','Egyptian','Egyptian',48,TRUE),
('employee','nationality','Emirati','Emirati',49,TRUE),
('employee','nationality','Eritrean','Eritrean',50,TRUE),
('employee','nationality','Estonian','Estonian',51,TRUE),
('employee','nationality','Ethiopian','Ethiopian',52,TRUE),
('employee','nationality','Fijian','Fijian',53,TRUE),
('employee','nationality','Finnish','Finnish',54,TRUE),
('employee','nationality','French','French',55,TRUE),
('employee','nationality','Gabonese','Gabonese',56,TRUE),
('employee','nationality','Gambian','Gambian',57,TRUE),
('employee','nationality','Georgian','Georgian',58,TRUE),
('employee','nationality','German','German',59,TRUE),
('employee','nationality','Ghanaian','Ghanaian',60,TRUE),
('employee','nationality','Greek','Greek',61,TRUE),
('employee','nationality','Grenadian','Grenadian',62,TRUE),
('employee','nationality','Guatemalan','Guatemalan',63,TRUE),
('employee','nationality','Guinean','Guinean',64,TRUE),
('employee','nationality','Guyanese','Guyanese',65,TRUE),
('employee','nationality','Haitian','Haitian',66,TRUE),
('employee','nationality','Honduran','Honduran',67,TRUE),
('employee','nationality','Hungarian','Hungarian',68,TRUE),
('employee','nationality','Icelandic','Icelandic',69,TRUE),
('employee','nationality','Indian','Indian',70,TRUE),
('employee','nationality','Indonesian','Indonesian',71,TRUE),
('employee','nationality','Iranian','Iranian',72,TRUE),
('employee','nationality','Iraqi','Iraqi',73,TRUE),
('employee','nationality','Irish','Irish',74,TRUE),
('employee','nationality','Israeli','Israeli',75,TRUE),
('employee','nationality','Italian','Italian',76,TRUE),
('employee','nationality','Ivorian','Ivorian',77,TRUE),
('employee','nationality','Jamaican','Jamaican',78,TRUE),
('employee','nationality','Japanese','Japanese',79,TRUE),
('employee','nationality','Jordanian','Jordanian',80,TRUE),
('employee','nationality','Kazakhstani','Kazakhstani',81,TRUE),
('employee','nationality','Kenyan','Kenyan',82,TRUE),
('employee','nationality','Kuwaiti','Kuwaiti',83,TRUE),
('employee','nationality','Kyrgyz','Kyrgyz',84,TRUE),
('employee','nationality','Laotian','Laotian',85,TRUE),
('employee','nationality','Latvian','Latvian',86,TRUE),
('employee','nationality','Lebanese','Lebanese',87,TRUE),
('employee','nationality','Liberian','Liberian',88,TRUE),
('employee','nationality','Libyan','Libyan',89,TRUE),
('employee','nationality','Lithuanian','Lithuanian',90,TRUE),
('employee','nationality','Luxembourgish','Luxembourgish',91,TRUE),
('employee','nationality','Macedonian','Macedonian',92,TRUE),
('employee','nationality','Malagasy','Malagasy',93,TRUE),
('employee','nationality','Malawian','Malawian',94,TRUE),
('employee','nationality','Malaysian','Malaysian',95,TRUE),
('employee','nationality','Maldivian','Maldivian',96,TRUE),
('employee','nationality','Malian','Malian',97,TRUE),
('employee','nationality','Maltese','Maltese',98,TRUE),
('employee','nationality','Mauritanian','Mauritanian',99,TRUE),
('employee','nationality','Mauritian','Mauritian',100,TRUE),
('employee','nationality','Mexican','Mexican',101,TRUE),
('employee','nationality','Moldovan','Moldovan',102,TRUE),
('employee','nationality','Mongolian','Mongolian',103,TRUE),
('employee','nationality','Montenegrin','Montenegrin',104,TRUE),
('employee','nationality','Moroccan','Moroccan',105,TRUE),
('employee','nationality','Mozambican','Mozambican',106,TRUE),
('employee','nationality','Namibian','Namibian',107,TRUE),
('employee','nationality','Nepalese','Nepalese',108,TRUE),
('employee','nationality','New Zealander','New Zealander',109,TRUE),
('employee','nationality','Nicaraguan','Nicaraguan',110,TRUE),
('employee','nationality','Nigerian','Nigerian',111,TRUE),
('employee','nationality','Norwegian','Norwegian',112,TRUE),
('employee','nationality','Omani','Omani',113,TRUE),
('employee','nationality','Pakistani','Pakistani',114,TRUE),
('employee','nationality','Panamanian','Panamanian',115,TRUE),
('employee','nationality','Paraguayan','Paraguayan',116,TRUE),
('employee','nationality','Peruvian','Peruvian',117,TRUE),
('employee','nationality','Filipino','Filipino',118,TRUE),
('employee','nationality','Polish','Polish',119,TRUE),
('employee','nationality','Portuguese','Portuguese',120,TRUE),
('employee','nationality','Qatari','Qatari',121,TRUE),
('employee','nationality','Romanian','Romanian',122,TRUE),
('employee','nationality','Russian','Russian',123,TRUE),
('employee','nationality','Rwandan','Rwandan',124,TRUE),
('employee','nationality','Saudi','Saudi',125,TRUE),
('employee','nationality','Senegalese','Senegalese',126,TRUE),
('employee','nationality','Serbian','Serbian',127,TRUE),
('employee','nationality','Sierra Leonean','Sierra Leonean',128,TRUE),
('employee','nationality','Singaporean','Singaporean',129,TRUE),
('employee','nationality','Slovak','Slovak',130,TRUE),
('employee','nationality','Slovenian','Slovenian',131,TRUE),
('employee','nationality','Somali','Somali',132,TRUE),
('employee','nationality','South African','South African',133,TRUE),
('employee','nationality','South Korean','South Korean',134,TRUE),
('employee','nationality','Spanish','Spanish',135,TRUE),
('employee','nationality','Sri Lankan','Sri Lankan',136,TRUE),
('employee','nationality','Sudanese','Sudanese',137,TRUE),
('employee','nationality','Swedish','Swedish',138,TRUE),
('employee','nationality','Swiss','Swiss',139,TRUE),
('employee','nationality','Syrian','Syrian',140,TRUE),
('employee','nationality','Taiwanese','Taiwanese',141,TRUE),
('employee','nationality','Tajik','Tajik',142,TRUE),
('employee','nationality','Tanzanian','Tanzanian',143,TRUE),
('employee','nationality','Thai','Thai',144,TRUE),
('employee','nationality','Togolese','Togolese',145,TRUE),
('employee','nationality','Trinidadian','Trinidadian',146,TRUE),
('employee','nationality','Tunisian','Tunisian',147,TRUE),
('employee','nationality','Turkish','Turkish',148,TRUE),
('employee','nationality','Turkmen','Turkmen',149,TRUE),
('employee','nationality','Ugandan','Ugandan',150,TRUE),
('employee','nationality','Ukrainian','Ukrainian',151,TRUE),
('employee','nationality','Uruguayan','Uruguayan',152,TRUE),
('employee','nationality','Uzbek','Uzbek',153,TRUE),
('employee','nationality','Venezuelan','Venezuelan',154,TRUE),
('employee','nationality','Vietnamese','Vietnamese',155,TRUE),
('employee','nationality','Yemeni','Yemeni',156,TRUE),
('employee','nationality','Zambian','Zambian',157,TRUE),
('employee','nationality','Zimbabwean','Zimbabwean',158,TRUE),

-- ── Onboarding source ─────────────────────────────────────────────────────────
('onboarding','source','Direct Hire','Direct',1,TRUE),
('onboarding','source','From Recruitment','Recruitment',2,TRUE),
('onboarding','source','Referral','Referral',3,TRUE),
('onboarding','source','Bulk Upload','Bulk Upload',4,TRUE),
('onboarding','source','Other','Other',5,TRUE),

-- ── Recruitment: interview duration + work mode ───────────────────────────────
('recruitment','interview_duration','30 min','30 min',1,TRUE),
('recruitment','interview_duration','45 min','45 min',2,TRUE),
('recruitment','interview_duration','60 min','60 min',3,TRUE),
('recruitment','interview_duration','90 min','90 min',4,TRUE),
('recruitment','interview_duration','120 min','120 min',5,TRUE),
('recruitment','work_mode','On-site','On-site',1,TRUE),
('recruitment','work_mode','Remote','Remote',2,TRUE),
('recruitment','work_mode','Hybrid','Hybrid',3,TRUE),
-- Add No-show to interview_status (was inline-only, conflicting with Rescheduled)
('recruitment','interview_status','No-show','No-show',5,TRUE),

-- ── User management ──────────────────────────────────────────────────────────
('user','status','Active','active',1,TRUE),
('user','status','Inactive','inactive',2,TRUE),
('user','status','Suspended','suspended',3,TRUE),
('user','role','Admin','admin',1,TRUE),
('user','role','HR','hr',2,TRUE),
('user','role','Manager','manager',3,TRUE),
('user','role','Employee','employee',4,TRUE),
('user','role','Finance','finance',5,TRUE),
('user','role','IT','it',6,TRUE),
('user','role','Marketing','marketing',7,TRUE),

-- ── Invoice: currency ─────────────────────────────────────────────────────────
('invoice','currency','Indian Rupee (INR)','INR',1,TRUE),
('invoice','currency','US Dollar (USD)','USD',2,TRUE),
('invoice','currency','Euro (EUR)','EUR',3,TRUE),
('invoice','currency','British Pound (GBP)','GBP',4,TRUE),
('invoice','currency','UAE Dirham (AED)','AED',5,TRUE),
('invoice','currency','Singapore Dollar (SGD)','SGD',6,TRUE),
('invoice','currency','Australian Dollar (AUD)','AUD',7,TRUE),

-- ── Holiday types ─────────────────────────────────────────────────────────────
('holiday','type','National','national',1,TRUE),
('holiday','type','Regional','regional',2,TRUE),
('holiday','type','Optional / Restricted','optional',3,TRUE),

-- ── Performance: PIP review frequency ────────────────────────────────────────
('performance','pip_review_frequency','Weekly','Weekly',1,TRUE),
('performance','pip_review_frequency','Biweekly','Biweekly',2,TRUE),
('performance','pip_review_frequency','Monthly','Monthly',3,TRUE),

-- ── Master data form fields ───────────────────────────────────────────────────
('masterdata','industry','Technology','Technology',1,TRUE),
('masterdata','industry','Manufacturing','Manufacturing',2,TRUE),
('masterdata','industry','Healthcare','Healthcare',3,TRUE),
('masterdata','industry','Finance & Banking','Finance',4,TRUE),
('masterdata','industry','Retail & E-commerce','Retail',5,TRUE),
('masterdata','industry','Education','Education',6,TRUE),
('masterdata','industry','Consulting','Consulting',7,TRUE),
('masterdata','industry','Software & IT','Software',8,TRUE),
('masterdata','industry','Media & Entertainment','Media',9,TRUE),
('masterdata','industry','Logistics & Supply Chain','Logistics',10,TRUE),
('masterdata','industry','Automotive','Automotive',11,TRUE),
('masterdata','industry','Real Estate','Real Estate',12,TRUE),
('masterdata','industry','Other','Other',13,TRUE),

('masterdata','status','Active','active',1,TRUE),
('masterdata','status','Inactive','inactive',2,TRUE),
('masterdata','status','Pending','pending',3,TRUE),
('masterdata','status','Archived','archived',4,TRUE),

('masterdata','job_level','Intern','Intern',1,TRUE),
('masterdata','job_level','Entry-Level','Entry-Level',2,TRUE),
('masterdata','job_level','Mid-Level','Mid-Level',3,TRUE),
('masterdata','job_level','Senior','Senior',4,TRUE),
('masterdata','job_level','Lead','Lead',5,TRUE),
('masterdata','job_level','Principal','Principal',6,TRUE),
('masterdata','job_level','Manager','Manager',7,TRUE),
('masterdata','job_level','Director','Director',8,TRUE),
('masterdata','job_level','Executive / C-Suite','Executive',9,TRUE),

('masterdata','location_type','Headquarters','headquarters',1,TRUE),
('masterdata','location_type','Branch Office','branch',2,TRUE),
('masterdata','location_type','Remote','remote',3,TRUE),
('masterdata','location_type','Co-working Space','coworking',4,TRUE),
('masterdata','location_type','Warehouse','warehouse',5,TRUE),
('masterdata','location_type','Data Centre','datacenter',6,TRUE),

('masterdata','metric_category','Engineering','Engineering',1,TRUE),
('masterdata','metric_category','Customer Success','Customer Success',2,TRUE),
('masterdata','metric_category','Productivity','Productivity',3,TRUE),
('masterdata','metric_category','Quality','Quality',4,TRUE),
('masterdata','metric_category','Employee Engagement','Employee Engagement',5,TRUE),
('masterdata','metric_category','Financial','Financial',6,TRUE),
('masterdata','metric_category','Sales','Sales',7,TRUE),
('masterdata','metric_category','Operations','Operations',8,TRUE),

('masterdata','frequency','Real-time','Realtime',1,TRUE),
('masterdata','frequency','Daily','Daily',2,TRUE),
('masterdata','frequency','Weekly','Weekly',3,TRUE),
('masterdata','frequency','Bi-weekly','Bi-weekly',4,TRUE),
('masterdata','frequency','Monthly','Monthly',5,TRUE),
('masterdata','frequency','Quarterly','Quarterly',6,TRUE),
('masterdata','frequency','Annually','Annually',7,TRUE),

('masterdata','component_type','Fixed','Fixed',1,TRUE),
('masterdata','component_type','Variable','Variable',2,TRUE),
('masterdata','component_type','Bonus','Bonus',3,TRUE),
('masterdata','component_type','Allowance','Allowance',4,TRUE),
('masterdata','component_type','Deduction','Deduction',5,TRUE),

('masterdata','benefit_type','Medical Insurance','Medical',1,TRUE),
('masterdata','benefit_type','Dental Insurance','Dental',2,TRUE),
('masterdata','benefit_type','Vision Insurance','Vision',3,TRUE),
('masterdata','benefit_type','Retirement / PF','Retirement',4,TRUE),
('masterdata','benefit_type','Wellness Allowance','Wellness',5,TRUE),
('masterdata','benefit_type','Life Insurance','Life',6,TRUE),
('masterdata','benefit_type','Meal Vouchers','Meals',7,TRUE),
('masterdata','benefit_type','Other','Other',8,TRUE),

('masterdata','vendor_category','Hardware Supplier','hardware',1,TRUE),
('masterdata','vendor_category','Software Vendor','software',2,TRUE),
('masterdata','vendor_category','Service Provider','services',3,TRUE),
('masterdata','vendor_category','Consulting','consulting',4,TRUE),
('masterdata','vendor_category','Office Supplies','office-supplies',5,TRUE),
('masterdata','vendor_category','Cloud / SaaS','cloud',6,TRUE),
('masterdata','vendor_category','Facility Management','facility',7,TRUE),
('masterdata','vendor_category','Other','other',8,TRUE)

ON CONFLICT (entity, field, value) DO UPDATE SET
  label      = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_active  = EXCLUDED.is_active;

INSERT INTO defect_sla_policies
  (name, severity, first_response_mins, fix_mins, verification_mins, escalate_at_percent)
VALUES
  ('Very High (Blocker)',  'Very High', 60,   480,   120,  75),
  ('High (Critical)',      'High',      240,  1440,  240,  80),
  ('Medium (Major)',       'Medium',    480,  4320,  480,  80),
  ('Low (Minor)',          'Low',       1440, 10080, 1440, 85)
ON CONFLICT (severity) DO NOTHING;
INSERT INTO defect_resolution_codes (code, label, sort_order) VALUES
  ('fixed_in_code',    'Fixed in Code',     1),
  ('config_change',    'Config Change',      2),
  ('data_fix',         'Data Fix',           3),
  ('third_party_fix',  'Third-party Fix',    4),
  ('workaround',       'Workaround',         5),
  ('by_design',        'By Design',          6),
  ('cannot_reproduce', 'Cannot Reproduce',   7),
  ('duplicate',        'Duplicate',          8),
  ('deferred',         'Deferred',           9)
ON CONFLICT (code) DO NOTHING;
INSERT INTO defect_root_cause_categories (code, label, sort_order) VALUES
  ('code_logic',         'Code Logic',                1),
  ('missing_validation', 'Missing Validation',         2),
  ('env_config',         'Environment/Config',         3),
  ('db_data',            'DB/Data Issue',              4),
  ('third_party',        'Third-party Integration',    5),
  ('performance',        'Performance',                6),
  ('security',           'Security',                   7),
  ('ui_ux',              'UI/UX',                      8),
  ('requirements_gap',   'Requirements Gap',           9)
ON CONFLICT (code) DO NOTHING;
INSERT INTO defect_rejection_reasons (code, label) VALUES
  ('not_reproducible',   'Not Reproducible'),
  ('works_as_designed',  'Works as Designed'),
  ('duplicate',          'Duplicate'),
  ('out_of_scope',       'Out of Scope'),
  ('insufficient_info',  'Insufficient Info')
ON CONFLICT (code) DO NOTHING;
INSERT INTO defect_labels (code, label, color) VALUES
  ('regression',    'regression',    '#F97316'),
  ('performance',   'performance',   '#EAB308'),
  ('security',      'security',      '#EF4444'),
  ('data-loss',     'data-loss',     '#DC2626'),
  ('ux',            'ux',            '#8B5CF6'),
  ('accessibility', 'accessibility', '#06B6D4'),
  ('integration',   'integration',   '#10B981'),
  ('api',           'api',           '#3B82F6'),
  ('mobile',        'mobile',        '#F59E0B'),
  ('desktop',       'desktop',       '#64748B')
ON CONFLICT (code) DO NOTHING;
INSERT INTO defect_environments (name, sort_order) VALUES
  ('Production',  1),
  ('Staging',     2),
  ('UAT',         3),
  ('QA',          4),
  ('Development', 5),
  ('Performance', 6),
  ('DR',          7)
ON CONFLICT (name) DO NOTHING;
INSERT INTO defect_priorities (code, label, description, sort_order) VALUES
  ('P1', 'Critical', 'Immediate action required — system down or data loss',   1),
  ('P2', 'High',     'Must fix in current sprint — major business impact',      2),
  ('P3', 'Medium',   'Fix in upcoming sprint — moderate business impact',       3),
  ('P4', 'Low',      'Fix when convenient — minor inconvenience or cosmetic',   4)
ON CONFLICT (code) DO NOTHING;
UPDATE project_defects
SET status = 'Resolved',
    root_cause = COALESCE(NULLIF(BTRIM(root_cause), ''), 'Legacy / Unspecified'),
    resolution_code = COALESCE(NULLIF(BTRIM(resolution_code), ''), 'Legacy / Unspecified')
WHERE status = 'Fixed';
DELETE FROM defect_status_transitions
WHERE from_status IN ('Open','In Progress','Awaiting Info','Blocked','Fixed','Resolved','Verified','Deferred','Won''t Fix','Duplicate','Closed')
   OR to_status IN ('Open','In Progress','Awaiting Info','Blocked','Fixed','Resolved','Verified','Deferred','Won''t Fix','Duplicate','Closed');
DELETE FROM defect_statuses WHERE name = 'Fixed';
INSERT INTO defect_statuses (name, label, description, is_terminal, sort_order) VALUES
  ('Open',        'Open',        'Newly filed, not yet triaged',                      false, 1),
  ('In Progress', 'In Progress', 'Being actively worked on by assignee',              false, 2),
  ('Awaiting Info','Awaiting Info','Waiting for reporter information; SLA is paused',   false, 3),
  ('Blocked',     'Blocked',     'Work stopped due to dependency or external block',   false, 4),
  ('Resolved',    'Resolved',    'Resolution implemented, awaiting reporter verification', false, 5),
  ('Verified',    'Verified',    'Resolution confirmed by the reporter or QA team',    false, 6),
  ('Closed',      'Closed',      'Defect is permanently closed',                        true,  7),
  ('Deferred',    'Deferred',    'Intentionally deferred to a future sprint/release',  false, 8),
  ('Won''t Fix',  'Won''t Fix',  'Will not be fixed — by design, out of scope, etc.',  true,  9),
  ('Duplicate',   'Duplicate',   'A duplicate of an existing defect',                  true,  10)
ON CONFLICT (name) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  is_terminal = EXCLUDED.is_terminal,
  sort_order = EXCLUDED.sort_order;
INSERT INTO defect_status_transitions (from_status, to_status) VALUES
  ('Open',        'In Progress'),
  ('Open',        'Awaiting Info'),
  ('Open',        'Deferred'),
  ('Open',        'Won''t Fix'),
  ('Open',        'Duplicate'),
  ('In Progress', 'Blocked'),
  ('In Progress', 'Awaiting Info'),
  ('In Progress', 'Resolved'),
  ('In Progress', 'Won''t Fix'),
  ('Awaiting Info','In Progress'),
  ('Blocked',     'In Progress'),
  ('Blocked',     'Won''t Fix'),
  ('Resolved',    'Verified'),
  ('Resolved',    'In Progress'),
  ('Verified',    'Closed'),
  ('Deferred',    'Open'),
  ('Won''t Fix',  'Open'),
  ('Duplicate',   'Open')
ON CONFLICT (from_status, to_status) DO NOTHING;

INSERT INTO defect_escalation_rules
  (name, severity, condition, threshold, action, target_role, description, notification_message)
VALUES
  (
    'Very High unassigned escalation', 'Very High', 'unassigned_mins', 30, 'notify_team_lead', 'team_lead',
    'Notify team lead when a Very High defect is unassigned for 30+ minutes',
    'Very High defect {id} has been unassigned for over 30 minutes'
  ),
  (
    'Very High SLA at-risk escalation', 'Very High', 'sla_percent', 75, 'notify_manager', 'manager',
    'Notify manager when Very High SLA reaches 75% elapsed',
    'Very High defect {id} SLA is at 75% — action required'
  ),
  (
    'High SLA breach escalation', 'High', 'sla_percent', 100, 'notify_manager', 'manager',
    'Notify manager when High defect SLA is fully breached',
    'High defect {id} has breached its SLA target'
  ),
  (
    'Medium SLA breach escalation', 'Medium', 'sla_percent', 100, 'notify_team_lead', 'team_lead',
    'Notify team lead when Medium defect SLA is fully breached',
    'Medium defect {id} has breached its SLA target'
  ),
  (
    'Very High auto-escalate to PM', 'Very High', 'sla_percent', 90, 'notify_pm', 'manager',
    'Notify PM when Very High defect SLA reaches 90% elapsed',
    'Very High defect {id} SLA is at 90% — escalating to PM'
  )
ON CONFLICT DO NOTHING;

INSERT INTO pm_project_categories (category_id, name, description, default_methodology, color, sort_order) VALUES
  ('product_dev',    'Product Development',   'Building new products or features',          'Scrum',     '#6366F1', 1),
  ('it_infra',       'IT Infrastructure',     'Infrastructure and platform projects',        'Kanban',    '#0EA5E9', 2),
  ('biz_process',    'Business Process',      'Process improvement and automation',          'Hybrid',    '#10B981', 3),
  ('research',       'Research & Innovation', 'R&D and innovation projects',                 'Kanban',    '#8B5CF6', 4),
  ('compliance',     'Compliance',            'Regulatory and compliance initiatives',       'Waterfall', '#F59E0B', 5),
  ('marketing',      'Marketing',             'Marketing campaigns and brand projects',      'Kanban',    '#EC4899', 6),
  ('operations',     'Operations',            'Operational improvement projects',            'Hybrid',    '#14B8A6', 7),
  ('client_delivery','Client Delivery',       'Client-facing delivery projects',             'Scrum',     '#F97316', 8),
  ('internal_tools', 'Internal Tools',        'Internal tooling and productivity projects', 'Scrum',     '#6B7280', 9)
ON CONFLICT (category_id) DO NOTHING;

INSERT INTO pm_methodologies (methodology_id, name, description, has_sprints, sprint_length_days, story_points_enabled, sort_order) VALUES
  ('scrum',     'Scrum',     'Iterative development with sprints, daily standups, and ceremonies', TRUE,  14, TRUE,  1),
  ('kanban',    'Kanban',    'Continuous flow with WIP limits, no fixed sprint cadence',           FALSE, 14, FALSE, 2),
  ('safe',      'SAFe',      'Scaled Agile Framework for large teams and portfolios',              TRUE,  14, TRUE,  3),
  ('waterfall', 'Waterfall', 'Sequential phases: Requirements, Design, Build, Test, Deploy',       FALSE, 0,  FALSE, 4),
  ('hybrid',    'Hybrid',    'Combination of agile and traditional approaches, configurable',      TRUE,  14, TRUE,  5)
ON CONFLICT (methodology_id) DO NOTHING;

INSERT INTO pm_task_types (type_id, name, icon, color, sort_order) VALUES
  ('story',       'Story',       'book-open',     '#3B82F6', 1),
  ('bug',         'Bug',         'bug',           '#EF4444', 2),
  ('task',        'Task',        'check-circle',  '#6B7280', 3),
  ('epic',        'Epic',        'zap',           '#8B5CF6', 4),
  ('subtask',     'Sub-task',    'corner-down-right', '#9CA3AF', 5),
  ('spike',       'Spike',       'activity',      '#0D9488', 6),
  ('improvement', 'Improvement', 'trending-up',   '#F97316', 7)
ON CONFLICT (type_id) DO NOTHING;

INSERT INTO pm_story_point_scales (scale_id, name, values) VALUES
  ('fibonacci', 'Fibonacci', '[1,2,3,5,8,13,21]'),
  ('tshirt',    'T-Shirt',   '["XS","S","M","L","XL","XXL"]'),
  ('linear',    'Linear',    '[1,2,3,4,5,6,7,8,9,10]')
ON CONFLICT (scale_id) DO NOTHING;

INSERT INTO pm_risk_categories (category_id, name, description, sort_order) VALUES
  ('technical',  'Technical',        'Technology, architecture, infrastructure risks',     1),
  ('resource',   'Resource',         'Team availability, skills, attrition risks',         2),
  ('schedule',   'Schedule',         'Timeline, dependency, deadline risks',               3),
  ('scope',      'Scope',            'Requirements change, scope creep risks',             4),
  ('budget',     'Budget',           'Cost overrun, funding, financial risks',             5),
  ('external',   'External/Vendor',  'Third-party, vendor, external dependency risks',     6),
  ('compliance', 'Compliance',       'Regulatory, legal, policy compliance risks',         7)
ON CONFLICT (category_id) DO NOTHING;

INSERT INTO pm_budget_categories (category_id, name, sort_order) VALUES
  ('personnel',     'Personnel',           1),
  ('infrastructure','Infrastructure',      2),
  ('software',      'Software/Licenses',   3),
  ('travel',        'Travel',              4),
  ('training',      'Training',            5),
  ('contingency',   'Contingency',         6),
  ('other',         'Other',               7)
ON CONFLICT (category_id) DO NOTHING;

INSERT INTO pm_health_metrics (metric_id, name, calculation_rule, green_threshold, yellow_threshold, weight) VALUES
  ('schedule',  'Schedule',          'milestones_on_track / total_milestones * 100',      80, 60, 1.5),
  ('scope',     'Scope',             '(sprint_items_not_added_mid_sprint / total) * 100', 85, 70, 1.2),
  ('quality',   'Quality',           '1 - (defects_in_sprint / story_pts_completed)',     90, 75, 1.3),
  ('velocity',  'Velocity',          'current_velocity / avg_velocity * 100',             85, 65, 1.0),
  ('budget',    'Budget',            '1 - abs(pct_spent - pct_elapsed)',                  90, 75, 1.0)
ON CONFLICT (metric_id) DO NOTHING;
-- ------------------------------------------------------------
-- SOURCE: 02_hr_and_business.sql
-- ------------------------------------------------------------


INSERT INTO master_value_helps (entity, field, label, value, sort_order, is_active) VALUES
('leave_types', 'config', 'Earned Leave (EL)', '{
  "code": "EL",
  "accrual_method": "annually",
  "accrual_rate": 12,
  "max_balance": 30,
  "carry_forward_max": 15,
  "encashable": true,
  "requires_approval": true,
  "min_notice_days": 7,
  "max_continuous_days": 15,
  "applicable_gender": "All"
}', 1, TRUE),

('leave_types', 'config', 'Sick Leave (SL)', '{
  "code": "SL",
  "accrual_method": "annually",
  "accrual_rate": 12,
  "max_balance": 12,
  "carry_forward_max": 0,
  "encashable": false,
  "requires_approval": true,
  "min_notice_days": 0,
  "max_continuous_days": null,
  "applicable_gender": "All"
}', 2, TRUE),

('leave_types', 'config', 'Casual Leave (CL)', '{
  "code": "CL",
  "accrual_method": "annually",
  "accrual_rate": 8,
  "max_balance": 8,
  "carry_forward_max": 0,
  "encashable": false,
  "requires_approval": true,
  "min_notice_days": 1,
  "max_continuous_days": 3,
  "applicable_gender": "All"
}', 3, TRUE),

('leave_types', 'config', 'Maternity Leave (ML)', '{
  "code": "ML",
  "accrual_method": "none",
  "accrual_rate": 0,
  "max_balance": 182,
  "carry_forward_max": 0,
  "encashable": false,
  "requires_approval": true,
  "min_notice_days": 0,
  "max_continuous_days": 182,
  "applicable_gender": "Female",
  "notes": "One-time grant of 182 days per qualifying event. Medical certificate required."
}', 4, TRUE),

('leave_types', 'config', 'Paternity Leave (PL)', '{
  "code": "PL",
  "accrual_method": "none",
  "accrual_rate": 0,
  "max_balance": 15,
  "carry_forward_max": 0,
  "encashable": false,
  "requires_approval": true,
  "min_notice_days": 0,
  "max_continuous_days": 15,
  "applicable_gender": "Male"
}', 5, TRUE),

('leave_types', 'config', 'Bereavement Leave (BL)', '{
  "code": "BL",
  "accrual_method": "none",
  "accrual_rate": 0,
  "max_balance": 5,
  "carry_forward_max": 0,
  "encashable": false,
  "requires_approval": false,
  "min_notice_days": 0,
  "max_continuous_days": 5,
  "applicable_gender": "All",
  "notes": "Applicable on death of immediate family member."
}', 6, TRUE),

('leave_types', 'config', 'Unpaid Leave (UL)', '{
  "code": "UL",
  "accrual_method": "none",
  "accrual_rate": 0,
  "max_balance": null,
  "carry_forward_max": 0,
  "encashable": false,
  "requires_approval": true,
  "min_notice_days": 0,
  "max_continuous_days": null,
  "applicable_gender": "All",
  "notes": "Approved solely at manager/HR discretion."
}', 7, TRUE),

('leave_types', 'config', 'Compensatory Off (Comp Off)', '{
  "code": "CompOff",
  "accrual_method": "none",
  "accrual_rate": 0,
  "max_balance": null,
  "carry_forward_max": 0,
  "encashable": false,
  "requires_approval": true,
  "min_notice_days": 0,
  "max_continuous_days": null,
  "applicable_gender": "All",
  "notes": "Credits must be consumed within 90 days. System auto-expires unclaimed credits."
}', 8, TRUE),

('leave_types', 'config', 'Floater Holiday (FH)', '{
  "code": "FH",
  "accrual_method": "annually",
  "accrual_rate": 2,
  "max_balance": 2,
  "carry_forward_max": 0,
  "encashable": false,
  "requires_approval": true,
  "min_notice_days": 1,
  "max_continuous_days": 2,
  "applicable_gender": "All",
  "notes": "Employee chooses the date from approved festival list. Must be used within calendar year."
}', 9, TRUE)

ON CONFLICT (entity, field, value) DO NOTHING;


-- ============================================================
-- SECTION 2: ATTENDANCE_SHIFT_TYPES
-- Stored in master_value_helps (entity='attendance_shift_types').
-- ============================================================

INSERT INTO master_value_helps (entity, field, label, value, sort_order, is_active) VALUES
('attendance_shift_types', 'config', 'General Shift', '{
  "start_time": "09:00",
  "end_time": "18:00",
  "grace_period_mins": 15,
  "break_duration_mins": 60,
  "weekly_off_days": [0, 6],
  "is_flexi": false,
  "core_hours_start": null,
  "core_hours_end": null
}', 1, TRUE),

('attendance_shift_types', 'config', 'Flexi Shift', '{
  "start_time": null,
  "end_time": null,
  "grace_period_mins": 0,
  "break_duration_mins": 60,
  "weekly_off_days": [0, 6],
  "is_flexi": true,
  "core_hours_start": "11:00",
  "core_hours_end": "15:00",
  "notes": "Employee must be present during core window. Total logged hours >= 9h per day."
}', 2, TRUE),

('attendance_shift_types', 'config', 'Night Shift', '{
  "start_time": "21:00",
  "end_time": "06:00",
  "grace_period_mins": 15,
  "break_duration_mins": 60,
  "weekly_off_days": [],
  "is_flexi": false,
  "core_hours_start": null,
  "core_hours_end": null,
  "notes": "Night shift differential rules managed separately in payroll config."
}', 3, TRUE),

('attendance_shift_types', 'config', 'Early Shift', '{
  "start_time": "07:00",
  "end_time": "16:00",
  "grace_period_mins": 15,
  "break_duration_mins": 60,
  "weekly_off_days": [0, 6],
  "is_flexi": false,
  "core_hours_start": null,
  "core_hours_end": null
}', 4, TRUE),

('attendance_shift_types', 'config', 'Half Day Shift', '{
  "start_time_first_half": "09:00",
  "end_time_first_half": "13:00",
  "start_time_second_half": "14:00",
  "end_time_second_half": "18:00",
  "grace_period_mins": 10,
  "break_duration_mins": 0,
  "weekly_off_days": [0, 6],
  "is_flexi": false,
  "notes": "Half-day selection captured at leave application time."
}', 5, TRUE)

ON CONFLICT (entity, field, value) DO NOTHING;


-- ============================================================
-- SECTION 3: WFH_POLICIES
-- Stored in master_value_helps (entity='wfh_policies').
-- ============================================================

INSERT INTO master_value_helps (entity, field, label, value, sort_order, is_active) VALUES
('wfh_policies', 'config', 'Default WFH Policy', '{
  "department": null,
  "max_wfh_days_per_week": 2,
  "max_wfh_days_per_month": 8,
  "approval_required": true,
  "advance_notice_hours": 24,
  "eligible_employment_types": ["Full-time", "On Probation", "Part-time"],
  "effective_from": "2024-01-01"
}', 1, TRUE),

('wfh_policies', 'config', 'Engineering WFH Policy', '{
  "department": "Engineering",
  "max_wfh_days_per_week": 3,
  "max_wfh_days_per_month": 12,
  "approval_required": false,
  "advance_notice_hours": 0,
  "eligible_employment_types": ["Full-time", "Contract", "Consultant"],
  "effective_from": "2024-01-01"
}', 2, TRUE),

('wfh_policies', 'config', 'Operations WFH Policy', '{
  "department": "Operations",
  "max_wfh_days_per_week": 1,
  "max_wfh_days_per_month": 4,
  "approval_required": true,
  "advance_notice_hours": 48,
  "eligible_employment_types": ["Full-time"],
  "effective_from": "2024-01-01"
}', 3, TRUE)

ON CONFLICT (entity, field, value) DO NOTHING;


-- ============================================================
-- SECTION 4: EMPLOYMENT_TYPES
-- Uses master_employment_types table (already partially seeded).
-- Adds "On Probation" and "Intern" (spec name) if missing.
-- ============================================================

INSERT INTO master_employment_types (name, description, is_active) VALUES
('On Probation',  'Employee on probationary period; transitions to Full-time on confirmation', TRUE),
('Intern',        'Internship engagement — typically 3 to 6 months duration',                 TRUE)
ON CONFLICT (lower(name)) DO NOTHING;


-- ============================================================
-- SECTION 5: DEPARTMENTS
-- Uses master_departments. Adds spec-defined departments with
-- codes stored in description field (no code column exists).
-- Already seeded: Engineering, HR, Finance, Marketing, Sales,
-- Operations, Product, Customer Success, IT & Infrastructure, Legal, Administration.
-- Spec adds: IT (as code IT), HR (as code HR), etc.
-- Insert spec names with codes captured in master_value_helps.
-- ============================================================

-- Store department codes as a lookup
INSERT INTO master_value_helps (entity, field, label, value, sort_order, is_active) VALUES
('departments', 'code', 'IT',               'IT',  1,  TRUE),
('departments', 'code', 'HR',               'HR',  2,  TRUE),
('departments', 'code', 'Finance',          'FIN', 3,  TRUE),
('departments', 'code', 'Operations',       'OPS', 4,  TRUE),
('departments', 'code', 'Sales',            'SLS', 5,  TRUE),
('departments', 'code', 'Marketing',        'MKT', 6,  TRUE),
('departments', 'code', 'Engineering',      'ENG', 7,  TRUE),
('departments', 'code', 'Product',          'PRD', 8,  TRUE),
('departments', 'code', 'Legal',            'LGL', 9,  TRUE),
('departments', 'code', 'Admin',            'ADM', 10, TRUE),
('departments', 'code', 'Customer Success', 'CS',  11, TRUE)
ON CONFLICT (entity, field, value) DO NOTHING;

-- Ensure spec department names exist in master_departments
INSERT INTO master_departments (name, description, is_active) VALUES
('IT',               'Information Technology',                            TRUE),
('HR',               'Human Resources',                                   TRUE),
('Finance',          'Finance and Accounting',                            TRUE),
('Operations',       'Business Operations',                               TRUE),
('Sales',            'Sales and Revenue',                                 TRUE),
('Marketing',        'Marketing and Brand',                               TRUE),
('Engineering',      'Software Engineering',                              TRUE),
('Product',          'Product Management',                                TRUE),
('Legal',            'Legal and Compliance',                              TRUE),
('Admin',            'Administration',                                    TRUE),
('Customer Success', 'Customer Success and Support',                      TRUE)
ON CONFLICT (lower(name)) DO NOTHING;


-- ============================================================
-- SECTION 6: DESIGNATIONS
-- Stored in master_value_helps (entity='designations') and
-- also in master_job_titles where applicable.
-- ============================================================

INSERT INTO master_value_helps (entity, field, label, value, sort_order, is_active) VALUES
('designations', 'level_config', 'Intern',             '{"level": 1, "is_manager_level": false, "min_experience_years": 0}',  1,  TRUE),
('designations', 'level_config', 'Trainee',            '{"level": 2, "is_manager_level": false, "min_experience_years": 0}',  2,  TRUE),
('designations', 'level_config', 'Junior Analyst',     '{"level": 3, "is_manager_level": false, "min_experience_years": 1}',  3,  TRUE),
('designations', 'level_config', 'Analyst',            '{"level": 4, "is_manager_level": false, "min_experience_years": 2}',  4,  TRUE),
('designations', 'level_config', 'Senior Analyst',     '{"level": 5, "is_manager_level": false, "min_experience_years": 4}',  5,  TRUE),
('designations', 'level_config', 'Lead',               '{"level": 6, "is_manager_level": false, "min_experience_years": 6}',  6,  TRUE),
('designations', 'level_config', 'Manager',            '{"level": 7, "is_manager_level": true,  "min_experience_years": 7}',  7,  TRUE),
('designations', 'level_config', 'Senior Manager',     '{"level": 8, "is_manager_level": true,  "min_experience_years": 10}', 8,  TRUE),
('designations', 'level_config', 'Director',           '{"level": 9, "is_manager_level": true,  "min_experience_years": 14}', 9,  TRUE),
('designations', 'level_config', 'Vice President (VP)','{"level": 10, "is_manager_level": true, "min_experience_years": 18}', 10, TRUE),
('designations', 'level_config', 'C-Suite',            '{"level": 11, "is_manager_level": true, "min_experience_years": 20}', 11, TRUE)
ON CONFLICT (entity, field, value) DO NOTHING;


-- ============================================================
-- SECTION 7: LOCATIONS
-- Uses master_locations (already partially seeded).
-- Adds spec-defined locations with full details.
-- ============================================================

INSERT INTO master_locations (name, country, city, address, is_active) VALUES
('HQ Mumbai',        'India', 'Mumbai',    'Head Quarter, Mumbai, Maharashtra', TRUE),
('Pune Office',      'India', 'Pune',      'Pune Office, Maharashtra',          TRUE),
('Bangalore Office', 'India', 'Bangalore', 'Bangalore Office, Karnataka',       TRUE),
('Delhi Office',     'India', 'New Delhi', 'Delhi Office, Delhi',               TRUE),
('Remote',           NULL,    NULL,        NULL,                                 TRUE)
ON CONFLICT (lower(name)) DO NOTHING;

-- Extended location config with timezone details
INSERT INTO master_value_helps (entity, field, label, value, sort_order, is_active) VALUES
('locations', 'timezone_config', 'HQ Mumbai',        '{"city": "Mumbai",    "state": "Maharashtra", "country": "India", "timezone": "Asia/Kolkata", "is_headquarter": true}',  1, TRUE),
('locations', 'timezone_config', 'Pune Office',      '{"city": "Pune",      "state": "Maharashtra", "country": "India", "timezone": "Asia/Kolkata", "is_headquarter": false}', 2, TRUE),
('locations', 'timezone_config', 'Bangalore Office', '{"city": "Bangalore", "state": "Karnataka",   "country": "India", "timezone": "Asia/Kolkata", "is_headquarter": false}', 3, TRUE),
('locations', 'timezone_config', 'Delhi Office',     '{"city": "New Delhi", "state": "Delhi",       "country": "India", "timezone": "Asia/Kolkata", "is_headquarter": false}', 4, TRUE),
('locations', 'timezone_config', 'Remote',           '{"city": null,        "state": null,          "country": null,    "timezone": null,            "is_headquarter": false}', 5, TRUE)
ON CONFLICT (entity, field, value) DO NOTHING;


-- ============================================================
-- SECTION 8: SKILL_CATEGORIES
-- Stored in master_value_helps (entity='skill_categories').
-- ============================================================

INSERT INTO master_value_helps (entity, field, label, value, sort_order, is_active) VALUES
('skill_categories', 'name', 'Technical',        'Technical',        1, TRUE),
('skill_categories', 'name', 'Soft Skills',      'Soft Skills',      2, TRUE),
('skill_categories', 'name', 'Domain Knowledge', 'Domain Knowledge', 3, TRUE),
('skill_categories', 'name', 'Leadership',       'Leadership',       4, TRUE),
('skill_categories', 'name', 'Tool / Platform',  'Tool / Platform',  5, TRUE),
('skill_categories', 'name', 'Language',         'Language',         6, TRUE),
('skill_categories', 'name', 'Certification',    'Certification',    7, TRUE)
ON CONFLICT (entity, field, value) DO NOTHING;

-- Skills by spec category (supplement existing master_skills data)
INSERT INTO master_skills (name, category, is_active) VALUES
-- Technical
('NoSQL',          'Technical', TRUE),
('SAP ABAP',       'Technical', TRUE),
('SAP Fiori',      'Technical', TRUE),
('SAPUI5',         'Technical', TRUE),
-- Soft Skills
('Time Management',    'Soft Skills', TRUE),
('Teamwork',           'Soft Skills', TRUE),
('Presentation',       'Soft Skills', TRUE),
('Negotiation',        'Soft Skills', TRUE),
('Adaptability',       'Soft Skills', TRUE),
('Conflict Resolution','Soft Skills', TRUE),
-- Domain Knowledge
('Supply Chain', 'Domain Knowledge', TRUE),
('Oil & Gas',    'Domain Knowledge', TRUE),
('Retail',       'Domain Knowledge', TRUE),
('Healthcare',   'Domain Knowledge', TRUE),
('Banking',      'Domain Knowledge', TRUE),
('Insurance',    'Domain Knowledge', TRUE)
ON CONFLICT (lower(name), lower(category)) DO NOTHING;


-- ============================================================
-- SECTION 9: COMPETENCY_FRAMEWORKS
-- Stored in master_value_helps (entity='competency_frameworks').
-- Full framework stored as JSONB in value column.
-- ============================================================

INSERT INTO master_value_helps (entity, field, label, value, sort_order, is_active) VALUES
('competency_frameworks', 'framework', 'Individual Contributor Framework', '{
  "role_pattern": "^(Intern|Trainee|Junior Analyst|Analyst|Senior Analyst|Lead)$",
  "competencies": [
    {
      "name": "Technical Expertise",
      "description": "Measures depth and currency of domain and technical knowledge relevant to the role.",
      "proficiency_levels": [
        {"level": 1, "label": "Foundational",  "descriptor": "Basic awareness of concepts."},
        {"level": 2, "label": "Developing",    "descriptor": "Applies knowledge with supervision."},
        {"level": 3, "label": "Proficient",    "descriptor": "Works independently; delivers quality output."},
        {"level": 4, "label": "Advanced",      "descriptor": "Considered a go-to resource by peers."},
        {"level": 5, "label": "Expert",        "descriptor": "Sets technical direction."}
      ]
    },
    {
      "name": "Problem Solving",
      "description": "Measures analytical thinking and solution design under ambiguity.",
      "proficiency_levels": [
        {"level": 1, "label": "Foundational",  "descriptor": "Identifies straightforward problems when pointed out."},
        {"level": 2, "label": "Developing",    "descriptor": "Breaks down structured problems with guidance."},
        {"level": 3, "label": "Proficient",    "descriptor": "Independently diagnoses and resolves moderately complex issues."},
        {"level": 4, "label": "Advanced",      "descriptor": "Designs solutions for systemic or cross-functional problems."},
        {"level": 5, "label": "Expert",        "descriptor": "Resolves novel, high-impact problems with lasting solutions."}
      ]
    },
    {
      "name": "Communication",
      "description": "Clarity, conciseness, and appropriateness of written and verbal communication.",
      "proficiency_levels": [
        {"level": 1, "label": "Foundational",  "descriptor": "Communicates basic information clearly in familiar contexts."},
        {"level": 2, "label": "Developing",    "descriptor": "Structures messages for intended audience with some guidance."},
        {"level": 3, "label": "Proficient",    "descriptor": "Communicates proactively and adapts style to context."},
        {"level": 4, "label": "Advanced",      "descriptor": "Influences through communication; leads critical conversations."},
        {"level": 5, "label": "Expert",        "descriptor": "Exemplary communicator; represents org externally."}
      ]
    },
    {
      "name": "Collaboration",
      "description": "Effectiveness in teamwork, sharing knowledge, and supporting peers.",
      "proficiency_levels": [
        {"level": 1, "label": "Foundational",  "descriptor": "Participates when asked."},
        {"level": 2, "label": "Developing",    "descriptor": "Actively contributes to team goals."},
        {"level": 3, "label": "Proficient",    "descriptor": "Builds relationships and helps others."},
        {"level": 4, "label": "Advanced",      "descriptor": "Fosters inclusion and removes blockers for team."},
        {"level": 5, "label": "Expert",        "descriptor": "Creates a culture of collaboration."}
      ]
    },
    {
      "name": "Ownership & Initiative",
      "description": "Degree of accountability taken and proactiveness shown.",
      "proficiency_levels": [
        {"level": 1, "label": "Foundational",  "descriptor": "Completes assigned tasks on time."},
        {"level": 2, "label": "Developing",    "descriptor": "Raises issues proactively; takes ownership of deliverables."},
        {"level": 3, "label": "Proficient",    "descriptor": "Drives tasks end-to-end without hand-holding."},
        {"level": 4, "label": "Advanced",      "descriptor": "Anticipates org needs; initiates improvements unprompted."},
        {"level": 5, "label": "Expert",        "descriptor": "Inspires ownership culture; holds team accountable."}
      ]
    }
  ]
}', 1, TRUE),

('competency_frameworks', 'framework', 'Manager Framework', '{
  "role_pattern": "^(Manager|Senior Manager|Director|VP|C-Suite)$",
  "competencies": [
    {
      "name": "Leadership",
      "description": "Ability to inspire, direct, and develop a high-performing team.",
      "proficiency_levels": [
        {"level": 1, "label": "Foundational",  "descriptor": "Manages own work; beginning to guide others."},
        {"level": 2, "label": "Developing",    "descriptor": "Leads small team; sets clear expectations."},
        {"level": 3, "label": "Proficient",    "descriptor": "Leads a functional team; manages performance actively."},
        {"level": 4, "label": "Advanced",      "descriptor": "Leads multiple teams or large function."},
        {"level": 5, "label": "Expert",        "descriptor": "Visionary leader; influences org-wide culture and direction."}
      ]
    },
    {
      "name": "Strategic Thinking",
      "description": "Capacity to think beyond the immediate and align work to business goals.",
      "proficiency_levels": [
        {"level": 1, "label": "Foundational",  "descriptor": "Understands team goals within dept context."},
        {"level": 2, "label": "Developing",    "descriptor": "Connects team work to department strategy."},
        {"level": 3, "label": "Proficient",    "descriptor": "Contributes to department-level strategy."},
        {"level": 4, "label": "Advanced",      "descriptor": "Shapes functional strategy; considers competitive landscape."},
        {"level": 5, "label": "Expert",        "descriptor": "Drives org-wide strategy with multi-year horizon."}
      ]
    },
    {
      "name": "People Development",
      "description": "Investment in growing direct reports and building talent pipeline.",
      "proficiency_levels": [
        {"level": 1, "label": "Foundational",  "descriptor": "Gives basic feedback when asked."},
        {"level": 2, "label": "Developing",    "descriptor": "Conducts regular 1:1s; identifies development needs."},
        {"level": 3, "label": "Proficient",    "descriptor": "Creates individual development plans; coaches actively."},
        {"level": 4, "label": "Advanced",      "descriptor": "Builds successors; advocates for team members growth org-wide."},
        {"level": 5, "label": "Expert",        "descriptor": "Develops next-generation leaders; builds people programs."}
      ]
    },
    {
      "name": "Decision Making",
      "description": "Speed, quality, and accountability in making and owning decisions.",
      "proficiency_levels": [
        {"level": 1, "label": "Foundational",  "descriptor": "Makes low-risk decisions with guidance."},
        {"level": 2, "label": "Developing",    "descriptor": "Makes routine decisions independently; escalates appropriately."},
        {"level": 3, "label": "Proficient",    "descriptor": "Makes complex decisions under uncertainty; communicates rationale."},
        {"level": 4, "label": "Advanced",      "descriptor": "Makes high-stakes decisions; manages risk and fallback."},
        {"level": 5, "label": "Expert",        "descriptor": "Makes org-defining decisions; navigates ambiguity at scale."}
      ]
    },
    {
      "name": "Communication",
      "description": "Clarity, conciseness, and appropriateness of written and verbal communication.",
      "proficiency_levels": [
        {"level": 1, "label": "Foundational",  "descriptor": "Communicates basic information clearly in familiar contexts."},
        {"level": 2, "label": "Developing",    "descriptor": "Structures messages for intended audience with some guidance."},
        {"level": 3, "label": "Proficient",    "descriptor": "Communicates proactively and adapts style to context."},
        {"level": 4, "label": "Advanced",      "descriptor": "Influences through communication; leads critical conversations."},
        {"level": 5, "label": "Expert",        "descriptor": "Exemplary communicator; represents org externally."}
      ]
    },
    {
      "name": "Business Acumen",
      "description": "Understanding of financial drivers, market dynamics, and org economics.",
      "proficiency_levels": [
        {"level": 1, "label": "Foundational",  "descriptor": "Understands team budget basics."},
        {"level": 2, "label": "Developing",    "descriptor": "Manages team budget; understands P&L concepts."},
        {"level": 3, "label": "Proficient",    "descriptor": "Owns cost center; drives efficiency."},
        {"level": 4, "label": "Advanced",      "descriptor": "Understands competitive and market dynamics."},
        {"level": 5, "label": "Expert",        "descriptor": "Influences business model; drives revenue or cost strategy."}
      ]
    },
    {
      "name": "Execution",
      "description": "Ability to translate strategy into results reliably.",
      "proficiency_levels": [
        {"level": 1, "label": "Foundational",  "descriptor": "Delivers assigned tasks on schedule."},
        {"level": 2, "label": "Developing",    "descriptor": "Delivers team commitments; manages blockers."},
        {"level": 3, "label": "Proficient",    "descriptor": "Runs programs end-to-end; mitigates delivery risk."},
        {"level": 4, "label": "Advanced",      "descriptor": "Delivers complex cross-functional programs."},
        {"level": 5, "label": "Expert",        "descriptor": "Consistently delivers org-level strategic initiatives on time."}
      ]
    }
  ]
}', 2, TRUE)

ON CONFLICT (entity, field, value) DO NOTHING;


-- ============================================================
-- SECTION 10: REVIEW_RATING_SCALES
-- Stored in master_value_helps (entity='review_rating_scales').
-- ============================================================

INSERT INTO master_value_helps (entity, field, label, value, sort_order, is_active) VALUES
('review_rating_scales', 'scale_config', 'Standard 5-Point Rating Scale', '{
  "levels": [
    {"value": 1, "label": "Unsatisfactory",      "color": "#DC2626", "description": "Performance is significantly below role expectations. Immediate corrective action required."},
    {"value": 2, "label": "Below Expectations",  "color": "#EA580C", "description": "Performance partially meets expectations. Improvement plan recommended."},
    {"value": 3, "label": "Meets Expectations",  "color": "#2563EB", "description": "Performance consistently meets role requirements. Employee is effective in their position."},
    {"value": 4, "label": "Exceeds Expectations","color": "#16A34A", "description": "Performance frequently surpasses role requirements. Employee delivers notable impact beyond scope."},
    {"value": 5, "label": "Outstanding",         "color": "#7C3AED", "description": "Exceptional and consistent performance. Role model for the organization; significant business impact delivered."}
  ]
}', 1, TRUE),

('review_rating_scales', 'scale_config', 'Simplified 3-Point Rating Scale', '{
  "levels": [
    {"value": 1, "label": "Needs Improvement",   "color": "#DC2626", "description": "Performance does not yet meet core role expectations."},
    {"value": 2, "label": "Meets Expectations",  "color": "#2563EB", "description": "Performance is aligned with role requirements."},
    {"value": 3, "label": "Exceeds Expectations","color": "#16A34A", "description": "Performance goes above and beyond requirements."}
  ]
}', 2, TRUE)

ON CONFLICT (entity, field, value) DO NOTHING;


-- ============================================================
-- SECTION 11: RECRUITMENT_SOURCES
-- Added to master_value_helps (entity='recruitment', field='source_extended').
-- Core sources already seeded in 02_seed.sql; this adds spec-specific ones.
-- ============================================================

INSERT INTO master_value_helps (entity, field, label, value, sort_order, is_active) VALUES
('recruitment', 'source_extended', 'LinkedIn',           'LinkedIn',           1,  TRUE),
('recruitment', 'source_extended', 'Naukri.com',         'Naukri.com',         2,  TRUE),
('recruitment', 'source_extended', 'Indeed',             'Indeed',             3,  TRUE),
('recruitment', 'source_extended', 'Monster',            'Monster',            4,  TRUE),
('recruitment', 'source_extended', 'Internal Referral',  'Internal Referral',  5,  TRUE),
('recruitment', 'source_extended', 'Campus Placement',   'Campus Placement',   6,  TRUE),
('recruitment', 'source_extended', 'Direct Application', 'Direct Application', 7,  TRUE),
('recruitment', 'source_extended', 'Recruitment Agency', 'Recruitment Agency', 8,  TRUE),
('recruitment', 'source_extended', 'Job Fair',           'Job Fair',           9,  TRUE),
('recruitment', 'source_extended', 'Walk-in',            'Walk-in',            10, TRUE),
('recruitment', 'source_extended', 'Company Website',    'Company Website',    11, TRUE)
ON CONFLICT (entity, field, value) DO NOTHING;


-- ============================================================
-- SECTION 12: INTERVIEW_TYPES
-- Added to master_value_helps (entity='recruitment', field='interview_type_extended').
-- Spec-specific types supplement existing 02_seed.sql entries.
-- ============================================================

INSERT INTO master_value_helps (entity, field, label, value, sort_order, is_active) VALUES
('recruitment', 'interview_type_extended', 'HR Screening',      'HR Screening',      1, TRUE),
('recruitment', 'interview_type_extended', 'Technical Round',   'Technical Round',   2, TRUE),
('recruitment', 'interview_type_extended', 'Managerial Round',  'Managerial Round',  3, TRUE),
('recruitment', 'interview_type_extended', 'Panel Interview',   'Panel Interview',   4, TRUE),
('recruitment', 'interview_type_extended', 'Case Study',        'Case Study',        5, TRUE),
('recruitment', 'interview_type_extended', 'Group Discussion',  'Group Discussion',  6, TRUE),
('recruitment', 'interview_type_extended', 'Culture Fit',       'Culture Fit',       7, TRUE),
('recruitment', 'interview_type_extended', 'Final Round',       'Final Round',       8, TRUE),
('recruitment', 'interview_type_extended', 'Reference Check',   'Reference Check',   9, TRUE)
ON CONFLICT (entity, field, value) DO NOTHING;


-- ============================================================
-- SECTION 13: OFFER_LETTER_TEMPLATES
-- Uses email_templates table (closest structural match).
-- ============================================================

INSERT INTO email_templates (name, subject, body, category, variables) VALUES

('Standard Full-time Offer Letter',
 'Offer of Employment — {position} at {department}',
 '<!DOCTYPE html>
<html>
<body>
<p>Dear {candidate_name},</p>
<p>We are pleased to extend an offer of employment for the position of <strong>{position}</strong>
in the <strong>{department}</strong> department.</p>

<h3>Compensation Details</h3>
<p>Annual CTC: <strong>{salary_ctc}</strong><br>
Basic Salary (Monthly): {basic_salary}<br>
HRA: As per company policy<br>
Special Allowance: As per company policy<br>
Provident Fund: 12% of Basic (employer contribution)<br>
Gratuity: As applicable under the Payment of Gratuity Act</p>

<h3>Terms of Employment</h3>
<p>Joining Date: {joining_date}<br>
Reporting Manager: {reporting_manager}<br>
Work Location: {work_location}<br>
Probation Period: {probation_period}</p>

<p>This offer is subject to your signing and returning the enclosed Non-Disclosure Agreement
and Code of Conduct acknowledgement. Please confirm acceptance by <strong>{offer_validity_date}</strong>.</p>

<p>We look forward to welcoming you to the team.</p>
<p>Warm regards,<br>Human Resources</p>
</body>
</html>',
 'Recruitment',
 '["candidate_name","position","department","salary_ctc","basic_salary","joining_date","reporting_manager","work_location","probation_period","offer_validity_date"]'::jsonb),

('Intern Offer Letter',
 'Internship Offer — {position} at {department}',
 '<!DOCTYPE html>
<html>
<body>
<p>Dear {candidate_name},</p>
<p>We are pleased to offer you an internship as <strong>{position}</strong>
in the <strong>{department}</strong> department.</p>

<h3>Internship Details</h3>
<p>Duration: As per agreed term (typically 3–6 months)<br>
Stipend: {salary_ctc} per month<br>
Joining Date: {joining_date}<br>
Reporting Manager: {reporting_manager}<br>
Work Location: {work_location}</p>

<h3>Learning Objectives</h3>
<p>You will be assigned structured learning objectives at the start of the internship
by your reporting manager.</p>

<p><em>Note: This internship does not guarantee future employment. All work produced
during the internship remains the intellectual property of the company. This letter
is subject to signing the enclosed Confidentiality Agreement.</em></p>

<p>Please confirm acceptance by <strong>{offer_validity_date}</strong>.</p>

<p>Warm regards,<br>Human Resources</p>
</body>
</html>',
 'Recruitment',
 '["candidate_name","position","department","salary_ctc","joining_date","reporting_manager","work_location","offer_validity_date"]'::jsonb),

('Contract Offer Letter',
 'Contract Engagement Offer — {position}',
 '<!DOCTYPE html>
<html>
<body>
<p>Dear {candidate_name},</p>
<p>We are pleased to engage you as a contractor for the role of <strong>{position}</strong>
in the <strong>{department}</strong> department.</p>

<h3>Engagement Details</h3>
<p>Contract Start Date: {joining_date}<br>
Contract End Date: As agreed per Statement of Work<br>
Rate / Fee Structure: {salary_ctc}<br>
Work Location: {work_location}<br>
Reporting Manager: {reporting_manager}</p>

<h3>Scope of Work</h3>
<p>The scope of work will be defined in the attached Statement of Work document.</p>

<h3>Termination</h3>
<p>Either party may terminate this engagement with {probation_period} written notice.</p>

<p><em>All intellectual property created during this engagement shall be assigned to
the company. Please sign and return the enclosed IP Assignment Agreement.</em></p>

<p>Please confirm acceptance by <strong>{offer_validity_date}</strong>.</p>

<p>Warm regards,<br>Human Resources</p>
</body>
</html>',
 'Recruitment',
 '["candidate_name","position","department","salary_ctc","joining_date","reporting_manager","work_location","probation_period","offer_validity_date"]'::jsonb)

ON CONFLICT (lower(name)) DO NOTHING;

INSERT INTO onboarding_workflow_templates (name, department, steps) VALUES
('Default Onboarding', NULL, '[
  {
    "task_id": "ot-001",
    "title": "Submit Government ID Documents",
    "description": "Employee submits copies of Aadhaar, PAN, passport, and any other identity documents required for HR records.",
    "owner": "Employee",
    "due_day_offset": 0,
    "category": "Documents",
    "is_mandatory": true,
    "depends_on_task_id": null
  },
  {
    "task_id": "ot-002",
    "title": "Sign Offer Letter and NDA",
    "description": "Employee countersigns the offer letter and the Non-Disclosure Agreement via the portal or in person.",
    "owner": "Employee",
    "due_day_offset": 0,
    "category": "Documents",
    "is_mandatory": true,
    "depends_on_task_id": null
  },
  {
    "task_id": "ot-003",
    "title": "IT Laptop and Equipment Allocation",
    "description": "IT team provisions and hands over laptop, accessories, and any role-specific hardware.",
    "owner": "IT",
    "due_day_offset": 0,
    "category": "IT",
    "is_mandatory": true,
    "depends_on_task_id": null
  },
  {
    "task_id": "ot-004",
    "title": "System Access Setup",
    "description": "Create corporate email, configure VPN access, set up required collaboration tools, and provision application access per role permissions.",
    "owner": "IT",
    "due_day_offset": 1,
    "category": "Access",
    "is_mandatory": true,
    "depends_on_task_id": "ot-003"
  },
  {
    "task_id": "ot-005",
    "title": "Office Orientation and Tour",
    "description": "HR walks the new employee through the office floor, facilities, safety exits, cafeteria, and meeting rooms.",
    "owner": "HR",
    "due_day_offset": 1,
    "category": "Orientation",
    "is_mandatory": true,
    "depends_on_task_id": null
  },
  {
    "task_id": "ot-006",
    "title": "Introduction to Manager and Team",
    "description": "Reporting manager introduces the employee to the immediate team, shares team norms, and explains the 30/60/90-day expectations.",
    "owner": "Manager",
    "due_day_offset": 1,
    "category": "Orientation",
    "is_mandatory": true,
    "depends_on_task_id": null
  },
  {
    "task_id": "ot-007",
    "title": "Enroll in Mandatory Compliance Training",
    "description": "HR assigns POSH, Information Security, and Code of Conduct training through the Training module. Employee must complete within 30 days.",
    "owner": "HR",
    "due_day_offset": 3,
    "category": "Training",
    "is_mandatory": true,
    "depends_on_task_id": null
  },
  {
    "task_id": "ot-008",
    "title": "Complete Employee Profile in Directory",
    "description": "Employee fills in the full profile in the Employee Directory app: photo, bio, skills, emergency contact, bank details, and address proof.",
    "owner": "Employee",
    "due_day_offset": 7,
    "category": "Documents",
    "is_mandatory": true,
    "depends_on_task_id": null
  },
  {
    "task_id": "ot-009",
    "title": "HR Policies Walkthrough",
    "description": "HR conducts a session covering leave policy, attendance, WFH norms, expense reimbursement, and grievance redressal procedures.",
    "owner": "HR",
    "due_day_offset": 7,
    "category": "Orientation",
    "is_mandatory": true,
    "depends_on_task_id": null
  },
  {
    "task_id": "ot-010",
    "title": "Meet Assigned Buddy for Knowledge Sharing",
    "description": "Employee connects with their assigned buddy (experienced peer) for a knowledge transfer session on team processes and unwritten norms.",
    "owner": "Employee",
    "due_day_offset": 14,
    "category": "Orientation",
    "is_mandatory": false,
    "depends_on_task_id": null
  },
  {
    "task_id": "ot-011",
    "title": "Complete Onboarding Assessment",
    "description": "Employee completes the onboarding assessment quiz covering compliance, policies, and tools introduced during the first month.",
    "owner": "HR",
    "due_day_offset": 30,
    "category": "Training",
    "is_mandatory": true,
    "depends_on_task_id": "ot-007"
  },
  {
    "task_id": "ot-012",
    "title": "Probation Review Meeting with Manager",
    "description": "Manager conducts the formal probation review. Outcome is recorded (confirmed / extended / not confirmed) and triggers the relevant workflow event.",
    "owner": "Manager",
    "due_day_offset": 90,
    "category": "Orientation",
    "is_mandatory": true,
    "depends_on_task_id": null
  }
]')
ON CONFLICT (lower(name)) DO NOTHING;


-- ============================================================
-- SECTION 15: TRAINING_CATEGORIES
-- Added to master_value_helps (entity='training_categories').
-- Some overlap with 02_seed.sql training.category — new field.
-- ============================================================

INSERT INTO master_value_helps (entity, field, label, value, sort_order, is_active) VALUES
('training_categories', 'name', 'Technical Skills',      'Technical Skills',      1,  TRUE),
('training_categories', 'name', 'Compliance & Regulatory','Compliance & Regulatory',2, TRUE),
('training_categories', 'name', 'Leadership Development','Leadership Development', 3,  TRUE),
('training_categories', 'name', 'Communication',         'Communication',          4,  TRUE),
('training_categories', 'name', 'Safety & Health',       'Safety & Health',        5,  TRUE),
('training_categories', 'name', 'Domain Knowledge',      'Domain Knowledge',       6,  TRUE),
('training_categories', 'name', 'Tool / Software',       'Tool / Software',        7,  TRUE),
('training_categories', 'name', 'Soft Skills',           'Soft Skills',            8,  TRUE),
('training_categories', 'name', 'Sales & Customer',      'Sales & Customer',       9,  TRUE),
('training_categories', 'name', 'Finance & Legal',       'Finance & Legal',        10, TRUE)
ON CONFLICT (entity, field, value) DO NOTHING;


-- ============================================================
-- SECTION 16: PERFORMANCE_REVIEW_TYPES
-- Added to master_value_helps (entity='performance_review_types').
-- ============================================================

INSERT INTO master_value_helps (entity, field, label, value, sort_order, is_active) VALUES
('performance_review_types', 'name', 'Annual Review',       'Annual Review',       1, TRUE),
('performance_review_types', 'name', 'Mid-Year Review',     'Mid-Year Review',     2, TRUE),
('performance_review_types', 'name', 'Quarterly Check-in',  'Quarterly Check-in',  3, TRUE),
('performance_review_types', 'name', 'Probation Review',    'Probation Review',    4, TRUE),
('performance_review_types', 'name', 'PIP Review',          'PIP Review',          5, TRUE),
('performance_review_types', 'name', '360-Degree Feedback', '360-Degree Feedback', 6, TRUE),
('performance_review_types', 'name', 'Peer Review',         'Peer Review',         7, TRUE),
('performance_review_types', 'name', 'Exit Review',         'Exit Review',         8, TRUE)
ON CONFLICT (entity, field, value) DO NOTHING;


-- ============================================================
-- SECTION 17: PIP_CATEGORIES
-- Added to master_value_helps (entity='pip_categories').
-- ============================================================

INSERT INTO master_value_helps (entity, field, label, value, sort_order, is_active) VALUES
('pip_categories', 'name', 'Performance Below Expectations', 'Performance Below Expectations', 1, TRUE),
('pip_categories', 'name', 'Behavioral Concerns',            'Behavioral Concerns',            2, TRUE),
('pip_categories', 'name', 'Attendance & Punctuality',       'Attendance & Punctuality',       3, TRUE),
('pip_categories', 'name', 'Compliance Violation',           'Compliance Violation',           4, TRUE),
('pip_categories', 'name', 'Communication Issues',           'Communication Issues',           5, TRUE)
ON CONFLICT (entity, field, value) DO NOTHING;


-- ============================================================
-- SECTION 18: RECOGNITION_BADGE_TYPES
-- Added to master_value_helps (entity='recognition_badge_types').
-- ============================================================

INSERT INTO master_value_helps (entity, field, label, value, sort_order, is_active) VALUES
('recognition_badge_types', 'badge_config', 'Above & Beyond', '{
  "color": "#D97706",
  "icon": "star",
  "description": "Awarded for delivering results that significantly exceed normal role expectations."
}', 1, TRUE),

('recognition_badge_types', 'badge_config', 'Innovator', '{
  "color": "#7C3AED",
  "icon": "lightbulb",
  "description": "Recognizes creative problem-solving and introduction of new ideas or improvements."
}', 2, TRUE),

('recognition_badge_types', 'badge_config', 'Team Player', '{
  "color": "#2563EB",
  "icon": "users",
  "description": "Celebrates outstanding collaboration, helpfulness, and team-first attitude."
}', 3, TRUE),

('recognition_badge_types', 'badge_config', 'Customer First', '{
  "color": "#16A34A",
  "icon": "heart-handshake",
  "description": "Honors exceptional dedication to customer or stakeholder satisfaction."
}', 4, TRUE),

('recognition_badge_types', 'badge_config', 'Rising Star', '{
  "color": "#EA580C",
  "icon": "trending-up",
  "description": "Highlights high-potential employees showing exceptional early-career growth."
}', 5, TRUE),

('recognition_badge_types', 'badge_config', 'Mentor', '{
  "color": "#0D9488",
  "icon": "graduation-cap",
  "description": "Recognizes significant investment in developing and guiding colleagues."
}', 6, TRUE),

('recognition_badge_types', 'badge_config', 'Problem Solver', '{
  "color": "#4338CA",
  "icon": "puzzle",
  "description": "Awarded for tackling persistent or complex problems with effective, lasting solutions."
}', 7, TRUE),

('recognition_badge_types', 'badge_config', 'Leadership Excellence', '{
  "color": "#DC2626",
  "icon": "award",
  "description": "Celebrates exemplary leadership behavior that inspires and elevates the team."
}', 8, TRUE)

ON CONFLICT (entity, field, value) DO NOTHING;


-- ============================================================
-- SECTION 19: WORKFLOW_TRIGGER_EVENTS
-- Stored in master_value_helps (entity='workflow_trigger_events').
-- ============================================================

INSERT INTO master_value_helps (entity, field, label, value, sort_order, is_active) VALUES
('workflow_trigger_events', 'event_config', 'Leave Applied', '{
  "event_key": "leave_applied",
  "source_app": "Employee Dashboard",
  "entity": "leaves",
  "description": "Fired when an employee submits a leave request.",
  "payload_schema": {"leave_id": "uuid", "employee_id": "uuid", "type": "string", "start_date": "date", "end_date": "date", "days": "number", "reason": "string"}
}', 1, TRUE),

('workflow_trigger_events', 'event_config', 'Leave Approved', '{
  "event_key": "leave_approved",
  "source_app": "Employee Dashboard",
  "entity": "leaves",
  "description": "Fired when an approver (manager or HR) approves a pending leave request.",
  "payload_schema": {"leave_id": "uuid", "employee_id": "uuid", "approved_by": "uuid"}
}', 2, TRUE),

('workflow_trigger_events', 'event_config', 'Candidate Hired', '{
  "event_key": "candidate_hired",
  "source_app": "Recruitment",
  "entity": "candidates",
  "description": "Fired when a candidate status is set to Hired in the recruitment pipeline.",
  "payload_schema": {"candidate_id": "uuid", "name": "string", "email": "string", "position": "string", "department": "string", "joining_date": "date"}
}', 3, TRUE),

('workflow_trigger_events', 'event_config', 'Onboarding Completed', '{
  "event_key": "onboarding_completed",
  "source_app": "Onboarding",
  "entity": "onboarding_records",
  "description": "Fired when all mandatory onboarding tasks for an employee are marked complete.",
  "payload_schema": {"onboarding_id": "uuid", "employee_id": "uuid", "completed_at": "timestamp"}
}', 4, TRUE),

('workflow_trigger_events', 'event_config', 'PIP Created', '{
  "event_key": "pip_created",
  "source_app": "Performance",
  "entity": "performance_pips",
  "description": "Fired when a new Performance Improvement Plan is created for an employee.",
  "payload_schema": {"pip_id": "uuid", "employee_id": "uuid", "created_by": "uuid", "start_date": "date", "end_date": "date"}
}', 5, TRUE),

('workflow_trigger_events', 'event_config', 'Job Requisition Submitted', '{
  "event_key": "job_requisition_submitted",
  "source_app": "Recruitment",
  "entity": "job_requisitions",
  "description": "Fired when a department head or manager submits a new hiring request.",
  "payload_schema": {"req_id": "uuid", "position": "string", "department": "string", "headcount": "integer", "requested_by": "uuid"}
}', 6, TRUE),

('workflow_trigger_events', 'event_config', 'Review Cycle Opened', '{
  "event_key": "performance_cycle_opened",
  "source_app": "Performance",
  "entity": "performance_cycles",
  "description": "Fired when a new performance review cycle is activated and made visible to participants.",
  "payload_schema": {"cycle_id": "uuid", "name": "string", "type": "string", "deadline": "date"}
}', 7, TRUE),

('workflow_trigger_events', 'event_config', 'Employee Exit Initiated', '{
  "event_key": "employee_exit_initiated",
  "source_app": "Employee Directory",
  "entity": "employees",
  "description": "Fired when an employee exit/offboarding process is formally initiated in the directory.",
  "payload_schema": {"employee_id": "uuid", "last_working_day": "date", "exit_reason": "string"}
}', 8, TRUE),

('workflow_trigger_events', 'event_config', 'Onboarding Task Overdue', '{
  "event_key": "onboarding_task_overdue",
  "source_app": "Onboarding",
  "entity": "onboarding_tasks",
  "description": "Fired by a scheduled job when an onboarding task has not been completed by its due date.",
  "payload_schema": {"task_id": "uuid", "onboarding_id": "uuid", "employee_id": "uuid", "task_title": "string", "due_date": "date"}
}', 9, TRUE),

('workflow_trigger_events', 'event_config', 'Probation Review Due', '{
  "event_key": "probation_review_due",
  "source_app": "Onboarding",
  "entity": "onboarding_records",
  "description": "Fired 7 days before an employee probation period end date by a scheduled job.",
  "payload_schema": {"onboarding_id": "uuid", "employee_id": "uuid", "probation_end_date": "date"}
}', 10, TRUE),

('workflow_trigger_events', 'event_config', 'Training Compliance Overdue', '{
  "event_key": "training_compliance_overdue",
  "source_app": "Training",
  "entity": "training_enrollments",
  "description": "Fired when a mandatory course enrollment has not been completed by its compliance deadline.",
  "payload_schema": {"enrollment_id": "uuid", "employee_id": "uuid", "course_id": "uuid", "days_overdue": "integer"}
}', 11, TRUE),

('workflow_trigger_events', 'event_config', 'Announcement Published', '{
  "event_key": "announcement_published",
  "source_app": "Communications",
  "entity": "communications_posts",
  "description": "Fired when an announcement is published and made visible to its target audience.",
  "payload_schema": {"post_id": "uuid", "title": "string", "priority": "string", "audience": "string", "published_by": "uuid"}
}', 12, TRUE),

('workflow_trigger_events', 'event_config', 'Workflow Step Pending Approval', '{
  "event_key": "workflow_step_pending_approval",
  "source_app": "Workflow Automation",
  "entity": "workflow_approvals",
  "description": "Fired when a workflow step requires action from a designated approver.",
  "payload_schema": {"workflow_name": "string", "step_name": "string", "triggered_by": "uuid", "step_context": "string"}
}', 13, TRUE)

ON CONFLICT (entity, field, value) DO NOTHING;


-- ============================================================
-- SECTION 20: NOTIFICATION_TEMPLATES
-- Stored in master_value_helps (entity='notification_templates').
-- The email_templates table is used for email content; this
-- entity captures the in-app / push notification template config.
-- ============================================================

INSERT INTO master_value_helps (entity, field, label, value, sort_order, is_active) VALUES
('notification_templates', 'template_config', 'Leave Application Notification', '{
  "app": "Employee Dashboard",
  "event_key": "leave_applied",
  "title_template": "Leave Request: {type} from {start_date} to {end_date}",
  "body_template": "{employee_name} has applied for {days} day(s) of {type} leave from {start_date} to {end_date}. Please review and approve or reject the request.",
  "type": "action_required",
  "channels": ["in_app", "push", "email"]
}', 1, TRUE),

('notification_templates', 'template_config', 'Candidate Hired — Onboarding Kickoff', '{
  "app": "Recruitment",
  "event_key": "candidate_hired",
  "title_template": "New Hire: {name} joining on {joining_date}",
  "body_template": "Candidate {name} has been marked as hired for the position of {position} in {department}. Their joining date is {joining_date}. Please initiate the onboarding checklist.",
  "type": "action_required",
  "channels": ["in_app", "email"]
}', 2, TRUE),

('notification_templates', 'template_config', 'Performance Cycle Opened', '{
  "app": "Performance",
  "event_key": "performance_cycle_opened",
  "title_template": "Performance Review Cycle ''{name}'' is now open",
  "body_template": "The {type} review cycle ''{name}'' has been opened. Please complete your self-assessment and submit your goals before {deadline}.",
  "type": "info",
  "channels": ["in_app", "push", "email"]
}', 3, TRUE),

('notification_templates', 'template_config', 'Training Compliance Overdue', '{
  "app": "Training",
  "event_key": "training_compliance_overdue",
  "title_template": "Action Required: Overdue Training — {course_name}",
  "body_template": "You have a mandatory training course that is {days_overdue} day(s) overdue. Please log in to the Training module and complete ''{course_name}'' immediately to remain compliant.",
  "type": "warning",
  "channels": ["in_app", "push", "email"]
}', 4, TRUE),

('notification_templates', 'template_config', 'Workflow Step Pending Approval', '{
  "app": "Workflow Automation",
  "event_key": "workflow_step_pending_approval",
  "title_template": "Approval Required: {workflow_name} — Step ''{step_name}''",
  "body_template": "A workflow step requires your approval. Workflow: {workflow_name}. Triggered by: {triggered_by}. Step: {step_name}. Context: {step_context}. Please review and approve or reject in the Workflow Automation app.",
  "type": "action_required",
  "channels": ["in_app", "push", "email"]
}', 5, TRUE)

ON CONFLICT (entity, field, value) DO NOTHING;

-- Seed compliance frameworks
INSERT INTO compliance_frameworks (name, version, description) VALUES
  ('GDPR', 'GDPR 2018', 'General Data Protection Regulation'),
  ('HIPAA', 'HIPAA 1996', 'Health Insurance Portability and Accountability Act'),
  ('SOC2', 'SOC2 2017', 'Service Organization Control 2'),
  ('ISO27001', 'ISO 27001:2013', 'Information Security Management System'),
  ('PCI-DSS', 'PCI-DSS v4.0', 'Payment Card Industry Data Security Standard'),
  ('NIST', 'NIST CSF v1.1', 'NIST Cybersecurity Framework'),
  ('CCPA', 'CCPA 2020', 'California Consumer Privacy Act')
ON CONFLICT (name) DO NOTHING;

-- Seed doc_apps from existing portal apps
INSERT INTO doc_apps (name, icon, description, route, category, sort_order) VALUES
  ('Employee Dashboard', '🏠', 'Personal dashboard with KPIs, tasks, and notifications', '/dashboard', 'HR', 1),
  ('Employee Directory', '👥', 'Browse and manage employee profiles and org chart', '/directory', 'HR', 2),
  ('Recruitment Tracker', '🎯', 'Manage job postings, candidates, and hiring pipeline', '/recruitment', 'HR', 3),
  ('Onboarding', '🚀', 'New hire onboarding checklists and preboarding portal', '/onboarding', 'HR', 4),
  ('Performance Management', '📊', 'Set goals, conduct reviews, and track performance', '/performance', 'HR', 5),
  ('Training & Learning', '📚', 'Browse courses, track progress, and get certified', '/training', 'HR', 6),
  ('Communications Hub', '📢', 'Post announcements, polls, and team messages', '/communications', 'Communications', 7),
  ('Team Collaboration', '💬', 'Real-time chat, channels, and file sharing', '/collaboration', 'Communications', 8),
  ('Project Management', '📋', 'Manage projects, tasks, sprints, and timelines', '/projects', 'Operations', 9),
  ('IT Service Management', '🖥️', 'Submit and track IT support tickets', '/it-services', 'Operations', 10),
  ('Asset Management', '🏷️', 'Track company assets and assignments', '/assets', 'Operations', 11),
  ('Defect Tracker', '🐛', 'Report and track software defects and bugs', '/defects', 'Operations', 12),
  ('OKR Management', '🎯', 'Set and track objectives and key results', '/okr', 'Business', 13),
  ('Executive Dashboard', '📈', 'Company-wide KPIs and executive metrics', '/executive-dashboard', 'Business', 14),
  ('Advanced Analytics', '📉', 'Deep analytics across all domains', '/analytics', 'Business', 15),
  ('Security & Compliance', '🔒', 'Audit logs, compliance frameworks, and privacy requests', '/security', 'Business', 16),
  ('Invoice Generation', '🧾', 'Create, send, and track client invoices', '/invoices', 'Finance', 17),
  ('Payroll Management', '💰', 'Process payroll with statutory deductions', '/payroll', 'Finance', 18),
  ('Advanced Features', '⚡', 'Custom reports, integrations, and automation studio', '/advanced-features', 'Admin', 19),
  ('Documentation', '📖', 'Help guides, FAQs, and video tutorials', '/documentation', 'Admin', 20),
  ('User Management', '👤', 'Manage users, roles, and permissions', '/user-management', 'Admin', 21),
  ('Workflow Automation', '⚙️', 'Automate business processes and approvals', '/workflow-automation', 'Admin', 22)
ON CONFLICT DO NOTHING;

-- Seed Professional Tax slabs (7 states)
INSERT INTO professional_tax_slabs (state, income_from, income_to, monthly_pt, annual_pt) VALUES
  -- Maharashtra
  ('Maharashtra', 0, 7500, 0, 0),
  ('Maharashtra', 7501, 10000, 175, 2100),
  ('Maharashtra', 10001, NULL, 200, 2400),
  -- Karnataka
  ('Karnataka', 0, 15000, 0, 0),
  ('Karnataka', 15001, 25000, 150, 1800),
  ('Karnataka', 25001, NULL, 200, 2400),
  -- West Bengal
  ('West Bengal', 0, 8500, 0, 0),
  ('West Bengal', 8501, 10000, 90, 1080),
  ('West Bengal', 10001, NULL, 110, 1320),
  -- Tamil Nadu
  ('Tamil Nadu', 0, 3500, 0, 0),
  ('Tamil Nadu', 3501, NULL, 208, 2496),
  -- Gujarat
  ('Gujarat', 0, 6000, 0, 0),
  ('Gujarat', 6001, NULL, 200, 2400),
  -- Andhra Pradesh
  ('Andhra Pradesh', 0, 15000, 0, 0),
  ('Andhra Pradesh', 15001, 20000, 150, 1800),
  ('Andhra Pradesh', 20001, NULL, 200, 2400),
  -- Telangana
  ('Telangana', 0, 15000, 0, 0),
  ('Telangana', 15001, 20000, 150, 1800),
  ('Telangana', 20001, NULL, 200, 2400)
ON CONFLICT (state, income_from) DO NOTHING;

-- ========================
-- WORKFLOW TRIGGER EVENTS (new events for business apps)
-- ========================

-- Add new trigger events to workflow_trigger_events if that table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='workflow_trigger_events') THEN
    INSERT INTO workflow_trigger_events (event_key, app, description, payload_schema) VALUES
      ('okr_checkin_missed', 'OKR Management', 'OKR owner missed weekly check-in', '{"okr_id":"uuid","employee_id":"uuid","okr_title":"string","days_since_last_checkin":"integer"}'),
      ('okr_behind_midcycle', 'OKR Management', 'OKR score below 0.4 at cycle midpoint', '{"okr_id":"uuid","employee_id":"uuid","score":"decimal","cycle_id":"uuid"}'),
      ('okr_blocker_flagged', 'OKR Management', 'A check-in was logged with blocker=true', '{"okr_id":"uuid","employee_id":"uuid","blocker_description":"string","manager_id":"uuid"}'),
      ('invoice_overdue', 'Invoice', 'Invoice is past due date and unpaid', '{"invoice_id":"uuid","invoice_number":"string","client_name":"string","amount":"decimal","overdue_days":"integer"}'),
      ('payroll_processing_due', 'Payroll', 'Payroll month approaching scheduled processing day', '{"month":"integer","year":"integer","employee_count":"integer"}'),
      ('critical_audit_event', 'Security', 'A severity=critical audit event detected', '{"event_id":"uuid","user_email":"string","action":"string","resource":"string"}')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- File: 03_platform_services.sql
-- Purpose: Notifications, push delivery, analytics anomalies, and reports
-- ────────────────────────────────────────────────────────────

-- ============================================================
-- JESHAN LABS HR PORTAL - 03_platform_services.sql
-- Notifications, push delivery, analytics anomalies, and reports.
-- Consolidated from legacy migrations 03-04.
-- Idempotent: safe to run repeatedly after 01_schema.sql.
-- ============================================================

-- >>> LEGACY SOURCE: 03_notifications_and_push.sql

-- ============================================================
-- JESHAN LABS HR PORTAL — NOTIFICATIONS & PUSH
-- Source: 12_notifications_complete.sql
-- Fully idempotent: safe to run multiple times.
-- ============================================================

-- ============================================================
-- 12_notifications_complete.sql
-- Complete notification system setup — idempotent, safe to re-run.
-- Supersedes and merges: 08, 09, 10, 11 migrations.
-- ============================================================

-- ============================================================
-- SECTION 1: Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Run defect inactivity warnings and auto-closure hourly. Re-scheduling by
-- stable job name keeps this migration idempotent.
DO $$
DECLARE
  existing_job_id BIGINT;
BEGIN
  SELECT jobid
    INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'defect-auto-closure'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'defect-auto-closure',
    '15 * * * *',
    'SELECT public.process_defect_auto_closure();'
  );
END;
$$;

-- ============================================================
-- SECTION 2: push_subscriptions table
-- user_id TEXT to match notifications.user_id
-- ============================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    text        NOT NULL,
  endpoint   text        NOT NULL UNIQUE,
  p256dh     text        NOT NULL,
  auth       text        NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can manage their own push subscriptions"
  ON push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Service role can manage push_subscriptions" ON push_subscriptions;
CREATE POLICY "Service role can manage push_subscriptions"
  ON push_subscriptions FOR ALL TO service_role USING (true);

-- ============================================================
-- SECTION 3: notifications table — add missing columns
-- The base table exists in 01_schema.sql; this adds columns
-- that the frontend depends on.
-- ============================================================
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS is_read       boolean     DEFAULT false,
  ADD COLUMN IF NOT EXISTS app_filter    text        DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS severity      text        DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS deep_link     text,
  ADD COLUMN IF NOT EXISTS action_data   jsonb,
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz,
  ADD COLUMN IF NOT EXISTS read_at       timestamptz,
  ADD COLUMN IF NOT EXISTS metadata      jsonb;

-- Keep legacy "read" boolean and new is_read in sync.
-- "read" is a reserved keyword and must be double-quoted.
CREATE OR REPLACE FUNCTION sync_notification_read_columns()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_read IS TRUE THEN
      NEW."read" := TRUE;
    ELSIF NEW."read" IS TRUE THEN
      NEW.is_read := TRUE;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_read IS DISTINCT FROM OLD.is_read THEN
      NEW."read" := NEW.is_read;
    ELSIF NEW."read" IS DISTINCT FROM OLD."read" THEN
      NEW.is_read := NEW."read";
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_read_cols ON notifications;
CREATE TRIGGER sync_read_cols
  BEFORE INSERT OR UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION sync_notification_read_columns();

-- ============================================================
-- SECTION 4: notification_preferences table
-- Already exists from 05_hr_spec_gaps.sql with employee_id.
-- Add user_id TEXT + quiet-hours columns if missing.
-- ============================================================
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS user_id             text,
  ADD COLUMN IF NOT EXISTS quiet_hours_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiet_hours_start   text    DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS quiet_hours_end     text    DEFAULT '07:00';

-- Unique index on user_id (partial — only for non-null values)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_notif_prefs_user_id'
  ) THEN
    CREATE UNIQUE INDEX idx_notif_prefs_user_id
      ON notification_preferences(user_id)
      WHERE user_id IS NOT NULL;
  END IF;
END;
$$;

-- ============================================================
-- SECTION 5: RLS policies
--
-- notifications:
--   - INSERT: any authenticated user (inserts target other users)
--   - SELECT/UPDATE: open to authenticated (app layer filters by user_id;
--     user_id is inserted inconsistently as auth UUID / app_users.id /
--     employee_id so a column-level policy cannot reliably match all cases)
--
-- app_users:
--   - SELECT: open to authenticated (roles/names are internal, not sensitive)
-- ============================================================

-- Drop any existing conflicting notification policies
DO $$
DECLARE pol text;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'notifications' AND schemaname = 'public'
      AND policyname NOT IN ('Service role can manage notifications')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON notifications', pol);
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated users can read notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated users can update notifications" ON notifications;
CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read notifications"
  ON notifications FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (true);

-- Drop any existing app_users SELECT policies and create a clean one
DO $$
DECLARE pol text;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'app_users' AND schemaname = 'public'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON app_users', pol);
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS "Authenticated users can read app_users" ON app_users;
CREATE POLICY "Authenticated users can read app_users"
  ON app_users FOR SELECT TO authenticated
  USING (true);

-- ============================================================
-- SECTION 6: push notification functions + trigger
-- ============================================================
CREATE OR REPLACE FUNCTION send_push_to_user(
  p_user_id text,
  p_title   text,
  p_body    text,
  p_link    text DEFAULT '/'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sub     record;
  v_payload jsonb;
BEGIN
  v_payload := jsonb_build_object('title', p_title, 'body', p_body, 'link', p_link);
  FOR v_sub IN
    SELECT endpoint FROM push_subscriptions WHERE user_id = p_user_id
  LOOP
    PERFORM net.http_post(
      url     := v_sub.endpoint,
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body    := v_payload::text
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_push_on_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  BEGIN
    PERFORM send_push_to_user(
      NEW.user_id,
      NEW.title,
      COALESCE(NEW.message, ''),
      COALESCE(NEW.metadata->>'link', '/')
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_on_notification_insert ON notifications;
CREATE TRIGGER push_on_notification_insert
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION trigger_push_on_notification();

-- ============================================================
-- SECTION 7: Realtime — add notifications to publication
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END;
$$;

-- ============================================================
-- SECTION 8: Rebuild index on notifications
-- ============================================================
DROP INDEX IF EXISTS idx_notifications_user;
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications(user_id, is_read, created_at DESC);

-- ============================================================
-- VAPID private key: run ONCE manually if not already stored:
--
--   SELECT vault.create_secret(
--     'EdnX7O-X8cVrQcgBuLlqubsbFo1w586rYk1wGu9JRFI',
--     'vapid_private_key'
--   );
-- ============================================================

-- >>> LEGACY SOURCE: 04_analytics_anomalies.sql

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

-- ────────────────────────────────────────────────────────────
-- File: 04_security_and_access.sql
-- Purpose: RLS, grants, JWT role claims, and anonymous-access lockdown
-- ────────────────────────────────────────────────────────────

-- ============================================================
-- JESHAN LABS HR PORTAL - 04_security_and_access.sql
-- RLS, grants, JWT role claims, and anonymous-access lockdown.
-- Consolidated in effective execution order from legacy security migrations.
-- Idempotent: policies are dropped/replaced or guarded before creation.
-- ============================================================

-- >>> LEGACY SOURCE: 05_rls_security.sql

-- ──────────────────────────────────────────────────────────────────────────────
-- Migration: Enforce authentication on all RLS policies
-- Remove all policies that allow the anon role to access sensitive tables.
-- After this migration, every table in the application requires a valid
-- Supabase user session (authenticated role) to read or write data.
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. Drop the explicitly permissive anonymous read policy on employees.
DROP POLICY IF EXISTS "Allow anonymous read on employees" ON employees;

-- 2. Revoke all direct privileges from the anon role on sensitive tables.
--    This is a belt-and-suspenders control on top of RLS — even if a policy
--    has USING (true) with no role restriction, the anon role can't access the
--    table without a privilege grant.
DO $$
DECLARE
  tbl TEXT;
  sensitive_tables TEXT[] := ARRAY[
    'employees',
    'payroll_records',
    'payroll_components',
    'payroll_run_items',
    'payroll_runs',
    'it_tickets',
    'it_ticket_updates',
    'training_courses',
    'training_enrollments',
    'performance_reviews',
    'performance_goals',
    'projects',
    'project_tasks',
    'project_sprints',
    'project_time_logs',
    'project_comments',
    'defect_tracker_projects',
    'defect_tracker_defects',
    'assets',
    'asset_assignments',
    'asset_maintenance',
    'okr',
    'key_results',
    'okr_check_ins',
    'invoices',
    'invoice_items',
    'invoice_payments',
    'recruitment_jobs',
    'recruitment_candidates',
    'recruitment_applications',
    'onboarding_tasks',
    'onboarding_assignments',
    'employee_documents',
    'employee_notes',
    'employee_leaves',
    'leave_requests',
    'communications',
    'communication_participants',
    'notifications',
    'push_subscriptions',
    'workflow_definitions',
    'workflow_instances',
    'workflow_approvals',
    'knowledge_articles',
    'knowledge_categories',
    'master_data_config',
    'app_permissions',
    'audit_logs',
    'analytics_anomalies',
    'scheduled_reports'
  ];
BEGIN
  FOREACH tbl IN ARRAY sensitive_tables LOOP
    -- Only revoke if the table actually exists to avoid errors on partial schemas.
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('REVOKE ALL ON %I FROM anon', tbl);
    END IF;
  END LOOP;
END $$;

-- 3. Drop any remaining policies on sensitive tables that do not restrict to
--    the authenticated role (i.e., policies that implicitly include anon).
--    We identify them by checking pg_policies.roles — if it's empty/null or
--    contains 'public', it applies to all roles including anon.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (roles IS NULL OR roles = '{}' OR 'public' = ANY(roles))
      AND tablename NOT IN ('preboarding_submissions')  -- intentionally public
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 4. Re-create standard authenticated-only policies for the tables that had
--    their policies dropped above. These grant full access to any authenticated
--    user; row-level filtering is handled in application queries.

DO $$
DECLARE
  tbl TEXT;
  standard_tables TEXT[] := ARRAY[
    'employees',
    'payroll_records',
    'payroll_components',
    'payroll_run_items',
    'payroll_runs',
    'it_tickets',
    'it_ticket_updates',
    'training_courses',
    'training_enrollments',
    'performance_reviews',
    'performance_goals',
    'projects',
    'project_tasks',
    'project_sprints',
    'project_time_logs',
    'project_comments',
    'defect_tracker_projects',
    'defect_tracker_defects',
    'assets',
    'asset_assignments',
    'asset_maintenance',
    'okr',
    'key_results',
    'okr_check_ins',
    'invoices',
    'invoice_items',
    'invoice_payments',
    'recruitment_jobs',
    'recruitment_candidates',
    'recruitment_applications',
    'onboarding_tasks',
    'onboarding_assignments',
    'employee_documents',
    'employee_notes',
    'employee_leaves',
    'leave_requests',
    'communications',
    'communication_participants',
    'notifications',
    'push_subscriptions',
    'workflow_definitions',
    'workflow_instances',
    'workflow_approvals',
    'knowledge_articles',
    'knowledge_categories',
    'master_data_config',
    'app_permissions',
    'audit_logs',
    'analytics_anomalies',
    'scheduled_reports'
  ];
BEGIN
  FOREACH tbl IN ARRAY standard_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      -- Ensure RLS is enabled on the table.
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

      -- Create authenticated all-access policy only if none exists yet.
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = tbl
          AND policyname = 'Authenticated users full access'
      ) THEN
        EXECUTE format(
          'CREATE POLICY "Authenticated users full access" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
          tbl
        );
      END IF;
    END IF;
  END LOOP;
END $$;

-- 5. preboarding_submissions stays accessible to anon so that candidates can
--    submit their pre-boarding form before they have a Supabase account.
--    All other tables require authentication.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'preboarding_submissions'
  ) THEN
    ALTER TABLE preboarding_submissions ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'preboarding_submissions'
        AND policyname = 'Preboarding submissions public insert'
    ) THEN
      CREATE POLICY "Preboarding submissions public insert"
        ON preboarding_submissions FOR INSERT TO anon WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'preboarding_submissions'
        AND policyname = 'Preboarding submissions authenticated read'
    ) THEN
      CREATE POLICY "Preboarding submissions authenticated read"
        ON preboarding_submissions FOR SELECT TO authenticated USING (true);
    END IF;
  END IF;
END $$;

-- >>> LEGACY SOURCE: 06_rls_fix.sql

-- ──────────────────────────────────────────────────────────────────────────────
-- Migration 06: Enforce authenticated-only access on all sensitive tables.
-- Uses direct SQL statements (no loops) to avoid deadlocks.
-- Run each section separately in the SQL editor if needed.
-- ──────────────────────────────────────────────────────────────────────────────

-- ── SECTION 1: Enable RLS on every sensitive table ───────────────────────────
ALTER TABLE IF EXISTS employees               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payroll_records         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payroll_components      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payroll_run_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payroll_runs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS it_tickets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS it_ticket_updates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS training_courses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS training_enrollments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS performance_reviews     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS performance_goals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS projects                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_sprints         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_time_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS defect_tracker_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS defect_tracker_defects  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_defects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assets                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS asset_assignments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS asset_maintenance       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS okr                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS key_results             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS okr_check_ins           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoices                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoice_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoice_payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS recruitment_jobs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS recruitment_candidates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS recruitment_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS onboarding_tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS onboarding_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS employee_documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS employee_notes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS employee_leaves         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS leave_requests          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS communications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS communication_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS push_subscriptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workflow_definitions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workflow_instances      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workflow_approvals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS knowledge_articles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS knowledge_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS master_data_config      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS app_permissions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS analytics_anomalies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scheduled_reports       ENABLE ROW LEVEL SECURITY;

-- ── SECTION 2: Revoke anon access / grant authenticated only ─────────────────
-- REVOKE has no IF EXISTS, so we check table existence first.
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'employees', 'it_tickets', 'payroll_records', 'training_enrollments',
    'performance_reviews', 'projects', 'project_tasks', 'assets',
    'okr', 'key_results', 'invoices', 'recruitment_jobs',
    'recruitment_candidates', 'payroll_components', 'payroll_run_items',
    'payroll_runs', 'it_ticket_updates', 'training_courses',
    'performance_goals', 'project_sprints', 'project_time_logs',
    'project_comments', 'defect_tracker_projects', 'defect_tracker_defects', 'project_defects',
    'asset_assignments', 'asset_maintenance', 'okr_check_ins',
    'invoice_items', 'invoice_payments', 'recruitment_applications',
    'onboarding_tasks', 'onboarding_assignments', 'employee_documents',
    'employee_notes', 'employee_leaves', 'leave_requests',
    'communications', 'communication_participants', 'notifications',
    'push_subscriptions', 'workflow_definitions', 'workflow_instances',
    'workflow_approvals', 'knowledge_articles', 'knowledge_categories',
    'master_data_config', 'app_permissions', 'audit_logs',
    'analytics_anomalies', 'scheduled_reports'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %I FROM anon', tbl);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO authenticated', tbl);
    END IF;
  END LOOP;
END $$;

-- ── SECTION 3: Drop known permissive anon policies ───────────────────────────
DO $$
DECLARE
  rec TEXT[];
  known TEXT[][] := ARRAY[
    ARRAY['employees',               'Allow anonymous read on employees'],
    ARRAY['employees',               'Allow all operations on employees'],
    ARRAY['employees',               'Enable read access for all users'],
    ARRAY['it_tickets',              'Allow all operations on it_tickets'],
    ARRAY['payroll_records',         'Allow all operations on payroll_records'],
    ARRAY['training_enrollments',    'Allow all operations on training_enrollments'],
    ARRAY['performance_reviews',     'Allow all operations on performance_reviews'],
    ARRAY['projects',                'Allow all operations on projects'],
    ARRAY['project_tasks',           'Allow all operations on project_tasks'],
    ARRAY['assets',                  'Allow all operations on assets'],
    ARRAY['okr',                     'Allow all operations on okr'],
    ARRAY['key_results',             'Allow all operations on key_results'],
    ARRAY['invoices',                'Allow all operations on invoices'],
    ARRAY['recruitment_jobs',        'Allow all operations on recruitment_jobs'],
    ARRAY['recruitment_candidates',  'Allow all operations on recruitment_candidates']
  ];
BEGIN
  FOREACH rec SLICE 1 IN ARRAY known LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = rec[1]
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', rec[2], rec[1]);
    END IF;
  END LOOP;
END $$;

-- ── SECTION 4: Create authenticated-only policies (skip if already exists) ───
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='employees' AND policyname='Authenticated users full access') THEN
    CREATE POLICY "Authenticated users full access" ON employees FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='it_tickets' AND policyname='Authenticated users full access') THEN
    CREATE POLICY "Authenticated users full access" ON it_tickets FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payroll_records' AND policyname='Authenticated users full access') THEN
    CREATE POLICY "Authenticated users full access" ON payroll_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='training_enrollments' AND policyname='Authenticated users full access') THEN
    CREATE POLICY "Authenticated users full access" ON training_enrollments FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='performance_reviews' AND policyname='Authenticated users full access') THEN
    CREATE POLICY "Authenticated users full access" ON performance_reviews FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='projects' AND policyname='Authenticated users full access') THEN
    CREATE POLICY "Authenticated users full access" ON projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='project_tasks' AND policyname='Authenticated users full access') THEN
    CREATE POLICY "Authenticated users full access" ON project_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='assets' AND policyname='Authenticated users full access') THEN
    CREATE POLICY "Authenticated users full access" ON assets FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='okr')
    AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='okr' AND policyname='Authenticated users full access')
  THEN
    CREATE POLICY "Authenticated users full access" ON okr FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='key_results')
    AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='key_results' AND policyname='Authenticated users full access')
  THEN
    CREATE POLICY "Authenticated users full access" ON key_results FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoices' AND policyname='Authenticated users full access') THEN
    CREATE POLICY "Authenticated users full access" ON invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='recruitment_jobs' AND policyname='Authenticated users full access') THEN
    CREATE POLICY "Authenticated users full access" ON recruitment_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='recruitment_candidates' AND policyname='Authenticated users full access') THEN
    CREATE POLICY "Authenticated users full access" ON recruitment_candidates FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='project_defects')
    AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='project_defects' AND policyname='Authenticated users full access')
  THEN
    CREATE POLICY "Authenticated users full access" ON project_defects FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── SECTION 5: Diagnostic — verify the fix ───────────────────────────────────
-- Run this after the migration. anon_has_select should be FALSE for all rows.
SELECT
  t.table_name,
  c.relrowsecurity AS rls_enabled,
  EXISTS (
    SELECT 1 FROM information_schema.role_table_grants g
    WHERE g.table_schema = 'public'
      AND g.table_name = t.table_name
      AND g.grantee = 'anon'
      AND g.privilege_type = 'SELECT'
  ) AS anon_has_select
FROM information_schema.tables t
JOIN pg_class c ON c.relname = t.table_name AND c.relnamespace = 'public'::regnamespace
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND t.table_name IN (
    'employees','it_tickets','payroll_records','training_enrollments',
    'performance_reviews','projects','project_tasks','assets','okr',
    'key_results','invoices','recruitment_jobs','recruitment_candidates'
  )
ORDER BY t.table_name;

-- >>> LEGACY SOURCE: 15_notifications_rls_fix.sql

-- Migration 15: Fix notifications RLS — allow authenticated users to update
-- and delete their own notifications.
--
-- Root cause: the base notifications table uses user_id TEXT (matching either
-- auth.users.id or app_users.id). We widen the UPDATE policy (already done in
-- migration 03, but re-applied here for idempotency) and add a DELETE policy
-- so the bell tray delete/delete-all-read operations actually persist to the DB.

-- ── UPDATE ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated users can update notifications" ON notifications;

CREATE POLICY "Authenticated users can update notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── DELETE ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can delete notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;

CREATE POLICY "Authenticated users can delete notifications"
  ON notifications FOR DELETE TO authenticated
  USING (true);

-- >>> LEGACY SOURCE: 20_enforce_auth_rls.sql

-- Migration 20: Enforce authenticated-only access across ALL tables
-- Drops any remaining open policies (USING (true) without a role restriction)
-- and ensures every table requires auth.uid() IS NOT NULL before returning data.

-- ── 1. Fix task_comments (migration 18 left these open to anon) ──────────────
DROP POLICY IF EXISTS "task_comments_select" ON task_comments;
DROP POLICY IF EXISTS "task_comments_insert" ON task_comments;
DROP POLICY IF EXISTS "task_comments_update" ON task_comments;
DROP POLICY IF EXISTS "task_comments_delete" ON task_comments;

CREATE POLICY "task_comments_select" ON task_comments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "task_comments_insert" ON task_comments
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "task_comments_update" ON task_comments
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "task_comments_delete" ON task_comments
  FOR DELETE TO authenticated USING (true);

-- ── 2. Ensure RLS is enabled and authenticated-only on every table ────────────
-- This loop runs over ALL user tables, enables RLS if not already on,
-- drops any open anon-accessible policies, and adds a catch-all authenticated
-- policy if none exists yet. Tables with existing fine-grained policies keep them.
DO $$
DECLARE
  tbl  TEXT;
  pol  TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    -- Exclude Supabase internal tables
    AND tablename NOT IN (
      'schema_migrations', 'spatial_ref_sys', 'geography_columns',
      'geometry_columns', 'raster_columns', 'raster_overviews'
    )
  LOOP
    -- Enable RLS (idempotent)
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    -- Drop policies that are open to anon / public (no role or TO public/anon)
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = tbl
        AND (roles = '{public}' OR roles = '{anon}' OR roles IS NULL OR roles = '{}')
        -- Keep preboarding_submissions anon INSERT (external candidates)
        AND NOT (tbl = 'preboarding_submissions' AND cmd = 'INSERT')
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol, tbl);
    END LOOP;

    -- Add a default authenticated catch-all if the table has NO policies at all
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
    ) THEN
      EXECUTE format(
        'CREATE POLICY "Authenticated users full access" ON %I
         FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        tbl
      );
    END IF;
  END LOOP;
END $$;

-- ── 3. Revoke anon SELECT on all public tables ────────────────────────────────
-- Belt-and-suspenders: even if a policy is misconfigured, the anon role
-- has no table-level SELECT grant.
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    AND tablename NOT IN ('preboarding_submissions')
  LOOP
    EXECUTE format('REVOKE SELECT, INSERT, UPDATE, DELETE ON %I FROM anon', tbl);
  END LOOP;
END $$;

-- ── 4. Grant authenticated role full access on all tables ─────────────────────
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO authenticated', tbl
    );
  END LOOP;
END $$;

-- >>> LEGACY SOURCE: 21_auth_hook_and_row_rls.sql

-- Migration 21: Auth Hook + Row-Level RLS Policies
--
-- PART A: Supabase Custom Access Token Hook
--   Embeds the user's role and employee_id into the JWT on every login.
--   After applying this SQL, enable the hook manually in the Supabase Dashboard:
--     Authentication → Hooks → Custom Access Token → select function
--     "public.custom_access_token_hook"
--
-- PART B: Row-level RLS policies for sensitive tables
--   Employees can only read their OWN data (payroll, leaves, performance,
--   attendance). HR/admin/finance/manager can read all rows.

-- ============================================================
-- PART A — Custom Access Token Hook
-- ============================================================

-- Allow the supabase_auth_admin role to call this function
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims      jsonb;
  user_role   text;
  emp_id      text;
BEGIN
  -- Guard: if event is somehow null, return a minimal valid object
  IF event IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  -- COALESCE ensures claims is always an object even if the key is absent
  claims := COALESCE(event -> 'claims', '{}'::jsonb);

  -- Inner block so a DB lookup failure does not abort the whole hook
  BEGIN
    SELECT
      COALESCE(primary_role, 'employee'),
      employee_id::text
    INTO user_role, emp_id
    FROM public.app_users
    WHERE auth_user_id = (event ->> 'user_id')::uuid
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    user_role := 'employee';
    emp_id    := NULL;
  END;

  user_role := COALESCE(user_role, 'employee');

  claims := jsonb_set(claims, '{app_role}',   to_jsonb(user_role),         true);
  claims := jsonb_set(claims, '{app_emp_id}', to_jsonb(COALESCE(emp_id, '')), true);

  RETURN jsonb_set(event, '{claims}', claims, true);

EXCEPTION WHEN OTHERS THEN
  -- Outer safety net: never return NULL — always return event unmodified
  RETURN COALESCE(event, '{}'::jsonb);
END;
$$;

-- Grant execute to supabase_auth_admin so the hook can call it
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- ============================================================
-- PART B — Row-Level RLS Policies for sensitive tables
-- Uses auth.jwt() claims set by the hook above.
-- Falls back to a permissive policy for admin/hr/finance/manager.
-- ============================================================

-- Helper: returns the app_role claim from the JWT
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(auth.jwt() ->> 'app_role', 'employee');
$$;

-- Helper: returns the employee_id claim from the JWT
CREATE OR REPLACE FUNCTION public.get_my_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT (auth.jwt() ->> 'app_emp_id')::uuid;
$$;

-- Helper: true if the current user is an elevated role
CREATE OR REPLACE FUNCTION public.is_elevated()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT public.get_my_role() IN ('admin', 'hr', 'finance', 'manager');
$$;

-- ── payroll_records ──────────────────────────────────────────────────────────
-- Employees see only their own payroll record. HR/finance/admin/manager see all.
DROP POLICY IF EXISTS "Authenticated users full access" ON payroll_records;
DROP POLICY IF EXISTS "payroll_own_read" ON payroll_records;
DROP POLICY IF EXISTS "payroll_elevated_read" ON payroll_records;
DROP POLICY IF EXISTS "payroll_write" ON payroll_records;

CREATE POLICY "payroll_elevated_read" ON payroll_records
  FOR SELECT TO authenticated
  USING (public.is_elevated());

CREATE POLICY "payroll_own_read" ON payroll_records
  FOR SELECT TO authenticated
  USING (
    NOT public.is_elevated()
    AND employee_id = public.get_my_employee_id()
  );

CREATE POLICY "payroll_write" ON payroll_records
  FOR ALL TO authenticated
  USING (public.get_my_role() IN ('admin', 'hr', 'finance'))
  WITH CHECK (public.get_my_role() IN ('admin', 'hr', 'finance'));

-- ── leaves ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users full access" ON leaves;
DROP POLICY IF EXISTS "leaves_own_read" ON leaves;
DROP POLICY IF EXISTS "leaves_elevated_read" ON leaves;
DROP POLICY IF EXISTS "leaves_write" ON leaves;

CREATE POLICY "leaves_elevated_read" ON leaves
  FOR SELECT TO authenticated USING (public.is_elevated());

CREATE POLICY "leaves_own_read" ON leaves
  FOR SELECT TO authenticated
  USING (
    NOT public.is_elevated()
    AND employee_id = public.get_my_employee_id()
  );

CREATE POLICY "leaves_write" ON leaves
  FOR ALL TO authenticated
  USING (
    public.get_my_role() IN ('admin', 'hr', 'manager')
    OR employee_id = public.get_my_employee_id()
  )
  WITH CHECK (
    public.get_my_role() IN ('admin', 'hr', 'manager')
    OR employee_id = public.get_my_employee_id()
  );

-- ── attendance ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users full access" ON attendance;
DROP POLICY IF EXISTS "attendance_own_read" ON attendance;
DROP POLICY IF EXISTS "attendance_elevated_read" ON attendance;
DROP POLICY IF EXISTS "attendance_write" ON attendance;

CREATE POLICY "attendance_elevated_read" ON attendance
  FOR SELECT TO authenticated USING (public.is_elevated());

CREATE POLICY "attendance_own_read" ON attendance
  FOR SELECT TO authenticated
  USING (
    NOT public.is_elevated()
    AND employee_id = public.get_my_employee_id()
  );

CREATE POLICY "attendance_write" ON attendance
  FOR ALL TO authenticated
  USING (
    public.get_my_role() IN ('admin', 'hr')
    OR employee_id = public.get_my_employee_id()
  )
  WITH CHECK (
    public.get_my_role() IN ('admin', 'hr')
    OR employee_id = public.get_my_employee_id()
  );

-- ── performance_reviews ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users full access" ON performance_reviews;
DROP POLICY IF EXISTS "perf_own_read" ON performance_reviews;
DROP POLICY IF EXISTS "perf_elevated_read" ON performance_reviews;
DROP POLICY IF EXISTS "perf_write" ON performance_reviews;

CREATE POLICY "perf_elevated_read" ON performance_reviews
  FOR SELECT TO authenticated USING (public.is_elevated());

CREATE POLICY "perf_own_read" ON performance_reviews
  FOR SELECT TO authenticated
  USING (
    NOT public.is_elevated()
    AND employee_id = public.get_my_employee_id()
  );

CREATE POLICY "perf_write" ON performance_reviews
  FOR ALL TO authenticated
  USING (public.get_my_role() IN ('admin', 'hr', 'manager'))
  WITH CHECK (public.get_my_role() IN ('admin', 'hr', 'manager'));

-- ── salary_structures / salary_revision_history ──────────────────────────────
DROP POLICY IF EXISTS "Authenticated users full access" ON salary_structures;
DROP POLICY IF EXISTS "salary_own_read" ON salary_structures;
DROP POLICY IF EXISTS "salary_elevated_all" ON salary_structures;

CREATE POLICY "salary_elevated_all" ON salary_structures
  FOR ALL TO authenticated
  USING (public.get_my_role() IN ('admin', 'hr', 'finance'))
  WITH CHECK (public.get_my_role() IN ('admin', 'hr', 'finance'));

CREATE POLICY "salary_own_read" ON salary_structures
  FOR SELECT TO authenticated
  USING (
    NOT public.get_my_role() IN ('admin', 'hr', 'finance')
    AND employee_id = public.get_my_employee_id()
  );

DROP POLICY IF EXISTS "Authenticated users full access" ON salary_revision_history;
DROP POLICY IF EXISTS "sal_rev_own_read" ON salary_revision_history;
DROP POLICY IF EXISTS "sal_rev_elevated_all" ON salary_revision_history;

CREATE POLICY "sal_rev_elevated_all" ON salary_revision_history
  FOR ALL TO authenticated
  USING (public.get_my_role() IN ('admin', 'hr', 'finance'))
  WITH CHECK (public.get_my_role() IN ('admin', 'hr', 'finance'));

CREATE POLICY "sal_rev_own_read" ON salary_revision_history
  FOR SELECT TO authenticated
  USING (
    NOT public.get_my_role() IN ('admin', 'hr', 'finance')
    AND employee_id = public.get_my_employee_id()
  );

-- ── payslips ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users full access" ON payslips;
DROP POLICY IF EXISTS "payslips_own_read" ON payslips;
DROP POLICY IF EXISTS "payslips_elevated_all" ON payslips;

CREATE POLICY "payslips_elevated_all" ON payslips
  FOR ALL TO authenticated
  USING (public.get_my_role() IN ('admin', 'hr', 'finance'))
  WITH CHECK (public.get_my_role() IN ('admin', 'hr', 'finance'));

CREATE POLICY "payslips_own_read" ON payslips
  FOR SELECT TO authenticated
  USING (
    NOT public.get_my_role() IN ('admin', 'hr', 'finance')
    AND employee_id = public.get_my_employee_id()
  );

-- ── audit_logs — admin/hr only ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users full access" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_admin_hr" ON audit_logs;

CREATE POLICY "audit_logs_admin_hr" ON audit_logs
  FOR ALL TO authenticated
  USING (public.get_my_role() IN ('admin', 'hr'))
  WITH CHECK (public.get_my_role() IN ('admin', 'hr'));

-- ── app_users — admin only for sensitive operations ──────────────────────────
DROP POLICY IF EXISTS "Authenticated users full access" ON app_users;
DROP POLICY IF EXISTS "app_users_admin_all" ON app_users;
DROP POLICY IF EXISTS "app_users_self_read" ON app_users;

CREATE POLICY "app_users_admin_all" ON app_users
  FOR ALL TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- Every user can read their own app_users record
CREATE POLICY "app_users_self_read" ON app_users
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- ── role_permissions / custom_roles — admin only ──────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read role_permissions" ON role_permissions;
DROP POLICY IF EXISTS "Service role can manage role_permissions" ON role_permissions;
DROP POLICY IF EXISTS "role_permissions_admin" ON role_permissions;

CREATE POLICY "role_permissions_admin" ON role_permissions
  FOR ALL TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "Authenticated users full access" ON custom_roles;
DROP POLICY IF EXISTS "custom_roles_admin" ON custom_roles;

CREATE POLICY "custom_roles_admin" ON custom_roles
  FOR ALL TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ============================================================
-- PART B done.
-- ============================================================
-- REMINDER: After applying this migration, go to:
--   Supabase Dashboard → Authentication → Hooks
--   → Custom Access Token → set function to: public.custom_access_token_hook
-- This embeds app_role + app_emp_id into the JWT so RLS policies above
-- work without any DB lookup per row.
-- ============================================================

-- >>> LEGACY SOURCE: 22_deny_anon_rest_api.sql

-- Migration 22: Explicit anon denial on Supabase REST API
--
-- Locks down the Supabase REST API (/rest/v1/) so the anon key alone
-- cannot read any application data. Uses pg_policies (roles name[])
-- instead of pg_catalog.pg_policy (polroles oid[]) to avoid type errors.

-- ── Step 1: Drop all anon/public policies and add explicit DENY ───────────────
DO $$
DECLARE
  tbl  TEXT;
  pol  TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT IN ('preboarding_submissions')
  LOOP
    -- Drop policies that apply to the anon role or the PUBLIC pseudo-role.
    -- pg_policies.roles is name[] so @> works correctly here.
    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = tbl
        AND (
          roles @> ARRAY['anon']::name[]
          OR roles @> ARRAY['public']::name[]
        )
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol, tbl);
    END LOOP;

    -- Add an explicit DENY policy for anon (belt-and-suspenders on top of REVOKE)
    BEGIN
      EXECUTE format(
        'CREATE POLICY "deny_anon_all" ON %I
         FOR ALL TO anon
         USING (false)
         WITH CHECK (false)',
        tbl
      );
    EXCEPTION WHEN duplicate_object THEN
      NULL; -- already exists from a previous run, that is fine
    END;
  END LOOP;
END $$;

-- ── Step 2: Revoke all table-level grants from anon ───────────────────────────
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %I FROM anon', tbl);
  END LOOP;
END $$;

-- ── Step 3: Revoke sequence access from anon ──────────────────────────────────
DO $$
DECLARE seq TEXT;
BEGIN
  FOR seq IN
    SELECT sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON SEQUENCE %I FROM anon', seq);
  END LOOP;
END $$;

-- ── Step 4: Revoke schema introspection from anon ─────────────────────────────
-- Prevents PostgREST from exposing table definitions to unauthenticated callers.
REVOKE USAGE ON SCHEMA public FROM anon;

-- Grant schema access back only to authenticated roles
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- ── Step 5: Restore grants for authenticated users on all tables ──────────────
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO authenticated',
      tbl
    );
  END LOOP;
END $$;

-- Restore sequence access for authenticated users
DO $$
DECLARE seq TEXT;
BEGIN
  FOR seq IN
    SELECT sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  LOOP
    EXECUTE format(
      'GRANT USAGE, SELECT ON SEQUENCE %I TO authenticated',
      seq
    );
  END LOOP;
END $$;

-- ── Step 6: Restore minimal anon access for the preboarding form only ─────────
-- External candidates submit through this table without logging in.
GRANT USAGE ON SCHEMA public TO anon;
GRANT INSERT ON TABLE preboarding_submissions TO anon;

DROP POLICY IF EXISTS "deny_anon_all" ON preboarding_submissions;
DROP POLICY IF EXISTS "Preboarding submissions public insert" ON preboarding_submissions;

CREATE POLICY "Preboarding submissions public insert"
  ON preboarding_submissions FOR INSERT TO anon
  WITH CHECK (true);

-- >>> LEGACY SOURCE: 23_close_remaining_anon_surfaces.sql

-- Migration 23: Close anonymous access through views, RPCs, and future objects.
--
-- Migration 22 secures current public tables. This migration also covers views
-- (which do not appear in pg_tables), functions exposed through /rest/v1/rpc,
-- and objects created by later migrations.

-- PUBLIC privileges are inherited by anon, so revoke from both roles.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- Prevent newly created tables, sequences, and functions from becoming
-- anonymously accessible through PostgreSQL's default privileges.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Existing application RPCs remain available only to authenticated sessions.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- The sole intentional anonymous operation is submitting the external
-- preboarding form. It has INSERT only: no SELECT means Prefer:
-- return=representation cannot disclose the inserted or existing rows.
GRANT USAGE ON SCHEMA public TO anon;
GRANT INSERT ON TABLE public.preboarding_submissions TO anon;

REVOKE SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.preboarding_submissions FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

-- >>> LEGACY SOURCE: 24_fix_app_user_role_resolution.sql

-- Migration 24: Reconcile app_users with Supabase Auth and issue correct roles.
--
-- Legacy app_users records can have a NULL auth_user_id or a stale
-- primary_role even though roles contains an elevated role. That made the UI
-- show an administrator while API/RLS authorization treated the same user as
-- an employee.

-- Link unambiguous legacy app_users rows to auth.users by normalized email.
UPDATE public.app_users AS app_user
SET auth_user_id = auth_user.id,
    updated_at = NOW()
FROM auth.users AS auth_user
WHERE app_user.auth_user_id IS NULL
  AND auth_user.email IS NOT NULL
  AND LOWER(app_user.email) = LOWER(auth_user.email)
  AND NOT EXISTS (
    SELECT 1
    FROM public.app_users AS linked
    WHERE linked.auth_user_id = auth_user.id
  )
  AND (
    SELECT COUNT(*)
    FROM public.app_users AS candidate
    WHERE LOWER(candidate.email) = LOWER(auth_user.email)
  ) = 1;

-- Keep the stored primary role consistent with the priority already used by
-- the frontend. The JSONB `?` operator checks array membership.
UPDATE public.app_users
SET primary_role = CASE
      WHEN roles ? 'admin' THEN 'admin'
      WHEN roles ? 'hr' THEN 'hr'
      WHEN roles ? 'finance' THEN 'finance'
      WHEN roles ? 'manager' THEN 'manager'
      WHEN roles ? 'it' THEN 'it'
      WHEN roles ? 'marketing' THEN 'marketing'
      WHEN roles ? 'employee' THEN 'employee'
      WHEN primary_role IN (
        'admin', 'hr', 'finance', 'manager', 'it', 'marketing', 'employee'
      ) THEN primary_role
      ELSE 'employee'
    END,
    updated_at = NOW()
WHERE roles IS NOT NULL;

-- Issue app_role/app_emp_id from the reconciled database record. UUID matching
-- remains preferred; verified JWT email is a fallback for any row that could
-- not be backfilled.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims      jsonb;
  user_role   text;
  emp_id      text;
  jwt_email   text;
BEGIN
  IF event IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  claims := COALESCE(event -> 'claims', '{}'::jsonb);
  jwt_email := claims ->> 'email';

  BEGIN
    SELECT
      CASE
        WHEN roles ? 'admin' THEN 'admin'
        WHEN roles ? 'hr' THEN 'hr'
        WHEN roles ? 'finance' THEN 'finance'
        WHEN roles ? 'manager' THEN 'manager'
        WHEN roles ? 'it' THEN 'it'
        WHEN roles ? 'marketing' THEN 'marketing'
        WHEN roles ? 'employee' THEN 'employee'
        WHEN primary_role IN (
          'admin', 'hr', 'finance', 'manager', 'it', 'marketing', 'employee'
        ) THEN primary_role
        ELSE 'employee'
      END,
      employee_id::text
    INTO user_role, emp_id
    FROM public.app_users
    WHERE auth_user_id = (event ->> 'user_id')::uuid
       OR (
         auth_user_id IS NULL
         AND
         jwt_email IS NOT NULL
         AND LOWER(email) = LOWER(jwt_email)
       )
    ORDER BY (auth_user_id = (event ->> 'user_id')::uuid) DESC
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    user_role := 'employee';
    emp_id := NULL;
  END;

  user_role := COALESCE(user_role, 'employee');
  claims := jsonb_set(claims, '{app_role}', to_jsonb(user_role), true);
  claims := jsonb_set(
    claims,
    '{app_emp_id}',
    to_jsonb(COALESCE(emp_id, '')),
    true
  );

  RETURN jsonb_set(event, '{claims}', claims, true);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(event, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb)
  TO supabase_auth_admin;

-- >>> LEGACY SOURCE: 25_authenticated_permission_reads.sql

-- Migration 25: Permission definitions drive authenticated UI access.
--
-- All authenticated users need SELECT access to role_permissions so the
-- portal can decide which apps and sections to show. Mutations remain limited
-- to the existing admin policy and service role.

DROP POLICY IF EXISTS "Authenticated users can read role_permissions"
  ON public.role_permissions;

CREATE POLICY "Authenticated users can read role_permissions"
  ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON TABLE public.role_permissions TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- DEFECT TRACKER: PROJECT MEMBERSHIP ACCESS
-- Admins can access every defect. Other authenticated users can access defects
-- only when their linked employee record is present in project_members.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.defect_tracker_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_users AS app_user
    WHERE (
      app_user.auth_user_id = auth.uid()
      OR (
        app_user.auth_user_id IS NULL
        AND LOWER(app_user.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      )
    )
    AND (
      app_user.roles ? 'admin'
      OR app_user.primary_role = 'admin'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.defect_tracker_current_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT app_user.employee_id
      FROM public.app_users AS app_user
      WHERE (
        app_user.auth_user_id = auth.uid()
        OR LOWER(app_user.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      )
      ORDER BY (app_user.auth_user_id = auth.uid()) DESC NULLS LAST
      LIMIT 1
    ),
    (
      SELECT employee.id
      FROM public.employees AS employee
      WHERE (
        employee.auth_user_id = auth.uid()
        OR LOWER(employee.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      )
      ORDER BY (employee.auth_user_id = auth.uid()) DESC NULLS LAST
      LIMIT 1
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.defect_tracker_can_access_project(target_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.defect_tracker_is_admin()
    OR (
      target_project_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.project_members AS membership
        WHERE membership.project_id = target_project_id
          AND membership.employee_id = public.defect_tracker_current_employee_id()
      )
    );
$$;

REVOKE ALL ON FUNCTION public.defect_tracker_is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.defect_tracker_current_employee_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.defect_tracker_can_access_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.defect_tracker_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.defect_tracker_current_employee_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.defect_tracker_can_access_project(uuid) TO authenticated;

DROP POLICY IF EXISTS "Authenticated users full access" ON public.project_defects;
DROP POLICY IF EXISTS "project_defects_open_access" ON public.project_defects;
DROP POLICY IF EXISTS "project_defects_project_access" ON public.project_defects;
CREATE POLICY "project_defects_project_access"
  ON public.project_defects
  FOR ALL
  TO authenticated
  USING (public.defect_tracker_can_access_project(project_id))
  WITH CHECK (public.defect_tracker_can_access_project(project_id));

DROP POLICY IF EXISTS "Authenticated users full access" ON public.project_members;
DROP POLICY IF EXISTS "project_members_authenticated_read" ON public.project_members;
DROP POLICY IF EXISTS "project_members_admin_write" ON public.project_members;
CREATE POLICY "project_members_authenticated_read"
  ON public.project_members
  FOR SELECT
  TO authenticated
  USING (
    public.defect_tracker_is_admin()
    OR employee_id = public.defect_tracker_current_employee_id()
  );
CREATE POLICY "project_members_admin_write"
  ON public.project_members
  FOR ALL
  TO authenticated
  USING (public.defect_tracker_is_admin())
  WITH CHECK (public.defect_tracker_is_admin());

DO $$
DECLARE
  child_table text;
  child_tables text[] := ARRAY[
    'defect_comments',
    'defect_activity_log',
    'defect_linked_items',
    'defect_sla_events'
  ];
BEGIN
  FOREACH child_table IN ARRAY child_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', child_table || '_open_access', child_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', child_table || '_project_access', child_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
       USING (
         EXISTS (
           SELECT 1 FROM public.project_defects AS defect
           WHERE defect.id = %I.defect_id
             AND public.defect_tracker_can_access_project(defect.project_id)
         )
       )
       WITH CHECK (
         EXISTS (
           SELECT 1 FROM public.project_defects AS defect
           WHERE defect.id = %I.defect_id
             AND public.defect_tracker_can_access_project(defect.project_id)
         )
       )',
      child_table || '_project_access',
      child_table,
      child_table,
      child_table
    );
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- REUSABLE ENTITY ATTACHMENTS
-- Unknown entity types are denied by default. Add an explicit branch here when
-- another app integrates the shared attachment component.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.portal_attachment_can_access(
  target_entity_type TEXT,
  target_entity_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF target_entity_type = 'defect' THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.project_defects AS defect
      WHERE defect.id::TEXT = target_entity_id
        AND public.defect_tracker_can_access_project(defect.project_id)
    );
  END IF;

  RETURN FALSE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.portal_attachment_can_access(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_attachment_can_access(TEXT, TEXT) TO authenticated;

ALTER TABLE public.entity_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.entity_attachments;
DROP POLICY IF EXISTS "entity_attachments_project_read" ON public.entity_attachments;
DROP POLICY IF EXISTS "entity_attachments_project_insert" ON public.entity_attachments;
DROP POLICY IF EXISTS "entity_attachments_owner_delete" ON public.entity_attachments;

CREATE POLICY "entity_attachments_project_read"
  ON public.entity_attachments
  FOR SELECT TO authenticated
  USING (public.portal_attachment_can_access(entity_type, entity_id));

CREATE POLICY "entity_attachments_project_insert"
  ON public.entity_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()::TEXT
    AND storage_bucket = 'portal-attachments'
    AND public.portal_attachment_can_access(entity_type, entity_id)
  );

CREATE POLICY "entity_attachments_owner_delete"
  ON public.entity_attachments
  FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()::TEXT
    OR public.defect_tracker_is_admin()
  );

GRANT SELECT, INSERT, DELETE ON TABLE public.entity_attachments TO authenticated;
REVOKE UPDATE ON TABLE public.entity_attachments FROM authenticated;

DROP POLICY IF EXISTS "portal_attachments_project_read" ON storage.objects;
DROP POLICY IF EXISTS "portal_attachments_project_insert" ON storage.objects;
DROP POLICY IF EXISTS "portal_attachments_owner_delete" ON storage.objects;

CREATE POLICY "portal_attachments_project_read"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'portal-attachments'
    AND public.portal_attachment_can_access(
      (storage.foldername(name))[1],
      (storage.foldername(name))[2]
    )
  );

CREATE POLICY "portal_attachments_project_insert"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'portal-attachments'
    AND public.portal_attachment_can_access(
      (storage.foldername(name))[1],
      (storage.foldername(name))[2]
    )
  );

CREATE POLICY "portal_attachments_owner_delete"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'portal-attachments'
    AND (
      owner_id = auth.uid()::TEXT
      OR public.defect_tracker_is_admin()
    )
  );

-- ────────────────────────────────────────────────────────────
-- File: 05_business_extensions.sql
-- Purpose: Current business-module extensions and corrective migrations
-- ────────────────────────────────────────────────────────────

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
    SELECT auth_user_id::TEXT
    FROM app_users
    WHERE primary_role IN ('admin', 'hr')
       OR roles ?| ARRAY['admin', 'hr']
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
  state_code TEXT,
  fy TEXT NOT NULL DEFAULT '2025-26',
  income_from NUMERIC,
  income_to NUMERIC,
  min_salary NUMERIC NOT NULL,
  max_salary NUMERIC,
  monthly_pt NUMERIC NOT NULL,
  annual_pt NUMERIC NOT NULL,
  monthly_tax NUMERIC,
  annual_tax NUMERIC,
  effective_from DATE NOT NULL DEFAULT '2025-04-01',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reconcile the original payroll schema with the field names consumed by the
-- current Payroll UI/API. ADD COLUMN is intentionally used because CREATE
-- TABLE IF NOT EXISTS does not upgrade an already-existing table.
ALTER TABLE professional_tax_slabs ADD COLUMN IF NOT EXISTS fy TEXT NOT NULL DEFAULT '2025-26';
ALTER TABLE professional_tax_slabs ADD COLUMN IF NOT EXISTS state_code TEXT;
ALTER TABLE professional_tax_slabs ADD COLUMN IF NOT EXISTS income_from NUMERIC;
ALTER TABLE professional_tax_slabs ADD COLUMN IF NOT EXISTS income_to NUMERIC;
ALTER TABLE professional_tax_slabs ADD COLUMN IF NOT EXISTS min_salary NUMERIC;
ALTER TABLE professional_tax_slabs ADD COLUMN IF NOT EXISTS max_salary NUMERIC;
ALTER TABLE professional_tax_slabs ADD COLUMN IF NOT EXISTS monthly_pt NUMERIC;
ALTER TABLE professional_tax_slabs ADD COLUMN IF NOT EXISTS annual_pt NUMERIC;
ALTER TABLE professional_tax_slabs ADD COLUMN IF NOT EXISTS monthly_tax NUMERIC;
ALTER TABLE professional_tax_slabs ADD COLUMN IF NOT EXISTS annual_tax NUMERIC;
ALTER TABLE professional_tax_slabs ADD COLUMN IF NOT EXISTS effective_from DATE NOT NULL DEFAULT '2025-04-01';
ALTER TABLE professional_tax_slabs ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE professional_tax_slabs
SET min_salary = COALESCE(min_salary, income_from),
    max_salary = COALESCE(max_salary, income_to)
WHERE min_salary IS NULL
   OR (max_salary IS NULL AND income_to IS NOT NULL);

-- Clear and seed Karnataka PT slabs FY 2025-26
DELETE FROM professional_tax_slabs WHERE state = 'Karnataka' AND fy = '2025-26';
INSERT INTO professional_tax_slabs (
  state, state_code, fy, income_from, income_to,
  min_salary, max_salary, monthly_pt, annual_pt, monthly_tax, annual_tax
) VALUES
  ('Karnataka', 'KA', '2025-26', 0,     14999, 0,     14999, 0,   0,    0,   0),
  ('Karnataka', 'KA', '2025-26', 15000, 29999, 15000, 29999, 150, 1800, 150, 1800),
  ('Karnataka', 'KA', '2025-26', 30000, 44999, 30000, 44999, 200, 2400, 200, 2400),
  ('Karnataka', 'KA', '2025-26', 45000, 59999, 45000, 59999, 300, 3600, 300, 3600),
  ('Karnataka', 'KA', '2025-26', 60000, 74999, 60000, 74999, 400, 4800, 400, 4800),
  ('Karnataka', 'KA', '2025-26', 75000, NULL,  75000, NULL,  200, 2400, 200, 2400);  -- capped at ₹2400/yr for Karnataka

-- Maharashtra PT slabs
DELETE FROM professional_tax_slabs WHERE state = 'Maharashtra' AND fy = '2025-26';
INSERT INTO professional_tax_slabs (
  state, state_code, fy, income_from, income_to,
  min_salary, max_salary, monthly_pt, annual_pt, monthly_tax, annual_tax
) VALUES
  ('Maharashtra', 'MH', '2025-26', 0,     7499, 0,     7499, 0,   0,    0,   0),
  ('Maharashtra', 'MH', '2025-26', 7500,  9999, 7500,  9999, 175, 2100, 175, 2100),
  ('Maharashtra', 'MH', '2025-26', 10000, NULL, 10000, NULL, 200, 2500, 200, 2500);  -- Feb ₹300, rest ₹200

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

-- Keep Defect Tracker integration details available on databases that were
-- initialized from an older project_defects schema snapshot.
ALTER TABLE public.project_defects
  ADD COLUMN IF NOT EXISTS system_name        TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_name        TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS external_ticket_no TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_request  TEXT DEFAULT '';

-- Make the new columns visible to PostgREST immediately after this migration.
NOTIFY pgrst, 'reload schema';

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
