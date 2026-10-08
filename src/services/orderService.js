import { apiRequest } from "./api";
/*
  Creates an order through the backend API.
  Call this only when the real backend endpoint is available.
*/
export async function createOrder(order) {
  if (!order || !Array.isArray(order.items) || order.items.length === 0) {
    throw new Error("Cannot create an order without items.");
  }

  return apiRequest("/orders", {
    method: "POST",
    body: JSON.stringify(order),
  });
}