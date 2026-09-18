import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { SelectOptions } from '../../context/ValueHelpsContext';

interface FormFieldsProps {
  activeTab: string;
  editingItem: any;
  formData: any;
  setFormData: (data: any) => void;
  masterData: any;
}


export function MasterDataFormFields({ activeTab, editingItem, formData, setFormData, masterData }: FormFieldsProps) {
  // Helper to get department options from existing data
  const departmentOptions = (masterData.departments || []).map((d: any) => ({
    value: d.name,
    label: d.name
  }));

  // Helper to get location options from existing data
  const locationOptions = (masterData.locations || []).map((l: any) => ({
    value: l.name,
    label: l.name
  }));

  // Clients Form
  if (activeTab === 'clients') {
    return (
      <>
        <div>
          <Label>Name *</Label>
          <Input name="name" defaultValue={editingItem?.name} required />
        </div>
        <div>
          <Label>Industry *</Label>
          <Select value={formData.industry} onValueChange={(value) => setFormData({ ...formData, industry: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select industry" />
            </SelectTrigger>
            <SelectContent>
              <SelectOptions entity="masterdata" field="industry" fallback={['Technology','Manufacturing','Healthcare','Finance','Retail','Education','Consulting','Software','Other']} />
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Contact Person *</Label>
          <Input name="contact" defaultValue={editingItem?.contact} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Email</Label>
            <Input name="email" type="email" defaultValue={editingItem?.email} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input name="phone" defaultValue={editingItem?.phone} />
          </div>
        </div>
        <div>
          <Label>Annual Revenue *</Label>
          <Input name="revenue" type="number" defaultValue={editingItem?.revenue} required />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={formData.status || 'active'} onValueChange={(value) => setFormData({ ...formData, status: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectOptions entity="masterdata" field="status" fallback={['active','inactive','pending','archived']} />
            </SelectContent>
          </Select>
        </div>
      </>
    );
  }

  // Departments Form
  if (activeTab === 'departments') {
    return (
      <>
        <div>
          <Label>Department Name *</Label>
          <Input name="name" defaultValue={editingItem?.name} required />
        </div>
        <div>
          <Label>Code *</Label>
          <Input name="code" defaultValue={editingItem?.code} required />
        </div>
        <div>
          <Label>Manager *</Label>
          <Input name="manager" defaultValue={editingItem?.manager} required />
        </div>
        {locationOptions.length > 0 && (
          <div>
            <Label>Location</Label>
            <Select value={formData.location || editingItem?.location || 'headquarters'} onValueChange={(value) => setFormData({ ...formData, location: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locationOptions.map(l => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Budget</Label>
            <Input name="budget" type="number" defaultValue={editingItem?.budget} />
          </div>
          <div>
            <Label>Headcount</Label>
            <Input name="headcount" type="number" defaultValue={editingItem?.headcount} />
          </div>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={formData.status || editingItem?.status || 'active'} onValueChange={(value) => setFormData({ ...formData, status: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectOptions entity="masterdata" field="status" fallback={['active','inactive','pending','archived']} />
            </SelectContent>
          </Select>
        </div>
      </>
    );
  }

  // Job Titles Form
  if (activeTab === 'job-titles') {
    return (
      <>
        <div>
          <Label>Job Title *</Label>
          <Input name="title" defaultValue={editingItem?.title} required />
        </div>
        <div>
          <Label>Department *</Label>
          <Select value={formData.department || editingItem?.department || 'Engineering'} onValueChange={(value) => setFormData({ ...formData, department: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {departmentOptions.length > 0 ? departmentOptions.map(d => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              )) : [
                { value: 'Engineering', label: 'Engineering' },
                { value: 'HR', label: 'Human Resources' },
                { value: 'Finance', label: 'Finance' },
                { value: 'Marketing', label: 'Marketing' },
              ].map(d => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Level *</Label>
          <Select value={formData.level || editingItem?.level || 'entry-level'} onValueChange={(value) => setFormData({ ...formData, level: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              <SelectOptions entity="masterdata" field="job_level" fallback={['Entry-Level','Mid-Level','Senior','Lead','Principal','Executive']} />
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Min Salary</Label>
            <Input name="salaryMin" type="number" defaultValue={editingItem?.salaryMin} />
          </div>
          <div>
            <Label>Max Salary</Label>
            <Input name="salaryMax" type="number" defaultValue={editingItem?.salaryMax} />
          </div>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={formData.status || editingItem?.status || 'active'} onValueChange={(value) => setFormData({ ...formData, status: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectOptions entity="masterdata" field="status" fallback={['active','inactive','pending','archived']} />
            </SelectContent>
          </Select>
        </div>
      </>
    );
  }

  // Locations Form
  if (activeTab === 'locations') {
    return (
      <>
        <div>
          <Label>Location Name *</Label>
          <Input name="name" defaultValue={editingItem?.name} required />
        </div>
        <div>
          <Label>Type *</Label>
          <Select value={formData.type || editingItem?.type || 'headquarters'} onValueChange={(value) => setFormData({ ...formData, type: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectOptions entity="masterdata" field="location_type" fallback={['headquarters','branch','remote','coworking','warehouse']} />
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Address *</Label>
          <Input name="address" defaultValue={editingItem?.address} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Capacity</Label>
            <Input name="capacity" type="number" defaultValue={editingItem?.capacity} />
          </div>
          <div>
            <Label>Occupancy</Label>
            <Input name="occupancy" type="number" defaultValue={editingItem?.occupancy} />
          </div>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={formData.status || editingItem?.status || 'active'} onValueChange={(value) => setFormData({ ...formData, status: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectOptions entity="masterdata" field="status" fallback={['active','inactive','pending','archived']} />
            </SelectContent>
          </Select>
        </div>
      </>
    );
  }

  // Performance Metrics Form
  if (activeTab === 'performance-metrics') {
    return (
      <>
        <div>
          <Label>Metric Name *</Label>
          <Input name="name" defaultValue={editingItem?.name} required />
        </div>
        <div>
          <Label>Category *</Label>
          <Select value={formData.category || editingItem?.category || 'productivity'} onValueChange={(value) => setFormData({ ...formData, category: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectOptions entity="masterdata" field="metric_category" fallback={['Engineering','Customer Success','Productivity','Quality','Employee Engagement','Financial']} />
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Unit</Label>
            <Input name="unit" defaultValue={editingItem?.unit} placeholder="e.g., %, Score, Count" />
          </div>
          <div>
            <Label>Target Value</Label>
            <Input name="target" type="number" defaultValue={editingItem?.target} />
          </div>
        </div>
        <div>
          <Label>Frequency</Label>
          <Select value={formData.frequency || editingItem?.frequency || 'monthly'} onValueChange={(value) => setFormData({ ...formData, frequency: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectOptions entity="masterdata" field="frequency" fallback={['Daily','Weekly','Bi-weekly','Monthly','Quarterly','Annually']} />
            </SelectContent>
          </Select>
        </div>
      </>
    );
  }

  // Training Courses Form
  if (activeTab === 'training-courses') {
    return (
      <>
        <div>
          <Label>Course Name *</Label>
          <Input name="name" defaultValue={editingItem?.name} required />
        </div>
        <div>
          <Label>Category *</Label>
          <Select value={formData.category || editingItem?.category || 'technical'} onValueChange={(value) => setFormData({ ...formData, category: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectOptions entity="training" field="category" fallback={['Technical','Leadership','Soft Skills','Compliance','Domain','Safety']} />
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Duration</Label>
            <Input name="duration" defaultValue={editingItem?.duration} placeholder="e.g., 2 days" />
          </div>
          <div>
            <Label>Provider</Label>
            <Input name="provider" defaultValue={editingItem?.provider} />
          </div>
          <div>
            <Label>Cost</Label>
            <Input name="cost" type="number" defaultValue={editingItem?.cost} />
          </div>
        </div>
      </>
    );
  }

  // Salary Components Form
  if (activeTab === 'salary-components') {
    return (
      <>
        <div>
          <Label>Component Name *</Label>
          <Input name="name" defaultValue={editingItem?.name} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Type *</Label>
            <Select value={formData.type || editingItem?.type || 'fixed'} onValueChange={(value) => setFormData({ ...formData, type: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectOptions entity="masterdata" field="component_type" fallback={['Fixed','Variable','Bonus','Allowance']} />
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Calculation Method</Label>
            <Input name="calculation" defaultValue={editingItem?.calculation} placeholder="e.g., Monthly, Percentage" />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="taxable"
            checked={formData.taxable !== undefined ? formData.taxable : (editingItem?.taxable !== false)}
            onCheckedChange={(checked) => setFormData({ ...formData, taxable: checked })}
          />
          <Label htmlFor="taxable" className="cursor-pointer">Taxable</Label>
        </div>
      </>
    );
  }

  // Benefits Form
  if (activeTab === 'benefits') {
    return (
      <>
        <div>
          <Label>Benefit Name *</Label>
          <Input name="name" defaultValue={editingItem?.name} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Type *</Label>
            <Select value={formData.type || editingItem?.type || 'medical'} onValueChange={(value) => setFormData({ ...formData, type: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectOptions entity="masterdata" field="benefit_type" fallback={['Medical','Dental','Vision','Retirement','Wellness','Other']} />
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Monthly Cost</Label>
            <Input name="cost" type="number" defaultValue={editingItem?.cost} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Eligibility</Label>
            <Input name="eligibility" defaultValue={editingItem?.eligibility} placeholder="e.g., All Full-Time" />
          </div>
          <div>
            <Label>Provider</Label>
            <Input name="provider" defaultValue={editingItem?.provider} />
          </div>
        </div>
      </>
    );
  }

  // Service Categories Form
  if (activeTab === 'service-categories') {
    return (
      <>
        <div>
          <Label>Category Name *</Label>
          <Input name="name" defaultValue={editingItem?.name} required />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea name="description" defaultValue={editingItem?.description} rows={3} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Assigned Team</Label>
            <Input name="team" defaultValue={editingItem?.team} />
          </div>
          <div>
            <Label>Priority Level</Label>
            <Select value={formData.priority || editingItem?.priority || 'medium'} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectOptions entity="project" field="priority" fallback={['Low','Medium','High','Critical']} />
              </SelectContent>
            </Select>
          </div>
        </div>
      </>
    );
  }

  // Ticket Types Form  
  if (activeTab === 'ticket-types') {
    return (
      <>
        <div>
          <Label>Ticket Type Name *</Label>
          <Input name="name" defaultValue={editingItem?.name} required />
        </div>
        <div>
          <Label>Category *</Label>
          <Input name="category" defaultValue={editingItem?.category} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Default Priority</Label>
            <Select value={formData.defaultPriority || editingItem?.defaultPriority || 'medium'} onValueChange={(value) => setFormData({ ...formData, defaultPriority: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectOptions entity="project" field="priority" fallback={['Low','Medium','High','Critical']} />
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>SLA</Label>
            <Input name="sla" defaultValue={editingItem?.sla} placeholder="e.g., 4 hours" />
          </div>
        </div>
      </>
    );
  }

  // Asset Types Form
  if (activeTab === 'asset-types') {
    return (
      <>
        <div>
          <Label>Asset Type Name *</Label>
          <Input name="name" defaultValue={editingItem?.name} required />
        </div>
        <div>
          <Label>Category *</Label>
          <Select value={formData.category || editingItem?.category || 'hardware'} onValueChange={(value) => setFormData({ ...formData, category: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectOptions entity="asset" field="category" fallback={['Computing','Peripherals','Networking','Office Equipment','Furniture','Other']} />
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Depreciation Rate (%)</Label>
            <Input name="depreciationRate" type="number" step="0.1" defaultValue={editingItem?.depreciationRate} />
          </div>
          <div>
            <Label>Warranty Period</Label>
            <Input name="warrantyPeriod" defaultValue={editingItem?.warrantyPeriod} placeholder="e.g., 3 years" />
          </div>
        </div>
      </>
    );
  }

  // Vendors Form
  if (activeTab === 'vendors') {
    return (
      <>
        <div>
          <Label>Vendor Name *</Label>
          <Input name="name" defaultValue={editingItem?.name} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Category *</Label>
            <Select value={formData.category || editingItem?.category || 'hardware'} onValueChange={(value) => setFormData({ ...formData, category: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectOptions entity="masterdata" field="vendor_category" fallback={['hardware','software','services','consulting','office-supplies']} />
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Contact</Label>
            <Input name="contact" defaultValue={editingItem?.contact} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Rating (0-5)</Label>
            <Input name="rating" type="number" step="0.1" min="0" max="5" defaultValue={editingItem?.rating} />
          </div>
          <div>
            <Label>Payment Terms</Label>
            <Input name="paymentTerms" defaultValue={editingItem?.paymentTerms} placeholder="e.g., Net 30" />
          </div>
        </div>
      </>
    );
  }

  // Priority Levels Form
  if (activeTab === 'priority-levels') {
    return (
      <>
        <div>
          <Label>Priority Name *</Label>
          <Input name="name" defaultValue={editingItem?.name} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Color Code</Label>
            <Input name="colorCode" type="color" defaultValue={editingItem?.colorCode || '#3B82F6'} />
          </div>
          <div>
            <Label>SLA Impact</Label>
            <Input name="slaImpact" defaultValue={editingItem?.slaImpact} placeholder="e.g., 4 hours" />
          </div>
        </div>
        <div>
          <Label>Escalation Rules</Label>
          <Input name="escalation" defaultValue={editingItem?.escalation} placeholder="e.g., Auto-escalate in 1 hour" />
        </div>
      </>
    );
  }

  // Tax Rates Form
  if (activeTab === 'tax-rates') {
    return (
      <>
        <div>
          <Label>Tax Name *</Label>
          <Input name="name" defaultValue={editingItem?.name} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Rate (%) *</Label>
            <Input name="rate" type="number" step="0.1" defaultValue={editingItem?.rate} required />
          </div>
          <div>
            <Label>Jurisdiction</Label>
            <Input name="jurisdiction" defaultValue={editingItem?.jurisdiction} placeholder="e.g., California, UK" />
          </div>
        </div>
        <div>
          <Label>Effective Date</Label>
          <Input name="effectiveDate" type="date" defaultValue={editingItem?.effectiveDate} />
        </div>
      </>
    );
  }

  // Generic fallback for other types
  return (
    <>
      <div>
        <Label>Name *</Label>
        <Input name="name" defaultValue={editingItem?.name || editingItem?.title} required />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea name="description" defaultValue={editingItem?.description} rows={3} />
      </div>
      <div>
        <Label>Status</Label>
        <Select value={formData.status || editingItem?.status || 'active'} onValueChange={(value) => setFormData({ ...formData, status: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectOptions entity="masterdata" field="status" fallback={['active','inactive','pending','archived']} />
          </SelectContent>
        </Select>
      </div>
    </>
  );
}