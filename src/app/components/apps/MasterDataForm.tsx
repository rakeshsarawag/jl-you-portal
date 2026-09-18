import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Save, X } from 'lucide-react';

interface MasterDataFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  dataType: 'clients' | 'departments' | 'job-titles' | 'locations';
  initialData?: any;
  isEditing: boolean;
}

export function MasterDataForm({ open, onClose, onSave, dataType, initialData, isEditing }: MasterDataFormProps) {
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (open) {
      if (isEditing && initialData) {
        setFormData(initialData);
      } else {
        // Initialize with empty values based on data type
        switch (dataType) {
          case 'clients':
            setFormData({
              name: '',
              industry: '',
              contactPerson: '',
              email: '',
              phone: '',
              address: '',
              city: '',
              country: '',
              status: 'active',
              revenue: 0,
              contractStartDate: '',
              contractEndDate: '',
              notes: ''
            });
            break;
          case 'departments':
            setFormData({
              name: '',
              code: '',
              description: '',
              managerId: '',
              managerName: '',
              location: '',
              budget: 0,
              headcount: 0,
              status: 'active'
            });
            break;
          case 'job-titles':
            setFormData({
              title: '',
              department: '',
              level: '',
              description: '',
              minSalary: 0,
              maxSalary: 0,
              requirements: '',
              responsibilities: '',
              status: 'active'
            });
            break;
          case 'locations':
            setFormData({
              name: '',
              type: 'branch',
              address: '',
              city: '',
              state: '',
              country: '',
              postalCode: '',
              capacity: 0,
              currentOccupancy: 0,
              facilities: [],
              status: 'active'
            });
            break;
        }
      }
    }
  }, [open, isEditing, initialData, dataType]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const renderClientForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Client Name *</Label>
          <Input
            id="name"
            value={formData.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="industry">Industry *</Label>
          <Input
            id="industry"
            value={formData.industry || ''}
            onChange={(e) => handleChange('industry', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="contactPerson">Contact Person</Label>
          <Input
            id="contactPerson"
            value={formData.contactPerson || ''}
            onChange={(e) => handleChange('contactPerson', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email || ''}
            onChange={(e) => handleChange('email', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={formData.phone || ''}
            onChange={(e) => handleChange('phone', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status || 'active'} onValueChange={(value) => handleChange('status', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="prospect">Prospect</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={formData.city || ''}
            onChange={(e) => handleChange('city', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            value={formData.country || ''}
            onChange={(e) => handleChange('country', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="revenue">Revenue ($)</Label>
          <Input
            id="revenue"
            type="number"
            value={formData.revenue || 0}
            onChange={(e) => handleChange('revenue', Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          value={formData.address || ''}
          onChange={(e) => handleChange('address', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="contractStartDate">Contract Start Date</Label>
          <Input
            id="contractStartDate"
            type="date"
            value={formData.contractStartDate || ''}
            onChange={(e) => handleChange('contractStartDate', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="contractEndDate">Contract End Date</Label>
          <Input
            id="contractEndDate"
            type="date"
            value={formData.contractEndDate || ''}
            onChange={(e) => handleChange('contractEndDate', e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes || ''}
          onChange={(e) => handleChange('notes', e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );

  const renderDepartmentForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Department Name *</Label>
          <Input
            id="name"
            value={formData.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="code">Code *</Label>
          <Input
            id="code"
            value={formData.code || ''}
            onChange={(e) => handleChange('code', e.target.value.toUpperCase())}
            maxLength={4}
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="managerName">Manager Name</Label>
          <Input
            id="managerName"
            value={formData.managerName || ''}
            onChange={(e) => handleChange('managerName', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="managerId">Manager ID</Label>
          <Input
            id="managerId"
            value={formData.managerId || ''}
            onChange={(e) => handleChange('managerId', e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          value={formData.location || ''}
          onChange={(e) => handleChange('location', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="budget">Budget ($)</Label>
          <Input
            id="budget"
            type="number"
            value={formData.budget || 0}
            onChange={(e) => handleChange('budget', Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="headcount">Headcount</Label>
          <Input
            id="headcount"
            type="number"
            value={formData.headcount || 0}
            onChange={(e) => handleChange('headcount', Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status || 'active'} onValueChange={(value) => handleChange('status', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  const renderJobTitleForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="title">Job Title *</Label>
          <Input
            id="title"
            value={formData.title || ''}
            onChange={(e) => handleChange('title', e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="department">Department</Label>
          <Input
            id="department"
            value={formData.department || ''}
            onChange={(e) => handleChange('department', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="level">Level</Label>
          <Select value={formData.level || 'Mid-Level'} onValueChange={(value) => handleChange('level', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Entry-Level">Entry-Level</SelectItem>
              <SelectItem value="Mid-Level">Mid-Level</SelectItem>
              <SelectItem value="Senior">Senior</SelectItem>
              <SelectItem value="Lead">Lead</SelectItem>
              <SelectItem value="Principal">Principal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status || 'active'} onValueChange={(value) => handleChange('status', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="minSalary">Min Salary ($)</Label>
          <Input
            id="minSalary"
            type="number"
            value={formData.minSalary || 0}
            onChange={(e) => handleChange('minSalary', Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="maxSalary">Max Salary ($)</Label>
          <Input
            id="maxSalary"
            type="number"
            value={formData.maxSalary || 0}
            onChange={(e) => handleChange('maxSalary', Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="requirements">Requirements</Label>
        <Textarea
          id="requirements"
          value={formData.requirements || ''}
          onChange={(e) => handleChange('requirements', e.target.value)}
          rows={2}
        />
      </div>

      <div>
        <Label htmlFor="responsibilities">Responsibilities</Label>
        <Textarea
          id="responsibilities"
          value={formData.responsibilities || ''}
          onChange={(e) => handleChange('responsibilities', e.target.value)}
          rows={2}
        />
      </div>
    </div>
  );

  const renderLocationForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Location Name *</Label>
          <Input
            id="name"
            value={formData.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="type">Type</Label>
          <Select value={formData.type || 'branch'} onValueChange={(value) => handleChange('type', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="headquarters">Headquarters</SelectItem>
              <SelectItem value="branch">Branch</SelectItem>
              <SelectItem value="remote">Remote</SelectItem>
              <SelectItem value="coworking">Coworking</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          value={formData.address || ''}
          onChange={(e) => handleChange('address', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={formData.city || ''}
            onChange={(e) => handleChange('city', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="state">State</Label>
          <Input
            id="state"
            value={formData.state || ''}
            onChange={(e) => handleChange('state', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            value={formData.country || ''}
            onChange={(e) => handleChange('country', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="postalCode">Postal Code</Label>
          <Input
            id="postalCode"
            value={formData.postalCode || ''}
            onChange={(e) => handleChange('postalCode', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="capacity">Capacity</Label>
          <Input
            id="capacity"
            type="number"
            value={formData.capacity || 0}
            onChange={(e) => handleChange('capacity', Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="currentOccupancy">Current Occupancy</Label>
          <Input
            id="currentOccupancy"
            type="number"
            value={formData.currentOccupancy || 0}
            onChange={(e) => handleChange('currentOccupancy', Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="facilities">Facilities (comma-separated)</Label>
        <Input
          id="facilities"
          value={Array.isArray(formData.facilities) ? formData.facilities.join(', ') : ''}
          onChange={(e) => handleChange('facilities', e.target.value.split(',').map((s: string) => s.trim()))}
          placeholder="WiFi, Conference Rooms, Parking"
        />
      </div>

      <div>
        <Label htmlFor="status">Status</Label>
        <Select value={formData.status || 'active'} onValueChange={(value) => handleChange('status', value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const getTitle = () => {
    const action = isEditing ? 'Edit' : 'Add New';
    switch (dataType) {
      case 'clients': return `${action} Client`;
      case 'departments': return `${action} Department`;
      case 'job-titles': return `${action} Job Title`;
      case 'locations': return `${action} Location`;
      default: return action;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the information below' : 'Fill in the details to create a new record'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          {dataType === 'clients' && renderClientForm()}
          {dataType === 'departments' && renderDepartmentForm()}
          {dataType === 'job-titles' && renderJobTitleForm()}
          {dataType === 'locations' && renderLocationForm()}

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit">
              <Save className="h-4 w-4 mr-2" />
              {isEditing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
