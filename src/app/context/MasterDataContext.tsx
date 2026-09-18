import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { API_BASE } from '../utils/constants';
import { toast } from 'sonner';

// Master Data Types
export interface Client {
  id: string;
  name: string;
  industry: string;
  contact: string;
  email?: string;
  phone?: string;
  revenue: number;
  status: 'active' | 'inactive' | 'prospect';
  createdAt?: string;
  updatedAt?: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  manager: string;
  budget: number;
  headcount: number;
  status: 'active' | 'inactive';
  createdAt?: string;
}

export interface JobTitle {
  id: string;
  title: string;
  department: string;
  level: string;
  salaryMin: number;
  salaryMax: number;
  status: 'active' | 'inactive';
  createdAt?: string;
}

export interface Location {
  id: string;
  name: string;
  type: 'headquarters' | 'branch' | 'remote' | 'coworking';
  address: string;
  capacity: number;
  occupancy: number;
  status: 'active' | 'inactive';
  createdAt?: string;
}

export interface PerformanceMetric {
  id: string;
  name: string;
  category: string;
  unit: string;
  target: number;
  frequency: string;
  status: 'active' | 'inactive';
}

export interface TrainingCourse {
  id: string;
  name: string;
  category: string;
  duration: string;
  provider: string;
  cost: number;
  status: 'active' | 'inactive';
}

export interface SalaryComponent {
  id: string;
  name: string;
  type: 'Fixed' | 'Variable';
  calculation: string;
  taxable: boolean;
  status: 'active' | 'inactive';
}

export interface Benefit {
  id: string;
  name: string;
  type: string;
  eligibility: string;
  cost: number;
  provider: string;
  status: 'active' | 'inactive';
}

export interface ServiceCategory {
  id: string;
  name: string;
  description: string;
  team: string;
  priority: string;
  status: 'active' | 'inactive';
}

export interface TicketType {
  id: string;
  name: string;
  category: string;
  defaultPriority: string;
  sla: string;
  status: 'active' | 'inactive';
}

export interface SLALevel {
  id: string;
  name: string;
  responseTime: string;
  resolutionTime: string;
  priority: number;
  status: 'active' | 'inactive';
}

export interface AssetType {
  id: string;
  name: string;
  category: string;
  depreciationRate: number;
  warrantyPeriod: string;
  status: 'active' | 'inactive';
}

export interface Vendor {
  id: string;
  name: string;
  category: string;
  contact: string;
  rating: number;
  paymentTerms: string;
  status: 'active' | 'inactive';
}

export interface ProjectCategory {
  id: string;
  name: string;
  description: string;
  timeline: string;
  budgetRange: string;
  status: 'active' | 'inactive';
}

export interface TaskType {
  id: string;
  name: string;
  defaultPriority: string;
  estimatedHours: number;
  category: string;
  status: 'active' | 'inactive';
}

export interface PriorityLevel {
  id: string;
  name: string;
  colorCode: string;
  slaImpact: string;
  escalation: string;
  status: 'active' | 'inactive';
}

export interface InvoiceTemplate {
  id: string;
  name: string;
  type: string;
  layout: string;
  defaultTerms: string;
  status: 'active' | 'inactive';
}

export interface TaxRate {
  id: string;
  name: string;
  rate: number;
  jurisdiction: string;
  effectiveDate: string;
  status: 'active' | 'inactive';
}

export interface PaymentTerm {
  id: string;
  name: string;
  netDays: number;
  discount: number;
  lateFee: number;
  status: 'active' | 'inactive';
}

export interface DocumentType {
  id: string;
  name: string;
  category: string;
  template: string;
  retentionPeriod: string;
  status: 'active' | 'inactive';
}

export interface KnowledgeCategory {
  id: string;
  name: string;
  parent: string;
  description: string;
  visibility: string;
  status: 'active' | 'inactive';
}

export interface CommunicationChannel {
  id: string;
  name: string;
  type: string;
  audience: string;
  moderators: string;
  status: 'active' | 'inactive';
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  trigger: string;
  steps: number;
  approvers: string;
  duration: string;
  status: 'active' | 'inactive';
}

