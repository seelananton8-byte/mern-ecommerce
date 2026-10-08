import { apiRequest } from "./api";

const CONVERT_USD_TO_INR = true;
const USD_TO_INR_RATE = 85;

function withLocalPrice(product) {
  if (!CONVERT_USD_TO_INR || !product) {
    return product;
  }

  return {
    ...product,
    price: Math.round(Number(product.price || 0) * USD_TO_INR_RATE),
  };
}

export async function getProducts() {
  const data = await apiRequest("/products");

  return (data.products || []).map(withLocalPrice);
}

export async function getProductById(id) {
  const data = await apiRequest(
    `/products/${encodeURIComponent(id)}`
  );

  return withLocalPrice(data);
}