import { useState } from "react";
import { Link } from "react-router-dom";
import { useWishlist } from "../context/WishlistContext.jsx";
import "../styles/product-card.css";

const StarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2.8l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.6l-5.8 3.1 1.1-6.5L2.6 9.6l6.5-.9L12 2.8z" />
  </svg>
);

const HeartIcon = ({ filled = false }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 20.5s-7.5-4.6-9.3-9.4C1.5 7.8 3.3 4.5 6.7 4.5c2 0 3.5 1.1 5.3 3.1 1.8-2 3.3-3.1 5.3-3.1 3.4 0 5.2 3.3 4 6.6-1.8 4.8-9.3 9.4-9.3 9.4z" />
  </svg>
);

const ImageIcon = () => (
  <svg
    width="40"
    height="40"
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

export default function ProductCard({ product }) {
  const [imgFailed, setImgFailed] = useState(false);

  const { toggleWishlist, isInWishlist } = useWishlist();
  const isWishlisted = isInWishlist(product.id);

  const inStock = product.stock > 0;
  const price = Number(product.price || 0);
  const category = String(product.category || "").replace(/-/g, " ");

  return (
    <article className="product-card">
      <Link
        to={`/products/${product.id}`}
        className="product-image-wrapper"
      >
        {imgFailed || !product.thumbnail ? (
          <span className="product-image-fallback">
            <ImageIcon />
          </span>
        ) : (
          <img
            src={product.thumbnail}
            alt={product.title}
            className="product-image"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        )}

        <span className="view-product">View product</span>
      </Link>

      <div className="product-info">
        <span className="product-category">{category}</span>

        <Link to={`/products/${product.id}`} className="product-title">
          {product.title}
        </Link>

        <div className="product-meta">
          <div className="product-rating">
            <StarIcon />
            {product.rating?.toFixed(1) || "4.5"}
          </div>

          <span className={`stock-text ${inStock ? "in-stock" : "out-of-stock"}`}>
            {inStock ? "In Stock" : "Out of Stock"}
          </span>
        </div>

        <div className="product-bottom">
          <span className="product-price">
            ₹{price.toLocaleString("en-IN")}
          </span>

          <button
            type="button"
            className={`wishlist-btn ${isWishlisted ? "active" : ""}`}
            aria-label={
              isWishlisted ? "Remove from wishlist" : "Add to wishlist"
            }
            aria-pressed={isWishlisted}
            onClick={() => toggleWishlist(product)}
          >
            <HeartIcon filled={isWishlisted} />
          </button>
        </div>
      </div>
    </article>
  );
}