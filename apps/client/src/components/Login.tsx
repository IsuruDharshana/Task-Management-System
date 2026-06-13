import React, { useState } from "react";
import { api, APIError } from "../services/api";
import type { User } from "../services/api";
import logoUrl from "../assets/veyra-logo.png";
import { Button, Input } from "./ui";

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
              type="password"
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="current-password"
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
