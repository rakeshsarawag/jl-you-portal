import { toast } from 'sonner';

export type ReportType = 'table' | 'chart' | 'pivot' | 'dashboard' | 'custom';
export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'radar' | 'funnel';
export type DataSourceType = 'employees' | 'projects' | 'tasks' | 'sales' | 'custom' | 'api';
export type AggregationType = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median';

export interface ReportField {
  id: string;
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  aggregation?: AggregationType;
}

export interface ReportFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'between' | 'in';
  value: any;
}

export interface ReportSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  time: string;
  recipients: string[];
  format: 'pdf' | 'excel' | 'csv' | 'html';
}

export interface Report {
  id: string;
  name: string;
  description: string;
  type: ReportType;
  dataSource: DataSourceType;
  fields: ReportField[];
  filters: ReportFilter[];
  chartType?: ChartType;
  groupBy?: string[];
  sortBy?: { field: string; direction: 'asc' | 'desc' }[];
  schedule?: ReportSchedule;
  createdBy: string;
  createdAt: string;
  lastRun?: string;
  shared: boolean;
  tags: string[];
  favorited: boolean;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: ReportType;
  category: string;
  icon: string;
  fields: ReportField[];
  sampleData: any[];
}

export class ReportingService {
  private static reports: Map<string, Report> = new Map();
  private static templates: ReportTemplate[] = [];

  /**
   * Initialize reporting service
   */
  static initialize() {
    this.loadFromStorage();
    this.initializeTemplates();
    this.initializeSampleReports();
  }

  /**
   * Initialize report templates
   */
  private static initializeTemplates() {
    this.templates = [
      {
        id: 'template_employee_summary',
        name: 'Employee Summary Report',
        description: 'Overview of employee statistics and demographics',
        type: 'table',
        category: 'HR',
        icon: 'Users',
        fields: [
          { id: 'name', name: 'Name', type: 'string' },
          { id: 'department', name: 'Department', type: 'string' },
          { id: 'role', name: 'Role', type: 'string' },
          { id: 'startDate', name: 'Start Date', type: 'date' },
          { id: 'salary', name: 'Salary', type: 'number', aggregation: 'avg' }
        ],
        sampleData: []
      },
      {
        id: 'template_sales_performance',
        name: 'Sales Performance Dashboard',
        description: 'Track sales metrics and trends',
        type: 'dashboard',
        category: 'Sales',
        icon: 'TrendingUp',
        fields: [
          { id: 'month', name: 'Month', type: 'string' },
          { id: 'revenue', name: 'Revenue', type: 'number', aggregation: 'sum' },
          { id: 'deals', name: 'Deals', type: 'number', aggregation: 'count' },
          { id: 'conversion', name: 'Conversion Rate', type: 'number', aggregation: 'avg' }
        ],
        sampleData: []
      },
      {
        id: 'template_project_timeline',
        name: 'Project Timeline Report',
        description: 'View project schedules and milestones',
        type: 'chart',
        category: 'Projects',
        icon: 'Calendar',
        fields: [
          { id: 'project', name: 'Project', type: 'string' },
          { id: 'status', name: 'Status', type: 'string' },
          { id: 'startDate', name: 'Start Date', type: 'date' },
          { id: 'endDate', name: 'End Date', type: 'date' },
          { id: 'progress', name: 'Progress', type: 'number' }
        ],
        sampleData: []
      },
      {
        id: 'template_expense_analysis',
        name: 'Expense Analysis',
        description: 'Analyze spending patterns and budgets',
        type: 'pivot',
        category: 'Finance',
        icon: 'DollarSign',
        fields: [
          { id: 'category', name: 'Category', type: 'string' },
          { id: 'amount', name: 'Amount', type: 'number', aggregation: 'sum' },
          { id: 'date', name: 'Date', type: 'date' },
          { id: 'vendor', name: 'Vendor', type: 'string' }
        ],
        sampleData: []
      },
      {
        id: 'template_compliance_checklist',
        name: 'Compliance Checklist',
        description: 'Track compliance requirements and status',
        type: 'table',
        category: 'Compliance',
        icon: 'Shield',
        fields: [
          { id: 'requirement', name: 'Requirement', type: 'string' },
          { id: 'status', name: 'Status', type: 'string' },
          { id: 'owner', name: 'Owner', type: 'string' },
          { id: 'dueDate', name: 'Due Date', type: 'date' },
          { id: 'completion', name: 'Completion', type: 'number' }
        ],
        sampleData: []
      }
    ];
  }