export interface MasterData {
  clients: Client[];
  departments: Department[];
  jobTitles: JobTitle[];
  locations: Location[];
  performanceMetrics: PerformanceMetric[];
  trainingCourses: TrainingCourse[];
  salaryComponents: SalaryComponent[];
  benefits: Benefit[];
  serviceCategories: ServiceCategory[];
  ticketTypes: TicketType[];
  slaLevels: SLALevel[];
  assetTypes: AssetType[];
  vendors: Vendor[];
  projectCategories: ProjectCategory[];
  taskTypes: TaskType[];
  priorityLevels: PriorityLevel[];
  invoiceTemplates: InvoiceTemplate[];
  taxRates: TaxRate[];
  paymentTerms: PaymentTerm[];
  documentTypes: DocumentType[];
  knowledgeCategories: KnowledgeCategory[];
  communicationChannels: CommunicationChannel[];
  workflowTemplates: WorkflowTemplate[];
}

interface MasterDataContextType {
  masterData: MasterData;
  loading: boolean;
  refreshMasterData: () => Promise<void>;
  updateMasterData: (type: keyof MasterData, data: any[]) => void;
  addItem: (type: keyof MasterData, item: any) => void;
  updateItem: (type: keyof MasterData, id: string, updates: any) => void;
  deleteItem: (type: keyof MasterData, id: string) => void;
  setMasterData: React.Dispatch<React.SetStateAction<MasterData>>;
}

const MasterDataContext = createContext<MasterDataContextType | undefined>(undefined);

