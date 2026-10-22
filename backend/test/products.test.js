import { describe, it, expect } from "vitest";

describe("Products API", () => {
  it("returns the product list successfully", async () => {
    const response = await fetch("http://localhost:5000/api/products");
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.products)).toBe(true);
    expect(data.count).toBe(data.products.length);
  });

  it("returns a product by its ID", async () => {
    // Use a real product from the list instead of a hard-coded ID,
    // so the test still passes after products are added or deleted.
    const listResponse = await fetch("http://localhost:5000/api/products");
    const listData = await listResponse.json();
    const firstProduct = listData.products[0];

    expect(firstProduct).toBeDefined();

    const response = await fetch(
      `http://localhost:5000/api/products/${firstProduct._id}`
    );
    const data = await response.json();
    const product = data.product || data;

    expect(response.status).toBe(200);
    expect(product._id || product.id).toBe(firstProduct._id);
    expect(product.title).toBe(firstProduct.title);
    expect(product.price).toBe(firstProduct.price);
  });
});