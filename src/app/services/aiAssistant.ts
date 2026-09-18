import { toast } from 'sonner';

export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageType = 'text' | 'action' | 'data' | 'suggestion';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  type: MessageType;
  content: string;
  timestamp: string;
  metadata?: any;
  actions?: ChatAction[];
}

export interface ChatAction {
  id: string;
  label: string;
  type: 'navigate' | 'execute' | 'query';
  target: string;
}

export interface QueryResult {
  query: string;
  results: any[];
  suggestions: string[];
  confidence: number;
}

export interface AIResponse {
  message: string;
  type: MessageType;
  data?: any;
  actions?: ChatAction[];
  suggestions?: string[];
}

export class AIAssistant {
  private static conversations: Map<string, ChatMessage[]> = new Map();
  private static currentConversation: string = 'default';

  /**
   * Process user message and generate AI response
   */
  static async processMessage(userMessage: string): Promise<AIResponse> {
    // Analyze the message intent
    const intent = this.analyzeIntent(userMessage);
    
    // Generate response based on intent
    let response: AIResponse;

    switch (intent.type) {
      case 'query_employees':
        response = this.handleEmployeeQuery(userMessage, intent);
        break;
      case 'query_performance':
        response = this.handlePerformanceQuery(userMessage, intent);
        break;
      case 'query_finance':
        response = this.handleFinanceQuery(userMessage, intent);
        break;
      case 'query_recruitment':
        response = this.handleRecruitmentQuery(userMessage, intent);
        break;
      case 'create_workflow':
        response = this.handleWorkflowCreation(userMessage, intent);
        break;
      case 'generate_report':
        response = this.handleReportGeneration(userMessage, intent);
        break;
      case 'navigation':
        response = this.handleNavigation(userMessage, intent);
        break;
      case 'help':
        response = this.handleHelp(userMessage, intent);
        break;
      default:
        response = this.handleGeneral(userMessage);
    }

    // Add messages to conversation
    this.addMessage({
      role: 'user',
      type: 'text',
      content: userMessage
    });

    this.addMessage({
      role: 'assistant',
      type: response.type,
      content: response.message,
      metadata: response.data,
      actions: response.actions
    });

    return response;
  }

  /**
   * Analyze message intent using NLP patterns
   */
  private static analyzeIntent(message: string): { type: string; entities: any } {
    const lowerMessage = message.toLowerCase();

    // Query patterns
    if (this.matchesPattern(lowerMessage, ['how many', 'count', 'total', 'number of']) && 
        this.matchesPattern(lowerMessage, ['employee', 'staff', 'people', 'team'])) {
      return { type: 'query_employees', entities: { count: true } };
    }

    if (this.matchesPattern(lowerMessage, ['performance', 'rating', 'score', 'evaluation'])) {
      return { type: 'query_performance', entities: {} };
    }

    if (this.matchesPattern(lowerMessage, ['revenue', 'invoice', 'payment', 'salary', 'payroll', 'finance', 'cost'])) {
      return { type: 'query_finance', entities: {} };
    }

    if (this.matchesPattern(lowerMessage, ['candidate', 'hiring', 'recruitment', 'applicant', 'interview'])) {
      return { type: 'query_recruitment', entities: {} };
    }

    // Action patterns
    if (this.matchesPattern(lowerMessage, ['create', 'start', 'new']) && 
        this.matchesPattern(lowerMessage, ['workflow', 'automation', 'process'])) {
      return { type: 'create_workflow', entities: {} };
    }

    if (this.matchesPattern(lowerMessage, ['generate', 'create', 'make']) && 
        this.matchesPattern(lowerMessage, ['report', 'summary', 'analysis'])) {
      return { type: 'generate_report', entities: {} };
    }

    // Navigation patterns
    if (this.matchesPattern(lowerMessage, ['go to', 'open', 'show', 'navigate', 'take me to'])) {
      return { type: 'navigation', entities: this.extractNavigationTarget(lowerMessage) };
    }

    // Help patterns
    if (this.matchesPattern(lowerMessage, ['help', 'how do', 'how can', 'what is', 'explain'])) {
      return { type: 'help', entities: {} };
    }

    return { type: 'general', entities: {} };
  }

