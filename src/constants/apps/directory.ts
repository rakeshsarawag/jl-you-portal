export const EMPLOYEE_STATUSES = ['Active', 'On Leave', 'Inactive', 'Remote'] as const;
export type EmployeeStatus = typeof EMPLOYEE_STATUSES[number];

export const DEPARTMENTS = [
  'Engineering',
  'Human Resources',
  'Finance',
  'Marketing',
  'Sales',
  'Operations',
  'Design',
  'Product',
  'Legal',
  'Administration',
  'Customer Success',
  'IT & Infrastructure',
] as const;

export const LOCATIONS = [
  'Mumbai',
  'Delhi',
  'Bangalore',
  'Pune',
  'Hyderabad',
  'Chennai',
  'Kolkata',
  'Remote',
] as const;

export const SKILLS = [
  'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java',
  'SQL', 'AWS', 'Product Management', 'UX Design', 'Data Analysis',
  'Project Management', 'Sales', 'Marketing', 'Finance', 'HR',
] as const;

export const ORG_CHART_VIEW_MODES = ['tree', 'flat'] as const;

export const EMPLOYEE_EXPORT_FIELDS = [
  'id', 'name', 'email', 'phone', 'department', 'designation',
  'location', 'status', 'joinDate', 'managerName',
] as const;

export const LIFECYCLE_STATUSES = ['Active', 'On Notice', 'Resigned', 'On Leave'] as const;
export type LifecycleStatus = typeof LIFECYCLE_STATUSES[number];
