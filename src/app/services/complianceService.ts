import { toast } from 'sonner';

export type ComplianceFramework = 
  | 'GDPR'
  | 'HIPAA'
  | 'SOC2'
  | 'ISO27001'
  | 'PCI-DSS'
  | 'CCPA'
  | 'NIST';

export type ComplianceStatus = 'compliant' | 'partial' | 'non-compliant' | 'in-progress';

export interface ComplianceRequirement {
  id: string;
  framework: ComplianceFramework;
  requirementId: string;
  title: string;
  description: string;
  category: string;
  status: ComplianceStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  owner: string;
  dueDate?: string;
  completionDate?: string;
  evidence?: ComplianceEvidence[];
  controls?: string[];
  notes?: string;
}

export interface ComplianceEvidence {
  id: string;
  type: 'document' | 'screenshot' | 'log' | 'certificate' | 'report';
  name: string;
  uploadedBy: string;
  uploadedAt: string;
  url?: string;
  verified: boolean;
}

export interface ComplianceAssessment {
  id: string;
  framework: ComplianceFramework;
  assessmentDate: string;
  assessor: string;
  overallStatus: ComplianceStatus;
  score: number; // percentage
  findings: ComplianceFinding[];
  recommendations: string[];
  nextAssessmentDate: string;
}

export interface ComplianceFinding {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  requirement: string;
  remediation: string;
  status: 'open' | 'in-progress' | 'resolved';
  assignedTo?: string;
  dueDate?: string;
}

export interface DataPrivacyRequest {
  id: string;
  type: 'access' | 'deletion' | 'rectification' | 'portability' | 'objection';
  userId: string;
  userName: string;
  userEmail: string;
  requestDate: string;
  status: 'pending' | 'in-progress' | 'completed' | 'rejected';
  completionDate?: string;
  assignedTo?: string;
  notes?: string;
  framework: ComplianceFramework;
}

export class ComplianceService {
  private static requirements: Map<string, ComplianceRequirement> = new Map();
  private static assessments: ComplianceAssessment[] = [];
  private static privacyRequests: DataPrivacyRequest[] = [];

  /**
   * Initialize compliance service
   */
  static initialize() {
    this.loadFromStorage();
    this.initializeSampleData();
  }

