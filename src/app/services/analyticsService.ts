import { projectId, publicAnonKey } from '../utils/constants';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-1fe2c468`;

export interface DashboardMetrics {
  totalEmployees: number;
  activeProjects: number;
  monthlyRevenue: number;
  openPositions: number;
  pendingApprovals: number;
  activeTickets: number;
  completedTraining: number;
  departmentHeadcount: Array<{ name: string; value: number }>;
  revenueByMonth: Array<{ name: string; value: number }>;
  projectStatusDistribution: Array<{ name: string; value: number }>;
  budgetVsActual: Array<{ name: string; budget: number; spent: number }>;
  employeeGrowth: Array<{ name: string; employees: number }>;
  topPerformers: Array<{ name: string; score: number; department: string }>;
  recruitmentPipeline: Array<{ name: string; value: number }>;
  trainingCompletion: Array<{ name: string; completion: number; target: number }>;
  assetsByCategory: Array<{ name: string; value: number }>;
  okrProgress: Array<{ name: string; progress: number }>;
}

export class AnalyticsService {
  /**
   * Get comprehensive dashboard data aggregated from all 18 apps
   */
  static async getDashboardData(): Promise<DashboardMetrics> {
    try {
      // Fetch data from all sources in parallel for performance
      const [
        employeeData,
        projectData,
        invoiceData,
        recruitmentData,
        performanceData,
        trainingData,
        itServicesData,
        assetData,
        okrData,
        payrollData
      ] = await Promise.allSettled([
        this.fetchFromKV('employees'),
        this.fetchFromKV('projects'),
        this.fetchFromKV('invoices'),
        this.fetchFromKV('recruitment_positions'),
        this.fetchFromKV('performance_reviews'),
        this.fetchFromKV('training_courses'),
        this.fetchFromKV('it_tickets'),
        this.fetchFromKV('assets'),
        this.fetchFromKV('okrs'),
        this.fetchFromKV('payroll_records')
      ]);

      const employees = this.extractData(employeeData);
      const projects = this.extractData(projectData);
      const invoices = this.extractData(invoiceData);
      const recruitment = this.extractData(recruitmentData);
      const performance = this.extractData(performanceData);
      const training = this.extractData(trainingData);
      const tickets = this.extractData(itServicesData);
      const assets = this.extractData(assetData);
      const okrs = this.extractData(okrData);

      return {
        // KPI Metrics
        totalEmployees: employees.length,
        activeProjects: projects.filter(p => p.status === 'active' || p.status === 'in-progress').length,
        monthlyRevenue: this.calculateMonthlyRevenue(invoices),
        openPositions: recruitment.filter(r => r.status === 'open' || r.status === 'active').length,
        pendingApprovals: this.countPendingApprovals(projects, performance, training),
        activeTickets: tickets.filter(t => t.status === 'open' || t.status === 'in-progress').length,
        completedTraining: training.filter(t => t.completionRate === 100 || t.status === 'completed').length,

        // Chart Data
        departmentHeadcount: this.aggregateByDepartment(employees),
        revenueByMonth: this.aggregateRevenueByMonth(invoices),
        projectStatusDistribution: this.aggregateProjectStatus(projects),
        budgetVsActual: this.aggregateBudgetData(projects),
        employeeGrowth: this.calculateEmployeeGrowth(employees),
        topPerformers: this.getTopPerformers(performance, employees),
        recruitmentPipeline: this.aggregateRecruitmentPipeline(recruitment),
        trainingCompletion: this.aggregateTrainingCompletion(training),
        assetsByCategory: this.aggregateAssetsByCategory(assets),
        okrProgress: this.aggregateOKRProgress(okrs)
      };
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      return this.getDefaultMetrics();
    }
  }

  /**
   * Fetch data from KV store with error handling
   */
  private static async fetchFromKV(key: string): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE}/kv/${key}`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data) ? data : (data.value || []);
      }
      return [];
    } catch (error) {
      console.error(`Error fetching ${key}:`, error);
      return [];
    }
  }

  /**
   * Extract data from Promise.allSettled result
   */
  private static extractData(result: PromiseSettledResult<any[]>): any[] {
    if (result.status === 'fulfilled') {
      return Array.isArray(result.value) ? result.value : [];
    }
    return [];
  }

  /**
   * Calculate monthly revenue from invoices
   */
  private static calculateMonthlyRevenue(invoices: any[]): number {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    return invoices
      .filter(inv => {
        if (inv.status === 'paid' && inv.paidDate) {
          const date = new Date(inv.paidDate);
          return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        }
        return false;
      })
      .reduce((sum, inv) => sum + (inv.total || inv.amount || 0), 0);
  }

  /**
   * Count pending approvals across multiple apps
   */
  private static countPendingApprovals(projects: any[], performance: any[], training: any[]): number {
    let count = 0;
    
    // Project approvals
    count += projects.filter(p => p.status === 'pending-approval' || p.requiresApproval).length;
    
    // Performance review approvals
    count += performance.filter(p => p.status === 'pending-approval' || p.status === 'pending').length;
    
    // Training approvals
    count += training.filter(t => t.status === 'pending-approval' || t.requiresApproval).length;
    
    return count;
  }

  /**
   * Aggregate employees by department
   */
  private static aggregateByDepartment(employees: any[]): Array<{ name: string; value: number }> {
    const deptCount: Record<string, number> = {};
    
    employees.forEach(emp => {
      const dept = emp.department || 'Unassigned';
      deptCount[dept] = (deptCount[dept] || 0) + 1;
    });

    return Object.entries(deptCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }

  /**
   * Aggregate revenue by month (last 6 months)
   */
  private static aggregateRevenueByMonth(invoices: any[]): Array<{ name: string; value: number }> {
    const monthlyRevenue: Record<string, number> = {};
    
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthKey = format(date, 'MMM yyyy');
      monthlyRevenue[monthKey] = 0;
    }

    invoices.forEach(inv => {
      if (inv.status === 'paid' && inv.paidDate) {
        const monthKey = format(new Date(inv.paidDate), 'MMM yyyy');
        if (monthKey in monthlyRevenue) {
          monthlyRevenue[monthKey] += (inv.total || inv.amount || 0);
        }
      }
    });

    return Object.entries(monthlyRevenue).map(([name, value]) => ({ name, value }));
  }

  /**
   * Aggregate project status distribution
   */
  private static aggregateProjectStatus(projects: any[]): Array<{ name: string; value: number }> {
    const statusCount: Record<string, number> = {};
    
    projects.forEach(proj => {
      const status = proj.status || 'unknown';
      const statusName = status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, ' ');
      statusCount[statusName] = (statusCount[statusName] || 0) + 1;
    });

    return Object.entries(statusCount).map(([name, value]) => ({ name, value }));
  }

  /**
   * Aggregate budget vs actual spending for projects
   */
  private static aggregateBudgetData(projects: any[]): Array<{ name: string; budget: number; spent: number }> {
    return projects
      .filter(proj => proj.budget || proj.spent)
      .slice(0, 8) // Top 8 projects
      .map(proj => ({
        name: proj.name?.substring(0, 15) || 'Unnamed',
        budget: proj.budget || 0,
        spent: proj.spent || proj.actualCost || 0
      }));
  }

  /**
   * Calculate employee growth over last 6 months
   */
  private static calculateEmployeeGrowth(employees: any[]): Array<{ name: string; employees: number }> {
    const growth: Record<string, number> = {};
    
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthKey = format(date, 'MMM yyyy');
      growth[monthKey] = 0;
    }

    employees.forEach(emp => {
      if (emp.hireDate || emp.joinDate) {
        const monthKey = format(new Date(emp.hireDate || emp.joinDate), 'MMM yyyy');
        if (monthKey in growth) {
          growth[monthKey]++;
        }
      }
    });

    // Calculate cumulative growth
    let cumulative = employees.filter(e => {
      const hireDate = new Date(e.hireDate || e.joinDate || '2020-01-01');
      return hireDate < subMonths(new Date(), 6);
    }).length;

    return Object.entries(growth).map(([name, value]) => {
      cumulative += value;
      return { name, employees: cumulative };
    });
  }

  /**
   * Get top performers based on performance reviews
   */
  private static getTopPerformers(performance: any[], employees: any[]): Array<{ name: string; score: number; department: string }> {
    return performance
      .filter(p => p.overallRating || p.score)
      .sort((a, b) => (b.overallRating || b.score) - (a.overallRating || a.score))
      .slice(0, 5)
      .map(p => {
        const employee = employees.find(e => e.id === p.employeeId);
        return {
          name: employee?.name || p.employeeName || 'Unknown',
          score: p.overallRating || p.score || 0,
          department: employee?.department || 'N/A'
        };
      });
  }

  /**
   * Aggregate recruitment pipeline stages
   */
  private static aggregateRecruitmentPipeline(recruitment: any[]): Array<{ name: string; value: number }> {
    const stages = ['Screening', 'Interview', 'Offer', 'Hired'];
    const pipeline: Record<string, number> = {};

    stages.forEach(stage => {
      pipeline[stage] = recruitment.filter(r => 
        r.stage?.toLowerCase() === stage.toLowerCase() || 
        r.status?.toLowerCase() === stage.toLowerCase()
      ).length;
    });

    return Object.entries(pipeline).map(([name, value]) => ({ name, value }));
  }

  /**
   * Aggregate training completion rates
   */
  private static aggregateTrainingCompletion(training: any[]): Array<{ name: string; completion: number; target: number }> {
    const categories = ['Technical', 'Leadership', 'Compliance', 'Soft Skills'];
    
    return categories.map(category => {
      const categoryTraining = training.filter(t => 
        t.category?.toLowerCase() === category.toLowerCase() ||
        t.type?.toLowerCase() === category.toLowerCase()
      );

      const completed = categoryTraining.filter(t => 
        t.completionRate === 100 || t.status === 'completed'
      ).length;

      return {
        name: category,
        completion: completed,
        target: categoryTraining.length
      };
    });
  }

  /**
   * Aggregate assets by category
   */
  private static aggregateAssetsByCategory(assets: any[]): Array<{ name: string; value: number }> {
    const categoryCount: Record<string, number> = {};
    
    assets.forEach(asset => {
      const category = asset.category || asset.type || 'Uncategorized';
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    });

    return Object.entries(categoryCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }

  /**
   * Aggregate OKR progress
   */
  private static aggregateOKRProgress(okrs: any[]): Array<{ name: string; progress: number }> {
    return okrs
      .filter(okr => okr.progress !== undefined)
      .slice(0, 5)
      .map(okr => ({
        name: okr.title?.substring(0, 30) || okr.name?.substring(0, 30) || 'Unnamed OKR',
        progress: okr.progress || 0
      }));
  }

  /**
   * Get default metrics when data is unavailable
   */
  private static getDefaultMetrics(): DashboardMetrics {
    return {
      totalEmployees: 0,
      activeProjects: 0,
      monthlyRevenue: 0,
      openPositions: 0,
      pendingApprovals: 0,
      activeTickets: 0,
      completedTraining: 0,
      departmentHeadcount: [],
      revenueByMonth: [],
      projectStatusDistribution: [],
      budgetVsActual: [],
      employeeGrowth: [],
      topPerformers: [],
      recruitmentPipeline: [],
      trainingCompletion: [],
      assetsByCategory: [],
      okrProgress: []
    };
  }

  /**
   * Format currency
   */
  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * Format percentage
   */
  static formatPercentage(value: number, total: number): string {
    if (total === 0) return '0%';
    return `${((value / total) * 100).toFixed(1)}%`;
  }

  /**
   * Calculate percentage change
   */
  static calculateChange(current: number, previous: number): { value: string; trend: 'up' | 'down' | 'neutral' } {
    if (previous === 0) {
      return { value: current > 0 ? '+100%' : '0%', trend: current > 0 ? 'up' : 'neutral' };
    }

    const change = ((current - previous) / previous) * 100;
    const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
    const sign = change > 0 ? '+' : '';

    return {
      value: `${sign}${change.toFixed(1)}%`,
      trend
    };
  }
}
