import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { API_BASE, apiHeaders, safeJson, supabase } from '../utils/constants';
import { t } from '../../i18n/index';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DefectSeverity = 'Very High' | 'High' | 'Medium' | 'Low';
export type DefectPriority = 'P1' | 'P2' | 'P3' | 'P4';
export type DefectStatus = 'Open' | 'In Progress' | 'Blocked' | 'Fixed' | 'Verified' | 'Closed' | 'Deferred' | "Won't Fix" | 'Duplicate';
export type SLAStatus = 'on_track' | 'at_risk' | 'fix_breached' | 'verify_breached' | 'all_met';

export interface DefectComment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  fieldChanged: string;
  oldValue: string;
  newValue: string;
  comment: string;
  occurredAt: string;
}

export interface LinkedItem {
  id: string;
  itemType: 'it_ticket' | 'backlog_item' | 'related_defect';
  itemRef: string;
  itemTitle: string;
  itemStatus: string;
}

export interface Defect {
  id: string;
  defectId: string;
  projectId: string;
  projectName: string;
  title: string;
  severity: DefectSeverity;
  priority: DefectPriority;
  status: DefectStatus;
  description: string;
  stepsToReproduce: string[];
  expectedResult: string;
  actualResult: string;
  environment: string;
  buildVersion: string;
  foundInVersion: string;
  fixVersion: string;
  fixedInVersion: string;
  sprintId: string;
  sprintName: string;
  assigneeId: string;
  assigneeName: string;
  reporterId: string;
  reporterName: string;
  labels: string[];
  isRegression: boolean;
  isDuplicate: boolean;
  duplicateOfId: string;
  rootCause: string;
  resolutionCode: string;
  rejectionReason: string;
  fixDescription: string;
  fixedBy: string;
  fixedDate: string | null;
  verifiedBy: string;
  verifiedDate: string | null;
  testEvidence: string;
  watchers: string[];
  slaPaused: boolean;
  firstResponseAt: string | null;
  introducedInSprint: string;
  os: string;
  browser: string;
  duplicateCount: number;
  reopenCount: number;
  createdAt: string;
  updatedAt: string;
  ageInDays: number;
  // SLA computed
  slaStatus: SLAStatus;
  slaFixRemainingMins: number | null;
  slaVerifyRemainingMins: number | null;
  slaFixDueAt: string | null;
  slaVerifyDueAt: string | null;
  slaFirstResponseMet: boolean;
  slaFixBreached: boolean;
  slaVerifyBreached: boolean;
  slaPolicyName: string;
  // Detail only
  comments?: DefectComment[];
  activityLog?: ActivityEntry[];
  linkedItems?: LinkedItem[];
}

export interface DashboardData {
  totalOpen: number;
  s1Count: number;
  slaBreached: number;
  fixedToday: number;
  pendingVerify: number;
  s1Defects: Defect[];
  recentActivity: any[];
  severityBreakdown: { severity: string; count: number }[];
  projectBreakdown: { name: string; S1: number; S2: number; S3: number; S4: number }[];
  slaCompliance: { severity: string; firstResponse: number; fix: number; verify: number }[];
  trendData: { date: string; opened: number; closed: number }[];
}

export interface SLAData {
  bySeverity: {
    severity: string; open: number; total: number;
    firstResponse: number; fix: number; verify: number;
    avgFixTime: string; breached: number;
  }[];
  atRisk: Defect[];
  breached: Defect[];
  byProject: { projectName: string; total: number; breached: number; compliance: number; s1: number; s2: number }[];
}

export interface AnalyticsData {
  rootCause: { name: string; value: number }[];
  regressionRate: number;
  aging: { bucket: string; count: number }[];
  avgFixTime: { severity: string; avgHours: number; slaTarget: number }[];
  topReporters: { name: string; count: number }[];
  topAssignees: { name: string; resolved: number; avgFixTime: number }[];
  velocity: { sprint: string; opened: number; closed: number }[];
}

export interface ByProjectRow {
  projectId: string;
  projectName: string;
  s1: number; s2: number; s3: number; s4: number;
  total: number; resolved: number;
  resolvedPct: number;
  slaCompliance: number;
  criticalDefects: Defect[];
}

