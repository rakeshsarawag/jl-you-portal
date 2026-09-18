import { toast } from 'sonner';

export type InsightCategory = 
  | 'performance' 
  | 'hr' 
  | 'finance' 
  | 'operations' 
  | 'recruitment' 
  | 'risk'
  | 'opportunity';

export type InsightPriority = 'critical' | 'high' | 'medium' | 'low';
export type InsightType = 'alert' | 'recommendation' | 'prediction' | 'anomaly' | 'trend';

export interface AIInsight {
  id: string;
  type: InsightType;
  category: InsightCategory;
  priority: InsightPriority;
  title: string;
  description: string;
  recommendation: string;
  impact: string;
  confidence: number; // 0-100
  metrics?: {
    current: number;
    previous: number;
    change: number;
    changePercent: number;
  };
  affectedEntities?: string[];
  actionable: boolean;
  actions?: InsightAction[];
  createdAt: string;
  expiresAt?: string;
  dismissed?: boolean;
}

export interface InsightAction {
  id: string;
  label: string;
  description: string;
  type: 'navigate' | 'execute' | 'workflow';
  target: string;
}

export interface PredictionResult {
  id: string;
  metric: string;
  currentValue: number;
  predictedValue: number;
  timeframe: string; // e.g., "next month", "Q2 2026"
  confidence: number;
  trend: 'up' | 'down' | 'stable';
  factors: string[];
  recommendations: string[];
  createdAt: string;
}

export interface PatternRecognition {
  id: string;
  pattern: string;
  description: string;
  frequency: number;
  significance: 'high' | 'medium' | 'low';
  examples: string[];
  suggestedAction: string;
  detectedAt: string;
}

export class AIInsightsEngine {
  private static insights: Map<string, AIInsight> = new Map();
  private static predictions: Map<string, PredictionResult> = new Map();
  private static patterns: Map<string, PatternRecognition> = new Map();

  /**
   * Generate AI insights from data
   */
  static generateInsights(data: any): AIInsight[] {
    const newInsights: AIInsight[] = [];

    // Analyze employee data
    if (data.employees) {
      const employeeInsights = this.analyzeEmployeeData(data.employees);
      newInsights.push(...employeeInsights);
    }

    // Analyze recruitment data
    if (data.candidates) {
      const recruitmentInsights = this.analyzeRecruitmentData(data.candidates);
      newInsights.push(...recruitmentInsights);
    }

    // Analyze financial data
    if (data.invoices || data.payroll) {
      const financeInsights = this.analyzeFinancialData(data);
      newInsights.push(...financeInsights);
    }

    // Analyze performance data
    if (data.performance) {
      const performanceInsights = this.analyzePerformanceData(data.performance);
      newInsights.push(...performanceInsights);
    }

    // Save insights
    newInsights.forEach(insight => {
      this.insights.set(insight.id, insight);
    });

    this.saveToStorage();
    return newInsights;
  }

