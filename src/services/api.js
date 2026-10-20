// Set VITE_API_URL to the backend origin, with or without its /api suffix.
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const backendOrigin = (configuredApiUrl || "http://localhost:5000/api")
  .replace(/\/+$/, "")
  .replace(/\/api$/i, "");
export const API_BASE_URL = `${backendOrigin}/api`;

// Socket.io lives on the same host, without the "/api" suffix
export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem("user") || sessionStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function apiRequest(endpoint, options = {}) {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = `API request failed: ${response.status}`;

    try {
      const errorData = await response.json();
      message = errorData.message || message;
    } catch {
      // Keep the default error message if no JSON response exists.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// Product, order, and payment services share the configured backend URL.
export async function backendRequest(endpoint, options = {}) {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = `API request failed: ${response.status}`;

    try {
      const errorData = await response.json();
      message = errorData.message || message;
    } catch {
      // Keep the default error message if no JSON response exists.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}