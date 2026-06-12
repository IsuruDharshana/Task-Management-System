import { supabaseAdmin } from "../config/supabaseAdmin.js";
import { emitToUsers } from "../socket/socketRooms.js";
import { createNotificationsForUsers } from "./notificationService.js";

type TaskStatus = "to_do" | "in_progress" | "completed";

interface ProjectMemberRow {
  user_id: string;
  project_role: string;
}

interface TaskEventContext {
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectName: string;
  actorUserId: string;
}

interface ProjectEventContext {
  projectId: string;
  projectName: string;
  actorUserId: string;
}

interface TaskUpdatedContext extends TaskEventContext {
  changedFields: string[];
}

function unique(userIds: string[]): string[] {
  return [...new Set(userIds.filter(Boolean))];
}

function formatTaskStatus(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    to_do: "To Do",
    in_progress: "In Progress",
    completed: "Completed",
  };

  return labels[status];
}

export function excludeActor(userIds: string[], actorUserId: string): string[] {
  return unique(userIds).filter((userId) => userId !== actorUserId);
}

async function safeNotify(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    console.error("Failed to publish realtime notification event.", error);
  }
}

async function getActiveProjectMembers(projectId: string): Promise<ProjectMemberRow[]> {
  const { data, error } = await supabaseAdmin
    .from("project_members")
    .select("user_id, project_role")
    .eq("project_id", projectId)
    .is("removed_at", null);

  if (error) {
    throw error;
  }

  return (data ?? []) as ProjectMemberRow[];
}

export async function getProjectNotificationRecipients(projectId: string): Promise<string[]> {
  const members = await getActiveProjectMembers(projectId);
  return unique(members.map((member) => member.user_id));
}

export async function getProjectManagerRecipients(projectId: string): Promise<string[]> {
  const members = await getActiveProjectMembers(projectId);
  return unique(
    members
      .filter((member) => member.project_role === "project_manager")
      .map((member) => member.user_id)
  );
}

export async function getTaskAssigneeRecipients(taskId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("task_assignees")
    .select("user_id")
    .eq("task_id", taskId)
    .is("removed_at", null);

  if (error) {
    throw error;
  }

  return unique((data ?? []).map((assignee) => assignee.user_id));
}

export async function getTaskNotificationRecipients(
  taskId: string,
  projectId: string
): Promise<string[]> {
  const [assigneeIds, projectManagerIds] = await Promise.all([
    getTaskAssigneeRecipients(taskId),
    getProjectManagerRecipients(projectId),
  ]);

  return unique([...assigneeIds, ...projectManagerIds]);
}

function emitDashboardSummaryUpdated(userIds: string[], payload: Record<string, unknown>): void {
  emitToUsers(userIds, "dashboard:summary-updated", payload);
}

export async function notifyTaskAssigned(
  context: TaskEventContext,
  assignedUserIds: string[],
  options: { emitTaskUpdated?: boolean } = {}
): Promise<void> {
  await safeNotify(async () => {
    const notificationRecipients = excludeActor(assignedUserIds, context.actorUserId);
    const eventRecipients = unique([
      ...(await getProjectManagerRecipients(context.projectId)),
      ...assignedUserIds,
    ]);
    const payload = {
      taskId: context.taskId,
      projectId: context.projectId,
      eventType: "task_assigned",
      actorUserId: context.actorUserId,
    };

    if (notificationRecipients.length > 0) {
      await createNotificationsForUsers(notificationRecipients, {
        type: "task_assigned",
        title: "New task assigned",
        message: `You were assigned to "${context.taskTitle}" in ${context.projectName}.`,
        entityType: "task",
        entityId: context.taskId,
        metadata: {
          taskId: context.taskId,
          taskTitle: context.taskTitle,
          projectId: context.projectId,
          projectName: context.projectName,
          actorUserId: context.actorUserId,
        },
      });
    }

    if (options.emitTaskUpdated ?? true) {
      emitToUsers(eventRecipients, "task:updated", payload);
      emitDashboardSummaryUpdated(eventRecipients, payload);
    }
  });
}

export async function broadcastTaskCreated(
  context: TaskEventContext,
  assignedUserIds: string[]
): Promise<void> {
  await safeNotify(async () => {
    const recipients = unique([...(await getProjectManagerRecipients(context.projectId)), ...assignedUserIds]);
    const payload = {
      taskId: context.taskId,
      projectId: context.projectId,
      eventType: "task_created",
      actorUserId: context.actorUserId,
    };

    emitToUsers(recipients, "task:created", payload);
    emitDashboardSummaryUpdated(recipients, payload);
  });
}

export async function notifyTaskStatusChanged(
  context: TaskEventContext,
  oldStatus: TaskStatus,
  newStatus: TaskStatus
): Promise<void> {
  await safeNotify(async () => {
    const recipients = await getTaskNotificationRecipients(context.taskId, context.projectId);
    const notificationRecipients = excludeActor(recipients, context.actorUserId);
    const payload = {
      taskId: context.taskId,
      projectId: context.projectId,
      eventType: "task_status_changed",
      changedFields: ["status"],
      actorUserId: context.actorUserId,
    };

    if (notificationRecipients.length > 0) {
      await createNotificationsForUsers(notificationRecipients, {
        type: "task_status_changed",
        title: "Task status changed",
        message: `"${context.taskTitle}" changed from ${formatTaskStatus(oldStatus)} to ${formatTaskStatus(newStatus)}.`,
        entityType: "task",
        entityId: context.taskId,
        metadata: {
          taskId: context.taskId,
          taskTitle: context.taskTitle,
          projectId: context.projectId,
          projectName: context.projectName,
          oldStatus,
          newStatus,
          actorUserId: context.actorUserId,
        },
      });
    }

    emitToUsers(recipients, "task:updated", payload);
    emitDashboardSummaryUpdated(recipients, payload);
  });
}

