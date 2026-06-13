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
  const navItems = [
    ...(!isAdmin
      ? [
          { label: "Dashboard", path: "/dashboard", active: path === "/dashboard" },
          { label: "Projects", path: "/projects", active: path.startsWith("/projects") },
        ]
      : [{ label: "Admin Workspace", path: "/admin", active: path === "/admin" }]),
    {
      label: isAdmin ? "Audit Log" : "Activity Log",
      path: "/activity-log",
      active: path === "/activity-log",
    },
    { label: "Settings", path: "/settings", active: path === "/settings" },
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
