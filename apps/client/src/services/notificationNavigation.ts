import type { NotificationDTO } from "./api";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getMetadataString(notification: NotificationDTO, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = notification.metadata?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getProjectId(notification: NotificationDTO): string | null {
  return getMetadataString(notification, "projectId", "relatedProjectId", "related_project_id");
}

function getTaskId(notification: NotificationDTO): string | null {
  if (notification.entityType === "task" && notification.entityId) {
    return notification.entityId;
  }

  return getMetadataString(notification, "taskId", "relatedTaskId", "related_task_id");
}

function getSafeLink(notification: NotificationDTO): string | null {
  const link = getMetadataString(notification, "link");
  if (!link || UUID_PATTERN.test(link) || !link.startsWith("/")) {
    return null;
  }

  return link;
}

export function getNotificationNavigationPath(notification: NotificationDTO): string {
  if (
    notification.type === "project_member_removed" ||
    notification.type === "project_deleted" ||
    notification.type === "task_deleted"
  ) {
    return "/notifications";
  }

  const safeLink = getSafeLink(notification);
  if (safeLink) {
    return safeLink;
  }

  const projectId = getProjectId(notification);

  if (notification.type === "project_member_added") {
    return projectId ? `/projects/${projectId}` : "/notifications";
  }

  if (
    notification.type === "task_created" ||
    notification.type === "task_assigned" ||
    notification.type === "task_updated" ||
    notification.type === "task_status_changed" ||
    notification.type === "comment_added" ||
    notification.type === "attachment_uploaded" ||
    notification.type === "deadline_approaching" ||
    notification.entityType === "task" ||
    getTaskId(notification)
  ) {
    return projectId ? `/projects/${projectId}` : "/notifications";
  }

  if (notification.entityType === "project" || notification.type === "project_updated") {
    return projectId ? `/projects/${projectId}` : "/notifications";
  }

  return "/notifications";
}
