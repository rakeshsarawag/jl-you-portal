import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { auditCreate, auditUpdate } from "./audit-helpers.ts";

const app = new Hono();

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

// ==================== PAYROLL RECORDS ====================

app.get('/records', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('payroll_records')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: (data || []).map(shapeRecord) });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch payroll records' }, 500);
  }
});

app.post('/records', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const basic = body.basicSalary || body.baseSalary || 0;
    const hra = body.hra || 0;
    const transport = body.transportAllowance || 0;
    const medical = body.medicalAllowance || 0;
    const otherAllowances = body.otherAllowances || 0;
    const gross = body.grossSalary || (basic + hra + transport + medical + otherAllowances);
    const pf = body.pfDeduction || 0;
    const tax = body.taxDeduction || 0;
    const otherDeductions = body.otherDeductions || 0;
    const totalDeductions = body.totalDeductions || (pf + tax + otherDeductions);
    const net = body.netSalary || (gross - totalDeductions);

    const { data, error } = await supabase
      .from('payroll_records')
      .insert([{
        employee_id: body.employeeId || null,
        employee_name: body.employeeName || '',
        employee_email: body.email || body.employeeEmail || '',
        department: body.department || '',
        designation: body.designation || body.jobTitle || '',
        month: body.month || new Date().toLocaleString('default', { month: 'long' }),
        year: body.year || new Date().getFullYear(),
        basic_salary: basic,
        hra,
        transport_allowance: transport,
        medical_allowance: medical,
        other_allowances: otherAllowances,
        gross_salary: gross,
        pf_deduction: pf,
        tax_deduction: tax,
        other_deductions: otherDeductions,
        total_deductions: totalDeductions,
        net_salary: net,
        status: body.status || 'Draft',
        payment_date: body.paymentDate || null,
        payment_method: body.paymentMethod || 'Bank Transfer',
        bank_account: body.bankAccount || '',
        notes: body.notes || '',
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: shapeRecord(data) }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create payroll record' }, 500);
  }
});

app.put('/records/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('payroll_records')
      .update({
        status: body.status,
        payment_date: body.paymentDate || null,
        payment_method: body.paymentMethod,
        notes: body.notes,
        basic_salary: body.basicSalary || body.baseSalary,
        hra: body.hra,
        transport_allowance: body.transportAllowance,
        medical_allowance: body.medicalAllowance,
        other_allowances: body.otherAllowances,
        gross_salary: body.grossSalary,
        pf_deduction: body.pfDeduction,
        tax_deduction: body.taxDeduction,
        other_deductions: body.otherDeductions,
        total_deductions: body.totalDeductions,
        net_salary: body.netSalary,
        ...auditUpdate(c),
      })
      .eq('id', c.req.param('id'))
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);

    // If status changed to Paid/Approved, notify the employee
    if (body.status === 'Paid' || body.status === 'Approved') {
      const rec = data;
      const employeeId = rec.employee_id;
      const monthName = rec.month;
      const year = rec.year;
      const netPay = rec.net_salary || 0;
      if (employeeId) {
        try {
          await supabase.from('notifications').insert({
            user_id: employeeId,
            title: 'Payslip Available',
            message: `Your payslip for ${monthName} ${year} is now available. Net Pay: ₹${netPay.toLocaleString('en-IN')}.`,
            type: 'payroll',
            link: '/employee-dashboard',
            ...auditCreate(c),
          });
        } catch {}
        try {
          const { sendPushToUser } = await import('./push-utils.tsx');
          await sendPushToUser(employeeId, {
            title: 'Payslip Ready',
            body: `Your ${monthName} payslip is available. Net Pay: ₹${netPay.toLocaleString('en-IN')}`,
            type: 'payroll',
            link: '/employee-dashboard',
          });
        } catch {}
      }
    }

    return c.json({ success: true, data: shapeRecord(data) });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update payroll record' }, 500);
  }
});

