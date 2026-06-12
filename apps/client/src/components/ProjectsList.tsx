import { useCallback, useState, useEffect } from "react";
import { api } from "../services/api";
import type { Project, User } from "../services/api";
import { useRouter } from "./Router";
import { useSocket } from "../context/SocketContext";

interface ProjectsListProps {
  currentUser: User;
}

export default function ProjectsList({ currentUser }: ProjectsListProps) {
  const { navigate } = useRouter();
  const { socket } = useSocket();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.projects.list();
      setProjects(data.projects || []);
    } catch (err: any) {
      setError(err.message || "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser.role === "admin") {
      return;
    }
    fetchProjects();
  }, [currentUser, fetchProjects]);

  useEffect(() => {
    if (!socket || currentUser.role === "admin") return;

    const handleProjectUpdated = () => {
      fetchProjects();
    };

    socket.on("project:updated", handleProjectUpdated);

    return () => {
      socket.off("project:updated", handleProjectUpdated);
    };
  }, [socket, currentUser.role, fetchProjects]);

  if (currentUser.role === "admin") {
    return (
      <div className="unauthorized-container card">
        <span className="unauthorized-icon">!</span>
        <h2>Access Denied</h2>
        <p>Admin users cannot access project management features. Please log in with a Project Manager or Collaborator account.</p>
      </div>
    );
  }

  const isGlobalPM = currentUser.role === "project_manager";

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Not set";
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="projects-list-page">
      <div className="projects-header">
        <div>
          <h1>Projects Workspace</h1>
          <p className="subtitle">View and manage your assigned projects.</p>
        </div>

        {isGlobalPM && (
          <button onClick={() => navigate("/projects/new")} className="btn btn-primary">
            + Create Project
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner big"></div>
          <p>Loading projects...</p>
        </div>
      ) : error ? (
        <div className="error-state card">
          <p className="error-msg">{error}</p>
          <button className="btn btn-secondary" onClick={fetchProjects}>
            Retry
          </button>
        </div>
      ) : projects.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">Projects</div>
          <h2>No Projects Found</h2>
          <p>You are not currently assigned to any active projects.</p>
          {isGlobalPM && (
            <button onClick={() => navigate("/projects/new")} className="btn btn-primary" style={{ marginTop: "16px" }}>
              Create Your First Project
            </button>
          )}
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((project) => (
            <div key={project.id} className="card project-card" onClick={() => navigate(`/projects/${project.id}`)}>
              <div className="project-card-header">
                <span className={`status-badge status-${project.status}`}>
                  {project.status}
                </span>
              </div>
              
              <h3 className="project-title">{project.name}</h3>
              <p className="project-desc">{project.description || "No description provided."}</p>
              
              <div className="project-meta-grid">
                <div className="meta-item">
                  <span className="meta-label">Start Date</span>
                  <span className="meta-value">{formatDate(project.startDate)}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Due Date</span>
                  <span className="meta-value">{formatDate(project.dueDate)}</span>
                </div>
              </div>

              <div className="project-card-footer">
                <span className="link-text">View details &rarr;</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
