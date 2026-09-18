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
  ADD COLUMN IF NOT EXISTS first_response_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS introduced_in_sprint  TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS os                    TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS browser               TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS duplicate_count       INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reopen_count          INTEGER     DEFAULT 0;

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
  metadata    JSONB DEFAULT '{}'
);
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
END $$;

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
