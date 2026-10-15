import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/account.css";

const getStoredAuth = () => {
  try {
    const token =
      localStorage.getItem("token") ||
      sessionStorage.getItem("token");

    const storedUser =
      localStorage.getItem("user") ||
      sessionStorage.getItem("user");

    if (!token || !storedUser) return null;

    return {
      token,
      user: JSON.parse(storedUser),
    };
  } catch {
    return null;
  }
};

export default function Account() {
  const navigate = useNavigate();
  const [auth, setAuth] = useState(getStoredAuth);

  useEffect(() => {
    const syncAuth = () => {
      setAuth(getStoredAuth());
    };

    window.addEventListener("storage", syncAuth);
    window.addEventListener("authchange", syncAuth);

    return () => {
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener("authchange", syncAuth);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");

    setAuth(null);
    window.dispatchEvent(new Event("authchange"));
    navigate("/login", { replace: true });
  };

  if (!auth) {
    return (
      <main className="account-page">
        <section className="account-card account-guest">
          <div className="account-avatar">S</div>

          <h1>Sign in to your account</h1>

          <p>
            Please log in to view your ShopSphere account details.
          </p>

          <Link to="/login" className="account-primary-btn">
            Sign in
          </Link>

          <p className="account-register">
            Don't have an account? <Link to="/register">Create one</Link>
          </p>
        </section>
      </main>
    );
  }

  const { user } = auth;
  const displayName = user.name || "ShopSphere User";
  const initials = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <main className="account-page">
      <section className="account-card">
        <div className="account-heading">
          <span className="account-eyebrow">MY SHOPSPHERE</span>
          <h1>My Account</h1>
          <p>Manage your account information.</p>
        </div>

        <div className="account-profile">
          <div className="account-avatar">
            {initials || "S"}
          </div>

          <div className="account-profile-info">
            <h2>{displayName}</h2>
            <p>{user.email}</p>
            <span className="account-role">
              {user.role || "user"}
            </span>
          </div>
        </div>

        <div className="account-details">
          <h3>Personal information</h3>

          <div className="account-detail-row">
            <span>Full name</span>
            <strong>{displayName}</strong>
          </div>

          <div className="account-detail-row">
            <span>Email address</span>
            <strong>{user.email || "Not available"}</strong>
          </div>

          <div className="account-detail-row">
            <span>Account type</span>
            <strong>
              {user.role === "admin" ? "Administrator" : "Customer"}
            </strong>
          </div>
        </div>

        <div className="account-actions">
          <Link to="/products" className="account-primary-btn">
            Continue shopping
          </Link>

          <button
            type="button"
            className="account-logout-btn"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </section>
    </main>
  );
}