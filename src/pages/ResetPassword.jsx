import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import "../styles/auth.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function ResetPassword() {
  const { token } = useParams();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) return;

    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (new TextEncoder().encode(password).length > 72) {
      setError("Password must not exceed 72 UTF-8 bytes.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/auth/reset-password/${encodeURIComponent(token || "")}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to reset your password."
        );
      }

      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Cannot connect to the server. Please try again later."
          : err.message || "Unable to reset your password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo">S</span>
          <strong>ShopSphere</strong>
        </div>

        <div className="auth-heading">
          <h1>Reset your password</h1>
          <p>
            Choose a new password for your ShopSphere account.
          </p>
        </div>

        {success ? (
          <>
            <div className="auth-success" role="status">
              Password reset successful. You can now sign in
              with your new password.
            </div>

            <p className="auth-switch">
              <Link to="/login">Continue to sign in</Link>
            </p>
          </>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}

            <div className="auth-group">
              <label htmlFor="new-password">
                New password
              </label>

              <div className="password-input">
                <input
                  id="new-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Enter a new password"
                  minLength={8}
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  required
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="auth-group">
              <label htmlFor="confirm-password">
                Confirm new password
              </label>

              <input
                id="confirm-password"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Enter your password again"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                required
              />
            </div>

            <button
              className="auth-submit"
              type="submit"
              disabled={loading}
            >
              {loading ? "Resetting password..." : "Reset password"}
            </button>
          </form>
        )}

        {!success && (
          <p className="auth-switch">
            <Link to="/forgot-password">
              Request a new reset link
            </Link>
          </p>
        )}
      </section>
    </main>
  );
}