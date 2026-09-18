import { useEffect, useState } from 'react';
import {
  Moon,
  ChevronDown,
  ChevronUp,
  Lock,
  LayoutDashboard,
  Users,
  UserPlus,
  ClipboardList,
  BarChart2,
  BookOpen,
  MessageSquare,
  GitBranch,
  Settings,
  Package,
  FolderKanban,
  UsersRound,
  Monitor,
  Target,
  LineChart,
  ShieldCheck,
  FileText,
  Banknote,
  TrendingUp,
} from 'lucide-react';
import { supabase } from '../utils/constants';
import { useUser } from '../context/UserContext';
import { t } from '../../i18n';

// ── Types ──────────────────────────────────────────────────────────────────

interface EventConfig {
  eventKey: string;
  label: string;
  defaultInApp: boolean;
  defaultPush: boolean;
  locked?: boolean;
}

interface AppConfig {
  app: string;
  label: string;
  icon: React.ReactNode;
  events: EventConfig[];
}

interface PrefRow {
  app: string;
  event_key: string;
  in_app: boolean;
  push: boolean;
}

interface QuietHours {
  start_time: string;
  end_time: string;
  timezone: string;
  is_active: boolean;
}

// ── App/event config ───────────────────────────────────────────────────────

const APP_CONFIGS: AppConfig[] = [
  {
    app: 'workflow',
    label: 'Workflow',
    icon: <GitBranch className="h-5 w-5 text-indigo-500" />,
    events: [
      { eventKey: 'approval_required', label: 'Approval Required', defaultInApp: true, defaultPush: true, locked: true },
      { eventKey: 'approval_deadline_warning', label: 'Approval Deadline Warning', defaultInApp: true, defaultPush: true },
      { eventKey: 'approval_escalated', label: 'Approval Escalated', defaultInApp: true, defaultPush: true },
      { eventKey: 'workflow_step_assigned', label: 'Workflow Step Assigned', defaultInApp: true, defaultPush: true },
      { eventKey: 'workflow_completed', label: 'Workflow Completed', defaultInApp: true, defaultPush: true },
      { eventKey: 'workflow_failed', label: 'Workflow Failed', defaultInApp: true, defaultPush: true },
      { eventKey: 'workflow_cancelled', label: 'Workflow Cancelled', defaultInApp: true, defaultPush: true },
    ],
  },
  {
    app: 'communications',
    label: 'Communications',
    icon: <MessageSquare className="h-5 w-5 text-pink-500" />,
    events: [
      { eventKey: 'critical_announcement', label: 'Critical Announcement', defaultInApp: true, defaultPush: true, locked: true },
      { eventKey: 'high_priority_announcement', label: 'High Priority Announcement', defaultInApp: true, defaultPush: true },
      { eventKey: 'medium_announcement', label: 'Medium Announcement', defaultInApp: true, defaultPush: true },
      { eventKey: 'low_announcement', label: 'Low Announcement', defaultInApp: true, defaultPush: true },
      { eventKey: 'mention_in_post', label: '@Mention in Post', defaultInApp: true, defaultPush: true },
      { eventKey: 'comment_on_post', label: 'Comment on Your Post', defaultInApp: true, defaultPush: true },
      { eventKey: 'event_reminder', label: 'Event Reminder', defaultInApp: true, defaultPush: true },
      { eventKey: 'poll_closing', label: 'Poll Closing', defaultInApp: true, defaultPush: true },
    ],
  },
  {
    app: 'collaboration',
    label: 'Collaboration',
    icon: <UsersRound className="h-5 w-5 text-sky-500" />,
    events: [
      { eventKey: 'dm_received', label: 'Direct Message Received', defaultInApp: true, defaultPush: true },
      { eventKey: 'mention_in_channel', label: '@Mention in Channel', defaultInApp: true, defaultPush: true },
      { eventKey: 'new_channel_member', label: 'New Channel Member', defaultInApp: true, defaultPush: true },
      { eventKey: 'file_shared', label: 'File Shared with You', defaultInApp: true, defaultPush: true },
      { eventKey: 'meeting_invite', label: 'Meeting Invite', defaultInApp: true, defaultPush: true },
    ],
  },
  {
    app: 'recruitment',
    label: 'Recruitment',
    icon: <UserPlus className="h-5 w-5 text-violet-500" />,
    events: [
      { eventKey: 'new_application', label: 'New Application Received', defaultInApp: true, defaultPush: true },
      { eventKey: 'interview_scheduled', label: 'Interview Scheduled', defaultInApp: true, defaultPush: true },
      { eventKey: 'offer_letter_action', label: 'Offer Letter Action Needed', defaultInApp: true, defaultPush: true, locked: true },
      { eventKey: 'candidate_status_change', label: 'Candidate Status Change', defaultInApp: true, defaultPush: true },
      { eventKey: 'job_requisition_approved', label: 'Job Requisition Approved', defaultInApp: true, defaultPush: true },
    ],
  },
  {
    app: 'training',
    label: 'Training',
    icon: <BookOpen className="h-5 w-5 text-amber-500" />,
    events: [
      { eventKey: 'course_assigned', label: 'Course Assigned', defaultInApp: true, defaultPush: true },
      { eventKey: 'certification_expiring', label: 'Certification Expiring', defaultInApp: true, defaultPush: true },
      { eventKey: 'course_deadline', label: 'Course Deadline Approaching', defaultInApp: true, defaultPush: true },
      { eventKey: 'certificate_earned', label: 'Certificate Earned', defaultInApp: true, defaultPush: true },
      { eventKey: 'course_completed', label: 'Course Completed', defaultInApp: true, defaultPush: true },
    ],
  },
  {
    app: 'onboarding',
    label: 'Onboarding',
    icon: <ClipboardList className="h-5 w-5 text-teal-500" />,
    events: [
      { eventKey: 'task_assigned', label: 'Task Assigned', defaultInApp: true, defaultPush: true },
      { eventKey: 'task_overdue', label: 'Task Overdue', defaultInApp: true, defaultPush: true, locked: true },
      { eventKey: 'onboarding_complete', label: 'Onboarding Complete', defaultInApp: true, defaultPush: true },
      { eventKey: 'document_submission', label: 'Document Submission Needed', defaultInApp: true, defaultPush: true },
    ],
  },
  {
    app: 'performance',
    label: 'Performance',
    icon: <BarChart2 className="h-5 w-5 text-orange-500" />,
    events: [
      { eventKey: 'review_cycle_started', label: 'Review Cycle Started', defaultInApp: true, defaultPush: true },
      { eventKey: 'review_submission_deadline', label: 'Review Submission Deadline', defaultInApp: true, defaultPush: true },
      { eventKey: 'feedback_received', label: 'Feedback Received', defaultInApp: true, defaultPush: true },
      { eventKey: 'goal_updated', label: 'Goal Updated', defaultInApp: true, defaultPush: true },
      { eventKey: 'review_approved', label: 'Review Approved', defaultInApp: true, defaultPush: true },
    ],
  },
  {
    app: 'directory',
    label: 'Directory',
    icon: <Users className="h-5 w-5 text-cyan-500" />,
    events: [
      { eventKey: 'profile_update_approved', label: 'Profile Update Approved', defaultInApp: true, defaultPush: true },
      { eventKey: 'team_change', label: 'Team Change Notification', defaultInApp: true, defaultPush: true },
      { eventKey: 'new_team_member', label: 'New Team Member Joined', defaultInApp: true, defaultPush: true },
    ],
  },
  {
    app: 'dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-5 w-5 text-indigo-400" />,
    events: [
      { eventKey: 'system_alert', label: 'System Alert', defaultInApp: true, defaultPush: true, locked: true },
      { eventKey: 'report_ready', label: 'Report Ready', defaultInApp: true, defaultPush: true },
      { eventKey: 'scheduled_maintenance', label: 'Scheduled Maintenance', defaultInApp: true, defaultPush: true },
    ],
  },
  {
    app: 'user-mgmt',
    label: 'User Mgmt',
    icon: <Settings className="h-5 w-5 text-gray-500" />,
    events: [
      { eventKey: 'account_access_changed', label: 'Account Access Changed', defaultInApp: true, defaultPush: true, locked: true },
      { eventKey: 'password_policy_expiry', label: 'Password Policy Expiry', defaultInApp: true, defaultPush: true },
      { eventKey: 'new_user_created', label: 'New User Created (yours)', defaultInApp: true, defaultPush: true },
    ],
  },
  {
    app: 'it-services',
    label: 'IT Services',
    icon: <Monitor className="h-5 w-5 text-violet-500" />,
    events: [
      { eventKey: 'ticket_update', label: 'Ticket Update', defaultInApp: true, defaultPush: true },
      { eventKey: 'ticket_resolved', label: 'Ticket Resolved', defaultInApp: true, defaultPush: true },
      { eventKey: 'sla_breach_warning', label: 'SLA Breach Warning', defaultInApp: true, defaultPush: true, locked: true },
      { eventKey: 'it_announcement', label: 'New IT Announcement', defaultInApp: true, defaultPush: true },
    ],
  },
  {
    app: 'assets',
    label: 'Assets',
    icon: <Package className="h-5 w-5 text-emerald-500" />,
    events: [
      { eventKey: 'asset_assigned', label: 'Asset Assigned to You', defaultInApp: true, defaultPush: true },
      { eventKey: 'asset_return_due', label: 'Asset Return Due', defaultInApp: true, defaultPush: true },
      { eventKey: 'asset_request_approved', label: 'Asset Request Approved', defaultInApp: true, defaultPush: true },
      { eventKey: 'maintenance_reminder', label: 'Maintenance Reminder', defaultInApp: true, defaultPush: true },
    ],
  },
  {
    app: 'projects',
    label: 'Projects',
    icon: <FolderKanban className="h-5 w-5 text-blue-500" />,
    events: [
      { eventKey: 'task_assigned', label: 'Task Assigned', defaultInApp: true, defaultPush: true },
      { eventKey: 'task_overdue', label: 'Task Overdue', defaultInApp: true, defaultPush: true },
      { eventKey: 'milestone_reached', label: 'Milestone Reached', defaultInApp: true, defaultPush: true },
      { eventKey: 'project_status_changed', label: 'Project Status Changed', defaultInApp: true, defaultPush: true },
      { eventKey: 'mention_in_task', label: '@Mention in Task', defaultInApp: true, defaultPush: true },
    ],
  },
  {
    app: 'okr',
    label: 'OKR Management',
    icon: <Target className="h-5 w-5 text-rose-500" />,
    events: [
      { eventKey: 'okr_checkin_due', label: 'OKR check-in reminder', defaultInApp: true, defaultPush: true },
      { eventKey: 'okr_behind_midcycle', label: 'OKR behind at mid-cycle', defaultInApp: true, defaultPush: true },
      { eventKey: 'okr_blocker_flagged', label: 'Blocker flagged on OKR', defaultInApp: true, defaultPush: true, locked: true },
      { eventKey: 'okr_graded', label: 'OKR graded by manager', defaultInApp: true, defaultPush: true },
      { eventKey: 'okr_cycle_closing', label: 'OKR cycle closing in 7 days', defaultInApp: true, defaultPush: true },
    ],
  },
  {
    app: 'invoices',
    label: 'Invoice',
    icon: <FileText className="h-5 w-5 text-yellow-600" />,
    events: [
      { eventKey: 'invoice_paid', label: 'Invoice marked as paid', defaultInApp: true, defaultPush: true, locked: true },
      { eventKey: 'invoice_overdue', label: 'Invoice overdue', defaultInApp: true, defaultPush: true, locked: true },
      { eventKey: 'invoice_overdue_14d', label: 'Invoice 14 days overdue', defaultInApp: true, defaultPush: true, locked: true },
      { eventKey: 'partial_payment', label: 'Partial payment received', defaultInApp: true, defaultPush: true },
      { eventKey: 'recurring_created', label: 'Recurring invoice generated', defaultInApp: true, defaultPush: true },
    ],
  },
  {
    app: 'payroll',
    label: 'Payroll Management',
    icon: <Banknote className="h-5 w-5 text-green-600" />,
    events: [
      { eventKey: 'payslip_ready', label: 'Payslip ready to view', defaultInApp: true, defaultPush: true, locked: true },
      { eventKey: 'payroll_approval_req', label: 'Payroll requires approval', defaultInApp: true, defaultPush: true, locked: true },
      { eventKey: 'payroll_locked', label: 'Payroll locked for month', defaultInApp: true, defaultPush: true },
      { eventKey: 'salary_revision_appr', label: 'Salary revision approved', defaultInApp: true, defaultPush: true },
    ],
  },
  {
    app: 'security',
    label: 'Security & Compliance',
    icon: <ShieldCheck className="h-5 w-5 text-red-500" />,
    events: [
      { eventKey: 'critical_audit_event', label: 'Critical audit event detected', defaultInApp: true, defaultPush: true, locked: true },
      { eventKey: 'compliance_deadline', label: 'Compliance deadline in 7 days', defaultInApp: true, defaultPush: true },
      { eventKey: 'privacy_req_overdue', label: 'Privacy request overdue', defaultInApp: true, defaultPush: true, locked: true },
      { eventKey: 'login_failure_spike', label: 'Login failure spike detected', defaultInApp: true, defaultPush: true, locked: true },
    ],
  },
  {
    app: 'analytics',
    label: 'Analytics',
    icon: <LineChart className="h-5 w-5 text-purple-500" />,
    events: [
      { eventKey: 'anomaly_detected', label: 'Anomaly detected in metrics', defaultInApp: true, defaultPush: true, locked: true },
      { eventKey: 'scheduled_rpt_ready', label: 'Scheduled report ready', defaultInApp: true, defaultPush: true },
      { eventKey: 'report_run_failed', label: 'Report run failed', defaultInApp: true, defaultPush: true, locked: true },
    ],
  },
  {
    app: 'executive',
    label: 'Executive Dashboard',
    icon: <TrendingUp className="h-5 w-5 text-indigo-600" />,
    events: [
      { eventKey: 'exec_critical_alert', label: 'Critical executive alert', defaultInApp: true, defaultPush: true, locked: true },
      { eventKey: 'kpi_threshold_breached', label: 'KPI threshold breached', defaultInApp: true, defaultPush: true },
      { eventKey: 'scheduled_exec_report', label: 'Scheduled exec report ready', defaultInApp: true, defaultPush: true },
    ],
  },
];

