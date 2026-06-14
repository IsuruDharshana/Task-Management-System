import React, { useState } from "react";
import { api, APIError } from "../services/api";
import type { User } from "../services/api";
import logoUrl from "../assets/veyra-logo.png";
import { Button, Input } from "./ui";

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

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

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await api.auth.login(email, password);
      onLoginSuccess(data.user);
    } catch (err: unknown) {
      if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError("Network error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <section className="login-brand-panel" aria-label="Veyra overview">
        <div className="login-pattern" aria-hidden="true" />
        <div className="login-brand-mark">
          <img src={logoUrl} alt="Veyra" />
          <span>Veyra</span>
        </div>

        <div className="login-brand-copy">
          <h1>
            Organize work.
            <br />
            Track progress.
            <br />
            Deliver faster.
          </h1>
          <p>
            Veyra helps teams manage projects, tasks, deadlines, and collaboration in one secure workspace.
          </p>
        </div>

        <div className="login-floating-card card-one" aria-hidden="true">
          <span className="mini-check">✓</span>
          <span className="mini-line wide" />
          <span className="mini-line" />
        </div>
        <div className="login-floating-card card-two" aria-hidden="true">
          <span className="mini-pill">URGENT</span>
          <span className="mini-line wide" />
          <span className="mini-line" />
        </div>
        <div className="login-floating-card card-three" aria-hidden="true">
          <span className="mini-avatar-stack">
            <i />
            <i />
            <i />
          </span>
          <span className="mini-line wide" />
          <span className="mini-line" />
        </div>

        <p className="login-copyright">© {new Date().getFullYear()} Veyra Technologies. All rights reserved.</p>
      </section>

      <main className="login-form-panel">
        <div className="login-mobile-brand">
          <img src={logoUrl} alt="Veyra" />
          <strong>Veyra</strong>
        </div>

        <div className="login-card">
          <div className="login-header">
            <h2>Welcome back</h2>
            <p>Sign in to continue to Veyra</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="alert alert-danger">
                <span className="alert-icon">!</span>
                <span className="alert-message">{error}</span>
              </div>
            )}

            <Input
              id="email"
              type="email"
              label="Email Address"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="email"
              leftIcon={<span aria-hidden="true">✉</span>}
            />

            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="current-password"
              rightIcon={<PasswordVisibilityButton visible={showPassword} onClick={() => setShowPassword((current) => !current)} />}
              leftIcon={<span aria-hidden="true">●</span>}
            />

            <Button type="submit" variant="primary" fullWidth disabled={loading} className="login-submit">
              {loading ? <span className="spinner" /> : "Sign In"}
            </Button>
          </form>

          <div className="login-access-note">
            <span aria-hidden="true">i</span>
            <p>
              Access is provided by your administrator. <strong>Public registration is disabled.</strong>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
