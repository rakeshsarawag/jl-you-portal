import { toast } from 'sonner';

export type ReportType = 
  | 'employee_summary' 
  | 'financial_analysis' 
  | 'performance_review'
  | 'recruitment_pipeline'
  | 'training_progress'
  | 'payroll_summary'
  | 'project_status'
  | 'custom';

export type DataSource = 
  | 'employees' 
  | 'invoices' 
  | 'candidates' 
  | 'performance'
  | 'training'
  | 'payroll'
  | 'projects'
  | 'workflows';

export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'table' | 'metric';

export type AggregationType = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct';

export interface ReportFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between' | 'in';
  value: any;
}

export interface ReportColumn {
  id: string;
  field: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'percentage';
  aggregation?: AggregationType;
  format?: string;
}

export interface ReportVisualization {
  id: string;
  type: ChartType;
  title: string;
  dataField: string;
  labelField: string;
  aggregation?: AggregationType;
  color?: string;
}

export interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  type: ReportType;
  dataSource: DataSource;
  columns: ReportColumn[];
  filters: ReportFilter[];
  groupBy?: string[];
  sortBy?: { field: string; direction: 'asc' | 'desc' };
  visualizations: ReportVisualization[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface GeneratedReport {
  id: string;
  definition: ReportDefinition;
  data: any[];
  summary: {
    totalRecords: number;
    generatedAt: string;
    executionTime: number;
  };
  visualizationData?: any;
}

export interface ScheduledReport {
  id: string;
  reportId: string;
  name: string;
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    time: string; // HH:mm format
    dayOfWeek?: number; // 0-6 for weekly
    dayOfMonth?: number; // 1-31 for monthly
  };
  recipients: string[];
  format: 'pdf' | 'excel' | 'csv';
  enabled: boolean;
  lastRun?: string;
  nextRun: string;
  createdAt: string;
}

export class ReportBuilder {
  private static reports: Map<string, ReportDefinition> = new Map();
  private static scheduledReports: Map<string, ScheduledReport> = new Map();
  private static generatedReports: Map<string, GeneratedReport> = new Map();

