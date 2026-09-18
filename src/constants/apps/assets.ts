export const ASSET_TYPES = ["Laptop", "Desktop", "Monitor", "Phone", "Tablet", "Printer", "Server", "Networking", "Furniture", "Other"] as const;
export const ASSET_STATUSES = ["Available", "Assigned", "In Repair", "Retired", "Lost"] as const;
export const ASSET_CONDITIONS = ["Excellent", "Good", "Fair", "Poor"] as const;
export const ASSET_TAG_PREFIX = "AST";
export const MAINTENANCE_TYPES = ["Preventive", "Corrective", "Predictive", "Emergency"] as const;

export const ASSET_CATEGORIES = [
  'Laptop', 'Desktop', 'Server', 'Network Equipment', 'Mobile Phone', 'Monitor', 'Printer',
] as const;

export const DOCUMENT_TYPES = ['pdf', 'image', 'docx', 'xlsx', 'other'] as const;

export const RECURRING_FREQUENCIES = [
  'Weekly', 'Monthly', 'Quarterly', 'Semi-Annual', 'Annual',
] as const;

export const FREQ_DAYS: Record<string, number> = {
  Weekly: 7, Monthly: 30, Quarterly: 90, 'Semi-Annual': 180, Annual: 365,
};

export const VENDORS = [
  'Dell Technologies', 'Apple Inc.', 'HP Inc.', 'Lenovo',
  'Cisco Systems', 'Microsoft', 'Samsung', 'LG Electronics',
] as const;

export const LOCATION_BUILDINGS = ['HQ Tower A', 'HQ Tower B', 'Regional Office - North', 'Regional Office - South', 'Data Center', 'Remote'] as const;
export const WARRANTY_ALERT_THRESHOLDS = [90, 30, 0] as const; // days before expiry