  /**
   * Check if message matches any of the patterns
   */
  private static matchesPattern(message: string, patterns: string[]): boolean {
    return patterns.some(pattern => message.includes(pattern));
  }

  /**
   * Extract navigation target from message
   */
  private static extractNavigationTarget(message: string): { target: string } {
    const targets: Record<string, string> = {
      'dashboard': '/dashboard',
      'employee': '/directory',
      'employees': '/directory',
      'directory': '/directory',
      'performance': '/performance',
      'recruitment': '/recruitment',
      'invoice': '/invoices',
      'invoices': '/invoices',
      'payroll': '/payroll',
      'training': '/training',
      'project': '/projects',
      'projects': '/projects',
      'workflow': '/workflow-dashboard',
      'workflows': '/workflow-dashboard',
      'analytics': '/executive-dashboard',
      'reports': '/executive-dashboard'
    };

    for (const [key, path] of Object.entries(targets)) {
      if (message.includes(key)) {
        return { target: path };
      }
    }

    return { target: '/' };
  }

  /**
   * Handle employee queries
   */
  private static handleEmployeeQuery(message: string, intent: any): AIResponse {
    // Simulate data retrieval
    const totalEmployees = this.getEmployeeCount();
    const departments = this.getDepartmentBreakdown();

    return {
      message: `We currently have **${totalEmployees} employees** across the organization.\n\nHere's the breakdown by department:\n${departments.map(d => `• ${d.name}: ${d.count} employees`).join('\n')}\n\nWould you like to see more details?`,
      type: 'data',
      data: { totalEmployees, departments },
      actions: [
        {
          id: 'action_1',
          label: 'View Employee Directory',
          type: 'navigate',
          target: '/directory'
        },
        {
          id: 'action_2',
          label: 'Generate HR Report',
          type: 'execute',
          target: 'generate_hr_report'
        }
      ],
      suggestions: [
        'Show me employees by department',
        'Who are the newest employees?',
        'What\'s the average tenure?'
      ]
    };
  }

  /**
   * Handle performance queries
   */
  private static handlePerformanceQuery(message: string, intent: any): AIResponse {
    const avgScore = 82.5;
    const topPerformers = 12;

    return {
      message: `**Performance Overview:**\n\n• Average team score: **${avgScore}%**\n• ${topPerformers} employees rated as "Excellent"\n• 3 employees need improvement plans\n\nPerformance is trending positively with a 5% improvement over last quarter.`,
      type: 'data',
      data: { avgScore, topPerformers },
      actions: [
        {
          id: 'action_1',
          label: 'View Performance Dashboard',
          type: 'navigate',
          target: '/performance'
        },
        {
          id: 'action_2',
          label: 'Schedule Reviews',
          type: 'execute',
          target: 'schedule_reviews'
        }
      ],
      suggestions: [
        'Show top performers',
        'Who needs improvement?',
        'Schedule performance reviews'
      ]
    };
  }

  /**
   * Handle finance queries
   */
  private static handleFinanceQuery(message: string, intent: any): AIResponse {
    const totalRevenue = 450000;
    const pendingInvoices = 12;
    const overdueAmount = 28500;

    return {
      message: `**Financial Summary:**\n\n• Total Revenue (MTD): **$${totalRevenue.toLocaleString()}**\n• Pending Invoices: ${pendingInvoices}\n• Overdue Amount: $${overdueAmount.toLocaleString()}\n\n💡 **Insight:** 3 high-value invoices are overdue. Immediate follow-up recommended.`,
      type: 'data',
      data: { totalRevenue, pendingInvoices, overdueAmount },
      actions: [
        {
          id: 'action_1',
          label: 'View Invoices',
          type: 'navigate',
          target: '/invoices'
        },
        {
          id: 'action_2',
          label: 'Send Payment Reminders',
          type: 'execute',
          target: 'send_reminders'
        }
      ],
      suggestions: [
        'Show overdue invoices',
        'Generate financial report',
        'What\'s our cash flow?'
      ]
    };
  }

