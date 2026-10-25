import { backendRequest } from "./api";

export const shortId = (id) =>
  `#${String(id || "").slice(-8).toUpperCase()}`;

/* Price and stock are always decided by the server. */
export async function createOrder(order) {
  if (!order || !Array.isArray(order.items) || order.items.length === 0) {
    throw new Error("Cannot create an order without items.");
  }

  return backendRequest("/orders", {
    method: "POST",
    body: JSON.stringify(order),
  });
}

export const getMyOrders = () =>
  backendRequest("/orders?limit=50");

export const getOrder = (id) =>
  backendRequest(`/orders/${encodeURIComponent(id)}`);

export const cancelOrder = (id) =>
  backendRequest(`/orders/${encodeURIComponent(id)}/cancel`, {
    method: "PATCH",
  });

/* ---------- Payments ---------- */

export const getPaymentMode = () =>
  backendRequest("/payments/config");

export const startCheckout = (orderId) =>
  backendRequest("/payments/checkout-session", {
    method: "POST",
    body: JSON.stringify({ orderId }),
  });

export const demoPay = (orderId, cardNumber) =>
  backendRequest("/payments/demo-pay", {
    method: "POST",
    body: JSON.stringify({ orderId, cardNumber }),
  });

export const getSessionStatus = (sessionId) =>
  backendRequest(
    `/payments/session-status?session_id=${encodeURIComponent(sessionId)}`
  );

/* Demo mode -> our fake card page. Stripe mode -> Stripe Checkout. */
export async function proceedToPayment(orderId, navigate) {
  const data = await startCheckout(orderId);

  if (data.demo) {
    navigate(`/demo-payment?order_id=${encodeURIComponent(orderId)}`);
    return;
  }

  if (data.checkoutUrl) {
    window.location.href = data.checkoutUrl;
    return;
  }

  throw new Error("Unable to start payment.");
}