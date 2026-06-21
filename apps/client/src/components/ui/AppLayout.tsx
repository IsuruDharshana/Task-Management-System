import { useEffect, useState, type ReactNode } from "react";
import type { User } from "../../services/api";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

interface AppLayoutProps {
  currentUser: User;
  path: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  children: ReactNode;
}

export default function AppLayout({
  currentUser,
  path,
  onNavigate,
  onLogout,
  children,
}: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAdmin = currentUser.role === "admin";
  const isProjectManager = currentUser.role === "project_manager";
  const isAdminDashboardRoute = (pathname: string) =>
    pathname === "/admin" || pathname === "/admin/dashboard";
  const isUsersRoute = (pathname: string) =>
    pathname === "/admin/users" || pathname.startsWith("/admin/users/");
  const isNotificationsRoute = (pathname: string) =>
    pathname === "/admin/notifications" || pathname.startsWith("/admin/notifications/");
  const isSettingsRoute = (pathname: string) =>
    pathname === "/admin/settings" || pathname.startsWith("/admin/settings/");
  const navItems = isAdmin
    ? [
        { label: "Dashboard", path: "/admin/dashboard", active: isAdminDashboardRoute(path), icon: "dashboard" },
        { label: "Users", path: "/admin/users", active: isUsersRoute(path), icon: "users" },
        { label: "Notifications", path: "/admin/notifications", active: isNotificationsRoute(path), icon: "notifications" },
        { label: "Settings", path: "/admin/settings", active: isSettingsRoute(path), icon: "settings" },
      ]
    : [
        { label: "Dashboard", path: "/dashboard", active: path === "/dashboard", icon: "dashboard" },
        {
          label: isProjectManager ? "Projects" : "My Tasks",
          path: "/projects",
          active: path.startsWith("/projects"),
          icon: isProjectManager ? "projects" : "tasks",
        },
        ...(isProjectManager
          ? [{ label: "Audit Log", path: "/activity-log", active: path === "/activity-log", icon: "audit" }]
          : []),
        { label: "Notifications", path: "/notifications", active: path === "/notifications", icon: "notifications" },
        { label: "Settings", path: "/settings", active: path === "/settings", icon: "settings" },
      ];

  useEffect(() => {
    if (!sidebarOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen]);

  const handleNavigate = (nextPath: string) => {
    onNavigate(nextPath);
    setSidebarOpen(false);
  };

  return (
    <div className="app-shell veyra-app-layout">
      <Sidebar
        currentUser={currentUser}
        navItems={navItems}
        onNavigate={handleNavigate}
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      {sidebarOpen && <button type="button" className="mobile-sidebar-backdrop" aria-label="Close navigation menu" onClick={() => setSidebarOpen(false)} />}
      <div className="app-main veyra-content-shell">
        <Topbar currentUser={currentUser} onLogout={onLogout} onMenuClick={() => setSidebarOpen(true)} />
        <main className="app-content page-content app-main-content">{children}</main>
      </div>
    </div>
  );
}
