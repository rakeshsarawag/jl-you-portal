import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { AppLayout } from '../apps/AppLayout';
import ReportDefectButton from '../ReportDefectButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { supabase } from '../../utils/constants';
import { useUser } from '../../context/UserContext';
import { useAuditLogger } from '../../../hooks/useAuditLogger';
import { t } from '../../../i18n';
import {
  Rocket,
  FileText,
  TrendingUp,
  BarChart3,
  Download,
  Star,
  Clock,
  Share2,
  Play,
  Plus,
  Search,
  Filter,
  Grid3x3,
  Layout,
  Zap,
  Code,
  Database,
  Settings,
  Activity,
  Eye,
  Copy,
  Trash2,
  Calendar,
  Users,
  DollarSign,
  Shield,
  Package,
  Sparkles,
  Brain,
  Target,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Mail,
  Webhook,
  Cloud,
  MessageSquare,
  ArrowRight,
  Printer
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';

interface AdvancedFeaturesDashboardProps {
  accessToken: string;
  onLogout: () => void;
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface CustomReport {
  id: string;
  name: string;
  description?: string;
  type: 'table' | 'chart' | 'dashboard';
  domain?: string;
  metric_config?: any;
  filter_config?: any;
  is_favorite?: boolean;
  schedule?: string | null;
  schedule_time?: string | null;
  schedule_recipients?: string | null;
  next_run_at?: string | null;
  last_run_at?: string | null;
  last_run_output?: any;
  run_count?: number;
  created_by?: string;
  created_at?: string;
}

interface MonitoringMetric {
  id: string;
  metric_name: string;
  value: string | number;
  unit?: string;
  status?: 'healthy' | 'warning' | 'critical';
  source?: string;
  timestamp: string;
}

interface IntegrationConfig {
  id?: string;
  integration_id: string;
  status: 'connected' | 'disconnected' | 'error' | 'suspended';
  last_tested_at?: string | null;
  last_synced_at?: string | null;
  config?: any;
  error_message?: string | null;
  created_by?: string;
}

interface SearchResult {
  entity_type: 'employee' | 'ticket' | 'invoice' | 'documentation' | 'course' | 'task' | 'defect' | 'announcement' | 'okr' | 'workflow' | 'job';
  id: string;
  title: string;
  preview: string;
  route: string;
  icon: string;
}

interface Automation {
  id: string;
  name: string;
  trigger: string;
  actions: string[];
  enabled: boolean;
  lastTriggered?: string;
  last_triggered_at?: string | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const FEATURE_CATEGORIES = [
  { id: 'reporting', name: 'Advanced Reporting', icon: FileText, description: 'Create custom reports and dashboards', color: 'bg-blue-500' },
  { id: 'api', name: 'API Integration Hub', icon: Code, description: 'Connect external services and APIs', color: 'bg-purple-500' },
  { id: 'automation', name: 'Automation Studio', icon: Zap, description: 'Build workflows and automations', color: 'bg-yellow-500' },
  { id: 'analytics', name: 'Advanced Analytics', icon: BarChart3, description: 'Deep insights and predictions', color: 'bg-green-500' },
  { id: 'search', name: 'Smart Search', icon: Search, description: 'AI-powered universal search', color: 'bg-pink-500' },
  { id: 'monitoring', name: 'System Monitoring', icon: Activity, description: 'Real-time health and performance', color: 'bg-red-500' }
];

const AVAILABLE_INTEGRATIONS = [
  { id: 'slack', name: 'Slack', icon: MessageSquare, color: 'bg-purple-500', fields: ['webhook_url', 'channel'] },
  { id: 'teams', name: 'Microsoft Teams', icon: MessageSquare, color: 'bg-blue-600', fields: ['webhook_url'] },
  { id: 'google_workspace', name: 'Google Workspace', icon: Cloud, color: 'bg-green-500', fields: ['client_id', 'client_secret'] },
  { id: 'microsoft_365', name: 'Microsoft 365', icon: Cloud, color: 'bg-blue-500', fields: ['tenant_id', 'client_id', 'client_secret'] },
  { id: 'whatsapp', name: 'WhatsApp Business', icon: MessageSquare, color: 'bg-green-600', fields: ['api_key', 'phone_number_id'] },
  { id: 'custom_webhook', name: 'Custom Webhook', icon: Webhook, color: 'bg-yellow-500', fields: ['url', 'secret'] },
  { id: 'email_smtp', name: 'Email SMTP', icon: Mail, color: 'bg-red-500', fields: ['host', 'port', 'username', 'password', 'from_name', 'from_email'] },
  { id: 'aws_s3', name: 'AWS S3', icon: Database, color: 'bg-orange-500', fields: ['access_key', 'secret_key', 'bucket', 'region'] },
  { id: 'azure_blob', name: 'Azure Blob Storage', icon: Database, color: 'bg-blue-700', fields: ['connection_string', 'container'] }
];

const AUTOMATION_TRIGGERS = [
  { id: 'new_employee', label: 'New Employee Joined' },
  { id: 'invoice_overdue', label: 'Invoice Overdue' },
  { id: 'it_ticket_sla', label: 'IT Ticket SLA Breached' },
  { id: 'okr_checkin_missed', label: 'OKR Check-In Missed' },
  { id: 'task_overdue', label: 'Task Overdue' },
  { id: 'custom_event', label: 'Custom Event' }
];

const AUTOMATION_ACTIONS = [
  { id: 'assign_task', label: 'Assign Task' },
  { id: 'send_email', label: 'Send Email Notification' },
  { id: 'send_push', label: 'Send Push Notification' },
  { id: 'create_ticket', label: 'Create IT Ticket' },
  { id: 'enroll_training', label: 'Enroll in Training' },
  { id: 'forward_slack', label: 'Forward to Slack/Teams' },
  { id: 'call_webhook', label: 'Call Webhook' }
];

const AUTOMATION_RECIPES = [
  { id: 'new_hire', name: 'New Hire Onboarding', trigger: 'New Employee', actionCount: 3 },
  { id: 'invoice_reminder', name: 'Overdue Invoice Reminder', trigger: 'Invoice Overdue', actionCount: 3 },
  { id: 'sla_escalation', name: 'SLA Breach Escalation', trigger: 'IT Ticket SLA Breached', actionCount: 2 },
  { id: 'okr_checkin', name: 'OKR Check-In Reminder', trigger: 'OKR Check-In Missed', actionCount: 2 }
];

const AUTOMATION_SEARCH_SCOPES = ['all', 'employees', 'tasks', 'tickets', 'invoices', 'courses', 'documents', 'defects', 'announcements', 'okrs', 'workflows', 'jobs'];

const SCHEDULE_OPTIONS = [
  { value: 'daily_8am', label: 'Daily 8AM' },
  { value: 'weekly_monday_9am', label: 'Weekly Monday 9AM' },
  { value: 'monthly_1st', label: 'Monthly 1st' },
  { value: 'custom', label: 'Custom' }
];

const GAUGE_METRICS: Record<string, { max: number; unit: string }> = {
  cpu_usage: { max: 100, unit: '%' },
  cpu: { max: 100, unit: '%' },
  memory_usage: { max: 100, unit: '%' },
  memory: { max: 100, unit: '%' },
  disk_usage: { max: 100, unit: '%' },
  disk: { max: 100, unit: '%' },
  api_response_time: { max: 500, unit: 'ms' },
  api_latency: { max: 500, unit: 'ms' },
  error_rate: { max: 10, unit: '%' },
  active_users: { max: 200, unit: '' },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function downloadXLSX(rows: any[], filename: string) {
  if (!rows || rows.length === 0) return;
  import('xlsx').then(XLSX => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, filename);
  });
}

function downloadCSV(rows: any[], filename: string) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function domainTable(domain?: string): string {
  switch (domain) {
    case 'hr': return 'employees';
    case 'finance': return 'invoices';
    case 'it': return 'it_tickets';
    case 'training': return 'training_enrollments';
    default: return 'employees';
  }
}

function statusColor(status?: string) {
  switch (status) {
    case 'connected': return 'bg-green-100 text-green-800';
    case 'error': return 'bg-red-100 text-red-800';
    case 'suspended': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function redactPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'token', 'secret', 'api_key', 'apikey', 'authorization', 'webhook_secret'];
  return Object.fromEntries(
    Object.entries(payload ?? {}).map(([k, v]) => [
      k,
      sensitiveKeys.some(sk => k.toLowerCase().includes(sk)) ? '***REDACTED***' : v
    ])
  );
}

function metricStatusDot(status?: string) {
  switch (status) {
    case 'healthy': return 'bg-green-500';
    case 'warning': return 'bg-yellow-500';
    case 'critical': return 'bg-red-500';
    default: return 'bg-gray-400';
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AdvancedFeaturesDashboard({ accessToken, onLogout }: AdvancedFeaturesDashboardProps) {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const { log } = useAuditLogger();

  // ── Reports state ──────────────────────────────────────────────────────────
  const [reports, setReports] = useState<CustomReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newReportName, setNewReportName] = useState('');
  const [newReportDescription, setNewReportDescription] = useState('');
  const [newReportType, setNewReportType] = useState<'table' | 'chart' | 'dashboard'>('table');
  const [newReportDomain, setNewReportDomain] = useState<string>('hr');
  const [runningReportId, setRunningReportId] = useState<string | null>(null);
  const [reportResults, setReportResults] = useState<Record<string, any[]>>({});
  const [reportRunStatus, setReportRunStatus] = useState<Record<string, string>>({});

  // Schedule modal
  const [scheduleReportId, setScheduleReportId] = useState<string | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState('daily_8am');
  const [customCronExpr, setCustomCronExpr] = useState('');
  const [scheduleRecipients, setScheduleRecipients] = useState('');

  // ── Integrations state ─────────────────────────────────────────────────────
  const [integrationConfigs, setIntegrationConfigs] = useState<Record<string, IntegrationConfig>>({});
  const [integrationsLoading, setIntegrationsLoading] = useState(false);
  const [connectModalId, setConnectModalId] = useState<string | null>(null);
  const [connectFormData, setConnectFormData] = useState<Record<string, string>>({});
  const [testingIntegration, setTestingIntegration] = useState<string | null>(null);
  const [disconnectConfirm, setDisconnectConfirm] = useState<string | null>(null);
  const [testPassed, setTestPassed] = useState(false);
  const [testPassedAt, setTestPassedAt] = useState<number | null>(null);

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('reports');

  // ── Smart Search state ─────────────────────────────────────────────────────
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState('all');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimestamps = useRef<number[]>([]);

  // ── Automation state ───────────────────────────────────────────────────────
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [automationSearch, setAutomationSearch] = useState('');
  const [showAutomationModal, setShowAutomationModal] = useState(false);
  const [automationWizardStep, setAutomationWizardStep] = useState(1);
  const [automationTrigger, setAutomationTrigger] = useState('');
  const [automationActions, setAutomationActions] = useState<string[]>([]);
  const [automationName, setAutomationName] = useState('');
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [actionParams, setActionParams] = useState<Record<string, Record<string, string>>>({});
  const [wizardCourses, setWizardCourses] = useState<{ id: string; title: string }[]>([]);
  const [wizardWorkflows, setWizardWorkflows] = useState<{ id: string; name: string }[]>([]);

  // ── Monitoring state ───────────────────────────────────────────────────────
  const [metrics, setMetrics] = useState<MonitoringMetric[]>([]);
  const [recentEvents, setRecentEvents] = useState<MonitoringMetric[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [metricHistory, setMetricHistory] = useState<Record<string, number[]>>({});

  // ── Integration event log state ────────────────────────────────────────────
  const [eventLogIntegration, setEventLogIntegration] = useState<string | null>(null);
  const [integrationEvents, setIntegrationEvents] = useState<any[]>([]);

  // ── Load data on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    loadReports();
    loadIntegrations();
    loadMonitoring();
    loadAutomations();
  }, []);

  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          loadMonitoring();
          return 60;
        }
        return c - 1;
      });
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  // ── Cmd+K shortcut ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setActiveTab('smart-search');
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Debounced search trigger ────────────────────────────────────────────────
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (globalSearchQuery.length < 3) { setSearchResults([]); return; }
    searchDebounceRef.current = setTimeout(() => {
      void searchAll(globalSearchQuery, searchScope);
    }, 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [globalSearchQuery, searchScope]);

  // ── Automations loader ─────────────────────────────────────────────────────

  async function loadAutomations() {
    if (!currentUser?.id) return;
    const { data } = await supabase
      .from('workflow_definitions')
      .select('*')
      .eq('created_by', currentUser.id)
      .order('created_at', { ascending: false });
    if (data) {
      setAutomations(data.map((row: any) => ({
        id: row.id,
        name: row.name,
        trigger: row.trigger_config?.trigger ?? row.trigger_type ?? '',
        actions: (() => { try { return JSON.parse(row.nodes ?? '[]'); } catch { return Array.isArray(row.nodes) ? row.nodes : []; } })(),
        enabled: row.status === 'active',
        last_triggered_at: row.updated_at ?? null
      })));
    }
  }

  // ── Smart Search ───────────────────────────────────────────────────────────

  async function searchAll(query: string, scope: string) {
    if (query.length < 3) return;
    const now = Date.now();
    searchTimestamps.current = searchTimestamps.current.filter(t => now - t < 60000);
    if (searchTimestamps.current.length >= 10) {
      toast.error("Search rate limit reached. Please wait before searching again.");
      return;
    }
    searchTimestamps.current.push(now);
    setSearching(true);
    const results: SearchResult[] = [];
    const q = `%${query}%`;

    if (scope === 'all' || scope === 'employees') {
      const { data } = await supabase.from('employees')
        .select('id, name, email, department, designation')
        .or(`name.ilike.${q},email.ilike.${q},department.ilike.${q}`)
        .limit(50);
      if (data) results.push(...data.map((e: any) => ({
        entity_type: 'employee' as const,
        id: e.id,
        title: e.name,
        preview: `${e.designation ?? ''} • ${e.department ?? ''}`,
        route: '/directory',
        icon: '👤'
      })));
    }

    if (scope === 'all' || scope === 'tickets') {
      const { data } = await supabase.from('it_tickets')
        .select('id, title, description, status')
        .or(`title.ilike.${q},description.ilike.${q}`)
        .limit(50);
      if (data) results.push(...data.map((t: any) => ({
        entity_type: 'ticket' as const,
        id: t.id,
        title: t.title,
        preview: `Status: ${t.status}`,
        route: '/it-services',
        icon: '🎫'
      })));
    }

    if (scope === 'all' || scope === 'invoices') {
      const { data } = await supabase.from('invoices')
        .select('id, invoice_number, client_name, status')
        .or(`invoice_number.ilike.${q},client_name.ilike.${q}`)
        .limit(50);
      if (data) results.push(...data.map((i: any) => ({
        entity_type: 'invoice' as const,
        id: i.id,
        title: i.invoice_number,
        preview: `${i.client_name} • ${i.status}`,
        route: '/invoices',
        icon: '🧾'
      })));
    }

    if (scope === 'all' || scope === 'documents') {
      const { data } = await supabase.from('doc_faqs')
        .select('id, question, answer')
        .or(`question.ilike.${q},answer.ilike.${q}`)
        .limit(3);
      if (data) results.push(...data.map((d: any) => ({
        entity_type: 'documentation' as const,
        id: d.id,
        title: d.question,
        preview: d.answer.slice(0, 80) + '...',
        route: '/documentation',
        icon: '📖'
      })));
    }

    if (scope === 'all' || scope === 'tasks') {
      const { data: taskRows } = await supabase
        .from('project_tasks')
        .select('id, title, description, status, assignee_name')
        .ilike('title', `%${query}%`)
        .limit(50);
      if (taskRows) results.push(...taskRows.map((row: any) => ({
        entity_type: 'task' as const,
        id: row.id,
        title: row.title,
        preview: row.description ?? row.status ?? '',
        route: '/projects',
        icon: '✅'
      })));
    }

    if (scope === 'all' || scope === 'courses') {
      const { data: courseRows } = await supabase
        .from('training_courses')
        .select('id, title, description, category, status')
        .ilike('title', `%${query}%`)
        .limit(50);
      if (courseRows) results.push(...courseRows.map((row: any) => ({
        entity_type: 'course' as const,
        id: row.id,
        title: row.title,
        preview: row.description ?? row.category ?? '',
        route: '/training',
        icon: '🎓'
      })));
    }

    if (scope === 'all' || scope === 'defects') {
      const { data: defects } = await supabase
        .from('defects')
        .select('id, title, description, status, severity')
        .ilike('title', `${query}%`)
        .limit(50);
      if (defects) results.push(...defects.map((row: any) => ({
        entity_type: 'defect' as const,
        id: row.id,
        title: row.title,
        preview: `${row.status} - ${row.severity}`,
        route: `/defect-tracker?id=${row.id}`,
        icon: '🐛'
      })));
    }

    if (scope === 'all' || scope === 'announcements') {
      const { data: announcements } = await supabase
        .from('announcements')
        .select('id, title, content, created_at')
        .ilike('title', `${query}%`)
        .limit(50);
      if (announcements) results.push(...announcements.map((row: any) => ({
        entity_type: 'announcement' as const,
        id: row.id,
        title: row.title,
        preview: 'Announcement',
        route: `/communications?announcement=${row.id}`,
        icon: '📢'
      })));
    }

    if (scope === 'all' || scope === 'okrs') {
      const { data: okrResults } = await supabase.from('okrs')
        .select('id, title, type, status, owner_id')
        .ilike('title', `%${query}%`).limit(50);
      if (okrResults) results.push(...(okrResults as any[]).map(r => ({
        entity_type: 'okr' as const,
        id: r.id,
        title: r.title,
        preview: `${r.type} · ${r.status}`,
        route: '/okr',
        icon: '🎯'
      })));
    }

    if (scope === 'all' || scope === 'workflows') {
      const { data: workflowResults } = await supabase.from('workflow_instances')
        .select('id, workflow_name, status, created_at')
        .ilike('workflow_name', `%${query}%`).limit(50);
      if (workflowResults) results.push(...(workflowResults as any[]).map(r => ({
        entity_type: 'workflow' as const,
        id: r.id,
        title: r.workflow_name,
        preview: `Status: ${r.status}`,
        route: '/workflow-dashboard',
        icon: '⚙️'
      })));
    }

    if (scope === 'all' || scope === 'jobs') {
      const { data: reqResults } = await supabase.from('job_requisitions')
        .select('id, title, department, status')
        .ilike('title', `%${query}%`).limit(50);
      if (reqResults) results.push(...(reqResults as any[]).map(r => ({
        entity_type: 'job' as const,
        id: r.id,
        title: r.title,
        preview: `${r.department} · ${r.status}`,
        route: '/recruitment',
        icon: '💼'
      })));
    }

    setSearchResults(results);
    setSearching(false);
  }

  // ── Automation helpers ─────────────────────────────────────────────────────

  function openAutomationModal(recipe?: typeof AUTOMATION_RECIPES[0], existing?: Automation) {
    setAutomationWizardStep(1);
    setEditingAutomation(existing ?? null);
    setAutomationName(existing ? existing.name : (recipe ? recipe.name : ''));
    setAutomationTrigger(existing ? existing.trigger : (recipe ? recipe.trigger : ''));
    setAutomationActions(existing ? existing.actions : []);
    setAutomationEnabled(existing ? existing.enabled : true);
    setActionParams({});
    setShowAutomationModal(true);
    // Preload courses and workflows for step 3 params
    void (async () => {
      const { data: courses } = await supabase.from('training_courses').select('id, title').limit(5);
      if (courses) setWizardCourses(courses as { id: string; title: string }[]);
      const { data: wfs } = await supabase.from('workflow_definitions').select('id, name').limit(20);
      if (wfs) setWizardWorkflows(wfs as { id: string; name: string }[]);
    })();
  }

  async function handleSaveAutomation() {
    if (!automationName.trim()) { toast.error(t('advanced.automation.nameRequired')); return; }
    if (!automationTrigger) { toast.error(t('advanced.automation.triggerRequired')); return; }
    if (automationActions.length === 0) { toast.error(t('advanced.automation.actionsRequired')); return; }

    if (editingAutomation) {
      // Update existing
      void supabase.from('workflow_definitions').update({
        name: automationName,
        trigger_config: { trigger: automationTrigger },
        nodes: JSON.stringify(automationActions),
        action_params: actionParams,
        status: automationEnabled ? 'active' : 'inactive',
        updated_by: currentUser?.id
      }).eq('id', editingAutomation.id);
      setAutomations(prev => prev.map(a => a.id === editingAutomation.id
        ? { ...a, name: automationName, trigger: automationTrigger, actions: automationActions, enabled: automationEnabled }
        : a));
    } else {
      // Insert new
      const { data: inserted } = await supabase.from('workflow_definitions').insert([{
        name: automationName,
        trigger_type: 'event',
        trigger_config: { trigger: automationTrigger },
        nodes: JSON.stringify(automationActions),
        action_params: actionParams,
        status: automationEnabled ? 'active' : 'inactive',
        created_by: currentUser?.id
      }]).select('id').single();
      const newId = inserted?.id ?? crypto.randomUUID();
      const newAuto: Automation = {
        id: newId,
        name: automationName,
        trigger: automationTrigger,
        actions: automationActions,
        enabled: automationEnabled,
        last_triggered_at: null
      };
      setAutomations(prev => [newAuto, ...prev]);
    }

    toast.success(t('advanced.automation.saved'));
    setShowAutomationModal(false);
    setEditingAutomation(null);
  }

  function handleToggleAutomation(id: string) {
    setAutomations(prev => prev.map(a => {
      if (a.id !== id) return a;
      const next = !a.enabled;
      void supabase.from('workflow_definitions').update({ status: next ? 'active' : 'inactive' }).eq('id', id);
      toast.success(next ? t('advanced.automation.enabled') : t('advanced.automation.disabled'));
      return { ...a, enabled: next };
    }));
  }

  function handleDeleteAutomation(id: string) {
    void supabase.from('workflow_definitions').delete().eq('id', id);
    setAutomations(prev => prev.filter(a => a.id !== id));
    toast.success(t('advanced.automation.deleted'));
  }

  const filteredAutomations = automationSearch
    ? automations.filter(a => a.name.toLowerCase().includes(automationSearch.toLowerCase()))
    : automations;

  // Group search results by entity type
  const groupedResults = searchResults.reduce<Record<string, SearchResult[]>>((acc, r) => {
    const key = r.entity_type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const entityTypeLabel: Record<string, string> = {
    employee: t('advanced.search.employees'),
    ticket: t('advanced.search.tickets'),
    invoice: t('advanced.search.invoices'),
    documentation: t('advanced.search.documentation'),
    course: t('advanced.search.courses'),
    defect: 'Defects',
    announcement: 'Announcements',
    okr: 'OKRs',
    workflow: 'Workflows',
    job: 'Jobs'
  };

  // ── Reports ────────────────────────────────────────────────────────────────

  async function loadReports() {
    if (!currentUser?.id) return;
    setReportsLoading(true);
    const { data, error } = await supabase
      .from('custom_reports')
      .select('*')
      .eq('created_by', currentUser.id)
      .order('created_at', { ascending: false });
    if (!error && data) setReports(data as CustomReport[]);

    const { data: runs } = await supabase
      .from('report_runs')
      .select('report_id, status, created_at')
      .order('created_at', { ascending: false });
    if (runs) {
      const runMap: Record<string, string> = {};
      for (const run of runs as { report_id: string; status: string; created_at: string }[]) {
        if (!runMap[run.report_id]) runMap[run.report_id] = run.status;
      }
      setReportRunStatus(runMap);
    }

    setReportsLoading(false);
  }

  async function handleCreateReport() {
    if (!newReportName.trim()) { toast.error(t('advanced.reports.nameRequired')); return; }
    if (newReportName.trim().length < 3) { toast.error("Report name must be at least 3 characters."); return; }
    if (newReportName.trim().length > 100) { toast.error("Report name cannot exceed 100 characters."); return; }
    const { data, error } = await supabase.from('custom_reports').insert([{
      name: newReportName,
      description: newReportDescription,
      type: newReportType,
      domain: newReportDomain,
      is_favorite: false,
      run_count: 0,
      created_by: currentUser?.id
    }]).select().single();
    if (error) { toast.error(t('advanced.reports.createError')); return; }
    toast.success(t('advanced.reports.created'));
    setShowCreateDialog(false);
    setNewReportName('');
    setNewReportDescription('');
    setNewReportType('table');
    setNewReportDomain('hr');
    loadReports();
  }

  async function handleRunReport(report: CustomReport) {
    setRunningReportId(report.id);
    const table = domainTable(report.domain);
    const { data: rows, error } = await supabase.from(table).select('*').limit(100);
    if (error) {
      toast.error(t('advanced.reports.runError'));
      setRunningReportId(null);
      return;
    }
    const output = { rows: rows ?? [], ran_at: new Date().toISOString() };
    setReportResults(prev => ({ ...prev, [report.id]: rows ?? [] }));

    void supabase.from('custom_reports').update({
      last_run_output: output,
      last_run_at: new Date().toISOString(),
      run_count: (report.run_count ?? 0) + 1
    }).eq('id', report.id);

    void supabase.from('report_runs').insert([{
      report_id: report.id,
      run_at: new Date().toISOString(),
      run_by: currentUser?.id,
      trigger: 'manual',
      status: 'success',
      row_count: rows?.length ?? 0
    }]);

    toast.success(`${t('advanced.reports.ranOk')} — ${rows?.length ?? 0} rows`);
    setRunningReportId(null);
    loadReports();
  }

  async function handleToggleFavorite(report: CustomReport) {
    const next = !report.is_favorite;
    setReports(prev => prev.map(r => r.id === report.id ? { ...r, is_favorite: next } : r));
    void supabase.from('custom_reports').update({ is_favorite: next }).eq('id', report.id);
  }

  async function handleDeleteReport(reportId: string) {
    if (!confirm(t('advanced.reports.deleteConfirm'))) return;
    const { error } = await supabase.from('custom_reports').delete().eq('id', reportId).eq('created_by', currentUser?.id ?? '');
    if (error) { toast.error(t('advanced.reports.deleteError')); return; }
    toast.success(t('advanced.reports.deleted'));
    setReports(prev => prev.filter(r => r.id !== reportId));
    setReportResults(prev => { const copy = { ...prev }; delete copy[reportId]; return copy; });
  }

  async function handleSaveSchedule() {
    if (!scheduleReportId) return;
    if (selectedSchedule === 'custom') {
      const parts = customCronExpr.trim().split(/\s+/);
      if (parts.length !== 5) {
        toast.error("Cron expression must have exactly 5 space-separated parts (e.g. 0 9 * * 1).");
        return;
      }
    }
    const now = new Date();
    let next_run_at: string | null = null;
    if (selectedSchedule === 'daily_8am') {
      const d = new Date(now); d.setHours(8, 0, 0, 0); if (d <= now) d.setDate(d.getDate() + 1);
      next_run_at = d.toISOString();
    } else if (selectedSchedule === 'weekly_monday_9am') {
      const d = new Date(now); const day = d.getDay(); const diff = (1 - day + 7) % 7 || 7;
      d.setDate(d.getDate() + diff); d.setHours(9, 0, 0, 0); next_run_at = d.toISOString();
    } else {
      const d = new Date(now); d.setMonth(d.getMonth() + 1, 1); d.setHours(0, 0, 0, 0);
      next_run_at = d.toISOString();
    }
    void supabase.from('custom_reports').update({
      schedule: selectedSchedule,
      schedule_recipients: scheduleRecipients,
      next_run_at
    }).eq('id', scheduleReportId);
    toast.success(t('advanced.reports.scheduleSet'));
    setScheduleReportId(null);
    loadReports();
  }

  async function handleRemoveSchedule(reportId: string) {
    void supabase.from('custom_reports').update({ schedule: null, schedule_recipients: null, next_run_at: null }).eq('id', reportId);
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, schedule: null, next_run_at: null } : r));
    toast.success(t('advanced.reports.scheduleRemoved'));
  }

  function handleExportReportPDF(report: CustomReport, rows: any[] | undefined) {
    if (!rows?.length) { toast.error("Run the report first to get data"); return; }
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const headers = Object.keys(rows[0] || {});
    printWindow.document.write(`<html><head><title>${report.name} Report</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h2{color:#4F46E5}table{width:100%;border-collapse:collapse}th,td{border:1px solid #e5e7eb;padding:8px;font-size:12px;text-align:left}th{background:#f9fafb;font-weight:600}tr:nth-child(even){background:#f9fafb}@media print{body{padding:0}}</style>
    </head><body>
    <h2>${report.name}</h2>
    <p style="color:#6b7280;font-size:12px">Generated: ${new Date().toLocaleString()} | Rows: ${rows.length}</p>
    <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(row => `<tr>${headers.map(h => `<td>${row[h] ?? ''}</td>`).join('')}</tr>`).join('')}
    </tbody></table>
    </body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 400);
  }

  const filteredReports = searchQuery
    ? reports.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.description?.toLowerCase().includes(searchQuery.toLowerCase()))
    : reports;

  const reportStats = {
    total: reports.length,
    favorites: reports.filter(r => r.is_favorite).length,
    scheduled: reports.filter(r => r.schedule).length,
    recentlyRun: reports.filter(r => r.last_run_at).length
  };

  // ── Integrations ───────────────────────────────────────────────────────────

  async function loadIntegrations() {
    setIntegrationsLoading(true);
    const { data } = await supabase.from('integrations_config').select('*').eq('created_by', currentUser?.id ?? '');
    if (data) {
      const map: Record<string, IntegrationConfig> = {};
      data.forEach((row: IntegrationConfig) => { map[row.integration_id] = row; });
      setIntegrationConfigs(map);
    }
    setIntegrationsLoading(false);
  }

  function openConnectModal(integrationId: string) {
    const existing = integrationConfigs[integrationId];
    setConnectFormData(existing?.config ?? {});
    setTestPassed(false);
    setTestPassedAt(null);
    setConnectModalId(integrationId);
  }

  async function handleTestConnection(integrationId: string) {
    setTestingIntegration(integrationId);
    await new Promise(r => setTimeout(r, 1000));
    const cfg = connectFormData;
    const isWebhookType = integrationId === 'slack' || integrationId === 'teams' || integrationId === 'custom_webhook';
    let ok = true;
    if (isWebhookType && cfg.webhook_url) {
      try { const u = new URL(cfg.webhook_url); ok = u.protocol === 'https:'; } catch { ok = false; }
    }
    if (ok) { toast.success(t('advanced.integrations.testOk')); setTestPassed(true); setTestPassedAt(Date.now()); }
    else { toast.error(t('advanced.integrations.testFail')); setTestPassed(false); setTestPassedAt(null); }
    setTestingIntegration(null);
  }

  async function handleSaveIntegration() {
    if (!connectModalId) return;
    const TEST_VALID_MS = 5 * 60 * 1000;
    const isTestValid = testPassed && testPassedAt && (Date.now() - testPassedAt < TEST_VALID_MS);
    if (!isTestValid) {
      toast.error("Please test the connection again. Connection tests expire after 5 minutes.");
      setTestPassed(false);
      setTestPassedAt(null);
      return;
    }
    const existing = integrationConfigs[connectModalId];
    if (existing?.id) {
      void supabase.from('integrations_config').update({ config: connectFormData, status: 'connected', last_tested_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      void supabase.from('integrations_config').insert([{
        integration_id: connectModalId,
        status: 'connected',
        config: connectFormData,
        last_tested_at: new Date().toISOString(),
        created_by: currentUser?.id
      }]);
    }
    setIntegrationConfigs(prev => ({
      ...prev,
      [connectModalId]: { ...(prev[connectModalId] ?? { integration_id: connectModalId, status: 'connected' }), config: connectFormData, status: 'connected', last_tested_at: new Date().toISOString() }
    }));
    const intgName = AVAILABLE_INTEGRATIONS.find(i => i.id === connectModalId)?.name ?? connectModalId;
    log({ event_type: 'integration_connected', action: 'connect', resource_type: 'integration', resource_id: connectModalId, metadata: { integration_name: intgName, integration_type: connectModalId } });
    toast.success(t('advanced.integrations.saved'));
    setConnectModalId(null);
  }

  async function handleDisconnect(integrationId: string) {
    const existing = integrationConfigs[integrationId];
    if (existing?.id) {
      void supabase.from('integrations_config').update({ status: 'disconnected' }).eq('id', existing.id);
    }
    setIntegrationConfigs(prev => ({ ...prev, [integrationId]: { ...prev[integrationId], status: 'disconnected' } }));
    log({ event_type: 'integration_disconnected', action: 'disconnect', resource_type: 'integration', resource_id: integrationId, metadata: { integration_id: integrationId } });
    toast.success(t('advanced.integrations.disconnected'));
  }

  async function handleSuspendIntegration(integrationId: string) {
    const existing = integrationConfigs[integrationId];
    if (existing?.id) {
      void supabase.from('integrations_config').update({ status: 'suspended' }).eq('id', existing.id);
    }
    setIntegrationConfigs(prev => ({ ...prev, [integrationId]: { ...prev[integrationId], status: 'suspended' } }));
    log({ event_type: 'integration_suspended', action: 'suspend', resource_type: 'integration', resource_id: integrationId, metadata: { integration_id: integrationId } });
    toast.success("Integration suspended.");
  }

  async function handleReactivateIntegration(integrationId: string) {
    const existing = integrationConfigs[integrationId];
    if (existing?.id) {
      void supabase.from('integrations_config').update({ status: 'connected' }).eq('id', existing.id);
    }
    setIntegrationConfigs(prev => ({ ...prev, [integrationId]: { ...prev[integrationId], status: 'connected' } }));
    log({ event_type: 'integration_reactivated', action: 'reactivate', resource_type: 'integration', resource_id: integrationId, metadata: { integration_id: integrationId } });
    toast.success("Integration reactivated.");
  }

  const connectingIntegration = connectModalId ? AVAILABLE_INTEGRATIONS.find(i => i.id === connectModalId) : null;

  // ── Monitoring ─────────────────────────────────────────────────────────────

  async function loadMonitoring() {
    setMetricsLoading(true);
    setCountdown(60);
    const { data: eventsData } = await supabase
      .from('monitoring_metrics')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(50);

    if (!eventsData || eventsData.length === 0) {
      // Seed example metrics display (no DB write, just show placeholder)
      const placeholder: MonitoringMetric[] = [
        { id: '1', metric_name: 'api_response_time', value: 78, unit: 'ms', status: 'healthy', timestamp: new Date().toISOString() },
        { id: '2', metric_name: 'error_rate', value: 0.2, unit: '%', status: 'healthy', timestamp: new Date().toISOString() },
        { id: '3', metric_name: 'active_users', value: 24, unit: '', status: 'healthy', timestamp: new Date().toISOString() }
      ];
      setMetrics(placeholder);
      setRecentEvents([]);
      setMetricHistory({});
    } else {
      // Deduplicate: latest per metric_name
      const seen = new Set<string>();
      const latest: MonitoringMetric[] = [];
      for (const row of eventsData as MonitoringMetric[]) {
        if (!seen.has(row.metric_name)) { seen.add(row.metric_name); latest.push(row); }
      }
      setMetrics(latest);
      setRecentEvents(eventsData as MonitoringMetric[]);

      // Fetch sparkline history (last 24 readings per metric)
      const METRIC_COUNT = latest.length || 1;
      const { data: history } = await supabase
        .from('monitoring_metrics')
        .select('metric_name, value, measured_at')
        .order('measured_at', { ascending: false })
        .limit(24 * METRIC_COUNT);
      if (history) {
        const grouped: Record<string, number[]> = {};
        for (const row of history as { metric_name: string; value: number }[]) {
          if (!grouped[row.metric_name]) grouped[row.metric_name] = [];
          if (grouped[row.metric_name].length < 24) grouped[row.metric_name].push(Number(row.value));
        }
        // Reverse so oldest first (left to right)
        for (const k of Object.keys(grouped)) grouped[k] = grouped[k].reverse();
        setMetricHistory(grouped);
      }
    }
    setMetricsLoading(false);
  }

  async function loadEventLog(integId: string, integName?: string) {
    const nameToQuery = integName ?? integId;
    const { data: events } = await supabase
      .from('integration_events')
      .select('*')
      .eq('integration_name', nameToQuery)
      .order('created_at', { ascending: false })
      .limit(50);
    setIntegrationEvents(events ?? []);
  }

  function SemiCircleGauge({ value, max, label, unit }: { value: number; max: number; label: string; unit: string }) {
    const pct = Math.min(value / max, 1);
    const angle = -180 + pct * 180;
    const r = 40;
    const cx = 50, cy = 50;
    const startX = cx - r, endX = cx + r;
    const rad = (angle * Math.PI) / 180;
    const needleX = cx + r * Math.cos(rad);
    const needleY = cy + r * Math.sin(rad);
    const arcColor = pct > 0.8 ? '#ef4444' : pct > 0.6 ? '#f59e0b' : '#22c55e';
    return (
      <svg viewBox="0 0 100 60" className="w-full">
        <path d={`M ${startX} ${cy} A ${r} ${r} 0 0 1 ${endX} ${cy}`} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <path d={`M ${startX} ${cy} A ${r} ${r} 0 0 1 ${needleX} ${needleY}`} fill="none" stroke={arcColor} strokeWidth="8" strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="#374151" strokeWidth="2" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="3" fill="#374151" />
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="12" fontWeight="bold" fill="currentColor">{value}{unit}</text>
        <text x={cx} y={cy + 20} textAnchor="middle" fontSize="7" fill="#6b7280">{label}</text>
      </svg>
    );
  }

  function Sparkline({ data }: { data: number[] }) {
    if (!data.length) return null;
    const max = Math.max(...data), min = Math.min(...data);
    const range = max - min || 1;
    const w = 80, h = 24;
    const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
    return <svg width={w} height={h} className="overflow-visible"><polyline points={points} fill="none" stroke="#6366f1" strokeWidth="1.5" /></svg>;
  }

  function SparkLine({ values, status }: { values: number[]; status?: string }) {
    if (values.length < 2) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const points = values.map((v, i) =>
      `${i * (60 / (values.length - 1))},${24 - ((v - min) / range) * 24}`
    ).join(' ');
    const color = status === 'critical' ? '#ef4444' : status === 'warning' ? '#f59e0b' : '#10b981';
    return (
      <svg width="60" height="24" className="ml-auto flex-shrink-0">
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
      </svg>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppLayout title="Advanced Features" icon={<Rocket className="h-6 w-6" />} onLogout={onLogout}>
      <div className="space-y-6">

        {/* Hero Section */}
        <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-none">
          <CardContent className="p-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold mb-2">Innovation Hub</h2>
                <p className="text-blue-100 text-lg mb-4">Advanced features to supercharge your productivity</p>
                <div className="flex gap-2">
                  <Badge className="bg-white/20 text-white border-white/30"><Sparkles className="h-3 w-3 mr-1" />25 Applications</Badge>
                  <Badge className="bg-white/20 text-white border-white/30"><Brain className="h-3 w-3 mr-1" />AI-Powered</Badge>
                  <Badge className="bg-white/20 text-white border-white/30"><Target className="h-3 w-3 mr-1" />Enterprise Ready</Badge>
                </div>
              </div>
              <Rocket className="h-32 w-32 opacity-20" />
            </div>
          </CardContent>
        </Card>

        {/* Feature Categories */}
        {(() => {
          const categoryTabMap: Record<string, string> = {
            reporting: 'reports',
            api: 'integrations',
            automation: 'automation',
            analytics: 'reports',
            search: 'smart-search',
            monitoring: 'monitoring'
          };
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURE_CATEGORIES.map((category, index) => {
                const Icon = category.icon;
                const targetTab = categoryTabMap[category.id] ?? 'reports';
                return (
                  <motion.div key={category.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                    <Card
                      className="hover:shadow-lg transition-all cursor-pointer group"
                      onClick={() => setActiveTab(targetTab)}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 ${category.color} rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                            <Icon className="h-6 w-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 mb-1">{category.name}</h3>
                            <p className="text-sm text-gray-600">{category.description}</p>
                            <Button variant="link" className="p-0 h-auto mt-2 text-blue-600 cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => { e.stopPropagation(); setActiveTab(targetTab); }}>Explore →</Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          );
        })()}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="reports"><FileText className="h-4 w-4 mr-2" />Reports</TabsTrigger>
            <TabsTrigger value="templates"><Layout className="h-4 w-4 mr-2" />Templates</TabsTrigger>
            <TabsTrigger value="integrations"><Package className="h-4 w-4 mr-2" />Integrations</TabsTrigger>
            <TabsTrigger value="monitoring"><Activity className="h-4 w-4 mr-2" />Monitoring</TabsTrigger>
            <TabsTrigger value="smart-search"><Search className="h-4 w-4 mr-2" />Smart Search</TabsTrigger>
            <TabsTrigger value="automation"><Zap className="h-4 w-4 mr-2" />Automation</TabsTrigger>
          </TabsList>

          {/* ── REPORTS TAB ───────────────────────────────────────────────── */}
          <TabsContent value="reports" className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: t('advanced.reports.total'), value: reportStats.total, icon: FileText, color: 'text-blue-600' },
                { label: t('advanced.reports.favorites'), value: reportStats.favorites, icon: Star, color: 'text-yellow-600' },
                { label: t('advanced.reports.scheduled'), value: reportStats.scheduled, icon: Clock, color: 'text-green-600' },
                { label: t('advanced.reports.recentlyRun'), value: reportStats.recentlyRun, icon: Activity, color: 'text-purple-600' }
              ].map(stat => {
                const Icon = stat.icon;
                return (
                  <Card key={stat.label}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">{stat.label}</p>
                          <p className="text-2xl font-bold">{stat.value}</p>
                        </div>
                        <Icon className={`h-8 w-8 ${stat.color}`} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t('advanced.reports.title')}</CardTitle>
                    <CardDescription>{t('advanced.reports.subtitle')}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <ReportDefectButton appName="Advanced Features" />
                    <Button onClick={() => setShowCreateDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />{t('advanced.reports.create')}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input placeholder={t('advanced.reports.search')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                </div>

                {reportsLoading && <div className="text-center py-8 text-gray-500">{t('common.loading')}</div>}

                <div className="grid grid-cols-1 gap-3">
                  {filteredReports.map((report, index) => (
                    <motion.div key={report.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}>
                      <Card className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center flex-wrap gap-2 mb-1">
                                <h4 className="font-semibold text-gray-900">{report.name}</h4>
                                <Badge variant="outline" className="capitalize">{report.type}</Badge>
                                {report.domain && <Badge variant="outline" className="text-xs uppercase">{report.domain}</Badge>}
                                {report.schedule && (
                                  <Badge className="bg-green-100 text-green-800">
                                    <Clock className="h-3 w-3 mr-1" />Scheduled
                                  </Badge>
                                )}
                              </div>
                              {report.description && <p className="text-sm text-gray-600 mb-1">{report.description}</p>}
                              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                {report.last_run_at && <span>Last run: {new Date(report.last_run_at).toLocaleString()}</span>}
                                {(() => {
                                  const runStatus = reportRunStatus[report.id];
                                  if (runStatus === 'success') return <span className="bg-emerald-100 text-emerald-700 text-xs px-1.5 py-0.5 rounded-full">Success</span>;
                                  if (runStatus === 'error') return <span className="bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded-full">Failed</span>;
                                  if (runStatus === 'running') return <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full animate-pulse">Running</span>;
                                  return <span className="bg-gray-100 text-gray-500 text-xs px-1.5 py-0.5 rounded-full">Never run</span>;
                                })()}
                                {report.run_count != null && report.run_count > 0 && <span>• {report.run_count} runs</span>}
                                {report.next_run_at && <span>• Next: {new Date(report.next_run_at).toLocaleString()}</span>}
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 flex-shrink-0">
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => handleToggleFavorite(report)} title="Toggle favorite">
                                  <Star className={`h-4 w-4 ${report.is_favorite ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                                </Button>
                                <Button size="sm" variant="ghost" disabled={runningReportId === report.id} onClick={() => handleRunReport(report)} title="Run report">
                                  {runningReportId === report.id
                                    ? <RefreshCw className="h-4 w-4 animate-spin" />
                                    : <Play className="h-4 w-4" />}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => { setScheduleReportId(report.id); setSelectedSchedule(report.schedule ?? 'daily_8am'); setScheduleRecipients(report.schedule_recipients ?? ''); }} title="Schedule">
                                  <Calendar className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleDeleteReport(report.id)} title="Delete">
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                              {reportResults[report.id] && reportResults[report.id].length > 0 && (
                                <div className="flex gap-1">
                                  <Button size="sm" variant="outline" onClick={() => { downloadCSV(reportResults[report.id], `${report.name}.csv`); log({ event_type: 'custom_report_exported', action: 'export', resource_type: 'report', resource_id: report.id, metadata: { report_name: report.name, format: 'csv' } }); }}>
                                    <Download className="h-3 w-3 mr-1" />{t('advanced.reports.downloadCsv')}
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => { downloadXLSX(reportResults[report.id], `${report.name.replace(/\s+/g, '_')}.xlsx`); log({ event_type: 'custom_report_exported', action: 'export', resource_type: 'report', resource_id: report.id, metadata: { report_name: report.name, format: 'xlsx' } }); }}>
                                    <Download className="h-3 w-3 mr-1" />XLSX
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => handleExportReportPDF(report, reportResults[report.id])} title="Download PDF">
                                    <Printer className="h-3 w-3 mr-1" />PDF
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Results preview */}
                          {reportResults[report.id] && (
                            <div className="mt-3 border rounded overflow-auto max-h-48">
                              {reportResults[report.id].length === 0 ? (
                                <p className="text-sm text-gray-500 p-3">{t('advanced.reports.noRows')}</p>
                              ) : (
                                <>
                                  <p className="text-xs text-gray-500 mb-1 px-2 pt-2">Showing {reportResults[report.id].length} row{reportResults[report.id].length !== 1 ? 's' : ''}</p>
                                  <table className="text-xs w-full">
                                    <thead className="sticky top-0 bg-gray-100 z-10">
                                      <tr>
                                        {Object.keys(reportResults[report.id][0]).slice(0, 6).map(col => (
                                          <th key={col} className="px-2 py-1 text-left font-medium text-gray-600 whitespace-nowrap">{col}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {reportResults[report.id].slice(0, 10).map((row, i) => (
                                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                          {Object.keys(reportResults[report.id][0]).slice(0, 6).map(col => (
                                            <td key={col} className="px-2 py-1 text-gray-700 max-w-[120px] truncate">{String(row[col] ?? '')}</td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                {!reportsLoading && filteredReports.length === 0 && (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('advanced.reports.empty')}</h3>
                    <p className="text-gray-600 mb-4">{t('advanced.reports.emptySubtitle')}</p>
                    <Button onClick={() => setShowCreateDialog(true)}><Plus className="h-4 w-4 mr-2" />{t('advanced.reports.create')}</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TEMPLATES TAB ─────────────────────────────────────────────── */}
          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('advanced.templates.title')}</CardTitle>
                <CardDescription>{t('advanced.templates.subtitle')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { id: 'hr_headcount', name: 'HR Headcount Report', domain: 'hr', description: 'Employee count by department and role', icon: Users },
                    { id: 'finance_invoices', name: 'Finance Invoice Summary', domain: 'finance', description: 'Monthly invoice totals and status breakdown', icon: DollarSign },
                    { id: 'it_tickets', name: 'IT Ticket Status', domain: 'it', description: 'Open and resolved IT tickets overview', icon: Shield },
                    { id: 'training_completion', name: 'Training Completion', domain: 'training', description: 'Training enrollment and completion rates', icon: Target }
                  ].map((tpl, index) => {
                    const Icon = tpl.icon;
                    return (
                      <motion.div key={tpl.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.1 }}>
                        <Card className="hover:shadow-lg transition-all cursor-pointer group">
                          <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                <Icon className="h-6 w-6 text-white" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-gray-900">{tpl.name}</h4>
                                  <Badge variant="outline" className="text-xs uppercase">{tpl.domain}</Badge>
                                </div>
                                <p className="text-sm text-gray-600 mb-3">{tpl.description}</p>
                                <Button size="sm" onClick={async () => {
                                  const { error } = await supabase.from('custom_reports').insert([{
                                    name: tpl.name,
                                    description: tpl.description,
                                    type: 'table',
                                    domain: tpl.domain,
                                    is_favorite: false,
                                    run_count: 0,
                                    created_by: currentUser?.id
                                  }]);
                                  if (!error) { toast.success(t('advanced.templates.created')); loadReports(); }
                                  else toast.error(t('advanced.reports.createError'));
                                }}>
                                  <Plus className="h-3 w-3 mr-1" />{t('advanced.templates.use')}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── INTEGRATIONS TAB ──────────────────────────────────────────── */}
          <TabsContent value="integrations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('advanced.integrations.title')}</CardTitle>
                <CardDescription>{t('advanced.integrations.subtitle')}</CardDescription>
              </CardHeader>
              <CardContent>
                {integrationsLoading && <div className="text-center py-8 text-gray-500">{t('common.loading')}</div>}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {AVAILABLE_INTEGRATIONS.map((integration, index) => {
                    const cfg = integrationConfigs[integration.id];
                    const status = cfg?.status ?? 'disconnected';
                    const Icon = integration.icon;
                    return (
                      <motion.div key={integration.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}>
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3 mb-3">
                              <div className={`w-10 h-10 ${integration.color} rounded-lg flex items-center justify-center`}>
                                <Icon className="h-5 w-5 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-sm">{integration.name}</h4>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full font-medium border ${statusColor(status)}`}
                                  title={status === 'suspended' ? "Integration suspended - contact administrator" : undefined}
                                >
                                  {status === 'suspended' ? 'Suspended' : status}
                                </span>
                              </div>
                            </div>
                            {cfg?.last_tested_at && (
                              <p className="text-xs text-gray-500 mb-2">
                                {t('advanced.integrations.lastTested')}: {new Date(cfg.last_tested_at).toLocaleString()}
                              </p>
                            )}
                            {cfg?.error_message && (
                              <p className="text-xs text-red-600 mb-2">{cfg.error_message}</p>
                            )}
                            <div className="flex gap-2 flex-wrap">
                              {status !== 'suspended' && (
                                <Button size="sm" variant="default" className="flex-1" onClick={() => openConnectModal(integration.id)}>
                                  {status === 'connected' ? t('advanced.integrations.configure') : t('advanced.integrations.connect')}
                                </Button>
                              )}
                              {status === 'connected' && (
                                <Button size="sm" variant="outline" onClick={() => setDisconnectConfirm(integration.id)}>
                                  {t('advanced.integrations.disconnect')}
                                </Button>
                              )}
                              {status === 'connected' && (currentUser as any)?.role === 'admin' && (
                                <Button size="sm" variant="outline" className="text-amber-600 border-amber-300 hover:bg-amber-50" onClick={() => handleSuspendIntegration(integration.id)}>
                                  Suspend
                                </Button>
                              )}
                              {status === 'suspended' && (
                                <Button size="sm" variant="outline" className="flex-1 text-green-700 border-green-300 hover:bg-green-50" onClick={() => handleReactivateIntegration(integration.id)}>
                                  Reactivate
                                </Button>
                              )}
                            </div>
                            {(status === 'connected' || status === 'suspended') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="w-full mt-1 text-xs text-gray-600"
                                onClick={() => { setEventLogIntegration(integration.id); void loadEventLog(integration.id, integration.name); }}
                              >
                                Event Log
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── SMART SEARCH TAB ──────────────────────────────────────────── */}
          <TabsContent value="smart-search" className="space-y-4">
            <div className="max-w-[720px] mx-auto space-y-4">
              {/* Search input */}
              <div className="relative shadow-lg rounded-lg">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={globalSearchQuery}
                  onChange={e => setGlobalSearchQuery(e.target.value)}
                  placeholder={t('advanced.search.placeholder')}
                  className="w-full h-14 pl-12 pr-16 rounded-lg border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <kbd className="absolute right-4 top-1/2 -translate-y-1/2 px-2 py-1 text-xs bg-gray-100 border border-gray-300 rounded text-gray-500 font-mono">⌘K</kbd>
              </div>

              {/* Scope pills */}
              <div className="flex flex-wrap gap-2">
                {AUTOMATION_SEARCH_SCOPES.map(scope => (
                  <button
                    key={scope}
                    onClick={() => setSearchScope(scope)}
                    className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                      searchScope === scope
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
                    }`}
                  >
                    {scope === 'all' ? t('advanced.search.scopeAll')
                      : scope === 'employees' ? t('advanced.search.scopeEmployees')
                      : scope === 'tasks' ? t('advanced.search.scopeTasks')
                      : scope === 'tickets' ? t('advanced.search.scopeTickets')
                      : scope === 'invoices' ? t('advanced.search.scopeInvoices')
                      : scope === 'courses' ? t('advanced.search.scopeCourses')
                      : scope === 'defects' ? 'Defects'
                      : scope === 'announcements' ? 'Announcements'
                      : scope === 'okrs' ? 'OKRs'
                      : scope === 'workflows' ? 'Workflows'
                      : scope === 'jobs' ? 'Jobs'
                      : t('advanced.search.scopeDocuments')}
                  </button>
                ))}
              </div>

              {/* Results area */}
              {searching && (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-indigo-500" />
                </div>
              )}

              {!searching && globalSearchQuery.length < 3 && (
                <div className="text-center py-12 text-gray-400">
                  <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>{t('advanced.search.typeToSearch')}</p>
                </div>
              )}

              {!searching && globalSearchQuery.length >= 3 && searchResults.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <p>{t('advanced.search.noResults')} &ldquo;{globalSearchQuery}&rdquo;</p>
                </div>
              )}

              {!searching && Object.entries(groupedResults).map(([type, items]) => (
                <div key={type} className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                    {entityTypeLabel[type] ?? type} ({items.length})
                  </h3>
                  <Card>
                    <CardContent className="p-0 divide-y">
                      {items.map(result => (
                        <button
                          key={result.id}
                          onClick={() => navigate(result.route)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors"
                        >
                          <span className="text-2xl flex-shrink-0">{result.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{result.title}</p>
                            <p className="text-sm text-gray-500 truncate">{result.preview}</p>
                          </div>
                          <Badge variant="outline" className="flex-shrink-0 capitalize text-xs">{entityTypeLabel[result.entity_type] ?? result.entity_type}</Badge>
                          <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── AUTOMATION STUDIO TAB ──────────────────────────────────────── */}
          <TabsContent value="automation">
            <div className="flex gap-0 border rounded-lg overflow-hidden min-h-[600px] bg-white">
              {/* Left panel */}
              <div className="w-[280px] border-r flex flex-col flex-shrink-0">
                <div className="p-4 border-b">
                  <h3 className="font-semibold text-gray-900 mb-3">{t('advanced.automation.title')}</h3>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder={t('advanced.automation.search')}
                      value={automationSearch}
                      onChange={e => setAutomationSearch(e.target.value)}
                      className="pl-9 text-sm"
                    />
                  </div>
                  <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm" onClick={() => openAutomationModal()}>
                    {t('advanced.automation.create')}
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto divide-y">
                  {filteredAutomations.map(automation => (
                    <div key={automation.id} className="p-3 hover:bg-gray-50 cursor-pointer">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">{automation.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{automation.trigger}</p>
                        </div>
                        <Badge className={`text-xs flex-shrink-0 ${automation.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {automation.enabled ? t('advanced.automation.statusActive') : t('advanced.automation.statusInactive')}
                        </Badge>
                      </div>
                      {automation.last_triggered_at && (
                        <p className="text-xs text-gray-400 mt-1">
                          Last: {new Date(automation.last_triggered_at).toLocaleDateString()}
                        </p>
                      )}
                      {!automation.last_triggered_at && (
                        <p className="text-xs text-gray-400 mt-1">Last: Never</p>
                      )}
                      <div className="flex gap-1 mt-1 flex-wrap">
                        <button onClick={() => openAutomationModal(undefined, automation)} className="text-xs text-gray-600 hover:underline">
                          Edit
                        </button>
                        <span className="text-gray-300">·</span>
                        <button onClick={() => handleToggleAutomation(automation.id)} className="text-xs text-indigo-600 hover:underline">
                          {automation.enabled ? t('advanced.automation.disable') : t('advanced.automation.enable')}
                        </button>
                        <span className="text-gray-300">·</span>
                        <button onClick={() => handleDeleteAutomation(automation.id)} className="text-xs text-red-500 hover:underline">
                          {t('advanced.automation.delete')}
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredAutomations.length === 0 && (
                    <div className="p-4 text-center text-sm text-gray-400">No automations yet</div>
                  )}
                </div>
              </div>

              {/* Right panel */}
              <div className="flex-1 bg-gray-50 p-8">
                {automations.length === 0 ? (
                  <div className="space-y-8">
                    {/* Empty state */}
                    <div className="text-center py-8">
                      <div className="text-6xl mb-4">⚡</div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('advanced.automation.emptyTitle')}</h3>
                      <p className="text-gray-500 mb-6">{t('advanced.automation.emptySubtitle')}</p>
                      <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => openAutomationModal()}>
                        {t('advanced.automation.create')}
                      </Button>
                    </div>

                    {/* Recipes */}
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-4">{t('advanced.automation.recipesTitle')}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {AUTOMATION_RECIPES.map(recipe => (
                          <Card key={recipe.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <h5 className="font-semibold text-sm text-gray-900 mb-2">{recipe.name}</h5>
                              <p className="text-xs text-gray-500 mb-1"><span className="font-medium">Trigger:</span> {recipe.trigger}</p>
                              <p className="text-xs text-gray-500 mb-3"><span className="font-medium">Actions:</span> {recipe.actionCount}</p>
                              <Button size="sm" variant="outline" className="w-full text-indigo-600 border-indigo-300 hover:bg-indigo-50" onClick={() => openAutomationModal(recipe)}>
                                {t('advanced.automation.useTemplate')}
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-4">{t('advanced.automation.recipesTitle')}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {AUTOMATION_RECIPES.map(recipe => (
                        <Card key={recipe.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <h5 className="font-semibold text-sm text-gray-900 mb-2">{recipe.name}</h5>
                            <p className="text-xs text-gray-500 mb-1"><span className="font-medium">Trigger:</span> {recipe.trigger}</p>
                            <p className="text-xs text-gray-500 mb-3"><span className="font-medium">Actions:</span> {recipe.actionCount}</p>
                            <Button size="sm" variant="outline" className="w-full text-indigo-600 border-indigo-300 hover:bg-indigo-50" onClick={() => openAutomationModal(recipe)}>
                              {t('advanced.automation.useTemplate')}
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── MONITORING TAB ────────────────────────────────────────────── */}
          <TabsContent value="monitoring" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{t('advanced.monitoring.title')}</h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">{t('advanced.monitoring.refreshIn')} {countdown}s</span>
                <Button size="sm" variant="outline" onClick={loadMonitoring} disabled={metricsLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${metricsLoading ? 'animate-spin' : ''}`} />
                  {t('advanced.monitoring.refreshNow')}
                </Button>
              </div>
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {metrics.map(metric => {
                const histValues = metricHistory[metric.metric_name] ?? [];
                const gaugeConf = GAUGE_METRICS[metric.metric_name];
                return (
                  <Card key={metric.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-gray-600 capitalize">{metric.metric_name.replace(/_/g, ' ')}</p>
                        <div className={`w-3 h-3 rounded-full ${metricStatusDot(metric.status)}`} title={metric.status} />
                      </div>
                      {gaugeConf ? (
                        <div>
                          <SemiCircleGauge
                            value={Number(metric.value)}
                            max={gaugeConf.max}
                            label={metric.metric_name.replace(/_/g, ' ')}
                            unit={metric.unit ?? gaugeConf.unit}
                          />
                          {histValues.length >= 2 && (
                            <div className="flex justify-center mt-1">
                              <Sparkline data={histValues} />
                            </div>
                          )}
                          <p className="text-xs text-gray-400 mt-1 text-center">{new Date(metric.timestamp).toLocaleString()}</p>
                        </div>
                      ) : (
                        <div className="flex items-end justify-between gap-2">
                          <div>
                            <p className="text-2xl font-bold text-gray-900">{metric.value}{metric.unit ? <span className="text-sm font-normal text-gray-500 ml-1">{metric.unit}</span> : null}</p>
                            <p className="text-xs text-gray-400 mt-1">{new Date(metric.timestamp).toLocaleString()}</p>
                          </div>
                          {histValues.length >= 2 && (
                            <div className="flex flex-col items-end gap-1">
                              <Sparkline data={histValues} />
                              <SparkLine values={histValues} status={metric.status} />
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {metrics.length === 0 && !metricsLoading && (
                <Card className="col-span-full">
                  <CardContent className="p-6 text-center text-gray-500">
                    <Activity className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                    <p>{t('advanced.monitoring.empty')}</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Recent events */}
            {recentEvents.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('advanced.monitoring.recentEvents')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-auto max-h-72">
                    <table className="w-full text-sm border-collapse">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium text-gray-600">Timestamp</th>
                          <th className="text-left px-4 py-2 font-medium text-gray-600">Metric</th>
                          <th className="text-left px-4 py-2 font-medium text-gray-600">Value</th>
                          <th className="text-left px-4 py-2 font-medium text-gray-600">Status</th>
                          <th className="text-left px-4 py-2 font-medium text-gray-600">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentEvents.map(evt => {
                          const badgeColor = evt.status === 'healthy' ? 'bg-green-100 text-green-800'
                            : evt.status === 'warning' ? 'bg-amber-100 text-amber-800'
                            : evt.status === 'critical' ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-600';
                          return (
                            <tr key={evt.id}>
                              <td className="px-4 py-2 border-t border-gray-100 text-gray-500 text-xs whitespace-nowrap">{new Date(evt.timestamp).toLocaleString()}</td>
                              <td className="px-4 py-2 border-t border-gray-100 text-gray-700 capitalize">{evt.metric_name.replace(/_/g, ' ')}</td>
                              <td className="px-4 py-2 border-t border-gray-100 text-gray-700">{evt.value}{evt.unit ? <span className="text-gray-400 ml-0.5">{evt.unit}</span> : null}</td>
                              <td className="px-4 py-2 border-t border-gray-100">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor}`}>{evt.status ?? 'unknown'}</span>
                              </td>
                              <td className="px-4 py-2 border-t border-gray-100">
                                <button
                                  className="text-xs text-blue-600 hover:underline"
                                  onClick={() => toast.info(JSON.stringify(redactPayload(evt as Record<string, unknown>), null, 2).slice(0, 300))}
                                >
                                  Details
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* ── INTEGRATION EVENT LOG MODAL ──────────────────────────────── */}
        {eventLogIntegration && (() => {
          const intg = AVAILABLE_INTEGRATIONS.find(i => i.id === eventLogIntegration);
          const cfg = integrationConfigs[eventLogIntegration];
          // Generate placeholder rows from last_sync data if no real events
          const placeholderEvents = integrationEvents.length === 0 ? [
            { id: 'ph-1', created_at: cfg?.last_tested_at ?? new Date().toISOString(), event_type: 'connection_test', status: 'success', message: 'Connection test passed' },
            { id: 'ph-2', created_at: cfg?.last_synced_at ?? new Date(Date.now() - 60000).toISOString(), event_type: 'sync', status: 'success', message: 'Last sync completed' },
          ] : [];
          const displayEvents = integrationEvents.length > 0 ? integrationEvents : placeholderEvents;
          return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col">
                <Card className="flex-1 flex flex-col overflow-hidden">
                  <CardHeader className="flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <CardTitle>Event Log — {intg?.name ?? eventLogIntegration}</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => { setEventLogIntegration(null); setIntegrationEvents([]); }}>✕</Button>
                    </div>
                    <CardDescription>
                      {integrationEvents.length > 0 ? `${integrationEvents.length} recent events` : 'No events recorded yet — showing placeholder data'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-auto flex-1">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Event Type</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {displayEvents.map((ev: any) => {
                          const badgeColor = ev.status === 'success' ? 'bg-emerald-100 text-emerald-700'
                            : ev.status === 'error' ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700';
                          return (
                            <tr key={ev.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{ev.created_at ? new Date(ev.created_at).toLocaleString() : '—'}</td>
                              <td className="px-3 py-2 text-xs text-gray-700">{ev.event_type ?? '—'}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor}`}>{ev.status ?? 'unknown'}</span>
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-600 max-w-xs truncate">{ev.message ?? '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          );
        })()}

        {/* ── CREATE REPORT DIALOG ──────────────────────────────────────── */}
        {showCreateDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <Card>
                <CardHeader>
                  <CardTitle>{t('advanced.reports.createTitle')}</CardTitle>
                  <CardDescription>{t('advanced.reports.createSubtitle')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>{t('advanced.reports.nameLabel')}</Label>
                    <Input placeholder={t('advanced.reports.namePlaceholder')} value={newReportName} onChange={(e) => setNewReportName(e.target.value)} />
                  </div>
                  <div>
                    <Label>{t('advanced.reports.descLabel')}</Label>
                    <Textarea placeholder={t('advanced.reports.descPlaceholder')} value={newReportDescription} onChange={(e) => setNewReportDescription(e.target.value)} />
                  </div>
                  <div>
                    <Label>{t('advanced.reports.typeLabel')}</Label>
                    <Select value={newReportType} onValueChange={(v: any) => setNewReportType(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="table">Table</SelectItem>
                        <SelectItem value="chart">Chart</SelectItem>
                        <SelectItem value="dashboard">Dashboard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('advanced.reports.domainLabel')}</Label>
                    <Select value={newReportDomain} onValueChange={setNewReportDomain}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hr">HR</SelectItem>
                        <SelectItem value="finance">Finance</SelectItem>
                        <SelectItem value="it">IT</SelectItem>
                        <SelectItem value="training">Training</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleCreateReport} className="flex-1">{t('advanced.reports.create')}</Button>
                    <Button onClick={() => setShowCreateDialog(false)} variant="outline" className="flex-1">{t('common.cancel')}</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {/* ── SCHEDULE DIALOG ───────────────────────────────────────────── */}
        {scheduleReportId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <Card>
                <CardHeader>
                  <CardTitle>{t('advanced.reports.scheduleTitle')}</CardTitle>
                  <CardDescription>{t('advanced.reports.scheduleSubtitle')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>{t('advanced.reports.scheduleLabel')}</Label>
                    <Select value={selectedSchedule} onValueChange={setSelectedSchedule}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SCHEDULE_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {selectedSchedule === 'custom' && (
                      <div className="mt-2">
                        <Label className="text-xs text-gray-500">Cron Expression</Label>
                        <Input
                          placeholder="0 9 * * 1"
                          value={customCronExpr}
                          onChange={(e) => setCustomCronExpr(e.target.value)}
                          className="mt-1 font-mono text-sm"
                        />
                        <p className="text-xs text-gray-400 mt-1">5 fields: minute hour day month weekday</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>{t('advanced.reports.recipientsLabel')}</Label>
                    <Input placeholder="email1@example.com, email2@example.com" value={scheduleRecipients} onChange={(e) => setScheduleRecipients(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveSchedule} className="flex-1">{t('advanced.reports.saveSchedule')}</Button>
                    {reports.find(r => r.id === scheduleReportId)?.schedule && (
                      <Button variant="outline" onClick={() => { handleRemoveSchedule(scheduleReportId); setScheduleReportId(null); }}>
                        {t('advanced.reports.removeSchedule')}
                      </Button>
                    )}
                    <Button onClick={() => setScheduleReportId(null)} variant="outline">{t('common.cancel')}</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {/* ── CREATE AUTOMATION MODAL ──────────────────────────────────── */}
        {showAutomationModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <Card>
                <CardHeader>
                  <CardTitle>{editingAutomation ? "Edit Automation" : t('advanced.automation.wizardTitle')}</CardTitle>
                  <CardDescription>
                    Step {automationWizardStep} of 3 —{' '}
                    {automationWizardStep === 1 ? t('advanced.automation.step1')
                      : automationWizardStep === 2 ? t('advanced.automation.step2')
                      : t('advanced.automation.step3')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {automationWizardStep === 1 && (
                    <div className="space-y-2">
                      {AUTOMATION_TRIGGERS.map(trigger => (
                        <label key={trigger.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${automationTrigger === trigger.label ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}>
                          <input
                            type="radio"
                            name="trigger"
                            value={trigger.label}
                            checked={automationTrigger === trigger.label}
                            onChange={() => setAutomationTrigger(trigger.label)}
                            className="accent-indigo-600"
                          />
                          <span className="text-sm font-medium text-gray-900">{trigger.label}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {automationWizardStep === 2 && (
                    <div className="space-y-2">
                      {AUTOMATION_ACTIONS.map(action => (
                        <label key={action.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${automationActions.includes(action.label) ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}>
                          <input
                            type="checkbox"
                            checked={automationActions.includes(action.label)}
                            onChange={e => {
                              if (e.target.checked) setAutomationActions(prev => [...prev, action.label]);
                              else setAutomationActions(prev => prev.filter(a => a !== action.label));
                            }}
                            className="accent-indigo-600"
                          />
                          <span className="text-sm font-medium text-gray-900">{action.label}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {automationWizardStep === 3 && (
                    <div className="space-y-4">
                      <div>
                        <Label>{t('advanced.automation.nameLabel')}</Label>
                        <Input
                          placeholder={t('advanced.automation.namePlaceholder')}
                          value={automationName}
                          onChange={e => setAutomationName(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
                        <span className="text-sm font-medium text-gray-900">{t('advanced.automation.enabledToggle')}</span>
                        <button
                          onClick={() => setAutomationEnabled(!automationEnabled)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${automationEnabled ? 'bg-indigo-600' : 'bg-gray-200'}`}
                        >
                          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${automationEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>

                      {/* Per-action parameter configuration */}
                      {automationActions.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-sm font-semibold text-gray-700">Configure Action Parameters</p>
                          {automationActions.map(actionLabel => {
                            const params = actionParams[actionLabel] ?? {};
                            const setParam = (key: string, val: string) =>
                              setActionParams(prev => ({ ...prev, [actionLabel]: { ...(prev[actionLabel] ?? {}), [key]: val } }));
                            return (
                              <div key={actionLabel} className="p-3 border border-gray-200 rounded-lg space-y-2">
                                <p className="text-sm font-medium text-gray-800">{actionLabel}</p>
                                {(actionLabel === 'Assign Task' || actionLabel === 'create_task') && (
                                  <>
                                    <div>
                                      <Label className="text-xs">Task Template</Label>
                                      <Select value={params.task_template ?? ''} onValueChange={v => setParam('task_template', v)}>
                                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select template" /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="onboarding">Onboarding Checklist</SelectItem>
                                          <SelectItem value="review">Review Task</SelectItem>
                                          <SelectItem value="follow_up">Follow-Up Task</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label className="text-xs">Assignee Role</Label>
                                      <Select value={params.assignee_role ?? ''} onValueChange={v => setParam('assignee_role', v)}>
                                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select role" /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="manager">Manager</SelectItem>
                                          <SelectItem value="hr">HR</SelectItem>
                                          <SelectItem value="it">IT</SelectItem>
                                          <SelectItem value="finance">Finance</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </>
                                )}
                                {(actionLabel === 'Send Email Notification' || actionLabel === 'send_email') && (
                                  <>
                                    <div>
                                      <Label className="text-xs">Email Template</Label>
                                      <Select value={params.email_template ?? ''} onValueChange={v => setParam('email_template', v)}>
                                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select template" /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="welcome_email">Welcome Email</SelectItem>
                                          <SelectItem value="reminder">Reminder</SelectItem>
                                          <SelectItem value="alert">Alert</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label className="text-xs">Subject</Label>
                                      <Input className="h-8 text-sm" placeholder="Email subject" value={params.subject ?? ''} onChange={e => setParam('subject', e.target.value)} />
                                    </div>
                                  </>
                                )}
                                {(actionLabel === 'Enroll in Training' || actionLabel === 'enroll_training') && (
                                  <div>
                                    <Label className="text-xs">Training Course</Label>
                                    <Select value={params.course_id ?? ''} onValueChange={v => setParam('course_id', v)}>
                                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select course" /></SelectTrigger>
                                      <SelectContent>
                                        {wizardCourses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                                {(actionLabel === 'Send Push Notification' || actionLabel === 'send_notification') && (
                                  <>
                                    <div>
                                      <Label className="text-xs">Message</Label>
                                      <Textarea className="text-sm min-h-[60px]" placeholder="Notification message" value={params.message ?? ''} onChange={e => setParam('message', e.target.value)} />
                                    </div>
                                    <div>
                                      <Label className="text-xs">Priority</Label>
                                      <Select value={params.priority ?? ''} onValueChange={v => setParam('priority', v)}>
                                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select priority" /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="low">Low</SelectItem>
                                          <SelectItem value="normal">Normal</SelectItem>
                                          <SelectItem value="high">High</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </>
                                )}
                                {actionLabel === 'update_field' && (
                                  <>
                                    <div>
                                      <Label className="text-xs">Field Name</Label>
                                      <Input className="h-8 text-sm" placeholder="Field name" value={params.field_name ?? ''} onChange={e => setParam('field_name', e.target.value)} />
                                    </div>
                                    <div>
                                      <Label className="text-xs">New Value</Label>
                                      <Input className="h-8 text-sm" placeholder="New value" value={params.new_value ?? ''} onChange={e => setParam('new_value', e.target.value)} />
                                    </div>
                                  </>
                                )}
                                {actionLabel === 'approve_request' && (
                                  <>
                                    <div>
                                      <Label className="text-xs">Approver Role</Label>
                                      <Select value={params.approver_role ?? ''} onValueChange={v => setParam('approver_role', v)}>
                                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select role" /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="manager">Manager</SelectItem>
                                          <SelectItem value="director">Director</SelectItem>
                                          <SelectItem value="hr">HR</SelectItem>
                                          <SelectItem value="finance">Finance</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label className="text-xs">Timeout (hours)</Label>
                                      <Input className="h-8 text-sm" type="number" placeholder="48" value={params.timeout_hours ?? ''} onChange={e => setParam('timeout_hours', e.target.value)} />
                                    </div>
                                  </>
                                )}
                                {(actionLabel === 'trigger_workflow' || actionLabel === 'Call Webhook') && actionLabel === 'trigger_workflow' && (
                                  <div>
                                    <Label className="text-xs">Workflow</Label>
                                    <Select value={params.workflow_id ?? ''} onValueChange={v => setParam('workflow_id', v)}>
                                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select workflow" /></SelectTrigger>
                                      <SelectContent>
                                        {wizardWorkflows.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="text-sm text-gray-600 space-y-1 p-3 bg-gray-50 rounded-lg">
                        <p><span className="font-medium">Trigger:</span> {automationTrigger}</p>
                        <p><span className="font-medium">Actions ({automationActions.length}):</span> {automationActions.join(', ') || '—'}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    {automationWizardStep > 1 && (
                      <Button variant="outline" onClick={() => setAutomationWizardStep(s => s - 1)}>{t('common.back')}</Button>
                    )}
                    {automationWizardStep < 3 && (
                      <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setAutomationWizardStep(s => s + 1)}>{t('common.next')}</Button>
                    )}
                    {automationWizardStep === 3 && (
                      <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleSaveAutomation}>{editingAutomation ? "Update Automation" : "Save Automation"}</Button>
                    )}
                    <Button variant="outline" onClick={() => { setShowAutomationModal(false); setEditingAutomation(null); }}>{t('common.cancel')}</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {/* ── DISCONNECT CONFIRMATION MODAL ────────────────────────────── */}
        {disconnectConfirm && (() => {
          const intg = AVAILABLE_INTEGRATIONS.find(i => i.id === disconnectConfirm);
          return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-lg shadow-xl max-w-sm w-full">
                <Card>
                  <CardHeader>
                    <CardTitle>Disconnect {intg?.name ?? disconnectConfirm}?</CardTitle>
                    <CardDescription>This will mark the integration as disconnected. You can reconnect at any time.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => { handleDisconnect(disconnectConfirm); setDisconnectConfirm(null); }}
                      >
                        {t('advanced.integrations.disconnect')}
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => setDisconnectConfirm(null)}>
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          );
        })()}

        {/* ── INTEGRATION CONNECT MODAL ─────────────────────────────────── */}
        {connectModalId && connectingIntegration && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <Card>
                <CardHeader>
                  <CardTitle>{t('advanced.integrations.connectTitle')} {connectingIntegration.name}</CardTitle>
                  <CardDescription>{t('advanced.integrations.connectSubtitle')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {connectingIntegration.fields.map(field => (
                    <div key={field}>
                      <Label className="capitalize">{field.replace(/_/g, ' ')}</Label>
                      <Input
                        type={field.toLowerCase().includes('password') || field.toLowerCase().includes('secret') || field.toLowerCase().includes('key') ? 'password' : 'text'}
                        placeholder={field.replace(/_/g, ' ')}
                        value={connectFormData[field] ?? ''}
                        onChange={(e) => { setTestPassed(false); setConnectFormData(prev => ({ ...prev, [field]: e.target.value })); }}
                      />
                    </div>
                  ))}
                  {testPassed && testPassedAt && (
                    <div>
                      <p className="text-sm text-green-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" /> Connection tested
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        ✓ Tested · Expires in {Math.max(0, Math.ceil((5 * 60 * 1000 - (Date.now() - testPassedAt)) / 60000))} min
                      </p>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleSaveIntegration}
                      className={`flex-1 ${!testPassed ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={!testPassed}
                      title={!testPassed ? 'Run a connection test first' : undefined}
                    >
                      {t('advanced.integrations.saveConnect')}
                    </Button>
                    <Button variant="outline" disabled={testingIntegration === connectModalId} onClick={() => handleTestConnection(connectModalId)}>
                      {testingIntegration === connectModalId ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : null}
                      {t('advanced.integrations.testConnection')}
                    </Button>
                    <Button variant="outline" onClick={() => setConnectModalId(null)}>{t('common.cancel')}</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}

export default AdvancedFeaturesDashboard;