export interface DefectFilters {
  projectId?: string;
  severity?: string;
  status?: string;
  assigneeId?: string;
  regression?: string;
  slaStatus?: string;
  environment?: string;
  sprintId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ── SLA computation (mirrors server-side logic) ────────────────────────────────

function computeSLA(defect: any, policies: any[]) {
  const policy = policies.find((p: any) => p.severity === defect.severity);
  if (!policy) return {
    slaStatus: 'on_track' as const, slaFixRemainingMins: null, slaVerifyRemainingMins: null,
    slaFixDueAt: null, slaVerifyDueAt: null, slaFirstResponseMet: false,
    slaFixBreached: false, slaVerifyBreached: false, slaPolicyName: '',
  };
  const createdAt = new Date(defect.created_at ?? defect.createdAt).getTime();
  const now = Date.now();
  const fixDueAt = new Date(createdAt + policy.fix_mins * 60000);
  const verifyDueAt = (defect.fixed_date ?? defect.fixedDate)
    ? new Date(new Date(defect.fixed_date ?? defect.fixedDate).getTime() + policy.verification_mins * 60000)
    : null;
  const fixRemainingMins = Math.round((fixDueAt.getTime() - now) / 60000);
  const verifyRemainingMins = verifyDueAt ? Math.round((verifyDueAt.getTime() - now) / 60000) : null;
  const status = defect.status;
  const slaFixBreached = !['Fixed','Verified','Closed'].includes(status) && fixRemainingMins < 0;
  const slaVerifyBreached = verifyDueAt !== null && verifyRemainingMins !== null && verifyRemainingMins < 0 && !['Verified','Closed'].includes(status);
  const slaFirstResponseMet = !!(defect.first_response_at ?? defect.firstResponseAt);
  let slaStatus: SLAStatus;
  if (slaFixBreached) slaStatus = 'fix_breached';
  else if (slaVerifyBreached) slaStatus = 'verify_breached';
  else if (['Fixed','Verified','Closed'].includes(status)) slaStatus = 'all_met';
  else if (fixRemainingMins < 120) slaStatus = 'at_risk';
  else slaStatus = 'on_track';
  return {
    slaStatus, slaFixRemainingMins: fixRemainingMins, slaVerifyRemainingMins: verifyRemainingMins,
    slaFixDueAt: fixDueAt.toISOString(), slaVerifyDueAt: verifyDueAt?.toISOString() ?? null,
    slaFirstResponseMet, slaFixBreached, slaVerifyBreached, slaPolicyName: policy.name ?? '',
  };
}

// ── DB helpers ────────────────────────────────────────────────────────────────

function normalizeRow(d: any, sla?: ReturnType<typeof computeSLA>): Defect {
  return {
    id: d.id,
    defectId: d.defect_id ?? '',
    projectId: d.project_id ?? '',
    projectName: d.project_name ?? '',
    title: d.title ?? '',
    severity: d.severity ?? 'Medium',
    priority: PRIORITY_FROM_DB[d.priority] ?? d.priority ?? 'P3',
    status: d.status ?? 'Open',
    description: d.description ?? '',
    stepsToReproduce: d.steps_to_reproduce ?? [],
    expectedResult: d.expected_result ?? '',
    actualResult: d.actual_result ?? '',
    environment: d.environment ?? '',
    buildVersion: d.build_version ?? '',
    foundInVersion: d.found_in_version ?? '',
    fixVersion: d.fix_version ?? '',
    fixedInVersion: d.fixed_in_version ?? '',
    sprintId: d.sprint_id ?? '',
    sprintName: d.sprint_name ?? '',
    assigneeId: d.assignee_id ?? '',
    assigneeName: d.assignee_name ?? '',
    reporterId: d.reporter_id ?? '',
    reporterName: d.reporter_name ?? '',
    labels: d.labels ?? [],
    isRegression: d.is_regression ?? false,
    isDuplicate: d.is_duplicate ?? false,
    duplicateOfId: d.duplicate_of_id ?? '',
    rootCause: d.root_cause ?? '',
    resolutionCode: d.resolution_code ?? '',
    rejectionReason: d.rejection_reason ?? '',
    fixDescription: d.fix_description ?? '',
    fixedBy: d.fixed_by ?? '',
    fixedDate: d.fixed_date ?? null,
    verifiedBy: d.verified_by ?? '',
    verifiedDate: d.verified_date ?? null,
    testEvidence: d.test_evidence ?? '',
    watchers: d.watchers ?? [],
    slaPaused: d.sla_paused ?? false,
    firstResponseAt: d.first_response_at ?? null,
    introducedInSprint: d.introduced_in_sprint ?? '',
    os: d.os ?? '',
    browser: d.browser ?? '',
    duplicateCount: d.duplicate_count ?? 0,
    reopenCount: d.reopen_count ?? 0,
    createdAt: d.created_at ?? '',
    updatedAt: d.updated_at ?? '',
    ageInDays: d.created_at ? Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000) : 0,
    slaStatus: sla?.slaStatus ?? 'on_track',
    slaFixRemainingMins: sla?.slaFixRemainingMins ?? null,
    slaVerifyRemainingMins: sla?.slaVerifyRemainingMins ?? null,
    slaFixDueAt: sla?.slaFixDueAt ?? null,
    slaVerifyDueAt: sla?.slaVerifyDueAt ?? null,
    slaFirstResponseMet: sla?.slaFirstResponseMet ?? false,
    slaFixBreached: sla?.slaFixBreached ?? false,
    slaVerifyBreached: sla?.slaVerifyBreached ?? false,
    slaPolicyName: sla?.slaPolicyName ?? '',
  };
}

