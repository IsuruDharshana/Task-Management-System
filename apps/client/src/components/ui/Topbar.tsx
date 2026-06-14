import type { User } from "../../services/api";
import NotificationBell from "../NotificationBell";
import Badge from "./Badge";
import Button from "./Button";
import UserAvatar from "./UserAvatar";

interface TopbarProps {
  currentUser: User;
  onLogout: () => void;
}

export default function Topbar({ currentUser, onLogout }: TopbarProps) {
  return (
    <header className="veyra-topbar">
      <div>
        <p className="veyra-topbar-kicker">Veyra Task Management System</p>
        <h1>Welcome, {currentUser.name}</h1>
      </div>
      <div className="veyra-topbar-actions">
        <NotificationBell />
        <div className="veyra-topbar-user">
          <UserAvatar name={currentUser.name} />
          <div>
            <strong>{currentUser.name}</strong>
            <span>{currentUser.email}</span>
          </div>
          <Badge variant={currentUser.role}>{currentUser.role.replace("_", " ")}</Badge>
        </div>
        <Button type="button" variant="secondary" onClick={onLogout}>
          Sign Out
        </Button>
      </div>
    </header>
  );
}