export async function notifyTaskUpdated(context: TaskUpdatedContext): Promise<void> {
  if (context.changedFields.length === 0) return;

  await safeNotify(async () => {
    const recipients = await getTaskNotificationRecipients(context.taskId, context.projectId);
    const notificationRecipients = excludeActor(recipients, context.actorUserId);
    const payload = {
      taskId: context.taskId,
      projectId: context.projectId,
      eventType: "task_updated",
      changedFields: context.changedFields,
      actorUserId: context.actorUserId,
    };

    if (notificationRecipients.length > 0) {
      await createNotificationsForUsers(notificationRecipients, {
        type: "task_updated",
        title: "Task updated",
        message: `"${context.taskTitle}" was updated.`,
        entityType: "task",
        entityId: context.taskId,
        metadata: {
          taskId: context.taskId,
          taskTitle: context.taskTitle,
          projectId: context.projectId,
          projectName: context.projectName,
          changedFields: context.changedFields,
          actorUserId: context.actorUserId,
        },
      });
    }

    emitToUsers(recipients, "task:updated", payload);
    emitDashboardSummaryUpdated(recipients, payload);
  });
}

export async function broadcastTaskUpdated(context: TaskUpdatedContext): Promise<void> {
  await safeNotify(async () => {
    const recipients = await getTaskNotificationRecipients(context.taskId, context.projectId);
    const payload = {
      taskId: context.taskId,
      projectId: context.projectId,
      eventType: "task_updated",
      changedFields: context.changedFields,
      actorUserId: context.actorUserId,
    };

    emitToUsers(recipients, "task:updated", payload);
    emitDashboardSummaryUpdated(recipients, payload);
  });
}

export async function broadcastTaskDeleted(context: TaskEventContext): Promise<void> {
  await safeNotify(async () => {
    const recipients = await getTaskNotificationRecipients(context.taskId, context.projectId);
    const payload = {
      taskId: context.taskId,
      projectId: context.projectId,
      eventType: "task_deleted",
      actorUserId: context.actorUserId,
    };

    emitToUsers(recipients, "task:deleted", payload);
    emitDashboardSummaryUpdated(recipients, payload);
  });
}

export async function notifyCommentAdded(
  context: TaskEventContext & { commentId: string; actorName: string }
): Promise<void> {
  await safeNotify(async () => {
    const recipients = await getTaskNotificationRecipients(context.taskId, context.projectId);
    const notificationRecipients = excludeActor(recipients, context.actorUserId);
    const payload = {
      taskId: context.taskId,
      projectId: context.projectId,
      commentId: context.commentId,
      eventType: "comment_added",
      actorUserId: context.actorUserId,
    };

    if (notificationRecipients.length > 0) {
      await createNotificationsForUsers(notificationRecipients, {
        type: "comment_added",
        title: "New comment on task",
        message: `${context.actorName} commented on "${context.taskTitle}".`,
        entityType: "task",
        entityId: context.taskId,
        metadata: {
          taskId: context.taskId,
          taskTitle: context.taskTitle,
          projectId: context.projectId,
          projectName: context.projectName,
          commentId: context.commentId,
          actorUserId: context.actorUserId,
        },
      });
    }

    emitToUsers(recipients, "comment:created", payload);
  });
}

export async function notifyProjectUpdated(
  context: ProjectEventContext,
  changedFields: string[]
): Promise<void> {
  if (changedFields.length === 0) return;

  await safeNotify(async () => {
    const recipients = await getProjectNotificationRecipients(context.projectId);
    const notificationRecipients = excludeActor(recipients, context.actorUserId);
    const payload = {
      projectId: context.projectId,
      eventType: "project_updated",
      changedFields,
      actorUserId: context.actorUserId,
    };

    if (notificationRecipients.length > 0) {
      await createNotificationsForUsers(notificationRecipients, {
        type: "project_updated",
        title: "Project updated",
        message: `${context.projectName} was updated.`,
        entityType: "project",
        entityId: context.projectId,
        metadata: {
          projectId: context.projectId,
          projectName: context.projectName,
          changedFields,
          actorUserId: context.actorUserId,
        },
      });
    }

    emitToUsers(recipients, "project:updated", payload);
    emitDashboardSummaryUpdated(recipients, payload);
  });
}

export async function notifyProjectMemberAdded(
  context: ProjectEventContext,
  memberUserId: string
): Promise<void> {
  await safeNotify(async () => {
    const recipients = await getProjectNotificationRecipients(context.projectId);
    const notificationRecipients = excludeActor([memberUserId], context.actorUserId);
    const payload = {
      projectId: context.projectId,
      eventType: "project_member_added",
      memberUserId,
      actorUserId: context.actorUserId,
    };

    if (notificationRecipients.length > 0) {
      await createNotificationsForUsers(notificationRecipients, {
        type: "project_updated",
        title: "Added to project",
        message: `You were added to project ${context.projectName}.`,
        entityType: "project",
        entityId: context.projectId,
        metadata: {
          projectId: context.projectId,
          projectName: context.projectName,
          actorUserId: context.actorUserId,
        },
      });
    }

    emitToUsers(recipients, "project:updated", payload);
    emitDashboardSummaryUpdated(recipients, payload);
  });
}
