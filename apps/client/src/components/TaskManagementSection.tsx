import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, APIError } from "../services/api";
import TaskAttachmentsSection from "./TaskAttachmentsSection";
import TaskCommentsSection from "./TaskCommentsSection";
import { useSocket } from "../context/SocketContext";
import { Badge, Button, ConfirmDialog, EmptyState, Input, LoadingState, UserAvatar } from "./ui";
import type {
  Member,
  Task,
  TaskListParams,
  TaskPriority,
  TaskSortBy,
  TaskSortOrder,
  TaskStatus,
  User,
} from "../services/api";

interface TaskManagementSectionProps {
  projectId: string;
  projectName: string;
  currentUser: User;
  members: Member[];
  isProjectPM: boolean;
}

type FilterStatus = "all" | TaskStatus;
type FilterPriority = "all" | TaskPriority;
type DueDateFilter = "all" | "due_soon" | "overdue" | "no_due_date";

const STATUS_LABELS: Record<TaskStatus, string> = {
  to_do: "To Do",
  in_progress: "In Progress",
  completed: "Completed",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const EMPTY_FORM = {
  title: "",
  description: "",
  dueDate: "",
  priority: "medium" as TaskPriority,
  status: "to_do" as TaskStatus,
  assigneeIds: [] as string[],
};

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof APIError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

type TaskActionIconName = "details" | "comments" | "attachments" | "edit" | "delete";

function TaskActionIcon({ name }: { name: TaskActionIconName }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
  };

  switch (name) {
    case "details":
      return <svg {...common}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>;
    case "comments":
      return <svg {...common}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /></svg>;
    case "attachments":
      return <svg {...common}><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 1 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.82-2.83l8.48-8.48" /></svg>;
    case "edit":
      return <svg {...common}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
    case "delete":
      return <svg {...common}><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>;
    default:
      return null;
  }
}