  /**
   * Initialize sample reports
   */
  private static initializeSampleReports() {
    if (this.reports.size > 0) return;

    const sampleReports: Report[] = [
      {
        id: 'report_1',
        name: 'Monthly Employee Performance',
        description: 'Track employee KPIs and achievements',
        type: 'dashboard',
        dataSource: 'employees',
        fields: [
          { id: 'name', name: 'Name', type: 'string' },
          { id: 'department', name: 'Department', type: 'string' },
          { id: 'performance', name: 'Performance Score', type: 'number', aggregation: 'avg' },
          { id: 'projects', name: 'Projects Completed', type: 'number', aggregation: 'sum' }
        ],
        filters: [
          { field: 'department', operator: 'in', value: ['Engineering', 'Product', 'Sales'] }
        ],
        groupBy: ['department'],
        sortBy: [{ field: 'performance', direction: 'desc' }],
        createdBy: 'Admin User',
        createdAt: new Date(Date.now() - 2592000000).toISOString(),
        lastRun: new Date(Date.now() - 86400000).toISOString(),
        shared: true,
        tags: ['HR', 'Performance', 'Monthly'],
        favorited: true
      },
      {
        id: 'report_2',
        name: 'Project Status Overview',
        description: 'Current status of all active projects',
        type: 'chart',
        dataSource: 'projects',
        chartType: 'bar',
        fields: [
          { id: 'name', name: 'Project Name', type: 'string' },
          { id: 'status', name: 'Status', type: 'string' },
          { id: 'progress', name: 'Progress', type: 'number', aggregation: 'avg' },
          { id: 'budget', name: 'Budget Used', type: 'number', aggregation: 'sum' }
        ],
        filters: [
          { field: 'status', operator: 'in', value: ['Active', 'In Progress'] }
        ],
        groupBy: ['status'],
        createdBy: 'Admin User',
        createdAt: new Date(Date.now() - 1296000000).toISOString(),
        shared: true,
        tags: ['Projects', 'Status'],
        favorited: false
      },
      {
        id: 'report_3',
        name: 'Revenue Trends',
        description: 'Track revenue over time',
        type: 'chart',
        dataSource: 'sales',
        chartType: 'line',
        fields: [
          { id: 'month', name: 'Month', type: 'date' },
          { id: 'revenue', name: 'Revenue', type: 'number', aggregation: 'sum' },
          { id: 'deals', name: 'Deals Closed', type: 'number', aggregation: 'count' }
        ],
        filters: [],
        groupBy: ['month'],
        sortBy: [{ field: 'month', direction: 'asc' }],
        schedule: {
          enabled: true,
          frequency: 'weekly',
          time: '09:00',
          recipients: ['finance@jeshanlabs.com', 'ceo@jeshanlabs.com'],
          format: 'pdf'
        },
        createdBy: 'Finance Manager',
        createdAt: new Date(Date.now() - 604800000).toISOString(),
        lastRun: new Date(Date.now() - 3600000).toISOString(),
        shared: true,
        tags: ['Finance', 'Revenue', 'Weekly'],
        favorited: true
      }
    ];

    sampleReports.forEach(report => this.reports.set(report.id, report));
    this.saveToStorage();
  }

