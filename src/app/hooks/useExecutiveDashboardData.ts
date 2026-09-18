import { useState, useEffect, useCallback } from 'react';
import { API_BASE, publicAnonKey, safeJson, apiHeaders } from '../utils/constants';

export interface ExecutiveDashboardData {
  headcount: { total: number; active: number; newThisMonth: number; attrition: number } | null;
  payroll: { totalCost: number; avgSalary: number; processed: number } | null;
  recruitment: { totalCandidates: number; activeJobs: number; hiredThisMonth: number; pipelineCount: number } | null;
  onboarding: { inProgress: number; completed: number; pending: number } | null;
  performance: { avgRating: number; reviewsCompleted: number; goalsAchieved: number } | null;
  training: { completionRate: number; enrollments: number; certified: number } | null;
  itServices: { openTickets: number; avgResolutionHours: number; slaBreached: number } | null;
  invoices: { totalRevenue: number; outstanding: number; overdue: number } | null;
  assets: { total: number; assigned: number; maintenance: number } | null;
  okr: { avgProgress: number; onTrack: number; atRisk: number } | null;
  lastUpdated: Date;
}

const BACKEND = `${API_BASE}`;

function api(url: string, userEmail?: string) {
  return fetch(url, {
    headers: apiHeaders(userEmail),
  }).then((r) => safeJson(r));
}

function safe<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null;
}

export function useExecutiveDashboardData(dateRange?: string, userEmail?: string) {
  const [data, setData] = useState<ExecutiveDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [
        directoryRes,
        payrollRes,
        recruitmentRes,
        onboardingRes,
        performanceRes,
        trainingRes,
        itRes,
        invoicesRes,
        assetsRes,
        okrRes,
      ] = await Promise.allSettled([
        api(`${BACKEND}/directory/stats`, userEmail),
        api(`${BACKEND}/payroll/stats`, userEmail),
        api(`${BACKEND}/recruitment/stats`, userEmail),
        api(`${BACKEND}/onboarding/stats`, userEmail),
        api(`${BACKEND}/performance/stats`, userEmail),
        api(`${BACKEND}/training/stats`, userEmail),
        api(`${BACKEND}/it-services/stats`, userEmail),
        api(`${BACKEND}/invoices/analytics`, userEmail),
        api(`${BACKEND}/assets/stats/all`, userEmail),
        api(`${BACKEND}/okr/stats/all`, userEmail),
      ]);

      const dir = safe(directoryRes);
      const pay = safe(payrollRes);
      const rec = safe(recruitmentRes);
      const onb = safe(onboardingRes);
      const perf = safe(performanceRes);
      const train = safe(trainingRes);
      const it = safe(itRes);
      const inv = safe(invoicesRes);
      const assets = safe(assetsRes);
      const okr = safe(okrRes);

      setData({
        headcount: dir
          ? {
              total: dir.total ?? dir.totalEmployees ?? 0,
              active: dir.active ?? dir.activeEmployees ?? 0,
              newThisMonth: dir.newThisMonth ?? dir.newHires ?? 0,
              attrition: dir.attrition ?? dir.attritionRate ?? 0,
            }
          : null,
        payroll: pay
          ? {
              totalCost: pay.totalCost ?? pay.totalPayroll ?? 0,
              avgSalary: pay.avgSalary ?? pay.averageSalary ?? 0,
              processed: pay.processed ?? pay.employeesProcessed ?? 0,
            }
          : null,
        recruitment: rec
          ? {
              totalCandidates: rec.totalCandidates ?? rec.candidates ?? 0,
              activeJobs: rec.activeJobs ?? rec.openPositions ?? 0,
              hiredThisMonth: rec.hiredThisMonth ?? rec.hired ?? 0,
              pipelineCount: rec.pipelineCount ?? rec.inPipeline ?? 0,
            }
          : null,
        onboarding: onb
          ? {
              inProgress: onb.inProgress ?? onb.active ?? 0,
              completed: onb.completed ?? 0,
              pending: onb.pending ?? onb.notStarted ?? 0,
            }
          : null,
        performance: perf
          ? {
              avgRating: perf.avgRating ?? perf.averageRating ?? 0,
              reviewsCompleted: perf.reviewsCompleted ?? perf.completed ?? 0,
              goalsAchieved: perf.goalsAchieved ?? perf.goals ?? 0,
            }
          : null,
        training: train
          ? {
              completionRate: train.completionRate ?? train.completion ?? 0,
              enrollments: train.enrollments ?? train.enrolled ?? 0,
              certified: train.certified ?? train.certificates ?? 0,
            }
          : null,
        itServices: it
          ? {
              openTickets: it.openTickets ?? it.open ?? 0,
              avgResolutionHours: it.avgResolutionHours ?? it.avgResolution ?? 0,
              slaBreached: it.slaBreached ?? it.breached ?? 0,
            }
          : null,
        invoices: inv
          ? {
              totalRevenue: inv.totalRevenue ?? inv.revenue ?? 0,
              outstanding: inv.outstanding ?? inv.outstandingAmount ?? 0,
              overdue: inv.overdue ?? inv.overdueAmount ?? 0,
            }
          : null,
        assets: assets
          ? {
              total: assets.total ?? assets.totalAssets ?? 0,
              assigned: assets.assigned ?? 0,
              maintenance: assets.maintenance ?? assets.inMaintenance ?? 0,
            }
          : null,
        okr: okr
          ? {
              avgProgress: okr.avgProgress ?? okr.averageProgress ?? 0,
              onTrack: okr.onTrack ?? 0,
              atRisk: okr.atRisk ?? 0,
            }
          : null,
        lastUpdated: new Date(),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5 * 60 * 1000);
    // dateRange intentionally triggers a refresh when the user changes it
    return () => clearInterval(interval);
  }, [refresh, dateRange]);

  return { data, loading, refresh };
}
