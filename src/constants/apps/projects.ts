export const PROJECT_STATUSES = ["Planning", "Active", "On Hold", "Completed", "Cancelled"] as const;
export const PROJECT_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
export const TASK_STATUSES = ["To Do", "In Progress", "In Review", "Done", "Blocked"] as const;
export const TASK_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
export const PROJECT_CATEGORIES = ["Internal", "Client", "R&D", "Infrastructure", "Compliance", "Marketing"] as const;
export const MEMBER_ROLES = ["Lead", "Developer", "Designer", "QA", "Analyst", "Observer"] as const;
export const TIME_LOG_TYPES = ["Development", "Design", "Testing", "Meetings", "Documentation", "Other"] as const;
export const MILESTONE_STATUSES = ["Pending", "Completed", "Missed"] as const;
export const RAG_STATUSES = ["Green", "Amber", "Red"] as const;

export const BACKLOG_ITEM_TYPES = ['story', 'epic', 'spike', 'research', 'feature', 'bug'] as const;
export const BACKLOG_STATUSES = ['Backlog', 'Ready', 'In Sprint', 'Done'] as const;

export const DEFECT_SEVERITIES = ['S1', 'S2', 'S3', 'S4'] as const;
export const DEFECT_SEVERITY_LABELS: Record<string, string> = {
  S1: 'Blocker', S2: 'Critical', S3: 'Major', S4: 'Minor',
};
export const DEFECT_STATUSES = ['Open', 'In Progress', 'Fixed', 'Verified', 'Closed', 'Wont Fix'] as const;
export const DEFECT_ENVIRONMENTS = ['development', 'staging', 'production', 'qa'] as const;

export const SPRINT_DURATIONS = ['1 week', '2 weeks', '3 weeks', '4 weeks'] as const;
export const DEFAULT_SPRINT_DURATION = '2 weeks';

export const STORY_POINT_SCALES = {
  fibonacci: [1, 2, 3, 5, 8, 13, 21, 34],
  tshirt: ['XS', 'S', 'M', 'L', 'XL'],
} as const;

export const PM_METHODOLOGIES = ['Scrum', 'Kanban', 'Waterfall', 'Hybrid'] as const;
