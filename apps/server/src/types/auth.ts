export type UserRole = "admin" | "project_manager" | "collaborator";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tokenVersion: number;
  mustResetPassword: boolean;
}