import { useCallback, useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useCart } from "../context/CardContext.jsx";
import { useWishlist } from "../context/WishlistContext.jsx";
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

/* Categories and Shop share the same route. */
const noActive = () => "";

const getStoredAuth = () => {
  try {
    const token =
      localStorage.getItem("token") ||
      sessionStorage.getItem("token");

    const storedUser =
      localStorage.getItem("user") ||
      sessionStorage.getItem("user");

    if (!token || !storedUser) {
      return null;
    }

    const user = JSON.parse(storedUser);

    if (!user || typeof user !== "object") {
      return null;
    }

    return { token, user };
  } catch {
    return null;
  }
};

const getFirstName = (name) => {
  if (typeof name !== "string" || !name.trim()) {
    return "Account";
  }

  return name.trim().split(/\s+/)[0];
};

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [auth, setAuth] = useState(getStoredAuth);

  const headerRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();

  const { cartCount } = useCart();
  const { wishlistItems } = useWishlist();

  const wishlistCount = wishlistItems.length;
  const isLoggedIn = Boolean(auth?.token && auth?.user);
  const user = auth?.user;

  const accountPath = isLoggedIn ? "/account" : "/login";

  /* ---------- Synchronize authentication ---------- */

  const syncAuth = useCallback(() => {
    setAuth(getStoredAuth());
  }, []);

  useEffect(() => {
    syncAuth();
  }, [location.pathname, syncAuth]);

  useEffect(() => {
    window.addEventListener("storage", syncAuth);
    window.addEventListener("authchange", syncAuth);
    window.addEventListener("focus", syncAuth);

    return () => {
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener("authchange", syncAuth);
      window.removeEventListener("focus", syncAuth);
    };
  }, [syncAuth]);

  /* ---------- Close mobile menu ---------- */

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    const handleOutsideClick = (event) => {
      if (
        headerRef.current &&
        !headerRef.current.contains(event.target)
      ) {
        closeMenu();
      }
    };

    const handleResize = () => {
      if (window.innerWidth > 768) {
        closeMenu();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handleOutsideClick);
    window.addEventListener("resize", handleResize);

    return () => {
      document.body.style.overflow = previousOverflow;

      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handleOutsideClick);
      window.removeEventListener("resize", handleResize);
    };
  }, [menuOpen, closeMenu]);

  /* ---------- Logout ---------- */

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");

    setAuth(null);
    closeMenu();

    window.dispatchEvent(new Event("authchange"));

    navigate("/", { replace: true });
  };

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

  /* ---------- Wishlist badge ---------- */

  const wishlistBadge =
    wishlistCount > 0 ? (
      <span
        className="cart-count"
        aria-label={`${wishlistCount} items in wishlist`}
      >
        {wishlistCount > 99 ? "99+" : wishlistCount}
      </span>
    ) : null;

  return (
    <header className="navbar" ref={headerRef}>
      <div className="navbar-inner">
        {/* LOGO */}

        <Link to="/" className="logo" onClick={closeMenu}>
          <span className="logo-mark">S</span>
          <span className="logo-text">ShopSphere</span>
        </Link>

        {/* DESKTOP NAVIGATION */}

        <nav className="desktop-nav" aria-label="Main navigation">
          <NavLink to="/" end>
            Home
          </NavLink>

          <NavLink to="/products">
            Shop
          </NavLink>

          <NavLink to="/products" className={noActive}>
            Categories
          </NavLink>

          <NavLink to={accountPath}>
            Account
          </NavLink>

          {isLoggedIn && <NavLink to="/orders">My Orders</NavLink>}

          {isLoggedIn && user?.role === "admin" && (
            <NavLink to="/admin">Dashboard</NavLink>
          )}
        </nav>

        {/* DESKTOP ACTIONS */}

        <div className="desktop-actions">
          <Link
            to="/wishlist"
            className="nav-icon-btn"
            aria-label={`Wishlist${wishlistCount ? `, ${wishlistCount} items` : ""}`}
          >
            <span className="cart-icon-wrapper">
              <HeartIcon />
              {wishlistBadge}
            </span>
          </Link>

          <Link to="/cart" className="cart-btn" aria-label="Cart">
            <span className="cart-icon-wrapper">
              <CartIcon />
              {cartBadge}
            </span>
            <span>Cart</span>
          </Link>

          {isLoggedIn ? (
            <>
              <Link
                to="/account"
                className="login-btn"
                title={user.name || user.email}
              >
                {getFirstName(user.name)}
              </Link>

              <button
                type="button"
                className="login-btn"
                onClick={handleLogout}
              >
                Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="login-btn">
              Login
            </Link>
          )}
        </div>

        {/* MOBILE ACTIONS */}

        <div className="mobile-actions">
          <Link
            to="/wishlist"
            className="nav-icon-btn mobile-wishlist"
            aria-label="Wishlist"
            onClick={closeMenu}
          >
            <span className="cart-icon-wrapper">
              <HeartIcon />
              {wishlistBadge}
            </span>
          </Link>

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
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      {/* MOBILE MENU */}

      <div
        id="mobile-menu"
        className={`mobile-menu ${menuOpen ? "show" : ""}`}
        aria-hidden={!menuOpen}
      >
        <nav aria-label="Mobile navigation">
          <NavLink to="/" end onClick={closeMenu}>
            Home
          </NavLink>

          <NavLink to="/products" onClick={closeMenu}>
            Shop
          </NavLink>

          <NavLink
            to="/products"
            className={noActive}
            onClick={closeMenu}
          >
            Categories
          </NavLink>

          <NavLink to={accountPath} onClick={closeMenu}>
            Account
          </NavLink>

          {isLoggedIn && (
            <NavLink to="/orders" onClick={closeMenu}>
              My Orders
            </NavLink>
          )}

          {isLoggedIn && user?.role === "admin" && (
            <NavLink to="/admin" onClick={closeMenu}>
              Dashboard
            </NavLink>
          )}

          {isLoggedIn ? (
            <>
              <Link
                to="/account"
                className="mobile-login"
                onClick={closeMenu}
              >
                My account ({getFirstName(user.name)})
              </Link>

              <button
                type="button"
                className="mobile-login"
                onClick={handleLogout}
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="mobile-login"
              onClick={closeMenu}
            >
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}