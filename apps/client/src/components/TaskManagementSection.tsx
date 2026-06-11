import React, { useEffect, useMemo, useState } from "react";
import { api, APIError } from "../services/api";
import TaskAttachmentsSection from "./TaskAttachmentsSection";
import TaskCommentsSection from "./TaskCommentsSection";
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
  currentUser: User;
  members: Member[];
  isProjectPM: boolean;
}

type FilterStatus = "all" | TaskStatus;
type FilterPriority = "all" | TaskPriority;

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

export default function TaskManagementSection({
  projectId,
  currentUser,
  members,
  isProjectPM,
}: TaskManagementSectionProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<FilterPriority>("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [sortBy, setSortBy] = useState<TaskSortBy>("created_at");
  const [sortOrder, setSortOrder] = useState<TaskSortOrder>("desc");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [commentsTaskId, setCommentsTaskId] = useState<string | null>(null);
  const [attachmentsTaskId, setAttachmentsTaskId] = useState<string | null>(null);
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

  useEffect(() => {
    loadTasks();
  }, [projectId]);

  const summary = useMemo(() => {
    return {
      total: tasks.length,
      toDo: tasks.filter((task) => task.status === "to_do").length,
      inProgress: tasks.filter((task) => task.status === "in_progress").length,
      completed: tasks.filter((task) => task.status === "completed").length,
    };
  }, [tasks]);

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
    if (!window.confirm(`Delete task "${task.title}"?`)) return;

    const reason = window.prompt("Reason for deletion (optional):") || undefined;
    setActionError(null);

    try {
      await api.tasks.delete(task.id, reason);
      await loadTasks();
    } catch (err) {
      alert(getErrorMessage(err, "Failed to delete task."));
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
  };

  const toggleAttachments = (taskId: string) => {
    setAttachmentsTaskId((current) => (current === taskId ? null : taskId));
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

  return (
    <section className="task-section">
      <div className="card task-panel">
        <div className="task-section-header">
          <div>
            <h2>Tasks</h2>
            <p className="card-desc">Track core project work and assignments.</p>
          </div>

          <div className="task-header-actions">
            <button className="btn btn-secondary btn-sm" onClick={loadTasks} disabled={loading}>
              {loading ? <span className="spinner"></span> : "Refresh"}
            </button>
            {isProjectPM && (
              <button className="btn btn-primary btn-sm" onClick={openCreateForm}>
                Create Task
              </button>
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

        <div className="task-summary-grid">
          <div className="task-summary-card">
            <span>Total Tasks</span>
            <strong>{summary.total}</strong>
          </div>
          <div className="task-summary-card">
            <span>To Do</span>
            <strong>{summary.toDo}</strong>
          </div>
          <div className="task-summary-card">
            <span>In Progress</span>
            <strong>{summary.inProgress}</strong>
          </div>
          <div className="task-summary-card">
            <span>Completed</span>
            <strong>{summary.completed}</strong>
          </div>
        </div>

        <div className="task-filters">
          <div className="form-group">
            <label htmlFor="task-search">Search</label>
            <input
              id="task-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks"
            />
          </div>

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
          <div className="loading-state">
            <span className="spinner big"></span>
            <p>Loading tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            <h3>No tasks found</h3>
            <p className="subtitle">Adjust filters or create the first task for this project.</p>
          </div>
        ) : (
          <div className="table-responsive task-table-wrap">
            <table className="users-table task-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th>Assignees</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <React.Fragment key={task.id}>
                    <tr>
                      <td>
                        <strong className="task-title-cell">{task.title}</strong>
                        {task.description && <span className="task-description-cell">{task.description}</span>}
                      </td>
                      <td>
                        <span className={`task-priority priority-${task.priority}`}>{PRIORITY_LABELS[task.priority]}</span>
                      </td>
                      <td>
                        {isProjectPM ? (
                          <span className={`task-status status-${task.status}`}>{STATUS_LABELS[task.status]}</span>
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
                      <td>{formatDate(task.dueDate)}</td>
                      <td>
                        <div className="task-assignees-cell">
                          {task.assignees.length === 0
                            ? "Unassigned"
                            : task.assignees.map((assignee) => (
                                <span key={assignee.id} className="badge badge-secondary">
                                  {assignee.userName}
                                </span>
                              ))}
                        </div>
                      </td>
                      <td>{formatDateTime(task.updatedAt)}</td>
                      <td>
                        <div className="task-row-actions">
                          <button className="btn btn-secondary btn-xs" onClick={() => toggleComments(task.id)}>
                            {commentsTaskId === task.id ? "Hide Comments" : "Comments"}
                          </button>
                          <button className="btn btn-secondary btn-xs" onClick={() => toggleAttachments(task.id)}>
                            {attachmentsTaskId === task.id ? "Hide Attachments" : "Attachments"}
                          </button>
                          {isProjectPM ? (
                            <>
                              <button className="btn btn-secondary btn-xs" onClick={() => openEditForm(task)}>
                                Edit
                              </button>
                              <button className="btn btn-danger btn-xs" onClick={() => handleDeleteTask(task)}>
                                Delete
                              </button>
                            </>
                          ) : (
                            <span className="muted-text">Status only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {attachmentsTaskId === task.id && (
                      <tr className="task-comments-row">
                        <td colSpan={7}>
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
                        <td colSpan={7}>
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
        )}
      </div>
    </section>
  );
}