// ==================== ATTENDANCE HELPER ====================
async function getAttendanceDays(
  supabase: any,
  employeeId: string,
  month: number,
  year: number
): Promise<{ workingDays: number; presentDays: number }> {
  try {
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const { data } = await supabase
      .from('attendance')
      .select('status')
      .eq('employee_id', employeeId)
      .gte('attendance_date', monthStart)
      .lte('attendance_date', monthEnd);

    if (!data?.length) return { workingDays: 26, presentDays: 26 };

    const workingDays = data.length;
    let presentDays = 0;
    for (const rec of data) {
      if (['Present', 'Late', 'Work From Home'].includes(rec.status)) presentDays += 1;
      else if (rec.status === 'Half Day') presentDays += 0.5;
    }
    return { workingDays, presentDays };
  } catch {
    return { workingDays: 26, presentDays: 26 };
  }
}

// ==================== LEAVE DEDUCTION HELPER ====================
async function getUnpaidLeaveDays(supabase: any, employeeId: string, month: number, year: number): Promise<number> {
  try {
    const monthStart = new Date(year, month - 1, 1).toISOString();
    const monthEnd = new Date(year, month, 0).toISOString();
    const { data } = await supabase
      .from('leaves')
      .select('start_date, end_date, leave_type')
      .eq('employee_id', employeeId)
      .eq('status', 'Approved')
      .in('leave_type', ['LOP', 'Loss of Pay', 'Unpaid', 'Without Pay'])
      .gte('start_date', monthStart)
      .lte('end_date', monthEnd);

    if (!data?.length) return 0;
    return data.reduce((sum: number, leave: any) => {
      const start = new Date(leave.start_date);
      const end = new Date(leave.end_date);
      return sum + Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
    }, 0);
  } catch { return 0; }
}

// Indian statutory payroll calculation constants
const PF_RATE = 0.12;          // 12% of basic (capped at ₹15,000 basic)
const PF_BASIC_CAP = 15000;    // PF ceiling on basic
const ESI_GROSS_LIMIT = 21000; // ESI applicable only when gross ≤ ₹21,000
const ESI_EMPLOYEE_RATE = 0.0075; // Employee ESI: 0.75%
const PROF_TAX_THRESHOLD = 10000; // Professional tax applicable above this gross
const PROF_TAX = 200;          // Fixed professional tax (₹/month)
const TDS_ANNUAL_EXEMPT = 500000; // Annual income exempt from TDS
const TDS_RATE = 0.10;         // Basic TDS slab

function computePayroll(struct: Record<string, any> | null, lopDays: number) {
  const basic = Number(struct?.basic_salary ?? 0);
  const hra = Number(struct?.hra ?? 0);
  const transport = Number(struct?.transport_allowance ?? 0);
  const medical = Number(struct?.medical_allowance ?? 0);
  const otherAllowances = Number(struct?.other_allowances ?? 0);
  const grossBeforeLop = basic + hra + transport + medical + otherAllowances;

  const workingDays = 26;
  const lopDeduction = lopDays > 0 && grossBeforeLop > 0
    ? Math.round((grossBeforeLop / workingDays) * lopDays)
    : 0;
  const gross = grossBeforeLop - lopDeduction;

  const pfBasic = Math.min(basic, PF_BASIC_CAP);
  const pf = pfBasic > 0 ? Math.round(pfBasic * PF_RATE) : 0;
  const esi = grossBeforeLop > 0 && grossBeforeLop <= ESI_GROSS_LIMIT
    ? Math.round(grossBeforeLop * ESI_EMPLOYEE_RATE)
    : 0;
  const profTax = gross > PROF_TAX_THRESHOLD ? PROF_TAX : 0;
  const annualTaxable = grossBeforeLop * 12;
  const tds = annualTaxable > TDS_ANNUAL_EXEMPT
    ? Math.round(((annualTaxable - TDS_ANNUAL_EXEMPT) * TDS_RATE) / 12)
    : 0;
  const totalDeductions = pf + esi + profTax + tds + lopDeduction;
  const netSalary = Math.max(0, grossBeforeLop - pf - esi - profTax - tds - lopDeduction);

  return { basic, hra, transport, medical, otherAllowances, grossBeforeLop, pf, esi, profTax, tds, lopDeduction, totalDeductions, netSalary };
}

