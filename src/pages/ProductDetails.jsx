import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getProductById } from "../services/productService";
import { getToken } from "../services/api";
import {
  deleteReview,
  getMyReview,
  getReviews,
  saveReview,
} from "../services/reviewService";
import { useCart } from "../context/CardContext.jsx";
import "../styles/product-details.css";
import "../styles/product-reviews.css";

/* SVG icons */

const Icon = ({ children, size = 20, strokeWidth = 1.8 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const StarIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M12 2.8l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.6l-5.8 3.1 1.1-6.5L2.6 9.6l6.5-.9L12 2.8z" />
  </svg>
);

const CartIcon = () => (
  <Icon>
    <circle cx="9" cy="20" r="1.4" />
    <circle cx="18" cy="20" r="1.4" />
    <path d="M2.5 3h2.7l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.1a1.6 1.6 0 0 0 1.6-1.2L20.5 7H6" />
  </Icon>
);

const CheckIcon = () => (
  <Icon strokeWidth={2.4}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
);

const TruckIcon = () => (
  <Icon>
    <path d="M2 6h11v10H2z" />
    <path d="M13 9h4.5L21 12.5V16h-8" />
    <circle cx="6.5" cy="17.5" r="1.8" />
    <circle cx="17" cy="17.5" r="1.8" />
  </Icon>
);

const ReturnIcon = () => (
  <Icon>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </Icon>
);

const ShieldIcon = () => (
  <Icon>
    <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z" />
    <path d="M8.5 12l2.5 2.5L15.5 10" />
  </Icon>
);

const ImageIcon = () => (
  <Icon size={48} strokeWidth={1.3}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M21 16l-5-5-8 8" />
  </Icon>
);

const AlertIcon = () => (
  <Icon size={32} strokeWidth={1.6}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5" />
    <path d="M12 16.5v.01" />
  </Icon>
);

const formatPrice = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN")}`;

const EMPTY_SUMMARY = { average: 0, count: 0, distribution: {} };

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeImage, setActiveImage] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const [added, setAdded] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewPages, setReviewPages] = useState(1);
  const [myReview, setMyReview] = useState(null);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const addedTimer = useRef(null);
  const loggedIn = Boolean(getToken());

  // Load the reviews (and my own review when logged in) for this product.
  useEffect(() => {
    let ignore = false;

    async function loadReviews() {
      setReviews([]);
      setSummary(EMPTY_SUMMARY);
      setReviewPage(1);
      setReviewPages(1);
      setMyReview(null);
      setReviewText("");
      setReviewRating(5);
      setReviewMessage("");

      try {
        const data = await getReviews(id, 1);

        if (!ignore) {
          setReviews(data.reviews || []);
          setSummary(data.summary || EMPTY_SUMMARY);
          setReviewPages(data.pages || 1);
        }
      } catch (error) {
        console.error("Unable to load reviews:", error);
      }

      if (!getToken()) return;

      try {
        const data = await getMyReview(id);

        if (!ignore && data.review) {
          setMyReview(data.review);
          setReviewRating(data.review.rating);
          setReviewText(data.review.comment);
        }
      } catch (error) {
        console.error("Unable to load your review:", error);
      }
    }

    loadReviews();

    return () => {
      ignore = true;
    };
  }, [id]);

  // Load product details.
  useEffect(() => {
    let ignore = false;

    async function loadProduct() {
      setLoading(true);
      setError("");
      setQuantity(1);
      setActiveImage(0);
      setImageFailed(false);
      setAdded(false);

      try {
        const data = await getProductById(id);

        if (!ignore) {
          setProduct(data);
        }
      } catch (err) {
        console.error(err);

        if (!ignore) {
          setProduct(null);
          setError("Unable to load product.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadProduct();

    return () => {
      ignore = true;
    };
  }, [id]);

  // Clear the cart notification timer when leaving the page.
  useEffect(() => {
    return () => clearTimeout(addedTimer.current);
  }, []);

  const refreshReviews = async () => {
    const data = await getReviews(id, 1);

    setReviews(data.reviews || []);
    setSummary(data.summary || EMPTY_SUMMARY);
    setReviewPage(1);
    setReviewPages(data.pages || 1);
  };

  const handleReviewSubmit = async (event) => {
    event.preventDefault();

    const text = reviewText.trim();

    if (text.length < 3) {
      setReviewMessage("Please write at least 3 characters.");
      return;
    }

    setReviewBusy(true);
    setReviewMessage("");

    try {
      const data = await saveReview(id, {
        rating: reviewRating,
        comment: text,
      });

      setMyReview(data.review);
      setReviewMessage(data.message || "Your review was saved.");
      await refreshReviews();
    } catch (error) {
      setReviewMessage(
        error.message || "Unable to save your review. Please try again."
      );
    } finally {
      setReviewBusy(false);
    }
  };

  const handleReviewDelete = async () => {
    if (!myReview || !window.confirm("Delete your review?")) return;

    setReviewBusy(true);
    setReviewMessage("");

    try {
      await deleteReview(id, myReview.id);

      setMyReview(null);
      setReviewText("");
      setReviewRating(5);
      setReviewMessage("Your review was deleted.");
      await refreshReviews();
    } catch (error) {
      setReviewMessage(error.message || "Unable to delete your review.");
    } finally {
      setReviewBusy(false);
    }
  };

  const loadMoreReviews = async () => {
    const next = reviewPage + 1;

    try {
      const data = await getReviews(id, next);

      setReviews((current) => [...current, ...(data.reviews || [])]);
      setReviewPage(next);
      setReviewPages(data.pages || next);
    } catch (error) {
      setReviewMessage(error.message || "Unable to load more reviews.");
    }
  };

  const selectImage = (index) => {
    setActiveImage(index);
    setImageFailed(false);
  };

  const handleAddToCart = () => {
    addToCart(product, quantity);

    setAdded(true);
    clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAdded(false), 1800);
  };

  const handleBuyNow = () => {
    addToCart(product, quantity);
    navigate("/checkout");
  };

  if (loading) {
    return (
      <main className="product-details-page">
        <div
          className="details-loading"
          aria-busy="true"
          aria-label="Loading product"
        >
          <div className="loading-image"></div>
          <div className="loading-info">
            <div className="loading-line short"></div>
            <div className="loading-line title"></div>
            <div className="loading-line medium"></div>
            <div className="loading-line price"></div>
            <div className="loading-line"></div>
            <div className="loading-line"></div>
            <div className="loading-line button"></div>
          </div>
        </div>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="product-details-page">
        <div className="details-error" role="alert">
          <div className="details-error-icon">
            <AlertIcon />
          </div>
          <h2>Product not found</h2>
          <p>{error || "This product may have been removed."}</p>
          <Link to="/products">Back to products</Link>
        </div>
      </main>
    );
  }

  const stock = Number(product.stock) || 0;
  const inStock = stock > 0;
  const lowStock = inStock && stock <= 5;

  const images =
    Array.isArray(product.images) && product.images.length > 0
      ? product.images
      : product.thumbnail
        ? [product.thumbnail]
        : [];

  const currentImage = images[activeImage] || product.thumbnail;

  const increaseQuantity = () => {
    if (quantity < stock) {
      setQuantity((current) => current + 1);
    }
  };

  const decreaseQuantity = () => {
    if (quantity > 1) {
      setQuantity((current) => current - 1);
    }
  };

  return (
    <main className="product-details-page">
      <nav className="product-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/products">Products</Link>
        <span>/</span>
        <span className="breadcrumb-current">{product.title}</span>
      </nav>

      <section className="product-details">
        {/* Product images */}
        <div className="details-image-section">
          <div className="details-image-wrapper">
            {imageFailed || !currentImage ? (
              <span className="details-image-fallback">
                <ImageIcon />
              </span>
            ) : (
              <img
                key={currentImage}
                src={currentImage}
                alt={product.title}
                onError={() => setImageFailed(true)}
              />
            )}
          </div>

          {images.length > 1 && (
            <div className="details-thumbs" role="list">
              {images.slice(0, 5).map((src, index) => (
                <button
                  type="button"
                  role="listitem"
                  key={src}
                  className={`details-thumb ${
                    index === activeImage ? "active" : ""
                  }`}
                  onClick={() => selectImage(index)}
                  aria-label={`Show image ${index + 1}`}
                  aria-current={index === activeImage}
                >
                  <img src={src} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product information */}
        <div className="details-info">
          <span className="details-category">
            {String(product.category || "").replace(/-/g, " ")}
          </span>

          <h1>{product.title}</h1>

          <div className="details-rating">
            <span className="rating-stars">
              <StarIcon />
            </span>

            <strong>
              {summary.count > 0 ? summary.average.toFixed(1) : "New"}
            </strong>

            <span>
              {summary.count > 0
                ? `${summary.count} customer ${
                    summary.count === 1 ? "review" : "reviews"
                  }`
                : "No ratings yet"}
            </span>
          </div>

          <div className="details-price">{formatPrice(product.price)}</div>

          <p className="details-description">{product.description}</p>

          <div
            className={`details-stock ${
              !inStock ? "out" : lowStock ? "low" : ""
            }`}
          >
            <span className="stock-dot"></span>
            {!inStock
              ? "Out of stock"
              : lowStock
                ? `Only ${stock} left`
                : `${stock} items available`}
          </div>

          {/* Quantity selector */}
          <div className="quantity-section">
            <span>Quantity</span>

            <div
              className="quantity-control"
              role="group"
              aria-label="Quantity"
            >
              <button
                type="button"
                onClick={decreaseQuantity}
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
              >
                −
              </button>

              <strong aria-live="polite">{quantity}</strong>

              <button
                type="button"
                onClick={increaseQuantity}
                disabled={quantity >= stock}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </div>

          {/* Cart actions */}
          <div className="details-actions">
            <button
              type="button"
              className={`add-cart-btn ${added ? "added" : ""}`}
              onClick={handleAddToCart}
              disabled={!inStock}
            >
              {added ? <CheckIcon /> : <CartIcon />}
              <span aria-live="polite">
                {added ? "Added to cart" : "Add to cart"}
              </span>
            </button>

            <button
              type="button"
              className="buy-now-btn"
              onClick={handleBuyNow}
              disabled={!inStock}
            >
              Buy now
            </button>
          </div>

          {/* Benefits */}
          <div className="product-benefits">
            <div>
              <span><TruckIcon /></span>
              <div>
                <strong>Fast delivery</strong>
                <small>Quick &amp; reliable shipping</small>
              </div>
            </div>

            <div>
              <span><ReturnIcon /></span>
              <div>
                <strong>Easy returns</strong>
                <small>Simple return process</small>
              </div>
            </div>

            <div>
              <span><ShieldIcon /></span>
              <div>
                <strong>Secure payment</strong>
                <small>Safe checkout experience</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Customer reviews */}
      <section className="product-reviews">
        <div className="reviews-header">
          <div>
            <span className="details-category">CUSTOMER FEEDBACK</span>
            <h2>Customer Reviews</h2>
            <p>Share your experience with this product.</p>
          </div>

          <div className="reviews-summary">
            <strong>{summary.count}</strong>
            <span>{summary.count === 1 ? "Review" : "Reviews"}</span>
          </div>
        </div>

        {loggedIn ? (
          <form className="review-form" onSubmit={handleReviewSubmit}>
            <label htmlFor="review-rating">Your rating</label>
            <select
              id="review-rating"
              value={reviewRating}
              onChange={(event) =>
                setReviewRating(Number(event.target.value))
              }
            >
              <option value={5}>★★★★★ — Excellent</option>
              <option value={4}>★★★★ — Very good</option>
              <option value={3}>★★★ — Good</option>
              <option value={2}>★★ — Fair</option>
              <option value={1}>★ — Poor</option>
            </select>

            <label htmlFor="review-text">Your review</label>
            <textarea
              id="review-text"
              value={reviewText}
              onChange={(event) => setReviewText(event.target.value)}
              placeholder="Write your product review"
              rows={4}
              maxLength={1000}
              required
            />

            <button
              type="submit"
              className="submit-review-btn"
              disabled={reviewBusy}
            >
              {reviewBusy
                ? "Saving..."
                : myReview
                  ? "Update review"
                  : "Submit review"}
            </button>

            {myReview && (
              <button
                type="button"
                className="submit-review-btn"
                style={{
                  marginLeft: 8,
                  background: "#fff",
                  color: "#dc2626",
                  border: "1px solid #fecaca",
                }}
                onClick={handleReviewDelete}
                disabled={reviewBusy}
              >
                Delete my review
              </button>
            )}

            {reviewMessage && (
              <p className="review-message" role="status">
                {reviewMessage}
              </p>
            )}
          </form>
        ) : (
          <div className="review-login">
            <span className="review-login-icon" aria-hidden="true">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="4" y="11" width="16" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            </span>

            <div className="review-login-text">
              <h3>Want to share your experience?</h3>
              <p>Log in to rate and review this product.</p>
            </div>

            <div className="review-login-actions">
              <Link
                className="review-login-btn"
                to="/login"
                state={{ from: `/products/${id}` }}
              >
                Log in
              </Link>
              <Link className="review-login-btn ghost" to="/register">
                Create account
              </Link>
            </div>
          </div>
        )}

        <div className="reviews-list">
          {reviews.length === 0 ? (
            <p className="no-reviews">
              No reviews yet. Be the first to share your feedback!
            </p>
          ) : (
            reviews.map((review) => (
              <article className="review-card" key={review.id}>
                <div className="review-card-header">
                  <strong>{review.name}</strong>
                  <time>
                    {new Date(review.createdAt).toLocaleDateString("en-IN")}
                  </time>
                </div>

                <div
                  className="review-stars"
                  aria-label={`${review.rating} out of 5 stars`}
                >
                  {"★".repeat(review.rating)}
                  <span>{"★".repeat(5 - review.rating)}</span>
                </div>

                <p>{review.comment}</p>

                {review.verifiedPurchase && (
                  <small style={{ color: "#16a34a", fontWeight: 600 }}>
                    Verified purchase
                  </small>
                )}
              </article>
            ))
          )}
        </div>

        {reviewPage < reviewPages && (
          <button
            type="button"
            className="submit-review-btn"
            onClick={loadMoreReviews}
          >
            Load more reviews
          </button>
        )}
      </section>
    </main>
  );
}