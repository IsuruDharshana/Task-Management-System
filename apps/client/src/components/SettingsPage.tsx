import ChangePasswordForm from "./ChangePasswordForm";
import type { User } from "../services/api";
import { Badge, UserAvatar } from "./ui";

interface SettingsPageProps {
  currentUser: User;
  onUserUpdated: (user: User) => void;
}

export default function SettingsPage({ currentUser, onUserUpdated }: SettingsPageProps) {
  return (
    <div className="settings-page veyra-page">
      <div className="modern-page-header">
        <div>
          <h1>Settings</h1>
          <p className="subtitle">Manage profile details, password security, and account access.</p>
        </div>
      </div>

      <div className="settings-grid">
        <div className="card account-summary-card">
          <div className="settings-profile-hero">
            <UserAvatar name={currentUser.name} size="lg" />
            <div>
              <h2>{currentUser.name}</h2>
              <p>{currentUser.email}</p>
              <Badge variant={currentUser.role}>{currentUser.role.replace("_", " ")}</Badge>
            </div>
          </div>

          <div className="account-detail-row">
            <span>Name</span>
            <strong>{currentUser.name}</strong>
          </div>
          <div className="account-detail-row">
            <span>Email</span>
            <strong>{currentUser.email}</strong>
          </div>
          <div className="account-detail-row">
            <span>Role</span>
            <strong>{currentUser.role}</strong>
          </div>
        </div>

        <div className="card change-password-card">
          <h2>Change Password</h2>
          <p className="card-desc">Use your current password to set a new one. Passwords must be at least 8 characters with upper/lowercase letters, a number, and a special character.</p>
          <ChangePasswordForm onPasswordChanged={onUserUpdated} />
        </div>

        <div className="card security-session-card">
          <h2>Security & Sessions</h2>
          <p className="card-desc">Authentication is protected with HTTP-only server sessions. Sign out when using a shared device.</p>
          <div className="account-detail-row">
            <span>Password reset required</span>
            <strong>{currentUser.mustResetPassword ? "Yes" : "No"}</strong>
          </div>
          <div className="account-detail-row">
            <span>Account role</span>
            <strong>{currentUser.role.replace("_", " ")}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
