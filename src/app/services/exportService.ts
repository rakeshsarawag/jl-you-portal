import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

export class ExportService {
  /**
   * Export data to PDF with professional formatting
   */
  static async exportToPDF(data: any[], columns: string[], title: string, subtitle?: string) {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.text(title, 14, 22);
    
    // Add subtitle
    if (subtitle) {
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text(subtitle, 14, 30);
    }
    
    // Add metadata
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, subtitle ? 38 : 30);
    doc.text('Portal Jeshan Labs - Executive Dashboard', 14, subtitle ? 44 : 36);
    
    // Add table
    autoTable(doc, {
      head: [columns.map(col => col.replace(/([A-Z])/g, ' $1').trim())],
      body: data.map(row => columns.map(col => {
        const value = row[col];
        if (typeof value === 'number') {
          return value.toLocaleString();
        }
        return value || '-';
      })),
      startY: subtitle ? 50 : 42,
      styles: { 
        fontSize: 8,
        cellPadding: 3
      },
      headStyles: { 
        fillColor: [59, 130, 246],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250]
      },
      margin: { top: 10 }
    });
    
    // Add footer
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }
    
    // Download
    doc.save(`${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  /**
   * Export data to Excel with formatting and charts
   */
  static async exportToExcel(data: any[], columns: string[], title: string, subtitle?: string) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(title.substring(0, 31)); // Excel limit

    // Add title
    worksheet.mergeCells('A1:' + String.fromCharCode(64 + columns.length) + '1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = { size: 16, bold: true, color: { argb: 'FF1F2937' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(1).height = 30;

    // Add subtitle
    let headerRow = 3;
    if (subtitle) {
      worksheet.mergeCells('A2:' + String.fromCharCode(64 + columns.length) + '2');
      const subtitleCell = worksheet.getCell('A2');
      subtitleCell.value = subtitle;
      subtitleCell.font = { size: 11, color: { argb: 'FF6B7280' } };
      subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
      headerRow = 4;
    }

    // Add metadata
    worksheet.mergeCells(`A${headerRow - 1}:` + String.fromCharCode(64 + columns.length) + (headerRow - 1));
    const metaCell = worksheet.getCell(`A${headerRow - 1}`);
    metaCell.value = `Generated: ${new Date().toLocaleString()} | Portal Jeshan Labs`;
    metaCell.font = { size: 9, color: { argb: 'FF9CA3AF' } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'left' };

    // Add header row
    const headerRowObj = worksheet.getRow(headerRow);
    columns.forEach((col, index) => {
      const cell = headerRowObj.getCell(index + 1);
      cell.value = col.replace(/([A-Z])/g, ' $1').trim();
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3B82F6' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    headerRowObj.height = 25;

    // Add data rows
    data.forEach((row, rowIndex) => {
      const dataRow = worksheet.getRow(headerRow + rowIndex + 1);
      columns.forEach((col, colIndex) => {
        const cell = dataRow.getCell(colIndex + 1);
        const value = row[col];
        
        if (typeof value === 'number') {
          cell.value = value;
          cell.numFmt = '#,##0.00';
        } else if (value instanceof Date) {
          cell.value = value;
          cell.numFmt = 'mm/dd/yyyy';
        } else {
          cell.value = value || '-';
        }

        // Alternate row colors
        if (rowIndex % 2 === 0) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9FAFB' }
          };
        }

        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });
    });

    // Auto-size columns
    worksheet.columns.forEach((column, index) => {
      let maxLength = columns[index].length;
      data.forEach(row => {
        const value = row[columns[index]];
        const valueLength = value ? value.toString().length : 0;
        if (valueLength > maxLength) {
          maxLength = valueLength;
        }
      });
      column.width = Math.min(Math.max(maxLength + 2, 12), 50);
    });

    // Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Export data to CSV
   */
  static exportToCSV(data: any[], columns: string[], title: string) {
    const headers = columns.map(col => col.replace(/([A-Z])/g, ' $1').trim());
    const csv = [
      headers.join(','),
      ...data.map(row => 
        columns.map(col => {
          const value = row[col];
          if (value === null || value === undefined) return '""';
          const stringValue = String(value).replace(/"/g, '""');
          return `"${stringValue}"`;
        }).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Export dashboard summary to comprehensive PDF report
   */
  static async exportDashboardReport(metrics: any, kpiData: any[]) {
    const doc = new jsPDF();
    let yPos = 20;

    // Cover page
    doc.setFontSize(24);
    doc.text('Executive Dashboard Report', 105, yPos, { align: 'center' });
    
    yPos += 10;
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text('Portal Jeshan Labs', 105, yPos, { align: 'center' });
    
    yPos += 10;
    doc.setFontSize(12);
    doc.text(new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }), 105, yPos, { align: 'center' });

    // KPI Summary
    doc.addPage();
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text('Key Performance Indicators', 14, 20);

    autoTable(doc, {
      startY: 30,
      head: [['Metric', 'Current Value', 'Change', 'Trend']],
      body: kpiData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 10 }
    });

    // Department Overview
    if (metrics.departmentHeadcount && metrics.departmentHeadcount.length > 0) {
      doc.addPage();
      doc.setFontSize(16);
      doc.text('Department Overview', 14, 20);

      autoTable(doc, {
        startY: 30,
        head: [['Department', 'Headcount', 'Percentage']],
        body: metrics.departmentHeadcount.map(d => {
          const total = metrics.totalEmployees || 1;
          const percentage = ((d.value / total) * 100).toFixed(1);
          return [d.name, d.value.toString(), `${percentage}%`];
        }),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] }
      });
    }

    // Save
    doc.save(`Executive_Dashboard_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  /**
   * Export multiple datasets to Excel with multiple sheets
   */
  static async exportMultiSheetExcel(datasets: Array<{
    name: string;
    data: any[];
    columns: string[];
  }>, filename: string) {
    const workbook = new ExcelJS.Workbook();

    datasets.forEach(dataset => {
      const worksheet = workbook.addWorksheet(dataset.name.substring(0, 31));

      // Add header
      const headerRow = worksheet.addRow(dataset.columns);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3B82F6' }
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      // Add data
      dataset.data.forEach(row => {
        const values = dataset.columns.map(col => row[col]);
        worksheet.addRow(values);
      });

      // Auto-size columns
      worksheet.columns.forEach(column => {
        column.width = 15;
      });
    });

    // Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
