import type { ReactNode } from "react";
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
  const isAdmin = currentUser.role === "admin";
  const isProjectManager = currentUser.role === "project_manager";
  const navItems = isAdmin
    ? [
        { label: "Dashboard", path: "/admin", active: path === "/admin", icon: "dashboard" },
        { label: "Users", path: "/admin", active: path === "/admin", icon: "users" },
        { label: "Notifications", path: "/notifications", active: path === "/notifications", icon: "notifications" },
        { label: "System Settings", path: "/settings", active: path === "/settings", icon: "sliders" },
        { label: "Settings", path: "/settings", active: path === "/settings", icon: "settings" },
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

  return (
    <div className="app-shell veyra-app-layout">
      <Sidebar currentUser={currentUser} navItems={navItems} onNavigate={onNavigate} />
      <div className="app-main veyra-content-shell">
        <Topbar currentUser={currentUser} onLogout={onLogout} />
        <main className="app-content page-content app-main-content">{children}</main>
      </div>
    </div>
  );
}
