import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { getToken } from "../services/api";
import {
  addWishlistItem,
  fetchWishlist,
  mergeWishlist,
  removeWishlistItem,
} from "../services/wishlistService";

const WishlistContext = createContext(null);
const STORAGE_KEY = "wishlistItems";
const MAX_ITEMS = 100;

// Visitors who are not logged in keep their wishlist in this browser.
function loadGuestWishlist() {
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
  const [wishlistItems, setWishlistItems] = useState(() =>
    getToken() ? [] : loadGuestWishlist()
  );
  const [loggedIn, setLoggedIn] = useState(() => Boolean(getToken()));

  const itemsRef = useRef(wishlistItems);
  const tokenRef = useRef(getToken());
  const syncRun = useRef(0);

  const setItems = useCallback((next) => {
    itemsRef.current = next;
    setWishlistItems(next);
  }, []);

  // Guest wishlist is saved in the browser a logged in wishlist lives in MongoDB.
  useEffect(() => {
    if (loggedIn) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(wishlistItems));
    } catch {
      // Wishlist still works in memory.
    }
  }, [wishlistItems, loggedIn]);

  // Moves the guest wishlist into the account, then loads the account wishlist.
  const syncWithServer = useCallback(async () => {
    const run = ++syncRun.current;

    try {
      const guestIds = loadGuestWishlist()
        .map((item) => String(item.id))
        .slice(0, MAX_ITEMS);

      if (guestIds.length > 0) {
        await mergeWishlist(guestIds);
        localStorage.removeItem(STORAGE_KEY);
      }

      const items = await fetchWishlist();

      if (run === syncRun.current) setItems(items);
    } catch (error) {
      console.error("Unable to sync wishlist:", error);
    }
  }, [setItems]);

  // Load the account wishlist when the page opens while logged in.
  useEffect(() => {
    if (getToken()) syncWithServer();
  }, [syncWithServer]);

  // React to login and logout
  useEffect(() => {
    const onAuthChange = () => {
      const token = getToken();

      if (token === tokenRef.current) return;
      tokenRef.current = token;

      if (token) {
        setLoggedIn(true);
        syncWithServer();
      } else {
        syncRun.current += 1;
        localStorage.removeItem(STORAGE_KEY);
        setLoggedIn(false);
        setItems([]);
      }
    };

    window.addEventListener("authchange", onAuthChange);
    window.addEventListener("storage", onAuthChange);

    return () => {
      window.removeEventListener("authchange", onAuthChange);
      window.removeEventListener("storage", onAuthChange);
    };
  }, [syncWithServer, setItems]);

  const addToWishlist = useCallback(
    (product) => {
      if (!product || product.id === undefined) return;
      if (itemsRef.current.some((item) => item.id === product.id)) return;

      setItems([...itemsRef.current, product]);

      if (getToken()) {
        addWishlistItem(product.id).catch((error) => {
          console.error("Unable to save wishlist item:", error);
          syncWithServer();
        });
      }
    },
    [setItems, syncWithServer]
  );

  const removeFromWishlist = useCallback(
    (productId) => {
      setItems(itemsRef.current.filter((item) => item.id !== productId));

      if (getToken()) {
        removeWishlistItem(productId).catch((error) => {
          console.error("Unable to remove wishlist item:", error);
          syncWithServer();
        });
      }
    },
    [setItems, syncWithServer]
  );

  const toggleWishlist = useCallback(
    (product) => {
      if (!product || product.id === undefined) return;

      if (itemsRef.current.some((item) => item.id === product.id)) {
        removeFromWishlist(product.id);
      } else {
        addToWishlist(product);
      }
    },
    [addToWishlist, removeFromWishlist]
  );

  const isInWishlist = useCallback(
    (productId) => wishlistItems.some((item) => item.id === productId),
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
    throw new Error("useWishlist must be used inside <WishlistProvider>");
  }

  return context;
}