// Process payroll for a month/year — creates records for all active employees
// Pulls salary structures from DB and computes all values server-side.
app.post('/process', async (c) => {
  try {
    const supabase = getSupabase();
    const { month, year } = await c.req.json();

    if (!month || !year) {
      return c.json({ success: false, error: 'month and year are required' }, 400);
    }

    // Get all active employees
    const { data: employees, error: empErr } = await supabase
      .from('employees')
      .select('id, name, email, department, job_title')
      .eq('status', 'Active');

    if (empErr) return c.json({ success: false, error: empErr.message }, 500);
    if (!employees?.length) {
      return c.json({ success: false, error: 'No active employees found' }, 400);
    }

    // Fetch all salary structures into a map keyed by employee_id
    const { data: structures } = await supabase
      .from('salary_structures')
      .select('*');
    const structMap = new Map<string, any>((structures ?? []).map((s: any) => [s.employee_id, s]));

    // Parse month number from name (e.g. "January" → 1)
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const monthNum = typeof month === 'number' ? month : monthNames.indexOf(month) + 1;

    let created = 0, skipped = 0, noStructure = 0;

    for (const emp of employees) {
      // Skip if record already exists for this month/year
      const { data: existing } = await supabase
        .from('payroll_records')
        .select('id')
        .eq('employee_id', emp.id)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle();

      if (existing) { skipped++; continue; }

      // LOP days from approved unpaid leaves
      const lopDays = await getUnpaidLeaveDays(supabase, emp.id, monthNum, year);

      // Attendance: working days and days present from the attendance table
      const { workingDays, presentDays } = await getAttendanceDays(supabase, emp.id, monthNum, year);

      // Compute all payroll values from salary structure
      const struct = structMap.get(emp.id) ?? null;
      // Skip employees without a salary structure — can't compute meaningful payroll
      if (!struct) { noStructure++; continue; }
      const calc = computePayroll(struct, lopDays);

      await supabase.from('payroll_records').insert([{
        employee_id: emp.id,
        employee_name: emp.name,
        employee_email: emp.email,
        department: emp.department || '',
        designation: emp.job_title || '',
        month,
        year,
        basic_salary: calc.basic,
        hra: calc.hra,
        transport_allowance: calc.transport,
        medical_allowance: calc.medical,
        other_allowances: calc.otherAllowances,
        gross_salary: calc.grossBeforeLop,
        pf_deduction: calc.pf,
        tax_deduction: calc.tds,
        other_deductions: calc.esi + calc.profTax,
        total_deductions: calc.totalDeductions,
        net_salary: calc.netSalary,
        lop_days: lopDays,
        lop_deduction: calc.lopDeduction,
        working_days: workingDays,
        present_days: presentDays,
        status: 'Processed',
        payment_method: 'Bank Transfer',
        ...auditCreate(c),
      }]);
      created++;
    }

    return c.json({ success: true, created, skipped, noStructure, total: employees.length });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to process payroll' }, 500);
  }
});

app.delete('/records/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('payroll_records').delete().eq('id', c.req.param('id'));
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete record' }, 500);
  }
});

// ==================== STATS ====================

app.get('/stats', async (c) => {
  try {
    const supabase = getSupabase();
    const { data } = await supabase.from('payroll_records').select('status, net_salary, month, year');

    const now = new Date();
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const currentMonth = monthNames[now.getMonth()];
    const currentYear = now.getFullYear();

    const total = data?.length || 0;
    const paid = data?.filter((r: any) => r.status === 'Paid').length || 0;
    const totalPayout = data?.filter((r: any) => r.status === 'Paid')
      .reduce((sum: number, r: any) => sum + (r.net_salary || 0), 0) || 0;
    const processed = data?.filter((r: any) => ['Processed', 'Approved', 'Paid'].includes(r.status)).length || 0;

    // Current month records for cost/avg salary
    const currentMonthRecords = data?.filter((r: any) => r.month === currentMonth && r.year === currentYear) || [];
    const totalCost = currentMonthRecords.reduce((s: number, r: any) => s + (r.net_salary || 0), 0);
    const avgSalary = currentMonthRecords.length > 0
      ? Math.round(totalCost / currentMonthRecords.length)
      : 0;

    return c.json({ success: true, data: { totalRecords: total, paidRecords: paid, totalPayout, totalCost, avgSalary, processed } });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch stats' }, 500);
  }
});

