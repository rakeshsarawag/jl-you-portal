import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Plus, Edit, Trash2, X, Save, List, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/constants';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-1fe2c468`;

interface ValueHelpOption {
  id: string;
  value: string;
  label: string;
  description?: string;
  order: number;
  active: boolean;
}

interface ValueHelpConfig {
  id: string;
  name: string;
  description: string;
  category: string;
  usedBy: string[];
  allowCustomValues: boolean;
  options: ValueHelpOption[];
}

interface ValueHelpsManagerProps {
  onClose: () => void;
}

// Initial Value Help Configurations
const INITIAL_VALUE_HELPS: ValueHelpConfig[] = [
  {
    id: 'industries',
    name: 'Industries',
    description: 'Client and company industry classifications',
    category: 'General',
    usedBy: ['Clients', 'Recruitment Tracker', 'LinkedIn Post Generation'],
    allowCustomValues: true,
    options: [
      { id: '1', value: 'Technology', label: 'Technology', order: 1, active: true },
      { id: '2', value: 'Manufacturing', label: 'Manufacturing', order: 2, active: true },
      { id: '3', value: 'Healthcare', label: 'Healthcare', order: 3, active: true },
      { id: '4', value: 'Finance', label: 'Finance', order: 4, active: true },
      { id: '5', value: 'Retail', label: 'Retail', order: 5, active: true },
      { id: '6', value: 'Education', label: 'Education', order: 6, active: true },
      { id: '7', value: 'Consulting', label: 'Consulting', order: 7, active: true },
      { id: '8', value: 'Software', label: 'Software', order: 8, active: true },
      { id: '9', value: 'Other', label: 'Other', order: 9, active: true },
    ],
  },
  {
    id: 'statuses',
    name: 'Status Values',
    description: 'Common status values used across applications',
    category: 'General',
    usedBy: ['All Applications'],
    allowCustomValues: false,
    options: [
      { id: '1', value: 'active', label: 'Active', description: 'Item is currently active', order: 1, active: true },
      { id: '2', value: 'inactive', label: 'Inactive', description: 'Item is temporarily inactive', order: 2, active: true },
      { id: '3', value: 'pending', label: 'Pending', description: 'Item is pending approval', order: 3, active: true },
      { id: '4', value: 'archived', label: 'Archived', description: 'Item is archived', order: 4, active: true },
    ],
  },
  {
    id: 'job-levels',
    name: 'Job Levels',
    description: 'Employee and position hierarchy levels',
    category: 'HR',
    usedBy: ['Job Titles', 'Recruitment Tracker', 'Performance Tracker'],
    allowCustomValues: true,
    options: [
      { id: '1', value: 'Entry-Level', label: 'Entry-Level', order: 1, active: true },
      { id: '2', value: 'Mid-Level', label: 'Mid-Level', order: 2, active: true },
      { id: '3', value: 'Senior', label: 'Senior', order: 3, active: true },
      { id: '4', value: 'Lead', label: 'Lead', order: 4, active: true },
      { id: '5', value: 'Principal', label: 'Principal', order: 5, active: true },
      { id: '6', value: 'Executive', label: 'Executive', order: 6, active: true },
    ],
  },
  {
    id: 'priority-levels',
    name: 'Priority Levels',
    description: 'Task and issue priority classifications',
    category: 'Operations',
    usedBy: ['Project Management', 'IT Services', 'Workflow Automation'],
    allowCustomValues: false,
    options: [
      { id: '1', value: 'Low', label: 'Low', description: '1-2 weeks response time', order: 1, active: true },
      { id: '2', value: 'Medium', label: 'Medium', description: '1-3 days response time', order: 2, active: true },
      { id: '3', value: 'High', label: 'High', description: 'Same day response', order: 3, active: true },
      { id: '4', value: 'Critical', label: 'Critical', description: 'Immediate response', order: 4, active: true },
    ],
  },
  {
    id: 'frequency-options',
    name: 'Frequency Options',
    description: 'Time frequency and recurrence options',
    category: 'General',
    usedBy: ['Performance Metrics', 'Training Tracker', 'Payroll Management'],
    allowCustomValues: true,
    options: [
      { id: '1', value: 'Daily', label: 'Daily', order: 1, active: true },
      { id: '2', value: 'Weekly', label: 'Weekly', order: 2, active: true },
      { id: '3', value: 'Bi-weekly', label: 'Bi-weekly', order: 3, active: true },
      { id: '4', value: 'Monthly', label: 'Monthly', order: 4, active: true },
      { id: '5', value: 'Quarterly', label: 'Quarterly', order: 5, active: true },
      { id: '6', value: 'Annually', label: 'Annually', order: 6, active: true },
    ],
  },
  {
    id: 'component-types',
    name: 'Salary Component Types',
    description: 'Types of salary components',
    category: 'Finance',
    usedBy: ['Salary Components', 'Payroll Management'],
    allowCustomValues: true,
    options: [
      { id: '1', value: 'Fixed', label: 'Fixed', description: 'Fixed monthly amount', order: 1, active: true },
      { id: '2', value: 'Variable', label: 'Variable', description: 'Variable based on performance', order: 2, active: true },
      { id: '3', value: 'Bonus', label: 'Bonus', description: 'One-time bonus payment', order: 3, active: true },
      { id: '4', value: 'Allowance', label: 'Allowance', description: 'Monthly allowance', order: 4, active: true },
    ],
  },
  {
    id: 'benefit-types',
    name: 'Benefit Types',
    description: 'Employee benefit categories',
    category: 'HR',
    usedBy: ['Benefits', 'Payroll Management', 'Employee Dashboard'],
    allowCustomValues: true,
    options: [
      { id: '1', value: 'Medical', label: 'Medical', description: 'Health insurance', order: 1, active: true },
      { id: '2', value: 'Dental', label: 'Dental', description: 'Dental insurance', order: 2, active: true },
      { id: '3', value: 'Vision', label: 'Vision', description: 'Vision insurance', order: 3, active: true },
      { id: '4', value: 'Retirement', label: 'Retirement', description: 'Retirement plans', order: 4, active: true },
      { id: '5', value: 'Wellness', label: 'Wellness', description: 'Wellness programs', order: 5, active: true },
      { id: '6', value: 'Other', label: 'Other', description: 'Other benefits', order: 6, active: true },
    ],
  },
  {
    id: 'training-categories',
    name: 'Training Categories',
    description: 'Training and development categories',
    category: 'HR',
    usedBy: ['Training Courses', 'Training Tracker', 'Onboarding Portal'],
    allowCustomValues: true,
    options: [
      { id: '1', value: 'Technical', label: 'Technical', order: 1, active: true },
      { id: '2', value: 'Management', label: 'Management', order: 2, active: true },
      { id: '3', value: 'Methodology', label: 'Methodology', order: 3, active: true },
      { id: '4', value: 'Compliance', label: 'Compliance', order: 4, active: true },
      { id: '5', value: 'Leadership', label: 'Leadership', order: 5, active: true },
      { id: '6', value: 'Safety', label: 'Safety', order: 6, active: true },
    ],
  },
  {
    id: 'metric-categories',
    name: 'Performance Metric Categories',
    description: 'Performance measurement categories',
    category: 'HR',
    usedBy: ['Performance Metrics', 'Performance Tracker', 'OKR & Goal Management'],
    allowCustomValues: true,
    options: [
      { id: '1', value: 'Engineering', label: 'Engineering', order: 1, active: true },
      { id: '2', value: 'Customer Success', label: 'Customer Success', order: 2, active: true },
      { id: '3', value: 'Productivity', label: 'Productivity', order: 3, active: true },
      { id: '4', value: 'Quality', label: 'Quality', order: 4, active: true },
      { id: '5', value: 'Employee Engagement', label: 'Employee Engagement', order: 5, active: true },
      { id: '6', value: 'Financial', label: 'Financial', order: 6, active: true },
    ],
  },
  {
    id: 'asset-categories',
    name: 'Asset Categories',
    description: 'IT and physical asset classifications',
    category: 'IT',
    usedBy: ['Asset Types', 'Asset Management'],
    allowCustomValues: true,
    options: [
      { id: '1', value: 'Hardware', label: 'Hardware', order: 1, active: true },
      { id: '2', value: 'Software', label: 'Software', order: 2, active: true },
      { id: '3', value: 'Office Equipment', label: 'Office Equipment', order: 3, active: true },
      { id: '4', value: 'Furniture', label: 'Furniture', order: 4, active: true },
      { id: '5', value: 'Vehicle', label: 'Vehicle', order: 5, active: true },
    ],
  },
  {
    id: 'vendor-categories',
    name: 'Vendor Categories',
    description: 'Supplier and vendor classifications',
    category: 'Operations',
    usedBy: ['Vendors', 'Asset Management', 'Invoice Generation'],
    allowCustomValues: true,
    options: [
      { id: '1', value: 'Hardware', label: 'Hardware Supplier', order: 1, active: true },
      { id: '2', value: 'Software', label: 'Software Vendor', order: 2, active: true },
      { id: '3', value: 'Services', label: 'Service Provider', order: 3, active: true },
      { id: '4', value: 'Consulting', label: 'Consulting', order: 4, active: true },
      { id: '5', value: 'Office Supplies', label: 'Office Supplies', order: 5, active: true },
    ],
  },
  {
    id: 'location-types',
    name: 'Location Types',
    description: 'Office and facility types',
    category: 'General',
    usedBy: ['Locations', 'Employee Directory', 'Asset Management'],
    allowCustomValues: true,
    options: [
      { id: '1', value: 'headquarters', label: 'Headquarters', order: 1, active: true },
      { id: '2', value: 'branch', label: 'Branch Office', order: 2, active: true },
      { id: '3', value: 'remote', label: 'Remote', order: 3, active: true },
      { id: '4', value: 'coworking', label: 'Co-working Space', order: 4, active: true },
      { id: '5', value: 'warehouse', label: 'Warehouse', order: 5, active: true },
    ],
  },
];

