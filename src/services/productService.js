const API_URL = "https://dummyjson.com/products";
const CONVERT_USD_TO_INR = true;
const USD_TO_INR_RATE = 85;

function withLocalPrice(product) {
  if (!CONVERT_USD_TO_INR || !product) return product;

  return {
    ...product,
    price: Math.round(Number(product.price || 0) * USD_TO_INR_RATE),
  };
}

export async function getProducts() {
  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error("Failed to fetch products");
  }

  const data = await response.json();

  return (data.products || []).map(withLocalPrice);
}

export async function getProductById(id) {
  const response = await fetch(`${API_URL}/${encodeURIComponent(id)}`);

  if (!response.ok) {
    throw new Error("Failed to fetch product");
  }

  const data = await response.json();

  return withLocalPrice(data);
}