  /**
   * Initialize sample data
   */
  private static initializeSampleData() {
    if (this.requirements.size > 0) return;

    // GDPR Requirements
    const gdprRequirements: ComplianceRequirement[] = [
      {
        id: 'gdpr_1',
        framework: 'GDPR',
        requirementId: 'Art. 30',
        title: 'Records of Processing Activities',
        description: 'Maintain records of all data processing activities',
        category: 'Documentation',
        status: 'compliant',
        priority: 'high',
        owner: 'Admin User',
        completionDate: new Date(Date.now() - 2592000000).toISOString(),
        controls: ['Data inventory', 'Processing register'],
        evidence: [
          {
            id: 'ev1',
            type: 'document',
            name: 'Processing_Activities_Register.pdf',
            uploadedBy: 'Admin User',
            uploadedAt: new Date(Date.now() - 2592000000).toISOString(),
            verified: true
          }
        ]
      },
      {
        id: 'gdpr_2',
        framework: 'GDPR',
        requirementId: 'Art. 15-22',
        title: 'Data Subject Rights',
        description: 'Implement processes for handling data subject requests',
        category: 'Data Rights',
        status: 'compliant',
        priority: 'critical',
        owner: 'Admin User',
        completionDate: new Date(Date.now() - 1296000000).toISOString(),
        controls: ['Request portal', 'Response workflows']
      },
      {
        id: 'gdpr_3',
        framework: 'GDPR',
        requirementId: 'Art. 32',
        title: 'Security of Processing',
        description: 'Implement appropriate technical and organizational measures',
        category: 'Security',
        status: 'partial',
        priority: 'critical',
        owner: 'Admin User',
        dueDate: new Date(Date.now() + 2592000000).toISOString(),
        controls: ['Encryption', 'Access controls', 'Audit logs']
      },
      {
        id: 'gdpr_4',
        framework: 'GDPR',
        requirementId: 'Art. 33',
        title: 'Breach Notification',
        description: 'Notify supervisory authority within 72 hours of breach',
        category: 'Incident Response',
        status: 'in-progress',
        priority: 'critical',
        owner: 'Security Team',
        dueDate: new Date(Date.now() + 1296000000).toISOString()
      }
    ];

    // SOC2 Requirements
    const soc2Requirements: ComplianceRequirement[] = [
      {
        id: 'soc2_1',
        framework: 'SOC2',
        requirementId: 'CC6.1',
        title: 'Logical and Physical Access Controls',
        description: 'Implement controls to restrict access to system resources',
        category: 'Access Control',
        status: 'compliant',
        priority: 'high',
        owner: 'IT Team',
        completionDate: new Date(Date.now() - 1296000000).toISOString()
      },
      {
        id: 'soc2_2',
        framework: 'SOC2',
        requirementId: 'CC7.2',
        title: 'System Monitoring',
        description: 'Monitor system components and operations',
        category: 'Monitoring',
        status: 'partial',
        priority: 'high',
        owner: 'DevOps Team',
        dueDate: new Date(Date.now() + 2592000000).toISOString()
      }
    ];

    [...gdprRequirements, ...soc2Requirements].forEach(req => 
      this.requirements.set(req.id, req)
    );

    // Sample assessment
    const sampleAssessment: ComplianceAssessment = {
      id: 'assess_1',
      framework: 'GDPR',
      assessmentDate: new Date(Date.now() - 2592000000).toISOString(),
      assessor: 'External Auditor',
      overallStatus: 'partial',
      score: 78,
      findings: [
        {
          id: 'find_1',
          severity: 'medium',
          title: 'Incomplete encryption implementation',
          description: 'Data at rest encryption not implemented for all databases',
          requirement: 'Art. 32 - Security of Processing',
          remediation: 'Enable encryption for remaining database instances',
          status: 'in-progress',
          assignedTo: 'DevOps Team',
          dueDate: new Date(Date.now() + 1296000000).toISOString()
        },
        {
          id: 'find_2',
          severity: 'low',
          title: 'Privacy policy update needed',
          description: 'Privacy policy does not reflect recent changes',
          requirement: 'Art. 13 - Information to be provided',
          remediation: 'Update privacy policy documentation',
          status: 'open',
          assignedTo: 'Legal Team'
        }
      ],
      recommendations: [
        'Conduct regular security training for all employees',
        'Implement automated compliance monitoring',
        'Update data retention policies'
      ],
      nextAssessmentDate: new Date(Date.now() + 15552000000).toISOString() // 6 months
    };

    this.assessments.push(sampleAssessment);

    // Sample privacy requests
    const sampleRequests: DataPrivacyRequest[] = [
      {
        id: 'req_1',
        type: 'access',
        userId: 'user1',
        userName: 'Alice Johnson',
        userEmail: 'alice@jeshanlabs.com',
        requestDate: new Date(Date.now() - 172800000).toISOString(),
        status: 'completed',
        completionDate: new Date(Date.now() - 86400000).toISOString(),
        assignedTo: 'Admin User',
        framework: 'GDPR',
        notes: 'Data access request fulfilled via secure portal'
      },
      {
        id: 'req_2',
        type: 'deletion',
        userId: 'user5',
        userName: 'Former Employee',
        userEmail: 'former@jeshanlabs.com',
        requestDate: new Date(Date.now() - 86400000).toISOString(),
        status: 'in-progress',
        assignedTo: 'Admin User',
        framework: 'GDPR',
        notes: 'Verifying legal retention requirements'
      },
      {
        id: 'req_3',
        type: 'portability',
        userId: 'user2',
        userName: 'Bob Smith',
        userEmail: 'bob@jeshanlabs.com',
        requestDate: new Date(Date.now() - 43200000).toISOString(),
        status: 'pending',
        framework: 'GDPR'
      }
    ];

    this.privacyRequests = sampleRequests;

    this.saveToStorage();
  }

  /**
   * Get all requirements
   */
  static getAllRequirements(framework?: ComplianceFramework): ComplianceRequirement[] {
    const allReqs = Array.from(this.requirements.values());
    
    if (framework) {
      return allReqs.filter(req => req.framework === framework);
    }
    
    return allReqs;
  }

  /**
   * Get requirement by ID
   */
  static getRequirement(id: string): ComplianceRequirement | undefined {
    return this.requirements.get(id);
  }

  /**
   * Update requirement
   */
  static updateRequirement(id: string, updates: Partial<ComplianceRequirement>): void {
    const requirement = this.requirements.get(id);
    if (requirement) {
      this.requirements.set(id, { ...requirement, ...updates });
      this.saveToStorage();
      toast.success('Requirement updated');
    }
  }

