import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import type { Member, Project, Task, User } from "../services/api";
import { useRouter } from "./Router";
import { useSocket } from "../context/SocketContext";
import { Badge, Button, EmptyState, Input, SkeletonProjectGrid, UserAvatar } from "./ui";

interface ProjectsListProps {
  currentUser: User;
}

interface ProjectCardData {
  project: Project;
  members: Member[];
  tasks: Task[];
}

type ProjectStatusFilter = "all" | "active" | "completed" | "archived";

function formatDate(value: string | null): string {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function projectProgress(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((task) => task.status === "completed").length / tasks.length) * 100);
}

export default function ProjectsList({ currentUser }: ProjectsListProps) {
  const { navigate } = useRouter();
  const { socket } = useSocket();
  const [projectCards, setProjectCards] = useState<ProjectCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>("all");

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.projects.list();
      const projects = data.projects || [];
      const hydrated = await Promise.all(
        projects.map(async (project) => {
          const [membersData, tasksData] = await Promise.all([
            api.members.list(project.id),
            api.tasks.list(project.id, { sortBy: "created_at", sortOrder: "desc" }),
          ]);
          return { project, members: membersData.members || [], tasks: tasksData.tasks || [] };
        })
      );
      setProjectCards(hydrated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser.role === "admin") return;
    fetchProjects();
  }, [currentUser.role, fetchProjects]);

  useEffect(() => {
    if (!socket || currentUser.role === "admin") return;

    const handleProjectUpdated = () => {
      fetchProjects();
    };

    const refreshEvents = [
      "notification:new",
      "project:updated",
      "task:created",
      "task:updated",
      "task:deleted",
      "comment:created",
      "attachment:created",
    ];

    refreshEvents.forEach((eventName) => socket.on(eventName, handleProjectUpdated));

    return () => {
      refreshEvents.forEach((eventName) => socket.off(eventName, handleProjectUpdated));
    };
  }, [socket, currentUser.role, fetchProjects]);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projectCards.filter(({ project }) => {
      const matchesSearch =
        !query ||
        project.name.toLowerCase().includes(query) ||
        (project.description || "").toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || project.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projectCards, search, statusFilter]);

  if (currentUser.role === "admin") {
    return (
      <div className="unauthorized-container card">
        <span className="unauthorized-icon">!</span>
        <h2>Access Denied</h2>
        <p>Admin users cannot access project management features.</p>
      </div>
    );
  }

  const isGlobalPM = currentUser.role === "project_manager";

  return (
    <div className="projects-list-page veyra-page">
      <div className="modern-page-header">
        <div>
          <h1>Projects</h1>
          <p className="subtitle">Manage project spaces, members, and task progress.</p>
        </div>
        <div className="header-actions">
          <Button type="button" variant="secondary" onClick={fetchProjects} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
          {isGlobalPM && (
            <Button type="button" onClick={() => navigate("/projects/new")}>
              Create Project
            </Button>
          )}
        </div>
      </div>

      <div className="card project-toolbar">
        <Input id="project-search" type="search" label="Search projects" placeholder="Search by name or description" value={search} onChange={(event) => setSearch(event.target.value)} />
        <div className="project-status-filter">
          <label htmlFor="project-status-filter">Status</label>
          <select id="project-status-filter" className="veyra-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ProjectStatusFilter)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {loading ? (
        <SkeletonProjectGrid />
      ) : error ? (
        <div className="error-state card">
          <p className="error-msg">{error}</p>
          <Button type="button" variant="secondary" onClick={fetchProjects}>Retry</Button>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No projects found"
            description={isGlobalPM ? "Create a project or adjust your filters." : "You are not currently assigned to matching projects."}
            action={isGlobalPM ? <Button type="button" onClick={() => navigate("/projects/new")}>Create Project</Button> : undefined}
          />
        </div>
      ) : (
        <div className="projects-grid modern-projects-grid">
          {filteredProjects.map(({ project, members, tasks }) => {
            const progress = projectProgress(tasks);
            return (
              <article key={project.id} className="card project-card modern-project-card">
                <button type="button" className="project-card-hit" onClick={() => navigate(`/projects/${project.id}`)} aria-label={`Open ${project.name}`} />
                <div className="project-card-header">
                  <Badge variant={project.status}>{project.status}</Badge>
                  <span className="project-updated">Updated {formatDate(project.updatedAt)}</span>
                </div>

                <h3 className="project-title">{project.name}</h3>
                <p className="project-desc">{project.description || "No description provided."}</p>

                <div className="project-progress-block">
                  <div>
                    <span>Progress</span>
                    <strong>{progress}%</strong>
                  </div>
                  <div className="project-progress-track">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="project-meta-grid">
                  <div className="meta-item">
                    <span className="meta-label">Tasks</span>
                    <span className="meta-value">{tasks.length}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Due Date</span>
                    <span className="meta-value">{formatDate(project.dueDate)}</span>
                  </div>
                </div>

                <div className="project-card-footer">
                  <div className="avatar-stack">
                    {members.slice(0, 4).map((member) => (
                      <UserAvatar key={member.id} name={member.userName} size="sm" />
                    ))}
                    {members.length > 4 && <span className="avatar-overflow">+{members.length - 4}</span>}
                  </div>
                  <Button type="button" variant="secondary" onClick={() => navigate(`/projects/${project.id}`)}>
                    View
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
