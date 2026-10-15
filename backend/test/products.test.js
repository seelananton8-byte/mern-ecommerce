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
    const response = await fetch(
      "http://localhost:5000/api/products/6acb2910546b64bdad56ab3c"
    );
    const data = await response.json();
    const product = data.product || data;

    expect(response.status).toBe(200);
    expect(product._id || product.id).toBe("6acb2910546b64bdad56ab3c");
    expect(product.title).toBe("Test Product");
    expect(product.price).toBe(2999);
  });
});