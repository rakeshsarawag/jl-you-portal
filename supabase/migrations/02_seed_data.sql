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
ON CONFLICT (role) DO UPDATE SET permissions = EXCLUDED.permissions;

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
('Information Security Awareness','Covers data protection, phishing awareness, password hygiene, and incident reporting. Mandatory for all.','Compliance','IT Team',2,'Online','Active',85,'["mandatory","security","compliance","annual"]'::jsonb),
('Prevention of Sexual Harassment (POSH)','Mandatory POSH training covering the law, workplace conduct expectations, and the reporting mechanism.','Compliance','Legal Team',3,'Online','Active',90,'["mandatory","posh","compliance","annual"]'::jsonb),
('Code of Conduct & Ethics','Company values, code of conduct, anti-bribery policy and conflict of interest guidelines.','Compliance','HR Team',1.5,'Online','Active',80,'["mandatory","ethics","compliance"]'::jsonb),
('Leadership Essentials','Core leadership skills for first-time and mid-level managers: delegation, feedback, conflict resolution.','Leadership & Management','External Trainer',16,'Blended','Active',75,'["leadership","management","managers"]'::jsonb),
('Effective Communication in the Workplace','Written and verbal communication, active listening, and stakeholder communication.','Soft Skills','HR Team',8,'Blended','Active',70,'["communication","soft-skills"]'::jsonb),
('Project Management Fundamentals','Introduction to agile methodology, Jira basics, and sprint planning.','Technical Skills','Engineering Lead',12,'Online','Active',75,'["project-management","agile","scrum"]'::jsonb),
('Data Privacy & GDPR Compliance','Personal data, data subject rights, processing lawfulness, and breach procedures.','Compliance','Legal Team',2,'Online','Active',85,'["gdpr","data-privacy","compliance","annual"]'::jsonb),
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
('Engineering Onboarding Track','Mandatory learning path for all new engineering hires.','Software Engineer','["New Employee Orientation","Information Security Awareness","Code of Conduct & Ethics","React & TypeScript for Frontend Developers","Project Management Fundamentals"]'::jsonb,51),
('Manager Readiness Programme','Prepares individual contributors transitioning into first-time management roles.','Engineering Manager','["Leadership Essentials","Effective Communication in the Workplace","Financial Literacy for Managers","Prevention of Sexual Harassment (POSH)","Data Privacy & GDPR Compliance"]'::jsonb,31),
('Mandatory Compliance Bundle','Annual mandatory compliance training required for all employees.','All Employees','["Information Security Awareness","Prevention of Sexual Harassment (POSH)","Code of Conduct & Ethics","Data Privacy & GDPR Compliance"]'::jsonb,9),
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
('DevOps & Cloud Track','Cloud-native operations for DevOps and SRE engineers.','DevOps Engineer','["Public Cloud Fundamentals (AWS)","Project Management Fundamentals","Information Security Awareness"]'::jsonb,24),
('New Manager Onboarding','All-round preparation for a first-time people manager.','Engineering Manager','["Leadership Essentials","Effective Communication in the Workplace","Financial Literacy for Managers","Data Privacy & GDPR Compliance","Prevention of Sexual Harassment (POSH)"]'::jsonb,31),
('Annual Compliance Refresh','Mandatory annual refresh for every employee.','All Employees','["Information Security Awareness","Prevention of Sexual Harassment (POSH)","Code of Conduct & Ethics","Data Privacy & GDPR Compliance"]'::jsonb,9)
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
INSERT INTO defect_statuses (name, label, description, is_terminal, sort_order) VALUES
  ('Open',        'Open',        'Newly filed, not yet triaged',                      false, 1),
  ('In Progress', 'In Progress', 'Being actively worked on by assignee',              false, 2),
  ('Blocked',     'Blocked',     'Work stopped due to dependency or external block',   false, 3),
  ('Fixed',       'Fixed',       'Fix implemented, awaiting verification',             false, 4),
  ('Verified',    'Verified',    'Fix confirmed by QA team',                          false, 5),
  ('Closed',      'Closed',      'Defect is closed — verified or resolved',            true,  6),
  ('Deferred',    'Deferred',    'Intentionally deferred to a future sprint/release',  false, 7),
  ('Won''t Fix',  'Won''t Fix',  'Will not be fixed — by design, out of scope, etc.',  true,  8),
  ('Duplicate',   'Duplicate',   'A duplicate of an existing defect',                  true,  9)
ON CONFLICT (name) DO NOTHING;
INSERT INTO defect_status_transitions (from_status, to_status) VALUES
  ('Open',        'In Progress'),
  ('Open',        'Deferred'),
  ('Open',        'Won''t Fix'),
  ('Open',        'Duplicate'),
  ('In Progress', 'Blocked'),
  ('In Progress', 'Fixed'),
  ('In Progress', 'Won''t Fix'),
  ('Blocked',     'In Progress'),
  ('Blocked',     'Won''t Fix'),
  ('Fixed',       'Verified'),
  ('Fixed',       'Open'),
  ('Verified',    'Closed'),
  ('Verified',    'Open'),
  ('Deferred',    'Open'),
  ('Closed',      'Open'),
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
