export type RecommendationType = 
  | 'hiring' 
  | 'training' 
  | 'promotion' 
  | 'workflow' 
  | 'cost_optimization'
  | 'productivity'
  | 'retention';

export interface SmartRecommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  rationale: string;
  expectedImpact: string;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  estimatedROI?: string;
  timeToImplement?: string;
  resources?: string[];
  steps?: string[];
  relatedData?: any;
  createdAt: string;
  accepted?: boolean;
  dismissed?: boolean;
}

export class SmartRecommendations {
  private static recommendations: Map<string, SmartRecommendation> = new Map();

  /**
   * Generate smart recommendations based on data
   */
  static generateRecommendations(contextData: any): SmartRecommendation[] {
    const recommendations: SmartRecommendation[] = [];

    // Hiring recommendations
    if (contextData.departments) {
      const hiringRecs = this.analyzeHiringNeeds(contextData.departments);
      recommendations.push(...hiringRecs);
    }

    // Training recommendations
    if (contextData.performance) {
      const trainingRecs = this.analyzeTrainingNeeds(contextData.performance);
      recommendations.push(...trainingRecs);
    }

    // Promotion recommendations
    if (contextData.employees) {
      const promotionRecs = this.analyzePromotionOpportunities(contextData.employees);
      recommendations.push(...promotionRecs);
    }

    // Workflow optimization
    if (contextData.processes) {
      const workflowRecs = this.analyzeWorkflowOptimization(contextData.processes);
      recommendations.push(...workflowRecs);
    }

    // Cost optimization
    if (contextData.expenses) {
      const costRecs = this.analyzeCostOptimization(contextData.expenses);
      recommendations.push(...costRecs);
    }

    // Save recommendations
    recommendations.forEach(rec => {
      this.recommendations.set(rec.id, rec);
    });

    this.saveToStorage();
    return recommendations;
  }

  /**
   * Analyze hiring needs
   */
  private static analyzeHiringNeeds(departments: any[]): SmartRecommendation[] {
    const recommendations: SmartRecommendation[] = [];

    departments.forEach(dept => {
      if (dept.employeeCount < dept.optimalSize * 0.7) {
        recommendations.push({
          id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'hiring',
          title: `Expand ${dept.name} Team`,
          description: `${dept.name} is operating at ${((dept.employeeCount / dept.optimalSize) * 100).toFixed(0)}% capacity`,
          rationale: `Team size is below optimal threshold. Current workload indicates need for ${dept.optimalSize - dept.employeeCount} additional team members.`,
          expectedImpact: `Increase team productivity by 35%, reduce burnout risk by 40%`,
          priority: 'high',
          confidence: 85,
          estimatedROI: '250% within 12 months',
          timeToImplement: '2-3 months',
          resources: ['Recruitment budget: $80,000', 'Onboarding coordinator', 'Team leads for interviews'],
          steps: [
            '1. Define job descriptions and requirements',
            '2. Post positions on job boards',
            '3. Screen and interview candidates',
            '4. Make offers and onboard new hires'
          ],
          createdAt: new Date().toISOString()
        });
      }
    });

    return recommendations;
  }

  /**
   * Analyze training needs
   */
  private static analyzeTrainingNeeds(performanceData: any[]): SmartRecommendation[] {
    const recommendations: SmartRecommendation[] = [];

    // Identify skill gaps
    const lowPerformers = performanceData.filter(p => p.score < 70);
    
    if (lowPerformers.length > performanceData.length * 0.2) {
      const skillGaps = this.identifySkillGaps(lowPerformers);
      
      recommendations.push({
        id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'training',
        title: `Launch ${skillGaps[0]} Training Program`,
        description: `${lowPerformers.length} employees showing skill gaps in ${skillGaps.join(', ')}`,
        rationale: `Performance data indicates systematic skill gaps that can be addressed through targeted training.`,
        expectedImpact: `Improve average performance scores by 15-20%, boost team confidence`,
        priority: 'high',
        confidence: 82,
        estimatedROI: '180% within 6 months',
        timeToImplement: '1-2 months',
        resources: [
          'Training platform subscription: $5,000/year',
          'Expert trainers or courses',
          'Employee time allocation: 4 hours/week'
        ],
        steps: [
          '1. Assess detailed skill gaps per employee',
          '2. Design or source training curriculum',
          '3. Schedule training sessions',
          '4. Track progress and measure improvement',
          '5. Provide certification upon completion'
        ],
        relatedData: { affectedEmployees: lowPerformers.length, skills: skillGaps },
        createdAt: new Date().toISOString()
      });
    }

    return recommendations;
  }

