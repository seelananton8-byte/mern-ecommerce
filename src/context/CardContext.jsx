import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const CartContext = createContext(null);

const STORAGE_KEY = "cartItems";

/* ---------- Safe localStorage helpers ---------- */

function loadCart() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];

    if (!Array.isArray(parsed)) return [];

    // keep only valid items
    return parsed
      .filter((item) => item && item.id !== undefined)
      .map((item) => ({
        ...item,
        price: Number(item.price) || 0,
        quantity: Math.max(1, Math.floor(Number(item.quantity)) || 1),
      }));
  } catch {
    return [];
  }
}

function saveCart(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // storage full or blocked (private mode): cart still works in memory
  }
}

/* Max quantity allowed for an item.
   If the product has no stock info, there is no limit. */
function getMaxQty(item) {
  const stock = Number(item.stock);
  return Number.isFinite(stock) && stock > 0 ? stock : Infinity;
}

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(loadCart);

  /* Save every change */
  useEffect(() => {
    saveCart(cartItems);
  }, [cartItems]);

  /* Keep multiple browser tabs in sync */
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setCartItems(loadCart());
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const addToCart = useCallback((product, quantity = 1) => {
    if (!product || product.id === undefined) return;

    const qty = Math.max(1, Math.floor(Number(quantity)) || 1);

    setCartItems((currentItems) => {
      const existing = currentItems.find((item) => item.id === product.id);

      if (existing) {
        const newQty = Math.min(
          existing.quantity + qty,
          getMaxQty({ ...existing, ...product })
        );

        return currentItems.map((item) =>
          item.id === product.id ? { ...item, quantity: newQty } : item
        );
      }

      return [
        ...currentItems,
        {
          ...product,
          price: Number(product.price) || 0,
          quantity: Math.min(qty, getMaxQty(product)),
        },
      ];
    });
  }, []);

  const increaseQuantity = useCallback((productId) => {
    setCartItems((currentItems) =>
      currentItems.map((item) =>
        item.id === productId
          ? { ...item, quantity: Math.min(item.quantity + 1, getMaxQty(item)) }
          : item
      )
    );
  }, []);

  const decreaseQuantity = useCallback((productId) => {
    setCartItems((currentItems) =>
      currentItems
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCartItems((currentItems) =>
      currentItems.filter((item) => item.id !== productId)
    );
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const isInCart = useCallback(
    (productId) => cartItems.some((item) => item.id === productId),
    [cartItems]
  );

  const cartCount = useMemo(
    () => cartItems.reduce((total, item) => total + item.quantity, 0),
    [cartItems]
  );

  const cartTotal = useMemo(
    () =>
      cartItems.reduce(
        (total, item) => total + (Number(item.price) || 0) * item.quantity,
        0
      ),
    [cartItems]
  );

  const value = useMemo(
    () => ({
      cartItems,
      cartCount,
      cartTotal,
      addToCart,
      increaseQuantity,
      decreaseQuantity,
      removeFromCart,
      clearCart,
      isInCart,
    }),
    [
      cartItems,
      cartCount,
      cartTotal,
      addToCart,
      increaseQuantity,
      decreaseQuantity,
      removeFromCart,
      clearCart,
      isInCart,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside <CartProvider>");
  }

  return context;
}