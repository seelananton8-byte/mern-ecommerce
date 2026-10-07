import { useEffect, useRef, useState } from "react";
import { useCart } from "../context/CardContext.jsx";
import { Link, NavLink } from "react-router-dom";
import "../styles/navbar.css";

/* ---------- Inline SVG icons ---------- */

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

  /* ---------- Close mobile menu ---------- */
  const closeMenu = () => {
    setMenuOpen(false);
  };

  /* ---------- Mobile menu behavior ---------- */
  useEffect(() => {
    if (!menuOpen) return undefined;

    /* Escape key */
    const onKey = (e) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
    };

    /* Click outside navbar */
    const onPointer = (e) => {
      if (
        headerRef.current &&
        !headerRef.current.contains(e.target)
      ) {
        setMenuOpen(false);
      }
    };

    /* Close menu when switching to desktop */
    const onResize = () => {
      if (window.innerWidth > 768) {
        setMenuOpen(false);
      }
    };

    /* Prevent body scrolling while menu is open */
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

  /* ---------- Cart badge ---------- */
  const cartBadge =
    cartCount > 0 ? (
      <span
        className="cart-count"
        aria-label={`${cartCount} items in cart`}
      >
        {cartCount > 99 ? "99+" : cartCount}
      </span>
    ) : null;

  return (
    <header className="navbar" ref={headerRef}>
      <div className="navbar-inner">

        {/* ================= LOGO ================= */}

        <Link
          to="/"
          className="logo"
          onClick={closeMenu}
        >
          <span className="logo-mark">S</span>

          <span className="logo-text">
            ShopSphere
          </span>
        </Link>


        {/* ================= DESKTOP NAVIGATION ================= */}

        <nav
          className="desktop-nav"
          aria-label="Main"
        >
          <NavLink to="/" end>
            Home
          </NavLink>

          <NavLink to="/products">
            Shop
          </NavLink>

          <NavLink
            to="/products"
            className={noActive}
          >
            Categories
          </NavLink>

          <NavLink to="/login">
            Account
          </NavLink>
        </nav>


        {/* ================= DESKTOP ACTIONS ================= */}

        <div className="desktop-actions">

          {/* Wishlist */}
          <button
            type="button"
            className="nav-icon-btn"
            aria-label="Wishlist"
          >
            <HeartIcon />
          </button>

          {/* Cart */}
          <Link
            to="/cart"
            className="cart-btn"
            aria-label="Cart"
          >
            <span className="cart-icon-wrapper">
              <CartIcon />
              {cartBadge}
            </span>

            <span>
              Cart
            </span>
          </Link>

          {/* Login */}
          <Link
            to="/login"
            className="login-btn"
          >
            Login
          </Link>

        </div>


        {/* ================= MOBILE ACTIONS ================= */}

        <div className="mobile-actions">

          {/* Mobile Wishlist */}
          <button
            type="button"
            className="nav-icon-btn mobile-wishlist"
            aria-label="Wishlist"
          >
            <HeartIcon />
          </button>


          {/* Mobile Cart */}
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


          {/* Hamburger */}
          <button
            type="button"
            className={`menu-btn ${
              menuOpen ? "open" : ""
            }`}
            onClick={() =>
              setMenuOpen((open) => !open)
            }
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


      {/* ================= MOBILE MENU ================= */}

      <div
        id="mobile-menu"
        className={`mobile-menu ${
          menuOpen ? "show" : ""
        }`}
      >
        <nav aria-label="Mobile">

          {/* Home */}
          <NavLink
            to="/"
            end
            onClick={closeMenu}
          >
            Home
          </NavLink>


          {/* Shop */}
          <NavLink
            to="/products"
            onClick={closeMenu}
          >
            Shop
          </NavLink>


          {/* Categories */}
          <NavLink
            to="/products"
            className={noActive}
            onClick={closeMenu}
          >
            Categories
          </NavLink>


          {/* Account */}
          <NavLink
            to="/login"
            onClick={closeMenu}
          >
            Account
          </NavLink>


          {/* Login */}
          <Link
            to="/login"
            className="mobile-login"
            onClick={closeMenu}
          >
            Login
          </Link>

        </nav>
      </div>

    </header>
  );
}
