// Workflow trigger events — used when apps call POST /workflow/trigger
export const WORKFLOW_EVENTS = {
  LEAVE_SUBMITTED: 'leave.submitted',
  LEAVE_APPROVED: 'leave.approved',
  LEAVE_REJECTED: 'leave.rejected',
  LEAVE_ENCASHMENT_REQUESTED: 'leave_encashment.requested',
  INVOICE_SUBMITTED: 'invoice.submitted',
  INVOICE_APPROVED: 'invoice.approved',
  PAYROLL_SUBMITTED: 'payroll.submitted',
  PAYROLL_APPROVED: 'payroll.approved',
  ONBOARDING_STARTED: 'onboarding.started',
  ONBOARDING_COMPLETED: 'onboarding.completed',
  RECRUITMENT_HIRED: 'recruitment.hired',
  TICKET_SUBMITTED: 'ticket.submitted',
  TICKET_ESCALATED: 'ticket.escalated',
  ASSET_ASSIGNED: 'asset.assigned',
  TRAINING_ENROLLED: 'training.enrolled',
  DOCUMENT_SIGNATURE_REQUESTED: 'document.signature_requested',
  PERFORMANCE_REVIEW_DUE: 'performance.review_due',
  EXPENSE_SUBMITTED: 'expense.submitted',
} as const;

export type WorkflowEvent = typeof WORKFLOW_EVENTS[keyof typeof WORKFLOW_EVENTS];

// Where each workflow event is triggered from (for documentation/UI)
export const WORKFLOW_EVENT_SOURCES: Record<WorkflowEvent, { app: string; route: string; description: string }> = {
  [WORKFLOW_EVENTS.LEAVE_SUBMITTED]: { app: 'Employee Dashboard', route: '/dashboard', description: 'Employee submits a leave request' },
  [WORKFLOW_EVENTS.LEAVE_ENCASHMENT_REQUESTED]: { app: 'Employee Dashboard', route: '/dashboard', description: 'Employee requests leave encashment' },
  [WORKFLOW_EVENTS.INVOICE_SUBMITTED]: { app: 'Invoice Generation', route: '/invoices', description: 'Finance submits invoice for approval' },
  [WORKFLOW_EVENTS.PAYROLL_SUBMITTED]: { app: 'Payroll', route: '/payroll', description: 'HR processes and submits payroll for approval' },
  [WORKFLOW_EVENTS.ONBOARDING_STARTED]: { app: 'Onboarding', route: '/onboarding', description: 'New joiner onboarding record created' },
  [WORKFLOW_EVENTS.ONBOARDING_COMPLETED]: { app: 'Onboarding', route: '/onboarding', description: 'New joiner completes onboarding' },
  [WORKFLOW_EVENTS.RECRUITMENT_HIRED]: { app: 'Recruitment', route: '/recruitment', description: 'Candidate marked as Hired' },
  [WORKFLOW_EVENTS.TICKET_SUBMITTED]: { app: 'IT Services', route: '/it-services', description: 'Employee raises an IT ticket' },
  [WORKFLOW_EVENTS.TICKET_ESCALATED]: { app: 'IT Services', route: '/it-services', description: 'Ticket escalated due to SLA breach' },
  [WORKFLOW_EVENTS.ASSET_ASSIGNED]: { app: 'Asset Management', route: '/assets', description: 'Asset assigned to an employee' },
  [WORKFLOW_EVENTS.TRAINING_ENROLLED]: { app: 'Training', route: '/training', description: 'Employee enrolled in a training course' },
  [WORKFLOW_EVENTS.DOCUMENT_SIGNATURE_REQUESTED]: { app: 'Onboarding', route: '/onboarding', description: 'Document sent for digital signature' },
  [WORKFLOW_EVENTS.PERFORMANCE_REVIEW_DUE]: { app: 'Performance', route: '/performance', description: 'Performance review cycle is due' },
  [WORKFLOW_EVENTS.EXPENSE_SUBMITTED]: { app: 'Payroll', route: '/payroll', description: 'Employee submits an expense claim' },
  [WORKFLOW_EVENTS.LEAVE_APPROVED]: { app: 'Employee Dashboard', route: '/dashboard', description: 'Leave request approved' },
  [WORKFLOW_EVENTS.LEAVE_REJECTED]: { app: 'Employee Dashboard', route: '/dashboard', description: 'Leave request rejected' },
  [WORKFLOW_EVENTS.INVOICE_APPROVED]: { app: 'Invoice Generation', route: '/invoices', description: 'Invoice approved' },
  [WORKFLOW_EVENTS.PAYROLL_APPROVED]: { app: 'Payroll', route: '/payroll', description: 'Payroll run approved' },
};

// Pre-built workflow template node structures (matches WorkflowDefinition.nodes shape)
export const WORKFLOW_TEMPLATE_DEFINITIONS = {
  LEAVE_APPROVAL_SINGLE: 'leave_approval_single',
  LEAVE_APPROVAL_MULTI_LEVEL: 'leave_approval_multi',
  INVOICE_APPROVAL: 'invoice_approval',
  PAYROLL_APPROVAL: 'payroll_approval',
  ONBOARDING_CHECKLIST: 'onboarding_checklist',
  IT_TICKET_ESCALATION: 'it_ticket_escalation',
  DOCUMENT_SIGNATURE: 'document_signature',
  EXPENSE_APPROVAL: 'expense_approval',
} as const;

export const WORKFLOW_NODE_TYPES = ['trigger', 'notification', 'approval', 'condition', 'delay', 'action', 'end'] as const;

export const WORKFLOW_APPROVER_ROLES = [
  { value: 'manager', label: 'Line Manager' },
  { value: 'hr', label: 'HR Manager' },
  { value: 'finance', label: 'Finance' },
  { value: 'admin', label: 'Admin' },
] as const;

export const WORKFLOW_TRIGGER_TYPES = [
  { value: 'manual', label: 'Manual Trigger' },
  { value: 'event', label: 'Event-Based (automatic)' },
  { value: 'scheduled', label: 'Scheduled (time-based)' },
  { value: 'form_submission', label: 'Form Submission' },
  { value: 'status_change', label: 'Status Change' },
] as const;