// Initialize with comprehensive sample data
const getInitialData = (): MasterData => ({
  clients: [
    { id: '1', name: 'Acme Corporation', industry: 'Technology', contact: 'John Smith', email: 'john@acme.com', phone: '+1-555-0100', revenue: 2500000, status: 'active', createdAt: '2024-01-15' },
    { id: '2', name: 'Global Industries', industry: 'Manufacturing', contact: 'Sarah Johnson', email: 'sarah@global.com', phone: '+1-555-0200', revenue: 5000000, status: 'active', createdAt: '2024-02-20' },
    { id: '3', name: 'Tech Innovators Inc', industry: 'Technology', contact: 'Mike Chen', email: 'mike@techinnovators.com', phone: '+1-555-0300', revenue: 1800000, status: 'prospect', createdAt: '2024-03-10' },
  ],
  departments: [
    { id: '1', name: 'Engineering', code: 'ENG', manager: 'Alice Chen', budget: 5000000, headcount: 45, status: 'active', createdAt: '2024-01-01' },
    { id: '2', name: 'Human Resources', code: 'HR', manager: 'Bob Martinez', budget: 1200000, headcount: 12, status: 'active', createdAt: '2024-01-01' },
    { id: '3', name: 'Finance', code: 'FIN', manager: 'Carol Williams', budget: 800000, headcount: 15, status: 'active', createdAt: '2024-01-01' },
    { id: '4', name: 'Sales', code: 'SALES', manager: 'David Park', budget: 2000000, headcount: 25, status: 'active', createdAt: '2024-01-01' },
    { id: '5', name: 'Marketing', code: 'MKT', manager: 'Emma Davis', budget: 1500000, headcount: 18, status: 'active', createdAt: '2024-01-01' },
  ],
  jobTitles: [
    { id: '1', title: 'Software Engineer', department: 'Engineering', level: 'Mid-Level', salaryMin: 90000, salaryMax: 140000, status: 'active', createdAt: '2024-01-01' },
    { id: '2', title: 'Senior Software Engineer', department: 'Engineering', level: 'Senior', salaryMin: 140000, salaryMax: 200000, status: 'active', createdAt: '2024-01-01' },
    { id: '3', title: 'HR Manager', department: 'Human Resources', level: 'Manager', salaryMin: 100000, salaryMax: 150000, status: 'active', createdAt: '2024-01-01' },
    { id: '4', title: 'Sales Representative', department: 'Sales', level: 'Entry-Level', salaryMin: 50000, salaryMax: 80000, status: 'active', createdAt: '2024-01-01' },
  ],
  locations: [
    { id: '1', name: 'San Francisco HQ', type: 'headquarters', address: '100 Market St', capacity: 200, occupancy: 150, status: 'active', createdAt: '2024-01-01' },
    { id: '2', name: 'New York Office', type: 'branch', address: '350 Fifth Ave', capacity: 100, occupancy: 75, status: 'active', createdAt: '2024-01-01' },
    { id: '3', name: 'Austin Branch', type: 'branch', address: '500 Congress Ave', capacity: 50, occupancy: 30, status: 'active', createdAt: '2024-01-01' },
  ],
  performanceMetrics: [
    { id: '1', name: 'Code Quality Score', category: 'Engineering', unit: 'Percentage', target: 95, frequency: 'Weekly', status: 'active' },
    { id: '2', name: 'Customer Satisfaction', category: 'Customer Success', unit: 'CSAT Score', target: 4.5, frequency: 'Monthly', status: 'active' },
    { id: '3', name: 'Sprint Velocity', category: 'Engineering', unit: 'Story Points', target: 50, frequency: 'Bi-weekly', status: 'active' },
    { id: '4', name: 'Sales Conversion Rate', category: 'Sales', unit: 'Percentage', target: 25, frequency: 'Monthly', status: 'active' },
  ],
  trainingCourses: [
    { id: '1', name: 'Leadership Fundamentals', category: 'Management', duration: '2 days', provider: 'Internal', cost: 500, status: 'active' },
    { id: '2', name: 'AWS Solutions Architect', category: 'Technical', duration: '5 days', provider: 'AWS Training', cost: 2000, status: 'active' },
    { id: '3', name: 'Agile Scrum Master', category: 'Methodology', duration: '3 days', provider: 'Scrum Alliance', cost: 1500, status: 'active' },
  ],
  salaryComponents: [
    { id: '1', name: 'Base Salary', type: 'Fixed', calculation: 'Monthly', taxable: true, status: 'active' },
    { id: '2', name: 'Performance Bonus', type: 'Variable', calculation: 'Quarterly', taxable: true, status: 'active' },
    { id: '3', name: 'Housing Allowance', type: 'Fixed', calculation: 'Monthly', taxable: false, status: 'active' },
    { id: '4', name: 'Transportation', type: 'Fixed', calculation: 'Monthly', taxable: false, status: 'active' },
  ],
  benefits: [
    { id: '1', name: 'Health Insurance', type: 'Medical', eligibility: 'All Full-Time', cost: 500, provider: 'Blue Cross', status: 'active' },
    { id: '2', name: '401k Matching', type: 'Retirement', eligibility: 'After 90 days', cost: 0, provider: 'Fidelity', status: 'active' },
    { id: '3', name: 'Gym Membership', type: 'Wellness', eligibility: 'All Employees', cost: 50, provider: 'Local Gyms', status: 'active' },
  ],
  serviceCategories: [
    { id: '1', name: 'Hardware Support', description: 'Computer and device issues', team: 'IT Support', priority: 'Medium', status: 'active' },
    { id: '2', name: 'Software Support', description: 'Application and software issues', team: 'IT Support', priority: 'High', status: 'active' },
    { id: '3', name: 'Network Issues', description: 'Connectivity and network problems', team: 'Infrastructure', priority: 'Critical', status: 'active' },
  ],
  ticketTypes: [
    { id: '1', name: 'Incident', category: 'Hardware Support', defaultPriority: 'High', sla: '4 hours', status: 'active' },
    { id: '2', name: 'Service Request', category: 'Software Support', defaultPriority: 'Medium', sla: '24 hours', status: 'active' },
    { id: '3', name: 'Access Request', category: 'Security', defaultPriority: 'Low', sla: '48 hours', status: 'active' },
  ],
  slaLevels: [
    { id: '1', name: 'Critical', responseTime: '15 minutes', resolutionTime: '4 hours', priority: 1, status: 'active' },
    { id: '2', name: 'High', responseTime: '1 hour', resolutionTime: '8 hours', priority: 2, status: 'active' },
    { id: '3', name: 'Medium', responseTime: '4 hours', resolutionTime: '24 hours', priority: 3, status: 'active' },
    { id: '4', name: 'Low', responseTime: '1 day', resolutionTime: '5 days', priority: 4, status: 'active' },
  ],
  assetTypes: [
    { id: '1', name: 'Laptop', category: 'Hardware', depreciationRate: 20, warrantyPeriod: '3 years', status: 'active' },
    { id: '2', name: 'Monitor', category: 'Hardware', depreciationRate: 15, warrantyPeriod: '2 years', status: 'active' },
    { id: '3', name: 'Software License', category: 'Software', depreciationRate: 100, warrantyPeriod: '1 year', status: 'active' },
  ],
  vendors: [
    { id: '1', name: 'Dell Technologies', category: 'Hardware', contact: 'sales@dell.com', rating: 4.5, paymentTerms: 'Net 30', status: 'active' },
    { id: '2', name: 'Microsoft', category: 'Software', contact: 'support@microsoft.com', rating: 4.8, paymentTerms: 'Net 60', status: 'active' },
  ],
  projectCategories: [
    { id: '1', name: 'Product Development', description: 'New product features', timeline: '3-6 months', budgetRange: '$100k-$500k', status: 'active' },
    { id: '2', name: 'Internal Tools', description: 'Internal systems', timeline: '1-3 months', budgetRange: '$20k-$100k', status: 'active' },
    { id: '3', name: 'Client Projects', description: 'Customer deliverables', timeline: '2-4 months', budgetRange: '$50k-$300k', status: 'active' },
  ],
  taskTypes: [
    { id: '1', name: 'Development', defaultPriority: 'Medium', estimatedHours: 8, category: 'Engineering', status: 'active' },
    { id: '2', name: 'Bug Fix', defaultPriority: 'High', estimatedHours: 4, category: 'Engineering', status: 'active' },
    { id: '3', name: 'Code Review', defaultPriority: 'Medium', estimatedHours: 2, category: 'Quality', status: 'active' },
  ],
  priorityLevels: [
    { id: '1', name: 'Critical', colorCode: '#DC2626', slaImpact: 'Immediate', escalation: 'Auto-escalate in 1 hour', status: 'active' },
    { id: '2', name: 'High', colorCode: '#F59E0B', slaImpact: '4 hours', escalation: 'Escalate in 8 hours', status: 'active' },
    { id: '3', name: 'Medium', colorCode: '#3B82F6', slaImpact: '24 hours', escalation: 'Escalate in 48 hours', status: 'active' },
    { id: '4', name: 'Low', colorCode: '#10B981', slaImpact: '1 week', escalation: 'No auto-escalation', status: 'active' },
  ],
  invoiceTemplates: [
    { id: '1', name: 'Standard Invoice', type: 'Service', layout: 'Professional', defaultTerms: 'Net 30', status: 'active' },
    { id: '2', name: 'Recurring Invoice', type: 'Subscription', layout: 'Simple', defaultTerms: 'Monthly', status: 'active' },
  ],
  taxRates: [
    { id: '1', name: 'Sales Tax', rate: 8.5, jurisdiction: 'California', effectiveDate: '2024-01-01', status: 'active' },
    { id: '2', name: 'VAT', rate: 20, jurisdiction: 'UK', effectiveDate: '2024-01-01', status: 'active' },
  ],
  paymentTerms: [
    { id: '1', name: 'Net 30', netDays: 30, discount: 0, lateFee: 2, status: 'active' },
    { id: '2', name: 'Net 60', netDays: 60, discount: 0, lateFee: 2, status: 'active' },
    { id: '3', name: '2/10 Net 30', netDays: 30, discount: 2, lateFee: 2, status: 'active' },
  ],
  documentTypes: [
    { id: '1', name: 'Employee Handbook', category: 'HR', template: 'Standard', retentionPeriod: 'Permanent', status: 'active' },
    { id: '2', name: 'NDA', category: 'Legal', template: 'Legal Template', retentionPeriod: '7 years', status: 'active' },
    { id: '3', name: 'Offer Letter', category: 'HR', template: 'HR Template', retentionPeriod: '5 years', status: 'active' },
  ],
  knowledgeCategories: [
    { id: '1', name: 'Technical Documentation', parent: 'Root', description: 'Technical guides and APIs', visibility: 'All Employees', status: 'active' },
    { id: '2', name: 'HR Policies', parent: 'Root', description: 'HR policies and procedures', visibility: 'All Employees', status: 'active' },
    { id: '3', name: 'Product Guides', parent: 'Technical Documentation', description: 'Product user guides', visibility: 'Public', status: 'active' },
  ],
  communicationChannels: [
    { id: '1', name: 'Company Announcements', type: 'Broadcast', audience: 'All Employees', moderators: 'HR Team', status: 'active' },
    { id: '2', name: 'Engineering Updates', type: 'Team', audience: 'Engineering', moderators: 'Tech Leads', status: 'active' },
    { id: '3', name: 'Social Events', type: 'Social', audience: 'All Employees', moderators: 'Culture Committee', status: 'active' },
  ],
  workflowTemplates: [
    { id: '1', name: 'New Hire Onboarding', trigger: 'Employee Created', steps: 5, approvers: 'HR Manager', duration: '2 weeks', status: 'active' },
    { id: '2', name: 'PTO Request', trigger: 'Form Submission', steps: 3, approvers: 'Manager', duration: '2 days', status: 'active' },
    { id: '3', name: 'Equipment Request', trigger: 'Ticket Created', steps: 4, approvers: 'IT Manager', duration: '3 days', status: 'active' },
  ],
});

