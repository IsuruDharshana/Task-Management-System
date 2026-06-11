import ChangePasswordForm from "./ChangePasswordForm";
import type { User } from "../services/api";

interface SettingsPageProps {
  currentUser: User;
  onUserUpdated: (user: User) => void;
}

export default function SettingsPage({ currentUser, onUserUpdated }: SettingsPageProps) {
  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Account Settings</h1>
        <p className="subtitle">Manage your Veyra account security.</p>
      </div>

      <div className="settings-grid">
        <div className="card account-summary-card">
          <h2>Profile</h2>
          <p className="card-desc">Signed-in account details.</p>

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
          <p className="card-desc">Use your current password to set a new one.</p>
          <ChangePasswordForm onPasswordChanged={onUserUpdated} />
        </div>
      </div>
    </div>
  );
}
