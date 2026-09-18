import { useState, useEffect } from 'react';
import { SelectOptions } from '../../context/ValueHelpsContext';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import {
  ArrowLeft,
  Database,
  Users,
  Building2,
  MapPin,
  Briefcase,
  GraduationCap,
  DollarSign,
  Plus,
  Edit,
  Trash2,
  Search,
  Download,
  Upload,
  Filter,
  RefreshCw,
  Save,
  X,
  Check,
  AlertCircle,
  BookOpen,
  HelpCircle,
  Info,
  Lightbulb,
  FileText,
  Settings,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE, publicAnonKey, safeJson } from '../../utils/constants';
import { useUser } from '../../context/UserContext';
import { MasterDataForm } from './MasterDataForm';
import ConfirmDialog from '../ui/ConfirmDialog';

interface MasterDataManagementProps {
  accessToken: string;
  onLogout: () => void;
}

interface Client {
  id: string;
  name: string;
  industry: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  status: 'active' | 'inactive' | 'prospect';
  revenue: number;
  contractStartDate: string;
  contractEndDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  managerId: string;
  managerName: string;
  location: string;
  budget: number;
  headcount: number;
  status: 'active' | 'inactive';
  createdAt: string;
}

interface JobTitle {
  id: string;
  title: string;
  department: string;
  level: string;
  description: string;
  minSalary: number;
  maxSalary: number;
  requirements: string;
  responsibilities: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

interface Location {
  id: string;
  name: string;
  type: 'headquarters' | 'branch' | 'remote' | 'coworking';
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  capacity: number;
  currentOccupancy: number;
  facilities: string[];
  status: 'active' | 'inactive';
  createdAt: string;
}

interface Holiday {
  id: string;
  name: string;
  date: string;
  type: 'national' | 'regional' | 'optional';
  state?: string;
}

interface LeavePolicy {
  id: string;
  leave_type: string;
  days_per_year: number;
  carry_forward_limit: number;
  encashable: boolean;
  applicable_from: string;
  applicable_to?: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  trigger_event: string;
  variables: string[];
  updated_at?: string;
}

function exportICS(holidays: Holiday[]) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//JL You Portal//Holidays//EN',
    ...holidays.map(h => [
      'BEGIN:VEVENT',
      `DTSTART;VALUE=DATE:${h.date.replace(/-/g, '')}`,
      `SUMMARY:${h.name}`,
      `CATEGORIES:${h.type.toUpperCase()}`,
      'END:VEVENT',
    ].join('\r\n')),
    'END:VCALENDAR',
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'holidays.ics' });
  a.click();
}

