import { useState } from "react";
import { Link } from "react-router-dom";
import "../styles/auth.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/auth/forgot-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to process your request."
        );
      }

      setSuccess(data.message);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Cannot connect to the server. Please try again later."
          : err.message || "Something went wrong."
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
          <h1>Forgot password?</h1>
          <p>
            Enter your email address and we will send you
            instructions to reset your password.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}

          {success && (
            <div className="auth-success" role="status">
              {success}
            </div>
          )}

          {!success && (
            <>
              <div className="auth-group">
                <label htmlFor="reset-email">
                  Email address
                </label>

                <input
                  id="reset-email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  maxLength={254}
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  required
                />
              </div>

              <button
                className="auth-submit"
                type="submit"
                disabled={loading}
              >
                {loading
                  ? "Sending instructions..."
                  : "Send reset link"}
              </button>
            </>
          )}
        </form>

        <p className="auth-switch">
          Remember your password?{" "}
          <Link to="/login">Back to sign in</Link>
        </p>
      </section>
    </main>
  );
}