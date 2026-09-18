import { useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import {
  FileText,
  Plus,
  X,
  Download,
  Eye,
  Calendar,
  Filter,
  Settings,
  Database,
  Save,
  Play
} from 'lucide-react';
import { toast } from 'sonner';
import { ExportService } from '../../services/exportService';

interface ReportBuilderProps {
  onClose: () => void;
}

interface ReportConfig {
  name: string;
  description: string;
  dataSource: string;
  fields: string[];
  filters: Array<{ field: string; operator: string; value: string }>;
  groupBy: string[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

const DATA_SOURCES = [
  { id: 'employees', name: 'Employees', fields: ['name', 'email', 'department', 'position', 'salary', 'hireDate', 'status'] },
  { id: 'projects', name: 'Projects', fields: ['name', 'status', 'budget', 'spent', 'startDate', 'endDate', 'manager', 'progress'] },
  { id: 'invoices', name: 'Invoices', fields: ['invoiceNumber', 'client', 'amount', 'status', 'dueDate', 'paidDate', 'items'] },
  { id: 'recruitment', name: 'Recruitment', fields: ['position', 'candidate', 'stage', 'appliedDate', 'status', 'recruiter'] },
  { id: 'performance', name: 'Performance Reviews', fields: ['employeeName', 'reviewer', 'rating', 'period', 'status', 'comments'] },
  { id: 'training', name: 'Training', fields: ['courseName', 'employee', 'status', 'completionDate', 'score', 'category'] },
  { id: 'assets', name: 'Assets', fields: ['assetName', 'category', 'assignedTo', 'purchaseDate', 'value', 'status'] },
  { id: 'okrs', name: 'OKRs', fields: ['title', 'owner', 'progress', 'dueDate', 'status', 'keyResults'] },
];

const OPERATORS = [
  { id: 'equals', label: 'Equals' },
  { id: 'notEquals', label: 'Not Equals' },
  { id: 'contains', label: 'Contains' },
  { id: 'greaterThan', label: 'Greater Than' },
  { id: 'lessThan', label: 'Less Than' },
  { id: 'between', label: 'Between' },
];

export function ReportBuilder({ onClose }: ReportBuilderProps) {
  const [config, setConfig] = useState<ReportConfig>({
    name: '',
    description: '',
    dataSource: '',
    fields: [],
    filters: [],
    groupBy: [],
    sortBy: '',
    sortOrder: 'asc'
  });

  const [previewData, setPreviewData] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const selectedDataSource = DATA_SOURCES.find(ds => ds.id === config.dataSource);

  const handleAddField = (field: string) => {
    if (!config.fields.includes(field)) {
      setConfig({ ...config, fields: [...config.fields, field] });
    }
  };

  const handleRemoveField = (field: string) => {
    setConfig({ ...config, fields: config.fields.filter(f => f !== field) });
  };

  const handleAddFilter = () => {
    setConfig({
      ...config,
      filters: [...config.filters, { field: '', operator: 'equals', value: '' }]
    });
  };

  const handleRemoveFilter = (index: number) => {
    setConfig({
      ...config,
      filters: config.filters.filter((_, i) => i !== index)
    });
  };

  const handleUpdateFilter = (index: number, key: string, value: string) => {
    const newFilters = [...config.filters];
    newFilters[index] = { ...newFilters[index], [key]: value };
    setConfig({ ...config, filters: newFilters });
  };

  const TABLE_MAP: Record<string, string> = {
    employees: 'employees',
    projects: 'projects',
    invoices: 'invoices',
    recruitment: 'recruitment_candidates',
    performance: 'performance_reviews',
    training: 'training_enrollments',
    assets: 'assets',
    okrs: 'okrs',
  };

  const handlePreview = useCallback(async () => {
    if (!config.dataSource || config.fields.length === 0) {
      toast.error('Please select a data source and at least one field');
      return;
    }
    const table = TABLE_MAP[config.dataSource];
    if (!table) return;
    setPreviewLoading(true);
    try {
      let query = supabase.from(table as any).select('*').limit(20);
      // Apply simple equality filters
      for (const f of config.filters) {
        if (f.field && f.value && f.operator === 'equals') {
          query = query.eq(f.field, f.value) as typeof query;
        } else if (f.field && f.value && f.operator === 'contains') {
          query = query.ilike(f.field, `%${f.value}%`) as typeof query;
        }
      }
      if (config.sortBy) {
        query = query.order(config.sortBy, { ascending: config.sortOrder === 'asc' }) as typeof query;
      }
      const { data, error } = await query;
      if (error) throw error;
      // Project only selected fields
      const projected = (data ?? []).map((row: any) => {
        const out: any = {};
        config.fields.forEach(f => { if (f in row) out[f] = row[f]; });
        return out;
      });
      setPreviewData(projected);
      setShowPreview(true);
      toast.success(`Loaded ${projected.length} rows from ${config.dataSource}`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to load preview data');
    } finally {
      setPreviewLoading(false);
    }
  }, [config]);

  const handleExport = async (format: 'pdf' | 'excel' | 'csv') => {
    if (previewData.length === 0) {
      toast.error('Please generate a preview first');
      return;
    }

    const reportName = config.name || `${selectedDataSource?.name} Report`;

    try {
      if (format === 'pdf') {
        await ExportService.exportToPDF(
          previewData,
          config.fields,
          reportName,
          config.description
        );
        toast.success('Report exported to PDF');
      } else if (format === 'excel') {
        await ExportService.exportToExcel(
          previewData,
          config.fields,
          reportName,
          config.description
        );
        toast.success('Report exported to Excel');
      } else if (format === 'csv') {
        ExportService.exportToCSV(
          previewData,
          config.fields,
          reportName
        );
        toast.success('Report exported to CSV');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report');
    }
  };

  const handleSaveTemplate = () => {
    if (!config.name) {
      toast.error('Please enter a report name');
      return;
    }

    // Save to localStorage for now
    const templates = JSON.parse(localStorage.getItem('report_templates') || '[]');
    templates.push({
      ...config,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    });
    localStorage.setItem('report_templates', JSON.stringify(templates));
    toast.success('Report template saved');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-6 w-6" />
                Advanced Report Builder
              </CardTitle>
              <CardDescription>Create custom reports with filters and grouping</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Report Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Report Name *</Label>
              <Input
                placeholder="e.g., Monthly Employee Report"
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                placeholder="Brief description of the report"
                value={config.description}
                onChange={(e) => setConfig({ ...config, description: e.target.value })}
              />
            </div>
          </div>

          <Separator />

          {/* Data Source Selection */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Database className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold">Data Source</h3>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {DATA_SOURCES.map(source => (
                <Button
                  key={source.id}
                  variant={config.dataSource === source.id ? 'default' : 'outline'}
                  className="h-auto py-3"
                  onClick={() => setConfig({ ...config, dataSource: source.id, fields: [] })}
                >
                  {source.name}
                </Button>
              ))}
            </div>
          </div>

          {config.dataSource && (
            <>
              <Separator />

              {/* Field Selection */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-green-500" />
                    <h3 className="font-semibold">Select Fields</h3>
                  </div>
                  <Badge>{config.fields.length} selected</Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Available Fields */}
                  <div>
                    <Label className="text-sm mb-2 block">Available Fields</Label>
                    <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                      {selectedDataSource?.fields
                        .filter(field => !config.fields.includes(field))
                        .map(field => (
                          <Button
                            key={field}
                            variant="ghost"
                            size="sm"
                            className="w-full justify-between"
                            onClick={() => handleAddField(field)}
                          >
                            <span>{field}</span>
                            <Plus className="h-4 w-4" />
                          </Button>
                        ))}
                    </div>
                  </div>

                  {/* Selected Fields */}
                  <div>
                    <Label className="text-sm mb-2 block">Selected Fields</Label>
                    <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                      {config.fields.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">
                          No fields selected
                        </p>
                      ) : (
                        config.fields.map((field, index) => (
                          <div key={field} className="flex items-center justify-between p-2 bg-blue-50 rounded">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{index + 1}</Badge>
                              <span className="text-sm font-medium">{field}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveField(field)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Filters */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Filter className="h-5 w-5 text-purple-500" />
                    <h3 className="font-semibold">Filters (Optional)</h3>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleAddFilter}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Filter
                  </Button>
                </div>

                {config.filters.length === 0 ? (
                  <div className="border rounded-lg p-6 text-center text-gray-500">
                    <p className="text-sm">No filters added. Click "Add Filter" to create one.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {config.filters.map((filter, index) => (
                      <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                        <select
                          className="flex-1 border rounded px-2 py-1 text-sm"
                          value={filter.field}
                          onChange={(e) => handleUpdateFilter(index, 'field', e.target.value)}
                        >
                          <option value="">Select Field</option>
                          {config.fields.map(field => (
                            <option key={field} value={field}>{field}</option>
                          ))}
                        </select>

                        <select
                          className="flex-1 border rounded px-2 py-1 text-sm"
                          value={filter.operator}
                          onChange={(e) => handleUpdateFilter(index, 'operator', e.target.value)}
                        >
                          {OPERATORS.map(op => (
                            <option key={op.id} value={op.id}>{op.label}</option>
                          ))}
                        </select>

                        <Input
                          className="flex-1"
                          placeholder="Value"
                          value={filter.value}
                          onChange={(e) => handleUpdateFilter(index, 'value', e.target.value)}
                        />

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFilter(index)}
                        >
                          <X className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Sorting */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Sort By</Label>
                  <select
                    className="w-full border rounded-lg px-3 py-2"
                    value={config.sortBy}
                    onChange={(e) => setConfig({ ...config, sortBy: e.target.value })}
                  >
                    <option value="">None</option>
                    {config.fields.map(field => (
                      <option key={field} value={field}>{field}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Sort Order</Label>
                  <select
                    className="w-full border rounded-lg px-3 py-2"
                    value={config.sortOrder}
                    onChange={(e) => setConfig({ ...config, sortOrder: e.target.value as 'asc' | 'desc' })}
                  >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button onClick={handlePreview} className="flex-1" disabled={previewLoading}>
              <Eye className="h-4 w-4 mr-2" />
              {previewLoading ? 'Loading...' : 'Preview Report'}
            </Button>
            <Button onClick={handleSaveTemplate} variant="outline">
              <Save className="h-4 w-4 mr-2" />
              Save Template
            </Button>
          </div>

          {/* Export Buttons */}
          {showPreview && (
            <div className="flex gap-2">
              <Button onClick={() => handleExport('pdf')} variant="outline" className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
              <Button onClick={() => handleExport('excel')} variant="outline" className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
              <Button onClick={() => handleExport('csv')} variant="outline" className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          )}

          {/* Preview Table */}
          {showPreview && previewData.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Report Preview (Sample Data)</h3>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        {config.fields.map(field => (
                          <th key={field} className="px-4 py-2 text-left font-semibold">
                            {field}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, index) => (
                        <tr key={index} className="border-t hover:bg-gray-50">
                          {config.fields.map(field => (
                            <td key={field} className="px-4 py-2">
                              {typeof row[field] === 'number' 
                                ? row[field].toLocaleString() 
                                : row[field]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
