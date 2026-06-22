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

interface AttachmentUploadedContext extends TaskEventContext {
  attachmentId: string;
  fileName: string;
  actorName: string;
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

function eventTimestamp(): string {
  return new Date().toISOString();
}

function projectEventPayload(
  context: ProjectEventContext,
  eventType: string,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    type: eventType,
    eventType,
    projectId: context.projectId,
    related_project_id: context.projectId,
    actorUserId: context.actorUserId,
    actor_user_id: context.actorUserId,
    created_at: eventTimestamp(),
    ...extra,
  };
}

function taskEventPayload(
  context: TaskEventContext,
  eventType: string,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    type: eventType,
    eventType,
    taskId: context.taskId,
    related_task_id: context.taskId,
    projectId: context.projectId,
    related_project_id: context.projectId,
    actorUserId: context.actorUserId,
    actor_user_id: context.actorUserId,
    created_at: eventTimestamp(),
    ...extra,
  };
}

function taskMetadata(context: TaskEventContext, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    taskId: context.taskId,
    related_task_id: context.taskId,
    taskTitle: context.taskTitle,
    projectId: context.projectId,
    related_project_id: context.projectId,
    projectName: context.projectName,
    actorUserId: context.actorUserId,
    ...extra,
  };
}

function projectMetadata(context: ProjectEventContext, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    projectId: context.projectId,
    related_project_id: context.projectId,
    projectName: context.projectName,
    actorUserId: context.actorUserId,
    ...extra,
  };
}

