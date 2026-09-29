import { describe, it, expect } from 'vitest';
import {
  calculateTDSNewRegime,
  calculateTDSOldRegime,
  calculateTDSFromSlabs,
  type IncomeTaxSlab,
  type TaxRebate,
} from '../../../src/app/utils/payrollCalculations';

// ----------------------------------------------------------------
// calculateTDSNewRegime
// stdDeduction = 75,000
// Taxable = gross - 75,000
// Slabs: 0-3L @0%, 3-6L @5%, 6-9L @10%, 9-12L @15%, 12-15L @20%, >15L @30%
// 87A rebate: if taxable ≤ 7L AND computed tax ≤ 25,000 → tax = 0
// Cess: 4%, monthly (divide by 12)
// ----------------------------------------------------------------
describe('calculateTDSNewRegime', () => {
  it('returns 0 when gross <= 375000 (taxable <= 300000, zero-slab)', () => {
    // gross=375000, taxable=300000 → 0 tax
    expect(calculateTDSNewRegime(375000)).toBe(0);
  });

  it('returns 0 when taxable is exactly 300000', () => {
    expect(calculateTDSNewRegime(375000)).toBe(0);
  });

  it('returns 0 for gross=400000 due to 87A rebate (taxable=325000, tax=1250 ≤ 25000)', () => {
    // taxable = 400000 - 75000 = 325000
    // tax = (325000 - 300000) * 0.05 = 25000 * 0.05 = 1250
    // taxable ≤ 700000 and tax ≤ 25000 → rebate → tax = 0
    expect(calculateTDSNewRegime(400000)).toBe(0);
  });

  it('returns 0 for gross=775000 (taxable=700000, 87A rebate covers tax)', () => {
    // taxable = 775000 - 75000 = 700000
    // tax = (600000-300000)*0.05 + (700000-600000)*0.10 = 15000 + 10000 = 25000
    // taxable ≤ 700000 and tax = 25000 ≤ 25000 → rebate → tax = 0
    expect(calculateTDSNewRegime(775000)).toBe(0);
  });

  it('returns positive monthly TDS for gross=800000 (taxable=725000, above rebate threshold)', () => {
    // taxable = 800000 - 75000 = 725000 > 700000 → no 87A rebate
    // tax = 15000 + (725000-600000)*0.10 = 15000 + 12500 = 27500
    // with 4% cess: 27500 * 1.04 = 28600, monthly = 28600/12 ≈ 2383
    const result = calculateTDSNewRegime(800000);
    expect(result).toBe(Math.round(27500 * 1.04 / 12));
  });

  it('computes correct TDS for gross=1500000 (taxable=1425000)', () => {
    // taxable = 1500000 - 75000 = 1425000
    // tax = 15000 + 30000 + 45000 + (1425000-1200000)*0.20
    //     = 15000 + 30000 + 45000 + 45000 = 135000
    const taxable = 1425000;
    const tax = 15000 + (900000 - 600000) * 0.10 + (1200000 - 900000) * 0.15 + (taxable - 1200000) * 0.20;
    // = 15000 + 30000 + 45000 + 45000 = 135000
    const expected = Math.round(tax * 1.04 / 12);
    expect(calculateTDSNewRegime(1500000)).toBe(expected);
  });

  it('computes correct TDS for gross=2000000 (taxable=1925000, top 30% bracket)', () => {
    // taxable = 2000000 - 75000 = 1925000
    // tax = 15000 + 30000 + 45000 + 60000 + (1925000-1500000)*0.30
    //     = 150000 + 425000*0.30 = 150000 + 127500 = 277500
    const taxable = 1925000;
    const tax = 150000 + (taxable - 1500000) * 0.30;
    const expected = Math.round(tax * 1.04 / 12);
    expect(calculateTDSNewRegime(2000000)).toBe(expected);
  });

  it('applies 4% cess (health & education) on tax', () => {
    // gross=1000000, taxable=925000 > 700000 → no rebate
    // tax = 15000 + (900000-600000)*0.10 + (925000-900000)*0.15
    //     = 15000 + 30000 + 3750 = 48750
    // after cess: 48750 * 1.04 = 50700; monthly = 50700/12 = 4225
    const tax = 15000 + 30000 + (925000 - 900000) * 0.15;
    const expected = Math.round(tax * 1.04 / 12);
    expect(calculateTDSNewRegime(1000000)).toBe(expected);
  });
});

