import { describe, it, expect } from "vitest";
import { leaveApplicationSchema, payrollRecordSchema, assetCreateSchema, employeeProfileUpdateSchema } from "../../../src/utils/schemas";

describe("leaveApplicationSchema", () => {
  const valid = {
    leave_type: "Annual Leave",
    start_date: "2026-09-15",
    end_date: "2026-09-17",
    reason: "Family vacation trip",
  };

  it("accepts valid leave application", () => {
    expect(leaveApplicationSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects empty leave_type", () => {
    const result = leaveApplicationSchema.safeParse({ ...valid, leave_type: "" });
    expect(result.success).toBe(false);
  });

  it("rejects reason shorter than 10 chars", () => {
    const result = leaveApplicationSchema.safeParse({ ...valid, reason: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects end_date before start_date", () => {
    const result = leaveApplicationSchema.safeParse({ ...valid, start_date: "2026-09-17", end_date: "2026-09-15" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date format", () => {
    const result = leaveApplicationSchema.safeParse({ ...valid, start_date: "15-09-2026" });
    expect(result.success).toBe(false);
  });

  it("same start and end date is valid", () => {
    expect(leaveApplicationSchema.safeParse({ ...valid, end_date: "2026-09-15" }).success).toBe(true);
  });
});

describe("payrollRecordSchema", () => {
  const valid = {
    employee_id: "123e4567-e89b-12d3-a456-426614174000",
    month: "September",
    year: 2026,
    basic_salary: 50000,
  };

  it("accepts valid payroll record", () => {
    expect(payrollRecordSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invalid UUID for employee_id", () => {
    const result = payrollRecordSchema.safeParse({ ...valid, employee_id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects year out of range", () => {
    expect(payrollRecordSchema.safeParse({ ...valid, year: 1999 }).success).toBe(false);
    expect(payrollRecordSchema.safeParse({ ...valid, year: 2200 }).success).toBe(false);
  });

  it("rejects negative basic salary", () => {
    expect(payrollRecordSchema.safeParse({ ...valid, basic_salary: -1 }).success).toBe(false);
  });

  it("defaults status to Draft", () => {
    const result = payrollRecordSchema.safeParse(valid);
    if (result.success) expect(result.data.status).toBe("Draft");
  });
});

describe("assetCreateSchema", () => {
  const valid = { name: "MacBook Pro 14", type: "Laptop", category: "Electronics" };

  it("accepts minimal valid asset", () => {
    expect(assetCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(assetCreateSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
  });

  it("rejects invalid status value", () => {
    expect(assetCreateSchema.safeParse({ ...valid, status: "Lost" }).success).toBe(false);
  });

  it("defaults status to Available", () => {
    const result = assetCreateSchema.safeParse(valid);
    if (result.success) expect(result.data.status).toBe("Available");
  });
});

describe("employeeProfileUpdateSchema", () => {
  it("accepts valid PAN number", () => {
    expect(employeeProfileUpdateSchema.safeParse({ pan_number: "ABCDE1234F" }).success).toBe(true);
  });

  it("rejects invalid PAN format", () => {
    expect(employeeProfileUpdateSchema.safeParse({ pan_number: "invalid" }).success).toBe(false);
  });

  it("accepts empty PAN (optional)", () => {
    expect(employeeProfileUpdateSchema.safeParse({ pan_number: "" }).success).toBe(true);
  });

  it("accepts empty profile update", () => {
    expect(employeeProfileUpdateSchema.safeParse({}).success).toBe(true);
  });
});