export async function notifyTaskCreated(
  context: TaskEventContext,
  assignedUserIds: string[]
): Promise<void> {
  await safeNotify(async () => {
    const recipients = unique([...(await getProjectManagerRecipients(context.projectId)), ...assignedUserIds]);
    const notificationRecipients = excludeActor(recipients, context.actorUserId);
    const payload = taskEventPayload(context, "task_created");

    if (notificationRecipients.length > 0) {
      await createNotificationsForUsers(notificationRecipients, {
        type: "task_created",
        title: "Task created",
        message: `"${context.taskTitle}" was created in ${context.projectName}.`,
        entityType: "task",
        entityId: context.taskId,
        metadata: taskMetadata(context),
      });
    }

    emitToUsers(recipients, "task:created", payload);
    emitDashboardSummaryUpdated(recipients, payload);
  });
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
    const payload = taskEventPayload(context, "task_assigned");

    if (notificationRecipients.length > 0) {
      await createNotificationsForUsers(notificationRecipients, {
        type: "task_assigned",
        title: "New task assigned",
        message: `You were assigned to "${context.taskTitle}" in ${context.projectName}.`,
        entityType: "task",
        entityId: context.taskId,
        metadata: taskMetadata(context),
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
    const payload = taskEventPayload(context, "task_created");

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
    const payload = taskEventPayload(context, "task_status_changed", { changedFields: ["status"] });

    if (notificationRecipients.length > 0) {
      await createNotificationsForUsers(notificationRecipients, {
        type: "task_status_changed",
        title: "Task status changed",
        message: `"${context.taskTitle}" changed from ${formatTaskStatus(oldStatus)} to ${formatTaskStatus(newStatus)}.`,
        entityType: "task",
        entityId: context.taskId,
        metadata: taskMetadata(context, { oldStatus, newStatus }),
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
    const payload = taskEventPayload(context, "task_updated", { changedFields: context.changedFields });

    if (notificationRecipients.length > 0) {
      await createNotificationsForUsers(notificationRecipients, {
        type: "task_updated",
        title: "Task updated",
        message: `"${context.taskTitle}" was updated.`,
        entityType: "task",
        entityId: context.taskId,
        metadata: taskMetadata(context, { changedFields: context.changedFields }),
      });
    }

    emitToUsers(recipients, "task:updated", payload);
    emitDashboardSummaryUpdated(recipients, payload);
  });
}

export async function broadcastTaskUpdated(context: TaskUpdatedContext): Promise<void> {
  await safeNotify(async () => {
    const recipients = await getTaskNotificationRecipients(context.taskId, context.projectId);
    const payload = taskEventPayload(context, "task_updated", { changedFields: context.changedFields });

    emitToUsers(recipients, "task:updated", payload);
    emitDashboardSummaryUpdated(recipients, payload);
  });
}

export async function notifyTaskDeleted(context: TaskEventContext): Promise<void> {
  await safeNotify(async () => {
    const recipients = await getTaskNotificationRecipients(context.taskId, context.projectId);
    const notificationRecipients = excludeActor(recipients, context.actorUserId);
    const payload = taskEventPayload(context, "task_deleted");

    if (notificationRecipients.length > 0) {
      await createNotificationsForUsers(notificationRecipients, {
        type: "task_deleted",
        title: "Task deleted",
        message: `"${context.taskTitle}" was deleted from ${context.projectName}.`,
        entityType: "task",
        entityId: context.taskId,
        metadata: taskMetadata(context),
      });
    }

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
    const payload = taskEventPayload(context, "comment_added", { commentId: context.commentId });

    if (notificationRecipients.length > 0) {
      await createNotificationsForUsers(notificationRecipients, {
        type: "comment_added",
        title: "New comment on task",
        message: `${context.actorName} commented on "${context.taskTitle}".`,
        entityType: "task",
        entityId: context.taskId,
        metadata: taskMetadata(context, { commentId: context.commentId }),
      });
    }

    emitToUsers(recipients, "comment:created", payload);
  });
}

export async function notifyAttachmentUploaded(context: AttachmentUploadedContext): Promise<void> {
  await safeNotify(async () => {
    const recipients = await getTaskNotificationRecipients(context.taskId, context.projectId);
    const notificationRecipients = excludeActor(recipients, context.actorUserId);
    const payload = taskEventPayload(context, "attachment_uploaded", { attachmentId: context.attachmentId });

    if (notificationRecipients.length > 0) {
      await createNotificationsForUsers(notificationRecipients, {
        type: "attachment_uploaded",
        title: "New attachment on task",
        message: `${context.actorName} uploaded "${context.fileName}" to "${context.taskTitle}".`,
        entityType: "task",
        entityId: context.taskId,
        metadata: taskMetadata(context, {
          attachmentId: context.attachmentId,
          fileName: context.fileName,
        }),
      });
    }

    emitToUsers(recipients, "attachment:created", payload);
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
    const payload = projectEventPayload(context, "project_updated", { changedFields });

    if (notificationRecipients.length > 0) {
      await createNotificationsForUsers(notificationRecipients, {
        type: "project_updated",
        title: "Project updated",
        message: `${context.projectName} was updated.`,
        entityType: "project",
        entityId: context.projectId,
        metadata: projectMetadata(context, { changedFields }),
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
    const payload = projectEventPayload(context, "project_member_added", { memberUserId });

    if (notificationRecipients.length > 0) {
      await createNotificationsForUsers(notificationRecipients, {
        type: "project_member_added",
        title: "Added to project",
        message: `You were added to project ${context.projectName}.`,
        entityType: "project",
        entityId: context.projectId,
        metadata: projectMetadata(context),
      });
    }

    emitToUsers(recipients, "project:updated", payload);
    emitDashboardSummaryUpdated(recipients, payload);
  });
}

export async function notifyProjectDeleted(context: ProjectEventContext): Promise<void> {
  await safeNotify(async () => {
    const recipients = await getProjectNotificationRecipients(context.projectId);
    const notificationRecipients = excludeActor(recipients, context.actorUserId);
    const payload = projectEventPayload(context, "project_deleted");

    if (notificationRecipients.length > 0) {
      await createNotificationsForUsers(notificationRecipients, {
        type: "project_deleted",
        title: "Project deleted",
        message: `${context.projectName} was deleted.`,
        entityType: "project",
        entityId: context.projectId,
        metadata: projectMetadata(context),
      });
    }

    emitToUsers(recipients, "project:updated", payload);
    emitDashboardSummaryUpdated(recipients, payload);
  });
}

export async function notifyProjectMemberRemoved(
  context: ProjectEventContext,
  memberUserId: string
): Promise<void> {
  await safeNotify(async () => {
    const remainingRecipients = await getProjectNotificationRecipients(context.projectId);
    const notificationRecipients = excludeActor([memberUserId], context.actorUserId);
    const eventRecipients = unique([...remainingRecipients, memberUserId]);
    const payload = projectEventPayload(context, "project_member_removed", { memberUserId });

    if (notificationRecipients.length > 0) {
      await createNotificationsForUsers(notificationRecipients, {
        type: "project_member_removed",
        title: "Removed from project",
        message: `You were removed from project ${context.projectName}.`,
        entityType: "project",
        entityId: context.projectId,
        metadata: projectMetadata(context),
      });
    }

    emitToUsers(eventRecipients, "project:updated", payload);
    emitDashboardSummaryUpdated(eventRecipients, payload);
  });
}
