import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { getOrder, getSessionStatus, shortId } from "../services/orderService";
import "../styles/order-success.css";

const formatPrice = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const label = (value) => (value ? String(value).replace(/_/g, " ") : "-");
const POLL_INTERVAL_MS = 2000;
const MAX_STATUS_CHECKS = 30;

export default function OrderSuccess() {
  const location = useLocation();
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const orderId = location.state?.order?._id || location.state?.orderId;
  const [result, setResult] = useState({ status: "loading", order: null });

  useEffect(() => {
    let cancelled = false;
    let timer;
    let checks = 0;

    const load = async () => {
      try {
        if (sessionId) {
          const data = await getSessionStatus(sessionId);
          if (cancelled) return;

          const order = data.order;
          const isTerminal =
            data.paymentStatus !== "pending" ||
            data.orderStatus === "cancelled";

          setResult({
            status: data.verified && isTerminal ? "verified" : "pending",
            order,
            verified: data.verified === true,
            checkoutPaymentStatus: data.checkoutPaymentStatus,
          });

          checks += 1;
          if (!isTerminal && checks < MAX_STATUS_CHECKS) {
            timer = window.setTimeout(load, POLL_INTERVAL_MS);
          }
          return;
        }

        if (!orderId) {
          setResult({ status: "unavailable" });
          return;
        }

        const data = await getOrder(orderId);
        if (!cancelled) {
          setResult({
            status: data.order ? "verified" : "unavailable",
            order: data.order || null,
            verified: Boolean(data.order),
          });
        }
      } catch (error) {
        if (!cancelled) {
          setResult({
            status: "unavailable",
            error: error.message || "Unable to verify this order.",
          });
        }
      }
    };

    load();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [orderId, sessionId]);

  const order = result.order;
  const isCod = order?.paymentProvider === "cash_on_delivery";
  const isPaid =
    result.status === "verified" &&
    result.verified &&
    order?.paymentStatus === "paid" &&
    (!sessionId || result.checkoutPaymentStatus === "paid");
  const isCodOrderPlaced =
    result.status === "verified" &&
    result.verified &&
    isCod &&
    order?.status !== "cancelled";
  const isFailed =
    order?.paymentStatus === "failed" ||
    order?.paymentStatus === "refunded" ||
    order?.status === "cancelled" ||
    (result.status === "verified" && result.checkoutPaymentStatus === "unpaid" &&
      order?.status !== "pending");
  const isSuccess = isPaid || isCodOrderPlaced;
  const firstName = order?.shippingAddress?.fullName
    ? String(order.shippingAddress.fullName).trim().split(" ")[0]
    : "";
  const itemCount = order?.items
    ? order.items.reduce((total, item) => total + item.quantity, 0)
    : 0;
  const paymentStatus = isCod && order?.paymentStatus === "pending"
    ? "due on delivery"
    : order?.paymentStatus || "pending";
  const heading = isSuccess
    ? isPaid
      ? "Payment confirmed"
      : "Order placed"
    : result.status === "loading"
      ? "Verifying your order..."
      : result.status === "unavailable"
        ? "We couldn't verify your order"
        : isFailed
          ? "Payment not completed"
          : "Payment processing";
  const message = isSuccess
    ? isPaid
      ? "Your payment has been verified and your order is confirmed."
      : "Your order is confirmed. Payment is due when it is delivered."
    : result.status === "loading"
      ? "Please wait while we confirm your order with the server."
      : result.status === "unavailable"
        ? result.error || "Check your orders for the latest status."
        : isFailed
          ? order?.paymentStatus === "refunded"
            ? "This payment was refunded. Check your orders for the latest status."
            : "The payment was not completed. Check your orders for the latest status."
          : "Your payment is still awaiting confirmation. Check your orders for the latest status.";
  const iconClass = isSuccess
    ? "success-icon"
    : isFailed
      ? "success-icon is-failed"
      : "success-icon is-pending";
  const orderStatus = order?.status || "pending";
  const delivery = ["shipped", "delivered"].includes(orderStatus)
    ? orderStatus
    : orderStatus === "cancelled"
      ? "cancelled"
      : "not shipped";

  return (
    <main className="order-success-page">
      <section className="success-card" aria-live="polite">
        <div className={iconClass} aria-hidden="true">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {isSuccess ? (
              <path className="success-check" d="M5 12.5l4.5 4.5L19 7.5" />
            ) : (
              <>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v6" />
                <path d="M12 16.5v.01" />
              </>
            )}
          </svg>
        </div>

        <h1>{isSuccess && firstName ? `${heading}, ${firstName}!` : heading}</h1>
        <p>{message}</p>

        {order && (
          <div className="success-order">
            <div>
              <span>Order number</span>
              <strong>{shortId(order._id)}</strong>
            </div>
            {itemCount > 0 && (
              <div>
                <span>Items</span>
                <strong>{itemCount}</strong>
              </div>
            )}
            <div>
              <span>Total</span>
              <strong>{formatPrice(order.totalAmount)}</strong>
            </div>
          </div>
        )}

        <div className="success-info">
          <div>
            <span>Order status</span>
            <strong>{label(orderStatus)}</strong>
          </div>
          <div>
            <span>Payment</span>
            <strong>{label(paymentStatus)}</strong>
          </div>
          <div>
            <span>Delivery</span>
            <strong>{label(delivery)}</strong>
          </div>
        </div>

        <div className="success-actions">
          <Link to="/orders" className="success-primary-btn">
            Track my orders
          </Link>
          <Link to="/products" className="success-secondary-btn">
            Continue shopping
          </Link>
        </div>
      </section>
    </main>
  );
}
