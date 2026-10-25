import { backendRequest } from "./api";

/* The backend returns Mongo documents
   The UI components expect  so map them here. */
function normalize(product) {
  if (!product) return product;

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

export async function getProducts() {
  const data = await backendRequest("/products?limit=100");

  return (data.products || []).map(normalize);
}

export async function getProductById(id) {
  const data = await backendRequest(`/products/${encodeURIComponent(id)}`);

  return normalize(data.product || data);
}

/* ---------- Admin only ---------- */

const pickFields = (p) => ({
  title: String(p.title || "").trim(),
  description: String(p.description || "").trim(),
  price: Number(p.price),
  category: String(p.category || "").trim(),
  image: String(p.image || "").trim(),
  stock: Number(p.stock),
});

export async function createProduct(product) {
  const data = await backendRequest("/products", {
    method: "POST",
    body: JSON.stringify(pickFields(product)),
  });
  return normalize(data.product);
}

export async function updateProduct(id, product) {
  const data = await backendRequest(`/products/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(pickFields(product)),
  });
  return normalize(data.product);
}

export function deleteProduct(id) {
  return backendRequest(`/products/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
