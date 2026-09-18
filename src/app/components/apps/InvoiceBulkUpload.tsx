/**
 * Invoice Bulk Upload Component
 * Allows uploading multiple invoices via Excel file
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

export function InvoiceBulkUpload({ onUploadComplete }: BulkUploadProps) {
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
      const invoicesData: any[] = [];
      const headers: { [key: string]: number } = {};

      // Get headers from first row
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell, colNumber) => {
        const headerName = cell.value?.toString().trim();
        if (headerName) {
          headers[headerName] = colNumber;
        }
      });

      // Validate required headers
      const requiredHeaders = ['Invoice Number', 'Invoice Date', 'Currency', 'Subtotal', 'Total'];
      const missingHeaders = requiredHeaders.filter(h => !headers[h]);
      if (missingHeaders.length > 0) {
        throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
      }

      // Check for at least one billing identifier column
      if (!headers['Bill To Name'] && !headers['Bill To ID']) {
        throw new Error('Missing required column: Either "Bill To Name" or "Bill To ID" must be present');
      }

      console.log('Parsed headers:', headers);

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
          return formatDate(row.getCell(headers[header]).value);
        };

        const getCellNumber = (header: string, defaultValue: number = 0): number => {
          if (!headers[header]) return defaultValue;
          return parseFloat(row.getCell(headers[header]).value?.toString() || String(defaultValue));
        };

        const invoiceData: any = {
          invoiceNumber: getCellValue('Invoice Number'),
          invoiceDate: getCellDate('Invoice Date'),
          invoicePeriodFrom: getCellDate('Period From'),
          invoicePeriodTo: getCellDate('Period To'),
          poNumber: getCellValue('PO Number'),
          currency: getCellValue('Currency', 'INR'),
          currencySymbol: getCellValue('Currency Symbol', '₹'),
          billToId: getCellValue('Bill To ID'),
          billToName: getCellValue('Bill To Name'),
          billToAddress: getCellValue('Bill To Address'),
          billToGstin: getCellValue('Bill To GSTIN'),
          registrationId: getCellValue('Registration ID'),
          registrationDetails: getCellValue('Registration Details'),
          remittanceId: getCellValue('Remittance ID'),
          remittanceDetails: getCellValue('Remittance Details'),
          terms: getCellValue('Payment Terms', 'Net 30'),
          dueDate: getCellDate('Due Date'),
          subtotal: getCellNumber('Subtotal'),
          total: getCellNumber('Total'),
          totalInWords: getCellValue('Total In Words'),
          status: getCellValue('Status', 'Draft'),
          amountReceived: getCellNumber('Amount Received'),
          professionalTaxDeducted: getCellNumber('Professional Tax Deducted'),
          paymentDate: getCellDate('Payment Date'),
          notes: getCellValue('Notes'),
          lineItems: parseLineItems(getCellValue('Line Items')),
        };

        // Auto-generate totalInWords if not provided
        if (!invoiceData.totalInWords && invoiceData.total > 0) {
          invoiceData.totalInWords = convertNumberToWords(invoiceData.total, invoiceData.currency);
        }

        console.log(`Row ${rowNumber}:`, {
          invoiceDate: invoiceData.invoiceDate,
          invoiceNumber: invoiceData.invoiceNumber,
          billToId: invoiceData.billToId,
          billToName: invoiceData.billToName,
          currency: invoiceData.currency,
          subtotal: invoiceData.subtotal,
          total: invoiceData.total,
        });

        // Validate: must have invoiceDate and either billToName or billToId
        const hasRequiredBillTo = invoiceData.billToName || invoiceData.billToId;
        if (invoiceData.invoiceDate && hasRequiredBillTo) {
          invoicesData.push(invoiceData);
        } else {
          console.warn(`Skipping row ${rowNumber}: missing required data`, {
            hasDate: !!invoiceData.invoiceDate,
            hasBillToName: !!invoiceData.billToName,
            hasBillToId: !!invoiceData.billToId,
          });
        }
      });

      if (invoicesData.length === 0) {
        console.error('No valid invoices found. Check browser console for details.');
        throw new Error('No valid invoice data found in Excel file. Please check that your Excel file has data rows with Invoice Date and either Bill To Name or Bill To ID filled in. Open browser console (F12) for detailed logs.');
      }

      console.log(`Parsed ${invoicesData.length} invoices from Excel`);

      // Send to backend
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-1fe2c468/invoices/bulk-upload`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ invoices: invoicesData }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload invoices');
      }

      setResult(data.data);
      toast.success(`Successfully uploaded ${data.data.successCount} invoices!`);

      if (data.data.successCount > 0) {
        onUploadComplete();
      }

    } catch (error) {
      console.error('Error uploading invoices:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload invoices');
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

  const parseLineItems = (lineItemsStr: string): any[] => {
    if (!lineItemsStr) return [];

    try {
      // Expected format: "Description1|HSN1|Qty1|Rate1;Description2|HSN2|Qty2|Rate2"
      const items = lineItemsStr.split(';').map((item, index) => {
        const [description, hsnSac, quantity, rate] = item.split('|').map(s => s.trim());
        const qty = parseFloat(quantity || '1');
        const rateVal = parseFloat(rate || '0');
        return {
          id: `item_${Date.now()}_${index}`,
          description: description || '',
          hsnSac: hsnSac || '',
          quantity: qty,
          rate: rateVal,
          amount: qty * rateVal,
        };
      });
      return items;
    } catch (error) {
      console.error('Error parsing line items:', error);
      return [];
    }
  };

  const convertNumberToWords = (amount: number, currency: string): string => {
    if (!amount || amount === 0) return 'Zero';

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

    const convertLessThanThousand = (num: number): string => {
      if (num === 0) return '';
      if (num < 10) return ones[num];
      if (num < 20) return teens[num - 10];
      if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + ones[num % 10] : '');
      return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 !== 0 ? ' ' + convertLessThanThousand(num % 100) : '');
    };

    const convertIndianNumbering = (num: number): string => {
      if (num === 0) return 'Zero';

      const crore = Math.floor(num / 10000000);
      const lakh = Math.floor((num % 10000000) / 100000);
      const thousand = Math.floor((num % 100000) / 1000);
      const hundred = Math.floor((num % 1000) / 100);
      const remainder = num % 100;

      let result = '';
      if (crore > 0) result += convertLessThanThousand(crore) + ' Crore ';
      if (lakh > 0) result += convertLessThanThousand(lakh) + ' Lakh ';
      if (thousand > 0) result += convertLessThanThousand(thousand) + ' Thousand ';
      if (hundred > 0) result += ones[hundred] + ' Hundred ';
      if (remainder > 0) result += convertLessThanThousand(remainder);

      return result.trim();
    };

    const convertInternationalNumbering = (num: number): string => {
      if (num === 0) return 'Zero';

      const billion = Math.floor(num / 1000000000);
      const million = Math.floor((num % 1000000000) / 1000000);
      const thousand = Math.floor((num % 1000000) / 1000);
      const remainder = num % 1000;

      let result = '';
      if (billion > 0) result += convertLessThanThousand(billion) + ' Billion ';
      if (million > 0) result += convertLessThanThousand(million) + ' Million ';
      if (thousand > 0) result += convertLessThanThousand(thousand) + ' Thousand ';
      if (remainder > 0) result += convertLessThanThousand(remainder);

      return result.trim();
    };

    const integerPart = Math.floor(amount);
    const decimalPart = Math.round((amount - integerPart) * 100);

    let words = '';
    if (currency === 'INR') {
      words = convertIndianNumbering(integerPart);
      if (decimalPart > 0) {
        words += ' and ' + convertLessThanThousand(decimalPart) + ' Paise';
      }
      words += ' Rupees Only';
    } else {
      words = convertInternationalNumbering(integerPart);
      if (decimalPart > 0) {
        words += ' and ' + convertLessThanThousand(decimalPart) + ' Cents';
      }
      const currencyName = currency === 'USD' ? 'Dollars' : currency === 'EUR' ? 'Euros' : currency === 'GBP' ? 'Pounds' : currency;
      words += ' ' + currencyName + ' Only';
    }

    return words;
  };

  const downloadTemplate = () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Invoice Template');

    // Define columns
    worksheet.columns = [
      { header: 'Invoice Number', key: 'invoiceNumber', width: 15 },
      { header: 'Invoice Date', key: 'invoiceDate', width: 15 },
      { header: 'Period From', key: 'periodFrom', width: 15 },
      { header: 'Period To', key: 'periodTo', width: 15 },
      { header: 'PO Number', key: 'poNumber', width: 15 },
      { header: 'Currency', key: 'currency', width: 12 },
      { header: 'Currency Symbol', key: 'currencySymbol', width: 12 },
      { header: 'Bill To ID', key: 'billToId', width: 15 },
      { header: 'Bill To Name', key: 'billToName', width: 25 },
      { header: 'Bill To Address', key: 'billToAddress', width: 35 },
      { header: 'Bill To GSTIN', key: 'billToGstin', width: 18 },
      { header: 'Registration ID', key: 'registrationId', width: 18 },
      { header: 'Registration Details', key: 'registrationDetails', width: 35 },
      { header: 'Remittance ID', key: 'remittanceId', width: 18 },
      { header: 'Remittance Details', key: 'remittanceDetails', width: 35 },
      { header: 'Payment Terms', key: 'terms', width: 15 },
      { header: 'Due Date', key: 'dueDate', width: 15 },
      { header: 'Subtotal', key: 'subtotal', width: 15 },
      { header: 'Total', key: 'total', width: 15 },
      { header: 'Total In Words', key: 'totalInWords', width: 40 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Amount Received', key: 'amountReceived', width: 18 },
      { header: 'Professional Tax Deducted', key: 'professionalTaxDeducted', width: 20 },
      { header: 'Payment Date', key: 'paymentDate', width: 15 },
      { header: 'Notes', key: 'notes', width: 30 },
      { header: 'Line Items', key: 'lineItems', width: 50 },
    ];

    // Add sample row
    worksheet.addRow({
      invoiceNumber: 'JSN001',
      invoiceDate: '2026-04-01',
      periodFrom: '2026-04-01',
      periodTo: '2026-04-30',
      poNumber: 'PO-2026-001',
      currency: 'INR',
      currencySymbol: '₹',
      billToId: '',
      billToName: 'ABC Corporation',
      billToAddress: '123 Business Park, Mumbai, Maharashtra 400001',
      billToGstin: '27AABCU9603R1ZM',
      registrationId: '',
      registrationDetails: '',
      remittanceId: '',
      remittanceDetails: '',
      terms: 'Net 30',
      dueDate: '2026-05-01',
      subtotal: '100000',
      total: '118000',
      totalInWords: 'One Lakh Eighteen Thousand Rupees Only',
      status: 'Draft',
      amountReceived: '0',
      professionalTaxDeducted: '0',
      paymentDate: '',
      notes: 'Please pay within due date',
      lineItems: 'Software Development|998314|1|100000',
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
      a.download = 'invoice_upload_template.xlsx';
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
            Bulk Invoice Upload
          </CardTitle>
          <CardDescription>
            Upload multiple invoices at once using an Excel file
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
                  <li>Fill in your invoice data following the sample format</li>
                  <li>Required fields: Invoice Number, Invoice Date, Currency, Subtotal, Total, and either Bill To Name or Bill To ID</li>
                  <li>Optional: Total In Words will be auto-generated if not provided</li>
                  <li>For Line Items, use format: "Description|HSN|Qty|Rate" separated by semicolons for multiple items</li>
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
                    <p className="font-semibold text-green-900 mb-2">Successfully uploaded invoices:</p>
                    <div className="flex flex-wrap gap-2">
                      {result.successful.map((invNum) => (
                        <span key={invNum} className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                          {invNum}
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
