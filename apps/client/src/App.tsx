import { useState, useEffect } from "react";
import { api, APIError } from "./services/api";
import type { User } from "./services/api";
import { RouterProvider, useRouter, useRouteMatch } from "./components/Router";
import Login from "./components/Login";
import ProjectsList from "./components/ProjectsList";
import CreateProject from "./components/CreateProject";
import ProjectDetails from "./components/ProjectDetails";
import AdminPanel from "./components/AdminPanel";
import "./App.css";

function AppContent() {
  const { path, navigate } = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  // Password reset state (if user needs password reset)
  const [showResetForm, setShowResetForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  // Check auth status on load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const data = await api.auth.me();
        setCurrentUser(data.user);
      } catch (err) {
        // Not authenticated
        setCurrentUser(null);
      } finally {
        setLoading(false);
        setAuthChecked(true);
      }
    };
    checkAuth();
  }, []);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await api.auth.logout();
      setCurrentUser(null);
      navigate("/");
    } catch (err) {
      // Force user out anyway
      setCurrentUser(null);
      navigate("/");
    }
  };

  // Handle password reset submission
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccess(null);

    if (newPassword !== confirmPassword) {
      setResetError("New passwords do not match.");
      return;
    }

    setResetting(true);
    try {
      const result = await api.auth.resetPassword(currentPassword, newPassword);
      setResetSuccess("Password reset successfully! You can now close this panel.");
      
      // Update local state since password reset returns updated user
      setCurrentUser({
        ...result.user,
        mustResetPassword: false,
      });
      
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      if (err instanceof APIError) {
        setResetError(err.message);
      } else {
        setResetError("Failed to reset password. Please verify current password.");
      }
    } finally {
      setResetting(false);
    }
  };

  // Route matches
  const matchProjects = useRouteMatch("/projects");
  const matchCreateProject = useRouteMatch("/projects/new");
  const matchProjectDetails = useRouteMatch("/projects/:projectId");
  const matchAdmin = useRouteMatch("/admin");

  // Redirect to correct dashboard based on role on default root path '/'
  useEffect(() => {
    if (authChecked && currentUser && path === "/") {
      if (currentUser.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/projects");
      }
    }
  }, [authChecked, currentUser, path]);

  if (loading) {
    return (
      <div className="app-loader">
        <div className="spinner big"></div>
        <p>Loading Veyra Workspace...</p>
      </div>
    );
  }

  // Not authenticated? Show login screen
  if (!currentUser) {
    return <Login onLoginSuccess={setCurrentUser} />;
  }

  // Render main routing switch
  const renderRoute = () => {
    if (path === "/" || path === "") {
      // Default placeholder loading/redirect page
      return (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Redirecting to your workspace...</p>
        </div>
      );
    }

    if (matchProjects.matches) {
      return <ProjectsList currentUser={currentUser} />;
    }

    if (matchCreateProject.matches) {
      return <CreateProject currentUser={currentUser} />;
    }

    if (matchProjectDetails.matches) {
      const { projectId } = matchProjectDetails.params;
      return <ProjectDetails projectId={projectId} currentUser={currentUser} />;
    }

    if (matchAdmin.matches) {
      if (currentUser.role !== "admin") {
        return (
          <div className="unauthorized-container card">
            <span className="unauthorized-icon">!</span>
            <h2>Access Denied</h2>
            <p>You do not have administrative privileges to access this page.</p>
          </div>
        );
      }
      return <AdminPanel />;
    }

    // fallback 404
    return (
      <div className="not-found-container card">
        <span className="not-found-icon">?</span>
        <h2>Page Not Found</h2>
        <p>The page you are looking for does not exist or has been moved.</p>
        <button onClick={() => navigate("/")} className="btn btn-primary" style={{ marginTop: "16px" }}>
          Go to Dashboard
        </button>
      </div>
    );
  };

  const isUserAdmin = currentUser.role === "admin";

  return (
    <div className="app-shell">
      {/* Top Navbar */}
      <header className="app-navbar">
        <div className="nav-brand" onClick={() => navigate("/")}>
          <span className="logo-icon">V</span>
          <span className="logo-text">VEYRA</span>
        </div>

        <nav className="nav-links">
          {!isUserAdmin && (
            <button
              onClick={() => navigate("/projects")}
              className={`nav-item ${path.startsWith("/projects") ? "active" : ""}`}
            >
              Projects
            </button>
          )}
          {isUserAdmin && (
            <button
              onClick={() => navigate("/admin")}
              className={`nav-item ${path === "/admin" ? "active" : ""}`}
            >
              Admin Workspace
            </button>
          )}
        </nav>

        <div className="nav-profile">
          <div className="profile-details">
            <span className="profile-name">{currentUser.name}</span>
            <span className="profile-role badge">{currentUser.role}</span>
          </div>
          <button onClick={handleLogout} className="btn btn-secondary btn-sm">
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="app-main-content">
        {/* Force password reset notification banner */}
        {currentUser.mustResetPassword && (
          <div className="password-reset-banner">
            <div className="banner-content">
              <span className="banner-icon">*</span>
              <div>
                <strong>Security Alert:</strong> You are currently using a temporary password. For safety, please update it.
              </div>
              <button 
                onClick={() => setShowResetForm(!showResetForm)} 
                className="btn btn-primary btn-sm banner-action-btn"
              >
                {showResetForm ? "Hide Form" : "Change Password Now"}
              </button>
            </div>

            {showResetForm && (
              <form onSubmit={handleResetPasswordSubmit} className="banner-reset-form card">
                <h3>Update Password</h3>
                {resetError && <div className="alert alert-danger">{resetError}</div>}
                {resetSuccess && <div className="alert alert-success">{resetSuccess}</div>}

                <div className="form-group">
                  <label htmlFor="curr-pwd">Current Password</label>
                  <input
                    id="curr-pwd"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    disabled={resetting}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="new-pwd">New Password</label>
                    <input
                      id="new-pwd"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      disabled={resetting}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="conf-pwd">Confirm New Password</label>
                    <input
                      id="conf-pwd"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={resetting}
                    />
                  </div>
                </div>

                <div className="inline-edit-actions">
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowResetForm(false)}
                    disabled={resetting}
                  >
                    Close
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary btn-sm"
                    disabled={resetting}
                  >
                    {resetting ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {renderRoute()}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>&copy; {new Date().getFullYear()} Veyra Task Management System. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <AppContent />
    </RouterProvider>
  );
}
