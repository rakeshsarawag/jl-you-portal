import { toast } from 'sonner';

export type AuditEventType = 
  | 'login' 
  | 'logout' 
  | 'create' 
  | 'read' 
  | 'update' 
  | 'delete' 
  | 'export'
  | 'share'
  | 'permission_change'
  | 'config_change'
  | 'security_alert'
  | 'failed_login'
  | 'data_access';

export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userEmail: string;
  eventType: AuditEventType;
  action: string;
  resource: string;
  resourceId?: string;
  severity: AuditSeverity;
  ipAddress: string;
  userAgent: string;
  location?: string;
  details?: any;
  status: 'success' | 'failure' | 'warning';
  duration?: number; // milliseconds
  changes?: {
    before?: any;
    after?: any;
  };
}

export interface AuditFilter {
  userId?: string;
  eventType?: AuditEventType;
  severity?: AuditSeverity;
  status?: 'success' | 'failure' | 'warning';
  dateFrom?: string;
  dateTo?: string;
  resource?: string;
  searchQuery?: string;
}

export interface AuditStats {
  totalEvents: number;
  successRate: number;
  failureCount: number;
  criticalEvents: number;
  eventsByType: Record<AuditEventType, number>;
  eventsBySeverity: Record<AuditSeverity, number>;
  topUsers: Array<{ userId: string; userName: string; count: number }>;
  topResources: Array<{ resource: string; count: number }>;
}

export class AuditLogService {
  private static logs: AuditLog[] = [];
  private static retentionDays = 90; // Keep logs for 90 days

  /**
   * Initialize audit log service
   */
  static initialize() {
    this.loadFromStorage();
    this.initializeSampleData();
    this.startRetentionCleanup();
  }

  /**
   * Initialize sample data
   */
  private static initializeSampleData() {
    if (this.logs.length > 0) return;

    const sampleLogs: AuditLog[] = [
      {
        id: 'audit_1',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        userId: 'user1',
        userName: 'Alice Johnson',
        userEmail: 'alice@jeshanlabs.com',
        eventType: 'login',
        action: 'User logged in',
        resource: 'auth',
        severity: 'low',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        location: 'New York, USA',
        status: 'success',
        duration: 234
      },
      {
        id: 'audit_2',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        userId: 'user2',
        userName: 'Bob Smith',
        userEmail: 'bob@jeshanlabs.com',
        eventType: 'failed_login',
        action: 'Failed login attempt',
        resource: 'auth',
        severity: 'high',
        ipAddress: '203.45.67.89',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)',
        location: 'Unknown',
        status: 'failure',
        details: { reason: 'Invalid password', attempts: 3 }
      },
      {
        id: 'audit_3',
        timestamp: new Date(Date.now() - 10800000).toISOString(),
        userId: 'current-user',
        userName: 'Admin User',
        userEmail: 'admin@jeshanlabs.com',
        eventType: 'permission_change',
        action: 'Updated user permissions',
        resource: 'user_management',
        resourceId: 'user5',
        severity: 'high',
        ipAddress: '192.168.1.50',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        status: 'success',
        changes: {
          before: { roles: ['employee'] },
          after: { roles: ['employee', 'manager'] }
        }
      },
      {
        id: 'audit_4',
        timestamp: new Date(Date.now() - 14400000).toISOString(),
        userId: 'user3',
        userName: 'Carol Davis',
        userEmail: 'carol@jeshanlabs.com',
        eventType: 'export',
        action: 'Exported employee data',
        resource: 'employee_dashboard',
        severity: 'medium',
        ipAddress: '192.168.1.120',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        status: 'success',
        details: { format: 'CSV', records: 150 }
      },
      {
        id: 'audit_5',
        timestamp: new Date(Date.now() - 18000000).toISOString(),
        userId: 'current-user',
        userName: 'Admin User',
        userEmail: 'admin@jeshanlabs.com',
        eventType: 'security_alert',
        action: 'Multiple failed login attempts detected',
        resource: 'security',
        severity: 'critical',
        ipAddress: '203.45.67.89',
        userAgent: 'Python-requests/2.25.1',
        status: 'warning',
        details: { attempts: 10, blocked: true }
      },
      {
        id: 'audit_6',
        timestamp: new Date(Date.now() - 21600000).toISOString(),
        userId: 'user1',
        userName: 'Alice Johnson',
        userEmail: 'alice@jeshanlabs.com',
        eventType: 'data_access',
        action: 'Accessed sensitive data',
        resource: 'payroll',
        severity: 'high',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        status: 'success',
        details: { dataType: 'salary_information', recordCount: 50 }
      },
      {
        id: 'audit_7',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        userId: 'user2',
        userName: 'Bob Smith',
        userEmail: 'bob@jeshanlabs.com',
        eventType: 'create',
        action: 'Created new project',
        resource: 'project_management',
        resourceId: 'proj_123',
        severity: 'low',
        ipAddress: '192.168.1.105',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        status: 'success'
      },
      {
        id: 'audit_8',
        timestamp: new Date(Date.now() - 172800000).toISOString(),
        userId: 'current-user',
        userName: 'Admin User',
        userEmail: 'admin@jeshanlabs.com',
        eventType: 'config_change',
        action: 'Updated system configuration',
        resource: 'system_settings',
        severity: 'high',
        ipAddress: '192.168.1.50',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        status: 'success',
        changes: {
          before: { sessionTimeout: 30 },
          after: { sessionTimeout: 60 }
        }
      }
    ];

