import type { User } from "../../services/api";
import logoUrl from "../../assets/veyra-logo.png";
import Badge from "./Badge";

interface NavItem {
  label: string;
  path: string;
  active: boolean;
  icon?: string;
}

interface SidebarProps {
  currentUser: User;
  navItems: NavItem[];
  onNavigate: (path: string) => void;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

function NavIcon({ name }: { name?: string }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "users":
      return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    case "projects":
      return <svg {...common}><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M8 13h8" /><path d="M8 16h5" /></svg>;
    case "tasks":
      return <svg {...common}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>;
    case "audit":
      return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h5" /><path d="M8 17h8" /><path d="M16 13h.01" /></svg>;
    case "notifications":
      return <svg {...common}><path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16Z" /><path d="M9.5 20a2.5 2.5 0 0 0 5 0" /></svg>;
    case "sliders":
      return <svg {...common}><path d="M4 21v-7" /><path d="M4 10V3" /><path d="M12 21v-9" /><path d="M12 8V3" /><path d="M20 21v-5" /><path d="M20 12V3" /><path d="M2 14h4" /><path d="M10 8h4" /><path d="M18 16h4" /></svg>;
    case "settings":
      return <svg {...common}><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.36.19.72.32 1.1.4H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z" /></svg>;
    case "logout":
      return <svg {...common}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>;
    default:
      return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg>;
  }
}

export default function Sidebar({ currentUser, navItems, onNavigate, onLogout, isOpen = false, onClose }: SidebarProps) {
  return (
    <aside className={`veyra-sidebar ${isOpen ? "is-open" : ""}`}>
      <button type="button" className="veyra-sidebar-brand" onClick={() => onNavigate("/")}>
        <img src={logoUrl} alt="Veyra" />
        <span>Veyra</span>
      </button>

      <div className="veyra-sidebar-section">
        <p className="veyra-sidebar-label">Workspace</p>
        <nav className="veyra-sidebar-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              key={`${item.label}-${item.path}`}
              type="button"
              className={`veyra-sidebar-link ${item.active ? "active" : ""}`}
              onClick={() => {
                onNavigate(item.path);
                onClose?.();
              }}
            >
              <span className="veyra-sidebar-icon" aria-hidden="true"><NavIcon name={item.icon} /></span>
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="veyra-sidebar-footer mobile-sidebar-footer">
        <p>Signed in as</p>
        <strong>{currentUser.name}</strong>
        <Badge variant={currentUser.role}>{currentUser.role.replace("_", " ")}</Badge>
        <button
          type="button"
          className="sidebar-signout-button mobile-sidebar-signout"
          onClick={() => {
            onClose?.();
            onLogout();
          }}
        >
          <span className="veyra-sidebar-icon" aria-hidden="true"><NavIcon name="logout" /></span>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