export function ValueHelpsManager({ onClose }: ValueHelpsManagerProps) {
  const [valueHelps, setValueHelps] = useState<ValueHelpConfig[]>(INITIAL_VALUE_HELPS);
  const [selectedHelp, setSelectedHelp] = useState<ValueHelpConfig | null>(valueHelps[0]);
  const [editingOption, setEditingOption] = useState<ValueHelpOption | null>(null);
  const [showAddOption, setShowAddOption] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  const categories = Array.from(new Set(valueHelps.map(vh => vh.category)));

  const handleAddOption = (helpId: string, newOption: Omit<ValueHelpOption, 'id'>) => {
    setValueHelps(prev => prev.map(vh => {
      if (vh.id === helpId) {
        const option: ValueHelpOption = {
          ...newOption,
          id: `${Date.now()}`,
        };
        return {
          ...vh,
          options: [...vh.options, option].sort((a, b) => a.order - b.order),
        };
      }
      return vh;
    }));
    setShowAddOption(false);
    toast.success('Option added successfully');
  };

  const handleEditOption = (helpId: string, optionId: string, updates: Partial<ValueHelpOption>) => {
    setValueHelps(prev => prev.map(vh => {
      if (vh.id === helpId) {
        return {
          ...vh,
          options: vh.options.map(opt =>
            opt.id === optionId ? { ...opt, ...updates } : opt
          ).sort((a, b) => a.order - b.order),
        };
      }
      return vh;
    }));
    setEditingOption(null);
    toast.success('Option updated successfully');
  };

  const handleDeleteOption = (helpId: string, optionId: string) => {
    if (!confirm('Are you sure you want to delete this option?')) return;
    
    setValueHelps(prev => prev.map(vh => {
      if (vh.id === helpId) {
        return {
          ...vh,
          options: vh.options.filter(opt => opt.id !== optionId),
        };
      }
      return vh;
    }));
    toast.success('Option deleted successfully');
  };

  const handleToggleActive = (helpId: string, optionId: string) => {
    setValueHelps(prev => prev.map(vh => {
      if (vh.id === helpId) {
        return {
          ...vh,
          options: vh.options.map(opt =>
            opt.id === optionId ? { ...opt, active: !opt.active } : opt
          ),
        };
      }
      return vh;
    }));
  };

  const filteredHelps = valueHelps.filter(vh =>
    vh.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vh.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vh.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const fetchValueHelps = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${SERVER_URL}/value-helps/all`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.data && result.data.length > 0) {
          setValueHelps(result.data);
          setSelectedHelp(result.data[0]);
        } else {
          // No data in DB, use initial data and save it
          setValueHelps(INITIAL_VALUE_HELPS);
          setSelectedHelp(INITIAL_VALUE_HELPS[0]);
          await saveValueHelpsToServer(INITIAL_VALUE_HELPS);
        }
      } else {
        console.error('Failed to fetch value helps:', await response.text());
        toast.error('Failed to load value helps');
      }
    } catch (error) {
      console.error('Error fetching value helps:', error);
      toast.error('Failed to load value helps');
    } finally {
      setLoading(false);
    }
  };

  const saveValueHelpsToServer = async (data: ValueHelpConfig[]) => {
    try {
      const response = await fetch(`${SERVER_URL}/value-helps/save`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to save value helps');
      }

      return true;
    } catch (error) {
      console.error('Error saving value helps:', error);
      throw error;
    }
  };

  const saveValueHelps = async () => {
    setLoading(true);
    try {
      await saveValueHelpsToServer(valueHelps);
      toast.success('Value helps saved successfully');
    } catch (error) {
      toast.error('Failed to save value helps');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchValueHelps();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-7xl w-full h-[90vh] flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Value Helps Manager</CardTitle>
              <CardDescription>
                Configure dropdown options and selection lists used across all applications
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar - Value Help List */}
          <div className="w-80 border-r flex flex-col">
            <div className="p-4 border-b">
              <Input
                placeholder="Search value helps..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {categories.map(cat => (
                  <Badge key={cat} variant="outline" className="text-xs">
                    {cat} ({valueHelps.filter(vh => vh.category === cat).length})
                  </Badge>
                ))}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <div className="p-2 space-y-1">
                {filteredHelps.map(vh => (
                  <button
                    key={vh.id}
                    onClick={() => setSelectedHelp(vh)}
                    className={`w-full text-left p-3 rounded-lg hover:bg-gray-100 transition-colors ${
                      selectedHelp?.id === vh.id ? 'bg-blue-50 border-2 border-blue-200' : 'border border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{vh.name}</p>
                        <p className="text-xs text-gray-500 truncate">{vh.description}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">{vh.category}</Badge>
                          <span className="text-xs text-gray-400">{vh.options.length} options</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0 ml-2" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content - Options Editor */}
          {selectedHelp && (
            <div className="flex-1 flex flex-col">
              <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-purple-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-900">{selectedHelp.name}</h2>
                    <p className="text-gray-600 mt-1">{selectedHelp.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge>{selectedHelp.category}</Badge>
                      <Badge variant="outline">
                        {selectedHelp.allowCustomValues ? 'Custom Values Allowed' : 'Fixed List'}
                      </Badge>
                    </div>
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-1">Used by:</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedHelp.usedBy.map(app => (
                          <Badge key={app} variant="secondary" className="text-xs">{app}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setEditingOption({
                        id: '',
                        value: '',
                        label: '',
                        order: selectedHelp.options.length + 1,
                        active: true,
                      });
                      setShowAddOption(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Option
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-3">
                  {selectedHelp.options.map((option, index) => (
                    <Card key={option.id} className={!option.active ? 'opacity-50' : ''}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-semibold text-blue-600">
                            {option.order}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold">{option.label}</p>
                                  {!option.active && <Badge variant="secondary">Inactive</Badge>}
                                </div>
                                <p className="text-sm text-gray-600 mt-1">
                                  Value: <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{option.value}</code>
                                </p>
                                {option.description && (
                                  <p className="text-sm text-gray-500 mt-1">{option.description}</p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleToggleActive(selectedHelp.id, option.id)}
                                >
                                  {option.active ? 'Deactivate' : 'Activate'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingOption(option);
                                    setShowAddOption(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteOption(selectedHelp.id, option.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Add/Edit Option Modal */}
        {showAddOption && editingOption && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4">
            <Card className="max-w-md w-full">
              <CardHeader>
                <CardTitle>{editingOption.id ? 'Edit Option' : 'Add New Option'}</CardTitle>
                <CardDescription>Configure the dropdown option</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const data = {
                      value: formData.get('value') as string,
                      label: formData.get('label') as string,
                      description: formData.get('description') as string,
                      order: parseInt(formData.get('order') as string),
                      active: true,
                    };

                    if (editingOption.id) {
                      handleEditOption(selectedHelp!.id, editingOption.id, data);
                    } else {
                      handleAddOption(selectedHelp!.id, data);
                    }
                  }}
                  className="space-y-4"
                >
                  <div>
                    <Label>Display Label *</Label>
                    <Input
                      name="label"
                      defaultValue={editingOption.label}
                      placeholder="e.g., Technology"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">User-visible text in dropdown</p>
                  </div>

                  <div>
                    <Label>Internal Value *</Label>
                    <Input
                      name="value"
                      defaultValue={editingOption.value}
                      placeholder="e.g., Technology"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Stored value in database (usually same as label)</p>
                  </div>

                  <div>
                    <Label>Description (Optional)</Label>
                    <Input
                      name="description"
                      defaultValue={editingOption.description}
                      placeholder="Optional description or help text"
                    />
                  </div>

                  <div>
                    <Label>Display Order</Label>
                    <Input
                      name="order"
                      type="number"
                      defaultValue={editingOption.order}
                      min="1"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Position in dropdown list</p>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowAddOption(false);
                        setEditingOption(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">
                      <Save className="h-4 w-4 mr-2" />
                      {editingOption.id ? 'Update' : 'Add'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Save Button */}
        <div className="p-4 border-t">
          <Button
            size="lg"
            variant="primary"
            onClick={saveValueHelps}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </Card>
    </div>
  );
}