export function MasterDataProvider({ children, accessToken }: { children: ReactNode; accessToken: string }) {
  const [masterData, setMasterData] = useState<MasterData>(getInitialData());
  const [loading, setLoading] = useState(false);

  // Load from backend on mount
  useEffect(() => {
    loadMasterData();
  }, []);

  const loadMasterData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/master-data/all`, {
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'X-Access-Token': accessToken 
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        // Merge with defaults if backend data exists
        if (data && Object.keys(data).length > 0) {
          setMasterData(prev => ({ ...prev, ...data }));
        }
      }
    } catch (error) {
      console.log('Using local master data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshMasterData = async () => {
    await loadMasterData();
  };

  const updateMasterData = (type: keyof MasterData, data: any[]) => {
    setMasterData(prev => ({
      ...prev,
      [type]: data
    }));
    
    // Save to backend
    saveMasterData(type, data);
  };

  const addItem = (type: keyof MasterData, item: any) => {
    const newItem = {
      ...item,
      id: `${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    
    setMasterData(prev => ({
      ...prev,
      [type]: [...prev[type], newItem]
    }));
    
    saveMasterData(type, [...masterData[type], newItem]);
    toast.success('Item added successfully');
  };

  const updateItem = (type: keyof MasterData, id: string, updates: any) => {
    const updatedData = masterData[type].map((item: any) =>
      item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
    );
    
    setMasterData(prev => ({
      ...prev,
      [type]: updatedData
    }));
    
    saveMasterData(type, updatedData);
    toast.success('Item updated successfully');
  };

  const deleteItem = (type: keyof MasterData, id: string) => {
    const updatedData = masterData[type].filter((item: any) => item.id !== id);
    
    setMasterData(prev => ({
      ...prev,
      [type]: updatedData
    }));
    
    saveMasterData(type, updatedData);
    toast.success('Item deleted successfully');
  };

  const saveMasterData = async (type: keyof MasterData, data: any[]) => {
    try {
      await fetch(`${API_BASE}/master-data/${type}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
    } catch (error) {
      console.log('Master data saved locally:', error);
    }
  };

  return (
    <MasterDataContext.Provider value={{
      masterData,
      loading,
      refreshMasterData,
      updateMasterData,
      addItem,
      updateItem,
      deleteItem,
      setMasterData
    }}>
      {children}
    </MasterDataContext.Provider>
  );
}

export function useMasterData() {
  const context = useContext(MasterDataContext);
  if (context === undefined) {
    throw new Error('useMasterData must be used within a MasterDataProvider');
  }
  return context;
}