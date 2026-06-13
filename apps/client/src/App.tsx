import { useState, useEffect } from "react";
import { api } from "./services/api";
import type { User } from "./services/api";
import { RouterProvider, useRouter, useRouteMatch } from "./components/Router";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import ProjectsList from "./components/ProjectsList";
import CreateProject from "./components/CreateProject";
import ProjectDetails from "./components/ProjectDetails";
import AdminPanel from "./components/AdminPanel";
import ActivityLogSection from "./components/ActivityLogSection";
import FirstLoginPasswordResetPage from "./components/FirstLoginPasswordResetPage";
import SettingsPage from "./components/SettingsPage";
import { SocketProvider } from "./context/SocketContext";
import { NotificationProvider } from "./context/NotificationContext";
import { AppLayout, LoadingState } from "./components/ui";
import "./App.css";

function getHomePath(user: User): string {
  if (user.role === "admin") return "/admin";
  return "/dashboard";
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
  const matchDashboard = useRouteMatch("/dashboard");
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
    return <LoadingState fullPage label="Loading Veyra Workspace..." />;
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

    if (matchDashboard.matches) {
      return <Dashboard currentUser={currentUser} />;
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

  return (
    <SocketProvider user={currentUser}>
      <NotificationProvider user={currentUser}>
        <AppLayout
          currentUser={currentUser}
          path={path}
          onNavigate={navigate}
          onLogout={handleLogout}
        >
          {renderRoute()}
        </AppLayout>
      </NotificationProvider>
    </SocketProvider>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <AppContent />
    </RouterProvider>
  );
}
