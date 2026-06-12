import { supabaseAdmin } from "../config/supabaseAdmin.js";
import type { AuthUser } from "../types/auth.js";
import { AppError } from "../utils/appError.js";
import { getUnreadNotificationCount } from "./notificationService.js";

type TaskStatus = "to_do" | "in_progress" | "completed";

interface ProjectIdRow {
  id: string;
}

interface ProjectMemberProjectRow {
  project_id: string;
}

interface TaskAssignmentRow {
  task_id: string;
}

interface DashboardTaskRow {
  id: string;
  project_id: string;
  status: TaskStatus;
  priority: string;
  due_date: string | null;
}

export interface DashboardSummaryDTO {
  totalProjects: number;
  myTasks: number;
  projectTasks: number;
  todoTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  dueSoonTasks: number;
  overdueTasks: number;
  highPriorityTasks: number;
  unreadNotifications: number;
}

function emptySummary(unreadNotifications: number): DashboardSummaryDTO {
  return {
    totalProjects: 0,
    myTasks: 0,
    projectTasks: 0,
    todoTasks: 0,
    inProgressTasks: 0,
    completedTasks: 0,
    dueSoonTasks: 0,
    overdueTasks: 0,
    highPriorityTasks: 0,
    unreadNotifications,
  };
}

function getDeadlineAlertWindowHours(): number {
  const parsed = Number(process.env.DEADLINE_ALERT_WINDOW_HOURS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 48;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

async function getActiveProjectIds(user: AuthUser): Promise<string[]> {
  const { data: memberships, error: memberError } = await supabaseAdmin
    .from("project_members")
    .select("project_id")
    .eq("user_id", user.id)
    .is("removed_at", null);

  if (memberError) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load dashboard projects.");
  }

  const candidateProjectIds = (memberships ?? []).map(
    (membership: ProjectMemberProjectRow) => membership.project_id
  );

  if (user.role === "project_manager") {
    const { data: createdProjects, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("created_by", user.id)
      .is("deleted_at", null);

    if (projectError) {
      throw new AppError(500, "DATABASE_ERROR", "Failed to load dashboard projects.");
    }

    candidateProjectIds.push(...((createdProjects ?? []) as ProjectIdRow[]).map((project) => project.id));
  }

  const projectIds = unique(candidateProjectIds);

  if (projectIds.length === 0) {
    return [];
  }

  const { data: activeProjects, error } = await supabaseAdmin
    .from("projects")
    .select("id")
    .in("id", projectIds)
    .is("deleted_at", null);

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load dashboard projects.");
  }

  return ((activeProjects ?? []) as ProjectIdRow[]).map((project) => project.id);
}

async function getAssignedTaskIds(userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("task_assignees")
    .select("task_id")
    .eq("user_id", userId)
    .is("removed_at", null);

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load dashboard tasks.");
  }

  return unique(((data ?? []) as TaskAssignmentRow[]).map((assignment) => assignment.task_id));
}

async function getActiveTasksByIds(taskIds: string[], activeProjectIds: string[]): Promise<DashboardTaskRow[]> {
  if (taskIds.length === 0 || activeProjectIds.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .select("id, project_id, status, priority, due_date")
    .in("id", taskIds)
    .in("project_id", activeProjectIds)
    .is("deleted_at", null);

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load dashboard tasks.");
  }

  return (data ?? []) as DashboardTaskRow[];
}

async function getActiveTasksByProjectIds(projectIds: string[]): Promise<DashboardTaskRow[]> {
  if (projectIds.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .select("id, project_id, status, priority, due_date")
    .in("project_id", projectIds)
    .is("deleted_at", null);

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load dashboard tasks.");
  }

  return (data ?? []) as DashboardTaskRow[];
}

function isDueSoon(task: DashboardTaskRow, now: Date, windowEnd: Date): boolean {
  if (!task.due_date || task.status === "completed") return false;

  const dueDate = new Date(task.due_date);
  return dueDate >= now && dueDate <= windowEnd;
}

function isOverdue(task: DashboardTaskRow, now: Date): boolean {
  if (!task.due_date || task.status === "completed") return false;
  return new Date(task.due_date) < now;
}

function countTaskSummary(
  totalProjects: number,
  projectTasks: DashboardTaskRow[],
  myTasks: DashboardTaskRow[],
  unreadNotifications: number
): DashboardSummaryDTO {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + getDeadlineAlertWindowHours() * 60 * 60 * 1000);

  return {
    totalProjects,
    myTasks: myTasks.length,
    projectTasks: projectTasks.length,
    todoTasks: projectTasks.filter((task) => task.status === "to_do").length,
    inProgressTasks: projectTasks.filter((task) => task.status === "in_progress").length,
    completedTasks: projectTasks.filter((task) => task.status === "completed").length,
    dueSoonTasks: projectTasks.filter((task) => isDueSoon(task, now, windowEnd)).length,
    overdueTasks: projectTasks.filter((task) => isOverdue(task, now)).length,
    highPriorityTasks: projectTasks.filter(
      (task) => task.priority === "high" && task.status !== "completed"
    ).length,
    unreadNotifications,
  };
}

export async function getDashboardSummary(user: AuthUser): Promise<DashboardSummaryDTO> {
  const unreadNotifications = await getUnreadNotificationCount(user.id);

  if (user.role === "admin") {
    return emptySummary(unreadNotifications);
  }

  const activeProjectIds = await getActiveProjectIds(user);
  const assignedTaskIds = await getAssignedTaskIds(user.id);
  const myTasks = await getActiveTasksByIds(assignedTaskIds, activeProjectIds);

  if (user.role === "collaborator") {
    return countTaskSummary(activeProjectIds.length, myTasks, myTasks, unreadNotifications);
  }

  const projectTasks = await getActiveTasksByProjectIds(activeProjectIds);
  return countTaskSummary(activeProjectIds.length, projectTasks, myTasks, unreadNotifications);
}
