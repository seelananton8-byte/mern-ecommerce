import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getProducts } from "../services/productService";
import ProductCard from "../components/ProductCard";
import "../styles/products.css";

/* ---------- Inline SVG icons ---------- */

const SearchIcon = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

const CloseIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

/* "mens-shirts" -> "Mens shirts" */
const prettyCategory = (value) => {
  const text = String(value || "").replace(/-/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("default");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* Category lives in the URL (?category=beauty), so links from
     Home / Navbar can open a filtered list and the back button works. */
  const urlCategory = searchParams.get("category") || "all";

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getProducts();
      setProducts(data);
    } catch (err) {
      console.error(err);
      setError("Unable to load products.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const categories = useMemo(() => {
    return ["all", ...new Set(products.map((product) => product.category))];
  }, [products]);

  /* unknown category in the URL falls back to "all" */
  const category = categories.includes(urlCategory) ? urlCategory : "all";

  const setCategory = (value) => {
    const next = new URLSearchParams(searchParams);

    if (value === "all") {
      next.delete("category");
    } else {
      next.set("category", value);
    }

    setSearchParams(next, { replace: true });
  };

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    let result = products.filter((product) => {
      const matchesSearch = String(product.title || "")
        .toLowerCase()
        .includes(query);

      const matchesCategory = category === "all" || product.category === category;

      return matchesSearch && matchesCategory;
    });

    if (sort === "price-low") {
      result.sort((a, b) => a.price - b.price);
    }

    if (sort === "price-high") {
      result.sort((a, b) => b.price - a.price);
    }

    if (sort === "name") {
      result.sort((a, b) => String(a.title).localeCompare(String(b.title)));
    }

    return result;
  }, [products, search, category, sort]);

  const hasFilters = search.trim() !== "" || category !== "all" || sort !== "default";

  const clearFilters = () => {
    setSearch("");
    setSort("default");
    setCategory("all");
  };

  return (
    <main className="products-page">
      {/* Header */}
      <section className="products-header">
        <div>
          <h1>Shop products</h1>

          <p>Discover products selected for your everyday needs.</p>
        </div>

        <div className="product-count" aria-live="polite">
          <strong>{filteredProducts.length}</strong>
          <span>{filteredProducts.length === 1 ? "Product" : "Products"}</span>
        </div>
      </section>

      {/* Controls */}
      <section className="products-controls" aria-label="Search and filters">
        <div className="search-box">
          <SearchIcon />

          <input
            type="search"
            placeholder="Search products..."
            aria-label="Search products"
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {search && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <CloseIcon />
            </button>
          )}
        </div>

        <div className="filter-group">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filter by category"
          >
            {categories.map((item) => (
              <option value={item} key={item}>
                {item === "all" ? "All categories" : prettyCategory(item)}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort products"
          >
            <option value="default">Sort by</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
            <option value="name">Name: A to Z</option>
          </select>
        </div>
      </section>

      {hasFilters && !loading && !error && (
        <div className="products-active">
          <span>
            Showing {filteredProducts.length} of {products.length}
          </span>

          <button type="button" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="products-message error" role="alert">
          <p>{error}</p>

          <button type="button" onClick={loadProducts}>
            Try again
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="products-grid" aria-busy="true">
          {Array.from({ length: 8 }).map((_, index) => (
            <div className="product-skeleton" key={index}>
              <div className="skeleton-product-image"></div>
              <div className="skeleton-product-line"></div>
              <div className="skeleton-product-small"></div>
            </div>
          ))}
        </div>
      )}

      {/* Products */}
      {!loading && !error && (
        <>
          {filteredProducts.length > 0 ? (
            <div className="products-grid">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="products-message empty">
              <div className="products-empty-icon">
                <SearchIcon size={30} />
              </div>

              <h2>No products found</h2>

              <p>Try another search or category.</p>

              {hasFilters && (
                <button type="button" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}