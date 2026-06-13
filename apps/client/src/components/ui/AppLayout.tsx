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
        { label: "Dashboard", path: "/admin", active: path === "/admin", icon: "D" },
        { label: "Users", path: "/admin", active: path === "/admin", icon: "U" },
        { label: "Notifications", path: "/activity-log", active: path === "/activity-log", icon: "N" },
        { label: "System Settings", path: "/settings", active: path === "/settings", icon: "S" },
        { label: "Settings", path: "/settings", active: path === "/settings", icon: "P" },
      ]
    : [
        { label: "Dashboard", path: "/dashboard", active: path === "/dashboard", icon: "D" },
        {
          label: isProjectManager ? "Projects" : "My Tasks",
          path: "/projects",
          active: path.startsWith("/projects"),
          icon: isProjectManager ? "P" : "T",
        },
        ...(isProjectManager
          ? [{ label: "Tasks", path: "/projects", active: path.startsWith("/projects"), icon: "T" }]
          : []),
        { label: "Notifications", path: "/activity-log", active: path === "/activity-log", icon: "N" },
        { label: "Settings", path: "/settings", active: path === "/settings", icon: "S" },
      ];

  return (
    <div className="app-shell veyra-app-layout">
      <Sidebar currentUser={currentUser} navItems={navItems} onNavigate={onNavigate} />
      <div className="veyra-content-shell">
        <Topbar currentUser={currentUser} onLogout={onLogout} />
        <main className="app-main-content">{children}</main>
      </div>
    </div>
  );
}
