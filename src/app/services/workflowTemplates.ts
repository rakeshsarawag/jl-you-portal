import { WorkflowDefinition } from './workflowEngine';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  triggerEvent: string;
  stepCount: number;
  template: Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'version'>;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  // ── 1. Leave Approval ──────────────────────────────────────────────────────
  {
    id: 'leave_approval',
    name: 'Leave Approval',
    description: 'Routes leave requests through manager approval. Extended leaves (>5 days) also require HR approval.',
    category: 'HR',
    icon: 'Calendar',
    triggerEvent: 'leave_applied',
    stepCount: 7,
    template: {
      name: 'Leave Approval',
      description: 'Routes leave requests through manager and optional HR approval based on days requested.',
      status: 'draft',
      trigger: {
        type: 'event',
        config: { app: 'leave_management', entity: 'leaves', event_key: 'leave_applied' },
      },
      nodes: [
        {
          id: 'n1',
          type: 'trigger',
          label: 'Leave Applied',
          config: { event_key: 'leave_applied' },
          position: { x: 100, y: 200 },
          connections: ['n2'],
        },
        {
          id: 'n2',
          type: 'condition',
          label: 'Check leave duration',
          config: {
            condition: {
              operator: 'AND',
              conditions: [{ field: 'days', operator: 'greater_than', value: 5 }],
            },
          },
          position: { x: 300, y: 200 },
          connections: ['n3', 'n4'],
        },
        {
          id: 'n3',
          type: 'approval',
          label: 'Manager Approval (extended)',
          config: {
            approver_role: 'direct_manager',
            step_name: 'Manager Approval',
            deadline_hours: 24,
            on_timeout: 'escalate_to_next_level',
            push_notify: true,
          },
          position: { x: 520, y: 100 },
          connections: ['n5'],
        },
        {
          id: 'n4',
          type: 'approval',
          label: 'Manager Approval',
          config: {
            approver_role: 'direct_manager',
            step_name: 'Manager Approval',
            deadline_hours: 24,
            on_timeout: 'escalate_to_next_level',
            push_notify: true,
          },
          position: { x: 520, y: 300 },
          connections: ['n6'],
        },
        {
          id: 'n5',
          type: 'approval',
          label: 'HR Manager Approval',
          config: {
            approver_role: 'hr_manager',
            step_name: 'HR Manager Approval',
            deadline_hours: 48,
            on_timeout: 'auto_reject',
            push_notify: true,
          },
          position: { x: 740, y: 100 },
          connections: ['n6'],
        },
        {
          id: 'n6',
          type: 'update_field',
          label: 'Update Leave Status',
          config: {
            target_app: 'leave_management',
            entity: 'leaves',
            record_id: '{{trigger.leave_id}}',
            field: 'status',
            new_value: '{{approval.final_status}}',
          },
          position: { x: 960, y: 200 },
          connections: ['n7', 'n8'],
        },
        {
          id: 'n7',
          type: 'notification',
          label: 'Notify Employee',
          config: {
            recipients: ['{{trigger.employee_id}}'],
            message: 'Your leave request has been {{approval.final_status}}.',
            channel: 'both',
          },
          position: { x: 1180, y: 100 },
          connections: ['n_end'],
        },
        {
          id: 'n8',
          type: 'notification',
          label: 'Notify Manager',
          config: {
            recipients: ['{{trigger.manager_id}}'],
            message: 'Leave for {{trigger.employee_name}} has been {{approval.final_status}}.',
            channel: 'in_app',
          },
          position: { x: 1180, y: 300 },
          connections: ['n_end'],
        },
        {
          id: 'n_end',
          type: 'end',
          label: 'Complete',
          config: {},
          position: { x: 1400, y: 200 },
          connections: [],
        },
      ],
    },
  },

  // ── 2. Job Requisition Approval ────────────────────────────────────────────
  {
    id: 'job_requisition_approval',
    name: 'Job Requisition Approval',
    description: 'Two-level approval for new job requisitions. Activates job posting upon full approval.',
    category: 'Recruitment',
    icon: 'Briefcase',
    triggerEvent: 'job_requisition_submitted',
    stepCount: 4,
    template: {
      name: 'Job Requisition Approval',
      description: 'Two-level approval for new job requisitions; activates posting upon full approval.',
      status: 'draft',
      trigger: {
        type: 'event',
        config: { app: 'recruitment', entity: 'job_requisitions', event_key: 'job_requisition_submitted' },
      },
      nodes: [
        {
          id: 'n1',
          type: 'trigger',
          label: 'Requisition Submitted',
          config: { event_key: 'job_requisition_submitted' },
          position: { x: 100, y: 200 },
          connections: ['n2'],
        },
        {
          id: 'n2',
          type: 'approval',
          label: 'Department Manager Approval',
          config: {
            approver_role: 'department_manager',
            step_name: 'Department Manager Approval',
            deadline_hours: 48,
            on_timeout: 'escalate_to_next_level',
            push_notify: true,
          },
          position: { x: 320, y: 200 },
          connections: ['n3'],
        },
        {
          id: 'n3',
          type: 'approval',
          label: 'HR Manager Approval',
          config: {
            approver_role: 'hr_manager',
            step_name: 'HR Manager Approval',
            deadline_hours: 48,
            on_timeout: 'auto_reject',
            push_notify: true,
          },
          position: { x: 540, y: 200 },
          connections: ['n4'],
        },
        {
          id: 'n4',
          type: 'update_field',
          label: 'Activate Job Posting',
          config: {
            target_app: 'recruitment',
            entity: 'job_postings',
            record_id: '{{trigger.job_requisition_id}}',
            field: 'status',
            new_value: 'active',
          },
          position: { x: 760, y: 200 },
          connections: ['n5'],
        },
        {
          id: 'n5',
          type: 'notification',
          label: 'Notify Requester',
          config: {
            recipients: ['{{trigger.requester_id}}'],
            message: 'Your job requisition for {{trigger.position_title}} has been approved and is now live.',
            channel: 'both',
          },
          position: { x: 980, y: 200 },
          connections: ['n_end'],
        },
        {
          id: 'n_end',
          type: 'end',
          label: 'Complete',
          config: {},
          position: { x: 1200, y: 200 },
          connections: [],
        },
      ],
    },
  },

  // ── 3. New Hire Onboarding ─────────────────────────────────────────────────
  {
    id: 'new_hire_onboarding',
    name: 'New Hire Onboarding',
    description: 'Automates parallel onboarding tasks (IT, welcome email, training enrollment) upon hire confirmation.',
    category: 'Onboarding',
    icon: 'UserPlus',
    triggerEvent: 'candidate_hired',
    stepCount: 7,
    template: {
      name: 'New Hire Onboarding',
      description: 'Automates parallel onboarding tasks upon hire confirmation, then sends welcome communications on joining date.',
      status: 'draft',
      trigger: {
        type: 'event',
        config: { app: 'recruitment', entity: 'candidates', event_key: 'candidate_hired' },
      },
      nodes: [
        {
          id: 'n1',
          type: 'trigger',
          label: 'Candidate Hired',
          config: { event_key: 'candidate_hired' },
          position: { x: 100, y: 250 },
          connections: ['n2'],
        },
        {
          id: 'n2',
          type: 'create_record',
          label: 'Create Onboarding Record',
          config: {
            target_app: 'onboarding',
            entity: 'onboarding_records',
            field_mapping: [
              { source_field: 'trigger.employee_id', target_field: 'employee_id' },
              { source_field: 'trigger.joining_date', target_field: 'joining_date' },
            ],
          },
          position: { x: 320, y: 250 },
          connections: ['n3'],
        },
        {
          id: 'n3',
          type: 'parallel',
          label: 'Parallel Onboarding Tasks',
          config: {
            branch_count: 3,
            branch_labels: ['IT Provisioning', 'Welcome Email', 'Mandatory Training'],
          },
          position: { x: 540, y: 250 },
          connections: ['n4', 'n5', 'n6'],
        },
        {
          id: 'n4',
          type: 'create_record',
          label: 'Create IT Provisioning Ticket',
          config: {
            target_app: 'it_services',
            entity: 'it_tickets',
            field_mapping: [
              { source_field: 'trigger.employee_id', target_field: 'employee_id' },
              { source_field: 'trigger.joining_date', target_field: 'due_date' },
            ],
          },
          position: { x: 760, y: 100 },
          connections: ['n7'],
        },
        {
          id: 'n5',
          type: 'email',
          label: 'Send Welcome Email',
          config: {
            to: '{{trigger.personal_email}}',
            template_id: 'WELCOME_EMAIL_TEMPLATE',
            custom_subject: 'Welcome to the team, {{trigger.first_name}}!',
            recipient_type: 'employee',
          },
          position: { x: 760, y: 250 },
          connections: ['n7'],
        },
        {
          id: 'n6',
          type: 'create_record',
          label: 'Create Training Enrollments',
          config: {
            target_app: 'training',
            entity: 'training_enrollments',
            field_mapping: [
              { source_field: 'trigger.employee_id', target_field: 'employee_id' },
              { source_field: 'trigger.role_id', target_field: 'role_id' },
            ],
          },
          position: { x: 760, y: 400 },
          connections: ['n7'],
        },
        {
          id: 'n7',
          type: 'delay',
          label: 'Wait Until Joining Date',
          config: { duration_value: '{{trigger.joining_date}}', duration_unit: 'days' },
          position: { x: 980, y: 250 },
          connections: ['n8'],
        },
        {
          id: 'n8',
          type: 'notification',
          label: 'Post Welcome Announcement',
          config: {
            recipients: ['company_announcements'],
            message: 'Please welcome {{trigger.full_name}} who is joining us today as {{trigger.job_title}}!',
            channel: 'in_app',
          },
          position: { x: 1200, y: 250 },
          connections: ['n9'],
        },
        {
          id: 'n9',
          type: 'notification',
          label: 'Notify Manager',
          config: {
            recipients: ['{{trigger.manager_id}}'],
            message: 'Your new team member {{trigger.full_name}} starts today. Their onboarding tasks have been initiated.',
            channel: 'both',
          },
          position: { x: 1420, y: 250 },
          connections: ['n_end'],
        },
        {
          id: 'n_end',
          type: 'end',
          label: 'Complete',
          config: {},
          position: { x: 1640, y: 250 },
          connections: [],
        },
      ],
    },
  },

  // ── 4. PIP Approval ────────────────────────────────────────────────────────
  {
    id: 'pip_approval',
    name: 'PIP Approval',
    description: 'HR approves the PIP document, notifies relevant parties, and sets a 30-day check-in reminder.',
    category: 'Performance',
    icon: 'AlertTriangle',
    triggerEvent: 'pip_created',
    stepCount: 6,
    template: {
      name: 'PIP Approval Workflow',
      description: 'HR approves PIP document, notifies parties, schedules 30-day check-in.',
      status: 'draft',
      trigger: {
        type: 'event',
        config: { app: 'performance', entity: 'pip', event_key: 'pip_created' },
      },
      nodes: [
        {
          id: 'n1',
          type: 'trigger',
          label: 'PIP Created',
          config: { event_key: 'pip_created' },
          position: { x: 100, y: 200 },
          connections: ['n2'],
        },
        {
          id: 'n2',
          type: 'approval',
          label: 'HR Manager Approval',
          config: {
            approver_role: 'hr_manager',
            step_name: 'HR Manager Approval',
            deadline_hours: 24,
            on_timeout: 'escalate_to_next_level',
            push_notify: true,
          },
          position: { x: 320, y: 200 },
          connections: ['n3', 'n4'],
        },
        {
          id: 'n3',
          type: 'notification',
          label: 'Notify Employee of PIP',
          config: {
            recipients: ['{{trigger.employee_id}}'],
            message: 'A Performance Improvement Plan has been initiated. Your manager will discuss the details with you.',
            channel: 'both',
          },
          position: { x: 540, y: 100 },
          connections: ['n5'],
        },
        {
          id: 'n4',
          type: 'notification',
          label: 'Notify PIP Creator of Rejection',
          config: {
            recipients: ['{{trigger.created_by}}'],
            message: 'The PIP for {{trigger.employee_name}} was rejected by HR. Reason: {{approval.response_comment}}',
            channel: 'both',
          },
          position: { x: 540, y: 300 },
          connections: ['n_end'],
        },
        {
          id: 'n5',
          type: 'notification',
          label: 'Confirm to Manager',
          config: {
            recipients: ['{{trigger.manager_id}}'],
            message: 'The PIP for {{trigger.employee_name}} has been approved by HR. Please proceed with the discussion.',
            channel: 'in_app',
          },
          position: { x: 760, y: 100 },
          connections: ['n6'],
        },
        {
          id: 'n6',
          type: 'delay',
          label: 'Wait 30 Days',
          config: { duration_value: 30, duration_unit: 'days' },
          position: { x: 980, y: 100 },
          connections: ['n7'],
        },
        {
          id: 'n7',
          type: 'notification',
          label: '30-Day Check-In Reminder',
          config: {
            recipients: ['{{trigger.manager_id}}'],
            message: 'The PIP for {{trigger.employee_name}} is now one month in. Please schedule a check-in review.',
            channel: 'both',
          },
          position: { x: 1200, y: 100 },
          connections: ['n_end'],
        },
        {
          id: 'n_end',
          type: 'end',
          label: 'Complete',
          config: {},
          position: { x: 1420, y: 200 },
          connections: [],
        },
      ],
    },
  },

  // ── 5. Performance Review Reminder ────────────────────────────────────────
  {
    id: 'performance_review_reminder',
    name: 'Performance Review Reminder',
    description: 'Reminds employees who have not submitted their self-assessment as the deadline approaches (daily at 8 AM).',
    category: 'Performance',
    icon: 'Star',
    triggerEvent: 'schedule: daily 8 AM',
    stepCount: 3,
    template: {
      name: 'Performance Review Reminder',
      description: 'Daily reminder for employees who have not submitted self-assessment near deadline.',
      status: 'draft',
      trigger: {
        type: 'scheduled',
        config: { cron: '0 8 * * *', timezone: 'UTC', preset: 'Every day at 8 AM' },
      },
      nodes: [
        {
          id: 'n1',
          type: 'trigger',
          label: 'Daily Schedule',
          config: { cron: '0 8 * * *' },
          position: { x: 100, y: 200 },
          connections: ['n2'],
        },
        {
          id: 'n2',
          type: 'condition',
          label: 'Check Deadline and Submission Status',
          config: {
            condition: {
              operator: 'AND',
              conditions: [
                { field: 'review_deadline_in_days', operator: 'less_than_or_equal', value: 3 },
                { field: 'self_assessment_submitted', operator: 'equals', value: false },
              ],
            },
          },
          position: { x: 320, y: 200 },
          connections: ['n3'],
        },
        {
          id: 'n3',
          type: 'email',
          label: 'Self-Assessment Deadline Reminder',
          config: {
            to: '{{employee.email}}',
            custom_subject: 'Reminder: Your self-assessment is due in {{review_deadline_in_days}} days',
            custom_body: 'Hi {{employee.first_name}}, please complete your self-assessment by {{review_deadline_date}}. Log in to the HR portal to submit.',
            recipient_type: 'employee',
          },
          position: { x: 540, y: 200 },
          connections: ['n4'],
        },
        {
          id: 'n4',
          type: 'notification',
          label: 'In-App Reminder',
          config: {
            recipients: ['{{employee.employee_id}}'],
            message: 'Your self-assessment is due in {{review_deadline_in_days}} days. Please submit it before {{review_deadline_date}}.',
            channel: 'in_app',
          },
          position: { x: 760, y: 200 },
          connections: ['n_end'],
        },
        {
          id: 'n_end',
          type: 'end',
          label: 'Complete',
          config: {},
          position: { x: 980, y: 200 },
          connections: [],
        },
      ],
    },
  },

  // ── 6. Employee Exit ───────────────────────────────────────────────────────
  {
    id: 'employee_exit',
    name: 'Employee Exit',
    description: 'Coordinates all offboarding tasks in parallel, then deactivates the employee account on the last working day.',
    category: 'Offboarding',
    icon: 'LogOut',
    triggerEvent: 'employee_exit_initiated',
    stepCount: 8,
    template: {
      name: 'Employee Exit Workflow',
      description: 'Coordinates offboarding tasks in parallel, then deactivates employee account on last working day.',
      status: 'draft',
      trigger: {
        type: 'event',
        config: { app: 'offboarding', entity: 'offboarding_records', event_key: 'employee_exit_initiated' },
      },
      nodes: [
        {
          id: 'n1',
          type: 'trigger',
          label: 'Exit Initiated',
          config: { event_key: 'employee_exit_initiated' },
          position: { x: 100, y: 300 },
          connections: ['n2'],
        },
        {
          id: 'n2',
          type: 'parallel',
          label: 'Initiate Offboarding Tasks',
          config: {
            branch_count: 4,
            branch_labels: ['IT Access Revocation', 'Finance Notification', 'Exit Interview', 'Farewell Email'],
          },
          position: { x: 320, y: 300 },
          connections: ['n3', 'n4', 'n5', 'n6'],
        },
        {
          id: 'n3',
          type: 'notification',
          label: 'Notify IT Department',
          config: {
            recipients: ['it_operations_group'],
            message: 'Please schedule access revocation for {{trigger.employee_name}} ({{trigger.employee_id}}) by {{trigger.last_working_date}}.',
            channel: 'in_app',
          },
          position: { x: 540, y: 100 },
          connections: ['n7'],
        },
        {
          id: 'n4',
          type: 'notification',
          label: 'Notify Finance for F&F Settlement',
          config: {
            recipients: ['finance_team_group'],
            message: 'Please initiate Full & Final settlement for {{trigger.employee_name}} with last working date {{trigger.last_working_date}}.',
            channel: 'in_app',
          },
          position: { x: 540, y: 233 },
          connections: ['n7'],
        },
        {
          id: 'n5',
          type: 'create_record',
          label: 'Create Exit Interview Record',
          config: {
            target_app: 'offboarding',
            entity: 'exit_interviews',
            field_mapping: [
              { source_field: 'trigger.employee_id', target_field: 'employee_id' },
              { source_field: 'trigger.last_working_date', target_field: 'scheduled_date' },
            ],
          },
          position: { x: 540, y: 366 },
          connections: ['n7'],
        },
        {
          id: 'n6',
          type: 'email',
          label: 'Send Farewell Email',
          config: {
            to: '{{trigger.personal_email}}',
            template_id: 'FAREWELL_EMAIL_TEMPLATE',
            recipient_type: 'employee',
          },
          position: { x: 540, y: 500 },
          connections: ['n7'],
        },
        {
          id: 'n7',
          type: 'delay',
          label: 'Wait Until Last Working Day',
          config: { duration_value: '{{trigger.last_working_date}}', duration_unit: 'days' },
          position: { x: 760, y: 300 },
          connections: ['n8'],
        },
        {
          id: 'n8',
          type: 'update_field',
          label: 'Set Employee Status to Inactive',
          config: {
            target_app: 'employee_directory',
            entity: 'employees',
            record_id: '{{trigger.employee_id}}',
            field: 'employment_status',
            new_value: 'inactive',
          },
          position: { x: 980, y: 250 },
          connections: ['n9'],
        },
        {
          id: 'n9',
          type: 'update_field',
          label: 'Suspend User Account',
          config: {
            target_app: 'user_management',
            entity: 'user_accounts',
            record_id: '{{trigger.user_account_id}}',
            field: 'account_status',
            new_value: 'suspended',
          },
          position: { x: 980, y: 350 },
          connections: ['n_end'],
        },
        {
          id: 'n_end',
          type: 'end',
          label: 'Complete',
          config: {},
          position: { x: 1200, y: 300 },
          connections: [],
        },
      ],
    },
  },

  // ── 7. Certification Renewal Reminder ─────────────────────────────────────
  {
    id: 'certification_renewal',
    name: 'Certification Renewal Reminder',
    description: 'Daily check for certificates expiring in 30 days. Assigns renewal course, notifies employee, escalates to manager if not renewed in 7 days.',
    category: 'Training',
    icon: 'Award',
    triggerEvent: 'schedule: daily 9 AM',
    stepCount: 6,
    template: {
      name: 'Certification Renewal Reminder',
      description: 'Proactively assigns renewal training and escalates to manager if employee does not act within 7 days.',
      status: 'draft',
      trigger: {
        type: 'scheduled',
        config: { cron: '0 9 * * *', timezone: 'UTC', preset: 'Every day at 8 AM' },
      },
      nodes: [
        {
          id: 'n1',
          type: 'trigger',
          label: 'Daily Schedule',
          config: { cron: '0 9 * * *' },
          position: { x: 100, y: 200 },
          connections: ['n2'],
        },
        {
          id: 'n2',
          type: 'condition',
          label: 'Check Expiry Window',
          config: {
            condition: {
              operator: 'AND',
              conditions: [{ field: 'certification_expiry_in_days', operator: 'less_than_or_equal', value: 30 }],
            },
          },
          position: { x: 320, y: 200 },
          connections: ['n3'],
        },
        {
          id: 'n3',
          type: 'create_record',
          label: 'Assign Renewal Course',
          config: {
            target_app: 'training',
            entity: 'training_enrollments',
            field_mapping: [
              { source_field: 'employee.id', target_field: 'employee_id' },
              { source_field: 'certification.renewal_course_id', target_field: 'course_id' },
            ],
          },
          position: { x: 540, y: 200 },
          connections: ['n4'],
        },
        {
          id: 'n4',
          type: 'notification',
          label: 'Notify Employee',
          config: {
            recipients: ['{{employee.employee_id}}'],
            message: 'Your {{certification.name}} expires in {{certification_expiry_in_days}} days. A renewal course has been assigned to you.',
            channel: 'both',
          },
          position: { x: 760, y: 200 },
          connections: ['n5'],
        },
        {
          id: 'n5',
          type: 'delay',
          label: 'Wait 7 Days',
          config: { duration_value: 7, duration_unit: 'days' },
          position: { x: 980, y: 200 },
          connections: ['n6'],
        },
        {
          id: 'n6',
          type: 'condition',
          label: 'Check If Still Not Renewed',
          config: {
            condition: {
              operator: 'AND',
              conditions: [{ field: 'certification_renewed', operator: 'equals', value: false }],
            },
          },
          position: { x: 1200, y: 200 },
          connections: ['n7'],
        },
        {
          id: 'n7',
          type: 'notification',
          label: 'Escalate to Manager',
          config: {
            recipients: ['{{employee.manager_id}}'],
            message: "{{employee.full_name}}'s {{certification.name}} expires in {{certification_expiry_in_days}} days and has not yet been renewed. Please follow up.",
            channel: 'both',
          },
          position: { x: 1420, y: 200 },
          connections: ['n_end'],
        },
        {
          id: 'n_end',
          type: 'end',
          label: 'Complete',
          config: {},
          position: { x: 1640, y: 200 },
          connections: [],
        },
      ],
    },
  },

  // ── 8. Invoice Overdue Reminder ────────────────────────────────────────────
  {
    id: 'invoice_overdue_reminder',
    name: 'Invoice Overdue Reminder',
    description: 'Sends payment reminder to client when invoice is overdue, then escalates to finance and admin if still unpaid after 7 days.',
    category: 'Finance',
    icon: 'FileText',
    triggerEvent: 'invoice_overdue',
    stepCount: 7,
    template: {
      name: 'Invoice Overdue Reminder',
      description: 'Notifies client of overdue invoice, waits 7 days, checks if still unpaid, sends second reminder, then escalates to finance and admin.',
      status: 'draft',
      trigger: {
        type: 'event',
        config: { app: 'invoice_generation', entity: 'invoices', event_key: 'invoice_overdue' },
      },
      nodes: [
        {
          id: 'n1',
          type: 'trigger',
          label: 'Invoice Overdue',
          config: { event_key: 'invoice_overdue' },
          position: { x: 100, y: 200 },
          next: 'n2',
        },
        {
          id: 'n2',
          type: 'email',
          label: 'Email Client: Payment Reminder',
          config: {
            to: '{{client_email}}',
            subject: 'Invoice {{invoice_number}} Payment Reminder',
            body: 'Your invoice is overdue. Please arrange payment.',
          },
          position: { x: 300, y: 200 },
          next: 'n3',
        },
        {
          id: 'n3',
          type: 'notification',
          label: 'Notify Finance Team',
          config: {
            role: 'finance',
            title: 'Invoice Overdue',
            message: 'Invoice {{invoice_number}} is overdue. Client has been notified.',
          },
          position: { x: 500, y: 200 },
          next: 'n4',
        },
        {
          id: 'n4',
          type: 'delay',
          label: 'Wait 7 Days',
          config: { duration: 7, unit: 'days' },
          position: { x: 700, y: 200 },
          next: 'n5',
        },
        {
          id: 'n5',
          type: 'condition',
          label: 'Invoice Still Unpaid?',
          config: { field: 'invoice_status', operator: '!=', value: 'paid' },
          position: { x: 900, y: 200 },
          branches: { yes: 'n6', no: null },
        },
        {
          id: 'n6',
          type: 'email',
          label: 'Urgent Email to Client',
          config: {
            to: '{{client_email}}',
            subject: 'URGENT: Invoice {{invoice_number}} Overdue',
            body: 'Your invoice requires immediate payment.',
          },
          position: { x: 1100, y: 200 },
          next: 'n7',
        },
        {
          id: 'n7',
          type: 'notification',
          label: 'Escalate to Finance & Admin',
          config: {
            role: 'finance,admin',
            title: 'Invoice Overdue Escalation',
            message: 'Invoice {{invoice_number}} remains unpaid after second notice.',
            priority: 'high',
          },
          position: { x: 1300, y: 200 },
          next: null,
        },
      ],
    },
  },

  // ── 9. Salary Revision Approval ────────────────────────────────────────────
  {
    id: 'salary_revision_approval',
    name: 'Salary Revision Approval',
    description: 'Routes salary revision requests through HR Manager approval and notifies the employee of the outcome.',
    category: 'Payroll',
    icon: 'DollarSign',
    triggerEvent: 'salary_revision_submitted',
    stepCount: 5,
    template: {
      name: 'Salary Revision Approval',
      description: 'HR Manager approves salary revision; employee is notified of approval or rejection.',
      status: 'draft',
      trigger: {
        type: 'event',
        config: { app: 'payroll_management', entity: 'salary_revisions', event_key: 'salary_revision_submitted' },
      },
      nodes: [
        {
          id: 'n1',
          type: 'trigger',
          label: 'Salary Revision Submitted',
          config: { event_key: 'salary_revision_submitted' },
          position: { x: 100, y: 200 },
          connections: ['n2'],
        },
        {
          id: 'n2',
          type: 'approval',
          label: 'HR Manager Approval',
          config: {
            approver_role: 'hr_manager',
            step_name: 'HR Manager Approval',
            deadline_hours: 48,
            on_timeout: 'escalate_to_next_level',
            push_notify: true,
          },
          position: { x: 320, y: 200 },
          connections: ['n3', 'n4'],
        },
        {
          id: 'n3',
          type: 'notification',
          label: 'Notify Employee — Approved',
          config: {
            recipients: ['{{trigger.employee_id}}'],
            message: "Salary revision approved effective {{trigger.effective_date}}.",
            channel: 'both',
          },
          position: { x: 540, y: 100 },
          connections: ['n_updatefield'],
        },
        {
          id: 'n_updatefield',
          type: 'update_field',
          label: 'Update Revision Status',
          config: { table: 'salary_revision_history', field: 'status', value: 'approved' },
          position: { x: 500, y: 200 },
          connections: ['n_hr_notify'],
        },
        {
          id: 'n_hr_notify',
          type: 'notification',
          label: 'Notify HR Team',
          config: {
            role: 'hr_manager',
            title: 'Salary Revision Approved',
            message: 'Salary revision for {{employee_name}} has been approved.',
          },
          next: null,
        },
        {
          id: 'n4',
          type: 'notification',
          label: 'Notify Employee — Not Approved',
          config: {
            recipients: ['{{submitted_by}}'],
            message: "Salary revision not approved: {{approval.response_comment}}",
            channel: 'both',
          },
          position: { x: 540, y: 300 },
          connections: ['n_end'],
        },
        {
          id: 'n_end',
          type: 'end',
          label: 'Complete',
          config: {},
          position: { x: 760, y: 200 },
          connections: [],
        },
      ],
    },
  },

  // ── 10. OKR Check-In Reminder ──────────────────────────────────────────────
  {
    id: 'okr_checkin_reminder',
    name: 'OKR Check-In Reminder',
    description: 'Reminds OKR owner when check-in is due, then escalates to manager if not submitted after 2 days.',
    category: 'OKR',
    icon: 'Target',
    triggerEvent: 'okr_checkin_due',
    stepCount: 5,
    template: {
      name: 'OKR Check-In Reminder',
      description: 'Notifies OKR owner of due check-in, waits 2 days, then escalates to manager if still not submitted.',
      status: 'draft',
      trigger: {
        type: 'event',
        config: { app: 'okr', entity: 'okrs', event_key: 'okr_checkin_due' },
      },
      nodes: [
        {
          id: 'n1',
          type: 'trigger',
          label: 'Schedule: Monday 08:00',
          config: { trigger_type: 'schedule', schedule: '0 8 * * 1', description: 'Every Monday at 8:00 AM' },
          position: { x: 100, y: 200 },
          next: 'n_email_emp',
        },
        {
          id: 'n_email_emp',
          type: 'email',
          label: 'Email Employee',
          config: { to: '{{employee_email}}', subject: 'OKR Check-in Reminder', body: 'Please update your OKR progress for this week.' },
          position: { x: 300, y: 80 },
          connections: ['n2'],
        },
        {
          id: 'n2',
          type: 'notification',
          label: 'Notify OKR Owner',
          config: {
            recipients: ['{{okr.owner_id}}'],
            message: 'OKR check-in due: {{okr.title}}. Please submit your check-in update.',
            channel: 'both',
          },
          position: { x: 320, y: 200 },
          connections: ['n3'],
        },
        {
          id: 'n3',
          type: 'delay',
          label: 'Wait 2 Days',
          config: { duration_value: 2, duration_unit: 'days' },
          position: { x: 540, y: 200 },
          connections: ['n4'],
        },
        {
          id: 'n4',
          type: 'condition',
          label: 'Check-in still not submitted?',
          config: {
            condition: {
              operator: 'AND',
              conditions: [{ field: 'checkin_submitted', operator: 'equals', value: false }],
            },
          },
          position: { x: 760, y: 200 },
          connections: ['n5'],
        },
        {
          id: 'n5',
          type: 'notification',
          label: 'Notify Manager',
          config: {
            recipients: ['{{okr.manager_id}}'],
            message: 'Employee {{okr.owner_name}} has not submitted OKR check-in for {{okr.title}}. Please follow up.',
            channel: 'both',
          },
          position: { x: 980, y: 200 },
          connections: ['n_end'],
        },
        {
          id: 'n_end',
          type: 'end',
          label: 'Complete',
          config: {},
          position: { x: 1200, y: 200 },
          connections: [],
        },
      ],
    },
  },

  // ── 11. Payroll Processing Reminder ───────────────────────────────────────
  {
    id: 'payroll_processing_reminder',
    name: 'Payroll Processing Reminder',
    description: 'Notifies finance manager when payroll processing is due, then escalates urgently to finance and HR managers if still unprocessed after 1 day.',
    category: 'Payroll',
    icon: 'CreditCard',
    triggerEvent: 'payroll_processing_due',
    stepCount: 5,
    template: {
      name: 'Payroll Processing Reminder',
      description: 'Alerts finance manager of due payroll; escalates urgently to finance and HR managers if still unprocessed after 1 day.',
      status: 'draft',
      trigger: {
        type: 'event',
        config: { app: 'payroll_management', entity: 'payroll_runs', event_key: 'payroll_processing_due' },
      },
      nodes: [
        {
          id: 'n1',
          type: 'trigger',
          label: 'Payroll Processing Due',
          config: { event_key: 'payroll_processing_due' },
          position: { x: 100, y: 200 },
          connections: ['n2'],
        },
        {
          id: 'n2',
          type: 'notification',
          label: 'Notify Finance Manager',
          config: {
            recipients: ['{{trigger.finance_manager_id}}'],
            message: 'Payroll processing due for {{trigger.period}}. Please begin processing immediately.',
            channel: 'both',
            priority: 'high',
          },
          position: { x: 320, y: 200 },
          connections: ['n_email_fin'],
        },
        {
          id: 'n_email_fin',
          type: 'email',
          label: 'Email Finance Manager',
          config: {
            to: '{{finance_manager_email}}',
            subject: 'Payroll Processing Due',
            body: 'Payroll processing is due. Please log in and process payroll for this month. Checklist: 1. Verify employee records 2. Check LOP leaves 3. Process payroll 4. Review for approval.',
          },
          position: { x: 400, y: 80 },
          next: 'n3',
        },
        {
          id: 'n3',
          type: 'delay',
          label: 'Wait 1 Day',
          config: { duration_value: 1, duration_unit: 'days' },
          position: { x: 540, y: 200 },
          connections: ['n4'],
        },
        {
          id: 'n4',
          type: 'condition',
          label: 'Payroll still unprocessed?',
          config: {
            condition: {
              operator: 'AND',
              conditions: [{ field: 'payroll_status', operator: 'equals', value: 'unprocessed' }],
            },
          },
          position: { x: 760, y: 200 },
          connections: ['n5'],
        },
        {
          id: 'n5',
          type: 'notification',
          label: 'Urgent Escalation to Finance & HR',
          config: {
            recipients: ['{{trigger.finance_manager_id}}', '{{trigger.hr_manager_id}}'],
            message: 'URGENT: Payroll not processed for {{trigger.period}}. Immediate action required.',
            channel: 'both',
            priority: 'urgent',
          },
          position: { x: 980, y: 200 },
          connections: ['n_end'],
        },
        {
          id: 'n_end',
          type: 'end',
          label: 'Complete',
          config: {},
          position: { x: 1200, y: 200 },
          connections: [],
        },
      ],
    },
  },

  // ── 12. Compliance Assessment Reminder ────────────────────────────────────
  {
    id: 'compliance_assessment_reminder',
    name: 'Compliance Assessment Reminder',
    description: 'Notifies compliance officer of upcoming deadline. Escalates to admin if unresolved after 5 days.',
    category: 'Compliance',
    icon: 'ShieldCheck',
    triggerEvent: 'compliance_deadline_7d',
    stepCount: 5,
    template: {
      name: 'Compliance Assessment Reminder',
      description: 'Notifies compliance officer of approaching deadline; escalates to admin if still unresolved.',
      status: 'draft',
      trigger: {
        type: 'event',
        config: { app: 'security_compliance', entity: 'compliance_requirements', event_key: 'compliance_deadline_7d' },
      },
      nodes: [
        {
          id: 'n1',
          type: 'trigger',
          label: 'Compliance Deadline (7 days)',
          config: { event_key: 'compliance_deadline_7d' },
          position: { x: 100, y: 200 },
          connections: ['n2'],
        },
        {
          id: 'n2',
          type: 'notification',
          label: 'Notify Compliance Officer',
          config: {
            recipients: ['{{trigger.compliance_officer_id}}'],
            message: 'Compliance deadline in 7 days: {{trigger.framework}} — {{trigger.requirement}}. Please complete the required assessment.',
            channel: 'both',
          },
          position: { x: 320, y: 200 },
          connections: ['n_email_assigned'],
        },
        {
          id: 'n_email_assigned',
          type: 'email',
          label: 'Email Assigned Officer',
          config: {
            to: '{{assigned_to_email}}',
            subject: 'Compliance Assessment Due in 7 Days',
            body: 'Your compliance assessment for {{framework_name}} is due in 7 days. Please complete it.',
          },
          position: { x: 400, y: 80 },
          next: 'n3',
        },
        {
          id: 'n3',
          type: 'delay',
          label: 'Wait 5 Days',
          config: { duration_value: 5, duration_unit: 'days' },
          position: { x: 540, y: 200 },
          connections: ['n4'],
        },
        {
          id: 'n4',
          type: 'condition',
          label: 'Still Unresolved?',
          config: {
            condition: {
              operator: 'AND',
              conditions: [{ field: 'compliance_status', operator: 'equals', value: 'pending' }],
            },
          },
          position: { x: 760, y: 200 },
          connections: ['n5'],
        },
        {
          id: 'n5',
          type: 'notification',
          label: 'Urgent: Escalate to Admin & Compliance Officer',
          config: {
            role: 'admin,compliance_officer',
            title: 'URGENT: Compliance Assessment Overdue',
            message: 'Compliance assessment for {{framework_name}} is critically overdue.',
            priority: 'urgent',
          },
          position: { x: 980, y: 200 },
          connections: ['n_end'],
        },
        {
          id: 'n_end',
          type: 'end',
          label: 'Complete',
          config: {},
          position: { x: 1200, y: 200 },
          connections: [],
        },
      ],
    },
  },

  // ── 13. Analytics Anomaly Escalation ──────────────────────────────────────
  {
    id: 'analytics_anomaly_escalation',
    name: 'Analytics Anomaly Escalation',
    description: 'On detecting a high-severity KPI anomaly, notifies data analyst and dept manager in parallel; escalates to director if unresolved after 1 hour.',
    category: 'Analytics',
    icon: 'TrendingUp',
    triggerEvent: 'anomaly_detected',
    stepCount: 6,
    template: {
      name: 'Analytics Anomaly Escalation',
      description: 'Alerts data analyst and dept manager in parallel; escalates to director if anomaly persists.',
      status: 'draft',
      trigger: {
        type: 'event',
        config: { app: 'advanced_analytics', entity: 'kpi_metrics', event_key: 'anomaly_detected' },
      },
      nodes: [
        { id: 'n1', type: 'trigger', label: 'Anomaly Detected', config: { event: 'anomaly_detected', filter: 'severity in (high,critical)' }, position: { x: 50, y: 200 }, next: 'n2' },
        { id: 'n2', type: 'condition', label: 'Check Deviation > 20%', config: { field: 'deviation_percent', operator: '>', value: '20' }, position: { x: 250, y: 200 }, branches: { yes: 'n3', no: 'n4' } },
        { id: 'n3', type: 'approval', label: 'Analytics Admin Approval', config: { approver_role: 'analytics_admin', deadline_hours: 24, on_timeout: 'escalate' }, position: { x: 450, y: 100 }, next: 'n5', on_reject: 'n6' },
        { id: 'n4', type: 'notification', label: 'Info: Notify Analytics Admin', config: { role: 'analytics_admin', title: 'Analytics Anomaly Detected', message: '{{metric_name}} anomaly detected ({{deviation_percent}}% deviation).', priority: 'info' }, position: { x: 450, y: 300 }, next: null },
        { id: 'n5', type: 'notification', label: 'Anomaly Acknowledged', config: { role: 'analytics_admin', title: 'Anomaly Acknowledged', message: 'Anomaly for {{metric_name}} has been reviewed.', priority: 'low' }, position: { x: 650, y: 100 }, next: null },
        { id: 'n6', type: 'notification', label: 'Escalate to Admin', config: { role: 'admin', title: 'CRITICAL: Unresolved Anomaly', message: 'Analytics anomaly for {{metric_name}} requires immediate attention.', priority: 'urgent', web_push: true }, position: { x: 650, y: 300 }, next: null },
      ],
    },
  },

  // ── 14. Security Breach Alert ──────────────────────────────────────────────
  {
    id: 'security_breach_alert',
    name: 'Security Breach Alert',
    description: 'Immediately alerts security officer and IT Manager on a critical audit event, then escalates to CEO if the incident remains open after 1 hour.',
    category: 'Security',
    icon: 'ShieldAlert',
    triggerEvent: 'critical_audit_event',
    stepCount: 7,
    template: {
      name: 'Security Breach Alert',
      description: 'Immediate parallel alerts to security officer and IT; escalates to CEO if incident is still open after 1 hour.',
      status: 'draft',
      trigger: {
        type: 'event',
        config: { app: 'security_compliance', entity: 'audit_events', event_key: 'critical_audit_event' },
      },
      nodes: [
        { id: 'n1', type: 'trigger', label: 'Security Breach', config: { event: 'critical_audit_event', filter: 'severity=critical' }, position: { x: 50, y: 200 }, next: 'n_parallel' },
        { id: 'n_parallel', type: 'parallel', label: 'Simultaneous Alerts', config: {}, position: { x: 250, y: 200 }, branches: { branch_a: 'n3', branch_b: 'n5' }, next: 'n6' },
        { id: 'n3', type: 'notification', label: 'Alert Admin & Security', config: { role: 'admin,security_officer', title: 'SECURITY BREACH DETECTED', message: 'Critical security event: {{event_description}}', priority: 'urgent', web_push: true }, position: { x: 450, y: 100 }, next: null },
        { id: 'n5', type: 'email', label: 'Email IT Admin & CISO', config: { to: '{{it_admin_email}},{{ciso_email}}', subject: 'SECURITY BREACH ALERT', body: 'A critical security breach has been detected. Immediate action required. Event: {{event_description}}' }, position: { x: 450, y: 300 }, next: null },
        { id: 'n6', type: 'delay', label: 'Wait 1 Hour', config: { duration: 1, unit: 'hours' }, position: { x: 650, y: 200 }, next: 'n7' },
        { id: 'n7', type: 'condition', label: 'Event Resolved?', config: { field: 'event_status', operator: '=', value: 'resolved' }, position: { x: 850, y: 200 }, branches: { yes: null, no: 'n8' } },
        { id: 'n8', type: 'notification', label: 'Escalate to C-Suite', config: { role: 'admin,c_suite', title: 'UNRESOLVED SECURITY BREACH', message: 'Security breach still unresolved after 1 hour. Immediate executive attention required.', priority: 'urgent', web_push: true }, position: { x: 1050, y: 200 }, next: null },
      ],
    },
  },

  // ── 15. Privacy Request Processing ────────────────────────────────────────
  {
    id: 'privacy_request_processing',
    name: 'Privacy Request Processing',
    description: 'Handles GDPR/CCPA data subject requests with SLA tracking',
    category: 'Compliance',
    trigger_event: 'privacy_request_received',
    icon: 'Shield',
    tags: ['privacy', 'gdpr', 'ccpa', 'compliance'],
    triggerEvent: 'privacy_request_received',
    stepCount: 6,
    template: {
      name: 'Privacy Request Processing',
      description: 'Handles GDPR/CCPA data subject requests with SLA tracking.',
      status: 'draft',
      trigger: {
        type: 'event',
        config: { event_key: 'privacy_request_received' },
      },
      nodes: [
        { id: 'n1', type: 'trigger', label: 'Privacy Request Received', config: { event: 'privacy_request_received' }, position: { x: 50, y: 200 }, next: 'n2' },
        { id: 'n2', type: 'notification', label: 'Notify Compliance Officer', config: { role: 'compliance_officer', title: 'New Privacy Request', message: 'A new {{request_type}} request has been received from {{subject_name}} under {{regulation}}.', priority: 'high' }, position: { x: 250, y: 200 }, next: 'n3' },
        { id: 'n3', type: 'email', label: 'Acknowledge to Subject', config: { to: '{{subject_email}}', subject: 'Privacy Request Received - {{regulation}}', body: 'We have received your {{request_type}} request. We will respond within the statutory deadline.' }, position: { x: 450, y: 200 }, next: 'n4' },
        { id: 'n4', type: 'delay', label: 'Wait Until SLA Minus 3 Days', config: { duration: 27, unit: 'days' }, position: { x: 650, y: 200 }, next: 'n5' },
        { id: 'n5', type: 'condition', label: 'Request Completed?', config: { field: 'request_status', operator: '=', value: 'completed' }, position: { x: 850, y: 200 }, branches: { yes: null, no: 'n6' } },
        { id: 'n6', type: 'notification', label: 'SLA Warning: 3 Days Left', config: { role: 'compliance_officer,admin', title: 'Privacy Request SLA Warning', message: 'Privacy request from {{subject_name}} is due in 3 days. Immediate action required.', priority: 'urgent', web_push: true }, position: { x: 1050, y: 200 }, next: null },
      ],
    },
  },
];

export class WorkflowTemplateService {
  static getAllTemplates(): WorkflowTemplate[] {
    return WORKFLOW_TEMPLATES;
  }

  static getTemplatesByCategory(category: string): WorkflowTemplate[] {
    return WORKFLOW_TEMPLATES.filter(t => t.category === category);
  }

  static getTemplate(id: string): WorkflowTemplate | undefined {
    return WORKFLOW_TEMPLATES.find(t => t.id === id);
  }

  static getCategories(): string[] {
    return [...new Set(WORKFLOW_TEMPLATES.map(t => t.category))];
  }
}
