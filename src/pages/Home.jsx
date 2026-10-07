import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getProducts } from "../services/productService";
import "../styles/home.css";

/* ---------- Inline SVG icons ---------- */

const Icon = ({ children, size = 22 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const TruckIcon = () => (
  <Icon>
    <path d="M2 6h11v10H2z" />
    <path d="M13 9h4.5L21 12.5V16h-8" />
    <circle cx="6.5" cy="17.5" r="1.8" />
    <circle cx="17" cy="17.5" r="1.8" />
  </Icon>
);

const ShieldIcon = () => (
  <Icon>
    <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z" />
    <path d="M8.5 12l2.5 2.5L15.5 10" />
  </Icon>
);

const ReturnIcon = () => (
  <Icon>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </Icon>
);

const BagIcon = ({ size = 56 }) => (
  <Icon size={size}>
    <path d="M5 8h14l-1 12H6L5 8z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </Icon>
);

const ImageIcon = () => (
  <Icon size={36}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M21 16l-5-5-8 8" />
  </Icon>
);

const SparkleIcon = () => (
  <Icon size={26}>
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
    <path d="M19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7L19 16z" />
  </Icon>
);

const BottleIcon = () => (
  <Icon size={26}>
    <path d="M10 3h4v3h-4z" />
    <path d="M8 9a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9z" />
    <path d="M8 13h8" />
  </Icon>
);

const SofaIcon = () => (
  <Icon size={26}>
    <path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3" />
    <path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3v-5z" />
    <path d="M6 18v2M18 18v2" />
  </Icon>
);

const BasketIcon = () => (
  <Icon size={26}>
    <path d="M3 10h18l-2 10H5L3 10z" />
    <path d="M8 10l3-6M16 10l-3-6" />
  </Icon>
);

const formatPrice = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

const cleanCategory = (value) => String(value || "").replace(/-/g, " ");

/* Image with fallback if it fails to load */
function FeaturedImage({ product }) {
  const [failed, setFailed] = useState(false);

  if (failed || !product.thumbnail) {
    return (
      <span className="featured-image-fallback">
        <ImageIcon />
      </span>
    );
  }

  return (
    <img
      src={product.thumbnail}
      alt={product.title}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

const CATEGORIES = [
  { name: "Beauty", text: "Everyday care & essentials", icon: <SparkleIcon /> },
  { name: "Fragrances", text: "Fresh and elegant choices", icon: <BottleIcon /> },
  { name: "Furniture", text: "Modern pieces for your space", icon: <SofaIcon /> },
  { name: "Groceries", text: "Daily essentials made easy", icon: <BasketIcon /> },
];

export default function Home() {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const loadFeaturedProducts = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      const products = await getProducts();

      // First 4 products as featured
      setFeaturedProducts(products.slice(0, 4));
    } catch (err) {
      console.error("Featured products error:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeaturedProducts();
  }, [loadFeaturedProducts]);

  const heroProduct = featuredProducts[0];
  const heroCardProduct = featuredProducts[1] || featuredProducts[0];

  return (
    <main className="home-page">
      {/* ================= HERO ================= */}

      <section className="hero-section">
        <div className="hero-content">
          <h1>
            Shop smarter.
            <br />
            <span>Live better.</span>
          </h1>

          <p>
            Discover quality products, modern essentials, and everyday
            favorites, all in one place.
          </p>

          <div className="hero-actions">
            <Link to="/products" className="primary-btn">
              Shop now
            </Link>

            <Link to="/products" className="secondary-btn">
              Explore products
            </Link>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-glow"></div>

          <div className="hero-circle">
            {heroProduct && heroProduct.thumbnail && !heroImgFailed ? (
              <img
                src={heroProduct.thumbnail}
                alt={heroProduct.title}
                className="hero-product-image"
                onError={() => setHeroImgFailed(true)}
              />
            ) : (
              <BagIcon />
            )}
          </div>

          {heroCardProduct && (
            <Link
              to={`/products/${heroCardProduct.id}`}
              className="hero-floating-card"
            >
              <span>Featured</span>
              <strong>{heroCardProduct.title}</strong>
              <em>{formatPrice(heroCardProduct.price)}</em>
            </Link>
          )}
        </div>
      </section>

      {/* ================= FEATURES ================= */}

      <section className="features-section">
        <div className="feature-card">
          <div className="feature-icon">
            <TruckIcon />
          </div>

          <div>
            <h3>Fast delivery</h3>
            <p>Quick and reliable delivery</p>
          </div>
        </div>

        <div className="feature-card">
          <div className="feature-icon">
            <ShieldIcon />
          </div>

          <div>
            <h3>Secure payment</h3>
            <p>Safe and protected checkout</p>
          </div>
        </div>

        <div className="feature-card">
          <div className="feature-icon">
            <ReturnIcon />
          </div>

          <div>
            <h3>Easy returns</h3>
            <p>Simple and hassle-free returns</p>
          </div>
        </div>
      </section>

      {/* ================= FEATURED PRODUCTS ================= */}

      <section className="featured-section">
        <div className="section-heading">
          <h2>Featured products</h2>

          <Link to="/products">View all</Link>
        </div>

        {loading ? (
          <div className="featured-grid" aria-busy="true">
            {[1, 2, 3, 4].map((item) => (
              <div className="featured-skeleton" key={item}>
                <div className="skeleton-image"></div>
                <div className="skeleton-line"></div>
                <div className="skeleton-small"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="featured-error" role="alert">
            <p>We couldn't load products right now. Check your connection and try again.</p>

            <button type="button" onClick={loadFeaturedProducts}>
              Try again
            </button>
          </div>
        ) : (
          <div className="featured-grid">
            {featuredProducts.map((product) => (
              <Link
                to={`/products/${product.id}`}
                className="featured-card"
                key={product.id}
              >
                <div className="featured-image">
                  <FeaturedImage product={product} />
                </div>

                <div className="featured-info">
                  <span>{cleanCategory(product.category)}</span>

                  <h3>{product.title}</h3>

                  <strong>{formatPrice(product.price)}</strong>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ================= CATEGORIES ================= */}

      <section className="categories-section">
        <div className="section-heading">
          <h2>Shop by category</h2>

          <Link to="/products">View all</Link>
        </div>

        <div className="category-grid">
          {CATEGORIES.map((category) => (
            <Link to="/products" className="category-card" key={category.name}>
              <div className="category-icon">{category.icon}</div>

              <h3>{category.name}</h3>
              <p>{category.text}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ================= CTA ================= */}

      <section className="home-cta">
        <h2>
          Find something
          <br />
          you'll love.
        </h2>

        <Link to="/products" className="cta-button">
          Browse products
        </Link>
      </section>
    </main>
  );
}