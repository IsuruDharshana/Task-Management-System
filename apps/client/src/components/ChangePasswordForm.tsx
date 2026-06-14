import React, { useState } from "react";
import { api, APIError } from "../services/api";
import type { User } from "../services/api";
import { Button, Input } from "./ui";

interface ChangePasswordFormProps {
  submitLabel?: string;
  successMessage?: string;
  onPasswordChanged: (user: User) => void;
}

type PasswordFieldName = "current" | "new" | "confirm";

function PasswordVisibilityButton({
  visible,
  onClick,
}: {
  visible: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="password-visibility-toggle"
      onClick={onClick}
      aria-label={visible ? "Hide password" : "Show password"}
    >
      {visible ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
          <path d="M9.9 5.1A9.7 9.7 0 0 1 12 5c5 0 8.5 4.2 9.5 6.7a1 1 0 0 1 0 .6 12.4 12.4 0 0 1-3 4.1" />
          <path d="M6.1 6.4a12.3 12.3 0 0 0-3.6 5.3 1 1 0 0 0 0 .6C3.5 14.8 7 19 12 19a9.7 9.7 0 0 0 3.4-.6" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2.5 11.7a1 1 0 0 0 0 .6C3.5 14.8 7 19 12 19s8.5-4.2 9.5-6.7a1 1 0 0 0 0-.6C20.5 9.2 17 5 12 5s-8.5 4.2-9.5 6.7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
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
  const [visibleFields, setVisibleFields] = useState<Record<PasswordFieldName, boolean>>({
    current: false,
    new: false,
    confirm: false,
  });

  const togglePasswordVisibility = (field: PasswordFieldName) => {
    setVisibleFields((current) => ({
      ...current,
      [field]: !current[field],
    }));
  };

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

      <Input
        id="current-password"
        type={visibleFields.current ? "text" : "password"}
        label="Current Password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        required
        disabled={submitting}
        autoComplete="current-password"
        rightIcon={<PasswordVisibilityButton visible={visibleFields.current} onClick={() => togglePasswordVisibility("current")} />}
      />

      <div className="form-row">
        <Input
          id="new-password"
          type={visibleFields.new ? "text" : "password"}
          label="New Password"
          helperText="Use at least 8 characters, mixed case, a number, and a special character."
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          disabled={submitting}
          autoComplete="new-password"
          rightIcon={<PasswordVisibilityButton visible={visibleFields.new} onClick={() => togglePasswordVisibility("new")} />}
        />
        <Input
          id="confirm-password"
          type={visibleFields.confirm ? "text" : "password"}
          label="Confirm New Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={submitting}
          autoComplete="new-password"
          rightIcon={<PasswordVisibilityButton visible={visibleFields.confirm} onClick={() => togglePasswordVisibility("confirm")} />}
        />
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting ? "Updating..." : submitLabel}
      </Button>
    </form>
  );
}