// ── Toggle switch ──────────────────────────────────────────────────────────

function Toggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${
        value ? 'bg-indigo-600' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      aria-pressed={value}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transform transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

// ── Snoozed notifications section ─────────────────────────────────────────

interface SnoozedNotif {
  id: string;
  title: string;
  app_filter: string;
  type: string;
  snoozed_until: string;
}

function SnoozedSection({ userId }: { userId: string }) {
  const [snoozed, setSnoozed] = useState<SnoozedNotif[]>([]);

  useEffect(() => {
    supabase
      .from('notifications')
      .select('id, title, app_filter, type, snoozed_until')
      .eq('user_id', userId)
      .gt('snoozed_until', new Date().toISOString())
      .order('snoozed_until', { ascending: true })
      .then(({ data }) => { if (data) setSnoozed(data as SnoozedNotif[]); });
  }, [userId]);

  function unsnooze(id: string) {
    setSnoozed((prev) => prev.filter((n) => n.id !== id));
    void supabase.from('notifications').update({ snoozed_until: null }).eq('id', id);
  }

  return (
    <div className="mt-8">
      <h2 className="text-base font-semibold text-gray-800 mb-3">
        {t('notificationBell.snoozedTitle')}
      </h2>
      {snoozed.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl py-4 text-center text-sm text-gray-400 italic">
          {t('notificationBell.noSnoozed')}
        </div>
      ) : (
        snoozed.map((n) => (
          <div
            key={n.id}
            className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg mb-2"
          >
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-gray-700 truncate block">{n.title}</span>
              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                {n.app_filter}
              </span>
            </div>
            <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
              {t('notificationBell.snoozedUntil')} {new Date(n.snoozed_until).toLocaleString()}
            </span>
            <button
              className="border border-gray-300 text-gray-600 text-xs px-3 py-1 rounded hover:bg-gray-50 transition-colors flex-shrink-0"
              onClick={() => unsnooze(n.id)}
            >
              {t('notificationBell.unsnooze')}
            </button>
          </div>
        ))
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function NotificationPreferencesPage() {
  const { currentUser } = useUser();
  const [prefs, setPrefs] = useState<Record<string, PrefRow>>({});
  const [quietHours, setQuietHours] = useState<QuietHours>({
    start_time: '22:00',
    end_time: '08:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    is_active: false,
  });
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set(['workflow']));
  const [saving, setSaving] = useState(false);
  const [savingQh, setSavingQh] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Build default prefs key = `${app}__${event_key}`
  function prefKey(app: string, eventKey: string) {
    return `${app}__${eventKey}`;
  }

  function getDefaultPrefs(): Record<string, PrefRow> {
    const defaults: Record<string, PrefRow> = {};
    for (const appCfg of APP_CONFIGS) {
      for (const ev of appCfg.events) {
        const k = prefKey(appCfg.app, ev.eventKey);
        defaults[k] = { app: appCfg.app, event_key: ev.eventKey, in_app: ev.defaultInApp, push: ev.defaultPush };
      }
    }
    return defaults;
  }

  useEffect(() => {
    if (!currentUser?.id) return;

    // Load prefs
    supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', currentUser.id)
      .then(({ data }) => {
        const defaults = getDefaultPrefs();
        if (data && data.length > 0) {
          for (const row of data as PrefRow[]) {
            const k = prefKey(row.app, row.event_key);
            defaults[k] = row;
          }
        }
        setPrefs(defaults);
      });

    // Load quiet hours
    supabase
      .from('notification_quiet_hours')
      .select('*')
      .eq('user_id', currentUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setQuietHours({
            start_time: (data as QuietHours).start_time,
            end_time: (data as QuietHours).end_time,
            timezone: (data as QuietHours).timezone,
            is_active: (data as QuietHours).is_active,
          });
        }
      });
  }, [currentUser?.id]);

  function setPref(app: string, eventKey: string, field: 'in_app' | 'push', value: boolean) {
    const k = prefKey(app, eventKey);
    setPrefs((prev) => {
      const existing = prev[k] ?? { app, event_key: eventKey, in_app: true, push: true };
      const updated = { ...existing, [field]: value };
      // push requires in_app
      if (field === 'in_app' && !value) updated.push = false;
      return { ...prev, [k]: updated };
    });
  }

  async function savePrefs() {
    if (!currentUser?.id) return;
    setSaving(true);
    const rows = Object.values(prefs).map((r) => ({ ...r, user_id: currentUser.id }));
    await supabase.from('notification_preferences').upsert(rows, { onConflict: 'user_id,app,event_key' });
    setSaving(false);
    setSaveMsg(t('common.success'));
    setTimeout(() => setSaveMsg(''), 2500);
  }

  async function saveQuietHours() {
    if (!currentUser?.id) return;
    setSavingQh(true);
    await supabase
      .from('notification_quiet_hours')
      .upsert({ user_id: currentUser.id, ...quietHours }, { onConflict: 'user_id' });
    setSavingQh(false);
  }

  function toggleApp(app: string) {
    setExpandedApps((prev) => {
      const next = new Set(prev);
      if (next.has(app)) next.delete(app);
      else next.add(app);
      return next;
    });
  }

  const timezones = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : [quietHours.timezone];

  return (
    <div className="max-w-[800px] mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('notificationBell.preferencesTitle')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('notificationBell.preferencesSubtitle')}</p>
      </div>

      {/* Quiet Hours card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3">
          <Moon className="h-5 w-5 text-indigo-500" />
          <span className="text-base font-semibold text-gray-800 flex-1">{t('notificationBell.quietHours')}</span>
          <Toggle
            value={quietHours.is_active}
            onChange={(v) => setQuietHours((q) => ({ ...q, is_active: v }))}
          />
        </div>

        {quietHours.is_active && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 font-medium">{t('notificationBell.quietFrom')}</label>
              <input
                type="time"
                value={quietHours.start_time}
                onChange={(e) => setQuietHours((q) => ({ ...q, start_time: e.target.value }))}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <span className="text-gray-400">→</span>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 font-medium">{t('notificationBell.quietTo')}</label>
              <input
                type="time"
                value={quietHours.end_time}
                onChange={(e) => setQuietHours((q) => ({ ...q, end_time: e.target.value }))}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <select
              value={quietHours.timezone}
              onChange={(e) => setQuietHours((q) => ({ ...q, timezone: e.target.value }))}
              className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        )}

        {quietHours.is_active && (
          <p className="text-sm text-gray-500 italic mt-3">
            {t('notificationBell.quietPreview')
              .replace('{start}', quietHours.start_time)
              .replace('{end}', quietHours.end_time)
              .replace('{tz}', quietHours.timezone)}
          </p>
        )}

        <div className="flex justify-end mt-4">
          <button
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            onClick={saveQuietHours}
            disabled={savingQh}
          >
            {savingQh ? t('common.loading') : t('notificationBell.saveQuietHours')}
          </button>
        </div>
      </div>

      {/* Per-app accordion */}
      {APP_CONFIGS.map((appCfg) => {
        const expanded = expandedApps.has(appCfg.app);
        return (
          <div key={appCfg.app} className="bg-white border border-gray-200 rounded-xl mb-3 overflow-hidden">
            {/* Accordion header */}
            <button
              className="w-full flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => toggleApp(appCfg.app)}
            >
              {appCfg.icon}
              <span className="text-sm font-semibold text-gray-800">{appCfg.label}</span>
              <span className="text-xs text-gray-400 ml-1">{appCfg.events.length} events</span>
              <span className="flex-1" />
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>

            {/* Accordion body */}
            {expanded && (
              <div className="px-5 pb-4">
                <div className="grid grid-cols-[1fr_60px_60px] gap-2 text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100 pb-2 mb-2">
                  <span>Event</span>
                  <span className="text-center">In-App</span>
                  <span className="text-center">Push</span>
                </div>
                {appCfg.events.map((ev) => {
                  const k = prefKey(appCfg.app, ev.eventKey);
                  const pref = prefs[k] ?? { app: appCfg.app, event_key: ev.eventKey, in_app: ev.defaultInApp, push: ev.defaultPush };
                  return (
                    <div
                      key={ev.eventKey}
                      className="grid grid-cols-[1fr_60px_60px] gap-2 items-center py-2.5 border-b border-gray-50 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700">{ev.label}</span>
                        {ev.locked && (
                          <Lock
                            className="h-3 w-3 text-gray-400 flex-shrink-0"
                            title="This event cannot be disabled"
                          />
                        )}
                      </div>
                      <div className="flex justify-center">
                        <Toggle
                          value={pref.in_app}
                          onChange={(v) => setPref(appCfg.app, ev.eventKey, 'in_app', v)}
                          disabled={ev.locked}
                        />
                      </div>
                      <div className="flex justify-center">
                        <Toggle
                          value={pref.push}
                          onChange={(v) => setPref(appCfg.app, ev.eventKey, 'push', v)}
                          disabled={ev.locked || !pref.in_app}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Save button */}
      <div className="flex items-center justify-end gap-4 mt-6">
        {saveMsg && <span className="text-sm text-green-600">{saveMsg}</span>}
        <button
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          onClick={savePrefs}
          disabled={saving}
        >
          {saving ? t('common.loading') : t('common.save')}
        </button>
      </div>

      {/* Snoozed section */}
      {currentUser?.id && <SnoozedSection userId={currentUser.id} />}
    </div>
  );
}
