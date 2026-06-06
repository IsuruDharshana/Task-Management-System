import React, { useState, useEffect } from "react";
import { api, APIError } from "../services/api";

export default function AdminPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"project_manager" | "collaborator">("project_manager");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  
  // Successful creation payload
  const [createdUserPayload, setCreatedUserPayload] = useState<{ user: any; temporaryPassword: string } | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
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
              <p>Please share these credentials with the user for logging in:</p>
              
              <div className="credential-row">
                <strong>Email:</strong> <code>{createdUserPayload.user.email}</code>
              </div>
              <div className="credential-row">
                <strong>Role:</strong> <span className="badge badge-accent">{createdUserPayload.user.role}</span>
              </div>
              <div className="credential-row">
                <strong>Temporary Password:</strong> <code className="temp-pw">{createdUserPayload.temporaryPassword}</code>
              </div>
              
              <div className="alert alert-warning password-warning">
                Warning: Make sure to copy this password now. It will not be shown again.
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
          <p className="card-desc">Users in the system. Use their UUIDs to add them as project members.</p>

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
                    <th>User ID (UUID)</th>
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
                        <div className="uuid-container">
                          <code className="uuid-text">{u.id}</code>
                          <button
                            className="btn-icon-copy"
                            title="Copy UUID"
                            onClick={() => {
                              navigator.clipboard.writeText(u.id);
                              alert("UUID copied to clipboard!");
                            }}
                          >
                            Copy
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
    </div>
  );
}
