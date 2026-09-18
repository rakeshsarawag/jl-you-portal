export const LEAVE_TYPES = [
  "Annual Leave",
  "Sick Leave",
  "Casual Leave",
  "Maternity Leave",
  "Paternity Leave",
  "Unpaid Leave",
  "Compensatory Leave",
  "Bereavement Leave",
] as const;

export const LEAVE_STATUSES = ["Pending", "Approved", "Rejected", "Cancelled"] as const;
export const ATTENDANCE_STATUSES = ["Present", "Absent", "Half Day", "Work From Home", "Holiday"] as const;

export const DEFAULT_LEAVE_BALANCES: Record<string, number> = {
  "Annual Leave": 18,
  "Sick Leave": 12,
  "Casual Leave": 6,
};
