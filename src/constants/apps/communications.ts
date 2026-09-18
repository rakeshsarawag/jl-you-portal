export const AUDIENCE_OPTIONS = [
  { value: 'all', label: '👥 All Employees' },
  { value: 'hr', label: '🏢 HR Only' },
  { value: 'manager', label: '💼 Managers Only' },
  { value: 'finance', label: '💰 Finance Only' },
  { value: 'it', label: '💻 IT Only' },
  { value: 'marketing', label: '📣 Marketing Only' },
] as const;

export const POST_TYPES = ['announcement', 'update', 'event', 'policy'] as const;
export const REACTION_TYPES = ['👍', '❤️', '🎉'] as const;
export const MODERATION_STATUSES = ['active', 'flagged', 'removed'] as const;

export const ATTACHMENT_TYPES = {
  ALLOWED_MIME: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  MAX_SIZE_MB: 10,
  MAX_FILES: 5,
} as const;
