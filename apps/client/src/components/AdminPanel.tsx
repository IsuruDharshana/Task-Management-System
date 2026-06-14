import React, { useEffect, useMemo, useState } from "react";
import { api, APIError } from "../services/api";
import type { AdminUser } from "../services/api";
import { Badge, Button, ConfirmDialog, EmptyState, Input, LoadingState, Select, UserAvatar } from "./ui";

type EditableRole = "project_manager" | "collaborator";
type RoleFilter = "all" | "admin" | "project_manager" | "collaborator";
type StatusFilter = "all" | "active" | "inactive";
type PasswordFilter = "all" | "required" | "not_required";
type ConfirmAction =
  | { type: "deactivate"; user: AdminUser }
  | { type: "reactivate"; user: AdminUser }
  | { type: "reset-password"; user: AdminUser };

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof APIError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

function formatDate(value?: string | null): string {
  if (!value) return "Not available";
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value?: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [passwordFilter, setPasswordFilter] = useState<PasswordFilter>("all");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<EditableRole>("project_manager");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createdUserPayload, setCreatedUserPayload] = useState<{ user: AdminUser } | null>(null);

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<EditableRole>("project_manager");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmingAction, setConfirmingAction] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.admin.listUsers();
      setUsers(data.users || []);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load users list."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch = !query || user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query);
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? user.isActive : !user.isActive);
      const matchesPassword =
        passwordFilter === "all" ||
        (passwordFilter === "required" ? user.mustResetPassword : !user.mustResetPassword);
      return matchesSearch && matchesRole && matchesStatus && matchesPassword;
    });
  }, [passwordFilter, roleFilter, search, statusFilter, users]);

  const metrics = useMemo(() => {
    const totalUsers = users.length;
    const activeUsers = users.filter((user) => user.isActive).length;
    const inactiveUsers = users.filter((user) => !user.isActive).length;
    const pendingPasswordResets = users.filter((user) => user.mustResetPassword).length;
    const roleDistribution = {
      admin: users.filter((user) => user.role === "admin").length,
      project_manager: users.filter((user) => user.role === "project_manager").length,
      collaborator: users.filter((user) => user.role === "collaborator").length,
    };

    return { totalUsers, activeUsers, inactiveUsers, pendingPasswordResets, roleDistribution };
  }, [users]);

  const usersRequiringAttention = users.filter((user) => !user.isActive || user.mustResetPassword).slice(0, 5);
  const recentUserActivity = [...users]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())
    .slice(0, 5);

  const updateUserInList = (updatedUser: AdminUser) => {
    setUsers((currentUsers) => currentUsers.map((user) => (user.id === updatedUser.id ? updatedUser : user)));
  };

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError(null);
    setCreatedUserPayload(null);
    setActionMessage(null);
    setActionError(null);
    setCreating(true);

    try {
      const result = await api.admin.createUser({ name: name.trim(), email: email.trim(), role });
      setCreatedUserPayload(result);
      setName("");
      setEmail("");
      setRole("project_manager");
      setShowCreateForm(false);
      await fetchUsers();
    } catch (err) {
      setCreateError(getErrorMessage(err, "Failed to create user."));
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

  const handleSaveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingUser) return;

    setEditError(null);
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
    } catch (err) {
      setEditError(getErrorMessage(err, "Failed to update user."));
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
    } catch (err) {
      setActionError(getErrorMessage(err, "Action failed. Please try again."));
    } finally {
      setConfirmingAction(false);
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
    <div className="admin-panel veyra-page">
      <div className="modern-page-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p className="subtitle">Monitor user access and account attention across Veyra.</p>
        </div>
        <div className="header-actions">
          <Button type="button" variant="secondary" onClick={fetchUsers} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
          <Button type="button" onClick={() => setShowCreateForm((current) => !current)}>
            Create New User
          </Button>
        </div>
      </div>

      <div className="admin-dashboard-grid">
        {[
          ["Total Users", metrics.totalUsers],
          ["Active Users", metrics.activeUsers],
          ["Inactive Users", metrics.inactiveUsers],
          ["Pending Password Resets", metrics.pendingPasswordResets],
        ].map(([label, value]) => (
          <article key={label} className="card modern-metric-card">
            <span className="dashboard-card-label">{label}</span>
            <strong className="dashboard-card-value">{value}</strong>
            <span className="dashboard-card-helper">Derived from registered users</span>
          </article>
        ))}
      </div>

      <div className="admin-insight-grid">
        <section className="card">
          <h2>Recent User Activity</h2>
          <div className="activity-mini-list">
            {recentUserActivity.length === 0 ? (
              <p className="muted-text">No user activity available.</p>
            ) : (
              recentUserActivity.map((user) => (
                <article key={user.id}>
                  <UserAvatar name={user.name} size="sm" />
                  <div>
                    <strong>{user.name}</strong>
                    <span>Updated {formatDateTime(user.updatedAt || user.createdAt)}</span>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="card">
          <h2>Users Requiring Attention</h2>
          <div className="attention-list">
            {usersRequiringAttention.length === 0 ? (
              <p className="muted-text">No users currently require attention.</p>
            ) : (
              usersRequiringAttention.map((user) => (
                <article key={user.id}>
                  <div>
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                  </div>
                  <div className="attention-badges">
                    {!user.isActive && <Badge variant="inactive">Inactive</Badge>}
                    {user.mustResetPassword && <Badge variant="overdue">Reset required</Badge>}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="card">
          <h2>Role Distribution</h2>
          <div className="role-distribution">
            {Object.entries(metrics.roleDistribution).map(([roleName, count]) => (
              <div key={roleName}>
                <span>{roleName.replace("_", " ")}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      {showCreateForm && (
        <section className="card admin-create-panel">
          <div className="section-heading-row">
            <div>
              <h2>Create New User</h2>
              <p className="card-desc">Add a project manager or collaborator. Temporary credentials are sent through the configured email channel.</p>
            </div>
          </div>
          <form onSubmit={handleCreateUser} className="admin-create-form">
            {createError && <div className="alert alert-danger">{createError}</div>}
            <Input id="user-name" label="Full Name" value={name} onChange={(event) => setName(event.target.value)} required disabled={creating} />
            <Input id="user-email" type="email" label="Email Address" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={creating} />
            <Select id="user-role" label="System Role" value={role} onChange={(event) => setRole(event.target.value as EditableRole)} disabled={creating}>
              <option value="project_manager">Project Manager</option>
              <option value="collaborator">Collaborator</option>
            </Select>
            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={() => setShowCreateForm(false)} disabled={creating}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create User"}
              </Button>
            </div>
          </form>
        </section>
      )}

      {createdUserPayload && (
        <div className="alert alert-success">
          User created successfully for {createdUserPayload.user.email}. Onboarding details were sent through the configured email channel.
          <Button type="button" variant="ghost" onClick={() => setCreatedUserPayload(null)}>Dismiss</Button>
        </div>
      )}

      <section className="card admin-users-card">
        <div className="section-heading-row">
          <div>
            <h1>User Management</h1>
            <p className="subtitle">Create, update, activate, deactivate, and manage user access.</p>
          </div>
        </div>

        {actionError && <div className="alert alert-danger">{actionError}</div>}
        {actionMessage && <div className="alert alert-success">{actionMessage}</div>}

        <div className="admin-user-toolbar">
          <Input id="admin-user-search" type="search" label="Search users" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or email" />
          <Select id="admin-role-filter" label="Role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}>
            <option value="all">All roles</option>
            <option value="admin">Admin</option>
            <option value="project_manager">Project Manager</option>
            <option value="collaborator">Collaborator</option>
          </Select>
          <Select id="admin-status-filter" label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
          <Select id="admin-password-filter" label="Password State" value={passwordFilter} onChange={(event) => setPasswordFilter(event.target.value as PasswordFilter)}>
            <option value="all">All states</option>
            <option value="required">Reset required</option>
            <option value="not_required">Current</option>
          </Select>
        </div>

        {loading ? (
          <LoadingState label="Loading users..." />
        ) : error ? (
          <div className="error-state">
            <p className="error-msg">{error}</p>
            <Button type="button" variant="secondary" onClick={fetchUsers}>Retry</Button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <EmptyState title="No users found" description="Adjust filters or create a new user." />
        ) : (
          <div className="table-responsive">
            <table className="users-table modern-users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Password State</th>
                  <th>Last Login</th>
                  <th>Created Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="user-cell">
                        <UserAvatar name={user.name} />
                        <div>
                          <strong>{user.name}</strong>
                          <span>{user.id.slice(0, 8)}</span>
                        </div>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td><Badge variant={user.role}>{user.role.replace("_", " ")}</Badge></td>
                    <td><Badge variant={user.isActive ? "active" : "inactive"}>{user.isActive ? "Active" : "Inactive"}</Badge></td>
                    <td><Badge variant={user.mustResetPassword ? "overdue" : "completed"}>{user.mustResetPassword ? "Reset required" : "Current"}</Badge></td>
                    <td>{formatDateTime(user.lastLoginAt)}</td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td>
                      <div className="admin-row-actions">
                        <Button type="button" variant="secondary" className="btn-xs" onClick={() => handleStartEdit(user)} disabled={user.role === "admin"}>
                          Edit
                        </Button>
                        <Button type="button" variant="secondary" className="btn-xs" onClick={() => setConfirmAction({ type: "reset-password", user })}>
                          Reset
                        </Button>
                        <Button
                          type="button"
                          variant={user.isActive ? "danger" : "secondary"}
                          className="btn-xs"
                          onClick={() => setConfirmAction({ type: user.isActive ? "deactivate" : "reactivate", user })}
                        >
                          {user.isActive ? "Deactivate" : "Reactivate"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editingUser && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="edit-user-title">
            <h2 id="edit-user-title">Edit User</h2>
            <p className="card-desc">Update account details for {editingUser.name}.</p>

            <form onSubmit={handleSaveEdit}>
              {editError && <div className="alert alert-danger">{editError}</div>}
              <Input id="edit-user-name" label="Full Name" value={editName} onChange={(event) => setEditName(event.target.value)} required disabled={savingEdit} />
              <Input id="edit-user-email" type="email" label="Email Address" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} required disabled={savingEdit} />
              <Select id="edit-user-role" label="System Role" value={editRole} onChange={(event) => setEditRole(event.target.value as EditableRole)} disabled={savingEdit}>
                <option value="project_manager">Project Manager</option>
                <option value="collaborator">Collaborator</option>
              </Select>
              <div className="form-actions">
                <Button type="button" variant="secondary" onClick={() => setEditingUser(null)} disabled={savingEdit}>Cancel</Button>
                <Button type="submit" disabled={savingEdit}>{savingEdit ? "Saving..." : "Save Changes"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={getConfirmTitle()}
        description={getConfirmMessage()}
        confirmLabel={
          confirmAction?.type === "deactivate"
            ? "Deactivate"
            : confirmAction?.type === "reactivate"
              ? "Reactivate"
              : "Reset Password"
        }
        variant={confirmAction?.type === "deactivate" ? "danger" : "default"}
        isLoading={confirmingAction}
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}
