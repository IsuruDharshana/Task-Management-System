import { useEffect, useState } from "react";
import { api, APIError } from "../services/api";
import type { ActivityLog, User } from "../services/api";
import { Badge, Button, EmptyState, SkeletonList, UserAvatar } from "./ui";

interface ActivityLogSectionProps {
  currentUser: User;
  mode?: "audit" | "notifications";
}

const ADMIN_ENTITY_TYPES = ["user", "system", "account"];
const PROJECT_ENTITY_TYPES = ["project", "task", "comment", "attachment", "account"];
const ACTIVITY_LOG_LIMIT = 50;

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}

function statusLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function fieldLabel(value: string) {
  return value.replace(/_/g, " ");
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof APIError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

function buildMessage(log: ActivityLog) {
  const actor = log.actorName || "System";
  const meta = log.metadata || {};
  const projectName = getString(meta, "projectName");
  const taskTitle = getString(meta, "taskTitle");
  const fileName = getString(meta, "fileName");
  const targetUserName = getString(meta, "targetUserName");
  const assigneeName = getString(meta, "assigneeName");
  const from = getString(meta, "from");
  const to = getString(meta, "to");

  switch (log.action) {
    case "project_created":
      return `${actor} created project${projectName ? ` "${projectName}"` : ""}`;
    case "project_updated":
      return `${actor} updated project${projectName ? ` "${projectName}"` : ""}`;
    case "project_deleted":
      return `${actor} deleted project${projectName ? ` "${projectName}"` : ""}`;
    case "project_member_added":
      return `${actor} added ${targetUserName || "a member"} to the project`;
    case "project_member_removed":
      return `${actor} removed ${targetUserName || "a member"} from the project`;
    case "project_member_role_changed":
      return `${actor} changed ${targetUserName || "a member"} from ${statusLabel(from)} to ${statusLabel(to)}`;
    case "task_created":
      return `${actor} created task${taskTitle ? ` "${taskTitle}"` : ""}`;
    case "task_updated":
      return `${actor} updated task${taskTitle ? ` "${taskTitle}"` : ""}`;
    case "task_deleted":
      return `${actor} deleted task${taskTitle ? ` "${taskTitle}"` : ""}`;
    case "task_status_changed":
      return `${actor} changed status from ${statusLabel(from)} to ${statusLabel(to)}`;
    case "task_priority_changed":
      return `${actor} changed priority from ${statusLabel(from)} to ${statusLabel(to)}`;
    case "task_due_date_changed":
      return `${actor} changed due date from ${from || "none"} to ${to || "none"}`;
    case "task_assignee_added":
      return `${actor} assigned ${assigneeName || "a member"} to a task`;
    case "task_assignee_removed":
      return `${actor} removed ${assigneeName || "a member"} from a task`;
    case "task_comment_added":
      return `${actor} added a comment`;
    case "task_comment_updated":
      return `${actor} updated a comment`;
    case "task_comment_deleted":
      return `${actor} deleted a comment`;
    case "task_attachment_uploaded":
      return `${actor} uploaded ${fileName || "an attachment"}`;
    case "task_attachment_deleted":
      return `${actor} deleted ${fileName || "an attachment"}`;
    case "admin_user_created":
      return `${actor} created user ${targetUserName || "a user"}`;
    case "admin_user_updated":
      return `${actor} updated user ${targetUserName || "a user"}`;
    case "admin_user_deactivated":
      return `${actor} deactivated user ${targetUserName || "a user"}`;
    case "admin_user_reactivated":
      return `${actor} reactivated user ${targetUserName || "a user"}`;
    case "admin_user_password_reset":
      return `${actor} reset password for ${targetUserName || "a user"}`;
    case "own_password_changed":
      return "User changed own password";
    case "first_login_password_reset_completed":
      return "User completed first login password reset";
    default:
      return `${actor} performed ${log.action.replace(/_/g, " ")}`;
  }
}

function getDetail(log: ActivityLog) {
  const meta = log.metadata || {};
  const changedFields = Array.isArray(meta.changedFields)
    ? meta.changedFields.filter((field): field is string => typeof field === "string")
    : [];
  const details = [];
  const projectName = getString(meta, "projectName");
  const taskTitle = getString(meta, "taskTitle");
  const fileName = getString(meta, "fileName");
  const targetUserName = getString(meta, "targetUserName");
  const targetUserRole = getString(meta, "targetUserRole");
  const assigneeName = getString(meta, "assigneeName");
  const securityMessage = getString(meta, "message");

  if (projectName) details.push(`Project: ${projectName}`);
  if (taskTitle) details.push(`Task: ${taskTitle}`);
  if (fileName) details.push(`File: ${fileName}`);
  if (targetUserName) details.push(`User: ${targetUserName}`);
  if (targetUserRole) details.push(`Role: ${statusLabel(targetUserRole)}`);
  if (assigneeName) details.push(`Assignee: ${assigneeName}`);
  if (securityMessage) details.push(`Security: ${securityMessage}`);
  if (changedFields.length > 0) {
    details.push(`Changed: ${changedFields.map(fieldLabel).join(", ")}`);
  }

  return details.length > 0 ? details.join(" • ") : "No additional details";
}

export default function ActivityLogSection({ currentUser, mode }: ActivityLogSectionProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [entityType, setEntityType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuditMode = mode ? mode === "audit" : currentUser.role === "admin";
  const title = isAuditMode ? "Audit Log" : "Notifications";
  const entityTypes = currentUser.role === "admin" ? ADMIN_ENTITY_TYPES : PROJECT_ENTITY_TYPES;

  const loadLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.activityLogs.list({
        entityType: entityType || undefined,
        limit: ACTIVITY_LOG_LIMIT,
      });
      setLogs(data.logs || []);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load activity logs."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <section className="task-section activity-page veyra-page">
      <div className="modern-page-header">
        <div>
          <h1>{title}</h1>
          <p className="subtitle">Review recent account, notification, and workspace activity.</p>
        </div>
        <Button type="button" variant="secondary" onClick={loadLogs} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <div className="card task-panel">
        <div className="task-section-header">
          <div>
            <h2>{isAuditMode ? "Activity Feed" : "Notification Feed"}</h2>
            <p className="card-desc">Human-readable changes from projects, tasks, comments, attachments, and user access.</p>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger">
            <span className="alert-icon">!</span>
            <span className="alert-message">{error}</span>
          </div>
        )}

        <div className="task-filters">
          <div className="form-group">
            <label htmlFor="activity-entity-type">Entity Type</label>
            <select id="activity-entity-type" value={entityType} onChange={(event) => setEntityType(event.target.value)}>
              <option value="">All</option>
              {entityTypes.map((type) => (
                <option key={type} value={type}>
                  {statusLabel(type)}
                </option>
              ))}
            </select>
          </div>

          <button className="btn btn-secondary task-filter-apply" onClick={loadLogs} disabled={loading}>
            Apply
          </button>
        </div>

        {loading ? (
          <SkeletonList count={6} />
        ) : logs.length === 0 ? (
          <EmptyState title="No activity found" description="Recent audit records and notification activity will appear here." />
        ) : (
          <div className="activity-feed-list">
            {logs.map((log) => (
              <article key={log.id} className="activity-feed-item">
                <UserAvatar name={log.actorName || "System"} />
                <div>
                  <div className="activity-feed-title">
                    <strong>{buildMessage(log)}</strong>
                    <Badge variant="default">{statusLabel(log.entityType)}</Badge>
                  </div>
                  <p>{getDetail(log)}</p>
                  <time>{formatDateTime(log.createdAt)} · {log.actorName || "System"}</time>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