const ENV_MAP: Record<string, string> = {
  'production': 'production', 'Production': 'production',
  'staging': 'staging', 'Staging': 'staging',
  'uat': 'uat', 'UAT': 'uat',
  'dev': 'dev', 'Development': 'dev', 'development': 'dev',
  'QA': 'uat', 'qa': 'uat',
  'Performance': 'production', 'performance': 'production',
  'DR': 'production', 'dr': 'production',
};
// DB stores legacy values ('Critical','High','Medium','Low') due to old constraint.
// Map UI P-codes → DB legacy values for writes.
const PRIORITY_TO_DB: Record<string, string> = {
  'P1': 'Critical', 'P2': 'High', 'P3': 'Medium', 'P4': 'Low',
  'Critical': 'Critical', 'High': 'High', 'Medium': 'Medium', 'Low': 'Low',
};
// Map DB legacy values → UI P-codes for reads.
const PRIORITY_FROM_DB: Record<string, DefectPriority> = {
  'Critical': 'P1', 'High': 'P2', 'Medium': 'P3', 'Low': 'P4',
  'P1': 'P1', 'P2': 'P2', 'P3': 'P3', 'P4': 'P4',
};

function toDbBody(body: Partial<Defect> & Record<string, any>) {
  const map: Record<string, string> = {
    projectId: 'project_id', projectName: 'project_name', defectId: 'defect_id',
    stepsToReproduce: 'steps_to_reproduce', expectedResult: 'expected_result',
    actualResult: 'actual_result', buildVersion: 'build_version',
    foundInVersion: 'found_in_version', fixVersion: 'fix_version',
    fixedInVersion: 'fixed_in_version', sprintId: 'sprint_id', sprintName: 'sprint_name',
    assigneeId: 'assignee_id', assigneeName: 'assignee_name',
    reporterId: 'reporter_id', reporterName: 'reporter_name',
    isRegression: 'is_regression', isDuplicate: 'is_duplicate',
    duplicateOfId: 'duplicate_of_id', rootCause: 'root_cause',
    resolutionCode: 'resolution_code', rejectionReason: 'rejection_reason',
    fixDescription: 'fix_description', fixedBy: 'fixed_by', fixedDate: 'fixed_date',
    verifiedBy: 'verified_by', verifiedDate: 'verified_date', testEvidence: 'test_evidence',
    slaPaused: 'sla_paused', firstResponseAt: 'first_response_at',
    introducedInSprint: 'introduced_in_sprint', duplicateCount: 'duplicate_count',
    reopenCount: 'reopen_count', createdBy: 'created_by', updatedBy: 'updated_by',
  };
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(body)) {
    const dbKey = map[k] ?? k;
    if (!['id','createdAt','updatedAt','ageInDays','slaStatus','slaFixRemainingMins',
          'slaVerifyRemainingMins','slaFixDueAt','slaVerifyDueAt','slaFirstResponseMet',
          'slaFixBreached','slaVerifyBreached','slaPolicyName','comments','activityLog','linkedItems'].includes(k)) {
      if (dbKey === 'environment' && typeof v === 'string') result[dbKey] = ENV_MAP[v] ?? v.toLowerCase();
      else if (dbKey === 'priority' && typeof v === 'string') result[dbKey] = PRIORITY_TO_DB[v] ?? v;
      else result[dbKey] = v;
    }
  }
  return result;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDefectTrackerData() {
  const [defects, setDefects] = useState<Defect[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [slaData, setSLAData] = useState<SLAData | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [byProjectData, setByProjectData] = useState<ByProjectRow[]>([]);
  const [selectedDefect, setSelectedDefect] = useState<Defect | null>(null);
  const [masterData, setMasterData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildQuery = (filters: DefectFilters) => {
    const params = new URLSearchParams();
    if (filters.projectId) params.set('projectId', filters.projectId);
    if (filters.severity) params.set('severity', filters.severity);
    if (filters.status) params.set('status', filters.status);
    if (filters.assigneeId) params.set('assigneeId', filters.assigneeId);
    if (filters.regression) params.set('regression', filters.regression);
    if (filters.slaStatus) params.set('slaStatus', filters.slaStatus);
    if (filters.environment) params.set('environment', filters.environment);
    if (filters.sprintId) params.set('sprintId', filters.sprintId);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    return params.toString();
  };

  const loadDefects = useCallback(async (filters: DefectFilters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: rows, error: dbErr }, { data: policies }] = await Promise.all([
        (() => {
          let query = supabase.from('project_defects').select('*').order('created_at', { ascending: false });
          if (filters.projectId) query = query.eq('project_id', filters.projectId);
          if (filters.severity) query = query.in('severity', filters.severity.split(','));
          if (filters.status) query = query.in('status', filters.status.split(','));
          if (filters.assigneeId) query = query.eq('assignee_id', filters.assigneeId);
          if (filters.regression === 'true') query = query.eq('is_regression', true);
          if (filters.regression === 'false') query = query.eq('is_regression', false);
          if (filters.environment) query = query.eq('environment', filters.environment);
          if (filters.sprintId) query = query.eq('sprint_id', filters.sprintId);
          if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
          if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
          return query;
        })(),
        supabase.from('defect_sla_policies').select('*'),
      ]);
      if (dbErr) setError(dbErr.message);
      else {
        let result = (rows ?? []).map(d => normalizeRow(d, computeSLA(d, policies ?? [])));
        if (filters.slaStatus) {
          if (filters.slaStatus === 'breached') result = result.filter(d => d.slaFixBreached || d.slaVerifyBreached);
          else if (filters.slaStatus === 'at_risk') result = result.filter(d => d.slaStatus === 'at_risk');
          else if (filters.slaStatus === 'on_track') result = result.filter(d => d.slaStatus === 'on_track');
        }
        setDefects(result);
      }
    } catch {
      setError('Network error loading defects');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: all }, { data: policies }, { data: actData }, { data: trendD }] = await Promise.all([
        supabase.from('project_defects').select('*'),
        supabase.from('defect_sla_policies').select('*'),
        supabase.from('defect_activity_log').select('*,project_defects(defect_id,title,project_name)').order('occurred_at', { ascending: false }).limit(10),
        supabase.from('project_defects').select('created_at,status,fixed_date').gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
      ]);
      const withSLA = (all ?? []).map(d => ({ ...d, ...computeSLA(d, policies ?? []) }));
      const open = withSLA.filter(d => !['Closed','Verified'].includes(d.status));
      const s1 = withSLA.filter(d => d.severity === 'Very High');
      const breached = withSLA.filter(d => d.slaFixBreached || d.slaVerifyBreached);
      const todayStr = new Date().toISOString().slice(0, 10);
      const fixedToday = withSLA.filter(d => d.status === 'Fixed' && d.fixed_date?.startsWith(todayStr)).length;
      const pendingVerify = withSLA.filter(d => d.status === 'Fixed').length;
      const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const openLastWeek = (all ?? []).filter(d => !['Closed','Verified'].includes(d.status) && d.created_at <= oneWeekAgo).length;
      const severityBreakdown = ['Very High','High','Medium','Low'].map(sev => ({ severity: sev, count: open.filter(d => d.severity === sev).length }));
      const projectMap: Record<string, Record<string, number>> = {};
      for (const d of open) {
        const pn = d.project_name || d.project_id || 'Unknown';
        if (!projectMap[pn]) projectMap[pn] = { 'Very High': 0, 'High': 0, 'Medium': 0, 'Low': 0 };
        projectMap[pn][d.severity] = (projectMap[pn][d.severity] ?? 0) + 1;
      }
      const projectBreakdown = Object.entries(projectMap).map(([name, c]) => ({ name, ...c }));
      const slaCompliance = ['Very High','High','Medium','Low'].map(sev => {
        const sd = withSLA.filter(d => d.severity === sev);
        const total = sd.length;
        return {
          severity: sev,
          firstResponse: total ? Math.round(sd.filter(d => d.slaFirstResponseMet).length / total * 100) : 100,
          fix: total ? Math.round(sd.filter(d => !d.slaFixBreached).length / total * 100) : 100,
          verify: total ? Math.round(sd.filter(d => !d.slaVerifyBreached).length / total * 100) : 100,
        };
      });
      const recentActivity = (actData ?? []).map((a: any) => ({
        id: a.id, actorName: a.actor_name, action: a.action,
        defectId: a.project_defects?.defect_id ?? '', defectTitle: a.project_defects?.title ?? '',
        projectName: a.project_defects?.project_name ?? '', occurredAt: a.occurred_at,
      }));
      const trendDays: Record<string, { opened: number; closed: number }> = {};
      for (let i = 29; i >= 0; i--) {
        const key = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        trendDays[key] = { opened: 0, closed: 0 };
      }
      for (const d of trendD ?? []) {
        const k = d.created_at?.slice(0, 10);
        if (k && trendDays[k]) trendDays[k].opened++;
        if (d.fixed_date) { const fk = d.fixed_date.slice(0, 10); if (trendDays[fk]) trendDays[fk].closed++; }
      }
      const s1Defects = s1.map(d => normalizeRow(d, computeSLA(d, policies ?? []))).slice(0, 10);
      setDashboard({
        totalOpen: open.length, openDelta: open.length - openLastWeek, s1Count: s1.length,
        slaBreached: breached.length, fixedToday, pendingVerify, s1Defects,
        recentActivity, severityBreakdown, projectBreakdown, slaCompliance,
        trendData: Object.entries(trendDays).map(([date, v]) => ({ date, ...v })),
      } as any);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  const loadSLAData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: all }, { data: policies }] = await Promise.all([
        supabase.from('project_defects').select('*'),
        supabase.from('defect_sla_policies').select('*'),
      ]);
      const withSLA = (all ?? []).map(d => normalizeRow(d, computeSLA(d, policies ?? [])));
      const bySeverity = ['Very High','High','Medium','Low'].map(sev => {
        const sd = withSLA.filter(d => d.severity === sev);
        const total = sd.length;
        const open = sd.filter(d => !['Closed','Verified'].includes(d.status)).length;
        const fixTimes = sd.filter(d => d.fixedDate).map(d => (new Date(d.fixedDate!).getTime() - new Date(d.createdAt).getTime()) / 3600000);
        return {
          severity: sev, open, total,
          firstResponse: total ? Math.round(sd.filter(d => d.slaFirstResponseMet).length / total * 100) : 100,
          fix: total ? Math.round(sd.filter(d => !d.slaFixBreached).length / total * 100) : 100,
          verify: total ? Math.round(sd.filter(d => !d.slaVerifyBreached).length / total * 100) : 100,
          avgFixTime: fixTimes.length ? (fixTimes.reduce((a, b) => a + b, 0) / fixTimes.length).toFixed(1) : 'N/A',
          breached: sd.filter(d => d.slaFixBreached || d.slaVerifyBreached).length,
        };
      });
      const twoHours = 2 * 60;
      const atRisk = withSLA.filter(d => !['Closed','Verified','Fixed'].includes(d.status) && d.slaFixRemainingMins !== null && d.slaFixRemainingMins > 0 && d.slaFixRemainingMins < twoHours).sort((a, b) => (a.slaFixRemainingMins ?? 999) - (b.slaFixRemainingMins ?? 999));
      const breachedList = withSLA.filter(d => d.slaFixBreached || d.slaVerifyBreached);
      const projMap: Record<string, any> = {};
      for (const d of withSLA) {
        const pn = d.projectName || 'Unknown';
        if (!projMap[pn]) projMap[pn] = { projectName: pn, total: 0, breached: 0, s1: 0, s2: 0 };
        projMap[pn].total++;
        if (d.slaFixBreached || d.slaVerifyBreached) projMap[pn].breached++;
        if (d.severity === 'Very High') projMap[pn].s1++;
        if (d.severity === 'High') projMap[pn].s2++;
      }
      const byProject = Object.values(projMap).map((p: any) => ({ ...p, compliance: p.total ? Math.round((p.total - p.breached) / p.total * 100) : 100 }));
      setSLAData({ bySeverity, atRisk, breached: breachedList, byProject });
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async (filters: Partial<DefectFilters> = {}) => {
    setLoading(true);
    try {
      let query = supabase.from('project_defects').select('*');
      if (filters.projectId) query = query.eq('project_id', filters.projectId);
      if (filters.severity) query = query.in('severity', filters.severity.split(','));
      if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
      if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
      const { data: all } = await query;
      const defects = all ?? [];
      const rootCauseMap: Record<string, number> = {};
      for (const d of defects) { const rc = d.root_cause || 'Unknown'; rootCauseMap[rc] = (rootCauseMap[rc] ?? 0) + 1; }
      const rootCause = Object.entries(rootCauseMap).map(([name, value]) => ({ name, value }));
      const regressionRate = defects.length ? Math.round(defects.filter((d: any) => d.is_regression).length / defects.length * 100) : 0;
      const aging = [{ bucket: '<1d', count: 0 }, { bucket: '1-3d', count: 0 }, { bucket: '3-7d', count: 0 }, { bucket: '7-14d', count: 0 }, { bucket: '>14d', count: 0 }];
      for (const d of defects) {
        const age = Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000);
        if (age < 1) aging[0].count++;
        else if (age < 3) aging[1].count++;
        else if (age < 7) aging[2].count++;
        else if (age < 14) aging[3].count++;
        else aging[4].count++;
      }
      const sevFixMins: Record<string, number> = { 'Very High': 480, 'High': 1440, 'Medium': 4320, 'Low': 10080 };
      const avgFixTime = ['Very High','High','Medium','Low'].map(sev => {
        const sf = defects.filter((d: any) => d.severity === sev && d.fixed_date);
        const times = sf.map((d: any) => (new Date(d.fixed_date).getTime() - new Date(d.created_at).getTime()) / 3600000);
        return { severity: sev, avgHours: times.length ? Math.round(times.reduce((a: number, b: number) => a + b, 0) / times.length * 10) / 10 : 0, slaTarget: (sevFixMins[sev] ?? 480) / 60 };
      });
      const reporterMap: Record<string, number> = {};
      for (const d of defects) { const r = d.reporter_name || 'Unknown'; reporterMap[r] = (reporterMap[r] ?? 0) + 1; }
      const topReporters = Object.entries(reporterMap).sort(([,a],[,b]) => b - a).slice(0, 10).map(([name, count]) => ({ name, count }));
      const assigneeMap: Record<string, { resolved: number; totalFix: number }> = {};
      for (const d of defects) {
        const a = d.assignee_name || 'Unassigned';
        if (!assigneeMap[a]) assigneeMap[a] = { resolved: 0, totalFix: 0 };
        if (['Fixed','Verified','Closed'].includes(d.status)) assigneeMap[a].resolved++;
        if (d.fixed_date) assigneeMap[a].totalFix += (new Date(d.fixed_date).getTime() - new Date(d.created_at).getTime()) / 3600000;
      }
      const topAssignees = Object.entries(assigneeMap).sort(([,a],[,b]) => b.resolved - a.resolved).slice(0, 10).map(([name, v]) => ({ name, resolved: v.resolved, avgFixTime: v.resolved ? Math.round(v.totalFix / v.resolved * 10) / 10 : 0 }));
      const sprintMap: Record<string, { opened: number; closed: number }> = {};
      for (const d of defects) {
        const sprint = d.sprint_name || d.sprint_id || 'No Sprint';
        if (!sprintMap[sprint]) sprintMap[sprint] = { opened: 0, closed: 0 };
        sprintMap[sprint].opened++;
        if (['Fixed','Verified','Closed'].includes(d.status)) sprintMap[sprint].closed++;
      }
      const velocity = Object.entries(sprintMap).map(([sprint, v]) => ({ sprint, ...v }));
      setAnalyticsData({ rootCause, regressionRate, aging, avgFixTime, topReporters, topAssignees, velocity });
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  const loadByProject = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: all }, { data: policies }] = await Promise.all([
        supabase.from('project_defects').select('*'),
        supabase.from('defect_sla_policies').select('*'),
      ]);
      const withSLA = (all ?? []).map(d => ({ ...normalizeRow(d, computeSLA(d, policies ?? [])), _raw: d }));
      const projMap: Record<string, any> = {};
      for (const d of withSLA) {
        const pId = d.projectId;
        const pName = d.projectName || pId || 'Unknown';
        if (!projMap[pId]) projMap[pId] = { projectId: pId, projectName: pName, s1: 0, s2: 0, s3: 0, s4: 0, total: 0, resolved: 0, breached: 0, criticalDefects: [] };
        projMap[pId].total++;
        if (d.severity === 'Very High') { projMap[pId].s1++; projMap[pId].criticalDefects.push(d); }
        if (d.severity === 'High') projMap[pId].s2++;
        if (d.severity === 'Medium') projMap[pId].s3++;
        if (d.severity === 'Low') projMap[pId].s4++;
        if (['Fixed','Verified','Closed'].includes(d.status)) projMap[pId].resolved++;
        if (d.slaFixBreached || d.slaVerifyBreached) projMap[pId].breached++;
      }
      setByProjectData(Object.values(projMap).map((p: any) => ({
        ...p,
        resolvedPct: p.total ? Math.round(p.resolved / p.total * 100) : 0,
        slaCompliance: p.total ? Math.round((p.total - p.breached) / p.total * 100) : 100,
      })));
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  const loadDefectDetail = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const [defectRes, commentsRes, activityRes, linksRes] = await Promise.all([
        supabase.from('project_defects').select('*').eq('id', id).single(),
        supabase.from('defect_comments').select('*').eq('defect_id', id).order('created_at'),
        supabase.from('defect_activity_log').select('*').eq('defect_id', id).order('occurred_at', { ascending: false }).limit(50),
        supabase.from('defect_linked_items').select('*').eq('defect_id', id),
      ]);
      if (defectRes.error) return null;
      const defect = normalizeRow(defectRes.data);
      const comments: DefectComment[] = (commentsRes.data ?? []).map((c: any) => ({
        id: c.id, authorId: c.author_id, authorName: c.author_name,
        content: c.content, isInternal: c.is_internal, createdAt: c.created_at,
      }));
      const activityLog: ActivityEntry[] = (activityRes.data ?? []).map((a: any) => ({
        id: a.id, actorId: a.actor_id, actorName: a.actor_name, action: a.action,
        fieldChanged: a.field_changed ?? '', oldValue: a.old_value ?? '', newValue: a.new_value ?? '',
        comment: a.comment ?? '', occurredAt: a.occurred_at,
      }));
      const linkedItems: LinkedItem[] = (linksRes.data ?? []).map((l: any) => ({
        id: l.id, itemType: l.item_type, itemRef: l.item_ref,
        itemTitle: l.item_title, itemStatus: l.item_status,
      }));
      const full = { ...defect, comments, activityLog, linkedItems };
      setSelectedDefect(full);
      return full;
    } catch {} finally {
      setLoading(false);
    }
    return null;
  }, []);

  const loadMasterData = useCallback(async () => {
    try {
      const [resCodesRes, rootCauseRes, rejectionRes, labelsRes, envRes, priorityRes, statusRes, escalationRes] = await Promise.all([
        supabase.from('defect_resolution_codes').select('*').order('sort_order'),
        supabase.from('defect_root_cause_categories').select('*').order('sort_order'),
        supabase.from('defect_rejection_reasons').select('*').order('name'),
        supabase.from('defect_labels').select('*').order('name'),
        supabase.from('defect_environments').select('*').order('sort_order'),
        supabase.from('defect_priorities').select('*').order('sort_order'),
        supabase.from('defect_statuses').select('*').order('sort_order'),
        supabase.from('defect_escalation_rules').select('*').order('name'),
      ]);
      setMasterData({
        resolutionCodes: resCodesRes.data ?? [],
        rootCauseCategories: rootCauseRes.data ?? [],
        rejectionReasons: rejectionRes.data ?? [],
        labels: labelsRes.data ?? [],
        environments: envRes.data ?? [],
        priorities: priorityRes.data ?? [],
        statuses: statusRes.data ?? [],
        escalationRules: escalationRes.data ?? [],
      });
    } catch {}
  }, []);

  const createDefect = useCallback(async (body: Partial<Defect>): Promise<Defect | null> => {
    try {
      const { data: lastDef } = await supabase.from('project_defects').select('defect_id').like('defect_id', 'DEF%').order('defect_id', { ascending: false }).limit(1);
      let defNext = 1;
      if (lastDef?.length) { const m = String(lastDef[0].defect_id).match(/DEF(\d+)/); if (m) defNext = parseInt(m[1]) + 1; }
      const defectId = `DEF${String(defNext).padStart(4, '0')}`;
      const dbBody = { ...toDbBody(body), defect_id: defectId, status: 'Open', created_by: body.reporterName ?? '' };
      const { data, error: dbErr } = await supabase.from('project_defects').insert([dbBody]).select().single();
      if (dbErr) {
        toast.error(dbErr.message);
        return null;
      }
      const created = normalizeRow(data);
      setDefects(prev => [created, ...prev]);
      // Log activity (fire-and-forget)
      void supabase.from('defect_activity_log').insert([{
        defect_id: data.id, actor_id: body.reporterId ?? '', actor_name: body.reporterName ?? 'System',
        action: 'created', new_value: 'Open',
      }]);
      toast.success(t('defectTracker.defectCreated'));
      return created;
    } catch (err: any) {
      toast.error(err?.message ?? t('defectTracker.createFailed'));
    }
    return null;
  }, []);

  const updateDefect = useCallback(async (id: string, body: Partial<Defect> & Record<string, any>, actorId?: string, actorName?: string): Promise<Defect | null> => {
    try {
      const { data, error: dbErr } = await supabase.from('project_defects').update(toDbBody(body)).eq('id', id).select().single();
      if (dbErr) { toast.error(dbErr.message); return null; }
      const updated = normalizeRow(data);
      setDefects(prev => prev.map(d => d.id === id ? updated : d));
      if (selectedDefect?.id === id) setSelectedDefect(updated);
      // Audit log (fire-and-forget)
      const changedFields = Object.keys(body)
        .filter(k => !['id','createdAt','updatedAt','ageInDays','slaStatus','slaFixRemainingMins',
                        'slaVerifyRemainingMins','slaFixDueAt','slaVerifyDueAt','slaFirstResponseMet',
                        'slaFixBreached','slaVerifyBreached','slaPolicyName','comments','activityLog','linkedItems'].includes(k));
      if (changedFields.length > 0) {
        void supabase.from('defect_activity_log').insert([{
          defect_id: id,
          actor_id: actorId ?? 'system',
          actor_name: actorName ?? 'System',
          action: 'updated',
          field_changed: changedFields.join(', '),
          new_value: changedFields.length === 1 ? String(body[changedFields[0]] ?? '') : '',
        }]);
      }
      toast.success(t('defectTracker.defectUpdated'));
      return updated;
    } catch {
      toast.error(t('defectTracker.updateFailed'));
    }
    return null;
  }, [selectedDefect]);

  const deleteDefect = useCallback(async (id: string) => {
    try {
      const { error: dbErr } = await supabase.from('project_defects').delete().eq('id', id);
      if (!dbErr) {
        setDefects(prev => prev.filter(d => d.id !== id));
        toast.success(t('defectTracker.defectDeleted'));
        return true;
      }
    } catch {}
    return false;
  }, []);

  const addComment = useCallback(async (defectId: string, content: string, authorId: string, authorName: string): Promise<DefectComment | null> => {
    try {
      const { data, error: dbErr } = await supabase.from('defect_comments').insert([{
        defect_id: defectId, content, author_id: authorId, author_name: authorName, is_internal: false,
      }]).select().single();
      if (dbErr) return null;
      const comment: DefectComment = {
        id: data.id, authorId: data.author_id, authorName: data.author_name,
        content: data.content, isInternal: data.is_internal, createdAt: data.created_at,
      };
      if (selectedDefect?.id === defectId) {
        setSelectedDefect(prev => prev ? { ...prev, comments: [...(prev.comments ?? []), comment] } : prev);
      }
      toast.success(t('defectTracker.commentAdded'));
      return comment;
    } catch {}
    return null;
  }, [selectedDefect]);

  const addLink = useCallback(async (defectId: string, link: Omit<LinkedItem, 'id'>) => {
    try {
      const { data, error: dbErr } = await supabase.from('defect_linked_items').insert([{
        defect_id: defectId, item_type: link.itemType, item_ref: link.itemRef,
        item_title: link.itemTitle, item_status: link.itemStatus,
      }]).select().single();
      if (dbErr) return null;
      const newLink = { id: data.id, ...link };
      if (selectedDefect?.id === defectId) {
        setSelectedDefect(prev => prev ? { ...prev, linkedItems: [...(prev.linkedItems ?? []), newLink] } : prev);
      }
      return newLink;
    } catch {}
    return null;
  }, [selectedDefect]);

  return {
    defects, dashboard, slaData, analyticsData, byProjectData,
    selectedDefect, setSelectedDefect, masterData,
    loading, error,
    loadDefects, loadDashboard, loadSLAData, loadAnalytics,
    loadByProject, loadDefectDetail, loadMasterData,
    createDefect, updateDefect, deleteDefect, addComment, addLink,
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const SEVERITY_CONFIG: Record<DefectSeverity, { label: string; color: string; bg: string; border: string; textColor: string; dotColor: string }> = {
  'Very High': { label: 'Very High', color: 'bg-red-600 text-white',    bg: 'bg-red-50',     border: 'border-l-red-500',    textColor: 'text-red-700',    dotColor: 'bg-red-500' },
  'High':      { label: 'High',      color: 'bg-orange-500 text-white', bg: 'bg-orange-50',  border: 'border-l-orange-500', textColor: 'text-orange-700', dotColor: 'bg-orange-500' },
  'Medium':    { label: 'Medium',    color: 'bg-blue-600 text-white',   bg: 'bg-blue-50',    border: 'border-l-blue-400',   textColor: 'text-blue-700',   dotColor: 'bg-blue-500' },
  'Low':       { label: 'Low',       color: 'bg-gray-500 text-white',   bg: 'bg-gray-50',    border: 'border-l-gray-400',   textColor: 'text-gray-600',   dotColor: 'bg-gray-400' },
};

export const STATUS_CONFIG: Record<DefectStatus, { color: string; bg: string }> = {
  'Open':        { color: 'text-blue-700',   bg: 'bg-blue-100' },
  'In Progress': { color: 'text-yellow-700', bg: 'bg-yellow-100' },
  'Blocked':     { color: 'text-red-700',    bg: 'bg-red-100' },
  'Fixed':       { color: 'text-green-700',  bg: 'bg-green-100' },
  'Verified':    { color: 'text-teal-700',   bg: 'bg-teal-100' },
  'Closed':      { color: 'text-gray-700',   bg: 'bg-gray-100' },
  'Deferred':    { color: 'text-purple-700', bg: 'bg-purple-100' },
  "Won't Fix":   { color: 'text-orange-700', bg: 'bg-orange-100' },
  'Duplicate':   { color: 'text-pink-700',   bg: 'bg-pink-100' },
};

export const VALID_TRANSITIONS: Record<DefectStatus, DefectStatus[]> = {
  'Open':        ['In Progress', 'Deferred', "Won't Fix", 'Duplicate'],
  'In Progress': ['Fixed', 'Blocked', 'Open'],
  'Blocked':     ['In Progress', "Won't Fix"],
  'Fixed':       ['Verified', 'In Progress'],
  'Verified':    ['Closed'],
  'Deferred':    ['Open'],
  "Won't Fix":   ['Open'],
  'Duplicate':   [],
  'Closed':      ['Open'],
};

export const SLA_STATUS_CONFIG = {
  on_track:       { label: 'On Track',     dot: 'bg-green-500',  text: 'text-green-700' },
  at_risk:        { label: 'At Risk',      dot: 'bg-yellow-500', text: 'text-yellow-700' },
  fix_breached:   { label: 'Fix Breached', dot: 'bg-red-500',    text: 'text-red-700' },
  verify_breached:{ label: 'Verify SLA',   dot: 'bg-orange-500', text: 'text-orange-700' },
  all_met:        { label: 'All Met',      dot: 'bg-green-500',  text: 'text-green-700' },
};

export const DEFECT_SEVERITIES: DefectSeverity[] = ['Very High', 'High', 'Medium', 'Low'];

export function formatRemaining(mins: number | null): string {
  if (mins === null) return '—';
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const overdue = mins < 0;
  if (h > 24) return `${overdue ? 'Overdue ' : ''}${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${overdue ? 'Overdue ' : ''}${h}h ${m}m`;
  return `${overdue ? 'Overdue ' : ''}${m}m`;
}
