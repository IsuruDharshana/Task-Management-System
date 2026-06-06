import React, { useState } from "react";
import { api, APIError } from "../services/api";
import type { User } from "../services/api";
import { useRouter } from "./Router";

interface CreateProjectProps {
  currentUser: User;
}

export default function CreateProject({ currentUser }: CreateProjectProps) {
  const { navigate } = useRouter();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "completed" | "archived">("active");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Role validation
  if (currentUser.role !== "project_manager") {
    return (
      <div className="unauthorized-container card">
        <span className="unauthorized-icon">!</span>
        <h2>Access Denied</h2>
        <p>Only Project Managers can create projects.</p>
        <button onClick={() => navigate("/projects")} className="btn btn-secondary" style={{ marginTop: "16px" }}>
          Back to Projects
        </button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Map input names to snake_case payload expected by the service
      const payload = {
        name,
        description: description.trim() || null,
        status,
        start_date: startDate || null,
        due_date: dueDate || null,
      };

      const result = await api.projects.create(payload);
      // Redirect to the created project details page
      navigate(`/projects/${result.project.id}`);
    } catch (err: any) {
      if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError("Failed to create project. Please verify inputs.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-project-page">
      <div className="form-container card">
        <div className="form-header">
          <button onClick={() => navigate("/projects")} className="btn-back">
            &larr; Back to list
          </button>
          <h1>Create New Project</h1>
          <p className="card-desc">Initialize a new project and configure its settings.</p>
        </div>

        <form onSubmit={handleSubmit} className="project-form">
          {error && (
            <div className="alert alert-danger">
              <span className="alert-icon">!</span>
              <span className="alert-message">{error}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="proj-name">Project Name <span className="required">*</span></label>
            <input
              id="proj-name"
              type="text"
              placeholder="E.g., Website Redesign Q3"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
              maxLength={150}
            />
          </div>

          <div className="form-group">
            <label htmlFor="proj-desc">Description</label>
            <textarea
              id="proj-desc"
              rows={4}
              placeholder="Outline the objectives and scope of this project..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="proj-status">Initial Status</label>
            <select
              id="proj-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              disabled={loading}
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="proj-start">Start Date</label>
              <input
                id="proj-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="proj-due">Due Date</label>
              <input
                id="proj-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate("/projects")}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner"></span> : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
