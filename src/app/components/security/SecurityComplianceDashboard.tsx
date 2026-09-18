import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { t } from '../../../i18n';
import { supabase } from '../../utils/constants';
import { useUser } from '../../context/UserContext';
import { useAuditLogger } from '../../../hooks/useAuditLogger';
import { AppLayout } from '../apps/AppLayout';
import ReportDefectButton from '../ReportDefectButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Shield,
  Activity,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Lock,
  Download,
  Search,
  Award,
  Plus,
  X,
  AlertCircle,
  BarChart2,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface SecurityComplianceDashboardProps {
  accessToken: string;
  onLogout: () => void;
}

interface AuditLog {
  id: string;
  event_id: string;
  timestamp: string;
  user_id: string;
  user_email: string;
  user_role: string;
  event_type: string;
  action: string;
  resource_type: string;
  resource_id: string;
  severity: string;
  status: string;
  ip_address: string;
  user_agent: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface ComplianceFrameworkRow {
  id: string;
  name: string;
  version: string;
  description: string;
  is_active: boolean;
}

interface ComplianceRequirement {
  id: string;
  framework_id: string;
  control_id: string;
  category: string;
  title: string;
  description: string;
  status: 'compliant' | 'partial' | 'in_progress' | 'non_compliant';
  assigned_to: string;
  evidence: unknown[];
  evidence_data: EvidenceFile[] | null;
  evidence_uploaded: boolean;
  evidence_uploaded_at: string | null;
  last_assessed: string;
  due_date: string;
}

interface ComplianceAssessment {
  id: string;
  framework_id: string;
  assessment_date: string;
  score: number;
  assessor: string;
  notes: string;
  findings: string;
  recommendations: string;
  overall_status: string;
  assessed_by: string;
  created_at: string;
}

interface PrivacyRequest {
  id: string;
  requester_name: string;
  requester_email: string;
  request_type: string;
  status: string;
  assigned_to: string;
  received_at: string;
  due_date: string;
  completed_at: string;
  response_notes: string;
  regulation: string;
  description: string;
}

interface SecurityRisk {
  id: string;
  title: string;
  category: string;
  likelihood: number;
  impact: number;
  risk_score: number;
  mitigation_plan: string;
  status: string;
  owner: string;
  review_date: string;
  last_reviewed_at: string;
}

interface EvidenceFile {
  name: string;
  type: string;
  size: number;
  data: string;
  uploaded_at: string;
}

interface ComplianceEvidence {
  id: string;
  requirement_id: string;
  name: string;
  evidence_type: string;
  notes: string;
  uploaded_by: string | undefined;
  file_name: string;
  uploaded_at: string;
  created_at: string;
}

const RISK_CATEGORIES = ['Data Breach', 'Unauthorized Access', 'System Failure', 'Compliance', 'Insider Threat'];
const RISK_STATUSES = ['open', 'mitigating', 'resolved', 'accepted'];

const FRAMEWORKS = ['GDPR', 'HIPAA', 'SOC2', 'ISO27001', 'PCI-DSS', 'NIST', 'CCPA'];

const FRAMEWORK_SEED: Record<string, Array<{ control_id: string; category: string; title: string; description: string }>> = {
  GDPR: [
    { control_id: 'GDPR-001', category: 'Data Protection', title: 'Data Protection by Design', description: 'Embed data protection into processing by default.' },
    { control_id: 'GDPR-002', category: 'Processing', title: 'Lawful Basis for Processing', description: 'Document lawful basis for each processing activity.' },
    { control_id: 'GDPR-003', category: 'Consent', title: 'Consent Management', description: 'Obtain and record valid consent; allow withdrawal.' },
    { control_id: 'GDPR-004', category: 'Rights', title: 'Right to Access', description: 'Respond to Subject Access Requests within 30 days.' },
    { control_id: 'GDPR-005', category: 'Rights', title: 'Right to Erasure', description: 'Process erasure requests; document exceptions.' },
    { control_id: 'GDPR-006', category: 'Breach', title: 'Data Breach Notification', description: 'Notify supervisory authority within 72 hours.' },
    { control_id: 'GDPR-007', category: 'Governance', title: 'DPO Appointment', description: 'Appoint Data Protection Officer where required.' },
    { control_id: 'GDPR-008', category: 'Transfers', title: 'Cross-border Transfer Controls', description: 'Implement SCCs or adequacy decision for data transfers.' },
    { control_id: 'GDPR-009', category: 'Privacy', title: 'Privacy Notices', description: 'Maintain clear accessible privacy notices.' },
    { control_id: 'GDPR-010', category: 'Retention', title: 'Retention Policies', description: 'Define and enforce data retention schedules.' },
    { control_id: 'GDPR-011', category: 'Data Quality', title: 'Data Minimisation', description: 'Collect only adequate and relevant data.' },
    { control_id: 'GDPR-012', category: 'Data Quality', title: 'Accuracy', description: 'Maintain accurate and up-to-date personal data.' },
    { control_id: 'GDPR-013', category: 'Contracts', title: 'Data Processing Agreements', description: 'Execute DPAs with all processors.' },
    { control_id: 'GDPR-014', category: 'Records', title: 'ROPA Maintenance', description: 'Maintain Records of Processing Activities.' },
    { control_id: 'GDPR-015', category: 'Rights', title: 'Right to Rectification', description: 'Process rectification requests.' },
    { control_id: 'GDPR-016', category: 'Rights', title: 'Right to Portability', description: 'Provide data in machine-readable format.' },
    { control_id: 'GDPR-017', category: 'Rights', title: 'Right to Object', description: 'Honor objection to direct marketing processing.' },
    { control_id: 'GDPR-018', category: 'Automation', title: 'Automated Decision Making', description: 'Provide info on automated decisions and allow human review.' },
    { control_id: 'GDPR-019', category: 'Children', title: "Children's Data", description: 'Verify age and obtain parental consent for minors.' },
    { control_id: 'GDPR-020', category: 'Assessment', title: 'Impact Assessment', description: 'Conduct DPIA for high-risk processing activities.' },
  ],
  HIPAA: [
    { control_id: 'HIPAA-001', category: 'Privacy', title: 'Notice of Privacy Practices', description: 'Provide patients with notice of how their PHI is used and disclosed.' },
    { control_id: 'HIPAA-002', category: 'Security', title: 'Access Controls', description: 'Implement technical policies to allow access only to authorized persons.' },
    { control_id: 'HIPAA-003', category: 'Breach', title: 'Breach Notification Rule', description: 'Notify affected individuals within 60 days of discovering a breach of PHI.' },
    { control_id: 'HIPAA-004', category: 'Security', title: 'Audit Controls', description: 'Implement hardware, software, or procedural mechanisms to record and examine PHI access.' },
    { control_id: 'HIPAA-005', category: 'Privacy', title: 'Minimum Necessary Standard', description: 'Limit PHI use and disclosure to the minimum necessary for the intended purpose.' },
    { control_id: 'HIPAA-006', category: 'Security', title: 'Transmission Security', description: 'Implement technical security measures to guard against unauthorized PHI access in transit.' },
    { control_id: 'HIPAA-007', category: 'Workforce', title: 'Workforce Training', description: 'Train all workforce members on HIPAA policies and their role in protecting PHI.' },
    { control_id: 'HIPAA-008', category: 'Physical', title: 'Facility Access Controls', description: 'Implement policies limiting physical access to electronic information systems and facilities.' },
    { control_id: 'HIPAA-009', category: 'Privacy', title: 'Business Associate Agreements', description: 'Execute BAAs with all business associates who handle PHI.' },
    { control_id: 'HIPAA-010', category: 'Security', title: 'Risk Analysis', description: 'Conduct accurate and thorough assessment of potential risks to PHI confidentiality.' },
    { control_id: 'HIPAA-011', category: 'Security', title: 'Risk Management', description: 'Implement security measures to reduce risks to PHI to a reasonable level.' },
    { control_id: 'HIPAA-012', category: 'Security', title: 'Integrity Controls', description: 'Implement policies to protect PHI from improper alteration or destruction.' },
    { control_id: 'HIPAA-013', category: 'Privacy', title: 'Patient Rights', description: 'Provide patients the right to inspect, copy, and amend their PHI.' },
    { control_id: 'HIPAA-014', category: 'Physical', title: 'Workstation Security', description: 'Implement physical safeguards for workstations that access ePHI.' },
    { control_id: 'HIPAA-015', category: 'Security', title: 'Contingency Plan', description: 'Establish policies for responding to emergencies that damage systems containing ePHI.' },
    { control_id: 'HIPAA-016', category: 'Security', title: 'Device and Media Controls', description: 'Implement policies governing receipt and removal of hardware and media containing ePHI.' },
    { control_id: 'HIPAA-017', category: 'Governance', title: 'Assigned Security Responsibility', description: 'Designate a security official responsible for HIPAA security policies and procedures.' },
    { control_id: 'HIPAA-018', category: 'Privacy', title: 'De-identification Standards', description: 'Apply expert determination or safe harbor method to de-identify PHI.' },
  ],
  SOC2: [
    { control_id: 'SOC2-001', category: 'Security', title: 'Logical Access Controls', description: 'Restrict logical access to systems and data to authorized users.' },
    { control_id: 'SOC2-002', category: 'Availability', title: 'System Availability', description: 'Ensure systems are available for operation as committed or agreed.' },
    { control_id: 'SOC2-003', category: 'Confidentiality', title: 'Data Confidentiality', description: 'Protect confidential information from unauthorized disclosure.' },
    { control_id: 'SOC2-004', category: 'Security', title: 'Change Management', description: 'Implement controls over changes to infrastructure, data, and software.' },
    { control_id: 'SOC2-005', category: 'Security', title: 'Incident Response', description: 'Identify, respond to, and recover from security incidents in a timely manner.' },
    { control_id: 'SOC2-006', category: 'Processing Integrity', title: 'System Processing Integrity', description: 'Ensure system processing is complete, valid, accurate, timely, and authorized.' },
    { control_id: 'SOC2-007', category: 'Privacy', title: 'Privacy of Personal Information', description: 'Collect, use, retain, disclose, and dispose of personal information per commitments.' },
    { control_id: 'SOC2-008', category: 'Security', title: 'Risk Assessment', description: 'Identify and assess risks that threaten the achievement of entity objectives.' },
    { control_id: 'SOC2-009', category: 'Security', title: 'Vendor Risk Management', description: 'Assess and monitor third-party vendor risks on an ongoing basis.' },
    { control_id: 'SOC2-010', category: 'Availability', title: 'Backup and Recovery', description: 'Implement backup procedures and test recovery capabilities regularly.' },
    { control_id: 'SOC2-CC6.6', category: 'Logical Access', title: 'External Threat Management', description: 'System protects against external threats' },
    { control_id: 'SOC2-CC6.7', category: 'Logical Access', title: 'Data Transmission Security', description: 'Data transmitted securely' },
    { control_id: 'SOC2-CC6.8', category: 'Logical Access', title: 'Malicious Software Prevention', description: 'Malicious software prevention controls' },
    { control_id: 'SOC2-CC7.1', category: 'System Operations', title: 'Vulnerability Detection', description: 'Vulnerabilities detected and monitored' },
    { control_id: 'SOC2-CC7.2', category: 'System Operations', title: 'Anomaly Monitoring', description: 'Anomalies monitored and evaluated' },
    { control_id: 'SOC2-CC7.3', category: 'System Operations', title: 'Security Events Evaluation', description: 'Security events evaluated and response initiated' },
    { control_id: 'SOC2-CC7.4', category: 'System Operations', title: 'Security Incidents Response', description: 'Identified security incidents responded to' },
    { control_id: 'SOC2-CC8.1', category: 'Change Management', title: 'Change Management Process', description: 'Changes managed through formal process' },
    { control_id: 'SOC2-CC9.1', category: 'Risk Mitigation', title: 'Risk Mitigation Activities', description: 'Risk identified and mitigated' },
    { control_id: 'SOC2-CC9.2', category: 'Risk Mitigation', title: 'Vendor Risk Management', description: 'Vendor and business partner risks managed' },
    { control_id: 'SOC2-A1.1', category: 'Availability', title: 'System Capacity Planning', description: 'Current and forecasted capacity managed' },
    { control_id: 'SOC2-A1.2', category: 'Availability', title: 'Environmental Protections', description: 'Environmental threats mitigated' },
    { control_id: 'SOC2-A1.3', category: 'Availability', title: 'Recovery Plan', description: 'Recovery plan procedures tested' },
    { control_id: 'SOC2-PI1.1', category: 'Processing Integrity', title: 'Input Validation', description: 'System inputs complete, accurate, valid' },
    { control_id: 'SOC2-C1.1', category: 'Confidentiality', title: 'Confidential Data Identification', description: 'Confidential information identified and maintained' },
  ],
  ISO27001: [
    { control_id: 'ISO-A5.1', category: 'Organizational', title: 'Policies for information security', description: '' },
    { control_id: 'ISO-A5.2', category: 'Organizational', title: 'Information security roles and responsibilities', description: '' },
    { control_id: 'ISO-A5.3', category: 'Organizational', title: 'Segregation of duties', description: '' },
    { control_id: 'ISO-A5.4', category: 'Organizational', title: 'Management responsibilities', description: '' },
    { control_id: 'ISO-A5.5', category: 'Organizational', title: 'Contact with authorities', description: '' },
    { control_id: 'ISO-A6.1', category: 'People', title: 'Screening', description: '' },
    { control_id: 'ISO-A6.2', category: 'People', title: 'Terms and conditions of employment', description: '' },
    { control_id: 'ISO-A6.3', category: 'People', title: 'Information security awareness, education and training', description: '' },
    { control_id: 'ISO-A6.4', category: 'People', title: 'Disciplinary process', description: '' },
    { control_id: 'ISO-A6.5', category: 'People', title: 'Responsibilities after termination or change of employment', description: '' },
    { control_id: 'ISO-A7.1', category: 'Physical', title: 'Physical security perimeters', description: '' },
    { control_id: 'ISO-A7.2', category: 'Physical', title: 'Physical entry', description: '' },
    { control_id: 'ISO-A7.3', category: 'Physical', title: 'Securing offices, rooms and facilities', description: '' },
    { control_id: 'ISO-A7.4', category: 'Physical', title: 'Physical security monitoring', description: '' },
    { control_id: 'ISO-A8.1', category: 'Technological', title: 'User endpoint devices', description: '' },
    { control_id: 'ISO-A8.2', category: 'Technological', title: 'Privileged access rights', description: '' },
    { control_id: 'ISO-A8.3', category: 'Technological', title: 'Information access restriction', description: '' },
    { control_id: 'ISO-A8.4', category: 'Technological', title: 'Access to source code', description: '' },
    { control_id: 'ISO-A8.5', category: 'Technological', title: 'Secure authentication', description: '' },
    { control_id: 'ISO-A8.6', category: 'Technological', title: 'Capacity management', description: '' },
    { control_id: 'ISO-A8.7', category: 'Technological', title: 'Protection against malware', description: '' },
    { control_id: 'ISO-A8.8', category: 'Technological', title: 'Management of technical vulnerabilities', description: '' },
    { control_id: 'ISO-A8.9', category: 'Technological', title: 'Configuration management', description: '' },
    { control_id: 'ISO-A8.10', category: 'Technological', title: 'Information deletion', description: '' },
    { control_id: 'ISO-A8.11', category: 'Technological', title: 'Data masking', description: '' },
    { control_id: 'ISO-A8.12', category: 'Technological', title: 'Data leakage prevention', description: '' },
    { control_id: 'ISO-A8.13', category: 'Technological', title: 'Information backup', description: '' },
    { control_id: 'ISO-A8.14', category: 'Technological', title: 'Redundancy of information processing facilities', description: '' },
    { control_id: 'ISO-A8.15', category: 'Technological', title: 'Logging', description: '' },
    { control_id: 'ISO-A8.16', category: 'Technological', title: 'Monitoring activities', description: '' },
  ],
  'PCI-DSS': [
    { control_id: 'PCI-001', category: 'Network', title: 'Firewall Configuration', description: 'Install and maintain a firewall configuration to protect cardholder data.' },
    { control_id: 'PCI-002', category: 'Data', title: 'Protect Stored Cardholder Data', description: 'Protect stored cardholder data using encryption or tokenization.' },
    { control_id: 'PCI-003', category: 'Access', title: 'Restrict Access to Cardholder Data', description: 'Restrict access to cardholder data on a need-to-know basis.' },
    { control_id: 'PCI-004', category: 'Transmission', title: 'Encrypt Transmission of Cardholder Data', description: 'Encrypt transmission of cardholder data across open, public networks.' },
    { control_id: 'PCI-005', category: 'Vulnerability', title: 'Protect Systems Against Malware', description: 'Use and regularly update anti-virus software or programs.' },
    { control_id: 'PCI-006', category: 'Development', title: 'Develop Secure Systems', description: 'Develop and maintain secure systems and applications using secure coding practices.' },
    { control_id: 'PCI-007', category: 'Monitoring', title: 'Track and Monitor Access', description: 'Track and monitor all access to network resources and cardholder data.' },
    { control_id: 'PCI-008', category: 'Testing', title: 'Test Security Systems Regularly', description: 'Regularly test security systems and processes including penetration testing.' },
    { control_id: 'PCI-009', category: 'Policy', title: 'Information Security Policy', description: 'Maintain an information security policy that addresses information security for all personnel.' },
    { control_id: 'PCI-010', category: 'Authentication', title: 'Strong Authentication', description: 'Assign a unique ID to each person with computer access; use strong authentication.' },
    { control_id: 'PCI-011', category: 'Physical', title: 'Physical Access Controls', description: 'Restrict physical access to cardholder data environments.' },
    { control_id: 'PCI-012', category: 'Network', title: 'Default Passwords', description: 'Do not use vendor-supplied defaults for system passwords and security parameters.' },
  ],
  NIST: [
    { control_id: 'NIST-001', category: 'Identify', title: 'Asset Management', description: 'Identify and manage organizational assets that support business functions.' },
    { control_id: 'NIST-002', category: 'Protect', title: 'Identity Management', description: 'Manage identities and credentials for authorized devices and users.' },
    { control_id: 'NIST-003', category: 'Detect', title: 'Security Monitoring', description: 'Detect cybersecurity events through continuous monitoring.' },
    { control_id: 'NIST-004', category: 'Identify', title: 'Risk Assessment', description: 'Understand cybersecurity risk to operations, assets, and individuals.' },
    { control_id: 'NIST-005', category: 'Protect', title: 'Awareness and Training', description: 'Ensure personnel have cybersecurity awareness education and training.' },
    { control_id: 'NIST-006', category: 'Protect', title: 'Data Security', description: 'Manage information consistent with risk strategy to protect confidentiality and integrity.' },
    { control_id: 'NIST-007', category: 'Protect', title: 'Protective Technology', description: 'Manage technical security solutions to ensure resilience consistent with policies.' },
    { control_id: 'NIST-008', category: 'Detect', title: 'Anomaly Detection', description: 'Detect anomalies and events and understand their potential impact.' },
    { control_id: 'NIST-009', category: 'Respond', title: 'Incident Response Planning', description: 'Execute and maintain incident response processes and procedures.' },
    { control_id: 'NIST-010', category: 'Respond', title: 'Communications', description: 'Coordinate response activities with internal and external stakeholders.' },
    { control_id: 'NIST-011', category: 'Recover', title: 'Recovery Planning', description: 'Execute and maintain recovery processes to restore systems impacted by incidents.' },
    { control_id: 'NIST-012', category: 'Recover', title: 'Improvements', description: 'Improve recovery planning and processes by incorporating lessons learned.' },
    { control_id: 'NIST-013', category: 'Identify', title: 'Governance', description: 'Establish cybersecurity policies, processes, and procedures to manage risk.' },
    { control_id: 'NIST-014', category: 'Identify', title: 'Supply Chain Risk Management', description: 'Establish priorities, constraints, and assumptions for managing supply chain risk.' },
    { control_id: 'NIST-015', category: 'Protect', title: 'Maintenance', description: 'Perform maintenance and repairs of industrial control and information systems.' },
    { control_id: 'NIST-016', category: 'Protect', title: 'Information Protection Processes', description: 'Maintain and use security policies, processes, and procedures to protect information systems.' },
    { control_id: 'NIST-017', category: 'Detect', title: 'Detection Processes', description: 'Maintain and test detection processes and procedures to ensure timely discovery of events.' },
    { control_id: 'NIST-018', category: 'Respond', title: 'Analysis', description: 'Conduct analysis to ensure adequate response and support recovery activities.' },
    { control_id: 'NIST-019', category: 'Respond', title: 'Mitigation', description: 'Perform activities to prevent expansion of an event and resolve the incident.' },
    { control_id: 'NIST-020', category: 'Identify', title: 'Business Environment', description: 'Understand the mission, objectives, and activities that inform priorities and risk decisions.' },
    { control_id: 'NIST-021', category: 'Protect', title: 'Access Control', description: 'Limit access to assets and associated facilities to authorized users and processes.' },
    { control_id: 'NIST-022', category: 'Detect', title: 'Security Continuous Monitoring', description: 'Monitor the information system to detect cybersecurity events.' },
    { control_id: 'NIST-023', category: 'Recover', title: 'Communications Recovery', description: 'Restore communications capabilities and coordinate recovery activities.' },
  ],
  CCPA: [
    { control_id: 'CCPA-001', category: 'Disclosure', title: 'Privacy Notice at Collection', description: 'Inform consumers of the categories of personal information collected at or before collection.' },
    { control_id: 'CCPA-002', category: 'Rights', title: 'Right to Know', description: 'Allow consumers to request disclosure of personal information collected about them.' },
    { control_id: 'CCPA-003', category: 'Rights', title: 'Right to Delete', description: 'Allow consumers to request deletion of personal information.' },
    { control_id: 'CCPA-004', category: 'Rights', title: 'Right to Opt-Out', description: 'Allow consumers to opt out of the sale of their personal information.' },
    { control_id: 'CCPA-005', category: 'Non-Discrimination', title: 'Non-Discrimination', description: 'Do not discriminate against consumers who exercise their CCPA rights.' },
    { control_id: 'CCPA-006', category: 'Disclosure', title: 'Privacy Policy', description: 'Maintain a comprehensive privacy policy disclosing data practices.' },
    { control_id: 'CCPA-007', category: 'Verification', title: 'Request Verification', description: 'Implement reasonable methods to verify the identity of consumers making requests.' },
    { control_id: 'CCPA-008', category: 'Response', title: 'Response Timelines', description: 'Respond to consumer requests within 45 days; extend by additional 45 days if necessary.' },
    { control_id: 'CCPA-009', category: 'Data Inventory', title: 'Data Mapping', description: 'Maintain a comprehensive inventory of personal information categories collected and shared.' },
    { control_id: 'CCPA-010', category: 'Security', title: 'Reasonable Security', description: 'Implement and maintain reasonable security procedures to protect personal information.' },
  ],
};

function getSeverityBadgeClass(severity: string) {
  switch (severity) {
    case 'critical': return 'bg-red-600 text-white';
    case 'high': return 'bg-orange-500 text-white';
    case 'medium': return 'bg-amber-500 text-white';
    case 'low': return 'bg-blue-500 text-white';
    default: return 'bg-gray-400 text-white';
  }
}

function getEventTypeBadgeClass(eventType: string) {
  switch (eventType) {
    case 'login': return 'border-green-400 text-green-700';
    case 'logout': return 'border-gray-400 text-gray-600';
    case 'create': return 'border-blue-400 text-blue-700';
    case 'update': return 'border-yellow-400 text-yellow-700';
    case 'delete': return 'border-red-400 text-red-700';
    case 'security_alert': return 'border-orange-400 text-orange-700';
    case 'failed_login': return 'border-red-400 text-red-700';
    default: return 'border-gray-300 text-gray-600';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'success':
    case 'compliant':
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'failure':
    case 'non_compliant':
    case 'rejected':
      return <XCircle className="h-4 w-4 text-red-600" />;
    case 'partial':
    case 'in_progress':
    case 'in-progress':
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    default:
      return <Clock className="h-4 w-4 text-gray-600" />;
  }
}

function getRiskColor(score: number) {
  if (score >= 9) return 'bg-red-500';
  if (score >= 6) return 'bg-orange-400';
  if (score >= 3) return 'bg-amber-400';
  return 'bg-green-400';
}

function getRiskStatusBadgeClass(status: string) {
  switch (status) {
    case 'open': return 'bg-red-100 text-red-700 border border-red-200';
    case 'mitigating': return 'bg-amber-100 text-amber-700 border border-amber-200';
    case 'resolved': return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    case 'accepted': return 'bg-blue-100 text-blue-700 border border-blue-200';
    default: return 'bg-gray-100 text-gray-700 border border-gray-200';
  }
}

function ComplianceScoreRing({ score }: { score: number }) {
  const r = 44, cx = 56, cy = 56;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - score / 100);
  const color = score < 50 ? '#ef4444' : score < 75 ? '#f59e0b' : '#10b981';
  const label = score < 50 ? 'At Risk' : score < 75 ? 'Improving' : 'Compliant';
  return (
    <div className="flex flex-col items-center">
      <svg width="112" height="112">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circumference} strokeDashoffset={dashOffset}
          strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}
        />
        <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="central" fontSize="18" fontWeight="bold" fill="#1f2937">{score}%</text>
        <text x={cx} y={cy + 14} textAnchor="middle" dominantBaseline="central" fontSize="10" fill="#6b7280">{label}</text>
      </svg>
    </div>
  );
}

