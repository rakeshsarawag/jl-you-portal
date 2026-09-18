export const NOTIFICATION_TYPES = ['info', 'success', 'warning', 'error', 'leave', 'ticket', 'payroll', 'onboarding'] as const;
export type NotificationType = typeof NOTIFICATION_TYPES[number];