  /**
   * Handle recruitment queries
   */
  private static handleRecruitmentQuery(message: string, intent: any): AIResponse {
    const activeCandidates = 24;
    const interviewStage = 9;

    return {
      message: `**Recruitment Pipeline:**\n\n• Active Candidates: **${activeCandidates}**\n• In Interview Stage: ${interviewStage}\n• Offers Extended: 2\n\n📊 **AI Insight:** Pipeline is healthy. Expect 3-4 hires this month based on current conversion rates.`,
      type: 'data',
      data: { activeCandidates, interviewStage },
      actions: [
        {
          id: 'action_1',
          label: 'View Recruitment Tracker',
          type: 'navigate',
          target: '/recruitment'
        },
        {
          id: 'action_2',
          label: 'Schedule Interviews',
          type: 'execute',
          target: 'schedule_interviews'
        }
      ],
      suggestions: [
        'Show candidates by stage',
        'Who\'s in interview stage?',
        'Forecast hiring timeline'
      ]
    };
  }

  /**
   * Handle workflow creation
   */
  private static handleWorkflowCreation(message: string, intent: any): AIResponse {
    return {
      message: `I can help you create a new workflow! 🚀\n\nWhat type of workflow would you like to create?\n\n• **Approval Workflow** - For invoice, leave, or expense approvals\n• **Onboarding Workflow** - Automate new hire processes\n• **Notification Workflow** - Send automated alerts\n• **Custom Workflow** - Build from scratch`,
      type: 'action',
      actions: [
        {
          id: 'action_1',
          label: 'Create from Template',
          type: 'navigate',
          target: '/workflow-dashboard'
        },
        {
          id: 'action_2',
          label: 'Build Custom Workflow',
          type: 'navigate',
          target: '/workflow-dashboard'
        }
      ],
      suggestions: [
        'Create invoice approval workflow',
        'Automate employee onboarding',
        'Set up leave request process'
      ]
    };
  }

  /**
   * Handle report generation
   */
  private static handleReportGeneration(message: string, intent: any): AIResponse {
    return {
      message: `I can generate comprehensive reports for you! 📊\n\n**Available Reports:**\n• HR Analytics Report\n• Financial Summary\n• Performance Review Report\n• Recruitment Pipeline Report\n• Executive Dashboard Report\n\nWhich report would you like to generate?`,
      type: 'action',
      actions: [
        {
          id: 'action_1',
          label: 'Open Report Builder',
          type: 'navigate',
          target: '/executive-dashboard'
        },
        {
          id: 'action_2',
          label: 'Generate Quick Summary',
          type: 'execute',
          target: 'quick_summary'
        }
      ],
      suggestions: [
        'Generate HR report',
        'Create financial summary',
        'Show me performance metrics'
      ]
    };
  }

  /**
   * Handle navigation
   */
  private static handleNavigation(message: string, intent: any): AIResponse {
    const target = intent.entities.target || '/';
    const pageName = this.getPageName(target);

    return {
      message: `I'll take you to the ${pageName}! 🚀`,
      type: 'action',
      data: { target },
      actions: [
        {
          id: 'action_1',
          label: `Open ${pageName}`,
          type: 'navigate',
          target
        }
      ]
    };
  }

  /**
   * Handle help requests
   */
  private static handleHelp(message: string, intent: any): AIResponse {
    return {
      message: `I'm your AI assistant for Portal Jeshan Labs! 👋\n\n**I can help you with:**\n\n📊 **Data Queries** - Ask about employees, performance, finances, recruitment\n🤖 **Workflows** - Create and manage automated processes\n📈 **Reports** - Generate insights and analytics\n🧭 **Navigation** - Find and open different apps\n💡 **Insights** - Get AI-powered recommendations\n\n**Try asking:**\n• "How many employees do we have?"\n• "Show me financial summary"\n• "Create an approval workflow"\n• "Generate performance report"`,
      type: 'text',
      suggestions: [
        'Show me employee count',
        'What\'s our revenue?',
        'Create a new workflow',
        'Generate a report'
      ]
    };
  }

