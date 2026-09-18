import { toast } from 'sonner';

export type ExportFormat = 'csv' | 'excel' | 'pdf' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  filename: string;
  data: any[];
  columns?: {
    field: string;
    label: string;
    format?: (value: any) => string;
  }[];
  title?: string;
  subtitle?: string;
  includeTimestamp?: boolean;
  metadata?: Record<string, any>;
}

export class DataExportService {
  /**
   * Export data to specified format
   */
  static async exportData(options: ExportOptions): Promise<void> {
    const { format, filename, data } = options;

    try {
      switch (format) {
        case 'csv':
          this.exportToCSV(options);
          break;
        case 'excel':
          this.exportToExcel(options);
          break;
        case 'pdf':
          this.exportToPDF(options);
          break;
        case 'json':
          this.exportToJSON(options);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      toast.success(`Exported ${data.length} records as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
      throw error;
    }
  }

  /**
   * Export to CSV format
   */
  private static exportToCSV(options: ExportOptions): void {
    const { filename, data, columns } = options;

    if (data.length === 0) {
      toast.warning('No data to export');
      return;
    }

    // Determine columns
    const exportColumns = columns || this.inferColumns(data[0]);

    // Create CSV header
    const headers = exportColumns.map(col => col.label).join(',');

    // Create CSV rows
    const rows = data.map(row => {
      return exportColumns.map(col => {
        const value = row[col.field];
        const formatted = col.format ? col.format(value) : value;
        // Escape commas and quotes
        const escaped = String(formatted).replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(',');
    });

    // Combine header and rows
    const csv = [headers, ...rows].join('\n');

    // Download
    this.downloadFile(csv, `${filename}.csv`, 'text/csv');
  }

  /**
   * Export to Excel format (CSV with .xlsx extension for simplicity)
   */
  private static exportToExcel(options: ExportOptions): void {
    const { filename, data, columns, title } = options;

    if (data.length === 0) {
      toast.warning('No data to export');
      return;
    }

    const exportColumns = columns || this.inferColumns(data[0]);

    // Create Excel-compatible CSV with BOM for UTF-8
    const BOM = '\ufeff';
    
    let content = BOM;

    // Add title if provided
    if (title) {
      content += `${title}\n\n`;
    }

    // Add headers
    const headers = exportColumns.map(col => col.label).join('\t');
    content += headers + '\n';

    // Add data rows
    const rows = data.map(row => {
      return exportColumns.map(col => {
        const value = row[col.field];
        return col.format ? col.format(value) : value;
      }).join('\t');
    });

    content += rows.join('\n');

    // Download as Excel file
    this.downloadFile(content, `${filename}.xls`, 'application/vnd.ms-excel');
  }

  /**
   * Export to PDF format (text-based for simplicity)
   */
  private static exportToPDF(options: ExportOptions): void {
    const { filename, data, columns, title, subtitle, metadata } = options;

    if (data.length === 0) {
      toast.warning('No data to export');
      return;
    }

    const exportColumns = columns || this.inferColumns(data[0]);

    // Create simple text-based PDF content
    let content = '';

    // Add metadata
    content += `%PDF-1.4\n`;
    content += `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
    content += `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`;
    content += `3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources 4 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n`;
    content += `4 0 obj\n<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >>\nendobj\n`;
    
    // Build content stream
    let streamContent = 'BT\n';
    streamContent += '/F1 16 Tf\n';
    streamContent += '50 750 Td\n';
    
    if (title) {
      streamContent += `(${this.escapePDFString(title)}) Tj\n`;
      streamContent += '0 -20 Td\n';
    }

    if (subtitle) {
      streamContent += '/F1 12 Tf\n';
      streamContent += `(${this.escapePDFString(subtitle)}) Tj\n`;
      streamContent += '0 -30 Td\n';
    }

    // Add table header
    streamContent += '/F1 10 Tf\n';
    streamContent += `(${exportColumns.map(c => c.label).join(' | ')}) Tj\n`;
    streamContent += '0 -15 Td\n';

    // Add data rows (limit to prevent PDF overflow)
    const maxRows = Math.min(data.length, 30);
    for (let i = 0; i < maxRows; i++) {
      const row = data[i];
      const rowText = exportColumns.map(col => {
        const value = row[col.field];
        return col.format ? col.format(value) : String(value);
      }).join(' | ');
      
      streamContent += `(${this.escapePDFString(rowText)}) Tj\n`;
      streamContent += '0 -12 Td\n';
    }

    if (data.length > maxRows) {
      streamContent += `(... and ${data.length - maxRows} more records) Tj\n`;
    }

    streamContent += 'ET\n';

    content += `5 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}endstream\nendobj\n`;
    content += `xref\n0 6\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000115 00000 n\n0000000214 00000 n\n0000000299 00000 n\n`;
    content += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${content.length}\n%%EOF`;

    this.downloadFile(content, `${filename}.pdf`, 'application/pdf');
  }

  /**
   * Export to JSON format
   */
  private static exportToJSON(options: ExportOptions): void {
    const { filename, data, title, subtitle, metadata, includeTimestamp } = options;

    const exportData: any = {
      data
    };

    if (title) exportData.title = title;
    if (subtitle) exportData.subtitle = subtitle;
    if (metadata) exportData.metadata = metadata;
    if (includeTimestamp) {
      exportData.exportedAt = new Date().toISOString();
    }

    const json = JSON.stringify(exportData, null, 2);
    this.downloadFile(json, `${filename}.json`, 'application/json');
  }

  /**
   * Infer columns from data object
   */
  private static inferColumns(sampleRow: any): ExportOptions['columns'] {
    return Object.keys(sampleRow).map(key => ({
      field: key,
      label: this.formatLabel(key)
    }));
  }

  /**
   * Format field name as label
   */
  private static formatLabel(field: string): string {
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Escape string for PDF
   */
  private static escapePDFString(str: string): string {
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .substring(0, 100); // Limit length
  }

  /**
   * Download file to user's computer
   */
  private static downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Format value based on type
   */
  static formatValue(value: any, type: string): string {
    if (value === null || value === undefined) return '';

    switch (type) {
      case 'currency':
        return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'percentage':
        return `${Number(value).toFixed(2)}%`;
      case 'date':
        return new Date(value).toLocaleDateString();
      case 'number':
        return Number(value).toLocaleString();
      default:
        return String(value);
    }
  }

  /**
   * Batch export multiple reports
   */
  static async batchExport(exports: ExportOptions[]): Promise<void> {
    try {
      for (const exportOption of exports) {
        await this.exportData(exportOption);
        // Small delay between exports
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      toast.success(`Exported ${exports.length} reports`);
    } catch (error) {
      console.error('Batch export error:', error);
      toast.error('Failed to export some reports');
    }
  }

  /**
   * Get export preview
   */
  static getPreview(options: ExportOptions, maxRows: number = 10): string {
    const { data, columns } = options;
    const exportColumns = columns || this.inferColumns(data[0]);

    const previewData = data.slice(0, maxRows);
    const headers = exportColumns.map(col => col.label).join(' | ');
    const rows = previewData.map(row => {
      return exportColumns.map(col => {
        const value = row[col.field];
        return col.format ? col.format(value) : String(value);
      }).join(' | ');
    });

    return [headers, ...rows].join('\n');
  }

  /**
   * Estimate export size
   */
  static estimateSize(options: ExportOptions): { bytes: number; readable: string } {
    const { data, format } = options;
    
    // Rough estimation
    const jsonSize = JSON.stringify(data).length;
    let estimatedBytes: number;

    switch (format) {
      case 'csv':
        estimatedBytes = jsonSize * 0.7; // CSV is typically smaller
        break;
      case 'excel':
        estimatedBytes = jsonSize * 0.8;
        break;
      case 'pdf':
        estimatedBytes = jsonSize * 1.5; // PDF has overhead
        break;
      case 'json':
        estimatedBytes = jsonSize;
        break;
      default:
        estimatedBytes = jsonSize;
    }

    const readable = this.formatBytes(estimatedBytes);
    return { bytes: estimatedBytes, readable };
  }

  /**
   * Format bytes to human readable
   */
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}
