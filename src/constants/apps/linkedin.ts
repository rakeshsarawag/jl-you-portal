export const LINKEDIN_POST_TYPES = ['article', 'update', 'poll', 'event', 'job'] as const;
export type LinkedInPostType = typeof LINKEDIN_POST_TYPES[number];

export const LINKEDIN_TONES = ['professional', 'casual', 'inspirational', 'educational', 'promotional'] as const;
export type LinkedInTone = typeof LINKEDIN_TONES[number];

export const LINKEDIN_TONE_LABELS: Record<typeof LINKEDIN_TONES[number], string> = {
  professional: 'Professional',
  casual: 'Casual & Friendly',
  inspirational: 'Inspirational',
  educational: 'Educational',
  promotional: 'Promotional',
};

export const LINKEDIN_POST_TYPE_LABELS: Record<LinkedInPostType, string> = {
  article: 'Article',
  update: 'Status Update',
  poll: 'Poll',
  event: 'Event',
  job: 'Job Posting',
};

export const MAX_POST_LENGTH = 3000;
export const RECOMMENDED_POST_LENGTH = 1300;
