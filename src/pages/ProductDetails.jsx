import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getProductById } from "../services/productService";
import { useCart } from "../context/CardContext.jsx";
import "../styles/product-details.css";

/* ---------- Inline SVG icons ---------- */

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
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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

const formatPrice = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

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

  const addedTimer = useRef(null);

  useEffect(() => {
    let ignore = false;

    async function loadProduct() {
      // reset everything when the product id changes
      setLoading(true);
      setError("");
      setQuantity(1);
      setActiveImage(0);
      setImageFailed(false);
      setAdded(false);

      try {
        const data = await getProductById(id);
        if (!ignore) setProduct(data);
      } catch (err) {
        console.error(err);
        if (!ignore) {
          setProduct(null);
          setError("Unable to load product.");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadProduct();

    return () => {
      ignore = true;
    };
  }, [id]);

  /* clear the "Added" timer when leaving the page */
  useEffect(() => {
    return () => clearTimeout(addedTimer.current);
  }, []);

  if (loading) {
    return (
      <main className="product-details-page">
        <div className="details-loading" aria-busy="true" aria-label="Loading product">
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
    if (quantity < product.stock) {
      setQuantity((current) => current + 1);
    }
  };

  const decreaseQuantity = () => {
    if (quantity > 1) {
      setQuantity((current) => current - 1);
    }
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

  const selectImage = (index) => {
    setActiveImage(index);
    setImageFailed(false);
  };

  return (
    <main className="product-details-page">
      {/* Breadcrumb */}
      <nav className="product-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/products">Products</Link>
        <span>/</span>
        <span className="breadcrumb-current">{product.title}</span>
      </nav>

      <section className="product-details">
        {/* Image */}
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
                  className={`details-thumb ${index === activeImage ? "active" : ""}`}
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

        {/* Information */}
        <div className="details-info">
          <span className="details-category">
            {String(product.category || "").replace(/-/g, " ")}
          </span>

          <h1>{product.title}</h1>

          <div className="details-rating">
            <span className="rating-stars">
              <StarIcon />
            </span>
            <strong>{product.rating?.toFixed(1) || "4.5"}</strong>
            <span>Customer rating</span>
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

          {/* Quantity */}
          <div className="quantity-section">
            <span>Quantity</span>

            <div className="quantity-control" role="group" aria-label="Quantity">
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
                disabled={quantity >= product.stock}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="details-actions">
            <button
              type="button"
              className={`add-cart-btn ${added ? "added" : ""}`}
              onClick={handleAddToCart}
              disabled={!product.stock}
            >
              {added ? <CheckIcon /> : <CartIcon />}
              <span aria-live="polite">{added ? "Added to cart" : "Add to cart"}</span>
            </button>

            <button
              type="button"
              className="buy-now-btn"
              onClick={handleBuyNow}
              disabled={!product.stock}
            >
              Buy now
            </button>
          </div>

          {/* Benefits */}
          <div className="product-benefits">
            <div>
              <span>
                <TruckIcon />
              </span>
              <div>
                <strong>Fast delivery</strong>
                <small>Quick &amp; reliable shipping</small>
              </div>
            </div>

            <div>
              <span>
                <ReturnIcon />
              </span>
              <div>
                <strong>Easy returns</strong>
                <small>Simple return process</small>
              </div>
            </div>

            <div>
              <span>
                <ShieldIcon />
              </span>
              <div>
                <strong>Secure payment</strong>
                <small>Safe checkout experience</small>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}