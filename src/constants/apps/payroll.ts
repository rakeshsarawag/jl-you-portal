export const PAYROLL_STATUSES = ["Draft", "Processing", "Approved", "Paid", "On Hold"] as const;
export const PAYROLL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"] as const;
export const DEDUCTION_TYPES = ["PF", "ESI", "TDS", "Professional Tax", "Loan", "Advance"] as const;
export const ALLOWANCE_TYPES = ["HRA", "Conveyance", "Medical", "Special", "Bonus", "Overtime"] as const;
export const DEFAULT_PF_RATE = 0.12; // 12%
export const DEFAULT_ESI_RATE = 0.0175; // 1.75%
