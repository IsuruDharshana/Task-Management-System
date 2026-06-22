import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import type { ActivityLog, DashboardSummary, Project, Task, User } from "../services/api";
import { useSocket } from "../context/SocketContext";
import { Badge, Button, EmptyState, SkeletonDashboard, UserAvatar } from "./ui";
import { useRouter } from "./Router";

interface DashboardProps {
  currentUser: User;
}

interface ProjectWithTasks {
  project: Project;
  tasks: Task[];
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function isDueSoon(value: string | null): boolean {
  if (!value) return false;
  const due = new Date(value).getTime();
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return due >= now && due <= now + sevenDays;
}

function isCompletedThisWeek(task: Task): boolean {
  if (!task.completedAt) return false;
  const completed = new Date(task.completedAt).getTime();
  return completed >= Date.now() - 7 * 24 * 60 * 60 * 1000;
}

function projectProgress(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((task) => task.status === "completed").length / tasks.length) * 100);
}

function formatAction(action: string): string {
  return action
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getMetricIcon(label: string) {
  const common = {
    viewBox: "0 0 24 24",
    "aria-hidden": true,
    focusable: false,
  };

  switch (label) {
    case "Active Projects":
      return <svg {...common}><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M8 13h8" /></svg>;
    case "Open Tasks":
      return <svg {...common}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>;
    case "Due Soon":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "Completed This Week":
      return <svg {...common}><path d="M20 6 9 17l-5-5" /><path d="M20 12a8 8 0 1 1-2.35-5.65" /></svg>;
    default:
      return <svg {...common}><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 16v-5" /><path d="M12 16V8" /><path d="M16 16v-3" /></svg>;
  }
}

function getMetricVariant(label: string): string {
  switch (label) {
    case "Active Projects":
      return "metric-card--blue";
    case "Open Tasks":
      return "metric-card--green";
    case "Due Soon":
      return "metric-card--amber";
    case "Completed This Week":
      return "metric-card--teal";
    default:
      return "";
  }
}

export default function Dashboard({ currentUser }: DashboardProps) {
  const { navigate } = useRouter();
  const { socket } = useSocket();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [projectData, setProjectData] = useState<ProjectWithTasks[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (currentUser.role === "admin") return;

    setLoading(true);
    setError(null);

    try {
      const [summaryData, projectsData, activityData] = await Promise.all([
        api.dashboard.getSummary(),
        api.projects.list(),
        api.activityLogs.list({ limit: 8 }),
      ]);

      const projects = projectsData.projects || [];
      const projectsWithTasks = await Promise.all(
        projects.map(async (project) => {
          const tasksData = await api.tasks.list(project.id, { sortBy: "due_date", sortOrder: "asc" });
          return { project, tasks: tasksData.tasks || [] };
        })
      );

      setSummary(summaryData.summary);
      setProjectData(projectsWithTasks);
      setActivity(activityData.logs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [currentUser.role]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!socket || currentUser.role === "admin") return;

    const handleSummaryUpdated = () => {
      loadDashboard();
    };

    const refreshEvents = [
      "dashboard:summary-updated",
      "notification:new",
      "project:updated",
      "task:created",
      "task:updated",
      "task:deleted",
      "comment:created",
      "attachment:created",
    ];

    refreshEvents.forEach((eventName) => socket.on(eventName, handleSummaryUpdated));

    return () => {
      refreshEvents.forEach((eventName) => socket.off(eventName, handleSummaryUpdated));
    };
  }, [socket, currentUser.role, loadDashboard]);

  const allTasks = useMemo(() => projectData.flatMap((item) => item.tasks), [projectData]);
  const assignedTasks = useMemo(
    () => allTasks.filter((task) => task.assignees.some((assignee) => assignee.userId === currentUser.id)),
    [allTasks, currentUser.id]
  );
  const visibleTasks = currentUser.role === "collaborator" ? assignedTasks : allTasks;
  const priorityTasks = visibleTasks
    .filter((task) => task.priority === "high" && task.status !== "completed")
    .slice(0, 5);
  const upcomingTasks = visibleTasks
    .filter((task) => task.status !== "completed" && isDueSoon(task.dueDate))
    .slice(0, 5);

  if (currentUser.role === "admin") {
    return (
      <section className="dashboard-page veyra-page">
        <div className="modern-page-header">
          <div>
            <h1>Admin Dashboard</h1>
            <p className="subtitle">User access, account status, and system administration live in the Admin workspace.</p>
          </div>
          <Button type="button" onClick={() => navigate("/admin")}>Open User Management</Button>
        </div>
      </section>
    );
  }

  if (loading && !summary) {
    return <SkeletonDashboard />;
  }

  const metricCards =
    currentUser.role === "project_manager"
      ? [
          { label: "Active Projects", value: projectData.filter(({ project }) => project.status === "active").length },
          { label: "Open Tasks", value: visibleTasks.filter((task) => task.status !== "completed").length },
          { label: "Due Soon", value: summary?.dueSoonTasks ?? upcomingTasks.length },
          { label: "Completed This Week", value: visibleTasks.filter(isCompletedThisWeek).length },
        ]
      : [
          { label: "Assigned Tasks", value: assignedTasks.length },
          { label: "In Progress", value: assignedTasks.filter((task) => task.status === "in_progress").length },
          { label: "Due Soon", value: assignedTasks.filter((task) => isDueSoon(task.dueDate)).length },
          { label: "Completed", value: assignedTasks.filter((task) => task.status === "completed").length },
        ];

  return (
    <section className="dashboard-page veyra-page">
      <div className="modern-page-header">
        <div>
          <h1>{currentUser.role === "project_manager" ? "Project Manager Dashboard" : "My Work Dashboard"}</h1>
          <p className="subtitle">
            {currentUser.role === "project_manager"
              ? "Monitor project spaces, priority work, and upcoming delivery risks."
              : "Focus on your assigned tasks, comments, deadlines, and notifications."}
          </p>
        </div>
        <div className="header-actions">
          <Button type="button" variant="secondary" onClick={loadDashboard} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
          {currentUser.role === "project_manager" && (
            <Button type="button" onClick={() => navigate("/projects/new")}>New Project</Button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-danger dashboard-alert">
          <span>{error}</span>
          <Button type="button" variant="secondary" onClick={loadDashboard}>Retry</Button>
        </div>
      )}

      <div className="dashboard-grid modern-metrics-grid">
        {metricCards.map((card) => (
          <article key={card.label} className={`dashboard-card card modern-metric-card ${getMetricVariant(card.label)}`}>
            <span className="dashboard-card-label">{card.label}</span>
            <span className="dashboard-metric-icon" aria-hidden="true">{getMetricIcon(card.label)}</span>
            <strong className="dashboard-card-value">{card.value}</strong>
            <span className="dashboard-card-helper">Live from your Veyra workspace</span>
          </article>
        ))}
      </div>

      <div className="dashboard-work-grid">
        <section className="card dashboard-wide-card">
          <div className="section-heading-row">
            <div>
              <h2>{currentUser.role === "project_manager" ? "My Projects" : "My Assigned Tasks"}</h2>
              <p className="card-desc">
                {currentUser.role === "project_manager" ? "Project progress derived from visible task status." : "Assigned work across your visible projects."}
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={() => navigate("/projects")}>
              View all
            </Button>
          </div>

          {currentUser.role === "project_manager" ? (
            projectData.length === 0 ? (
              <EmptyState title="No projects yet" description="Create a project to begin tracking work." />
            ) : (
              <div className="dashboard-project-list">
                {projectData.slice(0, 4).map(({ project, tasks }) => (
                  <button key={project.id} type="button" className="dashboard-project-row" onClick={() => navigate(`/projects/${project.id}`)}>
                    <div>
                      <div className="project-row-title">
                        <strong>{project.name}</strong>
                        <Badge variant={project.status}>{project.status}</Badge>
                      </div>
                      <p>{project.description || "No description provided."}</p>
                      <div className="project-progress-track">
                        <span style={{ width: `${projectProgress(tasks)}%` }} />
                      </div>
                    </div>
                    <div className="project-row-meta">
                      <span>{tasks.length} tasks</span>
                      <span>Due {formatDate(project.dueDate)}</span>
                      <span>{projectProgress(tasks)}%</span>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : assignedTasks.length === 0 ? (
            <EmptyState title="No assigned tasks" description="Assigned work will appear here when project managers assign tasks to you." />
          ) : (
            <div className="dashboard-task-list">
              {assignedTasks.slice(0, 6).map((task) => (
                <article key={task.id} className="dashboard-task-item">
                  <div>
                    <strong>{task.title}</strong>
                    <span>Due {formatDate(task.dueDate)}</span>
                  </div>
                  <Badge variant={task.status}>{task.status.replace("_", " ")}</Badge>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="dashboard-side-stack">
          <section className="card">
            <h2>{currentUser.role === "project_manager" ? "Priority Tasks" : "Due Soon"}</h2>
            <div className="dashboard-task-list compact">
              {(currentUser.role === "project_manager" ? priorityTasks : upcomingTasks).length === 0 ? (
                <p className="muted-text">No urgent work right now.</p>
              ) : (
                (currentUser.role === "project_manager" ? priorityTasks : upcomingTasks).map((task) => (
                  <article key={task.id} className="dashboard-task-item">
                    <div>
                      <strong>{task.title}</strong>
                      <span>Due {formatDate(task.dueDate)}</span>
                    </div>
                    <Badge variant={task.priority}>{task.priority}</Badge>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="card">
            <h2>{currentUser.role === "project_manager" ? "Recent Activity" : "Notifications"}</h2>
            <div className="activity-mini-list">
              {activity.length === 0 ? (
                <p className="muted-text">No recent activity available.</p>
              ) : (
                activity.slice(0, 5).map((item) => (
                  <article key={item.id}>
                    <UserAvatar name={item.actorName || "Veyra"} size="sm" />
                    <div>
                      <strong>{formatAction(item.action)}</strong>
                      <span>{item.actorName || "System"} · {formatDate(item.createdAt)}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