  /**
   * Handle general queries
   */
  private static handleGeneral(message: string): AIResponse {
    return {
      message: `I understand you're asking about: "${message}"\n\nI'm still learning to understand all types of questions. Could you try rephrasing, or ask me about:\n\n• Employees and HR data\n• Performance metrics\n• Financial information\n• Recruitment pipeline\n• Creating workflows\n• Generating reports`,
      type: 'text',
      suggestions: [
        'Show me help',
        'What can you do?',
        'How many employees?',
        'Show financial summary'
      ]
    };
  }

  /**
   * Get page name from path
   */
  private static getPageName(path: string): string {
    const names: Record<string, string> = {
      '/': 'Launchpad',
      '/dashboard': 'Employee Dashboard',
      '/directory': 'Employee Directory',
      '/performance': 'Performance Tracker',
      '/recruitment': 'Recruitment Tracker',
      '/invoices': 'Invoice Management',
      '/payroll': 'Payroll Management',
      '/training': 'Training Tracker',
      '/projects': 'Project Management',
      '/workflow-dashboard': 'Workflow Automation',
      '/executive-dashboard': 'Executive Dashboard'
    };

    return names[path] || 'Page';
  }

  /**
   * Simulate employee count retrieval
   */
  private static getEmployeeCount(): number {
    try {
      const employees = JSON.parse(localStorage.getItem('employees') || '[]');
      return employees.length || 45;
    } catch {
      return 45;
    }
  }

  /**
   * Simulate department breakdown
   */
  private static getDepartmentBreakdown(): Array<{ name: string; count: number }> {
    return [
      { name: 'Engineering', count: 18 },
      { name: 'Sales', count: 12 },
      { name: 'Marketing', count: 8 },
      { name: 'HR', count: 4 },
      { name: 'Finance', count: 3 }
    ];
  }

  /**
   * Add message to conversation
   */
  private static addMessage(message: Omit<ChatMessage, 'id' | 'timestamp'>): void {
    const chatMessage: ChatMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    };

    const conversation = this.conversations.get(this.currentConversation) || [];
    conversation.push(chatMessage);
    this.conversations.set(this.currentConversation, conversation);
    this.saveToStorage();
  }

  /**
   * Get conversation history
   */
  static getConversation(conversationId: string = 'default'): ChatMessage[] {
    return this.conversations.get(conversationId) || [];
  }

  /**
   * Clear conversation
   */
  static clearConversation(conversationId: string = 'default'): void {
    this.conversations.set(conversationId, []);
    this.saveToStorage();
  }

  /**
   * Get quick suggestions based on context
   */
  static getContextualSuggestions(): string[] {
    const hour = new Date().getHours();
    
    if (hour < 12) {
      return [
        'Show me today\'s agenda',
        'What are the pending approvals?',
        'How many employees are active?',
        'Generate morning report'
      ];
    } else if (hour < 17) {
      return [
        'What\'s our revenue today?',
        'Show pending tasks',
        'Any critical alerts?',
        'Schedule afternoon reviews'
      ];
    } else {
      return [
        'Generate end-of-day summary',
        'What did we accomplish today?',
        'Pending items for tomorrow',
        'Team performance today'
      ];
    }
  }

  /**
   * Save to localStorage
   */
  private static saveToStorage(): void {
    try {
      localStorage.setItem('ai_conversations', JSON.stringify(Array.from(this.conversations.entries())));
    } catch (error) {
      console.error('Error saving conversations:', error);
    }
  }

  /**
   * Load from localStorage
   */
  static loadFromStorage(): void {
    try {
      const data = localStorage.getItem('ai_conversations');
      if (data) {
        this.conversations = new Map(JSON.parse(data));
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  }
}

// Load data on initialization
AIAssistant.loadFromStorage();
