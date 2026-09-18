import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { createClient } from '@supabase/supabase-js';

// Export for direct use
export { projectId, publicAnonKey };

// Supabase client singleton
export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

// API Base URL — includes the route prefix used by all hooks and components
export const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-1fe2c468`;

/**
 * Standard headers for all API requests.
 * Pass userEmail so the backend records created_by / updated_by on every write.
 */
export function apiHeaders(userEmail?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: publicAnonKey,
    Authorization: `Bearer ${publicAnonKey}`,
  };
  if (userEmail) headers['x-user-email'] = userEmail;
  return headers;
}

/**
 * Safe JSON parser — prevents "Unexpected non-whitespace character at position 4"
 * crashes when the server returns "404 Not Found" or other non-JSON text.
 * Returns null if the response body cannot be parsed as JSON.
 */
export async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text || !text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    console.warn(`[API] Non-JSON response (${res.status}) from ${res.url}: ${text.slice(0, 120)}`);
    return null;
  }
}

// ── Defect Tracker — typed fallback constants ─────────────────────────────────
// Used when master-data API hasn't loaded yet; matches the DB seed values.

export type DefectSeverityConst = 'Very High' | 'High' | 'Medium' | 'Low';
export type DefectPriorityConst = 'P1' | 'P2' | 'P3' | 'P4';
export type DefectStatusConst =
  | 'Open' | 'In Progress' | 'Blocked' | 'Fixed'
  | 'Verified' | 'Closed' | 'Deferred' | "Won't Fix" | 'Duplicate';

export const DEFECT_SEVERITY_LIST: DefectSeverityConst[] = ['Very High', 'High', 'Medium', 'Low'];

export const DEFECT_PRIORITY_LIST: { code: DefectPriorityConst; label: string }[] = [
  { code: 'P1', label: 'P1 — Critical' },
  { code: 'P2', label: 'P2 — High' },
  { code: 'P3', label: 'P3 — Medium' },
  { code: 'P4', label: 'P4 — Low' },
];

export const DEFECT_ENVIRONMENT_LIST: string[] = [
  'Production', 'Staging', 'UAT', 'QA', 'Development', 'Performance', 'DR',
];

export const DEFECT_STATUS_LIST: DefectStatusConst[] = [
  'Open', 'In Progress', 'Blocked', 'Fixed', 'Verified', 'Closed', 'Deferred', "Won't Fix", 'Duplicate',
];

export const SEVERITY_COLOR_MAP: Record<DefectSeverityConst, string> = {
  'Very High': '#dc2626',
  'High':      '#f97316',
  'Medium':    '#3b82f6',
  'Low':       '#9ca3af',
};

export const SEVERITY_BADGE_MAP: Record<DefectSeverityConst, { bg: string; text: string }> = {
  'Very High': { bg: 'bg-red-100',    text: 'text-red-800' },
  'High':      { bg: 'bg-orange-100', text: 'text-orange-800' },
  'Medium':    { bg: 'bg-blue-100',   text: 'text-blue-800' },
  'Low':       { bg: 'bg-gray-100',   text: 'text-gray-600' },
};

export const PRIORITY_BADGE_MAP: Record<DefectPriorityConst, { bg: string; text: string }> = {
  P1: { bg: 'bg-red-100',    text: 'text-red-800' },
  P2: { bg: 'bg-orange-100', text: 'text-orange-800' },
  P3: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  P4: { bg: 'bg-gray-100',   text: 'text-gray-600' },
};

// OKR Constants
export const OKR_PROGRESS_BANDS = [
  { label: 'Behind', min: 0, max: 0.39, color: 'bg-red-100 text-red-700', barColor: 'bg-red-500' },
  { label: 'Progressing', min: 0.40, max: 0.59, color: 'bg-amber-100 text-amber-700', barColor: 'bg-amber-500' },
  { label: 'On Track', min: 0.60, max: 0.69, color: 'bg-lime-100 text-lime-700', barColor: 'bg-lime-500' },
  { label: 'Achieved', min: 0.70, max: 1.0, color: 'bg-emerald-100 text-emerald-700', barColor: 'bg-emerald-500' },
] as const;

export const OKR_GRADE_COLORS: Record<string, string> = {
  A: 'bg-green-100 text-green-700',
  B: 'bg-blue-100 text-blue-700',
  C: 'bg-yellow-100 text-yellow-700',
  D: 'bg-orange-100 text-orange-700',
  F: 'bg-red-100 text-red-700',
};

export const OKR_GRADE_THRESHOLDS = { A: 0.80, B: 0.60, C: 0.40, D: 0.20 } as const;

// Payroll Constants
export const PF_WAGE_CEILING = 15000;
export const ESI_GROSS_LIMIT = 21000;
export const ESI_EMPLOYEE_RATE = 0.0075;
export const ESI_EMPLOYER_RATE = 0.0325;
export const TDS_CESS_RATE = 0.04;
export const TDS_STD_DEDUCTION_NEW = 75000;
export const TDS_STD_DEDUCTION_OLD = 50000;
export const LOP_WORKING_DAYS = 30;

export const TDS_SLABS_FY2526_NEW = [
  { from: 0, to: 400000, rate: 0 },
  { from: 400000, to: 800000, rate: 0.05 },
  { from: 800000, to: 1200000, rate: 0.10 },
  { from: 1200000, to: 1600000, rate: 0.15 },
  { from: 1600000, to: 2000000, rate: 0.20 },
  { from: 2000000, to: 2400000, rate: 0.25 },
  { from: 2400000, to: Infinity, rate: 0.30 },
] as const;

export const TDS_87A_REBATE_LIMIT_NEW = 700000;
export const TDS_87A_REBATE_LIMIT_OLD = 500000;

// Invoice Constants
export const GST_RATES = [0, 5, 12, 18, 28] as const;
export const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  partially_paid: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-gray-200 text-gray-500',
};

export const PAYMENT_METHODS = ['bank_transfer', 'upi', 'cheque', 'cash', 'credit_card'] as const;

// Analytics Constants
export const ANOMALY_SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-blue-100 text-blue-700',
};

// ── Master Data Seed Records ──────────────────────────────────────────────────
// Default policy values for all apps. Upserted once on app boot (idempotent).
export const MASTER_DATA_SEED_RECORDS = [
  // PAYROLL POLICIES
  { config_group: 'payroll_policies', config_key: 'pf_wage_ceiling', config_value: '15000', display_name: 'PF Wage Ceiling (₹)', data_type: 'number' },
  { config_group: 'payroll_policies', config_key: 'esi_gross_limit', config_value: '21000', display_name: 'ESI Gross Limit (₹)', data_type: 'number' },
  { config_group: 'payroll_policies', config_key: 'esi_employee_rate', config_value: '0.75', display_name: 'ESI Employee Rate (%)', data_type: 'number' },
  { config_group: 'payroll_policies', config_key: 'esi_employer_rate', config_value: '3.25', display_name: 'ESI Employer Rate (%)', data_type: 'number' },
  { config_group: 'payroll_policies', config_key: 'lop_working_days', config_value: '30', display_name: 'LOP Working Days/Month', data_type: 'number' },
  { config_group: 'payroll_policies', config_key: 'default_tax_regime', config_value: 'new', display_name: 'Default Tax Regime', data_type: 'string' },
  { config_group: 'payroll_policies', config_key: 'payroll_lock_day', config_value: '28', display_name: 'Auto-Lock Day of Month', data_type: 'number' },
  { config_group: 'payroll_policies', config_key: 'grace_period_days', config_value: '3', display_name: 'Grace Period (days)', data_type: 'number' },
  // INVOICE POLICIES
  { config_group: 'invoice_policies', config_key: 'company_name', config_value: 'Acme Technologies Pvt Ltd', display_name: 'Company Name', data_type: 'string' },
  { config_group: 'invoice_policies', config_key: 'company_gstin', config_value: '27AABCA1234B1Z5', display_name: 'Company GSTIN', data_type: 'string' },
  { config_group: 'invoice_policies', config_key: 'company_pan', config_value: 'AABCA1234B', display_name: 'Company PAN', data_type: 'string' },
  { config_group: 'invoice_policies', config_key: 'company_address', config_value: 'Plot 42, MIDC, Andheri East, Mumbai 400093', display_name: 'Company Address', data_type: 'string' },
  { config_group: 'invoice_policies', config_key: 'bank_name', config_value: 'HDFC Bank Ltd', display_name: 'Bank Name', data_type: 'string' },
  { config_group: 'invoice_policies', config_key: 'bank_account', config_value: '50200012345678', display_name: 'Bank Account Number', data_type: 'string' },
  { config_group: 'invoice_policies', config_key: 'bank_ifsc', config_value: 'HDFC0001234', display_name: 'Bank IFSC Code', data_type: 'string' },
  { config_group: 'invoice_policies', config_key: 'default_payment_terms', config_value: '30', display_name: 'Default Payment Terms (days)', data_type: 'number' },
  { config_group: 'invoice_policies', config_key: 'default_tax_rate', config_value: '18', display_name: 'Default GST Rate (%)', data_type: 'number' },
  { config_group: 'invoice_policies', config_key: 'late_fee_rate', config_value: '1.5', display_name: 'Late Fee Rate (% per month)', data_type: 'number' },
  // OKR CONFIG
  { config_group: 'okr_config', config_key: 'max_krs_per_okr', config_value: '5', display_name: 'Max Key Results per OKR', data_type: 'number' },
  { config_group: 'okr_config', config_key: 'checkin_frequency_days', config_value: '7', display_name: 'Check-in Frequency (days)', data_type: 'number' },
  { config_group: 'okr_config', config_key: 'behind_threshold_pct', config_value: '70', display_name: 'Behind Schedule Threshold (%)', data_type: 'number' },
  { config_group: 'okr_config', config_key: 'at_risk_threshold_pct', config_value: '50', display_name: 'At Risk Threshold (%)', data_type: 'number' },
  { config_group: 'okr_config', config_key: 'grade_on_cycle_close', config_value: 'true', display_name: 'Auto-grade on Cycle Close', data_type: 'boolean' },
  // SECURITY POLICIES
  { config_group: 'security_policies', config_key: 'audit_log_retention_days', config_value: '365', display_name: 'Audit Log Retention (days)', data_type: 'number' },
  { config_group: 'security_policies', config_key: 'password_expiry_days', config_value: '90', display_name: 'Password Expiry (days)', data_type: 'number' },
  { config_group: 'security_policies', config_key: 'session_timeout_minutes', config_value: '480', display_name: 'Session Timeout (minutes)', data_type: 'number' },
  { config_group: 'security_policies', config_key: 'mfa_required_roles', config_value: 'admin,c_suite,finance_manager', display_name: 'MFA Required Roles', data_type: 'string' },
];