// ==================== SALARY STRUCTURES ====================

async function isTableMissing(supabase: any, table: string): Promise<boolean> {
  const { error } = await supabase.from(table).select('id').limit(1);
  return !!error && (error.code === '42P01' || error.message?.includes('does not exist'));
}

app.get('/salary-structures', async (c) => {
  try {
    const supabase = getSupabase();
    if (await isTableMissing(supabase, 'salary_structures')) {
      return c.json({ success: true, data: [] });
    }
    const { data, error } = await supabase
      .from('salary_structures')
      .select('*')
      .order('employee_name', { ascending: true });
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch salary structures' }, 500);
  }
});

app.post('/salary-structures', async (c) => {
  try {
    const supabase = getSupabase();
    if (await isTableMissing(supabase, 'salary_structures')) {
      return c.json({ success: false, error: 'salary_structures table does not exist' }, 500);
    }
    const body = await c.req.json();
    const { data, error } = await supabase
      .from('salary_structures')
      .insert([{
        employee_id: body.employee_id || '',
        employee_name: body.employee_name || '',
        basic_salary: body.basic_salary || 0,
        hra: body.hra || 0,
        transport_allowance: body.transport_allowance || 0,
        other_allowances: body.other_allowances || 0,
        effective_from: body.effective_from || new Date().toISOString().slice(0, 10),
        ...auditCreate(c),
      }])
      .select()
      .single();
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create salary structure' }, 500);
  }
});

app.get('/salary-structures/:id', async (c) => {
  try {
    const supabase = getSupabase();
    if (await isTableMissing(supabase, 'salary_structures')) {
      return c.json({ success: false, error: 'Not found' }, 404);
    }
    const { data, error } = await supabase
      .from('salary_structures')
      .select('*')
      .eq('id', c.req.param('id'))
      .single();
    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch salary structure' }, 500);
  }
});

app.put('/salary-structures/:id', async (c) => {
  try {
    const supabase = getSupabase();
    if (await isTableMissing(supabase, 'salary_structures')) {
      return c.json({ success: false, error: 'Not found' }, 404);
    }
    const body = await c.req.json();
    const { data, error } = await supabase
      .from('salary_structures')
      .update({
        employee_id: body.employee_id,
        employee_name: body.employee_name,
        basic_salary: body.basic_salary,
        hra: body.hra,
        transport_allowance: body.transport_allowance,
        other_allowances: body.other_allowances,
        effective_from: body.effective_from,
        ...auditUpdate(c),
      })
      .eq('id', c.req.param('id'))
      .select()
      .single();
    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update salary structure' }, 500);
  }
});

function shapeRecord(r: any) {
  return {
    id: r.id,
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    email: r.employee_email,
    department: r.department,
    designation: r.designation,
    month: r.month,
    year: r.year,
    basicSalary: r.basic_salary,
    hra: r.hra,
    transportAllowance: r.transport_allowance,
    medicalAllowance: r.medical_allowance,
    otherAllowances: r.other_allowances,
    grossSalary: r.gross_salary,
    pfDeduction: r.pf_deduction,
    taxDeduction: r.tax_deduction,
    otherDeductions: r.other_deductions,
    totalDeductions: r.total_deductions,
    netSalary: r.net_salary,
    lopDays: r.lop_days || 0,
    lopDeduction: r.lop_deduction || 0,
    workingDays: r.working_days ?? 26,
    presentDays: r.present_days ?? 0,
    status: r.status,
    paymentDate: r.payment_date,
    paymentMethod: r.payment_method,
    bankAccount: r.bank_account,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export default app;
