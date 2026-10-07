import { Link, useLocation } from "react-router-dom";
import "../styles/order-success.css";

const formatPrice = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

export default function OrderSuccess() {
  const location = useLocation();

  /* Optional: Checkout can send { order } through navigate state.
     If it is missing (direct visit), the page still works normally. */
  const order = location.state?.order;
  const firstName = order?.name ? String(order.name).trim().split(" ")[0] : "";

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
            {order.id && (
              <div>
                <span>Order number</span>
                <strong>{order.id}</strong>
              </div>
            )}

            {order.itemCount > 0 && (
              <div>
                <span>Items</span>
                <strong>{order.itemCount}</strong>
              </div>
            )}

            {order.total !== undefined && (
              <div>
                <span>Total</span>
                <strong>{formatPrice(order.total)}</strong>
              </div>
            )}
          </div>
        )}

        <div className="success-info">
          <div>
            <span>Order status</span>
            <strong>Confirmed</strong>
          </div>

          <div>
            <span>Payment</span>
            <strong>Pending</strong>
          </div>

          <div>
            <span>Delivery</span>
            <strong>Processing</strong>
          </div>
        </div>

        <div className="success-actions">
          <Link to="/products" className="success-primary-btn">
            Continue shopping
          </Link>

          <Link to="/" className="success-secondary-btn">
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}