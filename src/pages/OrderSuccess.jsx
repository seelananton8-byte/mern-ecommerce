import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { getSessionStatus, shortId } from "../services/orderService";
import "../styles/order-success.css";

const formatPrice = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const label = (value) => (value ? String(value).replace(/_/g, " ") : "-");

export default function OrderSuccess() {
  const location = useLocation();
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");

  /* The order comes from Checkout / DemoPayment through navigate state.
     After a real Stripe redirect only ?session_id=... is available. */
  const order = location.state?.order;
  const [stripeInfo, setStripeInfo] = useState(null);

  useEffect(() => {
    if (order || !sessionId) return;

    getSessionStatus(sessionId)
      .then(setStripeInfo)
      .catch(() => setStripeInfo(null));
  }, [order, sessionId]);

  const firstName = order?.shippingAddress?.fullName
    ? String(order.shippingAddress.fullName).trim().split(" ")[0]
    : "";

  const itemCount = order?.items
    ? order.items.reduce((total, item) => total + item.quantity, 0)
    : 0;

  const orderStatus = order?.status || stripeInfo?.orderStatus || "confirmed";
  const paymentStatus = order?.paymentStatus || stripeInfo?.paymentStatus || "pending";
  const delivery = ["shipped", "delivered"].includes(orderStatus) ? orderStatus : "processing";

  return (
    <main className="order-success-page">
      <section className="success-card">
        <div className="success-icon" aria-hidden="true">
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
            <path className="success-check" d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </div>

        <h1>
          {firstName
            ? `Thank you, ${firstName}!`
            : "Thank you for your order!"}
        </h1>

        <p>
          Your order has been placed successfully. We appreciate your purchase.
        </p>

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
