export const USER_STATUSES = ['active', 'inactive', 'suspended'] as const;
export type UserStatus = typeof USER_STATUSES[number];

export const USER_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  suspended: 'Suspended',
};

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Super Admin',
  hr: 'HR Manager',
  manager: 'Line Manager',
  employee: 'Employee',
  finance: 'Finance',
  it: 'IT Admin',
  marketing: 'Marketing',
};

export const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  hr: 'bg-blue-100 text-blue-700',
  manager: 'bg-green-100 text-green-700',
  employee: 'bg-gray-100 text-gray-700',
  finance: 'bg-yellow-100 text-yellow-700',
  it: 'bg-red-100 text-red-700',
  marketing: 'bg-pink-100 text-pink-700',
};

export const ALL_ROLES = ['admin', 'hr', 'manager', 'employee', 'finance', 'it', 'marketing'] as const;
export type AppRole = typeof ALL_ROLES[number];

export const USER_EXPORT_FIELDS = ['id', 'name', 'email', 'department', 'primaryRole', 'status', 'createdAt'] as const;
