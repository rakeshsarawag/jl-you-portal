import { z } from "zod";

// ==================== LEAVE ====================

export const leaveApplicationSchema = z.object({
  leave_type: z.string().min(1, "Leave type is required"),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  reason: z.string().min(10, "Please provide a reason (min 10 characters)").max(500),
  is_half_day: z.boolean().optional().default(false),
  half_day_period: z.enum(["morning", "afternoon"]).optional(),
}).refine(data => {
  const start = new Date(data.start_date);
  const end = new Date(data.end_date);
  return end >= start;
}, { message: "End date must be on or after start date", path: ["end_date"] });

export type LeaveApplicationInput = z.infer<typeof leaveApplicationSchema>;

// ==================== PAYROLL ====================

export const payrollRecordSchema = z.object({
  employee_id: z.string().uuid("Invalid employee ID"),
  month: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  basic_salary: z.number().min(0),
  hra: z.number().min(0).default(0),
  transport_allowance: z.number().min(0).default(0),
  medical_allowance: z.number().min(0).default(0),
  other_allowances: z.number().min(0).default(0),
  pf_deduction: z.number().min(0).default(0),
  tax_deduction: z.number().min(0).default(0),
  other_deductions: z.number().min(0).default(0),
  payment_method: z.enum(["Bank Transfer", "Cheque", "Cash"]).default("Bank Transfer"),
  status: z.enum(["Draft", "Approved", "Paid", "Cancelled"]).default("Draft"),
});

export type PayrollRecordInput = z.infer<typeof payrollRecordSchema>;

// ==================== ASSET ====================

export const assetCreateSchema = z.object({
  name: z.string().min(1, "Asset name is required").max(200),
  type: z.string().min(1, "Asset type is required"),
  category: z.string().min(1, "Category is required"),
  serial_number: z.string().optional(),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  purchase_cost: z.number().min(0).optional(),
  vendor: z.string().optional(),
  warranty_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["Available", "Assigned", "In Repair", "Retired", "Disposed"]).default("Available"),
  condition: z.enum(["New", "Good", "Fair", "Poor"]).default("Good"),
  location: z.string().optional(),
});

export type AssetCreateInput = z.infer<typeof assetCreateSchema>;

// ==================== EMPLOYEE ====================

export const employeeProfileUpdateSchema = z.object({
  phone: z.string().regex(/^[0-9+\-\s()]{7,15}$/, "Invalid phone number").optional().or(z.literal("")),
  address: z.string().max(500).optional(),
  emergency_contact_name: z.string().max(200).optional(),
  bank_account_number: z.string().max(30).optional(),
  pan_number: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format").optional().or(z.literal("")),
});

export type EmployeeProfileUpdateInput = z.infer<typeof employeeProfileUpdateSchema>;

// ==================== RECRUITMENT ====================

export const jobRequisitionSchema = z.object({
  title: z.string().min(1, "Job title is required").max(200),
  department: z.string().min(1, "Department is required"),
  location: z.string().min(1, "Location is required"),
  employment_type: z.enum(["Full-time", "Part-time", "Contract", "Internship"]).default("Full-time"),
  positions: z.number().int().min(1).max(100),
  priority: z.enum(["Low", "Medium", "High", "Critical"]).default("Medium"),
  expected_ctc_min: z.number().min(0).optional(),
  expected_ctc_max: z.number().min(0).optional(),
  required_skills: z.array(z.string()).optional(),
  description: z.string().min(10, "Job description is required"),
  requirements: z.string().optional(),
}).refine(data => {
  if (data.expected_ctc_min && data.expected_ctc_max) {
    return data.expected_ctc_max >= data.expected_ctc_min;
  }
  return true;
}, { message: "Max CTC must be >= min CTC", path: ["expected_ctc_max"] });

export type JobRequisitionInput = z.infer<typeof jobRequisitionSchema>;
