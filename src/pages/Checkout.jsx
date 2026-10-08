import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CardContext.jsx";
import "../styles/checkout.css";

/* ---------- Inline SVG icons ---------- */

const CartIcon = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="9" cy="20" r="1.4" />
    <circle cx="18" cy="20" r="1.4" />
    <path d="M2.5 3h2.7l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.1a1.6 1.6 0 0 0 1.6-1.2L20.5 7H6" />
  </svg>
);

const LockIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="4" y="11" width="16" height="10" rx="2.5" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

const ChevronIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const ImageIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M21 16l-5-5-8 8" />
  </svg>
);

const formatPrice = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

/* Thumbnail with fallback if the image fails */
function SummaryImage({ item }) {
  const [failed, setFailed] = useState(false);

  if (failed || !item.thumbnail) {
    return (
      <span className="checkout-image-fallback">
        <ImageIcon />
      </span>
    );
  }

  return (
    <img
      src={item.thumbnail}
      alt={item.title}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export default function Checkout() {
  const navigate = useNavigate();

  const { cartItems, cartTotal, clearCart } = useCart();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    pincode: "",
  });

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // phone & pincode accept digits only
    const cleaned =
      name === "phone" || name === "pincode" ? value.replace(/\D/g, "") : value;

    setFormData((current) => ({
      ...current,
      [name]: cleaned,
    }));
  };

  const handleSubmit = (e) => {
  e.preventDefault();

  if (submitting) return;

  if (cartItems.length === 0) {
    setError("Your cart is empty.");
    return;
  }

  setError("");

  const order = {
    id: `ORD-${Date.now()}`,
    name: formData.name.trim(),
    email: formData.email.trim(),
    phone: formData.phone,
    address: formData.address.trim(),
    city: formData.city.trim(),
    pincode: formData.pincode,
    items: cartItems.map((item) => ({ ...item })),
    itemCount: cartItems.reduce(
      (total, item) => total + item.quantity,
      0
    ),
    total: cartTotal,
    status: "Confirmed",
    paymentStatus: "Pending",
    createdAt: new Date().toISOString(),
  };

  setSubmitting(true);

  clearCart();

  navigate("/order-success", {
    state: { order },
  });
};

  if (cartItems.length === 0) {
    return (
      <main className="checkout-page">
        <section className="checkout-empty">
          <div className="checkout-empty-icon">
            <CartIcon />
          </div>

          <h1>Your cart is empty</h1>

          <p>Add some products before proceeding to checkout.</p>

          <Link to="/products" className="checkout-shopping-btn">
            Browse products
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="checkout-page">
      <div className="checkout-header">
        <h1>Complete your order</h1>
        <p>Enter your details and review your order before placing it.</p>
      </div>

      <section className="checkout-layout">
        <form className="checkout-form" onSubmit={handleSubmit}>
          <div className="checkout-section">
            <div className="checkout-section-title">
              <span>1</span>
              <div>
                <h2>Contact information</h2>
                <p>We'll use this information for your order.</p>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group full">
                <label htmlFor="name">Full name</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Enter your full name"
                  autoComplete="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">Phone number</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="10-digit mobile number"
                  autoComplete="tel-national"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  title="Enter a 10-digit phone number"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          <div className="checkout-section">
            <div className="checkout-section-title">
              <span>2</span>
              <div>
                <h2>Delivery address</h2>
                <p>Where should we deliver your order?</p>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group full">
                <label htmlFor="address">Address</label>
                <textarea
                  id="address"
                  name="address"
                  placeholder="House number, street, area"
                  autoComplete="street-address"
                  value={formData.address}
                  onChange={handleChange}
                  rows="4"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="city">City</label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  placeholder="Enter city"
                  autoComplete="address-level2"
                  value={formData.city}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="pincode">Pincode</label>
                <input
                  id="pincode"
                  name="pincode"
                  type="text"
                  inputMode="numeric"
                  placeholder="6-digit pincode"
                  autoComplete="postal-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  title="Enter a 6-digit pincode"
                  value={formData.pincode}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="checkout-error" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="place-order-btn"
            disabled={submitting}
          >
            {submitting ? "Placing order..." : "Place order"}
          </button>
        </form>

        <aside className="checkout-summary">
          {/* Mobile: collapsible header. Hidden on desktop. */}
          <button
            type="button"
            className={`summary-toggle ${summaryOpen ? "open" : ""}`}
            onClick={() => setSummaryOpen((open) => !open)}
            aria-expanded={summaryOpen}
            aria-controls="checkout-summary-body"
          >
            <span className="summary-toggle-label">
              {summaryOpen ? "Hide order summary" : "Show order summary"}
              <ChevronIcon />
            </span>

            <strong>{formatPrice(cartTotal)}</strong>
          </button>

          <div
            id="checkout-summary-body"
            className={`summary-body ${summaryOpen ? "open" : ""}`}
          >
            <h2 className="summary-title">Order summary</h2>

            <div className="checkout-products">
              {cartItems.map((item) => (
                <div className="checkout-product" key={item.id}>
                  <div className="checkout-product-image">
                    <SummaryImage item={item} />
                    <span>{item.quantity}</span>
                  </div>

                  <div className="checkout-product-info">
                    <strong title={item.title}>{item.title}</strong>
                    <small>{String(item.category || "").replace(/-/g, " ")}</small>
                  </div>

                  <strong>
                    {formatPrice(Number(item.price || 0) * item.quantity)}
                  </strong>
                </div>
              ))}
            </div>

            <div className="checkout-divider"></div>

            <div className="checkout-summary-row">
              <span>Subtotal</span>
              <strong>{formatPrice(cartTotal)}</strong>
            </div>

            <div className="checkout-summary-row">
              <span>Delivery</span>
              <strong>Free</strong>
            </div>

            <div className="checkout-divider"></div>

            <div className="checkout-total">
              <span>Total</span>
              <strong>{formatPrice(cartTotal)}</strong>
            </div>

            <div className="secure-checkout">
              <LockIcon />
              <div>
                <strong>Secure checkout</strong>
                <small>Your information is protected.</small>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}