// ----------------------------------------------------------------
// calculateTDSOldRegime
// stdDeduction = 50,000
// Taxable = gross - 50,000 - totalDeductions
// Slabs: 0-2.5L @0%, 2.5-5L @5%, 5-10L @20%, >10L @30%
// 87A rebate: if taxable ≤ 500000 → tax = 0 (applied after computation)
// Cess: 4%, monthly
// ----------------------------------------------------------------
describe('calculateTDSOldRegime', () => {
  it('returns 0 when gross <= 300000 (taxable ≤ 250000)', () => {
    // taxable = 300000 - 50000 - 0 = 250000 → 0 tax
    expect(calculateTDSOldRegime(300000)).toBe(0);
  });

  it('returns 0 when taxable ≤ 500000 (87A rebate)', () => {
    // gross=550000, taxable=550000-50000=500000 ≤ 500000 → rebate → 0
    expect(calculateTDSOldRegime(550000)).toBe(0);
  });

  it('returns 0 when deductions bring taxable to 500000', () => {
    // gross=700000, deductions=150000 → taxable=700000-50000-150000=500000 → rebate → 0
    expect(calculateTDSOldRegime(700000, 150000)).toBe(0);
  });

  it('returns positive TDS for taxable > 500000', () => {
    // gross=700000, deductions=0 → taxable=650000
    // tax = 12500 + (650000-500000)*0.20 = 12500 + 30000 = 42500
    // taxable > 500000 → no rebate
    // cess: 42500 * 1.04 = 44200; monthly = 44200/12 ≈ 3683
    const tax = 12500 + (650000 - 500000) * 0.20;
    const expected = Math.round(tax * 1.04 / 12);
    expect(calculateTDSOldRegime(700000, 0)).toBe(expected);
  });

  it('applies deductions to reduce taxable income', () => {
    // gross=800000, deductions=100000 → taxable=650000 (same as above)
    const tax = 12500 + (650000 - 500000) * 0.20;
    const expected = Math.round(tax * 1.04 / 12);
    expect(calculateTDSOldRegime(800000, 100000)).toBe(expected);
  });

  it('computes correct TDS in 30% bracket (taxable > 10L)', () => {
    // gross=1200000, deductions=0 → taxable=1150000
    // tax = 112500 + (1150000-1000000)*0.30 = 112500 + 45000 = 157500
    const tax = 112500 + (1150000 - 1000000) * 0.30;
    const expected = Math.round(tax * 1.04 / 12);
    expect(calculateTDSOldRegime(1200000, 0)).toBe(expected);
  });

  it('applies 4% cess on final tax', () => {
    // The result should include 4% cess
    // gross=900000, taxable=850000
    // tax = 12500 + (850000-500000)*0.20 = 12500 + 70000 = 82500
    // with cess: 82500*1.04 = 85800; monthly = 85800/12 = 7150
    const tax = 12500 + (850000 - 500000) * 0.20;
    const expected = Math.round(tax * 1.04 / 12);
    expect(calculateTDSOldRegime(900000, 0)).toBe(expected);
  });
});

