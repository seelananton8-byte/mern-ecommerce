import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import GoogleAuthButton from "../components/GoogleAuthButton";
import "../styles/auth.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const EyeIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 3l18 18" />
    <path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4" />
    <path d="M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.8 9.8 0 0 0 4.4-1" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
);

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const getDestination = () => {
    const requestedPath = location.state?.from;

    return typeof requestedPath === "string" &&
      requestedPath.startsWith("/") &&
      !requestedPath.startsWith("//")
      ? requestedPath
      : "/";
  };

  const saveLogin = (data) => {
    if (!data?.token || !data?.user) {
      throw new Error("Login response is incomplete.");
    }

    const storage = rememberMe ? localStorage : sessionStorage;

    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");

    storage.setItem("token", data.token);
    storage.setItem("user", JSON.stringify(data.user));

    window.dispatchEvent(new Event("authchange"));

    navigate(getDestination(), { replace: true });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading || googleLoading) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success || !data.token || !data.user) {
        throw new Error(
          data.message || "Unable to sign in. Please try again."
        );
      }

      saveLogin(data);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Cannot connect to the server. Make sure the backend is running."
          : err.message || "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (googleResponse) => {
    if (loading || googleLoading) return;

    if (!googleResponse?.credential) {
      setError("Google did not return a credential. Please try again.");
      return;
    }

    setGoogleLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/auth/google`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          credential: googleResponse.credential,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success || !data.token || !data.user) {
        throw new Error(
          data.message || "Unable to sign in with Google."
        );
      }

      saveLogin(data);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Cannot connect to the server. Please make sure the backend is running."
          : err.message || "Google sign-in failed. Please try again."
      );
    } finally {
      setGoogleLoading(false);
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
          <h1>Sign in to your account</h1>
          <p>Access your account and continue shopping.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && (
            <div className="auth-error" role="alert" aria-live="polite">
              {error}
            </div>
          )}

          <div className="auth-group">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
              required
            />
          </div>

          <div className="auth-group">
            <div className="password-label">
              <label htmlFor="password">Password</label>
              <button
                type="button"
                onClick={() =>
                  setError(
                    "Password reset is not configured yet. Please contact the administrator."
                  )
                }
              >
                Forgot password?
              </button>
            </div>

            <div className="password-input">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />

              <button
                type="button"
                onClick={() => setShowPassword((show) => !show)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <label className="remember-row">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            <span>Remember me</span>
          </label>

          <button
            type="submit"
            className="auth-submit"
            disabled={loading || googleLoading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <GoogleAuthButton
          loading={googleLoading}
          loadingText="Signing in with Google..."
          onSuccess={handleGoogleSuccess}
          onError={() =>
            setError("Google sign-in failed. Please try again.")
          }
        />

        <p className="auth-switch">
          Don't have an account?
          <Link to="/register"> Create one</Link>
        </p>
      </section>
    </main>
  );
}