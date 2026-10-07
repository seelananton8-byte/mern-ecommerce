import { useEffect, useRef, useState } from "react";
import { useCart } from "../context/CardContext.jsx";
import { Link, NavLink } from "react-router-dom";
import "../styles/navbar.css";

/* ---------- Inline SVG icons (consistent on every device) ---------- */

const CartIcon = () => (
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
    <circle cx="9" cy="20" r="1.4" />
    <circle cx="18" cy="20" r="1.4" />
    <path d="M2.5 3h2.7l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.1a1.6 1.6 0 0 0 1.6-1.2L20.5 7H6" />
  </svg>
);

const HeartIcon = () => (
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
    <path d="M12 20.5s-7.5-4.6-9.3-9.4C1.5 7.8 3.3 4.5 6.7 4.5c2 0 3.5 1.1 5.3 3.1 1.8-2 3.3-3.1 5.3-3.1 3.4 0 5.2 3.3 4 6.6-1.8 4.8-9.3 9.4-9.3 9.4z" />
  </svg>
);

/* Categories shares the /products route with Shop.
   Returning an empty className stops both links from highlighting together. */
const noActive = () => "";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { cartCount } = useCart();
  const headerRef = useRef(null);

  const closeMenu = () => {
    setMenuOpen(false);
  };

  /* Close on Escape + outside click, lock body scroll while open */
  useEffect(() => {
    if (!menuOpen) return undefined;

    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };

    const onPointer = (e) => {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };

    const onResize = () => {
      if (window.innerWidth > 768) setMenuOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("resize", onResize);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("resize", onResize);
    };
  }, [menuOpen]);

  const cartBadge =
    cartCount > 0 ? (
      <span className="cart-count" aria-label={`${cartCount} items in cart`}>
        {cartCount > 99 ? "99+" : cartCount}
      </span>
    ) : null;

  return (
    <header className="navbar" ref={headerRef}>
      <div className="navbar-inner">
        {/* Logo */}
        <Link to="/" className="logo" onClick={closeMenu}>
          <span className="logo-mark">S</span>
          <span className="logo-text">ShopSphere</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="desktop-nav" aria-label="Main">
          <NavLink to="/" end>
            Home
          </NavLink>

          <NavLink to="/products">Shop</NavLink>

          <NavLink to="/products" className={noActive}>
            Categories
          </NavLink>

          <NavLink to="/login">Account</NavLink>
        </nav>

        {/* Desktop Actions */}
        <div className="desktop-actions">
          <button type="button" className="nav-icon-btn" aria-label="Wishlist">
            <HeartIcon />
          </button>

          <Link to="/cart" className="cart-btn" aria-label="Cart">
            <span className="cart-icon-wrapper">
              <CartIcon />
              {cartBadge}
            </span>
            <span>Cart</span>
          </Link>

          <Link to="/login" className="login-btn">
            Login
          </Link>
        </div>

        {/* Mobile Actions */}
        <div className="mobile-actions">
          <Link
            to="/cart"
            className="mobile-cart"
            aria-label="Cart"
            onClick={closeMenu}
          >
            <span className="cart-icon-wrapper">
              <CartIcon />
              {cartBadge}
            </span>
          </Link>

          <button
            type="button"
            className={`menu-btn ${menuOpen ? "open" : ""}`}
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        id="mobile-menu"
        className={`mobile-menu ${menuOpen ? "show" : ""}`}
      >
        <nav aria-label="Mobile">
          <NavLink to="/" end onClick={closeMenu}>
            Home
          </NavLink>

          <NavLink to="/products" onClick={closeMenu}>
            Shop
          </NavLink>

          <NavLink to="/products" className={noActive} onClick={closeMenu}>
            Categories
          </NavLink>

          <NavLink to="/login" onClick={closeMenu}>
            Account
          </NavLink>

          <Link to="/login" className="mobile-login" onClick={closeMenu}>
            Login
          </Link>
        </nav>
      </div>
    </header>
  );
}