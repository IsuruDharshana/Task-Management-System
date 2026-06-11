import { useState, useEffect } from "react";
import { api } from "./services/api";
import type { User } from "./services/api";
import { RouterProvider, useRouter, useRouteMatch } from "./components/Router";
import Login from "./components/Login";
import ProjectsList from "./components/ProjectsList";
import CreateProject from "./components/CreateProject";
import ProjectDetails from "./components/ProjectDetails";
import AdminPanel from "./components/AdminPanel";
import ActivityLogSection from "./components/ActivityLogSection";
import FirstLoginPasswordResetPage from "./components/FirstLoginPasswordResetPage";
import SettingsPage from "./components/SettingsPage";
import "./App.css";

function getHomePath(user: User): string {
  if (user.role === "admin") return "/admin";
  return "/projects";
}

function AppContent() {
  const { path, navigate } = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

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

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    navigate(user.mustResetPassword ? "/first-login-password-reset" : getHomePath(user));
  };

  const handlePasswordChanged = (user: User) => {
    const updatedUser = { ...user, mustResetPassword: false };
    setCurrentUser(updatedUser);
    navigate(getHomePath(updatedUser));
  };

  // Route matches
  const matchProjects = useRouteMatch("/projects");
  const matchCreateProject = useRouteMatch("/projects/new");
  const matchProjectDetails = useRouteMatch("/projects/:projectId");
  const matchAdmin = useRouteMatch("/admin");
  const matchActivityLog = useRouteMatch("/activity-log");
  const matchSettings = useRouteMatch("/settings");

  // Redirect to correct dashboard based on role on default root path '/'
  useEffect(() => {
    if (authChecked && currentUser && path === "/") {
      navigate(currentUser.mustResetPassword ? "/first-login-password-reset" : getHomePath(currentUser));
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
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  if (currentUser.mustResetPassword) {
    return (
      <FirstLoginPasswordResetPage
        currentUser={currentUser}
        onPasswordChanged={handlePasswordChanged}
        onLogout={handleLogout}
      />
    );
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

    if (matchActivityLog.matches) {
      return <ActivityLogSection currentUser={currentUser} />;
    }

    if (matchSettings.matches) {
      return <SettingsPage currentUser={currentUser} onUserUpdated={setCurrentUser} />;
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
          <button
            onClick={() => navigate("/activity-log")}
            className={`nav-item ${path === "/activity-log" ? "active" : ""}`}
          >
            {isUserAdmin ? "Audit Log" : "Activity Log"}
          </button>
          <button
            onClick={() => navigate("/settings")}
            className={`nav-item ${path === "/settings" ? "active" : ""}`}
          >
            Settings
          </button>
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
