import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { WorkflowDefinition, WorkflowNode, NodeType, TriggerType } from '../../services/workflowEngine';
import { supabase } from '../../utils/constants';
import { useUser } from '../../context/UserContext';
import {
  Plus,
  Save,
  X,
  Zap,
  GitBranch,
  Send,
  Bell,
  Clock,
  CheckCircle,
  Settings,
  Trash2,
  ArrowDown,
  Database,
  Edit3,
  Mail,
  Globe,
  RefreshCw,
  SplitSquareHorizontal,
  History,
  ChevronDown,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import { t } from '../../../i18n';

interface WorkflowBuilderProps {
  existingWorkflow?: WorkflowDefinition;
  onClose: () => void;
  onSave?: (
    def: Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
    existingId?: string
  ) => Promise<void>;
}

// ── Master data ───────────────────────────────────────────────────────────────

const WORKFLOW_TRIGGER_EVENTS: Record<string, Record<string, string[]>> = {
  'Leave Management': {
    Leaves: ['leave_applied', 'leave_approved', 'leave_rejected', 'leave_cancelled'],
    'Leave Balances': ['balance_updated', 'balance_expired'],
  },
  Attendance: {
    Attendance: ['attendance_corrected', 'attendance_flagged'],
  },
  Recruitment: {
    'Job Requisitions': ['job_requisition_submitted', 'job_requisition_approved'],
    Candidates: ['candidate_applied', 'candidate_hired', 'offer_accepted'],
    Interviews: ['interview_scheduled', 'interview_completed'],
  },
  Performance: {
    Reviews: ['review_submitted', 'review_completed'],
    PIP: ['pip_created', 'pip_completed'],
  },
  Training: {
    Enrollments: ['enrollment_created', 'enrollment_completed'],
    Certificates: ['certificate_expiring', 'certificate_expired'],
  },
  Onboarding: {
    'Onboarding Records': ['onboarding_started', 'document_signed'],
  },
  Offboarding: {
    'Offboarding Records': ['employee_exit_initiated', 'exit_interview_completed'],
  },
  'IT Services': {
    Tickets: ['ticket_created', 'ticket_escalated', 'ticket_resolved'],
  },
  Projects: {
    Projects: ['project_created', 'milestone_completed'],
  },
  'OKR Management': {
    OKRs: ['okr_checkin_missed', 'okr_behind_midcycle', 'okr_blocker_flagged', 'okr_cycle_closing_7d'],
  },
  'Invoice Generation': {
    Invoices: ['invoice_overdue', 'invoice_overdue_14d', 'partial_payment_received', 'recurring_invoice_due'],
  },
  'Payroll Management': {
    Payroll: ['payroll_processing_due', 'salary_revision_submitted', 'payroll_lock_created', 'compliance_challan_due'],
  },
  'Security & Compliance': {
    Security: ['critical_audit_event', 'compliance_deadline_7d', 'privacy_request_overdue'],
  },
  'Advanced Analytics': {
    Analytics: ['anomaly_detected', 'scheduled_report_failed'],
  },
};

const EVENT_PAYLOAD_SCHEMAS: Record<string, Record<string, string>> = {
  leave_applied: { leave_id: 'UUID', employee_id: 'UUID', type: 'string', start_date: 'date', end_date: 'date', days: 'number', status: 'string' },
  candidate_hired: { candidate_id: 'UUID', employee_id: 'UUID', joining_date: 'date', job_title: 'string', manager_id: 'UUID' },
  pip_created: { pip_id: 'UUID', employee_id: 'UUID', employee_name: 'string', manager_id: 'UUID', created_by: 'UUID' },
  employee_exit_initiated: { employee_id: 'UUID', employee_name: 'string', last_working_date: 'date', user_account_id: 'UUID', personal_email: 'string' },
};

const TRIGGER_PAYLOAD_SCHEMAS: Record<string, { field: string; type: string; description: string }[]> = {
  employee_created: [
    { field: 'employee_id', type: 'string', description: 'New employee UUID' },
    { field: 'name', type: 'string', description: 'Full name' },
    { field: 'department', type: 'string', description: 'Department name' },
    { field: 'role', type: 'string', description: 'Job title' },
    { field: 'start_date', type: 'date', description: 'Employment start date' }
  ],
  invoice_overdue: [
    { field: 'invoice_id', type: 'string', description: 'Invoice UUID' },
    { field: 'invoice_number', type: 'string', description: 'Invoice number e.g. INV-001' },
    { field: 'client_name', type: 'string', description: 'Client company name' },
    { field: 'balance_due', type: 'number', description: 'Outstanding amount in INR' },
    { field: 'days_overdue', type: 'number', description: 'Days past due date' }
  ],
  payroll_processed: [
    { field: 'month', type: 'number', description: 'Payroll month (1-12)' },
    { field: 'year', type: 'number', description: 'Payroll year' },
    { field: 'employee_count', type: 'number', description: 'Number of employees processed' },
    { field: 'total_gross', type: 'number', description: 'Total gross payroll amount' }
  ],
  okr_checkin_due: [
    { field: 'okr_id', type: 'string', description: 'OKR UUID' },
    { field: 'okr_title', type: 'string', description: 'OKR title' },
    { field: 'owner_id', type: 'string', description: 'OKR owner user ID' },
    { field: 'cycle_name', type: 'string', description: 'Active cycle name' },
    { field: 'due_date', type: 'date', description: 'Check-in due date' }
  ],
  compliance_deadline_7d: [
    { field: 'framework', type: 'string', description: 'Compliance framework name' },
    { field: 'requirement_id', type: 'string', description: 'Requirement UUID' },
    { field: 'requirement_name', type: 'string', description: 'Requirement title' },
    { field: 'deadline', type: 'date', description: 'Compliance deadline' }
  ],
  salary_revision_submitted: [
    { field: 'revision_id', type: 'string', description: 'Revision UUID' },
    { field: 'employee_id', type: 'string', description: 'Employee UUID' },
    { field: 'employee_name', type: 'string', description: 'Employee full name' },
    { field: 'new_ctc', type: 'number', description: 'Proposed new CTC' },
    { field: 'revision_type', type: 'string', description: 'increment/promotion/correction' }
  ],
  privacy_request_received: [
    { field: 'request_id', type: 'string', description: 'Privacy request UUID' },
    { field: 'request_type', type: 'string', description: 'access/erasure/portability/rectification' },
    { field: 'requester_name', type: 'string', description: 'Data subject name' },
    { field: 'regulation', type: 'string', description: 'GDPR/CCPA' },
    { field: 'due_date', type: 'date', description: 'Response deadline' }
  ],
  ticket_sla_breach: [
    { field: 'ticket_id', type: 'string', description: 'IT Ticket UUID' },
    { field: 'ticket_title', type: 'string', description: 'Ticket title' },
    { field: 'priority', type: 'string', description: 'low/medium/high/critical' },
    { field: 'assigned_to', type: 'string', description: 'Assigned agent user ID' },
    { field: 'breached_by_hours', type: 'number', description: 'Hours past SLA' }
  ],
  leave_approved: [
    { field: 'leave_id', type: 'string', description: 'Leave request UUID' },
    { field: 'employee_id', type: 'string', description: 'Employee UUID' },
    { field: 'leave_type', type: 'string', description: 'annual/sick/casual/maternity' },
    { field: 'start_date', type: 'date', description: 'Leave start date' },
    { field: 'end_date', type: 'date', description: 'Leave end date' },
    { field: 'approved_by', type: 'string', description: 'Approver user ID' }
  ],
  asset_assigned: [
    { field: 'asset_id', type: 'string', description: 'Asset UUID' },
    { field: 'asset_name', type: 'string', description: 'Asset name/model' },
    { field: 'assigned_to', type: 'string', description: 'Employee user ID' },
    { field: 'assigned_date', type: 'date', description: 'Assignment date' }
  ],
  recruitment_offer_accepted: [
    { field: 'application_id', type: 'string', description: 'Application UUID' },
    { field: 'candidate_name', type: 'string', description: 'Candidate full name' },
    { field: 'position', type: 'string', description: 'Job position title' },
    { field: 'joining_date', type: 'date', description: 'Expected joining date' }
  ],
  training_completed: [
    { field: 'enrollment_id', type: 'string', description: 'Enrollment UUID' },
    { field: 'employee_id', type: 'string', description: 'Employee UUID' },
    { field: 'course_name', type: 'string', description: 'Course title' },
    { field: 'score', type: 'number', description: 'Completion score (0-100)' },
    { field: 'completed_at', type: 'date', description: 'Completion timestamp' }
  ],
  expense_submitted: [
    { field: 'expense_id', type: 'string', description: 'Expense report UUID' },
    { field: 'employee_id', type: 'string', description: 'Submitting employee UUID' },
    { field: 'amount', type: 'number', description: 'Total expense amount' },
    { field: 'category', type: 'string', description: 'Expense category' },
    { field: 'submitted_at', type: 'date', description: 'Submission timestamp' }
  ],
  performance_review_due: [
    { field: 'review_id', type: 'string', description: 'Review UUID' },
    { field: 'employee_id', type: 'string', description: 'Employee UUID' },
    { field: 'reviewer_id', type: 'string', description: 'Reviewer user ID' },
    { field: 'due_date', type: 'date', description: 'Review submission deadline' },
    { field: 'review_period', type: 'string', description: 'Review period e.g. Q3-2026' }
  ],
  security_incident_detected: [
    { field: 'incident_id', type: 'string', description: 'Security incident UUID' },
    { field: 'severity', type: 'string', description: 'low/medium/high/critical' },
    { field: 'incident_type', type: 'string', description: 'Type of security event' },
    { field: 'detected_at', type: 'date', description: 'Detection timestamp' },
    { field: 'affected_system', type: 'string', description: 'Affected system/resource' }
  ],
  project_status_changed: [
    { field: 'project_id', type: 'string', description: 'Project UUID' },
    { field: 'project_name', type: 'string', description: 'Project name' },
    { field: 'old_status', type: 'string', description: 'Previous status' },
    { field: 'new_status', type: 'string', description: 'New status' },
    { field: 'changed_by', type: 'string', description: 'User who made the change' }
  ]
};

const HR_APPS = [
  'leave_management', 'attendance', 'recruitment', 'performance', 'training',
  'onboarding', 'offboarding', 'employee_directory', 'it_services', 'payroll',
  'user_management', 'projects',
];

const APP_ENTITIES: Record<string, string[]> = {
  leave_management: ['leaves', 'leave_balances'],
  attendance: ['attendance_records'],
  recruitment: ['job_requisitions', 'job_postings', 'candidates', 'offers'],
  performance: ['reviews', 'pip'],
  training: ['training_enrollments', 'certificates'],
  onboarding: ['onboarding_records'],
  offboarding: ['offboarding_records', 'exit_interviews'],
  employee_directory: ['employees'],
  it_services: ['it_tickets'],
  payroll: ['payroll_runs'],
  user_management: ['user_accounts'],
  projects: ['projects', 'milestones'],
};

const CRON_PRESETS: Array<{ labelKey: string; cron: string }> = [
  { labelKey: 'workflowBuilder.presetEveryDay8am', cron: '0 8 * * *' },
  { labelKey: 'workflowBuilder.presetEveryMonday9am', cron: '0 9 * * 1' },
  { labelKey: 'workflowBuilder.presetFirst1stMonth', cron: '0 9 1 * *' },
  { labelKey: 'workflowBuilder.presetQuarterly', cron: '0 9 1 1,4,7,10 *' },
  { labelKey: 'workflowBuilder.presetCustom', cron: '' },
];

// ── Condition group types ─────────────────────────────────────────────────────

interface SingleCondition {
  field: string;
  operator: string;
  value: string | number | boolean;
}

interface ConditionGroup {
  operator: 'AND' | 'OR';
  conditions: Array<SingleCondition | ConditionGroup>;
}

// ── Node type definitions ─────────────────────────────────────────────────────

const NODE_TYPES: Array<{
  type: NodeType;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  bg: string;
  color: string;
  section: string;
}> = [
  { type: 'trigger',      labelKey: 'workflowBuilder.nodeTypeTrigger',      icon: Zap,                   bg: 'bg-purple-50',  color: 'text-purple-600',  section: 'Trigger' },
  { type: 'condition',    labelKey: 'workflowBuilder.nodeTypeCondition',     icon: GitBranch,             bg: 'bg-amber-50',   color: 'text-amber-600',   section: 'Logic' },
  { type: 'parallel',     labelKey: 'workflowBuilder.nodeTypeParallel',      icon: SplitSquareHorizontal, bg: 'bg-violet-50',  color: 'text-violet-600',  section: 'Logic' },
  { type: 'loop',         labelKey: 'workflowBuilder.nodeTypeLoop',          icon: RefreshCw,             bg: 'bg-purple-50',  color: 'text-purple-700',  section: 'Logic' },
  { type: 'delay',        labelKey: 'workflowBuilder.nodeTypeDelay',         icon: Clock,                 bg: 'bg-slate-50',   color: 'text-slate-600',   section: 'Logic' },
  { type: 'approval',     labelKey: 'workflowBuilder.nodeTypeApproval',      icon: CheckCircle,           bg: 'bg-green-50',   color: 'text-green-600',   section: 'Actions' },
  { type: 'notification', labelKey: 'workflowBuilder.nodeTypeNotification',  icon: Bell,                  bg: 'bg-orange-50',  color: 'text-orange-600',  section: 'Actions' },
  { type: 'email',        labelKey: 'workflowBuilder.nodeTypeEmail',         icon: Mail,                  bg: 'bg-sky-50',     color: 'text-sky-600',     section: 'Actions' },
  { type: 'create_record',labelKey: 'workflowBuilder.nodeTypeCreateRecord',  icon: Database,              bg: 'bg-emerald-50', color: 'text-emerald-600', section: 'Actions' },
  { type: 'update_field', labelKey: 'workflowBuilder.nodeTypeUpdateField',   icon: Edit3,                 bg: 'bg-amber-50',   color: 'text-amber-700',   section: 'Actions' },
  { type: 'webhook',      labelKey: 'workflowBuilder.nodeTypeWebhook',       icon: Globe,                 bg: 'bg-rose-50',    color: 'text-rose-600',    section: 'Actions' },
  { type: 'action',       labelKey: 'workflowBuilder.nodeTypeAction',        icon: Send,                  bg: 'bg-blue-50',    color: 'text-blue-600',    section: 'Actions' },
  { type: 'end',          labelKey: 'workflowBuilder.nodeTypeEnd',           icon: CheckCircle,           bg: 'bg-red-50',     color: 'text-red-500',     section: 'Actions' },
  { type: 'audit_log',   labelKey: 'workflowBuilder.nodeTypeAuditLog',      icon: Shield,                bg: 'bg-emerald-50', color: 'text-emerald-600', section: 'Actions' },
];

const TRIGGER_TYPE_KEYS: Record<TriggerType, string> = {
  manual:          'workflowBuilder.triggerManual',
  scheduled:       'workflowBuilder.triggerScheduled',
  event:           'workflowBuilder.triggerEvent',
  form_submission: 'workflowBuilder.triggerFormSubmission',
  status_change:   'workflowBuilder.triggerStatusChange',
};

const selectCls = 'w-full border border-border rounded-lg px-3 py-2 text-sm bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary';

// ── Cron options ──────────────────────────────────────────────────────────────

const MINUTE_OPTIONS = ['*', '0', '5', '10', '15', '30', '45'];
const HOUR_OPTIONS = ['*', '0', '6', '7', '8', '9', '10', '12', '17', '18', '20', '23'];
const DAY_OF_MONTH_OPTIONS = ['*', '1', '7', '14', '15', '28', '31'];
const MONTH_OPTIONS = ['*', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const DAY_OF_WEEK_OPTIONS = [
  { value: '*', label: 'Every day' },
  { value: '1', label: 'Monday' }, { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' }, { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' }, { value: '0', label: 'Sunday' }, { value: '6', label: 'Saturday' },
];

// ── Cron helpers ──────────────────────────────────────────────────────────────

function cronToHuman(cron: string): string {
  const preset = CRON_PRESETS.find(p => p.cron === cron && p.cron);
  if (preset) return t(preset.labelKey);
  if (!cron) return '';
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;
  const [min, hour, dom, month, dow] = parts;
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let desc = 'Runs';
  if (dow !== '*') desc += ` every ${days[parseInt(dow)] ?? dow}`;
  if (dom !== '*') desc += ` on day ${dom} of month`;
  if (month !== '*') desc += ` in month ${month}`;
  if (hour !== '*' && min !== '*') desc += ` at ${hour}:${min.padStart(2,'0')}`;
  return desc;
}

function getNextRuns(cron: string): string[] {
  if (!cron) return [];
  const results: string[] = [];
  const now = new Date();
  const parts = cron.split(' ');
  if (parts.length !== 5) return [];
  const [, hourStr, , , dowStr] = parts;
  const hour = parseInt(hourStr);
  const dow = dowStr !== '*' ? parseInt(dowStr) : -1;
  let cursor = new Date(now);
  cursor.setMinutes(0, 0, 0);
  let attempts = 0;
  while (results.length < 3 && attempts < 366) {
    cursor.setHours(isNaN(hour) ? 0 : hour);
    if (cursor > now) {
      if (dow === -1 || cursor.getDay() === dow) {
        results.push(cursor.toLocaleString());
      }
    }
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    attempts++;
  }
  return results;
}

// ── Schedule Trigger Config ───────────────────────────────────────────────────

interface CronParts { minute: string; hour: string; dayOfMonth: string; month: string; dayOfWeek: string }

function parseCronParts(cron: string): CronParts {
  const parts = cron ? cron.split(' ') : [];
  return {
    minute: parts[0] || '*',
    hour: parts[1] || '*',
    dayOfMonth: parts[2] || '*',
    month: parts[3] || '*',
    dayOfWeek: parts[4] || '*',
  };
}

function buildCron(parts: CronParts): string {
  return `${parts.minute} ${parts.hour} ${parts.dayOfMonth} ${parts.month} ${parts.dayOfWeek}`;
}

function ScheduleTriggerConfig({
  config,
  onChange,
}: {
  config: any;
  onChange: (cfg: any) => void;
}) {
  const cron: string = config.cron || '* * * * *';
  const parts = parseCronParts(cron);
  const nextRuns = getNextRuns(cron);
  const humanReadable = cronToHuman(cron);

  const updatePart = (key: keyof CronParts, value: string) => {
    const newParts = { ...parts, [key]: value };
    const newCron = buildCron(newParts);
    onChange({ ...config, cron: newCron });
  };

  return (
    <div className="space-y-3">
      {/* 5 cron dropdowns */}
      <div className="grid grid-cols-5 gap-2">
        <div className="space-y-1">
          <Label className="text-xs font-medium">{t('workflow.cronMinute')}</Label>
          <select className={selectCls} value={parts.minute} onChange={e => updatePart('minute', e.target.value)}>
            {MINUTE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium">{t('workflow.cronHour')}</Label>
          <select className={selectCls} value={parts.hour} onChange={e => updatePart('hour', e.target.value)}>
            {HOUR_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium">{t('workflow.cronDay')}</Label>
          <select className={selectCls} value={parts.dayOfMonth} onChange={e => updatePart('dayOfMonth', e.target.value)}>
            {DAY_OF_MONTH_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium">{t('workflow.cronMonth')}</Label>
          <select className={selectCls} value={parts.month} onChange={e => updatePart('month', e.target.value)}>
            {MONTH_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium">{t('workflow.cronWeekday')}</Label>
          <select className={selectCls} value={parts.dayOfWeek} onChange={e => updatePart('dayOfWeek', e.target.value)}>
            {DAY_OF_WEEK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">{t('workflowBuilder.scheduleTimezone')}</Label>
        <select
          className={selectCls}
          value={config.timezone || 'UTC'}
          onChange={e => onChange({ ...config, timezone: e.target.value })}
        >
          {['UTC','Asia/Kolkata','America/New_York','America/Los_Angeles','Europe/London','Europe/Berlin','Asia/Tokyo','Australia/Sydney'].map(tz => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </div>

      <div className="bg-muted/40 border border-border rounded-lg p-3 space-y-2">
        <p className="text-xs font-medium text-foreground">{t('workflowBuilder.schedulePreviewLabel')}:</p>
        <p className="text-xs text-primary font-medium">{humanReadable || cron}</p>
        {nextRuns.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t('workflowBuilder.scheduleNextRuns')}:</p>
            {nextRuns.map((r, i) => (
              <p key={i} className="text-xs text-muted-foreground">• {r}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Event Trigger Config ──────────────────────────────────────────────────────

function EventTriggerConfig({
  config,
  onChange,
}: {
  config: any;
  onChange: (cfg: any) => void;
}) {
  const apps = Object.keys(WORKFLOW_TRIGGER_EVENTS);
  const selectedApp = config.app || '';
  const entities = selectedApp ? Object.keys(WORKFLOW_TRIGGER_EVENTS[selectedApp] || {}) : [];
  const selectedEntity = config.entity || '';
  const events = selectedApp && selectedEntity
    ? (WORKFLOW_TRIGGER_EVENTS[selectedApp]?.[selectedEntity] || [])
    : [];
  const selectedEvent = config.event_key || '';
  const payloadSchema = EVENT_PAYLOAD_SCHEMAS[selectedEvent] || {};
  const payloadFields = Object.keys(payloadSchema);
  const triggerPayloadFields = TRIGGER_PAYLOAD_SCHEMAS[selectedEvent] ?? null;

  const filter = config.condition_filter || { field: '', operator: 'equals', value: '' };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">{t('workflowBuilder.eventApp')}</Label>
        <select
          className={selectCls}
          value={selectedApp}
          onChange={e => onChange({ ...config, app: e.target.value, entity: '', event_key: '' })}
        >
          <option value="">{t('workflowBuilder.selectApp')}</option>
          {apps.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {selectedApp && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t('workflowBuilder.eventEntity')}</Label>
          <select
            className={selectCls}
            value={selectedEntity}
            onChange={e => onChange({ ...config, entity: e.target.value, event_key: '' })}
          >
            <option value="">{t('workflowBuilder.selectEntity')}</option>
            {entities.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      )}

      {selectedEntity && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t('workflowBuilder.eventKey')}</Label>
          <select
            className={selectCls}
            value={selectedEvent}
            onChange={e => onChange({ ...config, event_key: e.target.value })}
          >
            <option value="">{t('workflowBuilder.selectEvent')}</option>
            {events.map(ev => <option key={ev} value={ev}>{ev}</option>)}
          </select>
        </div>
      )}

      {selectedEvent && triggerPayloadFields ? (
        <div className="bg-muted/40 border border-border rounded-lg p-3">
          <p className="text-xs font-medium text-foreground mb-2">Available Payload Fields</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left pb-1 pr-2 font-medium">Field</th>
                <th className="text-left pb-1 pr-2 font-medium">Type</th>
                <th className="text-left pb-1 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {triggerPayloadFields.map(f => (
                <tr key={f.field} className="border-b border-border/40 last:border-0">
                  <td className="py-1 pr-2 font-mono text-foreground">{f.field}</td>
                  <td className="py-1 pr-2 text-muted-foreground">{f.type}</td>
                  <td className="py-1 text-muted-foreground">{f.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : selectedEvent && payloadFields.length > 0 ? (
        <div className="bg-muted/40 border border-border rounded-lg p-3">
          <p className="text-xs font-medium text-foreground mb-2">{t('workflowBuilder.eventPayloadPreview')}</p>
          <div className="space-y-1">
            {payloadFields.map(field => (
              <p key={field} className="text-xs text-muted-foreground font-mono">
                <span className="text-foreground">{field}</span>: {payloadSchema[field]}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {selectedEvent && (
        <div className="space-y-2">
          <Label className="text-xs font-medium">{t('workflowBuilder.eventFilterLabel')}</Label>
          <div className="flex gap-2 items-center">
            <select
              className={`${selectCls} flex-1`}
              value={filter.field}
              onChange={e => onChange({ ...config, condition_filter: { ...filter, field: e.target.value } })}
            >
              <option value="">{t('workflowBuilder.eventFilterField')}</option>
              {payloadFields.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <select
              className={`${selectCls} flex-1`}
              value={filter.operator}
              onChange={e => onChange({ ...config, condition_filter: { ...filter, operator: e.target.value } })}
            >
              {['equals','not_equals','greater_than','less_than','contains','is_empty','is_not_empty'].map(op => (
                <option key={op} value={op}>{op.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <Input
              className="flex-1"
              placeholder={t('workflowBuilder.eventFilterValue')}
              value={filter.value}
              onChange={e => onChange({ ...config, condition_filter: { ...filter, value: e.target.value } })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Condition Group Builder ───────────────────────────────────────────────────

function ConditionGroupBuilder({
  group,
  onChange,
  depth = 0,
}: {
  group: ConditionGroup;
  onChange: (g: ConditionGroup) => void;
  depth?: number;
}) {
  const addCondition = () => {
    onChange({
      ...group,
      conditions: [...group.conditions, { field: '', operator: 'equals', value: '' }],
    });
  };

  const addGroup = () => {
    if (depth >= 2) return;
    onChange({
      ...group,
      conditions: [...group.conditions, { operator: 'AND', conditions: [] }],
    });
  };

  const removeAt = (i: number) => {
    onChange({ ...group, conditions: group.conditions.filter((_, idx) => idx !== i) });
  };

  const updateAt = (i: number, updated: SingleCondition | ConditionGroup) => {
    onChange({ ...group, conditions: group.conditions.map((c, idx) => idx === i ? updated : c) });
  };

  return (
    <div className={`space-y-2 ${depth > 0 ? 'ml-4 pl-3 border-l-2 border-primary/20 bg-muted/20 rounded-r-lg p-2' : ''}`}>
      {/* AND/OR toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{t('workflowBuilder.groupLogic')}:</span>
        <div className="flex border border-border rounded-lg overflow-hidden">
          {(['AND','OR'] as const).map(logic => (
            <button
              key={logic}
              onClick={() => onChange({ ...group, operator: logic })}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                group.operator === logic ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-muted'
              }`}
            >
              {logic}
            </button>
          ))}
        </div>
      </div>

      {group.conditions.map((cond, i) => {
        const isGroup = 'conditions' in cond;
        return (
          <div key={i}>
            {i > 0 && (
              <div className="text-xs text-muted-foreground text-center py-0.5 font-semibold">
                {group.operator}
              </div>
            )}
            {isGroup ? (
              <div className="relative">
                <ConditionGroupBuilder
                  group={cond as ConditionGroup}
                  onChange={g => updateAt(i, g)}
                  depth={depth + 1}
                />
                <button
                  onClick={() => removeAt(i)}
                  className="absolute top-0 right-0 text-xs text-red-500 hover:text-red-700 p-1"
                >
                  {t('workflowBuilder.removeGroup')}
                </button>
              </div>
            ) : (
              <div className="flex gap-1.5 items-center">
                <Input
                  className="flex-1 text-xs h-8"
                  placeholder={t('workflowBuilder.eventFilterField')}
                  value={(cond as SingleCondition).field}
                  onChange={e => updateAt(i, { ...cond as SingleCondition, field: e.target.value })}
                />
                <select
                  className="border border-border rounded-lg px-1.5 py-1 text-xs bg-input-background"
                  value={(cond as SingleCondition).operator}
                  onChange={e => updateAt(i, { ...cond as SingleCondition, operator: e.target.value })}
                >
                  {['equals','not_equals','greater_than','less_than','greater_than_or_equal','less_than_or_equal','contains','does_not_contain','is_empty','is_not_empty','in_list','not_in_list'].map(op => (
                    <option key={op} value={op}>{op.replace(/_/g,' ')}</option>
                  ))}
                </select>
                <Input
                  className="flex-1 text-xs h-8"
                  placeholder="value"
                  value={String((cond as SingleCondition).value ?? '')}
                  onChange={e => updateAt(i, { ...cond as SingleCondition, value: e.target.value })}
                />
                <button onClick={() => removeAt(i)} className="p-1 text-red-400 hover:text-red-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={addCondition}
          className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          {t('workflowBuilder.addCondition')}
        </button>
        {depth < 2 && (
          <button
            onClick={addGroup}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <Plus className="h-3 w-3" />
            {t('workflowBuilder.addGroup')}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Version History Modal ─────────────────────────────────────────────────────

interface WorkflowVersion {
  id: string;
  version_number: number;
  change_summary: string;
  changed_at: string;
  changed_by: string;
  nodes: any;
}

function VersionHistoryPanel({
  workflowId,
  currentNodes,
  onRestore,
  onClose,
}: {
  workflowId: string;
  currentNodes: WorkflowNode[];
  onRestore: (nodes: WorkflowNode[]) => void;
  onClose: () => void;
}) {
  const [versions, setVersions] = useState<WorkflowVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changeNotes, setChangeNotes] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  const loadVersions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('workflow_versions')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('version_number', { ascending: false });
    setVersions(data || []);
    setLoading(false);
  };

  useState(() => { loadVersions(); });

  const handleSaveVersion = async () => {
    if (!changeNotes.trim()) { toast.error(t('workflowBuilder.placeholderChangeNotes')); return; }
    setSaving(true);
    const maxVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version_number)) : 0;
    const { error } = await supabase.from('workflow_versions').insert([{
      workflow_id: workflowId,
      version_number: maxVersion + 1,
      nodes: currentNodes,
      edges: [],
      change_summary: changeNotes,
      is_current: true,
    }]);
    setSaving(false);
    if (error) { toast.error(t('workflowBuilder.toastVersionSaveFailed')); return; }
    toast.success(t('workflowBuilder.toastVersionSaved'));
    setChangeNotes('');
    setShowSaveForm(false);
    loadVersions();
  };

  const handleRestore = (v: WorkflowVersion) => {
    onRestore(v.nodes || []);
    toast.success(t('workflowBuilder.toastVersionRestored'));
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">{t('workflowBuilder.versionHistory')}</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {showSaveForm ? (
            <div className="space-y-3">
              <Label className="text-xs font-medium">{t('workflowBuilder.versionChangeNotes')}</Label>
              <textarea
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-input-background resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder={t('workflowBuilder.placeholderChangeNotes')}
                value={changeNotes}
                onChange={e => setChangeNotes(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveVersion} disabled={saving} className="flex-1">
                  {saving ? t('workflowBuilder.saving') : t('workflowBuilder.saveVersion')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowSaveForm(false)}>
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setShowSaveForm(true)} className="w-full">
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {t('workflowBuilder.saveVersion')}
            </Button>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t('common.loading')}</p>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No versions saved yet.</p>
          ) : (
            <div className="space-y-2">
              {versions.map((v, i) => (
                <div key={v.id} className="border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        v{v.version_number}
                      </span>
                      {i === 0 && (
                        <Badge className="text-xs bg-green-50 text-green-700 border-green-200">
                          {t('workflowBuilder.versionCurrentBadge')}
                        </Badge>
                      )}
                    </div>
                    <button
                      onClick={() => handleRestore(v)}
                      className="text-xs text-primary hover:underline"
                    >
                      {t('workflowBuilder.versionRestoreBtn')}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">{v.change_summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(v.changed_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Node Config Panel ─────────────────────────────────────────────────────────

function NodeConfigPanel({
  node,
  nodes,
  onUpdate,
  onConnect,
}: {
  node: WorkflowNode;
  nodes: WorkflowNode[];
  onUpdate: (n: WorkflowNode) => void;
  onConnect: (fromId: string, toId: string) => void;
}) {
  const cfg = node.config ?? {};
  const upd = (patch: any) => onUpdate({ ...node, config: { ...cfg, ...patch } });

  // Condition group helper
  const conditionGroup: ConditionGroup = cfg.condition || { operator: 'AND', conditions: [] };

  // Field mapping helpers
  const fieldMappings: Array<{ source_field: string; target_field: string }> = cfg.field_mapping || [];
  const addMapping = () => upd({ field_mapping: [...fieldMappings, { source_field: '', target_field: '' }] });
  const removeMapping = (i: number) => upd({ field_mapping: fieldMappings.filter((_, idx) => idx !== i) });
  const updateMapping = (i: number, key: string, val: string) =>
    upd({ field_mapping: fieldMappings.map((m, idx) => idx === i ? { ...m, [key]: val } : m) });

  // Webhook headers
  const headers: Array<{ key: string; value: string }> = cfg.headers || [];
  const addHeader = () => upd({ headers: [...headers, { key: '', value: '' }] });
  const removeHeader = (i: number) => upd({ headers: headers.filter((_, idx) => idx !== i) });
  const updateHeader = (i: number, k: string, v: string) =>
    upd({ headers: headers.map((h, idx) => idx === i ? { ...h, [k]: v } : h) });

  return (
    <div className="space-y-4">
      {/* Label */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">{t('workflowBuilder.nodeLabelField')}</Label>
        <Input
          value={node.label}
          onChange={e => onUpdate({ ...node, label: e.target.value })}
        />
      </div>

      {/* ── APPROVAL ── */}
      {node.type === 'approval' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.stepName')}</Label>
            <Input
              placeholder={t('workflowBuilder.placeholderStepName')}
              value={cfg.step_name || ''}
              onChange={e => upd({ step_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.approverRole')}</Label>
            <select className={selectCls} value={cfg.approver_role || 'manager'}
              onChange={e => upd({ approver_role: e.target.value, approvers: [e.target.value] })}>
              <option value="admin">{t('workflowBuilder.optionAdmin')}</option>
              <option value="hr">{t('workflowBuilder.optionHr')}</option>
              <option value="finance">{t('workflowBuilder.optionFinance')}</option>
              <option value="manager">{t('workflowBuilder.optionManager')}</option>
              <option value="hr_manager">HR Manager</option>
              <option value="direct_manager">Direct Manager</option>
              <option value="department_manager">Department Manager</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.approvalMessage')}</Label>
            <Input
              placeholder={t('workflowBuilder.placeholderApprovalMessage')}
              value={cfg.message || ''}
              onChange={e => upd({ message: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={cfg.push_notify !== false}
              onChange={e => upd({ push_notify: e.target.checked })}
              className="h-4 w-4 rounded border-border" />
            <span className="text-xs font-medium text-foreground">{t('workflowBuilder.sendPushNotification')}</span>
          </label>
          {/* Response Deadline */}
          <div className="border-t border-border pt-3 mt-3">
            <label className="text-xs font-medium text-gray-700">{t('workflow.responseDeadline')}</label>
            <input
              type="number"
              min={1}
              placeholder="Hours (optional)"
              value={cfg.deadline_hours || ''}
              onChange={e => upd({ deadline_hours: e.target.value ? parseInt(e.target.value) : undefined })}
              className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            {cfg.deadline_hours && (
              <div className="mt-2">
                <label className="text-xs font-medium text-gray-700">{t('workflow.onTimeout')}</label>
                <div className="flex flex-col gap-1 mt-1">
                  {(['escalate', 'auto_approve', 'auto_reject'] as const).map(opt => (
                    <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name={`on_timeout_${node.id}`}
                        value={opt}
                        checked={cfg.on_timeout === opt}
                        onChange={() => upd({ on_timeout: opt })}
                        className="h-3.5 w-3.5"
                      />
                      <span className="text-xs text-foreground">
                        {opt === 'escalate' ? t('workflow.escalate') : opt === 'auto_approve' ? t('workflow.autoApprove') : t('workflow.autoReject')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── NOTIFICATION ── */}
      {node.type === 'notification' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.recipients')}</Label>
            <Input
              placeholder={t('workflowBuilder.placeholderRecipients')}
              value={cfg.recipients?.join(', ') || ''}
              onChange={e => upd({ recipients: e.target.value.split(',').map((s: string) => s.trim()) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.messageLabel')}</Label>
            <Input
              placeholder={t('workflowBuilder.placeholderNotificationMessage')}
              value={cfg.message || ''}
              onChange={e => upd({ message: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.channelLabel')}</Label>
            <select className={selectCls} value={cfg.channel || 'in_app'}
              onChange={e => upd({ channel: e.target.value })}>
              <option value="in_app">{t('workflowBuilder.optionInApp')}</option>
              <option value="email">{t('workflowBuilder.optionEmail')}</option>
              <option value="both">{t('workflowBuilder.optionBoth')}</option>
            </select>
          </div>
        </>
      )}

      {/* ── CONDITION ── */}
      {node.type === 'condition' && (
        <div className="space-y-2">
          <Label className="text-xs font-medium">{t('workflowBuilder.conditionGroups')}</Label>
          <ConditionGroupBuilder
            group={conditionGroup}
            onChange={g => upd({ condition: g })}
          />
        </div>
      )}

      {/* ── ACTION ── */}
      {node.type === 'action' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.actionType')}</Label>
            <select className={selectCls} value={cfg.actionType || ''}
              onChange={e => upd({ actionType: e.target.value })}>
              <option value="">{t('workflowBuilder.selectAction')}</option>
              <option value="update_status">{t('workflowBuilder.optionUpdateStatus')}</option>
              <option value="send_email">{t('workflowBuilder.optionSendEmail')}</option>
              <option value="create_record">{t('workflowBuilder.optionCreateRecord')}</option>
              <option value="update_field">{t('workflowBuilder.optionUpdateField')}</option>
            </select>
          </div>
          {cfg.actionType === 'update_status' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflowBuilder.newStatus')}</Label>
              <Input
                placeholder={t('workflowBuilder.placeholderNewStatus')}
                value={cfg.newStatus || ''}
                onChange={e => upd({ newStatus: e.target.value })}
              />
            </div>
          )}
        </>
      )}

      {/* ── DELAY ── */}
      {node.type === 'delay' && (
        <div className="flex gap-2">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.delayDuration')}</Label>
            <Input
              type="number"
              min={1}
              placeholder="1"
              value={cfg.duration_value || ''}
              onChange={e => upd({ duration_value: e.target.value })}
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.delayUnit')}</Label>
            <select className={selectCls} value={cfg.duration_unit || 'hours'}
              onChange={e => upd({ duration_unit: e.target.value })}>
              <option value="minutes">{t('workflowBuilder.delayUnitMinutes')}</option>
              <option value="hours">{t('workflowBuilder.delayUnitHours')}</option>
              <option value="days">{t('workflowBuilder.delayUnitDays')}</option>
              <option value="weeks">{t('workflowBuilder.delayUnitWeeks')}</option>
            </select>
          </div>
        </div>
      )}

      {/* ── PARALLEL ── */}
      {node.type === 'parallel' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.branchCount')}</Label>
            <Input
              type="number"
              min={2}
              max={5}
              value={cfg.branch_count || 2}
              onChange={e => upd({ branch_count: parseInt(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.branchLabels')}</Label>
            {Array.from({ length: cfg.branch_count || 2 }, (_, i) => (
              <Input
                key={i}
                placeholder={`${t('workflowBuilder.branchLabelPlaceholder')} ${i + 1}`}
                value={(cfg.branch_labels || [])[i] || ''}
                onChange={e => {
                  const labels = [...(cfg.branch_labels || [])];
                  labels[i] = e.target.value;
                  upd({ branch_labels: labels });
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* ── CREATE RECORD ── */}
      {node.type === 'create_record' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.targetApp')}</Label>
            <select className={selectCls} value={cfg.target_app || ''}
              onChange={e => upd({ target_app: e.target.value, entity: '' })}>
              <option value="">{t('workflowBuilder.selectApp')}</option>
              {HR_APPS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {cfg.target_app && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflowBuilder.targetEntity')}</Label>
              <select className={selectCls} value={cfg.entity || ''}
                onChange={e => upd({ entity: e.target.value })}>
                <option value="">{t('workflowBuilder.selectEntity')}</option>
                {(APP_ENTITIES[cfg.target_app] || []).map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-xs font-medium">{t('workflowBuilder.fieldMapping')}</Label>
            {fieldMappings.map((m, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <Input className="flex-1 text-xs h-8" placeholder={t('workflowBuilder.sourceField')} value={m.source_field}
                  onChange={e => updateMapping(i, 'source_field', e.target.value)} />
                <span className="text-xs text-muted-foreground">→</span>
                <Input className="flex-1 text-xs h-8" placeholder={t('workflowBuilder.targetField')} value={m.target_field}
                  onChange={e => updateMapping(i, 'target_field', e.target.value)} />
                <button onClick={() => removeMapping(i)} className="p-1 text-red-400 hover:text-red-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button onClick={addMapping} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
              <Plus className="h-3 w-3" />
              {t('workflowBuilder.addFieldMapping')}
            </button>
          </div>
        </>
      )}

      {/* ── UPDATE FIELD ── */}
      {node.type === 'update_field' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.targetApp')}</Label>
            <select className={selectCls} value={cfg.target_app || ''}
              onChange={e => upd({ target_app: e.target.value, entity: '' })}>
              <option value="">{t('workflowBuilder.selectApp')}</option>
              {HR_APPS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {cfg.target_app && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflowBuilder.targetEntity')}</Label>
              <select className={selectCls} value={cfg.entity || ''}
                onChange={e => upd({ entity: e.target.value })}>
                <option value="">{t('workflowBuilder.selectEntity')}</option>
                {(APP_ENTITIES[cfg.target_app] || []).map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.recordIdSource')}</Label>
            <Input placeholder="{{trigger.record_id}}" value={cfg.record_id || ''}
              onChange={e => upd({ record_id: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.fieldName')}</Label>
            <Input placeholder="status" value={cfg.field || ''}
              onChange={e => upd({ field: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.newValue')}</Label>
            <Input placeholder="approved" value={cfg.new_value || ''}
              onChange={e => upd({ new_value: e.target.value })} />
          </div>
        </>
      )}

      {/* ── EMAIL ── */}
      {node.type === 'email' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.emailTo')}</Label>
            <Input placeholder="{{trigger.employee_email}}" value={cfg.to || ''}
              onChange={e => upd({ to: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.recipientType')}</Label>
            <select className={selectCls} value={cfg.recipient_type || 'employee'}
              onChange={e => upd({ recipient_type: e.target.value })}>
              <option value="employee">{t('workflowBuilder.recipientEmployee')}</option>
              <option value="manager">{t('workflowBuilder.recipientManager')}</option>
              <option value="hr">{t('workflowBuilder.recipientHr')}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.emailTemplate')}</Label>
            <Input placeholder="WELCOME_EMAIL_TEMPLATE" value={cfg.template_id || ''}
              onChange={e => upd({ template_id: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.emailSubject')}</Label>
            <Input placeholder="{{trigger.subject}}" value={cfg.custom_subject || ''}
              onChange={e => upd({ custom_subject: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.emailBody')}</Label>
            <textarea
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-input-background resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Hi {{first_name}}, ..."
              value={cfg.custom_body || ''}
              onChange={e => upd({ custom_body: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.emailCc')}</Label>
            <Input placeholder="cc@example.com" value={cfg.cc || ''}
              onChange={e => upd({ cc: e.target.value })} />
          </div>
        </>
      )}

      {/* ── WEBHOOK ── */}
      {node.type === 'webhook' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.webhookUrl')}</Label>
            <Input placeholder="https://example.com/webhook" value={cfg.url || ''}
              onChange={e => upd({ url: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.webhookMethod')}</Label>
            <select className={selectCls} value={cfg.method || 'POST'}
              onChange={e => upd({ method: e.target.value })}>
              {['GET','POST','PUT','PATCH'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">{t('workflowBuilder.webhookHeaders')}</Label>
            {headers.map((h, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <Input className="flex-1 text-xs h-8" placeholder={t('workflowBuilder.headerKey')} value={h.key}
                  onChange={e => updateHeader(i, 'key', e.target.value)} />
                <Input className="flex-1 text-xs h-8" placeholder={t('workflowBuilder.headerValue')} value={h.value}
                  onChange={e => updateHeader(i, 'value', e.target.value)} />
                <button onClick={() => removeHeader(i)} className="p-1 text-red-400 hover:text-red-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button onClick={addHeader} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
              <Plus className="h-3 w-3" />
              {t('workflowBuilder.addHeader')}
            </button>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.webhookBodyTemplate')}</Label>
            <textarea
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-input-background resize-none h-20 font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder='{"employee_id": "{{trigger.employee_id}}"}'
              value={cfg.body_template || ''}
              onChange={e => upd({ body_template: e.target.value })}
            />
          </div>
        </>
      )}

      {/* ── LOOP ── */}
      {node.type === 'loop' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.collectionSource')}</Label>
            <Input placeholder="employees in department" value={cfg.collection_source || ''}
              onChange={e => upd({ collection_source: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.itemVariable')}</Label>
            <Input placeholder="employee" value={cfg.item_variable_name || ''}
              onChange={e => upd({ item_variable_name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('workflowBuilder.maxIterations')}</Label>
            <Input type="number" min={1} max={50} value={cfg.max_iterations || 10}
              onChange={e => upd({ max_iterations: parseInt(e.target.value) })} />
          </div>
        </>
      )}

      {/* ── AUDIT LOG ── */}
      {node.type === 'audit_log' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Action</Label>
            <Input
              placeholder="e.g. workflow_triggered, salary_revised"
              value={cfg.action || ''}
              onChange={e => upd({ action: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Resource</Label>
            <Input
              placeholder="e.g. payroll_record, invoice"
              value={cfg.resource || ''}
              onChange={e => upd({ resource: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Severity</Label>
            <select
              value={cfg.severity || 'info'}
              onChange={e => upd({ severity: e.target.value })}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
            >
              <option value="info">Info</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Notes / Metadata</Label>
            <textarea
              value={cfg.metadata || ''}
              onChange={e => upd({ metadata: e.target.value })}
              placeholder="Optional metadata or notes for this audit entry"
              rows={2}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
            />
          </div>
        </>
      )}

      {/* Connect to next */}
      {node.type !== 'end' && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t('workflowBuilder.connectToNextNode')}</Label>
          <select className={selectCls}
            onChange={e => { if (e.target.value) onConnect(node.id, e.target.value); }}
            value="">
            <option value="">{t('workflowBuilder.selectNode')}</option>
            {nodes
              .filter(n => n.id !== node.id && !(node.connections ?? []).includes(n.id))
              .map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

// ── Main WorkflowBuilder ──────────────────────────────────────────────────────

export function WorkflowBuilder({ existingWorkflow, onClose, onSave }: WorkflowBuilderProps) {
  const { currentUser } = useUser();

  const [name, setName] = useState(existingWorkflow?.name || '');
  const [description, setDescription] = useState(existingWorkflow?.description || '');
  const [nodes, setNodes] = useState<WorkflowNode[]>(
    (existingWorkflow?.nodes || []).map(n => ({ ...n, connections: n.connections ?? [] }))
  );
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [triggerType, setTriggerType] = useState<TriggerType>(
    existingWorkflow?.trigger?.type || 'manual'
  );
  const [triggerConfig, setTriggerConfig] = useState<any>(existingWorkflow?.trigger?.config || {});
  const [saving, setSaving] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const handleAddNode = (type: NodeType) => {
    const defaults: Record<string, any> = {
      approval: { approver_role: 'manager', step_name: '', push_notify: true },
      delay: { duration_value: 1, duration_unit: 'hours' },
      parallel: { branch_count: 2, branch_labels: ['Branch A', 'Branch B'] },
      create_record: { target_app: '', entity: '', field_mapping: [] },
      update_field: { target_app: '', entity: '', record_id: '', field: '', new_value: '' },
      email: { to: '', recipient_type: 'employee' },
      webhook: { url: '', method: 'POST', headers: [] },
      loop: { max_iterations: 10, collection_source: '', item_variable_name: 'item' },
    };
    const newNode: WorkflowNode = {
      id: `node_${Date.now()}`,
      type,
      label: `${type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} ${nodes.length + 1}`,
      config: defaults[type] || {},
      position: { x: 100 + nodes.length * 200, y: 100 },
      connections: [],
    };
    setNodes([...nodes, newNode]);
    setSelectedNode(newNode);
    toast.success(t('workflowBuilder.toastNodeAdded'));
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes(nodes.filter(n => n.id !== nodeId));
    if (selectedNode?.id === nodeId) setSelectedNode(null);
    toast.success(t('workflowBuilder.toastNodeDeleted'));
  };

  const handleUpdateNode = (updatedNode: WorkflowNode) => {
    setNodes(nodes.map(n => n.id === updatedNode.id ? updatedNode : n));
    setSelectedNode(updatedNode);
  };

  const handleConnectNodes = (fromId: string, toId: string) => {
    setNodes(nodes.map(n => {
      if (n.id === fromId && !n.connections.includes(toId)) {
        return { ...n, connections: [...n.connections, toId] };
      }
      return n;
    }));
    toast.success(t('workflowBuilder.toastNodesConnected'));
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error(t('workflowBuilder.toastEnterWorkflowName')); return; }
    if (nodes.length === 0) { toast.error(t('workflowBuilder.toastAddAtLeastOneNode')); return; }
    setSaving(true);
    try {
      const def: Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt' | 'version'> = {
        name,
        description,
        status: existingWorkflow?.status || 'draft',
        trigger: { type: triggerType, config: triggerConfig },
        nodes,
        createdBy: existingWorkflow?.createdBy || '',
      };
      await onSave?.(def, existingWorkflow?.id);
      onClose();
    } catch {
      toast.error(t('workflowBuilder.toastFailedToSave'));
    } finally {
      setSaving(false);
    }
  };

  // Group node types by section
  const sections = ['Trigger', 'Logic', 'Actions'];

  const getNodeTypeConfigPreview = (node: WorkflowNode): string | null => {
    const cfg = node.config ?? {};
    switch (node.type) {
      case 'approval': return cfg.approver_role ? `Role: ${cfg.approver_role}` : null;
      case 'notification': return cfg.message ? cfg.message.slice(0, 40) : null;
      case 'condition': return cfg.condition ? 'Condition group configured' : (cfg.field ? `${cfg.field} ${cfg.operator} ${cfg.value}` : null);
      case 'action': return cfg.actionType || null;
      case 'delay': return cfg.duration_value ? `Wait ${cfg.duration_value} ${cfg.duration_unit}` : null;
      case 'parallel': return cfg.branch_count ? `${cfg.branch_count} branches` : null;
      case 'create_record': return cfg.target_app ? `${cfg.target_app}.${cfg.entity}` : null;
      case 'update_field': return cfg.field ? `${cfg.field} = ${cfg.new_value}` : null;
      case 'email': return cfg.to || null;
      case 'webhook': return cfg.url ? cfg.url.slice(0, 40) : null;
      case 'loop': return cfg.collection_source || null;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center">
              <GitBranch className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">
                {existingWorkflow ? t('workflowBuilder.editWorkflow') : t('workflowBuilder.createNewWorkflow')}
              </h2>
              <p className="text-xs text-muted-foreground">{t('workflowBuilder.designDescription')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {existingWorkflow?.id && (
              <Button variant="outline" size="sm" onClick={() => setShowVersionHistory(true)}>
                <History className="h-3.5 w-3.5 mr-1.5" />
                {t('workflowBuilder.versionHistory')}
              </Button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Name + Description */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflowBuilder.workflowNameLabel')}</Label>
              <Input
                placeholder={t('workflowBuilder.placeholderWorkflowName')}
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflowBuilder.descriptionLabel')}</Label>
              <Input
                placeholder={t('workflowBuilder.placeholderDescription')}
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Trigger Type */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">{t('workflowBuilder.triggerTypeLabel')}</Label>
            <div className="flex gap-2 flex-wrap">
              {(['manual', 'scheduled', 'event', 'form_submission', 'status_change'] as TriggerType[]).map(type => (
                <button
                  key={type}
                  onClick={() => { setTriggerType(type); setTriggerConfig({}); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    triggerType === type
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-foreground border-border hover:bg-muted'
                  }`}
                >
                  {t(TRIGGER_TYPE_KEYS[type])}
                </button>
              ))}
            </div>

            {/* Schedule Trigger Config */}
            {triggerType === 'scheduled' && (
              <div className="mt-3 bg-muted/30 border border-border rounded-xl p-4">
                <ScheduleTriggerConfig config={triggerConfig} onChange={setTriggerConfig} />
              </div>
            )}

            {/* Event Trigger Config */}
            {triggerType === 'event' && (
              <div className="mt-3 bg-muted/30 border border-border rounded-xl p-4">
                <EventTriggerConfig config={triggerConfig} onChange={setTriggerConfig} />
              </div>
            )}
          </div>

          <div className="border-t border-border" />

          {/* Node Palette + Canvas */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

            {/* Palette */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                  {t('workflowBuilder.addNodes')}
                </span>
              </div>
              <div className="space-y-3">
                {sections.map(section => {
                  const sectionNodes = NODE_TYPES.filter(nt => nt.section === section);
                  return (
                    <div key={section}>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 font-medium">{section}</p>
                      <div className="space-y-1">
                        {sectionNodes.map(({ type, labelKey, icon: Icon, bg, color }) => (
                          <button
                            key={type}
                            onClick={() => handleAddNode(type)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border bg-card hover:border-primary/30 hover:bg-muted/50 transition-colors text-left"
                          >
                            <div className={`w-6 h-6 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                              <Icon className={`h-3 w-3 ${color}`} />
                            </div>
                            <span className="text-xs font-medium text-foreground">{t(labelKey)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Canvas */}
            <div className="lg:col-span-3 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                  {t('workflowBuilder.workflowCanvas')}
                </span>
              </div>

              <div className="bg-muted/30 border border-border rounded-xl p-4 min-h-[420px]" role="application" aria-label="Workflow builder canvas">
                {nodes.length === 0 ? (
                  <div className="flex items-center justify-center h-80">
                    <div className="text-center">
                      <div className="w-14 h-14 bg-amber-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <GitBranch className="h-7 w-7 text-amber-600/60" />
                      </div>
                      <p className="text-sm font-medium text-foreground">{t('workflowBuilder.noNodes')}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('workflowBuilder.noNodesHint')}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 max-w-lg mx-auto">
                    {nodes.map((node, index) => {
                      const nodeTypeDef = NODE_TYPES.find(nt => nt.type === node.type);
                      const Icon = nodeTypeDef?.icon || Settings;
                      const isSelected = selectedNode?.id === node.id;
                      const preview = getNodeTypeConfigPreview(node);
                      return (
                        <div key={node.id}>
                          <div
                            role="button"
                            aria-label={`${node.type} node: ${node.label}`}
                            tabIndex={0}
                            className={`bg-card border rounded-xl p-3 cursor-pointer transition-all ${
                              isSelected
                                ? 'border-primary shadow-sm ring-1 ring-primary/20'
                                : 'border-border hover:border-primary/30 hover:shadow-sm'
                            }`}
                            onClick={() => setSelectedNode(node)}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedNode(node); } }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 rounded-lg ${nodeTypeDef?.bg ?? 'bg-muted'} flex items-center justify-center shrink-0`}>
                                  <Icon className={`h-4 w-4 ${nodeTypeDef?.color ?? 'text-muted-foreground'}`} />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-foreground">{node.label}</p>
                                  <p className="text-xs text-muted-foreground capitalize">{node.type.replace(/_/g,' ')}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">
                                  {index + 1}
                                </span>
                                <button
                                  onClick={e => { e.stopPropagation(); handleDeleteNode(node.id); }}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors"
                                  aria-label={`Delete ${node.label} node`}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                </button>
                              </div>
                            </div>

                            {preview && (
                              <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground truncate">
                                {preview}
                              </div>
                            )}

                            {(node.connections ?? []).length > 0 && (
                              <div className="mt-2 pt-2 border-t border-border flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs text-muted-foreground">{t('workflowBuilder.connectsTo')}</span>
                                {(node.connections ?? []).map(connId => {
                                  const connNode = nodes.find(n => n.id === connId);
                                  return (
                                    <Badge key={connId} variant="outline" className="text-xs">
                                      {connNode?.label}
                                    </Badge>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {index < nodes.length - 1 && (
                            <div className="flex justify-center my-1.5">
                              <ArrowDown className="h-4 w-4 text-muted-foreground/50" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Node config panel */}
              {selectedNode && (
                <div className="bg-card border border-border rounded-xl p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">
                      {t('workflowBuilder.configurePrefix')}: {selectedNode.label}
                    </span>
                    <button
                      onClick={() => setSelectedNode(null)}
                      className="ml-auto p-1 rounded hover:bg-muted"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                  <NodeConfigPanel
                    node={selectedNode}
                    nodes={nodes}
                    onUpdate={handleUpdateNode}
                    onConnect={handleConnectNodes}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              <Save className="h-4 w-4 mr-2" />
              {saving ? t('workflowBuilder.saving') : t('workflowBuilder.saveWorkflow')}
            </Button>
            <Button variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      </div>

      {/* Version History */}
      {showVersionHistory && existingWorkflow?.id && (
        <VersionHistoryPanel
          workflowId={existingWorkflow.id}
          currentNodes={nodes}
          onRestore={restoredNodes => {
            setNodes(restoredNodes.map(n => ({ ...n, connections: n.connections ?? [] })));
          }}
          onClose={() => setShowVersionHistory(false)}
        />
      )}
    </div>
  );
}

export default WorkflowBuilder;
