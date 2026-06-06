import React, { useState } from "react";
import { api, APIError } from "../services/api";
import type { User } from "../services/api";

interface ChangePasswordFormProps {
  submitLabel?: string;
  successMessage?: string;
  onPasswordChanged: (user: User) => void;
}

function getPasswordPolicyError(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter.";
  if (!/\d/.test(password)) return "Password must include a number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include a special character.";
  return null;
}

export default function ChangePasswordForm({
  submitLabel = "Change Password",
  successMessage = "Password changed successfully.",
  onPasswordChanged,
}: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const policyError = getPasswordPolicyError(newPassword);
    if (policyError) {
      setError(policyError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.auth.changePassword(currentPassword, newPassword);
      onPasswordChanged(result.user);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(successMessage);
    } catch (err: any) {
      if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError("Failed to change password. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="change-password-form">
      {error && (
        <div className="alert alert-danger">
          <span className="alert-icon">!</span>
          <span className="alert-message">{error}</span>
        </div>
      )}
      {success && (
        <div className="alert alert-success">
          <span className="alert-icon">!</span>
          <span className="alert-message">{success}</span>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="current-password">Current Password</label>
        <input
          id="current-password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          disabled={submitting}
          autoComplete="current-password"
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="new-password">New Password</label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            disabled={submitting}
            autoComplete="new-password"
          />
        </div>
        <div className="form-group">
          <label htmlFor="confirm-password">Confirm New Password</label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={submitting}
            autoComplete="new-password"
          />
        </div>
      </div>

      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? "Updating..." : submitLabel}
      </button>
    </form>
  );
}
