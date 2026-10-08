import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const WishlistContext = createContext(null);
const STORAGE_KEY = "wishlistItems";

function loadWishlist() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];

    return Array.isArray(parsed)
      ? parsed.filter((item) => item && item.id !== undefined)
      : [];
  } catch {
    return [];
  }
}

export function WishlistProvider({ children }) {
  const [wishlistItems, setWishlistItems] = useState(loadWishlist);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(wishlistItems)
      );
    } catch {
      // Wishlist still works in memory.
    }
  }, [wishlistItems]);

  const addToWishlist = useCallback((product) => {
    if (!product || product.id === undefined) return;

    setWishlistItems((items) =>
      items.some((item) => item.id === product.id)
        ? items
        : [...items, product]
    );
  }, []);

  const removeFromWishlist = useCallback((productId) => {
    setWishlistItems((items) =>
      items.filter((item) => item.id !== productId)
    );
  }, []);

  const toggleWishlist = useCallback((product) => {
    if (!product || product.id === undefined) return;

    setWishlistItems((items) =>
      items.some((item) => item.id === product.id)
        ? items.filter((item) => item.id !== product.id)
        : [...items, product]
    );
  }, []);

  const isInWishlist = useCallback(
    (productId) =>
      wishlistItems.some((item) => item.id === productId),
    [wishlistItems]
  );

  return (
    <WishlistContext.Provider
      value={{
        wishlistItems,
        addToWishlist,
        removeFromWishlist,
        toggleWishlist,
        isInWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);

  if (!context) {
    throw new Error(
      "useWishlist must be used inside <WishlistProvider>"
    );
  }

  return context;
}