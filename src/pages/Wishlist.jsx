import { Link } from "react-router-dom";
import { useWishlist } from "../context/WishlistContext.jsx";
import ProductCard from "../components/ProductCard.jsx";
import "../styles/wishlist.css";

export default function Wishlist() {
  const { wishlistItems, removeFromWishlist } = useWishlist();

  return (
    <main className="wishlist-page">
      <header className="wishlist-header">
        <div className="wishlist-heading">
          <span className="wishlist-eyebrow">YOUR COLLECTION</span>
          <h1>My Wishlist</h1>
          <p>Your saved products, all in one place.</p>
        </div>

        <div className="wishlist-summary" aria-live="polite">
          <span className="wishlist-summary-icon" aria-hidden="true">♡</span>
          <div className="wishlist-summary-text">
            <strong>{wishlistItems.length}</strong>
            <span>Saved items</span>
          </div>
        </div>
      </header>

      {wishlistItems.length > 0 ? (
        <>
          <div className="wishlist-toolbar">
            <span>
              {wishlistItems.length}{" "}
              {wishlistItems.length === 1 ? "product" : "products"}
            </span>
            <Link to="/products" className="wishlist-continue-link">
              Continue shopping →
            </Link>
          </div>

          <div className="wishlist-grid">
            {wishlistItems.map((product) => (
              <article className="wishlist-item" key={product.id}>
                <ProductCard product={product} />

                <button
                  type="button"
                  className="wishlist-remove-btn"
                  onClick={() => removeFromWishlist(product.id)}
                  aria-label={`Remove ${product.title} from wishlist`}
                >
                  <span aria-hidden="true">×</span>
                  Remove from wishlist
                </button>
              </article>
            ))}
          </div>
        </>
      ) : (
        <section className="wishlist-empty">
          <div className="wishlist-empty-icon" aria-hidden="true">♡</div>
          <span className="wishlist-empty-eyebrow">YOUR COLLECTION</span>
          <h2>Your wishlist is empty</h2>
          <p>
            Save the products you love using the heart icon.
            Your favourites will appear here.
          </p>
          <Link to="/products" className="wishlist-shop-btn">
            Explore products →
          </Link>
        </section>
      )}
    </main>
  );
}