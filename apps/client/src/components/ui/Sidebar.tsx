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
}

export default function Sidebar({ currentUser, navItems, onNavigate }: SidebarProps) {
  return (
    <aside className="veyra-sidebar">
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
              onClick={() => onNavigate(item.path)}
            >
              <span className="veyra-sidebar-link-dot" aria-hidden="true" />
              {item.icon && <span className="veyra-sidebar-icon" aria-hidden="true">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="veyra-sidebar-footer">
        <p>Signed in as</p>
        <strong>{currentUser.name}</strong>
        <Badge variant={currentUser.role}>{currentUser.role.replace("_", " ")}</Badge>
      </div>
    </aside>
  );
}