  /**
   * Get all reports
   */
  static getAllReports(): Report[] {
    return Array.from(this.reports.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Get report by ID
   */
  static getReport(id: string): Report | undefined {
    return this.reports.get(id);
  }

  /**
   * Create new report
   */
  static createReport(report: Omit<Report, 'id' | 'createdAt' | 'favorited'>): Report {
    const newReport: Report = {
      ...report,
      id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      favorited: false
    };

    this.reports.set(newReport.id, newReport);
    this.saveToStorage();
    
    toast.success('Report created', {
      description: `"${newReport.name}" has been created successfully`
    });

    return newReport;
  }

  /**
   * Update report
   */
  static updateReport(id: string, updates: Partial<Report>): void {
    const report = this.reports.get(id);
    if (report) {
      this.reports.set(id, { ...report, ...updates });
      this.saveToStorage();
      toast.success('Report updated');
    }
  }

  /**
   * Delete report
   */
  static deleteReport(id: string): void {
    this.reports.delete(id);
    this.saveToStorage();
    toast.success('Report deleted');
  }

  /**
   * Toggle favorite
   */
  static toggleFavorite(id: string): void {
    const report = this.reports.get(id);
    if (report) {
      report.favorited = !report.favorited;
      this.reports.set(id, report);
      this.saveToStorage();
      toast.success(report.favorited ? 'Added to favorites' : 'Removed from favorites');
    }
  }

  /**
   * Get favorited reports
   */
  static getFavorites(): Report[] {
    return this.getAllReports().filter(r => r.favorited);
  }

  /**
   * Get reports by tag
   */
  static getReportsByTag(tag: string): Report[] {
    return this.getAllReports().filter(r => r.tags.includes(tag));
  }

  /**
   * Search reports
   */
  static searchReports(query: string): Report[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllReports().filter(r =>
      r.name.toLowerCase().includes(lowerQuery) ||
      r.description.toLowerCase().includes(lowerQuery) ||
      r.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get all templates
   */
  static getTemplates(): ReportTemplate[] {
    return this.templates;
  }

  /**
   * Create report from template
   */
  static createFromTemplate(templateId: string, customizations?: Partial<Report>): Report {
    const template = this.templates.find(t => t.id === templateId);
    
    if (!template) {
      toast.error('Template not found');
      throw new Error('Template not found');
    }

    return this.createReport({
      name: template.name,
      description: template.description,
      type: template.type,
      dataSource: 'custom',
      fields: template.fields,
      filters: [],
      createdBy: 'Current User',
      shared: false,
      tags: [template.category],
      ...customizations
    });
  }

  /**
   * Run report and get data
   */
  static async runReport(reportId: string): Promise<any[]> {
    const report = this.reports.get(reportId);
    
    if (!report) {
      toast.error('Report not found');
      return [];
    }

    // Update last run timestamp
    report.lastRun = new Date().toISOString();
    this.reports.set(reportId, report);
    this.saveToStorage();

    // Generate sample data based on report configuration
    const data = this.generateSampleData(report);

    toast.success('Report generated', {
      description: `${data.length} records retrieved`
    });

    return data;
  }

  /**
   * Generate sample data for report
   */
  private static generateSampleData(report: Report): any[] {
    const count = 50;
    const data: any[] = [];

    for (let i = 0; i < count; i++) {
      const row: any = {};
      
      report.fields.forEach(field => {
        switch (field.type) {
          case 'string':
            if (field.id === 'name') row[field.id] = `Person ${i + 1}`;
            else if (field.id === 'department') row[field.id] = ['Engineering', 'Sales', 'Marketing', 'HR'][i % 4];
            else if (field.id === 'status') row[field.id] = ['Active', 'Completed', 'On Hold'][i % 3];
            else row[field.id] = `Value ${i + 1}`;
            break;
          case 'number':
            row[field.id] = Math.floor(Math.random() * 100) + 1;
            break;
          case 'date':
            row[field.id] = new Date(Date.now() - Math.random() * 31536000000).toISOString();
            break;
          case 'boolean':
            row[field.id] = Math.random() > 0.5;
            break;
        }
      });

      data.push(row);
    }

    return data;
  }

  /**
   * Export report
   */
  static exportReport(reportId: string, format: 'csv' | 'json' | 'excel'): void {
    const report = this.reports.get(reportId);
    
    if (!report) {
      toast.error('Report not found');
      return;
    }

    const data = this.generateSampleData(report);

    if (format === 'csv') {
      const csv = this.convertToCSV(data);
      this.downloadFile(csv, `${report.name}.csv`, 'text/csv');
    } else if (format === 'json') {
      const json = JSON.stringify(data, null, 2);
      this.downloadFile(json, `${report.name}.json`, 'application/json');
    }

    toast.success('Report exported', {
      description: `Downloaded as ${format.toUpperCase()}`
    });
  }

  /**
   * Convert data to CSV
   */
  private static convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const rows = data.map(row => 
      headers.map(header => `"${row[header]}"`).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Download file
   */
  private static downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Get report statistics
   */
  static getStatistics() {
    const reports = this.getAllReports();
    
    return {
      total: reports.length,
      favorites: reports.filter(r => r.favorited).length,
      scheduled: reports.filter(r => r.schedule?.enabled).length,
      shared: reports.filter(r => r.shared).length,
      byType: {
        table: reports.filter(r => r.type === 'table').length,
        chart: reports.filter(r => r.type === 'chart').length,
        dashboard: reports.filter(r => r.type === 'dashboard').length,
        pivot: reports.filter(r => r.type === 'pivot').length
      },
      recentlyRun: reports.filter(r => 
        r.lastRun && new Date(r.lastRun).getTime() > Date.now() - 86400000
      ).length
    };
  }

  /**
   * Save to localStorage
   */
  private static saveToStorage(): void {
    try {
      localStorage.setItem('reports', JSON.stringify(Array.from(this.reports.entries())));
    } catch (error) {
      console.error('Error saving reports:', error);
    }
  }

  /**
   * Load from localStorage
   */
  private static loadFromStorage(): void {
    try {
      const data = localStorage.getItem('reports');
      if (data) {
        this.reports = new Map(JSON.parse(data));
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    }
  }
}