  /**
   * Add evidence to requirement
   */
  static addEvidence(requirementId: string, evidence: Omit<ComplianceEvidence, 'id'>): void {
    const requirement = this.requirements.get(requirementId);
    if (requirement) {
      if (!requirement.evidence) requirement.evidence = [];
      
      const newEvidence: ComplianceEvidence = {
        ...evidence,
        id: `ev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      
      requirement.evidence.push(newEvidence);
      this.saveToStorage();
      toast.success('Evidence added');
    }
  }

  /**
   * Get compliance statistics
   */
  static getStatistics(framework?: ComplianceFramework) {
    const requirements = this.getAllRequirements(framework);
    
    const total = requirements.length;
    const compliant = requirements.filter(r => r.status === 'compliant').length;
    const partial = requirements.filter(r => r.status === 'partial').length;
    const nonCompliant = requirements.filter(r => r.status === 'non-compliant').length;
    const inProgress = requirements.filter(r => r.status === 'in-progress').length;
    
    const complianceRate = total > 0 ? (compliant / total) * 100 : 0;
    
    const byCategory: Record<string, number> = {};
    requirements.forEach(req => {
      if (!byCategory[req.category]) byCategory[req.category] = 0;
      byCategory[req.category]++;
    });
    
    const byPriority = {
      low: requirements.filter(r => r.priority === 'low').length,
      medium: requirements.filter(r => r.priority === 'medium').length,
      high: requirements.filter(r => r.priority === 'high').length,
      critical: requirements.filter(r => r.priority === 'critical').length
    };

    return {
      total,
      compliant,
      partial,
      nonCompliant,
      inProgress,
      complianceRate,
      byCategory,
      byPriority
    };
  }

  /**
   * Get all assessments
   */
  static getAssessments(framework?: ComplianceFramework): ComplianceAssessment[] {
    if (framework) {
      return this.assessments.filter(a => a.framework === framework);
    }
    return this.assessments;
  }

  /**
   * Get latest assessment
   */
  static getLatestAssessment(framework: ComplianceFramework): ComplianceAssessment | undefined {
    const assessments = this.getAssessments(framework);
    return assessments.sort((a, b) => 
      new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime()
    )[0];
  }

  /**
   * Get all privacy requests
   */
  static getPrivacyRequests(status?: DataPrivacyRequest['status']): DataPrivacyRequest[] {
    if (status) {
      return this.privacyRequests.filter(r => r.status === status);
    }
    return this.privacyRequests.sort((a, b) => 
      new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()
    );
  }

  /**
   * Create privacy request
   */
  static createPrivacyRequest(request: Omit<DataPrivacyRequest, 'id' | 'requestDate' | 'status'>): DataPrivacyRequest {
    const newRequest: DataPrivacyRequest = {
      ...request,
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      requestDate: new Date().toISOString(),
      status: 'pending'
    };

    this.privacyRequests.unshift(newRequest);
    this.saveToStorage();
    
    toast.success('Privacy request created');
    return newRequest;
  }

  /**
   * Update privacy request
   */
  static updatePrivacyRequest(id: string, updates: Partial<DataPrivacyRequest>): void {
    const index = this.privacyRequests.findIndex(r => r.id === id);
    if (index !== -1) {
      this.privacyRequests[index] = { ...this.privacyRequests[index], ...updates };
      this.saveToStorage();
      toast.success('Request updated');
    }
  }

  /**
   * Get compliance score by framework
   */
  static getFrameworkScore(framework: ComplianceFramework): number {
    const stats = this.getStatistics(framework);
    return stats.complianceRate;
  }

  /**
   * Get overdue requirements
   */
  static getOverdueRequirements(): ComplianceRequirement[] {
    const now = new Date();
    return Array.from(this.requirements.values()).filter(req => 
      req.dueDate && new Date(req.dueDate) < now && req.status !== 'compliant'
    );
  }

  /**
   * Get open findings
   */
  static getOpenFindings(): ComplianceFinding[] {
    const allFindings: ComplianceFinding[] = [];
    this.assessments.forEach(assessment => {
      assessment.findings.forEach(finding => {
        if (finding.status !== 'resolved') {
          allFindings.push(finding);
        }
      });
    });
    return allFindings;
  }

  /**
   * Export compliance report
   */
  static exportReport(framework: ComplianceFramework): string {
    const requirements = this.getAllRequirements(framework);
    const stats = this.getStatistics(framework);
    const assessment = this.getLatestAssessment(framework);

    const report = {
      framework,
      generatedAt: new Date().toISOString(),
      statistics: stats,
      latestAssessment: assessment,
      requirements: requirements,
      openFindings: this.getOpenFindings()
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Save to localStorage
   */
  private static saveToStorage(): void {
    try {
      localStorage.setItem('compliance_requirements', JSON.stringify(Array.from(this.requirements.entries())));
      localStorage.setItem('compliance_assessments', JSON.stringify(this.assessments));
      localStorage.setItem('privacy_requests', JSON.stringify(this.privacyRequests));
    } catch (error) {
      console.error('Error saving compliance data:', error);
    }
  }

  /**
   * Load from localStorage
   */
  private static loadFromStorage(): void {
    try {
      const reqData = localStorage.getItem('compliance_requirements');
      if (reqData) {
        this.requirements = new Map(JSON.parse(reqData));
      }

      const assessData = localStorage.getItem('compliance_assessments');
      if (assessData) {
        this.assessments = JSON.parse(assessData);
      }

      const privacyData = localStorage.getItem('privacy_requests');
      if (privacyData) {
        this.privacyRequests = JSON.parse(privacyData);
      }
    } catch (error) {
      console.error('Error loading compliance data:', error);
    }
  }
}