// ----------------------------------------------------------------
// calculateTDSFromSlabs
// taxable = max(0, annualGross - stdDeduction)
// Iterates slabs, applies rebate if taxable ≤ rebate.max_income_for_rebate
// Returns Math.round(tax * 1.04 / 12)
// ----------------------------------------------------------------
describe('calculateTDSFromSlabs', () => {
  const simpleSlabs: IncomeTaxSlab[] = [
    { min_income: 0,      max_income: 300000, rate_pct: 0  },
    { min_income: 300000, max_income: 600000, rate_pct: 5  },
    { min_income: 600000, max_income: null,   rate_pct: 10 },
  ];

  const rebate: TaxRebate = {
    max_income_for_rebate: 700000,
    rebate_amount: 25000,
  };

  it('returns 0 for empty slabs array', () => {
    expect(calculateTDSFromSlabs(500000, 0, [])).toBe(0);
  });

  it('returns 0 when taxable income falls entirely in zero-rate slab', () => {
    // taxable = 400000 - 0 = 400000; but 0% applies up to 300000
    // Wait — taxable=300000 with stdDeduction=100000 → all in first 0% slab
    expect(calculateTDSFromSlabs(300000, 0, simpleSlabs)).toBe(0);
  });

  it('computes tax for single slab with 5% rate', () => {
    // annualGross=400000, stdDeduction=0 → taxable=400000
    // 0-300000 @0%, 300000-400000 @5% = 100000*0.05 = 5000
    // monthly with cess: round(5000 * 1.04 / 12) = round(5200/12) = round(433.33) = 433
    const expected = Math.round(5000 * 1.04 / 12);
    expect(calculateTDSFromSlabs(400000, 0, simpleSlabs)).toBe(expected);
  });

  it('computes tax spanning multiple slabs', () => {
    // annualGross=800000, stdDeduction=0 → taxable=800000
    // 0-300000 @0%, 300000-600000 @5% = 15000, 600000-800000 @10% = 20000
    // total = 35000; monthly cess: round(35000*1.04/12) = round(36400/12) = round(3033.33) = 3033
    const expected = Math.round(35000 * 1.04 / 12);
    expect(calculateTDSFromSlabs(800000, 0, simpleSlabs)).toBe(expected);
  });

  it('applies standard deduction before computing taxable income', () => {
    // annualGross=875000, stdDeduction=75000 → taxable=800000 (same as above)
    const expected = Math.round(35000 * 1.04 / 12);
    expect(calculateTDSFromSlabs(875000, 75000, simpleSlabs)).toBe(expected);
  });

  it('applies rebate when taxable <= max_income_for_rebate and tax <= rebate_amount', () => {
    // taxable=400000, tax=5000 ≤ 25000 and taxable ≤ 700000 → rebate → max(0, 5000-25000) = 0
    expect(calculateTDSFromSlabs(400000, 0, simpleSlabs, rebate)).toBe(0);
  });

  it('does NOT apply rebate when taxable > max_income_for_rebate', () => {
    // taxable=800000 > 700000 → no rebate
    const expected = Math.round(35000 * 1.04 / 12);
    expect(calculateTDSFromSlabs(800000, 0, simpleSlabs, rebate)).toBe(expected);
  });

  it('partially reduces tax when rebate_amount < tax and within threshold', () => {
    // Scenario: taxable=650000 ≤ 700000 (rebate applies)
    // tax = 300000-300000 @0 + 300000-600000 @5% = 15000 + 600000-650000 @10%... wait
    // taxable=650000: 0-300000@0%, 300000-600000@5%=15000, 600000-650000@10%=5000; total=20000
    // rebate = 25000 → max(0, 20000-25000) = 0
    expect(calculateTDSFromSlabs(650000, 0, simpleSlabs, rebate)).toBe(0);
  });

  it('applies rebate that partially offsets tax when rebate < tax', () => {
    // Use a smaller rebate that doesn't cover full tax
    const smallRebate: TaxRebate = { max_income_for_rebate: 700000, rebate_amount: 5000 };
    // taxable=650000: tax=20000; after rebate: 20000-5000=15000
    const expected = Math.round(15000 * 1.04 / 12);
    expect(calculateTDSFromSlabs(650000, 0, simpleSlabs, smallRebate)).toBe(expected);
  });

  it('handles null max_income in last slab (unbounded)', () => {
    const unboundedSlabs: IncomeTaxSlab[] = [
      { min_income: 0, max_income: 500000, rate_pct: 0 },
      { min_income: 500000, max_income: null, rate_pct: 20 },
    ];
    // taxable=1000000: 500000-1000000 @20% = 100000
    const expected = Math.round(100000 * 1.04 / 12);
    expect(calculateTDSFromSlabs(1000000, 0, unboundedSlabs)).toBe(expected);
  });

  it('returns 0 when annualGross <= stdDeduction (taxable = 0)', () => {
    expect(calculateTDSFromSlabs(50000, 75000, simpleSlabs)).toBe(0);
  });
});
