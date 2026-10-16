import { apiRequest } from "./api";

/* The backend returns Mongo documents ({ _id, image, ... }).
   The UI components expect { id, thumbnail, images }, so map them here. */
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
  const data = await apiRequest("/products?limit=100");

  return (data.products || []).map(normalize);
}

export async function getProductById(id) {
  const data = await apiRequest(`/products/${encodeURIComponent(id)}`);

  return normalize(data.product || data);
}

/* ---------- Admin only (backend checks the admin role) ---------- */

const pickFields = (p) => ({
  title: String(p.title || "").trim(),
  description: String(p.description || "").trim(),
  price: Number(p.price),
  category: String(p.category || "").trim(),
  image: String(p.image || "").trim(),
  stock: Number(p.stock),
});

export async function createProduct(product) {
  const data = await apiRequest("/products", {
    method: "POST",
    body: JSON.stringify(pickFields(product)),
  });
  return normalize(data.product);
}

export async function updateProduct(id, product) {
  const data = await apiRequest(`/products/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(pickFields(product)),
  });
  return normalize(data.product);
}

export function deleteProduct(id) {
  return apiRequest(`/products/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
