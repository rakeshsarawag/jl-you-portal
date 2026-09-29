import { describe, it, expect } from 'vitest';
import {
  numberToWords,
  calculateDueDate,
  formatCurrency,
} from '../../../src/app/utils/invoiceUtils';

describe('numberToWords - INR', () => {
  it('returns Zero Rupees Only for 0', () => {
    expect(numberToWords(0, 'INR')).toBe('Zero Rupees Only');
  });

  it('converts simple integer (5) to words', () => {
    expect(numberToWords(5, 'INR')).toBe('Five Rupees Only');
  });

  it('converts a teen number (15)', () => {
    expect(numberToWords(15, 'INR')).toBe('Fifteen Rupees Only');
  });

  it('converts hundreds correctly (500)', () => {
    expect(numberToWords(500, 'INR')).toBe('Five Hundred Rupees Only');
  });

  it('converts thousands correctly (1000)', () => {
    expect(numberToWords(1000, 'INR')).toBe('One Thousand Rupees Only');
  });

  it('converts lakhs correctly (100000)', () => {
    expect(numberToWords(100000, 'INR')).toBe('One Lakh Rupees Only');
  });

  it('converts crores correctly (10000000)', () => {
    expect(numberToWords(10000000, 'INR')).toBe('One Crore Rupees Only');
  });

  it('converts combined lakhs and thousands (125000)', () => {
    // 1 lakh, 25 thousand
    expect(numberToWords(125000, 'INR')).toBe('One Lakh Twenty Five Thousand Rupees Only');
  });

  it('includes paise when decimal amount has cents > 0', () => {
    expect(numberToWords(1.50, 'INR')).toBe('One Rupees and Fifty Paise Only');
  });

  it('omits paise when amount is a whole number', () => {
    expect(numberToWords(100, 'INR')).toBe('One Hundred Rupees Only');
  });
});

describe('numberToWords - USD', () => {
  it('returns Zero Dollars Only for 0', () => {
    expect(numberToWords(0, 'USD')).toBe('Zero Dollars Only');
  });

  it('converts simple integer (7) to words', () => {
    expect(numberToWords(7, 'USD')).toBe('Seven Dollars Only');
  });

  it('converts thousands correctly (1000)', () => {
    expect(numberToWords(1000, 'USD')).toBe('One Thousand Dollars Only');
  });

  it('converts millions correctly (1000000)', () => {
    expect(numberToWords(1000000, 'USD')).toBe('One Million Dollars Only');
  });

  it('includes cents when decimal amount provided', () => {
    expect(numberToWords(1.25, 'USD')).toBe('One Dollars and Twenty Five Cents Only');
  });

  it('omits cents when amount is whole number', () => {
    expect(numberToWords(500, 'USD')).toBe('Five Hundred Dollars Only');
  });
});

describe('calculateDueDate', () => {
  it('returns same date for "Due on Receipt"', () => {
    expect(calculateDueDate('2024-01-15', 'Due on Receipt')).toBe('2024-01-15');
  });

  it('adds 30 days for "Net 30"', () => {
    expect(calculateDueDate('2024-01-01', 'Net 30')).toBe('2024-01-31');
  });

  it('adds 15 days for "Net 15"', () => {
    expect(calculateDueDate('2024-01-01', 'Net 15')).toBe('2024-01-16');
  });

  it('adds 60 days for "Net 60"', () => {
    expect(calculateDueDate('2024-01-01', 'Net 60')).toBe('2024-03-01');
  });

  it('handles month boundary correctly (Jan 31 + 30 days)', () => {
    expect(calculateDueDate('2024-01-31', 'Net 30')).toBe('2024-03-01');
  });

  it('returns same date for unknown terms', () => {
    expect(calculateDueDate('2024-06-01', 'Custom Terms')).toBe('2024-06-01');
  });

  it('returns same date for empty string terms', () => {
    expect(calculateDueDate('2024-06-01', '')).toBe('2024-06-01');
  });
});

describe('formatCurrency', () => {
  it('formats INR with ₹ symbol', () => {
    const result = formatCurrency(1000, 'INR');
    expect(result).toContain('₹');
    expect(result).toContain('1,000.00');
  });

  it('formats USD with $ symbol', () => {
    const result = formatCurrency(1000, 'USD');
    expect(result).toContain('$');
    expect(result).toContain('1,000.00');
  });

  it('formats EUR with € symbol', () => {
    const result = formatCurrency(500, 'EUR');
    expect(result).toContain('€');
    expect(result).toContain('500.00');
  });

  it('formats GBP with £ symbol', () => {
    const result = formatCurrency(250, 'GBP');
    expect(result).toContain('£');
    expect(result).toContain('250.00');
  });

  it('handles null amount as 0', () => {
    const result = formatCurrency(null, 'USD');
    expect(result).toContain('0.00');
  });

  it('handles undefined amount as 0', () => {
    const result = formatCurrency(undefined, 'USD');
    expect(result).toContain('0.00');
  });

  it('formats large INR amount with Indian numbering grouping', () => {
    const result = formatCurrency(1234567, 'INR');
    expect(result).toContain('₹');
    // Indian format groups as 12,34,567
    expect(result).toContain('12,34,567.00');
  });

  it('formats large USD amount with international grouping', () => {
    const result = formatCurrency(1234567, 'USD');
    expect(result).toContain('$');
    expect(result).toContain('1,234,567.00');
  });
});
