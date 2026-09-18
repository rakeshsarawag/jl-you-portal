import { describe, it, expect } from "vitest";
import {
  calculatePF,
  calculateESI,
  calculateTDSNewRegime,
  calculateTDSOldRegime,
  PF_WAGE_CEILING,
  ESI_THRESHOLD,
} from "../../../src/app/utils/payrollCalculations";

describe("calculatePF", () => {
  it("caps PF base at ₹15,000 wage ceiling", () => {
    const { employee } = calculatePF(50000);
    expect(employee).toBe(1800); // 15000 * 12% = 1800
  });

  it("uses actual basic when below ceiling", () => {
    const { employee } = calculatePF(10000);
    expect(employee).toBe(1200); // 10000 * 12%
  });

  it("employee and employer contributions are equal", () => {
    const result = calculatePF(15000);
    expect(result.employee).toBe(result.employer);
  });

  it("PF_WAGE_CEILING constant is 15000", () => {
    expect(PF_WAGE_CEILING).toBe(15000);
  });
});

describe("calculateESI", () => {
  it("applies ESI when gross <= ₹21,000", () => {
    const { employee } = calculateESI(20000);
    expect(employee).toBe(150); // 20000 * 0.75%
  });

  it("no ESI when gross > ₹21,000", () => {
    const { employee, employer } = calculateESI(25000);
    expect(employee).toBe(0);
    expect(employer).toBe(0);
  });

  it("ESI threshold boundary", () => {
    const { employee } = calculateESI(21000);
    expect(employee).toBe(158); // 21000 * 0.75% rounded
  });

  it("ESI_THRESHOLD constant is 21000", () => {
    expect(ESI_THRESHOLD).toBe(21000);
  });

  it("employer rate is higher than employee rate", () => {
    const { employee, employer } = calculateESI(15000);
    expect(employer).toBeGreaterThan(employee);
  });
});

describe("calculateTDSNewRegime", () => {
  it("no TDS for income below ₹3L after std deduction", () => {
    expect(calculateTDSNewRegime(300000)).toBe(0);
  });

  it("87A rebate applies for income up to ₹7L", () => {
    // 775000 - 75000 = 700000 taxable, at exactly the 87A limit
    expect(calculateTDSNewRegime(775000)).toBe(0);
  });

  it("TDS is positive for high income", () => {
    expect(calculateTDSNewRegime(2000000)).toBeGreaterThan(0);
  });

  it("returns monthly TDS (annual / 12)", () => {
    const monthly = calculateTDSNewRegime(1200000);
    expect(monthly).toBeGreaterThan(0);
    expect(monthly).toBeLessThan(50000);
  });

  it("zero income returns zero TDS", () => {
    expect(calculateTDSNewRegime(0)).toBe(0);
  });
});

describe("calculateTDSOldRegime", () => {
  it("no TDS for income below ₹2.5L", () => {
    expect(calculateTDSOldRegime(300000)).toBe(0); // 300000 - 50000 = 250000, no tax
  });

  it("87A rebate for taxable <= ₹5L", () => {
    expect(calculateTDSOldRegime(550000)).toBe(0); // 550000-50000=500000, within rebate
  });

  it("with 80C deductions reduces tax", () => {
    const withoutDeductions = calculateTDSOldRegime(1000000, 0);
    const withDeductions = calculateTDSOldRegime(1000000, 150000);
    expect(withDeductions).toBeLessThan(withoutDeductions);
  });

  it("zero income returns zero TDS", () => {
    expect(calculateTDSOldRegime(0)).toBe(0);
  });
});
