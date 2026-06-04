export const USER_ROLES = {
  ADMIN: "admin",
  PROJECT_MANAGER: "project_manager",
  COLLABORATOR: "collaborator",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const PROJECT_MEMBER_ROLES = {
  PROJECT_MANAGER: "project_manager",
  COLLABORATOR: "collaborator",
} as const;

export type ProjectMemberRole =
  (typeof PROJECT_MEMBER_ROLES)[keyof typeof PROJECT_MEMBER_ROLES];