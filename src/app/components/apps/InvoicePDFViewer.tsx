/**
 * Invoice PDF Viewer and Generator
 * Displays invoice matching the reference format and allows PDF download
 */

import { useRef } from 'react';
import { Button } from '../ui/button';
import { Download, X, Printer } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Invoice } from '../../hooks/useInvoiceData';
import { formatCurrency } from '../../utils/invoiceUtils';

interface InvoicePDFViewerProps {
  invoice: Invoice;
  onClose: () => void;
}

export function InvoicePDFViewer({ invoice, onClose }: InvoicePDFViewerProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);

  const handleDownloadPDF = async () => {
    if (!invoiceRef.current) return;

    try {
      toast.info('Generating PDF...');

      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          // Aggressively replace all oklch colors with standard colors
          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach((element) => {
            const el = element as HTMLElement;
            const computedStyle = window.getComputedStyle(el);

            // Replace any oklch colors in color property
            if (computedStyle.color && computedStyle.color.includes('oklch')) {
              el.style.color = '#000000';
            }

            // Replace any oklch colors in background-color
            if (computedStyle.backgroundColor && computedStyle.backgroundColor.includes('oklch')) {
              el.style.backgroundColor = '#ffffff';
            }

            // Replace any oklch colors in border-color
            if (computedStyle.borderColor && computedStyle.borderColor.includes('oklch')) {
              el.style.borderColor = '#d1d5db';
            }

            // Force standard colors on all text elements
            if (el.textContent && el.textContent.trim()) {
              const currentColor = computedStyle.color;
              // Convert any non-standard colors to black
              if (currentColor && (currentColor.includes('oklch') || currentColor.includes('color-mix'))) {
                el.style.color = '#000000';
              }
            }
          });

          // Override CSS variables with standard colors
          const styleElement = clonedDoc.createElement('style');
          styleElement.textContent = `
            * {
              --foreground: #000000 !important;
              --background: #ffffff !important;
              --muted: #f3f4f6 !important;
              --muted-foreground: #6b7280 !important;
              --card: #ffffff !important;
              --card-foreground: #000000 !important;
              --popover: #ffffff !important;
              --popover-foreground: #000000 !important;
              --border: #d1d5db !important;
              --input: #d1d5db !important;
              --primary: #7c3aed !important;
              --primary-foreground: #ffffff !important;
              --secondary: #f3f4f6 !important;
              --secondary-foreground: #000000 !important;
              --accent: #f3f4f6 !important;
              --accent-foreground: #000000 !important;
              --destructive: #ef4444 !important;
              --destructive-foreground: #ffffff !important;
              --ring: #6b7280 !important;
            }
          `;
          clonedDoc.head.appendChild(styleElement);
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 0;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`${invoice.invoiceNumber}.pdf`);

      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const handlePrint = () => {
    // Print only the invoice content, not the modal
    const printContent = invoiceRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice ${invoice.invoiceNumber}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              margin: 0;
              padding: 20px;
              font-family: Arial, sans-serif;
              background: white;
              color: black;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            td {
              border: 1px solid #d1d5db;
              padding: 8px;
              vertical-align: middle;
            }
            .border { border: 1px solid #d1d5db; }
            .border-gray-300 { border-color: #d1d5db; }
            .text-xs { font-size: 0.75rem; }
            .text-sm { font-size: 0.875rem; }
            .text-base { font-size: 1rem; }
            .text-lg { font-size: 1.125rem; }
            .text-xl { font-size: 1.25rem; }
            .text-2xl { font-size: 1.5rem; }
            .font-bold { font-weight: 700; }
            .font-semibold { font-weight: 600; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .text-left { text-align: left; }
            .grid { display: grid; }
            .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .gap-8 { gap: 2rem; }
            .mb-2 { margin-bottom: 0.5rem; }
            .mb-4 { margin-bottom: 1rem; }
            .mb-6 { margin-bottom: 1.5rem; }
            .mb-8 { margin-bottom: 2rem; }
            .mt-1 { margin-top: 0.25rem; }
            .mt-2 { margin-top: 0.5rem; }
            .p-1 { padding: 0.25rem; }
            .p-2 { padding: 0.5rem; }
            .p-4 { padding: 1rem; }
            .p-6 { padding: 1.5rem; }
            .p-8 { padding: 2rem; }
            .flex { display: flex; }
            .items-center { align-items: center; }
            .items-start { align-items: flex-start; }
            .justify-between { justify-content: space-between; }
            .justify-end { justify-content: flex-end; }
            .whitespace-pre-line { white-space: pre-line; }
            .italic { font-style: italic; }
            .w-full { width: 100%; }
            .w-96 { width: 24rem; }
            @media print {
              body { margin: 0; padding: 10mm; }
              @page { margin: 10mm; size: A4; }
              table td { vertical-align: middle !important; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto">
        {/* Action Bar */}
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between z-10 no-print">
          <h2 className="text-xl font-semibold">Invoice {invoice.invoiceNumber}</h2>
          <div className="flex gap-2">
            <Button size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button size="sm" onClick={handleDownloadPDF}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button size="sm" variant="outline" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Invoice Content */}
        <div 
          ref={invoiceRef} 
          data-invoice-content
          className="p-8 bg-white" 
          style={{ 
            fontFamily: 'Arial, sans-serif',
            color: '#000000',
            backgroundColor: '#ffffff'
          }}
        >
          {/* Header */}
          <div className="mb-8" style={{ backgroundColor: '#e0f2fe', padding: '16px' }}>
            <div className="flex items-start justify-between">
              {/* Logo and Company Info */}
              <div className="flex items-start gap-4">
                {/* <img 
                  src={logoImage} 
                  alt="Jeshan Labs" 
                  className="h-16"
                  style={{ height: '64px', width: 'auto' }}
                /> */}
                <div>
                  <div className="font-bold text-lg" style={{ color: '#5b21b6' }}>Jeshan Labs Private Limited</div>
                  <div className="text-xs mt-1">
                    First Floor, 428, Jaswant Nagar, Khatipura, Jaipur, Rajasthan, India 302012
                  </div>
                  <div className="text-xs">
                    <strong>E:</strong> sales@jeshanlabs.com &nbsp; <strong>M:</strong> +91-9785833383
                  </div>
                </div>
              </div>

              {/* Invoice Title */}
              <div className="text-right">
                <h1 className="text-3xl font-bold mb-2" style={{ color: '#5b21b6' }}>INVOICE</h1>
              </div>
            </div>
          </div>

          {/* Bill To and Invoice Details */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            {/* Bill To */}
            <div>
              <div className="font-bold text-sm mb-2">BILL TO:</div>
              <div className="border border-gray-300 p-3">
                {invoice.billToName.includes('\n') ? (
                  <div className="whitespace-pre-line text-sm font-semibold">{invoice.billToName}</div>
                ) : (
                  <div className="font-semibold text-sm mb-1">{invoice.billToName}</div>
                )}
                <div className="text-sm whitespace-pre-line">{invoice.billToAddress}</div>
                {invoice.billToGstin && (
                  <div className="text-sm mt-2">
                    <span className="font-semibold">GSTIN:</span> {invoice.billToGstin}
                  </div>
                )}
              </div>
            </div>

            {/* Invoice Details */}
            <div>
              <table className="w-full text-sm border-collapse">
                <tbody>
                  <tr>
                    <td className="border border-gray-300 p-2 font-semibold bg-gray-50">Invoice #</td>
                    <td className="border border-gray-300 p-2">{invoice.invoiceNumber}</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 p-2 font-semibold bg-gray-50">Invoice Date</td>
                    <td className="border border-gray-300 p-2">{formatDate(invoice.invoiceDate)}</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 p-2 font-semibold bg-gray-50">Terms</td>
                    <td className="border border-gray-300 p-2">{invoice.terms}</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 p-2 font-semibold bg-gray-50">Invoice Period</td>
                    <td className="border border-gray-300 p-2">
                      {invoice.invoicePeriodFrom && invoice.invoicePeriodTo
                        ? `${formatDate(invoice.invoicePeriodFrom)} - ${formatDate(invoice.invoicePeriodTo)}`
                        : 'N/A'}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 p-2 font-semibold bg-gray-50">Due Date</td>
                    <td className="border border-gray-300 p-2">{formatDate(invoice.dueDate)}</td>
                  </tr>
                  {invoice.poNumber && (
                    <tr>
                      <td className="border border-gray-300 p-2 font-semibold bg-gray-50">PO#</td>
                      <td className="border border-gray-300 p-2">{invoice.poNumber}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="mb-8">
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ backgroundColor: '#5b21b6', color: '#ffffff' }}>
                  <th className="border border-gray-300 p-2 text-left text-sm">DESCRIPTION</th>
                  {invoice.currency === 'INR' && (
                    <th className="border border-gray-300 p-2 text-center text-sm w-24">HSN/SAC</th>
                  )}
                  <th className="border border-gray-300 p-2 text-center text-sm w-20">QUANTITY</th>
                  <th className="border border-gray-300 p-2 text-right text-sm w-28">RATE</th>
                  {invoice.currency === 'INR' && (
                    <th className="border border-gray-300 p-2 text-right text-sm w-32">IGST (18%)</th>
                  )}
                  <th className="border border-gray-300 p-2 text-right text-sm w-32">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, index) => {
                  const itemAmount = item.amount ?? 0;
                  const igstAmount = invoice.currency === 'INR' ? itemAmount * 0.18 : 0;
                  return (
                    <tr key={item.id} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                      <td className="border border-gray-300 p-2 text-sm" style={{ verticalAlign: 'middle' }}>{item.description}</td>
                      {invoice.currency === 'INR' && (
                        <td className="border border-gray-300 p-2 text-center text-sm" style={{ verticalAlign: 'middle' }}>{item.hsnSac}</td>
                      )}
                      <td className="border border-gray-300 p-2 text-center text-sm" style={{ verticalAlign: 'middle' }}>{(item.quantity ?? 0).toFixed(2)}</td>
                      <td className="border border-gray-300 p-2 text-right text-sm" style={{ verticalAlign: 'middle' }}>
                        {formatCurrency(item.rate, invoice.currency)}
                      </td>
                      {invoice.currency === 'INR' && (
                        <td className="border border-gray-300 p-2 text-right text-sm" style={{ verticalAlign: 'middle' }}>
                          {formatCurrency(igstAmount, invoice.currency)}
                        </td>
                      )}
                      <td className="border border-gray-300 p-2 text-right text-sm font-semibold" style={{ verticalAlign: 'middle' }}>
                        {formatCurrency(itemAmount, invoice.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="mb-8">
            <div className="flex justify-end">
              <div className="w-96">
                <table className="w-full border-collapse">
                  <tbody>
                    <tr style={{ backgroundColor: '#dbeafe' }}>
                      <td className="border border-gray-300 p-2 text-right font-semibold" style={{ verticalAlign: 'middle' }}>TOTAL AMOUNT</td>
                      <td className="border border-gray-300 p-2 text-right font-semibold" style={{ verticalAlign: 'middle' }}>
                        {formatCurrency(invoice.subtotal, invoice.currency)}
                      </td>
                    </tr>
                    {invoice.currency === 'INR' && invoice.gstAmount > 0 && (
                      <tr style={{ backgroundColor: '#dbeafe' }}>
                        <td className="border border-gray-300 p-2 text-right font-semibold" style={{ verticalAlign: 'middle' }}>TOTAL IGST(18%)</td>
                        <td className="border border-gray-300 p-2 text-right font-semibold" style={{ verticalAlign: 'middle' }}>
                          {formatCurrency(invoice.gstAmount, invoice.currency)}
                        </td>
                      </tr>
                    )}
                    <tr style={{ backgroundColor: '#dbeafe' }}>
                      <td className="border border-gray-300 p-2 text-right font-bold" style={{ verticalAlign: 'middle' }}>BALANCE DUE</td>
                      <td className="border border-gray-300 p-2 text-right font-bold text-lg" style={{ color: '#5b21b6', verticalAlign: 'middle' }}>
                        {formatCurrency(invoice.total, invoice.currency)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={2} className="border border-gray-300 p-2 text-right italic text-sm" style={{ verticalAlign: 'middle' }}>
                        <span className="font-semibold">Total in words : </span>
                        {invoice.totalInWords}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Registration and Remittance Details */}
          <div className="grid grid-cols-2 gap-8 mb-6">
            {/* Registration Details */}
            <div>
              <div className="font-bold text-sm mb-2">Registration Details</div>
              <table className="w-full text-xs" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <tbody>
                  {invoice.registrationDetails.split('\n').map((line, idx) => {
                    const parts = line.split(':');
                    if (parts.length === 2) {
                      return (
                        <tr key={idx}>
                          <td
                            style={{
                              width: '40%',
                              border: '1px solid #d1d5db',
                              padding: '10px 8px',
                              fontSize: '12px',
                              lineHeight: '16px',
                              backgroundColor: '#ffffff'
                            }}
                          >
                            {parts[0].trim()}
                          </td>
                          <td
                            style={{
                              width: '60%',
                              border: '1px solid #d1d5db',
                              padding: '10px 8px',
                              fontSize: '12px',
                              lineHeight: '16px',
                              backgroundColor: '#ffffff'
                            }}
                          >
                            {parts[1].trim()}
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={idx}>
                        <td
                          colSpan={2}
                          style={{
                            border: '1px solid #d1d5db',
                            padding: '10px 8px',
                            fontSize: '12px',
                            lineHeight: '16px',
                            backgroundColor: '#ffffff'
                          }}
                        >
                          {line}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Remittance Details */}
            <div>
              <div className="font-bold text-sm mb-2">Remittance Details</div>
              <table className="w-full text-xs" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <tbody>
                  {invoice.remittanceDetails.split('\n').map((line, idx) => {
                    const parts = line.split(':');
                    if (parts.length === 2) {
                      return (
                        <tr key={idx}>
                          <td
                            style={{
                              width: '40%',
                              border: '1px solid #d1d5db',
                              padding: '10px 8px',
                              fontSize: '12px',
                              lineHeight: '16px',
                              backgroundColor: '#ffffff'
                            }}
                          >
                            {parts[0].trim()}
                          </td>
                          <td
                            style={{
                              width: '60%',
                              border: '1px solid #d1d5db',
                              padding: '10px 8px',
                              fontSize: '12px',
                              lineHeight: '16px',
                              backgroundColor: '#ffffff'
                            }}
                          >
                            {parts[1].trim()}
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={idx}>
                        <td
                          colSpan={2}
                          style={{
                            border: '1px solid #d1d5db',
                            padding: '10px 8px',
                            fontSize: '12px',
                            lineHeight: '16px',
                            backgroundColor: '#ffffff'
                          }}
                        >
                          {line}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="mb-6">
              <div className="font-bold text-sm mb-2">NOTES:</div>
              <div className="text-sm whitespace-pre-line text-gray-600">{invoice.notes}</div>
            </div>
          )}

          {/* Thank You Note */}
          <div className="text-center mt-8 text-sm italic" style={{ color: '#6b7280' }}>
            Thank you for your business!
          </div>
        </div>
      </div>
    </div>
  );
}