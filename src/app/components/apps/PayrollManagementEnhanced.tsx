import { useState, useEffect, useCallback, useRef } from 'react';
import { useUnsavedChanges } from '../../context/UnsavedChangesContext';
import { useAuditLogger } from '../../../hooks/useAuditLogger';
import { useEmployeeOptions } from '../../hooks/useSharedData';
import { DollarSign, Users, TrendingUp, Eye, RefreshCw, Loader2, Calendar, Plus, Pencil, Printer, X, Lock, CheckCircle2, XCircle, BarChart2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { usePayrollData, PayrollRecord } from '../../hooks/usePayrollData';
import { useUser } from '../../context/UserContext';
import { t } from '../../../i18n';
import { toast } from 'sonner';
import { API_BASE, publicAnonKey, safeJson, supabase } from '../../utils/constants';
import { PAYROLL_MONTHS, PAYROLL_STATUSES } from '../../../constants/apps/payroll';
import { useSectionPermission } from '../SectionGuard';
import ReportDefectButton from '../ReportDefectButton';

// ==================== CALCULATION CONSTANTS ====================
const PF_RATE = 0.12;
const PF_CAP = 15000; // PF calculated on max ₹15,000 basic
const ESI_GROSS_LIMIT = 21000;
const ESI_EMPLOYEE_RATE = 0.0075; // Employee ESI: 0.75%
const ESI_RATE = 0.0325; // Employer ESI: 3.25%
const PROF_TAX = 200; // default if state not in slabs
const STD_DEDUCTION = 75000; // New regime standard deduction FY 2025-26

// Old Tax Regime TDS FY 2025-26
function calcOldRegimeTDS(annualGross: number, decl: {
  hra_actual?: number; rent_paid?: number; is_metro?: boolean;
  basic_annual?: number; section_80c?: number; section_80d?: number; nps_80ccd?: number;
}): number {
  const stdDed = 50000;
  const basic = decl.basic_annual ?? annualGross * 0.4;
  const hraReceived = decl.hra_actual ?? 0;
  const rentPaid = decl.rent_paid ?? 0;
  const hraLimit = decl.is_metro ? basic * 0.5 : basic * 0.4;
  const hraExempt = Math.min(hraReceived, hraLimit, Math.max(0, rentPaid - basic * 0.1));
  const c80 = Math.min(decl.section_80c ?? 0, 150000);
  const d80 = Math.min(decl.section_80d ?? 0, 25000);
  const nps = Math.min(decl.nps_80ccd ?? 0, 50000);
  const taxable = Math.max(0, annualGross - stdDed - hraExempt - c80 - d80 - nps);
  let tax = 0;
  if (taxable > 1000000) tax = 112500 + (taxable - 1000000) * 0.30;
  else if (taxable > 500000) tax = 12500 + (taxable - 500000) * 0.20;
  else if (taxable > 250000) tax = (taxable - 250000) * 0.05;
  if (taxable <= 500000) tax = 0; // 87A rebate
  return Math.round(tax * 1.04 / 12); // monthly with cess
}

// New Tax Regime Slabs FY 2025-26
function calcNewRegimeTDS(annualTaxableIncome: number): number {
  if (annualTaxableIncome <= 0) return 0;
  let tax = 0;
  const slabs = [
    { from: 0,       to: 300000,  rate: 0.00 },
    { from: 300000,  to: 700000,  rate: 0.05 },
    { from: 700000,  to: 1000000, rate: 0.10 },
    { from: 1000000, to: 1200000, rate: 0.15 },
    { from: 1200000, to: 1500000, rate: 0.20 },
    { from: 1500000, to: Infinity, rate: 0.30 },
  ];
  for (const slab of slabs) {
    if (annualTaxableIncome > slab.from) {
      const chunk = Math.min(annualTaxableIncome, slab.to) - slab.from;
      tax += chunk * slab.rate;
    }
  }
  // 87A Rebate: if income <= 7,00,000 no tax
  if (annualTaxableIncome <= 700000) tax = 0;
  // Health & Education Cess 4%
  tax = Math.round(tax * 1.04);
  return tax;
}

type Tab = 'payslips' | 'processing' | 'summary' | 'salary-structure' | 'payslip-viewer' | 'salary-revision' | 'compliance';

const MONTHS = PAYROLL_MONTHS;

const FY_MONTHS = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'] as const;

// TDS slabs FY 2025-26 for expandable breakdown
const TDS_SLABS_2526 = [
  { label: '₹0 – ₹3L', from: 0, to: 300000, rate: 0 },
  { label: '₹3L – ₹7L', from: 300000, to: 700000, rate: 5 },
  { label: '₹7L – ₹10L', from: 700000, to: 1000000, rate: 10 },
  { label: '₹10L – ₹12L', from: 1000000, to: 1200000, rate: 15 },
  { label: '₹12L – ₹15L', from: 1200000, to: 1500000, rate: 20 },
  { label: 'Above ₹15L', from: 1500000, to: null, rate: 30 },
];
const CURRENT_FY = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;

// ==================== TYPES ====================
interface SalaryStructure {
  id: string;
  employee_id: string;
  employee_name: string;
  basic_salary: number;
  hra: number;
  transport_allowance: number;
  medical_allowance?: number;
  other_allowances: number;
  effective_from: string;
}

interface SalaryCalc {
  gross: number;
  pf: number;
  esi: number;
  profTax: number;
  tds: number;
  totalDeductions: number;
  net: number;
}

interface PayrollLock {
  id: string;
  month: string;
  year: number;
  locked_by: string;
  locked_at: string;
  unlocked_by?: string;
  unlocked_at?: string;
  notes?: string;
}

interface SalaryRevision {
  id: string;
  employee_id: string;
  old_ctc: number;
  new_ctc: number;
  effective_from: string;
  revision_type: string;
  approved_by?: string;
  submitted_by?: string;
  approval_status: string;
  notes?: string;
  created_at?: string;
}

// ==================== TYPES (continued) ====================
interface PtSlab {
  state_code: string;
  min_salary: number;
  max_salary: number | null;
  monthly_pt: number;
  notes?: string;
}

// ==================== HELPERS ====================
function getProfTax(ptSlabs: PtSlab[], stateCode: string | null | undefined, grossSalary: number, month: number): number {
  if (!stateCode) return PROF_TAX;
  if (!ptSlabs || ptSlabs.length === 0) return 0;
  const stateSlabs = ptSlabs.filter(s => s.state_code === stateCode).sort((a, b) => b.min_salary - a.min_salary);
  if (stateSlabs.length === 0) return 0;
  const slab = stateSlabs.find(s => grossSalary >= s.min_salary && (s.max_salary === null || grossSalary <= s.max_salary));
  if (!slab) return 0;
  // Maharashtra Feb special case: ₹300 for highest slab
  if (stateCode === 'MH' && month === 2 && !stateSlabs.find(s => s.min_salary > slab.min_salary)) return 300;
  return slab.monthly_pt;
}

function fmtINR(n: number) {
  return '₹' + (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function calcDeductions(s: SalaryStructure, ptSlabs?: PtSlab[], stateCode?: string | null, month?: number, decl?: any, policies?: { pf_wage_ceiling?: number; esi_gross_limit?: number; esi_employee_rate?: number }): SalaryCalc {
  const pfCap = typeof policies?.pf_wage_ceiling === 'number' ? policies.pf_wage_ceiling : PF_CAP;
  const esiGrossLimit = typeof policies?.esi_gross_limit === 'number' ? policies.esi_gross_limit : ESI_GROSS_LIMIT;
  const esiEmpRate = typeof policies?.esi_employee_rate === 'number' ? policies.esi_employee_rate : ESI_EMPLOYEE_RATE;
  const gross = (s.basic_salary || 0) + (s.hra || 0) + (s.transport_allowance || 0) + (s.medical_allowance || 0) + (s.other_allowances || 0);
  const basic = s.basic_salary || 0;
  const empPF = Math.round(Math.min(basic, pfCap) * PF_RATE);
  const emplrPF = Math.round(Math.min(basic, pfCap) * PF_RATE);
  const esi = gross <= esiGrossLimit ? Math.round(gross * esiEmpRate) : 0;
  const profTax = (ptSlabs && ptSlabs.length > 0)
    ? getProfTax(ptSlabs, stateCode ?? null, gross, month ?? (new Date().getMonth() + 1))
    : PROF_TAX;
  const annualCTC = gross * 12;
  let tds: number;
  const regime = decl?.tax_regime ?? (s as any).tax_regime ?? 'new';
  if (regime === 'old') {
    tds = calcOldRegimeTDS(annualCTC, {
      hra_actual: decl?.hra_declaration ?? 0,
      rent_paid: decl?.rent_paid ?? 0,
      is_metro: decl?.is_metro ?? false,
      basic_annual: basic * 12,
      section_80c: decl?.declared_80c ?? 0,
      section_80d: decl?.declared_80d ?? 0,
      nps_80ccd: decl?.declared_nps ?? 0,
    });
  } else {
    // New Tax Regime TDS: annualCTC - stdDeduction - employerPF
    const annualTaxable = Math.max(0, annualCTC - STD_DEDUCTION - (emplrPF * 12));
    const annualTDS = calcNewRegimeTDS(annualTaxable);
    tds = Math.round(annualTDS / 12);
  }
  const totalDeductions = empPF + esi + profTax + tds;
  const net = gross - totalDeductions;
  return { gross, pf: empPF, esi, profTax, tds, totalDeductions, net };
}

function statusBadge(status: string) {
  const base = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
  if (status === 'Paid') return `${base} bg-green-100 text-green-800`;
  if (status === 'Approved') return `${base} bg-green-100 text-green-800`;
  if (status === 'Processed') return `${base} bg-blue-100 text-blue-800`;
  if (status === 'Processing') return `${base} bg-blue-100 text-blue-800`;
  if (status === 'Rejected') return `${base} bg-red-100 text-red-800`;
  if (status === 'On Hold') return `${base} bg-orange-100 text-orange-800`;
  return `${base} bg-yellow-100 text-yellow-800`;
}

function ApprovedBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
      <Lock className="h-3 w-3" /> {t('payroll.approved')}
    </span>
  );
}

function fmt(n: number) {
  return fmtINR(n);
}

const SALARY_STRUCT_URL = `${API_BASE}/payroll/salary-structures`;

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
    download: filename,
  });
  a.click();
}