export default function TaskManagementSection({
  projectId,
  projectName,
  currentUser,
  members,
  isProjectPM,
}: TaskManagementSectionProps) {
  const { socket, status: socketStatus } = useSocket();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<FilterPriority>("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilter>("all");
  const [sortBy, setSortBy] = useState<TaskSortBy>("created_at");
  const [sortOrder, setSortOrder] = useState<TaskSortOrder>("desc");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [commentsTaskId, setCommentsTaskId] = useState<string | null>(null);
  const [attachmentsTaskId, setAttachmentsTaskId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskPendingDelete, setTaskPendingDelete] = useState<Task | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [assigneeToAdd, setAssigneeToAdd] = useState("");

  const loadTasks = async () => {
    setLoading(true);
    setError(null);

    try {
      const params: TaskListParams = {
        sortBy,
        sortOrder,
      };

      if (search.trim()) params.search = search.trim();
      if (statusFilter !== "all") params.status = statusFilter;
      if (priorityFilter !== "all") params.priority = priorityFilter;
      if (assigneeFilter !== "all") params.assigneeId = assigneeFilter;

      const data = await api.tasks.list(projectId, params);
      setTasks(data.tasks || []);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load tasks."));
    } finally {
      setLoading(false);
    }
  };

  const loadTasksRef = useRef(loadTasks);

  useEffect(() => {
    loadTasksRef.current = loadTasks;
  });

  useEffect(() => {
    loadTasks();
  }, [projectId]);

  useEffect(() => {
    if (!socket) return;

    let refreshTimer: number | undefined;
    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        loadTasksRef.current();
      }, 250);
    };

    const handleTaskEvent = (payload: { projectId?: string; taskId?: string }) => {
      if (payload.projectId !== projectId) return;

      if (payload.taskId && editingTask?.id === payload.taskId) {
        setEditingTask(null);
        closeForms();
      }

      scheduleRefresh();
    };

    socket.on("task:created", handleTaskEvent);
    socket.on("task:updated", handleTaskEvent);
    socket.on("task:deleted", handleTaskEvent);

    return () => {
      window.clearTimeout(refreshTimer);
      socket.off("task:created", handleTaskEvent);
      socket.off("task:updated", handleTaskEvent);
      socket.off("task:deleted", handleTaskEvent);
    };
  }, [socket, projectId, editingTask?.id]);

  const filteredTasks = useMemo(() => {
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return tasks.filter((task) => {
      if (dueDateFilter === "all") return true;
      if (dueDateFilter === "no_due_date") return !task.dueDate;
      if (!task.dueDate || task.status === "completed") return false;

      const due = new Date(task.dueDate).getTime();
      if (dueDateFilter === "overdue") return due < now;
      return due >= now && due <= now + sevenDays;
    });
  }, [dueDateFilter, tasks]);

  const selectedTask = filteredTasks.find((task) => task.id === selectedTaskId) || null;

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setAssigneeToAdd("");
    setActionError(null);
  };

  const openCreateForm = () => {
    resetForm();
    setEditingTask(null);
    setShowCreateForm(true);
  };

  const openEditForm = (task: Task) => {
    setActionError(null);
    setShowCreateForm(false);
    setEditingTask(task);
    setAssigneeToAdd("");
    setForm({
      title: task.title,
      description: task.description || "",
      dueDate: task.dueDate ? task.dueDate.substring(0, 10) : "",
      priority: task.priority,
      status: task.status,
      assigneeIds: task.assignees.map((assignee) => assignee.userId),
    });
  };

  const closeForms = () => {
    setShowCreateForm(false);
    setEditingTask(null);
    resetForm();
  };

  const handleCreateTask = async (event: React.FormEvent) => {
    event.preventDefault();
    setActionError(null);

    if (!form.title.trim()) {
      setActionError("Task title is required.");
      return;
    }

    setActionLoading(true);

    try {
      await api.tasks.create(projectId, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        due_date: form.dueDate || null,
        priority: form.priority,
        status: form.status,
        assignee_ids: form.assigneeIds,
      });
      closeForms();
      await loadTasks();
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to create task."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingTask) return;

    setActionError(null);

    if (!form.title.trim()) {
      setActionError("Task title is required.");
      return;
    }

    setActionLoading(true);

    try {
      await api.tasks.update(editingTask.id, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        due_date: form.dueDate || null,
        priority: form.priority,
        status: form.status,
      });
      closeForms();
      await loadTasks();
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to update task."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTask = async (task: Task) => {
    setActionError(null);
    setActionLoading(true);

    try {
      await api.tasks.delete(task.id);
      setTaskPendingDelete(null);
      await loadTasks();
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to delete task."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCollaboratorStatusChange = async (task: Task, status: TaskStatus) => {
    setActionError(null);

    try {
      await api.tasks.update(task.id, { status });
      await loadTasks();
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to update task status."));
    }
  };

  const toggleComments = (taskId: string) => {
    setCommentsTaskId((current) => (current === taskId ? null : taskId));
    setSelectedTaskId(taskId);
  };

  const toggleAttachments = (taskId: string) => {
    setAttachmentsTaskId((current) => (current === taskId ? null : taskId));
    setSelectedTaskId(taskId);
  };

  const handleAddAssignee = async () => {
    if (!editingTask || !assigneeToAdd) return;

    setActionError(null);
    setActionLoading(true);

    try {
      await api.tasks.addAssignee(editingTask.id, assigneeToAdd);
      setAssigneeToAdd("");
      const refreshed = await api.tasks.get(editingTask.id);
      setEditingTask(refreshed.task);
      setForm((current) => ({
        ...current,
        assigneeIds: refreshed.task.assignees.map((assignee) => assignee.userId),
      }));
      await loadTasks();
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to assign member."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveAssignee = async (userId: string) => {
    if (!editingTask) return;

    setActionError(null);
    setActionLoading(true);

    try {
      await api.tasks.removeAssignee(editingTask.id, userId);
      const refreshed = await api.tasks.get(editingTask.id);
      setEditingTask(refreshed.task);
      setForm((current) => ({
        ...current,
        assigneeIds: refreshed.task.assignees.map((assignee) => assignee.userId),
      }));
      await loadTasks();
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to remove assignee."));
    } finally {
      setActionLoading(false);
    }
  };

  const availableAssignees = editingTask
    ? members.filter((member) => !editingTask.assignees.some((assignee) => assignee.userId === member.userId))
    : [];

  const getDueState = (task: Task): "due_soon" | "overdue" | "default" => {
    if (!task.dueDate || task.status === "completed") return "default";
    const due = new Date(task.dueDate).getTime();
    const now = Date.now();
    if (due < now) return "overdue";
    if (due <= now + 7 * 24 * 60 * 60 * 1000) return "due_soon";
    return "default";
  };

  const getSocketLabel = () => {
    if (socketStatus === "connected") return "Live";
    if (socketStatus === "connecting") return "Reconnecting";
    return "Offline";
  };

  const renderTaskActions = (task: Task) => (
    <div className="task-action-group">
      <button
        type="button"
        className="task-action-icon task-action-icon--details"
        aria-label="View task details"
        title="Details"
        data-tooltip="Details"
        onClick={() => setSelectedTaskId(task.id)}
      >
        <TaskActionIcon name="details" />
      </button>
      <button
        type="button"
        className="task-action-icon task-action-icon--comments"
        aria-label={commentsTaskId === task.id ? "Hide task comments" : "Show task comments"}
        title={commentsTaskId === task.id ? "Hide comments" : "Comments"}
        data-tooltip={commentsTaskId === task.id ? "Hide comments" : "Comments"}
        onClick={() => toggleComments(task.id)}
      >
        <TaskActionIcon name="comments" />
      </button>
      <button
        type="button"
        className="task-action-icon task-action-icon--attachments"
        aria-label={attachmentsTaskId === task.id ? "Hide task attachments" : "Show task attachments"}
        title={attachmentsTaskId === task.id ? "Hide attachments" : "Attachments"}
        data-tooltip={attachmentsTaskId === task.id ? "Hide attachments" : "Attachments"}
        onClick={() => toggleAttachments(task.id)}
      >
        <TaskActionIcon name="attachments" />
      </button>
      {isProjectPM ? (
        <>
          <button
            type="button"
            className="task-action-icon task-action-icon--edit"
            aria-label="Edit task"
            title="Edit"
            data-tooltip="Edit"
            onClick={() => openEditForm(task)}
          >
            <TaskActionIcon name="edit" />
          </button>
          <button
            type="button"
            className="task-action-icon task-action-icon--danger"
            aria-label="Delete task"
            title="Delete"
            data-tooltip="Delete"
            onClick={() => setTaskPendingDelete(task)}
          >
            <TaskActionIcon name="delete" />
          </button>
        </>
      ) : (
        <span className="muted-text">Status only</span>
      )}
    </div>
  );

  return (
    <section className="tasks-section task-section modern-task-workflow">
      <div className="card task-panel">
        <div className="task-section-header">
          <div>
            <h2>Tasks</h2>
            <p className="card-desc">Search, filter, update, and discuss project tasks.</p>
          </div>

          <div className="task-header-actions">
            <span className={`socket-status socket-${socketStatus}`}>{getSocketLabel()}</span>
            <Button type="button" variant="secondary" onClick={loadTasks} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
            {isProjectPM && (
              <Button type="button" onClick={openCreateForm}>
                Create Task
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="alert alert-danger">
            <span className="alert-icon">!</span>
            <span className="alert-message">{error}</span>
          </div>
        )}

        {actionError && (
          <div className="alert alert-danger">
            <span className="alert-icon">!</span>
            <span className="alert-message">{actionError}</span>
          </div>
        )}

        <div className="task-filters">
          <Input
            id="task-search"
            type="search"
            label="Search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tasks"
          />

          <div className="form-group">
            <label htmlFor="task-status-filter">Status</label>
            <select id="task-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as FilterStatus)}>
              <option value="all">All</option>
              <option value="to_do">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="task-priority-filter">Priority</label>
            <select id="task-priority-filter" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as FilterPriority)}>
              <option value="all">All</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="task-assignee-filter">Assignee</label>
            <select id="task-assignee-filter" value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}>
              <option value="all">All</option>
              {members.map((member) => (
                <option key={member.id} value={member.userId}>
                  {member.userName}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="task-sort-by">Sort By</label>
            <select id="task-sort-by" value={sortBy} onChange={(event) => setSortBy(event.target.value as TaskSortBy)}>
              <option value="created_at">Created</option>
              <option value="due_date">Due Date</option>
              <option value="priority">Priority</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="task-due-filter">Due Date</label>
            <select id="task-due-filter" value={dueDateFilter} onChange={(event) => setDueDateFilter(event.target.value as DueDateFilter)}>
              <option value="all">All</option>
              <option value="due_soon">Due soon</option>
              <option value="overdue">Overdue</option>
              <option value="no_due_date">No due date</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="task-sort-order">Order</label>
            <select id="task-sort-order" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as TaskSortOrder)}>
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>

          <button className="btn btn-secondary task-filter-apply" onClick={loadTasks} disabled={loading}>
            Apply
          </button>
        </div>

        {(showCreateForm || editingTask) && isProjectPM && (
          <div className="task-form-panel">
            <h3>{editingTask ? "Edit Task" : "Create Task"}</h3>
            <form onSubmit={editingTask ? handleUpdateTask : handleCreateTask} className="task-form">
              <div className="form-group">
                <label htmlFor="task-title">Title <span className="required">*</span></label>
                <input
                  id="task-title"
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  disabled={actionLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="task-description">Description</label>
                <textarea
                  id="task-description"
                  rows={3}
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  disabled={actionLoading}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="task-due">Due Date</label>
                  <input
                    id="task-due"
                    type="date"
                    value={form.dueDate}
                    onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                    disabled={actionLoading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="task-priority">Priority</label>
                  <select
                    id="task-priority"
                    value={form.priority}
                    onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as TaskPriority }))}
                    disabled={actionLoading}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="task-status">Status</label>
                  <select
                    id="task-status"
                    value={form.status}
                    onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as TaskStatus }))}
                    disabled={actionLoading}
                  >
                    <option value="to_do">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              {!editingTask && (
                <div className="form-group">
                  <label htmlFor="task-assignees">Assignees</label>
                  <select
                    id="task-assignees"
                    multiple
                    value={form.assigneeIds}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        assigneeIds: Array.from(event.target.selectedOptions).map((option) => option.value),
                      }))
                    }
                    disabled={actionLoading || members.length === 0}
                  >
                    {members.map((member) => (
                      <option key={member.id} value={member.userId}>
                        {member.userName} - {member.userEmail}
                      </option>
                    ))}
                  </select>
                  <p className="form-help">Hold Ctrl to select multiple project members.</p>
                </div>
              )}

              {editingTask && (
                <div className="task-assignee-editor">
                  <label>Active Assignees</label>
                  <div className="task-assignee-list">
                    {editingTask.assignees.length === 0 ? (
                      <span className="muted-text">No active assignees.</span>
                    ) : (
                      editingTask.assignees.map((assignee) => (
                        <span key={assignee.id} className="task-assignee-chip">
                          {assignee.userName}
                          <button type="button" onClick={() => handleRemoveAssignee(assignee.userId)} disabled={actionLoading}>
                            Remove
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  <div className="task-assignee-add-row">
                    <select value={assigneeToAdd} onChange={(event) => setAssigneeToAdd(event.target.value)} disabled={actionLoading}>
                      <option value="">Select project member</option>
                      {availableAssignees.map((member) => (
                        <option key={member.id} value={member.userId}>
                          {member.userName} - {member.userEmail}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddAssignee} disabled={actionLoading || !assigneeToAdd}>
                      Add
                    </button>
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={closeForms} disabled={actionLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? <span className="spinner"></span> : editingTask ? "Save Task" : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <LoadingState label="Loading tasks..." />
        ) : filteredTasks.length === 0 ? (
          <EmptyState title="No tasks found" description="Adjust filters or create the first task for this project." />
        ) : (
          <>
          <div className="table-responsive task-table-wrap">
            <table className="users-table task-table modern-task-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Project</th>
                  <th>Assignees</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => (
                  <React.Fragment key={task.id}>
                    <tr className={selectedTaskId === task.id ? "selected-task-row" : ""}>
                      <td>
                        <strong className="task-title-cell">{task.title}</strong>
                        {task.description && <span className="task-description-cell">{task.description}</span>}
                      </td>
                      <td>{projectName}</td>
                      <td>
                        <div className="task-assignees-cell avatar-stack">
                          {task.assignees.length === 0
                            ? <span className="muted-text">Unassigned</span>
                            : task.assignees.map((assignee) => (
                                <UserAvatar key={assignee.id} name={assignee.userName} size="sm" />
                              ))}
                        </div>
                      </td>
                      <td>
                        <Badge variant={task.priority}>{PRIORITY_LABELS[task.priority]}</Badge>
                      </td>
                      <td>
                        {isProjectPM ? (
                          <Badge variant={task.status}>{STATUS_LABELS[task.status]}</Badge>
                        ) : (
                          <select
                            className="task-status-select"
                            value={task.status}
                            onChange={(event) => handleCollaboratorStatusChange(task, event.target.value as TaskStatus)}
                          >
                            <option value="to_do">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>
                        )}
                      </td>
                      <td>
                        <span className={`due-chip due-${getDueState(task)}`}>{formatDate(task.dueDate)}</span>
                      </td>
                      <td>{formatDateTime(task.updatedAt)}</td>
                      <td>
                        {renderTaskActions(task)}
                      </td>
                    </tr>
                    {attachmentsTaskId === task.id && (
                      <tr className="task-comments-row">
                        <td colSpan={8}>
                          <TaskAttachmentsSection
                            taskId={task.id}
                            currentUser={currentUser}
                            isProjectPM={isProjectPM}
                          />
                        </td>
                      </tr>
                    )}
                    {commentsTaskId === task.id && (
                      <tr className="task-comments-row">
                        <td colSpan={8}>
                          <TaskCommentsSection
                            taskId={task.id}
                            currentUser={currentUser}
                            isProjectPM={isProjectPM}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mobile-task-card-list">
            {filteredTasks.map((task) => (
              <article key={task.id} className="mobile-task-card">
                <div className="mobile-task-card-header">
                  <div>
                    <strong>{task.title}</strong>
                    {task.description && <p>{task.description}</p>}
                  </div>
                  <Badge variant={task.priority}>{PRIORITY_LABELS[task.priority]}</Badge>
                </div>
                <dl className="mobile-task-meta">
                  <div><dt>Project</dt><dd>{projectName}</dd></div>
                  <div>
                    <dt>Assignees</dt>
                    <dd>
                      <div className="task-assignees-cell avatar-stack">
                        {task.assignees.length === 0
                          ? <span className="muted-text">Unassigned</span>
                          : task.assignees.map((assignee) => (
                              <UserAvatar key={assignee.id} name={assignee.userName} size="sm" />
                            ))}
                      </div>
                    </dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      {isProjectPM ? (
                        <Badge variant={task.status}>{STATUS_LABELS[task.status]}</Badge>
                      ) : (
                        <select
                          className="task-status-select"
                          value={task.status}
                          onChange={(event) => handleCollaboratorStatusChange(task, event.target.value as TaskStatus)}
                        >
                          <option value="to_do">To Do</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      )}
                    </dd>
                  </div>
                  <div><dt>Due</dt><dd><span className={`due-chip due-${getDueState(task)}`}>{formatDate(task.dueDate)}</span></dd></div>
                  <div><dt>Updated</dt><dd>{formatDateTime(task.updatedAt)}</dd></div>
                </dl>
                <div className="mobile-task-actions">{renderTaskActions(task)}</div>
                {attachmentsTaskId === task.id && (
                  <TaskAttachmentsSection taskId={task.id} currentUser={currentUser} isProjectPM={isProjectPM} />
                )}
                {commentsTaskId === task.id && (
                  <TaskCommentsSection taskId={task.id} currentUser={currentUser} isProjectPM={isProjectPM} />
                )}
              </article>
            ))}
          </div>
          </>
        )}

        {selectedTask && (
          <aside className="task-detail-drawer card">
            <div className="task-detail-header">
              <div>
                <span className="kanban-project-name">{projectName}</span>
                <h3>{selectedTask.title}</h3>
              </div>
              <button type="button" className="btn btn-secondary btn-xs" onClick={() => setSelectedTaskId(null)}>Close</button>
            </div>
            <div className="task-detail-badges">
              <Badge variant={selectedTask.status}>{STATUS_LABELS[selectedTask.status]}</Badge>
              <Badge variant={selectedTask.priority}>{PRIORITY_LABELS[selectedTask.priority]}</Badge>
              <span className={`due-chip due-${getDueState(selectedTask)}`}>{formatDate(selectedTask.dueDate)}</span>
            </div>
            <div className="task-detail-grid">
              <section>
                <h4>Description</h4>
                <p>{selectedTask.description || "No description provided."}</p>
              </section>
              <section>
                <h4>Assignees</h4>
                <div className="task-detail-assignees">
                  {selectedTask.assignees.length === 0 ? (
                    <span className="muted-text">Unassigned</span>
                  ) : (
                    selectedTask.assignees.map((assignee) => (
                      <div key={assignee.id}>
                        <UserAvatar name={assignee.userName} size="sm" />
                        <span>{assignee.userName}</span>
                      </div>
                    ))
                  )}
                </div>
              </section>
              <section>
                <h4>Properties</h4>
                <dl className="task-properties">
                  <div><dt>Project</dt><dd>{projectName}</dd></div>
                  <div><dt>Created</dt><dd>{formatDateTime(selectedTask.createdAt)}</dd></div>
                  <div><dt>Last updated</dt><dd>{formatDateTime(selectedTask.updatedAt)}</dd></div>
                  <div><dt>Completed</dt><dd>{selectedTask.completedAt ? formatDateTime(selectedTask.completedAt) : "Not completed"}</dd></div>
                </dl>
              </section>
            </div>
            <div className="task-detail-sections">
              <TaskAttachmentsSection taskId={selectedTask.id} currentUser={currentUser} isProjectPM={isProjectPM} />
              <TaskCommentsSection taskId={selectedTask.id} currentUser={currentUser} isProjectPM={isProjectPM} />
            </div>
          </aside>
        )}
        <ConfirmDialog
          open={Boolean(taskPendingDelete)}
          title="Delete task?"
          description={
            taskPendingDelete
              ? `The task "${taskPendingDelete.title}" will be removed from the active project workspace. This action cannot be undone.`
              : ""
          }
          confirmLabel="Delete"
          variant="danger"
          isLoading={actionLoading}
          onCancel={() => setTaskPendingDelete(null)}
          onConfirm={() => {
            if (taskPendingDelete) {
              return handleDeleteTask(taskPendingDelete);
            }
          }}
        />
      </div>
    </section>
  );
}
