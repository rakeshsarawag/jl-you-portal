export const PF_WAGE_CEILING = 15000;
export const PF_RATE = 0.12;
export const ESI_THRESHOLD = 21000;
export const ESI_EMPLOYEE_RATE = 0.0075;
export const ESI_EMPLOYER_RATE = 0.0325;

export function calculatePF(basicSalary: number): { employee: number; employer: number } {
  const pfBase = Math.min(basicSalary, PF_WAGE_CEILING);
  const employee = Math.round(pfBase * PF_RATE);
  const employer = Math.round(pfBase * PF_RATE);
  return { employee, employer };
}

export function calculateESI(grossSalary: number): { employee: number; employer: number } {
  if (grossSalary > ESI_THRESHOLD) return { employee: 0, employer: 0 };
  return {
    employee: Math.round(grossSalary * ESI_EMPLOYEE_RATE),
    employer: Math.round(grossSalary * ESI_EMPLOYER_RATE),
  };
}

export function calculateTDSNewRegime(annualGross: number): number {
  const stdDeduction = 75000;
  const taxable = Math.max(0, annualGross - stdDeduction);
  if (taxable <= 300000) return 0;
  // 87A rebate
  let tax = 0;
  if (taxable <= 700000) {
    // simplified: apply slabs
    if (taxable <= 300000) tax = 0;
    else if (taxable <= 600000) tax = (taxable - 300000) * 0.05;
    else if (taxable <= 900000) tax = 15000 + (taxable - 600000) * 0.10;
    else if (taxable <= 1200000) tax = 45000 + (taxable - 900000) * 0.15;
    else if (taxable <= 1500000) tax = 90000 + (taxable - 1200000) * 0.20;
    else tax = 150000 + (taxable - 1500000) * 0.30;
    // 87A rebate: if tax <= 25000 and taxable <= 700000, rebate
    if (tax <= 25000) tax = 0;
  } else {
    if (taxable <= 600000) tax = (taxable - 300000) * 0.05;
    else if (taxable <= 900000) tax = 15000 + (taxable - 600000) * 0.10;
    else if (taxable <= 1200000) tax = 45000 + (taxable - 900000) * 0.15;
    else if (taxable <= 1500000) tax = 90000 + (taxable - 1200000) * 0.20;
    else tax = 150000 + (taxable - 1500000) * 0.30;
  }
  // 4% cess
  return Math.round(tax * 1.04 / 12); // monthly TDS
}

export function calculateTDSOldRegime(annualGross: number, totalDeductions: number = 0): number {
  const stdDeduction = 50000;
  const taxable = Math.max(0, annualGross - stdDeduction - totalDeductions);
  let tax = 0;
  if (taxable <= 250000) tax = 0;
  else if (taxable <= 500000) tax = (taxable - 250000) * 0.05;
  else if (taxable <= 1000000) tax = 12500 + (taxable - 500000) * 0.20;
  else tax = 112500 + (taxable - 1000000) * 0.30;
  // 87A rebate
  if (taxable <= 500000) tax = 0;
  return Math.round(tax * 1.04 / 12);
}
