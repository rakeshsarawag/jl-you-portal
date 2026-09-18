// Convert number to words for invoice total
export function numberToWords(amount: number, currency: string): string {
  if (amount === 0) return currency === 'INR' ? 'Zero Rupees Only' : 'Zero Dollars Only';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  
  function convertLessThanThousand(n: number): string {
    if (n === 0) return '';
    
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) {
      const ten = Math.floor(n / 10);
      const one = n % 10;
      return tens[ten] + (one > 0 ? ' ' + ones[one] : '');
    }
    
    const hundred = Math.floor(n / 100);
    const remainder = n % 100;
    return ones[hundred] + ' Hundred' + (remainder > 0 ? ' ' + convertLessThanThousand(remainder) : '');
  }
  
  // Split into integer and decimal parts
  const [integerPart, decimalPart] = amount.toFixed(2).split('.');
  const intAmount = parseInt(integerPart);
  const decAmount = parseInt(decimalPart);
  
  if (currency === 'INR') {
    // Indian numbering system: Crores, Lakhs, Thousands
    const crores = Math.floor(intAmount / 10000000);
    const lakhs = Math.floor((intAmount % 10000000) / 100000);
    const thousands = Math.floor((intAmount % 100000) / 1000);
    const hundreds = intAmount % 1000;
    
    let result = '';
    if (crores > 0) result += convertLessThanThousand(crores) + ' Crore ';
    if (lakhs > 0) result += convertLessThanThousand(lakhs) + ' Lakh ';
    if (thousands > 0) result += convertLessThanThousand(thousands) + ' Thousand ';
    if (hundreds > 0) result += convertLessThanThousand(hundreds);
    
    result = result.trim() + ' Rupees';
    
    if (decAmount > 0) {
      result += ' and ' + convertLessThanThousand(decAmount) + ' Paise';
    }
    
    return result + ' Only';
  } else {
    // International numbering system: Billions, Millions, Thousands
    const billions = Math.floor(intAmount / 1000000000);
    const millions = Math.floor((intAmount % 1000000000) / 1000000);
    const thousands = Math.floor((intAmount % 1000000) / 1000);
    const hundreds = intAmount % 1000;
    
    let result = '';
    if (billions > 0) result += convertLessThanThousand(billions) + ' Billion ';
    if (millions > 0) result += convertLessThanThousand(millions) + ' Million ';
    if (thousands > 0) result += convertLessThanThousand(thousands) + ' Thousand ';
    if (hundreds > 0) result += convertLessThanThousand(hundreds);
    
    result = result.trim() + ' Dollars';
    
    if (decAmount > 0) {
      result += ' and ' + convertLessThanThousand(decAmount) + ' Cents';
    }
    
    return result + ' Only';
  }
}

// Calculate due date based on terms
export function calculateDueDate(invoiceDate: string, terms: string): string {
  const date = new Date(invoiceDate);
  
  if (terms === 'Due on Receipt') {
    return invoiceDate;
  }
  
  const match = terms.match(/Net (\d+)/);
  if (match) {
    const days = parseInt(match[1]);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }
  
  return invoiceDate;
}

// Format currency
export function formatCurrency(amount: number | null | undefined, currency: string): string {
  const symbols: Record<string, string> = {
    'INR': '₹',
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
  };

  const symbol = symbols[currency] || currency;

  // Handle null, undefined, or invalid amounts
  const validAmount = amount ?? 0;

  if (currency === 'INR') {
    // Indian format: 1,23,45,678.00
    return symbol + ' ' + validAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else {
    // International format: 1,234,567.00
    return symbol + ' ' + validAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
