import React, { useCallback, useState, useEffect } from "react";
import { api, APIError } from "../services/api";
import type { Project, Member, User, EligibleMember, Task } from "../services/api";
import TaskManagementSection from "./TaskManagementSection";
import { useRouter } from "./Router";
import { useSocket } from "../context/SocketContext";
import { Badge, Button, LoadingState, UserAvatar } from "./ui";

interface ProjectDetailsProps {
  projectId: string;
  currentUser: User;
}

export default function ProjectDetails({ projectId, currentUser }: ProjectDetailsProps) {
  const { navigate } = useRouter();
  const { socket } = useSocket();

  // Project state
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [eligibleUsers, setEligibleUsers] = useState<EligibleMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit project state
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "completed" | "archived">("active");
  const [editStart, setEditStart] = useState("");
  const [editDue, setEditDue] = useState("");
  const [updatingProject, setUpdatingProject] = useState(false);
  const [projectUpdateError, setProjectUpdateError] = useState<string | null>(null);

  // Add member form state
  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState<"project_manager" | "collaborator">("collaborator");
  const [addLabel, setAddLabel] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);

  // Edit member row state
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editMemberRole, setEditMemberRole] = useState<"project_manager" | "collaborator">("collaborator");
  const [editMemberLabel, setEditMemberLabel] = useState("");
  const [savingMember, setSavingMember] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const projectData = await api.projects.get(projectId);
      const membersData = await api.members.list(projectId);
      const tasksData = await api.tasks.list(projectId, { sortBy: "due_date", sortOrder: "asc" });
      const loadedMembers = membersData.members || [];

      setProject(projectData.project);
      setMembers(loadedMembers);
      setTasks(tasksData.tasks || []);

      const loadedCurrentMember = loadedMembers.find((member) => member.userId === currentUser.id);
      if (loadedCurrentMember?.projectRole === "project_manager") {
        const eligibleData = await api.projects.listEligibleMembers(projectId);
        setEligibleUsers(eligibleData.users || []);
      } else {
        setEligibleUsers([]);
      }

      // Populate edit form initial values
      setEditName(projectData.project.name);
      setEditDesc(projectData.project.description || "");
      setEditStatus(projectData.project.status);
      setEditStart(projectData.project.startDate ? projectData.project.startDate.substring(0, 10) : "");
      setEditDue(projectData.project.dueDate ? projectData.project.dueDate.substring(0, 10) : "");
    } catch (err: any) {
      setError(err.message || "Failed to load project details.");
    } finally {
      setLoading(false);
    }
  }, [projectId, currentUser.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!socket) return;

    const handleProjectUpdated = (payload: { projectId?: string }) => {
      if (payload.projectId === projectId) {
        fetchData();
      }
    };

    socket.on("project:updated", handleProjectUpdated);

    return () => {
      socket.off("project:updated", handleProjectUpdated);
    };
  }, [socket, projectId, fetchData]);

  if (loading) {
    return <LoadingState label="Loading project details..." />;
  }

  if (error || !project) {
    return (
      <div className="error-state card">
        <h2>Error Loading Project</h2>
        <p className="error-msg">{error || "Project not found."}</p>
        <div className="error-actions">
          <button className="btn btn-secondary" onClick={() => navigate("/projects")}>
            Back to Projects
          </button>
          <button className="btn btn-primary" onClick={fetchData}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Find if current user is a project manager of this project
  const currentMember = members.find((m) => m.userId === currentUser.id);
  const isProjectPM =
    currentUser.role === "project_manager" &&
    (project.createdBy === currentUser.id || currentMember?.projectRole === "project_manager");
  const selectedEligibleUser = eligibleUsers.find((user) => user.id === addUserId);
  const selectedUserIsCollaborator = selectedEligibleUser?.role === "collaborator";
  const projectManager = members.find((member) => member.projectRole === "project_manager");
  const overviewStats = {
    total: tasks.length,
    todo: tasks.filter((task) => task.status === "to_do").length,
    inProgress: tasks.filter((task) => task.status === "in_progress").length,
    completed: tasks.filter((task) => task.status === "completed").length,
    overdue: tasks.filter((task) => task.status !== "completed" && task.dueDate && new Date(task.dueDate).getTime() < Date.now()).length,
  };
  const upcomingDeadlines = tasks
    .filter((task) => task.status !== "completed" && task.dueDate)
    .slice(0, 4);

  const refreshMemberManagement = async () => {
    const membersData = await api.members.list(projectId);
    const eligibleData = await api.projects.listEligibleMembers(projectId);

    setMembers(membersData.members || []);
    setEligibleUsers(eligibleData.users || []);
  };

  // Handlers for Project CRUD
  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setProjectUpdateError(null);
    setUpdatingProject(true);

    try {
      const result = await api.projects.update(projectId, {
        name: editName,
        description: editDesc.trim() || null,
        status: editStatus,
        start_date: editStart || null,
        due_date: editDue || null,
      });
      setProject(result.project);
      setIsEditingProject(false);
    } catch (err: any) {
      if (err instanceof APIError) {
        setProjectUpdateError(err.message);
      } else {
        setProjectUpdateError("Failed to update project settings.");
      }
    } finally {
      setUpdatingProject(false);
    }
  };

  const handleDeleteProject = async () => {
    const confirmDelete = window.confirm(
      "Are you sure you want to soft-delete this project? This will archive the project and restrict its usage."
    );
    if (!confirmDelete) return;

    const reason = window.prompt("Please enter a reason for deletion (optional):") || undefined;

    try {
      await api.projects.delete(projectId, reason);
      alert("Project deleted successfully.");
      navigate("/projects");
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  // Handlers for Member CRUD
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberActionError(null);

    if (!addUserId) {
      setMemberActionError("Please select a user to add.");
      return;
    }

    if (selectedUserIsCollaborator && addRole === "project_manager") {
      setMemberActionError("Global collaborators cannot be added as project managers.");
      return;
    }

    setAddingMember(true);

    try {
      await api.members.add(projectId, {
        user_id: addUserId,
        project_role: addRole,
        project_label: addLabel.trim() || null,
      });

      setAddUserId("");
      setAddLabel("");
      setAddRole("collaborator");

      // Refresh members and eligible users
      await refreshMemberManagement();
    } catch (err: any) {
      if (err instanceof APIError) {
        setMemberActionError(err.message);
      } else {
        setMemberActionError("Failed to add member.");
      }
    } finally {
      setAddingMember(false);
    }
  };

  const handleStartEditMember = (member: Member) => {
    setEditingMemberId(member.id);
    setEditMemberRole(member.projectRole);
    setEditMemberLabel(member.projectLabel || "");
  };

  const handleSaveMember = async (memberId: string) => {
    setMemberActionError(null);
    setSavingMember(true);

    try {
      await api.members.update(projectId, memberId, {
        project_role: editMemberRole,
        project_label: editMemberLabel.trim() || null,
      });

      setEditingMemberId(null);

      // Refresh members list
      const membersData = await api.members.list(projectId);
      setMembers(membersData.members || []);
    } catch (err: any) {
      if (err instanceof APIError) {
        setMemberActionError(err.message);
      } else {
        setMemberActionError("Failed to update member.");
      }
    } finally {
      setSavingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string, name: string) => {
    const confirmRemove = window.confirm(`Are you sure you want to remove ${name} from this project?`);
    if (!confirmRemove) return;

    setMemberActionError(null);

    try {
      await api.members.remove(projectId, memberId);

      // Refresh members list
      const membersData = await api.members.list(projectId);
      setMembers(membersData.members || []);
    } catch (err: any) {
      if (err instanceof APIError) {
        setMemberActionError(err.message);
      } else {
        setMemberActionError("Failed to remove member.");
      }
    }
  };

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
    <div className="project-details-page veyra-page">
      <div className="detail-navigation">
        <button onClick={() => navigate("/projects")} className="btn-back">
          &larr; Back to projects list
        </button>
      </div>

      <div className="project-hero card">
        <div>
          <div className="project-hero-eyebrow">
            <Badge variant={project.status}>{project.status}</Badge>
            <span>Updated {formatDate(project.updatedAt)}</span>
          </div>
          <h1>{project.name}</h1>
          <p>{project.description || "No description provided."}</p>
        </div>
        <div className="project-hero-actions">
          <div className="avatar-stack">
            {members.slice(0, 5).map((member) => (
              <UserAvatar key={member.id} name={member.userName} size="sm" />
            ))}
          </div>
          {isProjectPM && (
            <>
              <Button type="button" variant="secondary" onClick={() => setIsEditingProject(true)}>Edit Project</Button>
              <Button type="button" onClick={() => document.getElementById("task-management-heading")?.scrollIntoView({ behavior: "smooth" })}>Create Task</Button>
            </>
          )}
        </div>
      </div>

      <div className="project-overview-grid">
        {[
          ["Total tasks", overviewStats.total],
          ["To Do", overviewStats.todo],
          ["In Progress", overviewStats.inProgress],
          ["Completed", overviewStats.completed],
          ["Overdue", overviewStats.overdue],
        ].map(([label, value]) => (
          <article key={label} className="card modern-metric-card">
            <span className="dashboard-card-label">{label}</span>
            <strong className="dashboard-card-value">{value}</strong>
            <span className="dashboard-card-helper">Project task overview</span>
          </article>
        ))}
      </div>

      <div className="details-grid">
        {/* Left Column: Project Overview / Edit Forms */}
        <div className="details-main-col">
          {!isEditingProject ? (
            <div className="card project-info-card">
              <div className="project-card-header">
                <Badge variant={project.status}>{project.status}</Badge>
              </div>
              
              <h2>Overview</h2>
              <p className="project-desc">{project.description || "No description provided."}</p>

              <div className="project-dates-section">
                <div className="date-tile">
                  <span className="tile-label">Project Manager</span>
                  <span className="tile-value">{projectManager?.userName || "Not assigned"}</span>
                </div>
                <div className="date-tile">
                  <span className="tile-label">Start Date</span>
                  <span className="tile-value">{formatDate(project.startDate)}</span>
                </div>
                <div className="date-tile">
                  <span className="tile-label">Due Date</span>
                  <span className="tile-value">{formatDate(project.dueDate)}</span>
                </div>
              </div>

              {isProjectPM && (
                <div className="project-management-actions">
                  <Button type="button" variant="secondary" onClick={() => setIsEditingProject(true)}>Edit Settings</Button>
                  <Button type="button" variant="danger" onClick={handleDeleteProject}>Delete Project</Button>
                </div>
              )}
            </div>
          ) : (
            <div className="card edit-project-card">
              <h2>Edit Project Settings</h2>
              <p className="card-desc">Modify settings for {project.name}.</p>

              <form onSubmit={handleUpdateProject} className="project-form">
                {projectUpdateError && (
                  <div className="alert alert-danger">
                    <span className="alert-icon">!</span>
                    <span className="alert-message">{projectUpdateError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="edit-proj-name">Project Name <span className="required">*</span></label>
                  <input
                    id="edit-proj-name"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    disabled={updatingProject}
                    maxLength={150}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit-proj-desc">Description</label>
                  <textarea
                    id="edit-proj-desc"
                    rows={4}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    disabled={updatingProject}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit-proj-status">Status</label>
                  <select
                    id="edit-proj-status"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    disabled={updatingProject}
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="edit-proj-start">Start Date</label>
                    <input
                      id="edit-proj-start"
                      type="date"
                      value={editStart}
                      onChange={(e) => setEditStart(e.target.value)}
                      disabled={updatingProject}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-proj-due">Due Date</label>
                    <input
                      id="edit-proj-due"
                      type="date"
                      value={editDue}
                      onChange={(e) => setEditDue(e.target.value)}
                      disabled={updatingProject}
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    onClick={() => setIsEditingProject(false)}
                    className="btn btn-secondary"
                    disabled={updatingProject}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={updatingProject}>
                    {updatingProject ? <span className="spinner"></span> : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Right Column: Member Management */}
        <div className="details-side-col">
          <div className="card">
            <h2>Upcoming Deadlines</h2>
            <div className="dashboard-task-list compact">
              {upcomingDeadlines.length === 0 ? (
                <p className="muted-text">No upcoming deadlines.</p>
              ) : (
                upcomingDeadlines.map((task) => (
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
          </div>

          {/* Members list */}
          <div className="card members-card">
            <h2>Project Members ({members.length})</h2>
            <p className="card-desc">Users who have access to this project.</p>

            {memberActionError && (
              <div className="alert alert-danger">
                <span className="alert-icon">!</span>
                <span className="alert-message">{memberActionError}</span>
              </div>
            )}

            <div className="members-list">
              {members.map((member) => {
                const isEditingThis = editingMemberId === member.id;
                const isPMUser = member.projectRole === "project_manager";

                return (
                  <div key={member.id} className="member-item">
                    <UserAvatar name={member.userName} />

                    <div className="member-info">
                      <div className="member-name-row">
                        <span className="member-name">{member.userName}</span>
                        {member.userId === currentUser.id && (
                          <span className="badge badge-accent member-self-badge">You</span>
                        )}
                      </div>
                      <span className="member-email">{member.userEmail}</span>

                      {/* Display label and role */}
                      {!isEditingThis ? (
                        <div className="member-badges-row">
                          <Badge variant={member.projectRole}>{isPMUser ? "Project Manager" : "Collaborator"}</Badge>
                          {member.projectLabel && (
                            <span className="badge badge-label">{member.projectLabel}</span>
                          )}
                        </div>
                      ) : (
                        <div className="member-inline-edit-form">
                          <div className="form-group small">
                            <label>Role</label>
                            <select
                              value={editMemberRole}
                              onChange={(e) => setEditMemberRole(e.target.value as any)}
                              disabled={savingMember}
                            >
                              <option value="project_manager">Project Manager</option>
                              <option value="collaborator">Collaborator</option>
                            </select>
                          </div>
                          
                          <div className="form-group small">
                            <label>Label</label>
                            <input
                              type="text"
                              value={editMemberLabel}
                              placeholder="E.g., Frontend Lead"
                              onChange={(e) => setEditMemberLabel(e.target.value)}
                              disabled={savingMember}
                              maxLength={100}
                            />
                          </div>

                          <div className="inline-edit-actions">
                            <button
                              className="btn btn-secondary btn-xs"
                              onClick={() => setEditingMemberId(null)}
                              disabled={savingMember}
                            >
                              Cancel
                            </button>
                            <button
                              className="btn btn-primary btn-xs"
                              onClick={() => handleSaveMember(member.id)}
                              disabled={savingMember}
                            >
                              {savingMember ? "..." : "Save"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {isProjectPM && !isEditingThis && (
                      <div className="member-actions">
                        <button
                          className="btn-icon"
                          title="Edit Member"
                          onClick={() => handleStartEditMember(member)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-icon danger"
                          title="Remove Member"
                          onClick={() => handleRemoveMember(member.id, member.userName)}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add member form (visible to PM only) */}
          {isProjectPM && (
            <div className="card add-member-card">
              <h2>Add Project Member</h2>
              <p className="card-desc">Add an eligible registered user to this project.</p>

              <form onSubmit={handleAddMember} className="add-member-form">
                <div className="form-group">
                  <label htmlFor="add-user-id">User <span className="required">*</span></label>
                  <select
                    id="add-user-id"
                    value={addUserId}
                    onChange={(e) => {
                      const nextUserId = e.target.value;
                      const nextUser = eligibleUsers.find((user) => user.id === nextUserId);

                      setAddUserId(nextUserId);
                      if (nextUser?.role === "collaborator") {
                        setAddRole("collaborator");
                      }
                    }}
                    required
                    disabled={addingMember || eligibleUsers.length === 0}
                  >
                    <option value="">Select a user</option>
                    {eligibleUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} — {user.email} — {user.role}
                      </option>
                    ))}
                  </select>
                  {eligibleUsers.length === 0 && (
                    <p className="form-help">No eligible users available to add.</p>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="add-role">Project Role</label>
                  <select
                    id="add-role"
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value as any)}
                    disabled={addingMember}
                  >
                    <option value="collaborator">Collaborator</option>
                    <option value="project_manager" disabled={selectedUserIsCollaborator}>
                      Project Manager
                    </option>
                  </select>
                  {selectedUserIsCollaborator && (
                    <p className="form-help">Global collaborators can only be added as collaborators.</p>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="add-label">Project Label (Optional)</label>
                  <input
                    id="add-label"
                    type="text"
                    placeholder="e.g., Lead Developer"
                    value={addLabel}
                    onChange={(e) => setAddLabel(e.target.value)}
                    disabled={addingMember}
                    maxLength={100}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-block"
                  disabled={addingMember || eligibleUsers.length === 0}
                >
                  {addingMember ? <span className="spinner"></span> : "Add Member"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {currentUser.role !== "admin" && (
        <div id="task-management-heading" />
      )}

      {currentUser.role !== "admin" && (
        <TaskManagementSection
          projectId={projectId}
          currentUser={currentUser}
          members={members}
          isProjectPM={isProjectPM}
        />
      )}
    </div>
  );
}
