export const TICKET_CATEGORIES = [
  "Hardware",
  "Software",
  "Network",
  "Access & Permissions",
  "Email",
  "VPN",
  "Printer",
  "Mobile Device",
  "Other",
] as const;

export const TICKET_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
export const TICKET_STATUSES = ["Open", "In Progress", "Pending User", "Resolved", "Closed", "Cancelled"] as const;
export const TICKET_STATUS_LABELS: Record<string, string> = {
  "Open": "Open",
  "In Progress": "In Progress",
  "Pending User": "Awaiting Info",
  "Resolved": "Resolved",
  "Closed": "Closed",
  "Cancelled": "Cancelled",
};

export const SLA_HOURS: Record<string, number> = {
  Critical: 4,
  High: 8,
  Medium: 24,
  Low: 72,
};

export const TICKET_NUMBER_PREFIX = "INC";

export const KB_CATEGORIES = [
  'All', 'Hardware', 'Software', 'Network', 'Access & Permissions',
  'Email & Calendar', 'Security', 'Onboarding', 'General',
] as const;

export const RESOLUTION_CODES = [
  'Fixed', 'Workaround', 'Duplicate', 'Cannot Reproduce',
  'User Error', 'No Action Required', 'Known Issue',
] as const;

export const IMPACT_LEVELS = [
  'Individual', 'Team', 'Department', 'Organization',
] as const;

export const TICKET_SOURCES = [
  'Self-Service Portal', 'Email', 'Phone', 'Walk-in', 'Chat', 'Monitoring Alert',
] as const;

export const KB_STATUS = ['draft', 'published'] as const;

export const LINKED_ITEM_TYPES = ['backlog', 'defect', 'ticket'] as const;
export const LINKED_ITEM_STATUSES = ['Open', 'In Progress', 'Resolved', 'Done', 'Blocked'] as const;

export const KB_CATEGORIES_NO_ALL = [
  'Hardware', 'Software', 'Network', 'Access & Permissions',
  'Email & Calendar', 'Security', 'Onboarding', 'General',
] as const;
