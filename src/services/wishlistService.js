import { backendRequest } from "./api";

// The backend returns MongoDB documents
function toItem(product) {
  const image = product.image || product.thumbnail || "";

  return {
    ...product,
    id: product._id || product.id,
    thumbnail: image,
    images: Array.isArray(product.images) && product.images.length > 0
      ? product.images
      : image
        ? [image]
        : [],
  };
}

export async function fetchWishlist() {
  const data = await backendRequest("/wishlist");

  return (data.products || []).map(toItem);
}

export function addWishlistItem(productId) {
  return backendRequest(`/wishlist/${encodeURIComponent(productId)}`, {
    method: "POST",
  });
}

export function removeWishlistItem(productId) {
  return backendRequest(`/wishlist/${encodeURIComponent(productId)}`, {
    method: "DELETE",
  });
}

export function mergeWishlist(productIds) {
  return backendRequest("/wishlist/merge", {
    method: "POST",
    body: JSON.stringify({ productIds }),
  });
}