import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../services/api";

const CHECK_EVERY_MS = 5 * 60 * 1000; // re-check every 5 minutes

const getStore = () => {
  if (localStorage.getItem("token")) return localStorage;
  if (sessionStorage.getItem("token")) return sessionStorage;
  return null;
};

const clearAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
  window.dispatchEvent(new Event("authchange"));
};

// Reads the "exp" claim only (no verification: the server does that)
const isExpired = (token) => {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(part));
    return typeof exp === "number" && exp * 1000 <= Date.now();
  } catch {
    return true; // malformed token = treat as invalid
  }
};

/**
 * Call ONCE inside a component that is inside <BrowserRouter>, e.g. App.jsx
 *
 *  - validates the token with the server on load, on tab focus, every 5 min
 *  - removes expired / invalid / deleted-user sessions
 *  - refreshes the stored `user` from the server (so edited role/isAdmin in
 *    DevTools gets overwritten)
 *  - logs out other tabs when one tab logs out (localStorage sessions)
 */
export default function useAuthSync() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    const forceLogout = () => {
      clearAuth();
      navigate("/login", {
        replace: true,
        state: { from: location.pathname, sessionExpired: true },
      });
    };

    const validate = async () => {
      const store = getStore();
      if (!store) return;

      const token = store.getItem("token");

      if (!token || isExpired(token)) {
        forceLogout();
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (cancelled) return;

        if (response.status === 401 || response.status === 403) {
          forceLogout();
          return;
        }

        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          if (data?.user) {
            store.setItem("user", JSON.stringify(data.user));
            window.dispatchEvent(new Event("authchange"));
          }
        }
        // Network error / 5xx: do NOT log the user out, server may be down
      } catch {
        /* ignore */
      }
    };

    const onFocus = () => validate();

    const onStorage = (event) => {
      if (event.key === "token" && !event.newValue) {
        clearAuth();
        navigate("/login", { replace: true });
      } else if (event.key === "token" || event.key === "user") {
        window.dispatchEvent(new Event("authchange"));
      }
    };

    validate();
    const timer = window.setInterval(validate, CHECK_EVERY_MS);
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}