  /**
   * Analyze promotion opportunities
   */
  private static analyzePromotionOpportunities(employees: any[]): SmartRecommendation[] {
    const recommendations: SmartRecommendation[] = [];

    const promotionCandidates = employees.filter(e => 
      e.performance >= 90 && 
      e.tenure >= 18 && 
      !e.recentPromotion
    );

    if (promotionCandidates.length > 0) {
      promotionCandidates.slice(0, 3).forEach(candidate => {
        recommendations.push({
          id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'promotion',
          title: `Promote ${candidate.name} to Senior Role`,
          description: `${candidate.name} consistently exceeds expectations and shows leadership potential`,
          rationale: `Performance score: ${candidate.performance}%, tenure: ${candidate.tenure} months. Demonstrates leadership qualities and technical expertise.`,
          expectedImpact: `Boost morale, retain top talent, develop internal leadership pipeline`,
          priority: 'high',
          confidence: 88,
          estimatedROI: 'Retention of high performer worth 3x salary',
          timeToImplement: '2-4 weeks',
          resources: [
            `Salary increase: $${(candidate.salary * 0.15).toLocaleString()}`,
            'Leadership training program',
            'Mentorship from executive team'
          ],
          steps: [
            '1. Discuss career aspirations with employee',
            '2. Define new role responsibilities',
            '3. Prepare promotion package and announcement',
            '4. Transition to new role with support'
          ],
          relatedData: { employee: candidate },
          createdAt: new Date().toISOString()
        });
      });
    }

    return recommendations;
  }

  /**
   * Analyze workflow optimization
   */
  private static analyzeWorkflowOptimization(processes: any[]): SmartRecommendation[] {
    const recommendations: SmartRecommendation[] = [];

    // Identify manual processes that could be automated
    const manualProcesses = processes.filter(p => !p.automated && p.frequency === 'high');

    if (manualProcesses.length > 0) {
      recommendations.push({
        id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'workflow',
        title: `Automate ${manualProcesses[0].name}`,
        description: `This high-frequency process is currently manual and can be automated`,
        rationale: `Process occurs ${manualProcesses[0].occurrences || 20}+ times per month, taking average of 30 minutes each time.`,
        expectedImpact: `Save 10+ hours per month, reduce errors by 80%, improve turnaround time by 60%`,
        priority: 'medium',
        confidence: 79,
        estimatedROI: '340% in first year',
        timeToImplement: '1-2 weeks',
        resources: [
          'Workflow automation tool (already available)',
          'Process documentation: 2 hours',
          'Workflow setup: 4 hours'
        ],
        steps: [
          '1. Map current process flow',
          '2. Design automated workflow',
          '3. Test with sample data',
          '4. Train team on new process',
          '5. Monitor and refine'
        ],
        createdAt: new Date().toISOString()
      });
    }

    return recommendations;
  }

  /**
   * Analyze cost optimization
   */
  private static analyzeCostOptimization(expenses: any[]): SmartRecommendation[] {
    const recommendations: SmartRecommendation[] = [];

    // Look for subscription overlap
    const subscriptions = expenses.filter(e => e.type === 'subscription');
    const duplicates = this.findDuplicateSubscriptions(subscriptions);

    if (duplicates.length > 0) {
      const savingsAmount = duplicates.reduce((sum, d) => sum + d.amount, 0);
      
      recommendations.push({
        id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'cost_optimization',
        title: `Consolidate Duplicate Subscriptions`,
        description: `${duplicates.length} overlapping subscriptions identified`,
        rationale: `Multiple subscriptions provide similar functionality, creating unnecessary cost.`,
        expectedImpact: `Save $${savingsAmount.toLocaleString()}/month by consolidating to single platform`,
        priority: 'medium',
        confidence: 76,
        estimatedROI: `$${(savingsAmount * 12).toLocaleString()}/year`,
        timeToImplement: '2-3 weeks',
        resources: [
          'IT team for migration',
          'Stakeholder buy-in',
          'Training for new consolidated platform'
        ],
        steps: [
          '1. Compare features of all subscriptions',
          '2. Select best comprehensive platform',
          '3. Plan migration timeline',
          '4. Cancel redundant subscriptions',
          '5. Train team on consolidated tool'
        ],
        relatedData: { duplicateServices: duplicates },
        createdAt: new Date().toISOString()
      });
    }

    return recommendations;
  }