  /**
   * Create a new report definition
   */
  static createReport(report: Omit<ReportDefinition, 'id' | 'createdAt' | 'updatedAt'>): ReportDefinition {
    const newReport: ReportDefinition = {
      ...report,
      id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.reports.set(newReport.id, newReport);
    this.saveToStorage();
    
    toast.success('Report created successfully');
    return newReport;
  }

  /**
   * Update a report definition
   */
  static updateReport(reportId: string, updates: Partial<ReportDefinition>): void {
    const report = this.reports.get(reportId);
    if (report) {
      const updated = {
        ...report,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.reports.set(reportId, updated);
      this.saveToStorage();
      toast.success('Report updated');
    }
  }

  /**
   * Delete a report
   */
  static deleteReport(reportId: string): void {
    this.reports.delete(reportId);
    // Also delete scheduled reports
    Array.from(this.scheduledReports.values())
      .filter(sr => sr.reportId === reportId)
      .forEach(sr => this.scheduledReports.delete(sr.id));
    
    this.saveToStorage();
    toast.success('Report deleted');
  }

  /**
   * Generate a report
   */
  static generateReport(reportId: string): GeneratedReport {
    const startTime = Date.now();
    const definition = this.reports.get(reportId);
    
    if (!definition) {
      throw new Error('Report not found');
    }

    // Fetch data from the appropriate source
    const rawData = this.fetchDataSource(definition.dataSource);

    // Apply filters
    let filteredData = this.applyFilters(rawData, definition.filters);

    // Apply grouping
    if (definition.groupBy && definition.groupBy.length > 0) {
      filteredData = this.applyGrouping(filteredData, definition.groupBy, definition.columns);
    }

    // Apply sorting
    if (definition.sortBy) {
      filteredData = this.applySorting(filteredData, definition.sortBy);
    }

    // Generate visualization data
    const visualizationData = this.generateVisualizationData(
      filteredData,
      definition.visualizations
    );

    const endTime = Date.now();

    const generatedReport: GeneratedReport = {
      id: `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      definition,
      data: filteredData,
      summary: {
        totalRecords: filteredData.length,
        generatedAt: new Date().toISOString(),
        executionTime: endTime - startTime
      },
      visualizationData
    };

    this.generatedReports.set(generatedReport.id, generatedReport);
    this.saveToStorage();

    return generatedReport;
  }

  /**
   * Fetch data from source
   */
  private static fetchDataSource(dataSource: DataSource): any[] {
    const storageKey = dataSource;
    const data = localStorage.getItem(storageKey);
    
    if (data) {
      try {
        return JSON.parse(data);
      } catch {
        return [];
      }
    }

    // Return sample data if none exists
    return this.getSampleData(dataSource);
  }

  /**
   * Get sample data for a data source
   */
  private static getSampleData(dataSource: DataSource): any[] {
    switch (dataSource) {
      case 'employees':
        return [
          { id: 1, name: 'John Doe', department: 'Engineering', salary: 85000, status: 'active', joinDate: '2024-01-15' },
          { id: 2, name: 'Jane Smith', department: 'Sales', salary: 75000, status: 'active', joinDate: '2024-02-20' },
          { id: 3, name: 'Bob Johnson', department: 'Engineering', salary: 90000, status: 'active', joinDate: '2023-11-10' },
        ];
      case 'invoices':
        return [
          { id: 1, client: 'Acme Corp', amount: 15000, status: 'paid', date: '2026-03-01', dueDate: '2026-03-15' },
          { id: 2, client: 'Tech Inc', amount: 22000, status: 'pending', date: '2026-03-05', dueDate: '2026-03-20' },
        ];
      case 'candidates':
        return [
          { id: 1, name: 'Alice Brown', position: 'Developer', stage: 'Interview', score: 85 },
          { id: 2, name: 'Charlie Davis', position: 'Designer', stage: 'Offer', score: 92 },
        ];
      default:
        return [];
    }
  }

  /**
   * Apply filters to data
   */
  private static applyFilters(data: any[], filters: ReportFilter[]): any[] {
    return data.filter(item => {
      return filters.every(filter => {
        const value = item[filter.field];
        
        switch (filter.operator) {
          case 'equals':
            return value === filter.value;
          case 'contains':
            return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
          case 'greater_than':
            return value > filter.value;
          case 'less_than':
            return value < filter.value;
          case 'between':
            return value >= filter.value[0] && value <= filter.value[1];
          case 'in':
            return Array.isArray(filter.value) && filter.value.includes(value);
          default:
            return true;
        }
      });
    });
  }

  /**
   * Apply grouping
   */
  private static applyGrouping(data: any[], groupBy: string[], columns: ReportColumn[]): any[] {
    const grouped = new Map<string, any[]>();

    // Group data
    data.forEach(item => {
      const key = groupBy.map(field => item[field]).join('|');
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    });

    // Aggregate grouped data
    const result: any[] = [];
    grouped.forEach((items, key) => {
      const row: any = {};
      
      // Set group by fields
      groupBy.forEach((field, index) => {
        row[field] = items[0][field];
      });

      // Calculate aggregations
      columns.forEach(col => {
        if (col.aggregation) {
          row[col.field] = this.calculateAggregation(
            items.map(i => i[col.field]),
            col.aggregation
          );
        }
      });

      result.push(row);
    });

    return result;
  }

  /**
   * Calculate aggregation
   */
  private static calculateAggregation(values: any[], aggregation: AggregationType): any {
    const numbers = values.filter(v => typeof v === 'number');

    switch (aggregation) {
      case 'count':
        return values.length;
      case 'sum':
        return numbers.reduce((sum, val) => sum + val, 0);
      case 'avg':
        return numbers.length > 0 ? numbers.reduce((sum, val) => sum + val, 0) / numbers.length : 0;
      case 'min':
        return numbers.length > 0 ? Math.min(...numbers) : 0;
      case 'max':
        return numbers.length > 0 ? Math.max(...numbers) : 0;
      case 'distinct':
        return new Set(values).size;
      default:
        return values.length;
    }
  }

  /**
   * Apply sorting
   */
  private static applySorting(data: any[], sortBy: { field: string; direction: 'asc' | 'desc' }): any[] {
    return [...data].sort((a, b) => {
      const aVal = a[sortBy.field];
      const bVal = b[sortBy.field];
      
      if (aVal < bVal) return sortBy.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortBy.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  /**
   * Generate visualization data
   */
  private static generateVisualizationData(data: any[], visualizations: ReportVisualization[]): any {
    const vizData: any = {};

    visualizations.forEach(viz => {
      if (viz.type === 'metric') {
        // Single metric
        const values = data.map(d => d[viz.dataField]);
        vizData[viz.id] = {
          value: viz.aggregation 
            ? this.calculateAggregation(values, viz.aggregation)
            : values.length > 0 ? values[0] : 0
        };
      } else if (viz.type === 'table') {
        vizData[viz.id] = data;
      } else {
        // Chart data
        vizData[viz.id] = data.map(d => ({
          name: d[viz.labelField],
          value: d[viz.dataField]
        }));
      }
    });

    return vizData;
  }

  /**
   * Schedule a report
   */
  static scheduleReport(schedule: Omit<ScheduledReport, 'id' | 'createdAt' | 'lastRun' | 'nextRun'>): ScheduledReport {
    const nextRun = this.calculateNextRun(schedule.schedule);
    
    const scheduledReport: ScheduledReport = {
      ...schedule,
      id: `sched_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      nextRun: nextRun.toISOString()
    };

    this.scheduledReports.set(scheduledReport.id, scheduledReport);
    this.saveToStorage();
    
    toast.success('Report scheduled successfully');
    return scheduledReport;
  }

  /**
   * Calculate next run time for scheduled report
   */
  private static calculateNextRun(schedule: ScheduledReport['schedule']): Date {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);
    const nextRun = new Date(now);
    nextRun.setHours(hours, minutes, 0, 0);

    // If the time today has passed, move to next occurrence
    if (nextRun <= now) {
      switch (schedule.frequency) {
        case 'daily':
          nextRun.setDate(nextRun.getDate() + 1);
          break;
        case 'weekly':
          const daysUntilNext = ((schedule.dayOfWeek || 0) - now.getDay() + 7) % 7 || 7;
          nextRun.setDate(nextRun.getDate() + daysUntilNext);
          break;
        case 'monthly':
          if (schedule.dayOfMonth) {
            nextRun.setMonth(nextRun.getMonth() + 1);
            nextRun.setDate(schedule.dayOfMonth);
          }
          break;
        case 'quarterly':
          nextRun.setMonth(nextRun.getMonth() + 3);
          break;
      }
    }

    return nextRun;
  }

  /**
   * Update scheduled report
   */
  static updateScheduledReport(scheduleId: string, updates: Partial<ScheduledReport>): void {
    const schedule = this.scheduledReports.get(scheduleId);
    if (schedule) {
      const updated = { ...schedule, ...updates };
      
      // Recalculate next run if schedule changed
      if (updates.schedule) {
        updated.nextRun = this.calculateNextRun(updated.schedule).toISOString();
      }
      
      this.scheduledReports.set(scheduleId, updated);
      this.saveToStorage();
      toast.success('Schedule updated');
    }
  }

  /**
   * Delete scheduled report
   */
  static deleteScheduledReport(scheduleId: string): void {
    this.scheduledReports.delete(scheduleId);
    this.saveToStorage();
    toast.success('Schedule deleted');
  }

  /**
   * Get all reports
   */
  static getAllReports(): ReportDefinition[] {
    return Array.from(this.reports.values()).sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /**
   * Get report by id
   */
  static getReport(reportId: string): ReportDefinition | undefined {
    return this.reports.get(reportId);
  }

  /**
   * Get all scheduled reports
   */
  static getAllScheduledReports(): ScheduledReport[] {
    return Array.from(this.scheduledReports.values());
  }

  /**
   * Get generated reports
   */
  static getGeneratedReports(): GeneratedReport[] {
    return Array.from(this.generatedReports.values()).sort((a, b) =>
      new Date(b.summary.generatedAt).getTime() - new Date(a.summary.generatedAt).getTime()
    );
  }

  /**
   * Get report templates
   */
  static getReportTemplates(): Partial<ReportDefinition>[] {
    return [
      {
        name: 'Employee Summary Report',
        description: 'Overview of all employees with key metrics',
        type: 'employee_summary',
        dataSource: 'employees',
        columns: [
          { id: '1', field: 'name', label: 'Name', type: 'text' },
          { id: '2', field: 'department', label: 'Department', type: 'text' },
          { id: '3', field: 'salary', label: 'Salary', type: 'currency', aggregation: 'avg' },
          { id: '4', field: 'status', label: 'Status', type: 'text' }
        ],
        filters: [],
        groupBy: ['department'],
        visualizations: [
          {
            id: 'v1',
            type: 'bar',
            title: 'Employees by Department',
            dataField: 'count',
            labelField: 'department',
            aggregation: 'count'
          }
        ]
      },
      {
        name: 'Financial Analysis',
        description: 'Revenue and invoice analysis',
        type: 'financial_analysis',
        dataSource: 'invoices',
        columns: [
          { id: '1', field: 'client', label: 'Client', type: 'text' },
          { id: '2', field: 'amount', label: 'Amount', type: 'currency', aggregation: 'sum' },
          { id: '3', field: 'status', label: 'Status', type: 'text' },
          { id: '4', field: 'date', label: 'Date', type: 'date' }
        ],
        filters: [],
        visualizations: [
          {
            id: 'v1',
            type: 'pie',
            title: 'Revenue by Status',
            dataField: 'amount',
            labelField: 'status',
            aggregation: 'sum'
          }
        ]
      },
      {
        name: 'Recruitment Pipeline',
        description: 'Track candidates through hiring stages',
        type: 'recruitment_pipeline',
        dataSource: 'candidates',
        columns: [
          { id: '1', field: 'name', label: 'Candidate', type: 'text' },
          { id: '2', field: 'position', label: 'Position', type: 'text' },
          { id: '3', field: 'stage', label: 'Stage', type: 'text' },
          { id: '4', field: 'score', label: 'Score', type: 'number', aggregation: 'avg' }
        ],
        filters: [],
        groupBy: ['stage'],
        visualizations: [
          {
            id: 'v1',
            type: 'bar',
            title: 'Candidates by Stage',
            dataField: 'count',
            labelField: 'stage',
            aggregation: 'count'
          }
        ]
      }
    ];
  }

  /**
   * Save to localStorage
   */
  private static saveToStorage(): void {
    try {
      localStorage.setItem('report_definitions', JSON.stringify(Array.from(this.reports.entries())));
      localStorage.setItem('scheduled_reports', JSON.stringify(Array.from(this.scheduledReports.entries())));
      localStorage.setItem('generated_reports', JSON.stringify(Array.from(this.generatedReports.entries())));
    } catch (error) {
      console.error('Error saving reports:', error);
    }
  }

  /**
   * Load from localStorage
   */
  static loadFromStorage(): void {
    try {
      const reportsData = localStorage.getItem('report_definitions');
      if (reportsData) {
        this.reports = new Map(JSON.parse(reportsData));
      }

      const scheduledData = localStorage.getItem('scheduled_reports');
      if (scheduledData) {
        this.scheduledReports = new Map(JSON.parse(scheduledData));
      }

      const generatedData = localStorage.getItem('generated_reports');
      if (generatedData) {
        this.generatedReports = new Map(JSON.parse(generatedData));
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    }
  }
}

// Load data on initialization
ReportBuilder.loadFromStorage();
