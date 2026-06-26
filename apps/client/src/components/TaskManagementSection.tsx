import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api, APIError } from "../services/api";
import TaskAttachmentsSection from "./TaskAttachmentsSection";
import TaskCommentsSection from "./TaskCommentsSection";
import { useSocket } from "../context/SocketContext";
import { useSuccessMessage } from "../context/SuccessMessageContext";
import { Badge, Button, ConfirmDialog, EmptyState, Input, SkeletonKanban, SkeletonTable, UserAvatar } from "./ui";
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
  onTasksChanged?: () => void | Promise<void>;
}

type FilterStatus = "all" | TaskStatus;
type FilterPriority = "all" | TaskPriority;
type DueDateFilter = "all" | "due_soon" | "overdue" | "no_due_date";
type TaskViewMode = "list" | "kanban";
type TaskDetailMode = "view" | "edit";

const STATUS_LABELS: Record<TaskStatus, string> = {
  to_do: "To Do",
  in_progress: "In Progress",
  completed: "Completed",
};

const TASK_STATUSES = ["to_do", "in_progress", "completed"] as const;

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

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";
}

function getDueState(task: Task): "due_soon" | "overdue" | "default" {
  if (!task.dueDate || task.status === "completed") return "default";
  const due = new Date(task.dueDate).getTime();
  const now = Date.now();
  if (due < now) return "overdue";
  if (due <= now + 7 * 24 * 60 * 60 * 1000) return "due_soon";
  return "default";
}

type TaskActionIconName = "comments" | "attachments" | "edit" | "delete";

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

function KanbanColumn({
  status,
  taskCount,
  children,
}: {
  status: TaskStatus;
  taskCount: number;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: status });

  return (
    <section ref={setNodeRef} className={`kanban-column ${isOver ? "kanban-column-over" : ""}`}>
      <div className="kanban-column-header">
        <h3>{STATUS_LABELS[status]}</h3>
        <span>{taskCount}</span>
      </div>
      <div className="kanban-task-list">{children}</div>
    </section>
  );
}

function DraggableKanbanTask({
  task,
  projectName,
  onOpenTaskDetails,
}: {
  task: Task;
  projectName: string;
  onOpenTaskDetails: (task: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { status: task.status },
  });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`kanban-task-card priority-${task.priority} ${isDragging ? "kanban-task-card-dragging" : ""}`}
      style={style}
      onClick={() => {
        if (!isDragging) {
          onOpenTaskDetails(task);
        }
      }}
      {...listeners}
      {...attributes}
    >
      <div className="kanban-task-topline">
        <Badge variant={task.priority}>{PRIORITY_LABELS[task.priority]}</Badge>
        <span className={`due-chip due-${getDueState(task)}`}>{formatDate(task.dueDate)}</span>
      </div>
      <span className="kanban-project-name">{projectName}</span>
      <h4>{task.title}</h4>
      {task.description && <p>{task.description}</p>}
      <div className="kanban-task-footer">
        <div className="task-assignees-cell avatar-stack">
          {task.assignees.length === 0 ? (
            <span className="muted-text">Unassigned</span>
          ) : (
            task.assignees.map((assignee) => (
              <UserAvatar key={assignee.id} name={assignee.userName} size="sm" />
            ))
          )}
        </div>
      </div>
    </button>
  );
}

