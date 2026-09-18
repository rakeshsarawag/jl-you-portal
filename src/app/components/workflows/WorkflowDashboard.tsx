import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { AppLayout } from '../apps/AppLayout';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { WorkflowBuilder } from './WorkflowBuilder';
import { WorkflowDefinition, WorkflowInstance } from '../../services/workflowEngine';
import { WORKFLOW_TEMPLATES } from '../../services/workflowTemplates';
import { useWorkflow, ApiApprovalRequest } from '../../hooks/useWorkflow';
import { useUser } from '../../context/UserContext';
import { supabase } from '../../utils/constants';
import ConfirmDialog from '../ui/ConfirmDialog';
import {
  Zap,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  FileText,
  Sparkles,
  AlertTriangle,
  GitBranch,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Database,
  Mail,
  Globe,
  RefreshCw,
  SplitSquareHorizontal,
  Edit3,
  Loader2,
  Minus,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE, apiHeaders } from '../../utils/constants';
import { t } from '../../../i18n';

interface WorkflowDashboardProps {
  accessToken: string;
  onLogout: () => void;
}

// ── Execution trace types ─────────────────────────────────────────────────────

interface InstanceStep {
  id: string;
  instance_id: string;
  node_id: string;
  node_type: string;
  node_label: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  started_at: string | null;
  completed_at: string | null;
  input_payload: any;
  output_payload: any;
  error_message: string | null;
}

// ── Step icon by node_type ────────────────────────────────────────────────────

function StepIcon({ nodeType, status }: { nodeType: string; status: string }) {
  if (status === 'completed') return <CheckCircle className="h-4 w-4 text-green-500" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 text-red-500" />;
  if (status === 'running') return <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />;
  if (status === 'skipped') return <Minus className="h-4 w-4 text-muted-foreground" />;
  // pending
  const icons: Record<string, React.ReactNode> = {
    approval: <CheckCircle className="h-4 w-4 text-muted-foreground/50" />,
    notification: <span className="h-4 w-4 text-muted-foreground/50 text-xs">🔔</span>,
    email: <Mail className="h-4 w-4 text-muted-foreground/50" />,
    delay: <Clock className="h-4 w-4 text-muted-foreground/50" />,
    condition: <GitBranch className="h-4 w-4 text-muted-foreground/50" />,
    parallel: <SplitSquareHorizontal className="h-4 w-4 text-muted-foreground/50" />,
    create_record: <Database className="h-4 w-4 text-muted-foreground/50" />,
    update_field: <Edit3 className="h-4 w-4 text-muted-foreground/50" />,
    webhook: <Globe className="h-4 w-4 text-muted-foreground/50" />,
    loop: <RefreshCw className="h-4 w-4 text-muted-foreground/50" />,
    trigger: <Zap className="h-4 w-4 text-muted-foreground/50" />,
  };
  return <>{icons[nodeType] ?? <Clock className="h-4 w-4 text-muted-foreground/50" />}</>;
}

// ── Step status badge ─────────────────────────────────────────────────────────

function StepStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-muted text-muted-foreground border-border',
    running: 'bg-blue-50 text-blue-700 border-blue-200',
    completed: 'bg-green-50 text-green-700 border-green-200',
    failed: 'bg-red-50 text-red-700 border-red-200',
    skipped: 'bg-muted text-muted-foreground border-border',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[status] ?? 'bg-muted text-muted-foreground border-border'}`}>
      {status}
    </span>
  );
}

// ── Duration helper ───────────────────────────────────────────────────────────

function formatDuration(startedAt: string | null, completedAt: string | null): string | null {
  if (!startedAt || !completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1) return '< 1ms';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

// ── Execution Trace View ──────────────────────────────────────────────────────

function ExecutionTraceView({
  instance,
  workflowName,
  onBack,
}: {
  instance: WorkflowInstance;
  workflowName: string;
  onBack: () => void;
}) {
  const { currentUser } = useUser();
  const [steps, setSteps] = useState<InstanceStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const handleRerunFromStep = async (instanceId: string, stepId: string) => {
    void supabase.from('workflow_instance_steps')
      .update({ status: 'pending', error_message: null, started_at: null, completed_at: null })
      .eq('instance_id', instanceId).eq('id', stepId);
    void supabase.from('workflow_instance_steps')
      .update({ status: 'pending' })
      .eq('instance_id', instanceId).eq('status', 'failed');
    toast.success(t('workflow.rerunFromStep'));
    // Refresh steps
    const { data } = await supabase
      .from('workflow_instance_steps')
      .select('*')
      .eq('instance_id', instanceId)
      .order('started_at', { ascending: true });
    setSteps(data || []);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('workflow_instance_steps')
        .select('*')
        .eq('instance_id', instance.id)
        .order('started_at', { ascending: true });
      setSteps(data || []);
      setLoading(false);
    };
    load();
  }, [instance.id]);

  const toggleExpand = (id: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const isAdmin = currentUser?.primaryRole === 'super_admin' || currentUser?.primaryRole === 'admin';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('workflowDashboard.backToInstances')}
          </button>
        </div>
        {isAdmin && instance.status === 'failed' && (
          (() => {
            const failedStep = steps.find(s => s.status === 'failed');
            return failedStep ? (
              <Button
                size="sm"
                variant="outline"
                className="text-primary border-primary"
                onClick={() => handleRerunFromStep(instance.id, failedStep.id)}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                {t('workflow.rerunFromStep')}
              </Button>
            ) : null;
          })()
        )}
      </div>

      <div>
        <h2 className="text-lg font-bold text-foreground">{workflowName}</h2>
        <div className="flex items-center gap-3 mt-1">
          <StatusBadge status={instance.status} />
          <span className="text-xs text-muted-foreground">
            {t('workflowDashboard.startedLabel')}: {new Date(instance.startedAt).toLocaleString()}
          </span>
          {instance.completedAt && (
            <span className="text-xs text-muted-foreground">
              · {t('workflowDashboard.completedLabel')}: {new Date(instance.completedAt).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">{t('workflowDashboard.executionTrace')}</h3>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          </div>
        ) : steps.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">{t('workflowDashboard.noTraceSteps')}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {steps.map((step, index) => {
              const isExpanded = expandedSteps.has(step.id);
              const duration = formatDuration(step.started_at, step.completed_at);
              return (
                <div key={step.id} className={`${step.status === 'running' ? 'bg-amber-50/40' : ''}`}>
                  {/* Step row */}
                  <div
                    className="flex items-start gap-3 px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => toggleExpand(step.id)}
                  >
                    {/* Timeline line + icon */}
                    <div className="flex flex-col items-center shrink-0 mt-0.5">
                      <div className="w-7 h-7 rounded-full border-2 border-border bg-card flex items-center justify-center">
                        <StepIcon nodeType={step.node_type} status={step.status} />
                      </div>
                      {index < steps.length - 1 && (
                        <div className="w-0.5 h-6 bg-border mt-1" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">
                          {step.node_label || step.node_type}
                        </span>
                        <StepStatusBadge status={step.status} />
                        {duration && (
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                            {duration}
                          </span>
                        )}
                        {step.status === 'running' && (
                          <span className="flex items-center gap-1 text-xs text-amber-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Running
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span className="capitalize">{step.node_type.replace(/_/g,' ')}</span>
                        {step.started_at && (
                          <span>{new Date(step.started_at).toLocaleTimeString()}</span>
                        )}
                      </div>
                      {step.status === 'failed' && step.error_message && (
                        <p className="text-xs text-red-600 mt-1 font-medium">{step.error_message}</p>
                      )}
                    </div>

                    {/* Expand toggle */}
                    <div className="shrink-0 text-muted-foreground">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </div>

                  {/* Expanded payload */}
                  {isExpanded && (
                    <div className="ml-14 mr-5 mb-4 space-y-3">
                      {step.input_payload && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                            {t('workflowDashboard.traceInputData')}
                          </p>
                          <div className="bg-muted/60 border border-border rounded-lg p-3 max-h-48 overflow-y-auto">
                            <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">
                              {JSON.stringify(step.input_payload, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                      {step.output_payload && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                            {t('workflowDashboard.traceOutputData')}
                          </p>
                          <div className="bg-muted/60 border border-border rounded-lg p-3 max-h-48 overflow-y-auto">
                            <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">
                              {JSON.stringify(step.output_payload, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                      {step.status === 'failed' && step.error_message && (
                        <div>
                          <p className="text-xs font-medium text-red-600 uppercase tracking-wide mb-1">
                            {t('workflowDashboard.traceError')}
                          </p>
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-xs text-red-700 font-mono">{step.error_message}</p>
                          </div>
                        </div>
                      )}
                      {!step.input_payload && !step.output_payload && !step.error_message && (
                        <p className="text-xs text-muted-foreground italic">No payload data available.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Approval Card ────────────────────────────────────────────────────────────

function ApprovalCard({
  approval,
  onApprove,
  onReject,
}: {
  approval: ApiApprovalRequest;
  onApprove: () => void;
  onReject: (comment: string) => void;
}) {
  const [showReject, setShowReject] = useState(false);
  const [comment, setComment] = useState('');

  return (
    <div className="border border-border bg-card rounded-xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <Clock className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <span className="font-semibold text-foreground text-sm">
              {approval.workflow_name || t('workflowDashboard.approvalWorkflow')}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 ml-9">
            {approval.step_name || t('workflowDashboard.approvalStep')}
            {approval.entity_type ? ` · ${approval.entity_type}` : ''}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 ml-9">
            {t('workflowDashboard.requested')}{' '}
            {new Date(approval.requested_at || approval.createdAt).toLocaleString()}
          </p>
          {approval.message && (
            <div className="text-xs text-foreground mt-2 ml-9 bg-muted/40 rounded-lg p-2 border border-border">
              {approval.message}
            </div>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onApprove}
            className="px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 transition-colors"
          >
            {t('workflowDashboard.approve')}
          </button>
          <button
            onClick={() => setShowReject(!showReject)}
            className="px-3 py-1.5 bg-card text-red-600 border border-red-200 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors"
          >
            {t('workflowDashboard.reject')}
          </button>
        </div>
      </div>
      {showReject && (
        <div className="mt-3 flex gap-2 ml-9">
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder={t('workflowDashboard.rejectionReason')}
            className="flex-1 border border-border rounded-lg p-2 text-xs resize-none h-14 bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          <button
            onClick={() => onReject(comment)}
            className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg self-end hover:bg-red-600 transition-colors"
          >
            {t('workflowDashboard.confirmReject')}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
        <div className="h-8 bg-muted rounded animate-pulse w-1/3" />
      </CardContent>
    </Card>
  );
}

// ── Status badge helper ───────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-green-50 text-green-700 border-green-200',
    running: 'bg-blue-50 text-blue-700 border-blue-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    failed: 'bg-red-50 text-red-700 border-red-200',
    cancelled: 'bg-muted text-muted-foreground border-border',
    paused: 'bg-amber-50 text-amber-700 border-amber-200',
    draft: 'bg-muted text-muted-foreground border-border',
    waiting_approval: 'bg-purple-50 text-purple-700 border-purple-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[status] ?? 'bg-muted text-muted-foreground border-border'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ── Event Mappings Panel ──────────────────────────────────────────────────────

interface EventMapping {
  id: string;
  workflow_id: string;
  event_name: string;
  source_app: string;
  is_active: boolean;
  filter_conditions: Array<{ key: string; value: string }>;
  created_at: string;
}

const WORKFLOW_TRIGGER_EVENTS_FLAT: Record<string, string[]> = {
  'Leave Management': ['leave_applied', 'leave_approved', 'leave_rejected', 'leave_cancelled', 'balance_updated', 'balance_expired'],
  'Attendance': ['attendance_corrected', 'attendance_flagged'],
  'Recruitment': ['job_requisition_submitted', 'job_requisition_approved', 'candidate_applied', 'candidate_hired', 'offer_accepted', 'interview_scheduled', 'interview_completed'],
  'Performance': ['review_submitted', 'review_completed', 'pip_created', 'pip_completed'],
  'Training': ['enrollment_created', 'enrollment_completed', 'certificate_expiring', 'certificate_expired'],
  'Onboarding': ['onboarding_started', 'document_signed'],
  'Offboarding': ['employee_exit_initiated', 'exit_interview_completed'],
  'IT Services': ['ticket_created', 'ticket_escalated', 'ticket_resolved'],
  'Projects': ['project_created', 'milestone_completed'],
  'OKR Management': ['okr_checkin_missed', 'okr_behind_midcycle', 'okr_blocker_flagged', 'okr_cycle_closing_7d'],
  'Invoice Generation': ['invoice_overdue', 'invoice_overdue_14d', 'partial_payment_received', 'recurring_invoice_due'],
  'Payroll Management': ['payroll_processing_due', 'salary_revision_submitted', 'payroll_lock_created', 'compliance_challan_due'],
  'Security & Compliance': ['critical_audit_event', 'compliance_deadline_7d', 'privacy_request_overdue'],
  'Advanced Analytics': ['anomaly_detected', 'scheduled_report_failed'],
};

function EventMappingsPanel({ definitions }: { definitions: WorkflowDefinition[] }) {
  const [mappings, setMappings] = useState<EventMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMapping, setEditMapping] = useState<EventMapping | null>(null);

  // form state
  const [formWorkflowId, setFormWorkflowId] = useState('');
  const [formEventName, setFormEventName] = useState('');
  const [formSourceApp, setFormSourceApp] = useState('');
  const [formFilters, setFormFilters] = useState<Array<{ key: string; value: string }>>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('workflow_trigger_event_mappings')
      .select('*')
      .order('created_at', { ascending: false });
    setMappings(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditMapping(null);
    setFormWorkflowId('');
    setFormEventName('');
    setFormSourceApp('');
    setFormFilters([]);
    setShowModal(true);
  };

  const handleEventChange = (event: string) => {
    setFormEventName(event);
    // auto-fill source app
    const app = Object.entries(WORKFLOW_TRIGGER_EVENTS_FLAT).find(([, evts]) => evts.includes(event))?.[0] || '';
    setFormSourceApp(app);
  };

  const handleSubmit = async () => {
    if (!formWorkflowId || !formEventName) { toast.error('Select workflow and event'); return; }
    setSaving(true);
    if (editMapping) {
      void supabase.from('workflow_trigger_event_mappings')
        .update({ workflow_id: formWorkflowId, event_name: formEventName, source_app: formSourceApp, filter_conditions: formFilters })
        .eq('id', editMapping.id);
    } else {
      void supabase.from('workflow_trigger_event_mappings').insert([{
        workflow_id: formWorkflowId,
        event_name: formEventName,
        source_app: formSourceApp,
        is_active: true,
        filter_conditions: formFilters,
      }]);
    }
    setSaving(false);
    setShowModal(false);
    setTimeout(load, 300);
    toast.success(t('workflow.addMapping'));
  };

  const handleToggleActive = (id: string, is_active: boolean) => {
    void supabase.from('workflow_trigger_event_mappings').update({ is_active: !is_active }).eq('id', id);
    setMappings(ms => ms.map(m => m.id === id ? { ...m, is_active: !is_active } : m));
  };

  const handleDelete = (id: string) => {
    void supabase.from('workflow_trigger_event_mappings').delete().eq('id', id);
    setMappings(ms => ms.filter(m => m.id !== id));
    toast.success(t('common.delete'));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">{t('workflow.eventMappings')}</h2>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {t('workflow.addMapping')}
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
        ) : mappings.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">{t('common.noResults')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Workflow</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Event</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Source App</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mappings.map(m => {
                const def = definitions.find(d => d.id === m.workflow_id);
                return (
                  <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-xs font-medium text-foreground">{def?.name || m.workflow_id}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{m.event_name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{m.source_app}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(m.id, m.is_active)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${m.is_active ? 'bg-green-500' : 'bg-muted'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${m.is_active ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setEditMapping(m);
                            setFormWorkflowId(m.workflow_id);
                            setFormEventName(m.event_name);
                            setFormSourceApp(m.source_app);
                            setFormFilters(m.filter_conditions || []);
                            setShowModal(true);
                          }}
                          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="p-1.5 rounded hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-semibold text-foreground">{t('workflow.addMapping')}</h3>
              <button onClick={() => setShowModal(false)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted">
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Workflow selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Workflow</label>
                <select
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={formWorkflowId}
                  onChange={e => setFormWorkflowId(e.target.value)}
                >
                  <option value="">Select workflow...</option>
                  {definitions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              {/* Event selector grouped */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Event</label>
                <select
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={formEventName}
                  onChange={e => handleEventChange(e.target.value)}
                >
                  <option value="">Select event...</option>
                  {Object.entries(WORKFLOW_TRIGGER_EVENTS_FLAT).map(([group, evts]) => (
                    <optgroup key={group} label={group}>
                      {evts.map(ev => <option key={ev} value={ev}>{ev}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Source app (auto-filled) */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Source App</label>
                <input
                  type="text"
                  readOnly
                  value={formSourceApp}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/40 text-muted-foreground"
                />
              </div>

              {/* Filter conditions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground">Filter Conditions (optional)</label>
                  <button
                    onClick={() => setFormFilters([...formFilters, { key: '', value: '' }])}
                    className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />Add
                  </button>
                </div>
                {formFilters.map((f, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="key"
                      value={f.key}
                      onChange={e => setFormFilters(formFilters.map((ff, idx) => idx === i ? { ...ff, key: e.target.value } : ff))}
                      className="flex-1 border border-border rounded-lg px-2 py-1.5 text-xs bg-input-background focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="value"
                      value={f.value}
                      onChange={e => setFormFilters(formFilters.map((ff, idx) => idx === i ? { ...ff, value: e.target.value } : ff))}
                      className="flex-1 border border-border rounded-lg px-2 py-1.5 text-xs bg-input-background focus:outline-none"
                    />
                    <button onClick={() => setFormFilters(formFilters.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2 border-t border-border">
                <Button className="flex-1" onClick={handleSubmit} disabled={saving}>
                  {saving ? t('common.loading') : t('common.save')}
                </Button>
                <Button variant="outline" onClick={() => setShowModal(false)}>{t('common.cancel')}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Confirm dialog state helper ───────────────────────────────────────────────

interface ConfirmState {
  title: string;
  message: string;
  danger?: boolean;
  onConfirm: () => void;
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  valueColor,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${valueColor ?? 'text-foreground'}`}>{value}</p>
      </div>
    </div>
  );
}

