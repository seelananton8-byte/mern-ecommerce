import { apiRequest } from "./api";

export const shortId = (id) => `#${String(id || "").slice(-8).toUpperCase()}`;

/* Creates an order. Price and stock are always decided by the server. */
export async function createOrder(order) {
  if (!order || !Array.isArray(order.items) || order.items.length === 0) {
    throw new Error("Cannot create an order without items.");
  }

  return apiRequest("/orders", {
    method: "POST",
    body: JSON.stringify(order),
  });
}

export const getMyOrders = () => apiRequest("/orders?limit=50");

export const getOrder = (id) => apiRequest(`/orders/${encodeURIComponent(id)}`);

export const cancelOrder = (id) =>
  apiRequest(`/orders/${encodeURIComponent(id)}/cancel`, { method: "PATCH" });

/* ---------- Payments ---------- */

export const getPaymentMode = () => apiRequest("/payments/config");

export const startCheckout = (orderId) =>
  apiRequest("/payments/checkout-session", {
    method: "POST",
    body: JSON.stringify({ orderId }),
  });

export const demoPay = (orderId, cardNumber) =>
  apiRequest("/payments/demo-pay", {
    method: "POST",
    body: JSON.stringify({ orderId, cardNumber }),
  });

export const getSessionStatus = (sessionId) =>
  apiRequest(`/payments/session-status?session_id=${encodeURIComponent(sessionId)}`);

/* Demo mode -> our fake card page. Stripe mode -> Stripe Checkout. */
export async function proceedToPayment(orderId, navigate) {
  const data = await startCheckout(orderId);

  if (data.demo) {
    navigate(`/demo-payment?order_id=${orderId}`);
    return;
  }

  if (data.checkoutUrl) {
    window.location.href = data.checkoutUrl;
    return;
  }

  throw new Error("Unable to start payment.");
}