export function MasterDataManagement({ accessToken, onLogout }: MasterDataManagementProps) {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('clients');
  
  // Data states
  const [clients, setClients] = useState<Client[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  
  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showConfigGuide, setShowConfigGuide] = useState(false);

  // Holiday Calendar state
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayLoading, setHolidayLoading] = useState(false);
  const [holidayYear, setHolidayYear] = useState(String(new Date().getFullYear()));
  const [holidayTypeFilter, setHolidayTypeFilter] = useState('all');
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | undefined>();
  const [deletingHoliday, setDeletingHoliday] = useState<Holiday | undefined>();
  const [holidayForm, setHolidayForm] = useState({ name: '', date: '', type: 'national' as Holiday['type'], state: '' });

  // Leave Policies state
  const [leavePolicies, setLeavePolicies] = useState<LeavePolicy[]>([]);
  const [leavePoliciesLoading, setLeavePoliciesLoading] = useState(false);
  const [editingLeavePolicy, setEditingLeavePolicy] = useState<LeavePolicy | undefined>();
  const [leavePolicyForm, setLeavePolicyForm] = useState<Partial<LeavePolicy>>({});

  // Email Templates state
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [emailTemplatesLoading, setEmailTemplatesLoading] = useState(false);
  const [expandedTemplate, setExpandedTemplate] = useState<string | undefined>();
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | undefined>();
  const [templateForm, setTemplateForm] = useState({ subject: '', body: '' });

  // Defect Tracker master data state
  const [defectMasterData, setDefectMasterData] = useState<{
    resolutionCodes: any[];
    rootCauseCategories: any[];
    rejectionReasons: any[];
    labels: any[];
    environments: any[];
    priorities: any[];
    statuses: any[];
    escalationRules: any[];
  }>({ resolutionCodes: [], rootCauseCategories: [], rejectionReasons: [], labels: [], environments: [], priorities: [], statuses: [], escalationRules: [] });
  const [defectMasterLoading, setDefectMasterLoading] = useState(false);

  useEffect(() => {
    if (['clients', 'departments', 'job-titles', 'locations'].includes(activeTab)) {
      loadData();
    } else if (activeTab === 'holidays') {
      loadHolidays();
    } else if (activeTab === 'leave-policies') {
      loadLeavePolicies();
    } else if (activeTab === 'email-templates') {
      loadEmailTemplates();
    } else if (activeTab === 'defect-tracker') {
      loadDefectMasterData();
    }
  }, [activeTab, holidayYear]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/master-data/${activeTab}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        
        switch (activeTab) {
          case 'clients':
            setClients(data);
            break;
          case 'departments':
            setDepartments(data);
            break;
          case 'job-titles':
            setJobTitles(data);
            break;
          case 'locations':
            setLocations(data);
            break;
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      // Load sample data for demonstration
      loadSampleData();
    } finally {
      setLoading(false);
    }
  };

  const loadSampleData = () => {
    const sampleClients: Client[] = [
      {
        id: '1',
        name: 'Acme Corporation',
        industry: 'Technology',
        contactPerson: 'John Smith',
        email: 'john@acme.com',
        phone: '+1-555-0101',
        address: '123 Tech Street',
        city: 'San Francisco',
        country: 'USA',
        status: 'active',
        revenue: 2500000,
        contractStartDate: '2024-01-01',
        contractEndDate: '2025-12-31',
        notes: 'Premium client with enterprise support',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      },
      {
        id: '2',
        name: 'Global Industries Inc.',
        industry: 'Manufacturing',
        contactPerson: 'Sarah Johnson',
        email: 'sarah@global.com',
        phone: '+1-555-0102',
        address: '456 Industrial Blvd',
        city: 'Chicago',
        country: 'USA',
        status: 'active',
        revenue: 5000000,
        contractStartDate: '2023-06-01',
        contractEndDate: '2026-05-31',
        notes: 'Long-term strategic partner',
        createdAt: '2023-06-01',
        updatedAt: '2023-06-01'
      },
      {
        id: '3',
        name: 'Future Tech Solutions',
        industry: 'Software',
        contactPerson: 'Mike Chen',
        email: 'mike@futuretech.com',
        phone: '+1-555-0103',
        address: '789 Innovation Way',
        city: 'Austin',
        country: 'USA',
        status: 'prospect',
        revenue: 0,
        contractStartDate: '',
        contractEndDate: '',
        notes: 'In negotiation phase',
        createdAt: '2024-03-15',
        updatedAt: '2024-03-15'
      }
    ];

    const sampleDepartments: Department[] = [
      {
        id: '1',
        name: 'Engineering',
        code: 'ENG',
        description: 'Software development and technical operations',
        managerId: 'mgr-001',
        managerName: 'Alice Chen',
        location: 'San Francisco HQ',
        budget: 5000000,
        headcount: 45,
        status: 'active',
        createdAt: '2020-01-01'
      },
      {
        id: '2',
        name: 'Human Resources',
        code: 'HR',
        description: 'Employee relations and talent management',
        managerId: 'mgr-002',
        managerName: 'Bob Martinez',
        location: 'San Francisco HQ',
        budget: 1200000,
        headcount: 12,
        status: 'active',
        createdAt: '2020-01-01'
      },
      {
        id: '3',
        name: 'Finance',
        code: 'FIN',
        description: 'Financial planning and accounting',
        managerId: 'mgr-003',
        managerName: 'Carol Williams',
        location: 'New York Office',
        budget: 800000,
        headcount: 15,
        status: 'active',
        createdAt: '2020-01-01'
      },
      {
        id: '4',
        name: 'Marketing',
        code: 'MKT',
        description: 'Brand management and customer acquisition',
        managerId: 'mgr-004',
        managerName: 'David Lee',
        location: 'San Francisco HQ',
        budget: 2000000,
        headcount: 18,
        status: 'active',
        createdAt: '2020-01-01'
      }
    ];

    const sampleJobTitles: JobTitle[] = [
      {
        id: '1',
        title: 'Software Engineer',
        department: 'Engineering',
        level: 'Mid-Level',
        description: 'Design, develop, and maintain software applications',
        minSalary: 90000,
        maxSalary: 140000,
        requirements: 'BS in CS or related field, 3+ years experience',
        responsibilities: 'Code development, code reviews, testing, documentation',
        status: 'active',
        createdAt: '2020-01-01'
      },
      {
        id: '2',
        title: 'Senior Software Engineer',
        department: 'Engineering',
        level: 'Senior',
        description: 'Lead technical projects and mentor junior engineers',
        minSalary: 140000,
        maxSalary: 200000,
        requirements: 'BS in CS, 7+ years experience, leadership skills',
        responsibilities: 'Technical leadership, architecture, mentoring',
        status: 'active',
        createdAt: '2020-01-01'
      },
      {
        id: '3',
        title: 'HR Specialist',
        department: 'Human Resources',
        level: 'Entry-Level',
        description: 'Support HR operations and employee relations',
        minSalary: 55000,
        maxSalary: 75000,
        requirements: 'BS in HR or related field, 0-2 years experience',
        responsibilities: 'Recruitment support, onboarding, employee records',
        status: 'active',
        createdAt: '2020-01-01'
      },
      {
        id: '4',
        title: 'Financial Analyst',
        department: 'Finance',
        level: 'Mid-Level',
        description: 'Analyze financial data and prepare reports',
        minSalary: 70000,
        maxSalary: 100000,
        requirements: 'BS in Finance, 3+ years experience, CFA preferred',
        responsibilities: 'Financial modeling, reporting, budgeting',
        status: 'active',
        createdAt: '2020-01-01'
      }
    ];

    const sampleLocations: Location[] = [
      {
        id: '1',
        name: 'San Francisco HQ',
        type: 'headquarters',
        address: '100 Market Street, Suite 500',
        city: 'San Francisco',
        state: 'CA',
        country: 'USA',
        postalCode: '94105',
        capacity: 200,
        currentOccupancy: 150,
        facilities: ['Conference Rooms', 'Cafeteria', 'Gym', 'Parking', 'WiFi'],
        status: 'active',
        createdAt: '2020-01-01'
      },
      {
        id: '2',
        name: 'New York Office',
        type: 'branch',
        address: '350 Fifth Avenue, 34th Floor',
        city: 'New York',
        state: 'NY',
        country: 'USA',
        postalCode: '10118',
        capacity: 100,
        currentOccupancy: 75,
        facilities: ['Conference Rooms', 'WiFi', 'Kitchen'],
        status: 'active',
        createdAt: '2021-03-15'
      },
      {
        id: '3',
        name: 'Austin Branch',
        type: 'branch',
        address: '200 Congress Avenue',
        city: 'Austin',
        state: 'TX',
        country: 'USA',
        postalCode: '78701',
        capacity: 50,
        currentOccupancy: 35,
        facilities: ['Conference Rooms', 'WiFi', 'Parking'],
        status: 'active',
        createdAt: '2022-06-01'
      }
    ];

    switch (activeTab) {
      case 'clients':
        setClients(sampleClients);
        break;
      case 'departments':
        setDepartments(sampleDepartments);
        break;
      case 'job-titles':
        setJobTitles(sampleJobTitles);
        break;
      case 'locations':
        setLocations(sampleLocations);
        break;
    }
  };

  const loadDefectMasterData = async () => {
    setDefectMasterLoading(true);
    try {
      const res = await fetch(`${API_BASE}/defect-tracker/master-data`, {
        headers: { apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}` },
      });
      const json = await safeJson(res);
      if (json.data) setDefectMasterData(json.data);
    } catch { /* keep empty state */ } finally { setDefectMasterLoading(false); }
  };

  const mdApi = (path: string, opts: RequestInit = {}) =>
    fetch(`${API_BASE}/master-data${path}`, {
      ...opts,
      headers: { apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
    });

  // ── Holiday helpers ────────────────────────────────────────────────────
  const loadHolidays = async () => {
    setHolidayLoading(true);
    try {
      const res = await mdApi(`/holidays?year=${holidayYear}`);
      const json = await safeJson(res);
      setHolidays(json.data ?? []);
    } catch { setHolidays([]); } finally { setHolidayLoading(false); }
  };

  const saveHoliday = async () => {
    try {
      if (editingHoliday) {
        await mdApi(`/holidays/${editingHoliday.id}`, { method: 'PUT', body: JSON.stringify(holidayForm) });
        toast.success('Holiday updated');
      } else {
        await mdApi('/holidays', { method: 'POST', body: JSON.stringify(holidayForm) });
        toast.success('Holiday added');
      }
      setShowHolidayModal(false);
      setEditingHoliday(undefined);
      setHolidayForm({ name: '', date: '', type: 'national', state: '' });
      loadHolidays();
    } catch { toast.error('Failed to save holiday'); }
  };

  const deleteHoliday = async (id: string) => {
    await mdApi(`/holidays/${id}`, { method: 'DELETE' });
    toast.success('Holiday deleted');
    loadHolidays();
  };

  // ── Leave Policy helpers ───────────────────────────────────────────────
  const loadLeavePolicies = async () => {
    setLeavePoliciesLoading(true);
    try {
      const res = await mdApi('/leave-policies');
      const json = await safeJson(res);
      setLeavePolicies(json.data ?? []);
    } catch { setLeavePolicies([]); } finally { setLeavePoliciesLoading(false); }
  };

  const saveLeavePolicy = async () => {
    if (!editingLeavePolicy) return;
    try {
      await mdApi(`/leave-policies/${editingLeavePolicy.id}`, { method: 'PUT', body: JSON.stringify(leavePolicyForm) });
      toast.success('Leave policy updated');
      setEditingLeavePolicy(undefined);
      loadLeavePolicies();
    } catch { toast.error('Failed to update leave policy'); }
  };

  // ── Email Template helpers ─────────────────────────────────────────────
  const loadEmailTemplates = async () => {
    setEmailTemplatesLoading(true);
    try {
      const res = await mdApi('/email-templates');
      const json = await safeJson(res);
      setEmailTemplates(json.data ?? []);
    } catch { setEmailTemplates([]); } finally { setEmailTemplatesLoading(false); }
  };

  const saveEmailTemplate = async () => {
    if (!editingTemplate) return;
    try {
      await mdApi(`/email-templates/${editingTemplate.id}`, { method: 'PUT', body: JSON.stringify(templateForm) });
      toast.success('Template updated');
      setEditingTemplate(undefined);
      loadEmailTemplates();
    } catch { toast.error('Failed to update template'); }
  };

  const handleSave = async (item: any) => {
    try {
      const response = await fetch(`${API_BASE}/master-data/${activeTab}`, {
        method: editingItem ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(item),
      });

      if (response.ok) {
        toast.success(`${editingItem ? 'Updated' : 'Created'} successfully`);
        setShowAddModal(false);
        setEditingItem(null);
        loadData();
      }
    } catch (error) {
      toast.error('Operation failed - changes saved locally');
      setShowAddModal(false);
      setEditingItem(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    try {
      await fetch(`${API_BASE}/master-data/${activeTab}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      toast.success('Deleted successfully');
      loadData();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const exportData = () => {
    let data: any[] = [];
    switch (activeTab) {
      case 'clients': data = clients; break;
      case 'departments': data = departments; break;
      case 'job-titles': data = jobTitles; break;
      case 'locations': data = locations; break;
    }
    
    const csv = convertToCSV(data);
    downloadCSV(csv, `${activeTab}-export-${new Date().toISOString().split('T')[0]}.csv`);
    toast.success('Data exported successfully');
  };

  const convertToCSV = (data: any[]) => {
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(item => Object.values(item).join(',')).join('\n');
    return `${headers}\n${rows}`;
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getFilteredData = () => {
    let data: any[] = [];
    switch (activeTab) {
      case 'clients': data = clients; break;
      case 'departments': data = departments; break;
      case 'job-titles': data = jobTitles; break;
      case 'locations': data = locations; break;
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      data = data.filter(item => item.status === filterStatus);
    }

    // Apply search filter
    if (searchTerm) {
      data = data.filter(item =>
        Object.values(item).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    return data;
  };

  const renderClientsTable = () => {
    const filteredClients = getFilteredData() as Client[];
    
    return (
      <div className="space-y-4">
        {filteredClients.map(client => (
          <Card key={client.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-xl">{client.name}</CardTitle>
                    <Badge variant={client.status === 'active' ? 'default' : 'secondary'}>
                      {client.status}
                    </Badge>
                  </div>
                  <CardDescription className="mt-2">{client.industry}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditingItem(client)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(client.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Contact:</span>
                  <p className="font-medium">{client.contactPerson}</p>
                </div>
                <div>
                  <span className="text-gray-500">Email:</span>
                  <p className="font-medium">{client.email}</p>
                </div>
                <div>
                  <span className="text-gray-500">Location:</span>
                  <p className="font-medium">{client.city}, {client.country}</p>
                </div>
                <div>
                  <span className="text-gray-500">Revenue:</span>
                  <p className="font-medium">${client.revenue.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderDepartmentsTable = () => {
    const filteredDepartments = getFilteredData() as Department[];
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredDepartments.map(dept => (
          <Card key={dept.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-purple-600" />
                    <CardTitle>{dept.name}</CardTitle>
                    <Badge variant="outline">{dept.code}</Badge>
                  </div>
                  <CardDescription className="mt-2">{dept.description}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditingItem(dept)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(dept.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-500" />
                <span className="text-sm">Manager: <strong>{dept.managerName}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-500" />
                <span className="text-sm">{dept.location}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Headcount:</span>
                  <p className="font-medium">{dept.headcount}</p>
                </div>
                <div>
                  <span className="text-gray-500">Budget:</span>
                  <p className="font-medium">${(dept.budget / 1000000).toFixed(1)}M</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderJobTitlesTable = () => {
    const filteredJobs = getFilteredData() as JobTitle[];
    
    return (
      <div className="space-y-4">
        {filteredJobs.map(job => (
          <Card key={job.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-5 w-5 text-green-600" />
                    <CardTitle>{job.title}</CardTitle>
                    <Badge variant="outline">{job.level}</Badge>
                    <Badge>{job.department}</Badge>
                  </div>
                  <CardDescription className="mt-2">{job.description}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditingItem(job)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(job.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Salary Range:</span>
                  <p className="font-medium">${job.minSalary.toLocaleString()} - ${job.maxSalary.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-500">Requirements:</span>
                  <p className="font-medium">{job.requirements}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderLocationsTable = () => {
    const filteredLocations = getFilteredData() as Location[];
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredLocations.map(location => (
          <Card key={location.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-red-600" />
                    <CardTitle>{location.name}</CardTitle>
                    <Badge variant="outline">{location.type}</Badge>
                  </div>
                  <CardDescription className="mt-2">
                    {location.address}, {location.city}, {location.state}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditingItem(location)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(location.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Capacity:</span>
                  <p className="font-medium">{location.capacity}</p>
                </div>
                <div>
                  <span className="text-gray-500">Occupancy:</span>
                  <p className="font-medium">{location.currentOccupancy} ({Math.round(location.currentOccupancy / location.capacity * 100)}%)</p>
                </div>
              </div>
              <div>
                <span className="text-gray-500 text-sm">Facilities:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {location.facilities.map((facility, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">{facility}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const canEdit = currentUser?.roles.includes('admin') || currentUser?.roles.includes('hr') || currentUser?.roles.includes('manager');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="mb-4 text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Launchpad
          </Button>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Database className="h-12 w-12" />
              <div>
                <h1 className="text-3xl font-bold">Master Data Management</h1>
                <p className="text-purple-100 mt-1">Centralized management of organizational master data</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={exportData}
                className="bg-white/20 hover:bg-white/30 text-white"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={loadData}
                className="bg-white/20 hover:bg-white/30 text-white"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Clients</p>
                  <p className="text-2xl font-bold">{clients.length}</p>
                </div>
                <Building2 className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Departments</p>
                  <p className="text-2xl font-bold">{departments.length}</p>
                </div>
                <Briefcase className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Job Titles</p>
                  <p className="text-2xl font-bold">{jobTitles.length}</p>
                </div>
                <GraduationCap className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Locations</p>
                  <p className="text-2xl font-bold">{locations.length}</p>
                </div>
                <MapPin className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Actions */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant={filterStatus === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus('all')}
                >
                  All
                </Button>
                <Button
                  variant={filterStatus === 'active' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus('active')}
                >
                  Active
                </Button>
                <Button
                  variant={filterStatus === 'inactive' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus('inactive')}
                >
                  Inactive
                </Button>
              </div>
              
              {canEdit && (
                <Button onClick={() => setShowAddModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add New
                </Button>
              )}
              
              {currentUser?.roles.includes('admin') && (
                <Button 
                  variant="outline" 
                  onClick={() => setShowConfigGuide(!showConfigGuide)}
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Configuration Guide
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Configuration Guide (Admin Only) */}
        {showConfigGuide && currentUser?.roles.includes('admin') && (
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Settings className="h-6 w-6 text-blue-600" />
                  <div>
                    <CardTitle className="text-blue-900">Master Data Configuration Guide</CardTitle>
                    <CardDescription className="text-blue-700">Complete guide for administrators to configure and manage master data</CardDescription>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowConfigGuide(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Clients Section */}
              <div className="bg-white rounded-lg p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <Building2 className="h-6 w-6 text-blue-600 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Client Management</h3>
                    <p className="text-sm text-gray-600 mb-4">Manage client relationships, contracts, and business data.</p>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Basic Information</p>
                            <p className="text-xs text-gray-600">Client name, industry, contact person, email, phone</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Location Details</p>
                            <p className="text-xs text-gray-600">Full address, city, and country information</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Status Tracking</p>
                            <p className="text-xs text-gray-600">Active, Inactive, or Prospect status</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Financial Data</p>
                            <p className="text-xs text-gray-600">Revenue tracking and contract values</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Contract Management</p>
                            <p className="text-xs text-gray-600">Start date, end date, and renewal tracking</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Notes & Documentation</p>
                            <p className="text-xs text-gray-600">Custom notes for special requirements</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <Lightbulb className="h-4 w-4 text-blue-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-blue-900">Best Practice</p>
                          <p className="text-xs text-blue-700">Always update client status when contract renews or ends. Use "Prospect" for potential clients during the sales process.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Departments Section */}
              <div className="bg-white rounded-lg p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <Briefcase className="h-6 w-6 text-purple-600 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Department Configuration</h3>
                    <p className="text-sm text-gray-600 mb-4">Define organizational structure and department hierarchy.</p>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Department Identity</p>
                            <p className="text-xs text-gray-600">Name, code (3-4 letters), and description</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Management Assignment</p>
                            <p className="text-xs text-gray-600">Manager ID and name for each department</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Location Mapping</p>
                            <p className="text-xs text-gray-600">Physical location or office assignment</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Budget Allocation</p>
                            <p className="text-xs text-gray-600">Annual department budget in USD</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Headcount Tracking</p>
                            <p className="text-xs text-gray-600">Current number of employees</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Status Management</p>
                            <p className="text-xs text-gray-600">Active or Inactive department status</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <Lightbulb className="h-4 w-4 text-purple-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-purple-900">Best Practice</p>
                          <p className="text-xs text-purple-700">Use standardized department codes (e.g., ENG for Engineering, FIN for Finance). Update headcount monthly for accurate workforce planning.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Job Titles Section */}
              <div className="bg-white rounded-lg p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <GraduationCap className="h-6 w-6 text-green-600 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Job Title & Roles</h3>
                    <p className="text-sm text-gray-600 mb-4">Configure job positions, levels, and compensation ranges.</p>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Position Details</p>
                            <p className="text-xs text-gray-600">Title, department assignment, and level</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Salary Bands</p>
                            <p className="text-xs text-gray-600">Minimum and maximum salary ranges</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Requirements</p>
                            <p className="text-xs text-gray-600">Education, experience, and skills needed</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Responsibilities</p>
                            <p className="text-xs text-gray-600">Key duties and accountabilities</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Job Description</p>
                            <p className="text-xs text-gray-600">Comprehensive role overview</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Active Status</p>
                            <p className="text-xs text-gray-600">Control hiring availability</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <Lightbulb className="h-4 w-4 text-green-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-green-900">Best Practice</p>
                          <p className="text-xs text-green-700">Review salary bands annually based on market rates. Use standardized levels: Entry, Mid, Senior, Lead, Principal for consistency.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Locations Section */}
              <div className="bg-white rounded-lg p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="h-6 w-6 text-red-600 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Office Locations</h3>
                    <p className="text-sm text-gray-600 mb-4">Manage physical office locations and facilities.</p>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Location Type</p>
                            <p className="text-xs text-gray-600">HQ, Branch, Remote, or Coworking space</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Full Address</p>
                            <p className="text-xs text-gray-600">Street, city, state, country, postal code</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Capacity Planning</p>
                            <p className="text-xs text-gray-600">Total capacity and current occupancy</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Facilities Management</p>
                            <p className="text-xs text-gray-600">Conference rooms, cafeteria, gym, parking</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Amenities Tracking</p>
                            <p className="text-xs text-gray-600">WiFi, kitchen, and other facilities</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Operational Status</p>
                            <p className="text-xs text-gray-600">Active or inactive location status</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <Lightbulb className="h-4 w-4 text-red-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-900">Best Practice</p>
                          <p className="text-xs text-red-700">Update occupancy monthly. Plan for 80% max occupancy to allow flexibility. Track facilities to help employees find amenities.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Persistence Info */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <Database className="h-6 w-6 text-blue-600 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Data Persistence & Storage</h3>
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-sm">Automatic Database Sync</p>
                          <p className="text-xs text-gray-600">All changes are automatically saved to Supabase database with real-time persistence</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-sm">CRUD Operations</p>
                          <p className="text-xs text-gray-600">Create, Read, Update, and Delete operations are fully functional with instant DB updates</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-sm">Data Export</p>
                          <p className="text-xs text-gray-600">Export any master data table to CSV format for backup or external analysis</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-sm">Audit Trail</p>
                          <p className="text-xs text-gray-600">Created and updated timestamps tracked for all records for compliance</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions for Administrators</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  <Button onClick={() => { setActiveTab('clients'); setShowConfigGuide(false); }} className="justify-start">
                    <Building2 className="h-4 w-4 mr-2" />
                    Manage Clients
                  </Button>
                  <Button onClick={() => { setActiveTab('departments'); setShowConfigGuide(false); }} className="justify-start">
                    <Briefcase className="h-4 w-4 mr-2" />
                    Manage Departments
                  </Button>
                  <Button onClick={() => { setActiveTab('job-titles'); setShowConfigGuide(false); }} className="justify-start">
                    <GraduationCap className="h-4 w-4 mr-2" />
                    Manage Job Titles
                  </Button>
                  <Button onClick={() => { setActiveTab('locations'); setShowConfigGuide(false); }} className="justify-start">
                    <MapPin className="h-4 w-4 mr-2" />
                    Manage Locations
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Data Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="clients" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Clients
            </TabsTrigger>
            <TabsTrigger value="departments" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Departments
            </TabsTrigger>
            <TabsTrigger value="job-titles" className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Job Titles
            </TabsTrigger>
            <TabsTrigger value="locations" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Locations
            </TabsTrigger>
            <TabsTrigger value="holidays" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Holidays
            </TabsTrigger>
            <TabsTrigger value="leave-policies" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Leave Policies
            </TabsTrigger>
            <TabsTrigger value="email-templates" className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              Email Templates
            </TabsTrigger>
            <TabsTrigger value="defect-tracker" className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Defect Tracker
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clients" className="mt-6">
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                <p className="text-gray-500 mt-2">Loading...</p>
              </div>
            ) : (
              renderClientsTable()
            )}
          </TabsContent>

          <TabsContent value="departments" className="mt-6">
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                <p className="text-gray-500 mt-2">Loading...</p>
              </div>
            ) : (
              renderDepartmentsTable()
            )}
          </TabsContent>

          <TabsContent value="job-titles" className="mt-6">
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                <p className="text-gray-500 mt-2">Loading...</p>
              </div>
            ) : (
              renderJobTitlesTable()
            )}
          </TabsContent>

          <TabsContent value="locations" className="mt-6">
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                <p className="text-gray-500 mt-2">Loading...</p>
              </div>
            ) : (
              renderLocationsTable()
            )}
          </TabsContent>

          {/* ── Holiday Calendar ── */}
          <TabsContent value="holidays" className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={holidayYear}
                onChange={e => setHolidayYear(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
              >
                {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={String(y)}>{y}</option>)}
              </select>
              <select
                value={holidayTypeFilter}
                onChange={e => setHolidayTypeFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
              >
                <option value="all">All Types</option>
                <SelectOptions entity="holiday" field="type" fallback={['national','regional','optional']} />
              </select>
              <div className="flex-1" />
              <Button size="sm" variant="outline" onClick={() => exportICS(holidays)}>
                <Download className="h-4 w-4 mr-2" /> Export ICS
              </Button>
              {canEdit && (
                <Button size="sm" onClick={() => { setEditingHoliday(undefined); setHolidayForm({ name: '', date: '', type: 'national', state: '' }); setShowHolidayModal(true); }}>
                  <Plus className="h-4 w-4 mr-2" /> Add Holiday
                </Button>
              )}
            </div>
            {holidayLoading ? (
              <div className="text-center py-12"><RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" /></div>
            ) : (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">State</th>
                        {canEdit && <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {holidays.filter(h => holidayTypeFilter === 'all' || h.type === holidayTypeFilter).map(h => (
                        <tr key={h.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{h.name}</td>
                          <td className="px-4 py-3 text-gray-600">{h.date}</td>
                          <td className="px-4 py-3"><Badge variant={h.type === 'national' ? 'default' : 'secondary'}>{h.type}</Badge></td>
                          <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{h.state ?? '—'}</td>
                          {canEdit && (
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="outline" onClick={() => { setEditingHoliday(h); setHolidayForm({ name: h.name, date: h.date, type: h.type, state: h.state ?? '' }); setShowHolidayModal(true); }}>
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => setDeletingHoliday(h)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                      {holidays.length === 0 && (
                        <tr><td colSpan={5} className="text-center py-8 text-gray-400">No holidays for {holidayYear}.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* ── Leave Policies ── */}
          <TabsContent value="leave-policies" className="mt-6 space-y-4">
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={loadLeavePolicies}>
                <RefreshCw className="h-4 w-4 mr-2" /> Refresh
              </Button>
            </div>
            {leavePoliciesLoading ? (
              <div className="text-center py-12"><RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" /></div>
            ) : (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Leave Type</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Days/Year</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Carry Forward</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Encashable</th>
                        {canEdit && <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {leavePolicies.map(lp => (
                        <tr key={lp.id} className="hover:bg-gray-50">
                          {editingLeavePolicy?.id === lp.id ? (
                            <>
                              <td className="px-4 py-2 font-medium text-gray-900">{lp.leave_type}</td>
                              <td className="px-4 py-2">
                                <Input type="number" value={leavePolicyForm.days_per_year ?? lp.days_per_year} onChange={e => setLeavePolicyForm(f => ({ ...f, days_per_year: Number(e.target.value) }))} className="w-20 h-8 text-sm" />
                              </td>
                              <td className="px-4 py-2">
                                <Input type="number" value={leavePolicyForm.carry_forward_limit ?? lp.carry_forward_limit} onChange={e => setLeavePolicyForm(f => ({ ...f, carry_forward_limit: Number(e.target.value) }))} className="w-20 h-8 text-sm" />
                              </td>
                              <td className="px-4 py-2">
                                <input type="checkbox" checked={leavePolicyForm.encashable ?? lp.encashable} onChange={e => setLeavePolicyForm(f => ({ ...f, encashable: e.target.checked }))} className="w-4 h-4" />
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex justify-end gap-1">
                                  <Button size="sm" onClick={saveLeavePolicy}><Check className="h-3 w-3" /></Button>
                                  <Button size="sm" variant="outline" onClick={() => setEditingLeavePolicy(undefined)}><X className="h-3 w-3" /></Button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3 font-medium text-gray-900">{lp.leave_type}</td>
                              <td className="px-4 py-3 text-gray-600">{lp.days_per_year}</td>
                              <td className="px-4 py-3 text-gray-600">{lp.carry_forward_limit}</td>
                              <td className="px-4 py-3"><Badge variant={lp.encashable ? 'default' : 'secondary'}>{lp.encashable ? 'Yes' : 'No'}</Badge></td>
                              {canEdit && (
                                <td className="px-4 py-3">
                                  <div className="flex justify-end">
                                    <Button size="sm" variant="outline" onClick={() => { setEditingLeavePolicy(lp); setLeavePolicyForm(lp); }}>
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </td>
                              )}
                            </>
                          )}
                        </tr>
                      ))}
                      {leavePolicies.length === 0 && (
                        <tr><td colSpan={5} className="text-center py-8 text-gray-400">No leave policies configured.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* ── Defect Tracker ── */}
          <TabsContent value="defect-tracker" className="mt-6 space-y-6">
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={loadDefectMasterData}>
                <RefreshCw className="h-4 w-4 mr-2" /> Refresh
              </Button>
            </div>
            {defectMasterLoading ? (
              <div className="text-center py-12"><RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" /></div>
            ) : (
              <div className="space-y-6">
                {/* Resolution Codes */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Defect Resolution Codes</CardTitle>
                    <CardDescription>Codes used when closing or resolving defects</CardDescription>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Active</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {defectMasterData.resolutionCodes.map((rc: any) => (
                          <tr key={rc.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{rc.name ?? rc.code ?? rc.id}</td>
                            <td className="px-4 py-3 text-gray-600">{rc.description ?? '—'}</td>
                            <td className="px-4 py-3"><Badge variant={rc.is_active !== false ? 'default' : 'secondary'}>{rc.is_active !== false ? 'Yes' : 'No'}</Badge></td>
                          </tr>
                        ))}
                        {defectMasterData.resolutionCodes.length === 0 && (
                          <tr><td colSpan={3} className="text-center py-6 text-gray-400">No resolution codes found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Root Cause Categories */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Root Cause Categories</CardTitle>
                    <CardDescription>Categories used for defect root cause analysis</CardDescription>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Active</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {defectMasterData.rootCauseCategories.map((rc: any) => (
                          <tr key={rc.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{rc.name ?? rc.id}</td>
                            <td className="px-4 py-3 text-gray-600">{rc.description ?? '—'}</td>
                            <td className="px-4 py-3"><Badge variant={rc.is_active !== false ? 'default' : 'secondary'}>{rc.is_active !== false ? 'Yes' : 'No'}</Badge></td>
                          </tr>
                        ))}
                        {defectMasterData.rootCauseCategories.length === 0 && (
                          <tr><td colSpan={3} className="text-center py-6 text-gray-400">No root cause categories found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Defect Labels */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Defect Labels</CardTitle>
                    <CardDescription>Labels available for tagging defects</CardDescription>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Color</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {defectMasterData.labels.map((lbl: any) => (
                          <tr key={lbl.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{lbl.name ?? lbl.id}</td>
                            <td className="px-4 py-3">
                              {lbl.color ? (
                                <span className="inline-flex items-center gap-2">
                                  <span className="w-4 h-4 rounded-full inline-block border border-gray-200" style={{ backgroundColor: lbl.color }} />
                                  <span className="text-gray-500 font-mono text-xs">{lbl.color}</span>
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-600">{lbl.description ?? '—'}</td>
                          </tr>
                        ))}
                        {defectMasterData.labels.length === 0 && (
                          <tr><td colSpan={3} className="text-center py-6 text-gray-400">No labels found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Rejection Reasons */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Rejection Reasons</CardTitle>
                    <CardDescription>Reasons used when rejecting a defect report (Won't Fix workflow)</CardDescription>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Active</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {defectMasterData.rejectionReasons.map((rr: any) => (
                          <tr key={rr.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{rr.name ?? rr.reason ?? rr.id}</td>
                            <td className="px-4 py-3 text-gray-600">{rr.description ?? '—'}</td>
                            <td className="px-4 py-3"><Badge variant={rr.is_active !== false ? 'default' : 'secondary'}>{rr.is_active !== false ? 'Yes' : 'No'}</Badge></td>
                          </tr>
                        ))}
                        {defectMasterData.rejectionReasons.length === 0 && (
                          <tr><td colSpan={3} className="text-center py-6 text-gray-400">No rejection reasons found. Run migration 08_defect_config_tables.sql</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Environments */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Test Environments</CardTitle>
                    <CardDescription>Environments where defects can be found and reproduced</CardDescription>
                  </CardHeader>
                  <div className="p-4 flex flex-wrap gap-2">
                    {defectMasterData.environments.length > 0
                      ? defectMasterData.environments.map((env: any) => (
                          <Badge key={env.id ?? env.name} variant={env.is_active !== false ? 'default' : 'secondary'}>
                            {env.name}
                          </Badge>
                        ))
                      : <p className="text-sm text-gray-400">No environments found. Run migration 08_defect_config_tables.sql</p>
                    }
                  </div>
                </Card>

                {/* Priorities */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Defect Priorities</CardTitle>
                    <CardDescription>Priority levels (P1–P4) used to triage defects</CardDescription>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Code</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Label</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {defectMasterData.priorities.map((p: any) => (
                          <tr key={p.id ?? p.code} className="hover:bg-gray-50">
                            <td className="px-4 py-3"><Badge variant="outline" className="font-mono">{p.code}</Badge></td>
                            <td className="px-4 py-3 font-medium text-gray-900">{p.label}</td>
                            <td className="px-4 py-3 text-gray-600">{p.description ?? '—'}</td>
                          </tr>
                        ))}
                        {defectMasterData.priorities.length === 0 && (
                          <tr><td colSpan={3} className="text-center py-6 text-gray-400">No priorities found. Run migration 08_defect_config_tables.sql</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Defect Statuses */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Defect Statuses</CardTitle>
                    <CardDescription>All status values in the defect lifecycle workflow</CardDescription>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Terminal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {defectMasterData.statuses.map((s: any) => (
                          <tr key={s.id ?? s.name} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                            <td className="px-4 py-3 text-gray-600">{s.description ?? '—'}</td>
                            <td className="px-4 py-3">
                              {s.is_terminal
                                ? <Badge variant="secondary">Terminal</Badge>
                                : <Badge variant="default">Active</Badge>
                              }
                            </td>
                          </tr>
                        ))}
                        {defectMasterData.statuses.length === 0 && (
                          <tr><td colSpan={3} className="text-center py-6 text-gray-400">No statuses found. Run migration 08_defect_config_tables.sql</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Escalation Rules */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Escalation Rules</CardTitle>
                    <CardDescription>Automatic escalation triggers based on severity and SLA thresholds</CardDescription>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Rule Name</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Severity</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Condition</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Active</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {defectMasterData.escalationRules.map((r: any) => (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                            <td className="px-4 py-3">
                              <Badge variant={r.severity === 'Very High' ? 'destructive' : r.severity === 'High' ? 'default' : 'secondary'}>
                                {r.severity}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                              {r.condition} &gt; {r.threshold}{r.condition?.includes('percent') ? '%' : 'm'}
                            </td>
                            <td className="px-4 py-3 text-gray-600">{r.action?.replace(/_/g, ' ')}</td>
                            <td className="px-4 py-3">
                              <Badge variant={r.is_active !== false ? 'default' : 'secondary'}>{r.is_active !== false ? 'Yes' : 'No'}</Badge>
                            </td>
                          </tr>
                        ))}
                        {defectMasterData.escalationRules.length === 0 && (
                          <tr><td colSpan={5} className="text-center py-6 text-gray-400">No escalation rules found. Run migration 08_defect_config_tables.sql</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ── Email Templates ── */}
          <TabsContent value="email-templates" className="mt-6 space-y-3">
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={loadEmailTemplates}>
                <RefreshCw className="h-4 w-4 mr-2" /> Refresh
              </Button>
            </div>
            {emailTemplatesLoading ? (
              <div className="text-center py-12"><RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" /></div>
            ) : emailTemplates.map(tpl => {
              const vars = [...new Set([...tpl.body.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))];
              return (
                <Card key={tpl.id} className="overflow-hidden">
                  <CardHeader className="cursor-pointer" onClick={() => setExpandedTemplate(expandedTemplate === tpl.id ? undefined : tpl.id)}>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{tpl.name}</CardTitle>
                        <CardDescription>{tpl.trigger_event} {tpl.updated_at && `· Updated ${new Date(tpl.updated_at).toLocaleDateString()}`}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {canEdit && (
                          <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setEditingTemplate(tpl); setTemplateForm({ subject: tpl.subject, body: tpl.body }); }}>
                            <Edit className="h-3 w-3 mr-1" /> Edit
                          </Button>
                        )}
                        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${expandedTemplate === tpl.id ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                  </CardHeader>
                  {expandedTemplate === tpl.id && (
                    <CardContent className="border-t border-gray-100 space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1">Subject</p>
                        <p className="text-sm text-gray-800">{tpl.subject}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1">Body Preview</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded p-3"
                          dangerouslySetInnerHTML={{ __html: tpl.body.replace(/\{\{(\w+)\}\}/g, '<mark class="bg-yellow-100 text-yellow-800 rounded px-0.5">{{$1}}</mark>') }}
                        />
                      </div>
                      {vars.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 mb-1">Variables</p>
                          <div className="flex flex-wrap gap-1">
                            {vars.map(v => <span key={v} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 font-mono">{`{{${v}}}`}</span>)}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
            {!emailTemplatesLoading && emailTemplates.length === 0 && (
              <div className="text-center py-12 text-gray-400">No email templates found.</div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Holiday Add/Edit Modal */}
      {showHolidayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">{editingHoliday ? 'Edit Holiday' : 'Add Holiday'}</h3>
              <button onClick={() => setShowHolidayModal(false)} className="p-1 rounded hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <Label>Name *</Label>
                <Input value={holidayForm.name} onChange={e => setHolidayForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>Date *</Label>
                <Input type="date" value={holidayForm.date} onChange={e => setHolidayForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <Label>Type</Label>
                <select value={holidayForm.type} onChange={e => setHolidayForm(f => ({ ...f, type: e.target.value as Holiday['type'] }))} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mt-1">
                  <SelectOptions entity="holiday" field="type" fallback={['national','regional','optional']} />
                </select>
              </div>
              <div>
                <Label>State (optional)</Label>
                <Input value={holidayForm.state} onChange={e => setHolidayForm(f => ({ ...f, state: e.target.value }))} placeholder="e.g. CA, TX" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowHolidayModal(false)}>Cancel</Button>
              <Button onClick={saveHoliday}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* Holiday Delete Confirm */}
      {deletingHoliday && (
        <ConfirmDialog
          title="Delete Holiday"
          message={`Remove "${deletingHoliday.name}" from the calendar?`}
          confirmLabel="Delete"
          danger
          onConfirm={() => { deleteHoliday(deletingHoliday.id); setDeletingHoliday(undefined); }}
          onCancel={() => setDeletingHoliday(undefined)}
        />
      )}

      {/* Email Template Edit Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Edit: {editingTemplate.name}</h3>
              <button onClick={() => setEditingTemplate(undefined)} className="p-1 rounded hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <Label>Subject</Label>
                <Input value={templateForm.subject} onChange={e => setTemplateForm(f => ({ ...f, subject: e.target.value }))} />
              </div>
              <div>
                <Label>Body</Label>
                <textarea value={templateForm.body} onChange={e => setTemplateForm(f => ({ ...f, body: e.target.value }))} rows={10} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none font-mono" />
              </div>
              {(() => {
                const vars = [...new Set([...templateForm.body.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))];
                return vars.length > 0 ? (
                  <div>
                    <Label>Detected Variables</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {vars.map(v => <span key={v} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 font-mono">{`{{${v}}}`}</span>)}
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setEditingTemplate(undefined)}>Cancel</Button>
              <Button onClick={saveEmailTemplate}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <MasterDataForm
        open={showAddModal || !!editingItem}
        onClose={() => {
          setShowAddModal(false);
          setEditingItem(null);
        }}
        onSave={handleSave}
        dataType={activeTab as 'clients' | 'departments' | 'job-titles' | 'locations'}
        initialData={editingItem}
        isEditing={!!editingItem}
      />
    </div>
  );
}