function exportNEFT(records: PayrollRecord[], bank = 'HDFC') {
  const filename = `neft-${bank.toLowerCase()}-${new Date().toISOString().slice(0, 7)}.csv`;
  const narrationMonth = new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  let header = '';
  const rows = records.map((r, idx) => {
    const emp = r as any;
    const accNo = emp.bank_account_number ? String(emp.bank_account_number) : 'MISSING';
    const ifsc = emp.bank_ifsc ? String(emp.bank_ifsc) : 'MISSING';
    if (accNo === 'MISSING' || ifsc === 'MISSING') {
      console.warn(`Missing bank details for employee: ${r.employeeName} (${r.employeeId})`);
    }
    const amount = String(r.netSalary ?? 0);
    const narration = `Salary ${narrationMonth}`;
    const payRef = `SAL-${r.employeeId || idx + 1}-${new Date().toISOString().slice(0, 7)}`;
    if (bank === 'HDFC') {
      // Beneficiary Name,Beneficiary Account Number,Beneficiary IFSC,Amount,Debit Account Number,Payment Reference,Narration
      return [r.employeeName, accNo, ifsc, amount, emp.bank_debit_account || '', payRef, narration].join(',');
    } else if (bank === 'ICICI') {
      // Emp ID,Name,Account No,IFSC Code,Amount,Payment Mode,Remarks
      return [r.employeeId || String(idx + 1), r.employeeName, accNo, ifsc, amount, 'NEFT', narration].join(',');
    } else if (bank === 'SBI') {
      // Serial No,Beneficiary Name,Account Number,IFSC Code,Amount,Mobile,Email,Remarks
      return [String(idx + 1), r.employeeName, accNo, ifsc, amount, emp.mobile || '', emp.email || '', narration].join(',');
    } else if (bank === 'AXIS') {
      // Txn Ref No,Beneficiary Name,A/C No,IFSC,Amount,Payment Type,Narration
      return [payRef, r.employeeName, accNo, ifsc, amount, 'NEFT', narration].join(',');
    } else if (bank === 'KOTAK') {
      // Customer Name,Account Number,IFSC Code,Amount,Payment Reference,Mobile No
      return [r.employeeName, accNo, ifsc, amount, payRef, emp.mobile || ''].join(',');
    } else {
      // Generic: Employee Name,Account Number,IFSC Code,Bank Name,Branch,Amount
      return [r.employeeName, accNo, ifsc, emp.bank_name || '', emp.bank_branch || '', amount].join(',');
    }
  });

  if (bank === 'HDFC') header = 'Beneficiary Name,Beneficiary Account Number,Beneficiary IFSC,Amount,Debit Account Number,Payment Reference,Narration';
  else if (bank === 'ICICI') header = 'Emp ID,Name,Account No,IFSC Code,Amount,Payment Mode,Remarks';
  else if (bank === 'SBI') header = 'Serial No,Beneficiary Name,Account Number,IFSC Code,Amount,Mobile,Email,Remarks';
  else if (bank === 'AXIS') header = 'Txn Ref No,Beneficiary Name,A/C No,IFSC,Amount,Payment Type,Narration';
  else if (bank === 'KOTAK') header = 'Customer Name,Account Number,IFSC Code,Amount,Payment Reference,Mobile No';
  else header = 'Employee Name,Account Number,IFSC Code,Bank Name,Branch,Amount';

  const content = [header, ...rows].join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([content], { type: 'text/csv' })),
    download: filename,
  });
  a.click();
}

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${publicAnonKey}`,
      ...(options?.headers || {}),
    },
  });
  return safeJson(res);
}

// ==================== LEGACY PAYSLIP MODAL ====================
interface PayslipModalProps {
  record: PayrollRecord;
  onClose: () => void;
}

function PayslipModal({ record, onClose }: PayslipModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{t('payroll.payslip')}</h2>
              <p className="text-green-100 text-sm mt-1">{record.employeeName}</p>
            </div>
            <DollarSign className="h-10 w-10 opacity-30" />
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">{t('payroll.month')}</p>
              <p className="font-semibold">{record.month}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('payroll.year')}</p>
              <p className="font-semibold">{record.year}</p>
            </div>
          </div>
          <hr />
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('payroll.basicSalary')}</span>
              <span className="font-medium">{fmt(record.basicSalary)}</span>
            </div>
            <div className="flex justify-between text-red-600">
              <span>{t('payroll.deductions')}</span>
              <span>- {fmt(record.totalDeductions)}</span>
            </div>
            <hr />
            <div className="flex justify-between font-bold text-base">
              <span>{t('payroll.netSalary')}</span>
              <span className="text-green-700">{fmt(record.netSalary)}</span>
            </div>
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className={statusBadge(record.status)}>{record.status}</span>
            {record.processedAt && (
              <span className="text-xs text-muted-foreground">
                {t('payroll.processed')} {new Date(record.processedAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-full mt-4 py-2 px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== SALARY BREAKDOWN MODAL ====================
function SalaryBreakdownModal({ record, onClose }: { record: PayrollRecord; onClose: () => void }) {
  const lopDays = record.lopDays || 0;
  const workingDays = record.workingDays || 26;
  const presentDays = record.presentDays || Math.max(0, workingDays - lopDays);
  const basic = record.basicSalary || 0;
  const hra = record.hra || 0;
  const transport = record.transportAllowance || 0;
  const medical = record.medicalAllowance || 0;
  const otherEarnings = record.otherAllowances || 0;
  const gross = record.grossSalary || (basic + hra + transport + medical + otherEarnings);
  const pf = record.pfDeduction || 0;
  const tds = record.taxDeduction || 0;
  const otherDed = record.otherDeductions || 0;
  const lopDeduction = record.lopDeduction || 0;
  const totalDed = record.totalDeductions || (pf + tds + otherDed + lopDeduction);
  const net = record.netSalary || Math.max(0, gross - totalDed);

  const Row = ({ label, value, accent }: { label: string; value: number; accent?: string }) => (
    <div className={`flex justify-between items-center py-1.5 text-sm border-b border-border/50 last:border-0 ${accent ?? ''}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium tabular-nums ${accent ? 'text-inherit' : 'text-foreground'}`}>{fmtINR(value)}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="font-semibold text-foreground">{record.employeeName}</p>
            <p className="text-xs text-muted-foreground">{record.month} {record.year} · {t('payroll.salaryBreakdown')}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors"><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Attendance */}
          <div className="rounded-lg bg-muted/50 px-4 py-3 flex justify-between text-sm">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-0.5">{t('payroll.workingDays')}</p>
              <p className="font-bold text-foreground text-lg">{workingDays}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-0.5">{t('payroll.daysPresent')}</p>
              <p className="font-bold text-green-600 text-lg">{presentDays}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-0.5">{t('payroll.lopDays')}</p>
              <p className={`font-bold text-lg ${lopDays > 0 ? 'text-red-500' : 'text-foreground'}`}>{lopDays}</p>
            </div>
          </div>

          {/* Earnings */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t('payroll.earnings')}</p>
            <div className="rounded-lg border border-border px-4 py-2">
              <Row label={t('payroll.basicSalary')} value={basic} />
              <Row label={t('payroll.hra')} value={hra} />
              <Row label={t('payroll.transportAllowance')} value={transport} />
              {medical > 0 && <Row label={t('payroll.medicalAllowance')} value={medical} />}
              {otherEarnings > 0 && <Row label={t('payroll.otherAllowances')} value={otherEarnings} />}
              <div className="flex justify-between items-center pt-2 mt-1 border-t border-border text-sm font-semibold">
                <span>{t('payroll.grossSalary')}</span>
                <span className="text-green-700 tabular-nums">{fmtINR(gross)}</span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t('payroll.deductions')}</p>
            <div className="rounded-lg border border-border px-4 py-2">
              {pf > 0 && <Row label={t('payroll.pfEmployee12')} value={pf} />}
              {otherDed > 0 && <Row label={t('payroll.esiProfTax')} value={otherDed} />}
              {tds > 0 && <Row label={t('payroll.tds')} value={tds} />}
              {lopDeduction > 0 && <Row label={`${t('payroll.lossOfPay')} (${lopDays} days)`} value={lopDeduction} />}
              <div className="flex justify-between items-center pt-2 mt-1 border-t border-border text-sm font-semibold">
                <span>{t('payroll.totalDeductions')}</span>
                <span className="text-red-600 tabular-nums">{fmtINR(totalDed)}</span>
              </div>
            </div>
          </div>

          {/* Net Pay */}
          <div className="rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 px-4 py-3 flex items-center justify-between">
            <span className="font-semibold text-green-800 dark:text-green-300">{t('payroll.netPay')}</span>
            <span className="text-xl font-bold text-green-700 dark:text-green-400 tabular-nums">{fmtINR(net)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className={`${statusBadge(record.status)} `}>{record.status}</span>
            <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground transition-colors">{t('common.close')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== SALARY STRUCTURE MODAL ====================
interface SalaryStructureModalProps {
  existing?: SalaryStructure | null;
  onClose: () => void;
  onSaved: () => void;
}

function SalaryStructureModal({ existing, onClose, onSaved }: SalaryStructureModalProps) {
  const [form, setForm] = useState({
    employee_id: existing?.employee_id || '',
    employee_name: existing?.employee_name || '',
    basic_salary: existing?.basic_salary ?? '',
    hra: existing?.hra ?? '',
    transport_allowance: existing?.transport_allowance ?? '',
    other_allowances: existing?.other_allowances ?? '',
    effective_from: existing?.effective_from || new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const initialForm = useRef(form);
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm.current);
  useUnsavedChanges(isDirty);

  const handleClose = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Discard them?')) return;
    onClose();
  };

  // Employee picker state
  const { options: empOptions } = useEmployeeOptions();
  const [empQuery, setEmpQuery] = useState(existing?.employee_name || '');
  const [empOpen, setEmpOpen] = useState(false);
  const empRef = useRef<HTMLDivElement>(null);
  const filteredEmps = empQuery.trim()
    ? empOptions.filter(e =>
        e.label.toLowerCase().includes(empQuery.toLowerCase()) ||
        e.value.toLowerCase().includes(empQuery.toLowerCase())
      )
    : empOptions;

  const selectEmployee = (opt: typeof empOptions[number]) => {
    setForm(f => ({ ...f, employee_id: opt.value, employee_name: opt.label }));
    setEmpQuery(opt.label);
    setEmpOpen(false);
    setErrors(e => ({ ...e, employee_id: '' }));
  };

  const n = (v: string | number) => Number(v) || 0;
  const gross = n(form.basic_salary) + n(form.hra) + n(form.transport_allowance) + n(form.other_allowances);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors: Record<string, string> = {};
    if (!form.employee_id?.trim()) validationErrors.employee_id = t('validation.payroll.employee');
    if (n(form.basic_salary) <= 0) validationErrors.basic_salary = t('validation.payroll.basicSalary');
    if (!form.effective_from?.trim()) validationErrors.effective_from = t('validation.payroll.effectiveDate');
    if (n(form.hra) < 0) validationErrors.hra = t('validation.payroll.negativeComponent');
    if (n(form.transport_allowance) < 0) validationErrors.transport_allowance = t('validation.payroll.negativeComponent');
    if (n(form.other_allowances) < 0) validationErrors.other_allowances = t('validation.payroll.negativeComponent');
    const newCtc = n(form.basic_salary) + n(form.hra) + n(form.transport_allowance) + n(form.other_allowances);
    if (newCtc > 0 && n(form.basic_salary) < newCtc * 0.40) {
      toast.error("Basic salary must be at least 40% of CTC");
      return;
    }
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error(t('common.error'));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const payload = {
        employee_id: form.employee_id,
        employee_name: form.employee_name,
        basic_salary: n(form.basic_salary),
        hra: n(form.hra),
        transport_allowance: n(form.transport_allowance),
        other_allowances: n(form.other_allowances),
        effective_from: form.effective_from,
      };
      const res = existing
        ? await apiFetch(`${SALARY_STRUCT_URL}/${existing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        : await apiFetch(SALARY_STRUCT_URL, { method: 'POST', body: JSON.stringify(payload) });
      if (res.success) {
        toast.success(existing ? t('payroll.salaryStructureUpdated') : t('payroll.salaryStructureCreated'));
        onSaved();
        onClose();
      } else {
        toast.error(res.error || t('common.error'));
      }
    } catch {
      toast.error(t('common.networkError'));
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof typeof form, type = 'text') => (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={form[key] as string}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      {errors[key] && <p className="text-xs text-red-500 mt-0.5">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold text-foreground">{existing ? t('payroll.editSalaryStructure') : t('payroll.addSalaryStructure')}</h2>
          <button onClick={handleClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Employee picker — search by name or ID, selecting fills both fields */}
          <div ref={empRef} className="relative space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t('payroll.employeeLabel')} <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={empQuery}
              placeholder={t('payroll.searchEmployee')}
              onFocus={() => setEmpOpen(true)}
              onChange={e => {
                setEmpQuery(e.target.value);
                setEmpOpen(true);
                // If the user clears the field, clear the linked values too
                if (!e.target.value) setForm(f => ({ ...f, employee_id: '', employee_name: '' }));
              }}
              onBlur={() => setTimeout(() => setEmpOpen(false), 150)}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.employee_id ? 'border-red-400' : 'border-border'}`}
            />
            {errors.employee_id && <p className="text-xs text-red-500 mt-0.5">{errors.employee_id}</p>}
            {empOpen && (
              <div className="absolute z-20 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                {filteredEmps.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">{t('payroll.noEmployeesFound')}</p>
                ) : filteredEmps.map(e => (
                  <button
                    key={e.value}
                    type="button"
                    onMouseDown={() => selectEmployee(e)}
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-muted border-b border-border last:border-b-0 transition-colors ${e.value === form.employee_id ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 font-medium' : 'text-foreground'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{e.label}</span>
                      {(e as any).employeeCode && <span className="text-xs font-mono text-muted-foreground">{(e as any).employeeCode}</span>}
                    </div>
                    {e.department && <span className="text-xs text-muted-foreground">{e.department}</span>}
                  </button>
                ))}
              </div>
            )}
            {/* Show selected employee ID as read-only info */}
            {form.employee_id && (
              <p className="text-xs text-muted-foreground font-mono mt-0.5">ID: {form.employee_id}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field(t('payroll.basicSalaryInr'), 'basic_salary', 'number')}
            {field(t('payroll.hraInr'), 'hra', 'number')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field(t('payroll.transportAllowanceInr'), 'transport_allowance', 'number')}
            {field(t('payroll.otherAllowancesInr'), 'other_allowances', 'number')}
          </div>
          {field(t('payroll.effectiveFrom'), 'effective_from', 'date')}
          <div className="rounded-lg bg-muted p-3 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>{t('payroll.grossSalary')}</span>
              <span className="font-medium text-foreground">{fmtINR(gross)}</span>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2 px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {existing ? t('common.update') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== NUMBER TO WORDS ====================
function numberToWords(amount: number): string {
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  if (amount === 0) return 'Zero';
  function numToWord(n: number): string {
    if (n < 20) return units[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + units[n % 10] : '');
    if (n < 1000) return units[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + numToWord(n % 100) : '');
    if (n < 100000) return numToWord(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + numToWord(n % 1000) : '');
    if (n < 10000000) return numToWord(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + numToWord(n % 100000) : '');
    return numToWord(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + numToWord(n % 10000000) : '');
  }
  return 'Rupees ' + numToWord(Math.round(amount)) + ' Only';
}

// ==================== DETAILED PAYSLIP MODAL ====================
interface DetailedPayslipModalProps {
  record: PayrollRecord;
  salaryStructures: SalaryStructure[];
  onClose: () => void;
}

function DetailedPayslipModal({ record, salaryStructures, onClose }: DetailedPayslipModalProps) {
  const [showCtcBreakdown, setShowCtcBreakdown] = useState(false);
  const [companyConfig, setCompanyConfig] = useState<Record<string, string>>({});

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('master_data_config')
        .select('config_key, config_value')
        .eq('config_group', 'invoice_policies');
      if (data) {
        const cfg: Record<string, string> = {};
        data.forEach((row: { config_key: string; config_value: unknown }) => {
          cfg[row.config_key] = String(row.config_value ?? '');
        });
        setCompanyConfig(cfg);
      }
    })();
  }, []);

  const struct = salaryStructures.find((s) => s.employee_id === record.employeeId);

  const basic = record.basicSalary || struct?.basic_salary || 0;
  const hra = record.hra || struct?.hra || 0;
  const transport = record.transportAllowance || struct?.transport_allowance || 0;
  const other = record.otherAllowances || struct?.other_allowances || 0;
  const gross = record.grossSalary || (basic + hra + transport + other) || 0;

  const pf = record.pfDeduction || Math.round(Math.min(basic, 15000) * 0.12);
  const tds = record.taxDeduction || 0;
  const esiComputed = gross > 0 && gross <= ESI_GROSS_LIMIT ? Math.round(gross * ESI_EMPLOYEE_RATE) : 0;
  const esi = esiComputed;
  const profTax = record.otherDeductions
    ? Math.max(0, record.otherDeductions - esiComputed)
    : (gross > 10000 ? PROF_TAX : 0);
  const lopDays = record.lopDays || 0;
  const lopDeduction = record.lopDeduction || (lopDays > 0 ? Math.round((gross / 26) * lopDays) : 0);
  const totalDed = record.totalDeductions || (pf + esi + profTax + tds + lopDeduction);
  const net = record.netSalary || Math.max(0, gross - totalDed);

  // YTD: months elapsed in FY as of record month (April = month 1)
  const recordMonthIdx = FY_MONTHS.indexOf(record.month as typeof FY_MONTHS[number]);
  const ytdMonths = recordMonthIdx >= 0 ? recordMonthIdx + 1 : 1;

  // CTC Breakdown
  const employerPF = Math.round(Math.min(basic, 15000) * 0.0367);
  const employerESI = gross <= ESI_GROSS_LIMIT ? Math.round(gross * ESI_RATE) : 0;
  const totalCTC = gross + employerPF + employerESI;

  const emp = record as any;
  const panNumber = emp.pan_number || 'XXXXXXXXXX';
  const uanNumber = emp.uan_number || '—';
  const doj = emp.date_of_joining
    ? new Date(emp.date_of_joining).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
  const bankAcct = emp.bank_account_number ? 'XXXXXX' + String(emp.bank_account_number).slice(-4) : '—';

  const handlePrint = () => { window.print(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <style>{`
        @media print {
          body > * { display: none !important; }
          #payslip-print { display: block !important; position: fixed; top: 0; left: 0; width: 100%; }
        }
        #payslip-print { display: block; }
      `}</style>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold text-foreground">{t('payroll.payslip')}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              {t('payroll.downloadPdf')}
            </button>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div id="payslip-print" className="p-6 space-y-4">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-lg font-bold text-foreground">{companyConfig.company_name || 'JL You Portal'}</h1>
            {(companyConfig.company_address) && (
              <p className="text-xs text-muted-foreground mt-0.5">{companyConfig.company_address}</p>
            )}
            {(companyConfig.company_gstin || companyConfig.company_pan) && (
              <p className="text-xs text-muted-foreground">
                {companyConfig.company_gstin && <span>GSTIN: {companyConfig.company_gstin}</span>}
                {companyConfig.company_gstin && companyConfig.company_pan && <span className="mx-2">·</span>}
                {companyConfig.company_pan && <span>PAN: {companyConfig.company_pan}</span>}
              </p>
            )}
            <p className="text-sm font-semibold text-muted-foreground mt-0.5">PAYSLIP — {record.month} {record.year}</p>
          </div>

          {/* Employee Info */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm border border-border rounded-lg p-4">
            <div>
              <span className="text-muted-foreground">{t('payroll.employeeName')}</span>
              <p className="font-medium text-foreground">{record.employeeName}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('common.department')}</span>
              <p className="font-medium text-foreground">{emp.department || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('payroll.employeeId')}</span>
              <p className="font-medium text-foreground">{record.employeeId || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('payroll.designation')}</span>
              <p className="font-medium text-foreground">{emp.designation || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">PAN</span>
              <p className="font-medium text-foreground font-mono text-xs">{panNumber}</p>
            </div>
            <div>
              <span className="text-muted-foreground">UAN</span>
              <p className="font-medium text-foreground">{uanNumber}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Date of Joining</span>
              <p className="font-medium text-foreground">{doj}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Bank A/C</span>
              <p className="font-medium text-foreground font-mono">{bankAcct}</p>
            </div>
          </div>

          {/* Earnings table with YTD */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="bg-muted px-4 py-2">
              <p className="font-semibold text-foreground text-sm">{t('payroll.earningsHeader')}</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Component</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">Monthly</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">YTD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                <tr>
                  <td className="px-4 py-2 text-muted-foreground">{t('payroll.basic')}</td>
                  <td className="px-4 py-2 text-right">{fmtINR(basic)}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{fmtINR(basic * ytdMonths)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-muted-foreground">{t('payroll.hra')}</td>
                  <td className="px-4 py-2 text-right">{fmtINR(hra)}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{fmtINR(hra * ytdMonths)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-muted-foreground">{t('payroll.transport')}</td>
                  <td className="px-4 py-2 text-right">{fmtINR(transport)}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{fmtINR(transport * ytdMonths)}</td>
                </tr>
                {other > 0 && (
                  <tr>
                    <td className="px-4 py-2 text-muted-foreground">{t('payroll.other')}</td>
                    <td className="px-4 py-2 text-right">{fmtINR(other)}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{fmtINR(other * ytdMonths)}</td>
                  </tr>
                )}
                <tr className="bg-muted/30 font-semibold">
                  <td className="px-4 py-2">{t('payroll.gross')}</td>
                  <td className="px-4 py-2 text-right text-green-700">{fmtINR(gross)}</td>
                  <td className="px-4 py-2 text-right text-green-700">{fmtINR(gross * ytdMonths)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Deductions table with YTD */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="bg-muted px-4 py-2">
              <p className="font-semibold text-foreground text-sm">{t('payroll.deductionsHeader')}</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Component</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">Monthly</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">YTD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                <tr>
                  <td className="px-4 py-2 text-muted-foreground">{t('payroll.pf12')}</td>
                  <td className="px-4 py-2 text-right text-red-600">{fmtINR(pf)}</td>
                  <td className="px-4 py-2 text-right text-red-400">{fmtINR(pf * ytdMonths)}</td>
                </tr>
                {esi > 0 && (
                  <tr>
                    <td className="px-4 py-2 text-muted-foreground">ESI (0.75%)</td>
                    <td className="px-4 py-2 text-right text-red-600">{fmtINR(esi)}</td>
                    <td className="px-4 py-2 text-right text-red-400">{fmtINR(esi * ytdMonths)}</td>
                  </tr>
                )}
                {profTax > 0 && (
                  <tr>
                    <td className="px-4 py-2 text-muted-foreground">Prof. Tax</td>
                    <td className="px-4 py-2 text-right text-red-600">{fmtINR(profTax)}</td>
                    <td className="px-4 py-2 text-right text-red-400">{fmtINR(profTax * ytdMonths)}</td>
                  </tr>
                )}
                {tds > 0 && (
                  <tr>
                    <td className="px-4 py-2 text-muted-foreground">{t('payroll.tds')}</td>
                    <td className="px-4 py-2 text-right text-red-600">{fmtINR(tds)}</td>
                    <td className="px-4 py-2 text-right text-red-400">{fmtINR(tds * ytdMonths)}</td>
                  </tr>
                )}
                {lopDays > 0 && (
                  <tr>
                    <td className="px-4 py-2 text-muted-foreground">{t('payroll.lossOfPay')} ({lopDays} days)</td>
                    <td className="px-4 py-2 text-right text-red-600">{fmtINR(lopDeduction)}</td>
                    <td className="px-4 py-2 text-right text-red-400">{fmtINR(lopDeduction)}</td>
                  </tr>
                )}
                <tr className="bg-muted/30 font-semibold">
                  <td className="px-4 py-2">{t('payroll.totalDed')}</td>
                  <td className="px-4 py-2 text-right text-red-700">{fmtINR(totalDed)}</td>
                  <td className="px-4 py-2 text-right text-red-700">{fmtINR(totalDed * ytdMonths)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Net Pay */}
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
            <p className="text-xs text-green-600 font-medium uppercase tracking-wide mb-0.5">{t('payroll.netPay')}</p>
            <p className="text-2xl font-bold text-green-700">{fmtINR(net)}</p>
            <p className="text-xs text-gray-500 italic mt-1">{numberToWords(net)}</p>
          </div>

          {/* CTC Breakdown collapsible */}
          <div>
            <button
              onClick={() => setShowCtcBreakdown((s) => !s)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>{showCtcBreakdown ? '▴' : '▾'}</span> CTC Breakdown
            </button>
            {showCtcBreakdown && (
              <div className="mt-2 border border-border rounded-lg text-sm overflow-hidden">
                <table className="w-full">
                  <tbody className="divide-y divide-border/50">
                    <tr>
                      <td className="px-4 py-2 text-muted-foreground">Employee Cost (Gross)</td>
                      <td className="px-4 py-2 text-right">{fmtINR(gross)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 text-muted-foreground">Employer PF (3.67%)</td>
                      <td className="px-4 py-2 text-right">{fmtINR(employerPF)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 text-muted-foreground">Employer ESI (3.25%)</td>
                      <td className="px-4 py-2 text-right">{fmtINR(employerESI)}</td>
                    </tr>
                    <tr className="bg-muted/30 font-semibold">
                      <td className="px-4 py-2">Total CTC</td>
                      <td className="px-4 py-2 text-right text-green-700">{fmtINR(totalCTC)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className={statusBadge(record.status)}>{record.status}</span>
            {record.processedAt && (
              <span className="text-xs text-muted-foreground">{t('payroll.processed')} {new Date(record.processedAt).toLocaleDateString()}</span>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border pt-3">
            <p className="text-xs text-center text-muted-foreground italic">This is a computer-generated payslip. No signature required.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================
interface Props { accessToken?: string; onLogout?: () => void; }
export function PayrollManagementEnhanced(_props: Props) {
  const { currentUser } = useUser();
  const { log } = useAuditLogger();
  const { records, stats, loading, processPayroll, refresh } = usePayrollData();

  // All permissions sourced exclusively from the DB role_permissions matrix
  const secProcessPayroll  = useSectionPermission('payroll', 'process_payroll');
  const secApprovePayroll  = useSectionPermission('payroll', 'approve_payroll');
  const secSalaryStructure = useSectionPermission('payroll', 'salary_structure');
  const secCompliance      = useSectionPermission('payroll', 'compliance');
  const secRevHistory      = useSectionPermission('payroll', 'revision_history');

  const isPrivileged = secProcessPayroll;
  const canEdit      = secSalaryStructure;

  const [activeTab, setActiveTab] = useState<Tab>('payslips');
  const [selectedRecord, setSelectedRecord] = useState<PayrollRecord | null>(null);
  const [breakdownRecord, setBreakdownRecord] = useState<PayrollRecord | null>(null);
  const [processMonth, setProcessMonth] = useState(MONTHS[new Date().getMonth()]);
  const [processYear, setProcessYear] = useState(new Date().getFullYear());
  const [processing, setProcessing] = useState(false);

  // Salary structure state
  const [salaryStructures, setSalaryStructures] = useState<SalaryStructure[]>([]);
  const [structLoading, setStructLoading] = useState(false);
  const [showStructModal, setShowStructModal] = useState(false);
  const [editingStruct, setEditingStruct] = useState<SalaryStructure | null>(null);

  // My Payslips card grid state
  const [myPayslipFY, setMyPayslipFY] = useState(CURRENT_FY);
  const [myPayslipViewRecord, setMyPayslipViewRecord] = useState<PayrollRecord | null>(null);

  // Payslip viewer state
  const [viewerMonth, setViewerMonth] = useState(MONTHS[new Date().getMonth()]);
  const [viewerYear, setViewerYear] = useState(new Date().getFullYear());
  const [viewerRecord, setViewerRecord] = useState<PayrollRecord | null>(null);

  // Compliance tab separate period state
  const [complianceMonth, setComplianceMonth] = useState(MONTHS[new Date().getMonth()]);
  const [complianceYear, setComplianceYear] = useState(new Date().getFullYear());

  // Master data config: payroll policies (loaded from DB, seeded with defaults)
  const [payrollPolicies, setPayrollPolicies] = useState({
    pf_wage_ceiling: 15000,
    esi_gross_limit: 21000,
    esi_employee_rate: 0.0075,
    esi_employer_rate: 0.0325,
    standard_deduction_new: 75000,
    standard_deduction_old: 50000,
    processing_day: 28,
    lop_working_days: 30,
    default_tax_regime: 'new',
    email_payslip: true,
  });

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('master_data_config')
        .select('config_key, config_value')
        .eq('config_group', 'payroll_policies');
      if (data && data.length > 0) {
        const overrides: Record<string, unknown> = {};
        data.forEach((row: { config_key: string; config_value: unknown }) => { overrides[row.config_key] = row.config_value; });
        setPayrollPolicies(prev => ({ ...prev, ...overrides }));
      } else {
        const defaults = [
          { config_group: 'payroll_policies', config_key: 'pf_wage_ceiling', config_value: 15000, display_name: 'PF Wage Ceiling', data_type: 'number' },
          { config_group: 'payroll_policies', config_key: 'esi_gross_limit', config_value: 21000, display_name: 'ESI Gross Limit', data_type: 'number' },
          { config_group: 'payroll_policies', config_key: 'esi_employee_rate', config_value: 0.0075, display_name: 'ESI Employee Rate', data_type: 'number' },
          { config_group: 'payroll_policies', config_key: 'esi_employer_rate', config_value: 0.0325, display_name: 'ESI Employer Rate', data_type: 'number' },
          { config_group: 'payroll_policies', config_key: 'standard_deduction_new', config_value: 75000, display_name: 'Standard Deduction (New Regime)', data_type: 'number' },
          { config_group: 'payroll_policies', config_key: 'standard_deduction_old', config_value: 50000, display_name: 'Standard Deduction (Old Regime)', data_type: 'number' },
          { config_group: 'payroll_policies', config_key: 'processing_day', config_value: 28, display_name: 'Monthly Processing Day', data_type: 'number' },
          { config_group: 'payroll_policies', config_key: 'lop_working_days', config_value: 30, display_name: 'LOP Working Days per Month', data_type: 'number' },
          { config_group: 'payroll_policies', config_key: 'default_tax_regime', config_value: 'new', display_name: 'Default Tax Regime', data_type: 'string' },
        ];
        void supabase.from('master_data_config').upsert(defaults, { onConflict: 'config_group,config_key', ignoreDuplicates: true });
      }
    })();
  }, []);

  // Payroll lock state
  const [payrollLocks, setPayrollLocks] = useState<PayrollLock[]>([]);
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockNotes, setLockNotes] = useState('');
  const [lockingPayroll, setLockingPayroll] = useState(false);

  // PT slabs for calcDeductions
  const [ptSlabs, setPtSlabs] = useState<PtSlab[]>([]);

  // Salary revision state
  const [revisions, setRevisions] = useState<SalaryRevision[]>([]);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisingStruct, setRevisingStruct] = useState<SalaryStructure | null>(null);

  // Revision tab filters & view
  const [revisionSearch, setRevisionSearch] = useState('');
  const [revisionTypeFilter, setRevisionTypeFilter] = useState('');
  const [revisionStatusFilter, setRevisionStatusFilter] = useState('');
  const [revisionDateFrom, setRevisionDateFrom] = useState('');
  const [revisionDateTo, setRevisionDateTo] = useState('');
  const [viewingRevision, setViewingRevision] = useState<SalaryRevision | null>(null);
  const [revisionForm, setRevisionForm] = useState({
    new_ctc: '',
    effective_from: new Date().toISOString().slice(0, 10),
    revision_type: 'annual_appraisal',
    notes: '',
  });
  const [submittingRevision, setSubmittingRevision] = useState(false);
  const [approvingRevision, setApprovingRevision] = useState<string | null>(null);

  const loadSalaryStructures = useCallback(async () => {
    setStructLoading(true);
    try {
      const res = await apiFetch(SALARY_STRUCT_URL);
      if (res.success) setSalaryStructures(res.data || []);
    } catch {
      // silently ignore
    } finally {
      setStructLoading(false);
    }
  }, []);

  const loadPayrollLocks = useCallback(async () => {
    const { data } = await supabase.from('payroll_locks').select('*').order('locked_at', { ascending: false });
    setPayrollLocks(data || []);
  }, []);

  const loadRevisions = useCallback(async () => {
    const { data } = await supabase.from('salary_revision_history').select('*').order('created_at', { ascending: false });
    setRevisions(data || []);
  }, []);

  useEffect(() => {
    if (activeTab === 'salary-structure' || activeTab === 'payslip-viewer' || activeTab === 'salary-revision' || activeTab === 'compliance') {
      loadSalaryStructures();
    }
    if (activeTab === 'processing' || activeTab === 'compliance') {
      loadPayrollLocks();
    }
    if (activeTab === 'processing') {
      supabase.from('payroll_employee_configs').select('employee_id, tax_regime').then(({ data }) => {
        if (data) {
          const map: Record<string, 'new' | 'old'> = {};
          for (const row of data) map[row.employee_id] = row.tax_regime as 'new' | 'old';
          setEmpRegimeMap(map);
        }
      });
    }
    if (activeTab === 'salary-revision') {
      loadRevisions();
    }
    if (activeTab === 'salary-structure' || activeTab === 'compliance') {
      supabase.from('professional_tax_slabs').select('*').order('state_code').order('min_salary').then(({ data }) => {
        setPtSlabs(data || []);
      });
    }
    if (activeTab === 'salary-structure') {
      supabase.from('salary_structures').select('id, employee_id, employee_name, tax_regime, hra_declaration, declared_80c, declared_80d, declared_nps').then(({ data: decls }) => {
        setTaxDeclarations(decls || []);
      });
    }
  }, [activeTab, loadSalaryStructures, loadPayrollLocks, loadRevisions]);

  useEffect(() => {
    if (activeTab !== 'summary') return;
    setTrendLoading(true);
    supabase
      .from('payroll_records')
      .select('pay_period_start, gross_salary, net_salary, tds')
      .eq('status', 'approved')
      .then(({ data }) => {
        if (!data) { setTrendLoading(false); return; }
        const map = new Map<string, { gross: number; net: number; tds: number; date: Date }>();
        for (const row of data) {
          const d = new Date(row.pay_period_start);
          const key = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
          const existing = map.get(key);
          if (existing) {
            existing.gross += row.gross_salary || 0;
            existing.net += row.net_salary || 0;
            existing.tds += row.tds || 0;
          } else {
            map.set(key, { gross: row.gross_salary || 0, net: row.net_salary || 0, tds: row.tds || 0, date: d });
          }
        }
        const sorted = Array.from(map.entries())
          .sort((a, b) => a[1].date.getTime() - b[1].date.getTime())
          .slice(-12)
          .map(([month, v]) => ({ month, gross: v.gross, net: v.net, tds: v.tds }));
        setTrendData(sorted);
        setTrendLoading(false);
      });
  }, [activeTab]);

  const canApprove = secApprovePayroll;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'payslips', label: t('payroll.myPayslips') },
    ...(isPrivileged ? [{ key: 'processing' as Tab, label: t('payroll.processPayroll') }] : []),
    { key: 'summary', label: t('payroll.summary') },
    ...(canEdit ? [{ key: 'salary-structure' as Tab, label: t('payroll.salaryStructureTab') }] : []),
    ...(secRevHistory || canEdit ? [{ key: 'salary-revision' as Tab, label: t('payroll.revisionHistory') }] : []),
    { key: 'payslip-viewer', label: t('payroll.payslipViewer') },
    ...(canApprove && secCompliance ? [{ key: 'compliance' as Tab, label: t('payroll.complianceTab') }] : []),
  ];

  // Monthly trend chart state
  const [trendData, setTrendData] = useState<{ month: string; gross: number; net: number; tds: number }[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  // Processing status state
  const [processingProgress, setProcessingProgress] = useState<{ current: number; total: number } | null>(null);
  const [processingSummary, setProcessingSummary] = useState<{ count: number; gross: number; net: number; deductions: number } | null>(null);

  // Approval state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);

  // Compliance lock history toggle
  const [lockHistoryOpen, setLockHistoryOpen] = useState(false);

  // Challan due date reminders
  const [challanDueDate, setChallanDueDate] = useState<Record<string, string>>({});
  const [showChallanDatePicker, setShowChallanDatePicker] = useState<Record<string, boolean>>({});

  const handleSetChallanReminder = async (challanType: 'PF' | 'ESI' | 'TDS', dueDate: string) => {
    const { data: recipients } = await supabase.from('app_users').select('id').contains('roles', ['finance_manager', 'hr_manager']);
    const rows = (recipients ?? []).map((r: { id: string }) => ({
      user_id: r.id,
      type: 'compliance_challan_due',
      title: `${challanType} Challan Due`,
      message: `${challanType} statutory challan for ${complianceMonth}/${complianceYear} is due on ${new Date(dueDate).toLocaleDateString('en-IN')}.`,
      severity: 'medium',
      read: false,
      action_required: true,
      action_data: { challan_type: challanType, due_date: dueDate, month: complianceMonth, year: complianceYear }
    }));
    if (rows.length > 0) void supabase.from('notifications').insert(rows);
    toast.success(`Reminder set for ${challanType} challan due on ${new Date(dueDate).toLocaleDateString()}`);
    setShowChallanDatePicker(prev => ({ ...prev, [challanType]: false }));
  };

  const handleSendChallanReminderNow = async (challanType: 'PF' | 'ESI' | 'TDS') => {
    const { data: recipients } = await supabase.from('app_users').select('id').contains('roles', ['finance_manager', 'hr_manager']);
    const rows = (recipients ?? []).map((r: { id: string }) => ({
      user_id: r.id,
      type: 'compliance_challan_due',
      title: `${challanType} Challan Reminder`,
      message: `${challanType} statutory challan for ${complianceMonth}/${complianceYear} requires attention.`,
      severity: 'medium',
      read: false,
      action_required: true,
      action_data: { challan_type: challanType, month: complianceMonth, year: complianceYear }
    }));
    if (rows.length > 0) void supabase.from('notifications').insert(rows);
    toast.success(`${challanType} challan reminder sent`);
  };

  // FIX 1: TDS expandable rows in processing table
  const [expandedTDS, setExpandedTDS] = useState<Set<string>>(new Set());

  // TDS Override state
  const [showTdsOverrideModal, setShowTdsOverrideModal] = useState(false);
  const [overridingRecord, setOverridingRecord] = useState<PayrollRecord | null>(null);
  const [tdsOverrideAmount, setTdsOverrideAmount] = useState(0);
  const [tdsOverrideReason, setTdsOverrideReason] = useState('');

  // FIX 4: NEFT bank template
  const [neftBank, setNeftBank] = useState('GENERIC');

  // Per-employee tax regime overrides from payroll_employee_configs
  const [empRegimeMap, setEmpRegimeMap] = useState<Record<string, 'new' | 'old'>>({});

  // FIX 3: new_basic for revision modal
  const [newBasic, setNewBasic] = useState('');

  // Tax Declaration state
  const [showTaxDecl, setShowTaxDecl] = useState(false);
  const [taxDeclarations, setTaxDeclarations] = useState<any[]>([]);
  const [editingTaxDecl, setEditingTaxDecl] = useState<any | null>(null);
  const [taxDeclForm, setTaxDeclForm] = useState({ tax_regime: 'new', hra_declaration: '', declared_80c: '', declared_80d: '', declared_nps: '' });
  const [savingTaxDecl, setSavingTaxDecl] = useState(false);

  // NEFT validation state
  const [neftValidationErrors, setNeftValidationErrors] = useState<string[]>([]);
  const [neftMissingEmployees, setNeftMissingEmployees] = useState<any[]>([]);
  const neftProceedRef = useRef<(() => void) | null>(null);

  // Unlock modal state
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockTargetLock, setUnlockTargetLock] = useState<PayrollLock | null>(null);
  const [unlockReason, setUnlockReason] = useState('');

  const pendingApprovals = records.filter((r) => r.status === 'Processed');

  // ---- helpers ---
  function isMonthLocked(month: string, year: number) {
    return payrollLocks.some(
      (l) => l.month === month && l.year === year && !l.unlocked_at
    );
  }

  const handleLockPayroll = async () => {
    setLockingPayroll(true);
    void supabase.from('payroll_locks').insert([{
      month: processMonth,
      year: processYear,
      locked_by: currentUser?.id,
      locked_at: new Date().toISOString(),
      notes: lockNotes || null,
    }]);
    await new Promise((r) => setTimeout(r, 600));
    await loadPayrollLocks();
    setShowLockModal(false);
    setLockNotes('');
    setLockingPayroll(false);
    const lockMonthLabel = `${processMonth} ${processYear}`;
    void supabase.from('notifications').insert([{
      user_id: currentUser?.id,
      type: 'payroll_locked',
      title: 'Payroll Locked',
      message: `Payroll for ${lockMonthLabel} has been locked.`,
      app_name: 'Payroll Management',
      read: false,
    }]);
    log({ event_type: 'payroll_locked', action: 'payroll_locked', metadata: { month: processMonth, year: processYear } });
    toast.success(t('payroll.payrollLocked'));
  };

  const handleUnlockPayroll = async (lock: PayrollLock, reason?: string) => {
    void supabase.from('payroll_locks').update({
      unlocked_by: currentUser?.id,
      unlocked_at: new Date().toISOString(),
      unlock_reason: reason || null,
    }).eq('id', lock.id);
    await new Promise((r) => setTimeout(r, 600));
    await loadPayrollLocks();
    void supabase.from('notifications').insert([{
      user_id: currentUser?.id,
      type: 'payroll_unlocked',
      title: 'Payroll Unlocked',
      message: `Payroll for ${lock.month} ${lock.year} has been unlocked.`,
      app_name: 'Payroll Management',
      read: false,
    }]);
    toast.success(t('payroll.payrollUnlocked'));
  };

  const handleSubmitRevision = async () => {
    if (!revisingStruct) return;
    const newCtcVal = Number(revisionForm.new_ctc);
    if (!newCtcVal || newCtcVal <= 0) {
      toast.error(t('payroll.invalidNewCtc'));
      return;
    }
    // Check if effective_from falls within a locked pay period
    const effDate = new Date(revisionForm.effective_from);
    const effMonthStr = effDate.toLocaleString('default', { month: 'long' });
    const effYear = effDate.getFullYear();
    const isLocked = payrollLocks.some(lock =>
      lock.month === effMonthStr && lock.year === effYear && !lock.unlocked_at
    );
    if (isLocked) {
      toast.error(`Cannot set effective date in ${effMonthStr} ${effYear} — that pay period is locked.`);
      return;
    }

    const newBasicVal = newBasic ? parseFloat(newBasic) : 0;
    if (newCtcVal > 0 && newBasicVal > 0 && newBasicVal < newCtcVal * 0.4) {
      toast.error("Basic salary must be at least 40% of CTC");
      return;
    }

    setSubmittingRevision(true);
    const currentGross = revisingStruct.basic_salary + revisingStruct.hra + revisingStruct.transport_allowance + (revisingStruct.other_allowances || 0);
    void supabase.from('salary_revision_history').insert([{
      employee_id: revisingStruct.employee_id,
      old_ctc: currentGross,
      new_ctc: newCtcVal,
      old_basic: revisingStruct.basic_salary,
      new_basic: newBasic ? parseFloat(newBasic) : null,
      effective_from: revisionForm.effective_from,
      revision_type: revisionForm.revision_type,
      notes: revisionForm.notes || null,
      submitted_by: currentUser?.id,
      approval_status: 'pending',
    }]);
    await new Promise((r) => setTimeout(r, 600));
    await loadRevisions();
    setShowRevisionModal(false);
    setRevisingStruct(null);
    setNewBasic('');
    setRevisionForm({ new_ctc: '', effective_from: new Date().toISOString().slice(0, 10), revision_type: 'annual_appraisal', notes: '' });
    setSubmittingRevision(false);
    void supabase.from('notifications').insert([{
      user_id: currentUser?.id,
      type: 'salary_revision_submitted',
      title: 'Salary Revision Submitted',
      message: `A salary revision has been submitted for ${revisingStruct?.employee_name || ''}.`,
      app_name: 'Payroll Management',
      read: false,
    }]);
    log({ event_type: 'salary_revision_submitted', action: 'salary_revision_submitted', metadata: { employee_id: revisingStruct?.employee_id, new_ctc: Number(revisionForm.new_ctc) } });
    toast.success(t('payroll.revisionSubmitted'));
  };

  const handleApproveRevision = async (rev: SalaryRevision) => {
    setApprovingRevision(rev.id);
    void supabase.from('salary_revision_history').update({
      approval_status: 'approved',
      approved_by: currentUser?.id,
    }).eq('id', rev.id);
    await new Promise((r) => setTimeout(r, 600));
    await loadRevisions();
    setApprovingRevision(null);
    void supabase.from('notifications').insert([{
      user_id: rev.employee_id || currentUser?.id,
      type: 'salary_revision_approved',
      title: 'Salary Revision Approved',
      message: `Your salary revision has been approved, effective ${rev.effective_from || ''}.`,
      app_name: 'Payroll Management',
      read: false,
    }]);
    toast.success(t('payroll.revisionApproved'));
  };

  const handleRejectRevision = async (rev: SalaryRevision) => {
    void supabase.from('salary_revision_history').update({
      approval_status: 'rejected',
      approved_by: currentUser?.id,
    }).eq('id', rev.id);
    await new Promise((r) => setTimeout(r, 600));
    await loadRevisions();
    toast.info(t('payroll.revisionRejected'));
  };

  const handleProcessPayroll = async () => {
    // Check lock
    if (isMonthLocked(processMonth, processYear)) {
      toast.error(t('payroll.payrollLockedError'));
      return;
    }
    setProcessing(true);
    setProcessingProgress(null);
    setProcessingSummary(null);
    try {
      const monthIndex = MONTHS.indexOf(processMonth);
      const monthNumber = monthIndex + 1; // 1-based month number
      const monthPad = String(monthNumber).padStart(2, '0');

      // Batch-load PT slabs and LOP leaves alongside salary structures + employees
      const [structRes, empRes, ptSlabsRes, lopLeavesRes] = await Promise.all([
        apiFetch(`${API_BASE}/payroll/salary-structures`),
        apiFetch(`${API_BASE}/directory`),
        supabase.from('professional_tax_slabs').select('*').order('state_code').order('min_salary'),
        supabase
          .from('leaves')
          .select('employee_id, days')
          .eq('status', 'approved')
          .eq('leave_type', 'LOP')
          .gte('start_date', `${processYear}-${monthPad}-01`)
          .lte('end_date', `${processYear}-${monthPad}-31`),
      ]);

      const structures: SalaryStructure[] = structRes?.data || [];
      const allEmployees: any[] = empRes?.data || [];
      const ptSlabs: PtSlab[] = ptSlabsRes.data || [];

      // Build LOP map: employee_id → total LOP days
      const lopMap: Record<string, number> = {};
      for (const row of (lopLeavesRes.data || [])) {
        lopMap[row.employee_id] = (lopMap[row.employee_id] || 0) + (row.days || 0);
      }

      // Filter active employees only
      const activeEmployees = allEmployees.filter((e: any) => e.status === 'Active');
      const structMap = new Map(structures.map((s) => [s.employee_id, s]));

      let created = 0, updated = 0, skipped = 0, noStructure = 0;
      let totalGross = 0, totalNet = 0, totalDed = 0;

      setProcessingProgress({ current: 0, total: activeEmployees.length });
      for (let ei = 0; ei < activeEmployees.length; ei++) {
        const emp = activeEmployees[ei];
        setProcessingProgress({ current: ei + 1, total: activeEmployees.length });
        const struct = structMap.get(emp.id);
        if (!struct) { noStructure++; continue; }

        // Compute payroll values — new tax regime FY 2025-26
        const basic = Number(struct.basic_salary || 0);
        const hra = Number(struct.hra || 0);
        const transport = Number(struct.transport_allowance || 0);
        const medical = Number((struct as any).medical_allowance || 0);
        const other = Number(struct.other_allowances || 0);
        const gross = basic + hra + transport + medical + other;

        const empPF = Math.round(Math.min(basic, PF_CAP) * PF_RATE);
        const emplrPF = empPF; // employer also 12% of capped basic
        const esi = gross > 0 && gross <= ESI_GROSS_LIMIT ? Math.round(gross * ESI_EMPLOYEE_RATE) : 0;
        const stateCode: string | null = (struct as any).state_code || emp.state || null;
        const profTax = getProfTax(ptSlabs, stateCode, gross, monthNumber);
        // New Regime TDS
        const annualCTC = gross * 12;
        const annualTaxable = Math.max(0, annualCTC - STD_DEDUCTION - (emplrPF * 12));
        const annualTDS = calcNewRegimeTDS(annualTaxable);
        let tds = Math.round(annualTDS / 12);
        let decemberReconciliation: { december_reconciliation: boolean; annual_liability: number; tds_paid_ytd: number; reconciled_amount: number } | null = null;
        const isDecember = monthNumber === 12;
        if (isDecember && (emp as any).gross_ytd) {
          const annualGross = (emp as any).gross_ytd as number;
          const annualLiabilityDec = calcNewRegimeTDS(Math.max(0, annualGross - STD_DEDUCTION - (emplrPF * 12)));
          const tdsPaidYTD = (emp as any).tds_ytd ?? 0;
          const decemberTDS = Math.max(0, Math.round(annualLiabilityDec - tdsPaidYTD));
          tds = decemberTDS;
          decemberReconciliation = {
            december_reconciliation: true,
            annual_liability: annualLiabilityDec,
            tds_paid_ytd: tdsPaidYTD,
            reconciled_amount: decemberTDS,
          };
        }
        const otherDeductions = esi + profTax;

        // LOP deduction
        const rawLopDays = lopMap[emp.id] ?? 0;
        if (rawLopDays > 30) {
          toast.error(`LOP days cannot exceed working days in a month (${emp.name}: ${rawLopDays} days capped at 30)`);
        }
        const lopDays = Math.min(rawLopDays, 30);
        const lopDeduction = Math.round((gross / 30) * lopDays);

        const totalDeductions = empPF + otherDeductions + tds + lopDeduction;
        const netSalary = Math.max(0, gross - totalDeductions);

        totalGross += gross;
        totalNet += netSalary;
        totalDed += totalDeductions;

        const payload = {
          employeeId: emp.id,
          employeeName: emp.name,
          email: emp.email,
          department: emp.department || '',
          designation: emp.designation || '',
          month: processMonth,
          year: processYear,
          basicSalary: basic,
          hra,
          transportAllowance: transport,
          medicalAllowance: medical,
          otherAllowances: other,
          grossSalary: gross,
          pfDeduction: empPF,
          taxDeduction: tds,
          otherDeductions,
          lopDays,
          lopDeduction,
          totalDeductions,
          netSalary,
          status: 'Processed',
          tds_calculation_details: JSON.stringify({
            regime: (struct as any).tax_regime ?? 'new',
            annual_gross: annualCTC,
            standard_deduction: STD_DEDUCTION,
            taxable_income: annualTaxable,
            tax_before_cess: Math.round(annualTDS / 1.04),
            cess: annualTDS - Math.round(annualTDS / 1.04),
            monthly_tds: tds,
            slabs_applied: TDS_SLABS_2526,
            ...(decemberReconciliation ?? {}),
          }),
        };

        // Check if a record already exists for this employee+month+year
        const existing = records.find(
          (r) => r.employeeId === emp.id && r.month === processMonth && r.year === processYear
        );

        if (!existing) {
          await apiFetch(`${API_BASE}/payroll/records`, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          created++;
        } else if (existing.netSalary === 0 || existing.grossSalary === 0) {
          // Update broken zero-value record
          await apiFetch(`${API_BASE}/payroll/records/${existing.id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          updated++;
        } else {
          skipped++;
        }
      }

      setProcessingProgress(null);
      setProcessingSummary({ count: created + updated, gross: totalGross, net: totalNet, deductions: totalDed });

      await refresh();

      const monthLabel = `${processMonth} ${processYear}`;
      if (created > 0 || updated > 0) {
        log({ event_type: 'payroll_processed', action: 'payroll_processed', metadata: { month: processMonth, year: processYear, employee_count: created + updated } });
        void supabase.from('notifications').insert([{
          user_id: currentUser?.id,
          type: 'payroll_processed',
          title: 'Payroll Processed',
          message: `Payroll for ${monthLabel} has been processed successfully.`,
          app_name: 'Payroll Management',
          read: false,
        }]);
        const processedCount = created + updated;
        const { data: financeManagers } = await supabase.from('app_users').select('id').contains('roles', ['finance_manager']);
        const fmRows = (financeManagers ?? []).map(fm => ({
          user_id: fm.id,
          type: 'payroll_processed',
          title: 'Payroll Processed',
          message: `Payroll for ${processMonth}/${processYear} has been processed for ${processedCount} employees.`,
          severity: 'low',
          read: false,
          action_required: true,
          action_data: { month: processMonth, year: processYear },
        }));
        if (fmRows.length > 0) void supabase.from('notifications').insert(fmRows);
      }

      const parts = [];
      if (created > 0) parts.push(`${created} records created`);
      if (updated > 0) parts.push(`${updated} records updated`);
      if (skipped > 0) parts.push(`${skipped} already processed`);
      if (noStructure > 0) parts.push(`${noStructure} employees skipped (no salary structure)`);

      if (created === 0 && updated === 0) {
        toast.info(parts.join(' · ') || `No new records for ${processMonth} ${processYear}`);
      } else {
        toast.success(parts.join(' · '));
      }
    } catch (err: any) {
      toast.error('Failed to process payroll', { description: err?.message });
      setProcessingProgress(null);
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    try {
      const res = await apiFetch(`${API_BASE}/payroll/records/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'Approved',
          approved_by: currentUser?.id,
          approved_at: new Date().toISOString(),
        }),
      });
      if (res.success || res.data) {
        // Notify the employee that their payslip is ready
        const approvedRec = records.find(r => r.id === id);
        const employeeUserId = (approvedRec as any)?.userId || (approvedRec as any)?.user_id || approvedRec?.employeeId;
        const approvedMonthLabel = approvedRec ? `${approvedRec.month} ${approvedRec.year}` : '';
        void supabase.from('notifications').insert([{
          user_id: employeeUserId || currentUser?.id,
          type: 'payslip_ready',
          title: 'Payslip Ready',
          message: `Your payslip for ${approvedMonthLabel} is now available.`,
          app_name: 'Payroll Management',
          read: false,
        }]);
        toast.success(t('payroll.payrollRecordApproved'));
        refresh();
      } else {
        toast.error(res.error || t('common.error'));
      }
    } catch {
      toast.error(t('common.networkError'));
    } finally {
      setApprovingId(null);
    }
  };

  const handleApproveAll = async () => {
    setApprovingAll(true);
    const toApprove = records.filter((r) => r.status === 'Processed');
    for (const record of toApprove) {
      void supabase.from('payroll_records').update({
        status: 'approved',
        approved_by: currentUser?.id,
        approved_at: new Date().toISOString(),
      }).eq('id', record.id);
      void supabase.from('notifications').insert([{
        user_id: record.employeeId,
        title: 'Payslip Ready',
        message: 'Your payslip has been approved',
        type: 'payslip_ready',
        app: 'payroll',
        created_by: currentUser?.id,
      }]);
    }
    if (toApprove.length > 0) {
      log({ event_type: 'payroll_approved', action: 'payroll_approved', metadata: { month: processMonth, year: processYear } });
      const { data: financeManagers } = await supabase
        .from('app_users')
        .select('id')
        .contains('roles', ['finance_manager']);
      (financeManagers ?? []).forEach(fm => {
        void supabase.from('notifications').insert([{
          user_id: fm.id,
          type: 'payroll_approval_required',
          title: 'Payroll Approval Required',
          message: `Payroll for ${processMonth} ${processYear} requires your approval.`,
          app: 'payroll',
          read: false,
          severity: 'high',
        }]);
      });
    }
    await refresh();
    setApprovingAll(false);
    toast.success(`${toApprove.length} records approved`);
    // Auto-lock the payroll after bulk approval
    if (toApprove.length > 0) {
      void supabase.from('payroll_locks').insert([{
        month: processMonth,
        year: processYear,
        locked_at: new Date().toISOString(),
        locked_by: currentUser?.id,
        is_locked: true,
        lock_reason: 'Auto-locked after bulk approval',
      }]);
      toast.success(`Payroll for ${processMonth} ${processYear} has been locked.`);
      await loadPayrollLocks();
    }
  };

  function handleEmailPayslips() {
    const approvedRecords = records.filter(s => s.status === 'Approved' || s.status === 'Paid' || s.status === 'approved' || s.status === 'paid');
    approvedRecords.forEach(s => {
      void supabase.from('notifications').insert([{
        user_id: s.employeeId,
        type: 'payslip_ready',
        title: 'Your Payslip is Ready',
        message: `Your payslip for ${processMonth} ${processYear} is available. Please log in to view and download it.`,
        app: 'payroll',
        read: false,
      }]);
    });
    toast.success(`Payslip notifications sent to ${approvedRecords.length} employees.`);
  }

  const handleReject = async (id: string) => {
    try {
      const res = await apiFetch(`${API_BASE}/payroll/records/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'Rejected',
          rejection_reason: rejectReason,
        }),
      });
      if (res.success || res.data) {
        toast.success(t('payroll.payrollRecordRejected'));
        setRejectingId(null);
        setRejectReason('');
        refresh();
      } else {
        toast.error(res.error || t('common.error'));
      }
    } catch {
      toast.error(t('common.networkError'));
    }
  };

  const viewerRecords = records.filter(
    (r) => r.month === viewerMonth && r.year === viewerYear
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('payroll.title')}</h1>
          <p className="text-green-100 text-sm mt-1">{t('payroll.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <ReportDefectButton appName="Payroll Management" />
          <button
            onClick={refresh}
            className="p-2 rounded-lg bg-card/10 hover:bg-card/20 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <DollarSign className="h-12 w-12 opacity-20" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-muted rounded-xl p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* My Payslips Tab — card grid */}
          {activeTab === 'payslips' && (() => {
            const fyOptions = [CURRENT_FY - 2, CURRENT_FY - 1, CURRENT_FY] as const;
            // Build month→record map for selected FY
            const fyMap: Record<string, PayrollRecord> = {};
            records.forEach((r) => {
              if (r.status === 'Approved' || r.status === 'Paid' || r.status === 'approved' || r.status === 'paid') {
                const fyMap_key = `${r.month}-${r.year}`;
                fyMap[fyMap_key] = r;
              }
            });
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-foreground">{t('payroll.myPayslips')}</h2>
                  <select
                    value={myPayslipFY}
                    onChange={(e) => setMyPayslipFY(Number(e.target.value))}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {fyOptions.map((fy) => (
                      <option key={fy} value={fy}>FY {fy}-{String(fy + 1).slice(-2)}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {FY_MONTHS.map((month, idx) => {
                    const cardYear = idx < 9 ? myPayslipFY : myPayslipFY + 1;
                    const rec = fyMap[`${month}-${cardYear}`];
                    return (
                      <div
                        key={month}
                        className={`group relative rounded-xl border p-4 transition-all ${rec ? 'bg-card border-green-200 hover:border-green-400 hover:shadow-sm cursor-pointer' : 'bg-muted/30 border-border'}`}
                      >
                        <p className={`text-sm font-semibold ${rec ? 'text-foreground' : 'text-muted-foreground'}`}>{month}</p>
                        <p className="text-xs text-muted-foreground mb-2">{cardYear}</p>
                        {rec ? (
                          <>
                            <p className="text-base font-bold text-indigo-600">{fmtINR(rec.netSalary)}</p>
                            <p className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
                              <CheckCircle2 className="h-3 w-3" /> Approved
                            </p>
                            <button
                              onClick={() => setMyPayslipViewRecord(rec)}
                              className="mt-2 w-full text-xs py-1 px-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              View Payslip
                            </button>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-1">Not Processed</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Payroll Processing Tab */}
          {activeTab === 'processing' && isPrivileged && (
            <div className="space-y-6">
              <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
                <h2 className="font-semibold text-foreground mb-4">{t('payroll.processPayroll')}</h2>
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">{t('payroll.month')}</label>
                    <select
                      value={processMonth}
                      onChange={(e) => setProcessMonth(e.target.value)}
                      className="block w-40 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      {MONTHS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">{t('payroll.year')}</label>
                    <input
                      type="number"
                      value={processYear}
                      onChange={(e) => setProcessYear(Number(e.target.value))}
                      className="block w-28 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      min={2020}
                      max={2099}
                    />
                  </div>
                  {(() => {
                    const locked = isMonthLocked(processMonth, processYear);
                    const lockRecord = payrollLocks.find(l => l.month === processMonth && l.year === processYear && !l.unlocked_at);
                    return locked ? (
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                          <Lock className="h-3.5 w-3.5" /> {t('payroll.lockedBadge')}
                        </span>
                        {isPrivileged && lockRecord && (
                          <button
                            onClick={() => { setUnlockTargetLock(lockRecord); setShowUnlockModal(true); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-300 text-orange-700 text-xs font-medium hover:bg-orange-50 transition-colors"
                          >
                            {t('payroll.unlockPayroll')}
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={handleProcessPayroll}
                          disabled={processing}
                          className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                          {t('payroll.processPayroll')}
                        </button>
                        {isPrivileged && (
                          <button
                            onClick={() => setShowLockModal(true)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                          >
                            <Lock className="h-4 w-4" />
                            {t('payroll.lockPayroll')}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Processing status indicator */}
              {processingProgress && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      {t('payroll.processingStatus')} {processingProgress.current} {t('payroll.of')} {processingProgress.total} {t('payroll.employees')}...
                    </span>
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  </div>
                  <div className="w-full bg-blue-100 dark:bg-blue-900/30 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-200"
                      style={{ width: `${processingProgress.total > 0 ? (processingProgress.current / processingProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}
              {!processingProgress && processingSummary && processingSummary.count > 0 && (
                <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 px-5 py-4 flex flex-wrap gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="font-semibold text-green-800 dark:text-green-300">{processingSummary.count} {t('payroll.employeesProcessed')}</span>
                  </div>
                  <span className="text-green-700 dark:text-green-400">{t('payroll.gross')}: {fmtINR(processingSummary.gross)}</span>
                  <span className="text-green-700 dark:text-green-400">{t('payroll.netPay')}: {fmtINR(processingSummary.net)}</span>
                  <span className="text-green-700 dark:text-green-400">{t('payroll.totalDeductions')}: {fmtINR(processingSummary.deductions)}</span>
                </div>
              )}

              {/* Lock history */}
              {payrollLocks.filter(l => l.month === processMonth && l.year === processYear).length > 0 && (
                <div className="bg-card rounded-xl border border-border p-4 text-sm space-y-2">
                  <p className="font-medium text-foreground">{t('payroll.lockHistory')}</p>
                  {payrollLocks
                    .filter(l => l.month === processMonth && l.year === processYear)
                    .map(l => (
                      <div key={l.id} className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs border-b border-border/50 pb-2 last:border-0">
                        <span>{t('payroll.lockedAt')}: {new Date(l.locked_at).toLocaleString('en-IN')}</span>
                        {l.notes && <span>{t('payroll.lockNotes')}: {l.notes}</span>}
                        {l.unlocked_at && <span className="text-green-600">{t('payroll.unlockedAt')}: {new Date(l.unlocked_at).toLocaleString('en-IN')}</span>}
                      </div>
                    ))}
                </div>
              )}

              {neftValidationErrors.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
                  <p className="text-sm font-medium text-amber-800">Missing bank details for {neftMissingEmployees.length} employees:</p>
                  <ul className="text-sm text-amber-700 mt-1 list-disc pl-4">
                    {neftMissingEmployees.map((e: any) => <li key={e.employeeId || e.id}>{e.employeeName}</li>)}
                  </ul>
                  <p className="text-xs text-amber-600 mt-2">Export will continue with MISSING placeholder values.</p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => { neftProceedRef.current?.(); }} className="text-xs bg-amber-600 text-white px-2 py-1 rounded">Export Anyway</button>
                    <button onClick={() => { setNeftValidationErrors([]); setNeftMissingEmployees([]); neftProceedRef.current = null; }} className="text-xs bg-white border px-2 py-1 rounded">Cancel</button>
                  </div>
                </div>
              )}

              <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                  <h2 className="font-semibold text-foreground">{t('payroll.allRecords')} — {processMonth} {processYear}</h2>
                  {canApprove && (() => {
                    const neftRecords = records.filter(
                      (r) => r.month === processMonth && r.year === processYear &&
                        (r.status === 'Approved' || r.status === 'Paid')
                    );
                    return neftRecords.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={neftBank}
                          onChange={(e) => setNeftBank(e.target.value)}
                          className="rounded-lg border border-border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                          <option value="GENERIC">Generic</option>
                          <option value="HDFC">HDFC Bank</option>
                          <option value="ICICI">ICICI Bank</option>
                          <option value="SBI">SBI</option>
                          <option value="AXIS">Axis Bank</option>
                          <option value="KOTAK">Kotak Mahindra Bank</option>
                        </select>
                        <button
                          onClick={() => {
                            const missingBankEmployees = neftRecords.filter((r: any) => {
                              return !r.bank_account_number || r.bank_account_number === 'MISSING' || !r.bank_ifsc || r.bank_ifsc === 'MISSING';
                            });
                            if (missingBankEmployees.length > 0) {
                              setNeftMissingEmployees(missingBankEmployees);
                              setNeftValidationErrors(missingBankEmployees.map((e: any) => e.employeeName || e.employeeId));
                              neftProceedRef.current = () => {
                                exportNEFT(neftRecords, neftBank);
                                log({ event_type: 'neft_exported', action: 'neft_exported', metadata: { bank: neftBank, employee_count: neftRecords.length } });
                                toast.success('NEFT file downloaded');
                                setNeftValidationErrors([]);
                                setNeftMissingEmployees([]);
                              };
                            } else {
                              exportNEFT(neftRecords, neftBank);
                              log({ event_type: 'neft_exported', action: 'neft_exported', metadata: { bank: neftBank, employee_count: neftRecords.length } });
                              toast.success('NEFT file downloaded');
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
                        >
                          {t('payroll.exportNeft')}
                        </button>
                      </div>
                    ) : null;
                  })()}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[900px]">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Employee</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Basic</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Gross</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">PF</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">ESI</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">PT</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">TDS</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">LOP</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Net</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('common.status')}</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Regime</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {records
                        .filter((r) => r.month === processMonth && r.year === processYear)
                        .map((rec) => {
                          const recGross = rec.grossSalary || rec.basicSalary || 0;
                          const recEsi = recGross > 0 && recGross <= ESI_GROSS_LIMIT ? Math.round(recGross * ESI_EMPLOYEE_RATE) : 0;
                          const recPt = Math.max(0, (rec.otherDeductions || 0) - recEsi);
                          const tdsExpanded = expandedTDS.has(rec.id);
                          // Compute annual taxable for TDS slab breakdown
                          const annualGrossForTDS = recGross * 12;
                          const emplrPFforTDS = Math.round(Math.min(rec.basicSalary || 0, PF_CAP) * PF_RATE);
                          const annualTaxableForTDS = Math.max(0, annualGrossForTDS - STD_DEDUCTION - (emplrPFforTDS * 12));
                          return (
                            <>
                              <tr key={rec.id} className="group hover:bg-muted transition-colors">
                                <td className="px-4 py-3 font-medium text-foreground">{rec.employeeName}</td>
                                <td className="px-4 py-3 text-right text-foreground hidden md:table-cell">{fmt(rec.basicSalary)}</td>
                                <td className="px-4 py-3 text-right text-foreground">{fmt(recGross)}</td>
                                <td className="px-4 py-3 text-right text-red-600 hidden md:table-cell">{fmt(rec.pfDeduction || 0)}</td>
                                <td className="px-4 py-3 text-right text-red-600 hidden md:table-cell">{fmt(recEsi)}</td>
                                <td className="px-4 py-3 text-right text-red-600 hidden md:table-cell">{fmt(recPt)}</td>
                                <td className="px-4 py-3 text-right text-red-600">
                                  <div className="flex items-center justify-end gap-1">
                                    {fmt(rec.taxDeduction || 0)}
                                    <button
                                      onClick={() => setExpandedTDS(prev => {
                                        const next = new Set(prev);
                                        if (next.has(rec.id)) next.delete(rec.id); else next.add(rec.id);
                                        return next;
                                      })}
                                      className="ml-1 p-0.5 rounded hover:bg-red-100 transition-colors"
                                      title="Show TDS slab breakdown"
                                    >
                                      {tdsExpanded ? <ChevronUp className="h-3 w-3 text-red-500" /> : <ChevronDown className="h-3 w-3 text-red-400" />}
                                    </button>
                                    {(isPrivileged || canApprove) && (
                                      <button
                                        onClick={() => {
                                          setOverridingRecord(rec);
                                          setTdsOverrideAmount(rec.taxDeduction || 0);
                                          setTdsOverrideReason('');
                                          setShowTdsOverrideModal(true);
                                        }}
                                        className="ml-1 p-0.5 rounded hover:bg-yellow-100 transition-colors"
                                        title="Override TDS"
                                      >
                                        <Pencil className="h-3 w-3 text-yellow-600" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right text-red-600 hidden md:table-cell">{fmt(rec.lopDeduction || 0)}</td>
                                <td className="px-4 py-3 text-right font-semibold text-green-700">{fmt(rec.netSalary)}</td>
                                <td className="px-4 py-3">
                                  {rec.status === 'Approved'
                                    ? <ApprovedBadge />
                                    : <span className={statusBadge(rec.status)}>{rec.status}</span>
                                  }
                                </td>
                                <td className="px-4 py-3 hidden md:table-cell">
                                  {canApprove && (() => {
                                    const regime = empRegimeMap[rec.employeeId] ?? 'new';
                                    return (
                                      <button
                                        onClick={() => {
                                          const newRegime: 'new' | 'old' = regime === 'new' ? 'old' : 'new';
                                          setEmpRegimeMap(prev => ({ ...prev, [rec.employeeId]: newRegime }));
                                          void supabase.from('payroll_employee_configs').upsert([{ employee_id: rec.employeeId, tax_regime: newRegime }], { onConflict: 'employee_id' });
                                        }}
                                        title="Toggle Tax Regime"
                                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${regime === 'old' ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-blue-100 text-blue-800 hover:bg-blue-200'}`}
                                      >
                                        {regime === 'old' ? 'Old' : 'New'}
                                      </button>
                                    );
                                  })()}
                                </td>
                                <td className="px-4 py-3">
                                  <button
                                    onClick={() => setBreakdownRecord(rec)}
                                    className="sm:opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                                  >
                                    <BarChart2 className="h-3.5 w-3.5" />
                                    {t('payroll.details')}
                                  </button>
                                </td>
                              </tr>
                              {tdsExpanded && (
                                <tr key={`${rec.id}-tds`} className="bg-indigo-50">
                                  <td colSpan={13} className="px-6 py-3">
                                    <div className="flex items-center gap-2 mb-2">
                                    <div className="text-sm font-medium text-indigo-800">TDS Slab Breakdown (Annual Taxable: {fmtINR(annualTaxableForTDS)})</div>
                                    {(() => {
                                      try {
                                        const details = typeof rec.tds_calculation_details === 'string' ? JSON.parse(rec.tds_calculation_details) : rec.tds_calculation_details;
                                        if (details?.december_reconciliation) {
                                          return (
                                            <span className="inline-flex items-center text-xs bg-amber-100 text-amber-800 border border-amber-300 rounded-full px-2 py-0.5 font-semibold">
                                              December Reconciliation
                                            </span>
                                          );
                                        }
                                      } catch { /* ignore */ }
                                      return null;
                                    })()}
                                  </div>
                                    <table className="text-xs w-full">
                                      <thead>
                                        <tr className="text-indigo-600">
                                          <th className="text-left py-1 pr-4">Income Slab</th>
                                          <th className="text-right py-1 pr-4">Rate</th>
                                          <th className="text-right py-1 pr-4">Taxable Amount</th>
                                          <th className="text-right py-1">Tax</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {TDS_SLABS_2526.map((slab, idx) => {
                                          const slabMax = slab.to === null ? Infinity : slab.to;
                                          const taxableInSlab = Math.max(0, Math.min(annualTaxableForTDS - slab.from, slabMax - slab.from));
                                          return (
                                            <tr key={idx} className="border-t border-indigo-100">
                                              <td className="py-1 pr-4 text-indigo-700">{slab.label}</td>
                                              <td className="py-1 pr-4 text-right text-indigo-600">{slab.rate}%</td>
                                              <td className="py-1 pr-4 text-right text-foreground">{fmtINR(taxableInSlab)}</td>
                                              <td className="py-1 text-right font-medium text-red-600">{fmtINR(Math.round(taxableInSlab * slab.rate / 100))}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })}
                      {records.filter((r) => r.month === processMonth && r.year === processYear).length === 0 && (
                        <tr>
                          <td colSpan={13} className="text-center py-10 text-muted-foreground">
                            No records for {processMonth} {processYear}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Approvals section — Finance/Admin only */}
              {canApprove && (
                <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-border flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-orange-500" />
                    <h2 className="font-semibold text-foreground">{t('payroll.pendingApprovals')}</h2>
                    {pendingApprovals.length > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-100 text-orange-800 text-xs font-bold">
                        {pendingApprovals.length}
                      </span>
                    )}
                    {pendingApprovals.length > 0 && (
                      <div className="ml-auto flex items-center gap-2">
                        <button
                          onClick={handleEmailPayslips}
                          className="px-3 py-1.5 text-xs border border-indigo-600 text-indigo-600 rounded hover:bg-indigo-50 flex items-center gap-1"
                        >
                          ✉ Email Payslips
                        </button>
                        <button
                          onClick={handleApproveAll}
                          disabled={approvingAll}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          {approvingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                          Approve All
                        </button>
                      </div>
                    )}
                  </div>
                  {pendingApprovals.length === 0 ? (
                    <div className="px-6 py-10 text-center text-muted-foreground text-sm">{t('payroll.noRecordsAwaitingApproval')}</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">{t('payroll.employeeLabel')}</th>
                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">{t('payroll.month')}</th>
                            <th className="text-right px-6 py-3 font-medium text-muted-foreground">{t('payroll.gross')}</th>
                            <th className="text-right px-6 py-3 font-medium text-muted-foreground">{t('payroll.netPay')}</th>
                            <th className="px-6 py-3" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {pendingApprovals.map((rec) => (
                            <>
                              <tr key={rec.id} className="hover:bg-muted transition-colors">
                                <td className="px-6 py-4 font-medium text-foreground">{rec.employeeName}</td>
                                <td className="px-6 py-4 text-muted-foreground">{rec.month} {rec.year}</td>
                                <td className="px-6 py-4 text-right text-foreground">{fmt(rec.grossSalary || rec.basicSalary)}</td>
                                <td className="px-6 py-4 text-right font-semibold text-green-700">{fmt(rec.netSalary)}</td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2 justify-end">
                                    <button
                                      onClick={() => setBreakdownRecord(rec)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                    >
                                      <BarChart2 className="h-3 w-3" />
                                      {t('payroll.details')}
                                    </button>
                                    <button
                                      onClick={() => handleApprove(rec.id)}
                                      disabled={approvingId === rec.id}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                                    >
                                      {approvingId === rec.id
                                        ? <Loader2 className="h-3 w-3 animate-spin" />
                                        : <CheckCircle2 className="h-3 w-3" />}
                                      {t('payroll.approve')}
                                    </button>
                                    <button
                                      onClick={() => setRejectingId(rejectingId === rec.id ? null : rec.id)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 text-xs font-medium hover:bg-red-100 transition-colors"
                                    >
                                      <XCircle className="h-3 w-3" />
                                      {t('payroll.reject')}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {rejectingId === rec.id && (
                                <tr key={`${rec.id}-reject`}>
                                  <td colSpan={5} className="px-6 py-3 bg-red-50">
                                    <div className="flex items-start gap-3">
                                      <textarea
                                        className="flex-1 rounded-lg border border-red-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                                        rows={2}
                                        placeholder={t('payroll.rejectionReason')}
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                      />
                                      <button
                                        onClick={() => handleReject(rec.id)}
                                        disabled={!rejectReason.trim()}
                                        className="px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                                      >
                                        {t('payroll.confirmReject')}
                                      </button>
                                      <button
                                        onClick={() => { setRejectingId(null); setRejectReason(''); }}
                                        className="px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition-colors"
                                      >
                                        {t('common.cancel')}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-card rounded-2xl border border-border shadow-sm p-6 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-green-50">
                    <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('payroll.totalCost')}</p>
                    <p className="text-2xl font-bold text-foreground">
                      {fmt(stats?.totalPayout ?? records.reduce((s, r) => s + r.netSalary, 0))}
                    </p>
                  </div>
                </div>
                <div className="bg-card rounded-2xl border border-border shadow-sm p-6 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-blue-50">
                    <TrendingUp className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('payroll.avgSalary')}</p>
                    <p className="text-2xl font-bold text-foreground">
                      {records.length
                        ? fmt(records.reduce((s, r) => s + r.netSalary, 0) / records.length)
                        : fmtINR(0)}
                    </p>
                  </div>
                </div>
                <div className="bg-card rounded-2xl border border-border shadow-sm p-6 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-purple-50">
                    <Users className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('payroll.headcount')}</p>
                    <p className="text-2xl font-bold text-foreground">
                      {stats?.totalRecords ?? new Set(records.map((r) => r.employeeId)).size}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
                <h2 className="font-semibold text-foreground mb-4">{t('payroll.monthlyTrend')}</h2>
                {trendLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : trendData.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                    {t('payroll.noTrendData')}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={trendData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => fmtINR(v)} />
                      <Legend />
                      <Line type="monotone" dataKey="gross" name="Gross Pay" stroke="#6366f1" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="net" name="Net Pay" stroke="#22c55e" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="tds" name="TDS" stroke="#ef4444" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
                <h2 className="font-semibold text-foreground mb-4">{t('payroll.statusBreakdown')}</h2>
                <div className="grid grid-cols-3 gap-4 text-center text-sm">
                  {(['Paid', 'Pending', 'Processing'] as const).map((s) => {
                    const count = records.filter((r) => r.status === s).length;
                    return (
                      <div key={s} className="rounded-xl bg-muted p-4">
                        <p className="text-2xl font-bold text-foreground">{count}</p>
                        <span className={`mt-1 ${statusBadge(s)}`}>{s}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Salary Structure Tab */}
          {activeTab === 'salary-structure' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-foreground">{t('payroll.salaryStructures')}</h2>
                {canEdit && (
                  <button
                    onClick={() => { setEditingStruct(null); setShowStructModal(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    {t('payroll.addStructure')}
                  </button>
                )}
              </div>

              <div className="bg-card rounded-xl border border-border overflow-x-auto">
                {structLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('payroll.employeeLabel')}</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t('payroll.basic')}</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t('payroll.hra40')}</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t('payroll.transport')}</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t('payroll.other')}</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t('payroll.gross')}</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t('payroll.pf12')}</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t('payroll.esi')}</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t('payroll.profTax')}</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t('payroll.tds')}</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground font-semibold">{t('payroll.netPay')}</th>
                        {canEdit && <th className="px-4 py-3" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {salaryStructures.length === 0 && (
                        <tr>
                          <td colSpan={canEdit ? 12 : 11} className="text-center py-12 text-muted-foreground">
                            {t('payroll.noSalaryStructures')}
                          </td>
                        </tr>
                      )}
                      {salaryStructures.map((s) => {
                        const decl = taxDeclarations.find((d: any) => d.employee_id === s.employee_id);
                        const calc = calcDeductions(s, ptSlabs, (s as any).state_code ?? null, new Date().getMonth() + 1, decl, payrollPolicies);
                        return (
                          <tr key={s.id} className="hover:bg-muted transition-colors">
                            <td className="px-4 py-3 font-medium text-foreground">
                              <div>{s.employee_name}</div>
                              <div className="text-xs text-muted-foreground">{s.employee_id}</div>
                            </td>
                            <td className="px-4 py-3 text-right text-foreground">{fmtINR(s.basic_salary)}</td>
                            <td className="px-4 py-3 text-right text-foreground">{fmtINR(s.hra)}</td>
                            <td className="px-4 py-3 text-right text-foreground">{fmtINR(s.transport_allowance)}</td>
                            <td className="px-4 py-3 text-right text-foreground">{fmtINR(s.other_allowances)}</td>
                            <td className="px-4 py-3 text-right font-medium text-foreground">{fmtINR(calc.gross)}</td>
                            <td className="px-4 py-3 text-right text-red-600">{fmtINR(calc.pf)}</td>
                            <td className="px-4 py-3 text-right text-red-600">{fmtINR(calc.esi)}</td>
                            <td className="px-4 py-3 text-right text-red-600">{fmtINR(calc.profTax)}</td>
                            <td className="px-4 py-3 text-right text-red-600">{fmtINR(calc.tds)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-green-700">{fmtINR(calc.net)}</td>
                            {canEdit && (
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => { setEditingStruct(s); setShowStructModal(true); }}
                                    className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                    title={t('payroll.editSalaryStructure')}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => { setRevisingStruct(s); setShowRevisionModal(true); }}
                                    className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors text-blue-500 hover:text-blue-700 text-xs font-medium"
                                    title={t('payroll.reviseSalary')}
                                  >
                                    <TrendingUp className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Tax Declarations collapsible section */}
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => setShowTaxDecl(o => !o)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  <h3 className="font-medium text-foreground">Tax Declarations</h3>
                  {showTaxDecl ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {showTaxDecl && (
                  <div className="overflow-x-auto border-t border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Employee</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tax Regime</th>
                          <th className="text-right px-4 py-3 font-medium text-muted-foreground">HRA</th>
                          <th className="text-right px-4 py-3 font-medium text-muted-foreground">80C</th>
                          <th className="text-right px-4 py-3 font-medium text-muted-foreground">80D</th>
                          <th className="text-right px-4 py-3 font-medium text-muted-foreground">NPS</th>
                          <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total Declarations</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {taxDeclarations.length === 0 && (
                          <tr><td colSpan={8} className="text-center py-8 text-muted-foreground text-sm">No tax declarations found</td></tr>
                        )}
                        {taxDeclarations.map((d) => {
                          const total = (d.hra_declaration || 0) + (d.declared_80c || 0) + (d.declared_80d || 0) + (d.declared_nps || 0);
                          return (
                            <tr key={d.id} className="hover:bg-muted transition-colors">
                              <td className="px-4 py-3 font-medium text-foreground">{d.employee_name}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${d.tax_regime === 'old' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                                  {d.tax_regime === 'old' ? 'Old Regime' : 'New Regime'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-foreground">{fmtINR(d.hra_declaration || 0)}</td>
                              <td className="px-4 py-3 text-right text-foreground">{fmtINR(d.declared_80c || 0)}</td>
                              <td className="px-4 py-3 text-right text-foreground">{fmtINR(d.declared_80d || 0)}</td>
                              <td className="px-4 py-3 text-right text-foreground">{fmtINR(d.declared_nps || 0)}</td>
                              <td className="px-4 py-3 text-right font-medium text-foreground">{fmtINR(total)}</td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => {
                                    setEditingTaxDecl(d);
                                    setTaxDeclForm({
                                      tax_regime: d.tax_regime || 'new',
                                      hra_declaration: String(d.hra_declaration || ''),
                                      declared_80c: String(d.declared_80c || ''),
                                      declared_80d: String(d.declared_80d || ''),
                                      declared_nps: String(d.declared_nps || ''),
                                    });
                                  }}
                                  className="text-xs px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                >
                                  Edit Declaration
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Salary Revision History Tab */}
          {activeTab === 'salary-revision' && (() => {
            // Fix 2: filtered revisions
            const filteredRevisions = revisions.filter((rev) => {
              const empName = salaryStructures.find(s => s.employee_id === rev.employee_id)?.employee_name || rev.employee_id || '';
              if (revisionSearch && !empName.toLowerCase().includes(revisionSearch.toLowerCase())) return false;
              if (revisionTypeFilter && rev.revision_type !== revisionTypeFilter) return false;
              if (revisionStatusFilter && rev.approval_status !== revisionStatusFilter) return false;
              if (revisionDateFrom && rev.effective_from < revisionDateFrom) return false;
              if (revisionDateTo && rev.effective_from > revisionDateTo) return false;
              return true;
            });
            return (
              <div className="space-y-4">
                {/* Fix 1: header with + New Salary Revision button */}
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-foreground">{t('payroll.salaryRevisionHistory')}</h2>
                  {isPrivileged && (
                    <button
                      onClick={() => {
                        if (salaryStructures.length === 0) {
                          toast.error("No salary structures found. Add a salary structure first.");
                          return;
                        }
                        setRevisingStruct(salaryStructures[0]);
                        setRevisionForm({ new_ctc: '', effective_from: new Date().toISOString().slice(0, 10), revision_type: 'annual_appraisal', notes: '' });
                        setShowRevisionModal(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      + New Salary Revision
                    </button>
                  )}
                </div>

                {/* Fix 2: filter row */}
                <div className="flex flex-wrap gap-3">
                  <input
                    type="text"
                    placeholder="Search employee..."
                    value={revisionSearch}
                    onChange={(e) => setRevisionSearch(e.target.value)}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-48"
                  />
                  <select
                    value={revisionTypeFilter}
                    onChange={(e) => setRevisionTypeFilter(e.target.value)}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">All Types</option>
                    <option value="increment">Increment</option>
                    <option value="promotion">Promotion</option>
                    <option value="correction">Correction</option>
                    <option value="market_adjustment">Market Adjustment</option>
                    <option value="annual_appraisal">Annual Appraisal</option>
                    <option value="joining">Joining</option>
                  </select>
                  <select
                    value={revisionStatusFilter}
                    onChange={(e) => setRevisionStatusFilter(e.target.value)}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <input
                    type="date"
                    value={revisionDateFrom}
                    onChange={(e) => setRevisionDateFrom(e.target.value)}
                    className="border rounded px-2 py-1 text-sm border-border focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="From"
                  />
                  <input
                    type="date"
                    value={revisionDateTo}
                    onChange={(e) => setRevisionDateTo(e.target.value)}
                    className="border rounded px-2 py-1 text-sm border-border focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="To"
                  />
                </div>

                <div className="bg-card rounded-xl border border-border overflow-x-auto">
                  {structLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredRevisions.length === 0 ? (
                    <p className="text-center py-12 text-muted-foreground text-sm">{t('payroll.noRevisions')}</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('payroll.employeeLabel')}</th>
                          <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t('payroll.oldCtc')}</th>
                          <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t('payroll.newCtc')}</th>
                          <th className="text-right px-4 py-3 font-medium text-muted-foreground">% Change</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('payroll.effectiveDate')}</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('payroll.revisionType')}</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('common.status')}</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredRevisions.map((rev) => {
                          const empName = salaryStructures.find(s => s.employee_id === rev.employee_id)?.employee_name || rev.employee_id;
                          const statusCls = rev.approval_status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : rev.approval_status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-800';
                          return (
                            <tr key={rev.id} className="hover:bg-muted transition-colors">
                              <td className="px-4 py-3 font-medium text-foreground">
                                <div>{empName}</div>
                                <div className="text-xs text-muted-foreground">{rev.employee_id?.slice(0, 8)}…</div>
                              </td>
                              <td className="px-4 py-3 text-right text-muted-foreground">{fmtINR(rev.old_ctc)}</td>
                              <td className="px-4 py-3 text-right font-semibold text-green-700">{fmtINR(rev.new_ctc)}</td>
                              <td className="px-4 py-3 text-right">
                                {rev.old_ctc > 0 ? (() => {
                                  const delta = parseFloat(((rev.new_ctc - rev.old_ctc) / rev.old_ctc * 100).toFixed(1));
                                  return (
                                    <span className={delta >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                                      {delta >= 0 ? '+' : ''}{delta}%
                                    </span>
                                  );
                                })() : '—'}
                              </td>
                              <td className="px-4 py-3 text-foreground">{rev.effective_from ? new Date(rev.effective_from).toLocaleDateString('en-IN') : '—'}</td>
                              <td className="px-4 py-3 text-muted-foreground capitalize">{rev.revision_type?.replace(/_/g, ' ')}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusCls}`}>
                                  {rev.approval_status}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {/* Fix 3: View button */}
                                  <button
                                    onClick={() => setViewingRevision(rev)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                  >
                                    <Eye className="h-3 w-3" />
                                    View
                                  </button>
                                  {canApprove && rev.approval_status === 'pending' && (
                                    <>
                                      <button
                                        onClick={() => handleApproveRevision(rev)}
                                        disabled={approvingRevision === rev.id}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                                      >
                                        {approvingRevision === rev.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                        {t('payroll.approve')}
                                      </button>
                                      <button
                                        onClick={() => handleRejectRevision(rev)}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-600 border border-red-200 text-xs font-medium hover:bg-red-100 transition-colors"
                                      >
                                        <XCircle className="h-3 w-3" />
                                        {t('payroll.reject')}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Payslip Viewer Tab */}
          {activeTab === 'payslip-viewer' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{t('payroll.month')}</label>
                  <select
                    value={viewerMonth}
                    onChange={(e) => setViewerMonth(e.target.value)}
                    className="block w-36 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{t('payroll.year')}</label>
                  <input
                    type="number"
                    value={viewerYear}
                    onChange={(e) => setViewerYear(Number(e.target.value))}
                    className="block w-24 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    min={2020}
                    max={2099}
                  />
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left px-6 py-3 font-medium text-muted-foreground">{t('payroll.employeeLabel')}</th>
                      <th className="text-right px-6 py-3 font-medium text-muted-foreground">{t('payroll.gross')}</th>
                      <th className="text-right px-6 py-3 font-medium text-muted-foreground">{t('payroll.deductions')}</th>
                      <th className="text-right px-6 py-3 font-medium text-muted-foreground">{t('payroll.netPay')}</th>
                      <th className="text-left px-6 py-3 font-medium text-muted-foreground">{t('common.status')}</th>
                      <th className="px-6 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {viewerRecords.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-muted-foreground">
                          No payroll records for {viewerMonth} {viewerYear}
                        </td>
                      </tr>
                    )}
                    {viewerRecords.map((rec) => {
                      const struct = salaryStructures.find((s) => s.employee_id === rec.employeeId);
                      const gross = struct
                        ? struct.basic_salary + struct.hra + struct.transport_allowance + struct.other_allowances
                        : (rec as any).grossSalary || rec.basicSalary || 0;
                      const ded = rec.totalDeductions || 0;
                      const net = rec.netSalary || gross - ded;
                      return (
                        <tr key={rec.id} className="hover:bg-muted transition-colors">
                          <td className="px-6 py-4 font-medium text-foreground">{rec.employeeName}</td>
                          <td className="px-6 py-4 text-right text-foreground">{fmtINR(gross)}</td>
                          <td className="px-6 py-4 text-right text-red-600">{fmtINR(ded)}</td>
                          <td className="px-6 py-4 text-right font-semibold text-green-700">{fmtINR(net)}</td>
                          <td className="px-6 py-4">
                            <span className={statusBadge(rec.status)}>{rec.status}</span>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => setViewerRecord(rec)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              {t('payroll.viewPayslip')}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {/* Compliance Tab */}
          {activeTab === 'compliance' && canApprove && (() => {
            // Build compliance data from salary structures
            const pfRows = salaryStructures.map((s) => {
              const empPF = Math.round(Math.min(s.basic_salary, 15000) * PF_RATE);
              const emplrPF = Math.round(Math.min(s.basic_salary, 15000) * PF_RATE);
              return { name: s.employee_name, uan: s.employee_id || '—', basic: s.basic_salary, empPF, emplrPF, total: empPF + emplrPF };
            });

            const esiRows = salaryStructures
              .filter((s) => {
                const gross = s.basic_salary + s.hra + s.transport_allowance + s.other_allowances;
                return gross <= ESI_GROSS_LIMIT;
              })
              .map((s) => {
                const gross = s.basic_salary + s.hra + s.transport_allowance + s.other_allowances;
                const empESI = Math.round(gross * 0.0075);
                const emplrESI = Math.round(gross * ESI_RATE);
                return { name: s.employee_name, insNo: s.employee_id || '—', gross, empESI, emplrESI, total: empESI + emplrESI };
              });

            const tdsRows = salaryStructures.map((s) => {
              const gross = s.basic_salary + s.hra + s.transport_allowance + s.other_allowances;
              const emplrPF = Math.round(Math.min(s.basic_salary, PF_CAP) * PF_RATE);
              const annualCTC = gross * 12;
              const taxable = Math.max(0, annualCTC - STD_DEDUCTION - (emplrPF * 12));
              const tds = calcNewRegimeTDS(taxable);
              const rate = annualCTC > 0 ? ((tds / annualCTC) * 100).toFixed(2) : '0.00';
              return { name: s.employee_name, annualGross: annualCTC, taxable, tds, rate };
            });

            const ThCell = ({ children, className }: { children: string | JSX.Element | null; className?: string }) => (
              <th className={`text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase${className ? ` ${className}` : ''}`}>{children}</th>
            );
            const TdCell = ({ children, right, className }: { children: string | JSX.Element | null; right?: boolean; className?: string }) => (
              <td className={`px-3 py-2.5 text-sm${right ? ' text-right' : ''}${className ? ` ${className}` : ''}`}>{children}</td>
            );

            const currentMonthLabel = `${complianceMonth} ${complianceYear}`;
            return (
              <div className="space-y-8">
                {/* Compliance period picker */}
                <div className="flex items-center gap-2 mb-4">
                  <label className="text-sm font-medium text-gray-700">Compliance Period:</label>
                  <select
                    value={complianceMonth}
                    onChange={e => setComplianceMonth(e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    {['January','February','March','April','May','June','July','August','September','October','November','December'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={complianceYear}
                    onChange={e => setComplianceYear(Number(e.target.value))}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                {/* Generate Challans button */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-foreground">{t('payroll.complianceTab')}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">PF · ESI · TDS challan summary for {currentMonthLabel}</p>
                  </div>
                  <button
                    onClick={() => {
                      toast.loading(`Generating challans for ${currentMonthLabel}...`, { id: 'challans' });
                      // Trigger all 3 downloads in sequence
                      setTimeout(() => {
                        downloadCSV(`pf-challan-${new Date().toISOString().slice(0,7)}.csv`, [
                          ['Employee Name', 'UAN', 'Basic Salary', 'Employee PF (12%)', 'Employer PF (12%)', 'Total PF'],
                          ...pfRows.map((r) => [r.name, r.uan, String(r.basic), String(r.empPF), String(r.emplrPF), String(r.total)]),
                        ]);
                      }, 100);
                      setTimeout(() => {
                        downloadCSV(`esi-challan-${new Date().toISOString().slice(0,7)}.csv`, [
                          ['Employee Name', 'Insurance Number', 'Gross Salary', 'Employee ESI (0.75%)', 'Employer ESI (3.25%)', 'Total ESI'],
                          ...esiRows.map((r) => [r.name, r.insNo, String(r.gross), String(r.empESI), String(r.emplrESI), String(r.total)]),
                        ]);
                      }, 600);
                      setTimeout(() => {
                        downloadCSV(`tds-${new Date().toISOString().slice(0,7)}.csv`, [
                          ['Employee Name', 'Annual Gross (est.)', 'Taxable Income', 'TDS Deducted (Annual)', 'Effective Rate %'],
                          ...tdsRows.map((r) => [r.name, String(r.annualGross), String(r.taxable), String(r.tds), r.rate]),
                        ]);
                        toast.success(`Challans generated for ${currentMonthLabel}`, { id: 'challans' });
                      }, 1100);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                  >
                    <Printer className="h-4 w-4" />
                    Generate Challans
                  </button>
                </div>

                {/* PF Report */}
                <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <h2 className="font-semibold text-foreground">{t('payroll.pfReport')}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('payroll.pfReportDesc')}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {showChallanDatePicker['PF'] ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="date"
                            value={challanDueDate['PF'] ?? ''}
                            onChange={e => setChallanDueDate(prev => ({ ...prev, PF: e.target.value }))}
                            className="border rounded px-2 py-1 text-xs"
                          />
                          <button
                            onClick={() => challanDueDate['PF'] && handleSetChallanReminder('PF', challanDueDate['PF'])}
                            className="px-2 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600"
                          >Save</button>
                          <button
                            onClick={() => setShowChallanDatePicker(prev => ({ ...prev, PF: false }))}
                            className="px-2 py-1 text-xs border rounded hover:bg-muted"
                          >Cancel</button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => setShowChallanDatePicker(prev => ({ ...prev, PF: true }))}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-400 text-amber-700 text-xs font-medium hover:bg-amber-50 transition-colors"
                          >
                            Set Due Date Reminder
                          </button>
                          <button
                            onClick={() => handleSendChallanReminderNow('PF')}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-orange-400 text-orange-700 text-xs font-medium hover:bg-orange-50 transition-colors"
                          >
                            Send Reminder Now
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => downloadCSV(`pf-challan-${new Date().toISOString().slice(0,7)}.csv`, [
                          ['Employee Name', 'UAN', 'Basic Salary', 'Employee PF (12%)', 'Employer PF (12%)', 'Total PF'],
                          ...pfRows.map((r) => [r.name, r.uan, String(r.basic), String(r.empPF), String(r.emplrPF), String(r.total)]),
                        ])}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
                      >
                        {t('payroll.downloadPfChallan')}
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <ThCell>Employee Name</ThCell>
                          <ThCell className="hidden sm:table-cell">UAN</ThCell>
                          <ThCell>Basic Salary</ThCell>
                          <ThCell className="hidden md:table-cell">Employee PF (12%)</ThCell>
                          <ThCell className="hidden md:table-cell">Employer PF (12%)</ThCell>
                          <ThCell>Total PF</ThCell>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {pfRows.length === 0 && (
                          <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">No salary structures found</td></tr>
                        )}
                        {pfRows.map((r) => (
                          <tr key={r.uan} className="hover:bg-muted">
                            <TdCell><span className="font-medium text-foreground">{r.name}</span></TdCell>
                            <TdCell className="hidden sm:table-cell"><span className="text-muted-foreground text-xs">{r.uan}</span></TdCell>
                            <TdCell right>{fmtINR(r.basic)}</TdCell>
                            <TdCell right className="hidden md:table-cell"><span className="text-red-600">{fmtINR(r.empPF)}</span></TdCell>
                            <TdCell right className="hidden md:table-cell"><span className="text-orange-600">{fmtINR(r.emplrPF)}</span></TdCell>
                            <TdCell right><span className="font-semibold">{fmtINR(r.total)}</span></TdCell>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ESI Report */}
                <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <h2 className="font-semibold text-foreground">{t('payroll.esiReport')}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('payroll.esiReportDesc')}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {showChallanDatePicker['ESI'] ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="date"
                            value={challanDueDate['ESI'] ?? ''}
                            onChange={e => setChallanDueDate(prev => ({ ...prev, ESI: e.target.value }))}
                            className="border rounded px-2 py-1 text-xs"
                          />
                          <button
                            onClick={() => challanDueDate['ESI'] && handleSetChallanReminder('ESI', challanDueDate['ESI'])}
                            className="px-2 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600"
                          >Save</button>
                          <button
                            onClick={() => setShowChallanDatePicker(prev => ({ ...prev, ESI: false }))}
                            className="px-2 py-1 text-xs border rounded hover:bg-muted"
                          >Cancel</button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => setShowChallanDatePicker(prev => ({ ...prev, ESI: true }))}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-400 text-amber-700 text-xs font-medium hover:bg-amber-50 transition-colors"
                          >
                            Set Due Date Reminder
                          </button>
                          <button
                            onClick={() => handleSendChallanReminderNow('ESI')}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-orange-400 text-orange-700 text-xs font-medium hover:bg-orange-50 transition-colors"
                          >
                            Send Reminder Now
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => downloadCSV(`esi-challan-${new Date().toISOString().slice(0,7)}.csv`, [
                          ['Employee Name', 'Insurance Number', 'Gross Salary', 'Employee ESI (0.75%)', 'Employer ESI (3.25%)', 'Total ESI'],
                          ...esiRows.map((r) => [r.name, r.insNo, String(r.gross), String(r.empESI), String(r.emplrESI), String(r.total)]),
                        ])}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
                      >
                        {t('payroll.downloadEsiChallan')}
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <ThCell>Employee Name</ThCell>
                          <ThCell className="hidden sm:table-cell">Insurance Number</ThCell>
                          <ThCell>Gross Salary</ThCell>
                          <ThCell className="hidden md:table-cell">Employee ESI (0.75%)</ThCell>
                          <ThCell className="hidden md:table-cell">Employer ESI (3.25%)</ThCell>
                          <ThCell>Total ESI</ThCell>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {esiRows.length === 0 && (
                          <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">No eligible employees (Gross ≤ ₹21,000)</td></tr>
                        )}
                        {esiRows.map((r) => (
                          <tr key={r.insNo} className="hover:bg-muted">
                            <TdCell><span className="font-medium text-foreground">{r.name}</span></TdCell>
                            <TdCell className="hidden sm:table-cell"><span className="text-muted-foreground text-xs">{r.insNo}</span></TdCell>
                            <TdCell right>{fmtINR(r.gross)}</TdCell>
                            <TdCell right className="hidden md:table-cell"><span className="text-red-600">{fmtINR(r.empESI)}</span></TdCell>
                            <TdCell right className="hidden md:table-cell"><span className="text-orange-600">{fmtINR(r.emplrESI)}</span></TdCell>
                            <TdCell right><span className="font-semibold">{fmtINR(r.total)}</span></TdCell>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* TDS Summary */}
                <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <h2 className="font-semibold text-foreground">{t('payroll.tdsSummary')}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('payroll.tdsSummaryDesc')}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {showChallanDatePicker['TDS'] ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="date"
                            value={challanDueDate['TDS'] ?? ''}
                            onChange={e => setChallanDueDate(prev => ({ ...prev, TDS: e.target.value }))}
                            className="border rounded px-2 py-1 text-xs"
                          />
                          <button
                            onClick={() => challanDueDate['TDS'] && handleSetChallanReminder('TDS', challanDueDate['TDS'])}
                            className="px-2 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600"
                          >Save</button>
                          <button
                            onClick={() => setShowChallanDatePicker(prev => ({ ...prev, TDS: false }))}
                            className="px-2 py-1 text-xs border rounded hover:bg-muted"
                          >Cancel</button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => setShowChallanDatePicker(prev => ({ ...prev, TDS: true }))}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-400 text-amber-700 text-xs font-medium hover:bg-amber-50 transition-colors"
                          >
                            Set Due Date Reminder
                          </button>
                          <button
                            onClick={() => handleSendChallanReminderNow('TDS')}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-orange-400 text-orange-700 text-xs font-medium hover:bg-orange-50 transition-colors"
                          >
                            Send Reminder Now
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => downloadCSV(`tds-${new Date().toISOString().slice(0,7)}.csv`, [
                          ['Employee Name', 'Annual Gross (est.)', 'Taxable Income', 'TDS Deducted (Annual)', 'Effective Rate %'],
                          ...tdsRows.map((r) => [r.name, String(r.annualGross), String(r.taxable), String(r.tds), r.rate]),
                        ])}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition-colors"
                      >
                        {t('payroll.downloadTds')}
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <ThCell>Employee Name</ThCell>
                          <ThCell>Annual Gross (est.)</ThCell>
                          <ThCell>Taxable Income</ThCell>
                          <ThCell>TDS Deducted</ThCell>
                          <ThCell>Effective Rate %</ThCell>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {tdsRows.length === 0 && (
                          <tr><td colSpan={5} className="text-center py-8 text-muted-foreground text-sm">No salary structures found</td></tr>
                        )}
                        {tdsRows.map((r) => (
                          <tr key={r.name} className="hover:bg-muted">
                            <TdCell><span className="font-medium text-foreground">{r.name}</span></TdCell>
                            <TdCell right>{fmtINR(r.annualGross)}</TdCell>
                            <TdCell right>{fmtINR(r.taxable)}</TdCell>
                            <TdCell right><span className={r.tds > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}>{fmtINR(r.tds)}</span></TdCell>
                            <TdCell right><span className="text-muted-foreground">{r.rate}%</span></TdCell>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Fix 6: Payroll Lock History */}
                {(() => {
                  const completedLocks = payrollLocks.filter(l => !!l.unlocked_at).slice(0, 12);
                  return (
                    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                      <button
                        onClick={() => setLockHistoryOpen(o => !o)}
                        className="w-full px-6 py-4 border-b border-border flex items-center justify-between hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Lock className="h-4 w-4 text-muted-foreground" />
                          <h2 className="font-semibold text-foreground">Payroll Lock History</h2>
                          <span className="text-xs text-muted-foreground ml-1">({completedLocks.length} entries)</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{lockHistoryOpen ? '▴' : '▾'}</span>
                      </button>
                      {lockHistoryOpen && (
                        <div className="overflow-x-auto">
                          {completedLocks.length === 0 ? (
                            <p className="text-center py-8 text-muted-foreground text-sm">No completed lock/unlock history</p>
                          ) : (
                            <table className="w-full text-sm">
                              <thead className="bg-muted">
                                <tr>
                                  <ThCell>Period</ThCell>
                                  <ThCell>Locked By</ThCell>
                                  <ThCell>Locked At</ThCell>
                                  <ThCell>Unlocked By</ThCell>
                                  <ThCell>Unlocked At</ThCell>
                                  <ThCell>Unlock Reason</ThCell>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {completedLocks.map(l => (
                                  <tr key={l.id} className="hover:bg-muted">
                                    <TdCell><span className="font-medium text-foreground">{l.month} {l.year}</span></TdCell>
                                    <TdCell><span className="text-muted-foreground text-xs font-mono">{l.locked_by?.slice(0, 8)}…</span></TdCell>
                                    <TdCell><span className="text-muted-foreground">{new Date(l.locked_at).toLocaleString('en-IN')}</span></TdCell>
                                    <TdCell><span className="text-muted-foreground text-xs font-mono">{l.unlocked_by ? `${l.unlocked_by.slice(0, 8)}…` : '—'}</span></TdCell>
                                    <TdCell><span className="text-green-600">{l.unlocked_at ? new Date(l.unlocked_at).toLocaleString('en-IN') : '—'}</span></TdCell>
                                    <TdCell><span className="text-muted-foreground">{(l as any).unlock_reason || l.notes || '—'}</span></TdCell>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })()}
        </>
      )}

      {/* Salary Breakdown Quick-View Modal */}
      {breakdownRecord && (
        <SalaryBreakdownModal record={breakdownRecord} onClose={() => setBreakdownRecord(null)} />
      )}

      {/* Legacy Payslip Modal (My Payslips tab) */}
      {selectedRecord && (
        <PayslipModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
      )}

      {/* Detailed Payslip from My Payslips card grid */}
      {myPayslipViewRecord && (
        <DetailedPayslipModal
          record={myPayslipViewRecord}
          salaryStructures={salaryStructures}
          onClose={() => setMyPayslipViewRecord(null)}
        />
      )}

      {/* Salary Structure Modal */}
      {showStructModal && (
        <SalaryStructureModal
          existing={editingStruct}
          onClose={() => setShowStructModal(false)}
          onSaved={loadSalaryStructures}
        />
      )}

      {/* Detailed Payslip Viewer Modal */}
      {viewerRecord && (
        <DetailedPayslipModal
          record={viewerRecord}
          salaryStructures={salaryStructures}
          onClose={() => setViewerRecord(null)}
        />
      )}

      {/* Unlock Payroll Modal */}
      {showUnlockModal && unlockTargetLock && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-foreground">Unlock Payroll</h2>
              <button onClick={() => { setShowUnlockModal(false); setUnlockTargetLock(null); setUnlockReason(''); }} className="p-1 rounded-lg hover:bg-muted transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Unlock payroll for <span className="font-semibold text-foreground">{unlockTargetLock.month} {unlockTargetLock.year}</span>. Please provide a reason.
              </p>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Unlock Reason <span className="text-red-400">*</span></label>
                <textarea
                  rows={3}
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  placeholder="Provide a reason for unlocking (min 10 characters)"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                />
                {unlockReason.length > 0 && unlockReason.length < 10 && (
                  <p className="text-xs text-red-500">Reason must be at least 10 characters</p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowUnlockModal(false); setUnlockTargetLock(null); setUnlockReason(''); }}
                  className="flex-1 py-2 px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await handleUnlockPayroll(unlockTargetLock, unlockReason);
                    setShowUnlockModal(false);
                    setUnlockTargetLock(null);
                    setUnlockReason('');
                  }}
                  disabled={unlockReason.trim().length < 10}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
                >
                  Confirm Unlock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lock Payroll Modal */}
      {showLockModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-foreground">{t('payroll.lockPayroll')}</h2>
              <button onClick={() => setShowLockModal(false)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('payroll.lockConfirmMsg')} <span className="font-semibold text-foreground">{processMonth} {processYear}</span>
              </p>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('payroll.lockNotes')}</label>
                <textarea
                  rows={3}
                  value={lockNotes}
                  onChange={(e) => setLockNotes(e.target.value)}
                  placeholder={t('payroll.lockNotesPlaceholder')}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLockModal(false)}
                  className="flex-1 py-2 px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleLockPayroll}
                  disabled={lockingPayroll}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {lockingPayroll && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Lock className="h-4 w-4" />
                  {t('payroll.confirmLock')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fix 3: Revision View Detail Modal */}
      {viewingRevision && (() => {
        const rev = viewingRevision;
        const empName = salaryStructures.find(s => s.employee_id === rev.employee_id)?.employee_name || rev.employee_id;
        const statusCls = rev.approval_status === 'approved'
          ? 'bg-green-100 text-green-800'
          : rev.approval_status === 'rejected'
          ? 'bg-red-100 text-red-700'
          : 'bg-yellow-100 text-yellow-800';
        const Row = ({ label, value }: { label: string; value: string }) => (
          <div className="flex justify-between py-2 border-b border-border/50 last:border-0 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-foreground text-right max-w-[60%]">{value}</span>
          </div>
        );
        return (
          <div className="fixed inset-0 z-[450] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setViewingRevision(null)}>
            <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div>
                  <h2 className="font-semibold text-foreground">Revision Details</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{empName}</p>
                </div>
                <button onClick={() => setViewingRevision(null)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <div className="p-5 space-y-1">
                <Row label="Employee" value={empName || '—'} />
                <Row label="Old CTC" value={fmtINR(rev.old_ctc)} />
                <Row label="New CTC" value={fmtINR(rev.new_ctc)} />
                <Row label="Effective From" value={rev.effective_from ? new Date(rev.effective_from).toLocaleDateString('en-IN') : '—'} />
                <Row label="Revision Type" value={rev.revision_type?.replace(/_/g, ' ') || '—'} />
                <Row label="Notes" value={rev.notes || '—'} />
                <div className="flex justify-between py-2 border-b border-border/50 text-sm">
                  <span className="text-muted-foreground">Approval Status</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusCls}`}>{rev.approval_status}</span>
                </div>
                <Row label="Approved By" value={rev.approved_by ? `${rev.approved_by.slice(0, 8)}…` : '—'} />
                <Row label="Submitted By" value={rev.submitted_by ? `${rev.submitted_by.slice(0, 8)}…` : '—'} />
                <Row label="Created At" value={rev.created_at ? new Date(rev.created_at).toLocaleString('en-IN') : '—'} />
              </div>
              <div className="px-5 pb-5">
                <button onClick={() => setViewingRevision(null)} className="w-full py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tax Declaration Edit Modal */}
      {editingTaxDecl && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-foreground">Tax Declaration — {editingTaxDecl.employee_name}</h2>
              <button onClick={() => setEditingTaxDecl(null)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Tax Regime</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      value="new"
                      checked={taxDeclForm.tax_regime === 'new'}
                      onChange={() => setTaxDeclForm(f => ({ ...f, tax_regime: 'new' }))}
                    />
                    New Regime
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      value="old"
                      checked={taxDeclForm.tax_regime === 'old'}
                      onChange={() => setTaxDeclForm(f => ({ ...f, tax_regime: 'old' }))}
                    />
                    Old Regime
                  </label>
                </div>
              </div>
              {taxDeclForm.tax_regime === 'new' && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                  Deductions under 80C, 80D, NPS, and HRA are not applicable under the New Tax Regime.
                </div>
              )}
              {taxDeclForm.tax_regime === 'old' && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">HRA Declaration (Annual HRA exempt amount)</label>
                    <input
                      type="number"
                      value={taxDeclForm.hra_declaration}
                      onChange={e => setTaxDeclForm(f => ({ ...f, hra_declaration: e.target.value }))}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      min={0}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">80C Investments (max ₹1,50,000)</label>
                    <input
                      type="number"
                      value={taxDeclForm.declared_80c}
                      onChange={e => setTaxDeclForm(f => ({ ...f, declared_80c: e.target.value }))}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      min={0}
                      max={150000}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">80D Health Insurance (max ₹25,000)</label>
                    <input
                      type="number"
                      value={taxDeclForm.declared_80d}
                      onChange={e => setTaxDeclForm(f => ({ ...f, declared_80d: e.target.value }))}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      min={0}
                      max={25000}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">NPS 80CCD(1B) (max ₹50,000)</label>
                    <input
                      type="number"
                      value={taxDeclForm.declared_nps}
                      onChange={e => setTaxDeclForm(f => ({ ...f, declared_nps: e.target.value }))}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      min={0}
                      max={50000}
                    />
                  </div>
                </>
              )}
              {taxDeclForm.tax_regime === 'old' && (() => {
                const hra = parseFloat(taxDeclForm.hra_declaration) || 0;
                const c80 = Math.min(parseFloat(taxDeclForm.declared_80c) || 0, 150000);
                const d80 = Math.min(parseFloat(taxDeclForm.declared_80d) || 0, 25000);
                const nps = Math.min(parseFloat(taxDeclForm.declared_nps) || 0, 50000);
                const totalDecl = hra + c80 + d80 + nps;
                // marginal rate: assume 30% for simplicity (most employees claiming deductions are in 30% slab)
                const marginalRate = 0.30;
                const taxSaving = Math.round(totalDecl * marginalRate * 1.04);
                return (
                  <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs">
                    <span className="text-muted-foreground">Total Declarations: </span>
                    <span className="font-semibold text-foreground">{fmtINR(totalDecl)}</span>
                    <span className="ml-3 text-muted-foreground">Effective Tax Saving: </span>
                    <span className="font-semibold text-green-700">{fmtINR(taxSaving)}</span>
                  </div>
                );
              })()}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditingTaxDecl(null)}
                  className="flex-1 py-2 px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setSavingTaxDecl(true);
                    const hra = parseFloat(taxDeclForm.hra_declaration) || 0;
                    const c80 = parseFloat(taxDeclForm.declared_80c) || 0;
                    const d80 = parseFloat(taxDeclForm.declared_80d) || 0;
                    const nps = parseFloat(taxDeclForm.declared_nps) || 0;
                    void supabase.from("salary_structures").update({
                      tax_regime: taxDeclForm.tax_regime,
                      hra_declaration: hra,
                      declared_80c: c80,
                      declared_80d: d80,
                      declared_nps: nps,
                      declared_other_investments: hra + c80 + d80 + nps,
                    }).eq("id", editingTaxDecl.id);
                    void supabase.from("tax_declarations").upsert([{
                      employee_id: editingTaxDecl.employee_id,
                      fy: '2025-26',
                      declaration_80c: c80,
                      declaration_80d: d80,
                      declaration_nps: nps,
                      hra_claimed: hra,
                      updated_at: new Date().toISOString(),
                    }], { onConflict: 'employee_id,fy' });
                    await new Promise(r => setTimeout(r, 500));
                    const { data: decls } = await supabase.from("salary_structures").select("id, employee_id, employee_name, tax_regime, hra_declaration, declared_80c, declared_80d, declared_nps");
                    setTaxDeclarations(decls || []);
                    setEditingTaxDecl(null);
                    setSavingTaxDecl(false);
                    toast.success("Tax declaration saved");
                  }}
                  disabled={savingTaxDecl}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {savingTaxDecl && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Declarations
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Salary Revision Slide-over */}
      {showRevisionModal && (
        <div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="font-semibold text-foreground">{t('payroll.reviseSalary')}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{revisingStruct?.employee_name || 'Select employee'}</p>
              </div>
              <button onClick={() => { setShowRevisionModal(false); setRevisingStruct(null); setNewBasic(''); }} className="p-1 rounded-lg hover:bg-muted transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Employee selector (shown when opened from the tab button) */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Employee <span className="text-red-400">*</span></label>
                <select
                  value={revisingStruct?.employee_id || ''}
                  onChange={(e) => {
                    const s = salaryStructures.find(st => st.employee_id === e.target.value) || null;
                    setRevisingStruct(s);
                  }}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select employee...</option>
                  {salaryStructures.map(st => (
                    <option key={st.employee_id} value={st.employee_id}>{st.employee_name}</option>
                  ))}
                </select>
              </div>
              {revisingStruct && (
                <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('payroll.currentCtc')}</span>
                    <span className="font-semibold text-foreground">
                      {fmtINR(revisingStruct.basic_salary + revisingStruct.hra + revisingStruct.transport_allowance + (revisingStruct.other_allowances || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Basic</span>
                    <span className="font-semibold text-foreground">{fmtINR(revisingStruct.basic_salary)}</span>
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('payroll.newCtc')} <span className="text-red-400">*</span></label>
                <input
                  type="number"
                  value={revisionForm.new_ctc}
                  onChange={(e) => setRevisionForm(f => ({ ...f, new_ctc: e.target.value }))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  min={1}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">New Basic Salary</label>
                <input
                  type="number"
                  value={newBasic}
                  onChange={(e) => setNewBasic(e.target.value)}
                  placeholder="e.g. 30000"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  min={0}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('payroll.effectiveFrom')}</label>
                <input
                  type="date"
                  value={revisionForm.effective_from}
                  onChange={(e) => setRevisionForm(f => ({ ...f, effective_from: e.target.value }))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('payroll.revisionType')}</label>
                <select
                  value={revisionForm.revision_type}
                  onChange={(e) => setRevisionForm(f => ({ ...f, revision_type: e.target.value }))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="annual_appraisal">{t('payroll.annualAppraisal')}</option>
                  <option value="promotion">{t('payroll.promotion')}</option>
                  <option value="correction">{t('payroll.correction')}</option>
                  <option value="joining">{t('payroll.joining')}</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('payroll.revisionNotes')}</label>
                <textarea
                  rows={2}
                  value={revisionForm.notes}
                  onChange={(e) => setRevisionForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setShowRevisionModal(false); setRevisingStruct(null); setNewBasic(''); }}
                  className="flex-1 py-2 px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleSubmitRevision}
                  disabled={submittingRevision}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {submittingRevision && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('payroll.submitRevision')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TDS Override Modal */}
      {showTdsOverrideModal && overridingRecord && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-foreground">Override TDS</h2>
              <button
                onClick={() => { setShowTdsOverrideModal(false); setOverridingRecord(null); }}
                className="p-1 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Overriding TDS for <span className="font-medium text-foreground">{overridingRecord.employeeName}</span>
              </p>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Override TDS Amount (₹)</label>
                <input
                  type="number"
                  value={tdsOverrideAmount}
                  onChange={(e) => setTdsOverrideAmount(Number(e.target.value))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  min={0}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Override Reason <span className="text-red-400">*</span> (min 20 chars)</label>
                <textarea
                  rows={3}
                  value={tdsOverrideReason}
                  onChange={(e) => setTdsOverrideReason(e.target.value)}
                  placeholder="Reason for overriding TDS amount..."
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                />
                {tdsOverrideReason.length > 0 && tdsOverrideReason.length < 20 && (
                  <p className="text-xs text-red-500">{20 - tdsOverrideReason.length} more characters required</p>
                )}
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setShowTdsOverrideModal(false); setOverridingRecord(null); }}
                  className="flex-1 py-2 px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={tdsOverrideReason.trim().length < 20}
                  onClick={() => {
                    const rec = overridingRecord;
                    const originalTds = rec.taxDeduction || 0;
                    const newTds = tdsOverrideAmount;
                    const existingDetails = (() => {
                      try { return JSON.parse((rec as any).tds_calculation_details || '{}'); } catch { return {}; }
                    })();
                    const updatedDetails = {
                      ...existingDetails,
                      overridden: true,
                      override_reason: tdsOverrideReason,
                      original_tds: originalTds,
                      override_by: currentUser?.id,
                    };
                    // Update local state via refresh — optimistically done via DB update
                    if (rec.id && rec.id !== '') {
                      void supabase.from('payroll_records').update({
                        tds: newTds,
                        tds_calculation_details: JSON.stringify(updatedDetails),
                      }).eq('id', rec.id);
                    }
                    setShowTdsOverrideModal(false);
                    setOverridingRecord(null);
                    toast.success("TDS overridden successfully");
                  }}
                  className="flex-1 py-2 px-4 rounded-lg bg-yellow-600 text-white text-sm font-medium hover:bg-yellow-700 disabled:opacity-50 transition-colors"
                >
                  Save Override
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PayrollManagementEnhanced;
