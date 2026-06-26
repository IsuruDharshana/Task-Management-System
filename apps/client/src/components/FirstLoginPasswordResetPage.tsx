import ChangePasswordForm from "./ChangePasswordForm";
import type { User } from "../services/api";

interface FirstLoginPasswordResetPageProps {
  currentUser: User;
  onPasswordChanged: (user: User) => void;
  onLogout: () => void;
}

export default function FirstLoginPasswordResetPage({
  currentUser,
  onPasswordChanged,
  onLogout,
}: FirstLoginPasswordResetPageProps) {
  return (
    <div className="password-reset-page">
      <div className="card password-reset-card">
        <div className="login-header">
          <div className="brand-logo">V</div>
          <h2>Change Your Password</h2>
          <p>{currentUser.name}, update your temporary password before entering Veyra.</p>
        </div>

        <ChangePasswordForm
          submitLabel="Update Password"
          successMessage="Password reset successfully."
          onPasswordChanged={onPasswordChanged}
        />

        <div className="form-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onLogout}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
