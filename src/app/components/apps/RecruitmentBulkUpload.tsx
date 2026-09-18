/**
 * Recruitment Bulk Upload Component
 * Allows uploading multiple candidates via Excel file
 */

import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, Download } from 'lucide-react';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import { projectId, publicAnonKey } from '../../utils/constants';

interface BulkUploadProps {
  onUploadComplete: () => void;
}

interface UploadResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  successful: string[];
  failed: Array<{ row: number; error: string; data: any }>;
}

export function RecruitmentBulkUpload({ onUploadComplete }: BulkUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Please select a valid Excel file (.xlsx or .xls)');
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      // Parse Excel file
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) {
        throw new Error('No worksheet found in Excel file');
      }

      // Extract data from worksheet
      const candidatesData: any[] = [];
      const headers: { [key: string]: number } = {};

      // Get headers from first row
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell, colNumber) => {
        const headerName = cell.value?.toString().trim();
        if (headerName) {
          headers[headerName] = colNumber;
        }
      });

      console.log('Parsed headers:', headers);

      // Validate required headers
      const requiredHeaders = ['Name', 'Email', 'Phone', 'Position', 'Department'];
      const missingHeaders = requiredHeaders.filter(h => !headers[h]);
      if (missingHeaders.length > 0) {
        throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
      }

      // Parse data rows
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row

        // Helper to safely get cell value
        const getCellValue = (header: string, defaultValue: string = ''): string => {
          if (!headers[header]) return defaultValue;
          return row.getCell(headers[header]).value?.toString() || defaultValue;
        };

        const getCellDate = (header: string): string => {
          if (!headers[header]) return '';
          const value = row.getCell(headers[header]).value;
          return formatDate(value);
        };

        const getCellNumber = (header: string, defaultValue: number = 0): number => {
          if (!headers[header]) return defaultValue;
          const val = row.getCell(headers[header]).value?.toString() || String(defaultValue);
          return parseFloat(val) || defaultValue;
        };

        const candidateData: any = {
          name: getCellValue('Name'),
          email: getCellValue('Email'),
          phone: getCellValue('Phone'),
          position: getCellValue('Position'),
          department: getCellValue('Department'),
          hiringManager: getCellValue('Hiring Manager', 'TBD'),
          source: getCellValue('Source', 'Excel Upload'),
          experience: getCellNumber('Experience', 0),
          expectedSalary: getCellValue('Expected Salary'),
          currentSalary: getCellValue('Current Salary'),
          noticePeriod: getCellValue('Notice Period'),
          notes: getCellValue('Notes'),
          appliedDate: getCellDate('Applied Date') || new Date().toISOString().split('T')[0],
        };

        console.log(`Row ${rowNumber}:`, {
          name: candidateData.name,
          email: candidateData.email,
          position: candidateData.position,
        });

        // Validate: must have required fields
        if (candidateData.name && candidateData.email && candidateData.phone && candidateData.position && candidateData.department) {
          candidatesData.push(candidateData);
        } else {
          console.warn(`Skipping row ${rowNumber}: missing required data`, {
            hasName: !!candidateData.name,
            hasEmail: !!candidateData.email,
            hasPhone: !!candidateData.phone,
            hasPosition: !!candidateData.position,
            hasDepartment: !!candidateData.department,
          });
        }
      });

      if (candidatesData.length === 0) {
        console.error('No valid candidates found. Check browser console for details.');
        throw new Error('No valid candidate data found in Excel file. Please check that your Excel file has data rows with Name, Email, Phone, Position, and Department filled in. Open browser console (F12) for detailed logs.');
      }

      console.log(`Parsed ${candidatesData.length} candidates from Excel`);

      // Send to backend
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-1fe2c468/recruitment/bulk-upload`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ candidates: candidatesData }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload candidates');
      }

      setResult(data.data);
      toast.success(`Successfully uploaded ${data.data.successCount} candidates!`);

      if (data.data.successCount > 0) {
        onUploadComplete();
      }

    } catch (error) {
      console.error('Error uploading candidates:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload candidates');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatDate = (value: any): string => {
    if (!value) return '';

    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }

    if (typeof value === 'number') {
      // Excel date serial number
      const date = new Date((value - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }

    if (typeof value === 'string') {
      // Try to parse as date
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }

    return '';
  };

  const downloadTemplate = () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Recruitment Template');

    // Define columns
    worksheet.columns = [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Position', key: 'position', width: 25 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Hiring Manager', key: 'hiringManager', width: 25 },
      { header: 'Source', key: 'source', width: 20 },
      { header: 'Experience', key: 'experience', width: 12 },
      { header: 'Expected Salary', key: 'expectedSalary', width: 18 },
      { header: 'Current Salary', key: 'currentSalary', width: 18 },
      { header: 'Notice Period', key: 'noticePeriod', width: 15 },
      { header: 'Applied Date', key: 'appliedDate', width: 15 },
      { header: 'Notes', key: 'notes', width: 40 },
    ];

    // Add sample row
    worksheet.addRow({
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+1-555-0123',
      position: 'Software Engineer',
      department: 'Engineering',
      hiringManager: 'Jane Smith',
      source: 'LinkedIn',
      experience: 5,
      expectedSalary: '$120,000',
      currentSalary: '$100,000',
      noticePeriod: '30 days',
      appliedDate: '2026-04-15',
      notes: 'Strong technical background',
    });

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Generate and download
    workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'recruitment_upload_template.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded successfully');
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Candidate Upload
          </CardTitle>
          <CardDescription>
            Upload multiple candidates at once using an Excel file
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Instructions */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">Instructions:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Download the Excel template using the button below</li>
                  <li>Fill in your candidate data following the sample format</li>
                  <li>Required fields: Name, Email, Phone, Position, Department</li>
                  <li>Optional fields: Hiring Manager, Source, Experience, Expected Salary, Current Salary, Notice Period, Applied Date, Notes</li>
                  <li>Upload the completed Excel file</li>
                </ol>
              </div>
            </AlertDescription>
          </Alert>

          {/* Download Template Button */}
          <div className="flex gap-4">
            <Button onClick={downloadTemplate} variant="outline" className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Download Excel Template
            </Button>
          </div>

          {/* File Upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
              disabled={uploading}
            />
            <label
              htmlFor="file-upload"
              className={`cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-semibold mb-2">
                {uploading ? 'Uploading...' : 'Choose Excel File'}
              </p>
              <p className="text-sm text-gray-600">
                Click to browse or drag and drop your Excel file here
              </p>
            </label>
          </div>

          {/* Upload Results */}
          {result && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Total Processed</p>
                        <p className="text-2xl font-bold">{result.totalProcessed}</p>
                      </div>
                      <FileSpreadsheet className="h-8 w-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Successful</p>
                        <p className="text-2xl font-bold text-green-600">{result.successCount}</p>
                      </div>
                      <CheckCircle className="h-8 w-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Failed</p>
                        <p className="text-2xl font-bold text-red-600">{result.failureCount}</p>
                      </div>
                      <XCircle className="h-8 w-8 text-red-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Successful Uploads */}
              {result.successful.length > 0 && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    <p className="font-semibold text-green-900 mb-2">Successfully uploaded candidates:</p>
                    <div className="flex flex-wrap gap-2">
                      {result.successful.map((name) => (
                        <span key={name} className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                          {name}
                        </span>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Failed Uploads */}
              {result.failed.length > 0 && (
                <Alert className="bg-red-50 border-red-200">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription>
                    <p className="font-semibold text-red-900 mb-2">Failed to upload:</p>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {result.failed.map((failure, index) => (
                        <div key={index} className="bg-white p-2 rounded text-sm">
                          <p className="font-semibold text-red-800">Row {failure.row}: {failure.error}</p>
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
