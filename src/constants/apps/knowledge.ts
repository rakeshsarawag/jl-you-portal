export const ARTICLE_STATUSES = ['draft', 'published', 'archived'] as const;
export type ArticleStatus = typeof ARTICLE_STATUSES[number];

export const ARTICLE_STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

export const KNOWLEDGE_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'title_asc', label: 'Title A–Z' },
  { value: 'title_desc', label: 'Title Z–A' },
  { value: 'views', label: 'Most Viewed' },
] as const;

export const KNOWLEDGE_CATEGORIES = [
  'HR Policies',
  'IT Guidelines',
  'Finance',
  'Operations',
  'Legal & Compliance',
  'Product',
  'Engineering',
  'General',
] as const;