  /**
   * Identify skill gaps
   */
  private static identifySkillGaps(lowPerformers: any[]): string[] {
    // This would normally analyze detailed performance data
    // For now, return common skill gaps
    return ['Technical Skills', 'Communication', 'Time Management'];
  }

  /**
   * Find duplicate subscriptions
   */
  private static findDuplicateSubscriptions(subscriptions: any[]): any[] {
    // Simplified duplicate detection
    const categories = subscriptions.reduce((acc, sub) => {
      const category = sub.category || 'other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(sub);
      return acc;
    }, {} as Record<string, any[]>);

    const duplicates: any[] = [];
    Object.values(categories).forEach(subs => {
      if (subs.length > 1) {
        // Keep the cheapest, mark others as duplicates
        const sorted = subs.sort((a, b) => a.amount - b.amount);
        duplicates.push(...sorted.slice(1));
      }
    });

    return duplicates;
  }

  /**
   * Get all recommendations
   */
  static getAllRecommendations(includeProcessed: boolean = false): SmartRecommendation[] {
    const allRecs = Array.from(this.recommendations.values());
    
    if (includeProcessed) {
      return allRecs;
    }
    
    return allRecs.filter(r => !r.accepted && !r.dismissed);
  }

  /**
   * Get recommendations by type
   */
  static getRecommendationsByType(type: RecommendationType): SmartRecommendation[] {
    return Array.from(this.recommendations.values())
      .filter(r => r.type === type && !r.accepted && !r.dismissed);
  }

  /**
   * Accept a recommendation
   */
  static acceptRecommendation(recId: string): void {
    const rec = this.recommendations.get(recId);
    if (rec) {
      rec.accepted = true;
      this.saveToStorage();
    }
  }

  /**
   * Dismiss a recommendation
   */
  static dismissRecommendation(recId: string): void {
    const rec = this.recommendations.get(recId);
    if (rec) {
      rec.dismissed = true;
      this.saveToStorage();
    }
  }

  /**
   * Get recommendation statistics
   */
  static getStatistics() {
    const allRecs = Array.from(this.recommendations.values());
    const active = allRecs.filter(r => !r.accepted && !r.dismissed);

    return {
      total: allRecs.length,
      active: active.length,
      accepted: allRecs.filter(r => r.accepted).length,
      dismissed: allRecs.filter(r => r.dismissed).length,
      byType: {
        hiring: active.filter(r => r.type === 'hiring').length,
        training: active.filter(r => r.type === 'training').length,
        promotion: active.filter(r => r.type === 'promotion').length,
        workflow: active.filter(r => r.type === 'workflow').length,
        cost_optimization: active.filter(r => r.type === 'cost_optimization').length,
        productivity: active.filter(r => r.type === 'productivity').length,
        retention: active.filter(r => r.type === 'retention').length
      },
      highPriority: active.filter(r => r.priority === 'high').length,
      avgConfidence: active.length > 0
        ? active.reduce((sum, r) => sum + r.confidence, 0) / active.length
        : 0
    };
  }

  /**
   * Save to localStorage
   */
  private static saveToStorage(): void {
    try {
      localStorage.setItem('smart_recommendations', JSON.stringify(Array.from(this.recommendations.entries())));
    } catch (error) {
      console.error('Error saving recommendations:', error);
    }
  }

  /**
   * Load from localStorage
   */
  static loadFromStorage(): void {
    try {
      const data = localStorage.getItem('smart_recommendations');
      if (data) {
        this.recommendations = new Map(JSON.parse(data));
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
    }
  }
}

// Load data on initialization
SmartRecommendations.loadFromStorage();
