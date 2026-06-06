import React, { useState, useEffect } from "react";
import { api, APIError } from "../services/api";
import type { AdminUser } from "../services/api";

type EditableRole = "project_manager" | "collaborator";
type ConfirmAction =
  | { type: "deactivate"; user: AdminUser }
  | { type: "reactivate"; user: AdminUser }
  | { type: "reset-password"; user: AdminUser };

export default function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<EditableRole>("project_manager");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  
  // Successful creation payload
  const [createdUserPayload, setCreatedUserPayload] = useState<{ user: AdminUser } | null>(null);

  // Edit/action modal state
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<EditableRole>("project_manager");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmingAction, setConfirmingAction] = useState(false);

  const updateUserInList = (updatedUser: AdminUser) => {
    setUsers((currentUsers) =>
      currentUsers.map((user) => (user.id === updatedUser.id ? updatedUser : user))
    );
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.admin.listUsers();
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || "Failed to load users list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreatedUserPayload(null);
    setActionMessage(null);
    setActionError(null);
    setCreating(true);

    try {
      const result = await api.admin.createUser({ name, email, role });
      setCreatedUserPayload(result);
      setName("");
      setEmail("");
      setRole("project_manager");
      fetchUsers(); // Refresh user list
    } catch (err: any) {
      if (err instanceof APIError) {
        setCreateError(err.message);
      } else {
        setCreateError("Failed to create user.");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleStartEdit = (user: AdminUser) => {
    if (user.role === "admin") {
      setActionError("Admin role users cannot be edited from this form.");
      return;
    }

    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditError(null);
    setActionMessage(null);
    setActionError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setEditError(null);

    if (!editName.trim()) {
      setEditError("Name is required.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim())) {
      setEditError("Enter a valid email address.");
      return;
    }

    setSavingEdit(true);
    try {
      const result = await api.admin.updateUser(editingUser.id, {
        name: editName.trim(),
        email: editEmail.trim(),
        role: editRole,
      });

      updateUserInList(result.user);
      setEditingUser(null);
      setActionMessage("User updated successfully.");
    } catch (err: any) {
      if (err instanceof APIError) {
        setEditError(err.message);
      } else {
        setEditError("Failed to update user.");
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;

    setConfirmingAction(true);
    setActionMessage(null);
    setActionError(null);

    try {
      if (confirmAction.type === "deactivate") {
        const result = await api.admin.deactivateUser(confirmAction.user.id);
        updateUserInList(result.user);
        setActionMessage("User deactivated successfully.");
      }

      if (confirmAction.type === "reactivate") {
        const result = await api.admin.reactivateUser(confirmAction.user.id);
        updateUserInList(result.user);
        setActionMessage("User reactivated successfully.");
      }

      if (confirmAction.type === "reset-password") {
        const result = await api.admin.resetUserPassword(confirmAction.user.id);
        updateUserInList(result.user);
        setActionMessage("Password reset successfully. Reset instructions were sent through the configured email channel.");
      }

      setConfirmAction(null);
    } catch (err: any) {
      if (err instanceof APIError) {
        setActionError(err.message);
      } else {
        setActionError("Action failed. Please try again.");
      }
    } finally {
      setConfirmingAction(false);
    }
  };

  const formatDate = (dateValue?: string | null) => {
    if (!dateValue) return "Not available";

    try {
      return new Date(dateValue).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (err) {
      return dateValue;
    }
  };

  const getConfirmTitle = () => {
    if (!confirmAction) return "";
    if (confirmAction.type === "deactivate") return "Deactivate User";
    if (confirmAction.type === "reactivate") return "Reactivate User";
    return "Reset User Password";
  };

  const getConfirmMessage = () => {
    if (!confirmAction) return "";
    if (confirmAction.type === "deactivate") {
      return `${confirmAction.user.name} will no longer be able to log in. Existing sessions will also become invalid.`;
    }
    if (confirmAction.type === "reactivate") {
      return `${confirmAction.user.name} will be able to log in again with their current password.`;
    }
    return `This will generate a new temporary password for ${confirmAction.user.name}. They must change it on next login.`;
  };

  return (
    <div className="admin-panel">
      <div className="admin-header-section">
        <h1>Admin Control Workspace</h1>
        <p className="subtitle">
          Manage system users and create roles for Project Management testing.
        </p>
      </div>

      <div className="admin-grid">
        {/* Left Column: Create User Form */}
        <div className="card admin-form-card">
          <h2>Create New User</h2>
          <p className="card-desc">
            Add a new user with either a Project Manager or Collaborator role.
          </p>

          <form onSubmit={handleCreateUser} className="admin-form">
            {createError && (
              <div className="alert alert-danger">
                <span className="alert-icon">!</span>
                <span className="alert-message">{createError}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="user-name">Full Name</label>
              <input
                id="user-name"
                type="text"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={creating}
              />
            </div>

            <div className="form-group">
              <label htmlFor="user-email">Email Address</label>
              <input
                id="user-email"
                type="email"
                placeholder="jane@veyra.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={creating}
              />
            </div>

            <div className="form-group">
              <label htmlFor="user-role">System Role</label>
              <select
                id="user-role"
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                required
                disabled={creating}
              >
                <option value="project_manager">Project Manager (Can create projects)</option>
                <option value="collaborator">Collaborator (Can view assigned projects)</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={creating}>
              {creating ? <span className="spinner"></span> : "Create User"}
            </button>
          </form>

          {createdUserPayload && (
            <div className="alert alert-success created-credentials-box">
              <h3>User Created Successfully!</h3>
              <p>User created successfully. Onboarding details were sent through the configured email channel.</p>
              
              <div className="credential-row">
                <strong>Email:</strong> <code>{createdUserPayload.user.email}</code>
              </div>
              <div className="credential-row">
                <strong>Role:</strong> <span className="badge badge-accent">{createdUserPayload.user.role}</span>
              </div>
              
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => setCreatedUserPayload(null)}
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Users List */}
        <div className="card admin-list-card">
          <h2>Registered Users</h2>
          <p className="card-desc">Users in the system and their current account status.</p>

          {actionError && (
            <div className="alert alert-danger">
              <span className="alert-icon">!</span>
              <span className="alert-message">{actionError}</span>
            </div>
          )}
          {actionMessage && (
            <div className="alert alert-success">
              <span className="alert-icon">!</span>
              <span className="alert-message">{actionMessage}</span>
            </div>
          )}

          {loading ? (
            <div className="loading-state">
              <div className="spinner big"></div>
              <p>Loading users...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <p className="error-msg">{error}</p>
              <button className="btn btn-secondary" onClick={fetchUsers}>
                Retry
              </button>
            </div>
          ) : users.length === 0 ? (
            <div className="empty-state">
              <p>No registered users found.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Password Reset</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="font-semibold">{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`badge ${u.role === "admin" ? "badge-danger" : u.role === "project_manager" ? "badge-primary" : "badge-secondary"}`}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <span className={`status-dot ${u.isActive ? "active" : "inactive"}`}></span>
                        {u.isActive ? "Active" : "Inactive"}
                      </td>
                      <td>
                        <span className={`badge ${u.mustResetPassword ? "badge-danger" : "badge-secondary"}`}>
                          {u.mustResetPassword ? "Required" : "Not required"}
                        </span>
                      </td>
                      <td>{formatDate(u.createdAt)}</td>
                      <td>
                        <div className="admin-row-actions">
                          <button
                            className="btn btn-secondary btn-xs"
                            onClick={() => handleStartEdit(u)}
                            disabled={u.role === "admin"}
                            title={u.role === "admin" ? "Admin users cannot be edited here" : "Edit user"}
                          >
                            Edit
                          </button>
                          <button
                            className={`btn btn-xs ${u.isActive ? "btn-danger" : "btn-secondary"}`}
                            onClick={() => setConfirmAction({ type: u.isActive ? "deactivate" : "reactivate", user: u })}
                          >
                            {u.isActive ? "Deactivate" : "Reactivate"}
                          </button>
                          <button
                            className="btn btn-secondary btn-xs"
                            onClick={() => setConfirmAction({ type: "reset-password", user: u })}
                          >
                            Reset Password
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editingUser && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="edit-user-title">
            <h2 id="edit-user-title">Edit User</h2>
            <p className="card-desc">Update account details for {editingUser.name}.</p>

            <form onSubmit={handleSaveEdit}>
              {editError && (
                <div className="alert alert-danger">
                  <span className="alert-icon">!</span>
                  <span className="alert-message">{editError}</span>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="edit-user-name">Full Name</label>
                <input
                  id="edit-user-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  disabled={savingEdit}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-user-email">Email Address</label>
                <input
                  id="edit-user-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                  disabled={savingEdit}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-user-role">System Role</label>
                <select
                  id="edit-user-role"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as EditableRole)}
                  required
                  disabled={savingEdit}
                >
                  <option value="project_manager">Project Manager</option>
                  <option value="collaborator">Collaborator</option>
                </select>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingUser(null)}
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card modal-card-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-action-title">
            <h2 id="confirm-action-title">{getConfirmTitle()}</h2>
            <p className="card-desc">{getConfirmMessage()}</p>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmAction(null)}
                disabled={confirmingAction}
              >
                Cancel
              </button>
              <button
                type="button"
                className={confirmAction.type === "deactivate" ? "btn btn-danger" : "btn btn-primary"}
                onClick={handleConfirmAction}
                disabled={confirmingAction}
              >
                {confirmingAction ? "Working..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