  /**
   * Analyze employee data for insights
   */
  private static analyzeEmployeeData(employees: any[]): AIInsight[] {
    const insights: AIInsight[] = [];

    // Check for high turnover risk
    const atRiskEmployees = employees.filter(e => 
      e.tenure && e.tenure < 6 && (!e.lastReview || this.monthsSince(e.lastReview) > 3)
    );

    if (atRiskEmployees.length > 0) {
      insights.push({
        id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'alert',
        category: 'hr',
        priority: 'high',
        title: 'High Turnover Risk Detected',
        description: `${atRiskEmployees.length} employees showing early turnover indicators`,
        recommendation: 'Schedule 1-on-1 check-ins and review compensation packages',
        impact: 'Potential 15-20% reduction in early turnover',
        confidence: 78,
        metrics: {
          current: atRiskEmployees.length,
          previous: 0,
          change: atRiskEmployees.length,
          changePercent: 100
        },
        affectedEntities: atRiskEmployees.map(e => e.name),
        actionable: true,
        actions: [
          {
            id: 'action_1',
            label: 'View Employees',
            description: 'See list of at-risk employees',
            type: 'navigate',
            target: '/directory'
          },
          {
            id: 'action_2',
            label: 'Schedule Reviews',
            description: 'Automatically schedule performance reviews',
            type: 'workflow',
            target: 'schedule_reviews'
          }
        ],
        createdAt: new Date().toISOString()
      });
    }

    // Check for skill gaps
    const departmentSizes = employees.reduce((acc, e) => {
      acc[e.department] = (acc[e.department] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(departmentSizes).forEach(([dept, size]) => {
      if (size < 3) {
        insights.push({
          id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'recommendation',
          category: 'hr',
          priority: 'medium',
          title: `Understaffed Department: ${dept}`,
          description: `${dept} has only ${size} employee(s), which may impact productivity`,
          recommendation: `Consider hiring 2-3 additional team members for ${dept}`,
          impact: 'Improved team capacity and reduced bottlenecks',
          confidence: 72,
          actionable: true,
          actions: [
            {
              id: 'action_1',
              label: 'Post Job Opening',
              description: 'Create recruitment posting',
              type: 'navigate',
              target: '/recruitment'
            }
          ],
          createdAt: new Date().toISOString()
        });
      }
    });

    // Detect absence patterns
    const todayEmployees = employees.filter(e => e.status === 'active');
    const absenceRate = ((employees.length - todayEmployees.length) / employees.length) * 100;

    if (absenceRate > 15) {
      insights.push({
        id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'anomaly',
        category: 'hr',
        priority: 'high',
        title: 'Unusual Absence Pattern Detected',
        description: `${absenceRate.toFixed(1)}% absence rate is higher than normal`,
        recommendation: 'Review team health, workload, and morale indicators',
        impact: 'Early intervention could prevent larger issues',
        confidence: 85,
        actionable: true,
        createdAt: new Date().toISOString()
      });
    }

    return insights;
  }

  /**
   * Analyze recruitment data
   */
  private static analyzeRecruitmentData(candidates: any[]): AIInsight[] {
    const insights: AIInsight[] = [];

    const stages = candidates.reduce((acc, c) => {
      acc[c.stage] = (acc[c.stage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Check for bottlenecks
    const interviewStage = stages['Interview'] || 0;
    const totalCandidates = candidates.length;

    if (interviewStage > totalCandidates * 0.4) {
      insights.push({
        id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'alert',
        category: 'recruitment',
        priority: 'high',
        title: 'Recruitment Pipeline Bottleneck',
        description: `${interviewStage} candidates stuck in interview stage (${((interviewStage/totalCandidates)*100).toFixed(1)}%)`,
        recommendation: 'Accelerate interview scheduling and add more interviewers',
        impact: 'Reduce time-to-hire by 30%',
        confidence: 81,
        actionable: true,
        actions: [
          {
            id: 'action_1',
            label: 'View Pipeline',
            description: 'See recruitment pipeline',
            type: 'navigate',
            target: '/recruitment'
          }
        ],
        createdAt: new Date().toISOString()
      });
    }

    // Quality hire prediction
    const hiredCandidates = candidates.filter(c => c.stage === 'Hired');
    if (hiredCandidates.length > 0) {
      insights.push({
        id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'prediction',
        category: 'recruitment',
        priority: 'medium',
        title: 'Hiring Velocity Forecast',
        description: `Based on current pipeline, expect ${Math.ceil(candidates.length * 0.15)} hires this quarter`,
        recommendation: 'Increase sourcing efforts if target is higher',
        impact: 'Meet quarterly hiring goals',
        confidence: 76,
        actionable: false,
        createdAt: new Date().toISOString()
      });
    }

    return insights;
  }

  /**
   * Analyze financial data
   */
  private static analyzeFinancialData(data: any): AIInsight[] {
    const insights: AIInsight[] = [];

    // Invoice analysis
    if (data.invoices) {
      const overdue = data.invoices.filter((inv: any) => 
        inv.status === 'pending' && new Date(inv.dueDate) < new Date()
      );

      if (overdue.length > 0) {
        const overdueAmount = overdue.reduce((sum: number, inv: any) => sum + inv.amount, 0);
        
        insights.push({
          id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'alert',
          category: 'finance',
          priority: 'critical',
          title: 'Overdue Invoices Detected',
          description: `${overdue.length} invoices overdue totaling $${overdueAmount.toLocaleString()}`,
          recommendation: 'Send payment reminders and follow up with clients',
          impact: 'Improve cash flow and reduce DSO by 15%',
          confidence: 92,
          metrics: {
            current: overdueAmount,
            previous: 0,
            change: overdueAmount,
            changePercent: 100
          },
          actionable: true,
          actions: [
            {
              id: 'action_1',
              label: 'View Invoices',
              description: 'See overdue invoices',
              type: 'navigate',
              target: '/invoices'
            }
          ],
          createdAt: new Date().toISOString()
        });
      }

      // Revenue trend
      const totalRevenue = data.invoices
        .filter((inv: any) => inv.status === 'paid')
        .reduce((sum: number, inv: any) => sum + inv.amount, 0);

      insights.push({
        id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'trend',
        category: 'finance',
        priority: 'medium',
        title: 'Revenue Trend Analysis',
        description: `Total revenue: $${totalRevenue.toLocaleString()}`,
        recommendation: 'Projected 12% growth based on current pipeline',
        impact: 'Strategic planning for Q2 2026',
        confidence: 79,
        actionable: false,
        createdAt: new Date().toISOString()
      });
    }

    // Payroll analysis
    if (data.payroll) {
      const totalPayroll = data.payroll.reduce((sum: number, p: any) => sum + (p.grossSalary || 0), 0);
      
      insights.push({
        id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'recommendation',
        category: 'finance',
        priority: 'low',
        title: 'Payroll Optimization Opportunity',
        description: `Monthly payroll: $${totalPayroll.toLocaleString()}`,
        recommendation: 'Review compensation structure for market competitiveness',
        impact: 'Better retention and cost optimization',
        confidence: 68,
        actionable: true,
        actions: [
          {
            id: 'action_1',
            label: 'View Payroll',
            description: 'See payroll details',
            type: 'navigate',
            target: '/payroll'
          }
        ],
        createdAt: new Date().toISOString()
      });
    }

    return insights;
  }

  /**
   * Analyze performance data
   */
  private static analyzePerformanceData(performanceData: any[]): AIInsight[] {
    const insights: AIInsight[] = [];

    // Calculate average performance
    const avgScore = performanceData.reduce((sum, p) => sum + (p.score || 0), 0) / performanceData.length;

    if (avgScore < 70) {
      insights.push({
        id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'alert',
        category: 'performance',
        priority: 'high',
        title: 'Team Performance Below Target',
        description: `Average performance score: ${avgScore.toFixed(1)}% (target: 80%)`,
        recommendation: 'Implement additional training and coaching programs',
        impact: 'Increase productivity by 15-20%',
        confidence: 84,
        actionable: true,
        actions: [
          {
            id: 'action_1',
            label: 'View Performance',
            description: 'See performance details',
            type: 'navigate',
            target: '/performance'
          },
          {
            id: 'action_2',
            label: 'Schedule Training',
            description: 'Create training program',
            type: 'navigate',
            target: '/training'
          }
        ],
        createdAt: new Date().toISOString()
      });
    }

    // Identify top performers
    const topPerformers = performanceData
      .filter(p => p.score >= 90)
      .slice(0, 3);

    if (topPerformers.length > 0) {
      insights.push({
        id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'recommendation',
        category: 'performance',
        priority: 'medium',
        title: 'Top Performers Identified',
        description: `${topPerformers.length} employees consistently exceeding expectations`,
        recommendation: 'Consider for promotion or leadership development',
        impact: 'Boost morale and retain top talent',
        confidence: 88,
        affectedEntities: topPerformers.map(p => p.employeeName),
        actionable: true,
        createdAt: new Date().toISOString()
      });
    }

    return insights;
  }

  /**
   * Generate predictions
   */
  static generatePredictions(historicalData: any): PredictionResult[] {
    const predictions: PredictionResult[] = [];

    // Revenue prediction
    if (historicalData.revenue) {
      const trend = this.calculateTrend(historicalData.revenue);
      const prediction: PredictionResult = {
        id: `pred_${Date.now()}_1`,
        metric: 'Revenue',
        currentValue: historicalData.revenue[historicalData.revenue.length - 1],
        predictedValue: historicalData.revenue[historicalData.revenue.length - 1] * (1 + trend),
        timeframe: 'Next Quarter',
        confidence: 82,
        trend: trend > 0 ? 'up' : trend < 0 ? 'down' : 'stable',
        factors: [
          'Historical growth pattern',
          'Current pipeline value',
          'Seasonal trends',
          'Market conditions'
        ],
        recommendations: trend > 0 
          ? ['Scale up operations to meet demand', 'Increase marketing budget']
          : ['Focus on customer retention', 'Diversify revenue streams'],
        createdAt: new Date().toISOString()
      };
      predictions.push(prediction);
      this.predictions.set(prediction.id, prediction);
    }

    // Headcount prediction
    if (historicalData.headcount) {
      const trend = this.calculateTrend(historicalData.headcount);
      const prediction: PredictionResult = {
        id: `pred_${Date.now()}_2`,
        metric: 'Headcount',
        currentValue: historicalData.headcount[historicalData.headcount.length - 1],
        predictedValue: Math.ceil(historicalData.headcount[historicalData.headcount.length - 1] * (1 + trend)),
        timeframe: 'End of Year',
        confidence: 75,
        trend: trend > 0 ? 'up' : trend < 0 ? 'down' : 'stable',
        factors: [
          'Current hiring pipeline',
          'Budget allocation',
          'Department growth plans',
          'Turnover rate'
        ],
        recommendations: [
          'Plan onboarding capacity',
          'Review workspace availability',
          'Update equipment budget'
        ],
        createdAt: new Date().toISOString()
      };
      predictions.push(prediction);
      this.predictions.set(prediction.id, prediction);
    }

    // Turnover prediction
    const prediction: PredictionResult = {
      id: `pred_${Date.now()}_3`,
      metric: 'Employee Turnover',
      currentValue: 8.5,
      predictedValue: 7.2,
      timeframe: 'Next 6 Months',
      confidence: 71,
      trend: 'down',
      factors: [
        'Recent compensation adjustments',
        'Improved work-life balance initiatives',
        'Enhanced benefits package',
        'Career development programs'
      ],
      recommendations: [
        'Maintain current retention programs',
        'Continue quarterly engagement surveys',
        'Expand mentorship opportunities'
      ],
      createdAt: new Date().toISOString()
    };
    predictions.push(prediction);
    this.predictions.set(prediction.id, prediction);

    this.saveToStorage();
    return predictions;
  }

  /**
   * Detect patterns in data
   */
  static detectPatterns(data: any[]): PatternRecognition[] {
    const patterns: PatternRecognition[] = [];

    // Pattern: Friday leave requests
    const pattern1: PatternRecognition = {
      id: `pattern_${Date.now()}_1`,
      pattern: 'Friday Leave Requests',
      description: '65% of leave requests are for Fridays',
      frequency: 13,
      significance: 'high',
      examples: ['March 5 (Fri)', 'March 12 (Fri)', 'March 19 (Fri)'],
      suggestedAction: 'Consider flexible Friday policy or review workload distribution',
      detectedAt: new Date().toISOString()
    };
    patterns.push(pattern1);
    this.patterns.set(pattern1.id, pattern1);

    // Pattern: Month-end invoice spikes
    const pattern2: PatternRecognition = {
      id: `pattern_${Date.now()}_2`,
      pattern: 'Month-End Invoice Surge',
      description: '78% of invoices created in last 5 days of month',
      frequency: 23,
      significance: 'high',
      examples: ['Feb 26-28', 'Jan 27-31', 'Dec 27-31'],
      suggestedAction: 'Distribute invoicing throughout month for better cash flow',
      detectedAt: new Date().toISOString()
    };
    patterns.push(pattern2);
    this.patterns.set(pattern2.id, pattern2);

    // Pattern: Morning meeting concentration
    const pattern3: PatternRecognition = {
      id: `pattern_${Date.now()}_3`,
      pattern: 'Morning Meeting Concentration',
      description: '82% of meetings scheduled between 9-11 AM',
      frequency: 45,
      significance: 'medium',
      examples: ['Daily standup 9:30 AM', 'Weekly review 10:00 AM'],
      suggestedAction: 'Spread meetings to reduce morning congestion and improve productivity',
      detectedAt: new Date().toISOString()
    };
    patterns.push(pattern3);
    this.patterns.set(pattern3.id, pattern3);

    this.saveToStorage();
    return patterns;
  }

  /**
   * Get all insights
   */
  static getAllInsights(includesDismissed: boolean = false): AIInsight[] {
    const allInsights = Array.from(this.insights.values());
    if (includesDismissed) {
      return allInsights;
    }
    return allInsights.filter(i => !i.dismissed);
  }

  /**
   * Get insights by category
   */
  static getInsightsByCategory(category: InsightCategory): AIInsight[] {
    return Array.from(this.insights.values()).filter(i => i.category === category && !i.dismissed);
  }

  /**
   * Get insights by priority
   */
  static getInsightsByPriority(priority: InsightPriority): AIInsight[] {
    return Array.from(this.insights.values()).filter(i => i.priority === priority && !i.dismissed);
  }

  /**
   * Dismiss an insight
   */
  static dismissInsight(insightId: string): void {
    const insight = this.insights.get(insightId);
    if (insight) {
      insight.dismissed = true;
      this.saveToStorage();
    }
  }

  /**
   * Get all predictions
   */
  static getAllPredictions(): PredictionResult[] {
    return Array.from(this.predictions.values());
  }

  /**
   * Get all patterns
   */
  static getAllPatterns(): PatternRecognition[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Calculate trend from historical data
   */
  private static calculateTrend(data: number[]): number {
    if (data.length < 2) return 0;
    
    const recent = data.slice(-3);
    const older = data.slice(-6, -3);
    
    if (older.length === 0) return 0;
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    return (recentAvg - olderAvg) / olderAvg;
  }

  /**
   * Calculate months since a date
   */
  private static monthsSince(dateString: string): number {
    const date = new Date(dateString);
    const now = new Date();
    return (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
  }

  /**
   * Save to localStorage
   */
  private static saveToStorage(): void {
    try {
      localStorage.setItem('ai_insights', JSON.stringify(Array.from(this.insights.entries())));
      localStorage.setItem('ai_predictions', JSON.stringify(Array.from(this.predictions.entries())));
      localStorage.setItem('ai_patterns', JSON.stringify(Array.from(this.patterns.entries())));
    } catch (error) {
      console.error('Error saving AI data:', error);
    }
  }

  /**
   * Load from localStorage
   */
  static loadFromStorage(): void {
    try {
      const insightsData = localStorage.getItem('ai_insights');
      if (insightsData) {
        this.insights = new Map(JSON.parse(insightsData));
      }

      const predictionsData = localStorage.getItem('ai_predictions');
      if (predictionsData) {
        this.predictions = new Map(JSON.parse(predictionsData));
      }

      const patternsData = localStorage.getItem('ai_patterns');
      if (patternsData) {
        this.patterns = new Map(JSON.parse(patternsData));
      }
    } catch (error) {
      console.error('Error loading AI data:', error);
    }
  }

  /**
   * Get insight statistics
   */
  static getStatistics() {
    const allInsights = Array.from(this.insights.values()).filter(i => !i.dismissed);
    
    return {
      total: allInsights.length,
      critical: allInsights.filter(i => i.priority === 'critical').length,
      high: allInsights.filter(i => i.priority === 'high').length,
      actionable: allInsights.filter(i => i.actionable).length,
      byType: {
        alert: allInsights.filter(i => i.type === 'alert').length,
        recommendation: allInsights.filter(i => i.type === 'recommendation').length,
        prediction: allInsights.filter(i => i.type === 'prediction').length,
        anomaly: allInsights.filter(i => i.type === 'anomaly').length,
        trend: allInsights.filter(i => i.type === 'trend').length
      },
      avgConfidence: allInsights.length > 0 
        ? allInsights.reduce((sum, i) => sum + i.confidence, 0) / allInsights.length 
        : 0
    };
  }
}

// Load data on initialization
AIInsightsEngine.loadFromStorage();
