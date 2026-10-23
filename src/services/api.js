const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

// Supports:
// VITE_API_URL=http://localhost:5000
// VITE_API_URL=http://localhost:5000/api
// VITE_API_URL=https://your-backend-domain.com
// VITE_API_URL=https://your-backend-domain.com/api

const backendOrigin = (
  configuredApiUrl || "http://localhost:5000"
)
  .replace(/\/+$/, "")
  .replace(/\/api$/i, "");

export const API_BASE_URL = `${backendOrigin}/api`;

// Socket.io uses the backend origin without "/api".
export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL?.trim() ||
  backendOrigin;

export function getToken() {
  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

export function getStoredUser() {
  try {
    const raw =
      localStorage.getItem("user") ||
      sessionStorage.getItem("user");

    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function apiRequest(endpoint, options = {}) {
  const token = getToken();

  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;

  const response = await fetch(
    `${API_BASE_URL}${normalizedEndpoint}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token
          ? { Authorization: `Bearer ${token}` }
          : {}),
        ...options.headers,
      },
    }
  );

  if (!response.ok) {
    let message = `API request failed: ${response.status}`;

    try {
      const errorData = await response.json();
      message = errorData.message || message;
    } catch {
      // Keep the default error message if the response is not JSON.
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

  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;

  const response = await fetch(
    `${API_BASE_URL}${normalizedEndpoint}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token
          ? { Authorization: `Bearer ${token}` }
          : {}),
        ...options.headers,
      },
    }
  );

  if (!response.ok) {
    let message = `API request failed: ${response.status}`;

    try {
      const errorData = await response.json();
      message = errorData.message || message;
    } catch {
      // Keep the default error message if the response is not JSON.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}
