import { useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CardContext.jsx";
import "../styles/cart.css";

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

const ImageIcon = () => (
  <svg
    width="32"
    height="32"
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

const TrashIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M6 6l1 14h10l1-14" />
  </svg>
);

const formatPrice = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

/* Image with fallback if it fails to load */
function CartItemImage({ item }) {
  const [failed, setFailed] = useState(false);

  if (failed || !item.thumbnail) {
    return (
      <span className="cart-image-fallback">
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

export default function Cart() {
  const {
    cartItems,
    cartCount,
    cartTotal,
    increaseQuantity,
    decreaseQuantity,
    removeFromCart,
  } = useCart();

  if (cartItems.length === 0) {
    return (
      <main className="cart-page">
        <section className="empty-cart">
          <div className="empty-cart-icon">
            <CartIcon />
          </div>

          <h1>Your cart is empty</h1>

          <p>Looks like you haven't added anything to your cart yet.</p>

          <Link to="/products" className="continue-shopping-btn">
            Start shopping
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="cart-page">
      <div className="cart-header">
        <div>
          <h1>Your shopping cart</h1>
          <p>Review your items before checkout.</p>
        </div>

        <strong>
          {cartCount} {cartCount === 1 ? "item" : "items"}
        </strong>
      </div>

      <section className="cart-layout">
        <div className="cart-items">
          {cartItems.map((item) => {
            const stock = Number(item.stock);
            const atMax = Number.isFinite(stock) && stock > 0 && item.quantity >= stock;

            return (
              <article className="cart-item" key={item.id}>
                <Link
                  to={`/products/${item.id}`}
                  className="cart-item-image"
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  <CartItemImage item={item} />
                </Link>

                <div className="cart-item-info">
                  <span className="cart-item-category">
                    {String(item.category || "").replace(/-/g, " ")}
                  </span>

                  <Link to={`/products/${item.id}`} className="cart-item-title">
                    {item.title}
                  </Link>

                  <strong className="cart-item-price">
                    {formatPrice(item.price)}
                  </strong>

                  <div className="cart-item-actions">
                    <div className="cart-quantity" role="group" aria-label={`Quantity for ${item.title}`}>
                      <button
                        type="button"
                        onClick={() => decreaseQuantity(item.id)}
                        aria-label={`Decrease quantity of ${item.title}`}
                      >
                        −
                      </button>

                      <span aria-live="polite">{item.quantity}</span>

                      <button
                        type="button"
                        onClick={() => increaseQuantity(item.id)}
                        disabled={atMax}
                        aria-label={`Increase quantity of ${item.title}`}
                        title={atMax ? "Maximum stock reached" : undefined}
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      className="remove-btn"
                      onClick={() => removeFromCart(item.id)}
                      aria-label={`Remove ${item.title} from cart`}
                    >
                      <TrashIcon />
                      Remove
                    </button>
                  </div>

                  {atMax && (
                    <p className="stock-note">Maximum available stock added</p>
                  )}
                </div>

                <div className="cart-item-total">
                  <span className="cart-item-total-label">Item total</span>
                  {formatPrice(Number(item.price || 0) * item.quantity)}
                </div>
              </article>
            );
          })}
        </div>

        <aside className="cart-summary">
          <h2>Order summary</h2>

          <div className="summary-row">
            <span>Subtotal</span>
            <strong>{formatPrice(cartTotal)}</strong>
          </div>

          <div className="summary-row">
            <span>Delivery</span>
            <strong>Free</strong>
          </div>

          <div className="summary-divider"></div>

          <div className="summary-total">
            <span>Total</span>
            <strong>{formatPrice(cartTotal)}</strong>
          </div>

          <Link to="/checkout" className="checkout-btn">
            Proceed to checkout
          </Link>

          <Link to="/products" className="continue-link">
            Continue shopping
          </Link>
        </aside>
      </section>
    </main>
  );
}