// ── Category color helper ─────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  HR: { bg: 'bg-blue-50', text: 'text-blue-700' },
  Recruitment: { bg: 'bg-purple-50', text: 'text-purple-700' },
  Onboarding: { bg: 'bg-green-50', text: 'text-green-700' },
  Performance: { bg: 'bg-amber-50', text: 'text-amber-700' },
  Training: { bg: 'bg-teal-50', text: 'text-teal-700' },
  Offboarding: { bg: 'bg-orange-50', text: 'text-orange-700' },
};

// ── Main Dashboard ────────────────────────────────────────────────────────────

export function WorkflowDashboard({ accessToken, onLogout }: WorkflowDashboardProps) {
  const navigate = useNavigate();
  const { currentUser } = useUser();

  const {
    definitions,
    instances,
    pendingApprovals,
    stats,
    loading,
    createDefinition,
    updateDefinition,
    deleteDefinition,
    startWorkflow,
    cancelInstance,
    respondToApproval,
  } = useWorkflow();

  const [showBuilder, setShowBuilder] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowDefinition | undefined>();
  const [selectedInstance, setSelectedInstance] = useState<WorkflowInstance | null>(null);
  const [traceInstance, setTraceInstance] = useState<WorkflowInstance | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [activeTab, setActiveTab] = useState('workflows');

  const isSuperAdmin = currentUser?.primaryRole === 'super_admin';

  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      const res = await fetch(`${API_BASE}/workflow/seed-defaults`, {
        method: 'POST',
        headers: apiHeaders(currentUser?.email),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message ?? t('workflowDashboard.toastDefaultsSeeded'));
        setTimeout(() => window.location.reload(), 500);
      } else {
        toast.error(json.error ?? t('workflowDashboard.toastSeedFailed'));
      }
    } catch {
      toast.error(t('workflowDashboard.toastSeedFailed'));
    } finally {
      setSeeding(false);
    }
  };

  const confirmAction = (state: ConfirmState) => setConfirmState(state);

  const handleSaveWorkflow = async (
    def: Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
    existingId?: string
  ) => {
    if (existingId) {
      await updateDefinition(existingId, def);
      toast.success(t('workflowDashboard.toastWorkflowUpdated'));
    } else {
      await createDefinition({ ...def, createdBy: currentUser?.id || '' });
      toast.success(t('workflowDashboard.toastWorkflowCreated'));
    }
  };

  const handleCreateFromTemplate = async (templateId: string) => {
    const tmpl = WORKFLOW_TEMPLATES.find(t => t.id === templateId);
    if (!tmpl) return;
    await createDefinition({ ...tmpl.template, createdBy: currentUser?.id || '' });
    toast.success(`${t('workflowDashboard.toastCreatedFromTemplate')}: ${tmpl.name}`);
  };

  const handleActivateWorkflow = async (id: string) => {
    await updateDefinition(id, { status: 'active' });
    toast.success(t('workflowDashboard.toastWorkflowActivated'));
  };

  const handlePauseWorkflow = async (id: string) => {
    await updateDefinition(id, { status: 'paused' });
    toast.warning(t('workflowDashboard.toastWorkflowPaused'));
  };

  const handleDeleteWorkflow = (id: string, name: string) => {
    confirmAction({
      title: t('workflowDashboard.confirmDeleteTitle'),
      message: t('workflowDashboard.confirmDeleteMessage').replace('{name}', name),
      danger: true,
      onConfirm: async () => {
        await deleteDefinition(id);
        toast.success(t('workflowDashboard.toastWorkflowDeleted'));
        setConfirmState(null);
      },
    });
  };

  const handleStartWorkflow = async (workflowId: string) => {
    await startWorkflow(workflowId, {
      requestedBy: currentUser?.id || '',
      startedAt: new Date().toISOString(),
    });
    toast.success(t('workflowDashboard.toastWorkflowStarted'));
  };

  const handleCancelInstance = (instanceId: string) => {
    confirmAction({
      title: t('workflowDashboard.confirmCancelTitle'),
      message: t('workflowDashboard.confirmCancelMessage'),
      onConfirm: async () => {
        await cancelInstance(instanceId);
        toast.success(t('workflowDashboard.toastWorkflowCancelled'));
        setConfirmState(null);
      },
    });
  };

  const handleApprove = async (approvalId: string) => {
    await respondToApproval(approvalId, 'approved');
    toast.success(t('workflowDashboard.toastApproved'));
  };

  const handleReject = async (approvalId: string, comment: string) => {
    await respondToApproval(approvalId, 'rejected', comment);
    toast.error(t('workflowDashboard.toastRejected'));
  };

  const statCards = {
    totalWorkflows: stats.totalWorkflows ?? definitions.length,
    activeWorkflows: stats.activeWorkflows ?? definitions.filter(d => d.status === 'active').length,
    runningInstances: stats.runningInstances ?? instances.filter(i => i.status === 'running').length,
    pendingApprovals: stats.pendingApprovals ?? pendingApprovals.length,
  };

  const instancesByStatus = ['running', 'completed', 'failed', 'cancelled', 'waiting_approval'].map(
    status => ({
      label: status.replace(/_/g, ' '),
      count: instances.filter(i => i.status === status).length,
    })
  );
  const maxCount = Math.max(1, ...instancesByStatus.map(s => s.count));

  // If viewing trace, show that instead of normal instances tab
  if (traceInstance) {
    const def = definitions.find(d => d.id === traceInstance.workflowId);
    return (
      <AppLayout
        title={t('workflowDashboard.title')}
        description={t('workflowDashboard.subtitle')}
        icon={<GitBranch className="h-5 w-5 text-amber-600" />}
        onLogout={onLogout}
      >
        <ExecutionTraceView
          instance={traceInstance}
          workflowName={def?.name || t('workflowDashboard.unknownWorkflow')}
          onBack={() => setTraceInstance(null)}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={t('workflowDashboard.title')}
      description={t('workflowDashboard.subtitle')}
      icon={<GitBranch className="h-5 w-5 text-amber-600" />}
      onLogout={onLogout}
    >
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('workflowDashboard.title')}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t('workflowDashboard.subtitle')}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => {
                setEditingWorkflow(undefined);
                setShowBuilder(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('workflowDashboard.createWorkflow')}
            </Button>
            {currentUser?.primaryRole === 'admin' && import.meta.env.DEV && (
              <Button variant="outline" onClick={handleSeedDefaults} disabled={seeding} className="opacity-50" title="Dev only">
                <Sparkles className="h-4 w-4 mr-2" />
                {seeding ? t('workflowDashboard.seeding') : t('workflowDashboard.seedDefaults')}
              </Button>
            )}
          </div>
        </div>

        {/* Pending Approvals Banner */}
        {pendingApprovals.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              {t('workflowDashboard.youHave')} {pendingApprovals.length}{' '}
              {pendingApprovals.length !== 1
                ? t('workflowDashboard.pendingApprovals')
                : t('workflowDashboard.pendingApproval')}
            </div>
            <div className="space-y-2">
              {pendingApprovals.map(approval => (
                <ApprovalCard
                  key={approval.id}
                  approval={approval}
                  onApprove={() => handleApprove(approval.id)}
                  onReject={comment => handleReject(approval.id, comment)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {loading ? (
            [1, 2, 3, 4].map(n => <SkeletonCard key={n} />)
          ) : (
            <>
              <StatCard
                label={t('workflowDashboard.statTotalWorkflows')}
                value={statCards.totalWorkflows}
                icon={Zap}
                iconBg="bg-amber-50"
                iconColor="text-amber-600"
              />
              <StatCard
                label={t('workflowDashboard.statActiveWorkflows')}
                value={statCards.activeWorkflows}
                icon={Play}
                iconBg="bg-green-50"
                iconColor="text-green-600"
                valueColor="text-green-600"
              />
              <StatCard
                label={t('workflowDashboard.statRunningInstances')}
                value={statCards.runningInstances}
                icon={BarChart3}
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
                valueColor="text-blue-600"
              />
              <StatCard
                label={t('workflowDashboard.statPendingApprovals')}
                value={statCards.pendingApprovals}
                icon={Clock}
                iconBg="bg-orange-50"
                iconColor="text-orange-600"
                valueColor="text-orange-600"
              />
            </>
          )}
        </div>

        {/* Main tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-7">
            <TabsTrigger value="overview" className="text-xs">
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
              {t('workflowDashboard.tabOverview')}
            </TabsTrigger>
            <TabsTrigger value="workflows" className="text-xs">
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              {t('workflowDashboard.tabWorkflows')} ({definitions.length})
            </TabsTrigger>
            <TabsTrigger value="templates" className="text-xs">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              {t('workflowDashboard.tabTemplates')} ({WORKFLOW_TEMPLATES.length})
            </TabsTrigger>
            <TabsTrigger value="instances" className="text-xs">
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
              {t('workflowDashboard.tabInstances')} ({instances.length})
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs">
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
              {t('workflowDashboard.tabAnalytics')}
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs">
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              {t('workflow.settingsTab')}
            </TabsTrigger>
            <TabsTrigger value="automation-studio" className="text-xs">
              <Wand2 className="h-3.5 w-3.5 mr-1.5" />
              Automation Studio
            </TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-4 mt-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                {t('workflowDashboard.recentInstances')}
              </h2>
            </div>
            {instances.length === 0 ? (
              <div className="bg-card border border-border rounded-xl py-12 text-center">
                <BarChart3 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">{t('workflowDashboard.noInstancesYet')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('workflowDashboard.noInstancesHint')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {instances.slice(0, 5).map(instance => {
                  const def = definitions.find(d => d.id === instance.workflowId);
                  return (
                    <div
                      key={instance.id}
                      className="bg-card border border-border rounded-xl p-4 flex items-center justify-between hover:border-primary/30 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {def?.name || t('workflowDashboard.unknownWorkflow')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t('workflowDashboard.startedPrefix')} {new Date(instance.startedAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={instance.status} />
                        <button
                          onClick={() => setTraceInstance(instance)}
                          className="text-xs text-primary hover:underline"
                        >
                          {t('workflowDashboard.viewTrace')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* WORKFLOWS */}
          <TabsContent value="workflows" className="space-y-4 mt-6">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(n => (
                  <Card key={n}>
                    <CardContent className="pt-6 space-y-3">
                      <div className="h-5 bg-muted rounded animate-pulse w-3/4" />
                      <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
                      <div className="h-4 bg-muted rounded animate-pulse w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : definitions.length === 0 ? (
              <div className="bg-card border border-border rounded-xl py-14 text-center">
                <div className="w-14 h-14 bg-amber-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <GitBranch className="h-7 w-7 text-amber-600" />
                </div>
                <p className="text-base font-semibold text-foreground">{t('workflowDashboard.noWorkflows')}</p>
                <p className="text-sm text-muted-foreground mt-1 mb-5">{t('workflowDashboard.noWorkflowsHint')}</p>
                <div className="flex gap-2 justify-center flex-wrap">
                  <Button
                    onClick={() => {
                      setEditingWorkflow(undefined);
                      setShowBuilder(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('workflowDashboard.createWorkflow')}
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab('templates')}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {t('workflowDashboard.tabTemplates')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {definitions.map(workflow => (
                  <div
                    key={workflow.id}
                    className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                          <GitBranch className="h-4 w-4 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground truncate">{workflow.name}</span>
                            <StatusBadge status={workflow.status} />
                          </div>
                          {workflow.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{workflow.description}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
                      <div className="flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5 shrink-0" />
                        <span className="capitalize">{(workflow.trigger?.type ?? 'manual').replace(/_/g, ' ')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span>{(workflow.nodes ?? []).length} {t('workflowDashboard.nodesLabel')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span>{t('workflowDashboard.updatedPrefix')}: {new Date(workflow.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-3 border-t border-border flex-wrap">
                      {workflow.status === 'active' && (
                        <Button size="sm" onClick={() => handleStartWorkflow(workflow.id)}>
                          <Play className="h-3 w-3 mr-1" />
                          {t('workflowDashboard.run')}
                        </Button>
                      )}
                      {workflow.status === 'active' ? (
                        <Button size="sm" variant="outline" onClick={() => handlePauseWorkflow(workflow.id)}>
                          <Pause className="h-3 w-3 mr-1" />
                          {t('workflowDashboard.pause')}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => handleActivateWorkflow(workflow.id)}>
                          <Play className="h-3 w-3 mr-1" />
                          {t('workflowDashboard.activate')}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingWorkflow(workflow);
                          setShowBuilder(true);
                        }}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        {t('common.edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteWorkflow(workflow.id, workflow.name)}
                        className="ml-auto"
                      >
                        <Trash2 className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TEMPLATES */}
          <TabsContent value="templates" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {WORKFLOW_TEMPLATES.map(template => {
                const catColor = CATEGORY_COLORS[template.category] ?? { bg: 'bg-purple-50', text: 'text-purple-600' };
                return (
                  <div
                    key={template.id}
                    className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition-all flex flex-col gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 ${catColor.bg} rounded-lg flex items-center justify-center shrink-0`}>
                        <Sparkles className={`h-4 w-4 ${catColor.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground">{template.name}</p>
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 font-medium ${catColor.bg} ${catColor.text}`}>
                          {template.category}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{template.description}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        <span>{template.triggerEvent}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        <span>{template.stepCount} steps</span>
                      </div>
                    </div>
                    <Button size="sm" className="w-full mt-auto" onClick={() => handleCreateFromTemplate(template.id)}>
                      <Plus className="h-3 w-3 mr-1" />
                      {t('workflowDashboard.useTemplate')}
                    </Button>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* INSTANCES */}
          <TabsContent value="instances" className="space-y-3 mt-6">
            {instances.length === 0 ? (
              <div className="bg-card border border-border rounded-xl py-14 text-center">
                <BarChart3 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">{t('workflowDashboard.noInstances')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('workflowDashboard.noInstancesHint')}</p>
              </div>
            ) : (
              instances.map(instance => {
                const def = definitions.find(d => d.id === instance.workflowId);
                return (
                  <div key={instance.id} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">
                            {def?.name || t('workflowDashboard.unknownWorkflow')}
                          </span>
                          <StatusBadge status={instance.status} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t('workflowDashboard.startedLabel')}: {new Date(instance.startedAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {instance.status === 'running' && (
                          <Button size="sm" variant="outline" onClick={() => handleCancelInstance(instance.id)}>
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            {t('workflowDashboard.cancelBtn')}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setSelectedInstance(instance)}>
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          {t('workflowDashboard.viewDetails')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setTraceInstance(instance)}>
                          <BarChart3 className="h-3.5 w-3.5 mr-1" />
                          {t('workflowDashboard.viewTrace')}
                        </Button>
                      </div>
                    </div>
                    {instance.history.length > 0 && (
                      <div className="border-t border-border pt-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {t('workflowDashboard.executionHistory')}
                        </p>
                        {instance.history.map((entry, idx) => (
                          <div key={idx} className="flex items-center gap-2.5 text-xs">
                            {entry.status === 'success' ? (
                              <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            ) : entry.status === 'error' ? (
                              <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                            ) : (
                              <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            )}
                            <span className="font-medium text-foreground">{entry.action}</span>
                            <span className="text-muted-foreground">
                              {new Date(entry.timestamp).toLocaleTimeString()}
                            </span>
                            {entry.error && <span className="text-red-600">{entry.error}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </TabsContent>

          {/* SETTINGS — Event Mappings */}
          <TabsContent value="settings" className="space-y-4 mt-6">
            <EventMappingsPanel definitions={definitions} />
          </TabsContent>

          {/* AUTOMATION STUDIO */}
          <TabsContent value="automation-studio" className="space-y-6 mt-6">
            {/* Header row */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-base font-semibold text-foreground">Automation Studio</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Use pre-built recipes or build a custom automation from scratch.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-card border border-border rounded-xl px-4 py-2 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Active Automations</p>
                  <p className="text-2xl font-bold text-green-600 mt-0.5">{statCards.activeWorkflows}</p>
                </div>
                <Button
                  onClick={() => {
                    setEditingWorkflow(undefined);
                    setShowBuilder(true);
                  }}
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  Build Custom Automation
                </Button>
              </div>
            </div>

            {/* Recipe cards */}
            <div>
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">
                Pre-Built Recipes
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {([
                  {
                    name: "New Employee Onboarding",
                    description: "Auto-create tasks and send welcome email when new employee added",
                    trigger: "employee_created",
                    category: "HR",
                  },
                  {
                    name: "Invoice Overdue Alert",
                    description: "Alert finance team when invoice overdue by 14 days",
                    trigger: "invoice_overdue",
                    category: "Finance",
                  },
                  {
                    name: "OKR Check-in Reminder",
                    description: "Weekly reminder for employees to submit OKR check-ins",
                    trigger: "okr_checkin_due",
                    category: "OKR",
                  },
                  {
                    name: "Payroll Approval Flow",
                    description: "Route payroll for approval before processing",
                    trigger: "payroll_processed",
                    category: "Payroll",
                  },
                  {
                    name: "Compliance Deadline Alert",
                    description: "Alert compliance team 7 days before deadline",
                    trigger: "compliance_deadline_7d",
                    category: "Security",
                  },
                ] as const).map(recipe => {
                  const RECIPE_CAT_COLORS: Record<string, { bg: string; text: string; iconBg: string }> = {
                    HR: { bg: 'bg-blue-50', text: 'text-blue-700', iconBg: 'bg-blue-100' },
                    Finance: { bg: 'bg-emerald-50', text: 'text-emerald-700', iconBg: 'bg-emerald-100' },
                    OKR: { bg: 'bg-amber-50', text: 'text-amber-700', iconBg: 'bg-amber-100' },
                    Payroll: { bg: 'bg-purple-50', text: 'text-purple-700', iconBg: 'bg-purple-100' },
                    Security: { bg: 'bg-red-50', text: 'text-red-700', iconBg: 'bg-red-100' },
                  };
                  const colors = RECIPE_CAT_COLORS[recipe.category] ?? { bg: 'bg-muted', text: 'text-muted-foreground', iconBg: 'bg-muted' };
                  return (
                    <div
                      key={recipe.name}
                      className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 hover:border-primary/30 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 ${colors.iconBg} rounded-lg flex items-center justify-center shrink-0`}>
                          <Zap className={`h-4 w-4 ${colors.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground leading-snug">{recipe.name}</p>
                          <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 font-medium ${colors.bg} ${colors.text}`}>
                            {recipe.category}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed flex-1">{recipe.description}</p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Zap className="h-3 w-3 shrink-0" />
                        <span className="font-mono truncate">{recipe.trigger}</span>
                      </div>
                      <Button
                        size="sm"
                        className="w-full mt-auto"
                        onClick={async () => {
                          await createDefinition({
                            name: recipe.name,
                            description: recipe.description,
                            status: 'active',
                            trigger: { type: 'event', event: recipe.trigger },
                            nodes: [],
                            edges: [],
                            variables: [],
                            createdBy: currentUser?.id || '',
                          });
                          toast.success(`Recipe "${recipe.name}" activated successfully`);
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Use Recipe
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* ANALYTICS */}
          <TabsContent value="analytics" className="space-y-4 mt-6">
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-0.5">{t('workflowDashboard.instancesByStatus')}</h3>
              <p className="text-xs text-muted-foreground mb-4">{t('workflowDashboard.instancesByStatusDesc')}</p>
              {instances.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {t('workflowDashboard.noAnalyticsData')}
                </p>
              ) : (
                <div className="space-y-3">
                  {instancesByStatus.map(({ label, count }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="w-28 text-xs text-muted-foreground capitalize shrink-0">{label}</span>
                      <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            label === 'completed' ? 'bg-emerald-500'
                            : label === 'failed' ? 'bg-red-500'
                            : label === 'running' ? 'bg-blue-500'
                            : label === 'cancelled' ? 'bg-muted-foreground'
                            : 'bg-amber-500'
                          }`}
                          style={{ width: `${(count / maxCount) * 100}%` }}
                        />
                      </div>
                      <span className="w-6 text-xs font-semibold text-foreground text-right shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-0.5">{t('workflowDashboard.workflowActivity')}</h3>
              <p className="text-xs text-muted-foreground mb-4">{t('workflowDashboard.workflowActivityDesc')}</p>
              <div className="grid grid-cols-3 gap-3">
                {(['active', 'paused', 'draft'] as const).map(status => (
                  <div key={status} className="bg-muted/40 border border-border rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">
                      {definitions.filter(d => d.status === status).length}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize mt-1">{status}</p>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Instance Detail Modal */}
      {selectedInstance && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-foreground">{t('workflowDashboard.instanceDetails')}</h2>
              <button
                onClick={() => setSelectedInstance(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
              >
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">{t('workflowDashboard.statusLabel')}</p>
                  <StatusBadge status={selectedInstance.status} />
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">{t('workflowDashboard.startedLabel')}</p>
                  <p className="text-xs font-semibold text-foreground">
                    {new Date(selectedInstance.startedAt).toLocaleString()}
                  </p>
                </div>
                {selectedInstance.completedAt && (
                  <div className="bg-muted/40 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">{t('workflowDashboard.completedLabel')}</p>
                    <p className="text-xs font-semibold text-foreground">
                      {new Date(selectedInstance.completedAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  {t('workflowDashboard.fullHistory')}
                </p>
                <div className="space-y-2">
                  {selectedInstance.history.map((entry, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs bg-muted/40 rounded-lg p-3 border border-border">
                      {entry.status === 'success' ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                      ) : entry.status === 'error' ? (
                        <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <p className="font-medium text-foreground">{entry.action}</p>
                        <p className="text-muted-foreground">{new Date(entry.timestamp).toLocaleTimeString()}</p>
                        {entry.error && <p className="text-red-600 mt-1">{entry.error}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Button
                size="sm"
                className="w-full"
                onClick={() => { setSelectedInstance(null); setTraceInstance(selectedInstance); }}
              >
                <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                {t('workflowDashboard.viewTrace')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          danger={confirmState.danger}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}

      {/* Workflow Builder Modal */}
      {showBuilder && (
        <WorkflowBuilder
          existingWorkflow={editingWorkflow}
          onClose={() => {
            setShowBuilder(false);
            setEditingWorkflow(undefined);
          }}
          onSave={handleSaveWorkflow}
        />
      )}
    </AppLayout>
  );
}

export default WorkflowDashboard;