export default function SecurityComplianceDashboard({ accessToken, onLogout }: SecurityComplianceDashboardProps) {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const { log } = useAuditLogger();

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [selectedEventType, setSelectedEventType] = useState('all');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [auditLoading, setAuditLoading] = useState(false);

  const [frameworks, setFrameworks] = useState<ComplianceFrameworkRow[]>([]);
  const [selectedFrameworkName, setSelectedFrameworkName] = useState('GDPR');
  const [requirements, setRequirements] = useState<ComplianceRequirement[]>([]);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [assessments, setAssessments] = useState<ComplianceAssessment[]>([]);
  const [showAssessmentHistory, setShowAssessmentHistory] = useState(false);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [assessmentForm, setAssessmentForm] = useState({
    assessment_date: new Date().toISOString().split('T')[0],
    score: 0,
    assessor: '',
    notes: '',
    findings: '',
    recommendations: '',
    overall_status: 'compliant',
  });

  const [privacyRequests, setPrivacyRequests] = useState<PrivacyRequest[]>([]);
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [showNewRequestSlideOver, setShowNewRequestSlideOver] = useState(false);
  const [newRequest, setNewRequest] = useState({
    requester_name: '',
    requester_email: '',
    request_type: 'access',
    regulation: 'GDPR',
    description: '',
    received_at: new Date().toISOString().split('T')[0],
  });

  const [risks, setRisks] = useState<SecurityRisk[]>([]);
  const [risksLoading, setRisksLoading] = useState(false);
  const [showNewRiskSlideOver, setShowNewRiskSlideOver] = useState(false);
  const [editingRisk, setEditingRisk] = useState<SecurityRisk | null>(null);
  const [matrixFilter, setMatrixFilter] = useState<{ likelihood: number; impact: number } | null>(null);
  const [newRisk, setNewRisk] = useState({
    title: '',
    category: 'Data Breach',
    likelihood: 1,
    impact: 1,
    mitigation_plan: '',
    status: 'open',
    owner: '',
    review_date: '',
  });

  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [activeTab, setActiveTab] = useState('audit');

  // Bulk evidence state
  const [showBulkEvidenceModal, setShowBulkEvidenceModal] = useState(false);
  const [bulkEvidenceText, setBulkEvidenceText] = useState('');
  const [bulkEvidenceType, setBulkEvidenceType] = useState('document');
  const [bulkDescription, setBulkDescription] = useState('');

  // Evidence state
  const [showAddEvidenceModal, setShowAddEvidenceModal] = useState(false);
  const [evidenceReq, setEvidenceReq] = useState<ComplianceRequirement | null>(null);
  const [evidenceForm, setEvidenceForm] = useState({ name: '', evidence_type: 'document', notes: '', file_name: '' });
  const [evidenceByReqId, setEvidenceByReqId] = useState<Record<string, ComplianceEvidence[]>>({});
  const [showViewEvidenceModal, setShowViewEvidenceModal] = useState(false);
  const [viewEvidenceReq, setViewEvidenceReq] = useState<ComplianceRequirement | null>(null);
  const [deleteEvidenceId, setDeleteEvidenceId] = useState<string | null>(null);
  const [showFileEvidenceModal, setShowFileEvidenceModal] = useState(false);
  const [fileEvidenceReq, setFileEvidenceReq] = useState<ComplianceRequirement | null>(null);

  // Assessment detail state
  const [showAssessmentDetailModal, setShowAssessmentDetailModal] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<ComplianceAssessment | null>(null);
  const [allFrameworkAssessments, setAllFrameworkAssessments] = useState<ComplianceAssessment[]>([]);

  // Status change reason modal (Fix E)
  const [statusChangeModal, setStatusChangeModal] = useState<{ reqId: string; newStatus: string } | null>(null);
  const [statusChangeReason, setStatusChangeReason] = useState('');

  // Response notes modal for privacy requests (Fix F)
  const [responseNotesModal, setResponseNotesModal] = useState<{ reqId: string; newStatus: string } | null>(null);
  const [responseNotes, setResponseNotes] = useState('');

  // Audit log retention settings
  const [auditRetentionDays, setAuditRetentionDays] = useState(365);
  const [showRetentionSettings, setShowRetentionSettings] = useState(false);
  const [selectedRetention, setSelectedRetention] = useState(365);

  // Login failure spike detection
  const [loginSpikeAccounts, setLoginSpikeAccounts] = useState<{ email: string; count: number }[]>([]);

  const loadLoginFailures = useCallback(async () => {
    const { data: failures } = await supabase
      .from("audit_logs")
      .select("metadata, created_at, user_email")
      .eq("action", "login_failed")
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false });
    if (!failures) return;
    const countMap: Record<string, number> = {};
    for (const f of failures as { user_email: string }[]) {
      if (f.user_email) countMap[f.user_email] = (countMap[f.user_email] ?? 0) + 1;
    }
    const spikes = Object.entries(countMap)
      .filter(([, c]) => c >= 5)
      .map(([email, count]) => ({ email, count }))
      .sort((a, b) => b.count - a.count);
    setLoginSpikeAccounts(spikes);
  }, []);

  const seedRequirements = useCallback(async () => {
    const { data: fwRows } = await supabase.from('compliance_frameworks').select('id, name');
    if (!fwRows) return;
    const fwMap = Object.fromEntries(fwRows.map((f: { id: string; name: string }) => [f.name, f.id]));
    const toSeed: Array<{
      framework_id: string;
      control_id: string;
      category: string;
      title: string;
      description: string;
      status: string;
      evidence: unknown[];
    }> = [];
    for (const [fwName, reqs] of Object.entries(FRAMEWORK_SEED)) {
      const fwId = fwMap[fwName];
      if (!fwId) continue;
      for (const req of reqs) {
        toSeed.push({ framework_id: fwId, ...req, status: 'non_compliant', evidence: [] });
      }
    }
    if (toSeed.length > 0) {
      void supabase.from('compliance_requirements').upsert(toSeed, { onConflict: 'framework_id,control_id', ignoreDuplicates: true });
    }
  }, []);

  const loadAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    let query = supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(500);
    if (selectedEventType !== 'all') query = query.eq('event_type', selectedEventType);
    if (selectedSeverity !== 'all') query = query.eq('severity', selectedSeverity);
    if (dateFrom) query = query.gte('timestamp', dateFrom);
    if (dateTo) query = query.lte('timestamp', dateTo + 'T23:59:59');
    if (logSearchQuery) {
      query = query.or(`user_email.ilike.%${logSearchQuery}%,action.ilike.%${logSearchQuery}%,resource_type.ilike.%${logSearchQuery}%`);
    }
    const { data } = await query;
    setAuditLogs(data ?? []);
    setAuditLoading(false);
  }, [selectedEventType, selectedSeverity, dateFrom, dateTo, logSearchQuery]);

  const loadFrameworks = useCallback(async () => {
    const { data } = await supabase.from('compliance_frameworks').select('*').order('name');
    setFrameworks(data ?? []);
  }, []);

  const loadRequirements = useCallback(async () => {
    setComplianceLoading(true);
    const fw = frameworks.find(f => f.name === selectedFrameworkName);
    if (!fw) { setComplianceLoading(false); return; }
    const { data } = await supabase
      .from('compliance_requirements')
      .select('*')
      .eq('framework_id', fw.id)
      .order('control_id');
    setRequirements(data ?? []);
    setComplianceLoading(false);
  }, [frameworks, selectedFrameworkName]);

  const loadAssessments = useCallback(async () => {
    const fw = frameworks.find(f => f.name === selectedFrameworkName);
    if (!fw) return;
    const { data } = await supabase
      .from('compliance_assessments')
      .select('*')
      .eq('framework_id', fw.id)
      .order('assessment_date', { ascending: false })
      .limit(10);
    setAssessments(data ?? []);
  }, [frameworks, selectedFrameworkName]);

  const loadEvidence = useCallback(async (reqIds: string[]) => {
    if (reqIds.length === 0) return;
    const { data } = await supabase
      .from('compliance_evidence')
      .select('*')
      .in('requirement_id', reqIds)
      .order('created_at', { ascending: false });
    if (!data) return;
    const byReq: Record<string, ComplianceEvidence[]> = {};
    for (const ev of data as ComplianceEvidence[]) {
      if (!byReq[ev.requirement_id]) byReq[ev.requirement_id] = [];
      byReq[ev.requirement_id].push(ev);
    }
    setEvidenceByReqId(byReq);
  }, []);

  const loadPrivacyRequests = useCallback(async () => {
    setPrivacyLoading(true);
    const { data } = await supabase.from('privacy_requests').select('*').order('received_at', { ascending: false });
    setPrivacyRequests(data ?? []);
    setPrivacyLoading(false);
  }, []);

  const loadRisks = useCallback(async () => {
    setRisksLoading(true);
    const { data } = await supabase.from('security_risks').select('*').order('risk_score', { ascending: false });
    setRisks(data ?? []);
    setRisksLoading(false);
  }, []);

  useEffect(() => {
    void seedRequirements();
    void loadFrameworks();
    void loadPrivacyRequests();
    void loadRisks();
  }, []);

  useEffect(() => { void loadAuditLogs(); }, [loadAuditLogs]);

  useEffect(() => {
    if (frameworks.length > 0) {
      void (async () => {
        await loadRequirements();
      })();
      void loadAssessments();
    }
  }, [frameworks, selectedFrameworkName]);

  useEffect(() => {
    if (activeTab === 'security') void loadLoginFailures();
  }, [activeTab]);

  useEffect(() => {
    if (requirements.length > 0) {
      void loadEvidence(requirements.map(r => r.id));
    }
  }, [requirements]);

  useEffect(() => {
    void (async () => {
      const { data: retentionConfig } = await supabase
        .from('master_data_config')
        .select('config_value')
        .eq('config_group', 'security_policies')
        .eq('config_key', 'audit_log_retention_days')
        .single();
      const days = retentionConfig?.config_value ? parseInt(retentionConfig.config_value) : 365;
      setAuditRetentionDays(days);
      setSelectedRetention(days);
    })();
  }, []);

  const handleSaveRetention = () => {
    void supabase.from('master_data_config').upsert([{
      config_group: 'security_policies',
      config_key: 'audit_log_retention_days',
      config_value: String(selectedRetention),
      display_name: 'Audit Log Retention Period',
      data_type: 'number',
    }], { onConflict: 'config_group,config_key' });
    setAuditRetentionDays(selectedRetention);
    setShowRetentionSettings(false);
    toast.success("Audit log retention policy updated");
  };

  const handleExportLogs = () => {
    if (!['admin', 'security', 'hr_admin'].includes(currentUser?.primaryRole || '')) {
      toast.error("Export restricted to admin and security roles");
      return;
    }
    const headers = ['Timestamp', 'User Email', 'Event Type', 'Action', 'Resource', 'Severity', 'Status', 'IP'];
    const rows = auditLogs.map(l => [
      l.timestamp, l.user_email, l.event_type, l.action,
      `${l.resource_type}/${l.resource_id}`, l.severity, l.status, l.ip_address,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString()}.csv`;
    a.click();
    log({ event_type: 'export', action: 'audit_log_exported', resource_type: 'audit_logs', metadata: { filters: { selectedEventType, selectedSeverity, dateFrom, dateTo, logSearchQuery } } });
    toast.success(t('securityDashboard.auditLogsExported'));
  };

  const handleUpdateRequirement = async (id: string, status: string, reason: string) => {
    const oldReq = requirements.find(r => r.id === id);
    if (status === 'compliant') {
      const { data: evCount } = await supabase
        .from('compliance_evidence')
        .select('id', { count: 'exact' })
        .eq('requirement_id', id)
        .limit(1);
      if (!evCount || evCount.length === 0) {
        toast.error("At least one evidence document must be attached before marking as compliant.");
        return;
      }
    }
    await supabase.from('compliance_requirements').update({ status, last_assessed: new Date().toISOString(), status_change_reason: reason }).eq('id', id);
    setRequirements(prev => prev.map(r => r.id === id ? { ...r, status: status as ComplianceRequirement['status'] } : r));
    log({ event_type: 'update', action: 'compliance_status_updated', resource_type: 'compliance_requirement', resource_id: id, metadata: { framework: selectedFrameworkName, old_status: oldReq?.status, new_status: status } });
    toast.success(t('securityDashboard.requirementUpdated'));
  };

  const handleConfirmStatusChange = async () => {
    if (!statusChangeModal) return;
    if (statusChangeReason.trim().length < 20) {
      toast.error("Reason must be at least 20 characters");
      return;
    }
    await handleUpdateRequirement(statusChangeModal.reqId, statusChangeModal.newStatus, statusChangeReason);
    setStatusChangeModal(null);
    setStatusChangeReason('');
  };

  const handleUpdatePrivacyRequest = async (id: string, status: string, notes?: string) => {
    const update: Record<string, unknown> = { status };
    if (status === 'completed') update.completed_at = new Date().toISOString();
    if (notes) update.response_notes = notes;
    await supabase.from('privacy_requests').update(update).eq('id', id);
    setPrivacyRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    if (status === 'completed' || status === 'rejected') {
      log({ event_type: 'update', action: 'privacy_request_completed', resource_type: 'privacy_request', resource_id: id, metadata: { action: status } });
    }
    if (status === 'in_progress') {
      log({ event_type: 'update', action: 'privacy_request_in_progress', resource_type: 'privacy_request', resource_id: id, metadata: { request_id: id } });
    }
    toast.success(t('securityDashboard.requestUpdated'));
  };

  const handlePrivacyStatusChange = (id: string, status: string) => {
    if (status === 'completed' || status === 'rejected') {
      setResponseNotesModal({ reqId: id, newStatus: status });
    } else {
      void handleUpdatePrivacyRequest(id, status);
    }
  };

  const handleConfirmResponseNotes = async () => {
    if (!responseNotesModal) return;
    if (responseNotes.trim().length < 20) {
      toast.error("Response notes must be at least 20 characters");
      return;
    }
    await handleUpdatePrivacyRequest(responseNotesModal.reqId, responseNotesModal.newStatus, responseNotes);
    setResponseNotesModal(null);
    setResponseNotes('');
  };

  const handleCreatePrivacyRequest = async () => {
    const dueDays = newRequest.regulation === 'CCPA' ? 45 : 30;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDays);
    const { error } = await supabase.from('privacy_requests').insert([{
      requester_name: newRequest.requester_name,
      requester_email: newRequest.requester_email,
      request_type: newRequest.request_type,
      regulation: newRequest.regulation,
      description: newRequest.description,
      status: 'pending',
      received_at: newRequest.received_at ? new Date(newRequest.received_at).toISOString() : new Date().toISOString(),
      due_date: dueDate.toISOString().split('T')[0],
    }]);
    if (error) { toast.error(error.message); return; }
    log({ event_type: 'create', action: 'privacy_request_created', resource_type: 'privacy_request', metadata: { request_type: newRequest.request_type, regulation: newRequest.regulation, subject_name: newRequest.requester_name } });
    toast.success(t('securityDashboard.requestCreated'));
    setShowNewRequestSlideOver(false);
    setNewRequest({ requester_name: '', requester_email: '', request_type: 'access', regulation: 'GDPR', description: '', received_at: new Date().toISOString().split('T')[0] });
    void loadPrivacyRequests();
  };

  const handleCreateRisk = async () => {
    const score = Number(newRisk.likelihood) * Number(newRisk.impact);
    if (editingRisk) {
      const { error } = await supabase.from('security_risks').update({
        ...newRisk,
        likelihood: Number(newRisk.likelihood),
        impact: Number(newRisk.impact),
        risk_score: score,
        last_reviewed_at: new Date().toISOString(),
      }).eq('id', editingRisk.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Risk updated');
    } else {
      const { error } = await supabase.from('security_risks').insert([{
        ...newRisk,
        likelihood: Number(newRisk.likelihood),
        impact: Number(newRisk.impact),
        risk_score: score,
      }]);
      if (error) { toast.error(error.message); return; }
      toast.success(t('securityDashboard.riskAdded'));
    }
    setShowNewRiskSlideOver(false);
    setEditingRisk(null);
    setNewRisk({ title: '', category: 'Data Breach', likelihood: 1, impact: 1, mitigation_plan: '', status: 'open', owner: '', review_date: '' });
    void loadRisks();
  };

  const handleDeleteRisk = async (risk: SecurityRisk) => {
    toast("Delete this risk?", {
      action: {
        label: 'Delete',
        onClick: () => {
          void supabase.from('security_risks').delete().eq('id', risk.id);
          setRisks(prev => prev.filter(r => r.id !== risk.id));
          toast.success('Risk deleted');
        },
      },
      cancel: { label: 'Cancel', onClick: () => {} },
    });
  };

  const handleEditRisk = (risk: SecurityRisk) => {
    setEditingRisk(risk);
    setNewRisk({
      title: risk.title,
      category: risk.category,
      likelihood: risk.likelihood,
      impact: risk.impact,
      mitigation_plan: risk.mitigation_plan ?? '',
      status: risk.status,
      owner: risk.owner ?? '',
      review_date: risk.review_date ?? '',
    });
    setShowNewRiskSlideOver(true);
  };

  const handleSubmitAssessment = async () => {
    const fw = frameworks.find(f => f.name === selectedFrameworkName);
    if (!fw) return;
    const { error } = await supabase.from('compliance_assessments').insert([{
      framework_id: fw.id,
      assessment_date: assessmentForm.assessment_date,
      score: assessmentForm.score,
      assessor: assessmentForm.assessor,
      notes: assessmentForm.notes,
      findings: assessmentForm.findings,
      recommendations: assessmentForm.recommendations,
      overall_status: assessmentForm.overall_status,
    }]);
    if (error) { toast.error(error.message); return; }
    toast.success('Assessment submitted');
    setShowAssessmentModal(false);
    setAssessmentForm({ assessment_date: new Date().toISOString().split('T')[0], score: 0, assessor: '', notes: '', findings: '', recommendations: '', overall_status: 'compliant' });
    void loadAssessments();
  };

  const handleBulkAddEvidence = async () => {
    if (!evidenceReq) return;
    const fileNames = bulkEvidenceText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (fileNames.length === 0) return;
    const rows = fileNames.map(name => ({
      requirement_id: evidenceReq.id,
      file_name: name,
      evidence_type: bulkEvidenceType,
      description: bulkDescription,
      uploaded_by: currentUser?.id,
      uploaded_at: new Date().toISOString(),
    }));
    const { data } = await supabase.from('compliance_evidence').insert(rows).select();
    if (data && data.length > 0) {
      setEvidenceByReqId(prev => ({
        ...prev,
        [evidenceReq.id]: [...(prev[evidenceReq.id] ?? []), ...(data as ComplianceEvidence[])],
      }));
    }
    toast.success(`Added ${rows.length} evidence items`);
    setShowBulkEvidenceModal(false);
    setBulkEvidenceText('');
    setBulkEvidenceType('document');
    setBulkDescription('');
  };

  const handleAddEvidence = () => {
    if (!evidenceReq || !evidenceForm.name) return;
    void supabase.from('compliance_evidence').insert([{
      requirement_id: evidenceReq.id,
      name: evidenceForm.name,
      evidence_type: evidenceForm.evidence_type,
      notes: evidenceForm.notes,
      file_name: evidenceForm.file_name,
    }]);
    toast.success('Evidence added');
    setShowAddEvidenceModal(false);
    setEvidenceForm({ name: '', evidence_type: 'document', notes: '', file_name: '' });
    // Refresh evidence after a brief moment
    setTimeout(() => { void loadEvidence(requirements.map(r => r.id)); }, 500);
  };

  const handleDeleteEvidence = (evidenceId: string, reqId: string) => {
    void supabase.from('compliance_evidence').delete().eq('id', evidenceId);
    setEvidenceByReqId(prev => ({
      ...prev,
      [reqId]: (prev[reqId] ?? []).filter(e => e.id !== evidenceId),
    }));
    toast.success('Evidence deleted');
  };

  // ── Base64 file evidence helpers ──────────────────────────────────────────

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function fileTypeIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return '🖼';
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return '📊';
    return '📁';
  }

  function downloadEvidence(file: EvidenceFile) {
    const link = document.createElement('a');
    link.href = `data:${file.type};base64,${file.data}`;
    link.download = file.name;
    link.click();
  }

  const handleEvidenceFileUpload = async (requirementId: string, files: FileList) => {
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    const uploadedFiles: EvidenceFile[] = [];

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds 5 MB limit and was skipped`);
        continue;
      }
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        uploadedFiles.push({
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64,
          uploaded_at: new Date().toISOString(),
        });
      } catch {
        toast.error(`Failed to read ${file.name}`);
      }
    }

    if (uploadedFiles.length === 0) return;

    const { data: existing } = await supabase
      .from('compliance_requirements')
      .select('evidence_data')
      .eq('id', requirementId)
      .single();

    const currentFiles = (existing?.evidence_data as EvidenceFile[]) || [];
    const newFiles = [...currentFiles, ...uploadedFiles];

    void supabase
      .from('compliance_requirements')
      .update({ evidence_data: newFiles, evidence_uploaded: true, evidence_uploaded_at: new Date().toISOString() })
      .eq('id', requirementId);

    setRequirements(prev =>
      prev.map(r =>
        r.id === requirementId
          ? { ...r, evidence_data: newFiles, evidence_uploaded: true, evidence_uploaded_at: new Date().toISOString() }
          : r
      )
    );

    toast.success(`${uploadedFiles.length} file(s) uploaded as evidence`);
  };

  const handleDeleteFileEvidence = async (requirementId: string, fileIndex: number) => {
    const req = requirements.find(r => r.id === requirementId);
    if (!req) return;
    const currentFiles = req.evidence_data ?? [];
    const newFiles = currentFiles.filter((_, i) => i !== fileIndex);

    void supabase
      .from('compliance_requirements')
      .update({ evidence_data: newFiles, evidence_uploaded: newFiles.length > 0, evidence_uploaded_at: newFiles.length > 0 ? req.evidence_uploaded_at : null })
      .eq('id', requirementId);

    setRequirements(prev =>
      prev.map(r =>
        r.id === requirementId ? { ...r, evidence_data: newFiles, evidence_uploaded: newFiles.length > 0 } : r
      )
    );

    if (fileEvidenceReq?.id === requirementId) {
      setFileEvidenceReq(prev => prev ? { ...prev, evidence_data: newFiles } : prev);
    }

    toast.success('File evidence deleted');
  };

  const handleExportComplianceReport = () => {
    const headers = ['Framework', 'Control ID', 'Category', 'Requirement', 'Status', 'Last Assessed', 'Due Date', 'Assigned To'];
    const rows = requirements.map(r => [
      selectedFrameworkName,
      r.control_id,
      r.category,
      r.title,
      r.status,
      r.last_assessed ? new Date(r.last_assessed).toLocaleDateString() : '',
      r.due_date ? new Date(r.due_date).toLocaleDateString() : '',
      r.assigned_to ?? '',
    ]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-${selectedFrameworkName}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Compliance report exported');
  };

  const handleViewAssessmentDetail = async (assessment: ComplianceAssessment) => {
    setSelectedAssessment(assessment);
    const fw = frameworks.find(f => f.name === selectedFrameworkName);
    if (fw) {
      const { data } = await supabase
        .from('compliance_assessments')
        .select('*')
        .eq('framework_id', fw.id)
        .order('assessment_date', { ascending: true });
      setAllFrameworkAssessments(data ?? []);
    }
    setShowAssessmentDetailModal(true);
  };

  const auditStats = {
    total: auditLogs.length,
    critical: auditLogs.filter(l => l.severity === 'critical').length,
    failed: auditLogs.filter(l => l.status === 'failure').length,
    uniqueUsers: new Set(auditLogs.map(l => l.user_email)).size,
  };

  const complianceStats = {
    compliant: requirements.filter(r => r.status === 'compliant').length,
    partial: requirements.filter(r => r.status === 'partial').length,
    inProgress: requirements.filter(r => r.status === 'in_progress').length,
    nonCompliant: requirements.filter(r => r.status === 'non_compliant').length,
    total: requirements.length,
  };

  const complianceRate = complianceStats.total
    ? Math.round((complianceStats.compliant / complianceStats.total) * 100)
    : 0;

  const now = new Date();
  const privacyStats = {
    total: privacyRequests.length,
    pending: privacyRequests.filter(r => r.status === 'pending').length,
    overdue: privacyRequests.filter(r => r.due_date && new Date(r.due_date) < now && r.status !== 'completed' && r.status !== 'rejected').length,
    completedThisMonth: privacyRequests.filter(r => {
      if (r.status !== 'completed' || !r.completed_at) return false;
      const d = new Date(r.completed_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length,
  };

  const riskStats = {
    total: risks.length,
    high: risks.filter(r => r.risk_score >= 6).length,
    mitigated: risks.filter(r => r.status === 'resolved').length,
  };

  const filteredRisks = matrixFilter
    ? risks.filter(r => r.likelihood === matrixFilter.likelihood && r.impact === matrixFilter.impact)
    : risks;

  const eventsByType = auditLogs.reduce((acc, l) => {
    acc[l.event_type] = (acc[l.event_type] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const userActivityMap = auditLogs.reduce((acc, l) => {
    if (!l.user_email) return acc;
    acc[l.user_email] = (acc[l.user_email] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topUsers = Object.entries(userActivityMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <AppLayout title={t('securityDashboard.title')} icon={<Shield className="h-6 w-6" />} onLogout={onLogout}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: t('securityDashboard.totalAuditEvents'), value: auditStats.total, sub: t('securityDashboard.last90Days'), icon: <Activity className="h-6 w-6 text-blue-600" />, bg: 'bg-blue-100' },
            { label: t('securityDashboard.criticalEvents'), value: auditStats.critical, valueClass: 'text-red-600', sub: t('securityDashboard.requiresAttention'), icon: <AlertTriangle className="h-6 w-6 text-red-600" />, bg: 'bg-red-100' },
            { label: t('securityDashboard.complianceRate'), value: `${complianceRate}%`, valueClass: 'text-green-600', sub: `${selectedFrameworkName} ${t('securityDashboard.framework')}`, icon: <Award className="h-6 w-6 text-green-600" />, bg: 'bg-green-100' },
            { label: t('securityDashboard.privacyRequests'), value: privacyStats.pending, sub: t('securityDashboard.pendingAction'), icon: <Lock className="h-6 w-6 text-purple-600" />, bg: 'bg-purple-100' },
          ].map((card, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">{card.label}</p>
                      <p className={`text-3xl font-bold ${card.valueClass ?? ''}`}>{card.value}</p>
                      <p className="text-xs text-gray-500 mt-1">{card.sub}</p>
                    </div>
                    <div className={`w-12 h-12 ${card.bg} rounded-lg flex items-center justify-center`}>{card.icon}</div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="audit"><FileText className="h-4 w-4 mr-1 hidden sm:inline" />{t('securityDashboard.tabAuditLogs')}</TabsTrigger>
            <TabsTrigger value="compliance"><Award className="h-4 w-4 mr-1 hidden sm:inline" />{t('securityDashboard.tabCompliance')}</TabsTrigger>
            <TabsTrigger value="privacy"><Lock className="h-4 w-4 mr-1 hidden sm:inline" />{t('securityDashboard.tabPrivacy')}</TabsTrigger>
            <TabsTrigger value="security"><Shield className="h-4 w-4 mr-1 hidden sm:inline" />{t('securityDashboard.tabSecurityOverview')}</TabsTrigger>
            <TabsTrigger value="risk"><BarChart2 className="h-4 w-4 mr-1 hidden sm:inline" />{t('securityDashboard.tabRiskRegister')}</TabsTrigger>
          </TabsList>

          {/* AUDIT LOGS TAB */}
          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle>{t('securityDashboard.auditTrail')}</CardTitle>
                    <CardDescription>{t('securityDashboard.auditTrailDesc')}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button onClick={handleExportLogs} variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />{t('securityDashboard.exportCsv')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRetentionSettings(v => !v)}
                      title="Audit Log Retention Settings"
                    >
                      ⚙ Retention: {auditRetentionDays}d
                    </Button>
                    <ReportDefectButton appName="Security & Compliance" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {showRetentionSettings && (
                  <div className="bg-muted rounded-lg p-4 border border-border flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">Audit Log Retention Period</p>
                      <p className="text-xs text-muted-foreground mt-0.5">How long audit logs are kept before automatic purge.</p>
                    </div>
                    <select
                      value={selectedRetention}
                      onChange={e => setSelectedRetention(parseInt(e.target.value))}
                      className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value={90}>90 days</option>
                      <option value={180}>180 days</option>
                      <option value={365}>365 days (1 year)</option>
                      <option value={730}>2 years</option>
                      <option value={2555}>7 years (compliance)</option>
                    </select>
                    <button
                      onClick={handleSaveRetention}
                      className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Save
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="relative lg:col-span-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input placeholder={t('securityDashboard.searchLogs')} value={logSearchQuery} onChange={e => setLogSearchQuery(e.target.value)} className="pl-10" />
                  </div>
                  <Select value={selectedEventType} onValueChange={setSelectedEventType}>
                    <SelectTrigger><SelectValue placeholder={t('securityDashboard.eventType')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('securityDashboard.allEvents')}</SelectItem>
                      <SelectItem value="login">{t('securityDashboard.login')}</SelectItem>
                      <SelectItem value="logout">{t('securityDashboard.logout')}</SelectItem>
                      <SelectItem value="create">{t('securityDashboard.create')}</SelectItem>
                      <SelectItem value="update">{t('securityDashboard.update')}</SelectItem>
                      <SelectItem value="delete">{t('securityDashboard.delete')}</SelectItem>
                      <SelectItem value="export">{t('securityDashboard.export')}</SelectItem>
                      <SelectItem value="security_alert">{t('securityDashboard.securityAlert')}</SelectItem>
                      <SelectItem value="failed_login">{t('securityDashboard.failedLogin')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
                    <SelectTrigger><SelectValue placeholder={t('securityDashboard.severity')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('securityDashboard.allSeverities')}</SelectItem>
                      <SelectItem value="info">{t('securityDashboard.info')}</SelectItem>
                      <SelectItem value="low">{t('securityDashboard.low')}</SelectItem>
                      <SelectItem value="medium">{t('securityDashboard.medium')}</SelectItem>
                      <SelectItem value="high">{t('securityDashboard.high')}</SelectItem>
                      <SelectItem value="critical">{t('securityDashboard.critical')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder={t('securityDashboard.dateFrom')} className="text-xs" />
                    <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder={t('securityDashboard.dateTo')} className="text-xs" />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: t('securityDashboard.totalAuditEvents'), value: auditStats.total, color: 'text-gray-900' },
                    { label: t('securityDashboard.criticalEvents'), value: auditStats.critical, color: 'text-red-600' },
                    { label: t('securityDashboard.failedActions'), value: auditStats.failed, color: 'text-orange-600' },
                    { label: t('securityDashboard.uniqueUsers'), value: auditStats.uniqueUsers, color: 'text-blue-600' },
                  ].map((s, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto max-h-[450px]">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('securityDashboard.colTimestamp')}</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('securityDashboard.colUser')}</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('securityDashboard.colEvent')}</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('securityDashboard.colAction')}</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('securityDashboard.colResource')}</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('securityDashboard.severity')}</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.status')}</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('securityDashboard.colIp')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {auditLoading ? (
                          <tr><td colSpan={8} className="text-center py-8 text-gray-500">Loading...</td></tr>
                        ) : auditLogs.length === 0 ? (
                          <tr><td colSpan={8} className="text-center py-8 text-gray-500">{t('securityDashboard.noLogsFound')}</td></tr>
                        ) : auditLogs.map(log => (
                          <tr
                            key={log.id}
                            onClick={() => setSelectedLog(log)}
                            className={`cursor-pointer hover:bg-gray-50 transition-colors ${log.severity === 'critical' ? 'bg-red-50' : ''}`}
                          >
                            <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium text-gray-900">{log.user_email}</p>
                                <p className="text-xs text-gray-500">{log.user_role}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className={getEventTypeBadgeClass(log.event_type)}>
                                {log.event_type.replace(/_/g, ' ')}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-gray-900">{log.action}</td>
                            <td className="px-4 py-3 text-gray-600">{log.resource_type}{log.resource_id ? `/${log.resource_id}` : ''}</td>
                            <td className="px-4 py-3">
                              <Badge className={getSeverityBadgeClass(log.severity)}>{log.severity}</Badge>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">{getStatusIcon(log.status)}<span className="capitalize">{log.status}</span></div>
                            </td>
                            <td className="px-4 py-3 text-gray-600 font-mono text-xs">{log.ip_address}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* COMPLIANCE TAB */}
          <TabsContent value="compliance" className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex gap-2 flex-wrap">
                {FRAMEWORKS.map(fw => (
                  <button
                    key={fw}
                    onClick={() => setSelectedFrameworkName(fw)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedFrameworkName === fw ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    {fw}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportComplianceReport} disabled={requirements.length === 0}>
                  <Download className="h-4 w-4 mr-1" />Export Report
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowAssessmentModal(true)}>
                  {t('securityDashboard.newAssessment')}
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <ComplianceScoreRing score={complianceRate} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
                {[
                  { label: t('securityDashboard.compliant'), value: complianceStats.compliant, color: 'text-green-600', icon: <CheckCircle className="h-6 w-6 text-green-600" /> },
                  { label: t('securityDashboard.partial'), value: complianceStats.partial, color: 'text-yellow-600', icon: <AlertTriangle className="h-6 w-6 text-yellow-600" /> },
                  { label: t('securityDashboard.inProgress'), value: complianceStats.inProgress, color: 'text-blue-600', icon: <Clock className="h-6 w-6 text-blue-600" /> },
                  { label: t('securityDashboard.nonCompliant'), value: complianceStats.nonCompliant, color: 'text-red-600', icon: <XCircle className="h-6 w-6 text-red-600" /> },
                ].map((s, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">{s.label}</p>
                          <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        </div>
                        {s.icon}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{selectedFrameworkName} {t('securityDashboard.requirements')}</CardTitle>
                <CardDescription>{t('securityDashboard.frameworkRequirementsDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                {complianceLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading...</div>
                ) : (
                  <div className="space-y-3">
                    {requirements.map((req, index) => (
                      <motion.div key={req.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.04 }}>
                        <Card className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <Badge variant="outline" className="font-mono text-xs">{req.control_id}</Badge>
                                  <Badge variant="outline" className="text-xs">{req.category}</Badge>
                                  {(evidenceByReqId[req.id]?.length ?? 0) > 0 && (
                                    <Badge className="bg-blue-500 text-white text-xs">{evidenceByReqId[req.id].length} evidence</Badge>
                                  )}
                                  {(req.evidence_data?.length ?? 0) > 0 && (
                                    <Badge className="bg-emerald-500 text-white text-xs">{req.evidence_data!.length} files</Badge>
                                  )}
                                </div>
                                <h4 className="font-semibold text-gray-900 mb-1">{req.title}</h4>
                                <p className="text-sm text-gray-600 mb-2">{req.description}</p>
                                <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                                  {req.assigned_to && <span>{t('securityDashboard.assignedToLabel')}: {req.assigned_to}</span>}
                                  {req.due_date && <span>{t('securityDashboard.dueLabel')}: {new Date(req.due_date).toLocaleDateString()}</span>}
                                  {req.last_assessed && <span>Last assessed: {new Date(req.last_assessed).toLocaleDateString()}</span>}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2 shrink-0">
                                <div className="flex items-center gap-1">{getStatusIcon(req.status)}</div>
                                <Select value={req.status} onValueChange={v => setStatusChangeModal({ reqId: req.id, newStatus: v })}>
                                  <SelectTrigger className="w-36 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="compliant">{t('securityDashboard.compliant')}</SelectItem>
                                    <SelectItem value="partial">{t('securityDashboard.partial')}</SelectItem>
                                    <SelectItem value="in_progress">{t('securityDashboard.inProgress')}</SelectItem>
                                    <SelectItem value="non_compliant">{t('securityDashboard.nonCompliant')}</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setEvidenceReq(req); setShowAddEvidenceModal(true); }}>
                                  + Add Evidence
                                </Button>
                                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setEvidenceReq(req); setShowBulkEvidenceModal(true); }}>
                                  Bulk Add Evidence
                                </Button>
                                <label className="cursor-pointer">
                                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs h-7 rounded hover:bg-gray-100 text-gray-700 font-medium">
                                    📎 Upload Files
                                  </span>
                                  <input
                                    type="file"
                                    multiple
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                                    className="hidden"
                                    onChange={e => {
                                      if (e.target.files && e.target.files.length > 0) {
                                        void handleEvidenceFileUpload(req.id, e.target.files);
                                        e.target.value = '';
                                      }
                                    }}
                                  />
                                </label>
                                {(req.evidence_data?.length ?? 0) > 0 && (
                                  <Button variant="ghost" size="sm" className="text-xs h-7 text-emerald-600" onClick={() => { setFileEvidenceReq(req); setShowFileEvidenceModal(true); }}>
                                    📁 Files ({req.evidence_data!.length})
                                  </Button>
                                )}
                                {(evidenceByReqId[req.id]?.length ?? 0) > 0 && (
                                  <Button variant="ghost" size="sm" className="text-xs h-7 text-blue-600" onClick={() => { setViewEvidenceReq(req); setShowViewEvidenceModal(true); }}>
                                    View Evidence ({evidenceByReqId[req.id].length})
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                    {requirements.length === 0 && (
                      <div className="text-center py-8 text-gray-500">No requirements found for {selectedFrameworkName}.</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Assessment History */}
            {assessments.length > 0 && (
              <Card>
                <CardHeader>
                  <button
                    className="flex items-center justify-between w-full text-left"
                    onClick={() => setShowAssessmentHistory(v => !v)}
                  >
                    <CardTitle className="text-base">Assessment History ({assessments.length})</CardTitle>
                    {showAssessmentHistory ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
                  </button>
                </CardHeader>
                {showAssessmentHistory && (
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Assessor</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Overall Status</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {assessments.map(a => (
                            <tr key={a.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-900">{new Date(a.assessment_date).toLocaleDateString()}</td>
                              <td className="px-3 py-2">
                                <span className={`font-bold ${a.score >= 75 ? 'text-emerald-600' : a.score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{a.score}%</span>
                              </td>
                              <td className="px-3 py-2 text-gray-700">{a.assessor || '—'}</td>
                              <td className="px-3 py-2">
                                <Badge variant="outline" className="capitalize text-xs">{a.overall_status?.replace(/_/g, ' ')}</Badge>
                              </td>
                              <td className="px-3 py-2 text-gray-600 max-w-xs truncate">{a.notes || '—'}</td>
                              <td className="px-3 py-2">
                                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => void handleViewAssessmentDetail(a)}>
                                  View Full
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                )}
              </Card>
            )}
          </TabsContent>

          {/* PRIVACY REQUESTS TAB */}
          <TabsContent value="privacy" className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: t('securityDashboard.total'), value: privacyStats.total, color: 'text-gray-900' },
                { label: t('securityDashboard.pending'), value: privacyStats.pending, color: 'text-yellow-600' },
                { label: t('securityDashboard.overdue'), value: privacyStats.overdue, color: 'text-red-600' },
                { label: t('securityDashboard.completedThisMonth'), value: privacyStats.completedThisMonth, color: 'text-green-600' },
              ].map((s, i) => (
                <Card key={i}>
                  <CardContent className="p-4 text-center">
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t('securityDashboard.dataPrivacyRequests')}</CardTitle>
                    <CardDescription>{t('securityDashboard.dataPrivacyRequestsDesc')}</CardDescription>
                  </div>
                  <Button onClick={() => setShowNewRequestSlideOver(true)} size="sm">
                    <Plus className="h-4 w-4 mr-1" />{t('securityDashboard.newRequest')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {privacyLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading...</div>
                ) : (
                  <div className="space-y-3">
                    {privacyRequests.map((req, index) => {
                      const isOverdue = req.due_date && new Date(req.due_date) < now && req.status !== 'completed' && req.status !== 'rejected';
                      return (
                        <motion.div key={req.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
                          <Card className={`hover:shadow-md transition-shadow ${isOverdue ? 'bg-red-50 border-red-200' : ''}`}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <Badge className={req.request_type === 'deletion' ? 'bg-red-600 text-white' : req.request_type === 'access' ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'}>
                                      {req.request_type}
                                    </Badge>
                                    <Badge variant="outline">{req.regulation}</Badge>
                                    {isOverdue && <Badge className="bg-red-600 text-white">{t('securityDashboard.overdue')}</Badge>}
                                  </div>
                                  <h4 className="font-semibold text-gray-900">{req.requester_name}</h4>
                                  <p className="text-sm text-gray-600">{req.requester_email}</p>
                                  {req.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{req.description}</p>}
                                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-2 flex-wrap">
                                    <span>{t('securityDashboard.requestedLabel')}: {new Date(req.received_at).toLocaleDateString()}</span>
                                    {req.due_date && <span>{t('securityDashboard.dueLabel')}: {new Date(req.due_date).toLocaleDateString()}</span>}
                                    {req.assigned_to && <span>{t('securityDashboard.assignedToLabel')}: {req.assigned_to}</span>}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                  <div className="flex items-center gap-1">{getStatusIcon(req.status)}</div>
                                  <Select value={req.status} onValueChange={v => handlePrivacyStatusChange(req.id, v)}>
                                    <SelectTrigger className="w-36 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="pending">{t('securityDashboard.pending')}</SelectItem>
                                      <SelectItem value="in_progress">{t('securityDashboard.inProgress')}</SelectItem>
                                      <SelectItem value="completed">{t('securityDashboard.completed')}</SelectItem>
                                      <SelectItem value="rejected">{t('securityDashboard.rejected')}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                    {privacyRequests.length === 0 && (
                      <div className="text-center py-8 text-gray-500">No privacy requests yet.</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SECURITY OVERVIEW TAB */}
          <TabsContent value="security" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('securityDashboard.eventsByType')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(eventsByType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="text-sm capitalize">{type.replace(/_/g, ' ')}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${auditStats.total > 0 ? (count / auditStats.total) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-8 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                    {Object.keys(eventsByType).length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">No events recorded.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('securityDashboard.mostActiveUsers')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topUsers.map(([email, count], index) => (
                      <div key={email} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium text-gray-400">{index + 1}.</span>
                          <span className="text-sm truncate">{email}</span>
                        </div>
                        <Badge variant="outline" className="shrink-0">{count} {t('securityDashboard.events')}</Badge>
                      </div>
                    ))}
                    {topUsers.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">No user activity recorded.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Recent Critical Events</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {auditLogs.filter(l => l.severity === 'critical' || l.severity === 'high').slice(0, 5).map(log => (
                      <div key={log.id} className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                        <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{log.action}</p>
                          <p className="text-xs text-gray-500">{log.user_email} · {new Date(log.timestamp).toLocaleString()}</p>
                        </div>
                        <Badge className={getSeverityBadgeClass(log.severity)}>{log.severity}</Badge>
                      </div>
                    ))}
                    {auditLogs.filter(l => l.severity === 'critical' || l.severity === 'high').length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">No critical events.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Login Failure Spike Detection */}
            {loginSpikeAccounts.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-700 font-semibold">
                  <AlertTriangle className="h-4 w-4" /> Login Failure Spike Detected
                </div>
                <p className="text-sm text-red-600 mt-1">
                  {loginSpikeAccounts.length} {loginSpikeAccounts.length === 1 ? 'account' : 'accounts'} with 5+ failed logins in the last hour
                </p>
                <ul className="mt-2 text-sm text-red-700 space-y-1">
                  {loginSpikeAccounts.map(a => (
                    <li key={a.email}>{a.email}: {a.count} failures</li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>

          {/* RISK REGISTER TAB */}
          <TabsContent value="risk" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: t('securityDashboard.totalRisks'), value: riskStats.total, color: 'text-gray-900' },
                { label: t('securityDashboard.highRisks'), value: riskStats.high, color: 'text-red-600' },
                { label: t('securityDashboard.mitigatedRisks'), value: riskStats.mitigated, color: 'text-green-600' },
              ].map((s, i) => (
                <Card key={i}>
                  <CardContent className="p-4 text-center">
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{t('securityDashboard.riskMatrix')}</CardTitle>
                      <CardDescription>Likelihood vs Impact (3×3) — click a cell to filter</CardDescription>
                    </div>
                    {matrixFilter && (
                      <Button variant="outline" size="sm" onClick={() => setMatrixFilter(null)}>
                        <X className="h-3 w-3 mr-1" /> Clear filter
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <div className="flex flex-col justify-between text-xs text-gray-500 pr-2 pb-6 pt-1" style={{ width: 60 }}>
                      <span>High (3)</span>
                      <span>Med (2)</span>
                      <span>Low (1)</span>
                    </div>
                    <div className="flex-1">
                      <div className="grid grid-cols-3 gap-1">
                        {[3, 2, 1].flatMap(likelihood =>
                          [1, 2, 3].map(impact => {
                            const score = likelihood * impact;
                            const cellRisks = risks.filter(r => r.likelihood === likelihood && r.impact === impact);
                            const isActive = matrixFilter?.likelihood === likelihood && matrixFilter?.impact === impact;
                            return (
                              <button
                                key={`${likelihood}-${impact}`}
                                onClick={() => setMatrixFilter(isActive ? null : { likelihood, impact })}
                                className={`${getRiskColor(score)} rounded p-2 min-h-16 flex flex-col items-center justify-center text-white transition-opacity ${isActive ? 'ring-2 ring-offset-1 ring-gray-800 opacity-100' : 'hover:opacity-90'}`}
                              >
                                <span className="text-xs font-bold">{score}</span>
                                {cellRisks.length > 0 && (
                                  <span className="text-xs mt-1 bg-white/30 rounded px-1">{cellRisks.length}</span>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
                        <span>Low (1)</span>
                        <span>Med (2)</span>
                        <span>High (3)</span>
                      </div>
                      <div className="text-center text-xs text-gray-500 mt-1">Impact →</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {t('securityDashboard.riskRegister')}
                      {matrixFilter && (
                        <span className="ml-2 text-xs font-normal text-blue-600">
                          Filtered: L{matrixFilter.likelihood} × I{matrixFilter.impact}
                        </span>
                      )}
                    </CardTitle>
                    <Button onClick={() => { setEditingRisk(null); setNewRisk({ title: '', category: 'Data Breach', likelihood: 1, impact: 1, mitigation_plan: '', status: 'open', owner: '', review_date: '' }); setShowNewRiskSlideOver(true); }} size="sm">
                      <Plus className="h-4 w-4 mr-1" />{t('securityDashboard.addRisk')}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {risksLoading ? (
                    <div className="text-center py-8 text-gray-500">Loading...</div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {filteredRisks.map(risk => (
                        <div key={risk.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50">
                          <div className={`w-8 h-8 rounded flex items-center justify-center text-white text-xs font-bold shrink-0 ${getRiskColor(risk.risk_score)}`}>
                            {risk.risk_score}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium text-gray-900 truncate">{risk.title}</p>
                              {(() => {
                                const ninetyDaysAgo = new Date();
                                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                                const isStale = !risk.last_reviewed_at || new Date(risk.last_reviewed_at) < ninetyDaysAgo;
                                return isStale ? (
                                  <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" title="Not reviewed in 90+ days" />
                                ) : null;
                              })()}
                            </div>
                            <p className="text-xs text-gray-500">{risk.category} · {risk.owner}</p>
                          </div>
                          <span className={`text-xs rounded px-2 py-0.5 shrink-0 capitalize ${getRiskStatusBadgeClass(risk.status)}`}>{risk.status}</span>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => handleEditRisk(risk)}
                              className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
                              title="Edit risk"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteRisk(risk)}
                              className="p-1 rounded hover:bg-red-100 text-gray-500 hover:text-red-600 transition-colors"
                              title="Delete risk"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {filteredRisks.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          {matrixFilter ? 'No risks match this matrix cell.' : t('securityDashboard.noRisks')}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* AUDIT LOG DETAIL SLIDE-OVER */}
      <AnimatePresence>
        {selectedLog && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => setSelectedLog(null)}
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-xl z-50 overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold">Audit Log Detail</h2>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}><X className="h-4 w-4" /></Button>
                </div>
                <div className="space-y-4">
                  <div className="border-b pb-3">
                    <p className="text-xs font-medium text-gray-500 uppercase mb-1">Event ID</p>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-600">{selectedLog.id}</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(selectedLog.id); toast.success("Event ID copied!"); }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  {[
                    { label: 'Event Reference ID', value: selectedLog.event_id },
                    { label: 'Timestamp', value: new Date(selectedLog.timestamp).toLocaleString() },
                    { label: 'User Email', value: selectedLog.user_email },
                    { label: 'User Role', value: selectedLog.user_role },
                    { label: 'Event Type', value: selectedLog.event_type },
                    { label: 'Action', value: selectedLog.action },
                    { label: 'Resource Type', value: selectedLog.resource_type },
                    { label: 'Resource ID', value: selectedLog.resource_id },
                    { label: 'Severity', value: selectedLog.severity },
                    { label: 'Status', value: selectedLog.status },
                    { label: 'IP Address', value: selectedLog.ip_address },
                    { label: 'User Agent', value: selectedLog.user_agent },
                  ].map(({ label, value }) => (
                    <div key={label} className="border-b pb-3">
                      <p className="text-xs font-medium text-gray-500 uppercase mb-1">{label}</p>
                      <p className="text-sm text-gray-900 break-all">{value || '—'}</p>
                    </div>
                  ))}
                  {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase mb-1">Metadata</p>
                      <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto">{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* NEW PRIVACY REQUEST SLIDE-OVER */}
      <AnimatePresence>
        {showNewRequestSlideOver && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => setShowNewRequestSlideOver(false)}
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-xl z-50 overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold">{t('securityDashboard.newRequestTitle')}</h2>
                  <Button variant="ghost" size="sm" onClick={() => setShowNewRequestSlideOver(false)}><X className="h-4 w-4" /></Button>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label>{t('securityDashboard.requesterName')}</Label>
                    <Input value={newRequest.requester_name} onChange={e => setNewRequest(p => ({ ...p, requester_name: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>{t('securityDashboard.requesterEmail')}</Label>
                    <Input type="email" value={newRequest.requester_email} onChange={e => setNewRequest(p => ({ ...p, requester_email: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>{t('securityDashboard.requestType')}</Label>
                    <Select value={newRequest.request_type} onValueChange={v => setNewRequest(p => ({ ...p, request_type: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="access">Access</SelectItem>
                        <SelectItem value="deletion">Deletion</SelectItem>
                        <SelectItem value="portability">Portability</SelectItem>
                        <SelectItem value="rectification">Rectification</SelectItem>
                        <SelectItem value="objection">Objection</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('securityDashboard.regulation')}</Label>
                    <Select value={newRequest.regulation} onValueChange={v => setNewRequest(p => ({ ...p, regulation: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GDPR">GDPR</SelectItem>
                        <SelectItem value="CCPA">CCPA</SelectItem>
                        <SelectItem value="HIPAA">HIPAA</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {newRequest.regulation === 'CCPA' && (
                      <p className="text-xs text-blue-600 mt-1">CCPA requests have a 45-day due date.</p>
                    )}
                  </div>
                  <div>
                    <Label>Received Date</Label>
                    <Input type="date" value={newRequest.received_at} onChange={e => setNewRequest(p => ({ ...p, received_at: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <textarea
                      value={newRequest.description}
                      onChange={e => setNewRequest(p => ({ ...p, description: e.target.value }))}
                      rows={3}
                      placeholder="Describe the request..."
                      className="mt-1 w-full border rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button onClick={handleCreatePrivacyRequest} className="flex-1" disabled={!newRequest.requester_name || !newRequest.requester_email}>
                      {t('securityDashboard.submit')}
                    </Button>
                    <Button variant="outline" onClick={() => setShowNewRequestSlideOver(false)} className="flex-1">
                      {t('securityDashboard.cancel')}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* NEW / EDIT RISK SLIDE-OVER */}
      <AnimatePresence>
        {showNewRiskSlideOver && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => { setShowNewRiskSlideOver(false); setEditingRisk(null); }}
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-xl z-50 overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold">{editingRisk ? 'Edit Risk' : t('securityDashboard.newRisk')}</h2>
                  <Button variant="ghost" size="sm" onClick={() => { setShowNewRiskSlideOver(false); setEditingRisk(null); }}><X className="h-4 w-4" /></Button>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label>{t('securityDashboard.riskTitle')}</Label>
                    <Input value={newRisk.title} onChange={e => setNewRisk(p => ({ ...p, title: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>{t('securityDashboard.riskCategory')}</Label>
                    <Select value={newRisk.category} onValueChange={v => setNewRisk(p => ({ ...p, category: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RISK_CATEGORIES.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={newRisk.status} onValueChange={v => setNewRisk(p => ({ ...p, status: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RISK_STATUSES.map(s => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t('securityDashboard.likelihood')} (1-3)</Label>
                      <Select value={String(newRisk.likelihood)} onValueChange={v => setNewRisk(p => ({ ...p, likelihood: Number(v) }))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 - Low</SelectItem>
                          <SelectItem value="2">2 - Medium</SelectItem>
                          <SelectItem value="3">3 - High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>{t('securityDashboard.impact')} (1-3)</Label>
                      <Select value={String(newRisk.impact)} onValueChange={v => setNewRisk(p => ({ ...p, impact: Number(v) }))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 - Low</SelectItem>
                          <SelectItem value="2">2 - Medium</SelectItem>
                          <SelectItem value="3">3 - High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded p-3 text-center">
                    <p className="text-xs text-gray-500">{t('securityDashboard.riskScore')}</p>
                    <p className={`text-2xl font-bold ${getRiskColor(newRisk.likelihood * newRisk.impact).replace('bg-', 'text-').replace('-500', '-600').replace('-400', '-500')}`}>
                      {newRisk.likelihood * newRisk.impact}
                    </p>
                  </div>
                  <div>
                    <Label>{t('securityDashboard.mitigationPlan')}</Label>
                    <textarea
                      value={newRisk.mitigation_plan}
                      onChange={e => setNewRisk(p => ({ ...p, mitigation_plan: e.target.value }))}
                      rows={3}
                      className="mt-1 w-full border rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <Label>{t('securityDashboard.riskOwner')}</Label>
                    <Input value={newRisk.owner} onChange={e => setNewRisk(p => ({ ...p, owner: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>{t('securityDashboard.reviewDate')}</Label>
                    <Input type="date" value={newRisk.review_date} onChange={e => setNewRisk(p => ({ ...p, review_date: e.target.value }))} className="mt-1" />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button onClick={handleCreateRisk} className="flex-1" disabled={!newRisk.title}>
                      {editingRisk ? 'Update Risk' : t('securityDashboard.submit')}
                    </Button>
                    <Button variant="outline" onClick={() => { setShowNewRiskSlideOver(false); setEditingRisk(null); }} className="flex-1">
                      {t('securityDashboard.cancel')}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* NEW ASSESSMENT MODAL */}
      <AnimatePresence>
        {showAssessmentModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => setShowAssessmentModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-y-auto max-h-[90vh]">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold">New Assessment</h2>
                    <Button variant="ghost" size="sm" onClick={() => setShowAssessmentModal(false)}><X className="h-4 w-4" /></Button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label>Framework</Label>
                      <Input value={selectedFrameworkName} readOnly className="mt-1 bg-gray-50 cursor-not-allowed" />
                    </div>
                    <div>
                      <Label>Assessment Date</Label>
                      <Input
                        type="date"
                        value={assessmentForm.assessment_date}
                        onChange={e => setAssessmentForm(p => ({ ...p, assessment_date: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Score (0–100) *</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={assessmentForm.score}
                        onChange={e => setAssessmentForm(p => ({ ...p, score: Number(e.target.value) }))}
                        className="mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label>Assessor</Label>
                      <Input
                        value={assessmentForm.assessor}
                        onChange={e => setAssessmentForm(p => ({ ...p, assessor: e.target.value }))}
                        placeholder="Name of person conducting assessment"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Overall Status</Label>
                      <Select value={assessmentForm.overall_status} onValueChange={v => setAssessmentForm(p => ({ ...p, overall_status: v }))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="compliant">Compliant</SelectItem>
                          <SelectItem value="partial">Partial</SelectItem>
                          <SelectItem value="non_compliant">Non-Compliant</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <textarea
                        value={assessmentForm.notes}
                        onChange={e => setAssessmentForm(p => ({ ...p, notes: e.target.value }))}
                        rows={3}
                        placeholder="Additional notes..."
                        className="mt-1 w-full border rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <Label>Assessment Findings</Label>
                      <textarea
                        value={assessmentForm.findings}
                        onChange={e => setAssessmentForm(p => ({ ...p, findings: e.target.value }))}
                        rows={3}
                        maxLength={2000}
                        placeholder="Key findings from this assessment..."
                        className="mt-1 w-full border rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <Label>Recommendations</Label>
                      <textarea
                        value={assessmentForm.recommendations}
                        onChange={e => setAssessmentForm(p => ({ ...p, recommendations: e.target.value }))}
                        rows={3}
                        maxLength={2000}
                        placeholder="Actionable recommendations..."
                        className="mt-1 w-full border rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <Button onClick={handleSubmitAssessment} className="flex-1">
                        Submit Assessment
                      </Button>
                      <Button variant="outline" onClick={() => setShowAssessmentModal(false)} className="flex-1">
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* ADD EVIDENCE MODAL */}
      <AnimatePresence>
        {showAddEvidenceModal && evidenceReq && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => setShowAddEvidenceModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-y-auto max-h-[90vh]">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Add Evidence</h2>
                    <Button variant="ghost" size="sm" onClick={() => setShowAddEvidenceModal(false)}><X className="h-4 w-4" /></Button>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">{evidenceReq.control_id} — {evidenceReq.title}</p>
                  <div className="space-y-4">
                    <div>
                      <Label>Evidence Name *</Label>
                      <Input
                        value={evidenceForm.name}
                        onChange={e => setEvidenceForm(p => ({ ...p, name: e.target.value }))}
                        placeholder="e.g. GDPR Policy v2.1"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Evidence Type</Label>
                      <Select value={evidenceForm.evidence_type} onValueChange={v => setEvidenceForm(p => ({ ...p, evidence_type: v }))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="document">Document</SelectItem>
                          <SelectItem value="screenshot">Screenshot</SelectItem>
                          <SelectItem value="log">Log</SelectItem>
                          <SelectItem value="certificate">Certificate</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>File Name (reference)</Label>
                      <Input
                        value={evidenceForm.file_name}
                        onChange={e => setEvidenceForm(p => ({ ...p, file_name: e.target.value }))}
                        placeholder="e.g. policy-doc.pdf"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <textarea
                        value={evidenceForm.notes}
                        onChange={e => setEvidenceForm(p => ({ ...p, notes: e.target.value }))}
                        rows={3}
                        placeholder="Additional notes..."
                        className="mt-1 w-full border rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <Button onClick={handleAddEvidence} className="flex-1" disabled={!evidenceForm.name}>
                        Save Evidence
                      </Button>
                      <Button variant="outline" onClick={() => setShowAddEvidenceModal(false)} className="flex-1">
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* VIEW EVIDENCE MODAL */}
      <AnimatePresence>
        {showViewEvidenceModal && viewEvidenceReq && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => setShowViewEvidenceModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Evidence — {viewEvidenceReq.control_id}</h2>
                    <Button variant="ghost" size="sm" onClick={() => setShowViewEvidenceModal(false)}><X className="h-4 w-4" /></Button>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">{viewEvidenceReq.title}</p>
                  <div className="space-y-3">
                    {(evidenceByReqId[viewEvidenceReq.id] ?? []).length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No evidence found.</p>
                    ) : (
                      (evidenceByReqId[viewEvidenceReq.id] ?? []).map(ev => (
                        <div key={ev.id} className="border rounded-lg p-3 flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm text-gray-900">{ev.name}</span>
                              <Badge variant="outline" className="text-xs capitalize">{ev.evidence_type}</Badge>
                              {ev.file_name && (
                                <button
                                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                  onClick={() => {
                                    const path = `compliance-evidence/${selectedFrameworkName}/${viewEvidenceReq.id}/${ev.file_name}`;
                                    toast.info(`File: ${ev.file_name} (stored in Supabase Storage - download available in production)\nPath: ${path}`);
                                  }}
                                >
                                  <ExternalLink className="h-3 w-3" /> View
                                </button>
                              )}
                            </div>
                            {ev.file_name && <p className="text-xs text-gray-500 font-mono">{ev.file_name}</p>}
                            {ev.notes && <p className="text-xs text-gray-600 mt-1">{ev.notes}</p>}
                            <p className="text-xs text-gray-400 mt-1">
                              {ev.created_at ? new Date(ev.created_at).toLocaleDateString() : ev.uploaded_at ? new Date(ev.uploaded_at).toLocaleDateString() : ''}
                            </p>
                          </div>
                          <button
                            onClick={() => setDeleteEvidenceId(ev.id)}
                            className="text-red-500 hover:text-red-700 text-xs"
                            title="Delete evidence"
                          >
                            Delete
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* FILE EVIDENCE MODAL */}
      <AnimatePresence>
        {showFileEvidenceModal && fileEvidenceReq && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => setShowFileEvidenceModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold">Uploaded Files — {fileEvidenceReq.control_id}</h2>
                    <Button variant="ghost" size="sm" onClick={() => setShowFileEvidenceModal(false)}><X className="h-4 w-4" /></Button>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">{fileEvidenceReq.title}</p>
                  <div className="mb-4">
                    <label className="cursor-pointer">
                      <span className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 text-gray-700 font-medium">
                        📎 Upload More Files
                      </span>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                        className="hidden"
                        onChange={e => {
                          if (e.target.files && e.target.files.length > 0) {
                            void handleEvidenceFileUpload(fileEvidenceReq.id, e.target.files).then(() => {
                              setFileEvidenceReq(prev => requirements.find(r => r.id === prev?.id) ?? prev);
                            });
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div className="space-y-3">
                    {(fileEvidenceReq.evidence_data?.length ?? 0) === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No files uploaded yet.</p>
                    ) : (
                      (fileEvidenceReq.evidence_data ?? []).map((file, idx) => (
                        <div key={idx} className="border rounded-lg p-3 flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-base">{fileTypeIcon(file.type)}</span>
                              <span className="font-medium text-sm text-gray-900 truncate">{file.name}</span>
                            </div>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(file.size)} · {new Date(file.uploaded_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => downloadEvidence(file)}
                              className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                            >
                              Download
                            </button>
                            <button
                              onClick={() => void handleDeleteFileEvidence(fileEvidenceReq.id, idx)}
                              className="text-red-500 hover:text-red-700 text-xs font-medium"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* STATUS CHANGE REASON MODAL (Fix E) */}
      <AnimatePresence>
        {statusChangeModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => { setStatusChangeModal(null); setStatusChangeReason(''); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Reason for Status Change</h2>
                    <Button variant="ghost" size="sm" onClick={() => { setStatusChangeModal(null); setStatusChangeReason(''); }}><X className="h-4 w-4" /></Button>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    Changing status to <span className="font-medium text-gray-800">{statusChangeModal.newStatus.replace(/_/g, ' ')}</span>. Please provide a reason (min 20 characters).
                  </p>
                  <textarea
                    value={statusChangeReason}
                    onChange={e => setStatusChangeReason(e.target.value)}
                    rows={4}
                    placeholder="Describe the reason for this status change..."
                    className="w-full border rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1"
                  />
                  <p className="text-xs text-gray-400 mb-4">{statusChangeReason.trim().length} / 20 min chars</p>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => void handleConfirmStatusChange()}
                      className="flex-1"
                      disabled={statusChangeReason.trim().length < 20}
                    >
                      Confirm
                    </Button>
                    <Button variant="outline" onClick={() => { setStatusChangeModal(null); setStatusChangeReason(''); }} className="flex-1">
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* RESPONSE NOTES MODAL (Fix F) */}
      <AnimatePresence>
        {responseNotesModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => { setResponseNotesModal(null); setResponseNotes(''); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Response Notes Required</h2>
                    <Button variant="ghost" size="sm" onClick={() => { setResponseNotesModal(null); setResponseNotes(''); }}><X className="h-4 w-4" /></Button>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    Marking request as <span className="font-medium text-gray-800 capitalize">{responseNotesModal.newStatus}</span>. Please provide response notes (min 20 characters).
                  </p>
                  <textarea
                    value={responseNotes}
                    onChange={e => setResponseNotes(e.target.value)}
                    rows={4}
                    placeholder="Describe the response or reason for rejection..."
                    className="w-full border rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1"
                  />
                  <p className="text-xs text-gray-400 mb-4">{responseNotes.trim().length} / 20 min chars</p>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => void handleConfirmResponseNotes()}
                      className="flex-1"
                      disabled={responseNotes.trim().length < 20}
                    >
                      Confirm
                    </Button>
                    <Button variant="outline" onClick={() => { setResponseNotesModal(null); setResponseNotes(''); }} className="flex-1">
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ASSESSMENT DETAIL MODAL */}
      <AnimatePresence>
        {showAssessmentDetailModal && selectedAssessment && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => setShowAssessmentDetailModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold">Assessment Detail</h2>
                    <Button variant="ghost" size="sm" onClick={() => setShowAssessmentDetailModal(false)}><X className="h-4 w-4" /></Button>
                  </div>
                  <div className="space-y-3 mb-6">
                    {[
                      { label: 'Date', value: new Date(selectedAssessment.assessment_date).toLocaleDateString() },
                      { label: 'Score', value: `${selectedAssessment.score}%` },
                      { label: 'Assessor', value: selectedAssessment.assessor || '—' },
                      { label: 'Overall Status', value: selectedAssessment.overall_status?.replace(/_/g, ' ') || '—' },
                      { label: 'Notes', value: selectedAssessment.notes || '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="border-b pb-3 last:border-b-0">
                        <p className="text-xs font-medium text-gray-500 uppercase mb-1">{label}</p>
                        <p className="text-sm text-gray-900">{value}</p>
                      </div>
                    ))}
                    {selectedAssessment.findings && (
                      <div className="border-b pb-3">
                        <p className="text-xs font-medium text-gray-500 uppercase mb-1">Assessment Findings</p>
                        <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedAssessment.findings}</p>
                      </div>
                    )}
                    {selectedAssessment.recommendations && (
                      <div className="border-b pb-3">
                        <p className="text-xs font-medium text-gray-500 uppercase mb-1">Recommendations</p>
                        <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedAssessment.recommendations}</p>
                      </div>
                    )}
                  </div>
                  {allFrameworkAssessments.length > 1 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Score History</h3>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={allFrameworkAssessments.map(a => ({ date: new Date(a.assessment_date).toLocaleDateString(), score: a.score }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                          <RechartsTooltip />
                          <Line type="monotone" dataKey="score" stroke="#3b82f6" dot={true} strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* BULK ADD EVIDENCE MODAL */}
      <AnimatePresence>
        {showBulkEvidenceModal && evidenceReq && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => { setShowBulkEvidenceModal(false); setBulkEvidenceText(''); setBulkEvidenceType('document'); setBulkDescription(''); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-y-auto max-h-[90vh]">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Bulk Add Evidence</h2>
                    <Button variant="ghost" size="sm" onClick={() => { setShowBulkEvidenceModal(false); setBulkEvidenceText(''); setBulkEvidenceType('document'); setBulkDescription(''); }}><X className="h-4 w-4" /></Button>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">{evidenceReq.control_id} — {evidenceReq.title}</p>
                  <div className="space-y-4">
                    <div>
                      <Label>File Names</Label>
                      <textarea
                        value={bulkEvidenceText}
                        onChange={e => setBulkEvidenceText(e.target.value)}
                        rows={5}
                        placeholder="Enter one file name per line..."
                        className="mt-1 w-full border rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <Label>Evidence Type</Label>
                      <Select value={bulkEvidenceType} onValueChange={setBulkEvidenceType}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="document">Document</SelectItem>
                          <SelectItem value="screenshot">Screenshot</SelectItem>
                          <SelectItem value="report">Report</SelectItem>
                          <SelectItem value="certificate">Certificate</SelectItem>
                          <SelectItem value="policy">Policy</SelectItem>
                          <SelectItem value="procedure">Procedure</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input
                        value={bulkDescription}
                        onChange={e => setBulkDescription(e.target.value)}
                        placeholder="Description for all items..."
                        className="mt-1"
                      />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <Button
                        onClick={() => void handleBulkAddEvidence()}
                        className="flex-1"
                        disabled={!bulkEvidenceText.trim()}
                      >
                        Add All
                      </Button>
                      <Button variant="outline" onClick={() => { setShowBulkEvidenceModal(false); setBulkEvidenceText(''); setBulkEvidenceType('document'); setBulkDescription(''); }} className="flex-1">
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* DELETE EVIDENCE CONFIRMATION */}
      {deleteEvidenceId && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center">
          <div className="bg-white rounded-lg p-5 max-w-sm w-full mx-4">
            <p className="text-sm font-medium mb-4">Delete this evidence document?</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteEvidenceId(null)} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => {
                  const reqId = viewEvidenceReq?.id ?? '';
                  void supabase.from('compliance_evidence').delete().eq('id', deleteEvidenceId);
                  setEvidenceByReqId(prev => ({
                    ...prev,
                    [reqId]: (prev[reqId] ?? []).filter(e => e.id !== deleteEvidenceId),
                  }));
                  setDeleteEvidenceId(null);
                  toast.success("Evidence deleted.");
                }}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
