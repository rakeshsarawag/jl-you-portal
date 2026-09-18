import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Progress } from '../ui/progress';
import {
  Download,
  Upload,
  FileText,
  FileJson,
  File,
  CheckCircle,
  AlertCircle,
  X,
  Filter,
  Calendar,
  Database,
  Archive,
  Loader2,
  FolderDown,
  FolderUp,
  Shield,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

interface ExportImportToolsProps {
  onClose: () => void;
}

type ExportFormat = 'json' | 'csv' | 'pdf' | 'html';
type ExportScope = 'all' | 'posts' | 'announcements' | 'comments' | 'analytics';

export function ExportImportTools({ onClose }: ExportImportToolsProps) {
  const [mode, setMode] = useState<'export' | 'import'>('export');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [exportScope, setExportScope] = useState<ExportScope>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [importProgress, setImportProgress] = useState(0);

  const formatOptions = [
    {
      value: 'json' as const,
      label: 'JSON',
      description: 'Best for data backup and migration',
      icon: FileJson,
      size: '~2.5 MB',
    },
    {
      value: 'csv' as const,
      label: 'CSV',
      description: 'Compatible with Excel and spreadsheets',
      icon: FileText,
      size: '~1.8 MB',
    },
    {
      value: 'pdf' as const,
      label: 'PDF',
      description: 'Professional formatted reports',
      icon: File,
      size: '~4.2 MB',
    },
    {
      value: 'html' as const,
      label: 'HTML',
      description: 'Web-ready archive',
      icon: FileText,
      size: '~3.1 MB',
    },
  ];

  const scopeOptions = [
    {
      value: 'all' as const,
      label: 'Everything',
      description: 'All posts, comments, and data',
      count: 1247,
    },
    {
      value: 'posts' as const,
      label: 'Posts Only',
      description: 'Just your posts',
      count: 847,
    },
    {
      value: 'announcements' as const,
      label: 'Announcements',
      description: 'Official announcements',
      count: 234,
    },
    {
      value: 'comments' as const,
      label: 'Comments',
      description: 'All comments',
      count: 1562,
    },
    {
      value: 'analytics' as const,
      label: 'Analytics',
      description: 'Engagement data',
      count: 0,
    },
  ];

  const handleExport = async () => {
    setExporting(true);
    setExportProgress(0);

    // Simulate export process
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      setExportProgress((i / steps) * 100);
    }

    // Simulate file download
    const filename = `jeshan-labs-${exportScope}-${Date.now()}.${exportFormat}`;
    console.log('Exporting:', { format: exportFormat, scope: exportScope, dateRange, filename });

    toast.success(`Exported successfully! File: ${filename}`);
    setExporting(false);
    setExportProgress(0);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportProgress(0);

    // Simulate import process
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, 400));
      setImportProgress((i / steps) * 100);
    }

    console.log('Importing file:', file.name);
    toast.success(`Imported ${file.name} successfully!`);
    setImporting(false);
    setImportProgress(0);
  };

  const estimatedSize = formatOptions.find(f => f.value === exportFormat)?.size || '~2 MB';
  const estimatedItems = scopeOptions.find(s => s.value === exportScope)?.count || 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${
                mode === 'export'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600'
                  : 'bg-gradient-to-r from-green-600 to-emerald-600'
              }`}>
                {mode === 'export' ? (
                  <Download className="h-5 w-5 text-white" />
                ) : (
                  <Upload className="h-5 w-5 text-white" />
                )}
              </div>
              <div>
                <CardTitle>Export & Import Data</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Backup, migrate, or restore your content
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Mode Toggle */}
          <div className="flex gap-3 mb-6">
            <Button
              variant={mode === 'export' ? 'default' : 'outline'}
              onClick={() => setMode('export')}
              className={`flex-1 ${
                mode === 'export' ? 'bg-gradient-to-r from-blue-600 to-purple-600' : ''
              }`}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
            <Button
              variant={mode === 'import' ? 'default' : 'outline'}
              onClick={() => setMode('import')}
              className={`flex-1 ${
                mode === 'import' ? 'bg-gradient-to-r from-green-600 to-emerald-600' : ''
              }`}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import Data
            </Button>
          </div>

          {/* Export Section */}
          {mode === 'export' && (
            <div className="space-y-6">
              {/* GDPR Notice */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">Data Portability Rights</h4>
                    <p className="text-sm text-blue-800">
                      You have the right to export your data at any time. All exports are encrypted
                      and comply with GDPR regulations.
                    </p>
                  </div>
                </div>
              </div>

              {/* Format Selection */}
              <div>
                <Label className="text-base font-semibold mb-3 block">Export Format</Label>
                <div className="grid grid-cols-2 gap-3">
                  {formatOptions.map((format) => (
                    <Card
                      key={format.value}
                      className={`cursor-pointer transition-all ${
                        exportFormat === format.value
                          ? 'border-2 border-blue-500 bg-blue-50'
                          : 'hover:border-gray-400'
                      }`}
                      onClick={() => setExportFormat(format.value)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${
                            exportFormat === format.value
                              ? 'bg-blue-200'
                              : 'bg-gray-100'
                          }`}>
                            <format.icon className={`h-5 w-5 ${
                              exportFormat === format.value
                                ? 'text-blue-700'
                                : 'text-gray-600'
                            }`} />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold mb-1">{format.label}</h4>
                            <p className="text-xs text-gray-600 mb-2">{format.description}</p>
                            <Badge variant="outline" className="text-xs">
                              {format.size}
                            </Badge>
                          </div>
                          {exportFormat === format.value && (
                            <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Scope Selection */}
              <div>
                <Label className="text-base font-semibold mb-3 block">What to Export</Label>
                <div className="space-y-2">
                  {scopeOptions.map((scope) => (
                    <Card
                      key={scope.value}
                      className={`cursor-pointer transition-all ${
                        exportScope === scope.value
                          ? 'border-2 border-blue-500 bg-blue-50'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setExportScope(scope.value)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              exportScope === scope.value
                                ? 'border-blue-600 bg-blue-600'
                                : 'border-gray-300'
                            }`}>
                              {exportScope === scope.value && (
                                <div className="w-2 h-2 bg-white rounded-full" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-semibold">{scope.label}</h4>
                              <p className="text-sm text-gray-600">{scope.description}</p>
                            </div>
                          </div>
                          <Badge variant="outline">
                            {scope.count > 0 ? `${scope.count} items` : 'Data'}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Date Range Filter */}
              <div>
                <Label className="text-base font-semibold mb-3 block">
                  Date Range (Optional)
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm mb-2">From</Label>
                    <input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <Label className="text-sm mb-2">To</Label>
                    <input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Export Summary */}
              <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200">
                <CardContent className="p-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Info className="h-5 w-5 text-blue-600" />
                    Export Summary
                  </h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Format</p>
                      <p className="font-semibold">{exportFormat.toUpperCase()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Estimated Size</p>
                      <p className="font-semibold">{estimatedSize}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Items</p>
                      <p className="font-semibold">{estimatedItems}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Export Progress */}
              {exporting && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Exporting data...</span>
                    <span className="text-sm text-gray-600">{Math.round(exportProgress)}%</span>
                  </div>
                  <Progress value={exportProgress} className="h-2" />
                </div>
              )}

              {/* Export Button */}
              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleExport}
                  disabled={exporting}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  {exporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Export Data
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Import Section */}
          {mode === 'import' && (
            <div className="space-y-6">
              {/* Warning Notice */}
              <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-orange-900 mb-1">Important Notice</h4>
                    <p className="text-sm text-orange-800">
                      Importing data will merge with existing content. Duplicate content may be created.
                      Consider backing up your current data before importing.
                    </p>
                  </div>
                </div>
              </div>

              {/* Supported Formats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Supported File Formats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <FileJson className="h-8 w-8 text-blue-600" />
                      <div>
                        <p className="font-semibold">JSON</p>
                        <p className="text-xs text-gray-600">Recommended</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <FileText className="h-8 w-8 text-green-600" />
                      <div>
                        <p className="font-semibold">CSV</p>
                        <p className="text-xs text-gray-600">Limited support</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* File Upload */}
              <div>
                <Label className="text-base font-semibold mb-3 block">Select File to Import</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    onChange={handleImport}
                    accept=".json,.csv"
                    className="hidden"
                    id="import-file"
                    disabled={importing}
                  />
                  <label htmlFor="import-file" className="cursor-pointer">
                    <FolderUp className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-lg font-semibold mb-1">
                      Click to select file or drag and drop
                    </p>
                    <p className="text-sm text-gray-600">
                      Supports JSON and CSV files up to 50MB
                    </p>
                  </label>
                </div>
              </div>

              {/* Import Progress */}
              {importing && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Importing data...</span>
                    <span className="text-sm text-gray-600">{Math.round(importProgress)}%</span>
                  </div>
                  <Progress value={importProgress} className="h-2" />
                  <p className="text-xs text-gray-600">
                    This may take a few moments. Please don't close this window.
                  </p>
                </div>
              )}

              {/* Import Options */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Import Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" defaultChecked className="w-4 h-4" />
                    <Label>Skip duplicate entries</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" className="w-4 h-4" />
                    <Label>Validate data before import</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" defaultChecked className="w-4 h-4" />
                    <Label>Create backup before import</Label>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export default ExportImportTools;
