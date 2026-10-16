import { apiRequest } from "./api";

export const getAdminStats = () => apiRequest("/admin/stats");

export const getAdminUsers = () => apiRequest("/admin/users");

export const getAdminOrders = (status = "") =>
  apiRequest(`/orders/admin/all?limit=100${status ? `&status=${status}` : ""}`);

export const updateOrderStatus = (id, status) =>
  apiRequest(`/orders/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