export default function TaskManagementSection({
  projectId,
  projectName,
  currentUser,
  members,
  isProjectPM,
  onTasksChanged,
}: TaskManagementSectionProps) {
  const { socket, status: socketStatus } = useSocket();
  const { showSuccessMessage } = useSuccessMessage();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
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
  const [viewMode, setViewMode] = useState<TaskViewMode>(() => {
    if (typeof window === "undefined") return "list";
    return window.localStorage.getItem("project-task-view-mode") === "kanban" ? "kanban" : "list";
  });

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [commentsTaskId, setCommentsTaskId] = useState<string | null>(null);
  const [attachmentsTaskId, setAttachmentsTaskId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskDetails, setSelectedTaskDetails] = useState<Task | null>(null);
  const [taskDetailMode, setTaskDetailMode] = useState<TaskDetailMode>("view");
  const [taskPendingDelete, setTaskPendingDelete] = useState<Task | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [assigneeToAdd, setAssigneeToAdd] = useState("");

  const loadTasks = async (): Promise<Task[]> => {
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
      const latestTasks = data.tasks || [];
      setTasks(latestTasks);
      return latestTasks;
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load tasks."));
      return [];
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

    const handleTaskEvent = (payload: { projectId?: string; related_project_id?: string; taskId?: string; related_task_id?: string }) => {
      const relatedProjectId = payload.related_project_id || payload.projectId;
      const relatedTaskId = payload.related_task_id || payload.taskId;
      if (relatedProjectId !== projectId) return;

      if (relatedTaskId && editingTask?.id === relatedTaskId) {
        setEditingTask(null);
        closeForms();
      }

      scheduleRefresh();
    };

    const refreshEvents = ["task:created", "task:updated", "task:deleted", "comment:created", "attachment:created"];
    refreshEvents.forEach((eventName) => socket.on(eventName, handleTaskEvent));

    return () => {
      window.clearTimeout(refreshTimer);
      refreshEvents.forEach((eventName) => socket.off(eventName, handleTaskEvent));
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

  const selectedTask = selectedTaskDetails || tasks.find((task) => task.id === selectedTaskId) || null;
  const tasksByStatus = useMemo(
    () =>
      filteredTasks.reduce<Record<TaskStatus, Task[]>>(
        (groups, task) => {
          groups[task.status].push(task);
          return groups;
        },
        { to_do: [], in_progress: [], completed: [] }
      ),
    [filteredTasks]
  );

  useEffect(() => {
    window.localStorage.setItem("project-task-view-mode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!selectedTaskId) return;

    const refreshedSelectedTask = tasks.find((task) => task.id === selectedTaskId);
    if (refreshedSelectedTask) {
      setSelectedTaskDetails(refreshedSelectedTask);
    } else if (!selectedTaskDetails) {
      setSelectedTaskId(null);
    }
  }, [selectedTaskDetails, selectedTaskId, tasks]);

  useEffect(() => {
    if (!selectedTask) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedTaskId(null);
        setSelectedTaskDetails(null);
        setTaskDetailMode("view");
        resetForm();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedTask]);

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

  const setFormFromTask = (task: Task) => {
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
      showSuccessMessage("Task created successfully.");
      closeForms();
      await loadTasks();
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to create task."));
    } finally {
      setActionLoading(false);
    }
  };

  const refreshTaskInState = async (taskId: string) => {
    const refreshed = await api.tasks.get(taskId);
    setSelectedTaskDetails(refreshed.task);
    setTasks((current) => current.map((task) => (task.id === taskId ? refreshed.task : task)));
    return refreshed.task;
  };

  const refreshTasksAndSelectedTask = async (taskId: string) => {
  const refreshed = await api.tasks.get(taskId);
  const updatedTask = refreshed.task;

  setSelectedTaskId(taskId);
  setSelectedTaskDetails(updatedTask);
  setTaskDetailMode("view");

  setTasks((current) =>
    current.map((task) => (task.id === taskId ? updatedTask : task))
  );

  setForm((current) => ({
    ...current,
    assigneeIds: updatedTask.assignees.map((assignee) => assignee.userId),
  }));

  return updatedTask;
};

  const handleUpdateTaskInDetails = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTask) return;

    setActionError(null);

    if (!form.title.trim()) {
      setActionError("Task title is required.");
      return;
    }

    setActionLoading(true);

    try {
      await api.tasks.update(selectedTask.id, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        due_date: form.dueDate || null,
        priority: form.priority,
        status: form.status,
      });
      showSuccessMessage("Task updated successfully.");
      const refreshedTask = await refreshTaskInState(selectedTask.id);
      setFormFromTask(refreshedTask);
      await loadTasks();
      setTaskDetailMode("view");
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to update task."));
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
      showSuccessMessage("Task updated successfully.");
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
      showSuccessMessage("Task deleted successfully.");
      setTaskPendingDelete(null);
      if (selectedTaskId === task.id) {
        closeTaskDetails();
      }
      await loadTasks();
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to delete task."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleTaskStatusChange = async (
    task: Task,
    status: TaskStatus,
    options: { optimistic?: boolean } = {}
  ) => {
    const previousTasks = tasks;
    setActionError(null);

    if (options.optimistic) {
      setTasks((current) =>
        current.map((currentTask) => (currentTask.id === task.id ? { ...currentTask, status } : currentTask))
      );
    }

    try {
      await api.tasks.update(task.id, { status });
      showSuccessMessage("Task status updated successfully.");
      await loadTasks();
      await onTasksChanged?.();
    } catch (err) {
      if (options.optimistic) {
        setTasks(previousTasks);
        await onTasksChanged?.();
      }
      setActionError(getErrorMessage(err, "Failed to update task status."));
    }
  };

  const handleKanbanDragEnd = async (event: DragEndEvent) => {
    const taskId = String(event.active.id);
    const targetStatus = event.over?.id as TaskStatus | undefined;

    if (!targetStatus || !TASK_STATUSES.includes(targetStatus)) {
      return;
    }

    const draggedTask = tasks.find((task) => task.id === taskId);

    if (!draggedTask || draggedTask.status === targetStatus) {
      return;
    }

    await handleTaskStatusChange(draggedTask, targetStatus, { optimistic: true });
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

  const handleAddAssigneeFromDetails = async (task: Task, userId: string) => {
    setActionError(null);
    setActionLoading(true);

    try {
      await api.tasks.addAssignee(task.id, userId);
      const refreshed = await api.tasks.get(task.id);

      setSelectedTaskId(task.id);
      setSelectedTaskDetails(refreshed.task);
      setTaskDetailMode("view");
      setTasks((current) => current.map((item) => (item.id === task.id ? refreshed.task : item)));
      setForm((current) => ({
        ...current,
        assigneeIds: refreshed.task.assignees.map((assignee) => assignee.userId),
      }));
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

  const handleRemoveAssigneeFromDetails = async (task: Task, userId: string) => {
    setActionError(null);
    setActionLoading(true);

    try {
      await api.tasks.removeAssignee(task.id, userId);
      await refreshTasksAndSelectedTask(task.id);
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to remove assignee."));
    } finally {
      setActionLoading(false);
    }
  };

  const availableAssignees = editingTask
    ? members.filter((member) => !editingTask.assignees.some((assignee) => assignee.userId === member.userId))
    : [];

  const getSocketLabel = () => {
    if (socketStatus === "connected") return "Live";
    if (socketStatus === "connecting") return "Reconnecting";
    return "Offline";
  };

  const openTaskDetails = (task: Task) => {
    setActionError(null);
    setTaskDetailMode("view");
    setSelectedTaskId(task.id);
    setSelectedTaskDetails(task);
  };

  const closeTaskDetails = () => {
    setSelectedTaskId(null);
    setSelectedTaskDetails(null);
    setTaskDetailMode("view");
    resetForm();
  };

  const openTaskEditFromDetails = (task: Task) => {
    setActionError(null);
    setFormFromTask(task);
    setTaskDetailMode("edit");
  };

  const cancelTaskDetailEdit = () => {
    if (selectedTask) {
      setFormFromTask(selectedTask);
    }
    setActionError(null);
    setTaskDetailMode("view");
  };

  const isTaskAssignedToMember = (task: Task, userId: string) => {
    return task.assignees.some((assignee) => assignee.userId === userId);
  };

  const getAssigneeForMember = (task: Task, userId: string) => {
    return task.assignees.find((assignee) => assignee.userId === userId);
  };

  const handleTaskDetailKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      if (taskDetailMode === "edit") {
        cancelTaskDetailEdit();
      } else {
        closeTaskDetails();
      }
    }
  };

  const renderTaskActions = (task: Task) => (
    <div className="task-action-group">
      <button
        type="button"
        className="task-action-icon task-action-icon--comments"
        aria-label={commentsTaskId === task.id ? "Hide task comments" : "Show task comments"}
        title={commentsTaskId === task.id ? "Hide comments" : "Comments"}
        data-tooltip={commentsTaskId === task.id ? "Hide comments" : "Comments"}
        onClick={(event) => {
          event.stopPropagation();
          toggleComments(task.id);
        }}
      >
        <TaskActionIcon name="comments" />
      </button>
      <button
        type="button"
        className="task-action-icon task-action-icon--attachments"
        aria-label={attachmentsTaskId === task.id ? "Hide task attachments" : "Show task attachments"}
        title={attachmentsTaskId === task.id ? "Hide attachments" : "Attachments"}
        data-tooltip={attachmentsTaskId === task.id ? "Hide attachments" : "Attachments"}
        onClick={(event) => {
          event.stopPropagation();
          toggleAttachments(task.id);
        }}
      >
        <TaskActionIcon name="attachments" />
      </button>
      {isProjectPM && (
        <button
          type="button"
          className="task-action-icon task-action-icon--danger"
          aria-label="Delete task"
          title="Delete"
          data-tooltip="Delete"
          onClick={(event) => {
            event.stopPropagation();
            setTaskPendingDelete(task);
          }}
        >
          <TaskActionIcon name="delete" />
        </button>
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

        <div className="task-view-toolbar" aria-label="Task view options">
          <div className="task-view-toggle" role="tablist" aria-label="Task view">
            <button
              type="button"
              className={viewMode === "list" ? "active" : ""}
              role="tab"
              aria-selected={viewMode === "list"}
              onClick={() => setViewMode("list")}
            >
              List
            </button>
            <button
              type="button"
              className={viewMode === "kanban" ? "active" : ""}
              role="tab"
              aria-selected={viewMode === "kanban"}
              onClick={() => setViewMode("kanban")}
            >
              Kanban
            </button>
          </div>
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
          viewMode === "kanban" ? <SkeletonKanban /> : <SkeletonTable rows={6} columns={8} />
        ) : filteredTasks.length === 0 ? (
          <EmptyState title="No tasks found" description="Adjust filters or create the first task for this project." />
        ) : (
          viewMode === "list" ? (
          <>
          <div className="table-responsive task-table-wrap custom-scrollbar">
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
                    <tr
                      className={`clickable-task-row ${selectedTaskId === task.id ? "selected-task-row" : ""}`}
                      onClick={() => openTaskDetails(task)}
                    >
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
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => handleTaskStatusChange(task, event.target.value as TaskStatus)}
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
              <article
                key={task.id}
                className="mobile-task-card clickable-task-card"
                onClick={() => openTaskDetails(task)}
              >
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
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => handleTaskStatusChange(task, event.target.value as TaskStatus)}
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
                  <div onClick={(event) => event.stopPropagation()}>
                    <TaskAttachmentsSection taskId={task.id} currentUser={currentUser} isProjectPM={isProjectPM} />
                  </div>
                )}
                {commentsTaskId === task.id && (
                  <div onClick={(event) => event.stopPropagation()}>
                    <TaskCommentsSection taskId={task.id} currentUser={currentUser} isProjectPM={isProjectPM} />
                  </div>
                )}
              </article>
            ))}
          </div>
          </>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleKanbanDragEnd}
            >
              <div className="kanban-board project-task-kanban custom-scrollbar" aria-label="Task Kanban board">
                {TASK_STATUSES.map((status) => (
                  <KanbanColumn key={status} status={status} taskCount={tasksByStatus[status].length}>
                    {tasksByStatus[status].length === 0 ? (
                      <div className="kanban-empty-state">No tasks</div>
                    ) : (
                      tasksByStatus[status].map((task) => (
                        <DraggableKanbanTask
                          key={task.id}
                          task={task}
                          projectName={projectName}
                          onOpenTaskDetails={openTaskDetails}
                        />
                      ))
                    )}
                  </KanbanColumn>
                ))}
              </div>
            </DndContext>
          )
        )}

        {selectedTask && (
          <div
            className="task-detail-modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeTaskDetails();
              }
            }}
          >
            <aside
              className="task-detail-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="task-detail-modal-title"
              onKeyDown={handleTaskDetailKeyDown}
            >
              <div className="task-modal-header">
                <div className="task-modal-title-group">
                  <p className="task-modal-project-name">{projectName}</p>
                  <h2 id="task-detail-modal-title" className="task-modal-title">
                    {taskDetailMode === "edit" ? "Edit Task" : selectedTask.title}
                  </h2>
                  <div className="task-modal-badges">
                    <Badge variant={selectedTask.status}>{STATUS_LABELS[selectedTask.status]}</Badge>
                    <Badge variant={selectedTask.priority}>{PRIORITY_LABELS[selectedTask.priority]}</Badge>
                    <span className={`due-chip due-${getDueState(selectedTask)}`}>{formatDate(selectedTask.dueDate)}</span>
                  </div>
                </div>
                <div className="task-modal-header-actions">
                  {isProjectPM && taskDetailMode === "view" && (
                    <button
                      type="button"
                      className="task-action-icon task-action-icon--edit"
                      aria-label="Edit task"
                      title="Edit"
                      onClick={() => openTaskEditFromDetails(selectedTask)}
                    >
                      <TaskActionIcon name="edit" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="task-detail-close"
                    aria-label="Close task details"
                    onClick={closeTaskDetails}
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="task-detail-modal-body custom-scrollbar">
                {actionError && (
                  <div className="alert alert-danger">
                    <span className="alert-icon">!</span>
                    <span className="alert-message">{actionError}</span>
                  </div>
                )}

                {taskDetailMode === "view" ? (
                  <>
                    <div className="task-detail-grid">
                      <section className="task-detail-card task-detail-description-card">
                        <h4>Description</h4>
                        <p>{selectedTask.description || "No description provided."}</p>
                      </section>
                      <section className="task-detail-card">
                        <h4>Properties</h4>
                        <dl className="task-properties">
                          <div><dt>Project</dt><dd>{projectName}</dd></div>
                          <div><dt>Created</dt><dd>{formatDateTime(selectedTask.createdAt)}</dd></div>
                          <div><dt>Last updated</dt><dd>{formatDateTime(selectedTask.updatedAt)}</dd></div>
                          <div><dt>Completed</dt><dd>{selectedTask.completedAt ? formatDateTime(selectedTask.completedAt) : "Not completed"}</dd></div>
                        </dl>
                      </section>
                    </div>
                    <section className="task-assignees-panel">
                      <div className="task-assignees-panel-header">
                        <h3>Assignees</h3>
                      </div>

                      <div className="task-assignee-grid">
                        {isProjectPM ? (
                          members.length === 0 ? (
                            <span className="muted-text">No project members available.</span>
                          ) : (
                            members.map((member) => {
                              const isAssigned = isTaskAssignedToMember(selectedTask, member.userId);
                              const assignee = getAssigneeForMember(selectedTask, member.userId);
                              const displayName = assignee?.userName || member.userName;

                              return (
                                <div
                                  key={member.id}
                                  className={`task-assignee-card ${isAssigned ? "is-assigned" : ""}`}
                                >
                                  <div className="task-assignee-avatar">
                                    {getInitials(displayName)}
                                  </div>

                                  <div className="task-assignee-info">
                                    <div className="task-assignee-name">
                                      {displayName}
                                    </div>
                                    <div className="task-assignee-email">
                                      {member.userEmail}
                                    </div>
                                  </div>

                                  <div className="task-assignee-actions">
                                    {isAssigned && (
                                      <span className="task-assignee-badge">Assigned</span>
                                    )}

                                    {isAssigned ? (
                                      <button
                                        type="button"
                                        className="task-assignee-btn task-assignee-btn-remove"
                                        onClick={() => handleRemoveAssigneeFromDetails(selectedTask, member.userId)}
                                        disabled={actionLoading}
                                      >
                                        Remove
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        className="task-assignee-btn task-assignee-btn-add"
                                        onClick={() => handleAddAssigneeFromDetails(selectedTask, member.userId)}
                                        disabled={actionLoading}
                                      >
                                        Add
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )
                        ) : selectedTask.assignees.length === 0 ? (
                          <span className="muted-text">Unassigned</span>
                        ) : (
                          selectedTask.assignees.map((assignee) => (
                            <div key={assignee.id} className="task-assignee-card is-assigned">
                              <div className="task-assignee-avatar">
                                {getInitials(assignee.userName)}
                              </div>

                              <div className="task-assignee-info">
                                <div className="task-assignee-name">
                                  {assignee.userName}
                                </div>
                                <div className="task-assignee-email">
                                  {assignee.userEmail}
                                </div>
                              </div>

                              <div className="task-assignee-actions">
                                <span className="task-assignee-badge">Assigned</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </section>
                    <div className="task-detail-sections">
                      <TaskAttachmentsSection taskId={selectedTask.id} currentUser={currentUser} isProjectPM={isProjectPM} />
                      <TaskCommentsSection taskId={selectedTask.id} currentUser={currentUser} isProjectPM={isProjectPM} />
                    </div>
                  </>
                ) : (
                  <form onSubmit={handleUpdateTaskInDetails} className="task-form task-detail-edit-form">
                    <div className="form-group">
                      <label htmlFor="detail-task-title">Title <span className="required">*</span></label>
                      <input
                        id="detail-task-title"
                        value={form.title}
                        onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                        disabled={actionLoading}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="detail-task-description">Description</label>
                      <textarea
                        id="detail-task-description"
                        rows={4}
                        value={form.description}
                        onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                        disabled={actionLoading}
                      />
                    </div>

                    <div className="form-row task-detail-edit-grid">
                      <div className="form-group">
                        <label htmlFor="detail-task-due">Due Date</label>
                        <input
                          id="detail-task-due"
                          type="date"
                          value={form.dueDate}
                          onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                          disabled={actionLoading}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="detail-task-priority">Priority</label>
                        <select
                          id="detail-task-priority"
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
                        <label htmlFor="detail-task-status">Status</label>
                        <select
                          id="detail-task-status"
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

                    <div className="form-actions task-detail-edit-actions">
                      <button type="button" className="btn btn-secondary" onClick={cancelTaskDetailEdit} disabled={actionLoading}>
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                        {actionLoading ? <span className="spinner"></span> : "Save Task"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </aside>
          </div>
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
