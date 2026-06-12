import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";
import type { DashboardSummary, User } from "../services/api";
import { useSocket } from "../context/SocketContext";

interface DashboardProps {
  currentUser: User;
}

interface SummaryCard {
  label: string;
  value: number;
  helper: string;
  tone?: "default" | "accent" | "warning" | "danger";
}

function buildCards(summary: DashboardSummary): SummaryCard[] {
  return [
    { label: "Total Projects", value: summary.totalProjects, helper: "Active project access" },
    { label: "My Tasks", value: summary.myTasks, helper: "Assigned to you", tone: "accent" },
    { label: "Project Tasks", value: summary.projectTasks, helper: "Visible active tasks" },
    { label: "To Do", value: summary.todoTasks, helper: "Waiting to start" },
    { label: "In Progress", value: summary.inProgressTasks, helper: "Currently active", tone: "accent" },
    { label: "Completed", value: summary.completedTasks, helper: "Finished tasks" },
    { label: "Due Soon", value: summary.dueSoonTasks, helper: "Within the alert window", tone: "warning" },
    { label: "Overdue", value: summary.overdueTasks, helper: "Incomplete past due tasks", tone: "danger" },
    { label: "High Priority", value: summary.highPriorityTasks, helper: "Incomplete high priority", tone: "danger" },
    { label: "Unread Notifications", value: summary.unreadNotifications, helper: "Needs your attention", tone: "accent" },
  ];
}

export default function Dashboard({ currentUser }: DashboardProps) {
  const { socket } = useSocket();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.dashboard.getSummary();
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard summary.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser.role === "admin") return;
    loadSummary();
  }, [currentUser.role, loadSummary]);

  useEffect(() => {
    if (!socket || currentUser.role === "admin") return;

    const handleSummaryUpdated = () => {
      loadSummary();
    };

    socket.on("dashboard:summary-updated", handleSummaryUpdated);

    return () => {
      socket.off("dashboard:summary-updated", handleSummaryUpdated);
    };
  }, [socket, currentUser.role, loadSummary]);

  if (currentUser.role === "admin") {
    return (
      <section className="dashboard-page">
        <div className="dashboard-header">
          <h1>Admin Workspace</h1>
          <p className="subtitle">Use the Admin Workspace to manage users and system settings.</p>
        </div>

        <div className="card dashboard-admin-card">
          <h2>Admin Dashboard</h2>
          <p className="card-desc">
            Project and task dashboard data is limited to project members and collaborators.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p className="subtitle">A live summary of your current workspace.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={loadSummary} disabled={loading}>
          {loading ? <span className="spinner"></span> : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="alert alert-danger dashboard-alert">
          <span>{error}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadSummary}>
            Retry
          </button>
        </div>
      )}

      {loading && !summary && (
        <div className="loading-state card">
          <div className="spinner big"></div>
          <p>Loading dashboard summary...</p>
        </div>
      )}

      {summary && (
        <div className="dashboard-grid">
          {buildCards(summary).map((card) => (
            <article key={card.label} className={`dashboard-card card dashboard-card-${card.tone ?? "default"}`}>
              <span className="dashboard-card-label">{card.label}</span>
              <strong className="dashboard-card-value">{card.value}</strong>
              <span className="dashboard-card-helper">{card.helper}</span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
