export const PERFORMANCE_RATINGS = [1, 2, 3, 4, 5] as const;
export const RATING_LABELS: Record<number, string> = {
  1: "Needs Improvement",
  2: "Below Expectations",
  3: "Meets Expectations",
  4: "Exceeds Expectations",
  5: "Outstanding",
};

export const REVIEW_PERIODS = ["Q1", "Q2", "Q3", "Q4", "Annual", "Mid-year"] as const;
export const REVIEW_STATUSES = ["Draft", "In Progress", "Submitted", "Approved", "Completed"] as const;
export const GOAL_STATUSES = ["Not Started", "In Progress", "Completed", "Cancelled"] as const;
export const PIP_STATUSES = ["Active", "Completed", "Extended", "Closed"] as const;
export const FEEDBACK_TYPES = ["Peer", "Manager", "Self", "Subordinate"] as const;
export const COMPETENCIES = ['Technical Skills', 'Communication', 'Leadership', 'Teamwork', 'Innovation'] as const;