    this.logs = sampleLogs;
    this.saveToStorage();
  }

  /**
   * Log an audit event
   */
  static log(event: Omit<AuditLog, 'id' | 'timestamp' | 'ipAddress' | 'userAgent'>): AuditLog {
    const newLog: AuditLog = {
      ...event,
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ipAddress: this.getClientIP(),
      userAgent: navigator.userAgent
    };

    this.logs.unshift(newLog);
    this.saveToStorage();

    // Show toast for critical events
    if (newLog.severity === 'critical') {
      toast.error('Security Alert', {
        description: newLog.action
      });
    }

    return newLog;
  }

  /**
   * Get all audit logs with optional filtering
   */
  static getLogs(filter?: AuditFilter): AuditLog[] {
    let filtered = [...this.logs];

    if (filter) {
      if (filter.userId) {
        filtered = filtered.filter(log => log.userId === filter.userId);
      }
      if (filter.eventType) {
        filtered = filtered.filter(log => log.eventType === filter.eventType);
      }
      if (filter.severity) {
        filtered = filtered.filter(log => log.severity === filter.severity);
      }
      if (filter.status) {
        filtered = filtered.filter(log => log.status === filter.status);
      }
      if (filter.resource) {
        filtered = filtered.filter(log => log.resource.includes(filter.resource));
      }
      if (filter.dateFrom) {
        filtered = filtered.filter(log => log.timestamp >= filter.dateFrom!);
      }
      if (filter.dateTo) {
        filtered = filtered.filter(log => log.timestamp <= filter.dateTo!);
      }
      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        filtered = filtered.filter(log => 
          log.action.toLowerCase().includes(query) ||
          log.userName.toLowerCase().includes(query) ||
          log.resource.toLowerCase().includes(query)
        );
      }
    }

    return filtered.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Get audit statistics
   */
  static getStatistics(filter?: AuditFilter): AuditStats {
    const logs = filter ? this.getLogs(filter) : this.logs;

    const eventsByType: Record<AuditEventType, number> = {
      login: 0,
      logout: 0,
      create: 0,
      read: 0,
      update: 0,
      delete: 0,
      export: 0,
      share: 0,
      permission_change: 0,
      config_change: 0,
      security_alert: 0,
      failed_login: 0,
      data_access: 0
    };

    const eventsBySeverity: Record<AuditSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    const userCounts: Record<string, { userName: string; count: number }> = {};
    const resourceCounts: Record<string, number> = {};

    let successCount = 0;
    let failureCount = 0;

    logs.forEach(log => {
      // Count by type
      eventsByType[log.eventType]++;

      // Count by severity
      eventsBySeverity[log.severity]++;

      // Count by status
      if (log.status === 'success') successCount++;
      if (log.status === 'failure') failureCount++;

      // Count by user
      if (!userCounts[log.userId]) {
        userCounts[log.userId] = { userName: log.userName, count: 0 };
      }
      userCounts[log.userId].count++;

      // Count by resource
      if (!resourceCounts[log.resource]) {
        resourceCounts[log.resource] = 0;
      }
      resourceCounts[log.resource]++;
    });

    const topUsers = Object.entries(userCounts)
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topResources = Object.entries(resourceCounts)
      .map(([resource, count]) => ({ resource, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalEvents: logs.length,
      successRate: logs.length > 0 ? (successCount / logs.length) * 100 : 0,
      failureCount,
      criticalEvents: eventsBySeverity.critical,
      eventsByType,
      eventsBySeverity,
      topUsers,
      topResources
    };
  }

  /**
   * Get logs for a specific user
   */
  static getUserLogs(userId: string): AuditLog[] {
    return this.getLogs({ userId });
  }

  /**
   * Get logs for a specific resource
   */
  static getResourceLogs(resource: string): AuditLog[] {
    return this.getLogs({ resource });
  }

  /**
   * Get critical events
   */
  static getCriticalEvents(): AuditLog[] {
    return this.getLogs({ severity: 'critical' });
  }

  /**
   * Get failed events
   */
  static getFailedEvents(): AuditLog[] {
    return this.getLogs({ status: 'failure' });
  }

  /**
   * Search logs
   */
  static searchLogs(query: string): AuditLog[] {
    return this.getLogs({ searchQuery: query });
  }

  /**
   * Export logs
   */
  static exportLogs(format: 'json' | 'csv', filter?: AuditFilter): string {
    const logs = this.getLogs(filter);

    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    }

    // CSV format
    const headers = [
      'Timestamp',
      'User',
      'Email',
      'Event Type',
      'Action',
      'Resource',
      'Severity',
      'Status',
      'IP Address',
      'Location'
    ];

    const rows = logs.map(log => [
      log.timestamp,
      log.userName,
      log.userEmail,
      log.eventType,
      log.action,
      log.resource,
      log.severity,
      log.status,
      log.ipAddress,
      log.location || 'N/A'
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csv;
  }

  /**
   * Delete old logs (retention policy)
   */
  static cleanupOldLogs(): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
    
    const beforeCount = this.logs.length;
    this.logs = this.logs.filter(log => 
      new Date(log.timestamp) >= cutoffDate
    );
    
    const deletedCount = beforeCount - this.logs.length;
    
    if (deletedCount > 0) {
      this.saveToStorage();
      console.log(`Cleaned up ${deletedCount} old audit logs`);
    }
    
    return deletedCount;
  }

  /**
   * Start automatic retention cleanup
   */
  private static startRetentionCleanup() {
    // Run cleanup daily
    setInterval(() => {
      this.cleanupOldLogs();
    }, 86400000); // 24 hours
  }

  /**
   * Get client IP address (mock for client-side)
   */
  private static getClientIP(): string {
    // In a real app, this would come from the backend
    return '192.168.1.' + Math.floor(Math.random() * 255);
  }

  /**
   * Get event type color
   */
  static getEventTypeColor(eventType: AuditEventType): string {
    switch (eventType) {
      case 'login':
      case 'logout':
        return 'text-blue-600';
      case 'create':
        return 'text-green-600';
      case 'update':
        return 'text-yellow-600';
      case 'delete':
        return 'text-red-600';
      case 'security_alert':
      case 'failed_login':
        return 'text-red-700';
      case 'permission_change':
      case 'config_change':
        return 'text-purple-600';
      case 'export':
      case 'data_access':
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  }

  /**
   * Get severity color
   */
  static getSeverityColor(severity: AuditSeverity): string {
    switch (severity) {
      case 'low':
        return 'bg-blue-100 text-blue-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  /**
   * Save to localStorage
   */
  private static saveToStorage(): void {
    try {
      localStorage.setItem('audit_logs', JSON.stringify(this.logs));
    } catch (error) {
      console.error('Error saving audit logs:', error);
    }
  }

  /**
   * Load from localStorage
   */
  private static loadFromStorage(): void {
    try {
      const data = localStorage.getItem('audit_logs');
      if (data) {
        this.logs = JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading audit logs:', error);
    }
  }
}
