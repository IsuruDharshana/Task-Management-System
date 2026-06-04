export const TASK_STATUSES = {
  TO_DO: "to_do",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
} as const;

export type TaskStatus = (typeof TASK_STATUSES)[keyof typeof TASK_STATUSES];